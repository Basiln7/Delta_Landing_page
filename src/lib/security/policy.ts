import "server-only";

/**
 * Demo checkout marks orders as PAID without taking money. That's what we want on a laptop, and
 * never what we want on a live site that simply forgot its Razorpay keys. In production it's off
 * unless ALLOW_DEMO_CHECKOUT=true is set deliberately (e.g. a public demo deployment).
 */
export function demoCheckoutAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEMO_CHECKOUT?.trim().toLowerCase() === "true";
}
