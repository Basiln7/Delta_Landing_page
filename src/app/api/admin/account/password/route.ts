import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/admin/user-schemas";
import { currentPublicState, guardSecurityAction } from "@/lib/security/admin-api";
import { hashPassword, verifyPasswordHash } from "@/lib/security/password";
import { passwordProblem } from "@/lib/security/password-policy";
import { actorOf, conflict, parseBody } from "@/lib/security/user-admin";
import { getUser, mutateUser, recordAudit, who } from "@/lib/security/users";

/**
 * Any signed-in user (except the owner, whose password lives on the server): change your password.
 * Needs the current password; rate-limited per user; signs out your other sessions and keeps this one.
 */
export async function POST(req: Request) {
  const guard = await guardSecurityAction();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const body = await parseBody(req, changePasswordSchema, 2048);
  if ("response" in body) return body.response;
  const { current, next } = body.data;

  const user = await getUser(session.uid, { fresh: true });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.owner) return conflict("Your password is set on the server (ADMIN_PASSWORD_HASH). Change it there and restart the app.");
  if (!user.passwordHash || !verifyPasswordHash(current, user.passwordHash)) {
    return NextResponse.json({ error: "Your current password isn't right.", fields: { current: ["Your current password isn't right."] } }, { status: 422 });
  }
  const problem = passwordProblem(next, { email: user.email, name: user.name }) ?? (next === current ? "Choose a password you haven't used here before." : null);
  if (problem) return NextResponse.json({ error: problem, fields: { next: [problem] } }, { status: 422 });

  const hash = hashPassword(next);
  await mutateUser(session.uid, (u, db) => {
    u.passwordHash = hash;
    u.passwordChangedAt = new Date().toISOString();
    delete u.invite;
    u.sessionVersion = (u.sessionVersion ?? 1) + 1;
    recordAudit(db, "password.changed", actorOf(session), who(u));
  });
  await createSession(session.uid, { mfa: session.mfa });
  return NextResponse.json({ ok: true, state: await currentPublicState(session) });
}
