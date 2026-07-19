/**
 * Encrypted database client.
 *
 * Opens the SQLCipher-backed SQLite database with the raw DEK and returns a
 * Drizzle instance. The DEK only ever lives in memory for the duration of a
 * session; closing the DB (on logout / auto-logout) drops the handle.
 *
 * NOTE: `PRAGMA key` MUST run before any other statement touches the database,
 * otherwise SQLCipher will error ("file is not a database"). We also set a
 * conservative cipher config compatible with SQLCipher 4 defaults.
 */

import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

import { dekToRawKeyHex } from '../crypto/keyManager';
import * as schema from './schema';

const DB_NAME = 'fintrack.db';

export type Database = ExpoSQLiteDatabase<typeof schema> & {
  $client: SQLite.SQLiteDatabase;
};

let sqlite: SQLite.SQLiteDatabase | null = null;
let db: Database | null = null;

/**
 * Open (or return the already-open) encrypted database using the given DEK.
 * Throws if the key is wrong (a sanity query fails).
 */
export function openDatabase(dek: Uint8Array): Database {
  if (db && sqlite) return db;

  const conn = SQLite.openDatabaseSync(DB_NAME);
  // Provide the raw 256-bit key. The x'...' form tells SQLCipher this is a raw
  // key (no KDF applied on top), matching how we generated it.
  const rawKey = dekToRawKeyHex(dek);
  conn.execSync(`PRAGMA key = "x'${rawKey}'"`);
  // Touching sqlite_master forces SQLCipher to decrypt page 1. On a wrong key
  // this throws ("file is not a database"); on a fresh DB it returns 0 rows and
  // the file becomes encrypted on first write.
  conn.getFirstSync('SELECT count(*) as n FROM sqlite_master');
  // Reasonable durability/perf defaults.
  conn.execSync('PRAGMA foreign_keys = ON');
  conn.execSync('PRAGMA journal_mode = WAL');

  sqlite = conn;
  db = drizzle(conn, { schema }) as Database;
  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database is not open. Call openDatabase() first.');
  return db;
}

export function getRawConnection(): SQLite.SQLiteDatabase {
  if (!sqlite) throw new Error('Database is not open.');
  return sqlite;
}

export function isDatabaseOpen(): boolean {
  return db !== null;
}

/** Close the database and drop in-memory handles (used on logout). */
export function closeDatabase(): void {
  try {
    sqlite?.closeSync();
  } catch {
    // ignore
  }
  sqlite = null;
  db = null;
}
