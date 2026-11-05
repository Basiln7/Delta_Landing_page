import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { fieldErrors, mailSettingsSchema } from "@/lib/admin/schemas";
import { mutateDb, readDb } from "@/lib/db";
import { MailConfigError, toSmtpConfig } from "@/lib/mail/send";
import { applyMailInput, MailInputError } from "@/lib/mail/settings";
import { toPublicMailSettings } from "@/lib/mail/shared";
import { describeSmtpError, verifySmtp } from "@/lib/mail/transport";
import { encryptionStatus } from "@/lib/secrets";

/** Email settings for Admin → Email. The SMTP password is write-only: GET never returns it (or its ciphertext). */
export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const db = await readDb();
  return NextResponse.json(
    { settings: toPublicMailSettings(db.mail), encryption: encryptionStatus(), log: db.mailLog ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const parsed = mailSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }
  if (parsed.data.password && !encryptionStatus().available) {
    return NextResponse.json({ error: "Set CREDENTIALS_ENCRYPTION_KEY on the server before saving a password." }, { status: 503 });
  }

  let saved;
  try {
    saved = await mutateDb((db) => {
      db.mail = applyMailInput(db.mail, parsed.data);
      return db.mail;
    });
  } catch (err) {
    if (err instanceof MailInputError) {
      return NextResponse.json({ error: err.message, fields: { [err.field]: [err.message] } }, { status: 422 });
    }
    throw err;
  }

  // Optional: check the saved connection straight away so the admin sees whether it works.
  let verify: { ok: boolean; error?: string } | undefined;
  if (parsed.data.verify && saved.host && saved.fromEmail) {
    try {
      await verifySmtp(toSmtpConfig(saved));
      const verifiedAt = new Date().toISOString();
      saved = await mutateDb((db) => {
        if (db.mail) db.mail.verifiedAt = verifiedAt;
        return db.mail!;
      });
      verify = { ok: true };
    } catch (err) {
      verify = { ok: false, error: err instanceof MailConfigError ? err.message : describeSmtpError(err) };
    }
  }

  return NextResponse.json({ settings: toPublicMailSettings(saved), verify });
}
