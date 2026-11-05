import "server-only";
import { computeTotals, coursePrice, planPeriodLabel } from "@/lib/commerce";
import type { Database, Order, OrderItem } from "@/lib/types";
import type { CheckoutInput } from "@/lib/validators";

/** Price a cart against the live catalogue. The client only ever sends ids — prices come from here. */
export function priceCart(db: Database, input: Pick<CheckoutInput, "items" | "coupon">) {
  const wanted = input.items.filter((it, i, arr) => arr.findIndex((x) => x.kind === it.kind && x.id === it.id) === i);
  const items: OrderItem[] = wanted.map((it) => {
    if (it.kind === "course") {
      const c = db.courses.find((x) => x.id === it.id && x.published);
      if (!c) throw new CheckoutError(`A course in your cart is no longer available (${it.id}).`);
      return { kind: "course", id: c.id, title: c.title, price: coursePrice(c) };
    }
    const p = db.plans.find((x) => x.id === it.id);
    if (!p) throw new CheckoutError(`A plan in your cart is no longer available (${it.id}).`);
    const period = p.period === "one-time" ? "one-time" : `${planPeriodLabel(p.period).replace("/ ", "")}ly`;
    return { kind: "plan", id: p.id, title: `${p.name} (${period})`, price: p.price };
  });
  const totals = computeTotals(
    items.map((i) => i.price),
    input.coupon,
  );
  return { items, ...totals };
}

export function nextOrderNumber(db: Database) {
  const max = db.orders.reduce((m, o) => Math.max(m, Number(o.number.replace(/\D/g, "")) || 0), 10000);
  return `DLT-${max + 1}`;
}

/**
 * Idempotent transition to "paid" — safe to call from the checkout callback AND the webhook,
 * in any order, any number of times. A refunded order is never flipped back.
 */
export function markOrderPaid(order: Order, payment: { paymentId?: string; method?: string; at?: string }) {
  if (order.status === "refunded") return order;
  order.status = "paid";
  order.gatewayPaymentId ??= payment.paymentId;
  if (payment.method) order.gatewayMethod = payment.method;
  order.paidAt ??= payment.at ?? new Date().toISOString();
  order.failureReason = undefined;
  order.updatedAt = new Date().toISOString();
  return order;
}

/** A failed attempt never overrides a paid/refunded order (webhooks can arrive out of order). */
export function markOrderFailed(order: Order, reason: string) {
  if (order.status === "paid" || order.status === "refunded") return order;
  order.status = "failed";
  order.failureReason = reason.slice(0, 300);
  order.updatedAt = new Date().toISOString();
  return order;
}

export class CheckoutError extends Error {}

/** Public, non-sensitive view of an order for the storefront. */
export function publicOrder(o: Order) {
  return { id: o.id, number: o.number, total: o.total, currency: o.currency, status: o.status, email: o.customer.email, items: o.items };
}
