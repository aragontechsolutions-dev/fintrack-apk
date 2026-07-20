/**
 * Backup metadata, stored as a plaintext JSON file so a background task (which
 * runs while the DB is locked and the DEK is gone) can still read/update it.
 * Contains no secrets — only timestamps and settings.
 */

import * as FileSystem from 'expo-file-system';

const META_FILE = FileSystem.documentDirectory + 'backup-meta.json';

export interface BackupMeta {
  autoEnabled: boolean;
  intervalHours: number;
  lastBackupAt: number | null;
  lastError: string | null;
  keepSnapshots: number;
}

const DEFAULT_META: BackupMeta = {
  autoEnabled: true,
  intervalHours: 24,
  lastBackupAt: null,
  lastError: null,
  keepSnapshots: 5,
};

export async function readMeta(): Promise<BackupMeta> {
  const info = await FileSystem.getInfoAsync(META_FILE);
  if (!info.exists) return { ...DEFAULT_META };
  try {
    const raw = await FileSystem.readAsStringAsync(META_FILE);
    return { ...DEFAULT_META, ...(JSON.parse(raw) as Partial<BackupMeta>) };
  } catch {
    return { ...DEFAULT_META };
  }
}

export async function writeMeta(meta: BackupMeta): Promise<void> {
  await FileSystem.writeAsStringAsync(META_FILE, JSON.stringify(meta));
}

export async function updateMeta(
  patch: Partial<BackupMeta>,
): Promise<BackupMeta> {
  const current = await readMeta();
  const next = { ...current, ...patch };
  await writeMeta(next);
  return next;
}

/** True when a backup is due (never backed up, or older than the interval). */
export function isBackupDue(meta: BackupMeta): boolean {
  if (!meta.autoEnabled) return false;
  if (meta.lastBackupAt == null) return true;
  const elapsedMs = Date.now() - meta.lastBackupAt;
  return elapsedMs >= meta.intervalHours * 3600 * 1000;
}
