"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny external cart store (no provider needed):
 * items + coupon persist to localStorage; `open` is UI-only.
 * useSyncExternalStore keeps SSR (empty cart) and hydration consistent.
 */

export type CartItem = {
  kind: "course" | "plan";
  id: string;
  title: string;
  /** price to pay for this line (sale price for courses) */
  price: number;
  /** list price, for the strike-through */
  compareAt?: number;
  image?: string;
  subtitle?: string;
};

type State = { items: CartItem[]; coupon: string | null; open: boolean; view: "cart" | "checkout" | "success" };

const KEY = "delta:cart";
const SERVER: State = { items: [], coupon: null, open: false, view: "cart" };

let state: State = SERVER;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      state = { ...state, items: Array.isArray(saved.items) ? saved.items : [], coupon: saved.coupon ?? null };
    }
  } catch {}
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify({ items: state.items, coupon: state.coupon }));
  } catch {}
  listeners.forEach((l) => l());
}

export const cart = {
  add(item: CartItem, { open = true }: { open?: boolean } = {}) {
    hydrate();
    const exists = state.items.some((i) => i.kind === item.kind && i.id === item.id);
    // Only one plan at a time — a new plan replaces the old one.
    const items = exists
      ? state.items
      : [...(item.kind === "plan" ? state.items.filter((i) => i.kind !== "plan") : state.items), item];
    set({ items, open: open || state.open, view: open ? "cart" : state.view });
  },
  remove(id: string) {
    set({ items: state.items.filter((i) => i.id !== id) });
  },
  clear() {
    set({ items: [], coupon: null });
  },
  setCoupon(coupon: string | null) {
    set({ coupon });
  },
  open(view: State["view"] = "cart") {
    hydrate();
    set({ open: true, view });
  },
  close() {
    set({ open: false, view: state.view === "success" ? "cart" : state.view });
  },
  setView(view: State["view"]) {
    set({ view });
  },
};

export function useCart() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      hydrate();
      return state;
    },
    () => SERVER,
  );
}

/* ───── cross-section catalogue filter (hero search, learning paths → catalogue) ───── */
export const CATALOG_EVENT = "delta:catalog";
export type CatalogFilter = { category?: string; query?: string };

export function filterCatalog(detail: CatalogFilter) {
  window.dispatchEvent(new CustomEvent<CatalogFilter>(CATALOG_EVENT, { detail }));
}
