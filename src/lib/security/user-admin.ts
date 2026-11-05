import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { AdminSession } from "@/lib/auth";
import { fieldErrors } from "@/lib/admin/schemas";
import { sendInviteEmail, type InviteDelivery } from "@/lib/mail/invite";
import type { AdminInvite, AdminUser } from "@/lib/types";
import { readJson } from "./request";
import { inviteUrl, listAudit, listUsers, publicUsers, who } from "./users";

/** Shared pieces of the /api/admin/users routes. */

export const actorOf = (s: AdminSession) => who({ id: s.uid, name: s.name, email: s.email });

/** Parse a small JSON body (an empty body counts as `{}`) against a schema. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S, maxBytes = 4 * 1024): Promise<{ data: z.infer<S> } | { response: NextResponse }> {
  let raw: unknown = {};
  if (req.headers.get("content-length") !== "0" && req.body) {
    const body = await readJson(req, maxBytes);
    if (!body.ok) return { response: body.response };
    raw = body.data ?? {};
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { response: NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form and try again.", fields: fieldErrors(parsed.error) }, { status: 422 }) };
  }
  return { data: parsed.data };
}

/** Every response from user management carries the fresh list and activity log, so the page never drifts. */
export async function usersSnapshot() {
  const [users, audit] = await Promise.all([listUsers(), listAudit()]);
  return { users: publicUsers(users), audit };
}

export type LinkResult = { url: string; purpose: AdminInvite["purpose"]; expiresAt: string } & InviteDelivery;

/** Build the link for a freshly created token and (optionally) email it. */
export async function deliverLink(
  req: Request,
  o: { token: string; invite: AdminInvite; user: Pick<AdminUser, "email" | "name" | "role">; by: AdminSession; sendEmail?: boolean },
): Promise<LinkResult> {
  const url = inviteUrl(o.token, req);
  const delivery: InviteDelivery =
    o.sendEmail === false
      ? { emailed: false }
      : await sendInviteEmail({ to: o.user.email, name: o.user.name, role: o.user.role, url, purpose: o.invite.purpose, expiresAt: o.invite.expiresAt, by: o.by.name });
  return { url, purpose: o.invite.purpose, expiresAt: o.invite.expiresAt, ...delivery };
}

export const conflict = (error: string) => NextResponse.json({ error }, { status: 409 });
export const notFound = () => NextResponse.json({ error: "That user no longer exists." }, { status: 404 });
export const noStore = { headers: { "Cache-Control": "no-store" } };
