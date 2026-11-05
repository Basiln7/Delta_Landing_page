"use client";

import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { motion } from "motion/react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnquiryStatus } from "@/lib/types";

/* ───────── Button ───────── */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "brass";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-navy shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_6px_16px_-8px_rgb(11_19_36/0.6)]",
  secondary: "bg-white text-ink border border-line hover:border-ink/25 hover:bg-paper/40",
  ghost: "text-ink/70 hover:text-ink hover:bg-ink/[0.05]",
  danger: "bg-pin text-white hover:bg-[#b93b1f]",
  brass: "bg-brass text-white hover:bg-[#a67a33]",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[0.9375rem] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 select-none items-center font-medium whitespace-nowrap transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ───────── Form controls ───────── */
const controlBase =
  "w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-ink/35 transition-colors outline-none hover:border-ink/25 focus:border-brass focus:ring-4 focus:ring-brass/15 disabled:opacity-60 aria-[invalid=true]:border-pin aria-[invalid=true]:ring-pin/10";

export const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlBase, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(controlBase, "resize-y py-2.5 leading-relaxed", className)} {...props} />;
});

const CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%230b1324' stroke-width='1.6' viewBox='0 0 24 24'><path d='m6 9 6 6 6-6'/></svg>\")";

export const Select = forwardRef<HTMLSelectElement, ComponentProps<"select">>(function Select({ className, children, style, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(controlBase, "h-10 appearance-none bg-no-repeat pr-9", className)}
      style={{ backgroundImage: CHEVRON, backgroundPosition: "right 0.9rem center", backgroundSize: "12px", ...style }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[0.8125rem] font-medium text-ink/80">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-pin" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink/50">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-ink/50">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brass" : "bg-ink/15",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
          className={cn("size-5 rounded-full bg-white shadow", checked ? "ml-[22px]" : "ml-0.5")}
        />
      </button>
    </div>
  );
}

/* ───────── Display ───────── */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line bg-white", className)} {...props} />;
}

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "brass" | "ink" | "pin" | "green" | "blue" | "muted";
}) {
  const tones = {
    neutral: "bg-paper text-ink/75 ring-line",
    brass: "bg-brass/12 text-[#8a6425] ring-brass/25",
    ink: "bg-ink text-paper ring-ink",
    pin: "bg-pin/10 text-pin ring-pin/20",
    green: "bg-emerald-600/10 text-emerald-700 ring-emerald-600/20",
    blue: "bg-sky-600/10 text-sky-700 ring-sky-600/20",
    muted: "bg-ink/[0.04] text-ink/50 ring-ink/10",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const STATUS_META: Record<EnquiryStatus, { label: string; tone: "pin" | "blue" | "brass" | "green" | "muted"; dot: string }> = {
  new: { label: "New", tone: "pin", dot: "bg-pin" },
  contacted: { label: "Contacted", tone: "blue", dot: "bg-sky-600" },
  "tour-booked": { label: "Call booked", tone: "brass", dot: "bg-brass" },
  enrolled: { label: "Enrolled", tone: "green", dot: "bg-emerald-600" },
  archived: { label: "Archived", tone: "muted", dot: "bg-ink/30" },
};

export function StatusBadge({ status }: { status: EnquiryStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-ink/[0.06]", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/15 px-6 py-16 text-center", className)}>
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-paper text-brass">{icon}</div>}
      <p className="display text-2xl">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm text-ink/55">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/20 px-1 font-mono text-[0.625rem] opacity-70", className)}>
      {children}
    </kbd>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="eyebrow mb-3 flex items-center gap-2 text-brass">
          <span className="h-px w-6 bg-brass/60" />
          {eyebrow}
        </p>
        <h1 className="display text-[2.5rem] leading-none sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[0.9375rem] text-ink/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Segmented control with an animated active pill. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  layoutId,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number; ariaLabel?: string }[];
  layoutId: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("no-scrollbar inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-white p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[0.8125rem]",
              active ? "text-paper" : "text-ink/60 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-ink"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {o.label}
              {typeof o.count === "number" && (
                <span className={cn("font-mono text-[0.625rem] tabular-nums", active ? "text-paper/60" : "text-ink/35")}>{o.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
