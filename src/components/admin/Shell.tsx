"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  FileText,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  ReceiptText,
  Search,
  Settings,
  X,
} from "lucide-react";
import { DeltaMark } from "@/components/brand/Logo";
import { CommandPalette, openCommandPalette } from "@/components/admin/CommandPalette";
import { Portal } from "@/components/admin/Overlay";
import { Kbd } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Counts = { newEnquiries: number; pendingOrders: number };

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; badgeKey?: keyof Counts }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText, badgeKey: "pendingOrders" },
  { href: "/admin/enquiries", label: "Counselling", icon: Inbox, badgeKey: "newEnquiries" },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/email", label: "Email", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-3 rounded-lg">
      <DeltaMark className="h-7 text-paper" />
      <span className="flex flex-col leading-none">
        <span className="display text-[1.45rem]">Delta</span>
        <span className="eyebrow mt-1 text-[0.5rem] text-paper/50">Admin studio</span>
      </span>
    </Link>
  );
}

function NavList({ pathname, counts, onNavigate, layoutId }: { pathname: string; counts: Counts; onNavigate?: () => void; layoutId: string }) {
  return (
    <nav aria-label="Admin" className="space-y-1">
      {NAV.map(({ href, label, icon: Icon, badgeKey }) => {
        const active = isActive(pathname, href);
        const badge = badgeKey ? counts[badgeKey] : 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
              active ? "text-paper" : "text-paper/55 hover:text-paper",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.06]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              >
                <span className="absolute top-2.5 bottom-2.5 left-0 w-[2px] rounded-full bg-brass-light" />
              </motion.span>
            )}
            <Icon className={cn("relative size-[18px]", active ? "text-brass-light" : "")} strokeWidth={1.6} />
            <span className="relative flex-1">{label}</span>
            {badge > 0 && (
              <span className="relative rounded-full bg-pin px-1.5 py-0.5 font-mono text-[0.625rem] leading-none text-white tabular-nums">{badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <div className="space-y-3">
      <a
        href="/"
        target="_blank"
        rel="noopener"
        className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm text-paper/70 transition-colors hover:border-brass-light/40 hover:text-paper"
      >
        View website <ArrowUpRight className="size-4" />
      </a>
      <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
        <span className="grid size-9 place-items-center rounded-lg bg-brass/20 font-mono text-xs text-brass-light uppercase">{email.slice(0, 2)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] text-paper">{email}</p>
          <p className="text-[0.6875rem] text-paper/40">Administrator</p>
        </div>
        <button onClick={onLogout} aria-label="Sign out" className="grid size-8 place-items-center rounded-lg text-paper/50 transition-colors hover:bg-white/10 hover:text-paper">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children, email, counts }: { children: ReactNode; email: string; counts: Counts }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  const searchButton = (
    <button
      onClick={openCommandPalette}
      className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-paper/45 transition-colors hover:border-white/20 hover:text-paper/70"
    >
      <Search className="size-4" />
      <span className="flex-1 text-left">Search or jump to…</span>
      <Kbd className="border-white/20">Ctrl K</Kbd>
    </button>
  );

  return (
    <div className="min-h-dvh bg-[#F6F3ED] text-ink">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col overflow-hidden bg-ink px-4 py-6 text-paper lg:flex">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full bg-brass/20 blur-3xl" />
        <DeltaMark className="pointer-events-none absolute -right-16 -bottom-10 h-64 text-white/[0.03]" strokeWidth={0.6} />
        <div className="relative px-2">
          <Brand />
        </div>
        <div className="relative mt-7">{searchButton}</div>
        <p className="eyebrow relative mt-8 mb-3 px-3 text-paper/35">Workspace</p>
        <div className="relative flex-1">
          <NavList pathname={pathname} counts={counts} layoutId="nav-active-desktop" />
        </div>
        <div className="relative">
          <SidebarFooter email={email} onLogout={logout} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-ink px-3 text-paper lg:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="grid size-10 place-items-center rounded-lg hover:bg-white/10">
          <Menu className="size-5" />
        </button>
        <div className="flex-1">
          <Brand />
        </div>
        <button onClick={openCommandPalette} aria-label="Search" className="grid size-10 place-items-center rounded-lg hover:bg-white/10">
          <Search className="size-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <Portal>
        <AnimatePresence>
          {mobileOpen && (
            <div className="fixed inset-0 z-[70] lg:hidden">
              <motion.div className="absolute inset-0 bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
                className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col bg-ink px-4 py-5 text-paper"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 40 }}
              >
                <div className="flex items-center justify-between px-2">
                  <Brand />
                  <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="grid size-9 place-items-center rounded-lg hover:bg-white/10">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="mt-6">{searchButton}</div>
                <div className="mt-6 flex-1">
                  <NavList pathname={pathname} counts={counts} onNavigate={() => setMobileOpen(false)} layoutId="nav-active-mobile" />
                </div>
                <SidebarFooter email={email} onLogout={logout} />
              </motion.aside>
            </div>
          )}
        </AnimatePresence>
      </Portal>

      <main className="lg:pl-[264px]">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12"
        >
          {children}
        </motion.div>
      </main>

      <CommandPalette />
    </div>
  );
}
