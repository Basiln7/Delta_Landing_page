import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mutateDb } from "@/lib/db";
import { notifyEnquiry } from "@/lib/mail/notify";
import { enquirySchema } from "@/lib/validators";
import { uid } from "@/lib/utils";
import type { Enquiry } from "@/lib/types";

/** Public endpoint — the landing page enquiry form posts here; entries appear in Admin → Enquiries. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = enquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { website, ...data } = parsed.data;
  // Honeypot tripped: pretend success, store nothing.
  if (website) return NextResponse.json({ ok: true });

  const enquiry: Enquiry = {
    id: uid("en"),
    ...data,
    phone: data.phone ?? "",
    message: data.message ?? "",
    status: "new",
    notes: "",
    createdAt: new Date().toISOString(),
  };

  await mutateDb((db) => {
    db.enquiries.unshift(enquiry);
  });
  revalidatePath("/admin", "layout");
  // Staff alert + learner confirmation, sent after the response (SMTP never slows the form down).
  after(() => notifyEnquiry(enquiry.id));

  return NextResponse.json({ ok: true, id: enquiry.id }, { status: 201 });
}
