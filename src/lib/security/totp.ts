import "server-only";
import crypto from "node:crypto";

/**
 * TOTP (RFC 6238) — works with Google Authenticator, Microsoft Authenticator, 1Password, Authy…
 * HMAC-SHA1, 30-second steps, 6 digits (the parameters every authenticator app supports).
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret, as recommended by RFC 4226. */
export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/** HOTP value for a given counter (RFC 4226 §5.3 dynamic truncation). */
export function hotp(key: Buffer, counter: number, digits = DIGITS) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totp(secretB32: string, step = currentStep()) {
  return hotp(base32Decode(secretB32), step);
}

/**
 * Verify a code, allowing ±`window` steps of clock drift. Returns the matched step (store it and
 * pass it back as `afterStep` next time so a code can't be replayed), or null.
 */
export function verifyTotp(secretB32: string, code: string, opts: { window?: number; afterStep?: number; now?: number } = {}) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;
  const key = base32Decode(secretB32);
  const now = currentStep(opts.now);
  const window = opts.window ?? 1;
  for (let i = -window; i <= window; i++) {
    const step = now + i;
    if (opts.afterStep !== undefined && step <= opts.afterStep) continue;
    const expected = Buffer.from(hotp(key, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(normalized))) return step;
  }
  return null;
}

export function otpauthUri({ secret, account, issuer }: { secret: string; account: string; issuer: string }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/* ───────── recovery codes ───────── */

const RC_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

/** 10 single-use codes like "k7mq-2xwd". ~50 bits each — hashed with SHA-256 is sufficient at that entropy. */
export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(8);
    const chars = Array.from(bytes, (b) => RC_ALPHABET[b % RC_ALPHABET.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  });
}

export function normalizeRecoveryCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashRecoveryCode(code: string) {
  return crypto.createHash("sha256").update(`delta-rc:${normalizeRecoveryCode(code)}`).digest("base64url");
}
