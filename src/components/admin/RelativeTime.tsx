"use client";

import { formatDate, relativeTime } from "@/lib/utils";

/** Relative timestamp ("3 days ago") with the absolute date as a tooltip. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={formatDate(iso, { dateStyle: "medium", timeStyle: "short" })} className={className} suppressHydrationWarning>
      {relativeTime(iso)}
    </time>
  );
}
