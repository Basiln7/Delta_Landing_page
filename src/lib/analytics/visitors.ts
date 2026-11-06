import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Collection } from "mongodb";
import { cookies } from "next/headers";
import { readSignedValue, signValue } from "@/lib/auth";
import { mongoDatabase } from "@/lib/db/mongo-store";

/**
 * First-party unique-visitor tracking (MongoDB only).
 *
 *   visitors  { _id: sha256(deviceId), firstSeen, firstDay, lastSeen, registered?, registeredAt?, staff? }
 *             one per device, ever. Pseudonymous: no IP, no user agent, no personal details.
 *   visits    { _id: "<day>:<visitor>", day, month, vid, firstAt, lastAt, pageviews, path, referrer?,
 *               utm?, device, registered, staff, expireAt }
 *             one per device per day (India time); expires after 400 days.
 *
 * "Registered" = this device submitted a checkout or an enquiry. "Staff" = a signed-in admin used
 * it; staff devices are left out of every count.
 */

export const VISITOR_COOKIE = "delta_vid";
/** Browsers cap cookie lifetime at 400 days. */
export const VISITOR_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
export const STATS_TIME_ZONE = "Asia/Kolkata";
const RETENTION_MS = 400 * 86_400_000;
const PURPOSE = "visitor";

export type Device = "mobile" | "tablet" | "desktop";
export type Utm = { source?: string; medium?: string; campaign?: string };

type VisitorDoc = { _id: string; firstSeen: Date; firstDay: string; lastSeen: Date; registered?: boolean; registeredAt?: Date; staff?: boolean };
type VisitDoc = {
  _id: string;
  day: string;
  month: string;
  vid: string;
  firstAt: Date;
  lastAt: Date;
  pageviews: number;
  path: string;
  referrer?: string;
  utm?: Utm;
  device: Device;
  registered: boolean;
  staff: boolean;
  expireAt: Date;
};

export const trackingAvailable = () => Boolean(process.env.MONGODB_URI?.trim());

/* ───────────────────────── device id (signed cookie) ───────────────────────── */

export const newVisitorId = () => randomBytes(16).toString("base64url"); // 128 bits, 22 chars
export const visitorCookieValue = (id: string) => signValue(PURPOSE, id);

/** The device id from the cookie, or null if it's missing or wasn't issued by this server. */
export function readVisitorId(cookieValue: string | undefined | null): string | null {
  const id = readSignedValue(PURPOSE, cookieValue);
  return id && /^[A-Za-z0-9_-]{22}$/.test(id) ? id : null;
}

/** What's stored: a hash, so the database never holds a usable cookie value. */
const storedId = (id: string) => createHash("sha256").update(id).digest("base64url").slice(0, 32);

/* ───────────────────────── days (India time) ───────────────────────── */

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: STATS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
/** "2026-11-06" in India time. */
export const dayKey = (d = new Date()) => dayFormat.format(d);
const labelFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLabel = (day: string) => labelFormat.format(new Date(`${day}T12:00:00Z`));

/* ───────────────────────── storage ───────────────────────── */

let indexed: Promise<unknown> | null = null;

async function collections(): Promise<{ visitors: Collection<VisitorDoc>; visits: Collection<VisitDoc> }> {
  const db = await mongoDatabase();
  const visitors = db.collection<VisitorDoc>("visitors");
  const visits = db.collection<VisitDoc>("visits");
  indexed ??= Promise.all([
    visits.createIndexes([
      { key: { day: 1 }, name: "day" },
      { key: { month: 1, vid: 1 }, name: "month_vid" },
      { key: { expireAt: 1 }, name: "ttl", expireAfterSeconds: 0 },
    ]),
    visitors.createIndexes([
      { key: { firstDay: 1 }, name: "firstDay" },
      { key: { staff: 1 }, name: "staff", sparse: true },
    ]),
  ]).catch((err) => {
    indexed = null;
    throw err;
  });
  await indexed;
  return { visitors, visits };
}

export type VisitInput = { visitorId: string; path: string; referrer?: string; utm?: Utm; device: Device; staff: boolean };

