import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { enquiryUpdateSchema } from "@/lib/validators";
import { fieldErrors } from "@/lib/admin/schemas";
import type { EnquiryStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const parsed = enquiryUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }

  const item = await mutateDb((db) => {
    const found = db.enquiries.find((e) => e.id === id);
    if (!found) return null;
    if (parsed.data.status) found.status = parsed.data.status as EnquiryStatus;
    if (parsed.data.notes !== undefined) found.notes = parsed.data.notes;
    return found;
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath("/admin", "layout");
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const ok = await mutateDb((db) => {
    const before = db.enquiries.length;
    db.enquiries = db.enquiries.filter((e) => e.id !== id);
    return db.enquiries.length !== before;
  });
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath("/admin", "layout");
  return NextResponse.json({ ok: true });
}
