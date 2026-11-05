import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";

/** Resolve a path inside UPLOAD_DIR, or null if it would escape it. */
export function resolveUploadPath(...parts: string[]) {
  const root = path.resolve(UPLOAD_DIR);
  const target = path.resolve(root, ...parts);
  return target.startsWith(root + path.sep) ? target : null;
}

/** Delete the file behind a `/uploads/<name>` URL. Missing files are ignored. */
export async function removeUploadedFile(url: string) {
  if (!url.startsWith("/uploads/")) return;
  const target = resolveUploadPath(decodeURIComponent(url.slice("/uploads/".length)));
  if (!target) return;
  await fs.unlink(target).catch(() => undefined);
}
