import type { AdminUser, Database } from "@/lib/types";

/** Everything except private/transactional collections — what the public site needs. */
export type ContentSnapshot = Omit<
  Database,
  "orders" | "enquiries" | "processedEvents" | "mail" | "mailLog" | "security" | "adminUsers" | "adminAudit"
>;

/** A storage driver. Callers never see which one is active. */
export interface DataStore {
  kind: "json" | "mongodb";
  /** Full snapshot (admin, APIs). */
  readDb(): Promise<Database>;
  /** Public content only — drivers may skip loading orders/enquiries. */
  readContent(): Promise<ContentSnapshot>;
  /** Serialised read-modify-write. The mutator may change `db` in place and return any value. */
  mutateDb<T>(mutator: (db: Database) => T | Promise<T>): Promise<T>;
  /** One admin user — read on every authenticated request, so it must be cheap. */
  readAdminUser(id: string): Promise<AdminUser | null>;
  /** All admin users (a handful of documents). */
  readAdminUsers(): Promise<AdminUser[]>;
  /** Connectivity check for /api/health. */
  ping(): Promise<void>;
}
