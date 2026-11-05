import { NextResponse } from "next/server";
import { getSession, requireSuperAdmin } from "@/lib/auth";
import { DEFAULT_CURRENCY } from "@/lib/commerce";
import { readDb } from "@/lib/db";
import * as T from "@/lib/mail/templates";
import { MAIL_EVENTS, type Enquiry, type Order } from "@/lib/types";

/** Render a template with sample data (never real learner data) so admins can see what goes out. */
export async function GET(req: Request) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const event = new URL(req.url).searchParams.get("event") ?? "";
  if (event !== "test" && !(MAIL_EVENTS as readonly string[]).includes(event)) {
    return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
  }

  const db = await readDb();
  const brand = db.settings;
  const currency = brand.currency ?? DEFAULT_CURRENCY;
  const now = new Date().toISOString();
  const course = db.courses.find((c) => c.id === brand.flagshipCourseId) ?? db.courses[0];

  const enquiry: Enquiry = {
    id: "en_sample",
    parentName: "Ananya Menon",
    email: "ananya@example.com",
    phone: "+91 98470 12345",
    studentAge: "Beginner",
    program: course?.title ?? "Flagship program",
    message: "I work full-time. Is there a weekend batch, and do I need a demat account before joining?",
    status: "new",
    notes: "",
    createdAt: now,
  };
  const order: Order = {
    id: "or_sample",
    number: "DLT-10042",
    customer: { name: "Ananya Menon", email: "ananya@example.com", phone: "+91 98470 12345" },
    items: [{ kind: "course", id: course?.id ?? "c_sample", title: course?.title ?? "Flagship program", price: course?.salePrice || course?.price || 24999 }],
    subtotal: course?.salePrice || course?.price || 24999,
    discount: 0,
    total: course?.salePrice || course?.price || 24999,
    currency: currency.code,
    paymentMethod: "upi",
    status: "paid",
    createdAt: now,
    gateway: "razorpay",
    gatewayPaymentId: "pay_SAMPLE123",
    gatewayMethod: "upi",
    refundId: "rfnd_SAMPLE456",
  };

  const session = await getSession();
  const rendered = {
    enquiry_staff: () => T.enquiryStaff(enquiry, brand),
    enquiry_learner: () => T.enquiryLearner(enquiry, brand),
    order_staff: () => T.orderStaff(order, brand, currency),
    order_learner: () => T.orderLearner(order, brand, currency),
    refund_learner: () => T.refundLearner(order, brand, currency),
    test: () => T.testEmail(brand, session?.email ?? "admin"),
  }[event as (typeof MAIL_EVENTS)[number] | "test"]();

  return NextResponse.json(rendered, { headers: { "Cache-Control": "no-store" } });
}
