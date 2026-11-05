import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { currentPublicState } from "@/lib/security/admin-api";

/** Admin → Security status: 2FA state, current session, production-readiness checklist. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await currentPublicState(session), { headers: { "Cache-Control": "no-store" } });
}
