import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { currentPublicState, guardSecurityAction, readCode } from "@/lib/security/admin-api";
import { consumeSecondFactor } from "@/lib/security/admin-security";
import { getUser, mutateUser } from "@/lib/security/users";

/** Turn the signed-in user's 2FA off. Requires a current authenticator or recovery code; signs out their other sessions. */
export async function POST(req: Request) {
  const guard = await guardSecurityAction();
  if ("response" in guard) return guard.response;
  const input = await readCode(req);
  if ("response" in input) return input.response;

  if (!(await getUser(guard.session.uid, { fresh: true }))?.totp) return NextResponse.json({ error: "Two-step verification is already off." }, { status: 409 });
  const check = await consumeSecondFactor(guard.session.uid, input.code);
  if (!check.ok) return NextResponse.json({ error: "That code isn't valid." }, { status: 422 });

  await mutateUser(guard.session.uid, (user) => {
    delete user.totp;
    delete user.totpPending;
    delete user.recoveryCodes;
    user.sessionVersion = (user.sessionVersion ?? 1) + 1;
  });
  await createSession(guard.session.uid, { mfa: false });
  return NextResponse.json({ ok: true, state: await currentPublicState({ ...guard.session, mfa: false, twoFactor: false }) });
}
