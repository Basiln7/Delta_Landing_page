import "server-only";
import { promises as fs } from "node:fs";
import { MongoClient, type AnyBulkWriteOperation, type Db, type Document } from "mongodb";
import { SEED_VERSION, seed } from "@/data/seed";
import type { Database } from "@/lib/types";
import { DB_FILE } from "./paths";
import type { ContentSnapshot, DataStore } from "./store";

/**
 * MongoDB store.
 *
 * Layout — one MongoDB collection per entity (not one big document):
 *   site            { _id: "settings", …SiteSettings } and { _id: "meta", version, partners }
 *   courses, plans, modules, projects, tools, faculty, testimonials, events, faqs,
 *   stats, pillars, experiences, admissions, media      → editorial order kept in `_pos`
 *   orders, enquiries, processed_events                  → time-ordered (newest first), indexed
 * Every document uses the entity's own `id` as `_id`.
 *
 * Callers keep the same snapshot API (readDb / mutateDb). mutateDb diffs the snapshot before and
 * after the mutator and writes only what changed (insert / replace / delete per document) in one
 * unordered bulkWrite per collection — so an order insert touches one document, not the whole site.
 */

type ArrayKey = Exclude<keyof Database, "version" | "settings" | "partners" | SingletonKey>;
/** Private single documents stored in `site` under their own _id. */
type SingletonKey = "mail" | "security";
const SINGLETONS: SingletonKey[] = ["mail", "security"];

const COLLECTIONS: Record<ArrayKey, { name: string; timeField?: string }> = {
  stats: { name: "stats" },
  pillars: { name: "pillars" },
  courses: { name: "courses" },
  plans: { name: "plans" },
  modules: { name: "modules" },
  projects: { name: "projects" },
  tools: { name: "tools" },
  experiences: { name: "experiences" },
  faculty: { name: "faculty" },
  testimonials: { name: "testimonials" },
  events: { name: "events" },
  faqs: { name: "faqs" },
  admissions: { name: "admissions" },
  media: { name: "media" },
  enquiries: { name: "enquiries", timeField: "createdAt" },
  orders: { name: "orders", timeField: "createdAt" },
  processedEvents: { name: "processed_events", timeField: "receivedAt" },
  mailLog: { name: "mail_log", timeField: "at" },
};

const ARRAY_KEYS = Object.keys(COLLECTIONS) as ArrayKey[];
const PRIVATE_KEYS: ArrayKey[] = ["orders", "enquiries", "processedEvents", "mailLog"];
const CONTENT_KEYS = ARRAY_KEYS.filter((k) => !PRIVATE_KEYS.includes(k));

/* ───────────────────────── connection (cached across dev hot reloads) ───────────────────────── */

const globalForMongo = globalThis as unknown as { __deltaMongo?: { uri: string; client: MongoClient; ready: Promise<MongoClient> } };

function dbName() {
  return process.env.MONGODB_DB?.trim() || "delta_markets";
}

async function database(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!globalForMongo.__deltaMongo || globalForMongo.__deltaMongo.uri !== uri) {
    const client = new MongoClient(uri, { appName: "delta-markets-academy", maxPoolSize: 10, serverSelectionTimeoutMS: 6000 });
    globalForMongo.__deltaMongo = { uri, client, ready: client.connect() };
  }
  const client = await globalForMongo.__deltaMongo.ready;
  const db = client.db(dbName());
  await prepare(db);
  return db;
}

/* ───────────────────────── one-time setup: indexes + initial data ───────────────────────── */

let preparing: Promise<void> | null = null;

