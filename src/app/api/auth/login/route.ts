import { NextResponse } from "next/server";
import { createSession, verifyCredentials } from "@/lib/auth";
import { loginSchema } from "@/lib/admin/schemas";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  if (!verifyCredentials(email, password)) {
    // Small, jittered delay to blunt brute-force and timing probes.
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
    return NextResponse.json({ error: "Those credentials do not match our records." }, { status: 401 });
  }

  await createSession(email.trim().toLowerCase());
  return NextResponse.json({ ok: true });
}
