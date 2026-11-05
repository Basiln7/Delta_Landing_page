"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useAnimationControls } from "motion/react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LinkIcon, LoaderCircle, ShieldCheck } from "lucide-react";
import { AuthFrame } from "@/components/admin/AuthFrame";
import { Button, Field, Input } from "@/components/admin/ui";
import { PASSWORD_MIN, passwordProblem } from "@/lib/security/password-policy";

type Info = { name: string; email: string; purpose: "invite" | "reset"; expiresAt: string };
type View = { kind: "checking" } | { kind: "invalid"; message: string } | { kind: "form"; info: Info; token: string } | { kind: "done"; email: string; purpose: Info["purpose"] };

const post = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { res, data: await res.json().catch(() => ({})) };
};

const NO_TOKEN = "This page needs the link from your invitation or password-reset email. Open that link again, or ask a super admin for a new one.";

export function InviteView() {
  const [view, setView] = useState<View>({ kind: "checking" });
  const tokenRef = useRef("");

  useEffect(() => {
    // Read the token once, then drop it from the address bar and history.
    tokenRef.current ||= window.location.hash.slice(1);
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    const token = tokenRef.current;
    let cancelled = false;
    (async () => {
      const result = token ? await post("/api/auth/invite/check", { token }).catch(() => null) : null;
      if (cancelled) return;
      if (!token) return setView({ kind: "invalid", message: NO_TOKEN });
      if (!result) return setView({ kind: "invalid", message: "Network error. Check your connection and reload this page." });
      if (!result.res.ok) return setView({ kind: "invalid", message: result.data.error ?? NO_TOKEN });
      setView({ kind: "form", info: result.data as Info, token });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const heading =
    view.kind === "form"
      ? view.info.purpose === "reset"
        ? "New password."
        : `Welcome, ${view.info.name.split(" ")[0]}.`
      : view.kind === "done"
        ? "You're all set."
        : view.kind === "invalid"
          ? "Link not valid."
          : "One moment…";

  const intro =
    view.kind === "form" ? (
      <p>
        {view.info.purpose === "reset" ? "Choose a new password for " : "Choose a password to activate your admin account, "}
        <strong className="font-medium break-words text-ink">{view.info.email}</strong>.
      </p>
    ) : view.kind === "done" ? (
      <p>
        Sign in with <strong className="font-medium break-words text-ink">{view.email}</strong> and your new password.
      </p>
    ) : view.kind === "invalid" ? (
      <p>{view.message}</p>
    ) : (
      <p>Checking your link.</p>
    );

  return (
    <AuthFrame eyebrow={view.kind === "form" && view.info.purpose === "reset" ? "Password reset" : "Admin invite"} title={heading} intro={intro}>
      {view.kind === "checking" && (
        <div className="mt-10 flex items-center gap-3 text-sm text-ink/55">
          <LoaderCircle className="size-4 animate-spin" /> Checking…
        </div>
      )}
      {view.kind === "invalid" && (
        <div className="mt-10 flex items-start gap-3 rounded-xl border border-line bg-white/70 p-4 text-sm text-ink/70">
          <LinkIcon className="mt-0.5 size-5 shrink-0 text-brass" />
          <span>
            Links work once and expire after a few days. Already set your password?{" "}
            <Link href="/admin/login" className="font-medium text-ink underline underline-offset-2">
              Sign in
            </Link>
            .
          </span>
        </div>
      )}
      {view.kind === "form" && <PasswordForm info={view.info} token={view.token} onDone={(email) => setView({ kind: "done", email, purpose: view.info.purpose })} onInvalid={(message) => setView({ kind: "invalid", message })} />}
      {view.kind === "done" && (
        <div className="mt-10 space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <span>Your password is set. {view.purpose === "invite" && "After you sign in, turn on two-step verification on the Security page."}</span>
          </div>
          <Link
            href="/admin/login"
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[0.9375rem] font-medium text-paper transition-colors hover:bg-navy"
          >
            Go to sign in <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </AuthFrame>
  );
}

function PasswordForm({ info, token, onDone, onInvalid }: { info: Info; token: string; onDone: (email: string) => void; onInvalid: (message: string) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shake = useAnimationControls();
  const problem = password ? passwordProblem(password, { email: info.email, name: info.name }) : null;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem || mismatch || !password) {
      shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.45 } });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post("/api/auth/invite/accept", { token, password });
      if (res.status === 410) return onInvalid(data.error);
      if (!res.ok) {
        setError(data.error ?? "That didn't work. Try again.");
        shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.45 } });
        return;
      }
      onDone(data.email ?? info.email);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.form animate={shake} onSubmit={submit} className="mt-10 space-y-5" noValidate>
      {/* Lets password managers save the new password under the right account. */}
      <input type="email" name="username" autoComplete="username" value={info.email} readOnly hidden />
      <Field label="New password" htmlFor="new-password" error={problem ?? undefined} hint={`At least ${PASSWORD_MIN} characters. A few random words work well.`}>
        <div className="relative">
          <Input
            id="new-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(problem)}
            className="h-12 pr-12"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink/45 hover:bg-ink/5 hover:text-ink"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Field label="Repeat password" htmlFor="confirm-password" error={mismatch ? "The passwords don't match." : undefined}>
        <Input
          id="confirm-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch}
          className="h-12"
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-xl border border-pin/20 bg-pin/5 px-4 py-3 text-sm text-pin">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" loading={busy} className="group w-full justify-center" disabled={!password || confirm !== password || Boolean(problem)}>
        {info.purpose === "reset" ? "Save new password" : "Activate my account"}
        {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
      </Button>
      <p className="flex items-start gap-2 text-xs text-ink/50">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brass" />
        This link works once. Nobody else, including the person who invited you, can see your password.
      </p>
    </motion.form>
  );
}
