"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Trash2 } from "lucide-react";
import { api } from "@/lib/admin/client";
import { COLLECTION_META } from "@/lib/admin/media-meta";
import { Button, Field, Input, Select, Textarea, Badge } from "@/components/admin/ui";
import { ConfirmDialog, Drawer } from "@/components/admin/Overlay";
import { TagInput } from "@/components/admin/TagInput";
import { MediaThumb } from "@/components/admin/media/MediaThumb";
import { MEDIA_COLLECTIONS, type MediaCollection, type MediaItem } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";

export function MediaDetailsDrawer({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: MediaItem | null;
  onClose: () => void;
  onSaved: (item: MediaItem) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <Drawer open={!!item} onClose={onClose} title={item?.title ?? "Media"} description={item ? <Meta item={item} /> : null} width="max-w-2xl">
      {item && <DetailsForm key={item.id} item={item} onSaved={onSaved} onDeleted={onDeleted} onClose={onClose} />}
    </Drawer>
  );
}

function Meta({ item }: { item: MediaItem }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone="brass">{COLLECTION_META[item.collection].label}</Badge>
      <Badge>{item.type}</Badge>
      <Badge tone="muted">{item.source === "upload" ? "Uploaded" : "Remote"}</Badge>
    </span>
  );
}

function DetailsForm({
  item,
  onSaved,
  onDeleted,
  onClose,
}: {
  item: MediaItem;
  onSaved: (item: MediaItem) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [alt, setAlt] = useState(item.alt);
  const [collection, setCollection] = useState<MediaCollection>(item.collection);
  const [tags, setTags] = useState<string[]>(item.tags);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = title !== item.title || alt !== item.alt || collection !== item.collection || tags.join("|") !== item.tags.join("|");
  const absoluteUrl = typeof window !== "undefined" && item.url.startsWith("/") ? `${window.location.origin}${item.url}` : item.url;

  const save = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { item: updated } = await api<{ item: MediaItem }>(`/api/admin/media/${item.id}`, {
        method: "PATCH",
        json: { title, alt, collection, tags },
      });
      onSaved(updated);
      toast.success("Media details saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api(`/api/admin/media/${item.id}`, { method: "DELETE" });
      onDeleted(item.id);
      toast.success("Media deleted");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
      throw e;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      toast.success("URL copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <div className="space-y-7">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-2">
        {item.type === "document" ? (
          <MediaThumb item={item} className="aspect-[16/9]" />
        ) : (
          <MediaThumb item={item} width={1400} controls className="aspect-[16/10] [&_img]:object-contain [&_video]:object-contain" />
        )}
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm sm:grid-cols-4">
        {[
          ["Size", formatBytes(item.size)],
          ["Dimensions", item.width && item.height ? `${item.width} × ${item.height}` : "—"],
          ["Format", item.mime.split("/")[1]?.toUpperCase() ?? "—"],
          ["Added", formatDate(item.createdAt)],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-3.5 py-3">
            <dt className="eyebrow text-[0.5625rem] text-ink/40">{k}</dt>
            <dd className="mt-1.5 truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-5">
        <Field label="Title" htmlFor="md-title" error={error ?? undefined}>
          <Input id="md-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!error} />
        </Field>
        <Field label="Alt text" htmlFor="md-alt" hint="Describe the image for screen readers and search engines.">
          <Textarea id="md-alt" rows={2} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. Students collaborating in the library atrium" />
        </Field>
        <Field label="Collection" htmlFor="md-col" hint={COLLECTION_META[collection].description}>
          <Select id="md-col" value={collection} onChange={(e) => setCollection(e.target.value as MediaCollection)}>
            {MEDIA_COLLECTIONS.map((c) => (
              <option key={c} value={c}>
                {COLLECTION_META[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" htmlFor="md-tags">
          <TagInput id="md-tags" value={tags} onChange={setTags} placeholder="Add tags — e.g. library, sport" />
        </Field>
        <Field label="Public URL" htmlFor="md-url">
          <div className="flex gap-2">
            <Input id="md-url" readOnly value={absoluteUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button variant="secondary" size="icon" onClick={copy} aria-label="Copy URL" className="size-10">
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </Button>
            <a
              href={item.url}
              target="_blank"
              rel="noopener"
              aria-label="Open original"
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white hover:border-ink/25"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t border-line bg-[#FBFAF7]/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:px-7">
        <Button variant="ghost" className="text-pin hover:bg-pin/5 hover:text-pin" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" /> Delete
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        title="Delete this media?"
        description={
          item.source === "upload"
            ? "The file will be permanently removed from storage. Any page using it will fall back to a placeholder."
            : "This removes the remote image from the library. The original on the remote host is not affected."
        }
      />
    </div>
  );
}
