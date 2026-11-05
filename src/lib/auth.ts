import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { readSecurity } from "@/lib/db";
import { verifyPasswordHash } from "@/lib/security/password";
import type { AdminSecurity } from "@/lib/types";

/**
 * Admin authentication.
 *
 * - Credentials come from the environment: ADMIN_EMAIL + ADMIN_PASSWORD_HASH (scrypt, preferred)
 *   or ADMIN_PASSWORD. Production refuses placeholder or weak values and placeholder/short secrets.
 * - A session is an HMAC-SHA256-signed token in an httpOnly cookie (`__Host-` prefixed in
 *   production). It carries `sv` (session version) and `mfa`. Every request checks `sv` against
 *   the stored security state, so "sign out everywhere" and 2FA changes revoke old cookies at once.
 * - With 2FA on, the password step only issues a signed 5-minute ticket; the session is created
 *   after a valid authenticator or recovery code (see /api/auth/mfa).
 *
 * Callers only use getSession / requireAdmin / requirePageSession (+ the login routes).
 */

const isProd = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = isProd ? "__Host-delta_admin" : "delta_admin";
export const MFA_COOKIE = isProd ? "__Host-delta_mfa" : "delta_mfa";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours
const MFA_TICKET_MAX_AGE = 60 * 5; // 5 minutes

/** Values that have been public (README / .env.example / old source) and must never protect production. */
const PLACEHOLDER_SECRETS = new Set(["change-me-to-a-long-random-string-0f3c9a1b7e", "change-me", "secret", "changeme"]);
const PLACEHOLDER_PASSWORDS = new Set(["delta-admin-2026", "admin", "password", "changeme", "change-me"]);
const DEV_FALLBACK = { email: "admin@delta.academy", password: "delta-admin-2026" };

/* ───────────────────────── configuration ───────────────────────── */

const g = globalThis as unknown as { __deltaDevSessionSecret?: string; __deltaAuthWarned?: boolean };

function secret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (isProd) {
    if (!s || s.length < 32 || PLACEHOLDER_SECRETS.has(s)) {
      throw new Error("SESSION_SECRET must be a random value of at least 32 characters in production (not the .env.example placeholder).");
    }
    return s;
  }
  if (s && !PLACEHOLDER_SECRETS.has(s)) return s;
  // Development: never a hard-coded secret. A random per-process key (sessions reset on restart).
  g.__deltaDevSessionSecret ??= randomBytes(32).toString("base64url");
  if (!g.__deltaAuthWarned) {
    console.warn("[auth] SESSION_SECRET is missing or a placeholder — using a random development key. Set one in .env.local.");
    g.__deltaAuthWarned = true;
  }
  return g.__deltaDevSessionSecret;
}

type Credentials = { email: string; password?: string; passwordHash?: string };

function credentials(): Credentials | null {
  const email = (process.env.ADMIN_EMAIL?.trim() || (isProd ? "" : DEV_FALLBACK.email)).toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim() || undefined;
  const password = process.env.ADMIN_PASSWORD || (isProd ? undefined : DEV_FALLBACK.password);
  if (!email || (!password && !passwordHash)) return null;
  if (isProd && !passwordHash && password && (password.length < 12 || PLACEHOLDER_PASSWORDS.has(password))) {
    console.error("[auth] Admin sign-in disabled: ADMIN_PASSWORD is a placeholder or shorter than 12 characters. Set ADMIN_PASSWORD_HASH (npm run hash-password) or a strong ADMIN_PASSWORD.");
    return null;
  }
  return { email, password, passwordHash };
}

export function adminSignInConfigured() {
  return credentials() !== null;
}

/** For the Security page checklist — booleans only, never values. */
export function authConfigStatus() {
  const s = process.env.SESSION_SECRET?.trim() ?? "";
  const pw = process.env.ADMIN_PASSWORD ?? "";
  return {
    production: isProd,
    sessionSecretStrong: s.length >= 32 && !PLACEHOLDER_SECRETS.has(s),
    passwordHashed: Boolean(process.env.ADMIN_PASSWORD_HASH?.trim()),
    passwordStrong: Boolean(process.env.ADMIN_PASSWORD_HASH?.trim()) || (pw.length >= 12 && !PLACEHOLDER_PASSWORDS.has(pw)),
  };
}

/* ───────────────────────── primitives ───────────────────────── */

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** Domain-separated signature: a session token can never be replayed as an MFA ticket or vice versa. */
function sign(purpose: string, payload: string) {
  return createHmac("sha256", secret()).update(`${purpose}.${payload}`).digest("base64url");
}

/** Constant-time string comparison that doesn't leak length. */
export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function issue(purpose: string, data: object) {
  const payload = b64url(JSON.stringify(data));
  return `${payload}.${sign(purpose, payload)}`;
}

