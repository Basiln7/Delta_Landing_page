import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mutateDb } from "@/lib/db";
import { notifyOrderPaid, notifyRefund } from "@/lib/mail/notify";
import { markOrderFailed, markOrderPaid } from "@/lib/orders";
import { razorpayConfig, toSubunits, verifyWebhookSignature } from "@/lib/payments/razorpay";
import type { Database, Order } from "@/lib/types";

/**
 * Razorpay webhook receiver — the source of truth for payment state (the browser can close mid-payment).
 * Subscribe in Dashboard → Settings → Webhooks to: order.paid, payment.captured, payment.failed,
 * refund.processed, refund.failed.  URL: https://<your-domain>/api/webhooks/razorpay
 *
 * Per the docs: verify X-Razorpay-Signature against the RAW body, de-duplicate on x-razorpay-event-id,
 * tolerate out-of-order delivery, and answer 2xx within 5 seconds.
 */

type PaymentEntity = {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  error_code?: string;
  error_description?: string;
  error_reason?: string;
  created_at?: number;
};
type RefundEntity = { id: string; payment_id: string; amount: number; status: "pending" | "processed" | "failed" };
type WebhookEvent = {
  event: string;
  created_at?: number;
  payload: {
    payment?: { entity: PaymentEntity };
    order?: { entity: { id: string; receipt?: string; status: string } };
    refund?: { entity: RefundEntity };
  };
};

const MAX_EVENTS = 500;

export async function POST(req: Request) {
  if (!razorpayConfig().webhooksEnabled) {
    return NextResponse.json({ error: "Webhooks not configured" }, { status: 503 });
  }

  // Raw body FIRST — never parse before verifying.
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    console.warn("[razorpay:webhook] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = req.headers.get("x-razorpay-event-id") ?? `${event.event}:${event.payload.payment?.entity.id ?? event.payload.refund?.entity.id ?? raw.length}`;

  const { result, orderId } = await mutateDb((db): Applied => {
    db.processedEvents ??= [];
    if (db.processedEvents.some((e) => e.id === eventId)) return { result: "duplicate" };

    const outcome = apply(db, event);
    db.processedEvents.unshift({ id: eventId, event: event.event, receivedAt: new Date().toISOString() });
    db.processedEvents.length = Math.min(db.processedEvents.length, MAX_EVENTS);
    return outcome;
  });

  if (result !== "duplicate" && result !== "ignored") revalidatePath("/admin", "layout");
  // Emails go out after we've answered Razorpay (it expects a 2xx within 5 s). Both are exactly-once per order.
  if (result === "paid") after(() => notifyOrderPaid(orderId));
  if (result === "refund-processed") after(() => notifyRefund(orderId));
  return NextResponse.json({ ok: true, result });
}

type Applied = { result: string; orderId?: string };

function findByGatewayOrder(db: Database, gatewayOrderId?: string) {
  return gatewayOrderId ? db.orders.find((o) => o.gateway === "razorpay" && o.gatewayOrderId === gatewayOrderId) : undefined;
}

function amountMatches(order: Order, payment: PaymentEntity) {
  return payment.currency === order.currency && Number(payment.amount) === toSubunits(order.total, order.currency);
}

function apply(db: Database, event: WebhookEvent): Applied {
  const payment = event.payload.payment?.entity;

  switch (event.event) {
    case "order.paid":
    case "payment.captured": {
      if (!payment) return { result: "ignored" };
      const order = findByGatewayOrder(db, payment.order_id ?? event.payload.order?.entity.id);
      if (!order) return { result: "unknown-order" };
      if (!amountMatches(order, payment)) {
        console.error("[razorpay:webhook] amount mismatch", { order: order.number, payment: payment.id });
        order.failureReason = `Amount mismatch on ${payment.id} — review in Razorpay dashboard`;
        return { result: "amount-mismatch", orderId: order.id };
      }
      markOrderPaid(order, {
        paymentId: payment.id,
        method: payment.method,
        at: payment.created_at ? new Date(payment.created_at * 1000).toISOString() : undefined,
      });
      return { result: order.status === "paid" ? "paid" : "ignored", orderId: order.id };
    }

    case "payment.failed": {
      if (!payment) return { result: "ignored" };
      const order = findByGatewayOrder(db, payment.order_id);
      if (!order) return { result: "unknown-order" };
      const reason = [payment.error_description, payment.error_reason && `(${payment.error_reason})`].filter(Boolean).join(" ");
      markOrderFailed(order, reason || "Payment failed");
      return { result: "failed", orderId: order.id };
    }

    case "refund.processed":
    case "refund.failed":
    case "refund.created": {
      const refund = event.payload.refund?.entity;
      if (!refund) return { result: "ignored" };
      const order = db.orders.find((o) => o.gatewayPaymentId === refund.payment_id);
      if (!order) return { result: "unknown-order" };
      order.refundId = refund.id;
      order.refundStatus = refund.status;
      if (refund.status === "processed") order.status = "refunded";
      if (refund.status === "failed") order.failureReason = `Refund ${refund.id} failed — retry from the Razorpay dashboard`;
      order.updatedAt = new Date().toISOString();
      return { result: `refund-${refund.status}`, orderId: order.id };
    }

    default:
      return { result: "ignored" };
  }
}
