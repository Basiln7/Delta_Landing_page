"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { DeltaMark } from "@/components/brand/Logo";

const ease = [0.16, 1, 0.3, 1] as const;

/** Shared layout for the sign-in and invite pages: brand panel on the left, form column on the right. */
export function AuthFrame({ eyebrow, title, intro, children }: { eyebrow: string; title: ReactNode; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-[#F6F3ED] lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-ink p-12 text-paper lg:flex lg:flex-col">
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#f4efe6_1px,transparent_1px),linear-gradient(to_bottom,#f4efe6_1px,transparent_1px)] [background-size:72px_72px]" />
        <div aria-hidden className="animate-mesh absolute -top-40 -left-32 size-[34rem] rounded-full bg-brass/25 blur-[110px]" />
        <div aria-hidden className="animate-mesh absolute -right-40 -bottom-40 size-[30rem] rounded-full bg-[#2c4a7a]/50 blur-[120px] [animation-delay:-6s]" />

        <div className="relative flex items-center gap-3">
          <DeltaMark className="h-8 text-paper" />
          <span className="display text-2xl">Delta</span>
          <span className="eyebrow ml-2 rounded-full border border-white/15 px-2.5 py-1.5 text-[0.55rem] text-paper/60">Admin studio</span>
        </div>

        <div className="relative my-auto max-w-xl">
          <motion.div initial={{ opacity: 0, scale: 0.9, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 1.2, ease }}>
            <DeltaMark className="mb-12 h-24 text-brass-light" strokeWidth={1} />
          </motion.div>
          <motion.blockquote
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15, ease }}
            className="display text-[3.4rem] leading-[1.02] xl:text-[4.2rem]"
          >
            The quiet work behind <em className="text-brass-light">world-class</em> learning.
          </motion.blockquote>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.4 }} className="mt-6 max-w-md text-paper/55">
            Courses, orders, learner conversations and every image on the site — all in one place.
          </motion.p>
        </div>

        <div className="eyebrow relative flex justify-between text-paper/35">
          <span>Delta Markets Academy</span>
          <span>Est. 2026</span>
        </div>
      </section>

      {/* Form */}
      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink/55 transition-colors hover:text-ink">
            <ArrowLeft className="size-4" /> Back to website
          </Link>
          <DeltaMark className="h-7 text-ink lg:hidden" />
        </div>

        <div className="mx-auto my-auto w-full max-w-[400px] py-12">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
            <p className="eyebrow mb-4 flex items-center gap-2 text-brass">
              <span className="h-px w-6 bg-brass/60" /> {eyebrow}
            </p>
            <h1 className="display text-5xl">{title}</h1>
            <div className="mt-3 text-ink/60">{intro}</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease }}>
            {children}
          </motion.div>
        </div>

        <p className="eyebrow text-center text-ink/30">Protected area · Authorised staff only</p>
      </section>
    </div>
  );
}
