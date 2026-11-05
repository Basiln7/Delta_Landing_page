"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
/** true on the client after hydration, false during SSR — without setState-in-effect. */
export function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function Portal({ children }: { children: ReactNode }) {
  const isClient = useIsClient();
  return isClient ? createPortal(children, document.body) : null;
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Open dialogs, innermost last — only the top one reacts to Esc / Tab (nested confirm-in-drawer). */
const dialogStack: symbol[] = [];

/** Esc to close, focus trap, focus restore, scroll lock. */
export function useDialogBehaviour(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const token = Symbol("dialog");
    dialogStack.push(token);
    const isTop = () => dialogStack[dialogStack.length - 1] === token;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = window.setTimeout(() => {
      const node = ref.current;
      if (!node) return;
      const preferred = node.querySelector<HTMLElement>("[data-autofocus]");
      (preferred ?? node.querySelector<HTMLElement>(FOCUSABLE) ?? node).focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      const idx = dialogStack.indexOf(token);
      if (idx !== -1) dialogStack.splice(idx, 1);
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open]);

  return ref;
}

/* ───────── Drawer (right sheet) ───────── */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useDialogBehaviour(open, onClose);
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80]">
            <motion.div
              className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={typeof title === "string" ? title : undefined}
              tabIndex={-1}
              className={cn("absolute inset-y-0 right-0 flex w-full flex-col bg-[#FBFAF7] shadow-2xl outline-none sm:border-l sm:border-line", width)}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7 sm:py-5">
                <div className="min-w-0">
                  <h2 className="display truncate text-[1.75rem]">{title}</h2>
                  {description && <div className="mt-1 text-sm text-ink/55">{description}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
                  <X className="size-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7" data-lenis-prevent>
                {children}
              </div>
              {footer && <div className="flex items-center gap-2 border-t border-line bg-white/70 px-5 py-4 sm:px-7">{footer}</div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/* ───────── Modal (centered) ───────── */
export function Modal({
  open,
  onClose,
  children,
  className,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const ref = useDialogBehaviour(open, onClose);
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-start sm:p-6 sm:pt-[12vh]">
            <motion.div
              className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={label}
              tabIndex={-1}
              className={cn(
                "relative w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:max-w-lg sm:rounded-2xl",
                className,
              )}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/* ───────── Confirm dialog ───────── */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Keep the dialog open — the caller has already surfaced the error.
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} label={title}>
      <div className="p-6">
        <div className="flex gap-4">
          <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tone === "danger" ? "bg-pin/10 text-pin" : "bg-brass/10 text-brass")}>
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 className="display text-2xl">{title}</h2>
            {description && <div className="mt-1.5 text-sm text-ink/60">{description}</div>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={run} loading={busy} data-autofocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
