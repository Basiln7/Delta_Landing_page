import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { consume, LIMITS } from "@/lib/security/rate-limit";
import { clientIp, readJson, tooManyRequests } from "@/lib/security/request";
import { mutateDb } from "@/lib/db";

const schema = z.object({
  orderId: z.string().min(1).max(60),
  razorpay_order_id: z.string().max(60).optional(),
  code: z.string().max(80).optional(),
  description: z.string().max(300).optional(),
  reason: z.string().max(120).optional(),
});

/**
 * Records a failed attempt reported by Checkout's `payment.failed` event so the admin can see why.
 * This is informational only: the order stays PENDING (Checkout lets the learner retry on the same
 * Razorpay order). Authoritative status changes come from signature verification and webhooks.
 */
export async function POST(req: Request) {
  const limit = await consume(LIMITS.paymentCallbackIp(clientIp(req)));
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  const body = await readJson(req, 8 * 1024);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { orderId, razorpay_order_id, code, description, reason } = parsed.data;

  const ok = await mutateDb((db) => {
    const o = db.orders.find((x) => x.id === orderId);
    if (!o || o.gateway !== "razorpay" || o.status !== "pending") return false;
    if (razorpay_order_id && o.gatewayOrderId !== razorpay_order_id) return false;
    o.failureReason = [description, reason && `(${reason})`, code && `[${code}]`].filter(Boolean).join(" ").slice(0, 300) || "Payment attempt failed";
    o.updatedAt = new Date().toISOString();
    return true;
  });
  if (ok) revalidatePath("/admin", "layout");
  return NextResponse.json({ ok });
}
