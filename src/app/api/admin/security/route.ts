import { NextResponse } from "next/server";
import { sessionOrError } from "@/lib/auth";
import { currentPublicState } from "@/lib/security/admin-api";

/** Admin → Security status for the signed-in user: account, 2FA, current session (+ launch checklist for super admins). */
export async function GET() {
  const auth = await sessionOrError();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await currentPublicState(auth.session), { headers: { "Cache-Control": "no-store" } });
}
