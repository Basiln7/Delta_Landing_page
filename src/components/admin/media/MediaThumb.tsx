"use client";
/* eslint-disable @next/next/no-img-element -- admin thumbnails come from arbitrary uploads/remote URLs */

import { useState } from "react";
import { FileText, ImageOff, Play } from "lucide-react";
import { thumbUrl } from "@/lib/admin/files";
import type { MediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MediaThumb({
  item,
  className,
  width = 640,
  controls = false,
}: {
  item: Pick<MediaItem, "url" | "type" | "alt" | "mime" | "title">;
  className?: string;
  width?: number;
  controls?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (item.type === "video") {
    return (
      <div className={cn("relative overflow-hidden bg-ink", className)}>
        <video
          src={item.url}
          muted
          playsInline
          preload="metadata"
          controls={controls}
          className="h-full w-full object-cover"
          aria-label={item.alt || item.title}
        />
        {!controls && (
          <span className="absolute bottom-2 left-2 grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
            <Play className="size-3.5 fill-current" />
          </span>
        )}
      </div>
    );
  }

  if (item.type === "document") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 bg-paper text-ink/50", className)}>
        <FileText className="size-8 text-brass" strokeWidth={1.3} />
        <span className="font-mono text-[0.625rem] tracking-widest uppercase">{item.mime.split("/")[1] ?? "file"}</span>
      </div>
    );
  }

  if (failed || !item.url) {
    return (
      <div className={cn("media-fallback flex items-center justify-center text-ink/40", className)}>
        <ImageOff className="size-6" strokeWidth={1.4} />
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden bg-paper-2", className)}>
      <img
        src={thumbUrl(item.url, width)}
        alt={item.alt || item.title}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
