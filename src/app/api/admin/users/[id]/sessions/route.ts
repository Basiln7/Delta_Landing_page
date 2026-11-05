import { NextResponse } from "next/server";
import { guardUserAdmin } from "@/lib/security/admin-api";
import { actorOf, conflict, noStore, notFound, usersSnapshot } from "@/lib/security/user-admin";
import { mutateUser, recordAudit, who } from "@/lib/security/users";

type Ctx = { params: Promise<{ id: string }> };

/** Super admins: sign a user out on every device (their next request needs a fresh sign-in). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await guardUserAdmin();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const { id } = await params;
  if (id === session.uid) return conflict("Use Security → Sign out everywhere else for your own account.");

  const done = await mutateUser(id, (u, db) => {
    u.sessionVersion = (u.sessionVersion ?? 1) + 1;
    recordAudit(db, "user.signed_out", actorOf(session), who(u));
    return true;
  });
  if (!done) return notFound();
  return NextResponse.json(await usersSnapshot(), noStore);
}
