import { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { join } from "node:path";

// On macOS, use Homebrew SQLite for extension support
if (process.platform === "darwin") {
  try {
    Database.setCustomSQLite("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib");
  } catch {
    // SQLite already loaded, ignore
  }
}

const dbPath = join(homedir(), ".basic-memory", "memory.db");
const db = new Database(dbPath);

// Load sqlite-vec extension
const sqliteVec = require("sqlite-vec");
sqliteVec.load(db);

// Drop old table
try {
  db.run("DROP TABLE IF EXISTS brain_embeddings");
  console.log("Dropped old brain_embeddings table");
} catch (e: any) {
  console.log("Error dropping table:", e.message);
}

// Create new table with chunked schema
db.run(`
  CREATE VIRTUAL TABLE brain_embeddings USING vec0(
    chunk_id TEXT PRIMARY KEY,
    embedding FLOAT[768],
    entity_id TEXT,
    chunk_index INTEGER,
    +chunk_start INTEGER,
    +chunk_end INTEGER,
    +total_chunks INTEGER,
    +chunk_text TEXT
  )
`);
console.log("Created new chunked embeddings table");

db.close();
console.log("Migration complete!");
