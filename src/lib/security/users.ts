import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mutateDb, readAdminUser, readAdminUsers, readDb } from "@/lib/db";
import type { AdminAuditAction, AdminAuditEntry, AdminInvite, AdminUser, Database } from "@/lib/types";
import { uid } from "@/lib/utils";
import { burnPasswordCheck, ownerCredentials, ownerEmail, verifyOwnerPassword } from "./owner";
import { verifyPasswordHash } from "./password";

/**
 * Admin users repository: lookups (with a short process-wide cache for per-request session checks),
 * serialised mutations, the owner account, sign-in checks, invite tokens and the activity log.
 * Nothing here is safe to send to a browser except what `publicUser` returns.
 */

export const OWNER_ID = "owner";
export const AUDIT_LIMIT = 500;
export const INVITE_TTL_MS = 72 * 60 * 60_000;
export const RESET_TTL_MS = 24 * 60 * 60_000;

/* ───────────────────────── reads (cached briefly) ───────────────────────── */

type CacheEntry = { at: number; value: AdminUser | null };
const holder = globalThis as unknown as { __deltaUserCache?: Map<string, CacheEntry> };
const cache = () => (holder.__deltaUserCache ??= new Map());
const USER_CACHE_MS = 2000;

/**
 * One user. Request-path session checks may use a 2-second cache (a page render checks the session
 * several times). Security DECISIONS pass `fresh: true`. Other servers see changes within the window.
 */
export async function getUser(id: string, opts: { fresh?: boolean } = {}): Promise<AdminUser | null> {
  const c = cache();
  const hit = c.get(id);
  if (!opts.fresh && hit && Date.now() - hit.at < USER_CACHE_MS) return hit.value;
  const value = await readAdminUser(id);
  c.set(id, { at: Date.now(), value });
  return value;
}

export function invalidateUserCache() {
  cache().clear();
}

/** All users, read fresh. */
export function listUsers(): Promise<AdminUser[]> {
  return readAdminUsers();
}

/** Can this account be used right now? (Owner: valid server credentials. Others: a password and not disabled.) */
export function isActiveUser(user: AdminUser | null | undefined): user is AdminUser {
  if (!user || user.disabled) return false;
  return user.owner ? ownerCredentials() !== null : Boolean(user.passwordHash);
}

/* ───────────────────────── writes ───────────────────────── */

/** Read-modify-write of the user list (and activity log) inside the serialised DB queue. */
export async function mutateUsers<T>(fn: (users: AdminUser[], db: Database) => T): Promise<T> {
  try {
    return await mutateDb((db) => {
      db.adminUsers ??= [];
      return fn(db.adminUsers, db);
    });
  } finally {
    invalidateUserCache();
  }
}

/** Mutate one user; `fn` only runs if the user exists (otherwise resolves to null). */
export async function mutateUser<T>(id: string, fn: (user: AdminUser, db: Database) => T): Promise<T | null> {
  return mutateUsers((users, db) => {
    const user = users.find((u) => u.id === id);
    if (!user) return null;
    const out = fn(user, db);
    user.updatedAt = new Date().toISOString();
    return out;
  });
}

/* ───────────────────────── activity log ───────────────────────── */

export type Who = AdminAuditEntry["actor"];
export const who = (u: Pick<AdminUser, "id" | "name" | "email">): Who => ({ id: u.id, name: u.name, email: u.email });

export function recordAudit(db: Database, action: AdminAuditAction, actor: Who, target?: Who, detail?: string) {
  const entry: AdminAuditEntry = {
    id: uid("au"),
    at: new Date().toISOString(),
    action,
    actor,
    ...(target ? { target } : {}),
    ...(detail ? { detail: detail.slice(0, 200) } : {}),
  };
  db.adminAudit = [entry, ...(db.adminAudit ?? [])].slice(0, AUDIT_LIMIT);
}

export async function listAudit(limit = 40): Promise<AdminAuditEntry[]> {
  return ((await readDb()).adminAudit ?? []).slice(0, limit);
}

/* ───────────────────────── the owner account ───────────────────────── */

function defaultOwnerName(email: string) {
  const local = email.split("@")[0]?.replace(/[._+-]+/g, " ").trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : "Owner";
}

/**
 * Make sure the owner account exists and matches ADMIN_EMAIL, with its fixed guarantees
 * (super admin, never disabled, password only from the server). On first start it takes over the
 * legacy single-admin security state: 2FA, recovery codes and session version.
 */
