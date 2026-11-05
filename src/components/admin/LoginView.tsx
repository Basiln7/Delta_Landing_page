"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useAnimationControls } from "motion/react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info, KeyRound, ShieldCheck } from "lucide-react";
import { DeltaMark } from "@/components/brand/Logo";
import { Button, Field, Input } from "@/components/admin/ui";

const ease = [0.16, 1, 0.3, 1] as const;

export function LoginView({ showDemoHint = false }: { showDemoHint?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Two-step sign-in: after the password, an authenticator (or recovery) code.
  const [step, setStep] = useState<"password" | "code">("password");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const shake = useAnimationControls();

  const fail = (message: string) => {
    setError(message);
    shake.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.45 } });
  };

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { res, data: await res.json().catch(() => ({})) };
  };

  const enterAdmin = () => {
    router.replace("/admin");
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post("/api/auth/login", { email, password });
      if (!res.ok) return fail(data.error ?? "Sign in failed. Please try again.");
      if (data.mfaRequired) {
        setPassword("");
        setStep("code");
        return;
      }
      enterAdmin();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await post("/api/auth/mfa", { code });
      if (!res.ok) {
        if (data.restart || res.status === 429) {
          setStep("password");
          setCode("");
        }
        return fail(data.error ?? "That code isn't valid.");
      }
      enterAdmin();
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-[#F6F3ED] lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-ink p-12 text-paper lg:flex lg:flex-col">
        <div aria-hidden className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#f4efe6_1px,transparent_1px),linear-gradient(to_bottom,#f4efe6_1px,transparent_1px)] [background-size:72px_72px]" />
        <div aria-hidden className="animate-mesh absolute -top-40 -left-32 size-[34rem] rounded-full bg-brass/25 blur-[110px]" />
        <div aria-hidden className="animate-mesh absolute -right-40 -bottom-40 size-[30rem] rounded-full bg-[#2c4a7a]/50 blur-[120px] [animation-delay:-6s]" />

        <div className="relative flex items-center gap-3">
          <DeltaMark className="h-8 text-paper" />
          <span className="display text-2xl">Delta</span>
          <span className="eyebrow ml-2 rounded-full border border-white/15 px-2.5 py-1.5 text-[0.55rem] text-paper/60">Admin studio</span>
        </div>

        <div className="relative my-auto max-w-xl">
          <motion.div initial={{ opacity: 0, scale: 0.9, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 1.2, ease }}>
            <DeltaMark className="mb-12 h-24 text-brass-light" strokeWidth={1} />
          </motion.div>
          <motion.blockquote
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15, ease }}
            className="display text-[3.4rem] leading-[1.02] xl:text-[4.2rem]"
          >
            The quiet work behind <em className="text-brass-light">world-class</em> learning.
          </motion.blockquote>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.4 }} className="mt-6 max-w-md text-paper/55">
            Courses, orders, learner conversations and every image on the site — all in one place.
          </motion.p>
        </div>

        <div className="eyebrow relative flex justify-between text-paper/35">
          <span>Delta International Academy</span>
          <span>Est. 2026</span>
        </div>
      </section>

      {/* Form */}
      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink/55 transition-colors hover:text-ink">
            <ArrowLeft className="size-4" /> Back to website
          </Link>
          <DeltaMark className="h-7 text-ink lg:hidden" />
        </div>

        <div className="mx-auto my-auto w-full max-w-[400px] py-12">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
            <p className="eyebrow mb-4 flex items-center gap-2 text-brass">
              <span className="h-px w-6 bg-brass/60" /> Admin studio
            </p>
            <h1 className="display text-5xl">Welcome back.</h1>
            <p className="mt-3 text-ink/60">Sign in to manage courses, orders and website content.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease }}>
          {step === "code" ? (
            <motion.form animate={shake} onSubmit={submitCode} className="mt-10 space-y-5" noValidate>
              <div className="flex items-start gap-3 rounded-xl border border-line bg-white/70 p-4 text-sm text-ink/70">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brass" />
                <span>
                  {useRecovery
                    ? "Enter one of your recovery codes. Each code works only once."
                    : "Open your authenticator app and enter the 6-digit code for Delta Admin."}
                </span>
              </div>
              <Field label={useRecovery ? "Recovery code" : "Authentication code"} htmlFor="code">
                <Input
                  id="code"
                  autoFocus
                  inputMode={useRecovery ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  maxLength={useRecovery ? 12 : 7}
                  required
                  value={code}
                  onChange={(e) => setCode(useRecovery ? e.target.value : e.target.value.replace(/[^0-9 ]/g, ""))}
                  placeholder={useRecovery ? "abcd-efgh" : "123 456"}
                  aria-invalid={!!error}
                  className="h-12 text-center font-mono text-lg tracking-[0.3em]"
                />
              </Field>

              {error && (
                <p role="alert" className="rounded-xl border border-pin/20 bg-pin/5 px-4 py-3 text-sm text-pin">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                loading={busy}
                className="group w-full justify-center"
                disabled={code.replace(/[^0-9a-z]/gi, "").length < (useRecovery ? 8 : 6)}
              >
                Verify and sign in
                {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-ink/60 underline-offset-4 hover:text-ink hover:underline"
                  onClick={() => {
                    setUseRecovery((v) => !v);
                    setCode("");
                    setError(null);
                  }}
                >
                  <KeyRound className="size-3.5" />
                  {useRecovery ? "Use authenticator code" : "Use a recovery code"}
                </button>
                <button
                  type="button"
                  className="text-ink/50 underline-offset-4 hover:text-ink hover:underline"
                  onClick={() => {
                    setStep("password");
                    setCode("");
                    setError(null);
                  }}
                >
                  Start over
                </button>
              </div>
            </motion.form>
          ) : (
          <motion.form animate={shake} onSubmit={submit} className="mt-10 space-y-5" noValidate>
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                aria-invalid={!!error}
                className="h-12"
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  aria-invalid={!!error}
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

            {error && (
              <p role="alert" className="rounded-xl border border-pin/20 bg-pin/5 px-4 py-3 text-sm text-pin">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={busy} className="group w-full justify-center">
              Sign in
              {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
            </Button>
          </motion.form>
          )}
          </motion.div>

          {showDemoHint && step === "password" && (
          <p className="mt-8 flex items-start gap-2.5 rounded-xl border border-line bg-white/70 px-4 py-3 text-[0.8125rem] text-ink/60">
            <Info className="mt-0.5 size-4 shrink-0 text-brass" />
            <span>
              Demo credentials are in <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[0.75rem] text-ink">.env.example</code>. Copy it to{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[0.75rem] text-ink">.env.local</code> to change them.
            </span>
          </p>
          )}
        </div>

        <p className="eyebrow text-center text-ink/30">Protected area · Authorised staff only</p>
      </section>
    </div>
  );
}
