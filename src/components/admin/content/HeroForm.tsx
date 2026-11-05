"use client";

import { ArrowRight } from "lucide-react";
import { DeltaMark } from "@/components/brand/Logo";
import { Card, Field, Input, Switch, Textarea } from "@/components/admin/ui";
import { SaveBar, Section, useSettingsForm } from "@/components/admin/content/SettingsForm";
import type { SiteSettings } from "@/lib/types";
import { cn, parseEmphasis } from "@/lib/utils";

export function HeroForm({ initial }: { initial: SiteSettings }) {
  const { draft, update, updateIn, dirty, saving, save, discard } = useSettingsForm(initial);
  const { hero, announcement } = draft;

  return (
    <div>
      {/* Live preview */}
      <Card className="mb-10 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="eyebrow text-ink/45">Live preview</span>
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-ink/10" />
            <span className="size-2.5 rounded-full bg-ink/10" />
            <span className="size-2.5 rounded-full bg-ink/10" />
          </span>
        </div>
        {announcement.enabled && (
          <div className="flex items-center justify-center gap-3 bg-ink px-4 py-2 text-center text-xs text-paper/85">
            <span className="size-1.5 shrink-0 rounded-full bg-pin" />
            <span className="truncate">{announcement.text || "Announcement text"}</span>
            {announcement.linkLabel && <span className="shrink-0 text-brass-light underline underline-offset-4">{announcement.linkLabel}</span>}
          </div>
        )}
        <div className="relative overflow-hidden bg-paper px-6 py-10 sm:px-10 sm:py-14">
          <DeltaMark className="absolute -right-10 -bottom-12 h-56 text-ink/[0.04]" strokeWidth={0.8} />
          <p className="eyebrow text-ink/50">{hero.eyebrow || "Eyebrow"}</p>
          <h2 className="display mt-4 max-w-3xl text-[2.6rem] leading-[0.95] sm:text-6xl">
            {parseEmphasis(hero.headline || "Your headline").map((seg, i) => (
              <span key={i} className={cn(seg.em && "text-brass italic")}>
                {seg.text}
              </span>
            ))}
          </h2>
          <p className="mt-5 max-w-xl text-sm text-ink/65 sm:text-base">{hero.subheadline}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm text-paper">
              {hero.primaryCta || "Primary"} <ArrowRight className="size-4" />
            </span>
            <span className="inline-flex h-10 items-center rounded-full border border-ink/20 px-5 text-sm">{hero.secondaryCta || "Secondary"}</span>
          </div>
        </div>
      </Card>

      <Section title="Announcement bar" description="The slim banner above the navigation. Use it for deadlines and open days.">
        <Switch checked={announcement.enabled} onChange={(v) => updateIn("announcement", { enabled: v })} label="Show announcement" description="Visible on every page load." />
        <Field label="Text" htmlFor="an-text">
          <Input id="an-text" value={announcement.text} onChange={(e) => updateIn("announcement", { text: e.target.value })} maxLength={200} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Link label" htmlFor="an-label">
            <Input id="an-label" value={announcement.linkLabel} onChange={(e) => updateIn("announcement", { linkLabel: e.target.value })} />
          </Field>
          <Field label="Link target" htmlFor="an-href" hint="A URL or a section anchor like #enquire">
            <Input id="an-href" value={announcement.href} onChange={(e) => updateIn("announcement", { href: e.target.value })} className="font-mono text-xs" />
          </Field>
        </div>
      </Section>

      <Section title="Hero" description="The first thing every family sees. Keep the headline under ten words.">
        <Field label="Eyebrow" htmlFor="h-eyebrow">
          <Input id="h-eyebrow" value={hero.eyebrow} onChange={(e) => updateIn("hero", { eyebrow: e.target.value })} />
        </Field>
        <Field
          label="Headline *"
          htmlFor="h-headline"
          hint={
            <>
              Wrap a word in <code className="rounded bg-paper px-1 font-mono">*asterisks*</code> to set it in brass italic.
            </>
          }
        >
          <Input id="h-headline" value={hero.headline} onChange={(e) => updateIn("hero", { headline: e.target.value })} maxLength={160} />
        </Field>
        <Field label="Subheadline *" htmlFor="h-sub" hint={`${hero.subheadline.length}/400`}>
          <Textarea id="h-sub" rows={3} value={hero.subheadline} onChange={(e) => updateIn("hero", { subheadline: e.target.value })} maxLength={400} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Primary button *" htmlFor="h-cta1">
            <Input id="h-cta1" value={hero.primaryCta} onChange={(e) => updateIn("hero", { primaryCta: e.target.value })} maxLength={40} />
          </Field>
          <Field label="Secondary button *" htmlFor="h-cta2">
            <Input id="h-cta2" value={hero.secondaryCta} onChange={(e) => updateIn("hero", { secondaryCta: e.target.value })} maxLength={40} />
          </Field>
        </div>
      </Section>

      <Section title="Brand lines" description="Short lines reused across the page and in search results.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tagline *" htmlFor="b-tagline">
            <Input id="b-tagline" value={draft.tagline} onChange={(e) => update("tagline", e.target.value)} />
          </Field>
          <Field label="Intake label *" htmlFor="b-intake">
            <Input id="b-intake" value={draft.intakeLabel} onChange={(e) => update("intakeLabel", e.target.value)} />
          </Field>
        </div>
        <Field label="Manifesto *" htmlFor="b-manifesto" hint={`${draft.manifesto.length}/1200 · Revealed word-by-word as visitors scroll.`}>
          <Textarea id="b-manifesto" rows={6} value={draft.manifesto} onChange={(e) => update("manifesto", e.target.value)} maxLength={1200} />
        </Field>
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} />
    </div>
  );
}
