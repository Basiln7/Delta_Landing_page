import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { currentPublicState } from "@/lib/security/admin-api";
import { mutateSecurity } from "@/lib/security/admin-security";

/**
 * "Sign out everywhere else": bump the session version so every existing admin cookie is rejected,
 * then re-issue this browser's session so the admin stays signed in here.
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await mutateSecurity((sec) => {
    sec.sessionVersion += 1;
  });
  await createSession(session.email, { mfa: session.mfa });
  return NextResponse.json({ ok: true, state: await currentPublicState(session) });
}
