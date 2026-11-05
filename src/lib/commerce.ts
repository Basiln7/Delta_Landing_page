// Pricing rules shared by the storefront (display) and the orders API (authoritative re-calculation).
import type { Course, Plan, SiteSettings } from "@/lib/types";

/** Demo coupon codes. In production these live in the database and are validated server-side only. */
export const COUPONS: Record<string, { percent: number; label: string }> = {
  DELTA10: { percent: 10, label: "10% off your order" },
  LAUNCH20: { percent: 20, label: "Launch offer · 20% off" },
};

/** No-cost EMI is offered at or above this order total. */
export const EMI_MIN_TOTAL = 10000;

export type Currency = SiteSettings["currency"];
export const DEFAULT_CURRENCY: Currency = { code: "INR", symbol: "₹", locale: "en-IN" };

export function formatPrice(amount: number, currency: Currency = DEFAULT_CURRENCY) {
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: currency.code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency.symbol}${Math.round(amount).toLocaleString()}`;
  }
}

/** The price a learner actually pays for a course (before coupons). */
export function coursePrice(course: Pick<Course, "price" | "salePrice">) {
  return course.salePrice && course.salePrice > 0 && course.salePrice < course.price ? course.salePrice : course.price;
}

export function discountPercent(course: Pick<Course, "price" | "salePrice">) {
  const now = coursePrice(course);
  return now < course.price ? Math.round(((course.price - now) / course.price) * 100) : 0;
}

export function planPeriodLabel(period: Plan["period"]) {
  return period === "month" ? "/ month" : period === "year" ? "/ year" : "one-time";
}

export function normaliseCoupon(code?: string | null) {
  const c = (code ?? "").trim().toUpperCase();
  return c && COUPONS[c] ? c : null;
}

export function computeTotals(prices: number[], couponCode?: string | null) {
  const subtotal = prices.reduce((s, p) => s + p, 0);
  const coupon = normaliseCoupon(couponCode);
  const discount = coupon ? Math.round((subtotal * COUPONS[coupon].percent) / 100) : 0;
  return { subtotal, discount, total: Math.max(0, subtotal - discount), coupon };
}
