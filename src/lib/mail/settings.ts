import "server-only";
import type { MailSettingsInput } from "@/lib/admin/schemas";
import { encryptSecret } from "@/lib/secrets";
import type { MailSettings } from "@/lib/types";
import { MailConfigError, toSmtpConfig, withDefaults } from "./send";
import type { SmtpConfig } from "./transport";

/**
 * Turning admin form input into stored settings.
 *
 * Password rules (the password is write-only — it never leaves the server):
 *  - `password` present → encrypt and replace;  omitted → keep the saved one;  `clearPassword` → remove.
 *  - The saved password is only ever reused with the SAME host and username. Changing either
 *    requires typing the password again, so a hijacked admin session can't point the host at
 *    its own server and have us hand over the saved credentials.
 */

export class MailInputError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}

const norm = (h: string) => h.trim().toLowerCase();

export function sameAccount(a: Pick<MailSettings, "host" | "username">, b: Pick<MailSettings, "host" | "username">) {
  return norm(a.host) === norm(b.host) && a.username.trim() === b.username.trim();
}

function connectionKey(m: Pick<MailSettings, "host" | "port" | "security" | "username">) {
  return [norm(m.host), m.port, m.security, m.username.trim()].join("|");
}

const RE_ENTER = "Re-enter the password — it's required when the host or username changes.";

export function applyMailInput(saved: MailSettings | undefined, input: MailSettingsInput): MailSettings {
  const prev = withDefaults(saved);
  const accountChanged = !sameAccount(prev, input);

  let passwordEnc = input.clearPassword ? undefined : prev.passwordEnc;
  if (input.password) passwordEnc = encryptSecret(input.password);
  else if (passwordEnc && accountChanged) {
    if (input.username) throw new MailInputError("password", RE_ENTER);
    passwordEnc = undefined; // switched to no authentication
  }

  const next: MailSettings = {
    enabled: input.enabled,
    host: input.host.trim(),
    port: input.port,
    security: input.security,
    username: input.username.trim(),
    passwordEnc,
    fromName: input.fromName.trim(),
    fromEmail: input.fromEmail.trim(),
    replyTo: input.replyTo?.trim() ?? "",
    staffRecipients: [...new Set(input.staffRecipients.map((r) => r.trim().toLowerCase()))],
    events: { ...prev.events, ...input.events },
    updatedAt: new Date().toISOString(),
    // a verification only stays valid while the connection details and password are unchanged
    verifiedAt: connectionKey(prev) === connectionKey(input) && passwordEnc === prev.passwordEnc ? prev.verifiedAt : undefined,
  };
  if (!next.passwordEnc) delete next.passwordEnc;
  return next;
}

/** Transport config for unsaved form values (Test connection / Send test), falling back to the saved password. */
export function draftSmtpConfig(saved: MailSettings | undefined, input: MailSettingsInput): SmtpConfig {
  const prev = withDefaults(saved);
  const draft = { ...prev, ...input, passwordEnc: undefined };
  if (input.password) return toSmtpConfig(draft, input.password);
  if (input.clearPassword || !input.username) return toSmtpConfig(draft, "");
  if (!prev.passwordEnc) throw new MailConfigError("Enter the SMTP password.");
  if (!sameAccount(prev, input)) throw new MailConfigError(RE_ENTER);
  return toSmtpConfig({ ...draft, passwordEnc: prev.passwordEnc });
}

/** True when the draft would connect exactly like the saved settings (so a successful check can be recorded). */
export function matchesSaved(saved: MailSettings | undefined, input: MailSettingsInput) {
  const prev = withDefaults(saved);
  return connectionKey(prev) === connectionKey(input) && !input.password && !input.clearPassword && Boolean(prev.passwordEnc || !prev.username);
}
