// Client-safe mail constants (no secrets, no Node APIs).
import type { MailEvent, MailSettings, SmtpSecurity } from "@/lib/types";

export const MAIL_EVENT_META: Record<MailEvent, { label: string; description: string; audience: "Staff" | "Learner" }> = {
  enquiry_staff: { label: "New enquiry", description: "Staff get the learner's details and message when the mentor form is submitted.", audience: "Staff" },
  enquiry_learner: { label: "Enquiry received", description: "The learner gets a confirmation that a mentor will reply.", audience: "Learner" },
  order_staff: { label: "New paid order", description: "Staff get the order number, items and total when a payment succeeds.", audience: "Staff" },
  order_learner: { label: "Order receipt", description: "The learner gets a receipt with their order number and what happens next.", audience: "Learner" },
  refund_learner: { label: "Refund issued", description: "The learner is told when a refund is issued from Orders.", audience: "Learner" },
};

export const DEFAULT_MAIL_SETTINGS: MailSettings = {
  enabled: false,
  host: "",
  port: 587,
  security: "starttls",
  username: "",
  fromName: "Delta Markets Academy",
  fromEmail: "",
  replyTo: "",
  staffRecipients: [],
  events: { enquiry_staff: true, enquiry_learner: true, order_staff: true, order_learner: true, refund_learner: true },
};

export const SECURITY_LABEL: Record<SmtpSecurity, string> = {
  ssl: "SSL/TLS (usually port 465)",
  starttls: "STARTTLS (usually port 587)",
  none: "None (local testing only)",
};

export const SMTP_PRESETS: { id: string; label: string; host: string; port: number; security: SmtpSecurity; note: string }[] = [
  { id: "gmail", label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 465, security: "ssl", note: "Use a 16-character App Password (Google Account → Security → App passwords); 2-Step Verification must be on." },
  { id: "outlook", label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, security: "starttls", note: "SMTP AUTH must be enabled for this mailbox in the Microsoft 365 admin centre." },
  { id: "zoho", label: "Zoho Mail (India)", host: "smtp.zoho.in", port: 465, security: "ssl", note: "Use smtp.zoho.com for non-India accounts. Use an app-specific password if 2FA is on." },
  { id: "hostinger", label: "Hostinger", host: "smtp.hostinger.com", port: 465, security: "ssl", note: "Username is the full mailbox address, e.g. hello@yourdomain.com." },
  { id: "sendgrid", label: "SendGrid", host: "smtp.sendgrid.net", port: 587, security: "starttls", note: "Username is literally “apikey”; the password is your API key. Verify the sender first." },
  { id: "ses", label: "Amazon SES (Mumbai)", host: "email-smtp.ap-south-1.amazonaws.com", port: 587, security: "starttls", note: "Use SES SMTP credentials (not IAM access keys). Request production access before emailing learners." },
  { id: "mailgun", label: "Mailgun", host: "smtp.mailgun.org", port: 587, security: "starttls", note: "Use the domain's SMTP login, e.g. postmaster@mg.yourdomain.com." },
];

/** What the browser is allowed to see: everything except the encrypted password. */
export type PublicMailSettings = Omit<MailSettings, "passwordEnc"> & { hasPassword: boolean };

export function toPublicMailSettings(m?: MailSettings): PublicMailSettings {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordEnc, ...rest } = { ...DEFAULT_MAIL_SETTINGS, ...m, events: { ...DEFAULT_MAIL_SETTINGS.events, ...m?.events } };
  return { ...rest, hasPassword: Boolean(m?.passwordEnc) };
}

/** Configured enough to attempt delivery. */
export function isMailConfigured(m?: Pick<MailSettings, "host" | "port" | "fromEmail">) {
  return Boolean(m?.host && m.port && m.fromEmail);
}
