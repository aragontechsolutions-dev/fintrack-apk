/**
 * Local snapshot backups: byte-for-byte copies of the already-encrypted
 * SQLite/SQLCipher database files plus the auth store.
 *
 * Because the .db file is encrypted at rest with the DEK, this works WITHOUT
 * the DEK in memory — which is exactly what a background task needs (the app is
 * locked when it runs). A snapshot is device-bound: it can only be decrypted
 * with the same wrapped keys (auth.json is included so restore keeps working).
 *
 * Writes are atomic: files go to a temp dir that is moved into place only after
 * everything copied successfully. Old snapshots are pruned to `keepSnapshots`.
 */

import * as FileSystem from 'expo-file-system';

import { SCHEMA_VERSION } from '../config/version';
import { checkpoint, isDatabaseOpen } from '../db/client';
import { readMeta, updateMeta } from './meta';

const DOC = FileSystem.documentDirectory ?? '';
const SQLITE_DIR = DOC + 'SQLite/';
const DB_FILES = ['fintrack.db', 'fintrack.db-wal', 'fintrack.db-shm'];
const AUTH_FILE = 'auth.json';
const BACKUPS_DIR = DOC + 'backups/';

export interface SnapshotInfo {
  dir: string;
  name: string;
  createdAt: number;
  schemaVersion: number;
}

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function copyIfExists(from: string, to: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(from);
  if (!info.exists) return false;
  await FileSystem.copyAsync({ from, to });
  return true;
}

/** Create a new snapshot. Returns the snapshot directory URI. */
export async function createSnapshot(): Promise<string> {
  // If the DB is open (foreground), flush WAL so the .db file is consistent.
  if (isDatabaseOpen()) checkpoint();

  await ensureDir(BACKUPS_DIR);
  const ts = Date.now();
  const name = `snap-${ts}`;
  const tmpDir = `${BACKUPS_DIR}${name}.tmp/`;
  const finalDir = `${BACKUPS_DIR}${name}/`;

  try {
    await ensureDir(tmpDir);
    const copied: string[] = [];
    for (const f of DB_FILES) {
      if (await copyIfExists(SQLITE_DIR + f, tmpDir + f)) copied.push(f);
    }
    await copyIfExists(DOC + AUTH_FILE, tmpDir + AUTH_FILE);

    const manifest = {
      createdAt: ts,
      schemaVersion: SCHEMA_VERSION,
      dbFiles: copied,
      hasAuth: true,
    };
    await FileSystem.writeAsStringAsync(
      tmpDir + 'manifest.json',
      JSON.stringify(manifest),
    );

    // Atomic finalize.
    await FileSystem.moveAsync({ from: tmpDir, to: finalDir });

    await updateMeta({ lastBackupAt: ts, lastError: null });
    await pruneSnapshots();
    return finalDir;
  } catch (e) {
    // Clean up the temp dir on failure and record the error.
    try {
      await FileSystem.deleteAsync(tmpDir, { idempotent: true });
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : 'error desconocido';
    await updateMeta({ lastError: msg });
    throw e;
  }
}

/** List available snapshots, newest first. */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const info = await FileSystem.getInfoAsync(BACKUPS_DIR);
  if (!info.exists) return [];
  const entries = await FileSystem.readDirectoryAsync(BACKUPS_DIR);
  const snaps: SnapshotInfo[] = [];
  for (const name of entries) {
    if (name.endsWith('.tmp') || !name.startsWith('snap-')) continue;
    const dir = `${BACKUPS_DIR}${name}/`;
    let createdAt = Number(name.replace('snap-', '')) || 0;
    let schemaVersion = SCHEMA_VERSION;
    try {
      const raw = await FileSystem.readAsStringAsync(dir + 'manifest.json');
      const m = JSON.parse(raw);
      createdAt = m.createdAt ?? createdAt;
      schemaVersion = m.schemaVersion ?? schemaVersion;
    } catch {
      /* fall back to name-derived timestamp */
    }
    snaps.push({ dir, name, createdAt, schemaVersion });
  }
  return snaps.sort((a, b) => b.createdAt - a.createdAt);
}

async function pruneSnapshots(): Promise<void> {
  const meta = await readMeta();
  const snaps = await listSnapshots();
  const toDelete = snaps.slice(Math.max(1, meta.keepSnapshots));
  for (const s of toDelete) {
    try {
      await FileSystem.deleteAsync(s.dir, { idempotent: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Restore a snapshot by overwriting the live DB files and auth store.
 * The database MUST be closed first (the caller logs out before calling this).
 * A safety snapshot of the current state is taken automatically beforehand.
 */
export async function restoreSnapshot(snapshotDir: string): Promise<void> {
  if (isDatabaseOpen()) {
    throw new Error('Cerrá sesión antes de restaurar.');
  }
  // Safety net: snapshot current state before overwriting.
  await createSnapshot();

  await ensureDir(SQLITE_DIR);
  // Remove current DB files, then copy snapshot's files back.
  for (const f of DB_FILES) {
    await FileSystem.deleteAsync(SQLITE_DIR + f, { idempotent: true });
  }
  for (const f of DB_FILES) {
    await copyIfExists(snapshotDir + f, SQLITE_DIR + f);
  }
  await copyIfExists(snapshotDir + AUTH_FILE, DOC + AUTH_FILE);
}

export async function deleteSnapshot(snapshotDir: string): Promise<void> {
  await FileSystem.deleteAsync(snapshotDir, { idempotent: true });
}
