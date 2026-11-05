import { NextResponse, type NextRequest } from "next/server";
import { adminCsp } from "@/lib/security/csp";

/**
 * Edge of the app (Next 16 "proxy", formerly middleware). Two jobs:
 *
 * 1. CSRF defence for the API: browsers always send Origin (and Sec-Fetch-Site) on cross-site
 *    requests, so any POST/PUT/PATCH/DELETE to /api/* from another site is rejected before it
 *    reaches a route. This backs up the SameSite=Lax session cookie. The Razorpay webhook is
 *    exempt — it's server-to-server and authenticated by its HMAC signature.
 *
 * 2. Strict CSP for the admin: a fresh nonce per request; Next.js attaches it to its own scripts.
 *
 * Authorisation is NOT done here — every route and page still checks the session itself
 * (Next.js data-security guidance: never rely on proxy alone).
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT = ["/api/webhooks/"];

function expectedHost(req: NextRequest) {
  return req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || req.nextUrl.host;
}

function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    if (origin === "null") return false;
    try {
      const o = new URL(origin);
      if (o.host === expectedHost(req)) return true;
      const configured = process.env.NEXT_PUBLIC_SITE_URL;
      return Boolean(configured) && new URL(configured!).origin === o.origin;
    } catch {
      return false;
    }
  }
  // No Origin: only browsers send Sec-Fetch-Site; non-browser clients (curl, servers) carry no ambient cookies.
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (!SAFE_METHODS.has(req.method) && !CSRF_EXEMPT.some((p) => pathname.startsWith(p)) && !isSameOrigin(req)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  // /admin pages: per-request nonce CSP.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = adminCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: [
    "/api/:path*",
    {
      source: "/admin/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/admin",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
