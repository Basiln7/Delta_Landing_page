/**
 * Content-Security-Policy and security headers. Pure module (no Node or Next imports) so both
 * next.config.ts and src/proxy.ts can use it.
 *
 * Two policies:
 *  - ADMIN (dynamic pages): strict — scripts only with a per-request nonce + 'strict-dynamic'.
 *  - SITE  (public, statically generated for speed): no nonce possible, so scripts allow
 *    'unsafe-inline' for Next's inline bootstrap, but every other directive is locked down and the
 *    only third parties are Razorpay (checkout) and Unsplash (images). The public page renders no
 *    user-supplied HTML, which is what makes this trade-off acceptable.
 */

const RAZORPAY_SCRIPTS = "https://checkout.razorpay.com https://cdn.razorpay.com";
const RAZORPAY_ANY = "https://*.razorpay.com";
const IMAGES = "https://images.unsplash.com";

/** Only upgrade sub-resources when the site is actually served over https (set NEXT_PUBLIC_SITE_URL). */
function httpsSite() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
}

function join(directives: Record<string, string | false>) {
  return Object.entries(directives)
    .filter(([, v]) => v !== false)
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join("; ");
}

export function siteCsp(dev: boolean) {
  return join({
    "default-src": "'self'",
    "script-src": `'self' 'unsafe-inline' ${RAZORPAY_SCRIPTS}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src": "'self' 'unsafe-inline'",
    "img-src": `'self' data: blob: ${IMAGES} ${RAZORPAY_ANY}`,
    "font-src": "'self' data:",
    "media-src": "'self' blob:",
    "connect-src": `'self' ${RAZORPAY_ANY}${dev ? " ws: wss:" : ""}`,
    "frame-src": RAZORPAY_ANY,
    "worker-src": "'self' blob:",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
    "upgrade-insecure-requests": !dev && httpsSite() ? "" : false,
  });
}

export function adminCsp(nonce: string, dev: boolean) {
  return join({
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes come from React/Motion animations and email previews; style
    // injection can't run code, so allowing it is the standard trade-off.
    "style-src": "'self' 'unsafe-inline'",
    "img-src": `'self' data: blob: ${IMAGES}`,
    "font-src": "'self' data:",
    "media-src": "'self' blob:",
    "connect-src": `'self'${dev ? " ws: wss:" : ""}`,
    "frame-src": "'self'",
    "worker-src": "'self' blob:",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
    "upgrade-insecure-requests": !dev && httpsSite() ? "" : false,
  });
}

/** Headers for every response. HSTS only in production (it's ignored over plain http anyway). */
export function baseSecurityHeaders(dev: boolean): { key: string; value: string }[] {
  return [
    ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }, // Razorpay may open bank/UPI pop-ups
    { key: "X-DNS-Prefetch-Control", value: "on" },
    {
      key: "Permissions-Policy",
      // payment=(self) keeps the Payment Request API available to our own checkout.
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), usb=(), serial=(), hid=(), payment=(self \"https://checkout.razorpay.com\" \"https://api.razorpay.com\")",
    },
  ];
}
