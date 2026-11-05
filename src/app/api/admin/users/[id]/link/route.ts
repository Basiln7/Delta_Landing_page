import { NextResponse } from "next/server";
import { linkSchema } from "@/lib/admin/user-schemas";
import { guardUserAdmin } from "@/lib/security/admin-api";
import { actorOf, conflict, deliverLink, noStore, notFound, parseBody, usersSnapshot } from "@/lib/security/user-admin";
import { getUser, mutateUser, newInvite, recordAudit, who } from "@/lib/security/users";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Super admins: a new one-time link for a user.
 * - No password yet → a fresh invite (72 h); any older link stops working.
 * - Has a password → a password reset (24 h): the old password stops working now and the user is
 *   signed out everywhere, so a suspected compromise is contained immediately.
 */
export async function POST(req: Request, { params }: Ctx) {
  const guard = await guardUserAdmin();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const { id } = await params;
  const body = await parseBody(req, linkSchema, 1024);
  if ("response" in body) return body.response;

  const target = await getUser(id, { fresh: true });
  if (!target) return notFound();
  if (target.owner) return conflict("The owner's password is set on the server (ADMIN_PASSWORD_HASH), not here.");
  if (id === session.uid) return conflict("Change your own password on the Security page.");
  if (target.disabled) return conflict("Enable this account first.");

  const purpose = target.passwordHash ? "reset" : "invite";
  const { token, invite } = newInvite(purpose, session.uid);
  const user = await mutateUser(id, (u, db) => {
    u.invite = invite;
    if (purpose === "reset") {
      delete u.passwordHash;
      u.sessionVersion = (u.sessionVersion ?? 1) + 1;
    }
    recordAudit(db, purpose === "reset" ? "user.reset_sent" : "user.invite_sent", actorOf(session), who(u));
    return { email: u.email, name: u.name, role: u.role };
  });
  if (!user) return notFound();

  const link = await deliverLink(req, { token, invite, user, by: session, sendEmail: body.data.sendEmail });
  return NextResponse.json({ ...(await usersSnapshot()), link }, noStore);
}
