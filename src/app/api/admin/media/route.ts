import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mutateDb, readDb, UPLOAD_DIR } from "@/lib/db";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, humanizeFilename, mediaTypeFromMime } from "@/lib/admin/files";
import { MEDIA_COLLECTIONS, type MediaCollection, type MediaItem } from "@/lib/types";
import { slugify, uid } from "@/lib/utils";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const db = await readDb();
  return NextResponse.json({ items: db.media });
}

/** Multipart upload: `files` (1..n), optional `collection`, optional `width_<i>` / `height_<i>`. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No files received" }, { status: 400 });

  const rawCollection = String(form.get("collection") ?? "general");
  const collection: MediaCollection = (MEDIA_COLLECTIONS as readonly string[]).includes(rawCollection)
    ? (rawCollection as MediaCollection)
    : "general";

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const created: MediaItem[] = [];
  const errors: { name: string; error: string }[] = [];

  for (const [i, file] of files.entries()) {
    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      errors.push({ name: file.name, error: `Unsupported file type (${file.type || "unknown"})` });
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push({ name: file.name, error: "File is larger than 25 MB" });
      continue;
    }

    const base = slugify(file.name.replace(/\.[^.]+$/, "")).replace(/\./g, "-").slice(0, 60) || "file";
    const filename = `${base}-${uid().slice(0, 8)}.${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));

    const width = Number(form.get(`width_${i}`)) || undefined;
    const height = Number(form.get(`height_${i}`)) || undefined;
    const now = new Date().toISOString();
    const title = humanizeFilename(file.name);

    created.push({
      id: uid("md"),
      title,
      alt: title,
      url: `/uploads/${filename}`,
      type: mediaTypeFromMime(file.type),
      mime: file.type,
      size: file.size,
      width,
      height,
      collection,
      tags: [],
      source: "upload",
      createdAt: now,
      updatedAt: now,
    });
  }

  if (created.length) {
    await mutateDb((db) => {
      db.media.unshift(...created);
    });
    revalidatePath("/");
  }

  return NextResponse.json(
    { items: created, errors, error: created.length ? undefined : (errors[0]?.error ?? "Upload failed") },
    { status: created.length ? 201 : 400 },
  );
}
