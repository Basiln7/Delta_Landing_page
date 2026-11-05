"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { BadgeCheck, BookOpen, Check, Download, FolderGit2, Languages, Plus, RotateCcw, ShieldCheck, Sparkles, Video } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "@/components/site/fin";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { courseToCartItem } from "@/components/site/Courses";
import { cart, useCart } from "@/components/site/cart/store";
import { coursePrice, discountPercent, formatPrice, type Currency } from "@/lib/commerce";
import { cn, whatsappHref } from "@/lib/utils";
import type { Course, Plan, ProgramModule, SiteSettings } from "@/lib/types";

const ease = [0.16, 1, 0.3, 1] as const;

/** Countdown to a REAL, admin-set end date. Renders nothing once it has passed (no fake urgency). */
function Countdown({ endsAt }: { endsAt?: string }) {
  const end = endsAt ? Date.parse(endsAt) : NaN;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (Number.isNaN(end)) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [end]);

  if (Number.isNaN(end) || (now !== null && now >= end)) return null;
  const left = now === null ? null : Math.max(0, end - now);
  const parts = [
    { label: "days", v: left === null ? null : Math.floor(left / 86_400_000) },
    { label: "hrs", v: left === null ? null : Math.floor((left / 3_600_000) % 24) },
    { label: "min", v: left === null ? null : Math.floor((left / 60_000) % 60) },
    { label: "sec", v: left === null ? null : Math.floor((left / 1000) % 60) },
  ];
  const endLabel = new Date(end).toLocaleDateString("en-IN", { day: "numeric", month: "long" });

  return (
    <div className="rounded-2xl border border-edge bg-white/[0.03] p-4">
      <p className="flex items-center justify-between text-xs text-mute">
        <span>Launch price ends</span>
        <span className="text-brass-light">{endLabel}</span>
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2" aria-live="off">
        {parts.map((p) => (
          <div key={p.label} className="rounded-xl bg-white/[0.05] py-2 text-center">
            <span className="num block text-2xl font-semibold text-white">{p.v === null ? "··" : String(p.v).padStart(2, "0")}</span>
            <span className="text-[0.6rem] uppercase tracking-wider text-mute">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function brochureLink(settings: SiteSettings) {
  return settings.brochureUrl || whatsappHref(settings.contact.whatsapp, `Hi ${settings.name}! Please send me the brochure for the Stock Market + AI program.`) || "#enquire";
}

/** The flagship programme: 8-week roadmap (module by module) + sticky price card with guarantees. */
export function Flagship({
  course,
  modules,
  plan,
  settings,
  currency,
  projectCount,
  toolCount,
}: {
  course: Course;
  modules: ProgramModule[];
  plan?: Plan;
  settings: SiteSettings;
  currency: Currency;
  projectCount: number;
  toolCount: number;
}) {
  const [open, setOpen] = useState<string | null>(modules[0]?.id ?? null);
  const { items } = useCart();
  const inCart = items.some((i) => i.kind === "course" && i.id === course.id);
  const price = coursePrice(course);
  const off = discountPercent(course);
  const topicCount = modules.reduce((s, m) => s + m.topics.length, 0);
  const features = plan?.features?.length ? plan.features : course.outcomes;
  const wa = whatsappHref(settings.contact.whatsapp, settings.contact.whatsappMessage);
  const brochure = brochureLink(settings);
  const weeks = modules.length * 2;

  const join = () => {
    cart.add(courseToCartItem(course), { open: false });
    cart.open("checkout");
  };

  const facts = [
    { icon: <BookOpen className="h-4 w-4" />, label: `${modules.length} modules · ${topicCount} topics` },
    { icon: <FolderGit2 className="h-4 w-4" />, label: `${projectCount} real projects` },
    { icon: <Sparkles className="h-4 w-4" />, label: `${toolCount} AI & market tools` },
    { icon: <Video className="h-4 w-4" />, label: `${weeks} weeks · live + recorded` },
    { icon: <Languages className="h-4 w-4" />, label: "Malayalam support" },
  ];

  return (
    <section id="learn" className="bg-snow py-24 text-ink sm:py-32">
      <div className="container-x">
        <SectionHeader
          tone="light"
          eyebrow="The flagship program"
          title={`${course.title.replace("with AI", "with *AI*")}.`}
          lede={`Everything you'll learn, module by module — ${weeks} weeks from how an exchange works to a written trading plan with risk rules you actually follow.`}
        />

        <Reveal className="mt-8 flex flex-wrap gap-2">
          {facts.map((f) => (
            <span key={f.label} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm">
              <span className="text-emerald">{f.icon}</span>
              {f.label}
            </span>
          ))}
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          {/* Roadmap */}
          <div id="curriculum" className="relative scroll-mt-28 lg:col-span-7">
            <span aria-hidden="true" className="absolute bottom-6 left-[1.6rem] top-6 w-px bg-line sm:left-[1.85rem]" />
            <ol className="relative space-y-3">
              {modules.map((m, i) => {
                const isOpen = open === m.id;
                return (
                  <Reveal key={m.id} delay={i * 0.05}>
                    <li className={cn("rounded-2xl border bg-white transition-colors", isOpen ? "border-ink/80 shadow-[0_18px_40px_-28px_rgba(20,21,28,0.5)]" : "border-line hover:border-ink/25")}>
                      <h3>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`module-${m.id}`}
                          onClick={() => setOpen(isOpen ? null : m.id)}
                          className="flex w-full items-start gap-4 p-4 text-left sm:gap-5 sm:p-5"
                        >
                          <span className={cn("num relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold sm:h-12 sm:w-12", isOpen ? "bg-night text-brass-light" : "bg-cloud text-ink/60")}>
                            0{i + 1}
                          </span>
                          <span className="flex-1">
                            <span className="text-xs font-medium uppercase tracking-wider text-ink/45">
                              Weeks {i * 2 + 1}–{i * 2 + 2} · {m.topics.length} topics
                            </span>
                            <span className="display mt-1 block text-2xl sm:text-[1.7rem]">{m.title}</span>
                            <span className="mt-1.5 block max-w-xl text-sm leading-relaxed text-ink/60">{m.summary}</span>
                          </span>
                          <span className={cn("mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300", isOpen ? "rotate-45 border-ink bg-ink text-white" : "border-line")}>
                            <Plus className="h-4 w-4" />
                          </span>
                        </button>
                      </h3>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            id={`module-${m.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease }}
                            className="overflow-hidden"
                          >
                            <ul className="grid gap-x-6 gap-y-2 border-t border-line px-5 py-4 sm:grid-cols-2 sm:pl-[5.25rem]">
                              {m.topics.map((t, ti) => (
                                <li key={t} className="flex gap-2.5 text-[0.92rem]">
                                  <span className="num mt-0.5 text-xs text-ink/35">
                                    {i + 1}.{ti + 1}
                                  </span>
                                  {t}
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  </Reveal>
                );
              })}
            </ol>
          </div>

          {/* Price card */}
          <aside className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <Reveal className="overflow-hidden rounded-[24px] bg-night text-white shadow-[0_40px_90px_-45px_rgba(10,15,28,0.9)]">
                <div className="relative p-6 sm:p-8">
                  <div aria-hidden="true" className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brass-light/15 blur-3xl" />
                  <p className="text-sm text-mute">One plan · everything included</p>
                  <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <span className="num text-6xl font-semibold leading-none">{formatPrice(price, currency)}</span>
                    {price < course.price && <span className="num pb-1.5 text-lg text-mute line-through">{formatPrice(course.price, currency)}</span>}
                    {off > 0 && <span className="mb-1.5 rounded-full bg-brass-light px-2.5 py-0.5 text-xs font-bold text-ink">{off}% off</span>}
                  </div>
                  <p className="mt-2 text-sm text-mute">One-time payment · no tiers · nothing locked behind an upgrade</p>
                </div>
                <div className="space-y-5 px-6 pb-6 sm:px-8 sm:pb-8">
                  <Countdown endsAt={settings.offerEndsAt} />
                  <ul className="space-y-2.5">
                    {features.map((f) => (
                      <li key={f} className="flex gap-3 text-[0.95rem] text-white/90">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass-light text-ink">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="grid gap-2">
                    <button type="button" onClick={join} className="btn-primary h-14 w-full text-base">
                      {inCart ? "Continue to checkout" : `Join now — ${formatPrice(price, currency)}`}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <a href={brochure} target={brochure.startsWith("#") ? undefined : "_blank"} rel="noopener noreferrer" className="btn-ghost-dark h-11 text-sm">
                        <Download className="h-4 w-4" /> Brochure
                      </a>
                      {wa && (
                        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost-dark h-11 text-sm">
                          <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> Ask a mentor
                        </a>
                      )}
                    </div>
                  </div>
                  <ul className="grid gap-2 border-t border-edge pt-4 text-xs text-mute sm:grid-cols-2">
                    <li className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald" /> Secure Razorpay checkout</li>
                    <li className="inline-flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5 text-emerald" /> 7-day refund, no questions</li>
                    <li className="inline-flex items-center gap-1.5 sm:col-span-2"><BadgeCheck className="h-3.5 w-3.5 text-emerald" /> Education only — not investment advice</li>
                  </ul>
                </div>
              </Reveal>
              <p className="mt-3 text-center text-xs text-ink/50">Mentors reply on WhatsApp in minutes · English &amp; Malayalam</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
