import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";
import { fieldErrors, settingsSchema } from "@/lib/admin/schemas";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const db = await readDb();
  return NextResponse.json({ settings: db.settings });
}

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }

  const settings = await mutateDb((db) => {
    db.settings = parsed.data;
    return db.settings;
  });
  revalidatePath("/");
  return NextResponse.json({ settings });
}
