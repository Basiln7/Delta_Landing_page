"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { COLLECTIONS, type EditorContext } from "@/lib/admin/collections";
import { DEFAULT_CURRENCY } from "@/lib/commerce";
import { PageHeader } from "@/components/admin/ui";
import { HeroForm } from "@/components/admin/content/HeroForm";
import { CollectionEditor, type Row } from "@/components/admin/content/CollectionEditor";
import type { EditableCollection, SiteSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "hero" | EditableCollection;

export function ContentView({
  settings,
  collections,
  initialTab,
  startCreating,
}: {
  settings: SiteSettings;
  collections: Record<EditableCollection, Row[]>;
  initialTab: Tab;
  startCreating?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState(collections);
  const [createOnMount, setCreateOnMount] = useState(startCreating);

  const [prevTab, setPrevTab] = useState(initialTab);
  if (prevTab !== initialTab) {
    setPrevTab(initialTab);
    setTab(initialTab);
    setCreateOnMount(startCreating);
  }

  const select = (next: Tab) => {
    setTab(next);
    setCreateOnMount(false);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url);
  };

  const [first, ...rest] = COLLECTIONS;
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: first.key, label: first.label, count: data[first.key].length },
    { value: "hero", label: "Hero & announcement" },
    ...rest.map((c) => ({ value: c.key, label: c.label, count: data[c.key].length })),
  ];
  const config = COLLECTIONS.find((c) => c.key === tab);
  const ctx = useMemo<EditorContext>(
    () => ({
      currency: settings.currency ?? DEFAULT_CURRENCY,
      facultyNames: data.faculty.map((f) => String(f.name ?? "")).filter(Boolean),
    }),
    [settings.currency, data.faculty],
  );

  return (
    <>
      <PageHeader
        eyebrow="Website"
        title="Content"
        description="Courses, pricing and every word and image on the website. Changes publish instantly."
      />

      <div className="sticky top-14 z-30 -mx-4 mb-8 border-b border-line bg-[#F6F3ED]/90 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div role="tablist" aria-label="Content sections" className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.value === tab;
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={active}
                onClick={() => select(t.value)}
                className={cn(
                  "relative flex h-12 shrink-0 items-center gap-2 px-3 text-sm whitespace-nowrap transition-colors",
                  active ? "text-ink" : "text-ink/50 hover:text-ink",
                )}
              >
                {t.label}
                {typeof t.count === "number" && <span className="font-mono text-[0.625rem] text-ink/35">{t.count}</span>}
                {active && <motion.span layoutId="content-tab" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brass" />}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} role="tabpanel">
        {tab === "hero" && <HeroForm initial={settings} />}
        {config && (
          <CollectionEditor
            key={config.key}
            config={config}
            items={data[config.key]}
            ctx={ctx}
            startCreating={createOnMount}
            setItems={(fn) => setData((d) => ({ ...d, [config.key]: fn(d[config.key]) }))}
          />
        )}
      </motion.div>
    </>
  );
}
