import "server-only";
import { formatPrice, type Currency } from "@/lib/commerce";
import type { Enquiry, Order, SiteSettings } from "@/lib/types";

/**
 * Transactional email templates. Table-based layout + inline styles (Gmail, Outlook, Apple Mail),
 * a plain-text alternative for every message, and HTML-escaping of ALL user-supplied values.
 */

export type Rendered = { subject: string; html: string; text: string };

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Header values must stay on one line (no CR/LF injection). */
const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

const C = { ink: "#14151c", night: "#0a0f1c", lime: "#d3fb52", mute: "#5b6475", line: "#e4e8f3", snow: "#f6f8fb", green: "#10b981" };

function rows(items: [string, string][]) {
  return items
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};color:${C.mute};font-size:13px;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid ${C.line};color:${C.ink};font-size:14px;vertical-align:top">${v}</td></tr>`,
    )
    .join("");
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="background:${C.lime};border-radius:999px"><a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:600;color:${C.ink};text-decoration:none">${esc(label)} &rarr;</a></td></tr></table>`;
}

function layout(o: { brand: SiteSettings; preheader: string; heading: string; intro: string; body?: string; cta?: { href: string; label: string }; audience: "staff" | "learner" }) {
  const { brand } = o;
  const footer =
    o.audience === "learner"
      ? `${esc(brand.name)} · ${esc(brand.contact.phone)} · <a href="mailto:${esc(brand.contact.email)}" style="color:${C.mute}">${esc(brand.contact.email)}</a><br/><span style="font-size:11px">Education only — not investment advice. Investments in the securities market are subject to market risks.</span>`
      : `Automatic notification from the ${esc(brand.name)} website. Manage email settings in Admin → Email.`;
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>${esc(o.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.snow};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(o.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.snow};padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${C.line}">
<tr><td style="background:${C.night};padding:22px 28px"><span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#ffffff">delta</span><span style="display:inline-block;margin-left:8px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${C.lime}">${esc(brand.name.replace(/^Delta\s*/i, ""))}</span></td></tr>
<tr><td style="height:4px;background:${C.lime};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:30px 28px 26px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${C.ink}">${esc(o.heading)}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#2d3445">${o.intro}</p>
${o.body ?? ""}
${o.cta ? button(o.cta.href, o.cta.label) : ""}
</td></tr>
<tr><td style="padding:18px 28px;background:${C.snow};font-size:12px;line-height:1.6;color:${C.mute}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function text(lines: (string | false | undefined)[]) {
  return lines.filter((l) => l !== false && l !== undefined).join("\n");
}

/* ───────────── templates ───────────── */

export function enquiryStaff(e: Enquiry, brand: SiteSettings): Rendered {
  const link = `${siteUrl()}/admin/enquiries?open=${encodeURIComponent(e.id)}`;
  return {
    subject: oneLine(`New enquiry: ${e.parentName} — ${e.program}`),
    html: layout({
      brand,
      audience: "staff",
      preheader: `${e.parentName} is interested in ${e.program}`,
      heading: "New enquiry from the website",
      intro: `<strong>${esc(e.parentName)}</strong> asked to talk to a mentor about <strong>${esc(e.program)}</strong>. The website promises a reply within one working day.`,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">${rows([
        ["Name", esc(e.parentName)],
        ["Email", `<a href="mailto:${esc(e.email)}" style="color:${C.ink}">${esc(e.email)}</a>`],
        ["Phone / WhatsApp", esc(e.phone)],
        ["Interested in", esc(e.program)],
        ["Message", esc(e.message).replace(/\n/g, "<br/>")],
      ])}</table>`,
      cta: { href: link, label: "Open in admin" },
    }),
    text: text([`New enquiry from the website`, ``, `Name: ${e.parentName}`, `Email: ${e.email}`, e.phone && `Phone: ${e.phone}`, `Interested in: ${e.program}`, e.message && `Message: ${e.message}`, ``, `Open: ${link}`]),
  };
}

export function enquiryLearner(e: Enquiry, brand: SiteSettings): Rendered {
  const first = e.parentName.split(" ")[0];
  return {
    subject: oneLine(`We've got your message, ${first}`),
    html: layout({
      brand,
      audience: "learner",
      preheader: "A mentor will reply within one working day.",
      heading: `Thanks, ${first} — we've got your message`,
      intro: `A mentor from ${esc(brand.name)} will reply within one working day with the right course and batch for your goal. Prefer to chat now? Message us on WhatsApp at <strong>${esc(brand.contact.whatsapp || brand.contact.phone)}</strong> — we reply in English and Malayalam.`,
      body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">${rows([
        ["You're interested in", esc(e.program)],
        ["Your message", esc(e.message || "—").replace(/\n/g, "<br/>")],
      ])}</table>`,
      cta: { href: `${siteUrl()}/#learn`, label: "See the program" },
    }),
    text: text([`Thanks, ${first} — we've got your message.`, ``, `A mentor will reply within one working day.`, `Interested in: ${e.program}`, ``, `WhatsApp: ${brand.contact.whatsapp || brand.contact.phone}`, ``, `${brand.name} — education only, not investment advice.`]),
  };
}

