"use client";

import Lenis from "lenis";
import { useEffect } from "react";

let instance: Lenis | null = null;

/** Scroll to an anchor/element using Lenis when active, native smooth scroll otherwise. */
export function scrollToTarget(target: string | HTMLElement, offset = -72) {
  if (instance) {
    instance.scrollTo(target, { offset, duration: 1.4 });
    return;
  }
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (el instanceof HTMLElement) {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: "smooth" });
  }
}

/** Freeze page scrolling behind overlays (drawers, modals, menus). Ref-counted so overlays can stack. */
let locks = 0;
export function lockScroll(lock: boolean) {
  locks = Math.max(0, locks + (lock ? 1 : -1));
  const locked = locks > 0;
  document.documentElement.style.overflow = locked ? "hidden" : "";
  if (instance) {
    if (locked) instance.stop();
    else instance.start();
  }
}

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      autoRaf: true,
      anchors: { offset: -72 },
    });
    instance = lenis;
    return () => {
      lenis.destroy();
      instance = null;
    };
  }, []);
  return null;
}
