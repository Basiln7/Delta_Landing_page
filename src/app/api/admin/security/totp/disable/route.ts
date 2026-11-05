import { NextResponse } from "next/server";
import { createSession, getSecurityState } from "@/lib/auth";
import { currentPublicState, guardSecurityAction, readCode } from "@/lib/security/admin-api";
import { consumeSecondFactor, mutateSecurity } from "@/lib/security/admin-security";

/** Turn 2FA off. Requires a current authenticator or recovery code; signs out every other session. */
export async function POST(req: Request) {
  const guard = await guardSecurityAction();
  if ("response" in guard) return guard.response;
  const input = await readCode(req);
  if ("response" in input) return input.response;

  if (!(await getSecurityState({ fresh: true })).totp) return NextResponse.json({ error: "Two-step verification is already off." }, { status: 409 });
  const check = await consumeSecondFactor(input.code);
  if (!check.ok) return NextResponse.json({ error: "That code isn't valid." }, { status: 422 });

  await mutateSecurity((sec) => {
    delete sec.totp;
    delete sec.totpPending;
    delete sec.recoveryCodes;
    sec.sessionVersion += 1;
  });
  await createSession(guard.session.email, { mfa: false });
  return NextResponse.json({ ok: true, state: await currentPublicState({ ...guard.session, mfa: false }) });
}