function verify<T extends { exp: number }>(purpose: string, token: string | undefined | null): T | null {
  if (!token || token.length > 2048) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(purpose, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
    if (typeof data.exp !== "number" || data.exp * 1000 < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function verifyCredentials(email: string, password: string) {
  const creds = credentials();
  if (!creds) {
    // Still spend comparable time so "not configured" isn't distinguishable by timing.
    safeEqual(password, "x");
    return false;
  }
  const emailOk = safeEqual(email.trim().toLowerCase(), creds.email);
  const passOk = creds.passwordHash ? verifyPasswordHash(password, creds.passwordHash) : safeEqual(password, creds.password ?? "");
  return emailOk && passOk;
}

/* ───────────────────────── security state (cached briefly) ───────────────────────── */

// Process-wide (globalThis) so every route bundle shares one cache and one invalidation.
const cacheHolder = globalThis as unknown as { __deltaSecurityCache?: { at: number; value: AdminSecurity } | null };
const SECURITY_CACHE_MS = 2000;

/**
 * Stored 2FA + session-version state. Request-path session checks may use a 2-second cache (a page
 * render calls getSession several times). Security DECISIONS — whether sign-in needs a code — pass
 * `fresh: true`. Other servers see changes within the cache window.
 */
export async function getSecurityState(opts: { fresh?: boolean } = {}): Promise<AdminSecurity> {
  const cached = cacheHolder.__deltaSecurityCache;
  if (!opts.fresh && cached && Date.now() - cached.at < SECURITY_CACHE_MS) return cached.value;
  const value = (await readSecurity()) ?? { sessionVersion: 1 };
  cacheHolder.__deltaSecurityCache = { at: Date.now(), value };
  return value;
}

export function invalidateSecurityCache() {
  cacheHolder.__deltaSecurityCache = null;
}

/* ───────────────────────── sessions ───────────────────────── */

export interface Session {
  email: string;
  iat: number;
  exp: number; // unix seconds
  /** session version at sign-in */
  sv: number;
  /** signed in with a second factor */
  mfa: boolean;
}

const baseCookie = { httpOnly: true, secure: isProd, path: "/" } as const;

export function createSessionToken(email: string, opts: { sv: number; mfa: boolean }) {
  const now = Math.floor(Date.now() / 1000);
  const session: Session = { email, iat: now, exp: now + SESSION_MAX_AGE, sv: opts.sv, mfa: opts.mfa };
  return issue("session", session);
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  const s = verify<Session>("session", token);
  if (!s || typeof s.email !== "string" || typeof s.sv !== "number") return null;
  return s;
}

/** Sets the session cookie (route handlers / server actions only). */
export async function createSession(email: string, opts: { mfa: boolean }) {
  const security = await getSecurityState({ fresh: true });
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(email, { sv: security.sessionVersion ?? 1, mfa: opts.mfa }), {
    ...baseCookie,
    sameSite: "lax", // lax so links from notification emails open the admin while signed in
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Expire a cookie with the SAME attributes it was set with. Browsers ignore a Set-Cookie for a
 * `__Host-` cookie unless it has Secure + Path=/, so a bare delete() would silently keep the
 * session alive in production.
 */
function expire(store: Awaited<ReturnType<typeof cookies>>, name: string, sameSite: "lax" | "strict") {
  store.set(name, "", { ...baseCookie, sameSite, maxAge: 0, expires: new Date(0) });
}

export async function destroySession() {
  const store = await cookies();
  expire(store, SESSION_COOKIE, "lax");
  expire(store, MFA_COOKIE, "strict");
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const security = await getSecurityState();
  if (session.sv !== (security.sessionVersion ?? 1)) return null; // revoked
  if (security.totp && !session.mfa) return null; // 2FA was enabled after this session started
  return session;
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

/* ───────────────────────── 2FA sign-in ticket ───────────────────────── */

export interface MfaTicket {
  email: string;
  exp: number;
  /** ticket id — rate limits are counted per ticket */
  jti: string;
}

export async function issueMfaTicket(email: string) {
  const ticket: MfaTicket = { email, exp: Math.floor(Date.now() / 1000) + MFA_TICKET_MAX_AGE, jti: randomBytes(12).toString("base64url") };
  const store = await cookies();
  store.set(MFA_COOKIE, issue("mfa-ticket", ticket), { ...baseCookie, sameSite: "strict", maxAge: MFA_TICKET_MAX_AGE });
}

export async function readMfaTicket(): Promise<MfaTicket | null> {
  const store = await cookies();
  const t = verify<MfaTicket>("mfa-ticket", store.get(MFA_COOKIE)?.value);
  return t && typeof t.email === "string" && typeof t.jti === "string" ? t : null;
}

export async function clearMfaTicket() {
  expire(await cookies(), MFA_COOKIE, "strict");
}
