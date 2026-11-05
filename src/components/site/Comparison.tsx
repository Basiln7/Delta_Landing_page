import { Check, Minus, X } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "@/components/site/fin";
import { cn } from "@/lib/utils";

type Cell = "yes" | "no" | "partial" | string;

const ALTERNATIVES = ["Tip groups", "Free videos", "Signal services"] as const;

const ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: "Teaches you to research for yourself", cells: ["no", "partial", "no", "yes"] },
  { label: "Risk management & position sizing", cells: ["no", "partial", "no", "yes"] },
  { label: "A reusable AI research workflow", cells: ["no", "no", "no", "yes"] },
  { label: "Live mentors who answer your questions", cells: ["no", "no", "partial", "yes"] },
  { label: "4 projects you keep (report, journal, backtest, alerts)", cells: ["no", "no", "no", "yes"] },
  { label: "Certificate with a unique ID", cells: ["no", "no", "no", "yes"] },
  { label: "Live support in Malayalam", cells: ["partial", "partial", "no", "yes"] },
  { label: "Conflict of interest", cells: ["Often", "Varies", "Often", "None — we never give tips"] },
  { label: "Cost", cells: ["“Free” — you pay later", "Free", "₹2k–10k / month", "₹1,999 one-time"] },
];

function Mark({ v, highlight }: { v: Cell; highlight: boolean }) {
  if (v === "yes")
    return (
      <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full", highlight ? "bg-brass-light text-ink" : "bg-emerald/15 text-emerald")}>
        <Check className="h-4 w-4" strokeWidth={3} aria-label="Yes" />
      </span>
    );
  if (v === "no")
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.05] text-mute/70">
        <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="No" />
      </span>
    );
  if (v === "partial")
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f5b544]/15 text-[#f5b544]">
        <Minus className="h-4 w-4" strokeWidth={3} aria-label="Partly" />
      </span>
    );
  return <span className={cn("text-sm", highlight ? "font-semibold text-white" : "text-mute")}>{v}</span>;
}

/** Comparison against the alternatives a beginner actually considers. */
export function Comparison({ brandName = "Delta Markets Academy" }: { brandName?: string }) {
  const COLUMNS = [...ALTERNATIVES, brandName];
  return (
    <section id="compare" className="bg-night py-24 sm:py-32">
      <div className="container-x">
        <SectionHeader
          eyebrow="How we compare"
          title="Tips get you in. *A process keeps you in.*"
          lede="What a beginner really chooses between — and what each option leaves you with when the market turns."
        />

        <Reveal className="mt-14 overflow-x-auto rounded-[22px] border border-edge" data-lenis-prevent>
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <caption className="sr-only">Comparison of {brandName} with tip groups, free videos and signal services</caption>
            <thead>
              <tr className="border-b border-edge bg-white/[0.02]">
                <th scope="col" className="w-[34%] px-5 py-5 text-sm font-medium text-mute">
                  What you get
                </th>
                {COLUMNS.map((c, i) => {
                  const hl = i === COLUMNS.length - 1;
                  return (
                    <th key={c} scope="col" className={cn("px-4 py-5 text-center text-sm font-semibold", hl ? "relative bg-brass-light/[0.07] text-white" : "text-white/80")}>
                      {hl && <span className="absolute inset-x-0 top-0 h-0.5 bg-brass-light" />}
                      {c}
                      {hl && <span className="mt-1 block text-[0.65rem] font-medium uppercase tracking-wider text-brass-light">Recommended</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-b border-edge last:border-0">
                  <th scope="row" className="px-5 py-4 text-[0.95rem] font-normal text-white/85">
                    {r.label}
                  </th>
                  {r.cells.map((v, i) => {
                    const hl = i === r.cells.length - 1;
                    return (
                      <td key={i} className={cn("px-4 py-4 text-center", hl && "bg-brass-light/[0.07]")}>
                        <Mark v={v} highlight={hl} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <p className="mt-4 text-xs text-mute/70">Comparison reflects typical offerings in each category; individual providers vary.</p>
      </div>
    </section>
  );
}
