import "server-only";
import { mutateDb, readDb } from "@/lib/db";
import { decryptSecret } from "@/lib/secrets";
import type { MailEvent, MailLogEntry, MailSettings } from "@/lib/types";
import { uid } from "@/lib/utils";
import { DEFAULT_MAIL_SETTINGS, isMailConfigured } from "./shared";
import { describeSmtpError, fromHeader, transportFor, type SmtpConfig } from "./transport";
import type { Rendered } from "./templates";

/**
 * Delivery: resolve the admin-managed SMTP settings, send, and record the attempt in the
 * delivery log (newest first, capped). Message bodies are never stored — only metadata.
 */

export const MAIL_LOG_LIMIT = 200;

export class MailConfigError extends Error {}

/** Saved settings with defaults filled in (server-side; includes the encrypted password). */
export function withDefaults(m?: MailSettings): MailSettings {
  return { ...DEFAULT_MAIL_SETTINGS, ...m, events: { ...DEFAULT_MAIL_SETTINGS.events, ...m?.events } };
}

/** Decrypt the stored password and build a transport config. Throws MailConfigError with an admin-readable reason. */
export function toSmtpConfig(m: MailSettings, passwordOverride?: string): SmtpConfig {
  if (!isMailConfigured(m)) throw new MailConfigError("SMTP host, port and From email are required.");
  let password = passwordOverride ?? "";
  if (passwordOverride === undefined && m.passwordEnc) {
    try {
      password = decryptSecret(m.passwordEnc);
    } catch {
      throw new MailConfigError("The saved SMTP password can't be decrypted — the encryption key has changed. Re-enter the password in Admin → Email.");
    }
  }
  if (m.username && !password) throw new MailConfigError("A username is set but no password is saved.");
  return {
    host: m.host.trim(),
    port: m.port,
    security: m.security,
    username: m.username.trim(),
    password,
    fromName: m.fromName.trim(),
    fromEmail: m.fromEmail.trim(),
    replyTo: m.replyTo?.trim() || undefined,
  };
}

export type DeliveryResult = { status: MailLogEntry["status"]; error?: string; messageId?: string };

type Outgoing = {
  event: MailEvent | "test";
  to: string | string[];
  message: Rendered;
  /** overrides the configured Reply-To (e.g. staff replies go straight to the learner) */
  replyTo?: string;
  /** related order / enquiry id, shown in the log */
  ref?: string;
};

/**
 * Send one message. For notifications, pass the saved settings: disabled mail or a disabled event
 * returns "skipped" without logging (nothing to report). Test sends pass `force` to bypass both toggles.
 */
export async function deliver(out: Outgoing, opts: { settings: MailSettings; config?: SmtpConfig; force?: boolean }): Promise<DeliveryResult> {
  const { settings } = opts;
  if (!opts.force) {
    if (!settings.enabled || !isMailConfigured(settings)) return { status: "skipped" };
    if (out.event !== "test" && !settings.events[out.event]) return { status: "skipped" };
  }

  const recipients = (Array.isArray(out.to) ? out.to : [out.to]).map((r) => r.trim()).filter(Boolean);
  if (!recipients.length) {
    const result: DeliveryResult = { status: "skipped", error: "No recipients — add staff recipients in Admin → Email." };
    await log(out, recipients, result);
    return result;
  }

  let result: DeliveryResult;
  try {
    const config = opts.config ?? toSmtpConfig(settings);
    const info = await transportFor(config).sendMail({
      from: fromHeader(config),
      to: recipients,
      replyTo: out.replyTo || config.replyTo,
      subject: out.message.subject,
      html: out.message.html,
      text: out.message.text,
      headers: { "X-Delta-Event": out.event, ...(out.ref ? { "X-Delta-Ref": out.ref } : {}) },
    });
    const rejected = (info.rejected ?? []).map(String);
    result = rejected.length
      ? { status: "failed", error: `Rejected by the server: ${rejected.join(", ")}`, messageId: info.messageId }
      : { status: "sent", messageId: info.messageId };
  } catch (err) {
    result = { status: "failed", error: err instanceof MailConfigError ? err.message : describeSmtpError(err) };
    console.error(`[mail] ${out.event} → ${recipients.join(", ")} failed: ${result.error}`);
  }
  await log(out, recipients, result);
  return result;
}

async function log(out: Outgoing, recipients: string[], result: DeliveryResult) {
  const entry: MailLogEntry = {
    id: uid("ml"),
    at: new Date().toISOString(),
    event: out.event,
    to: recipients.join(", ").slice(0, 300),
    subject: out.message.subject.slice(0, 200),
    status: result.status,
    ...(result.error ? { error: result.error } : {}),
    ...(result.messageId ? { messageId: result.messageId } : {}),
    ...(out.ref ? { ref: out.ref } : {}),
  };
  try {
    await mutateDb((db) => {
      db.mailLog = [entry, ...(db.mailLog ?? [])].slice(0, MAIL_LOG_LIMIT);
    });
  } catch (err) {
    console.error("[mail] could not write the delivery log", err);
  }
}

/** Everything a notification needs from the database in one read. */
export async function mailContext() {
  const db = await readDb();
  return { db, settings: withDefaults(db.mail) };
}
