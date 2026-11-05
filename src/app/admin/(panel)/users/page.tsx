import type { Metadata } from "next";
import { requireSuperAdminPage } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { isMailConfigured } from "@/lib/mail/shared";
import { usersSnapshot } from "@/lib/security/user-admin";
import { ensureOwner } from "@/lib/security/users";
import { UsersView } from "@/components/admin/users/UsersView";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Super admins only (every /api/admin/users route enforces the same).
  const session = await requireSuperAdminPage();
  await ensureOwner();
  const [snapshot, db, params] = await Promise.all([usersSnapshot(), readDb(), searchParams]);
  const mailReady = Boolean(db.mail?.enabled && isMailConfigured(db.mail));

  return (
    <UsersView
      initial={snapshot}
      me={{ id: session.uid, twoFactor: session.twoFactor }}
      mailReady={mailReady}
      openNew={params.new === "1"}
    />
  );
}
