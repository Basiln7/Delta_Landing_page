import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { registerVisitorAfterResponse } from "@/lib/analytics/visitors";
import { mutateDb } from "@/lib/db";
import { notifyEnquiry } from "@/lib/mail/notify";
import { consume, LIMITS } from "@/lib/security/rate-limit";
import { clientIp, readJson, tooManyRequests } from "@/lib/security/request";
import { enquirySchema } from "@/lib/validators";
import { uid } from "@/lib/utils";
import type { Enquiry } from "@/lib/types";

/** Public endpoint — the landing page enquiry form posts here; entries appear in Admin → Enquiries. */
export async function POST(req: Request) {
  const ipLimit = await consume(LIMITS.enquiryIp(clientIp(req)));
  if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfter, "You've sent a few requests already. Please wait a few minutes, or message us on WhatsApp.");

  const body = await readJson(req, 16 * 1024);
  if (!body.ok) return body.response;

  const parsed = enquirySchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { website, ...data } = parsed.data;
  // Honeypot tripped: pretend success, store nothing.
  if (website) return NextResponse.json({ ok: true });

  // Per-recipient cap: the form triggers a confirmation email to the address typed in, so without
  // this anyone could use our mail server to flood a stranger's inbox.
  const emailLimit = await consume(LIMITS.enquiryEmail(data.email));
  if (!emailLimit.ok) return tooManyRequests(emailLimit.retryAfter, "We already have your request. A mentor will reply soon. For anything urgent, message us on WhatsApp.");

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
  // Visitor stats: this device now counts as Registered.
  await registerVisitorAfterResponse(after);

  return NextResponse.json({ ok: true, id: enquiry.id }, { status: 201 });
}
