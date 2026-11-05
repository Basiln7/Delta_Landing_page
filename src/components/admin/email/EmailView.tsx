"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Mail,
  PlugZap,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Segmented, Select, Switch } from "@/components/admin/ui";
import { SaveBar, Section } from "@/components/admin/content/SettingsForm";
import { ConfirmDialog, Modal } from "@/components/admin/Overlay";
import { RelativeTime } from "@/components/admin/RelativeTime";
import { TagInput } from "@/components/admin/TagInput";
import { api, ApiError } from "@/lib/admin/client";
import { isMailConfigured, MAIL_EVENT_META, SECURITY_LABEL, SMTP_PRESETS, type PublicMailSettings } from "@/lib/mail/shared";
import { MAIL_EVENTS, type MailEvent, type MailLogEntry, type SmtpSecurity } from "@/lib/types";
import { cn } from "@/lib/utils";

type Form = Pick<PublicMailSettings, "enabled" | "host" | "port" | "security" | "username" | "fromName" | "fromEmail" | "staffRecipients" | "events"> & {
  replyTo: string;
};
type PwMode = "keep" | "replace" | "clear";
type Check = { state: "idle" | "running" | "ok" | "fail"; message?: string };
type Rendered = { subject: string; html: string; text: string };

const formOf = (s: PublicMailSettings): Form => ({
  enabled: s.enabled,
  host: s.host,
  port: s.port,
  security: s.security,
  username: s.username,
  fromName: s.fromName,
  fromEmail: s.fromEmail,
  replyTo: s.replyTo ?? "",
  staffRecipients: s.staffRecipients,
  events: s.events,
});

const sameAccount = (a: Pick<Form, "host" | "username">, b: Pick<Form, "host" | "username">) =>
  a.host.trim().toLowerCase() === b.host.trim().toLowerCase() && a.username.trim() === b.username.trim();

