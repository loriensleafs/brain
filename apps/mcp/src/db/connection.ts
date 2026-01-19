import { Database } from "bun:sqlite";
import { join } from "path";
import { homedir } from "os";

// On macOS, use Homebrew SQLite for extension support.
// Wrapped in try/catch to handle case where SQLite is already loaded (e.g., in tests).
if (process.platform === "darwin") {
  try {
    Database.setCustomSQLite("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib");
  } catch {
    // SQLite already loaded, ignore
  }
}

const DB_PATH = join(homedir(), ".basic-memory", "memory.db");

export function createVectorConnection(): Database {
  const db = new Database(DB_PATH);

  // Load sqlite-vec extension
  const sqliteVec = require("sqlite-vec");
  sqliteVec.load(db);

  return db;
}

export function verifySqliteVec(db: Database): string | null {
  try {
    const result = db.query("SELECT vec_version()").get() as any;
    return result["vec_version()"];
  } catch {
    return null;
  }
}
