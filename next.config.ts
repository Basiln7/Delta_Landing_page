import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 85],
  },
  poweredByHeader: false,
  // Node-only SMTP client: load with native require instead of bundling (Next docs: serverExternalPackages).
  serverExternalPackages: ["nodemailer"],
};

export default nextConfig;
