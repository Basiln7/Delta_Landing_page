import { NextResponse } from "next/server";
import { acceptInviteSchema } from "@/lib/admin/user-schemas";
import { hashPassword } from "@/lib/security/password";
import { passwordProblem } from "@/lib/security/password-policy";
import { consume, LIMITS } from "@/lib/security/rate-limit";
import { clientIp, tooManyRequests } from "@/lib/security/request";
import { parseBody } from "@/lib/security/user-admin";
import { findByInviteToken, listUsers, mutateUsers, recordAudit, who } from "@/lib/security/users";

const EXPIRED_LINK = "This link has expired or was already used. Ask a super admin to send you a new one.";

/**
 * Public: set your password from an invite / reset link. The link works once: the token is
 * removed in the same serialised write that stores the new password hash.
 */
export async function POST(req: Request) {
  const limit = await consume(LIMITS.inviteIp(clientIp(req)));
  if (!limit.ok) return tooManyRequests(limit.retryAfter, "Too many attempts. Wait a few minutes and try again.");
  const body = await parseBody(req, acceptInviteSchema, 2048);
  if ("response" in body) return body.response;
  const { token, password } = body.data;

  const pending = findByInviteToken(await listUsers(), token);
  if (!pending) return NextResponse.json({ error: EXPIRED_LINK }, { status: 410 });
  const problem = passwordProblem(password, { email: pending.email, name: pending.name });
  if (problem) return NextResponse.json({ error: problem, fields: { password: [problem] } }, { status: 422 });

  const hash = hashPassword(password); // slow on purpose — done outside the write queue
  const done = await mutateUsers((users, db) => {
    const user = findByInviteToken(users, token); // re-check inside the queue: single use
    if (!user?.invite) return null;
    const purpose = user.invite.purpose;
    user.passwordHash = hash;
    user.passwordChangedAt = new Date().toISOString();
    delete user.invite;
    user.sessionVersion = (user.sessionVersion ?? 1) + 1;
    recordAudit(db, purpose === "reset" ? "password.reset" : "invite.accepted", who(user), who(user));
    return { email: user.email, purpose };
  });
  if (!done) return NextResponse.json({ error: EXPIRED_LINK }, { status: 410 });
  return NextResponse.json({ ok: true, ...done });
}
