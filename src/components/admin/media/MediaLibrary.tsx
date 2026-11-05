"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Check,
  CloudUpload,
  Images,
  Info,
  LayoutGrid,
  List,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "@/lib/admin/client";
import { ACCEPT_ATTR } from "@/lib/admin/files";
import { COLLECTION_META, TYPE_META } from "@/lib/admin/media-meta";
import { Badge, Button, EmptyState, Input, PageHeader, Segmented, Select } from "@/components/admin/ui";
import { ConfirmDialog, Portal } from "@/components/admin/Overlay";
import { MediaThumb } from "@/components/admin/media/MediaThumb";
import { MediaDetailsDrawer } from "@/components/admin/media/MediaDetails";
import { UploadTray, useUploader } from "@/components/admin/media/uploader";
import { MEDIA_COLLECTIONS, type MediaCollection, type MediaItem, type MediaType } from "@/lib/types";
import { cn, formatBytes, formatDate } from "@/lib/utils";

type TypeFilter = MediaType | "all";
type CollectionFilter = MediaCollection | "all";
type Sort = "newest" | "oldest" | "name" | "size";

export function MediaLibrary({
  initialItems,
  initialOpenId,
  showUploadPanel,
}: {
  initialItems: MediaItem[];
  initialOpenId?: string;
  showUploadPanel?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [collection, setCollection] = useState<CollectionFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [target, setTarget] = useState<MediaCollection>("courses");
  const [dragging, setDragging] = useState(false);
  const [panel, setPanel] = useState(!!showUploadPanel);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Re-sync when the URL (?upload=1 / ?open=id) changes while this page stays mounted.
  const [prevProps, setPrevProps] = useState({ showUploadPanel, initialOpenId });
  if (prevProps.showUploadPanel !== showUploadPanel || prevProps.initialOpenId !== initialOpenId) {
    setPrevProps({ showUploadPanel, initialOpenId });
    if (showUploadPanel) setPanel(true);
    if (initialOpenId) setOpenId(initialOpenId);
  }

  const { jobs, upload, clearFinished } = useUploader((item) => setItems((prev) => [item, ...prev]));

  // Keep latest upload fn + target for the window drop listener.
  const dropRef = useRef<(files: File[]) => void>(() => {});
  useEffect(() => {
    dropRef.current = (files) => upload(files, target);
  });

  // Full-page drag & drop.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) dropRef.current(files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const typeCounts = useMemo(() => {
    const c: Record<TypeFilter, number> = { all: items.length, image: 0, video: 0, document: 0 };
    items.forEach((i) => c[i.type]++);
    return c;
  }, [items]);

  const collectionCounts = useMemo(() => {
    const c = Object.fromEntries([["all", items.length], ...MEDIA_COLLECTIONS.map((k) => [k, 0])]) as Record<CollectionFilter, number>;
    items.forEach((i) => c[i.collection]++);
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (type === "all" || i.type === type) &&
        (collection === "all" || i.collection === collection) &&
        (!q || `${i.title} ${i.alt} ${i.tags.join(" ")} ${i.url}`.toLowerCase().includes(q)),
    );
    const sorters: Record<Sort, (a: MediaItem, b: MediaItem) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      name: (a, b) => a.title.localeCompare(b.title),
      size: (a, b) => b.size - a.size,
    };
    return list.sort(sorters[sort]);
  }, [items, query, type, collection, sort]);

  const openItem = items.find((i) => i.id === openId) ?? null;
  const allVisibleSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));

  const toggle = (index: number, shift: boolean) => {
    const id = visible[index].id;
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && anchor !== null) {
        const [a, b] = [Math.min(anchor, index), Math.max(anchor, index)];
        const shouldSelect = !prev.has(id);
        for (let i = a; i <= b; i++) {
          if (shouldSelect) next.add(visible[i].id);
          else next.delete(visible[i].id);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchor(index);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    try {
      await api("/api/admin/media/bulk-delete", { method: "POST", json: { ids } });
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setSelected(new Set());
      toast.success(`${ids.length} ${ids.length === 1 ? "item" : "items"} deleted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      throw e;
    }
  };

  const pickFiles = () => fileInput.current?.click();

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Media"
        description="Every image, video and document used across the website. Drop files anywhere on this page to upload."
        actions={
          <>
            <label className="sr-only" htmlFor="upload-target">
              Upload to collection
            </label>
            <Select id="upload-target" value={target} onChange={(e) => setTarget(e.target.value as MediaCollection)} className="w-auto min-w-[10.5rem]">
              {MEDIA_COLLECTIONS.map((c) => (
                <option key={c} value={c}>
                  Upload to: {COLLECTION_META[c].label}
                </option>
              ))}
            </Select>
            <Button onClick={pickFiles}>
              <Upload className="size-4" /> Upload
            </Button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) upload(files, target);
              }}
            />
          </>
        }
      />

      {/* Callout */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-brass/25 bg-brass/[0.07] px-4 py-3.5 text-sm text-ink/70">
        <Info className="mt-0.5 size-4 shrink-0 text-brass" />
        <p>
          <strong className="font-medium text-ink">Collections drive the website.</strong> The newest image in <Badge tone="brass">Hero</Badge> becomes the
          hero image and <Badge tone="brass">Gallery</Badge> items feed the homepage gallery. <Badge tone="brass">Courses</Badge>,{" "}
          <Badge tone="brass">Instructors</Badge> and <Badge tone="brass">Batches &amp; events</Badge> are folders you pick from in Content.
        </p>
      </div>

      {/* Inline upload panel (shown via ?upload=1 or toggle) */}
      <AnimatePresence initial={false}>
        {panel && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="relative mb-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brass/40 bg-white px-6 py-12 text-center">
              <button onClick={() => setPanel(false)} aria-label="Hide upload panel" className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-ink/40 hover:bg-ink/5">
                <X className="size-4" />
              </button>
              <div className="grid size-14 place-items-center rounded-2xl bg-brass/10 text-brass">
                <CloudUpload className="size-7" strokeWidth={1.5} />
              </div>
              <p className="display mt-4 text-3xl">Drop files to upload</p>
              <p className="mt-1.5 text-sm text-ink/55">
                JPG, PNG, WebP, AVIF, GIF, SVG, MP4, WebM or PDF · up to 25 MB each · into <strong className="font-medium text-ink">{COLLECTION_META[target].label}</strong>
              </p>
              <Button variant="secondary" className="mt-5" onClick={pickFiles}>
                Browse files
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink/35" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, alt text or tags…" className="pl-10" aria-label="Search media" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            layoutId="media-type"
            value={type}
            onChange={setType}
            options={(["all", "image", "video", "document"] as TypeFilter[]).map((t) => ({ value: t, label: TYPE_META[t], count: typeCounts[t] }))}
          />
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto" aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="size">Largest first</option>
          </Select>
          <Segmented
            layoutId="media-view"
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <LayoutGrid className="size-4" />, ariaLabel: "Grid view" },
              { value: "list", label: <List className="size-4" />, ariaLabel: "List view" },
            ]}
          />
        </div>
      </div>

      {/* Collection chips */}
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by collection">
        {(["all", ...MEDIA_COLLECTIONS] as CollectionFilter[]).map((c) => {
          const active = collection === c;
          return (
            <button
              key={c}
              onClick={() => setCollection(c)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[0.8125rem] transition-colors",
                active ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink/65 hover:border-ink/25 hover:text-ink",
              )}
            >
              {c === "all" ? "All collections" : COLLECTION_META[c].label}
              <span className={cn("font-mono text-[0.625rem]", active ? "text-paper/55" : "text-ink/35")}>{collectionCounts[c]}</span>
            </button>
          );
        })}
      </div>

      {/* Results bar */}
      <div className="mb-3 flex items-center gap-3 text-sm text-ink/55">
        <button
          role="checkbox"
          aria-checked={allVisibleSelected}
          aria-label="Select all visible"
          onClick={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((i) => i.id)))}
          className={cn(
            "grid size-5 place-items-center rounded-md border transition-colors",
            allVisibleSelected ? "border-ink bg-ink text-paper" : "border-ink/25 bg-white hover:border-ink/50",
          )}
        >
          {allVisibleSelected && <Check className="size-3.5" strokeWidth={3} />}
        </button>
        <span>
          {visible.length} of {items.length} items
        </span>
        <span className="hidden text-xs text-ink/35 md:inline">· Shift-click to select a range</span>
      </div>

      {/* Results */}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Images className="size-6" />}
          title={items.length ? "No matches" : "Your library is empty"}
          description={items.length ? "Try a different search or clear the filters." : "Drag images, videos or PDFs onto this page to upload them."}
          action={
            items.length ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setType("all");
                  setCollection("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={pickFiles}>
                <Upload className="size-4" /> Upload files
              </Button>
            )
          }
        />
      ) : view === "grid" ? (
        <motion.ul layout className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((item, index) => {
              const isSel = selected.has(item.id);
              return (
                <motion.li
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="group relative"
                >
                  <button onClick={() => setOpenId(item.id)} className="block w-full rounded-xl text-left" aria-label={`Open ${item.title}`}>
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-xl ring-1 transition-all duration-300",
                        isSel ? "ring-2 ring-brass ring-offset-2 ring-offset-[#F6F3ED]" : "ring-line group-hover:shadow-[0_18px_40px_-22px_rgb(11_19_36/0.55)]",
                      )}
                    >
                      <MediaThumb item={item} width={560} className="aspect-[4/3] transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <span className="absolute top-2 right-2">
                        <Badge className="bg-white/90 backdrop-blur" tone="neutral">
                          {COLLECTION_META[item.collection].label}
                        </Badge>
                      </span>
                      {!item.alt.trim() && item.type === "image" && (
                        <span className="absolute bottom-2 left-2">
                          <Badge tone="pin" className="bg-white/90">
                            No alt text
                          </Badge>
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-baseline justify-between gap-2 px-0.5">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="shrink-0 font-mono text-[0.625rem] text-ink/40">{item.size ? formatBytes(item.size) : "remote"}</p>
                    </div>
                  </button>
                  <SelectBox checked={isSel} visible={isSel || selected.size > 0} onToggle={(shift) => toggle(index, shift)} label={item.title} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="hidden grid-cols-[2.5rem_3.5rem_1fr_8rem_7rem_6rem_7rem] items-center gap-4 border-b border-line bg-paper/40 px-4 py-2.5 md:grid">
            <span />
            <span />
            {["Name", "Collection", "Dimensions", "Size", "Added"].map((h) => (
              <span key={h} className="eyebrow text-[0.5625rem] text-ink/40">
                {h}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-line">
            {visible.map((item, index) => {
              const isSel = selected.has(item.id);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "grid grid-cols-[2.5rem_3.5rem_1fr] items-center gap-4 px-4 py-2.5 transition-colors md:grid-cols-[2.5rem_3.5rem_1fr_8rem_7rem_6rem_7rem]",
                    isSel ? "bg-brass/[0.06]" : "hover:bg-paper/40",
                  )}
                >
                  <SelectBox inline checked={isSel} visible onToggle={(shift) => toggle(index, shift)} label={item.title} />
                  <MediaThumb item={item} width={120} className="size-12 rounded-lg" />
                  <button onClick={() => setOpenId(item.id)} className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium hover:underline">{item.title}</p>
                    <p className="truncate text-xs text-ink/45">{item.alt || "No alt text"}</p>
                  </button>
                  <span className="hidden md:block">
                    <Badge tone="brass">{COLLECTION_META[item.collection].label}</Badge>
                  </span>
                  <span className="hidden font-mono text-xs text-ink/55 md:block">{item.width && item.height ? `${item.width}×${item.height}` : "—"}</span>
                  <span className="hidden font-mono text-xs text-ink/55 md:block">{formatBytes(item.size)}</span>
                  <span className="hidden text-xs text-ink/55 md:block">{formatDate(item.createdAt, { day: "numeric", month: "short" })}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bulk action bar */}
      <Portal>
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 30, x: "-50%" }}
              className="fixed bottom-5 left-1/2 z-[55] flex items-center gap-1 rounded-2xl bg-ink p-1.5 pl-4 text-sm text-paper shadow-2xl lg:ml-[132px]"
              role="toolbar"
              aria-label="Bulk actions"
            >
              <span className="mr-2 font-mono text-xs tabular-nums">{selected.size} selected</span>
              <Button variant="ghost" size="sm" className="text-paper/70 hover:bg-white/10 hover:text-paper" onClick={() => setSelected(new Set(visible.map((i) => i.id)))}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" className="text-paper/70 hover:bg-white/10 hover:text-paper" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmBulk(true)}>
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>

      {/* Full-page drop overlay */}
      <Portal>
        <AnimatePresence>
          {dragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-ink/70 p-6 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.92 }}
                animate={{ scale: 1 }}
                className="flex w-full max-w-xl flex-col items-center rounded-3xl border-2 border-dashed border-brass-light/70 px-8 py-16 text-center text-paper"
              >
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}>
                  <CloudUpload className="size-14 text-brass-light" strokeWidth={1.2} />
                </motion.div>
                <p className="display mt-5 text-5xl">Release to upload</p>
                <p className="mt-2 text-paper/60">
                  Files go into <strong className="text-paper">{COLLECTION_META[target].label}</strong>
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>

      <UploadTray jobs={jobs} onClear={clearFinished} />

      <MediaDetailsDrawer
        item={openItem}
        onClose={() => setOpenId(null)}
        onSaved={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
        onDeleted={(id) => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }}
      />

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onConfirm={bulkDelete}
        title={`Delete ${selected.size} ${selected.size === 1 ? "item" : "items"}?`}
        description="Uploaded files are permanently removed from storage. This cannot be undone."
        confirmLabel="Delete all"
      />
    </>
  );
}

function SelectBox({
  checked,
  visible,
  onToggle,
  label,
  inline,
}: {
  checked: boolean;
  visible: boolean;
  onToggle: (shift: boolean) => void;
  label: string;
  inline?: boolean;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={`Select ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e.shiftKey);
      }}
      className={cn(
        "grid size-6 place-items-center rounded-md border-2 transition-all focus-visible:opacity-100",
        inline ? "" : "absolute top-2 left-2 shadow-sm",
        checked ? "border-ink bg-ink text-paper" : "border-white bg-white/80 backdrop-blur hover:bg-white",
        inline && !checked && "border-ink/25",
        !inline && !visible && "opacity-0 group-hover:opacity-100",
      )}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </button>
  );
}
