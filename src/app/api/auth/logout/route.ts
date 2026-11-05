import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

/** Clears the session and any pending 2FA ticket (stateless tokens: use "Sign out everywhere" to revoke copies). */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
