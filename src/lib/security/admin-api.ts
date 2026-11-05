import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionOrError, type AdminSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";
import type { AdminUser } from "@/lib/types";
import { consumeSecondFactor } from "./admin-security";
import { securityChecklist } from "./checklist";
import { consume, LIMITS } from "./rate-limit";
import { readJson, tooManyRequests } from "./request";
import { getUser, listUsers } from "./users";

export const codeSchema = z.object({ code: z.string().trim().min(6).max(20) });

/** Session + per-user rate limit for endpoints that check a 2FA code or password (stops guessing with a stolen cookie). */
export async function guardSecurityAction(): Promise<{ session: AdminSession } | { response: NextResponse }> {
  const auth = await sessionOrError();
  if ("response" in auth) return auth;
  const v = await consume(LIMITS.securityAction(auth.session.uid));
  if (!v.ok) return { response: tooManyRequests(v.retryAfter, "Too many attempts. Wait a few minutes and try again.") };
  return auth;
}

/** Super admin + per-admin rate limit, for user management. */
export async function guardUserAdmin(): Promise<{ session: AdminSession } | { response: NextResponse }> {
  const auth = await sessionOrError({ superAdmin: true });
  if ("response" in auth) return auth;
  const v = await consume(LIMITS.userAdmin(auth.session.uid));
  if (!v.ok) return { response: tooManyRequests(v.retryAfter, "Too many changes in a short time. Wait a few minutes and try again.") };
  return auth;
}

/**
 * Sensitive actions (granting super admin, deleting a user, resetting someone's 2FA) need a fresh
 * code when the acting admin has 2FA on. Returns an error response, or null to continue.
 * The client sees `stepUp: true` and asks for a code, then repeats the request with it.
 */
export async function requireStepUp(session: AdminSession, code: string | undefined): Promise<NextResponse | null> {
  if (!session.twoFactor) return null;
  if (!code?.trim()) return NextResponse.json({ error: "Enter a code from your authenticator app to confirm.", stepUp: true }, { status: 403 });
  const check = await consumeSecondFactor(session.uid, code);
  if (!check.ok) return NextResponse.json({ error: "That code isn't valid. Try the next one from your app.", stepUp: true }, { status: 403 });
  return null;
}

export async function readCode(req: Request) {
  const body = await readJson(req, 1024);
  if (!body.ok) return { response: body.response };
  const parsed = codeSchema.safeParse(body.data);
  if (!parsed.success) return { response: NextResponse.json({ error: "Enter the 6-digit code from your authenticator app." }, { status: 422 }) };
  return { code: parsed.data.code };
}

/** What the Security page shows. Never includes secrets, hashes or codes. The launch checklist is for super admins only. */
export function publicSecurityState(user: AdminUser, session: AdminSession, allUsers?: AdminUser[]) {
  return {
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      owner: Boolean(user.owner),
      passwordChangedAt: user.passwordChangedAt,
    },
    twoFactor: {
      enabled: Boolean(user.totp),
      enabledAt: user.totp?.enabledAt,
      recoveryCodesLeft: (user.recoveryCodes ?? []).filter((c) => !c.usedAt).length,
      setupPending: Boolean(user.totpPending),
    },
    session: { email: user.email, signedInAt: new Date(session.iat * 1000).toISOString(), expiresAt: new Date(session.exp * 1000).toISOString(), mfa: session.mfa },
    checklist: isSuperAdmin(user.role) && allUsers ? securityChecklist(allUsers) : null,
  };
}

export async function currentPublicState(session: AdminSession) {
  const [user, all] = await Promise.all([getUser(session.uid, { fresh: true }), listUsers()]);
  if (!user) throw new Error("Signed-in user no longer exists");
  return publicSecurityState(user, session, all);
}
