"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  Ban,
  CheckCircle2,
  ChevronRight,
  Copy,
  Crown,
  Info,
  KeyRound,
  Link2,
  LogOut,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader } from "@/components/admin/ui";
import { ConfirmDialog, Drawer, Modal } from "@/components/admin/Overlay";
import { RelativeTime } from "@/components/admin/RelativeTime";
import { api, ApiError } from "@/lib/admin/client";
import { ROLE_META } from "@/lib/roles";
import type { LinkResult } from "@/lib/security/user-admin";
import type { PublicUser } from "@/lib/security/users";
import type { AdminAuditEntry, AdminRole } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

type Snapshot = { users: PublicUser[]; audit: AdminAuditEntry[] };
type Result = Snapshot & { link?: LinkResult };
type Person = { name: string; email: string };
type ShownLink = LinkResult & Person;
type Confirm = { title: string; description: ReactNode; confirmLabel: string; tone?: "danger" | "primary"; run: () => Promise<void> } | null;
type StepUp = { title: string; run: (code: string) => Promise<void> } | null;
type Me = { id: string; twoFactor: boolean };

const errorText = (e: unknown, fallback = "That didn't work. Try again.") => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

const STATUS: Record<PublicUser["status"], { label: (u: PublicUser) => string; tone: "green" | "brass" | "muted" | "pin" }> = {
  active: { label: () => "Active", tone: "green" },
  pending: { label: (u) => (u.linkPurpose === "reset" ? "Reset pending" : "Invite pending"), tone: "brass" },
  expired: { label: () => "Link expired", tone: "muted" },
  disabled: { label: () => "Disabled", tone: "pin" },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

function RoleBadge({ user }: { user: Pick<PublicUser, "role" | "owner"> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={user.role === "super_admin" ? "ink" : "neutral"}>{ROLE_META[user.role].short}</Badge>
      {user.owner && (
        <Badge tone="brass">
          <Crown className="size-3" /> Owner
        </Badge>
      )}
    </span>
  );
}

function StatusBadge({ user }: { user: PublicUser }) {
  const s = STATUS[user.status];
  return <Badge tone={s.tone}>{s.label(user)}</Badge>;
}

/* ───────────────────────── page ───────────────────────── */

export function UsersView({ initial, me, mailReady, openNew }: { initial: Snapshot; me: Me; mailReady: boolean; openNew: boolean }) {
  const [users, setUsers] = useState(initial.users);
  const [audit, setAudit] = useState(initial.audit);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(openNew);
  const [link, setLink] = useState<ShownLink | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [stepUp, setStepUp] = useState<StepUp>(null);

  const open = users.find((u) => u.id === openId) ?? null;

  const counts = useMemo(
    () => ({
      superAdmins: users.filter((u) => u.role === "super_admin" && u.status !== "disabled").length,
      admins: users.filter((u) => u.role === "admin" && u.status !== "disabled").length,
      pending: users.filter((u) => u.status === "pending" || u.status === "expired").length,
      twoFactor: users.filter((u) => u.status === "active" && u.twoFactor).length,
      active: users.filter((u) => u.status === "active").length,
    }),
    [users],
  );

  const apply = (r: Result, person?: Person) => {
    setUsers(r.users);
    setAudit(r.audit);
    if (r.link && person) setLink({ ...r.link, ...person });
  };

  /** Call the API; when the server asks for a fresh 2FA code, ask for it and repeat the call with it. */
  const run = async (call: (code?: string) => Promise<Result>, opts: { success: string; stepUpTitle: string; person?: Person }) => {
    try {
      apply(await call(), opts.person);
      toast.success(opts.success);
    } catch (e) {
      if (e instanceof ApiError && e.stepUp) {
        setStepUp({
          title: opts.stepUpTitle,
          run: async (code) => {
            apply(await call(code), opts.person);
            toast.success(opts.success);
          },
        });
        return;
      }
      toast.error(errorText(e));
      throw e;
    }
  };

  const ask = (c: NonNullable<Confirm>) => setConfirm(c);

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Users"
        description="Who can sign in to the admin and what they can do. New people get a one-time link to choose their own password."
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Add user
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Super admins", value: counts.superAdmins },
          { label: "Admins", value: counts.admins },
          { label: "Waiting for a password", value: counts.pending },
          { label: "Using 2-step", value: `${counts.twoFactor}/${counts.active}` },
        ].map((s) => (
          <Card key={s.label} className="px-4 py-3.5">
            <p className="text-xs text-ink/50">{s.label}</p>
            <p className="display mt-1 text-3xl tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <div className="min-w-0">
          {users.length === 0 ? (
            <EmptyState icon={<UsersRound className="size-6" />} title="No users yet" description="Add the first person who should help manage the site." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="hidden grid-cols-[minmax(0,1.6fr)_10rem_8rem_5rem_7.5rem_1rem] gap-4 border-b border-line bg-paper/40 px-5 py-2.5 lg:grid">
                {["User", "Role", "Status", "2-step", "Last sign-in", ""].map((h) => (
                  <span key={h} className="eyebrow text-[0.5625rem] text-ink/40">
                    {h}
                  </span>
                ))}
              </div>
              <motion.ul layout className="divide-y divide-line">
                <AnimatePresence initial={false}>
                  {users.map((u) => (
                    <motion.li key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <button onClick={() => setOpenId(u.id)} className="group w-full px-4 py-3.5 text-left transition-colors hover:bg-paper/40 lg:px-5">
                        <div className="flex items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1.6fr)_10rem_8rem_5rem_7.5rem_1rem] lg:gap-4">
                          <span className="flex min-w-0 flex-1 items-center gap-3">
                            <span
                              className={cn(
                                "grid size-9 shrink-0 place-items-center rounded-xl font-mono text-xs",
                                u.status === "disabled" ? "bg-ink/[0.05] text-ink/35" : "bg-brass/12 text-[#8a6425]",
                              )}
                            >
                              {initials(u.name)}
                            </span>
                            <span className="min-w-0">
                              <span className={cn("block truncate text-sm font-medium", u.status === "disabled" && "text-ink/45")}>
                                {u.name}
                                {u.id === me.id && <span className="ml-1.5 text-xs font-normal text-ink/45">(you)</span>}
                              </span>
                              <span className="block truncate text-xs text-ink/50">{u.email}</span>
                              <span className="mt-1.5 flex flex-wrap gap-1 lg:hidden">
                                <RoleBadge user={u} />
                                <StatusBadge user={u} />
                              </span>
                            </span>
                          </span>
                          <span className="hidden lg:block">
                            <RoleBadge user={u} />
                          </span>
                          <span className="hidden lg:block">
                            <StatusBadge user={u} />
                          </span>
                          <span className="hidden text-xs lg:block">
                            {u.twoFactor ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <ShieldCheck className="size-3.5" /> On
                              </span>
                            ) : (
                              <span className="text-ink/40">Off</span>
                            )}
                          </span>
                          <span className="hidden text-xs text-ink/50 lg:block">{u.lastLoginAt ? <RelativeTime iso={u.lastLoginAt} /> : "Never"}</span>
                          <ChevronRight className="size-4 shrink-0 text-ink/25 transition-transform group-hover:translate-x-0.5 group-hover:text-ink/60" />
                        </div>
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </div>
          )}
        </div>

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <Card className="h-fit p-5 sm:p-6">
            <h2 className="display text-2xl">Roles</h2>
            <ul className="mt-4 space-y-3">
              {(["super_admin", "admin"] as AdminRole[]).map((r) => (
                <li key={r} className="rounded-xl border border-line bg-paper/30 p-3.5">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {r === "super_admin" ? <Crown className="size-4 text-brass" /> : <UsersRound className="size-4 text-ink/50" />}
                    {ROLE_META[r].label}
                  </p>
                  <p className="mt-1 text-xs text-ink/55">{ROLE_META[r].description}</p>
                </li>
              ))}
            </ul>
          </Card>
          <ActivityCard audit={audit} me={me} />
        </div>
      </div>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open?.name ?? "User"}
        description={open ? <span className="break-all">{open.email}</span> : null}
      >
        {open && <UserPanel key={open.id} user={open} me={me} run={run} ask={ask} />}
      </Drawer>

      <AddUserModal
        open={adding}
        onClose={() => setAdding(false)}
        mailReady={mailReady}
        meHas2fa={me.twoFactor}
        create={async (form) => {
          await run((code) => api<Result>("/api/admin/users", { method: "POST", json: { ...form, code } }), {
            success: `${form.name} was added`,
            stepUpTitle: `Make ${form.name} a super admin?`,
            person: { name: form.name, email: form.email },
          });
          setAdding(false);
        }}
      />

      <LinkModal link={link} onClose={() => setLink(null)} />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await confirm?.run();
        }}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone ?? "danger"}
      />

      <StepUpModal stepUp={stepUp} onClose={() => setStepUp(null)} />
    </>
  );
}

