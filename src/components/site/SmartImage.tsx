"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { DeltaMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

/**
 * next/image with a designed fallback: if a remote/uploaded image fails (offline, deleted, 404),
 * the slot shows a branded pattern instead of a broken icon. Uploaded files skip the optimizer.
 */
export function SmartImage({ className, alt, src, ...props }: ImageProps) {
  const [failed, setFailed] = useState(false);
  const isUpload = typeof src === "string" && src.startsWith("/uploads/");

  if (failed || !src) {
    return (
      <div role="img" aria-label={alt} className={cn("media-fallback flex items-center justify-center", props.fill && "absolute inset-0", className)}>
        <DeltaMark className="h-10 text-ink/25" />
      </div>
    );
  }

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized={isUpload || props.unoptimized}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
