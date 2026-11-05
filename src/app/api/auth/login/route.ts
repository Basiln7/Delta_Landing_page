import { NextResponse } from "next/server";
import { createSession, issueMfaTicket } from "@/lib/auth";
import { loginSchema } from "@/lib/admin/schemas";
import { clientIp, readJson, tooManyRequests } from "@/lib/security/request";
import { consume, LIMITS, peek, resetLimit } from "@/lib/security/rate-limit";
import { authenticate, getUser, mutateUser, signInAvailable } from "@/lib/security/users";

/**
 * Step 1 of sign-in: email + password.
 * Brute-force protection: failed attempts are counted per IP (10 / 15 min) and per account
 * (30 / hour, which stops slow distributed guessing). Successful sign-in clears the account counter.
 * Unknown, disabled and not-yet-activated accounts fail exactly like a wrong password.
 * With 2FA enabled this only issues a short-lived ticket; the session comes from /api/auth/mfa.
 */
export async function POST(req: Request) {
  const body = await readJson(req, 4 * 1024);
  if (!body.ok) return body.response;
  const parsed = loginSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });

  if (!(await signInAvailable())) {
    return NextResponse.json({ error: "Admin sign-in is not configured on this server." }, { status: 503 });
  }

  const { email, password } = parsed.data;
  const ip = clientIp(req);
  const ipRule = LIMITS.loginIp(ip);
  const accountRule = LIMITS.loginAccount(email.trim());

  const [ipState, accountState] = await Promise.all([peek(ipRule), peek(accountRule)]);
  if (!ipState.ok || !accountState.ok) {
    const wait = Math.max(ipState.retryAfter, accountState.retryAfter);
    return tooManyRequests(wait, `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? "s" : ""}.`);
  }

  const user = await authenticate(email, password);
  if (!user) {
    await Promise.all([consume(ipRule), consume(accountRule)]);
    // Small, jittered delay to blunt brute-force and timing probes.
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
    return NextResponse.json({ error: "Those credentials do not match our records." }, { status: 401 });
  }

  await resetLimit(accountRule.key);
  // Fresh read: whether a second factor is required must never come from a cache.
  const fresh = await getUser(user.id, { fresh: true });
  if (fresh?.totp) {
    await issueMfaTicket(user.id);
    return NextResponse.json({ ok: true, mfaRequired: true });
  }

  await mutateUser(user.id, (u) => {
    u.lastLoginAt = new Date().toISOString();
  });
  await createSession(user.id, { mfa: false });
  return NextResponse.json({ ok: true });
}
