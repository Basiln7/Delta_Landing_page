import { NextResponse } from "next/server";
import { stepUpSchema } from "@/lib/admin/user-schemas";
import { guardUserAdmin, requireStepUp } from "@/lib/security/admin-api";
import { actorOf, conflict, noStore, notFound, parseBody, usersSnapshot } from "@/lib/security/user-admin";
import { getUser, mutateUser, recordAudit, who } from "@/lib/security/users";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Super admins: turn off a user's two-step verification (lost phone and recovery codes).
 * Needs a fresh 2FA code from the acting super admin; signs the user out everywhere.
 * Not for your own account (Security page) or the owner (protected).
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const guard = await guardUserAdmin();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const { id } = await params;
  const body = await parseBody(req, stepUpSchema, 1024);
  if ("response" in body) return body.response;

  const target = await getUser(id, { fresh: true });
  if (!target) return notFound();
  if (id === session.uid) return conflict("Manage your own two-step verification on the Security page.");
  if (target.owner) return conflict("The owner's two-step verification can only be changed by the owner.");
  if (!target.totp) return conflict("Two-step verification is already off for this user.");

  const stepUp = await requireStepUp(session, body.data.code);
  if (stepUp) return stepUp;

  const done = await mutateUser(id, (u, db) => {
    delete u.totp;
    delete u.totpPending;
    delete u.recoveryCodes;
    u.sessionVersion = (u.sessionVersion ?? 1) + 1;
    recordAudit(db, "user.2fa_reset", actorOf(session), who(u));
    return true;
  });
  if (!done) return notFound();
  return NextResponse.json(await usersSnapshot(), noStore);
}
