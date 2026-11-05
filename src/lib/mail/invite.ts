import "server-only";
import { ROLE_META } from "@/lib/roles";
import type { AdminRole } from "@/lib/types";
import { deliver, mailContext } from "./send";
import { isMailConfigured } from "./shared";
import { adminInvite } from "./templates";

export type InviteDelivery = { emailed: boolean; reason?: string };

/**
 * Email an invite / reset link. Sent on demand by a super admin, so it ignores the notification
 * toggles, but needs SMTP to be set up and switched on. The link is never stored or logged.
 */
export async function sendInviteEmail(o: {
  to: string;
  name: string;
  role: AdminRole;
  url: string;
  purpose: "invite" | "reset";
  expiresAt: string;
  by: string;
}): Promise<InviteDelivery> {
  const { db, settings } = await mailContext();
  if (!settings.enabled || !isMailConfigured(settings)) {
    return { emailed: false, reason: "Email isn't set up yet (Admin → Email), so send the link yourself." };
  }
  const message = adminInvite(db.settings, { name: o.name, roleLabel: ROLE_META[o.role].label, url: o.url, purpose: o.purpose, expiresAt: o.expiresAt, by: o.by });
  const r = await deliver({ event: "admin_invite", to: o.to, message }, { settings, force: true });
  return r.status === "sent" ? { emailed: true } : { emailed: false, reason: r.error ?? "The email could not be sent. Send the link yourself." };
}
