import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const db = await readDb();
  const items = [...db.enquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ items });
}
