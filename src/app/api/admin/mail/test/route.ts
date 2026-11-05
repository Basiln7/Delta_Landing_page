import { NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { fieldErrors, mailTestSchema } from "@/lib/admin/schemas";
import { readDb } from "@/lib/db";
import { deliver, MailConfigError, withDefaults } from "@/lib/mail/send";
import { draftSmtpConfig } from "@/lib/mail/settings";
import { testEmail } from "@/lib/mail/templates";
import { consume, LIMITS } from "@/lib/security/rate-limit";

/**
 * Send a real test email. Uses the unsaved form values when `settings` is given, otherwise the saved ones.
 * Bypasses the "enabled" and per-event switches (that's the point of a test), and is rate-limited.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getSession();
  const limit = await consume(LIMITS.mailTest(session?.email ?? "admin"));
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many test emails — try again in ${limit.retryAfter}s.` }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  const parsed = mailTestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }

  const db = await readDb();
  const saved = withDefaults(db.mail);
  const draft = parsed.data.settings;
  const settings = draft ? withDefaults({ ...saved, ...draft, passwordEnc: saved.passwordEnc }) : saved;

  let config;
  try {
    config = draft ? draftSmtpConfig(db.mail, draft) : undefined;
  } catch (err) {
    if (err instanceof MailConfigError) return NextResponse.json({ ok: false, error: err.message });
    throw err;
  }

  const result = await deliver(
    { event: "test", to: parsed.data.to, message: testEmail(db.settings, session?.email ?? "an admin"), ref: "test" },
    { settings, config, force: true },
  );
  return NextResponse.json({ ok: result.status === "sent", ...result });
}
