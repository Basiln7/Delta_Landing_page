import type { Metadata } from "next";
import { requireSuperAdminPage } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { toPublicMailSettings } from "@/lib/mail/shared";
import { encryptionStatus } from "@/lib/secrets";
import { EmailView } from "@/components/admin/email/EmailView";

export const metadata: Metadata = { title: "Email" };

/** Request time — this page is dynamic (session cookie), so it renders per request. */
const requestTime = () => Date.now();

export default async function EmailPage() {
  // SMTP credentials are server secrets: super admins only (the API enforces the same).
  const session = await requireSuperAdminPage();
  const db = await readDb();
  return (
    <EmailView
      initial={toPublicMailSettings(db.mail)} // never includes the password
      encryption={encryptionStatus()}
      initialLog={db.mailLog ?? []}
      adminEmail={session.email}
      renderedAt={requestTime()}
    />
  );
}
