import "server-only";
import { invalidateSecurityCache } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";
import type { AdminSecurity } from "@/lib/types";
import { hashRecoveryCode, normalizeRecoveryCode, verifyTotp } from "./totp";

/** Read-modify-write the admin security state inside the serialised DB queue. */
export async function mutateSecurity<T>(fn: (sec: AdminSecurity) => T): Promise<T> {
  try {
    return await mutateDb((db) => {
      db.security ??= { sessionVersion: 1 };
      db.security.sessionVersion ??= 1;
      const result = fn(db.security);
      db.security.updatedAt = new Date().toISOString();
      return result;
    });
  } finally {
    invalidateSecurityCache();
  }
}

export type SecondFactorResult = { ok: true; method: "totp" | "recovery"; recoveryCodesLeft: number } | { ok: false };

/**
 * Check an authenticator code or a recovery code and *consume* it atomically:
 * a TOTP step can be used once (stored as lastStep), a recovery code is marked used.
 * Runs inside mutateDb, so two simultaneous submissions of the same code can't both pass.
 */
export async function consumeSecondFactor(code: string): Promise<SecondFactorResult> {
  const input = code.trim();
  return mutateSecurity((sec): SecondFactorResult => {
    if (!sec.totp) return { ok: false };
    const left = () => (sec.recoveryCodes ?? []).filter((c) => !c.usedAt).length;

    if (/^\d{3}\s?\d{3}$/.test(input)) {
      let secret: string;
      try {
        secret = decryptSecret(sec.totp.secretEnc);
      } catch {
        console.error("[2fa] stored TOTP secret can't be decrypted — was CREDENTIALS_ENCRYPTION_KEY changed? Use a recovery code.");
        return { ok: false };
      }
      const step = verifyTotp(secret, input, { afterStep: sec.totp.lastStep });
      if (step === null) return { ok: false };
      sec.totp.lastStep = step;
      return { ok: true, method: "totp", recoveryCodesLeft: left() };
    }

    if (normalizeRecoveryCode(input).length === 8) {
      const hash = hashRecoveryCode(input);
      const match = sec.recoveryCodes?.find((c) => !c.usedAt && c.hash === hash);
      if (!match) return { ok: false };
      match.usedAt = new Date().toISOString();
      return { ok: true, method: "recovery", recoveryCodesLeft: left() };
    }
    return { ok: false };
  });
}
