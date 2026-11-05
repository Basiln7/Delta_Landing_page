"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useRef, useState } from "react";
import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import { SectionHeader } from "@/components/site/fin";
import { SmartImage } from "@/components/site/SmartImage";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";
import type { EventItem } from "@/lib/types";

const KIND_STYLE: Record<string, string> = {
  "New Batch": "border-brass-light/40 bg-brass-light/10 text-brass-light",
  Webinar: "border-sky/30 bg-sky/10 text-sky",
  Masterclass: "border-emerald/30 bg-emerald/10 text-emerald",
};

/** Seminar & batch schedule — a calm list with a small image preview that follows the pointer (desktop). */
export function Events({ events }: { events: EventItem[] }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<EventItem | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 30 });
  const sy = useSpring(y, { stiffness: 260, damping: 30 });

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !listRef.current) return;
    const r = listRef.current.getBoundingClientRect();
    x.set(e.clientX - r.left);
    y.set(e.clientY - r.top);
  };

  return (
    <section id="events" className="bg-night py-24 text-white sm:py-32">
      <div className="container-x">
        <SectionHeader
          tone="dark"
          eyebrow="Free live seminars"
          title="Join a *free live* seminar."
          lede="Free beginner seminars, new batch kick-offs and live market reviews with our mentors — reserve your seat in one tap."
        />

        <div ref={listRef} className="relative mt-12" onPointerMove={onMove} onPointerLeave={() => setHovered(null)}>
          {/* pointer preview (desktop) */}
          <motion.div aria-hidden="true" style={{ x: sx, y: sy }} className="pointer-events-none absolute left-0 top-0 z-20 hidden lg:block">
            <AnimatePresence>
              {hovered && (
                <motion.div
                  key={hovered.id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="relative -ml-32 -mt-[5.5rem] h-40 w-64 overflow-hidden rounded-xl border border-edge shadow-2xl"
                >
                  <SmartImage src={hovered.image} alt="" fill sizes="256px" className="object-cover" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <ul className="card-dark divide-y divide-edge overflow-hidden">
            {events.map((ev, i) => {
              const d = new Date(ev.date);
              return (
                <li key={ev.id} onPointerEnter={() => setHovered(ev)} className="group">
                  <Reveal delay={i * 0.04}>
                    <a
                      href={ev.kind === "New Batch" ? "#learn" : "#enquire"}
                      className="grid grid-cols-[4rem_1fr_auto] items-center gap-4 px-5 py-5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[5rem_1fr_auto] sm:gap-6 sm:px-6 lg:grid-cols-[5.5rem_1.5fr_1fr_auto]"
                    >
                      <span className="flex h-16 w-16 flex-col items-center justify-center rounded-xl border border-edge bg-night text-center sm:h-[4.5rem] sm:w-[4.5rem]">
                        <span className="num text-2xl font-semibold leading-none text-white">{d.getUTCDate().toString().padStart(2, "0")}</span>
                        <span className="mt-1 text-[0.6rem] uppercase tracking-wider text-mute">
                          {d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} <span className="num">{String(d.getUTCFullYear()).slice(2)}</span>
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "mb-2 inline-block rounded-full border px-2.5 py-0.5 text-[0.65rem] font-medium",
                            KIND_STYLE[ev.kind] ?? "border-edge bg-white/[0.04] text-mute",
                          )}
                        >
                          {ev.kind}
                        </span>
                        <span className="block text-base font-semibold text-white transition-colors group-hover:text-brass-light sm:text-lg">{ev.title}</span>
                        <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mute lg:hidden">
                          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /><span className="num">{ev.time}</span></span>
                          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{ev.location}</span>
                        </span>
                      </span>
                      <span className="hidden flex-col gap-1.5 text-sm text-mute lg:flex">
                        <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-mute/70" /><span className="num">{ev.time}</span></span>
                        <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-mute/70" />{ev.location}</span>
                      </span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-edge text-white transition-colors group-hover:border-brass-light group-hover:bg-brass-light group-hover:text-ink">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                    </a>
                  </Reveal>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-mute">All seminars are free and live online. New batch kick-offs are for enrolled learners.</p>
        </div>
      </div>
    </section>
  );
}
