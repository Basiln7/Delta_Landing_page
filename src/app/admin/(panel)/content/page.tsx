import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { ContentView } from "@/components/admin/content/ContentView";
import type { Row } from "@/components/admin/content/CollectionEditor";
import { EDITABLE_COLLECTIONS, type EditableCollection } from "@/lib/types";

export const metadata: Metadata = { title: "Content" };

export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageSession();
  const [db, params] = await Promise.all([readDb(), searchParams]);

  const collections = Object.fromEntries(EDITABLE_COLLECTIONS.map((k) => [k, db[k] as unknown as Row[]])) as Record<EditableCollection, Row[]>;
  const requested = typeof params.tab === "string" ? params.tab : "courses";
  const tab = requested === "hero" || (EDITABLE_COLLECTIONS as readonly string[]).includes(requested) ? (requested as "hero" | EditableCollection) : "courses";

  return <ContentView settings={db.settings} collections={collections} initialTab={tab} startCreating={params.new === "1" && tab !== "hero"} />;
}
