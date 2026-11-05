import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";

/** Delivery log (metadata only, newest first, capped at 200 entries). */
export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  const db = await readDb();
  return NextResponse.json({ log: db.mailLog ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  await mutateDb((db) => {
    db.mailLog = [];
  });
  return NextResponse.json({ ok: true });
}
