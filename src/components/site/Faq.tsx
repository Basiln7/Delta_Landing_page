"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Clock3, Mail, Phone, Plus } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { SectionHeader } from "@/components/site/fin";
import { Reveal } from "@/components/motion/Reveal";
import { cn, whatsappHref } from "@/lib/utils";
import type { Faq as FaqItem, SiteSettings } from "@/lib/types";

export function Faq({ faqs, contact }: { faqs: FaqItem[]; contact: SiteSettings["contact"] }) {
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  const wa = whatsappHref(contact.whatsapp, contact.whatsappMessage);

  return (
    <section id="faq" className="bg-snow py-24 text-ink sm:py-32">
      <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <SectionHeader tone="light" eyebrow="FAQ" title="Before you *join*." lede="Straight answers on advice, risk, payments and support." />
            <Reveal delay={0.1} className="mt-8 rounded-[22px] border border-night bg-night p-7 text-white shadow-[0_30px_70px_-40px_rgba(10,15,28,0.7)]">
              <p className="display text-2xl">Still curious?</p>
              <p className="mt-2 text-mute">Talk to a mentor before you pay — no sales script, just answers.</p>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex h-11 items-center gap-2.5 rounded-full bg-[#25D366] pl-2 pr-5 text-sm font-semibold text-[#062e18] transition-colors hover:bg-[#1ebe5b]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/40">
                    <WhatsAppIcon className="h-4 w-4" />
                  </span>
                  Chat on WhatsApp
                </a>
              )}
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-mute">
                <Clock3 className="h-3.5 w-3.5" /> Replies in minutes · English &amp; Malayalam
              </p>
              <div className="mt-6 flex flex-col gap-3 border-t border-edge pt-5 text-sm">
                <a href={`mailto:${contact.email}`} className="inline-flex w-fit items-center gap-2 text-white/85 hover:text-white">
                  <Mail className="h-4 w-4 text-brass-light" /> {contact.email}
                </a>
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="inline-flex w-fit items-center gap-2 text-white/85 hover:text-white">
                  <Phone className="h-4 w-4 text-brass-light" /> <span className="num">{contact.phone}</span>
                </a>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="space-y-3 lg:col-span-7">
          {faqs.map((f, i) => {
            const isOpen = open === f.id;
            return (
              <Reveal key={f.id} delay={i * 0.03} className={cn("card-light overflow-hidden transition-colors", isOpen && "border-ink/20")}>
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${f.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${f.id}`}
                    onClick={() => setOpen(isOpen ? null : f.id)}
                    className="group flex w-full items-center justify-between gap-6 px-5 py-5 text-left sm:px-6"
                  >
                    <span className={cn("text-base font-semibold transition-colors sm:text-lg", isOpen ? "text-ink" : "text-ink/80 group-hover:text-ink")}>
                      {f.question}
                    </span>
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                        isOpen ? "rotate-45 border-ink bg-ink text-white" : "border-line text-ink/60",
                      )}
                    >
                      <Plus className="h-4 w-4" />
                    </span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-a-${f.id}`}
                      role="region"
                      aria-labelledby={`faq-q-${f.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-2xl px-5 pb-6 pr-14 leading-relaxed text-ink/65 sm:px-6">{f.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
