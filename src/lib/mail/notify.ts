import "server-only";
import { DEFAULT_CURRENCY } from "@/lib/commerce";
import { mutateDb } from "@/lib/db";
import type { MailEvent, MailSettings, Order } from "@/lib/types";
import { deliver, mailContext } from "./send";
import { isMailConfigured } from "./shared";
import * as T from "./templates";

/**
 * Notification triggers. Called from route handlers inside `after()` — the HTTP response is
 * already on its way, so a slow or broken SMTP server never delays or breaks checkout.
 * Every function here swallows its own errors.
 *
 * Exactly-once for orders: the checkout callback AND the Razorpay webhook both report "paid",
 * often within milliseconds. Before sending, each trigger claims the notification on the order
 * (`order.notified.receipt = "pending:<iso>"`) inside the serialised mutateDb queue; only the
 * winner sends. Success stores the sent time; failure releases the claim so a later trigger can
 * retry. A claim left behind by a crashed process expires after STALE_CLAIM_MS.
 */

type NotifyKey = keyof NonNullable<Order["notified"]>;
const STALE_CLAIM_MS = 10 * 60_000;

const KEY_EVENT: Record<NotifyKey, MailEvent> = { receipt: "order_learner", staff: "order_staff", refund: "refund_learner" };

function active(settings: MailSettings, event: MailEvent) {
  return settings.enabled && isMailConfigured(settings) && settings.events[event];
}

async function safely(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error(`[mail] ${label} notification failed`, err);
  }
}

/* ───────────────────────── enquiries ───────────────────────── */

export function notifyEnquiry(enquiryId: string) {
  return safely("enquiry", async () => {
    const { db, settings } = await mailContext();
    if (!settings.enabled) return;
    const enquiry = db.enquiries.find((e) => e.id === enquiryId);
    if (!enquiry) return;
    await Promise.all([
      deliver({ event: "enquiry_staff", to: settings.staffRecipients, message: T.enquiryStaff(enquiry, db.settings), replyTo: enquiry.email, ref: enquiry.id }, { settings }),
      deliver({ event: "enquiry_learner", to: enquiry.email, message: T.enquiryLearner(enquiry, db.settings), ref: enquiry.id }, { settings }),
    ]);
  });
}

/* ───────────────────────── orders ───────────────────────── */

async function claim(orderId: string, keys: NotifyKey[], valid: (o: Order) => boolean) {
  return mutateDb((db) => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order || !valid(order)) return null;
    const now = Date.now();
    const claimed = keys.filter((k) => {
      const v = order.notified?.[k];
      return !v || (v.startsWith("pending:") && now - Date.parse(v.slice(8)) > STALE_CLAIM_MS);
    });
    if (!claimed.length) return null;
    order.notified = { ...order.notified };
    for (const k of claimed) order.notified[k] = `pending:${new Date(now).toISOString()}`;
    return { order: structuredClone(order) as Order, claimed };
  });
}

async function settle(orderId: string, outcomes: Partial<Record<NotifyKey, boolean>>) {
  await mutateDb((db) => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) return;
    order.notified = { ...order.notified };
    for (const [k, ok] of Object.entries(outcomes) as [NotifyKey, boolean][]) {
      if (ok) order.notified[k] = new Date().toISOString();
      else delete order.notified[k];
    }
  });
}

async function sendForOrder(orderId: string, keys: NotifyKey[], valid: (o: Order) => boolean) {
  const { db, settings } = await mailContext();
  const wanted = keys.filter((k) => active(settings, KEY_EVENT[k]));
  if (!wanted.length) return;

  const won = await claim(orderId, wanted, valid);
  if (!won) return; // already sent, or another request is sending it right now

  const { order } = won;
  const currency = db.settings.currency ?? DEFAULT_CURRENCY;
  const outcomes: Partial<Record<NotifyKey, boolean>> = {};
  await Promise.all(
    won.claimed.map(async (k) => {
      const r =
        k === "receipt"
          ? await deliver({ event: "order_learner", to: order.customer.email, message: T.orderLearner(order, db.settings, currency), ref: order.number }, { settings })
          : k === "staff"
            ? await deliver({ event: "order_staff", to: settings.staffRecipients, message: T.orderStaff(order, db.settings, currency), replyTo: order.customer.email, ref: order.number }, { settings })
            : await deliver({ event: "refund_learner", to: order.customer.email, message: T.refundLearner(order, db.settings, currency), ref: order.number }, { settings });
      // "skipped" (e.g. no staff recipients yet) counts as handled — it's logged, not retried forever.
      outcomes[k] = r.status !== "failed";
    }),
  );
  await settle(orderId, outcomes);
}

/** Receipt to the learner + alert to staff, once per order, when it becomes paid. */
export function notifyOrderPaid(orderId: string | undefined) {
  if (!orderId) return Promise.resolve();
  return safely("order", () => sendForOrder(orderId, ["receipt", "staff"], (o) => o.status === "paid"));
}

/** Refund confirmation to the learner, once per order. */
export function notifyRefund(orderId: string | undefined) {
  if (!orderId) return Promise.resolve();
  return safely("refund", () => sendForOrder(orderId, ["refund"], (o) => o.status === "refunded"));
}

