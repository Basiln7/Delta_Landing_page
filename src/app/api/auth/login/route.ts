import { NextResponse } from "next/server";
import { adminSignInConfigured, createSession, getSecurityState, issueMfaTicket, verifyCredentials } from "@/lib/auth";
import { loginSchema } from "@/lib/admin/schemas";
import { clientIp, readJson, tooManyRequests } from "@/lib/security/request";
import { consume, LIMITS, peek, resetLimit } from "@/lib/security/rate-limit";

/**
 * Step 1 of sign-in: email + password.
 * Brute-force protection: failed attempts are counted per IP (10 / 15 min) and per account
 * (30 / hour, which stops slow distributed guessing). Successful sign-in clears the account counter.
 * With 2FA enabled this only issues a short-lived ticket; the session comes from /api/auth/mfa.
 */
export async function POST(req: Request) {
  const body = await readJson(req, 4 * 1024);
  if (!body.ok) return body.response;
  const parsed = loginSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });

  if (!adminSignInConfigured()) {
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

  if (!verifyCredentials(email, password)) {
    await Promise.all([consume(ipRule), consume(accountRule)]);
    // Small, jittered delay to blunt brute-force and timing probes.
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
    return NextResponse.json({ error: "Those credentials do not match our records." }, { status: 401 });
  }

  await resetLimit(accountRule.key);
  const normalized = email.trim().toLowerCase();
  // Fresh read: whether a second factor is required must never come from a cache.
  const security = await getSecurityState({ fresh: true });
  if (security.totp) {
    await issueMfaTicket(normalized);
    return NextResponse.json({ ok: true, mfaRequired: true });
  }

  await createSession(normalized, { mfa: false });
  return NextResponse.json({ ok: true });
}
