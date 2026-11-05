// Client-safe role metadata (no secrets, no Node APIs). The server enforces every rule;
// the UI uses this only to hide what a role can't open.
import type { AdminRole } from "@/lib/types";

export const ROLE_META: Record<AdminRole, { label: string; short: string; description: string }> = {
  super_admin: {
    label: "Super admin",
    short: "Super admin",
    description: "Everything, including adding and removing users, email server settings and the launch checklist.",
  },
  admin: {
    label: "Admin",
    short: "Admin",
    description: "Orders, counselling requests, content, media and site settings. Can't manage users or email server settings.",
  },
};

export function isSuperAdmin(role: AdminRole | undefined | null): role is "super_admin" {
  return role === "super_admin";
}

/** Admin pages only super admins may open. */
export const SUPER_ADMIN_PATHS = ["/admin/users", "/admin/email"] as const;
