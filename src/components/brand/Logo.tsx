import { cn } from "@/lib/utils";

/** The Δ mark: a delta with a horizon line and a lime signal dot. */
export function DeltaMark({ className, strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 40 36" fill="none" aria-hidden="true" className={cn("h-7 w-auto", className)}>
      <path d="M20 2 L38 34 H2 Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M9.3 21 H30.7" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <circle cx="20" cy="2.6" r="2.4" className="fill-brass-light stroke-ink" strokeWidth="0.8" />
    </svg>
  );
}

/** Lowercase "delta" wordmark (Delta family) with a "Markets Academy" tag. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <DeltaMark className="h-6" />
      <span className="flex flex-col leading-none">
        <span className="font-sans text-[1.55rem] font-extrabold lowercase tracking-[-0.04em]">delta</span>
        {!compact && <span className="eyebrow mt-0.5 text-[0.48rem] tracking-[0.24em] opacity-60">Markets Academy</span>}
      </span>
    </span>
  );
}
