"use client";

import { motion } from "motion/react";
import { cn, parseEmphasis } from "@/lib/utils";

type SplitTextProps = {
  text: string;
  className?: string;
  emClassName?: string;
  delay?: number;
  stagger?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  /** animate when scrolled into view (default) or immediately on mount */
  trigger?: "view" | "mount";
  /** with trigger="mount": hold the animation until this flips true */
  play?: boolean;
};

/**
 * Masked word-by-word reveal. Words wrapped in *asterisks* render in the accent colour.
 * Screen readers get the full sentence via aria-label.
 */
export function SplitText({
  text,
  className,
  emClassName = "text-brass",
  delay = 0,
  stagger = 0.06,
  as: Tag = "h2",
  trigger = "view",
  play = true,
}: SplitTextProps) {
  const segments = parseEmphasis(text);
  const plain = segments.map((s) => s.text).join("");
  let index = 0;

  const animateProps =
    trigger === "mount"
      ? { animate: play ? ("show" as const) : ("hidden" as const) }
      : { whileInView: "show" as const, viewport: { once: true, amount: 0.4 } };

  return (
    <Tag className={className} aria-label={plain}>
      <motion.span initial="hidden" {...animateProps} aria-hidden="true" className="inline">
        {segments.map((seg, si) =>
          seg.text.split(/(\s+)/).map((word, wi) => {
            if (!word) return null;
            if (/^\s+$/.test(word)) return <span key={`${si}-${wi}`}> </span>;
            const i = index++;
            return (
              <span key={`${si}-${wi}`} className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
                <motion.span
                  className={cn("inline-block will-change-transform", seg.em && emClassName)}
                  variants={{
                    hidden: { y: "115%", rotate: 3 },
                    show: {
                      y: "0%",
                      rotate: 0,
                      transition: { duration: 1.1, delay: delay + i * stagger, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                >
                  {word}
                </motion.span>
              </span>
            );
          }),
        )}
      </motion.span>
    </Tag>
  );
}
