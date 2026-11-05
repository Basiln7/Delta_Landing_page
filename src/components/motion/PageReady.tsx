"use client";

import { useEffect } from "react";
import { markPageReady } from "@/lib/hooks";

/** Signals "page ready" for entrance choreography (used to wait for the old preloader). */
export function PageReady() {
  useEffect(() => {
    markPageReady();
  }, []);
  return null;
}
