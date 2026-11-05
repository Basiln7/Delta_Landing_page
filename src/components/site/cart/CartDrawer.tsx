"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Tag,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SmartImage } from "@/components/site/SmartImage";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { lockScroll, scrollToTarget } from "@/components/motion/SmoothScroll";
import { cart, useCart } from "@/components/site/cart/store";
import { CheckoutDismissed, loadRazorpay, payWithRazorpay, toRazorpayContact } from "@/components/site/cart/razorpay-checkout";
import { COUPONS, EMI_MIN_TOTAL, computeTotals, formatPrice, normaliseCoupon, type Currency } from "@/lib/commerce";
import { checkoutSchema } from "@/lib/validators";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/types";

const ease = [0.16, 1, 0.3, 1] as const;

const METHODS: { id: PaymentMethod; label: string; note: string; icon: React.ReactNode }[] = [
  { id: "upi", label: "UPI", note: "GPay, PhonePe, Paytm & more", icon: <Smartphone className="h-4 w-4" /> },
  { id: "card", label: "Card", note: "Visa, Mastercard, RuPay, Amex", icon: <CreditCard className="h-4 w-4" /> },
  { id: "netbanking", label: "Net banking", note: "All major banks", icon: <Building2 className="h-4 w-4" /> },
  { id: "emi", label: "No-cost EMI", note: "6 months, 0% interest", icon: <WalletCards className="h-4 w-4" /> },
];

type Confirmed = { number: string; total: number; email: string; items: { title: string; price: number }[]; processing?: boolean };

type PublicOrder = { id: string; number: string; total: number; email: string; items: { title: string; price: number }[] };
type CreateOrderResponse = {
  mode: "demo" | "razorpay";
  order: PublicOrder;
  razorpay?: { keyId: string; orderId: string; amount: number; currency: string; testMode: boolean };
};

export type PaymentsConfig = { provider: "razorpay" | "demo"; testMode: boolean };

