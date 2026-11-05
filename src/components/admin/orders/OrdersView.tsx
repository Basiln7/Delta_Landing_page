"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ChevronRight, Download, Mail, MessageCircle, Phone, ReceiptText, RotateCcw, Search, Ticket, Trash2 } from "lucide-react";
import { api, downloadCsv } from "@/lib/admin/client";
import { ORDER_STATUS_META, PAYMENT_LABEL } from "@/lib/admin/media-meta";
import { formatPrice, type Currency } from "@/lib/commerce";
import { Badge, Button, EmptyState, Input, PageHeader, Segmented } from "@/components/admin/ui";
import { ConfirmDialog, Drawer } from "@/components/admin/Overlay";
import { RelativeTime } from "@/components/admin/RelativeTime";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type StatusFilter = OrderStatus | "all";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <Badge tone={meta.tone}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

const itemsSummary = (o: Order) => (o.items.length > 1 ? `${o.items[0].title} +${o.items.length - 1} more` : (o.items[0]?.title ?? "—"));

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

export function OrdersView({
  initialItems,
  currency,
  initialStatus = "all",
  initialOpenId,
}: {
  initialItems: Order[];
  currency: Currency;
  initialStatus?: StatusFilter;
  initialOpenId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);

  const [prevProps, setPrevProps] = useState({ initialStatus, initialOpenId });
  if (prevProps.initialStatus !== initialStatus || prevProps.initialOpenId !== initialOpenId) {
    setPrevProps({ initialStatus, initialOpenId });
    setStatus(initialStatus);
    if (initialOpenId) setOpenId(initialOpenId);
  }

  const money = (o: Pick<Order, "currency">, amount: number) => formatPrice(amount, { ...currency, code: o.currency || currency.code });

  const kpis = useMemo(() => {
    const paid = items.filter((o) => o.status === "paid");
    const refunded = items.filter((o) => o.status === "refunded");
    const revenue = paid.reduce((s, o) => s + o.total, 0);
    return {
      revenue,
      paidCount: paid.length,
      orders: items.length,
      pending: items.filter((o) => o.status === "pending").length,
      aov: paid.length ? Math.round(revenue / paid.length) : 0,
      refunds: refunded.length,
      refundedAmount: refunded.reduce((s, o) => s + o.total, 0),
    };
  }, [items]);

  const counts = useMemo(() => {
    const c = Object.fromEntries([["all", items.length], ...ORDER_STATUSES.map((s) => [s, 0])]) as Record<StatusFilter, number>;
    items.forEach((o) => c[o.status]++);
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (!q ||
          `${o.number} ${o.customer.name} ${o.customer.email} ${o.customer.phone} ${o.coupon ?? ""} ${o.items.map((i) => i.title).join(" ")}`
            .toLowerCase()
            .includes(q)),
    );
  }, [items, status, query]);

  const open = items.find((o) => o.id === openId) ?? null;

  const exportCsv = () => {
    downloadCsv(`delta-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Order", "Date", "Customer", "Email", "Phone", "Items", "Subtotal", "Coupon", "Discount", "Total", "Currency", "Payment", "Status"],
      ...visible.map((o) => [
        o.number,
        o.createdAt,
        o.customer.name,
        o.customer.email,
        o.customer.phone,
        o.items.map((i) => i.title).join(" | "),
        o.subtotal,
        o.coupon ?? "",
        o.discount,
        o.total,
        o.currency,
        PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod,
        ORDER_STATUS_META[o.status].label,
      ]),
    ]);
    toast.success(`Exported ${visible.length} ${visible.length === 1 ? "order" : "orders"}`);
  };

  const fmt = (amount: number) => formatPrice(amount, currency);

  return (
    <>
      <PageHeader
        eyebrow="Store"
        title="Orders"
        description="Every course and plan purchase. Totals are calculated on the server from the catalogue at checkout."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!visible.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <section aria-label="Order metrics" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: "Revenue", value: fmt(kpis.revenue), sub: `${kpis.paidCount} paid orders`, accent: true },
          { label: "Orders", value: kpis.orders, sub: `${kpis.pending} pending` },
          { label: "Avg. order value", value: fmt(kpis.aov), sub: "paid orders" },
          { label: "Refunds", value: kpis.refunds, sub: kpis.refundedAmount ? `${fmt(kpis.refundedAmount)} returned` : "none so far" },
        ].map((k) => (
          <div key={k.label} className={cn("px-5 py-4", k.accent ? "bg-ink text-paper" : "bg-white")}>
            <p className={cn("eyebrow", k.accent ? "text-paper/50" : "text-ink/45")}>{k.label}</p>
            <p className="display mt-2 text-[2rem] leading-none tabular-nums sm:text-[2.3rem]">{k.value}</p>
            <p className={cn("mt-1.5 text-xs", k.accent ? "text-paper/55" : "text-ink/50")}>{k.sub}</p>
          </div>
        ))}
      </section>

      <div className="mb-4">
        <Segmented
          layoutId="order-status"
          value={status}
          onChange={setStatus}
          options={(["all", ...ORDER_STATUSES] as StatusFilter[]).map((s) => ({
            value: s,
            label: s === "all" ? "All" : ORDER_STATUS_META[s].label,
            count: counts[s],
          }))}
        />
      </div>

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink/35" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order number, customer, course or coupon…" className="pl-10" aria-label="Search orders" />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="size-6" />}
          title={items.length ? "Nothing here" : "No orders yet"}
          description={items.length ? "No orders match these filters." : "When a learner checks out on the website, the order lands here."}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="hidden grid-cols-[6.5rem_minmax(0,1.3fr)_minmax(0,1.5fr)_6.5rem_6.5rem_6.5rem_6.5rem_1rem] gap-4 border-b border-line bg-paper/40 px-5 py-2.5 lg:grid">
            {["Order", "Customer", "Items", "Total", "Method", "Status", "Placed", ""].map((h) => (
              <span key={h} className={cn("eyebrow text-[0.5625rem] text-ink/40", h === "Total" && "text-right")}>
                {h}
              </span>
            ))}
          </div>
          <motion.ul layout className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {visible.map((o) => (
                <motion.li key={o.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button onClick={() => setOpenId(o.id)} className="group w-full px-4 py-3.5 text-left transition-colors hover:bg-paper/40 lg:px-5">
                    {/* Mobile card */}
                    <div className="lg:hidden">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs text-ink/55">{o.number}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">{o.customer.name}</span>
                        <span className={cn("display text-xl tabular-nums", o.status === "refunded" && "text-ink/40 line-through")}>{money(o, o.total)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink/50">
                        {itemsSummary(o)} · {PAYMENT_LABEL[o.paymentMethod]} · <RelativeTime iso={o.createdAt} />
                      </p>
                    </div>
                    {/* Desktop row */}
                    <div className="hidden grid-cols-[6.5rem_minmax(0,1.3fr)_minmax(0,1.5fr)_6.5rem_6.5rem_6.5rem_6.5rem_1rem] items-center gap-4 lg:grid">
                      <span className="font-mono text-xs text-ink/70">{o.number}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{o.customer.name}</span>
                        <span className="block truncate text-xs text-ink/50">{o.customer.email}</span>
                      </span>
                      <span className="truncate text-sm text-ink/70">{itemsSummary(o)}</span>
                      <span className={cn("text-right text-sm font-medium tabular-nums", o.status === "refunded" && "text-ink/40 line-through")}>{money(o, o.total)}</span>
                      <span className="text-xs text-ink/60">{PAYMENT_LABEL[o.paymentMethod]}</span>
                      <span>
                        <OrderStatusBadge status={o.status} />
                      </span>
                      <RelativeTime iso={o.createdAt} className="text-xs text-ink/50" />
                      <ChevronRight className="size-4 text-ink/25 transition-transform group-hover:translate-x-0.5 group-hover:text-ink/60" />
                    </div>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </div>
      )}

      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? `Order ${open.number}` : "Order"}
        description={
          open ? (
            <span className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={open.status} /> Placed {formatDate(open.createdAt, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          ) : null
        }
      >
        {open && (
          <OrderDetails
            key={open.id}
            order={open}
            money={(n) => money(open, n)}
            onChange={(u) => {
              setItems((prev) => prev.map((o) => (o.id === u.id ? u : o)));
              router.refresh();
            }}
            onDeleted={() => {
              setItems((prev) => prev.filter((o) => o.id !== open.id));
              setOpenId(null);
              router.refresh();
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function OrderDetails({
  order,
  money,
  onChange,
  onDeleted,
}: {
  order: Order;
  money: (n: number) => string;
  onChange: (o: Order) => void;
  onDeleted: () => void;
}) {
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setStatus = async (status: OrderStatus) => {
    if (status === order.status) return;
    setPending(status);
    try {
      const { item } = await api<{ item: Order }>(`/api/admin/orders/${order.id}`, { method: "PATCH", json: { status } });
      onChange(item);
      toast.success(`Order ${order.number} marked ${ORDER_STATUS_META[status].label.toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update order");
      throw e;
    } finally {
      setPending(null);
    }
  };

  const remove = async () => {
    try {
      await api(`/api/admin/orders/${order.id}`, { method: "DELETE" });
      toast.success(`Order ${order.number} deleted`);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
      throw e;
    }
  };

  const isGateway = order.gateway === "razorpay";
  const canRefund = isGateway ? order.status === "paid" && Boolean(order.gatewayPaymentId) : order.status !== "refunded";
  const canDelete = !(isGateway && (order.status === "paid" || order.status === "refunded"));
  const firstName = order.customer.name.split(" ")[0];
  const wa = whatsappLink(order.customer.phone, `Hi ${firstName}, this is Delta International Academy about your order ${order.number}.`);
  const contact = [
    { href: `mailto:${order.customer.email}?subject=${encodeURIComponent(`Your Delta order ${order.number}`)}`, label: "Email", value: order.customer.email, icon: <Mail className="size-4" /> },
    { href: `tel:${order.customer.phone.replace(/\s/g, "")}`, label: "Phone", value: order.customer.phone, icon: <Phone className="size-4" /> },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-3 text-ink/45">Customer</p>
        <p className="display text-2xl">{order.customer.name}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {contact.map((c) => (
            <a key={c.label} href={c.href} className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3 transition-colors hover:border-ink/25">
              <span className="grid size-9 place-items-center rounded-lg bg-paper text-brass">{c.icon}</span>
              <span className="min-w-0">
                <span className="eyebrow block text-[0.5625rem] text-ink/40">{c.label}</span>
                <span className="block truncate text-sm group-hover:underline">{c.value}</span>
              </span>
            </a>
          ))}
        </div>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-3 rounded-xl border border-emerald-600/20 bg-emerald-600/[0.06] p-3 text-sm text-emerald-800 transition-colors hover:bg-emerald-600/10"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-600 text-white">
              <MessageCircle className="size-4" />
            </span>
            <span className="flex-1">Message on WhatsApp</span>
            <ChevronRight className="size-4 opacity-60" />
          </a>
        )}
      </div>

      <div>
        <p className="eyebrow mb-3 text-ink/45">Items</p>
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
          {order.items.map((it) => (
            <li key={`${it.kind}-${it.id}`} className="flex items-center gap-3 px-4 py-3">
              <Badge tone={it.kind === "plan" ? "brass" : "neutral"}>{it.kind === "plan" ? "Plan" : "Course"}</Badge>
              <span className="min-w-0 flex-1 truncate text-sm">{it.title}</span>
              <span className="text-sm tabular-nums">{money(it.price)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-2 px-1 text-sm">
          <div className="flex justify-between text-ink/60">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{money(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt className="flex items-center gap-1.5">
                <Ticket className="size-3.5" /> Coupon {order.coupon && <code className="rounded bg-emerald-600/10 px-1.5 font-mono text-xs">{order.coupon}</code>}
              </dt>
              <dd className="tabular-nums">−{money(order.discount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-medium">Total</dt>
            <dd className={cn("display text-3xl tabular-nums", order.status === "refunded" && "text-ink/40 line-through")}>{money(order.total)}</dd>
          </div>
          <div className="flex justify-between text-ink/60">
            <dt>Payment method</dt>
            <dd>{order.gatewayMethod ? order.gatewayMethod.toUpperCase() : PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</dd>
          </div>
        </dl>
      </div>

      <div>
        <p className="eyebrow mb-3 text-ink/45">Payment gateway</p>
        <div className="space-y-2 rounded-xl border border-line bg-white p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink/60">Processor</span>
            <Badge tone={isGateway ? "brass" : "neutral"}>{isGateway ? "Razorpay" : "Demo checkout"}</Badge>
          </div>
          {order.gatewayOrderId && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink/60">Razorpay order</span>
              <a href={`https://dashboard.razorpay.com/app/orders/${order.gatewayOrderId}`} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-xs underline-offset-2 hover:underline">
                {order.gatewayOrderId} ↗
              </a>
            </div>
          )}
          {order.gatewayPaymentId && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink/60">Payment</span>
              <a href={`https://dashboard.razorpay.com/app/payments/${order.gatewayPaymentId}`} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-xs underline-offset-2 hover:underline">
                {order.gatewayPaymentId} ↗
              </a>
            </div>
          )}
          {order.paidAt && (
            <div className="flex items-center justify-between">
              <span className="text-ink/60">Paid</span>
              <RelativeTime iso={order.paidAt} className="text-ink/80" />
            </div>
          )}
          {order.refundId && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink/60">Refund</span>
              <span className="truncate font-mono text-xs">
                {order.refundId} · {order.refundStatus ?? "pending"}
              </span>
            </div>
          )}
          {order.failureReason && <p className="rounded-lg bg-pin/[0.07] px-3 py-2 text-xs text-pin">{order.failureReason}</p>}
          {!isGateway && <p className="text-xs text-ink/45">Created by the demo checkout — no money was collected.</p>}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-3 text-ink/45">Status</p>
        {isGateway ? (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm">
            <span className={cn("size-2 rounded-full", ORDER_STATUS_META[order.status].dot)} />
            <span className="font-medium">{ORDER_STATUS_META[order.status].label}</span>
            <span className="text-ink/50">· updated automatically by Razorpay</span>
          </p>
        ) : (
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Order status">
          {(["paid", "pending", "failed"] as OrderStatus[]).map((s) => {
            const active = order.status === s;
            return (
              <button
                key={s}
                role="radio"
                aria-checked={active}
                disabled={pending !== null}
                onClick={() => setStatus(s).catch(() => undefined)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-xl border text-[0.8125rem] transition-all",
                  active ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink/65 hover:border-ink/30 hover:text-ink",
                  pending === s && "animate-pulse",
                )}
              >
                <span className={cn("size-1.5 rounded-full", ORDER_STATUS_META[s].dot)} />
                {ORDER_STATUS_META[s].label}
              </button>
            );
          })}
        </div>
        )}
        {order.status === "refunded" ? (
          <p className="mt-3 rounded-xl bg-ink/[0.04] px-4 py-3 text-sm text-ink/60">
            {isGateway ? "Refunded through Razorpay. Funds return to the customer's original payment method in 5–7 working days." : "This order was refunded. Choose a status above to reopen it."}
          </p>
        ) : canRefund ? (
          <Button variant="secondary" className="mt-3 w-full justify-center" onClick={() => setConfirmRefund(true)}>
            <RotateCcw className="size-4" /> {isGateway ? "Refund via Razorpay" : "Mark refunded"}
          </Button>
        ) : null}
      </div>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t border-line bg-[#FBFAF7]/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:px-7">
        {canDelete && (
          <Button variant="ghost" className="text-pin hover:bg-pin/5 hover:text-pin" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
        <a
          href={contact[0].href}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-navy"
        >
          <Mail className="size-4" /> Email customer
        </a>
      </div>

      <ConfirmDialog
        open={confirmRefund}
        onClose={() => setConfirmRefund(false)}
        onConfirm={() => setStatus("refunded")}
        title={isGateway ? `Refund ${money(order.total)} to ${firstName}?` : `Mark ${order.number} as refunded?`}
        description={
          isGateway
            ? `A full refund of ${money(order.total)} will be issued through Razorpay to the original payment method. This can't be undone.`
            : `${money(order.total)} will be excluded from revenue. This only updates the record — no money moves for demo orders.`
        }
        confirmLabel={isGateway ? "Issue refund" : "Mark refunded"}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title={`Delete order ${order.number}?`}
        description="The order is removed from reports and exports. Prefer “Mark refunded” to keep an audit trail."
      />
    </div>
  );
}
