"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Loader2, Lock } from "lucide-react";
import { WhatsAppIcon } from "@/components/brand/WhatsAppIcon";
import { toast } from "sonner";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "@/components/site/fin";
import { PROGRAM_OPTIONS, enquirySchema } from "@/lib/validators";
import { cn, whatsappHref } from "@/lib/utils";
import type { SiteSettings } from "@/lib/types";

type Errors = Partial<Record<string, string>>;

const inputCls = (error?: string) =>
  cn(
    "h-12 w-full rounded-xl border bg-white px-4 text-[0.95rem] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/35",
    "focus:border-ink focus:ring-4 focus:ring-brass-light/50",
    error ? "border-pin" : "border-ink/15",
  );

function Field({
  label,
  name,
  error,
  className,
  ...props
}: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className={inputCls(error)}
        {...props}
      />
      {error && (
        <span id={`${name}-error`} className="mt-1.5 block text-xs text-pin">
          {error}
        </span>
      )}
    </label>
  );
}

export function Enquire({ settings }: { settings: SiteSettings }) {
  const [program, setProgram] = useState<string>("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [firstName, setFirstName] = useState("");
  const wa = whatsappHref(settings.contact.whatsapp, settings.contact.whatsappMessage);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = { ...data, program };
    const parsed = enquirySchema.safeParse(payload);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
      return;
    }
    setErrors({});
    setStatus("sending");
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Something went wrong");
      setFirstName(parsed.data.parentName.split(" ")[0]);
      setStatus("sent");
      form.reset();
      setProgram("");
    } catch (err) {
      setStatus("idle");
      toast.error("We couldn't send your enquiry", { description: err instanceof Error ? err.message : "Please try again." });
    }
  }

  return (
    <section id="enquire" className="relative isolate overflow-hidden bg-night py-24 text-white sm:py-32">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute -left-40 top-10 h-[30rem] w-[30rem] rounded-full bg-brass-light/[0.06] blur-[120px]" />
        <div className="absolute -right-20 bottom-[-8rem] h-[28rem] w-[28rem] rounded-full bg-sky/[0.06] blur-[120px]" />
      </div>

      <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHeader
            tone="dark"
            eyebrow="Talk to a mentor · free"
            title="Not sure where to start? *Talk to a mentor.*"
            lede="Tell us your goal — start investing, trade part-time, automate your research — and a mentor will suggest the right course and batch. In English or Malayalam."
          />
          <Reveal delay={0.15}>
            <ol className="mt-8 space-y-3">
              {["Free 15-minute call with a mentor", "The right course & batch for your goal", "Help in English or Malayalam"].map((t, i) => (
                <li key={t} className="flex items-center gap-3 text-white/85">
                  <span className="num flex h-7 w-7 items-center justify-center rounded-full border border-edge bg-night-2 text-xs text-brass-light">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="card-dark group mt-8 flex max-w-md items-center gap-4 p-4 transition-colors hover:border-[#25D366]/50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <WhatsAppIcon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">Prefer to chat? Message us on WhatsApp</span>
                  <span className="block text-sm text-mute">
                    <span className="num">{settings.contact.whatsapp}</span> · replies within minutes
                  </span>
                </span>
                <ArrowUpRight className="h-5 w-5 text-mute transition-colors group-hover:text-[#25D366]" />
              </a>
            )}
          </Reveal>
        </div>

        <Reveal delay={0.08} className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-white p-6 text-ink shadow-[0_40px_100px_-40px_rgba(0,0,0,0.7)] sm:p-9">
            <AnimatePresence mode="wait" initial={false}>
              {status === "sent" ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[26rem] flex-col items-center justify-center text-center"
                  role="status"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald/12 text-emerald">
                    <Check className="h-8 w-8" strokeWidth={2.5} />
                  </span>
                  <p className="display mt-6 text-3xl">Thank you{firstName ? `, ${firstName}` : ""}.</p>
                  <p className="mt-3 max-w-sm text-ink/60">A mentor will reach out shortly on WhatsApp or email with the right course and batch for you.</p>
                  <button type="button" onClick={() => setStatus("idle")} className="btn-ghost-light mt-8">
                    Send another enquiry
                  </button>
                </motion.div>
              ) : (
                <motion.form key="form" noValidate onSubmit={onSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="display text-2xl">Get a free course plan</p>
                    <p className="mt-1 text-sm text-ink/55">Takes 30 seconds. A mentor replies the same day.</p>
                  </div>
                  <Field label="Your name" name="parentName" autoComplete="name" placeholder="Jane Doe" error={errors.parentName} className="sm:col-span-2" />
                  <Field label="Email" name="email" type="email" autoComplete="email" placeholder="jane@example.com" error={errors.email} />
                  <Field label="Phone / WhatsApp" name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" error={errors.phone} />

                  <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-sm font-medium text-ink">I&apos;m interested in</legend>
                    <div className="flex flex-wrap gap-2">
                      {PROGRAM_OPTIONS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={program === p}
                          onClick={() => setProgram(p)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm transition-colors focus-visible:ring-4 focus-visible:ring-brass-light/50",
                            program === p ? "border-ink bg-ink text-white" : "border-ink/15 text-ink/75 hover:border-ink/40",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    {errors.program && <span className="mt-2 block text-xs text-pin">{errors.program}</span>}
                  </fieldset>

                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-ink">Message (optional)</span>
                    <textarea
                      name="message"
                      rows={3}
                      placeholder="Your goal, current level, and when you'd like to start."
                      className="w-full resize-none rounded-xl border border-ink/15 bg-white px-4 py-3 text-[0.95rem] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink/35 focus:border-ink focus:ring-4 focus:ring-brass-light/50"
                    />
                  </label>

                  {/* honeypot */}
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

                  <div className="flex flex-col items-start justify-between gap-4 pt-1 sm:col-span-2 sm:flex-row sm:items-center">
                    <p className="flex max-w-xs items-start gap-2 text-xs leading-relaxed text-ink/50">
                      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      We only contact you about courses and never share your data.
                    </p>
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 font-semibold text-white transition-colors hover:bg-night-3 disabled:opacity-70"
                    >
                      {status === "sending" ? "Sending…" : "Get my free plan"}
                      {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 text-brass-light" />}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
