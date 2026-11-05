import { NextResponse } from "next/server";
import { sessionOrError } from "@/lib/auth";
import { accountSchema } from "@/lib/admin/user-schemas";
import { currentPublicState } from "@/lib/security/admin-api";
import { actorOf, parseBody } from "@/lib/security/user-admin";
import { mutateUser, recordAudit, who } from "@/lib/security/users";

/** Any signed-in user: change your own display name. */
export async function PATCH(req: Request) {
  const auth = await sessionOrError();
  if ("response" in auth) return auth.response;
  const body = await parseBody(req, accountSchema, 1024);
  if ("response" in body) return body.response;
  const { name } = body.data;

  await mutateUser(auth.session.uid, (u, db) => {
    if (u.name === name) return;
    recordAudit(db, "user.renamed", actorOf(auth.session), who(u), `${u.name} → ${name}`);
    u.name = name;
  });
  return NextResponse.json({ ok: true, state: await currentPublicState({ ...auth.session, name }) });
}