function prepare(db: Db) {
  preparing ??= (async () => {
    await Promise.all([
      db.collection("orders").createIndexes([
        { key: { number: 1 }, name: "number_unique", unique: true },
        { key: { createdAt: -1 }, name: "createdAt" },
        { key: { status: 1, createdAt: -1 }, name: "status_createdAt" },
        { key: { gatewayOrderId: 1 }, name: "gatewayOrderId", sparse: true },
        { key: { gatewayPaymentId: 1 }, name: "gatewayPaymentId", sparse: true },
      ]),
      db.collection("enquiries").createIndexes([
        { key: { createdAt: -1 }, name: "createdAt" },
        { key: { status: 1 }, name: "status" },
      ]),
      db.collection("processed_events").createIndex({ receivedAt: -1 }, { name: "receivedAt" }),
      db.collection("mail_log").createIndex({ at: -1 }, { name: "at" }),
      ...CONTENT_KEYS.map((k) => db.collection(COLLECTIONS[k].name).createIndex({ _pos: 1 }, { name: "position" })),
    ]);
    await seedIfEmpty(db);
  })().catch((err) => {
    preparing = null; // retry on next request
    throw err;
  });
  return preparing;
}

/** Initial data: the current local storage/db.json if it exists (keeps your edits), otherwise src/data/seed.ts. */
async function initialData(): Promise<{ data: Database; source: string }> {
  try {
    const parsed = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Database;
    if (parsed.version === SEED_VERSION && parsed.settings) return { data: parsed, source: "storage/db.json" };
  } catch {
    /* no local file — fall through */
  }
  return { data: structuredClone(seed), source: "src/data/seed.ts" };
}

async function seedIfEmpty(db: Db) {
  const site = db.collection<Document>("site");
  if (await site.findOne({ _id: "meta" } as Document)) {
    const meta = await site.findOne({ _id: "meta" } as Document);
    if (meta && meta.version !== SEED_VERSION) {
      console.warn(`[mongodb] database "${dbName()}" holds data version ${meta.version}, app expects ${SEED_VERSION}. Not overwriting — migrate deliberately.`);
    }
    return;
  }
  const { data, source } = await initialData();
  for (const key of ARRAY_KEYS) {
    const items = (data[key] ?? []) as unknown as { id: string }[];
    if (!items.length) continue;
    await db
      .collection<Document>(COLLECTIONS[key].name)
      .insertMany(items.map((it, i) => toDoc(key, it, i)), { ordered: false })
      .catch(ignoreDuplicates);
  }
  await site.insertOne({ _id: "settings", ...data.settings } as Document).catch(ignoreDuplicates);
  // meta last: its presence marks the database as seeded
  await site.insertOne({ _id: "meta", version: data.version, partners: data.partners ?? [], seededFrom: source, seededAt: new Date().toISOString() } as Document).catch(ignoreDuplicates);
  console.info(`[mongodb] seeded "${dbName()}" from ${source}`);
}

function ignoreDuplicates(err: unknown) {
  if ((err as { code?: number })?.code === 11000) return;
  throw err;
}

/* ───────────────────────── mapping ───────────────────────── */

function toDoc(key: ArrayKey, item: { id: string }, index: number): Document {
  const doc: Document = { _id: item.id, ...item };
  if (!COLLECTIONS[key].timeField) doc._pos = index;
  return doc;
}

const PROJECTION = { projection: { _id: 0, _pos: 0 } } as const;

async function readArray(db: Db, key: ArrayKey) {
  const { name, timeField } = COLLECTIONS[key];
  const sort: Record<string, 1 | -1> = timeField ? { [timeField]: -1, _id: 1 } : { _pos: 1, _id: 1 };
  return db.collection(name).find({}, PROJECTION).sort(sort).toArray();
}

type SiteDoc = Document & { _id: string };

async function readSite(db: Db, includePrivate: boolean) {
  const docs = await db.collection<SiteDoc>("site").find({}).toArray();
  const settings: Document = docs.find((d) => d._id === "settings") ?? {};
  const meta: Document = docs.find((d) => d._id === "meta") ?? {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...settingsFields } = settings;
  const out: Record<string, unknown> = {
    settings: settingsFields as Database["settings"],
    version: (meta.version as number) ?? SEED_VERSION,
    partners: (meta.partners as string[]) ?? [],
  };
  if (includePrivate) {
    for (const key of SINGLETONS) {
      const doc = docs.find((d) => d._id === key);
      if (!doc) continue;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id: _s, ...fields } = doc;
      out[key] = fields;
    }
  }
  return out;
}

