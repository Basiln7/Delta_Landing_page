"use client";

import type { MediaCollection, MediaItem } from "@/lib/types";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES } from "@/lib/admin/files";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

/** JSON fetch helper for the admin API. Throws ApiError with server message + field errors. */
export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") {
    // Session expired mid-use: hard navigation so the server layout re-checks auth.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/admin/login";
  }
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.fields);
  return data as T;
}

/** Measure image/video dimensions in the browser before upload. */
export function measureMedia(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (width?: number, height?: number) => {
      URL.revokeObjectURL(url);
      resolve({ width: width || undefined, height: height || undefined });
    };
    const timer = window.setTimeout(() => done(), 4000);
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => {
        window.clearTimeout(timer);
        done(img.naturalWidth, img.naturalHeight);
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        done();
      };
      img.src = url;
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        done(video.videoWidth, video.videoHeight);
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        done();
      };
      video.src = url;
    } else {
      window.clearTimeout(timer);
      done();
    }
  });
}

export function validateFile(file: File): string | null {
  if (!ALLOWED_MIME[file.type]) return `Unsupported type${file.type ? ` (${file.type})` : ""}`;
  if (file.size > MAX_UPLOAD_BYTES) return "Larger than 25 MB";
  return null;
}

/** Upload one file with progress via XHR (fetch has no upload progress). */
export async function uploadWithProgress(
  file: File,
  collection: MediaCollection,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<MediaItem> {
  const dims = await measureMedia(file);
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("files", file);
    form.append("collection", collection);
    if (dims.width) form.append("width_0", String(dims.width));
    if (dims.height) form.append("height_0", String(dims.height));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response as { items?: MediaItem[]; error?: string } | null;
      if (xhr.status === 201 && body?.items?.[0]) resolve(body.items[0]);
      else reject(new Error(body?.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new Error("Cancelled"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(form);
  });
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
