"use client";

import { motion } from "motion/react";
import { ArrowRight, Award, BadgeCheck, Bot, Calculator, RotateCcw, ShieldCheck, Sparkles, Star } from "lucide-react";
import { MarketChart } from "@/components/site/MarketChart";
import { SmartImage } from "@/components/site/SmartImage";
import { SampleTag, Sparkline } from "@/components/site/fin";
import { courseToCartItem } from "@/components/site/Courses";
import { cart } from "@/components/site/cart/store";
import { usePageReady } from "@/lib/hooks";
import { coursePrice, formatPrice, type Currency } from "@/lib/commerce";
import { formatDate, parseEmphasis } from "@/lib/utils";
import type { Course, EventItem, SiteSettings, Testimonial } from "@/lib/types";

const ease = [0.16, 1, 0.3, 1] as const;

// Fictional tickers — a product mockup, never a recommendation.
const WATCHLIST = [
  { s: "DLT50", n: "Delta-50 index", p: "24,318", c: 0.62, seed: 3 },
  { s: "ZENTEK", n: "Zentek Systems", p: "1,642", c: 1.84, seed: 7 },
  { s: "NOVA", n: "Nova Energy", p: "418.6", c: -0.92, seed: 11 },
  { s: "MERIDN", n: "Meridian Bank", p: "1,186", c: 0.35, seed: 19 },
  { s: "KAVERI", n: "Kaveri Foods", p: "736.2", c: -0.41, seed: 23 },
  { s: "SURYA", n: "Surya Solar", p: "92.45", c: 2.6, seed: 29 },
];

