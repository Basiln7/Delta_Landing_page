import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  BookOpen,
  BookPlus,
  CalendarDays,
  Inbox,
  IndianRupee,
  MessageCircle,
  PenLine,
  ReceiptText,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { requirePageSession } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { computeOverview } from "@/lib/admin/metrics";
import { formatPrice } from "@/lib/commerce";
import { PAYMENT_LABEL } from "@/lib/admin/media-meta";
import { formatDate, whatsappHref } from "@/lib/utils";
import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { AreaChart, PipelineBar, RankBars } from "@/components/admin/overview/Charts";
import { MediaThumb } from "@/components/admin/media/MediaThumb";
import { RelativeTime } from "@/components/admin/RelativeTime";
import { OrderStatusBadge } from "@/components/admin/orders/OrdersView";

export const metadata: Metadata = { title: "Overview" };

function Kpi({
  label,
  value,
  sub,
  icon,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(11_19_36/0.45)] " +
        (accent ? "border-ink bg-ink text-paper" : "border-line bg-white")
      }
    >
      <div className="flex items-start justify-between">
        <span className={"grid size-9 place-items-center rounded-xl [&_svg]:size-[18px] " + (accent ? "bg-white/10 text-brass-light" : "bg-paper text-brass")}>
          {icon}
        </span>
        <ArrowUpRight className={"size-4 opacity-0 transition-all group-hover:opacity-60 " + (accent ? "text-paper" : "text-ink")} />
      </div>
      <p className={"eyebrow mt-5 " + (accent ? "text-paper/50" : "text-ink/45")}>{label}</p>
      <p className="display mt-2 truncate text-[2.1rem] leading-none tabular-nums sm:text-[2.6rem]">{value}</p>
      <p className={"mt-2 truncate text-xs " + (accent ? "text-paper/55" : "text-ink/50")}>{sub}</p>
    </Link>
  );
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

