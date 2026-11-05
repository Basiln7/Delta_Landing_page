import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { MediaLibrary } from "@/components/admin/media/MediaLibrary";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageSession();
  const [db, params] = await Promise.all([readDb(), searchParams]);
  const open = typeof params.open === "string" ? params.open : undefined;

  return <MediaLibrary initialItems={db.media} initialOpenId={open} showUploadPanel={params.upload === "1"} />;
}
