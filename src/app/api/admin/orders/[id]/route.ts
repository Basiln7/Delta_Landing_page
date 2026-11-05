import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";
import { notifyOrderPaid, notifyRefund } from "@/lib/mail/notify";
import { fieldErrors, orderUpdateSchema } from "@/lib/admin/schemas";
import { describeRazorpayError, razorpay, razorpayConfig, toSubunits } from "@/lib/payments/razorpay";
import type { OrderStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Update an order's status. Amounts and items are immutable.
 * - Demo orders: status is set directly.
 * - Razorpay orders: status is owned by the gateway. The only manual action is "refunded",
 *   which issues a real full refund through the Razorpay Refunds API (POST /payments/:id/refund).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const parsed = orderUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }
  const status = parsed.data.status as OrderStatus;

  const current = (await readDb()).orders.find((o) => o.id === id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (current.gateway === "razorpay") {
    if (status !== "refunded") {
      return NextResponse.json({ error: "This order's status is managed by Razorpay. You can only refund it." }, { status: 409 });
    }
    if (current.status === "refunded") return NextResponse.json({ item: current });
    if (current.status !== "paid" || !current.gatewayPaymentId) {
      return NextResponse.json({ error: "Only captured Razorpay payments can be refunded." }, { status: 409 });
    }
    if (!razorpayConfig().enabled) {
      return NextResponse.json({ error: "Razorpay keys are not configured on this server." }, { status: 503 });
    }

    try {
      const refund = await razorpay().payments.refund(current.gatewayPaymentId, {
        amount: toSubunits(current.total, current.currency),
        speed: "normal",
        receipt: `refund_${current.number}`,
        notes: { delta_order_number: current.number, reason: "Refund issued from Delta admin" },
      });
      const item = await mutateDb((db) => {
        const o = db.orders.find((x) => x.id === id);
        if (!o) return null;
        o.status = "refunded";
        o.refundId = refund.id;
        o.refundStatus = refund.status as "pending" | "processed" | "failed";
        o.updatedAt = new Date().toISOString();
        return o;
      });
      revalidatePath("/admin", "layout");
      after(() => notifyRefund(id));
      return NextResponse.json({ item });
    } catch (err) {
      const info = describeRazorpayError(err);
      console.error("[razorpay] refund failed", current.number, info.code, info.message);
      return NextResponse.json({ error: `Razorpay refused the refund: ${info.message}` }, { status: 502 });
    }
  }

  const item = await mutateDb((db) => {
    const found = db.orders.find((o) => o.id === id);
    if (!found) return null;
    found.status = status;
    found.updatedAt = new Date().toISOString();
    return found;
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath("/admin", "layout");
  // Demo orders: marking paid sends the receipt (once); marking refunded tells the learner (once).
  if (item.status === "paid" && current.status !== "paid") after(() => notifyOrderPaid(id));
  if (item.status === "refunded" && current.status !== "refunded") after(() => notifyRefund(id));
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const result = await mutateDb((db) => {
    const found = db.orders.find((o) => o.id === id);
    if (!found) return "missing" as const;
    // Keep an audit trail for real money: paid/refunded gateway orders can't be deleted.
    if (found.gateway === "razorpay" && (found.status === "paid" || found.status === "refunded")) return "locked" as const;
    db.orders = db.orders.filter((o) => o.id !== id);
    return "deleted" as const;
  });
  if (result === "missing") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result === "locked") return NextResponse.json({ error: "Paid Razorpay orders are kept for your records and can't be deleted." }, { status: 409 });

  revalidatePath("/admin", "layout");
  return NextResponse.json({ ok: true });
}
