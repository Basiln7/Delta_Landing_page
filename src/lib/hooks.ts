"use client";

import { useSyncExternalStore } from "react";

/** SSR-safe media query hook (false on the server). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ───── Page-ready signal (flips when the preloader finishes, or immediately if skipped) ───── */
declare global {
  interface Window {
    __deltaReady?: boolean;
  }
}

export const READY_EVENT = "delta:ready";

export function markPageReady() {
  window.__deltaReady = true;
  window.dispatchEvent(new Event(READY_EVENT));
}

export function usePageReady() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(READY_EVENT, cb);
      return () => window.removeEventListener(READY_EVENT, cb);
    },
    () => Boolean(window.__deltaReady),
    () => false,
  );
}
