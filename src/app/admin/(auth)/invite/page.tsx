import type { Metadata } from "next";
import { connection } from "next/server";
import { InviteView } from "@/components/admin/InviteView";

export const metadata: Metadata = {
  title: "Set your password · Delta Admin",
  robots: { index: false, follow: false },
};

/**
 * Invite / password-reset landing page. The one-time token is in the URL fragment (#…), which
 * browsers never send to the server, so it can't end up in access logs or Referer headers.
 */
export default async function InvitePage() {
  // Render per request: the admin CSP gives every response a fresh script nonce, which a
  // statically generated page couldn't carry (its scripts would be blocked).
  await connection();
  return <InviteView />;
}
