"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { ArrowRight, Check, ExternalLink, X } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "@/components/site/fin";

const SEBI_URL =
  "https://www.sebi.gov.in/media-and-notifications/press-releases/sep-2024/updated-sebi-study-reveals-93-of-individual-traders-incurred-losses-in-equity-fando-between-fy22-and-fy24-aggregate-losses-exceed-1-8-lakh-crores-over-three-years_86906.html";

const CAUSES = [
  { bad: "Buying on tips from WhatsApp and Telegram groups", good: "Research any company yourself — AI drafts, you verify", module: "Module 2" },
  { bad: "No position sizing, no stop-loss, no plan", good: "The 1% rule, stop-losses and a written trading plan", module: "Module 4" },
  { bad: "Jumping straight into options with real money", good: "Paper-trade first, then size small and journal every trade", module: "Modules 1 & 4" },
];

/** 10×10 waffle: 93 red squares = 93% of individual F&O traders lost money (SEBI, FY22–FY24). */
function Waffle() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  return (
    <div ref={ref} role="img" aria-label="93 out of 100 individual F&O traders lost money" className="grid w-full max-w-[22rem] grid-cols-10 gap-1.5">
      {Array.from({ length: 100 }, (_, i) => (
        <motion.span
          key={i}
          className={`aspect-square rounded-[4px] ${i < 93 ? "bg-pin" : "bg-emerald"}`}
          initial={{ opacity: 0.12, scale: 0.6 }}
          animate={inView ? { opacity: i < 93 ? 0.85 : 1, scale: 1 } : undefined}
          transition={{ duration: 0.35, delay: (i % 10) * 0.02 + Math.floor(i / 10) * 0.035 }}
        />
      ))}
    </div>
  );
}

export function Problem() {
  return (
    <section id="why" className="bg-snow py-24 text-ink sm:py-32">
      <div className="container-x">
        <SectionHeader
          tone="light"
          eyebrow="Why most traders lose"
          title="The market isn't a casino. *Untrained trading is.*"
          lede="India's market regulator studied more than one crore individual F&O traders. The result is the reason this academy exists."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <Reveal className="card-light flex flex-col gap-8 p-7 sm:p-9 lg:col-span-5">
            <div>
              <p className="num text-[clamp(4.5rem,9vw,7rem)] font-semibold leading-none tracking-tight text-pin">93%</p>
              <p className="mt-3 text-lg font-medium">of individual F&amp;O traders lost money between FY22 and FY24.</p>
              <p className="mt-2 text-sm text-ink/60">Average loss ≈ ₹2 lakh per trader, including transaction costs.</p>
            </div>
            <Waffle />
            <a href={SEBI_URL} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline">
              Source: SEBI study, 23 September 2024 <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Reveal>

          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink/45">
              <span>Why it happens</span>
              <span />
              <span>What we teach instead</span>
            </div>
            {CAUSES.map((c, i) => (
              <Reveal key={c.bad} delay={i * 0.08} className="card-light grid grid-cols-1 items-center gap-3 p-4 sm:grid-cols-[1fr_auto_1fr] sm:p-5">
                <p className="flex items-start gap-3 text-[0.95rem] text-ink/75">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pin/10 text-pin">
                    <X className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  {c.bad}
                </p>
                <ArrowRight className="hidden h-4 w-4 text-ink/30 sm:block" />
                <p className="flex items-start gap-3 text-[0.95rem] font-medium">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald/12 text-emerald">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span>
                    {c.good}
                    <span className="mt-1 block text-xs font-normal text-ink/45">{c.module}</span>
                  </span>
                </p>
              </Reveal>
            ))}
            <Reveal delay={0.25} className="mt-2 rounded-2xl border border-dashed border-ink/15 p-5 text-sm leading-relaxed text-ink/65">
              <span className="font-semibold text-ink">Our promise is a process, not a profit.</span> No one can guarantee returns — anyone who does is
              selling you something. We teach the research, risk rules and discipline that professionals use, so every decision you make is one you
              can explain.
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
