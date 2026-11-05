"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, ShoppingBag, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { cart, useCart } from "@/components/site/cart/store";
import { cn, whatsappHref } from "@/lib/utils";
import type { SiteSettings } from "@/lib/types";

const NAV = [
  { href: "#learn", label: "Program" },
  { href: "#projects", label: "Projects" },
  { href: "#calculators", label: "Calculators" },
  { href: "#courses", label: "Courses" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

function CartButton() {
  const { items } = useCart();
  const count = items.length;
  return (
    <button
      type="button"
      onClick={() => cart.open()}
      aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-edge text-white transition-colors hover:bg-white/10"
    >
      <ShoppingBag className="h-[18px] w-[18px]" />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pin px-1 text-[0.65rem] font-semibold text-white"
          >
            {count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export function Header({ settings, ctaLabel = "Join now" }: { settings: SiteSettings; ctaLabel?: string }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 40);
    setHidden(y > prev && y > 420 && !open);
  });

  // Highlight the section currently in view.
  useEffect(() => {
    const sections = NAV.map((n) => document.querySelector(n.href)).filter(Boolean) as Element[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const { announcement } = settings;
  const wa = whatsappHref(settings.contact.whatsapp, settings.contact.whatsappMessage);

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50"
        animate={{ y: hidden ? "-100%" : "0%" }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Announcement */}
        <AnimatePresence initial={false}>
          {announcement.enabled && !scrolled && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-b border-edge bg-night-2 text-white"
            >
              <div className="container-x flex items-center justify-center gap-3 py-2.5 text-[0.8rem]">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass-light opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-brass-light" />
                </span>
                <p className="truncate text-white/75">{announcement.text}</p>
                <a href={announcement.href} className="link-underline hidden shrink-0 items-center gap-1 font-medium text-brass-light sm:inline-flex">
                  {announcement.linkLabel} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main bar */}
        <div
          className={cn(
            "transition-[background-color,border-color,backdrop-filter] duration-500",
            scrolled ? "border-b border-edge bg-night/80 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
          )}
        >
          <nav aria-label="Primary" className="container-x flex h-16 items-center justify-between gap-6">
            <Link href="/" aria-label={`${settings.name} — home`} className="relative z-10 text-white">
              <Logo />
            </Link>

            <ul className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={cn(
                      "relative rounded-full px-3.5 py-2 text-[0.88rem] transition-colors",
                      active === item.href ? "text-white" : "text-mute hover:text-white",
                    )}
                  >
                    {active === item.href && (
                      <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-full bg-white/[0.07]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                    )}
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 sm:gap-3">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 text-[0.88rem] text-mute transition-colors hover:text-white xl:inline-flex">
                  <WhatsAppIcon className="h-4 w-4 text-[#25D366]" /> Talk to a mentor
                </a>
              )}
              <CartButton />
              <a href="#learn" className="btn-primary hidden h-10 px-5 text-[0.88rem] sm:inline-flex">
                {ctaLabel} <ArrowRight className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="mobile-menu"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-edge text-white lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </nav>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-[80] flex flex-col bg-night text-white"
            initial={{ clipPath: "circle(0% at calc(100% - 2.5rem) 2.5rem)" }}
            animate={{ clipPath: "circle(150% at calc(100% - 2.5rem) 2.5rem)" }}
            exit={{ clipPath: "circle(0% at calc(100% - 2.5rem) 2.5rem)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="container-x flex h-[4.5rem] items-center justify-between">
              <Logo className="text-white" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                autoFocus
                className="flex h-11 w-11 items-center justify-center rounded-full border border-edge"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="container-x mt-8 flex flex-1 flex-col gap-1">
              {[...NAV, { href: "#enquire", label: "Talk to a mentor" }].map((item, i) => (
                <li key={item.href} className="overflow-hidden border-b border-line-light">
                  <motion.a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.25 + i * 0.06, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-baseline justify-between py-3"
                  >
                    <span className="display text-5xl">{item.label}</span>
                    <span className="num text-xs text-mute">0{i + 1}</span>
                  </motion.a>
                </li>
              ))}
            </ul>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="container-x flex flex-col gap-1 pb-10 text-sm text-mute"
            >
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 inline-flex h-12 w-fit items-center gap-2.5 rounded-full bg-[#25D366] pl-2 pr-5 font-semibold text-[#073b1f]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/40">
                    <WhatsAppIcon className="h-4 w-4" />
                  </span>
                  Chat with us on WhatsApp
                </a>
              )}
              <a href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a>
              <span>{settings.contact.phone}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
