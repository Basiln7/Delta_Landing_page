import { NextResponse } from "next/server";
import { currentPublicState, guardSecurityAction, readCode } from "@/lib/security/admin-api";
import { consumeSecondFactor } from "@/lib/security/admin-security";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/security/totp";
import { getUser, mutateUser } from "@/lib/security/users";

/** Replace the signed-in user's recovery codes (old ones stop working). Requires a current code. Returns the new codes once. */
export async function POST(req: Request) {
  const guard = await guardSecurityAction();
  if ("response" in guard) return guard.response;
  const input = await readCode(req);
  if ("response" in input) return input.response;

  if (!(await getUser(guard.session.uid, { fresh: true }))?.totp) return NextResponse.json({ error: "Turn on two-step verification first." }, { status: 409 });
  const check = await consumeSecondFactor(guard.session.uid, input.code);
  if (!check.ok) return NextResponse.json({ error: "That code isn't valid." }, { status: 422 });

  const codes = generateRecoveryCodes();
  await mutateUser(guard.session.uid, (user) => {
    user.recoveryCodes = codes.map((c) => ({ hash: hashRecoveryCode(c) }));
  });
  return NextResponse.json({ ok: true, recoveryCodes: codes, state: await currentPublicState(guard.session) });
}
