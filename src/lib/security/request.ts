import "server-only";
import { NextResponse } from "next/server";

/**
 * Best-effort client IP for rate limiting.
 *
 * Route handlers don't see the socket address, so this relies on the reverse proxy in front of the
 * app (Vercel, Cloudflare, Nginx…) setting X-Real-IP / X-Forwarded-For. Those platforms overwrite
 * the headers, so clients can't spoof them there. Running Node directly on the internet without a
 * proxy is not supported (README → Security).
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0] ??
    "";
  return ip.trim().slice(0, 64) || "local";
}

type JsonResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Read a JSON body with a hard size cap. The body is streamed and the read is abandoned once it
 * exceeds `maxBytes`, so a huge request can't exhaust memory.
 */
export async function readJson<T = unknown>(req: Request, maxBytes: number): Promise<JsonResult<T>> {
  const tooLarge = () => ({ ok: false as const, response: NextResponse.json({ error: "Request body too large" }, { status: 413 }) });
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();

  const reader = req.body?.getReader();
  if (!reader) return { ok: false, response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return tooLarge();
    }
    chunks.push(value);
  }
  try {
    return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
}

export function tooManyRequests(retryAfter: number, message = "Too many requests. Please wait a moment and try again.") {
  return NextResponse.json({ error: message, retryAfter }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
}
