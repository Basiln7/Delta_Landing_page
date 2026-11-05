"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { DeltaMark } from "@/components/brand/Logo";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { usePageReady } from "@/lib/hooks";
import { whatsappHref } from "@/lib/utils";

const TEASER_KEY = "delta:wa-teaser-dismissed";
const TEASER_DELAY = 9000;

/**
 * Floating "Chat with us" launcher → opens a WhatsApp chat with admissions (wa.me deep link).
 * A one-time greeting bubble invites the conversation; dismissal is remembered for the session.
 * Sits above the mobile "Book a tour" bar on phones.
 */
export function WhatsAppChat({ number, message, schoolName }: { number?: string; message?: string; schoolName: string }) {
  const href = whatsappHref(number, message);
  const ready = usePageReady();
  const [teaser, setTeaser] = useState(false);

  useEffect(() => {
    if (!href || !ready) return;
    let dismissed = false;
    try {
      dismissed = Boolean(sessionStorage.getItem(TEASER_KEY));
    } catch {}
    if (dismissed) return;
    const t = setTimeout(() => setTeaser(true), TEASER_DELAY);
    return () => clearTimeout(t);
  }, [href, ready]);

  const dismiss = () => {
    setTeaser(false);
    try {
      sessionStorage.setItem(TEASER_KEY, "1");
    } catch {}
  };

  if (!href) return null;

  return (
    <div className="pointer-events-none fixed bottom-[5.25rem] right-3 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {teaser && (
          <motion.div
            role="dialog"
            aria-label="Chat with admissions on WhatsApp"
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "bottom right" }}
            className="pointer-events-auto relative w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-[20px] border border-edge bg-night-2 text-white shadow-[0_30px_80px_-25px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center gap-3 border-b border-edge bg-night-3 px-4 py-3.5 text-white">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-night">
                <DeltaMark className="h-5 text-white" />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-night-3 bg-[#25D366]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{schoolName} mentors</span>
                <span className="block text-xs text-mute">Replies in minutes · English & Malayalam</span>
              </span>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss chat invitation"
                className="flex h-8 w-8 items-center justify-center rounded-full text-mute transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-4">
              <p className="w-fit max-w-[92%] rounded-2xl rounded-tl-sm border border-edge bg-night-3 px-4 py-3 text-sm leading-relaxed text-white/85">
                Hi there 👋 Questions about the stock market course, batches or fees? We&apos;re one message away.
              </p>
            </div>
            <div className="p-3">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={dismiss}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-semibold text-[#062e18] transition-colors hover:bg-[#1ebe5b]"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Start a WhatsApp chat
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
        aria-label={`Chat with us on WhatsApp (${number})`}
        initial={{ opacity: 0, y: 24, scale: 0.8 }}
        animate={ready ? { opacity: 1, y: 0, scale: 1 } : undefined}
        transition={{ duration: 0.7, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.96 }}
        className="group pointer-events-auto relative flex h-14 items-center gap-3 rounded-full border border-edge bg-night-3 p-1.5 text-white shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] sm:pr-5"
      >
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white">
                    <WhatsAppIcon className="relative h-[1.35rem] w-[1.35rem]" />
        </span>
        <span className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-semibold">Chat with us</span>
          <span className="text-[0.7rem] text-mute">on WhatsApp</span>
        </span>
        <ArrowUpRight className="hidden h-4 w-4 text-mute transition-colors duration-300 group-hover:text-brass-light sm:block" />
      </motion.a>
    </div>
  );
}
