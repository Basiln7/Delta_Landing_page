import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { SettingsView } from "@/components/admin/settings/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePageSession();
  const db = await readDb();
  return <SettingsView initial={db.settings} />;
}
