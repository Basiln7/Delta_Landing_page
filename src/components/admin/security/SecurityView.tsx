"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Crown, Download, Eye, EyeOff, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, ShieldOff, Smartphone, UserRound, XCircle } from "lucide-react";
import { Badge, Button, Card, Field, Input, PageHeader } from "@/components/admin/ui";
import { ConfirmDialog, Modal } from "@/components/admin/Overlay";
import { RelativeTime } from "@/components/admin/RelativeTime";
import { api, ApiError } from "@/lib/admin/client";
import { ROLE_META } from "@/lib/roles";
import type { publicSecurityState } from "@/lib/security/admin-api";
import { PASSWORD_MIN, passwordProblem } from "@/lib/security/password-policy";
import { cn } from "@/lib/utils";

type State = ReturnType<typeof publicSecurityState>;
type Setup = { secret: string; qr: string; issuer: string; account: string };
type StepUp = { action: "disable" | "regenerate" } | null;

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

export function SecurityView({ initial }: { initial: State }) {
  const [state, setState] = useState(initial);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [stepUp, setStepUp] = useState<StepUp>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [revokeOpen, setRevokeOpen] = useState(false);
  const tf = state.twoFactor;

  const startSetup = async () => {
    setBusy("setup");
    try {
      setSetup(await api<Setup>("/api/admin/security/totp/setup", { method: "POST" }));
      setSetupCode("");
    } catch (e) {
      toast.error(errorText(e, "Could not start setup"));
    } finally {
      setBusy(null);
    }
  };

  const enable = async () => {
    setBusy("enable");
    try {
      const r = await api<{ recoveryCodes: string[]; state: State }>("/api/admin/security/totp/enable", { method: "POST", json: { code: setupCode } });
      setState(r.state);
      setSetup(null);
      setCodes(r.recoveryCodes);
      toast.success("Two-step verification is on", { description: "Every other session was signed out." });
    } catch (e) {
      toast.error(errorText(e, "Could not turn it on"));
      if (e instanceof ApiError && e.status === 410) setSetup(null);
    } finally {
      setBusy(null);
    }
  };

  const confirmStepUp = async () => {
    if (!stepUp) return;
    setBusy("stepup");
    try {
      if (stepUp.action === "disable") {
        const r = await api<{ state: State }>("/api/admin/security/totp/disable", { method: "POST", json: { code: stepUpCode } });
        setState(r.state);
        toast.success("Two-step verification is off");
      } else {
        const r = await api<{ recoveryCodes: string[]; state: State }>("/api/admin/security/recovery-codes", { method: "POST", json: { code: stepUpCode } });
        setState(r.state);
        setCodes(r.recoveryCodes);
        toast.success("New recovery codes created", { description: "Your old codes no longer work." });
      }
      setStepUp(null);
      setStepUpCode("");
    } catch (e) {
      toast.error(errorText(e, "That didn't work"));
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    try {
      const r = await api<{ state: State }>("/api/admin/security/sessions", { method: "DELETE" });
      setState(r.state);
      toast.success("Signed out everywhere else", { description: "This browser stays signed in." });
    } catch (e) {
      toast.error(errorText(e, "Could not sign out other sessions"));
      throw e;
    }
  };

  const checklist = state.checklist;
  const issues = checklist ? checklist.filter((c) => c.state !== "ok").length : 0;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Security"
        description={
          checklist
            ? "Your account, two-step verification and sessions, plus a check that the server is configured safely for launch."
            : "Your account, two-step verification and where you're signed in."
        }
        actions={
          <Badge tone={tf.enabled ? "green" : "pin"} className="px-3 py-1 text-xs">
            {tf.enabled ? <ShieldCheck className="size-3.5" /> : <ShieldOff className="size-3.5" />}
            {tf.enabled ? "2-step on" : "2-step off"}
          </Badge>
        }
      />

      <div className={cn("grid gap-6", checklist && "xl:grid-cols-[1.25fr_1fr]")}>
        <div className={cn("min-w-0 space-y-6", !checklist && "max-w-3xl")}>
          <AccountCard state={state} onState={setState} />

          {/* ───────── 2FA ───────── */}
          <Card className="p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <div className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tf.enabled ? "bg-emerald-600/10 text-emerald-700" : "bg-brass/12 text-brass")}>
                <Smartphone className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="display text-2xl">Two-step verification</h2>
                <p className="mt-1 text-sm text-ink/60">
                  After your password, sign-in asks for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).
                  A stolen password alone is then not enough.
                </p>
              </div>
            </div>

            {tf.enabled ? (
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-emerald-700">
                    <CheckCircle2 className="size-4" /> On
                  </span>
                  {tf.enabledAt && (
                    <span className="text-ink/55">
                      since <RelativeTime iso={tf.enabledAt} />
                    </span>
                  )}
                  <span className={cn("text-ink/55", tf.recoveryCodesLeft < 3 && "font-medium text-pin")}>
                    {tf.recoveryCodesLeft} recovery code{tf.recoveryCodesLeft === 1 ? "" : "s"} left
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setStepUp({ action: "regenerate" })}>
                    <KeyRound className="size-4" /> New recovery codes
                  </Button>
                  <Button variant="ghost" className="text-pin hover:bg-pin/10 hover:text-pin" onClick={() => setStepUp({ action: "disable" })}>
                    Turn off
                  </Button>
                </div>
              </div>
            ) : setup ? (
              <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr]">
                <div className="mx-auto rounded-2xl border border-line bg-white p-3 sm:mx-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data: URL */}
                  <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} className="size-[200px]" />
                </div>
                <div className="min-w-0 space-y-4">
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink/70">
                    <li>Open your authenticator app and add an account.</li>
                    <li>Scan the QR code, or type the key below.</li>
                    <li>Enter the 6-digit code it shows.</li>
                  </ol>
                  <div>
                    <p className="text-xs font-medium text-ink/55">Setup key</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="min-w-0 flex-1 rounded-lg bg-paper px-3 py-2 font-mono text-xs break-all select-all">{setup.secret}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Copy setup key"
                        onClick={() => navigator.clipboard.writeText(setup.secret.replace(/\s/g, "")).then(() => toast.success("Key copied"))}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <form
                    className="flex flex-col gap-2 sm:flex-row sm:items-end"
                    onSubmit={(e) => {
                      e.preventDefault();
                      enable();
                    }}
                  >
                    <Field label="6-digit code" htmlFor="setup-code" className="sm:w-44">
                      <Input
                        id="setup-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={7}
                        value={setupCode}
                        onChange={(e) => setSetupCode(e.target.value.replace(/[^0-9 ]/g, ""))}
                        placeholder="123 456"
                        className="text-center font-mono tracking-[0.25em]"
                        autoFocus
                      />
                    </Field>
                    <Button type="submit" loading={busy === "enable"} disabled={setupCode.replace(/\D/g, "").length !== 6}>
                      Turn on
                    </Button>
                    <Button variant="ghost" onClick={() => setSetup(null)}>
                      Cancel
                    </Button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <Button onClick={startSetup} loading={busy === "setup"}>
                  {busy !== "setup" && <ShieldCheck className="size-4" />}
                  Set up two-step verification
                </Button>
              </div>
            )}
          </Card>

          {/* ───────── sessions ───────── */}
          <Card className="p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper text-ink/70">
                <MonitorSmartphone className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="display text-2xl">Sessions</h2>
                <p className="mt-1 text-sm text-ink/60">Admin sessions last 12 hours. If you signed in on a shared computer or suspect someone else has access, sign out everywhere else.</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 rounded-xl border border-line bg-paper/40 p-4 text-sm sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs text-ink/50">Signed in as</dt>
                <dd className="truncate font-medium">{state.session.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/50">This session</dt>
                <dd>
                  <RelativeTime iso={state.session.signedInAt} /> {state.session.mfa ? "· with 2-step" : "· password only"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink/50">Expires</dt>
                <dd>
                  <RelativeTime iso={state.session.expiresAt} />
                </dd>
              </div>
            </dl>
            <Button variant="secondary" className="mt-4" onClick={() => setRevokeOpen(true)}>
              <LogOut className="size-4" /> Sign out everywhere else
            </Button>
          </Card>
        </div>

        {/* ───────── checklist (super admins) ───────── */}
        {checklist && (
        <Card className="h-fit p-5 sm:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-2xl">Launch checklist</h2>
            <span className={cn("text-xs font-medium", issues ? "text-brass" : "text-emerald-700")}>{issues ? `${issues} to review` : "All good"}</span>
          </div>
          <p className="mt-1 text-sm text-ink/55">Server configuration that matters before real payments. Values are never shown, only whether they&apos;re safe.</p>
          <ul className="mt-5 divide-y divide-line">
            {checklist.map((c) => (
              <li key={c.id} className="flex gap-3 py-3">
                {c.state === "ok" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : c.state === "warn" ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brass" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-pin" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs break-words text-ink/55">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        )}
      </div>

      {/* step-up: a fresh code before turning 2FA off or replacing recovery codes */}
      <Modal open={Boolean(stepUp)} onClose={() => (busy ? undefined : setStepUp(null))} label="Confirm with a code">
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            confirmStepUp();
          }}
        >
          <h2 className="display text-2xl">{stepUp?.action === "disable" ? "Turn off two-step verification?" : "Create new recovery codes?"}</h2>
          <p className="mt-1.5 text-sm text-ink/60">
            {stepUp?.action === "disable"
              ? "Your account will be protected by the password only. Enter a current code to confirm."
              : "Your existing recovery codes will stop working. Enter a current code to confirm."}
          </p>
          <Field label="Authenticator or recovery code" htmlFor="stepup-code" className="mt-5">
            <Input id="stepup-code" autoComplete="one-time-code" value={stepUpCode} onChange={(e) => setStepUpCode(e.target.value)} placeholder="123 456" autoFocus data-autofocus />
          </Field>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStepUp(null)} disabled={busy === "stepup"}>
              Cancel
            </Button>
            <Button type="submit" variant={stepUp?.action === "disable" ? "danger" : "primary"} loading={busy === "stepup"} disabled={stepUpCode.trim().length < 6}>
              {stepUp?.action === "disable" ? "Turn off" : "Create new codes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* recovery codes: shown exactly once */}
      <Modal open={Boolean(codes)} onClose={() => undefined} label="Recovery codes">
        {codes && <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />}
      </Modal>

      <ConfirmDialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={revokeOthers}
        title="Sign out everywhere else?"
        description="Every other browser and device signed in to the admin will be signed out immediately. You stay signed in here."
        confirmLabel="Sign out others"
        tone="primary"
      />
    </>
  );
}

/* ───────── your account: name + password ───────── */

function AccountCard({ state, onState }: { state: State; onState: (s: State) => void }) {
  const router = useRouter();
  const a = state.account;
  const [name, setName] = useState(a.name);
  const [savingName, setSavingName] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const saveName = async () => {
    setSavingName(true);
    try {
      const r = await api<{ state: State }>("/api/admin/account", { method: "PATCH", json: { name: name.trim() } });
      onState(r.state);
      setName(r.state.account.name);
      toast.success("Name updated");
      router.refresh(); // the sidebar shows your name
    } catch (e) {
      toast.error(errorText(e, "Could not update your name"));
    } finally {
      setSavingName(false);
    }
  };

  return (
    <Card id="account" className="scroll-mt-24 p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-paper text-ink/70">
          <UserRound className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="display text-2xl">Your account</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/60">
            <span className="break-all">{a.email}</span>
            <Badge tone={a.role === "super_admin" ? "ink" : "neutral"}>{ROLE_META[a.role].label}</Badge>
            {a.owner && (
              <Badge tone="brass">
                <Crown className="size-3" /> Owner
              </Badge>
            )}
          </p>
        </div>
      </div>

      <form
        className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          saveName();
        }}
      >
        <Field label="Display name" htmlFor="account-name" className="sm:flex-1">
          <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Button type="submit" variant="secondary" loading={savingName} disabled={!name.trim() || name.trim() === a.name}>
          Save name
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm">
        {a.owner ? (
          <p className="text-ink/60">
            Your password is set on the server (<code className="font-mono text-xs">ADMIN_PASSWORD_HASH</code>). Change it there and restart the app.
          </p>
        ) : (
          <>
            <p className="text-ink/60">
              Password{a.passwordChangedAt ? <> · changed <RelativeTime iso={a.passwordChangedAt} /></> : null}
            </p>
            <Button variant="secondary" size="sm" onClick={() => setPwOpen(true)}>
              <KeyRound className="size-3.5" /> Change password
            </Button>
          </>
        )}
      </div>

      <ChangePasswordModal
        open={pwOpen}
        email={a.email}
        name={a.name}
        onClose={() => setPwOpen(false)}
        onDone={(s) => {
          onState(s);
          setPwOpen(false);
        }}
      />
    </Card>
  );
}

function ChangePasswordModal({ open, email, name, onClose, onDone }: { open: boolean; email: string; name: string; onClose: () => void; onDone: (s: State) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const problem = next ? passwordProblem(next, { email, name }) : null;
  const mismatch = confirm.length > 0 && confirm !== next;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
    setShow(false);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem || mismatch) return;
    setBusy(true);
    setErrors({});
    try {
      const r = await api<{ state: State }>("/api/admin/account/password", { method: "POST", json: { current, next } });
      toast.success("Password changed", { description: "Your other sessions were signed out." });
      reset();
      onDone(r.state);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v?.[0]])));
      else toast.error(errorText(err, "Could not change your password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} label="Change password">
      <form className="p-6" onSubmit={submit} noValidate>
        <h2 className="display text-2xl">Change your password</h2>
        <p className="mt-1.5 text-sm text-ink/60">You stay signed in here; every other session is signed out.</p>
        <div className="mt-5 space-y-4">
          <Field label="Current password" htmlFor="pw-current" error={errors.current}>
            <Input id="pw-current" data-autofocus type={show ? "text" : "password"} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={Boolean(errors.current)} />
          </Field>
          <Field label="New password" htmlFor="pw-next" error={errors.next ?? problem ?? undefined} hint={`At least ${PASSWORD_MIN} characters. A few random words work well.`}>
            <div className="relative">
              <Input id="pw-next" type={show ? "text" : "password"} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className="pr-11" aria-invalid={Boolean(errors.next || problem)} />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide passwords" : "Show passwords"}
                className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink/45 hover:bg-ink/5 hover:text-ink"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field label="Repeat new password" htmlFor="pw-confirm" error={mismatch ? "The passwords don't match." : undefined}>
            <Input id="pw-confirm" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!current || !next || Boolean(problem) || confirm !== next}>
            Change password
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = `Delta Admin recovery codes\nGenerated ${new Date().toLocaleString()}\nEach code works once.\n\n${codes.join("\n")}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "delta-admin-recovery-codes.txt";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  };
  return (
    <div className="p-6">
      <h2 className="display text-2xl">Save your recovery codes</h2>
      <p className="mt-1.5 text-sm text-ink/60">
        If you lose your phone, each code signs you in once. <strong className="text-ink">This is the only time they&apos;re shown.</strong> Keep them in a password manager or a safe place.
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-2 rounded-xl border border-line bg-paper/40 p-4 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="text-center tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            navigator.clipboard
              .writeText(codes.join("\n"))
              .then(() => {
                toast.success("Codes copied");
                setSaved(true);
              })
              .catch(() => toast.error("This browser blocked copying. Download them, or write them down."))
          }
        >
          <Copy className="size-4" /> Copy
        </Button>
        <Button variant="secondary" onClick={download}>
          <Download className="size-4" /> Download .txt
        </Button>
      </div>
      {/* Fallback when copy/download are blocked, so the admin is never trapped in this dialog. */}
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink/70">
        <input type="checkbox" className="size-4 accent-[var(--color-brass,#b08a4a)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I&apos;ve written them down somewhere safe
      </label>
      <div className="mt-6 flex justify-end">
        <Button onClick={onDone} disabled={!saved}>
          {saved ? "I've saved them" : "Save the codes first"}
        </Button>
      </div>
    </div>
  );
}
