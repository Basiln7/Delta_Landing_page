import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/roles";
import { ownerPasswordStatus } from "@/lib/security/owner";
import { getUser, isActiveUser } from "@/lib/security/users";
import type { AdminRole, AdminUser } from "@/lib/types";

/**
 * Admin authentication.
 *
 * - Accounts live in the `admin_users` collection (see lib/security/users). The owner account's
 *   password comes from the server environment (ADMIN_EMAIL + ADMIN_PASSWORD_HASH); everyone else
 *   sets their own through a one-time invite link.
 * - A session is an HMAC-SHA256-signed token in an httpOnly cookie (`__Host-` prefixed in
 *   production) carrying the user id, `sv` (that user's session version) and `mfa`.
 *   Every request re-reads the user (2 s cache), so disabling, deleting, a role change, a password
 *   reset or "sign out everywhere" takes effect at once.
 * - With 2FA on, the password step only issues a signed 5-minute ticket; the session is created
 *   after a valid authenticator or recovery code (see /api/auth/mfa).
 *
 * Callers use getSession / requireAdmin / requireSuperAdmin / requirePageSession / requireSuperAdminPage.
 */

const isProd = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = isProd ? "__Host-delta_admin" : "delta_admin";
export const MFA_COOKIE = isProd ? "__Host-delta_mfa" : "delta_mfa";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours
const MFA_TICKET_MAX_AGE = 60 * 5; // 5 minutes

/** Values that have been public (README / .env.example / old source) and must never protect production. */
const PLACEHOLDER_SECRETS = new Set(["change-me-to-a-long-random-string-0f3c9a1b7e", "change-me", "secret", "changeme"]);

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

/** For the Security page checklist — booleans only, never values. */
export function authConfigStatus() {
  const s = process.env.SESSION_SECRET?.trim() ?? "";
  return {
    production: isProd,
    sessionSecretStrong: s.length >= 32 && !PLACEHOLDER_SECRETS.has(s),
    ...ownerPasswordStatus(),
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

/** `value.signature` for a small non-session value (e.g. the visitor cookie). Domain-separated by purpose. */
export function signValue(purpose: string, value: string) {
  return `${value}.${sign(purpose, value)}`;
}

/** The value inside a `signValue` token, or null when it's missing, malformed or the signature doesn't match. */
export function readSignedValue(purpose: string, token: string | undefined | null): string | null {
  if (!token || token.length > 256) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const value = token.slice(0, i);
  const expected = Buffer.from(sign(purpose, value));
  const given = Buffer.from(token.slice(i + 1));
  return expected.length === given.length && timingSafeEqual(expected, given) ? value : null;
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

/* ───────────────────────── sessions ───────────────────────── */

/** What the signed cookie carries. */
export interface Session {
  /** admin user id */
  uid: string;
  email: string;
  iat: number;
  exp: number; // unix seconds
  /** the user's session version at sign-in */
  sv: number;
  /** signed in with a second factor */
  mfa: boolean;
}

/** A verified session plus the user's current details (read fresh-ish on every request). */
export interface AdminSession extends Session {
  name: string;
  role: AdminRole;
  owner: boolean;
  twoFactor: boolean;
}

const baseCookie = { httpOnly: true, secure: isProd, path: "/" } as const;

export function createSessionToken(user: Pick<AdminUser, "id" | "email" | "sessionVersion">, mfa: boolean) {
  const now = Math.floor(Date.now() / 1000);
  const session: Session = { uid: user.id, email: user.email, iat: now, exp: now + SESSION_MAX_AGE, sv: user.sessionVersion ?? 1, mfa };
  return issue("session", session);
}

export function verifySessionToken(token: string | undefined | null): Session | null {
  const s = verify<Session>("session", token);
  // Cookies from before user accounts carry no uid: they're rejected (sign in once more).
  if (!s || typeof s.uid !== "string" || typeof s.email !== "string" || typeof s.sv !== "number") return null;
  return s;
}

/** Sets the session cookie for a user (route handlers only). Reads the user fresh, so the token carries the current session version. */
export async function createSession(userId: string, opts: { mfa: boolean }) {
  const user = await getUser(userId, { fresh: true });
  if (!user) throw new Error("Cannot create a session for a missing user");
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user, opts.mfa), {
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

export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!token) return null;
  const user = await getUser(token.uid);
  if (!isActiveUser(user)) return null; // deleted, disabled, or waiting for a password reset
  if (token.sv !== (user.sessionVersion ?? 1)) return null; // revoked
  if (user.totp && !token.mfa) return null; // 2FA was enabled after this session started
  return { ...token, email: user.email, name: user.name, role: user.role, owner: Boolean(user.owner), twoFactor: Boolean(user.totp) };
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "Only super admins can do this." }, { status: 403 });

/** For route handlers: returns a 401 response when not signed in, otherwise null. */
export async function requireAdmin(): Promise<NextResponse | null> {
  return (await getSession()) ? null : unauthorized();
}

/** For route handlers: 401 when not signed in, 403 for anyone but a super admin, otherwise null. */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) return unauthorized();
  return isSuperAdmin(session.role) ? null : forbidden();
}

/** For route handlers that need the session itself. */
export async function sessionOrError(opts: { superAdmin?: boolean } = {}): Promise<{ session: AdminSession } | { response: NextResponse }> {
  const session = await getSession();
  if (!session) return { response: unauthorized() };
  if (opts.superAdmin && !isSuperAdmin(session.role)) return { response: forbidden() };
  return { session };
}

/** For server components / pages: redirects to the login screen when not signed in. */
export async function requirePageSession(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

/** For super-admin pages: admins are sent back to the overview. */
export async function requireSuperAdminPage(): Promise<AdminSession> {
  const session = await requirePageSession();
  if (!isSuperAdmin(session.role)) redirect("/admin");
  return session;
}

/* ───────────────────────── 2FA sign-in ticket ───────────────────────── */

export interface MfaTicket {
  uid: string;
  exp: number;
  /** ticket id — rate limits are counted per ticket */
  jti: string;
}

export async function issueMfaTicket(userId: string) {
  const ticket: MfaTicket = { uid: userId, exp: Math.floor(Date.now() / 1000) + MFA_TICKET_MAX_AGE, jti: randomBytes(12).toString("base64url") };
  const store = await cookies();
  store.set(MFA_COOKIE, issue("mfa-ticket", ticket), { ...baseCookie, sameSite: "strict", maxAge: MFA_TICKET_MAX_AGE });
}

export async function readMfaTicket(): Promise<MfaTicket | null> {
  const store = await cookies();
  const t = verify<MfaTicket>("mfa-ticket", store.get(MFA_COOKIE)?.value);
  return t && typeof t.uid === "string" && typeof t.jti === "string" ? t : null;
}

export async function clearMfaTicket() {
  expire(await cookies(), MFA_COOKIE, "strict");
}
