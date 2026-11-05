import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { consume, LIMITS } from "@/lib/security/rate-limit";
import { clientIp, readJson, tooManyRequests } from "@/lib/security/request";
import { mutateDb, readDb } from "@/lib/db";
import { notifyOrderPaid } from "@/lib/mail/notify";
import { markOrderPaid, publicOrder } from "@/lib/orders";
import { describeRazorpayError, razorpay, razorpayConfig, toSubunits, verifyPaymentSignature } from "@/lib/payments/razorpay";

const schema = z.object({
  orderId: z.string().min(1).max(60), // our order id
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

/**
 * Step 2 of checkout — called by the Checkout `handler` after a successful payment.
 *  1. Verify hmac_sha256(stored_order_id + "|" + payment_id, key_secret) — reject on mismatch.
 *  2. Confirm with the Payments API that the payment belongs to this order, for the exact amount,
 *     and is captured (capture it if the account isn't set to auto-capture).
 *  3. Mark the order paid (idempotent — the `order.paid` webhook may get there first).
 * If step 2 can't reach Razorpay, the signature alone proves authenticity: we record the payment
 * and let the webhook finalise it, so the learner is never told "failed" after paying.
 */
export async function POST(req: Request) {
  if (!razorpayConfig().enabled) return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });

  const limit = await consume(LIMITS.paymentCallbackIp(clientIp(req)));
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  const body = await readJson(req, 8 * 1024);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment response" }, { status: 400 });
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const db = await readDb();
  const order = db.orders.find((o) => o.id === orderId);
  if (!order || order.gateway !== "razorpay" || !order.gatewayOrderId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Use the order id WE stored, never the one echoed back by the browser.
  if (order.gatewayOrderId !== razorpay_order_id || !verifyPaymentSignature(order.gatewayOrderId, razorpay_payment_id, razorpay_signature)) {
    console.warn("[razorpay] signature verification failed", { order: order.number, payment: razorpay_payment_id });
    return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
  }

  if (order.status === "paid") {
    after(() => notifyOrderPaid(order.id)); // no-op if the webhook already sent it
    return NextResponse.json({ ok: true, status: "paid", order: publicOrder(order) });
  }

  const expectedAmount = toSubunits(order.total, order.currency);
  let confirmed = false;
  let method: string | undefined;

  try {
    let payment = await razorpay().payments.fetch(razorpay_payment_id);
    if (payment.order_id !== order.gatewayOrderId || Number(payment.amount) !== expectedAmount || payment.currency !== order.currency) {
      console.error("[razorpay] payment does not match order", { order: order.number, payment: razorpay_payment_id });
      return NextResponse.json({ error: "Payment does not match this order" }, { status: 409 });
    }
    if (payment.status === "authorized") {
      // Account not on auto-capture → capture now (uncaptured payments are auto-refunded by Razorpay).
      payment = await razorpay().payments.capture(razorpay_payment_id, expectedAmount, order.currency);
    }
    confirmed = payment.status === "captured";
    method = payment.method;
  } catch (err) {
    const info = describeRazorpayError(err);
    console.warn("[razorpay] could not confirm payment status, deferring to webhook", info.code, info.message);
  }

  const updated = await mutateDb((d) => {
    const o = d.orders.find((x) => x.id === orderId);
    if (!o) return null;
    if (confirmed) {
      markOrderPaid(o, { paymentId: razorpay_payment_id, method });
    } else {
      // Signature valid but capture not confirmed yet — keep pending, remember the payment.
      o.gatewayPaymentId ??= razorpay_payment_id;
      o.failureReason = undefined;
      o.updatedAt = new Date().toISOString();
    }
    return o;
  });
  revalidatePath("/admin", "layout");

  if (!updated) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  // Receipt + staff alert once per order — the webhook may race us; notifyOrderPaid claims it exactly once.
  if (updated.status === "paid") after(() => notifyOrderPaid(updated.id));
  return NextResponse.json({ ok: true, status: confirmed ? "paid" : "processing", order: publicOrder(updated) });
}
