import { NextResponse } from "next/server";
import { inviteTokenSchema } from "@/lib/admin/user-schemas";
import { consume, LIMITS } from "@/lib/security/rate-limit";
import { clientIp, tooManyRequests } from "@/lib/security/request";
import { parseBody } from "@/lib/security/user-admin";
import { findByInviteToken, listUsers } from "@/lib/security/users";

const EXPIRED_LINK = "This link has expired or was already used. Ask a super admin to send you a new one.";

/**
 * Public: is this invite / reset link still valid? Returns only what the page needs to greet the
 * person. The token is POSTed (never in a URL the server logs). Rate-limited per IP.
 */
export async function POST(req: Request) {
  const limit = await consume(LIMITS.inviteIp(clientIp(req)));
  if (!limit.ok) return tooManyRequests(limit.retryAfter, "Too many attempts. Wait a few minutes and try again.");
  const body = await parseBody(req, inviteTokenSchema, 1024);
  if ("response" in body) return body.response;

  const user = findByInviteToken(await listUsers(), body.data.token);
  if (!user?.invite) return NextResponse.json({ error: EXPIRED_LINK }, { status: 410 });
  return NextResponse.json(
    { name: user.name, email: user.email, purpose: user.invite.purpose, expiresAt: user.invite.expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
