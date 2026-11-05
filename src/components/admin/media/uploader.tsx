"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, ChevronDown, LoaderCircle, X } from "lucide-react";
import { uploadWithProgress, validateFile } from "@/lib/admin/client";
import { Portal } from "@/components/admin/Overlay";
import type { MediaCollection, MediaItem } from "@/lib/types";
import { cn, formatBytes, uid } from "@/lib/utils";

export interface UploadJob {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

const CONCURRENCY = 3;

/** Queue + concurrency-limited XHR uploads with per-file progress. */
export function useUploader(onUploaded: (item: MediaItem) => void) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  const update = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const upload = useCallback(
    async (files: File[], collection: MediaCollection) => {
      if (files.length === 0) return;
      const batch = files.map((file) => ({ file, id: uid("up"), error: validateFile(file) }));
      setJobs((js) => [
        ...batch.map<UploadJob>(({ file, id, error }) => ({
          id,
          name: file.name,
          size: file.size,
          progress: 0,
          status: error ? "error" : "queued",
          error: error ?? undefined,
        })),
        ...js,
      ]);

      const valid = batch.filter((b) => !b.error);
      let cursor = 0;
      let ok = 0;
      const worker = async () => {
        while (cursor < valid.length) {
          const job = valid[cursor++];
          update(job.id, { status: "uploading" });
          try {
            const item = await uploadWithProgress(job.file, collection, (p) => update(job.id, { progress: p }));
            update(job.id, { status: "done", progress: 100 });
            onUploadedRef.current(item);
            ok++;
          } catch (err) {
            update(job.id, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, valid.length) }, worker));

      const failed = files.length - ok;
      if (ok && !failed) toast.success(`${ok} ${ok === 1 ? "file" : "files"} uploaded`);
      else if (ok && failed) toast.warning(`${ok} uploaded, ${failed} failed`);
      else toast.error(failed === 1 ? "Upload failed" : `${failed} uploads failed`);
    },
    [update],
  );

  const clearFinished = useCallback(() => {
    setJobs((js) => js.filter((j) => j.status === "uploading" || j.status === "queued"));
  }, []);

  return { jobs, upload, clearFinished };
}

export function UploadTray({ jobs, onClear }: { jobs: UploadJob[]; onClear: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const active = jobs.filter((j) => j.status === "uploading" || j.status === "queued").length;
  const done = jobs.filter((j) => j.status === "done").length;
  const failed = jobs.filter((j) => j.status === "error").length;

  return (
    <Portal>
      <AnimatePresence>
        {jobs.length > 0 && (
          <motion.section
            aria-label="Uploads"
            aria-live="polite"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed right-4 bottom-4 left-4 z-[95] overflow-hidden rounded-2xl border border-white/10 bg-ink text-paper shadow-2xl sm:left-auto sm:w-[380px]"
          >
            <header className="flex items-center gap-3 px-4 py-3">
              {active ? <LoaderCircle className="size-4 animate-spin text-brass-light" /> : <CheckCircle2 className="size-4 text-emerald-400" />}
              <p className="flex-1 text-sm">
                {active ? `Uploading ${done + 1 > jobs.length ? jobs.length : done + 1} of ${jobs.length - failed}` : `${done} uploaded${failed ? ` · ${failed} failed` : ""}`}
              </p>
              <button
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
                className="grid size-7 place-items-center rounded-lg text-paper/60 hover:bg-white/10"
              >
                <ChevronDown className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
              </button>
              {!active && (
                <button onClick={onClear} aria-label="Dismiss uploads" className="grid size-7 place-items-center rounded-lg text-paper/60 hover:bg-white/10">
                  <X className="size-4" />
                </button>
              )}
            </header>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.ul
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="max-h-72 overflow-y-auto border-t border-white/10"
                  data-lenis-prevent
                >
                  {jobs.map((j) => (
                    <li key={j.id} className="border-b border-white/5 px-4 py-3 last:border-0">
                      <div className="flex items-center gap-3">
                        <p className="min-w-0 flex-1 truncate text-[0.8125rem]">{j.name}</p>
                        <span className="font-mono text-[0.625rem] text-paper/40">{formatBytes(j.size)}</span>
                        {j.status === "done" && <CheckCircle2 className="size-4 text-emerald-400" />}
                        {j.status === "error" && <AlertCircle className="size-4 text-pin" />}
                        {(j.status === "uploading" || j.status === "queued") && (
                          <span className="w-9 text-right font-mono text-[0.6875rem] text-brass-light tabular-nums">{j.progress}%</span>
                        )}
                      </div>
                      {j.status === "error" ? (
                        <p className="mt-1 text-xs text-[#f19a86]">{j.error}</p>
                      ) : (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            className={cn("h-full rounded-full", j.status === "done" ? "bg-emerald-400" : "bg-brass-light")}
                            animate={{ width: `${j.progress}%` }}
                            transition={{ ease: "easeOut", duration: 0.3 }}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </Portal>
  );
}