function itemsTable(o: Order, currency: Currency) {
  const money = (n: number) => esc(formatPrice(n, currency));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">${rows([
    ...o.items.map((i) => [i.title, money(i.price)] as [string, string]),
    ...(o.discount > 0 ? ([[`Coupon ${o.coupon ?? ""}`.trim(), `−${money(o.discount)}`]] as [string, string][]) : []),
    ["Total paid", `<strong>${money(o.total)}</strong>`],
  ])}</table>`;
}

export function orderLearner(o: Order, brand: SiteSettings, currency: Currency): Rendered {
  const first = o.customer.name.split(" ")[0];
  return {
    subject: oneLine(`Your receipt — order ${o.number}`),
    html: layout({
      brand,
      audience: "learner",
      preheader: `Order ${o.number} confirmed · ${formatPrice(o.total, currency)}`,
      heading: `You're in, ${first}!`,
      intro: `Payment received for order <strong>${esc(o.number)}</strong>. Your login and batch schedule will follow shortly. Keep this email as your receipt.`,
      body: `${itemsTable(o, currency)}<p style="margin:18px 0 0;font-size:13px;color:${C.mute}">Payment method: ${esc((o.gatewayMethod ?? o.paymentMethod).toUpperCase())}${o.gatewayPaymentId ? ` · Ref ${esc(o.gatewayPaymentId)}` : ""}. Not happy? Request a full refund within 7 days.</p>`,
      cta: { href: `${siteUrl()}/#learn`, label: "What happens next" },
    }),
    text: text([`You're in, ${first}!`, ``, `Order ${o.number} — payment received.`, ...o.items.map((i) => `- ${i.title}: ${formatPrice(i.price, currency)}`), o.discount > 0 && `Coupon ${o.coupon ?? ""}: -${formatPrice(o.discount, currency)}`, `Total paid: ${formatPrice(o.total, currency)}`, ``, `7-day refund policy applies.`, `${brand.name} — education only, not investment advice.`]),
  };
}

export function orderStaff(o: Order, brand: SiteSettings, currency: Currency): Rendered {
  const link = `${siteUrl()}/admin/orders?open=${encodeURIComponent(o.id)}`;
  return {
    subject: oneLine(`New order ${o.number} — ${formatPrice(o.total, currency)} from ${o.customer.name}`),
    html: layout({
      brand,
      audience: "staff",
      preheader: `${o.customer.name} paid ${formatPrice(o.total, currency)}`,
      heading: `New paid order ${o.number}`,
      intro: `<strong>${esc(o.customer.name)}</strong> just paid <strong>${esc(formatPrice(o.total, currency))}</strong>${o.gateway === "razorpay" ? " via Razorpay" : " (demo checkout)"}.`,
      body: `${itemsTable(o, currency)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${rows([
        ["Email", `<a href="mailto:${esc(o.customer.email)}" style="color:${C.ink}">${esc(o.customer.email)}</a>`],
        ["Phone", esc(o.customer.phone)],
        ["Payment", esc(`${(o.gatewayMethod ?? o.paymentMethod).toUpperCase()}${o.gatewayPaymentId ? ` · ${o.gatewayPaymentId}` : ""}`)],
      ])}</table>`,
      cta: { href: link, label: "Open order" },
    }),
    text: text([`New paid order ${o.number}`, ``, `Customer: ${o.customer.name} <${o.customer.email}> ${o.customer.phone}`, ...o.items.map((i) => `- ${i.title}: ${formatPrice(i.price, currency)}`), `Total: ${formatPrice(o.total, currency)}`, ``, `Open: ${link}`]),
  };
}

