import type { NextConfig } from "next";
import { baseSecurityHeaders, siteCsp } from "./src/lib/security/csp";

const dev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 85],
  },
  poweredByHeader: false,
  // Node-only SMTP client: load with native require instead of bundling (Next docs: serverExternalPackages).
  serverExternalPackages: ["nodemailer"],

  // Security headers. The admin's stricter, nonce-based CSP is set per request in src/proxy.ts.
  async headers() {
    return [
      { source: "/:path*", headers: baseSecurityHeaders(dev) },
      {
        // Public pages (static/ISR, so no per-request nonce) — see src/lib/security/csp.ts.
        source: "/((?!admin|api|_next/static|_next/image).*)",
        headers: [{ key: "Content-Security-Policy", value: siteCsp(dev) }],
      },
    ];
  },
};

export default nextConfig;
