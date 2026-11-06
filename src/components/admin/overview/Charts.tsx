"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { STATUS_META } from "@/components/admin/ui";
import type { EnquiryStatus } from "@/lib/types";
import { DEFAULT_CURRENCY, formatPrice, type Currency } from "@/lib/commerce";
import { cn } from "@/lib/utils";

const W = 640;
const H = 240;
const BASE_PAD = { top: 20, right: 16, bottom: 32, left: 32 };

/** Monotone-ish smooth path through points (Catmull-Rom → cubic Bézier, tension 0.5). */
function smoothPath(pts: [number, number][], floor: number) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.5 / 3;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c1y = Math.min(p1[1] + (p2[1] - p0[1]) * t, floor);
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const c2y = Math.min(p2[1] - (p3[1] - p1[1]) * t, floor);
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Round up to a "nice" axis maximum (1, 2, 2.5, 5 × 10^n). */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * mag >= v) ?? 10;
  return step * mag;
}

export function AreaChart({
  data,
  format = "count",
  currency = DEFAULT_CURRENCY,
  unit = ["enquiry", "enquiries"],
  id = "area",
  period = "week",
}: {
  data: { label: string; value: number }[];
  format?: "count" | "currency";
  currency?: Currency;
  unit?: [string, string];
  id?: string;
  /** what one data point covers (screen-reader caption) */
  period?: "week" | "day";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const isMoney = format === "currency";
  const PAD = isMoney ? { ...BASE_PAD, left: 52 } : BASE_PAD;
  const peak = Math.max(...data.map((d) => d.value));
  const max = isMoney ? niceMax(peak * 1.15) : Math.max(4, Math.ceil(peak * 1.25));
  const compact = (v: number) => {
    if (!isMoney) return String(v);
    try {
      return new Intl.NumberFormat(currency.locale, { style: "currency", currency: currency.code, notation: "compact", maximumFractionDigits: 1 }).format(v);
    } catch {
      return `${currency.symbol}${v}`;
    }
  };
  const full = (v: number) => (isMoney ? formatPrice(v, currency) : `${v} ${v === 1 ? unit[0] : unit[1]}`);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = smoothPath(pts, H - PAD.bottom);
  const area = `${line} L ${x(data.length - 1)},${H - PAD.bottom} L ${x(0)},${H - PAD.bottom} Z`;
  const ticks = [0, isMoney ? max / 2 : Math.round(max / 2), max];

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1)))));
  };

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <figure className="relative">
      <figcaption className="sr-only">
        {period === "day"
          ? `Per day over the last ${data.length} days: ${data.map((d) => `${d.label}: ${full(d.value)}`).join(", ")}.`
          : `Weekly totals over the last ${data.length} weeks: ${data.map((d) => `${d.label}: ${full(d.value)}`).join(", ")}. Total ${full(total)}.`}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-hidden>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#B98A3E" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#B98A3E" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tk)} y2={y(tk)} stroke="#0b1324" strokeOpacity={0.07} strokeDasharray={tk === 0 ? undefined : "3 5"} />
            <text x={PAD.left - 10} y={y(tk) + 3.5} textAnchor="end" className="fill-ink/40 font-mono text-[10px]">
              {compact(tk)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={d.label} x={x(i)} y={H - 10} textAnchor="middle" className={cn("font-mono text-[10px]", hover === i ? "fill-ink" : "fill-ink/40")}>
            {d.label}
          </text>
        ))}
        <motion.path d={area} fill={`url(#${id}-fill)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.4 }} />
        <motion.path
          d={line}
          fill="none"
          stroke="#B98A3E"
          strokeWidth={2.25}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="#0b1324" strokeOpacity={0.15} />
        )}
        {pts.map(([px, py], i) => (
          <motion.circle
            key={i}
            cx={px}
            cy={py}
            r={hover === i ? 5.5 : 3.5}
            fill={hover === i ? "#0b1324" : "#fff"}
            stroke={hover === i ? "#fff" : "#B98A3E"}
            strokeWidth={2}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.06 }}
          />
        ))}
        <rect
          x={PAD.left}
          y={0}
          width={innerW}
          height={H}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-ink px-2.5 py-1.5 text-center text-paper shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%`, marginTop: -12 }}
        >
          <p className="font-mono text-[0.625rem] text-paper/55">w/e {data[hover].label}</p>
          <p className="text-sm font-medium whitespace-nowrap tabular-nums">{full(data[hover].value)}</p>
        </div>
      )}
    </figure>
  );
}

export function PipelineBar({ pipeline }: { pipeline: { status: EnquiryStatus; count: number }[] }) {
  const total = pipeline.reduce((s, p) => s + p.count, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-1 overflow-hidden rounded-full" role="img" aria-label="Enquiry pipeline">
        {pipeline
          .filter((p) => p.count > 0)
          .map((p, i) => (
            <motion.div
              key={p.status}
              className={cn("h-full rounded-full", STATUS_META[p.status].dot)}
              initial={{ width: 0 }}
              animate={{ width: `${(p.count / total) * 100}%` }}
              transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
      </div>
      <ul className="mt-6 space-y-3">
        {pipeline.map((p) => (
          <li key={p.status} className="flex items-center gap-3 text-sm">
            <span className={cn("size-2 rounded-full", STATUS_META[p.status].dot)} />
            <span className="flex-1 text-ink/70">{STATUS_META[p.status].label}</span>
            <span className="font-mono text-xs text-ink/40 tabular-nums">{Math.round((p.count / total) * 100)}%</span>
            <span className="w-6 text-right font-medium tabular-nums">{p.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked list with proportional bars — e.g. top courses by revenue. */
export function RankBars({
  rows,
  currency = DEFAULT_CURRENCY,
}: {
  rows: { id: string; title: string; revenue: number; sales: number }[];
  currency?: Currency;
}) {
  const top = rows[0]?.revenue || 1;
  return (
    <ol className="space-y-4">
      {rows.map((r, i) => (
        <li key={r.id}>
          <div className="flex items-baseline gap-3 text-sm">
            <span className="w-5 font-mono text-[0.6875rem] text-ink/35 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1 truncate">{r.title}</span>
            <span className="font-medium tabular-nums">{formatPrice(r.revenue, currency)}</span>
          </div>
          <div className="mt-1.5 ml-8 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[0.06]">
              <motion.div
                className="h-full rounded-full bg-brass"
                initial={{ width: 0 }}
                animate={{ width: `${(r.revenue / top) * 100}%` }}
                transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="w-12 text-right font-mono text-[0.625rem] text-ink/40">{r.sales} sold</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