export async function ensureOwner(): Promise<void> {
  const email = ownerEmail();
  const current = await getUser(OWNER_ID);
  if (current ? (!email || current.email === email) && current.role === "super_admin" && current.owner && !current.disabled : !email) return;

  await mutateUsers((users, db) => {
    const owner = users.find((u) => u.id === OWNER_ID);
    const clash = email ? users.find((u) => u.id !== OWNER_ID && u.email === email) : undefined;
    if (clash) console.error("[users] ADMIN_EMAIL is already used by another admin user, so the owner account keeps its current email.");

    if (!owner) {
      if (!email || clash) return;
      const legacy = db.security;
      const created: AdminUser = {
        id: OWNER_ID,
        email,
        name: defaultOwnerName(email),
        role: "super_admin",
        owner: true,
        createdAt: new Date().toISOString(),
        // +1: any session from before users existed is signed out.
        sessionVersion: (legacy?.sessionVersion ?? 0) + 1,
        ...(legacy?.totp ? { totp: legacy.totp } : {}),
        ...(legacy?.recoveryCodes ? { recoveryCodes: legacy.recoveryCodes } : {}),
      };
      users.push(created);
      delete db.security;
      recordAudit(db, "owner.created", who(created), undefined, legacy?.totp ? "Kept the existing two-step verification" : undefined);
      return;
    }

    if (email && !clash && owner.email !== email) {
      owner.email = email;
      owner.sessionVersion = (owner.sessionVersion ?? 1) + 1;
    }
    owner.role = "super_admin";
    owner.owner = true;
    delete owner.disabled;
    delete owner.passwordHash;
    delete owner.invite;
  });
}

/* ───────────────────────── sign-in ───────────────────────── */

/** Whether anyone can sign in at all (owner credentials valid, or another user has a password). */
export async function signInAvailable(): Promise<boolean> {
  if (ownerCredentials()) return true;
  return (await listUsers()).some((u) => !u.owner && !u.disabled && u.passwordHash);
}

/**
 * Email + password check. Exactly one scrypt runs per call whatever the outcome, and unknown,
 * disabled and not-yet-activated accounts fail exactly like a wrong password.
 */
export async function authenticate(email: string, password: string): Promise<AdminUser | null> {
  await ensureOwner();
  const normalized = email.trim().toLowerCase();
  const user = (await listUsers()).find((u) => u.email === normalized);
  if (!user || user.disabled) {
    burnPasswordCheck(password);
    return null;
  }
  if (user.owner) return verifyOwnerPassword(password) ? user : null;
  if (!user.passwordHash) {
    burnPasswordCheck(password);
    return null;
  }
  return verifyPasswordHash(password, user.passwordHash) ? user : null;
}

/* ───────────────────────── invite / reset links ───────────────────────── */

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

/** A one-time token (returned once, for the link) and what's stored (its hash). */
export function newInvite(purpose: AdminInvite["purpose"], createdBy: string): { token: string; invite: AdminInvite } {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  return {
    token,
    invite: {
      tokenHash: hashToken(token),
      purpose,
      createdBy,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + (purpose === "invite" ? INVITE_TTL_MS : RESET_TTL_MS)).toISOString(),
    },
  };
}

/** The user a still-valid link belongs to (never the owner, never a disabled account). */
export function findByInviteToken(users: AdminUser[], token: string): AdminUser | undefined {
  if (!TOKEN_RE.test(token)) return undefined;
  const h = hashToken(token);
  return users.find((u) => !u.owner && !u.disabled && u.invite?.tokenHash === h && Date.parse(u.invite.expiresAt) > Date.now());
}

/** Where invite links point. Prefers the configured public URL; otherwise the address this request came in on. */
export function inviteUrl(token: string, req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(req.url).origin).replace(/\/$/, "");
  return `${base}/admin/invite#${token}`;
}

/* ───────────────────────── what the browser may see ───────────────────────── */

export type UserStatus = "active" | "pending" | "expired" | "disabled";

export function publicUser(u: AdminUser, names: Map<string, string> = new Map()) {
  const status: UserStatus = u.disabled
    ? "disabled"
    : u.owner || u.passwordHash
      ? "active"
      : u.invite && Date.parse(u.invite.expiresAt) > Date.now()
        ? "pending"
        : "expired";
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    owner: Boolean(u.owner),
    status,
    /** what the outstanding link is for, when the user has no password yet */
    linkPurpose: !u.owner && !u.passwordHash ? (u.invite?.purpose ?? "invite") : undefined,
    linkExpiresAt: !u.passwordHash ? u.invite?.expiresAt : undefined,
    twoFactor: Boolean(u.totp),
    createdAt: u.createdAt,
    createdBy: u.createdBy ? (names.get(u.createdBy) ?? "A removed user") : undefined,
    lastLoginAt: u.lastLoginAt,
    passwordChangedAt: u.passwordChangedAt,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;

const ROLE_ORDER = { super_admin: 0, admin: 1 } as const;

/** Owner first, then super admins, then admins; alphabetical within a role. */
export function publicUsers(users: AdminUser[]): PublicUser[] {
  const names = new Map(users.map((u) => [u.id, u.name]));
  return [...users]
    .sort((a, b) => Number(Boolean(b.owner)) - Number(Boolean(a.owner)) || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))
    .map((u) => publicUser(u, names));
}
