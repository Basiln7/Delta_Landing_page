import "server-only";
import crypto from "node:crypto";

/**
 * Admin password hashing (scrypt). Lets production keep only a hash in the environment
 * (ADMIN_PASSWORD_HASH) instead of the plaintext password. Generate with `npm run hash-password`.
 * Format: scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>
 */

const KEYLEN = 32;

export function hashPassword(password: string, N = 2 ** 15, r = 8, p = 1) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password.normalize("NFKC"), salt, KEYLEN, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export function verifyPasswordHash(password: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "base64url");
    const actual = crypto.scryptSync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
