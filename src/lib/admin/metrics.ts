import { DEFAULT_CURRENCY, type Currency } from "@/lib/commerce";
import type { Database, EnquiryStatus } from "@/lib/types";
import { ENQUIRY_STATUSES } from "@/lib/types";

const DAY = 86_400_000;

export interface OverviewData {
  currency: Currency;
  // Store
  revenueMonth: number;
  paidOrdersMonth: number;
  revenueAllTime: number;
  paidOrders: number;
  aov: number;
  totalOrders: number;
  pendingOrders: number;
  revenueWeekly: { label: string; value: number }[];
  recentOrders: Database["orders"];
  topCourses: { id: string; title: string; revenue: number; sales: number }[];
  publishedCourses: number;
  draftCourses: number;
  // Counselling
  newEnquiries: number;
  newThisWeek: number;
  totalEnquiries: number;
  conversion: number; // % enrolled of non-archived
  weekly: { label: string; value: number }[];
  pipeline: { status: EnquiryStatus; count: number }[];
  recentEnquiries: Database["enquiries"];
  // Library & events
  mediaCount: number;
  uploadsCount: number;
  storageBytes: number;
  upcomingEvents: number;
  nextEvent: { title: string; date: string } | null;
  recentMedia: Database["media"];
  greeting: string;
  today: string;
}

/** Pure aggregation for the overview dashboard (server-side). */
export function computeOverview(db: Database, now = new Date()): OverviewData {
  const t = now.getTime();
  const ts = (iso: string) => new Date(iso).getTime();
  const weekLabel = (to: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(to - DAY));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = t - (8 - i) * 7 * DAY;
    return { from, to: from + 7 * DAY };
  });

  // ── Store ──
  const orders = [...(db.orders ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const paid = orders.filter((o) => o.status === "paid");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const paidMonth = paid.filter((o) => ts(o.createdAt) >= monthStart);
  const revenueAllTime = paid.reduce((s, o) => s + o.total, 0);

  const courseTotals = new Map<string, { id: string; title: string; revenue: number; sales: number }>();
  for (const o of paid) {
    for (const it of o.items) {
      if (it.kind !== "course") continue;
      const row = courseTotals.get(it.id) ?? { id: it.id, title: it.title, revenue: 0, sales: 0 };
      row.revenue += it.price;
      row.sales += 1;
      courseTotals.set(it.id, row);
    }
  }
  const courseTitle = new Map((db.courses ?? []).map((c) => [c.id, c.title]));
  const topCourses = [...courseTotals.values()]
    .map((r) => ({ ...r, title: courseTitle.get(r.id) ?? r.title }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Counselling ──
  const enquiries = [...db.enquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pipeline = ENQUIRY_STATUSES.map((status) => ({ status, count: enquiries.filter((e) => e.status === status).length }));
  const active = enquiries.filter((e) => e.status !== "archived").length;
  const enrolled = enquiries.filter((e) => e.status === "enrolled").length;

  // ── Events ──
  const todayIso = now.toISOString().slice(0, 10);
  const upcoming = db.events.filter((e) => e.published && e.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date));

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return {
    currency: db.settings.currency ?? DEFAULT_CURRENCY,
    revenueMonth: paidMonth.reduce((s, o) => s + o.total, 0),
    paidOrdersMonth: paidMonth.length,
    revenueAllTime,
    paidOrders: paid.length,
    aov: paid.length ? Math.round(revenueAllTime / paid.length) : 0,
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    revenueWeekly: weeks.map(({ from, to }) => ({
      label: weekLabel(to),
      value: paid.filter((o) => ts(o.createdAt) >= from && ts(o.createdAt) < to).reduce((s, o) => s + o.total, 0),
    })),
    recentOrders: orders.slice(0, 5),
    topCourses,
    publishedCourses: (db.courses ?? []).filter((c) => c.published).length,
    draftCourses: (db.courses ?? []).filter((c) => !c.published).length,

    newEnquiries: enquiries.filter((e) => e.status === "new").length,
    newThisWeek: enquiries.filter((e) => ts(e.createdAt) >= t - 7 * DAY).length,
    totalEnquiries: enquiries.length,
    conversion: active ? Math.round((enrolled / active) * 100) : 0,
    weekly: weeks.map(({ from, to }) => ({
      label: weekLabel(to),
      value: enquiries.filter((e) => ts(e.createdAt) >= from && ts(e.createdAt) < to).length,
    })),
    pipeline,
    recentEnquiries: enquiries.slice(0, 5),

    mediaCount: db.media.length,
    uploadsCount: db.media.filter((m) => m.source === "upload").length,
    storageBytes: db.media.reduce((sum, m) => sum + (m.size || 0), 0),
    upcomingEvents: upcoming.length,
    nextEvent: upcoming[0] ? { title: upcoming[0].title, date: upcoming[0].date } : null,
    recentMedia: [...db.media].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    greeting,
    today: new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now),
  };
}
