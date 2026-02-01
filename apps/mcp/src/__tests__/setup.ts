/**
 * Test setup file - runs once before all tests.
 * Configures custom SQLite for macOS to enable extension loading.
 */
import { Database } from "bun:sqlite";

// On macOS, use Homebrew SQLite for extension support.
// This must be called ONCE before any Database instances are created.
if (process.platform === "darwin") {
	Database.setCustomSQLite("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib");
}
