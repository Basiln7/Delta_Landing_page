import "server-only";
import { authConfigStatus } from "@/lib/auth";
import { razorpayConfig } from "@/lib/payments/razorpay";
import { encryptionStatus } from "@/lib/secrets";
import type { AdminSecurity } from "@/lib/types";
import { demoCheckoutAllowed } from "./policy";

export type CheckState = "ok" | "warn" | "fail";
export type Check = { id: string; label: string; state: CheckState; detail: string };

/** Production-readiness checks for Admin → Security. Reports booleans only — never secret values. */
export function securityChecklist(sec: AdminSecurity): Check[] {
  const auth = authConfigStatus();
  const enc = encryptionStatus();
  const rzp = razorpayConfig();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const codesLeft = (sec.recoveryCodes ?? []).filter((c) => !c.usedAt).length;

  return [
    {
      id: "2fa",
      label: "Two-step verification",
      state: sec.totp ? (codesLeft >= 3 ? "ok" : "warn") : "fail",
      detail: sec.totp
        ? codesLeft >= 3
          ? `On. ${codesLeft} recovery codes left.`
          : `On, but only ${codesLeft} recovery code${codesLeft === 1 ? "" : "s"} left. Generate new ones.`
        : "Off. A stolen password alone gives full access.",
    },
    {
      id: "session-secret",
      label: "Session signing secret",
      state: auth.sessionSecretStrong ? "ok" : auth.production ? "fail" : "warn",
      detail: auth.sessionSecretStrong ? "Random and long enough." : "SESSION_SECRET is missing, short or a public placeholder.",
    },
    {
      id: "admin-password",
      label: "Admin password",
      state: auth.passwordHashed ? "ok" : auth.passwordStrong ? "warn" : auth.production ? "fail" : "warn",
      detail: auth.passwordHashed
        ? "Stored as a scrypt hash (ADMIN_PASSWORD_HASH)."
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
