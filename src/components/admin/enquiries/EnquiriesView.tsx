"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ChevronRight, Download, Inbox, Mail, Phone, Search, Trash2 } from "lucide-react";
import { api, downloadCsv } from "@/lib/admin/client";
import { PROGRAM_OPTIONS } from "@/lib/validators";
import { Button, EmptyState, Field, Input, PageHeader, Segmented, Select, STATUS_META, StatusBadge, Textarea } from "@/components/admin/ui";
import { ConfirmDialog, Drawer } from "@/components/admin/Overlay";
import { RelativeTime } from "@/components/admin/RelativeTime";
import { ENQUIRY_STATUSES, type Enquiry, type EnquiryStatus } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type StatusFilter = EnquiryStatus | "all";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function EnquiriesView({
  initialItems,
  initialStatus = "all",
  initialOpenId,
}: {
  initialItems: Enquiry[];
  initialStatus?: StatusFilter;
  initialOpenId?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [program, setProgram] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);

  const [prevProps, setPrevProps] = useState({ initialStatus, initialOpenId });
  if (prevProps.initialStatus !== initialStatus || prevProps.initialOpenId !== initialOpenId) {
    setPrevProps({ initialStatus, initialOpenId });
    setStatus(initialStatus);
    if (initialOpenId) setOpenId(initialOpenId);
  }

  const counts = useMemo(() => {
    const c = Object.fromEntries([["all", items.length], ...ENQUIRY_STATUSES.map((s) => [s, 0])]) as Record<StatusFilter, number>;
    items.forEach((i) => c[i.status]++);
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (status === "all" || i.status === status) &&
        (program === "all" || i.program === program) &&
        (!q || `${i.parentName} ${i.email} ${i.phone} ${i.message} ${i.notes}`.toLowerCase().includes(q)),
    );
  }, [items, status, program, query]);

  const open = items.find((i) => i.id === openId) ?? null;

  const patchLocal = (updated: Enquiry) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));

  const exportCsv = () => {
    downloadCsv(`delta-counselling-requests-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Received", "Name", "Email", "Phone", "Interested in", "Age", "Status", "Message", "Notes"],
      ...visible.map((e) => [e.createdAt, e.parentName, e.email, e.phone, e.program, e.studentAge, STATUS_META[e.status].label, e.message, e.notes]),
    ]);
    toast.success(`Exported ${visible.length} ${visible.length === 1 ? "request" : "requests"}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Counselling"
        title="Counselling requests"
        description="Learners who asked for help choosing a course. Move them through the pipeline as you follow up."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={!visible.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4">
        <Segmented
          layoutId="enq-status"
          value={status}
          onChange={setStatus}
          options={(["all", ...ENQUIRY_STATUSES] as StatusFilter[]).map((s) => ({
            value: s,
            label: s === "all" ? "All" : STATUS_META[s].label,
            count: counts[s],
          }))}
        />
      </div>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink/35" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, message or notes…" className="pl-10" aria-label="Search counselling requests" />
        </div>
        <Select value={program} onChange={(e) => setProgram(e.target.value)} className="sm:w-56" aria-label="Filter by interest">
          <option value="all">All interests</option>
          {PROGRAM_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title={items.length ? "Nothing here" : "No requests yet"}
          description={items.length ? "No requests match these filters." : "When a learner asks for counselling on the website, the request lands here."}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8rem_7rem_1.5rem] gap-4 border-b border-line bg-paper/40 px-5 py-2.5 md:grid">
            {["Learner", "Interested in", "Status", "Received", ""].map((h) => (
              <span key={h} className="eyebrow text-[0.5625rem] text-ink/40">
                {h}
              </span>
            ))}
          </div>
          <motion.ul layout className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {visible.map((e) => (
                <motion.li key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    onClick={() => setOpenId(e.id)}
                    className="group grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3.5 text-left transition-colors hover:bg-paper/40 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8rem_7rem_1.5rem] md:gap-4 md:px-5"
                  >
                    {/* Mobile avatar */}
                    <span className="grid size-10 place-items-center rounded-full bg-paper font-mono text-[0.6875rem] text-ink/60 md:hidden">{initials(e.parentName)}</span>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="hidden size-9 shrink-0 place-items-center rounded-full bg-paper font-mono text-[0.6875rem] text-ink/60 md:grid">{initials(e.parentName)}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          {e.status === "new" && <span className="size-1.5 shrink-0 rounded-full bg-pin" aria-label="Unread" />}
                          <span className={cn("truncate text-sm", e.status === "new" ? "font-semibold" : "font-medium")}>{e.parentName}</span>
                        </span>
                        <span className="block truncate text-xs text-ink/50">
                          <span className="md:hidden">
                            {e.program}
                            {e.studentAge ? ` · age ${e.studentAge}` : ""}
                          </span>
                          <span className="hidden md:inline">{e.email}</span>
                        </span>
                      </span>
                    </span>
                    <span className="md:hidden">
                      <StatusBadge status={e.status} />
                    </span>
                    <span className="hidden min-w-0 md:block">
                      <span className="block truncate text-sm text-ink/70">{e.program}</span>
                      {e.studentAge && <span className="block font-mono text-[0.6875rem] text-ink/45">age {e.studentAge}</span>}
                    </span>
                    <span className="hidden md:block">
                      <StatusBadge status={e.status} />
                    </span>
                    <RelativeTime iso={e.createdAt} className="hidden text-xs text-ink/50 md:block" />
                    <ChevronRight className="hidden size-4 text-ink/25 transition-transform group-hover:translate-x-0.5 group-hover:text-ink/60 md:block" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </div>
      )}

      <Drawer
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open?.parentName ?? "Counselling request"}
        description={
          open ? (
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={open.status} /> Received {formatDate(open.createdAt, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          ) : null
        }
      >
        {open && (
          <EnquiryDetails
            key={open.id}
            enquiry={open}
            onChange={(u) => {
              patchLocal(u);
              router.refresh();
            }}
            onDeleted={() => {
              setItems((prev) => prev.filter((i) => i.id !== open.id));
              setOpenId(null);
              router.refresh();
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function EnquiryDetails({ enquiry, onChange, onDeleted }: { enquiry: Enquiry; onChange: (e: Enquiry) => void; onDeleted: () => void }) {
  const [notes, setNotes] = useState(enquiry.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [pending, setPending] = useState<EnquiryStatus | null>(null);
  const [confirm, setConfirm] = useState(false);

  const setStatus = async (status: EnquiryStatus) => {
    if (status === enquiry.status) return;
    setPending(status);
    try {
      const { item } = await api<{ item: Enquiry }>(`/api/admin/enquiries/${enquiry.id}`, { method: "PATCH", json: { status } });
      onChange(item);
      toast.success(`Marked as ${STATUS_META[status].label.toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setPending(null);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const { item } = await api<{ item: Enquiry }>(`/api/admin/enquiries/${enquiry.id}`, { method: "PATCH", json: { notes } });
      onChange(item);
      toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const remove = async () => {
    try {
      await api(`/api/admin/enquiries/${enquiry.id}`, { method: "DELETE" });
      toast.success("Request deleted");
      onDeleted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
      throw e;
    }
  };

  const subject = encodeURIComponent(`Your counselling request — Delta International Academy (${enquiry.program})`);

  return (
    <div className="space-y-7">
      <div className="grid gap-2 sm:grid-cols-2">
        <a href={`mailto:${enquiry.email}`} className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3.5 transition-colors hover:border-ink/25">
          <span className="grid size-9 place-items-center rounded-lg bg-paper text-brass">
            <Mail className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="eyebrow block text-[0.5625rem] text-ink/40">Email</span>
            <span className="block truncate text-sm group-hover:underline">{enquiry.email}</span>
          </span>
        </a>
        {enquiry.phone ? (
          <a href={`tel:${enquiry.phone.replace(/\s/g, "")}`} className="group flex items-center gap-3 rounded-xl border border-line bg-white p-3.5 transition-colors hover:border-ink/25">
            <span className="grid size-9 place-items-center rounded-lg bg-paper text-brass">
              <Phone className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="eyebrow block text-[0.5625rem] text-ink/40">Phone</span>
              <span className="block truncate text-sm group-hover:underline">{enquiry.phone}</span>
            </span>
          </a>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-line p-3.5 text-sm text-ink/40">No phone provided</div>
        )}
      </div>

      <dl className={cn("grid gap-px overflow-hidden rounded-xl border border-line bg-line text-sm", enquiry.studentAge ? "grid-cols-3" : "grid-cols-2")}>
        {[
          ["Interested in", enquiry.program],
          ...(enquiry.studentAge ? [["Age", enquiry.studentAge]] : []),
          ["Received", formatDate(enquiry.createdAt, { day: "numeric", month: "short" })],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-3.5 py-3">
            <dt className="eyebrow text-[0.5625rem] text-ink/40">{k}</dt>
            <dd className="mt-1.5 font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <p className="eyebrow mb-3 text-ink/45">Message</p>
        {enquiry.message ? (
          <blockquote className="relative rounded-2xl bg-paper/70 px-5 py-4 pl-10 text-[0.9375rem] leading-relaxed text-ink/80">
            <span aria-hidden className="display absolute top-1 left-3 text-5xl leading-none text-brass/60">
              “
            </span>
            {enquiry.message}
          </blockquote>
        ) : (
          <p className="text-sm text-ink/45">No message — just the form details.</p>
        )}
      </div>

      <div>
        <p className="eyebrow mb-3 text-ink/45">Pipeline stage</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Status">
          {ENQUIRY_STATUSES.map((s) => {
            const active = enquiry.status === s;
            return (
              <button
                key={s}
                role="radio"
                aria-checked={active}
                onClick={() => setStatus(s)}
                disabled={pending !== null}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-xl border text-[0.8125rem] transition-all",
                  active ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink/65 hover:border-ink/30 hover:text-ink",
                  pending === s && "animate-pulse",
                )}
              >
                <span className={cn("size-1.5 rounded-full", STATUS_META[s].dot)} />
                {STATUS_META[s].label}
              </button>
            );
          })}
        </div>
      </div>

      <Field label="Internal notes" htmlFor="enq-notes" hint="Only visible to the admissions team. Ctrl/⌘ + Enter to save.">
        <Textarea
          id="enq-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && notes !== enquiry.notes) saveNotes();
          }}
          placeholder="Call booked for Friday; comparing IELTS weekday vs weekend batch…"
        />
      </Field>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={saveNotes} loading={savingNotes} disabled={notes === enquiry.notes}>
          Save notes
        </Button>
      </div>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t border-line bg-[#FBFAF7]/95 px-5 py-4 backdrop-blur sm:-mx-7 sm:px-7">
        <Button variant="ghost" className="text-pin hover:bg-pin/5 hover:text-pin" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" /> Delete
        </Button>
        <a
          href={`mailto:${enquiry.email}?subject=${subject}`}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-navy"
        >
          <Mail className="size-4" /> Reply by email
        </a>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        title="Delete this request?"
        description={`${enquiry.parentName}'s request and notes will be permanently removed.`}
      />
    </div>
  );
}