export function CartDrawer({
  currency,
  whatsappHref,
  payments,
  brandName,
}: {
  currency: Currency;
  whatsappHref?: string | null;
  payments: PaymentsConfig;
  brandName: string;
}) {
  const { items, coupon, open, view } = useCart();
  const totals = computeTotals(
    items.map((i) => i.price),
    coupon,
  );
  const saleSavings = items.reduce((s, i) => s + Math.max(0, (i.compareAt ?? i.price) - i.price), 0);
  const fmt = (n: number) => formatPrice(n, currency);

  const closeRef = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [paying, setPaying] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  // Re-use the same pending order if the learner closes Checkout and tries again with an unchanged cart.
  const pendingRef = useRef<{ key: string; data: CreateOrderResponse } | null>(null);
  const isRazorpay = payments.provider === "razorpay";

  // Warm up checkout.js as soon as the learner reaches the payment step.
  useEffect(() => {
    if (open && view === "checkout" && isRazorpay) loadRazorpay().catch(() => undefined);
  }, [open, view, isRazorpay]);

  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cart.close();
    window.addEventListener("keydown", onKey);
    return () => {
      lockScroll(false);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const emiAvailable = totals.total >= EMI_MIN_TOTAL;
  const activeMethod = method === "emi" && !emiAvailable ? "upi" : method;

  function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    const valid = normaliseCoupon(code);
    if (!valid) {
      setCodeError("That code isn't valid. Try DELTA10.");
      return;
    }
    setCodeError("");
    setCode("");
    cart.setCoupon(valid);
    toast.success(`${valid} applied`, { description: COUPONS[valid].label });
  }

  function finish(order: PublicOrder, processing: boolean) {
    setConfirmed({ number: order.number, total: order.total, email: order.email, items: order.items, processing });
    pendingRef.current = null;
    cart.clear();
    cart.setView("success");
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      customer: form,
      items: items.map((i) => ({ kind: i.kind, id: i.id })),
      coupon: coupon ?? undefined,
      paymentMethod: activeMethod,
    };
    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
      const nested = parsed.error.issues.reduce<Record<string, string>>((acc, iss) => {
        const key = String(iss.path[iss.path.length - 1]);
        acc[key] ??= iss.message;
        return acc;
      }, {});
      setErrors({ ...Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])), ...nested });
      return;
    }
    setErrors({});
    setPaying(true);

    let data: CreateOrderResponse | null = null;
    try {
      // 1) Create (or re-use) the order — the server prices it and, for Razorpay, opens a gateway order.
      const reuseKey = JSON.stringify({ c: payload.customer, i: payload.items, k: payload.coupon });
      data = pendingRef.current?.key === reuseKey ? pendingRef.current.data : null;
      if (!data) {
        if (!isRazorpay) await new Promise((r) => setTimeout(r, 900)); // demo: simulated gateway hand-off
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "We couldn't create your order");
        data = json as CreateOrderResponse;
      }

      if (data.mode === "demo" || !data.razorpay) {
        finish(data.order, false);
        return;
      }
      pendingRef.current = { key: reuseKey, data };
      const order = data.order;

      // 2) Razorpay Checkout — the learner pays inside Razorpay's secure window.
      const success = await payWithRazorpay(
        {
          key: data.razorpay.keyId,
          amount: data.razorpay.amount,
          currency: data.razorpay.currency,
          name: brandName,
          description: order.items.map((i) => i.title).join(", ").slice(0, 250),
          image: `${window.location.origin}/apple-icon`,
          order_id: data.razorpay.orderId,
          prefill: { name: form.name, email: form.email, contact: toRazorpayContact(form.phone), method: activeMethod },
          notes: { delta_order: order.number },
          theme: { color: "#14151C" },
        },
        (failure) => {
          toast.error("That payment attempt failed", { description: `${failure.error.description} You can try again in the payment window.` });
          fetch("/api/payments/razorpay/failed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.id,
              razorpay_order_id: failure.error.metadata?.order_id,
              code: failure.error.code,
              description: failure.error.description,
              reason: failure.error.reason,
            }),
          }).catch(() => undefined);
        },
      );

      // 3) Verify the signature + payment status on our server before showing success.
      const vr = await fetch("/api/payments/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, ...success }),
      });
      const vj = await vr.json().catch(() => ({}));
      if (!vr.ok) {
        throw new Error(
          `${vj?.error ?? "We couldn't verify your payment"}. If money was deducted it will be confirmed or refunded automatically — quote order ${order.number} if you contact us.`,
        );
      }
      finish(vj.order ?? order, vj.status !== "paid");
    } catch (err) {
      if (err instanceof CheckoutDismissed) {
        toast("Payment window closed", { description: "Your cart is saved — pay whenever you're ready." });
      } else {
        toast.error("Payment didn't go through", { description: err instanceof Error ? err.message : "Please try again." });
      }
    } finally {
      setPaying(false);
    }
  }

  const title = view === "checkout" ? "Secure checkout" : view === "success" ? "You're enrolled" : `Your cart${items.length ? ` (${items.length})` : ""}`;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[66]" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            aria-label="Close cart"
            tabIndex={-1}
            onClick={() => cart.close()}
            className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.6, ease }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[28rem] flex-col bg-paper text-ink shadow-[-30px_0_80px_-20px_rgba(11,19,36,0.45)]"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
              {view === "checkout" && (
                <button
                  type="button"
                  onClick={() => cart.setView("cart")}
                  aria-label="Back to cart"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 hover:bg-ink hover:text-paper"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <p className="display flex-1 text-3xl">{title}</p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => cart.close()}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 transition-colors hover:bg-ink hover:text-paper"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Steps */}
            {view !== "success" && (
              <div className="flex items-center gap-2 px-5 pt-4 sm:px-6">
                {["Cart", "Details & payment", "Access"].map((s, i) => {
                  const active = (view === "cart" && i === 0) || (view === "checkout" && i <= 1);
                  return (
                    <span key={s} className="flex flex-1 flex-col gap-1.5">
                      <span className={cn("h-1 rounded-full transition-colors duration-500", active ? "bg-ink" : "bg-ink/10")} />
                      <span className={cn("eyebrow text-[0.55rem]", active ? "text-ink/70" : "text-ink/35")}>{s}</span>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6" data-lenis-prevent>
              <AnimatePresence mode="wait" initial={false}>
                {/* ───────── CART ───────── */}
                {view === "cart" && (
                  <motion.div key="cart" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease }}>
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center py-16 text-center">
                        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-paper-2 text-ink/40">
                          <ShoppingBag className="h-8 w-8" />
                        </span>
                        <p className="display mt-6 text-3xl">Your cart is empty</p>
                        <p className="mt-2 max-w-xs text-sm text-ink/55">Start with the flagship — Master the Stock Market with AI.</p>
                        <button
                          type="button"
                          onClick={() => {
                            cart.close();
                            setTimeout(() => scrollToTarget("#courses"), 300);
                          }}
                          className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-paper hover:bg-navy"
                        >
                          Browse courses <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <ul className="space-y-3">
                          <AnimatePresence initial={false}>
                            {items.map((it) => (
                              <motion.li
                                key={it.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 40, height: 0, marginTop: 0 }}
                                transition={{ duration: 0.35, ease }}
                                className="flex gap-3 overflow-hidden rounded-2xl border border-line bg-white p-3"
                              >
                                <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-paper-2">
                                  {it.image ? (
                                    <SmartImage src={it.image} alt="" fill sizes="80px" className="object-cover" />
                                  ) : (
                                    <span className="flex h-full items-center justify-center bg-ink text-brass-light">
                                      <ShieldCheck className="h-6 w-6" />
                                    </span>
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="line-clamp-2 text-sm font-semibold leading-snug">{it.title}</span>
                                  {it.subtitle && <span className="mt-0.5 block truncate text-xs text-ink/50">{it.subtitle}</span>}
                                  <span className="mt-1.5 flex items-baseline gap-2">
                                    <span className="text-sm font-semibold">{fmt(it.price)}</span>
                                    {it.compareAt && it.compareAt > it.price && <span className="text-xs text-ink/40 line-through">{fmt(it.compareAt)}</span>}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => cart.remove(it.id)}
                                  aria-label={`Remove ${it.title}`}
                                  className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full text-ink/40 transition-colors hover:bg-pin/10 hover:text-pin"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>

                        {/* Coupon */}
                        <div className="mt-5 rounded-2xl border border-dashed border-ink/20 p-4">
                          {coupon ? (
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-sm">
                                <Tag className="h-4 w-4 text-brass" />
                                <span className="font-mono font-medium">{coupon}</span>
                                <span className="text-ink/55">· {COUPONS[coupon]?.label}</span>
                              </span>
                              <button type="button" onClick={() => cart.setCoupon(null)} className="text-xs font-medium text-ink/60 underline-offset-2 hover:underline">
                                Remove
                              </button>
                            </div>
                          ) : (
                            <form onSubmit={applyCoupon} className="flex gap-2">
                              <label htmlFor="coupon" className="sr-only">
                                Coupon code
                              </label>
                              <input
                                id="coupon"
                                value={code}
                                onChange={(e) => {
                                  setCode(e.target.value.toUpperCase());
                                  setCodeError("");
                                }}
                                placeholder="Coupon code"
                                className="h-11 min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 font-mono text-sm uppercase outline-none placeholder:font-sans placeholder:normal-case placeholder:text-ink/35 focus:border-ink"
                              />
                              <button type="submit" className="h-11 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-navy">
                                Apply
                              </button>
                            </form>
                          )}
                          {codeError && <p className="mt-2 text-xs text-pin">{codeError}</p>}
                          {!coupon && !codeError && <p className="mt-2 text-xs text-ink/45">Launch offer: use <span className="font-mono font-medium text-ink/70">DELTA10</span> for an extra 10% off.</p>}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {/* ───────── CHECKOUT ───────── */}
                {view === "checkout" && (
                  <motion.form
                    key="checkout"
                    id="checkout-form"
                    noValidate
                    onSubmit={pay}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.35, ease }}
                    className="space-y-6"
                  >
                    <fieldset className="space-y-4">
                      <legend className="eyebrow mb-1 text-ink/50">Your details · course access is sent here</legend>
                      {(
                        [
                          { key: "name", label: "Full name", type: "text", auto: "name", ph: "Jane Doe" },
                          { key: "email", label: "Email", type: "email", auto: "email", ph: "jane@example.com" },
                          { key: "phone", label: "Phone / WhatsApp", type: "tel", auto: "tel", ph: "+91 98765 43210" },
                        ] as const
                      ).map((f) => (
                        <label key={f.key} className="block">
                          <span className="mb-1.5 block text-sm font-medium">{f.label}</span>
                          <input
                            type={f.type}
                            autoComplete={f.auto}
                            placeholder={f.ph}
                            value={form[f.key]}
                            aria-invalid={Boolean(errors[f.key])}
                            onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                            className={cn(
                              "h-12 w-full rounded-xl border bg-white px-4 text-[0.95rem] outline-none transition-colors placeholder:text-ink/30 focus:border-ink",
                              errors[f.key] ? "border-pin" : "border-ink/15",
                            )}
                          />
                          {errors[f.key] && <span className="mt-1 block text-xs text-pin">{errors[f.key]}</span>}
                        </label>
                      ))}
                    </fieldset>

                    <fieldset>
                      <legend className="eyebrow mb-3 text-ink/50">{isRazorpay ? "Preferred payment method" : "Payment method"}</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {METHODS.map((m) => {
                          const disabled = m.id === "emi" && !emiAvailable;
                          const selected = activeMethod === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              disabled={disabled}
                              aria-pressed={selected}
                              onClick={() => setMethod(m.id)}
                              className={cn(
                                "flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40",
                                selected ? "border-ink bg-ink text-paper shadow-lg" : "border-ink/15 bg-white hover:border-ink/40",
                              )}
                            >
                              <span className="flex items-center gap-2 text-sm font-semibold">
                                {m.icon} {m.label}
                              </span>
                              <span className={cn("text-[0.7rem] leading-snug", selected ? "text-paper/60" : "text-ink/50")}>
                                {m.id === "emi" && emiAvailable ? `${fmt(Math.ceil(totals.total / 6))}/mo × 6` : m.id === "emi" ? `On orders over ${fmt(EMI_MIN_TOTAL)}` : m.note}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    {isRazorpay ? (
                      <div className="space-y-2">
                        <p className="flex items-start gap-2 rounded-xl border border-line bg-white p-3 text-xs leading-relaxed text-ink/65">
                          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#128C4B]" />
                          Payments are processed securely by Razorpay. You can switch between UPI, cards, net banking, wallets and EMI in the payment window.
                        </p>
                        {payments.testMode && (
                          <p className="flex items-start gap-2 rounded-xl bg-brass/10 p-3 text-xs leading-relaxed text-[#7a5a22]">
                            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            Razorpay test mode — use Razorpay&apos;s test cards or UPI IDs. No real money is charged.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="flex items-start gap-2 rounded-xl bg-brass/10 p-3 text-xs leading-relaxed text-[#7a5a22]">
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Demo checkout — no real payment is taken. Add Razorpay keys to accept live payments.
                      </p>
                    )}
                  </motion.form>
                )}

                {/* ───────── SUCCESS ───────── */}
                {view === "success" && (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }} className="flex flex-col items-center pt-8 text-center" role="status">
                    <motion.span
                      initial={{ scale: 0, rotate: -40 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 240, damping: 15, delay: 0.1 }}
                      className="flex h-24 w-24 items-center justify-center rounded-full bg-ink text-brass-light"
                    >
                      <Check className="h-11 w-11" strokeWidth={2.5} />
                    </motion.span>
                    <p className="display mt-8 text-5xl">Welcome to Delta!</p>
                    {confirmed && (
                      <>
                        <p className="mt-3 text-ink/60">
                          Order <span className="font-mono font-medium text-ink">{confirmed.number}</span> · {fmt(confirmed.total)} {confirmed.processing ? "received" : "paid"}
                        </p>
                        <ul className="mt-8 w-full space-y-2 text-left">
                          {confirmed.items.map((i) => (
                            <li key={i.title} className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
                              <Check className="h-4 w-4 shrink-0 text-brass" />
                              <span className="flex-1">{i.title}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-6 max-w-xs text-sm text-ink/55">
                          Your login and batch schedule are on their way to <span className="font-medium text-ink">{confirmed.email}</span>.
                        </p>
                        {confirmed.processing && (
                          <p className="mt-3 max-w-xs rounded-xl bg-brass/10 px-4 py-2.5 text-xs text-[#7a5a22]">
                            Payment received — we&apos;re confirming it with your bank. This usually takes under a minute.
                          </p>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer / summary */}
            {view !== "success" && items.length > 0 && (
              <div className="border-t border-line bg-white/60 px-5 py-4 backdrop-blur-md sm:px-6">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-ink/60">
                    <dt>Subtotal</dt>
                    <dd>{fmt(totals.subtotal)}</dd>
                  </div>
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-[#128C4B]">
                      <dt>Coupon {totals.coupon}</dt>
                      <dd>−{fmt(totals.discount)}</dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between pt-1">
                    <dt className="font-semibold">Total</dt>
                    <dd className="display text-3xl">{fmt(totals.total)}</dd>
                  </div>
                  {saleSavings + totals.discount > 0 && (
                    <p className="text-right text-xs font-medium text-[#128C4B]">You save {fmt(saleSavings + totals.discount)}</p>
                  )}
                </dl>
                {view === "cart" ? (
                  <button
                    type="button"
                    onClick={() => cart.setView("checkout")}
                    className="group mt-4 flex h-14 w-full items-center justify-between rounded-full bg-ink pl-6 pr-2 font-medium text-paper transition-colors hover:bg-navy"
                  >
                    Checkout
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brass-light text-ink transition-transform group-hover:translate-x-1">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={paying}
                    className="group mt-4 flex h-14 w-full items-center justify-between rounded-full bg-ink pl-6 pr-2 font-medium text-paper transition-colors hover:bg-navy disabled:opacity-80"
                  >
                    {paying ? (isRazorpay ? "Complete payment in Razorpay…" : "Processing payment…") : `Pay ${fmt(totals.total)} securely`}
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brass-light text-ink">
                      {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    </span>
                  </button>
                )}
                <div className="mt-3 flex items-center justify-center gap-4 text-[0.7rem] text-ink/45">
                  <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" /> 7-day refund</span>
                  <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Secure payment</span>
                  <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Lifetime access</span>
                </div>
              </div>
            )}

            {view === "success" && (
              <div className="space-y-2 border-t border-line px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => cart.close()}
                  className="flex h-12 w-full items-center justify-center rounded-full bg-ink text-sm font-medium text-paper hover:bg-navy"
                >
                  Continue browsing
                </button>
                {whatsappHref && (
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-ink/15 text-sm font-medium hover:border-[#25D366]"
                  >
                    <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> Questions? Chat with us
                  </a>
                )}
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
