import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { hashPassword, isPasswordHash, verifyPasswordHash } from "./password";

/**
 * The owner account: the super admin defined on the server by ADMIN_EMAIL + ADMIN_PASSWORD_HASH
 * (or ADMIN_PASSWORD). Its password always comes from the environment, so whoever controls the
 * server can always get back in. Production refuses placeholder or weak values.
 */

const isProd = process.env.NODE_ENV === "production";

/** Values that have been public (README / .env.example / old source) and must never protect production. */
export const PLACEHOLDER_PASSWORDS = new Set(["delta-admin-2026", "admin", "password", "changeme", "change-me"]);
const DEV_FALLBACK = { email: "admin@delta.academy", password: "delta-admin-2026" };

/** Owner email from the environment (development falls back to the demo address). */
export function ownerEmail(): string {
  return (process.env.ADMIN_EMAIL?.trim() || (isProd ? "" : DEV_FALLBACK.email)).toLowerCase();
}

type OwnerCredentials = { email: string; password?: string; passwordHash?: string };

/** Usable owner credentials, or null when the owner can't sign in (missing, weak or malformed). */
export function ownerCredentials(): OwnerCredentials | null {
  const email = ownerEmail();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim() || undefined;
  const password = process.env.ADMIN_PASSWORD || (isProd ? undefined : DEV_FALLBACK.password);
  if (!email || (!password && !passwordHash)) return null;
  if (passwordHash && !isPasswordHash(passwordHash)) {
    // Fail closed instead of silently rejecting every password.
    console.error(
      '[auth] Owner sign-in disabled: ADMIN_PASSWORD_HASH is not a valid hash. If it was cut short after "scrypt", ' +
        "the $ signs were read as variables — run `npm run hash-password` again and paste the new (colon-separated) line.",
    );
    return null;
  }
  if (isProd && !passwordHash && password && (password.length < 12 || PLACEHOLDER_PASSWORDS.has(password))) {
    console.error("[auth] Owner sign-in disabled: ADMIN_PASSWORD is a placeholder or shorter than 12 characters. Set ADMIN_PASSWORD_HASH (npm run hash-password) or a strong ADMIN_PASSWORD.");
    return null;
  }
  return { email, password, passwordHash };
}

/* ───────── constant work per sign-in attempt ───────── */

const g = globalThis as unknown as { __deltaDummyHash?: string };

/**
 * Run one scrypt verification against a throwaway hash. Every sign-in attempt does exactly one
 * scrypt, whether or not the account exists, so response time doesn't reveal valid emails.
 */
export function burnPasswordCheck(password: string) {
  g.__deltaDummyHash ??= hashPassword(randomBytes(16).toString("base64url"));
  verifyPasswordHash(password, g.__deltaDummyHash);
}

function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

/** Check the owner's password (one scrypt either way). */
export function verifyOwnerPassword(password: string): boolean {
  const creds = ownerCredentials();
  if (!creds) {
    burnPasswordCheck(password);
    return false;
  }
  if (creds.passwordHash) return verifyPasswordHash(password, creds.passwordHash);
  burnPasswordCheck(password);
  return safeEqual(password, creds.password ?? "");
}

/** For the Security page checklist — booleans only, never values. */
export function ownerPasswordStatus() {
  const pw = process.env.ADMIN_PASSWORD ?? "";
  const hash = process.env.ADMIN_PASSWORD_HASH?.trim() ?? "";
  const passwordHashed = Boolean(hash) && isPasswordHash(hash);
  return {
    passwordHashed,
    passwordHashInvalid: Boolean(hash) && !passwordHashed,
    passwordStrong: passwordHashed || (!hash && pw.length >= 12 && !PLACEHOLDER_PASSWORDS.has(pw)),
  };
}
