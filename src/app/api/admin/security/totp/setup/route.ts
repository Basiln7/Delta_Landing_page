import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { readDb } from "@/lib/db";
import { encryptSecret, encryptionStatus } from "@/lib/secrets";
import { guardSecurityAction } from "@/lib/security/admin-api";
import { generateTotpSecret, otpauthUri } from "@/lib/security/totp";
import { getUser, mutateUser } from "@/lib/security/users";

/**
 * Start 2FA setup for the signed-in user: create a new secret (stored encrypted as "pending" until
 * a valid code confirms the authenticator app has it) and return it as a QR code + manual key.
 * Shown once, over HTTPS, to that user; never logged.
 */
export async function POST() {
  const guard = await guardSecurityAction();
  if ("response" in guard) return guard.response;

  if ((await getUser(guard.session.uid, { fresh: true }))?.totp) return NextResponse.json({ error: "Two-step verification is already on." }, { status: 409 });
  if (!encryptionStatus().available) return NextResponse.json({ error: "Set CREDENTIALS_ENCRYPTION_KEY on the server first." }, { status: 503 });

  const secret = generateTotpSecret();
  await mutateUser(guard.session.uid, (user) => {
    user.totpPending = { secretEnc: encryptSecret(secret), createdAt: new Date().toISOString() };
  });

  const issuer = (await readDb()).settings.name || "Delta Admin";
  const uri = otpauthUri({ secret, account: guard.session.email, issuer });
  const qr = await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#0a0f1c", light: "#ffffff" } });

  return NextResponse.json(
    { secret: secret.match(/.{1,4}/g)?.join(" "), qr, issuer, account: guard.session.email },
    { headers: { "Cache-Control": "no-store" } },
  );
}
