// Reset demo data. Next request re-seeds from src/data/seed.ts.
//   npm run db:reset            → JSON store: moves storage/db.json aside
//                                 MongoDB (MONGODB_URI set): drops the MONGODB_DB database
// Safety: only drops databases whose name starts with "delta" unless --force is passed.
import fs from "node:fs";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI?.trim();
const name = process.env.MONGODB_DB?.trim() || "delta_markets";

if (uri) {
  if (!/^delta/i.test(name) && !process.argv.includes("--force")) {
    console.error(`Refusing to drop "${name}" (name doesn't start with "delta"). Re-run with --force if you're sure.`);
    process.exit(1);
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000 });
  await client.connect();
  await client.db(name).dropDatabase();
  await client.close();
  console.log(`Dropped MongoDB database "${name}".`);
}

if (fs.existsSync("storage/db.json")) {
  const backup = `storage/db.backup-${Date.now()}.json`;
  fs.renameSync("storage/db.json", backup);
  console.log(`Moved storage/db.json to ${backup}.`);
}
console.log("Done — data re-seeds from src/data/seed.ts on the next request.");