export function EmailView({
  initial,
  encryption,
  initialLog,
  adminEmail,
  renderedAt,
}: {
  initial: PublicMailSettings;
  encryption: { dedicatedKey: boolean; available: boolean };
  initialLog: MailLogEntry[];
  adminEmail: string;
  /** server render time, the reference for "last 7 days" */
  renderedAt: number;
}) {
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState<Form>(() => formOf(initial));
  const [pwMode, setPwMode] = useState<PwMode>("keep");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [testTo, setTestTo] = useState(initial.staffRecipients[0] ?? adminEmail);
  const [testing, setTesting] = useState(false);
  const [log, setLog] = useState(initialLog);
  const [now, setNow] = useState(renderedAt);
  const [logFilter, setLogFilter] = useState<"all" | "sent" | "failed">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [preview, setPreview] = useState<{ event: MailEvent | "test"; data?: Rendered; view: "html" | "text" } | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    if (key === "host" || key === "port" || key === "security" || key === "username") setCheck({ state: "idle" });
  };

  const dirty = JSON.stringify(formOf(saved)) !== JSON.stringify(form) || pwMode !== "keep";
  const accountChanged = !sameAccount(saved, form);
  // The saved password is only reused with the same host + username (server enforces this too).
  const mustRetype = saved.hasPassword && accountChanged && Boolean(form.username.trim());
  const showPasswordInput = pwMode === "replace" || mustRetype || (!saved.hasPassword && pwMode !== "clear");
  // Derived from the host, so it's right after Discard and for saved settings too.
  const activePreset = SMTP_PRESETS.find((p) => p.host === form.host.trim().toLowerCase());
  const preset = activePreset?.id ?? null;
  const presetNote = activePreset?.note;

  const payload = () => ({
    ...form,
    port: Number(form.port) || 0,
    password: password && (pwMode === "replace" || mustRetype || !saved.hasPassword) ? password : undefined,
    clearPassword: pwMode === "clear" ? true : undefined,
  });

  const showFieldErrors = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.fields) {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(e.fields)) if (v?.length) next[k] = v[0];
      setErrors(next);
      const first = Object.entries(next)[0];
      toast.error(first ? first[1] : e.message);
    } else toast.error(e instanceof Error ? e.message : fallback);
  };

  const save = async () => {
    setSaving(true);
    try {
      const configured = Boolean(form.host && form.fromEmail);
      const res = await api<{ settings: PublicMailSettings; verify?: { ok: boolean; error?: string } }>("/api/admin/mail", {
        method: "PUT",
        json: { ...payload(), verify: form.enabled && configured },
      });
      setSaved(res.settings);
      setForm(formOf(res.settings));
      setPwMode("keep");
      setPassword("");
      setShowPw(false);
      setErrors({});
      if (res.verify?.ok) {
        setCheck({ state: "ok", message: "Connected and signed in." });
        toast.success("Saved — connection verified");
      } else if (res.verify) {
        setCheck({ state: "fail", message: res.verify.error });
        toast.warning("Saved, but the connection check failed", { description: res.verify.error });
      } else toast.success("Email settings saved");
    } catch (e) {
      showFieldErrors(e, "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setForm(formOf(saved));
    setPwMode("keep");
    setPassword("");
    setErrors({});
    setCheck({ state: "idle" });
  };

  const runCheck = async () => {
    setCheck({ state: "running" });
    try {
      const r = await api<{ ok: boolean; error?: string; latencyMs: number; verifiedAt?: string }>("/api/admin/mail/verify", {
        method: "POST",
        json: { settings: payload() },
      });
      if (r.ok) {
        setCheck({ state: "ok", message: `Connected and signed in (${r.latencyMs} ms).` });
        if (r.verifiedAt) setSaved((s) => ({ ...s, verifiedAt: r.verifiedAt }));
      } else setCheck({ state: "fail", message: r.error });
    } catch (e) {
      setCheck({ state: "fail", message: e instanceof Error ? e.message : "Check failed" });
      if (e instanceof ApiError && e.fields) showFieldErrors(e, "Check failed");
    }
  };

  const refreshLog = async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const r = await api<{ log: MailLogEntry[] }>("/api/admin/mail/log");
      setLog(r.log);
      setNow(Date.now());
    } catch {
      if (!quiet) toast.error("Could not load the delivery log");
    } finally {
      setRefreshing(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await api<{ ok: boolean; error?: string }>("/api/admin/mail/test", {
        method: "POST",
        json: { to: testTo, settings: dirty ? payload() : undefined },
      });
      if (r.ok) toast.success(`Test email sent to ${testTo}`, { description: "Check the inbox (and spam folder)." });
      else toast.error("Test email failed", { description: r.error });
    } catch (e) {
      showFieldErrors(e, "Could not send the test email");
    } finally {
      setTesting(false);
      refreshLog(true);
    }
  };

  const openPreview = async (event: MailEvent | "test") => {
    setPreview({ event, view: "html" });
    try {
      const data = await api<Rendered>(`/api/admin/mail/preview?event=${event}`);
      setPreview((p) => (p?.event === event ? { ...p, data } : p));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the preview");
      setPreview(null);
    }
  };

  const applyPreset = (id: string) => {
    const p = SMTP_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setForm((f) => ({ ...f, host: p.host, port: p.port, security: p.security }));
    setCheck({ state: "idle" });
  };

  /* ───────── derived status ───────── */
  const live = saved.enabled && isMailConfigured(saved);
  const weekAgo = now - 7 * 864e5;
  const stats = useMemo(() => {
    const recent = log.filter((l) => Date.parse(l.at) >= weekAgo);
    return { sent: recent.filter((l) => l.status === "sent").length, failed: recent.filter((l) => l.status === "failed").length };
  }, [log, weekAgo]);
  const visibleLog = logFilter === "all" ? log : log.filter((l) => l.status === logFilter);

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Email"
        description="Your SMTP server and the emails sent to your team and learners. Credentials are encrypted on the server, and the password can't be viewed again after you save it."
        actions={
          <Badge tone={live ? "green" : saved.enabled ? "brass" : "muted"} className="px-3 py-1 text-xs">
            <span className={cn("size-1.5 rounded-full", live ? "animate-pulse bg-emerald-600" : saved.enabled ? "bg-brass" : "bg-ink/30")} />
            {live ? "Sending" : saved.enabled ? "Needs setup" : "Off"}
          </Badge>
        }
      />

      {/* ───────── status strip ───────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile label="Notifications" value={live ? "On" : saved.enabled ? "Needs setup" : "Off"} tone={live ? "good" : saved.enabled ? "warn" : "muted"}>
          {live ? `${MAIL_EVENTS.filter((e) => saved.events[e]).length} of ${MAIL_EVENTS.length} emails enabled` : "Nothing is being sent"}
        </StatTile>
        <StatTile label="Connection" value={saved.verifiedAt ? "Verified" : "Not verified"} tone={saved.verifiedAt ? "good" : "muted"}>
          {saved.verifiedAt ? <RelativeTime iso={saved.verifiedAt} /> : "Run “Test connection” below"}
        </StatTile>
        <StatTile label="Last 7 days" value={`${stats.sent} sent`} tone={stats.failed ? "bad" : "muted"}>
          {stats.failed ? `${stats.failed} failed — see the log` : "No failures"}
        </StatTile>
      </div>

      {!encryption.dedicatedKey && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-brass/30 bg-brass/[0.07] p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-brass" />
          <div className="min-w-0 space-y-1.5">
            <p className="font-medium">Using a development encryption key</p>
            <p className="text-ink/65 [overflow-wrap:anywhere]">
              Saved passwords are encrypted with a key derived from <code className="font-mono text-xs">SESSION_SECRET</code>. Before going live, set a dedicated{" "}
              <code className="font-mono text-xs">CREDENTIALS_ENCRYPTION_KEY</code> in the server environment, then re-enter the SMTP password here.
            </p>
            <p className="rounded-lg bg-white/70 px-2.5 py-1.5 font-mono text-xs break-all text-ink/60 select-all">node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64&apos;))&quot;</p>
          </div>
        </div>
      )}

      <Card className="p-5 sm:p-8">
        <Section id="sending" title="Sending" description="When this is off, nothing is emailed. Enquiries and orders still work normally.">
          <Switch
            checked={form.enabled}
            onChange={(v) => set("enabled", v)}
            label="Send email notifications"
            description="Enquiry, order and refund emails, using the server below."
          />
        </Section>

        <Section id="smtp" title="SMTP server" description="From your email provider. Pick a preset to fill in the host, port and security, then add your login.">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Provider presets">
            {SMTP_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  preset === p.id ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink/70 hover:border-ink/30 hover:text-ink",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {presetNote && (
            <p className="flex gap-2 rounded-xl bg-paper/60 px-3.5 py-2.5 text-xs text-ink/65">
              <Info className="mt-px size-3.5 shrink-0 text-brass" />
              {presetNote}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-6 [&>*]:min-w-0">
            <Field label="Host" htmlFor="m-host" className="sm:col-span-4" error={errors.host}>
              <Input id="m-host" value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.yourprovider.com" autoComplete="off" spellCheck={false} aria-invalid={Boolean(errors.host)} />
            </Field>
            <Field label="Port" htmlFor="m-port" className="sm:col-span-2" error={errors.port}>
              <Input id="m-port" type="number" inputMode="numeric" min={1} max={65535} value={form.port || ""} onChange={(e) => set("port", Number(e.target.value))} aria-invalid={Boolean(errors.port)} />
            </Field>
            <Field label="Security" htmlFor="m-sec" className="sm:col-span-6" hint={form.security === "none" ? "Unencrypted — only for a local test server. Never use this with a real mailbox." : undefined}>
              <Select id="m-sec" value={form.security} onChange={(e) => set("security", e.target.value as SmtpSecurity)}>
                {(Object.keys(SECURITY_LABEL) as SmtpSecurity[]).map((s) => (
                  <option key={s} value={s}>
                    {SECURITY_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Username" htmlFor="m-user" className="sm:col-span-3" hint="Usually the full email address. Leave empty if the server needs no login." error={errors.username}>
              <Input id="m-user" value={form.username} onChange={(e) => set("username", e.target.value)} autoComplete="off" spellCheck={false} />
            </Field>

            <Field
              label="Password"
              htmlFor="m-pass"
              className="sm:col-span-3"
              error={errors.password || (mustRetype && !password ? "Re-enter the password. It's required when the host or username changes." : undefined)}
              hint={showPasswordInput ? "Stored encrypted. It can't be viewed again after saving." : undefined}
            >
              {pwMode === "clear" ? (
                <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-dashed border-pin/40 bg-pin/[0.04] px-3.5 text-sm text-pin">
                  Will be removed on save
                  <button type="button" className="text-xs font-medium text-ink/70 underline underline-offset-2" onClick={() => setPwMode("keep")}>
                    Undo
                  </button>
                </div>
              ) : showPasswordInput ? (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="m-pass"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((x) => ({ ...x, password: "" }));
                        if (saved.hasPassword) setPwMode("replace");
                        setCheck({ state: "idle" });
                      }}
                      placeholder={saved.hasPassword ? "New password" : "Password or app password"}
                      autoComplete="new-password"
                      spellCheck={false}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink/45 hover:text-ink"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {saved.hasPassword && !mustRetype && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setPwMode("keep");
                        setPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex h-10 items-center gap-2 rounded-xl border border-line bg-paper/40 pr-1.5 pl-3.5 text-sm">
                  <KeyRound className="size-4 text-emerald-600" />
                  <span className="min-w-0 flex-1 truncate">
                    Saved <span className="text-ink/45">· encrypted</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setPwMode("replace")}>
                    Replace
                  </Button>
                  <Button size="sm" variant="ghost" className="text-pin hover:bg-pin/10 hover:text-pin" onClick={() => setPwMode("clear")}>
                    Remove
                  </Button>
                </div>
              )}
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper/30 p-3">
            <Button variant="secondary" onClick={runCheck} loading={check.state === "running"} disabled={!form.host}>
              {check.state !== "running" && <PlugZap className="size-4" />}
              Test connection
            </Button>
            <CheckResult check={check} dirty={dirty} />
          </div>
        </Section>

        <Section id="sender" title="Sender" description="How your emails appear in the inbox.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="From name" htmlFor="m-fromname" error={errors.fromName}>
              <Input id="m-fromname" value={form.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="Delta Markets Academy" />
            </Field>
            <Field label="From email" htmlFor="m-from" error={errors.fromEmail} hint="Must be an address your provider lets you send from (the mailbox itself or a verified sender).">
              <Input id="m-from" type="email" value={form.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} placeholder="hello@yourdomain.com" aria-invalid={Boolean(errors.fromEmail)} />
            </Field>
            <Field label="Reply-to" htmlFor="m-reply" error={errors.replyTo} hint="Where learner replies go. Leave empty to use the From address." className="sm:col-span-2">
              <Input id="m-reply" type="email" value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} placeholder="admissions@yourdomain.com" />
            </Field>
          </div>
        </Section>

        <Section id="notifications" title="Who gets what" description="Turn each email on or off. Preview shows exactly what's sent, with sample data.">
          <Field
            label="Team recipients"
            htmlFor="m-staff"
            error={errors.staffRecipients}
            hint="Counsellors and sales, up to 10. Team emails set Reply-To to the learner, so you can answer directly."
          >
            <TagInput id="m-staff" value={form.staffRecipients} onChange={(v) => set("staffRecipients", v)} placeholder="name@yourdomain.com, then Enter" max={10} />
          </Field>

          {(["Staff", "Learner"] as const).map((audience) => (
            <div key={audience} className="space-y-2">
              <p className="eyebrow text-ink/45">{audience === "Staff" ? "To your team" : "To learners"}</p>
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {MAIL_EVENTS.filter((e) => MAIL_EVENT_META[e].audience === audience).map((e) => (
                  <EventRow
                    key={e}
                    label={MAIL_EVENT_META[e].label}
                    description={MAIL_EVENT_META[e].description}
                    checked={form.events[e]}
                    onChange={(v) => set("events", { ...form.events, [e]: v })}
                    onPreview={() => openPreview(e)}
                    warn={audience === "Staff" && form.events[e] && !form.staffRecipients.length ? "Add a team recipient to receive this." : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </Section>

        <Section id="test" title="Send a test" description="Sends a real email using the values on this page, even before you save.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@yourdomain.com" aria-label="Send the test email to" className="sm:max-w-sm" />
            <Button onClick={sendTest} loading={testing} disabled={!testTo || !form.host || !form.fromEmail}>
              {!testing && <Send className="size-4" />}
              Send test email
            </Button>
            <Button variant="ghost" onClick={() => openPreview("test")}>
              <Eye className="size-4" />
              Preview
            </Button>
          </div>
        </Section>
      </Card>

      {/* ───────── delivery log ───────── */}
      <Card id="log" className="mt-6 scroll-mt-24 p-5 sm:p-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="display text-2xl">Delivery log</h3>
            <p className="mt-1 text-sm text-ink/55">The last 200 emails: who, what and whether it was delivered. Email contents are not stored.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              layoutId="mail-log-filter"
              value={logFilter}
              onChange={setLogFilter}
              options={[
                { value: "all", label: "All", count: log.length },
                { value: "sent", label: "Sent", count: log.filter((l) => l.status === "sent").length },
                { value: "failed", label: "Failed", count: log.filter((l) => l.status === "failed").length },
              ]}
            />
            <Button size="icon" variant="ghost" onClick={() => refreshLog()} aria-label="Refresh log" disabled={refreshing}>
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setClearOpen(true)} aria-label="Clear log" disabled={!log.length}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {visibleLog.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {visibleLog.map((l) => (
              <li key={l.id} className="grid gap-x-4 gap-y-1 px-4 py-3 text-sm md:grid-cols-[7rem_10rem_1fr_auto] md:items-center">
                <RelativeTime iso={l.at} className="text-xs text-ink/50 tabular-nums" />
                <span className="font-medium">{l.event === "test" ? "Test email" : l.event === "admin_invite" ? "Admin invite / reset link" : (MAIL_EVENT_META[l.event]?.label ?? l.event)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-ink/80">{l.subject}</span>
                  <span className="block truncate text-xs text-ink/45">
                    to {l.to || "nobody"}
                    {l.ref && l.ref !== "test" ? ` · ${l.ref}` : ""}
                  </span>
                  {l.error && <span className="mt-1 block text-xs text-pin">{l.error}</span>}
                </span>
                <span className="md:justify-self-end">
                  <Badge tone={l.status === "sent" ? "green" : l.status === "failed" ? "pin" : "muted"}>
                    {l.status === "sent" ? <CheckCircle2 className="size-3" /> : l.status === "failed" ? <XCircle className="size-3" /> : null}
                    {l.status === "sent" ? "Delivered to server" : l.status === "failed" ? "Failed" : "Skipped"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Mail className="size-5" />}
            title={log.length ? "Nothing here" : "No emails yet"}
            description={log.length ? "No entries match this filter." : "Once email is on, every notification and test appears here with its delivery status."}
          />
        )}
      </Card>

      <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={discard} saveLabel="Save settings" />

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="Clear the delivery log?"
        description="This removes the history shown here. It doesn't affect emails already sent."
        confirmLabel="Clear log"
        onConfirm={async () => {
          try {
            await api("/api/admin/mail/log", { method: "DELETE" });
            setLog([]);
            toast.success("Delivery log cleared");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not clear the log");
            throw e;
          }
        }}
      />

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} label="Email preview" className="sm:max-w-2xl">
        {preview && (
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
              <div className="min-w-0">
                <p className="eyebrow text-ink/45">{preview.event === "test" ? "Test email" : MAIL_EVENT_META[preview.event].label} · sample data</p>
                <p className="mt-1 truncate font-medium">{preview.data?.subject ?? "Loading…"}</p>
              </div>
              <Segmented
                size="sm"
                layoutId="mail-preview-view"
                value={preview.view}
                onChange={(view) => setPreview((p) => (p ? { ...p, view } : p))}
                options={[
                  { value: "html", label: "HTML" },
                  { value: "text", label: "Plain text" },
                ]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-paper/40">
              {!preview.data ? (
                <div className="grid h-80 place-items-center text-sm text-ink/45">Rendering…</div>
              ) : preview.view === "html" ? (
                // sandbox="" — no scripts, no same-origin access; the email renders exactly as an inbox would.
                <iframe title="Email preview" sandbox="" srcDoc={preview.data.html} className="h-[65vh] w-full border-0 bg-white" />
              ) : (
                <pre className="p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink/80">{preview.data.text}</pre>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ───────── pieces ───────── */

function StatTile({ label, value, tone, children }: { label: string; value: string; tone: "good" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const dot = { good: "bg-emerald-600", warn: "bg-brass", bad: "bg-pin", muted: "bg-ink/25" }[tone];
  return (
    <Card className="p-4">
      <p className="eyebrow flex items-center gap-2 text-ink/45">
        <span className={cn("size-1.5 rounded-full", dot)} />
        {label}
      </p>
      <p className="display mt-2 text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-ink/50">{children}</p>
    </Card>
  );
}

function CheckResult({ check, dirty }: { check: Check; dirty: boolean }) {
  if (check.state === "ok")
    return (
      <p className="flex items-center gap-1.5 text-sm text-emerald-700" role="status">
        <ShieldCheck className="size-4" />
        {check.message}
        {dirty && <span className="text-ink/45">Save to keep these settings.</span>}
      </p>
    );
  if (check.state === "fail")
    return (
      <p className="flex items-start gap-1.5 text-sm text-pin" role="alert">
        <XCircle className="mt-0.5 size-4 shrink-0" />
        {check.message}
      </p>
    );
  if (check.state === "running") return <p className="text-sm text-ink/50">Connecting…</p>;
  return <p className="text-sm text-ink/45">Connects and signs in without sending anything.</p>;
}

function EventRow({
  label,
  description,
  checked,
  onChange,
  onPreview,
  warn,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  onPreview: () => void;
  warn?: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-ink/50">{description}</p>
        {warn && <p className="mt-1 text-xs text-brass">{warn}</p>}
      </div>
      <Button size="sm" variant="ghost" onClick={onPreview} aria-label={`Preview “${label}”`}>
        <Eye className="size-4" />
        <span className="hidden sm:inline">Preview</span>
      </Button>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", checked ? "bg-brass" : "bg-ink/15")}
      >
        <span className={cn("size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}
