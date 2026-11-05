import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SEED_VERSION, seed } from "@/data/seed";
import type { Database } from "@/lib/types";
import { DB_FILE, STORAGE_DIR, UPLOAD_DIR } from "./paths";
import type { DataStore } from "./store";

/**
 * Local JSON file store — used when MONGODB_URI is not set (zero-setup development).
 * Writes are serialised through a queue and written atomically (temp file + rename).
 */

let writeQueue: Promise<unknown> = Promise.resolve();
let migration: Promise<void> | null = null;

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(seed, null, 2), "utf8");
  }
}

/** File written by an older seed shape → keep a backup, then re-seed (dev convenience). */
async function migrateIfOutdated(db: Database) {
  if (db.version === SEED_VERSION) return;
  migration ??= (async () => {
    const backup = path.join(STORAGE_DIR, `db.v${db.version ?? 0}.backup-${Date.now()}.json`);
    await fs.copyFile(DB_FILE, backup);
    await fs.writeFile(DB_FILE, JSON.stringify(seed, null, 2), "utf8");
  })().finally(() => {
    migration = null;
  });
  await migration;
}

async function readDb(): Promise<Database> {
  await ensureFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  let db: Database;
  try {
    db = JSON.parse(raw) as Database;
  } catch {
    // Corrupt file (e.g. manual edit) — fall back to seed rather than crashing the site.
    return structuredClone(seed);
  }
  if (db.version !== SEED_VERSION) {
    await migrateIfOutdated(db);
    return structuredClone(seed);
  }
  return db;
}

function mutateDb<T>(mutator: (db: Database) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const db = await readDb();
    const result = await mutator(db);
    const tmp = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, DB_FILE);
    return result;
  };
  const next = writeQueue.then(run, run);
  writeQueue = next.catch(() => undefined);
  return next;
}

export const jsonStore: DataStore = {
  kind: "json",
  readDb,
  readContent: async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { orders, enquiries, processedEvents, mail, mailLog, security, ...content } = await readDb();
    return content;
  },
  readSecurity: async () => (await readDb()).security,
  mutateDb,
  ping: async () => {
    await ensureFile();
  },
};
