import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSecurityState, getSession, type Session } from "@/lib/auth";
import type { AdminSecurity } from "@/lib/types";
import { securityChecklist } from "./checklist";
import { consume, LIMITS } from "./rate-limit";
import { readJson, tooManyRequests } from "./request";

export const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });

/** Session + per-admin rate limit for endpoints that check a 2FA code (stops code guessing with a stolen cookie). */
export async function guardSecurityAction(): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const v = await consume(LIMITS.securityAction(session.email));
  if (!v.ok) return { response: tooManyRequests(v.retryAfter, "Too many attempts. Wait a few minutes and try again.") };
  return { session };
}

export async function readCode(req: Request) {
  const body = await readJson(req, 1024);
  if (!body.ok) return { response: body.response };
  const parsed = codeSchema.safeParse(body.data);
  if (!parsed.success) return { response: NextResponse.json({ error: "Enter the 6-digit code from your authenticator app." }, { status: 422 }) };
  return { code: parsed.data.code };
}

/** What the Security page shows. Never includes secrets, hashes or codes. */
export function publicSecurityState(sec: AdminSecurity, session: Session) {
  return {
    twoFactor: {
      enabled: Boolean(sec.totp),
      enabledAt: sec.totp?.enabledAt,
      recoveryCodesLeft: (sec.recoveryCodes ?? []).filter((c) => !c.usedAt).length,
      setupPending: Boolean(sec.totpPending),
    },
    session: { email: session.email, signedInAt: new Date(session.iat * 1000).toISOString(), expiresAt: new Date(session.exp * 1000).toISOString(), mfa: session.mfa },
    checklist: securityChecklist(sec),
  };
}

export async function currentPublicState(session: Session) {
  return publicSecurityState(await getSecurityState(), session);
}
