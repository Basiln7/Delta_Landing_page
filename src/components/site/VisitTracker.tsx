"use client";

import { useEffect } from "react";

type PrivacyNavigator = Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null; webdriver?: boolean };

/**
 * Anonymous page-view ping for the admin's unique-visitor stats. Renders nothing, adds no styles
 * or globals, and never delays the page: it waits for the load event and an idle moment (or the
 * visitor leaving, whichever comes first), then sends one fire-and-forget request. The device id is a cookie the server sets (httpOnly), so nothing
 * here reads or stores identifiers.
 *
 * Skipped for: Global Privacy Control / Do Not Track, automated browsers, and prerendered pages
 * until they're actually shown.
 */
export function VisitTracker() {
  useEffect(() => {
    const nav = navigator as PrivacyNavigator;
    if (nav.globalPrivacyControl || nav.doNotTrack === "1" || nav.webdriver) return;

    let cancelled = false;
    let sent = false;
    let idleId: number | undefined;
    let timer: number | undefined;

    const send = () => {
      if (cancelled || sent) return;
      sent = true;
      const q = new URLSearchParams(window.location.search);
      const utm = { source: q.get("utm_source") ?? undefined, medium: q.get("utm_medium") ?? undefined, campaign: q.get("utm_campaign") ?? undefined };
      const body = JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || undefined,
        utm: utm.source || utm.medium || utm.campaign ? utm : undefined,
      });
      fetch("/api/track-visit", { method: "POST", body, keepalive: true, credentials: "same-origin", headers: { "content-type": "application/json" } }).catch(() => {
        /* analytics must never surface errors to visitors */
      });
    };

    const schedule = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === "function") idleId = window.requestIdleCallback(send, { timeout: 2000 });
      else timer = window.setTimeout(send, 1000);
    };
    // Someone who leaves before the idle moment still counts (keepalive lets the request outlive the page).
    window.addEventListener("pagehide", send);
    const afterLoad = () => {
      if (document.readyState === "complete") schedule();
      else window.addEventListener("load", schedule, { once: true });
    };

    const doc = document as Document & { prerendering?: boolean };
    if (doc.prerendering) document.addEventListener("prerenderingchange", afterLoad, { once: true });
    else afterLoad();

    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("load", schedule);
      window.removeEventListener("pagehide", send);
      document.removeEventListener("prerenderingchange", afterLoad);
    };
  }, []);

  return null;
}
