import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dataStoreHealth } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + data-store check for uptime monitors and deploy smoke tests. */
export async function GET() {
  try {
    const db = await dataStoreHealth();
    // Public monitors get liveness only; which store/database we run is for signed-in admins.
    const detailed = await getSession().catch(() => null);
    return NextResponse.json(detailed ? { ok: true, ...db } : { ok: true, latencyMs: db.latencyMs }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[health] data store unreachable", err);
    return NextResponse.json({ ok: false, error: "Data store unreachable" }, { status: 503 });
  }
}
