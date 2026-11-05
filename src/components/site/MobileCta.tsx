"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { cart, useCart } from "@/components/site/cart/store";

const inView = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
};

/**
 * Thumb-zone CTA for phones. Empty cart → "Explore courses" (hidden while the catalogue is on screen).
 * Items in cart → "View cart", which opens the drawer. Always hides near the counsellor form.
 */
export function MobileCta({ label, href = "#courses" }: { label: string; href?: string }) {
  const { scrollY } = useScroll();
  const { items } = useCart();
  const [pos, setPos] = useState({ pastHero: false, nearForm: false, inCatalog: false });

  useMotionValueEvent(scrollY, "change", (y) => {
    setPos({ pastHero: y > window.innerHeight * 0.9, nearForm: inView("enquire"), inCatalog: inView("courses") });
  });

  const hasItems = items.length > 0;
  const show = pos.pastHero && !pos.nearForm && (hasItems || !pos.inCatalog);

  const inner = (
    <>
      <span className="flex items-center gap-2 text-sm font-medium">
        {hasItems ? <ShoppingBag className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-ink" />}
        {hasItems ? `View cart · ${items.length} item${items.length === 1 ? "" : "s"}` : label}
      </span>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-brass-light">
        <ArrowRight className="h-4 w-4" />
      </span>
    </>
  );
  const cls = "flex h-14 w-full items-center justify-between rounded-full bg-brass-light pl-6 pr-2 font-semibold text-ink shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)] ring-1 ring-black/10";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-3 bottom-3 z-40 sm:hidden"
        >
          {hasItems ? (
            <button type="button" onClick={() => cart.open()} className={cls}>
              {inner}
            </button>
          ) : (
            <a href={href} className={cls}>
              {inner}
            </a>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
