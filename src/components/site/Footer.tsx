"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUp, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { whatsappHref } from "@/lib/utils";
import { scrollToTarget } from "@/components/motion/SmoothScroll";
import type { SiteSettings } from "@/lib/types";

const COLUMNS = [
  {
    title: "Learn",
    links: [
      { label: "The flagship program", href: "#learn" },
      { label: "Projects", href: "#projects" },
      { label: "Calculators", href: "#calculators" },
      { label: "Short courses", href: "#courses" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Mentors", href: "#faculty" },
      { label: "Free seminars", href: "#events" },
      { label: "FAQ & refunds", href: "#faq" },
      { label: "Talk to a mentor", href: "#enquire" },
    ],
  },
];

export function Footer({ settings }: { settings: SiteSettings }) {
  const [email, setEmail] = useState("");
  const wa = whatsappHref(settings.contact.whatsapp, settings.contact.whatsappMessage);

  return (
    <footer className="relative overflow-hidden border-t border-edge bg-night text-white">
      <div className="container-x pt-16 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo className="text-white" />
            <p className="display mt-8 text-3xl sm:text-4xl">
              Market notes from <span className="text-brass-light">delta</span>
            </p>
            <p className="mt-3 max-w-sm text-mute">A weekly note on markets, AI tools and new batches. Education only — never tips.</p>
            <form
              className="mt-6 flex max-w-md items-center gap-2 rounded-full border border-edge bg-night-2 p-1.5 transition-colors focus-within:border-brass-light/60"
              onSubmit={(e) => {
                e.preventDefault();
                if (!/^\S+@\S+\.\S+$/.test(email)) {
                  toast.error("Please enter a valid email");
                  return;
                }
                setEmail("");
                toast.success("You're on the list", { description: "Your first market note is on its way." });
              }}
            >
              <label htmlFor="newsletter" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-mute/70"
              />
              <button type="submit" aria-label="Subscribe" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass-light text-ink transition-colors hover:bg-[#c7f23a]">
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="lg:col-span-2">
              <p className="eyebrow text-mute/80">{col.title}</p>
              <ul className="mt-5 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-white/75 transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="lg:col-span-3">
            <p className="eyebrow text-mute/80">Contact</p>
            <address className="mt-5 space-y-3 text-sm not-italic text-white/75">
              <p>{settings.contact.address}</p>
              <p>
                <a href={`mailto:${settings.contact.email}`} className="transition-colors hover:text-white">
                  {settings.contact.email}
                </a>
              </p>
              <p className="num">{settings.contact.phone}</p>
              {wa && (
                <p>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 transition-colors hover:text-white">
                    <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> Chat on WhatsApp
                  </a>
                </p>
              )}
              <p className="text-mute">{settings.contact.hours}</p>
            </address>
            <ul className="mt-6 flex flex-wrap gap-2">
              {settings.socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    {...(s.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="inline-block rounded-full border border-edge px-3.5 py-1.5 text-xs text-white/70 transition-colors hover:border-brass-light/60 hover:text-brass-light"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Quiet wordmark */}
      <div className="container-x relative mt-14 select-none" aria-hidden="true">
        <span className="display block text-[22vw] leading-[0.8] tracking-[-0.06em] text-white/[0.05]">delta</span>
      </div>

      {settings.riskDisclaimer && (
        <div className="container-x border-t border-edge py-6">
          <p className="flex max-w-5xl gap-3 text-[0.72rem] leading-relaxed text-mute">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mute" />
            <span>
              <span className="font-semibold text-white/80">Risk disclaimer: </span>
              {settings.riskDisclaimer}
            </span>
          </p>
        </div>
      )}

      <div className="container-x flex flex-col gap-4 border-t border-edge py-7 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
        <p>
          © <span className="num">{new Date().getFullYear()}</span> {settings.name}. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <a href="#" className="transition-colors hover:text-white">Privacy</a>
          <a href="#" className="transition-colors hover:text-white">Refund policy</a>
          <Link href="/admin" className="transition-colors hover:text-white">Staff login</Link>
          <button
            type="button"
            onClick={() => scrollToTarget("#top", 0)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-edge text-white transition-colors hover:bg-white/[0.06]"
            aria-label="Back to top"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