function Terminal() {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-edge bg-night-2/90 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur">
      {/* window chrome */}
      <div className="flex items-center gap-3 border-b border-edge bg-white/[0.02] px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
        </span>
        <span className="font-mono text-[0.72rem] text-mute">delta · paper-trading terminal</span>
        <SampleTag className="ml-auto">Fictional sample data</SampleTag>
      </div>

      <div className="grid lg:grid-cols-[13.5rem_1fr]">
        {/* watchlist */}
        <aside className="hidden border-r border-edge lg:block" aria-label="Sample watchlist (fictional tickers)">
          <p className="eyebrow px-4 pb-2 pt-4 text-[0.6rem] text-mute">Watchlist</p>
          <ul>
            {WATCHLIST.map((w, i) => (
              <li key={w.s} className={`flex items-center gap-2 px-4 py-2.5 ${i === 1 ? "bg-white/[0.04]" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[0.78rem] font-medium text-white">{w.s}</span>
                  <span className="block truncate text-[0.65rem] text-mute">{w.n}</span>
                </span>
                <Sparkline seed={w.seed} trend={w.c / 2} className="h-6 w-12" />
                <span className="w-14 text-right">
                  <span className="num block text-[0.75rem] text-white">{w.p}</span>
                  <span className={`num block text-[0.65rem] ${w.c >= 0 ? "text-emerald" : "text-pin"}`}>
                    {w.c >= 0 ? "+" : ""}
                    {w.c.toFixed(2)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0">
          <MarketChart bare />

          {/* AI copilot + risk widget */}
          <div className="grid gap-3 border-t border-edge p-4 md:grid-cols-[1fr_14rem]">
            <div className="rounded-2xl border border-edge bg-night-3/60 p-4">
              <p className="flex items-center gap-2 text-[0.72rem] text-mute">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brass-light text-ink">
                  <Bot className="h-3.5 w-3.5" />
                </span>
                AI research copilot
              </p>
              <p className="mt-3 w-fit max-w-[90%] rounded-2xl rounded-tr-sm bg-white/[0.06] px-3 py-2 text-[0.78rem] text-white/85">
                Summarise Zentek&apos;s Q2 results for a beginner.
              </p>
              <ul className="mt-3 space-y-1.5 text-[0.78rem] text-white/80">
                <li className="flex gap-2"><span className="text-emerald">▲</span> Revenue up 18% year on year; margins steady.</li>
                <li className="flex gap-2"><span className="text-pin">▼</span> Debt rose — check interest cover before deciding.</li>
                <li className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky" /> Verify every number in the annual report.</li>
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["P/E 21.4", "ROE 17.2%", "D/E 0.62", "FCF ₹412 cr"].map((t) => (
                  <span key={t} className="num rounded-md border border-edge px-2 py-0.5 text-[0.68rem] text-mute">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden rounded-2xl border border-edge bg-night-3/60 p-4 md:block">
              <p className="flex items-center gap-2 text-[0.72rem] text-mute">
                <Calculator className="h-3.5 w-3.5 text-sky" /> Position size · 1% rule
              </p>
              <dl className="mt-3 space-y-1.5 text-[0.75rem]">
                {[
                  ["Capital", "₹1,00,000"],
                  ["Risk / trade", "1% · ₹1,000"],
                  ["Entry → Stop", "1,642 → 1,598"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-mute">{k}</dt>
                    <dd className="num text-white">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 rounded-xl bg-brass-light/10 px-3 py-2">
                <p className="text-[0.65rem] text-mute">Quantity</p>
                <p className="num text-xl font-semibold text-brass-light">22 shares</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero({
  settings,
  nextEvent,
  faces,
  flagship,
  currency,
}: {
  settings: SiteSettings;
  nextEvent?: EventItem;
  faces: Testimonial[];
  flagship?: Course;
  currency: Currency;
}) {
  const ready = usePageReady();
  const { hero } = settings;
  const price = flagship ? formatPrice(coursePrice(flagship), currency) : null;
  const show = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: ready ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.8, delay, ease },
  });

  const join = () => {
    if (!flagship) return;
    cart.add(courseToCartItem(flagship), { open: false });
    cart.open("checkout");
  };

  return (
    <section id="top" className="relative isolate overflow-hidden bg-night pb-16 pt-28 sm:pt-32 lg:pb-24">
      {/* ambient: grid + glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(148_163_184/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(148_163_184/0.07)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_60%_20%,black_20%,transparent_70%)]" />
        <div className="absolute -top-40 left-1/3 h-[34rem] w-[34rem] rounded-full bg-sky/15 blur-[140px]" />
        <div className="absolute right-[-10rem] top-1/3 h-[30rem] w-[30rem] rounded-full bg-brass-light/12 blur-[140px]" />
      </div>

      <div className="container-x grid items-center gap-14 xl:grid-cols-12 xl:gap-10">
        <div className="xl:col-span-5">
          {nextEvent && (
            <motion.a href="#events" {...show(0)} className="inline-flex items-center gap-2 rounded-full border border-edge bg-white/[0.04] py-1.5 pl-1.5 pr-4 text-[0.8rem] text-white/80 transition-colors hover:border-white/25">
              <span className="rounded-full bg-brass-light px-2.5 py-0.5 text-[0.7rem] font-semibold text-ink">New batch</span>
              {nextEvent.kind === "New Batch" ? "Starts" : "Next session"} {formatDate(nextEvent.date, { day: "numeric", month: "short" })} · Malayalam support
              <ArrowRight className="h-3.5 w-3.5" />
            </motion.a>
          )}

          <motion.h1 {...show(0.08)} className="display mt-6 text-[clamp(2.75rem,5.6vw,4.9rem)] text-white" aria-label={parseEmphasis(hero.headline).map((p) => p.text).join("")}>
            {parseEmphasis(hero.headline).map((p, i) =>
              p.em ? (
                <span key={i} className="relative whitespace-nowrap text-brass-light">
                  {p.text}
                  <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-2.5 w-full text-brass-light/60">
                    <path d="M2 9 C 50 2, 150 2, 198 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </motion.h1>

          <motion.p {...show(0.18)} className="mt-6 max-w-xl text-lg leading-relaxed text-mute">
            {hero.subheadline}
          </motion.p>

          <motion.div {...show(0.28)} className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={join} className="btn-primary h-13 px-6 text-base">
              {hero.primaryCta}
              {price && <span className="num text-sm font-medium text-ink/60">{price}</span>}
              <ArrowRight className="h-4 w-4" />
            </button>
            <a href="#calculators" className="btn-ghost-dark h-13 px-6 text-base">
              <Calculator className="h-4 w-4 text-sky" /> {hero.secondaryCta}
            </a>
          </motion.div>

          {/* guarantees next to the CTA */}
          <motion.ul {...show(0.36)} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[0.8rem] text-mute">
            <li className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald" /> Secure Razorpay checkout</li>
            <li className="inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4 text-emerald" /> 7-day refund</li>
            <li className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-emerald" /> Education only · not investment advice</li>
          </motion.ul>

          {/* proof */}
          <motion.div {...show(0.44)} className="mt-9 flex flex-col gap-4 border-t border-edge pt-6 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {faces.slice(0, 4).map((f) => (
                  <span key={f.id} className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-night bg-night-3">
                    <SmartImage src={f.image} alt="" fill sizes="36px" className="object-cover" />
                  </span>
                ))}
              </div>
              <div className="text-sm leading-tight">
                <p className="flex items-center gap-1 text-white">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 text-brass-light" fill="currentColor" strokeWidth={0} />
                  ))}
                  <span className="num ml-1 font-semibold">{flagship ? flagship.rating.toFixed(1) : "4.9"}</span>
                </p>
                <p className="text-mute">
                  <span className="num text-white">{settings.studentsCount.toLocaleString("en-IN")}+</span> students
                </p>
              </div>
            </div>
            {settings.badges.length > 0 && (
              <ul className="flex flex-wrap gap-2 text-[0.75rem] text-white/75">
                {settings.badges.map((b) => (
                  <li key={b} className="inline-flex items-center gap-1.5 rounded-full border border-edge px-3 py-1.5">
                    {/guinness/i.test(b) ? <Award className="h-3.5 w-3.5 text-[#e8c35a]" /> : <ShieldCheck className="h-3.5 w-3.5 text-sky" />}
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>

        <motion.div
          className="xl:col-span-7"
          initial={{ opacity: 0, y: 30 }}
          animate={ready ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 1.1, delay: 0.2, ease }}
        >
          <Terminal />
        </motion.div>
      </div>
    </section>
  );
}
