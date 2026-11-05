"use client";

import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Rows3, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/admin/client";
import { emptyItem, type CollectionConfig, type EditorContext, type FieldDef } from "@/lib/admin/collections";
import { Badge, Button, Card, EmptyState } from "@/components/admin/ui";
import { ConfirmDialog, Drawer } from "@/components/admin/Overlay";
import { MediaThumb } from "@/components/admin/media/MediaThumb";
import { FieldInput } from "@/components/admin/content/FieldInput";
import type { EditableCollection, MediaCollection } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Row = { id: string } & Record<string, unknown>;

/** Where images picked/uploaded from each editor land in the media library. */
const MEDIA_TARGET: Partial<Record<EditableCollection, MediaCollection>> = {
  courses: "courses",
  faculty: "faculty",
  events: "events",
};

export function CollectionEditor({
  config,
  items,
  setItems,
  ctx,
  startCreating,
}: {
  config: CollectionConfig;
  items: Row[];
  setItems: (fn: (prev: Row[]) => Row[]) => void;
  ctx: EditorContext;
  startCreating?: boolean;
}) {
  const [editing, setEditing] = useState<{ id?: string; values: Record<string, unknown> } | null>(
    startCreating ? { values: emptyItem(config) } : null,
  );
  const [deleting, setDeleting] = useState<Row | null>(null);
  const savedOrder = useRef(items.map((i) => i.id).join("|"));
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });

  const persistOrder = async () => {
    const order = itemsRef.current.map((i) => i.id);
    if (order.join("|") === savedOrder.current) return;
    try {
      await api(`/api/admin/collections/${config.key}`, { method: "PUT", json: { order } });
      savedOrder.current = order.join("|");
      toast.success("Order saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save order");
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    itemsRef.current = next;
    setItems(() => next);
    void persistOrder();
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/admin/collections/${config.key}/${deleting.id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== deleting.id));
      toast.success(`Deleted “${String(deleting[config.titleKey] ?? "")}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
      throw e;
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="display text-3xl">{config.label}</h2>
          <p className="mt-1 text-sm text-ink/55">{config.description}</p>
        </div>
        <Button onClick={() => setEditing({ values: emptyItem(config) })}>
          <Plus className="size-4" /> Add {config.singular}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Rows3 className="size-6" />}
          title={`No ${config.label.toLowerCase()} yet`}
          description={`Add your first ${config.singular} — it will appear on the website straight away.`}
          action={
            <Button onClick={() => setEditing({ values: emptyItem(config) })}>
              <Plus className="size-4" /> Add {config.singular}
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Reorder.Group axis="y" values={items} onReorder={(next: Row[]) => setItems(() => next)} className="divide-y divide-line">
            {items.map((item, index) => (
              <EditorRow
                key={item.id}
                item={item}
                index={index}
                total={items.length}
                config={config}
                ctx={ctx}
                onEdit={() => setEditing({ id: item.id, values: { ...item } })}
                onDelete={() => setDeleting(item)}
                onMove={(d) => move(index, d)}
                onDragEnd={persistOrder}
              />
            ))}
          </Reorder.Group>
        </Card>
      )}
      <p className="mt-3 text-xs text-ink/40">Drag the handle or use the arrows to reorder — the website follows this order.</p>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${config.singular}` : `New ${config.singular}`}
        description={editing?.id ? String(editing.values[config.titleKey] ?? "") : `Add a ${config.singular} to ${config.label}.`}
        width={config.fields.length > 10 ? "max-w-2xl" : "max-w-xl"}
      >
        {editing && (
          <ItemForm
            key={editing.id ?? "new"}
            config={config}
            ctx={ctx}
            initial={editing.values}
            id={editing.id}
            onCancel={() => setEditing(null)}
            onSaved={(row, created) => {
              setItems((prev) => (created ? [...prev, row] : prev.map((i) => (i.id === row.id ? row : i))));
              savedOrder.current = created ? `${savedOrder.current}|${row.id}` : savedOrder.current;
              setEditing(null);
            }}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={`Delete this ${config.singular}?`}
        description={`“${String(deleting?.[config.titleKey] ?? "")}” will be removed from the website.`}
      />
    </div>
  );
}

function EditorRow({
  item,
  index,
  total,
  config,
  ctx,
  onEdit,
  onDelete,
  onMove,
  onDragEnd,
}: {
  item: Row;
  index: number;
  total: number;
  config: CollectionConfig;
  ctx: EditorContext;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const image = config.imageKey ? String(item[config.imageKey] ?? "") : "";

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className="group relative flex items-center gap-3 bg-white px-3 py-3 sm:px-4"
      whileDrag={{ scale: 1.01, boxShadow: "0 18px 40px -20px rgb(11 19 36 / 0.45)", zIndex: 10 }}
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag to reorder"
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-ink/30 hover:bg-ink/5 hover:text-ink/70 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="hidden w-6 font-mono text-[0.6875rem] text-ink/30 tabular-nums sm:block">{String(index + 1).padStart(2, "0")}</span>
      {config.imageKey && (
        <MediaThumb item={{ url: image, type: "image", alt: "", mime: "image/jpeg", title: "" }} width={200} className="h-12 w-16 shrink-0 rounded-lg" />
      )}
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{String(item[config.titleKey] ?? "Untitled")}</span>
          {item.published === false && <Badge tone="muted">Draft</Badge>}
          {item.featured === true && <Badge tone="brass">Featured</Badge>}
          {item.highlighted === true && <Badge tone="brass">Recommended</Badge>}
          {typeof item.badge === "string" && item.badge && <Badge tone="neutral">{item.badge}</Badge>}
        </p>
        <p className="truncate text-xs text-ink/50">{config.subtitle(item, ctx)}</p>
      </button>
      <div className="flex items-center gap-0.5 sm:opacity-60 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <button onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up" className="hidden size-8 place-items-center rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink disabled:opacity-25 sm:grid">
          <ArrowUp className="size-4" />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down" className="hidden size-8 place-items-center rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink disabled:opacity-25 sm:grid">
          <ArrowDown className="size-4" />
        </button>
        <button onClick={onEdit} aria-label="Edit" className="grid size-8 place-items-center rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink">
          <Pencil className="size-4" />
        </button>
        <button onClick={onDelete} aria-label="Delete" className="grid size-8 place-items-center rounded-lg text-ink/50 hover:bg-pin/10 hover:text-pin">
          <Trash2 className="size-4" />
        </button>
      </div>
    </Reorder.Item>
  );
}

function resolveField(f: FieldDef, ctx: EditorContext): FieldDef {
  if (f.optionsFrom === "faculty") return { ...f, options: ctx.facultyNames };
  return f;
}

function ItemForm({
  config,
  ctx,
  initial,
  id,
  onCancel,
  onSaved,
}: {
  config: CollectionConfig;
  ctx: EditorContext;
  initial: Record<string, unknown>;
  id?: string;
  onCancel: () => void;
  onSaved: (row: Row, created: boolean) => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: Record<string, string> = {};
    for (const f of config.fields) {
      const v = values[f.key];
      if (f.required && (v === "" || v == null || (Array.isArray(v) && v.length === 0))) missing[f.key] = `${f.label} is required`;
    }
    if (Object.keys(missing).length) {
      setErrors(missing);
      toast.error("Please fill in the required fields");
      return;
    }
    setSaving(true);
    setErrors({});
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _omit, ...payload } = values;
    try {
      const { item } = await api<{ item: Row }>(id ? `/api/admin/collections/${config.key}/${id}` : `/api/admin/collections/${config.key}`, {
        method: id ? "PUT" : "POST",
        json: payload,
      });
      onSaved(item, !id);
      toast.success(id ? "Changes saved" : `${config.singular[0].toUpperCase()}${config.singular.slice(1)} added`);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v?.[0] ?? "Invalid"])));
      }
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-h-full flex-col" noValidate>
      <div className="grid flex-1 gap-5 sm:grid-cols-2">
        {config.fields.map((raw, i) => {
          const f = resolveField(raw, ctx);
          return (
            <div key={f.key} className={cn(f.type === "boolean" || !f.half ? "sm:col-span-2" : "", f.section && "contents")}>
              {f.section && (
                <p className={cn("eyebrow flex items-center gap-2 text-brass sm:col-span-2", i > 0 && "mt-4 border-t border-line pt-6")}>
                  <span className="h-px w-5 bg-brass/60" />
                  {f.section}
                </p>
              )}
              <div className={cn(f.section && (f.type === "boolean" || !f.half ? "sm:col-span-2" : ""))}>
                <FieldInput
                  field={{ ...f, half: true }}
                  value={values[f.key]}
                  error={errors[f.key]}
                  mediaCollection={MEDIA_TARGET[config.key]}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 -mx-5 mt-8 flex justify-end gap-2 border-t border-line bg-[#FBFAF7]/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:px-7">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {id ? "Save changes" : `Add ${config.singular}`}
        </Button>
      </div>
    </form>
  );
}
