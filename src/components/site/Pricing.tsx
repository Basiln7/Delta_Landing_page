"use client";

import { Award, BadgeCheck, Check, CreditCard, RotateCcw, Scale, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "@/components/site/fin";
import { DeltaMark, Logo } from "@/components/brand/Logo";
import { cart, useCart } from "@/components/site/cart/store";
import { courseToCartItem } from "@/components/site/Courses";
import { formatPrice, planPeriodLabel, type Currency } from "@/lib/commerce";
import { cn } from "@/lib/utils";
import type { Course, Plan } from "@/lib/types";

const GUARANTEES = [
  { icon: RotateCcw, title: "7-day refund", body: "Full refund, no questions asked." },
  { icon: CreditCard, title: "Secure payments by Razorpay", body: "UPI, cards and net banking." },
  { icon: Award, title: "Certificate with a unique ID", body: "Verifiable proof of completion." },
  { icon: Scale, title: "Education only", body: "Not investment advice. Never tips." },
];

/** Stylised, clearly-labelled sample certificate (mirrors the academy's real certificate format). */
function CertificatePreview() {
  return (
    <div className="relative mx-auto max-w-3xl">
      <span className="absolute -top-3 left-6 z-10 rounded-full border border-line bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-ink/55">
        Sample certificate
      </span>
      <div className="relative overflow-hidden rounded-[22px] border border-line bg-white p-2 shadow-[0_30px_80px_-40px_rgba(20,21,28,0.35)]">
        <div className="relative rounded-[16px] border border-ink/10 bg-[linear-gradient(135deg,#fbfcfe,#f1f4f9)] px-6 py-8 sm:px-12 sm:py-10">
          <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[12px] border border-dashed border-ink/10" />
          <div className="relative flex items-start justify-between gap-4">
            <Logo className="text-ink" />
            <span className="num text-[0.65rem] text-ink/45">ID: DAI-SM-2026-000123</span>
          </div>
          <div className="relative mt-8 text-center">
            <p className="eyebrow text-ink/50">Certificate of completion</p>
            <p className="display mt-4 text-3xl text-ink sm:text-4xl">Your Name</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-ink/60">
              has successfully completed all 4 modules and 4 projects of
            </p>
            <p className="display mt-2 text-xl text-ink sm:text-2xl">Master the Stock Market with AI</p>
          </div>
          <div className="relative mt-10 flex items-end justify-between gap-6">
            <div className="text-left">
              <p className="num text-sm text-ink/70">30 Jan 2027</p>
              <p className="mt-1 border-t border-ink/20 pt-1 text-[0.65rem] uppercase tracking-wider text-ink/45">Date of issue</p>
            </div>
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brass-light text-ink shadow-[0_0_0_6px_rgba(211,251,82,0.25)]">
              <span className="flex flex-col items-center">
                <DeltaMark className="h-6" />
                <span className="mt-0.5 text-[0.5rem] font-bold uppercase tracking-wider">Verified</span>
              </span>
            </div>
            <div className="text-right">
              <p className="font-[cursive] text-lg italic text-ink/70">Academic Head</p>
              <p className="mt-1 border-t border-ink/20 pt-1 text-[0.65rem] uppercase tracking-wider text-ink/45">Delta Markets Academy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Pricing. A plan with `courseId` sells that course (e.g. the flagship) — its button adds the course
 * itself to the cart, so the flagship is never bought twice as "plan" and "course". Other plans are
 * memberships (one at a time).
 */
export function Pricing({ plans, courses, currency }: { plans: Plan[]; courses: Course[]; currency: Currency }) {
  const { items } = useCart();

  return (
    <section id="pricing" className="relative overflow-hidden bg-snow py-24 text-ink sm:py-32">
      <div className="container-x relative">
        <SectionHeader
          tone="light"
          align="center"
          className="mx-auto"
          eyebrow="Pricing"
          title="One flagship. *One price.*"
          lede="Everything in the flagship for a single launch price — or go further with a yearly pass and a personal mentor. No hidden fees."
        />

        <div className="mx-auto mt-14 grid max-w-6xl items-stretch gap-5 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const linked = plan.courseId ? courses.find((c) => c.id === plan.courseId) : undefined;
            const inCart = linked
              ? items.some((it) => it.kind === "course" && it.id === linked.id)
              : items.some((it) => it.kind === "plan" && it.id === plan.id);
            const monthly = plan.period === "year" ? Math.round(plan.price / 12) : null;
            const dark = plan.highlighted;
            return (
              <Reveal key={plan.id} delay={i * 0.06} className="h-full">
                <article
                  className={cn(
                    "relative flex h-full flex-col rounded-[22px] border p-7 sm:p-8",
                    dark
                      ? "border-night bg-night text-white shadow-[0_40px_90px_-40px_rgba(10,15,28,0.75)] lg:-my-3 lg:py-10"
                      : "border-line bg-white text-ink",
                  )}
                >
                  {dark && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brass-light px-3.5 py-1 text-xs font-semibold text-ink">
                      <Sparkles className="h-3.5 w-3.5" /> Most popular
                    </span>
                  )}
                  <p className={cn("text-sm font-semibold", dark ? "text-brass-light" : "text-emerald")}>{plan.name}</p>
                  <p className={cn("mt-2 text-sm", dark ? "text-mute" : "text-ink/60")}>{plan.tagline}</p>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="num text-5xl font-semibold leading-none">{formatPrice(plan.price, currency)}</span>
                    <span className={cn("text-sm", dark ? "text-mute" : "text-ink/50")}>{planPeriodLabel(plan.period)}</span>
                  </div>
                  {monthly && (
                    <p className={cn("mt-2 text-xs", dark ? "text-mute" : "text-ink/45")}>
                      ≈ <span className="num">{formatPrice(monthly, currency)}</span>/month, billed yearly
                    </p>
                  )}

                  <ul className={cn("mt-7 flex-1 space-y-3 border-t pt-6", dark ? "border-edge" : "border-line")}>
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-3 text-[0.95rem]">
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                            dark ? "bg-brass-light text-ink" : "bg-emerald/12 text-emerald",
                          )}
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span className={dark ? "text-white/85" : "text-ink/75"}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => {
                      if (inCart) return cart.open();
                      if (linked) return cart.add(courseToCartItem(linked));
                      cart.add({
                        kind: "plan",
                        id: plan.id,
                        title: `${plan.name} membership`,
                        price: plan.price,
                        subtitle: `${formatPrice(plan.price, currency)} ${planPeriodLabel(plan.period)}`,
                      });
                    }}
                    className={cn("mt-8 w-full", dark ? "btn-primary" : "btn-ghost-light", inCart && !dark && "border-emerald text-emerald")}
                  >
                    {inCart ? "In your cart — checkout" : plan.cta}
                  </button>
                  <p className={cn("mt-3 text-center text-[0.7rem]", dark ? "text-mute" : "text-ink/45")}>Education only · not investment advice</p>
                </article>
              </Reveal>
            );
          })}
        </div>

        {/* Guarantee block */}
        <Reveal delay={0.05}>
          <ul className="card-light mx-auto mt-10 grid max-w-6xl divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
            {GUARANTEES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald/10 text-emerald">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink">{title}</span>
                  <span className="mt-0.5 block text-sm text-ink/55">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Reveal>

        <p className="mt-6 text-center text-sm text-ink/50">
          Prices in {currency.code}, inclusive of taxes · Cancel monthly plans anytime · <BadgeCheck className="inline h-4 w-4 align-[-3px] text-emerald" /> 7-day refund on every purchase
        </p>

        {/* Certificate preview */}
        <div className="mt-20">
          <Reveal>
            <div className="mb-8 text-center">
              <p className="display text-2xl sm:text-3xl">Finish with proof, not just notes.</p>
              <p className="mt-2 text-ink/60">Every learner who completes the modules and projects receives a certificate with a unique, verifiable ID.</p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <CertificatePreview />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
