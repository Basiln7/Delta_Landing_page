import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { collectionSchemas, fieldErrors } from "@/lib/admin/schemas";
import { isCollection, type Row } from "@/lib/admin/collection-guard";

type Ctx = { params: Promise<{ name: string; id: string }> };

/** Replace an item (full validation). */
export async function PUT(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { name, id } = await params;
  if (!isCollection(name)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });

  const parsed = collectionSchemas[name].safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }

  const item = await mutateDb((db) => {
    const rows = db[name] as unknown as Row[];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { id, ...(parsed.data as object) } as Row;
    return rows[idx];
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath("/");
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { name, id } = await params;
  if (!isCollection(name)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });

  const ok = await mutateDb((db) => {
    const rows = db[name] as unknown as Row[];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    return true;
  });
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