export default async function OverviewPage() {
  const session = await requirePageSession();
  const db = await readDb();
  const data = computeOverview(db);
  const money = (n: number) => formatPrice(n, data.currency);
  const wa = db.settings.contact.whatsapp?.trim() ?? "";
  const waLink = whatsappHref(wa, db.settings.contact.whatsappMessage);
  const name = session.name.trim().split(/\s+/)[0] || session.email.split("@")[0];
  const revenue8w = data.revenueWeekly.reduce((s, w) => s + w.value, 0);

  const todo = [
    data.pendingOrders ? `${data.pendingOrders} pending ${data.pendingOrders === 1 ? "order" : "orders"}` : null,
    data.newEnquiries ? `${data.newEnquiries} new counselling ${data.newEnquiries === 1 ? "request" : "requests"}` : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow={data.today}
        title={
          <>
            {data.greeting}, <em className="text-brass capitalize">{name}</em>.
          </>
        }
        description={
          todo.length
            ? `You have ${todo.join(" and ")} waiting. The website promises a reply within one working day.`
            : "You're all caught up — no pending orders or new counselling requests."
        }
        actions={
          <>
            <Link href="/admin/content?tab=courses&new=1" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium hover:border-ink/25">
              <BookPlus className="size-4" /> Add a course
            </Link>
            <Link href="/admin/orders" className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-paper hover:bg-navy">
              <ReceiptText className="size-4" /> View orders
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-label="Key metrics">
        <Kpi
          accent
          label="Revenue this month"
          value={money(data.revenueMonth)}
          sub={`${data.paidOrdersMonth} paid ${data.paidOrdersMonth === 1 ? "order" : "orders"} this month`}
          icon={data.currency.code === "INR" ? <IndianRupee /> : <Wallet />}
          href="/admin/orders?status=paid"
        />
        <Kpi label="All-time revenue" value={money(data.revenueAllTime)} sub={`Avg. order ${money(data.aov)}`} icon={<TrendingUp />} href="/admin/orders?status=paid" />
        <Kpi label="Orders" value={data.totalOrders} sub={`${data.pendingOrders} pending · ${data.paidOrders} paid`} icon={<ReceiptText />} href="/admin/orders" />
        <Kpi
          label="New counselling requests"
          value={data.newEnquiries}
          sub={`${data.newThisWeek} this week · ${data.totalEnquiries} total`}
          icon={<Inbox />}
          href="/admin/enquiries?status=new"
        />
        <Kpi
          label="Published courses"
          value={data.publishedCourses}
          sub={data.draftCourses ? `${data.draftCourses} ${data.draftCourses === 1 ? "draft" : "drafts"}` : "No drafts"}
          icon={<BookOpen />}
          href="/admin/content?tab=courses"
        />
        <Kpi
          label="Batches & webinars"
          value={data.upcomingEvents}
          sub={data.nextEvent ? `Next: ${formatDate(data.nextEvent.date, { day: "numeric", month: "short" })} · ${data.nextEvent.title}` : "Nothing scheduled"}
          icon={<CalendarDays />}
          href="/admin/content?tab=events"
        />
      </section>

      {/* Revenue */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4">
            <p className="eyebrow text-ink/45">Revenue · last 8 weeks</p>
            <p className="display mt-2 text-3xl">
              {money(revenue8w)} <span className="text-ink/40">from paid orders</span>
            </p>
          </div>
          <AreaChart id="revenue" data={data.revenueWeekly} format="currency" currency={data.currency} />
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <p className="eyebrow text-ink/45">Top courses by revenue</p>
            <Link href="/admin/content?tab=courses" className="text-sm text-ink/60 hover:text-ink">
              Courses →
            </Link>
          </div>
          {data.topCourses.length ? (
            <RankBars rows={data.topCourses} currency={data.currency} />
          ) : (
            <p className="py-10 text-center text-sm text-ink/50">No paid course sales yet.</p>
          )}
        </Card>
      </section>

      {/* Orders + pipeline */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <p className="eyebrow text-ink/45">Recent orders</p>
            <Link href="/admin/orders" className="text-sm text-ink/60 hover:text-ink">
              All orders →
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {data.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders?open=${o.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper/40 sm:px-6">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper font-mono text-[0.6875rem] text-ink/60 uppercase">{initials(o.customer.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {o.customer.name} <span className="font-mono text-[0.6875rem] font-normal text-ink/40">{o.number}</span>
                    </p>
                    <p className="truncate text-xs text-ink/50">
                      {o.items.length > 1 ? `${o.items[0].title} +${o.items.length - 1} more` : o.items[0]?.title} · {PAYMENT_LABEL[o.paymentMethod]}
                    </p>
                  </div>
                  <span className={"hidden text-sm font-medium tabular-nums sm:block " + (o.status === "refunded" ? "text-ink/40 line-through" : "")}>
                    {formatPrice(o.total, { ...data.currency, code: o.currency || data.currency.code })}
                  </span>
                  <OrderStatusBadge status={o.status} />
                  <RelativeTime iso={o.createdAt} className="hidden w-24 text-right text-xs text-ink/45 md:block" />
                </Link>
              </li>
            ))}
            {data.recentOrders.length === 0 && <li className="px-6 py-10 text-center text-sm text-ink/50">No orders yet.</li>}
          </ul>
        </Card>
        <Card className="p-5 sm:p-6">
          <p className="eyebrow text-ink/45">Counselling pipeline</p>
          <p className="display mt-2 mb-6 text-3xl">
            {data.conversion}% <span className="text-ink/40">enrolled</span>
          </p>
          <PipelineBar pipeline={data.pipeline} />
        </Card>
      </section>

      {/* Counselling + library */}
      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-line p-5 sm:p-6">
            <p className="eyebrow text-ink/45">Counselling requests · last 8 weeks</p>
            <p className="display mt-2 mb-2 text-3xl">
              {data.weekly.reduce((s, w) => s + w.value, 0)} <span className="text-ink/40">learners asked for help</span>
            </p>
            <AreaChart id="requests" data={data.weekly} unit={["request", "requests"]} />
          </div>
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <p className="eyebrow text-ink/45">Latest requests</p>
            <Link href="/admin/enquiries" className="text-sm text-ink/60 hover:text-ink">
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {data.recentEnquiries.map((e) => (
              <li key={e.id}>
                <Link href={`/admin/enquiries?open=${e.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper/40 sm:px-6">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper font-mono text-[0.6875rem] text-ink/60 uppercase">{initials(e.parentName)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.parentName}</p>
                    <p className="truncate text-xs text-ink/50">
                      {e.program}
                      {e.studentAge ? ` · age ${e.studentAge}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                  <RelativeTime iso={e.createdAt} className="hidden w-24 text-right text-xs text-ink/45 sm:block" />
                </Link>
              </li>
            ))}
            {data.recentEnquiries.length === 0 && <li className="px-6 py-10 text-center text-sm text-ink/50">No counselling requests yet.</li>}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-ink/45">WhatsApp “Chat with us”</p>
              <span
                className={
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
                  (waLink ? "bg-[#25D366]/12 text-[#128C4B]" : "bg-ink/5 text-ink/50")
                }
              >
                <span className={"size-1.5 rounded-full " + (waLink ? "bg-[#25D366]" : "bg-ink/30")} />
                {waLink ? "Live on website" : "Hidden"}
              </span>
            </div>
            <p className="display mt-3 text-3xl tabular-nums">{wa || "No number set"}</p>
            <p className="mt-1 text-xs text-ink/50">Learners tap “Chat with us” to ask about courses, batches and payments on WhatsApp.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/admin/settings#whatsapp"
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-ink px-3.5 text-sm font-medium text-paper hover:bg-navy"
              >
                <MessageCircle className="size-4" /> Change number
              </Link>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-medium hover:border-ink/25"
                >
                  Test chat <ArrowUpRight className="size-3.5" />
                </a>
              )}
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="eyebrow text-ink/45">Recent media</p>
              <Link href="/admin/media" className="text-sm text-ink/60 hover:text-ink">
                Library →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {data.recentMedia.map((m) => (
                <Link key={m.id} href={`/admin/media?open=${m.id}`} className="group overflow-hidden rounded-lg" title={m.title}>
                  <MediaThumb item={m} width={240} className="aspect-square transition-transform duration-500 group-hover:scale-105" />
                </Link>
              ))}
            </div>
          </Card>
          <Card className="p-5 sm:p-6">
            <p className="eyebrow mb-3 text-ink/45">Quick actions</p>
            <div className="grid gap-1">
              {[
                { href: "/admin/content?tab=courses&new=1", label: "Add a course", icon: <BookPlus /> },
                { href: "/admin/content?tab=events&new=1", label: "Schedule a batch or webinar", icon: <CalendarDays /> },
                { href: "/admin/content?tab=hero", label: "Edit hero & announcement", icon: <PenLine /> },
                { href: "/admin/media?upload=1", label: "Upload course images", icon: <Upload /> },
                { href: "/admin/settings#whatsapp", label: "Change WhatsApp number", icon: <MessageCircle /> },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm transition-colors hover:bg-paper/60 [&_svg]:size-4">
                  <span className="grid size-8 place-items-center rounded-lg bg-paper text-brass">{a.icon}</span>
                  <span className="flex-1">{a.label}</span>
                  <ArrowUpRight className="opacity-0 transition-opacity group-hover:opacity-50" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
