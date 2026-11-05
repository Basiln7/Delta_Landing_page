import "server-only";
import type { Database, EditableCollection, SiteContent } from "@/lib/types";
import { jsonStore } from "./json-store";
import { mongoDbName, mongoStore } from "./mongo-store";
import type { DataStore } from "./store";

/**
 * Repository entry point. Picks the storage driver at call time:
 *   MONGODB_URI set → MongoDB (production / shared data)
 *   otherwise      → local JSON file (zero-setup development)
 * Callers never import a driver directly.
 */
function store(): DataStore {
  return process.env.MONGODB_URI?.trim() ? mongoStore : jsonStore;
}

export { STORAGE_DIR, UPLOAD_DIR } from "./paths";

export function readDb(): Promise<Database> {
  return store().readDb();
}

/** Serialised read-modify-write. The mutator may change `db` in place and return any value. */
export function mutateDb<T>(mutator: (db: Database) => T | Promise<T>): Promise<T> {
  return store().mutateDb(mutator);
}

/** Everything the public landing page renders (never loads orders or enquiries). */
export async function getSiteContent(): Promise<SiteContent> {
  const content = await store().readContent();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { version, ...rest } = content;
  return {
    ...rest,
    courses: rest.courses.filter((c) => c.published),
    events: rest.events.filter((e) => e.published).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function getCollection<K extends EditableCollection>(key: K): Promise<Database[K]> {
  const db = await readDb();
  return db[key];
}

/** Which driver is active + a live connectivity check (used by /api/health). */
export async function dataStoreHealth() {
  const s = store();
  const started = Date.now();
  await s.ping();
  return { store: s.kind, database: s.kind === "mongodb" ? mongoDbName() : "storage/db.json", latencyMs: Date.now() - started };
}
