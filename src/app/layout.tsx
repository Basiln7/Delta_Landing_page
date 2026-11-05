import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// Neutral grotesk + tabular mono — the fintech standard for trust and legible numbers.
const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Delta Markets Academy — Master the stock market with AI",
    template: "%s · Delta Markets Academy",
  },
  description:
    "Learn investing and trading from zero and use AI tools to research stocks, test strategies and manage risk. Live weekly sessions, Malayalam support, 4 real projects. Guinness World Record holding, KHDA approved academy.",
  keywords: ["stock market course", "stock market course in Malayalam", "AI for trading", "technical analysis course", "investing course Kerala", "trading course Dubai", "Delta Markets Academy"],
  openGraph: {
    type: "website",
    title: "Delta Markets Academy — Master the stock market with AI",
    description: "Investing and trading from zero, powered by AI tools. Live mentors, Malayalam support, 4 real projects.",
    siteName: "Delta Markets Academy",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0f1c" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border !border-line !bg-white !font-sans !text-ink !shadow-xl",
              description: "!text-ink/60",
            },
          }}
        />
      </body>
    </html>
  );
}
