import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, requireAdmin } from "@/lib/auth";
import { fieldErrors, mailSettingsSchema } from "@/lib/admin/schemas";
import { mutateDb, readDb } from "@/lib/db";
import { MailConfigError, toSmtpConfig, withDefaults } from "@/lib/mail/send";
import { draftSmtpConfig, matchesSaved } from "@/lib/mail/settings";
import { describeSmtpError, verifySmtp } from "@/lib/mail/transport";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ settings: mailSettingsSchema.optional() });

/**
 * Connect + authenticate against the SMTP server without sending anything.
 * Body `{ settings }` checks the unsaved form values; an empty body checks the saved settings.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await getSession();
  const limit = rateLimit(`mail-verify:${session?.email}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: `Too many checks — try again in ${limit.retryAfter}s.` }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }
  const draft = parsed.data.settings;
  const saved = (await readDb()).mail;

  const started = Date.now();
  try {
    const config = draft ? draftSmtpConfig(saved, draft) : toSmtpConfig(withDefaults(saved));
    await verifySmtp(config);
  } catch (err) {
    const error = err instanceof MailConfigError ? err.message : describeSmtpError(err);
    return NextResponse.json({ ok: false, error, latencyMs: Date.now() - started });
  }

  // Record the success only when it proves the *saved* settings work.
  let verifiedAt: string | undefined;
  if (saved && (!draft || matchesSaved(saved, draft))) {
    verifiedAt = new Date().toISOString();
    await mutateDb((db) => {
      if (db.mail) db.mail.verifiedAt = verifiedAt;
    });
  }
  return NextResponse.json({ ok: true, latencyMs: Date.now() - started, verifiedAt });
}