export function refundLearner(o: Order, brand: SiteSettings, currency: Currency): Rendered {
  const first = o.customer.name.split(" ")[0];
  return {
    subject: oneLine(`Refund issued — order ${o.number}`),
    html: layout({
      brand,
      audience: "learner",
      preheader: `${formatPrice(o.total, currency)} is on its way back to you`,
      heading: `Your refund is on its way, ${first}`,
      intro: `We've issued a full refund of <strong>${esc(formatPrice(o.total, currency))}</strong> for order <strong>${esc(o.number)}</strong>. It usually reaches your original payment method within 5–7 working days.`,
      body: `<p style="margin:18px 0 0;font-size:13px;color:${C.mute}">${o.refundId ? `Refund reference: ${esc(o.refundId)}. ` : ""}Questions? Reply to this email or message us on WhatsApp at ${esc(brand.contact.whatsapp || brand.contact.phone)}.</p>`,
    }),
    text: text([`Your refund is on its way, ${first}.`, ``, `Refund of ${formatPrice(o.total, currency)} for order ${o.number}.`, `Expect it within 5–7 working days.`, o.refundId && `Reference: ${o.refundId}`]),
  };
}

/** Invite to the admin, or a password reset. The link works once; only its hash is stored. */
export function adminInvite(
  brand: SiteSettings,
  o: { name: string; roleLabel: string; url: string; purpose: "invite" | "reset"; expiresAt: string; by: string },
): Rendered {
  const first = o.name.split(" ")[0] || o.name;
  const until = new Date(o.expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const invite = o.purpose === "invite";
  const intro = invite
    ? `<strong>${esc(o.by)}</strong> added you to the ${esc(brand.name)} admin as <strong>${esc(o.roleLabel)}</strong>. Choose a password to activate your account.`
    : `<strong>${esc(o.by)}</strong> started a password reset for your ${esc(brand.name)} admin account. Your old password no longer works. Choose a new one to sign in again.`;
  return {
    subject: oneLine(invite ? `You've been invited to the ${brand.name} admin` : `Reset your ${brand.name} admin password`),
    html: layout({
      brand,
      audience: "staff",
      preheader: invite ? "Choose a password to activate your admin account." : "Choose a new password for your admin account.",
      heading: invite ? `Welcome, ${first}` : `Set a new password, ${first}`,
      intro,
      body: `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${C.mute}">This link works once and expires on ${esc(until)}. If you weren't expecting this email, you can ignore it.</p>`,
      cta: { href: o.url, label: invite ? "Choose your password" : "Set a new password" },
    }),
    text: text([
      invite ? `Welcome, ${first}.` : `Set a new password, ${first}.`,
      ``,
      invite
        ? `${o.by} added you to the ${brand.name} admin as ${o.roleLabel}. Choose a password to activate your account:`
        : `${o.by} started a password reset for your ${brand.name} admin account. Your old password no longer works. Choose a new one:`,
      o.url,
      ``,
      `This link works once and expires on ${until}.`,
    ]),
  };
}

export function testEmail(brand: SiteSettings, requestedBy: string): Rendered {
  const at = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return {
    subject: oneLine(`Test email from ${brand.name}`),
    html: layout({
      brand,
      audience: "staff",
      preheader: "Your SMTP settings work.",
      heading: "Your SMTP settings work ✓",
      intro: `This test was sent from Admin → Email by <strong>${esc(requestedBy)}</strong> on ${esc(at)}. Enquiry, order and refund notifications will be delivered the same way.`,
    }),
    text: text([`Your SMTP settings work.`, ``, `Sent from Admin → Email by ${requestedBy} on ${at}.`]),
  };
}
