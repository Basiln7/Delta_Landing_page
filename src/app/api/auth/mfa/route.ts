import { NextResponse } from "next/server";
import { z } from "zod";
import { clearMfaTicket, createSession, readMfaTicket } from "@/lib/auth";
import { consumeSecondFactor } from "@/lib/security/admin-security";
import { consumeAll, LIMITS } from "@/lib/security/rate-limit";
import { clientIp, readJson, tooManyRequests } from "@/lib/security/request";

const schema = z.object({ code: z.string().trim().min(6).max(20) });

/**
 * Step 2 of sign-in: a 6-digit authenticator code or a single-use recovery code.
 * Needs the signed ticket cookie from step 1 (valid 5 minutes). Five wrong codes burn the ticket.
 */
export async function POST(req: Request) {
  const ticket = await readMfaTicket();
  if (!ticket) return NextResponse.json({ error: "Your sign-in expired. Enter your password again.", restart: true }, { status: 401 });

  const body = await readJson(req, 1024);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code from your authenticator app." }, { status: 400 });

  const limit = await consumeAll([LIMITS.mfaTicket(ticket.jti), LIMITS.mfaIp(clientIp(req))]);
  if (!limit.ok) {
    await clearMfaTicket();
    return tooManyRequests(limit.retryAfter, "Too many wrong codes. Sign in again in a few minutes.");
  }

  const result = await consumeSecondFactor(parsed.data.code);
  if (!result.ok) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    return NextResponse.json({ error: "That code isn't valid. Check your authenticator app and try again." }, { status: 401 });
  }

  await clearMfaTicket();
  await createSession(ticket.email, { mfa: true });
  return NextResponse.json({ ok: true, method: result.method, recoveryCodesLeft: result.recoveryCodesLeft });
}
