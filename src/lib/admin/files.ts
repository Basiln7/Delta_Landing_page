import type { MediaType } from "@/lib/types";

/** Upload allow-list: MIME → extension. */
export const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

export const EXT_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_MIME).map(([mime, ext]) => [ext, mime]),
);
EXT_MIME.jpeg = "image/jpeg";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ACCEPT_ATTR = Object.keys(ALLOWED_MIME).join(",");

export function mediaTypeFromMime(mime: string): MediaType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/** "campus_library-01.JPG" → "Campus library 01" */
export function humanizeFilename(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return "Untitled";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Smaller Unsplash rendition for thumbnails; uploads are returned unchanged. */
export function thumbUrl(url: string, width = 640) {
  if (url.includes("images.unsplash.com")) return url.replace(/([?&])w=\d+/, `$1w=${width}`);
  return url;
}
