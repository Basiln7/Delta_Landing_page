import "server-only";

/**
 * Upload content checks. The browser-declared MIME type is just a claim; these check the file's
 * actual leading bytes ("magic numbers") so an HTML/JS file can't be stored as "photo.png".
 */

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString("latin1");

/** ISO-BMFF ("ftyp" box) — MP4 and AVIF share the container; the brand tells them apart. */
function ftypBrands(buf: Buffer) {
  if (ascii(buf, 4, 8) !== "ftyp") return null;
  const size = Math.min(buf.readUInt32BE(0) || 32, 64, buf.length);
  const brands: string[] = [ascii(buf, 8, 12)];
  for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(buf, i, i + 4));
  return brands;
}

const SVG_DANGER = /<script|<foreignobject|<iframe|<embed|<object|\bon[a-z]+\s*=|javascript:|data:text\/html/i;

export function checkFileSignature(mime: string, buf: Buffer): { ok: true } | { ok: false; reason: string } {
  const bad = (reason = "The file's contents don't match its type.") => ({ ok: false as const, reason });
  if (buf.length < 4) return bad("The file is empty or too small.");

  switch (mime) {
    case "image/jpeg":
      return startsWith(buf, [0xff, 0xd8, 0xff]) ? { ok: true } : bad();
    case "image/png":
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? { ok: true } : bad();
    case "image/gif":
      return /^GIF8[79]a$/.test(ascii(buf, 0, 6)) ? { ok: true } : bad();
    case "image/webp":
      return ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP" ? { ok: true } : bad();
    case "image/avif": {
      const brands = ftypBrands(buf);
      return brands?.some((b) => b === "avif" || b === "avis") ? { ok: true } : bad();
    }
    case "video/mp4": {
      const brands = ftypBrands(buf);
      return brands && !brands.includes("avif") ? { ok: true } : bad();
    }
    case "video/webm":
      return startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3]) ? { ok: true } : bad();
    case "application/pdf":
      return ascii(buf, 0, 5) === "%PDF-" ? { ok: true } : bad();
    case "image/svg+xml": {
      const text = buf.toString("utf8");
      const head = text.replace(/^﻿/, "").trimStart().slice(0, 2048).toLowerCase();
      if (!(head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!--") || head.startsWith("<!doctype svg"))) return bad();
      if (!/<svg[\s>]/i.test(text)) return bad();
      if (SVG_DANGER.test(text)) return bad("SVGs with scripts, event handlers or embedded pages aren't allowed.");
      return { ok: true };
    }
    default:
      return bad("Unsupported file type.");
  }
}
