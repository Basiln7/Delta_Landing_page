import { NextResponse } from "next/server";
import { stepUpSchema, userPatchSchema } from "@/lib/admin/user-schemas";
import { ROLE_META } from "@/lib/roles";
import { guardUserAdmin, requireStepUp } from "@/lib/security/admin-api";
import { actorOf, conflict, noStore, notFound, parseBody, usersSnapshot } from "@/lib/security/user-admin";
import { getUser, mutateUser, mutateUsers, recordAudit, who } from "@/lib/security/users";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Super admins: rename, change role, disable / enable.
 * - Nobody changes their own role or disables themselves (no accidental lockout).
 * - The owner account is always an active super admin.
 * - Granting super admin needs a fresh 2FA code. Disabling signs the user out everywhere.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await guardUserAdmin();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const { id } = await params;
  const body = await parseBody(req, userPatchSchema);
  if ("response" in body) return body.response;
  const { name, role, disabled, code } = body.data;

  const target = await getUser(id, { fresh: true });
  if (!target) return notFound();
  const roleChange = role !== undefined && role !== target.role;
  const statusChange = disabled !== undefined && disabled !== Boolean(target.disabled);

  if (id === session.uid && (roleChange || statusChange)) {
    return conflict("You can't change your own role or disable your own account. Ask another super admin.");
  }
  if (target.owner && ((roleChange && role !== "super_admin") || disabled === true)) {
    return conflict("The owner account is set on the server (ADMIN_EMAIL). It can't be demoted or disabled.");
  }
  if (roleChange && role === "super_admin") {
    const stepUp = await requireStepUp(session, code);
    if (stepUp) return stepUp;
  }

  const actor = actorOf(session);
  const updated = await mutateUser(id, (u, db) => {
    if (name !== undefined && name !== u.name) {
      recordAudit(db, "user.renamed", actor, who(u), `${u.name} → ${name}`);
      u.name = name;
    }
    if (role !== undefined && role !== u.role && !u.owner) {
      recordAudit(db, "user.role_changed", actor, who(u), `${ROLE_META[u.role].label} → ${ROLE_META[role].label}`);
      u.role = role;
    }
    if (disabled !== undefined && disabled !== Boolean(u.disabled) && !u.owner) {
      if (disabled) {
        u.disabled = true;
        u.sessionVersion = (u.sessionVersion ?? 1) + 1; // signed out everywhere, at once
        recordAudit(db, "user.disabled", actor, who(u));
      } else {
        delete u.disabled;
        recordAudit(db, "user.enabled", actor, who(u));
      }
    }
    return true;
  });
  if (!updated) return notFound();
  return NextResponse.json(await usersSnapshot(), noStore);
}

/** Super admins: delete a user (not yourself, never the owner). Needs a fresh 2FA code. Their sessions stop working at once. */
export async function DELETE(req: Request, { params }: Ctx) {
  const guard = await guardUserAdmin();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const { id } = await params;
  const body = await parseBody(req, stepUpSchema, 1024);
  if ("response" in body) return body.response;

  const target = await getUser(id, { fresh: true });
  if (!target) return notFound();
  if (id === session.uid) return conflict("You can't delete your own account.");
  if (target.owner) return conflict("The owner account is set on the server (ADMIN_EMAIL) and can't be deleted.");

  const stepUp = await requireStepUp(session, body.data.code);
  if (stepUp) return stepUp;

  const removed = await mutateUsers((users, db) => {
    const i = users.findIndex((u) => u.id === id && !u.owner);
    if (i === -1) return false;
    const [user] = users.splice(i, 1);
    recordAudit(db, "user.deleted", actorOf(session), who(user), `was ${ROLE_META[user.role].label}`);
    return true;
  });
  if (!removed) return notFound();
  return NextResponse.json(await usersSnapshot(), noStore);
}
