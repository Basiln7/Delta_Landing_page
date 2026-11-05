import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { EXT_MIME } from "@/lib/admin/files";
import { resolveUploadPath } from "@/lib/admin/storage";

type Ctx = { params: Promise<{ path: string[] }> };

const notFound = () => new Response("Not found", { status: 404 });

/** Streams uploaded media from storage/uploads with Range support (video scrubbing). */
export async function GET(req: Request, { params }: Ctx) {
  const { path: parts } = await params;
  let decoded: string[];
  try {
    decoded = parts.map((p) => decodeURIComponent(p));
  } catch {
    return notFound();
  }
  const target = resolveUploadPath(...decoded);
  if (!target) return notFound();

  const stat = await fs.stat(target).catch(() => null);
  if (!stat?.isFile()) return notFound();

  const ext = path.extname(target).slice(1).toLowerCase();
  const headers = new Headers({
    "Content-Type": EXT_MIME[ext] ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Last-Modified": stat.mtime.toUTCString(),
  });
  // SVGs can carry script — neuter them when opened directly.
  if (ext === "svg") headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");

  const range = req.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    let start = match[1] ? Number(match[1]) : stat.size - Number(match[2]);
    let end = match[1] && match[2] ? Number(match[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, stat.size - 1);
    if (start > end || start >= stat.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(target, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(stat.size));
  const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
}
