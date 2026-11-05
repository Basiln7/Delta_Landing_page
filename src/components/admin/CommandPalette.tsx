"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BookPlus,
  CalendarPlus,
  CornerDownLeft,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  PenLine,
  ReceiptText,
  Search,
  Settings,
  Mail,
  MailCheck,
  MessageCircle,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/admin/Overlay";
import { Kbd } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  group: "Navigate" | "Actions";
  icon: ReactNode;
  keywords?: string;
  run: () => void;
}

export const OPEN_PALETTE_EVENT = "admin:command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      { id: "overview", label: "Overview", group: "Navigate", icon: <LayoutDashboard />, keywords: "dashboard home kpi", run: go("/admin") },
      { id: "orders", label: "Orders", group: "Navigate", icon: <ReceiptText />, keywords: "sales revenue payments purchases store", run: go("/admin/orders") },
      { id: "media", label: "Media library", group: "Navigate", icon: <ImageIcon />, keywords: "images video files photos", run: go("/admin/media") },
      { id: "enquiries", label: "Counselling requests", group: "Navigate", icon: <Inbox />, keywords: "enquiries leads inbox counselling calls", run: go("/admin/enquiries") },
      { id: "content", label: "Content", group: "Navigate", icon: <FileText />, keywords: "courses plans pricing instructors batches faq stories", run: go("/admin/content") },
      { id: "settings", label: "Settings", group: "Navigate", icon: <Settings />, keywords: "contact socials", run: go("/admin/settings") },
      { id: "email", label: "Email notifications", group: "Navigate", icon: <Mail />, keywords: "smtp mail notifications gmail credentials sender", run: go("/admin/email") },
      { id: "smtp", label: "Change SMTP credentials", group: "Actions", icon: <MailCheck />, keywords: "email password host server mail", run: go("/admin/email#smtp") },
      { id: "mail-log", label: "View email delivery log", group: "Actions", icon: <Mail />, keywords: "sent failed bounce notifications", run: go("/admin/email#log") },
      { id: "course", label: "Add a course", group: "Actions", icon: <BookPlus />, keywords: "new course catalogue product", run: go("/admin/content?tab=courses&new=1") },
      { id: "pending", label: "Review pending orders", group: "Actions", icon: <ReceiptText />, keywords: "payments unpaid", run: go("/admin/orders?status=pending") },
      { id: "upload", label: "Upload media", group: "Actions", icon: <Upload />, keywords: "add image video new", run: go("/admin/media?upload=1") },
      { id: "new-enq", label: "Review new counselling requests", group: "Actions", icon: <Inbox />, keywords: "unread leads", run: go("/admin/enquiries?status=new") },
      { id: "hero", label: "Edit hero & announcement", group: "Actions", icon: <PenLine />, keywords: "headline banner", run: go("/admin/content?tab=hero") },
      { id: "event", label: "Add a batch or webinar", group: "Actions", icon: <CalendarPlus />, keywords: "event masterclass new batch workshop", run: go("/admin/content?tab=events&new=1") },
      { id: "whatsapp", label: "Change WhatsApp number", group: "Actions", icon: <MessageCircle />, keywords: "chat with us phone number contact", run: go("/admin/settings#whatsapp") },
      { id: "site", label: "Open website", group: "Actions", icon: <ExternalLink />, keywords: "view landing public", run: () => window.open("/", "_blank", "noopener") },
      {
        id: "logout",
        label: "Sign out",
        group: "Actions",
        icon: <LogOut />,
        keywords: "logout exit",
        run: async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/admin/login");
          router.refresh();
        },
      },
    ];
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  const safeActive = Math.min(active, Math.max(filtered.length - 1, 0));

  const execute = (cmd?: Command) => {
    if (!cmd) return;
    close();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((safeActive + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((safeActive - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      execute(filtered[safeActive]);
    }
  };

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${safeActive}"]`)?.scrollIntoView({ block: "nearest" });
  }, [safeActive]);

  let lastGroup = "";

  return (
    <Modal open={open} onClose={close} label="Command palette" className="sm:max-w-xl">
      <div onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search className="size-4 text-ink/40" aria-hidden />
          <input
            data-autofocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search pages and actions…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={filtered[safeActive] ? `cmd-${filtered[safeActive].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-ink/35"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} id="command-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-2" data-lenis-prevent>
          {filtered.length === 0 && <p className="px-3 py-10 text-center text-sm text-ink/50">No matches for “{query}”.</p>}
          {filtered.map((cmd, i) => {
            const header = cmd.group !== lastGroup ? cmd.group : null;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {header && <p className="eyebrow px-3 pt-3 pb-2 text-ink/40">{header}</p>}
                <button
                  id={`cmd-${cmd.id}`}
                  role="option"
                  aria-selected={i === safeActive}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => execute(cmd)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors [&_svg]:size-4",
                    i === safeActive ? "bg-ink text-paper" : "text-ink/80",
                  )}
                >
                  <span className={cn("grid size-8 place-items-center rounded-lg", i === safeActive ? "bg-white/10 text-brass-light" : "bg-paper text-ink/60")}>
                    {cmd.icon}
                  </span>
                  <span className="flex-1">{cmd.label}</span>
                  {i === safeActive && <CornerDownLeft className="opacity-60" aria-hidden />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-paper/40 px-5 py-2.5 text-[0.6875rem] text-ink/50">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd> toggle
          </span>
        </div>
      </div>
    </Modal>
  );
}