async function snapshot(keys: ArrayKey[]) {
  const db = await database();
  const includePrivate = keys.some((k) => PRIVATE_KEYS.includes(k));
  const [site, ...arrays] = await Promise.all([readSite(db, includePrivate), ...keys.map((k) => readArray(db, k))]);
  const out: Record<string, unknown> = { ...site };
  keys.forEach((k, i) => (out[k] = arrays[i]));
  return out;
}

/* ───────────────────────── diff + write ───────────────────────── */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function persistChanges(before: Database, after: Database) {
  const db = await database();
  const writes: Promise<unknown>[] = [];

  if (!same(before.settings, after.settings)) {
    writes.push(db.collection<Document>("site").replaceOne({ _id: "settings" } as Document, { ...after.settings }, { upsert: true }));
  }
  for (const key of SINGLETONS) {
    if (same(before[key], after[key])) continue;
    const value = after[key];
    writes.push(
      value
        ? db.collection<Document>("site").replaceOne({ _id: key } as Document, { ...value }, { upsert: true })
        : db.collection<Document>("site").deleteOne({ _id: key } as Document),
    );
  }
  if (before.version !== after.version || !same(before.partners, after.partners)) {
    writes.push(db.collection<Document>("site").updateOne({ _id: "meta" } as Document, { $set: { version: after.version, partners: after.partners ?? [] } }, { upsert: true }));
  }

  for (const key of ARRAY_KEYS) {
    const prev = (before[key] ?? []) as unknown as { id: string }[];
    const next = (after[key] ?? []) as unknown as { id: string }[];
    const positional = !COLLECTIONS[key].timeField;
    const prevIndex = new Map(prev.map((it, i) => [it.id, i]));
    const nextIds = new Set(next.map((it) => it.id));
    const ops: AnyBulkWriteOperation<Document>[] = [];

    next.forEach((item, i) => {
      const j = prevIndex.get(item.id);
      const changed = j === undefined || !same(prev[j], item) || (positional && j !== i);
      if (changed) ops.push({ replaceOne: { filter: { _id: item.id } as Document, replacement: toDoc(key, item, i), upsert: true } });
    });
    for (const item of prev) {
      if (!nextIds.has(item.id)) ops.push({ deleteOne: { filter: { _id: item.id } as Document } });
    }
    if (ops.length) writes.push(db.collection<Document>(COLLECTIONS[key].name).bulkWrite(ops, { ordered: false }));
  }

  await Promise.all(writes);
}

let writeQueue: Promise<unknown> = Promise.resolve();

async function readDb(): Promise<Database> {
  return (await snapshot(ARRAY_KEYS)) as unknown as Database;
}

function mutateDb<T>(mutator: (db: Database) => T | Promise<T>): Promise<T> {
  // Serialised within this server process. Across instances, writes are per-document
  // (last writer wins per document) and order numbers are protected by a unique index.
  const run = async () => {
    const before = await readDb();
    const draft = structuredClone(before);
    const result = await mutator(draft);
    await persistChanges(before, draft);
    return result;
  };
  const next = writeQueue.then(run, run);
  writeQueue = next.catch(() => undefined);
  return next;
}

export const mongoStore: DataStore = {
  kind: "mongodb",
  readDb,
  readContent: async () => (await snapshot(CONTENT_KEYS)) as unknown as ContentSnapshot,
  mutateDb,
  readSecurity: async () => {
    const doc = await (await database()).collection<SiteDoc>("site").findOne({ _id: "security" });
    if (!doc) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...fields } = doc;
    return fields as unknown as Database["security"];
  },
  ping: async () => {
    await (await database()).command({ ping: 1 });
  },
};

/** Shared connection for other server modules (e.g. the rate limiter). */
export const mongoDatabase = database;

export const mongoDbName = dbName;
