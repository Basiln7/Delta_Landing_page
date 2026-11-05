import "server-only";
import { decryptSecret } from "@/lib/secrets";
import { hashRecoveryCode, normalizeRecoveryCode, verifyTotp } from "./totp";
import { mutateUser } from "./users";

export type SecondFactorResult = { ok: true; method: "totp" | "recovery"; recoveryCodesLeft: number } | { ok: false };

/**
 * Check a user's authenticator code or recovery code and *consume* it atomically:
 * a TOTP step can be used once (stored as lastStep), a recovery code is marked used.
 * Runs inside the serialised DB queue, so two simultaneous submissions of one code can't both pass.
 */
export async function consumeSecondFactor(userId: string, code: string): Promise<SecondFactorResult> {
  const input = code.trim();
  const result = await mutateUser(userId, (user): SecondFactorResult => {
    if (!user.totp) return { ok: false };
    const left = () => (user.recoveryCodes ?? []).filter((c) => !c.usedAt).length;

    if (/^\d{3}\s?\d{3}$/.test(input)) {
      let secret: string;
      try {
        secret = decryptSecret(user.totp.secretEnc);
      } catch {
        console.error("[2fa] stored TOTP secret can't be decrypted — was CREDENTIALS_ENCRYPTION_KEY changed? Use a recovery code.");
        return { ok: false };
      }
      const step = verifyTotp(secret, input, { afterStep: user.totp.lastStep });
      if (step === null) return { ok: false };
      user.totp.lastStep = step;
      return { ok: true, method: "totp", recoveryCodesLeft: left() };
    }

    if (normalizeRecoveryCode(input).length === 8) {
      const hash = hashRecoveryCode(input);
      const match = user.recoveryCodes?.find((c) => !c.usedAt && c.hash === hash);
      if (!match) return { ok: false };
      match.usedAt = new Date().toISOString();
      return { ok: true, method: "recovery", recoveryCodesLeft: left() };
    }
    return { ok: false };
  });
  return result ?? { ok: false };
}
