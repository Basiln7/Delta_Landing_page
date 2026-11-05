import { NextResponse } from "next/server";
import { sessionOrError } from "@/lib/auth";
import { userCreateSchema } from "@/lib/admin/user-schemas";
import { ROLE_META } from "@/lib/roles";
import { guardUserAdmin, requireStepUp } from "@/lib/security/admin-api";
import { actorOf, conflict, deliverLink, noStore, parseBody, usersSnapshot } from "@/lib/security/user-admin";
import { ensureOwner, mutateUsers, newInvite, recordAudit, who } from "@/lib/security/users";
import type { AdminUser } from "@/lib/types";
import { uid } from "@/lib/utils";

/** Super admins: list users + recent activity. */
export async function GET() {
  const auth = await sessionOrError({ superAdmin: true });
  if ("response" in auth) return auth.response;
  await ensureOwner();
  return NextResponse.json(await usersSnapshot(), noStore);
}

/**
 * Super admins: add a user. The account has no password until the person opens their one-time
 * invite link (72 h) and chooses one. Granting super admin needs a fresh 2FA code (step-up).
 */
export async function POST(req: Request) {
  const guard = await guardUserAdmin();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const body = await parseBody(req, userCreateSchema);
  if ("response" in body) return body.response;
  const { name, email, role, sendEmail, code } = body.data;

  if (role === "super_admin") {
    const stepUp = await requireStepUp(session, code);
    if (stepUp) return stepUp;
  }

  await ensureOwner();
  const { token, invite } = newInvite("invite", session.uid);
  const created = await mutateUsers((users, db) => {
    if (users.some((u) => u.email === email)) return null;
    const user: AdminUser = { id: uid("usr"), email, name, role, createdAt: new Date().toISOString(), createdBy: session.uid, sessionVersion: 1, invite };
    users.push(user);
    recordAudit(db, "user.created", actorOf(session), who(user), `as ${ROLE_META[role].label}`);
    return user;
  }).catch((err: unknown) => {
    if ((err as { code?: number })?.code === 11000) return null; // unique email index (another server won the race)
    throw err;
  });
  if (!created) return conflict("There's already an admin user with this email.");

  const link = await deliverLink(req, { token, invite, user: created, by: session, sendEmail });
  return NextResponse.json({ ...(await usersSnapshot()), link }, { status: 201, ...noStore });
}
