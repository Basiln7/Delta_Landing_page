"use client";

/**
 * Thin, typed wrapper around Razorpay Standard Checkout (checkout.js).
 * https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
 */

const SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayFailure = {
  error: {
    code: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
};

export type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpaySuccess) => void;
  prefill?: { name?: string; email?: string; contact?: string; method?: "card" | "netbanking" | "wallet" | "upi" | "emi" };
  notes?: Record<string, string>;
  theme?: { color?: string; backdrop_color?: string };
  modal?: { ondismiss?: () => void; confirm_close?: boolean; escape?: boolean; backdropclose?: boolean };
  retry?: { enabled: boolean };
};

type RazorpayInstance = {
  open: () => void;
  close: () => void;
  on: (event: "payment.failed", cb: (response: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

/** Loads checkout.js once (idempotent). Call early (e.g. when the checkout step opens) to hide latency. */
export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay can only load in the browser"));
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve() : reject(new Error("Razorpay failed to initialise")));
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't reach Razorpay. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export class CheckoutDismissed extends Error {
  constructor() {
    super("Payment window closed");
  }
}

/** "+91 98765 43210" → "+919876543210" (the format Razorpay prefill expects). */
export function toRazorpayContact(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+91${digits.replace(/^0+/, "")}`;
}

/**
 * Opens Checkout and resolves with the success payload, or rejects with CheckoutDismissed when the
 * learner closes the window. Failed attempts stay inside Checkout (it offers retry) and are reported
 * through `onAttemptFailed`.
 */
export async function payWithRazorpay(
  options: Omit<RazorpayOptions, "handler" | "modal">,
  onAttemptFailed?: (failure: RazorpayFailure) => void,
): Promise<RazorpaySuccess> {
  await loadRazorpay();
  return new Promise<RazorpaySuccess>((resolve, reject) => {
    const Rzp = window.Razorpay!;
    const instance = new Rzp({
      ...options,
      retry: { enabled: true },
      handler: (response) => resolve(response),
      modal: { confirm_close: true, ondismiss: () => reject(new CheckoutDismissed()) },
    });
    instance.on("payment.failed", (failure) => onAttemptFailed?.(failure));
    instance.open();
  });
}
