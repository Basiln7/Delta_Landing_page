import "server-only";
import crypto from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import type { SmtpSecurity } from "@/lib/types";

export type SmtpConfig = {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
};

let cache: { fingerprint: string; transport: Transporter } | null = null;

function fingerprint(c: SmtpConfig) {
  return crypto.createHash("sha256").update([c.host, c.port, c.security, c.username, c.password].join("\u0000")).digest("hex");
}

function build(c: SmtpConfig, pooled: boolean) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.security === "ssl", // implicit TLS (465)
    requireTLS: c.security === "starttls", // upgrade required (587)
    ignoreTLS: c.security === "none",
    auth: c.username ? { user: c.username, pass: c.password } : undefined,
    pool: pooled,
    maxConnections: 3,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

/** Pooled transport, re-created only when the SMTP settings change. */
export function transportFor(c: SmtpConfig): Transporter {
  const fp = fingerprint(c);
  if (cache?.fingerprint !== fp) {
    cache?.transport.close();
    cache = { fingerprint: fp, transport: build(c, true) };
  }
  return cache.transport;
}

/** One-off connection + authentication check (does not touch the shared pool). */
export async function verifySmtp(c: SmtpConfig) {
  const t = build(c, false);
  try {
    await t.verify();
  } finally {
    t.close();
  }
}

export function fromHeader(c: Pick<SmtpConfig, "fromName" | "fromEmail">) {
  return c.fromName ? { name: c.fromName, address: c.fromEmail } : c.fromEmail;
}

/** Turn nodemailer errors into something an admin can act on (never includes the password). */
export function describeSmtpError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string; command?: string };
  const msg = (e?.message ?? "").toLowerCase();
  if (e?.code === "EAUTH" || e?.responseCode === 535 || msg.includes("authentication")) {
    return "Authentication failed — check the username and password. Gmail and Zoho need an app password when 2-step verification is on.";
  }
  if (msg.includes("wrong version number") || msg.includes("ssl routines") || msg.includes("tls")) {
    return "TLS mismatch — use SSL/TLS on port 465 or STARTTLS on port 587.";
  }
  // nodemailer wraps socket errors (code "ESOCKET"/"ECONNECTION"), so match the message too.
  if (e?.code === "ECONNREFUSED" || msg.includes("econnrefused")) return "Connection refused — nothing is listening on that host and port. Check the port number.";
  if (e?.code === "ETIMEDOUT" || msg.includes("timeout") || msg.includes("etimedout")) return "Connection timed out — check the host and port, and that outbound SMTP isn't blocked by your network or host.";
  if (e?.code === "EDNS" || msg.includes("getaddrinfo") || msg.includes("enotfound") || msg.includes("eai_again")) return "Host not found — check the SMTP server name.";
  if (msg.includes("econnreset") || msg.includes("socket hang up")) return "The server closed the connection — check the port and security setting.";
  if (e?.code === "EENVELOPE" || e?.responseCode === 550 || e?.responseCode === 553) return `The server rejected the sender or recipient (${e.responseCode ?? e.code}). Use a From address your provider has verified.`;
  return (e?.message ?? "Unknown SMTP error").slice(0, 300);
}
