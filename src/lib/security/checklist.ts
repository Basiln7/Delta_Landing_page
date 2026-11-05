import "server-only";
import { authConfigStatus } from "@/lib/auth";
import { razorpayConfig } from "@/lib/payments/razorpay";
import { encryptionStatus } from "@/lib/secrets";
import type { AdminUser } from "@/lib/types";
import { demoCheckoutAllowed } from "./policy";

export type CheckState = "ok" | "warn" | "fail";
export type Check = { id: string; label: string; state: CheckState; detail: string };

const names = (users: AdminUser[]) => {
  const list = users.slice(0, 3).map((u) => u.name);
  return users.length > 3 ? `${list.join(", ")} and ${users.length - 3} more` : list.join(", ");
};

/** Two-step verification across every account that can sign in. */
function twoFactorCheck(users: AdminUser[]): Check {
  const active = users.filter((u) => !u.disabled && (u.owner || u.passwordHash));
  const without = active.filter((u) => !u.totp);
  const lowCodes = active.filter((u) => u.totp && (u.recoveryCodes ?? []).filter((c) => !c.usedAt).length < 3);
  if (without.length) {
    return {
      id: "2fa",
      label: "Two-step verification",
      state: without.some((u) => u.role === "super_admin") ? "fail" : "warn",
      detail: `Off for ${names(without)} (${without.length} of ${active.length}). A stolen password alone gives access to those accounts.`,
    };
  }
  if (lowCodes.length) {
    return { id: "2fa", label: "Two-step verification", state: "warn", detail: `On for everyone, but ${names(lowCodes)} ha${lowCodes.length === 1 ? "s" : "ve"} fewer than 3 recovery codes left.` };
  }
  return { id: "2fa", label: "Two-step verification", state: "ok", detail: `On for all ${active.length} active user${active.length === 1 ? "" : "s"}.` };
}

/** Production-readiness checks for Admin → Security. Reports booleans only — never secret values. */
export function securityChecklist(users: AdminUser[]): Check[] {
  const auth = authConfigStatus();
  const enc = encryptionStatus();
  const rzp = razorpayConfig();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return [
    twoFactorCheck(users),
    {
      id: "session-secret",
      label: "Session signing secret",
      state: auth.sessionSecretStrong ? "ok" : auth.production ? "fail" : "warn",
      detail: auth.sessionSecretStrong ? "Random and long enough." : "SESSION_SECRET is missing, short or a public placeholder.",
    },
    {
      id: "admin-password",
      label: "Owner password (server)",
      state: auth.passwordHashed ? "ok" : auth.passwordHashInvalid ? "fail" : auth.passwordStrong ? "warn" : auth.production ? "fail" : "warn",
      detail: auth.passwordHashed
        ? "Stored as a scrypt hash (ADMIN_PASSWORD_HASH)."
        : auth.passwordHashInvalid
          ? "ADMIN_PASSWORD_HASH is malformed, so sign-in is disabled. Run npm run hash-password again."
          : auth.passwordStrong
          ? "Strong, but stored in plain text. Prefer ADMIN_PASSWORD_HASH (npm run hash-password)."
          : "Weak or the demo password. Production refuses it.",
    },
    {
      id: "encryption-key",
      label: "Credential encryption key",
      state: enc.dedicatedKey ? "ok" : auth.production ? "fail" : "warn",
      detail: enc.dedicatedKey ? "CREDENTIALS_ENCRYPTION_KEY is set." : "Derived from SESSION_SECRET. Set CREDENTIALS_ENCRYPTION_KEY.",
    },
    {
      id: "https",
      label: "HTTPS site address",
      state: site.startsWith("https://") ? "ok" : auth.production ? "fail" : "warn",
      detail: site.startsWith("https://") ? site : "NEXT_PUBLIC_SITE_URL should be your https:// address in production.",
    },
    {
      id: "payments",
      label: "Payments",
      state: rzp.enabled ? (rzp.mode === "live" ? "ok" : "warn") : demoCheckoutAllowed() && auth.production ? "fail" : "warn",
      detail: rzp.enabled
        ? rzp.mode === "live"
          ? `Razorpay live mode${rzp.webhooksEnabled ? ", webhooks on" : ", but no webhook secret"}.`
          : "Razorpay test mode. Switch to live keys before launch."
        : demoCheckoutAllowed()
          ? "Demo checkout is ON: orders are marked paid without payment."
          : "Razorpay not configured. Checkout is closed in production.",
    },
    {
      id: "database",
      label: "Database",
      state: process.env.MONGODB_URI?.trim() ? "ok" : auth.production ? "fail" : "warn",
      detail: process.env.MONGODB_URI?.trim() ? "MongoDB." : "Local JSON file. Use MongoDB in production.",
    },
  ];
}
