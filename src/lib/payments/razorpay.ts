import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";

/**
 * Razorpay integration (Standard Checkout + Orders API + webhooks).
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
 *
 * Secrets live in env only and never reach the browser — the browser only ever sees the Key ID.
 * The SDK is used for API calls; signatures are verified here with a constant-time compare
 * (the SDK helpers use `===`), using exactly the documented formulas.
 */

export type RazorpayMode = "test" | "live";

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  return {
    keyId,
    keySecret,
    webhookSecret,
    /** Checkout works once both API keys are set; otherwise the site falls back to the demo checkout. */
    enabled: Boolean(keyId && keySecret),
    webhooksEnabled: Boolean(webhookSecret),
    mode: (keyId.startsWith("rzp_live_") ? "live" : "test") as RazorpayMode,
  };
}

let client: Razorpay | null = null;
let clientKey = "";

/** Lazily-created SDK client (re-created if keys change, e.g. after editing .env.local in dev). */
export function razorpay() {
  const { keyId, keySecret, enabled } = razorpayConfig();
  if (!enabled) throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  if (!client || clientKey !== keyId + keySecret) {
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    clientKey = keyId + keySecret;
  }
  return client;
}

/* ───────────────────────── Amounts ───────────────────────── */

// Razorpay amounts are integers in the currency's smallest sub-unit (₹1 = 100 paise).
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "PYG", "UGX", "XAF", "XOF"]);
const THREE_DECIMAL = new Set(["BHD", "KWD", "OMR", "JOD"]);

export function toSubunits(amount: number, currency: string) {
  const c = currency.toUpperCase();
  const factor = ZERO_DECIMAL.has(c) ? 1 : THREE_DECIMAL.has(c) ? 1000 : 100;
  return Math.round(amount * factor);
}

/* ───────────────────────── Signatures ───────────────────────── */

function hmacHex(message: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

function safeEqualHex(expected: string, received: string) {
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Checkout success signature: hmac_sha256(order_id + "|" + razorpay_payment_id, key_secret).
 * `orderId` MUST be the order id stored on our server, not the one echoed back by the browser.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = razorpayConfig();
  if (!keySecret) return false;
  return safeEqualHex(hmacHex(`${orderId}|${paymentId}`, keySecret), signature);
}

/** Webhook signature: hmac_sha256(raw request body, webhook_secret) in the X-Razorpay-Signature header. */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const { webhookSecret } = razorpayConfig();
  if (!webhookSecret || !signature) return false;
  return safeEqualHex(hmacHex(rawBody, webhookSecret), signature);
}

/* ───────────────────────── Errors ───────────────────────── */

type RazorpayApiError = { statusCode?: number; error?: { code?: string; description?: string; reason?: string } };

/** Turn SDK/API errors into a safe, human-readable message (never leaks keys). */
export function describeRazorpayError(err: unknown) {
  const e = err as RazorpayApiError;
  if (e && typeof e === "object" && e.error?.description) {
    return { status: e.statusCode ?? 502, code: e.error.code ?? "GATEWAY_ERROR", message: e.error.description };
  }
  // Some endpoints answer with a bare status code and no body.
  if (e && typeof e === "object" && typeof e.statusCode === "number") {
    const byStatus: Record<number, string> = {
      400: "Razorpay rejected the request.",
      401: "Authentication failed — check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      404: "Not found in this Razorpay account — check the keys belong to the account and mode (test/live) that took the payment.",
      429: "Too many requests to Razorpay — try again in a minute.",
    };
    return {
      status: e.statusCode,
      code: `HTTP_${e.statusCode}`,
      message: byStatus[e.statusCode] ?? (e.statusCode >= 500 ? "Razorpay is temporarily unavailable." : "Payment gateway error"),
    };
  }
  if (err instanceof Error) return { status: 502, code: "GATEWAY_UNREACHABLE", message: err.message };
  return { status: 502, code: "GATEWAY_ERROR", message: "Payment gateway error" };
}

/** Dashboard deep links for the admin. */
export const dashboardUrl = {
  payment: (id: string) => `https://dashboard.razorpay.com/app/payments/${id}`,
  order: (id: string) => `https://dashboard.razorpay.com/app/orders/${id}`,
};
