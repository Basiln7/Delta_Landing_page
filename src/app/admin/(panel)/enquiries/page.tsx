import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { EnquiriesView } from "@/components/admin/enquiries/EnquiriesView";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Enquiries" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageSession();
  const [db, params] = await Promise.all([readDb(), searchParams]);
  const items = [...db.enquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const status = typeof params.status === "string" && (ENQUIRY_STATUSES as string[]).includes(params.status) ? (params.status as EnquiryStatus) : "all";
  const open = typeof params.open === "string" ? params.open : undefined;

  return <EnquiriesView initialItems={items} initialStatus={status} initialOpenId={open} />;
}
