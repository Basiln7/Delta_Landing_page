import "server-only";
import crypto from "node:crypto";
import type { Collection } from "mongodb";
import { mongoDatabase } from "@/lib/db/mongo-store";

/**
 * Fixed-window rate limiter.
 *
 * Storage: MongoDB `rate_limits` when MONGODB_URI is set (one atomic findOneAndUpdate per hit,
 * expired windows removed by a TTL index), so limits survive restarts and are shared by every
 * server instance. Without MongoDB it falls back to process memory.
 *
 * If the store is unreachable the limiter fails OPEN (allows the request) and logs: an outage of
 * the counter store shouldn't take down sign-in or checkout.
 */

export type Rule = { key: string; limit: number; windowMs: number };
export type Verdict = { ok: boolean; count: number; retryAfter: number };

/** Hash identifiers (emails, IPs) so the counter store never holds personal data in clear text. */
export function bucket(name: string, ...parts: string[]) {
  const id = crypto.createHash("sha256").update(parts.join("\u0000").toLowerCase()).digest("base64url").slice(0, 22);
  return `${name}:${id}`;
}

/* ───────── memory store ───────── */

const mem = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;
function memHit(key: string, windowMs: number, now: number) {
  if (now - lastSweep > 60_000) {
    for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k);
    lastSweep = now;
  }
  const cur = mem.get(key);
  const next = cur && cur.resetAt > now ? { count: cur.count + 1, resetAt: cur.resetAt } : { count: 1, resetAt: now + windowMs };
  mem.set(key, next);
  return next;
}

/* ───────── mongo store ───────── */

type Doc = { _id: string; count: number; resetAt: Date };
let indexed: Promise<unknown> | null = null;

async function collection(): Promise<Collection<Doc> | null> {
  if (!process.env.MONGODB_URI?.trim()) return null;
  const db = await mongoDatabase();
  const col = db.collection<Doc>("rate_limits");
  indexed ??= col.createIndex({ resetAt: 1 }, { name: "ttl", expireAfterSeconds: 0 }).catch((err) => {
    indexed = null;
    throw err;
  });
  await indexed;
  return col;
}

async function hit(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
  const now = Date.now();
  const col = await collection();
  if (!col) return memHit(key, windowMs, now);
  const nowDate = new Date(now);
  const live = { $gt: ["$resetAt", nowDate] };
  // Atomic: increment inside a live window, otherwise start a new one.
  const doc = await col.findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          count: { $cond: [live, { $add: ["$count", 1] }, 1] },
          resetAt: { $cond: [live, "$resetAt", new Date(now + windowMs)] },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );
  return { count: doc?.count ?? 1, resetAt: doc?.resetAt?.getTime() ?? now + windowMs };
}

async function read(key: string): Promise<{ count: number; resetAt: number } | null> {
  const now = Date.now();
  const col = await collection();
  if (!col) {
    const cur = mem.get(key);
    return cur && cur.resetAt > now ? cur : null;
  }
  const doc = await col.findOne({ _id: key, resetAt: { $gt: new Date(now) } });
  return doc ? { count: doc.count, resetAt: doc.resetAt.getTime() } : null;
}

const retry = (resetAt: number) => Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

/** Count this request and say whether it is within the limit. */
export async function consume(rule: Rule): Promise<Verdict> {
  try {
    const { count, resetAt } = await hit(rule.key, rule.windowMs);
    return { ok: count <= rule.limit, count, retryAfter: count <= rule.limit ? 0 : retry(resetAt) };
  } catch (err) {
    console.error("[rate-limit] store unavailable, allowing request", err);
    return { ok: true, count: 0, retryAfter: 0 };
  }
}

/** Check without counting — for "failures only" limits such as wrong passwords. */
export async function peek(rule: Rule): Promise<Verdict> {
  try {
    const cur = await read(rule.key);
    const count = cur?.count ?? 0;
    return { ok: count < rule.limit, count, retryAfter: count < rule.limit || !cur ? 0 : retry(cur.resetAt) };
  } catch (err) {
    console.error("[rate-limit] store unavailable, allowing request", err);
    return { ok: true, count: 0, retryAfter: 0 };
  }
}

/** Consume several rules; the first one that's exceeded wins. */
export async function consumeAll(rules: Rule[]): Promise<Verdict> {
  let worst: Verdict = { ok: true, count: 0, retryAfter: 0 };
  for (const r of rules) {
    const v = await consume(r);
    if (!v.ok && v.retryAfter >= worst.retryAfter) worst = v;
  }
  return worst;
}

export async function resetLimit(key: string) {
  try {
    const col = await collection();
    if (col) await col.deleteOne({ _id: key });
    else mem.delete(key);
  } catch (err) {
    console.error("[rate-limit] reset failed", err);
  }
}

const MIN = 60_000;

/** Every limit in one place, so they're easy to review and tune. */
export const LIMITS = {
  loginIp: (ip: string): Rule => ({ key: bucket("login-ip", ip), limit: 10, windowMs: 15 * MIN }),
  loginAccount: (email: string): Rule => ({ key: bucket("login-acct", email), limit: 30, windowMs: 60 * MIN }),
  mfaTicket: (ticketId: string): Rule => ({ key: bucket("mfa-ticket", ticketId), limit: 5, windowMs: 10 * MIN }),
  mfaIp: (ip: string): Rule => ({ key: bucket("mfa-ip", ip), limit: 20, windowMs: 15 * MIN }),
  enquiryIp: (ip: string): Rule => ({ key: bucket("enq-ip", ip), limit: 5, windowMs: 10 * MIN }),
  enquiryEmail: (email: string): Rule => ({ key: bucket("enq-email", email), limit: 3, windowMs: 60 * MIN }),
  checkoutIp: (ip: string): Rule => ({ key: bucket("checkout-ip", ip), limit: 15, windowMs: 10 * MIN }),
  paymentCallbackIp: (ip: string): Rule => ({ key: bucket("pay-cb-ip", ip), limit: 40, windowMs: 10 * MIN }),
  mailTest: (admin: string): Rule => ({ key: bucket("mail-test", admin), limit: 5, windowMs: MIN }),
  mailVerify: (admin: string): Rule => ({ key: bucket("mail-verify", admin), limit: 10, windowMs: MIN }),
  securityAction: (admin: string): Rule => ({ key: bucket("sec-action", admin), limit: 10, windowMs: 10 * MIN }),
  userAdmin: (admin: string): Rule => ({ key: bucket("user-admin", admin), limit: 30, windowMs: 10 * MIN }),
  inviteIp: (ip: string): Rule => ({ key: bucket("invite-ip", ip), limit: 20, windowMs: 15 * MIN }),
};
