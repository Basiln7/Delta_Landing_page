"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/admin/client";
import { Button } from "@/components/admin/ui";
import { Portal } from "@/components/admin/Overlay";
import type { SiteSettings } from "@/lib/types";

/** Shared state + save bar for any form that edits SiteSettings. */
export function useSettingsForm(initial: SiteSettings) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const updateIn = <K extends "hero" | "announcement" | "contact" | "currency">(key: K, patch: Partial<SiteSettings[K]>) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      const { settings } = await api<{ settings: SiteSettings }>("/api/admin/settings", { method: "PUT", json: draft });
      setSaved(settings);
      setDraft(settings);
      toast.success("Published to the website");
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        const first = Object.entries(e.fields).find(([, v]) => v?.length);
        toast.error(first ? `${first[0]}: ${first[1]?.[0]}` : e.message);
      } else toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => setDraft(saved);

  return { draft, setDraft, update, updateIn, dirty, saving, save, discard };
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = "Save & publish",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}) {
  return (
    <Portal>
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 30, x: "-50%" }}
            className="fixed bottom-5 left-1/2 z-[55] flex w-[calc(100%-2rem)] max-w-lg items-center gap-2 rounded-2xl bg-ink p-2 pl-4 text-sm text-paper shadow-2xl lg:ml-[132px]"
            role="region"
            aria-label="Unsaved changes"
          >
            <span className="size-2 animate-pulse rounded-full bg-brass-light" />
            <span className="flex-1">Unsaved changes</span>
            <Button variant="ghost" size="sm" className="text-paper/70 hover:bg-white/10 hover:text-paper" onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
            <Button variant="brass" size="sm" onClick={onSave} loading={saving}>
              {saveLabel}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 grid gap-6 border-t border-line py-8 first:border-t-0 first:pt-0 lg:grid-cols-[18rem_1fr] lg:gap-10">
      <div>
        <h3 className="display text-2xl">{title}</h3>
        {description && <p className="mt-1.5 text-sm text-ink/55">{description}</p>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}
