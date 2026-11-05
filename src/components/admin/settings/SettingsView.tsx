"use client";

import { toast } from "sonner";
import { Copy, Plus, TerminalSquare, Trash2 } from "lucide-react";
import { Button, Card, Field, Input, PageHeader, Textarea } from "@/components/admin/ui";
import { SaveBar, Section, useSettingsForm } from "@/components/admin/content/SettingsForm";
import type { SiteSettings } from "@/lib/types";
import { whatsappHref } from "@/lib/utils";
import { DEFAULT_CURRENCY, formatPrice } from "@/lib/commerce";

/** ISO (any offset) → value for <input type="datetime-local"> in the admin's local time. */
function toLocalInput(iso?: string) {
  if (!iso || Number.isNaN(Date.parse(iso))) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SettingsView({ initial }: { initial: SiteSettings }) {
  const { draft, update, updateIn, dirty, saving, save, discard } = useSettingsForm(initial);
  const { contact, socials } = draft;
  const currency = draft.currency ?? DEFAULT_CURRENCY;

  const setSocial = (i: number, patch: Partial<SiteSettings["socials"][number]>) =>
    update(
      "socials",
      socials.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    );

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" description="Academy identity, store currency, contact details and social channels used across the website." />

      <Card className="p-5 sm:p-8">
        <Section title="Identity" description="Used in the navigation, footer and search results.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Academy name *" htmlFor="s-name">
              <Input id="s-name" value={draft.name} onChange={(e) => update("name", e.target.value)} />
            </Field>
            <Field label="Short name *" htmlFor="s-short">
              <Input id="s-short" value={draft.shortName} onChange={(e) => update("shortName", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section
          id="offer"
          title="Flagship & launch offer"
          description="The flagship program and its launch-price countdown. The countdown hides itself automatically once the end date passes."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Flagship course id *" htmlFor="s-flagship" hint="The course shown in “What you'll learn” (Content → Courses).">
              <Input id="s-flagship" value={draft.flagshipCourseId ?? ""} onChange={(e) => update("flagshipCourseId", e.target.value)} placeholder="c_flagship" />
            </Field>
            <Field label="Launch price ends" htmlFor="s-offer" hint="Leave empty to hide the countdown.">
              <div className="flex gap-2">
                <Input
                  id="s-offer"
                  type="datetime-local"
                  value={toLocalInput(draft.offerEndsAt)}
                  onChange={(e) => update("offerEndsAt", e.target.value ? new Date(e.target.value).toISOString() : "")}
                />
                {draft.offerEndsAt && (
                  <Button type="button" variant="ghost" onClick={() => update("offerEndsAt", "")}>
                    Clear
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Brochure link" htmlFor="s-brochure" hint="Upload the PDF in Media and paste its URL. Empty = “Brochure” asks for it on WhatsApp.">
              <Input id="s-brochure" value={draft.brochureUrl ?? ""} onChange={(e) => update("brochureUrl", e.target.value)} placeholder="/uploads/delta-brochure.pdf" />
            </Field>
            <Field label="Successful students" htmlFor="s-students" hint="Shown in the hero as “10,000+ successful students”.">
              <Input id="s-students" type="number" min={0} value={draft.studentsCount ?? 0} onChange={(e) => update("studentsCount", Number(e.target.value) || 0)} />
            </Field>
          </div>
        </Section>

        <Section id="trust" title="Trust & compliance" description="Academy badges in the hero, and the risk disclaimer shown in the footer.">
          <Field label="Badges (one per line)" htmlFor="s-badges">
            <Textarea
              id="s-badges"
              rows={3}
              value={(draft.badges ?? []).join("\n")}
              onChange={(e) => update("badges", e.target.value.split("\n").map((b) => b.trimStart()).filter((b, i, a) => b || i === a.length - 1))}
            />
          </Field>
          <Field label="Risk disclaimer *" htmlFor="s-risk" hint="Required for financial education. Keep “education only, not investment advice” wording.">
            <Textarea id="s-risk" rows={5} value={draft.riskDisclaimer ?? ""} onChange={(e) => update("riskDisclaimer", e.target.value)} />
          </Field>
        </Section>

        <Section
          id="store"
          title="Store"
          description="Currency for course and plan prices. Prices are stored as whole numbers — changing the currency does not convert them."
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Currency code *" htmlFor="cur-code" hint="ISO 4217, e.g. INR, USD, AED">
              <Input
                id="cur-code"
                value={currency.code}
                maxLength={3}
                className="font-mono uppercase"
                onChange={(e) => updateIn("currency", { code: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Symbol *" htmlFor="cur-symbol" hint="Fallback if the browser can't format the code">
              <Input id="cur-symbol" value={currency.symbol} maxLength={6} onChange={(e) => updateIn("currency", { symbol: e.target.value })} />
            </Field>
            <Field label="Number format (locale) *" htmlFor="cur-locale" hint="e.g. en-IN groups as 1,00,000">
              <Input id="cur-locale" value={currency.locale} className="font-mono" onChange={(e) => updateIn("currency", { locale: e.target.value })} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm">
            <span className="eyebrow text-ink/45">Preview</span>
            {[1499, 24999, 129999].map((amount) => (
              <span key={amount} className="font-medium tabular-nums">
                {formatPrice(amount, currency)}
              </span>
            ))}
          </div>
        </Section>

        <Section title="Contact" description="Shown in the counselling section and footer.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Support email *" htmlFor="c-email">
              <Input id="c-email" type="email" value={contact.email} onChange={(e) => updateIn("contact", { email: e.target.value })} />
            </Field>
            <Field label="Phone" htmlFor="c-phone">
              <Input id="c-phone" type="tel" value={contact.phone} onChange={(e) => updateIn("contact", { phone: e.target.value })} />
            </Field>
            <Field label="Address" htmlFor="c-address">
              <Input id="c-address" value={contact.address} onChange={(e) => updateIn("contact", { address: e.target.value })} />
            </Field>
            <Field label="Office hours" htmlFor="c-hours">
              <Input id="c-hours" value={contact.hours} onChange={(e) => updateIn("contact", { hours: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section
          id="whatsapp"
          title="WhatsApp chat"
          description="Powers the floating “Chat with us” button and the WhatsApp links on the website. Leave the number empty to hide them."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="WhatsApp number" htmlFor="c-whatsapp">
              <Input
                id="c-whatsapp"
                type="tel"
                placeholder="+91 86069 24500"
                value={contact.whatsapp ?? ""}
                onChange={(e) => updateIn("contact", { whatsapp: e.target.value })}
              />
            </Field>
            <Field label="Pre-filled message" htmlFor="c-whatsapp-msg">
              <Input
                id="c-whatsapp-msg"
                value={contact.whatsappMessage ?? ""}
                onChange={(e) => updateIn("contact", { whatsappMessage: e.target.value })}
              />
            </Field>
          </div>
          {whatsappHref(contact.whatsapp) && (
            <a
              href={whatsappHref(contact.whatsapp, contact.whatsappMessage)!}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
            >
              Test the chat link ↗
            </a>
          )}
        </Section>

        <Section title="Social channels" description="Links in the footer. Leave a URL as # until the channel goes live.">
          <ul className="space-y-2">
            {socials.map((s, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[12rem_1fr_auto]">
                <Input aria-label={`Channel ${i + 1} name`} value={s.label} onChange={(e) => setSocial(i, { label: e.target.value })} placeholder="Instagram" />
                <Input
                  aria-label={`Channel ${i + 1} URL`}
                  value={s.href}
                  onChange={(e) => setSocial(i, { href: e.target.value })}
                  placeholder="https://…"
                  className="col-span-2 row-start-2 font-mono text-xs sm:col-span-1 sm:row-start-auto"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 text-ink/50 hover:bg-pin/10 hover:text-pin"
                  aria-label={`Remove ${s.label || "channel"}`}
                  onClick={() =>
                    update(
                      "socials",
                      socials.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" onClick={() => update("socials", [...socials, { label: "", href: "#" }])} disabled={socials.length >= 12}>
            <Plus className="size-3.5" /> Add channel
          </Button>
        </Section>
      </Card>

      <Card className="mt-6 border-pin/25 p-5 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:gap-10">
          <div>
            <p className="eyebrow text-pin">Danger zone</p>
            <h3 className="display mt-2 text-2xl">Reset demo data</h3>
            <p className="mt-1.5 text-sm text-ink/55">Restores every course, order, request and setting to the original mock data.</p>
          </div>
          <div className="space-y-3 text-sm text-ink/70">
            <p>
              Data lives in <strong>MongoDB</strong> (the <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-xs">MONGODB_DB</code> database) when{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-xs">MONGODB_URI</code> is set, otherwise in{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-xs">storage/db.json</code>. Uploaded files are in{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-xs">storage/uploads/</code>. To start fresh, run this in the project folder and reload —
              the database re-seeds from the mock data on the next request. This deletes all orders and enquiries.
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-ink px-4 py-3 font-mono text-[0.8125rem] text-paper">
              <TerminalSquare className="size-4 shrink-0 text-brass-light" />
              <span className="flex-1">npm run db:reset</span>
              <button
                onClick={() => navigator.clipboard.writeText("npm run db:reset").then(() => toast.success("Command copied"))}
                aria-label="Copy command"
                className="grid size-7 place-items-center rounded-md text-paper/60 hover:bg-white/10 hover:text-paper"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
            <p className="text-xs text-ink/45">Uploaded files are kept on disk; delete them from the Media library first if you want them gone.</p>
          </div>
        </div>
      </Card>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </>
  );
}
