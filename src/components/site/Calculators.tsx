"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Calculator, LineChart, ShieldAlert } from "lucide-react";
import { SectionHeader } from "@/components/site/fin";
import { positionSize, sipProjection } from "@/lib/calculators";
import { formatPrice, type Currency } from "@/lib/commerce";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

/** Compact Indian formatting for chart labels: ₹12.4L, ₹1.2Cr. */
function compactINR(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n >= 1e6 ? 0 : 1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`;
  return `₹${Math.round(n)}`;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-ink/70">
          {label}
        </label>
        <span className="num rounded-lg bg-cloud px-2.5 py-1 text-sm font-semibold">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-[#4d7c0f]"
        style={{ background: `linear-gradient(to right, #14151c ${pct}%, #e4e8f3 ${pct}%)` }}
      />
    </div>
  );
}

function NumberField({ label, value, onChange, prefix, hint }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; hint?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm text-ink/70">{label}</span>
      <span className="mt-1.5 flex h-12 items-center rounded-xl border border-line bg-white px-3 focus-within:border-ink">
        {prefix && <span className="mr-1.5 text-ink/40">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="num w-full bg-transparent text-[0.95rem] outline-none"
        />
      </span>
      {hint && <span className="mt-1 block text-xs text-ink/45">{hint}</span>}
    </label>
  );
}

function SipCalculator({ currency }: { currency: Currency }) {
  const [monthly, setMonthly] = useState(5000);
  const [years, setYears] = useState(15);
  const [ret, setRet] = useState(12);
  const [stepUp, setStepUp] = useState(10);
  const r = useMemo(() => sipProjection({ monthly, years, annualReturn: ret, stepUp }), [monthly, years, ret, stepUp]);
  const fmt = (n: number) => formatPrice(n, currency);
  const max = Math.max(...r.series.map((s) => s.value), 1);
  const investedShare = r.value > 0 ? (r.invested / r.value) * 100 : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-7 lg:col-span-5">
        <Slider label="Monthly investment" value={monthly} min={500} max={100000} step={500} onChange={setMonthly} display={fmt(monthly)} />
        <Slider label="Investment period" value={years} min={1} max={40} step={1} onChange={setYears} display={`${years} yrs`} />
        <Slider label="Expected return (p.a.)" value={ret} min={1} max={20} step={0.5} onChange={setRet} display={`${ret}%`} />
        <Slider label="Yearly step-up" value={stepUp} min={0} max={25} step={1} onChange={setStepUp} display={`${stepUp}%`} />
      </div>

      <div className="lg:col-span-7">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { k: "Total invested", v: r.invested, cls: "" },
            { k: "Estimated gains", v: r.gain, cls: "text-emerald" },
            { k: "Estimated value", v: r.value, cls: "text-ink" },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-xs text-ink/55">{x.k}</p>
              <p className={cn("num mt-1 text-xl font-semibold sm:text-2xl", x.cls)}>{fmt(x.v)}</p>
            </div>
          ))}
        </div>

        {/* stacked bars: invested vs value, per year */}
        <div className="mt-5 rounded-2xl border border-line bg-white p-5">
          <div className="flex items-center justify-between text-xs text-ink/55">
            <span className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink" /> Invested</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald" /> Growth</span>
            </span>
            <span className="num">{compactINR(max)}</span>
          </div>
          <div className="mt-4 flex h-48 items-end gap-[3px]" role="img" aria-label={`Projected value grows to ${fmt(r.value)} over ${years} years`}>
            {r.series.map((s) => {
              const h = (s.value / max) * 100;
              const inv = (s.invested / s.value) * 100;
              return (
                <div key={s.year} className="group relative flex h-full flex-1 items-end">
                  <motion.div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-t-[3px]"
                    initial={false}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.45, ease }}
                  >
                    <div className="bg-ink" style={{ height: `${inv}%` }} />
                    <div className="flex-1 bg-emerald" />
                  </motion.div>
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[0.65rem] text-white group-hover:block">
                    Yr {s.year}: <span className="num">{compactINR(s.value)}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[0.65rem] text-ink/40">
            <span>Year 1</span>
            <span>Year {years}</span>
          </div>
          <p className="mt-4 text-sm text-ink/65">
            Your own money is <span className="num font-semibold text-ink">{investedShare.toFixed(0)}%</span> of the final value — the rest is
            compounding. Time in the market does most of the work.
          </p>
        </div>
      </div>
    </div>
  );
}

