import { NextResponse } from "next/server";
import { dataStoreHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + data-store check for uptime monitors and deploy smoke tests. */
export async function GET() {
  try {
    const db = await dataStoreHealth();
    return NextResponse.json({ ok: true, ...db });
  } catch (err) {
    console.error("[health] data store unreachable", err);
    return NextResponse.json({ ok: false, error: "Data store unreachable" }, { status: 503 });
  }
}
