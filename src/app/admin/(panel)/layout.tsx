import type { Metadata } from "next";
import { requirePageSession } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { AdminShell } from "@/components/admin/Shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Delta Admin" },
  robots: { index: false, follow: false },
};

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const db = await readDb();
  const newEnquiries = db.enquiries.filter((e) => e.status === "new").length;
  const pendingOrders = db.orders.filter((o) => o.status === "pending").length;

  return (
    <AdminShell email={session.email} counts={{ newEnquiries, pendingOrders }}>
      {children}
    </AdminShell>
  );
}
