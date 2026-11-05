import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { fieldErrors, mediaPatchSchema } from "@/lib/admin/schemas";
import { removeUploadedFile } from "@/lib/admin/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const parsed = mediaPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }

  const item = await mutateDb((db) => {
    const found = db.media.find((m) => m.id === id);
    if (!found) return null;
    Object.assign(found, parsed.data, { updatedAt: new Date().toISOString() });
    return found;
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath("/");
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;

  const removed = await mutateDb((db) => {
    const idx = db.media.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    return db.media.splice(idx, 1)[0];
  });
  if (!removed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (removed.source === "upload") await removeUploadedFile(removed.url);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
