import path from "node:path";

/** Local filesystem locations (uploads always live on disk; db.json only for the JSON store). */
export const STORAGE_DIR = path.join(process.cwd(), "storage");
export const UPLOAD_DIR = path.join(STORAGE_DIR, "uploads");
export const DB_FILE = path.join(STORAGE_DIR, "db.json");
