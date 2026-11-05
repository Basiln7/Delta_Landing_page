import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";
import { COLLECTION_PREFIX, collectionSchemas, fieldErrors, reorderSchema } from "@/lib/admin/schemas";
import { isCollection, type Row } from "@/lib/admin/collection-guard";
import { uid } from "@/lib/utils";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { name } = await params;
  if (!isCollection(name)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  const db = await readDb();
  return NextResponse.json({ items: db[name] });
}

/** Create an item. */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { name } = await params;
  if (!isCollection(name)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });

  const parsed = collectionSchemas[name].safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: fieldErrors(parsed.error) }, { status: 422 });
  }

  const item = { id: uid(COLLECTION_PREFIX[name]), ...(parsed.data as object) } as Row;
  await mutateDb((db) => {
    (db[name] as unknown as Row[]).push(item);
  });
  revalidatePath("/");
  return NextResponse.json({ item }, { status: 201 });
}

/** Reorder: body `{ order: string[] }` — ids in their new order. */
export async function PUT(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { name } = await params;
  if (!isCollection(name)) return NextResponse.json({ error: "Unknown collection" }, { status: 404 });

  const parsed = reorderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide { order: string[] }" }, { status: 422 });

  const items = await mutateDb((db) => {
    const rows = db[name] as unknown as Row[];
    const rank = new Map(parsed.data.order.map((id, i) => [id, i]));
    rows.sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
    return rows;
  });
  revalidatePath("/");
  return NextResponse.json({ items });
}
