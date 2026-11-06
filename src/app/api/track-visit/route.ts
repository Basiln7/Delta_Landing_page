import { after, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  newVisitorId,
  readVisitorId,
  recordVisit,
  trackingAvailable,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  visitorCookieValue,
  type Device,
  type Utm,
} from "@/lib/analytics/visitors";
import { consume, LIMITS } from "@/lib/security/rate-limit";
import { clientIp, readJson } from "@/lib/security/request";

/**
 * Public page-view ping from the landing page (see components/site/VisitTracker).
 * Same-origin only (proxy.ts CSRF check), 1 KB body cap, validated input, bots and opt-outs ignored,
 * rate-limited per IP. Always answers 204 straight away; the database writes run after the response.
 */

const isProd = process.env.NODE_ENV === "production";
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python|java\/|okhttp|go-http|axios|phantom|selenium|puppeteer|playwright/i;

const short = z.string().max(120).optional();
const schema = z.object({
  path: z.string().max(300).optional(),
  referrer: z.string().max(1000).optional(),
  utm: z.object({ source: short, medium: short, campaign: short }).optional(),
});

const done = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

function cleanPath(p?: string) {
  return p && /^\/[\w\-./~%]*$/.test(p) ? p.slice(0, 200) : "/";
}

/** Referring site's host only (no path or query), and nothing for internal navigation. */
function referrerHost(ref: string | undefined, req: Request) {
  if (!ref) return undefined;
  try {
    const u = new URL(ref);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    const ownHost = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || "";
    if (u.host === ownHost) return undefined;
    return u.hostname.toLowerCase().replace(/^www\./, "").slice(0, 100) || undefined;
  } catch {
    return undefined;
  }
}

function cleanUtm(utm?: { source?: string; medium?: string; campaign?: string }): Utm | undefined {
  if (!utm) return undefined;
  const clean = (v?: string) => v?.toLowerCase().replace(/[^\w\-.+ ]/g, "").trim().slice(0, 80) || undefined;
  const out: Utm = { source: clean(utm.source), medium: clean(utm.medium), campaign: clean(utm.campaign) };
  return out.source || out.medium || out.campaign ? JSON.parse(JSON.stringify(out)) : undefined;
}

function deviceOf(ua: string): Device {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "mobile";
  return "desktop";
}

export async function POST(req: Request) {
  if (!trackingAvailable()) return done();
  // Opt-outs are honoured here too, not just in the browser script.
  if (req.headers.get("sec-gpc") === "1" || req.headers.get("dnt") === "1") return done();
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return done();

  const ip = clientIp(req);
  if (!(await consume(LIMITS.trackIp(ip))).ok) return done(); // over the limit: dropped silently

  const body = await readJson(req, 1024);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const store = await cookies();
  let id = readVisitorId(store.get(VISITOR_COOKIE)?.value);
  if (!id) {
    // New devices are limited separately, so made-up or cleared cookies can't inflate the counts.
    if (!(await consume(LIMITS.trackNewIp(ip))).ok) return done();
    id = newVisitorId();
  }
  // (Re)issue on every visit: a sliding 400-day lifetime. Path=/api keeps it off page and asset requests.
  store.set(VISITOR_COOKIE, visitorCookieValue(id), { httpOnly: true, secure: isProd, sameSite: "lax", path: "/api", maxAge: VISITOR_COOKIE_MAX_AGE });

  const staff = Boolean(await getSession().catch(() => null));
  const visit = {
    visitorId: id,
    path: cleanPath(parsed.data.path),
    referrer: referrerHost(parsed.data.referrer, req),
    utm: cleanUtm(parsed.data.utm),
    device: deviceOf(ua),
    staff,
  };
  after(() => recordVisit(visit).catch((err) => console.error("[visitors] could not record a visit", err)));
  return done();
}
