"use client";
/* eslint-disable @next/next/no-img-element -- previews of arbitrary library URLs */

import { useState } from "react";
import { ImagePlus, RefreshCw } from "lucide-react";
import { optionLabel, optionValue, type FieldDef } from "@/lib/admin/collections";
import { Button, Field, Input, Select, Switch, Textarea } from "@/components/admin/ui";
import { TagInput } from "@/components/admin/TagInput";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { thumbUrl } from "@/lib/admin/files";
import { cn } from "@/lib/utils";
import type { MediaCollection } from "@/lib/types";

export function FieldInput({
  field,
  value,
  onChange,
  error,
  mediaCollection,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  /** Upload target used by the media picker for image fields. */
  mediaCollection?: MediaCollection;
}) {
  const id = `f-${field.key}`;
  const label = field.required ? `${field.label} *` : field.label;
  const common = { id, "aria-invalid": !!error, placeholder: field.placeholder };

  if (field.type === "boolean") {
    return <Switch checked={Boolean(value)} onChange={onChange} label={field.label} description={field.hint} />;
  }

  return (
    <Field label={label} hint={field.hint} error={error} htmlFor={id} className={cn(!field.half && "sm:col-span-2")}>
      {field.type === "text" && <Input {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />}
      {field.type === "number" && (
        <Input
          {...common}
          type="number"
          inputMode="decimal"
          min={0}
          step={field.step ?? 1}
          value={value === "" || value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "date" && <Input {...common} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />}
      {field.type === "textarea" && <Textarea {...common} rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />}
      {field.type === "select" && <SelectField common={common} field={field} value={String(value ?? "")} onChange={onChange} />}
      {field.type === "list" && <TagInput id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} placeholder={field.placeholder} />}
      {field.type === "image" && <ImageField id={id} value={String(value ?? "")} onChange={onChange} invalid={!!error} mediaCollection={mediaCollection} />}
    </Field>
  );
}

function SelectField({
  common,
  field,
  value,
  onChange,
}: {
  common: { id: string; "aria-invalid": boolean };
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = field.options ?? [];
  const values = options.map(optionValue);
  const hasEmptyOption = values.includes("");
  // Keep a stored value selectable even if it is no longer in the list (e.g. a renamed instructor).
  const orphan = value && !values.includes(value) ? value : null;
  return (
    <Select id={common.id} aria-invalid={common["aria-invalid"]} value={value} onChange={(e) => onChange(e.target.value)}>
      {!hasEmptyOption && (
        <option value="" disabled>
          Choose…
        </option>
      )}
      {orphan && <option value={orphan}>{orphan} (not in list)</option>}
      {options.map((o) => (
        <option key={optionValue(o)} value={optionValue(o)}>
          {optionLabel(o)}
        </option>
      ))}
    </Select>
  );
}

function ImageField({
  id,
  value,
  onChange,
  invalid,
  mediaCollection,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
  mediaCollection?: MediaCollection;
}) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-white", invalid ? "border-pin" : "border-line")}>
      <div className="flex gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-paper text-ink/40"
          aria-label="Choose image from library"
        >
          {value && broken !== value ? (
            <img src={thumbUrl(value, 320)} alt="" className="h-full w-full object-cover" onError={() => setBroken(value)} />
          ) : (
            <ImagePlus className="size-6" strokeWidth={1.4} />
          )}
          <span className="absolute inset-0 grid place-items-center bg-ink/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">Change</span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setOpen(true)}>
            {value ? <RefreshCw className="size-3.5" /> : <ImagePlus className="size-3.5" />}
            {value ? "Replace from library" : "Choose from library"}
          </Button>
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste an image URL"
            className="h-8 rounded-lg font-mono text-[0.6875rem]"
          />
        </div>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} onSelect={(url) => onChange(url)} current={value} defaultCollection={mediaCollection} />
    </div>
  );
}
