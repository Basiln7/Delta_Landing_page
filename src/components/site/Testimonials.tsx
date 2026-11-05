"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";
import { SmartImage } from "@/components/site/SmartImage";
import { Eyebrow } from "@/components/site/fin";
import { cn } from "@/lib/utils";
import type { Testimonial } from "@/lib/types";

const DURATION = 7000;

/** Skill/process tags inferred from the quote — stories describe process, never profits. */
const TAGS: [RegExp, string][] = [
  [/annual report|research|screen|claude/i, "AI research"],
  [/risk|position size|journal|rules/i, "Risk rules"],
  [/alert|n8n|automat|watchlist/i, "Automation"],
  [/process|plan|repeat/i, "Repeatable process"],
  [/tip/i, "No more tips"],
];
const tagsFor = (quote: string) => TAGS.filter(([re]) => re.test(quote)).map(([, t]) => t).slice(0, 3);

export function Testimonials({ items }: { items: Testimonial[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dir, setDir] = useState(1);

  const go = useCallback(
    (delta: number) => {
      setDir(delta);
      setIndex((i) => (i + delta + items.length) % items.length);
    },
    [items.length],
  );

  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setTimeout(() => go(1), DURATION);
    return () => clearTimeout(t);
  }, [index, paused, go, items.length]);

  if (!items.length) return null;
  const t = items[index];
  const tags = tagsFor(t.quote);

  return (
    <section
      id="voices"
      aria-roledescription="carousel"
      aria-label="Testimonials"
      className="relative overflow-hidden bg-night py-24 text-white sm:py-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-brass-light/[0.05] blur-[120px]" />

      <div className="container-x relative">
        <div className="flex justify-center">
          <Eyebrow tone="dark">Learner stories</Eyebrow>
        </div>

        <div className="relative mx-auto mt-10 min-h-[24rem] max-w-4xl text-center sm:min-h-[20rem]" aria-live="polite">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.figure
              key={t.id}
              custom={dir}
              initial={{ opacity: 0, y: 16 * dir }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 * dir }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Quote className="mx-auto h-8 w-8 text-brass-light" aria-hidden="true" />
              <blockquote className="display mt-6 text-[clamp(1.6rem,3.4vw,2.9rem)] leading-[1.18] text-white">&ldquo;{t.quote}&rdquo;</blockquote>
              {tags.length > 0 && (
                <ul className="mt-6 flex flex-wrap justify-center gap-2">
                  {tags.map((tag) => (
                    <li key={tag} className="rounded-full border border-edge bg-white/[0.04] px-3 py-1 text-xs text-mute">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
              <figcaption className="mt-8 flex items-center justify-center gap-4">
                <span className="relative h-12 w-12 overflow-hidden rounded-full border border-edge bg-night-3">
                  <SmartImage src={t.image} alt={t.author} fill sizes="48px" className="object-cover" />
                </span>
                <span className="text-left">
                  <span className="block font-semibold text-white">{t.author}</span>
                  <span className="text-sm text-mute">
                    {t.role}
                    {t.origin ? ` · ${t.origin}` : ""}
                  </span>
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        <div className="mx-auto mt-10 flex max-w-4xl items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous testimonial"
            className="btn-ghost-dark h-11 w-11 shrink-0 px-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 gap-2">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setDir(i > index ? 1 : -1);
                  setIndex(i);
                }}
                aria-label={`Show testimonial ${i + 1}`}
                aria-current={i === index}
                className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10"
              >
                <span
                  key={i === index ? `active-${index}-${paused}` : "idle"}
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full bg-white/40",
                    i < index && "w-full",
                    i === index && (paused ? "w-full bg-brass-light" : "animate-progress bg-brass-light"),
                  )}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next testimonial"
            className="btn-ghost-dark h-11 w-11 shrink-0 px-0"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mx-auto mt-6 max-w-4xl text-center text-xs text-mute/80">
          Individual experiences. Learning outcomes vary and no returns are implied.
        </p>
      </div>
    </section>
  );
}
