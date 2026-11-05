/**
 * v4 "precision fintech" shared primitives for the landing page.
 * Tone: "dark" sections sit on bg-night; "light" sections on bg-snow.
 */
import { Reveal } from "@/components/motion/Reveal";
import { SplitText } from "@/components/motion/SplitText";
import { cn } from "@/lib/utils";

export type Tone = "dark" | "light";

/** Small uppercase label with a status dot — the section "kicker". */
export function Eyebrow({ children, tone = "dark", className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
        tone === "dark" ? "border-edge bg-white/[0.03] text-mute" : "border-line bg-white text-ink/60",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone === "dark" ? "bg-brass-light" : "bg-emerald")} />
      {children}
    </span>
  );
}

/** Section header: kicker, headline (words in *asterisks* get the accent colour), optional lede. */
export function SectionHeader({
  eyebrow,
  title,
  lede,
  tone = "dark",
  align = "left",
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  tone?: Tone;
  align?: "left" | "center";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-5", align === "center" && "items-center text-center", className)}>
      <Reveal>
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      </Reveal>
      <SplitText
        text={title}
        stagger={0.035}
        className={cn("display max-w-[22ch] text-[clamp(2.2rem,4.4vw,3.9rem)]", tone === "dark" ? "text-white" : "text-ink")}
        emClassName={tone === "dark" ? "text-brass-light" : "text-emerald"}
      />
      {lede && (
        <Reveal delay={0.1} className={cn("max-w-2xl text-lg leading-relaxed", tone === "dark" ? "text-mute" : "text-ink/65")}>
          <p>{lede}</p>
        </Reveal>
      )}
      {children}
    </div>
  );
}

/** Deterministic sparkline (sample data) for watchlists and cards. */
export function Sparkline({
  seed = 1,
  points = 28,
  trend = 0.4,
  className,
  stroke,
}: {
  seed?: number;
  points?: number;
  trend?: number;
  className?: string;
  stroke?: string;
}) {
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const vals: number[] = [];
  let v = 50;
  for (let i = 0; i < points; i++) {
    v += (rand() - 0.5) * 9 + trend;
    vals.push(v);
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const d = vals
    .map((y, i) => `${i === 0 ? "M" : "L"}${((i / (points - 1)) * 100).toFixed(2)},${(28 - ((y - min) / (max - min || 1)) * 24 - 2).toFixed(2)}`)
    .join(" ");
  const up = vals[vals.length - 1] >= vals[0];
  const color = stroke ?? (up ? "var(--color-emerald)" : "var(--color-pin)");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn("h-7 w-20", className)} aria-hidden="true">
      <path d={`${d} L100,28 L0,28 Z`} fill={color} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** "Sample data" tag — every illustrative number on the page carries one. */
export function SampleTag({ className, children = "Sample data" }: { className?: string; children?: React.ReactNode }) {
  return <span className={cn("rounded-full border border-edge bg-white/[0.04] px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-mute", className)}>{children}</span>;
}
