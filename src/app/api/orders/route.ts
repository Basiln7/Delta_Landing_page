import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mutateDb } from "@/lib/db";
import { notifyOrderPaid } from "@/lib/mail/notify";
import { checkoutSchema } from "@/lib/validators";
import { EMI_MIN_TOTAL } from "@/lib/commerce";
import { CheckoutError, markOrderFailed, nextOrderNumber, priceCart, publicOrder } from "@/lib/orders";
import { describeRazorpayError, razorpay, razorpayConfig, toSubunits } from "@/lib/payments/razorpay";
import { uid } from "@/lib/utils";
import type { Order } from "@/lib/types";

/**
 * Step 1 of checkout — create the order.
 *
 * Razorpay configured (RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET):
 *   price the cart on the server → save a PENDING order → create a Razorpay Order for the exact amount
 *   → return what Checkout needs (key id, razorpay order id, amount in sub-units). Nothing is "paid" here.
 * Not configured: demo mode — the order is saved as paid immediately (no money moves).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  }
  const input = parsed.data;
  const rzp = razorpayConfig();

  // 1) Price + persist the order (pending for Razorpay, paid for demo).
  let order: Order;
  try {
    order = await mutateDb((db) => {
      const priced = priceCart(db, input);
      if (input.paymentMethod === "emi" && priced.total < EMI_MIN_TOTAL) {
        throw new CheckoutError("No-cost EMI is available on orders above the minimum amount.");
      }
      const now = new Date().toISOString();
      const created: Order = {
        id: uid("or"),
        number: nextOrderNumber(db),
        customer: input.customer,
        items: priced.items,
        subtotal: priced.subtotal,
        discount: priced.discount,
        total: priced.total,
        coupon: priced.coupon ?? undefined,
        currency: db.settings.currency?.code ?? "INR",
        paymentMethod: input.paymentMethod,
        status: rzp.enabled ? "pending" : "paid",
        gateway: rzp.enabled ? "razorpay" : "demo",
        createdAt: now,
        updatedAt: now,
        paidAt: rzp.enabled ? undefined : now,
      };
      db.orders.unshift(created);
      return created;
    });
  } catch (err) {
    const message = err instanceof CheckoutError ? err.message : "Could not create your order.";
    return NextResponse.json({ error: message }, { status: err instanceof CheckoutError ? 409 : 500 });
  }

  revalidatePath("/admin", "layout");

  if (!rzp.enabled) {
    after(() => notifyOrderPaid(order.id)); // demo orders are paid on creation
    return NextResponse.json({ ok: true, mode: "demo", order: publicOrder(order) }, { status: 201 });
  }

  // 2) Create the Razorpay Order (outside the DB write lock — it's a network call).
  try {
    const rOrder = await razorpay().orders.create({
      amount: toSubunits(order.total, order.currency),
      currency: order.currency,
      receipt: order.number, // ≤ 40 chars
      notes: { delta_order_id: order.id, delta_order_number: order.number, email: order.customer.email },
    });

    await mutateDb((db) => {
      const o = db.orders.find((x) => x.id === order.id);
      if (o) {
        o.gatewayOrderId = rOrder.id;
        o.updatedAt = new Date().toISOString();
      }
    });

    return NextResponse.json(
      {
        ok: true,
        mode: "razorpay",
        order: publicOrder(order),
        razorpay: {
          keyId: rzp.keyId, // public by design
          orderId: rOrder.id,
          amount: rOrder.amount,
          currency: rOrder.currency,
          testMode: rzp.mode === "test",
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const info = describeRazorpayError(err);
    await mutateDb((db) => {
      const o = db.orders.find((x) => x.id === order.id);
      if (o) markOrderFailed(o, `Gateway order creation failed: ${info.message}`);
    });
    console.error("[razorpay] order create failed", info.code, info.message);
    return NextResponse.json(
      { error: "We couldn't start the payment. Please try again in a moment.", code: info.code },
      { status: 502 },
    );
  }
}
