import { NextResponse } from "next/server";
import { createSession, sessionOrError } from "@/lib/auth";
import { currentPublicState } from "@/lib/security/admin-api";
import { mutateUser } from "@/lib/security/users";

/**
 * "Sign out everywhere else": bump the signed-in user's session version so every other cookie of
 * theirs is rejected, then re-issue this browser's session so they stay signed in here.
 */
export async function DELETE() {
  const auth = await sessionOrError();
  if ("response" in auth) return auth.response;
  const { session } = auth;
  await mutateUser(session.uid, (user) => {
    user.sessionVersion = (user.sessionVersion ?? 1) + 1;
  });
  await createSession(session.uid, { mfa: session.mfa });
  return NextResponse.json({ ok: true, state: await currentPublicState(session) });
}
