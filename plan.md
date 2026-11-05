# Delta Markets Academy — Finance Landing Page · Product, UX & Engineering Plan (v4)

> Status: v4 — finance landing page redesign · Date: 2026-11-04 · Owner: Design + Engineering
> Brand: **Delta Markets Academy** — a finance academy from the team behind Delta AI Academy (https://deltaaiacademy.ai) · Product: **Master the Stock Market with AI** + short courses
>
> **Why this name:** keeps the Delta family equity (wordmark, WhatsApp, community); "Markets" names exactly what is taught (stock market investing and trading) without the narrowness or tip-culture connotation of "Trading Academy"; it reads as *education*, unlike "Capital" or "Wealth", which suggest an investment adviser or fund (a regulatory risk in India). AI stays at product level ("…with AI"). Considered: Delta Finance Academy (generic), Delta Trading Academy (narrow), Delta Wealth / Capital (advisory connotation).
> v3 adopted the brand colours but kept a school-style layout. v4 redesigns the page as a **finance landing page**, based on the research below. Engineering (cart, Razorpay, admin, data layer) is unchanged.

---

## 1. Research — what high-converting finance landing pages do

Sources: [designrevision — 15 fintech SaaS landing pages (2026)](https://designrevision.com/blog/fintech-saas-landing-pages.md), [utsubo — 12 trust patterns for fintech](https://www.utsubo.com/blog/fintech-website-trust-design-patterns), [Webstacks — fintech websites](https://webstacks.com/blog/fintech-websites), [SEBI press release, 23 Sep 2024](https://www.sebi.gov.in/media-and-notifications/press-releases/sep-2024/updated-sebi-study-reveals-93-of-individual-traders-incurred-losses-in-equity-fando-between-fy22-and-fy24-aggregate-losses-exceed-1-8-lakh-crores-over-three-years_86906.html).

| # | Pattern | Evidence | How we apply it |
|---|---|---|---|
| 1 | **Lead with a pain point in plain money terms**, not features | Top fintech heroes lead with safety or a specific pain point | Hero + a "why most traders lose" section built on SEBI's study: **93% of individual F&O traders lost money FY22–FY24**, avg ≈ ₹2 lakh each (cited, linked) |
| 2 | **Show the product, not stock photos** | Mercury, Brex, Revolut: dashboard previews with realistic numbers | A "Delta terminal" UI in the hero (watchlist, live chart, AI research copilot), project cards drawn as product UI — all labelled *sample* |
| 3 | **Interactive calculators** | Wise, Ramp: show the real numbers before sign-up | SIP growth calculator + position-size (risk) calculator |
| 4 | **Comparison vs alternatives** | Comparison widgets naming 2–3 alternatives build trust | Table: tip groups vs free videos vs signal services vs Delta |
| 5 | **Numeric proof near the hero** | Scale numbers inside or right after the hero | Proof strip: 10,000+ students · 4.9★ · 28 lessons · 12 tools · 4 projects |
| 6 | **Regulatory / guarantee language next to CTAs**, not only the footer | Badges beside CTAs; a framed "protection" block | Price card + pricing: *education only, not investment advice* · secure Razorpay · 7-day refund · certificate with unique ID |
| 7 | **Support availability cue** | Visible support reduces risk perception | "Mentors reply on WhatsApp in minutes · English & Malayalam" near CTAs |
| 8 | **Motion restraint** | One ambient + one user-triggered animation reads as trustworthy | Remove preloader, custom cursor, film grain and smooth-scroll hijacking. Keep the live chart (ambient), calculators (user-triggered) and quiet fade-ins |
| 9 | **Neutral grotesk type, navy/slate + green palette, dark premium sections** | Recurring across fintech leaders | Geist + Geist Mono (tabular numbers), night-navy + snow sections, lime (brand) for actions, emerald/rose for gain/loss |
| 10 | **Transparent pricing, CTA repeated after major sections, sticky header CTA** | SMB fintech shows prices openly | Price on every primary CTA ("Join now — ₹1,999"), sticky header CTA, mobile bottom bar |

---

## 2. Design direction — "Precision fintech"

**Feel:** a calm, data-literate trading desk — confident, transparent, no hype.

| Token | Value | Use |
|---|---|---|
| `night` / `night-2` / `night-3` | `#0A0F1C` / `#0F1626` / `#172036` | dark sections, surfaces, elevated cards |
| `edge` | slate 400 @ 14% | hairlines on dark |
| `mute` | `#94A3B8` | secondary text on dark |
| `snow` / `cloud` | `#F6F8FB` / `#EDF1F7` | light reading sections |
| `ink` | `#14151C` | text on light |
| `brass-light` (brand lime) | `#D3FB52` | primary actions, positive highlights |
| `emerald` / `pin` | `#10B981` / `#F04438` | gain / loss only |
| `sky` | `#8EF3FB` | data lines, info |

- **Type:** Geist (headlines 600, tight tracking, sentence case) · Geist Mono for every number (tabular).
- **Rhythm:** dark (hero, problem, product, calculators, pricing, final CTA) alternating with light (comparison, curriculum, courses, mentors, FAQ).
- **Components:** 16–24px radii, 1px hairlines, soft inner glows on dark cards, no drop-shadow soup.
- **Data honesty:** every market figure says *sample*; every illustrative return says *not guaranteed*.

---

## 3. Page architecture (v4)

```
Announcement   launch price · real end date
Header         Program · Calculators · Curriculum · Courses · Pricing · FAQ  |  Talk to a mentor · Cart · [Join now ₹1,999]
01 Hero        "Invest with a process, not a tip." + Delta terminal (watchlist · live chart · AI copilot) + trust row
   Proof       10,000+ students · 4.9★ · 28 lessons · 12 tools · 4 projects + tools marquee
02 Problem     93% (SEBI FY22–24) · 3 causes → 3 things we teach instead
03 Compare     tip groups vs free videos vs signal services vs Delta
04 Program     8-week roadmap (4 modules) · topics · sticky price card + guarantees
05 Projects    4 projects shown as product UI (report, journal, backtest, alerts)
06 Calculators SIP growth · position size (risk) — illustrative, not advice
07 Courses     short courses catalogue (tabs, search, detail, cart)
08 Mentors     mentors + support cue
09 Stories     learner testimonials (process, never profits)
10 Pricing     Flagship · Pro Trader Pass · Mentorship + guarantee block + certificate preview
11 Seminars    free live seminars & batches
12 FAQ         incl. "Is this investment advice?" / "Guaranteed profits?"
13 Talk to us  mentor form + WhatsApp
Footer         links · contact · full risk disclaimer
```

Removed from the page (still editable or harmless in admin): manifesto scroll-scrub, stacking pillar cards, campus gallery, learning-path bento, panoramic photo band, preloader, cursor, grain, Lenis.

---

## 4. Content & compliance

- SEBI statistic quoted exactly and linked to the press release; used to motivate *education and risk management*, never to promise outcomes.
- Calculators: "Illustrative only. Returns are not guaranteed. Not investment advice."
- Risk disclaimer (admin-editable) in footer; "education only" line beside every price.
- Testimonials describe skills and process — no profit figures.

---

## 5. Engineering

1. **Design system:** tokens + Geist fonts in `globals.css` / `layout.tsx`; CSS utilities `btn-primary`, `btn-ghost-dark`, `btn-ghost-light`, `card-dark`, `card-light`; shared `SectionHeader`.
2. **Site shell:** drop Preloader, Cursor, grain and Lenis; native smooth anchors (`scroll-behavior: smooth`, respects reduced motion).
3. **New components:** `HeroTerminal` (watchlist, chart, AI copilot), `ProofStrip`, `Problem`, `Comparison`, `Calculators` (SIP + position size, pure functions + SVG chart), `Projects` as UI mockups, `Guarantee` + certificate preview.
4. **Restyled:** header, flagship/curriculum, courses + detail modal, mentors, testimonials, pricing, seminars, FAQ, contact, footer, WhatsApp widget.
5. **Data:** seed v4 (hero copy, stats). Cart, Razorpay, orders, admin APIs untouched.
6. **QA:** 375 / 768 / 1440, keyboard, reduced motion, lint, type-check, build, purchase flow.

## 5b. Database — MongoDB (2026-11-05)

- **Driver choice:** `src/lib/db/index.ts` selects MongoDB when `MONGODB_URI` is set, else the local JSON file. Callers (pages, admin, payments, webhooks) are unchanged.
- **Model:** one collection per entity, `_id` = entity id; editorial order in `_pos`; orders/enquiries time-ordered; settings + meta in `site`.
- **Integrity:** unique index on `orders.number`; indexes for gateway ids (webhook lookups) and admin listings; writes are per-document diffs, serialised per process.
- **Migration:** first connection seeds an empty database from `storage/db.json` (keeps current data) or the seed; populated databases are never overwritten — schema changes need an explicit migration.
- **Next:** move Razorpay order creation and webhook updates to targeted atomic operations (`insertOne`, `findOneAndUpdate`) for multi-instance hosting; move uploads to object storage.

## 5c. Email notifications — SMTP configured from the admin (2026-11-05)

**Goal:** the academy can send transactional email through *their own* SMTP provider (Gmail/Workspace, Zoho, Outlook, Hostinger, SendGrid, Amazon SES…), and staff can add or change the SMTP credentials from **Admin → Email** without a developer or a redeploy.

### Requirements
| # | Requirement |
|---|---|
| R1 | Admin form for host, port, security (SSL/TLS · STARTTLS · none), username, password, from name/email, reply-to; provider presets |
| R2 | **Password is write-only**: never returned to the browser, shown only as "saved"; can be replaced or cleared |
| R3 | **Encrypted at rest** (AES-256-GCM) with a key from the server environment, so a database dump alone doesn't leak it |
| R4 | "Verify connection" and "Send test email" before going live, with readable errors (auth failed, wrong port/TLS, timeout) |
| R5 | Notifications (each toggleable): **new enquiry → staff**, **enquiry received → learner**, **new paid order → staff**, **order receipt → learner**, **refund issued → learner**; staff recipient list editable |
| R6 | Email never blocks or breaks checkout/forms — sent after the response (`after()`), failures logged, never thrown to the user |
| R7 | Exactly-once per business event (Razorpay verify + webhook can both mark an order paid) |
| R8 | Delivery log in admin (time, type, recipient, subject, status, error) — capped, no message bodies stored |
| R9 | Branded, responsive HTML + plain-text; all user input HTML-escaped |

### Design
```
Admin → Email page ──PUT /api/admin/mail──► encrypt(password) ──► db.mail   (private: never in public content)
                    ──POST /api/admin/mail/verify | /test

Business event (enquiry / order paid / refund)
   └─► route handler finishes response ──after()──► notify*(…)
                                                       ├─ load db.mail, decrypt, cached nodemailer transport
                                                       ├─ claim once: mark order.notified.{receipt|staff} in DB (idempotency)
                                                       ├─ render template (escaped HTML + text)
                                                       └─ send → append db.mailLog (ok / error)
```
- **Storage:** `mail` (singleton) and `mailLog` (capped at 200) are new *private* keys — excluded from the public content snapshot exactly like orders. MongoDB: `site/_id:"mail"` + `mail_log` collection (time-ordered).
- **Crypto:** `CREDENTIALS_ENCRYPTION_KEY` (32-byte base64) from env; dev fallback derives a key from `SESSION_SECRET` (logged warning). Ciphertext format `v1:iv:tag:data` allows future key rotation.
- **Transport:** `nodemailer`, one pooled transporter cached per config fingerprint; 10s connection/greeting timeouts.
- **Security:** admin-only APIs; test endpoint rate-limited; no secrets in logs; header injection prevented by validated addresses; From must be a valid address (providers reject spoofed senders — use an address of the authenticated domain).
- **Testing:** local SMTP capture server (no external accounts), assertions on received mail, encryption at rest, write-only password, idempotency and failure logging.
- **Later:** a job queue (retries/backoff), DKIM/SPF guidance per provider, learner marketing email (requires consent) — out of scope.

### Status: built ✓ (2026-11-05)
All of R1–R9 are implemented. Two additions were made during the build:
- **Credential-redirection guard:** the saved password is reused only with the same host and username. Changing either requires re-typing it, so a stolen admin session can't redirect the stored password to an attacker's server via "Test connection".
- **Template preview** per email (sample data only), and **verify on save**, which stamps `verifiedAt` and clears it when the connection details change.

The end-to-end suite runs against a local capture SMTP server. It covers:
- encryption at rest and the write-only password
- the public page leaking no mail settings
- readable errors (auth, refused, TLS)
- header-injection rejection
- HTML escaping
- 2 emails per enquiry
- exactly-once under 3 concurrent "paid" triggers
- the refund email sent once
- per-event toggles
- the claim being released and retried after an SMTP outage
- the log storing no bodies
- the rate limit

See README → Email notifications.

## 5d. Security hardening (2026-11-05)

**Goal:** before real money and real learner data, close the gaps an attacker would try first. This builds on the controls already in place: signed httpOnly session, Razorpay HMAC checks, webhook de-duplication, encrypted SMTP password and escaped email input.

### Audit findings
| # | Finding | Risk |
|---|---|---|
| F1 | Session secret falls back to a hard-coded value, and the same value is in `.env.example` (and was copied into `.env.local`) | Anyone with the repo can forge an admin cookie on a server using it |
| F2 | No limit on login attempts | Password brute force |
| F3 | No limits on the public enquiry form, checkout or payment callbacks | Spam, and "email bombing" (our SMTP sends confirmations to any address typed in) |
| F4 | No security headers (CSP, HSTS, framing, nosniff, referrer, permissions) | XSS impact, clickjacking, downgrade |
| F5 | Password-only admin login; 7-day stateless sessions with no way to revoke | A stolen password or cookie means full control |
| F6 | No Origin check on state-changing APIs | CSRF (partly mitigated by SameSite=Lax) |
| F7 | Request bodies unbounded on public JSON endpoints | Memory exhaustion |
| F8 | Demo checkout marks orders **paid** when Razorpay keys are missing, even in production | Free "paid" orders and receipts after a misconfigured deploy |
| F9 | Uploads trust the browser's file type | Disguised files in the media library |
| F10 | `/api/health` and the login screen reveal internals (DB name, where the demo credentials are) | Reconnaissance |

### Design
- **Secrets (F1):** no hard-coded secret. In development, a missing `SESSION_SECRET` becomes a random per-process key. In production the app fails closed on:
  - a missing, short (<32 chars) or known-placeholder secret
  - a placeholder or weak `ADMIN_PASSWORD`

  Optional `ADMIN_PASSWORD_HASH` (scrypt) keeps the plaintext password out of the environment.
- **Rate limits (F2, F3):** fixed-window counters stored in MongoDB (`rate_limits`, cleaned up by a TTL index), so limits hold across restarts and multiple servers. In-memory fallback without Mongo.
  - Login: failures per IP and per account.
  - 2FA codes: per ticket and per IP.
  - Enquiries: per IP and **per recipient email**.
  - Checkout, payment callbacks, test emails and connection checks: per IP or per admin.
- **Headers (F4):**
  - Admin: strict CSP with a per-request nonce + `strict-dynamic`, set in `proxy.ts`.
  - Public site: a CSP without nonces (keeps the page static/ISR), with third parties limited to Razorpay and Unsplash.
  - Everywhere: HSTS (production), `frame-ancestors 'none'`/X-Frame-Options, nosniff, strict referrer, a locked-down Permissions-Policy, COOP; `noindex` on /admin and /api.
- **2FA + sessions (F5):** TOTP (RFC 6238, any authenticator app) with 10 single-use recovery codes, stored hashed.
  - Login is two steps: password, then a signed 5-minute ticket that only the code step accepts.
  - Codes can't be replayed (last used time-step is stored).
  - Sessions are 12 h, carry a `sessionVersion`, and "Sign out everywhere" revokes all of them.
  - The cookie is `__Host-` prefixed in production.
- **CSRF (F6):** `proxy.ts` rejects cross-site POST/PUT/PATCH/DELETE to `/api/*` (Origin / Sec-Fetch-Site). The signed Razorpay webhook is exempt.
- **Body caps (F7):** public JSON endpoints read at most a few KB (413 otherwise).
- **Demo checkout (F8):** disabled in production unless `ALLOW_DEMO_CHECKOUT=true`.
- **Uploads (F9):** file signature (magic bytes) must match the declared type; SVGs with scripts or event handlers are rejected.
- **Recon (F10):**
  - Public health check returns only `ok` and latency; details for admins.
  - The demo-credentials hint is shown in development only.
- **Testing:** an attack script runs against the running app (brute force, forged and tampered cookies, CSRF, flooding, oversized bodies, 2FA replay, recovery codes, revocation, disguised uploads). A production build is checked for headers and for zero CSP violations in the browser.

### Status: built ✓ (2026-11-05)
F1–F10 are fixed. The attack suite passes against a production build (57/57) and in development (56/56). The email suite still passes (39/39). npm audit: 0 vulnerabilities in production dependencies.

Found and fixed during testing:
- **Logout bug:** in production, logout didn't remove the `__Host-` session cookie. Browsers ignore a deletion that lacks `Secure`, which a plain `cookies().delete()` omits. Cookies are now expired with their original attributes, and the attack suite enforces browser cookie-prefix rules so this can't regress.
- **2FA cache in dev:** right after 2FA was turned off, the login route still saw the cached "2FA on" state. Security decisions now read fresh state, and the short cache is process-wide.
- **Recovery-codes dialog:** it could trap an admin if the browser blocks the clipboard. A "written them down" fallback was added.

## 5e. Admin users & roles (2026-11-05)

**Goal:** more than one person can work in the admin, each with their own sign-in, and only trusted people can manage accounts. Two roles: **Super admin** and **Admin**. The existing account becomes a super admin.

### Requirements
- A **Users** page (table) where super admins add, edit, disable, delete and manage admin users.
- Roles: `super_admin` and `admin`. Super admins can create, delete and manage other users; admins can't.
- The existing account (`ADMIN_EMAIL` on the server) becomes a super admin and keeps its 2FA and recovery codes.
- Every rule is enforced on the server (API + page), not just hidden in the menu.

### Who can do what
| Area | Admin | Super admin |
|---|---|---|
| Overview, Orders (incl. refunds), Counselling, Content, Media, Settings | ✓ | ✓ |
| Own account: name, password, 2FA, sessions (Admin → Security) | ✓ | ✓ |
| Email server settings + delivery log (SMTP credentials are server secrets) | – | ✓ |
| Launch checklist (server configuration) | – | ✓ |
| Users: add, change role, disable, delete, reset password / 2FA, activity log | – | ✓ |

### Design
- **Data:** `admin_users` collection (one document per user; unique email index) and `admin_audit` (user-management activity, newest 500 kept). Both are private: never part of the public site's data.
  - A user: name, email, role, disabled flag, scrypt password hash, own 2FA secret (encrypted), recovery codes (hashed), own session version, last sign-in, who created it.
- **The owner account:** the server-configured account (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`) becomes a user with id `owner`, role super admin.
  - Its password stays on the server (so the existing deployment steps still apply, and there's always a way back in).
  - It can't be demoted, disabled, deleted or reset by anyone, so there is always at least one super admin.
  - On first start it takes over the existing 2FA, recovery codes and session version; the old single-admin `security` record is then removed.
- **Adding a user:** a super admin enters name, email and role. The account is created **without a password** and a one-time invite link is made (valid 72 h).
  - The link is shown once to copy, and emailed if SMTP is set up.
  - The token sits in the URL fragment (`/admin/invite#…`), so it never reaches server logs or the Referer header. Only its SHA-256 hash is stored.
  - The new user chooses their own password (12+ characters). Super admins never see or set anyone's password.
- **Reset password:** same flow with a 24 h link. The old password stops working at once and the user is signed out everywhere.
- **Sessions:** the cookie carries the user id. Every request re-reads that user (2 s cache), so a role change, disable, delete or reset takes effect immediately.
  - Disabled, deleted or unknown accounts get the same error and the same response time as a wrong password (no account discovery).
- **Guardrails:**
  - Nobody can change their own role, disable or delete themselves (prevents lockout; your own account is managed on the Security page).
  - Granting super admin, deleting a user and resetting someone's 2FA need a fresh 2FA code from the acting super admin (when they have 2FA on).
  - Rate limits on invite links (per IP) and on user-management actions (per admin).
- **Activity log:** who created, invited, changed, disabled, reset or deleted whom, and when invites were accepted. Shown on the Users page.
- **Upgrade note:** after deploying, everyone signs in once more (old cookies carry no user id).
- **Testing:** an attack suite for roles — admin calling super-admin APIs and pages, self-promotion, demoting/deleting the owner or yourself, invite link reuse/expiry/guessing, disabled and deleted users' live sessions, step-up codes — plus the existing security suite on a production build.

### Status: built ✓ (2026-11-05)
- Users page (table, user drawer, add-user modal, one-time link dialog, activity log), invite / reset page, per-user Security page (name, password, 2FA, sessions), role-aware menu and command palette. Email settings and the launch checklist are super-admin only.
- The roles suite passes on development (58/58) and on a production build (57/57; the legacy-cookie check runs in dev only). The existing security suite still passes on both (56/56 dev, 57/57 production). Every script on the signed-in admin pages carries the CSP nonce, and the browser shows no CSP violations.

Found and fixed during testing:
- **Invite page blocked in production:** it was statically generated, so its scripts couldn't carry the per-request CSP nonce. It now renders per request (`connection()`).
- **Redirect status:** a page redirect after the admin layout starts streaming arrives as an in-page redirect (HTTP 200), not a 307. Admins still never receive super-admin data: the role check runs before any data is loaded, and the suite asserts nothing leaks.
- **Layout:** the users table was too narrow at 1440 px next to the side cards; the cards moved below it.

## 6. Before launch
- Replace mock mentors, testimonials, prices; confirm email; upload brochure.
- MongoDB Atlas (with backups) in production; Razorpay live keys + live webhook (README → Payments).
- Legal review of disclaimer, Terms, Privacy, Refund pages.
