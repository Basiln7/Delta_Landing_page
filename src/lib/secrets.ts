import "server-only";
import crypto from "node:crypto";

/**
 * Encryption for credentials stored in the database (e.g. the SMTP password).
 *
 * AES-256-GCM (authenticated) with a random 96-bit IV per value.
 * Format: "v1:<iv b64url>:<tag b64url>:<ciphertext b64url>" — the version prefix allows key rotation.
 *
 * Key: CREDENTIALS_ENCRYPTION_KEY — 32 random bytes, base64 (`openssl rand -base64 32`).
 * Development fallback: derived from SESSION_SECRET (scrypt) with a warning, so local setups work.
 * A database dump alone never reveals the password; the key lives only in the server environment.
 */

const VERSION = "v1";
let warned = false;
let cached: { source: string; key: Buffer } | null = null;

function key(): Buffer {
  const explicit = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
  const session = process.env.SESSION_SECRET?.trim();
  const source = explicit ? `k:${explicit}` : session ? `s:${session}` : "";
  if (!source) throw new Error("Set CREDENTIALS_ENCRYPTION_KEY (or SESSION_SECRET) to store credentials.");
  if (cached?.source === source) return cached.key;

  let k: Buffer;
  if (explicit) {
    k = Buffer.from(explicit, "base64");
    if (k.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  } else {
    if (!warned && process.env.NODE_ENV === "production") {
      console.warn("[secrets] CREDENTIALS_ENCRYPTION_KEY is not set — deriving the key from SESSION_SECRET. Set a dedicated key in production.");
      warned = true;
    }
    k = crypto.scryptSync(session!, "delta-markets/credentials/v1", 32);
  }
  cached = { source, key: k };
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unsupported secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** For the admin UI: is a dedicated key configured, or are we on the dev fallback? */
export function encryptionStatus() {
  return {
    dedicatedKey: Boolean(process.env.CREDENTIALS_ENCRYPTION_KEY?.trim()),
    available: Boolean(process.env.CREDENTIALS_ENCRYPTION_KEY?.trim() || process.env.SESSION_SECRET?.trim()),
  };
}
