import "server-only";
import crypto from "node:crypto";

/**
 * Admin password hashing (scrypt). Lets production keep only a hash in the environment
 * (ADMIN_PASSWORD_HASH) instead of the plaintext password. Generate with `npm run hash-password`.
 *
 * Format: scrypt:<N>:<r>:<p>:<salt b64url>:<hash b64url>
 * Colons, not "$": Next.js expands "$NAME" inside .env files, which would cut a "$"-separated hash
 * down to just "scrypt". The older "$" form (as a real environment variable, or "\$"-escaped in a
 * .env file) is still accepted.
 */

const KEYLEN = 32;
const MAXMEM = 64 * 1024 * 1024;

export function hashPassword(password: string, N = 2 ** 15, r = 8, p = 1) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join(":");
}

type ParsedHash = { N: number; r: number; p: number; salt: Buffer; hash: Buffer };

function parse(stored: string): ParsedHash | null {
  const parts = stored.trim().split(/\\?\$|:/);
  if (parts.length !== 6) return null;
  const [alg, n, r, p, salt, hash] = parts;
  const N = Number(n), R = Number(r), P = Number(p);
  const ints = [N, R, P].every((v) => Number.isSafeInteger(v) && v >= 1);
  if (alg !== "scrypt" || !ints || N < 2 || (N & (N - 1)) !== 0 || !salt || !hash) return null;
  const parsed = { N, r: R, p: P, salt: Buffer.from(salt, "base64url"), hash: Buffer.from(hash, "base64url") };
  return parsed.salt.length >= 8 && parsed.hash.length >= 16 ? parsed : null;
}

/** True when the value is a well-formed hash (catches one mangled by "$" expansion in a .env file). */
export function isPasswordHash(stored: string) {
  return parse(stored) !== null;
}

export function verifyPasswordHash(password: string, stored: string) {
  const h = parse(stored);
  if (!h) return false;
  try {
    const actual = crypto.scryptSync(password.normalize("NFKC"), h.salt, h.hash.length, { N: h.N, r: h.r, p: h.p, maxmem: MAXMEM });
    return crypto.timingSafeEqual(actual, h.hash);
  } catch {
    return false;
  }
}
