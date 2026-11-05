import type { Metadata } from "next";
import { getSecurityState, requirePageSession } from "@/lib/auth";
import { publicSecurityState } from "@/lib/security/admin-api";
import { SecurityView } from "@/components/admin/security/SecurityView";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const session = await requirePageSession();
  // Booleans and counts only: no secrets, hashes or codes reach the browser.
  return <SecurityView initial={publicSecurityState(await getSecurityState(), session)} />;
}
