import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

/**
 * Mock-but-proper admin auth.
 * A session is a base64url JSON payload signed with HMAC-SHA256, stored in an httpOnly cookie.
 * Swap for Auth.js / Clerk in production — callers only use getSession / requireAdmin / requirePageSession.
 */

export const SESSION_COOKIE = "delta_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Demo fallbacks mirror .env.example so a fresh clone works. Disabled in production.
const DEMO = {
  email: "admin@delta.academy",
  password: "delta-admin-2026",
  secret: "change-me-to-a-long-random-string-0f3c9a1b7e",
};

const isProd = process.env.NODE_ENV === "production";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (isProd) throw new Error("SESSION_SECRET must be set in production");
  return DEMO.secret;
}

function credentials() {
  const email = process.env.ADMIN_EMAIL ?? (isProd ? undefined : DEMO.email);
  const password = process.env.ADMIN_PASSWORD ?? (isProd ? undefined : DEMO.password);
  return email && password ? { email, password } : null;
}

export interface Session {
  email: string;
  exp: number; // unix seconds
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Constant-time string comparison that doesn't leak length. */
export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyCredentials(email: string, password: string) {
  const creds = credentials();
  if (!creds) return false;
  // Evaluate both comparisons to avoid short-circuit timing differences.
  const emailOk = safeEqual(email.trim().toLowerCase(), creds.email.toLowerCase());
  const passOk = safeEqual(password, creds.password);
  return emailOk && passOk;
}

export function createSessionToken(email: string) {
  const session: Session = { email, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS };
  const payload = b64url(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (typeof session.email !== "string" || typeof session.exp !== "number") return null;
    if (session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Sets the session cookie (route handlers / server actions only). */
export async function createSession(email: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** For route handlers: returns a 401 response when not signed in, otherwise null. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

/** For server components / pages: redirects to the login screen when not signed in. */
export async function requirePageSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}
