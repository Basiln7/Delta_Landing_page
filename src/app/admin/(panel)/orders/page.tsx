import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { DEFAULT_CURRENCY } from "@/lib/commerce";
import { OrdersView } from "@/components/admin/orders/OrdersView";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageSession();
  const [db, params] = await Promise.all([readDb(), searchParams]);
  const items = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const status = typeof params.status === "string" && (ORDER_STATUSES as string[]).includes(params.status) ? (params.status as OrderStatus) : "all";
  const open = typeof params.open === "string" ? params.open : undefined;

  return <OrdersView initialItems={items} currency={db.settings.currency ?? DEFAULT_CURRENCY} initialStatus={status} initialOpenId={open} />;
}