/** Count one page view: create/refresh the device and today's visit (two small upserts). */
export async function recordVisit(v: VisitInput) {
  const { visitors, visits } = await collections();
  const now = new Date();
  const day = dayKey(now);
  const vid = storedId(v.visitorId);

  const visitor = await visitors.findOneAndUpdate(
    { _id: vid },
    { $setOnInsert: { firstSeen: now, firstDay: day }, $set: { lastSeen: now, ...(v.staff ? { staff: true } : {}) } },
    { upsert: true, returnDocument: "after" },
  );

  await visits.updateOne(
    { _id: `${day}:${vid}` },
    {
      $setOnInsert: {
        day,
        month: day.slice(0, 7),
        vid,
        firstAt: now,
        path: v.path,
        device: v.device,
        expireAt: new Date(now.getTime() + RETENTION_MS),
        ...(v.referrer ? { referrer: v.referrer } : {}),
        ...(v.utm ? { utm: v.utm } : {}),
      },
      $set: { lastAt: now, registered: Boolean(visitor?.registered), staff: Boolean(visitor?.staff) },
      $inc: { pageviews: 1 },
    },
    { upsert: true },
  );
}

/** A checkout or enquiry came from this device: count it as Registered from now on (today included). */
export async function markVisitorRegistered(visitorId: string) {
  if (!trackingAvailable()) return;
  const { visitors, visits } = await collections();
  const now = new Date();
  const vid = storedId(visitorId);
  const r = await visitors.updateOne({ _id: vid }, { $set: { registered: true }, $min: { registeredAt: now } });
  if (r.matchedCount) await visits.updateOne({ _id: `${dayKey(now)}:${vid}` }, { $set: { registered: true } });
}

/**
 * For checkout / enquiry route handlers: read this request's visitor cookie now, and mark the device
 * Registered after the response is sent (never slows the form down, never fails it).
 */
export async function registerVisitorAfterResponse(schedule: (task: () => Promise<void>) => void) {
  const id = readVisitorId((await cookies()).get(VISITOR_COOKIE)?.value);
  if (!id || !trackingAvailable()) return;
  schedule(() => markVisitorRegistered(id).catch((err) => console.error("[visitors] could not mark a visitor registered", err)));
}

/* ───────────────────────── admin stats ───────────────────────── */

export type VisitorStats =
  | { available: false }
  | {
      available: true;
      timeZone: string;
      today: number;
      month: number;
      allTime: number;
      registeredToday: number;
      otherToday: number;
      newToday: number;
      staffToday: number;
      series: { label: string; value: number }[];
    };

/**
 * KPIs for the admin Overview. Every count excludes staff devices.
 * Uses the `day`, `month_vid` and `firstDay` indexes; the 14-day series is one grouped scan of ≤14 days.
 */
export async function visitorStats(days = 14): Promise<VisitorStats> {
  if (!trackingAvailable()) return { available: false };
  const { visitors, visits } = await collections();
  const now = new Date();
  const today = dayKey(now);
  const month = today.slice(0, 7);
  // India has no daylight saving, so stepping back 24 h always lands on the previous day.
  const dayList = Array.from({ length: days }, (_, i) => dayKey(new Date(now.getTime() - (days - 1 - i) * 86_400_000)));
  const notStaff = { staff: { $ne: true } };

  const [allTime, todayCount, registeredToday, staffToday, newToday, monthRows, seriesRows] = await Promise.all([
    visitors.countDocuments(notStaff),
    visits.countDocuments({ day: today, ...notStaff }),
    visits.countDocuments({ day: today, registered: true, ...notStaff }),
    visits.countDocuments({ day: today, staff: true }),
    visitors.countDocuments({ firstDay: today, ...notStaff }),
    visits.aggregate<{ n: number }>([{ $match: { month, ...notStaff } }, { $group: { _id: "$vid" } }, { $count: "n" }]).toArray(),
    visits.aggregate<{ _id: string; n: number }>([{ $match: { day: { $gte: dayList[0] }, ...notStaff } }, { $group: { _id: "$day", n: { $sum: 1 } } }]).toArray(),
  ]);

  const byDay = new Map(seriesRows.map((r) => [r._id, r.n]));
  return {
    available: true,
    timeZone: STATS_TIME_ZONE,
    today: todayCount,
    month: monthRows[0]?.n ?? 0,
    allTime,
    registeredToday,
    otherToday: todayCount - registeredToday,
    newToday,
    staffToday,
    series: dayList.map((d) => ({ label: dayLabel(d), value: byDay.get(d) ?? 0 })),
  };
}
