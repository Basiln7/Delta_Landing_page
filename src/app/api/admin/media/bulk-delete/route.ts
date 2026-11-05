import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { bulkDeleteSchema } from "@/lib/admin/schemas";
import { removeUploadedFile } from "@/lib/admin/storage";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = bulkDeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide an array of ids" }, { status: 422 });

  const ids = new Set(parsed.data.ids);
  const removed = await mutateDb((db) => {
    const gone = db.media.filter((m) => ids.has(m.id));
    db.media = db.media.filter((m) => !ids.has(m.id));
    return gone;
  });

  await Promise.all(removed.filter((m) => m.source === "upload").map((m) => removeUploadedFile(m.url)));
  revalidatePath("/");
  return NextResponse.json({ ok: true, deleted: removed.map((m) => m.id) });
}
