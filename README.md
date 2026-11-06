# Delta Markets Academy — Stock Market + AI · Website + Admin

The website for **Delta Markets Academy**, a finance academy from the team behind [Delta AI Academy](https://deltaaiacademy.ai): a flagship course "Master the Stock Market with AI" presented module by module, 4 projects, 12 AI & market tools, short courses, cart + Razorpay checkout, plus an admin panel for content, orders, media and mentor requests.
The full product, UX and engineering plan is in [plan.md](plan.md).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Motion · Lenis · Zod

## Quick start

```bash
npm install
cp .env.example .env.local   # demo admin credentials live here
npm run dev
```

- Website → http://localhost:3000
- Admin → http://localhost:3000/admin (sign in with the credentials in `.env.local`; that account is the **owner**, a super admin who can add everyone else in Admin → Users)

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run db:reset` | Reset demo data: drops the MongoDB database (only if its name starts with `delta`) or moves `storage/db.json` aside; re-seeds from `src/data/seed.ts` on the next request. **Deletes orders and enquiries.** |

## Where things live

```
src/app/(site)/        landing page (server component reading the data store)
src/app/admin/         admin panel (login + 2FA, overview, orders, enquiries, content, media, email, security, settings)
src/app/api/           public enquiry endpoint, auth, admin REST API
src/app/uploads/       serves uploaded files from storage/uploads
src/components/site/   landing sections (Hero + MarketChart, TickerTape, Flagship, Projects, Courses, Pricing, cart/, ...)
src/components/motion/ reusable animation primitives (Reveal, SplitText, Magnetic, Counter, Tilt, Cursor, Preloader, SmoothScroll)
src/components/admin/  admin UI kit
src/data/seed.ts       ALL mock data (copy, people, events, media) — edit here or through the admin
src/lib/db/            data layer: index.ts (API) → mongo-store.ts (MongoDB) or json-store.ts (local file)
src/lib/mail/          SMTP email: transport, templates, delivery log, notification triggers
src/lib/analytics/     unique-visitor tracking + the Overview's visitor stats
src/lib/security/      admin users + roles (users.ts, owner.ts), rate limits, TOTP 2FA, CSP/headers, request guards, upload checks
src/proxy.ts           CSRF origin check for /api, nonce CSP for /admin
storage/               uploads/ (+ db.json when MongoDB isn't configured) — gitignored
```

## Database (MongoDB)

The app stores everything in **MongoDB** when `MONGODB_URI` is set, and falls back to a local JSON file (`storage/db.json`) when it isn't — so it still runs with zero setup.

```
# .env.local
MONGODB_URI=mongodb://127.0.0.1:27017          # local MongoDB service
# MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority   # Atlas
MONGODB_DB=delta_markets
```

- **Layout:** one collection per entity — `courses`, `plans`, `modules`, `projects`, `tools`, `faculty`, `testimonials`, `events`, `faqs`, `stats`, `media`, `orders`, `enquiries`, `processed_events`, `mail_log` — plus `site` (settings, meta, and the encrypted mail settings). Each document's `_id` is the entity id. Editorial collections keep their admin order in `_pos`; orders and enquiries are sorted by `createdAt`.
- **Indexes** (created automatically): `orders.number` (unique), `orders.createdAt`, `orders.status + createdAt`, `orders.gatewayOrderId`, `orders.gatewayPaymentId`, `enquiries.createdAt`, `enquiries.status`, `_pos` on editorial collections.
- **First connection:** an empty database is seeded from `storage/db.json` if it exists (so your current content, orders and settings carry over), otherwise from `src/data/seed.ts`. A non-empty database is never overwritten.
- **Writes:** each change writes only the documents that changed (one insert, replace or delete per document), so an order touches one document.
- **Health check:** `GET /api/health` → `{"ok":true,"store":"mongodb","database":"delta_markets","latencyMs":…}`.
- **Uploaded files** (images, PDFs) are still saved to `storage/uploads/` on disk; only their records are in MongoDB. For serverless hosting, move files to S3, Cloudflare R2 or Cloudinary.

## Email notifications (SMTP)

Email is sent through **any SMTP server** (Gmail / Google Workspace, Microsoft 365, Zoho, Hostinger, SendGrid, Amazon SES, Mailgun, …). The credentials are entered and changed by an admin in **Admin → Email**. Nothing is hard-coded and no redeploy is needed.

### What gets sent

| Email | To | When |
|---|---|---|
| New enquiry | Team recipients (Reply-To = the learner) | The counselling form is submitted |
| Enquiry received | The learner | Same moment, as a confirmation |
| New paid order | Team recipients (Reply-To = the learner) | An order becomes **paid** (demo checkout, Checkout callback or `order.paid` webhook) |
| Order receipt | The learner | Same moment |
| Refund issued | The learner | A refund is issued from Admin → Orders, or Razorpay sends `refund.processed` |

Each email can be switched off on its own, and **Preview** shows it with sample data. Every email is a branded, table-based HTML layout plus a plain-text version. Everything a visitor typed is HTML-escaped.

### Set up

1. **Admin → Email**: pick your provider preset (it fills in host, port and security), then enter the username, password, From name and From email.
   - Gmail and Zoho with 2-step verification need an **app password**, not your normal one.
   - SendGrid's username is literally `apikey`.
2. Click **Test connection**. It connects and signs in without sending anything, and shows a plain-English reason if it fails (wrong password, wrong port/TLS, host not found, …).
3. Add **team recipients**, turn on **Send email notifications**, and **Save**. Saving re-checks the connection.
4. **Send a test** to your own inbox. Every send, sent or failed, appears in the **Delivery log**.

### How credentials are protected

- **Encrypted at rest.** The password is encrypted with AES-256-GCM before it is stored (MongoDB `site/_id:"mail"`). A database dump alone can't reveal it. The key is `CREDENTIALS_ENCRYPTION_KEY` (32 random bytes, base64) in the server environment:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
  Without it, development falls back to a key derived from `SESSION_SECRET`, and the Email page shows a warning. If you change the key later, re-enter the SMTP password.
- **Write-only.** The browser never receives the password or its ciphertext. The form shows "Saved · encrypted" with **Replace** and **Remove**.
- **No credential redirection.** The saved password is reused only with the same host and username. Changing either requires typing the password again, so a hijacked admin session can't point the host at its own server to collect the stored password.
- **Private data.** Mail settings and the delivery log are never part of the public site's data.
- **Validation.** Header-injection characters are rejected in names and addresses. Test sends (5/min) and connection checks (10/min) are rate-limited.

### Reliability

- **Never blocks the request.** Emails are sent **after the response** with Next.js `after()`, through a pooled SMTP connection with 10–20 s timeouts. A slow or broken mail server never delays or breaks the enquiry form, checkout or the Razorpay webhook (which must answer within 5 s).
- **Exactly once per order.** The Checkout callback and the webhook often both report "paid" at the same moment. Each trigger first claims the email on the order (`order.notified`) inside the serialised write queue, and only the winner sends.
  - A failed send releases the claim, so the next trigger retries.
  - A claim left by a crashed process expires after 10 minutes.
- **Delivery log.** The last 200 sends: time, type, recipient, subject, status, error and message id. **Email bodies are never stored.**

### Files

| File | Role |
|---|---|
| `src/lib/mail/shared.ts` | Event list, provider presets, defaults, public (password-free) settings view |
| `src/lib/mail/transport.ts` | nodemailer transport (pooled, cached per config), verify, friendly error messages |
| `src/lib/mail/templates.ts` | HTML + text templates, escaping |
| `src/lib/mail/send.ts` | Decrypt config, send, write the delivery log |
| `src/lib/mail/notify.ts` | Enquiry / order / refund triggers with exactly-once claims |
| `src/lib/mail/settings.ts` | Form input → stored settings, password rules |
| `src/lib/secrets.ts` | AES-256-GCM encryption for stored credentials |
| `src/app/api/admin/mail/` | `GET/PUT` settings, `POST verify`, `POST test`, `GET preview`, `GET/DELETE log` |
| `src/app/admin/(panel)/email/` + `src/components/admin/email/EmailView.tsx` | Admin → Email |

### Testing locally without a real mailbox

Run any local SMTP catcher on port 1025/2525 (for example [Mailpit](https://mailpit.axllent.org/)). In Admin → Email, set host `127.0.0.1`, that port, and security **None (local testing only)**. Every email then lands in the catcher's inbox instead of being delivered.

## Admin users & roles

Everyone who works in the admin gets their own account. **Admin → Users** (super admins only) lists them with their role, status, 2-step status and last sign-in, plus an activity log of every change.

| Role | Can do |
|---|---|
| **Super admin** | Everything: add, edit, disable and delete users, email server settings (Admin → Email), the launch checklist, plus all admin work |
| **Admin** | Orders (incl. refunds), counselling requests, content, media, site settings, and their own account. No users, no email server settings |

The rules are enforced by the server on every API route and page; the menu just hides what a role can't open.

- **The owner:** the account in `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` on the server. It's a super admin that can't be demoted, disabled or deleted, and its password only changes on the server, so there's always a way back in. On first start it took over the existing 2FA and recovery codes.
- **Adding someone:** Users → Add user → name, email, role. They get a one-time link (valid 72 h) to choose their own password; it's emailed when SMTP is set up, otherwise you copy it and send it. Nobody else ever sees their password.
  - The token is in the link's `#fragment`, so it never reaches server logs; only its SHA-256 hash is stored.
- **Managing someone:** click a user to rename them, change their role, send a new link, reset their password (old password stops working, they're signed out), sign them out everywhere, turn off their 2FA (lost phone), disable or delete them. Every change applies to their open sessions immediately.
- **Guardrails:** nobody can change their own role, disable or delete themselves. Granting super admin, deleting a user and turning off someone's 2FA need a fresh code from your authenticator app (when you have 2FA on).
- **Your own account** (any role): Admin → Security → change your name and password, set up 2-step verification, sign out other sessions.
- **Upgrading from the single-admin version:** everyone signs in once more after deploying.
- **Owner lost their phone and recovery codes:** on the server, in `mongosh`:
  ```js
  db.admin_users.updateOne({ _id: "owner" }, { $unset: { totp: "", totpPending: "", recoveryCodes: "" }, $inc: { sessionVersion: 1 } })
  ```

## Visitor stats (unique visitors)

Admin → Overview shows **unique visitors** today, this month and all time, **new visitors** today, a 14-day chart, and today's split into **Registered** (the device has sent an enquiry or started a checkout) and **Other**. Days are counted in India time. Signed-in admins' devices are never counted: once an admin signs in on a device, its earlier days are dropped from the month and chart too. Needs MongoDB; without it nothing is tracked and the Overview says so.

How it works:
- **Front end:** `<VisitTracker />` in the public layout renders nothing and adds no styles. After the page has loaded and the browser is idle (or when the visitor leaves, whichever is first), it sends one fire-and-forget `POST /api/track-visit` with the path, referrer and UTM tags. The home page stays statically generated.
- **Device ID:** a random ID in a first-party cookie `delta_vid` set by the server: httpOnly, `SameSite=Lax`, `Secure` in production, 400 days, and `Path=/api`, so it travels only with API calls.
  - It's HMAC-signed, so invented IDs are treated as new devices, and new devices are rate-limited per IP: the counts can't be inflated by faking cookies.
  - Checkout and enquiries read the same cookie to mark the device Registered. Those forms didn't change, and this step can never make them fail.
  - The signature uses `SESSION_SECRET`. Changing that secret signs every admin out **and** resets visitor IDs: returning visitors count as new once.
- **Ignored:** bots, browsers sending Global Privacy Control or Do Not Track (also when they send an enquiry or check out), automated browsers, and prerendered pages that are never shown.
- **Stored** (`visitors` and `visits` collections): a hash of the device ID, first/last seen, one record per device per day with page views, landing path, referring site (host only), UTM tags and device type (mobile/tablet/desktop).
  - **Not stored:** IP addresses, user agents, names or emails. "Registered" is just a flag; no order or enquiry is linked to the device.
  - Daily visit records expire after 400 days.
- **Queries:** `src/lib/analytics/visitors.ts` → `visitorStats()`. Indexed counts on `visits.day`, `visits.month+vid` and `visitors.firstDay`; the month figure groups that month's visits by device.
- **Privacy:** mention this first-party analytics cookie in your privacy policy. If you get visitors from the EU/UK, ask your lawyer whether a cookie consent banner is needed there.

## Security

What protects the site and the admin, and what the server must be given before launch. **Admin → Security** shows a live checklist of the items below.

### Admin sign-in
- **Two-step verification** (Admin → Security, each user sets up their own): after the password, a 6-digit code from an authenticator app (Google/Microsoft Authenticator, 1Password, …).
  - The secret is stored encrypted, and a code can't be reused.
  - 10 single-use recovery codes are shown once and stored hashed.
  - Turning 2FA off or replacing the codes needs a current code.
- **Sessions** last 12 hours.
  - The cookie is httpOnly, signed with HMAC-SHA256, and named `__Host-delta_admin` in production (HTTPS only, can't be set by subdomains).
  - Every request checks a session version, so **Sign out everywhere else**, enabling 2FA and disabling 2FA revoke all other sessions immediately.
- **Brute-force limits:** 10 failed passwords per IP per 15 minutes, and 30 per account per hour (stops slow distributed guessing). Five wrong 2FA codes burn the sign-in attempt.
- **Credentials:**
  - Production refuses a missing, short or placeholder `SESSION_SECRET`, and the demo or any <12-character `ADMIN_PASSWORD`.
  - Prefer `ADMIN_PASSWORD_HASH` (scrypt) so the password itself is never in the environment:
    ```bash
    npm run hash-password
    ```

### Rate limits (MongoDB-backed, shared by all server instances)
| Endpoint | Limit |
|---|---|
| Sign-in | 10 failures / IP / 15 min · 30 failures / account / hour |
| 2FA code | 5 tries per sign-in · 20 / IP / 15 min |
| Enquiry form | 5 / IP / 10 min · **3 / recipient email / hour** (it sends a confirmation email, so this stops our mail server being used to flood someone's inbox) |
| Checkout | 15 / IP / 10 min |
| Payment callbacks | 40 / IP / 10 min |
| Test email · SMTP check · 2FA / password changes | 5 / min · 10 / min · 10 / 10 min per admin |
| User management | 30 changes / 10 min per super admin |
| Visitor tracking | 600 hits / IP / 10 min · 200 new devices / IP / hour (generous: many visitors can share one IP on office Wi-Fi or mobile networks) |
| Invite / reset links | 20 checks / IP / 15 min (stops link guessing) |

Counters live in the `rate_limits` collection and expire on their own (TTL index). Without MongoDB they're kept in memory. **Run behind a proxy that sets the client IP** (`X-Real-IP` / `X-Forwarded-For`, which Vercel, Cloudflare and Nginx do), or every visitor shares one IP bucket.

### Browser protections
- **Content-Security-Policy:**
  - The admin gets a strict policy: scripts only with a per-request nonce + `strict-dynamic` (set in `src/proxy.ts`).
  - The public site stays statically generated for speed, so its policy can't use nonces. Instead it allows only our own scripts plus Razorpay Checkout, and blocks plugins, `<base>` hijacking, foreign form targets and framing.
- **Other headers:** HSTS (2 years, preload-ready, production only), `X-Frame-Options: DENY`, `nosniff`, `strict-origin-when-cross-origin` referrer, a locked-down `Permissions-Policy`, and COOP. `/admin` and `/api` are `noindex`.
- **CSRF:** cross-site POST/PUT/PATCH/DELETE to `/api/*` is rejected by Origin / `Sec-Fetch-Site`, on top of the SameSite cookie. The Razorpay webhook is exempt; its HMAC signature authenticates it.

### Data and uploads
- Public JSON endpoints read at most a few KB (413 above that).
- Uploads are checked by their **actual bytes** (magic numbers), not the browser's claim. SVGs containing scripts or event handlers are rejected. Uploaded SVGs are also served with a sandboxing CSP.
- SMTP password and 2FA secret are encrypted with AES-256-GCM (`CREDENTIALS_ENCRYPTION_KEY`). Recovery codes are hashed. None of them are ever returned to the browser.
- **Demo checkout is off in production** unless `ALLOW_DEMO_CHECKOUT=true`, so a deploy that forgot its Razorpay keys can't create "paid" orders without payment.
- `/api/health` gives the public only `ok` and latency; database details are for signed-in admins.

### If a secret leaks
| What leaked | Do this |
|---|---|
| `SESSION_SECRET` | Set a new random value and redeploy. Every session is signed out. |
| `CREDENTIALS_ENCRYPTION_KEY` | Set a new key, re-enter the SMTP password, and turn 2FA off and on again (the old secret can't be decrypted). |
| Owner password | Change `ADMIN_PASSWORD_HASH`, restart, then Admin → Security → **Sign out everywhere else**. |
| Another user's password | Admin → Users → the user → **Reset password** (old password and sessions stop working at once). |
| Razorpay keys | Regenerate them in the Razorpay dashboard. |

## Buying a course

1. Add courses (or a membership plan) to the cart — the cart persists in the browser.
2. Apply a coupon: `DELTA10` (10% off) or `LAUNCH20` (20% off).
3. Checkout with name, email, phone and a preferred payment method.
4. Payment runs in one of two modes, chosen automatically on the server:
   - **Razorpay** — when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set. Real (or test-mode) payments through Razorpay Standard Checkout.
   - **Demo** — when the keys are blank. No money moves; the order is saved as paid so you can demo the flow.

## Payments (Razorpay)

Built on Razorpay **Standard Checkout + Orders API + webhooks**, following
[Razorpay's integration guide](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

### How a payment flows

```
Browser (cart)                 Our server                              Razorpay
──────────────                 ──────────                              ────────
Pay ─────────────────────────► POST /api/orders
                               · re-price cart from the catalogue (client sends ids only)
                               · save order as PENDING
                               · orders.create({ amount in paise, receipt }) ───────────► order_…
◄──────────────── key id + order_… + amount
open Checkout (checkout.js) ───────────────────────────────────────────────────────────► learner pays
◄──────────────────────────────────────────── handler(payment_id, order_id, signature)
POST /api/payments/razorpay/verify ─►
                               · HMAC-SHA256(stored order_id|payment_id, key_secret) == signature (constant-time)
                               · payments.fetch → same order, exact amount, captured (captures if only authorized)
                               · mark PAID (idempotent)
◄──────────────── success screen
                               POST /api/webhooks/razorpay ◄──────────────────────────── order.paid / payment.failed / refund.*
                               · verify X-Razorpay-Signature over the RAW body
                               · de-duplicate on x-razorpay-event-id, safe for out-of-order events
```

The webhook is the source of truth: if the learner closes the tab after paying, the order still becomes paid.

### Set up (test mode first)

1. Create a Razorpay account and switch the Dashboard to **Test Mode**.
2. **API keys:** Dashboard → Account & Settings → API Keys → *Generate Key*. Put them in `.env.local`:
   ```
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```
   Restart `npm run dev`. The checkout now shows "Payments are processed securely by Razorpay" and a test-mode notice.
3. **Auto-capture:** Dashboard → Account & Settings → Payment Capture → *Automatic*. (The verify step also captures authorized payments as a fallback, because uncaptured payments are auto-refunded.)
4. **Webhook:** Dashboard → Account & Settings → Webhooks → *Add New Webhook*
   - URL: `https://<your-domain>/api/webhooks/razorpay`
   - Secret: any long random string → also set `RAZORPAY_WEBHOOK_SECRET` to the same value
   - Events: `order.paid`, `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`
   - Webhook URLs must be public. For local testing use a tunnel (Razorpay recommends **zrok**; some popular tunnels are blocked). In Test Mode the OTP for webhook changes is `754081`.
5. **Pay with test details** from Razorpay's [test cards & UPI page](https://razorpay.com/docs/payments/payments/test-card-details/). The order appears in **Admin → Orders** with its Razorpay order and payment IDs.

### Refunds

In **Admin → Orders**, a paid Razorpay order shows **Refund via Razorpay**. That calls the Refunds API (full amount, normal speed); the `refund.processed` webhook confirms it. Razorpay orders' statuses can't be edited by hand, and paid/refunded ones can't be deleted (audit trail). Demo orders keep the manual status controls.

### Go-live checklist

- [ ] **Use a managed MongoDB (e.g. Atlas) with backups** and set `MONGODB_URI` on the host — never run production on the JSON fallback. Move uploads off local disk (S3 / R2 / Cloudinary) if the host's filesystem isn't persistent.
- [ ] Complete Razorpay KYC/activation. Razorpay reviews the website: keep the contact details, Terms, Privacy and Refund policy pages live (the footer links are placeholders today).
- [ ] Generate **Live** keys (`rzp_live_…`) and add them as server-side environment variables on your host — never commit them, never prefix them with `NEXT_PUBLIC_`.
- [ ] Create a **separate webhook in Live Mode** with its own secret.
- [ ] Serve the site over HTTPS and set `NEXT_PUBLIC_SITE_URL` (also used for links in emails).
- [ ] Set a random `SESSION_SECRET` (48+ chars) and `ADMIN_PASSWORD_HASH` (`npm run hash-password`); remove `ADMIN_PASSWORD`.
- [ ] Sign in and turn on **two-step verification** (Admin → Security); store the recovery codes safely. The Launch checklist there should be all green.
- [ ] Add each team member in **Admin → Users** with the lowest role they need (Admin unless they manage people or email settings). Never share the owner login.
- [ ] Set a dedicated `CREDENTIALS_ENCRYPTION_KEY`, configure SMTP in Admin → Email, and set up SPF/DKIM/DMARC for your sending domain so receipts don't land in spam.
- [ ] Do one small real payment and one refund end to end; reconcile with the Razorpay dashboard.
- [ ] Replace the demo coupons in `src/lib/commerce.ts` with coupons managed in the database.

### Files

| File | Role |
|---|---|
| `src/lib/payments/razorpay.ts` | Config from env, SDK client, amount → paise, signature checks, error mapping |
| `src/lib/orders.ts` | Cart pricing, order numbers, idempotent paid/failed transitions |
| `src/app/api/orders/route.ts` | Create order (+ Razorpay order) |
| `src/app/api/payments/razorpay/verify/route.ts` | Verify the Checkout signature and payment |
| `src/app/api/payments/razorpay/failed/route.ts` | Record failed attempts for the admin |
| `src/app/api/webhooks/razorpay/route.ts` | Webhook receiver |
| `src/components/site/cart/razorpay-checkout.ts` | Loads checkout.js and opens Checkout |
| `src/app/api/admin/orders/[id]/route.ts` | Admin refunds through the Refunds API |

## How admin changes reach the website

- Media uploaded to the **campus** collection appears in the *Inside Delta* gallery; the newest **hero** item becomes the large hero image.
- Courses, plans, prices and sale prices are edited in **Admin → Content** and show up in the catalogue and pricing sections.
- Orders from the checkout appear in **Admin → Orders**; counselling requests from the form appear in **Admin → Enquiries**.
- The floating **Chat with us** button (and the WhatsApp links in the FAQ, enquiry section, footer and mobile menu) open a WhatsApp chat via `wa.me`. Change the number or the pre-filled message in **Admin → Settings → WhatsApp chat**; clear the number to hide them all.
- Content edits (hero copy, courses, plans, instructors, batches, FAQs, ...) call `revalidatePath("/")`, so the page updates on the next load.

## Notes

- The name is **Delta Markets Academy** (change it in Admin → Settings → Identity). Phone/WhatsApp (+91 85900 26442), Instagram and the Guinness / KHDA badges come from the parent Delta AI Academy (deltaaiacademy.ai) and are presented as "from the team behind Delta AI Academy". **Mentors, testimonials, course prices, orders and enquiries are mock data** — replace them in Admin → Content. The email `hello@deltaaiacademy.ai` is a placeholder until confirmed.
- Market numbers on the page (chart, ticker, AI note) are **sample data** and labelled as such. The footer and FAQ carry a risk disclaimer (Admin → Settings → Trust & compliance).
- Photos are loaded from Unsplash; if one fails to load, a branded placeholder is shown.
- Data is in MongoDB when `MONGODB_URI` is set (see **Database (MongoDB)**); the JSON file fallback is for zero-setup development only. Uploaded files stay on local disk until moved to object storage.