function PositionCalculator({ currency }: { currency: Currency }) {
  const [capital, setCapital] = useState(100000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(1642);
  const [stop, setStop] = useState(1598);
  const [target, setTarget] = useState(1750);
  const r = useMemo(() => positionSize({ capital, riskPct, entry, stop, target }), [capital, riskPct, entry, stop, target]);
  const fmt = (n: number) => formatPrice(n, currency);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-5">
        <NumberField label="Trading capital" prefix="₹" value={capital} onChange={setCapital} />
        <Slider label="Risk per trade" value={riskPct} min={0.25} max={5} step={0.25} onChange={setRiskPct} display={`${riskPct}%`} />
        <div className="grid grid-cols-3 gap-3">
          <NumberField label="Entry" prefix="₹" value={entry} onChange={setEntry} />
          <NumberField label="Stop-loss" prefix="₹" value={stop} onChange={setStop} />
          <NumberField label="Target" prefix="₹" value={target} onChange={setTarget} />
        </div>
      </div>

      <div className="lg:col-span-7">
        {r.valid ? (
          <>
            <div className="rounded-2xl bg-night p-6 text-white">
              <p className="text-sm text-mute">{r.direction === "short" ? "Short-sell at most" : "Buy at most"}</p>
              <p className="num mt-1 text-5xl font-semibold text-brass-light">
                {r.quantity.toLocaleString("en-IN")} <span className="text-2xl text-white/70">shares</span>
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-mute">Max loss if stopped out</p>
                  <p className="num mt-1 text-lg text-pin">−{fmt(r.maxLoss)}</p>
                </div>
                <div>
                  <p className="text-xs text-mute">Position value</p>
                  <p className="num mt-1 text-lg">{fmt(r.positionValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-mute">Risk : reward</p>
                  <p className={cn("num mt-1 text-lg", r.rr && r.rr >= 2 ? "text-emerald" : "text-white")}>{r.rr ? `1 : ${r.rr.toFixed(1)}` : "—"}</p>
                </div>
              </div>
              {/* exposure bar */}
              <div className="mt-6">
                <div className="flex justify-between text-xs text-mute">
                  <span>Capital in this trade</span>
                  <span className="num">{Math.min(r.exposurePct, 999).toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={cn("h-full rounded-full", r.exposurePct > 100 ? "bg-pin" : "bg-sky")}
                    animate={{ width: `${Math.min(r.exposurePct, 100)}%` }}
                    transition={{ duration: 0.4, ease }}
                  />
                </div>
              </div>
            </div>
            <AnimatePresence>
              {r.exposurePct > 100 && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 flex items-start gap-2 rounded-xl bg-pin/10 p-3 text-sm text-pin"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> This position is larger than your capital — it would need leverage. Widen the stop or reduce risk.
                </motion.p>
              )}
            </AnimatePresence>
            <p className="mt-4 text-sm text-ink/65">
              Risking <span className="num font-semibold text-ink">{riskPct}%</span> means{" "}
              <span className="num font-semibold text-ink">{Math.round(100 / riskPct)}</span> losing trades in a row before your capital is gone —
              that&apos;s why professionals size every position first.
            </p>
          </>
        ) : (
          <p className="flex items-start gap-2 rounded-2xl border border-dashed border-ink/20 p-6 text-sm text-ink/65">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-pin" /> Enter capital, an entry price and a stop-loss that is different from the entry.
          </p>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: "sip", label: "SIP growth", icon: <LineChart className="h-4 w-4" /> },
  { id: "position", label: "Position size", icon: <Calculator className="h-4 w-4" /> },
] as const;

/** Interactive finance calculators — teach the maths before the market (lead-magnet pattern). */
export function Calculators({ currency }: { currency: Currency }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("sip");

  return (
    <section id="calculators" className="bg-snow py-24 text-ink sm:py-32">
      <div className="container-x">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeader
            tone="light"
            eyebrow="Free tools"
            title="Do the maths *before* the market."
            lede="Two calculators from the course: what steady investing can grow into, and how much to buy so one bad trade never hurts you."
          />
          <LayoutGroup id="calc-tabs">
            <div role="tablist" aria-label="Calculators" className="flex w-fit rounded-full border border-line bg-white p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  aria-controls={`calc-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={cn("relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors", tab === t.id ? "text-white" : "text-ink/65 hover:text-ink")}
                >
                  {tab === t.id && <motion.span layoutId="calc-pill" className="absolute inset-0 rounded-full bg-night" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="relative flex items-center gap-2">
                    {t.icon}
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </LayoutGroup>
        </div>

        <div id={`calc-${tab}`} role="tabpanel" className="card-light mt-12 p-6 sm:p-9">
          {tab === "sip" ? <SipCalculator currency={currency} /> : <PositionCalculator currency={currency} />}
        </div>

        <div className="mt-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="max-w-2xl text-xs leading-relaxed text-ink/50">
            Illustrative only. Returns are not guaranteed; markets can fall as well as rise. These calculators are educational tools, not investment advice.
          </p>
          <a href="#learn" className="btn-ghost-light shrink-0">
            Learn the full risk module <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
