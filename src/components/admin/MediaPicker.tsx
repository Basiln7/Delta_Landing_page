"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, Upload, X } from "lucide-react";
import { api } from "@/lib/admin/client";
import { ACCEPT_ATTR } from "@/lib/admin/files";
import { COLLECTION_META } from "@/lib/admin/media-meta";
import { Modal } from "@/components/admin/Overlay";
import { Button, Input, Skeleton } from "@/components/admin/ui";
import { MediaThumb } from "@/components/admin/media/MediaThumb";
import { UploadTray, useUploader } from "@/components/admin/media/uploader";
import { MEDIA_COLLECTIONS, type MediaCollection, type MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Modal to choose an existing image from the library (or upload a new one). Returns its URL. */
export function MediaPicker({
  open,
  onClose,
  onSelect,
  current,
  defaultCollection = "general",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, item?: MediaItem) => void;
  current?: string;
  defaultCollection?: MediaCollection;
}) {
  return (
    <Modal open={open} onClose={onClose} label="Choose media" className="flex max-h-[92dvh] flex-col sm:max-w-4xl">
      {open && <PickerBody onClose={onClose} onSelect={onSelect} current={current} defaultCollection={defaultCollection} />}
    </Modal>
  );
}

function PickerBody({
  onClose,
  onSelect,
  current,
  defaultCollection,
}: {
  onClose: () => void;
  onSelect: (url: string, item?: MediaItem) => void;
  current?: string;
  defaultCollection: MediaCollection;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState<MediaCollection | "all">("all");
  const [chosen, setChosen] = useState<string | undefined>(current);
  const fileInput = useRef<HTMLInputElement>(null);

  const { jobs, upload, clearFinished } = useUploader((item) => {
    setItems((prev) => [item, ...(prev ?? [])]);
    setChosen(item.url);
  });

  useEffect(() => {
    let alive = true;
    api<{ items: MediaItem[] }>("/api/admin/media")
      .then((d) => alive && setItems(d.items.filter((i) => i.type === "image")))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load media"));
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) => (collection === "all" || i.collection === collection) && (!q || `${i.title} ${i.alt} ${i.tags.join(" ")}`.toLowerCase().includes(q)),
    );
  }, [items, query, collection]);

  const chosenItem = items?.find((i) => i.url === chosen);

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="display text-2xl">Choose an image</h2>
          <p className="text-xs text-ink/50">From the media library — or upload a new one.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink/35" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search images…" className="pl-10" aria-label="Search images" data-autofocus />
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {(["all", ...MEDIA_COLLECTIONS] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCollection(c)}
              aria-pressed={collection === c}
              className={cn(
                "h-10 shrink-0 rounded-xl border px-3 text-xs transition-colors",
                collection === c ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink/60 hover:text-ink",
              )}
            >
              {c === "all" ? "All" : COLLECTION_META[c].label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[240px] flex-1 overflow-y-auto p-5" data-lenis-prevent>
        {error && <p className="py-10 text-center text-sm text-pin">{error}</p>}
        {!items && !error && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        )}
        {items && visible.length === 0 && <p className="py-16 text-center text-sm text-ink/50">No images match. Upload one to get started.</p>}
        {items && visible.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {visible.map((item) => {
              const isChosen = item.url === chosen;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setChosen(item.url)}
                    onDoubleClick={() => {
                      onSelect(item.url, item);
                      onClose();
                    }}
                    aria-pressed={isChosen}
                    className="group block w-full text-left"
                  >
                    <div className={cn("relative overflow-hidden rounded-xl ring-1 transition-all", isChosen ? "ring-2 ring-brass ring-offset-2" : "ring-line")}>
                      <MediaThumb item={item} width={400} className="aspect-[4/3] transition-transform duration-500 group-hover:scale-105" />
                      {isChosen && (
                        <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-brass text-white shadow">
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-xs text-ink/70">{item.title}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/30 px-5 py-3.5">
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" /> Upload new
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTR.split(",").filter((m) => m.startsWith("image/")).join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) upload(files, defaultCollection);
          }}
        />
        <p className="hidden min-w-0 flex-1 truncate text-xs text-ink/50 sm:block">{chosenItem ? chosenItem.title : "Double-click to choose instantly"}</p>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!chosen}
            onClick={() => {
              if (chosen) onSelect(chosen, chosenItem);
              onClose();
            }}
          >
            Use image
          </Button>
        </div>
      </div>
      <UploadTray jobs={jobs} onClear={clearFinished} />
    </>
  );
}