/* ───────────────────────── one user (drawer) ───────────────────────── */

type Run = (call: (code?: string) => Promise<Result>, opts: { success: string; stepUpTitle: string; person?: Person }) => Promise<void>;

function UserPanel({ user, me, run, ask }: { user: PublicUser; me: Me; run: Run; ask: (c: NonNullable<Confirm>) => void }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<AdminRole>(user.role);
  const [saving, setSaving] = useState(false);
  const isMe = user.id === me.id;
  const locked = user.owner || isMe; // role, status and resets are off-limits here
  const url = `/api/admin/users/${encodeURIComponent(user.id)}`;
  const person = { name: user.name, email: user.email };
  const dirty = name.trim() !== user.name || role !== user.role;

  const save = async () => {
    const json: Record<string, unknown> = {};
    if (name.trim() !== user.name) json.name = name.trim();
    if (role !== user.role) json.role = role;
    setSaving(true);
    try {
      await run((code) => api<Result>(url, { method: "PATCH", json: { ...json, code } }), {
        success: "Changes saved",
        stepUpTitle: `Make ${user.name} a super admin?`,
      });
    } catch {
      /* toast already shown */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      {user.owner && (
        <Note icon={<Crown className="size-4 text-brass" />}>
          The <strong>owner</strong> account is set on the server (<code className="font-mono text-xs">ADMIN_EMAIL</code>). Its password is changed on the server, and it can&apos;t
          be demoted, disabled or deleted, so there&apos;s always a way back in.
        </Note>
      )}
      {isMe && !user.owner && (
        <Note icon={<Info className="size-4 text-ink/50" />}>
          This is you. Change your own password and 2-step settings on the{" "}
          <Link href="/admin/security" className="underline underline-offset-2">
            Security
          </Link>{" "}
          page. Another super admin has to change your role.
        </Note>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-paper/40 p-4 text-sm">
        <Detail label="Status">
          <StatusBadge user={user} />
        </Detail>
        <Detail label="2-step verification">{user.twoFactor ? <span className="text-emerald-700">On</span> : <span className="text-ink/50">Off</span>}</Detail>
        <Detail label="Last sign-in">{user.lastLoginAt ? <RelativeTime iso={user.lastLoginAt} /> : "Never"}</Detail>
        <Detail label="Added">
          {formatDate(user.createdAt)}
          {user.createdBy && <span className="block text-xs text-ink/45">by {user.createdBy}</span>}
        </Detail>
        {user.linkExpiresAt && (
          <Detail label={user.status === "expired" ? "Link expired" : "Link expires"}>
            <RelativeTime iso={user.linkExpiresAt} />
          </Detail>
        )}
        {user.passwordChangedAt && (
          <Detail label="Password set">
            <RelativeTime iso={user.passwordChangedAt} />
          </Detail>
        )}
      </dl>

      <section className="space-y-4">
        <Field label="Name" htmlFor="user-name">
          <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <div>
          <p className="mb-1.5 text-[0.8125rem] font-medium text-ink/80">Role</p>
          <RolePicker value={role} onChange={setRole} disabled={locked} name={`role-${user.id}`} />
        </div>
        <Button onClick={save} loading={saving} disabled={!dirty || !name.trim()}>
          Save changes
        </Button>
      </section>

      {!locked && (
        <section className="space-y-2 border-t border-line pt-6">
          <p className="eyebrow mb-3 text-ink/40">Access</p>
          {user.status !== "disabled" &&
            (user.status === "active" ? (
              <ActionRow
                icon={<KeyRound className="size-4" />}
                title="Reset password"
                body="Makes a one-time link to choose a new password. Their current password stops working right away."
                onClick={() =>
                  ask({
                    title: `Reset ${user.name}'s password?`,
                    description: "Their current password stops working now and they're signed out everywhere. You'll get a link (valid 24 hours) to send them.",
                    confirmLabel: "Reset password",
                    run: () => run(() => api<Result>(`${url}/link`, { method: "POST", json: {} }), { success: "Reset link created", stepUpTitle: "Confirm", person }),
                  })
                }
              />
            ) : (
              <ActionRow
                icon={<Link2 className="size-4" />}
                title={user.linkPurpose === "reset" ? "New reset link" : "New invite link"}
                body="Makes a fresh one-time link. Any earlier link stops working."
                onClick={() =>
                  run(() => api<Result>(`${url}/link`, { method: "POST", json: {} }), { success: "New link created", stepUpTitle: "Confirm", person }).catch(() => undefined)
                }
              />
            ))}
          {user.status === "active" && (
            <ActionRow
              icon={<LogOut className="size-4" />}
              title="Sign out everywhere"
              body="Ends every session this person has open. They can sign in again with their password."
              onClick={() =>
                ask({
                  title: `Sign ${user.name} out everywhere?`,
                  description: "Every browser and device they're signed in on is signed out immediately.",
                  confirmLabel: "Sign out",
                  tone: "primary",
                  run: () => run(() => api<Result>(`${url}/sessions`, { method: "DELETE" }), { success: `${user.name} was signed out everywhere`, stepUpTitle: "Confirm" }),
                })
              }
            />
          )}
          {user.twoFactor && (
            <ActionRow
              icon={<ShieldOff className="size-4" />}
              title="Turn off 2-step verification"
              body="For a lost phone with no recovery codes left. They can set it up again after signing in."
              onClick={() =>
                ask({
                  title: `Turn off 2-step for ${user.name}?`,
                  description: "Their account will be protected by the password only until they set it up again. They're signed out everywhere.",
                  confirmLabel: "Turn off",
                  run: () =>
                    run((code) => api<Result>(`${url}/two-factor`, { method: "DELETE", json: { code } }), {
                      success: `2-step verification is off for ${user.name}`,
                      stepUpTitle: `Turn off 2-step for ${user.name}?`,
                    }),
                })
              }
            />
          )}
          {user.status === "disabled" ? (
            <ActionRow
              icon={<RotateCcw className="size-4" />}
              title="Enable account"
              body="Lets this person sign in again with their existing password."
              onClick={() =>
                run(() => api<Result>(url, { method: "PATCH", json: { disabled: false } }), { success: `${user.name} can sign in again`, stepUpTitle: "Confirm" }).catch(
                  () => undefined,
                )
              }
            />
          ) : (
            <ActionRow
              icon={<Ban className="size-4" />}
              title="Disable account"
              body="Blocks sign-in and ends their sessions, but keeps the account so you can enable it later."
              onClick={() =>
                ask({
                  title: `Disable ${user.name}?`,
                  description: "They're signed out everywhere and can't sign in until you enable the account again.",
                  confirmLabel: "Disable",
                  run: () => run(() => api<Result>(url, { method: "PATCH", json: { disabled: true } }), { success: `${user.name} is disabled`, stepUpTitle: "Confirm" }),
                })
              }
            />
          )}
          <ActionRow
            danger
            icon={<Trash2 className="size-4" />}
            title="Delete user"
            body="Removes the account for good. The activity log keeps a record."
            onClick={() =>
              ask({
                title: `Delete ${user.name}?`,
                description: (
                  <>
                    <strong className="text-ink">{user.email}</strong> will no longer be able to sign in, and any open session ends now. This can&apos;t be undone.
                  </>
                ),
                confirmLabel: "Delete user",
                run: () =>
                  run((code) => api<Result>(url, { method: "DELETE", json: { code } }), { success: `${user.name} was deleted`, stepUpTitle: `Delete ${user.name}?` }),
              })
            }
          />
        </section>
      )}
    </div>
  );
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-white p-3.5 text-sm text-ink/70">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink/50">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function ActionRow({ icon, title, body, onClick, danger }: { icon: ReactNode; title: string; body: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-line bg-white px-4 py-3 text-left transition-colors",
        danger ? "hover:border-pin/30 hover:bg-pin/[0.04]" : "hover:border-ink/20 hover:bg-paper/40",
      )}
    >
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", danger ? "bg-pin/10 text-pin" : "bg-paper text-ink/60")}>{icon}</span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-medium", danger && "text-pin")}>{title}</span>
        <span className="block text-xs text-ink/55">{body}</span>
      </span>
    </button>
  );
}

