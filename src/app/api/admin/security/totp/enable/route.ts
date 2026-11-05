import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { decryptSecret } from "@/lib/secrets";
import { currentPublicState, guardSecurityAction, readCode } from "@/lib/security/admin-api";
import { mutateSecurity } from "@/lib/security/admin-security";
import { generateRecoveryCodes, hashRecoveryCode, verifyTotp } from "@/lib/security/totp";

const PENDING_TTL_MS = 30 * 60_000;

/**
 * Finish 2FA setup: the first valid code proves the authenticator app has the secret.
 * Turns 2FA on, issues 10 recovery codes (returned ONCE, stored hashed), signs out every other
 * session, and upgrades this session to a 2FA session.
 */
export async function POST(req: Request) {
  const guard = await guardSecurityAction();
  if ("response" in guard) return guard.response;
  const input = await readCode(req);
  if ("response" in input) return input.response;

  const codes = generateRecoveryCodes();
  const outcome = await mutateSecurity((sec) => {
    if (sec.totp) return "already" as const;
    const pending = sec.totpPending;
    if (!pending || Date.now() - Date.parse(pending.createdAt) > PENDING_TTL_MS) return "expired" as const;
    let secret: string;
    try {
      secret = decryptSecret(pending.secretEnc);
    } catch {
      return "expired" as const;
    }
    const step = verifyTotp(secret, input.code);
    if (step === null) return "invalid" as const;
    sec.totp = { secretEnc: pending.secretEnc, enabledAt: new Date().toISOString(), lastStep: step };
    delete sec.totpPending;
    sec.recoveryCodes = codes.map((c) => ({ hash: hashRecoveryCode(c) }));
    sec.sessionVersion += 1;
    return "enabled" as const;
  });

  if (outcome === "already") return NextResponse.json({ error: "Two-step verification is already on." }, { status: 409 });
  if (outcome === "expired") return NextResponse.json({ error: "Setup expired. Start again to get a new QR code." }, { status: 410 });
  if (outcome === "invalid") return NextResponse.json({ error: "That code doesn't match. Check the time on your phone and try again." }, { status: 422 });

  await createSession(guard.session.email, { mfa: true });
  return NextResponse.json({ ok: true, recoveryCodes: codes, state: await currentPublicState({ ...guard.session, mfa: true }) });
}