function RolePicker({ value, onChange, disabled, name }: { value: AdminRole; onChange: (r: AdminRole) => void; disabled?: boolean; name: string }) {
  return (
    <div role="radiogroup" aria-label="Role" className="grid gap-2 sm:grid-cols-2">
      {(["admin", "super_admin"] as AdminRole[]).map((r) => {
        const active = value === r;
        return (
          <label
            key={r}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors",
              active ? "border-ink bg-ink/[0.03] ring-1 ring-ink" : "border-line bg-white hover:border-ink/25",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input type="radio" name={name} value={r} checked={active} disabled={disabled} onChange={() => onChange(r)} className="mt-0.5 size-4 accent-[#0b1324]" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{ROLE_META[r].label}</span>
              <span className="block text-xs text-ink/55">{ROLE_META[r].description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ───────────────────────── add user ───────────────────────── */

type NewUser = { name: string; email: string; role: AdminRole; sendEmail: boolean };
const EMPTY: NewUser = { name: "", email: "", role: "admin", sendEmail: true };

function AddUserModal({
  open,
  onClose,
  mailReady,
  meHas2fa,
  create,
}: {
  open: boolean;
  onClose: () => void;
  mailReady: boolean;
  meHas2fa: boolean;
  create: (form: NewUser) => Promise<void>;
}) {
  const [form, setForm] = useState<NewUser>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setForm(EMPTY);
    setErrors({});
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await create({ ...form, name: form.name.trim(), email: form.email.trim(), sendEmail: mailReady && form.sendEmail });
      setForm(EMPTY);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v?.[0]])));
      else if (err instanceof ApiError && err.status === 409) setErrors({ email: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} label="Add user" className="sm:max-w-xl">
      <form className="p-6" onSubmit={submit} noValidate>
        <h2 className="display text-2xl">Add a user</h2>
        <p className="mt-1.5 text-sm text-ink/60">They&apos;ll get a one-time link (valid 72 hours) to choose their own password. You never see or set it.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="new-name" error={errors.name}>
            <Input id="new-name" data-autofocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} aria-invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Email" htmlFor="new-email" error={errors.email}>
            <Input
              id="new-email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={160}
              aria-invalid={Boolean(errors.email)}
            />
          </Field>
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-[0.8125rem] font-medium text-ink/80">Role</p>
          <RolePicker value={form.role} onChange={(role) => setForm({ ...form, role })} name="new-role" />
          {form.role === "super_admin" && meHas2fa && <p className="mt-2 text-xs text-ink/55">You&apos;ll be asked for a code from your authenticator app to confirm.</p>}
        </div>
        {mailReady ? (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" className="size-4 accent-[#b08a4a]" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
            Email the link to them as well
          </label>
        ) : (
          <p className="mt-4 rounded-xl bg-paper/60 px-3.5 py-2.5 text-xs text-ink/60">Email isn&apos;t set up yet, so you&apos;ll get the link to send them yourself.</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!form.name.trim() || !form.email.trim()}>
            Add user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── the one-time link ───────────────────────── */

function LinkModal({ link, onClose }: { link: ShownLink | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const done = () => {
    setCopied(false);
    onClose();
  };
  const copy = () =>
    link &&
    navigator.clipboard
      .writeText(link.url)
      .then(() => {
        setCopied(true);
        toast.success("Link copied");
      })
      .catch(() => toast.error("This browser blocked copying. Select the link and copy it."));

  return (
    <Modal open={Boolean(link)} onClose={done} label="One-time link">
      {link && (
        <div className="p-6">
          <div className="flex gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-600/10 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="display text-2xl">{link.purpose === "reset" ? "Reset link ready" : "Invite link ready"}</h2>
              <p className="mt-1 text-sm text-ink/60">
                {link.emailed ? (
                  <>
                    We emailed it to <strong className="text-ink">{link.email}</strong>. You can also copy it below.
                  </>
                ) : (
                  (link.reason ?? `Send this link to ${link.name} yourself.`)
                )}
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <input
              readOnly
              value={link.url}
              aria-label="One-time link"
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-paper/40 px-3 font-mono text-xs text-ink/80 outline-none"
            />
            <Button variant="secondary" onClick={copy}>
              <Copy className="size-4" /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink/55">
            Works once, until <span className="font-medium text-ink/70">{formatDate(link.expiresAt, { dateStyle: "medium", timeStyle: "short" })}</span>. Anyone with this link can set
            the password for {link.email}, so share it only with {link.name}, somewhere private. It won&apos;t be shown again.
          </p>
          <div className="mt-6 flex justify-end">
            <Button onClick={done}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ───────────────────────── step-up (fresh 2FA code) ───────────────────────── */

function StepUpModal({ stepUp, onClose }: { stepUp: StepUp; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    if (busy) return;
    setCode("");
    setError(null);
    onClose();
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepUp) return;
    setBusy(true);
    setError(null);
    try {
      await stepUp.run(code);
      setCode("");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.stepUp) {
        setError(err.message);
      } else {
        toast.error(errorText(err));
        setCode("");
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={Boolean(stepUp)} onClose={close} label="Confirm with a code">
      <form className="p-6" onSubmit={submit}>
        <h2 className="display text-2xl">{stepUp?.title}</h2>
        <p className="mt-1.5 text-sm text-ink/60">This change needs a fresh code from your authenticator app (or one of your recovery codes).</p>
        <Field label="Authenticator or recovery code" htmlFor="user-stepup-code" className="mt-5" error={error ?? undefined}>
          <Input
            id="user-stepup-code"
            data-autofocus
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123 456"
            aria-invalid={Boolean(error)}
            className="font-mono tracking-[0.2em]"
          />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={code.trim().length < 6}>
            Confirm
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ───────────────────────── activity ───────────────────────── */

function describe(e: AdminAuditEntry, me: Me): ReactNode {
  const actor = <strong className="font-medium text-ink">{e.actor.id === me.id ? "You" : e.actor.name}</strong>;
  const target = e.target ? <strong className="font-medium text-ink">{e.target.id === me.id ? "you" : e.target.name}</strong> : null;
  switch (e.action) {
    case "owner.created":
      return <>Owner account set up for {actor}{e.detail ? ` (${e.detail.toLowerCase()})` : ""}</>;
    case "user.created":
      return <>{actor} added {target} {e.detail}</>;
    case "user.invite_sent":
      return <>{actor} sent a new invite link to {target}</>;
    case "user.reset_sent":
      return <>{actor} reset the password of {target}</>;
    case "user.renamed":
      return <>{actor} renamed {e.detail ?? target}</>;
    case "user.role_changed":
      return <>{actor} changed {target}&apos;s role ({e.detail})</>;
    case "user.disabled":
      return <>{actor} disabled {target}</>;
    case "user.enabled":
      return <>{actor} enabled {target}</>;
    case "user.deleted":
      return <>{actor} deleted {target}{e.detail ? ` (${e.detail})` : ""}</>;
    case "user.signed_out":
      return <>{actor} signed {target} out everywhere</>;
    case "user.2fa_reset":
      return <>{actor} turned off 2-step verification for {target}</>;
    case "invite.accepted":
      return <>{actor} accepted the invite and set a password</>;
    case "password.reset":
      return <>{actor} set a new password from a reset link</>;
    case "password.changed":
      return <>{actor} changed {e.actor.id === me.id ? "your" : "their"} password</>;
    default:
      return <>{actor} made a change</>;
  }
}

function ActivityCard({ audit, me }: { audit: AdminAuditEntry[]; me: Me }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-brass" />
        <h2 className="display text-2xl">Activity</h2>
      </div>
      <p className="mt-1 text-xs text-ink/50">Changes to users and passwords. Newest first.</p>
      {audit.length === 0 ? (
        <p className="mt-5 text-sm text-ink/50">Nothing yet.</p>
      ) : (
        <ol className="mt-4 space-y-3.5">
          {audit.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brass/60" />
              <span className="min-w-0 text-ink/65">
                {describe(e, me)}
                <RelativeTime iso={e.at} className="block text-xs text-ink/40" />
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
