/**
 * High-level portable backup: encrypt the current user's data to a shareable
 * file, and restore from a picked file. Uses the passphrase-based container.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Database } from '../db/client';
import { BACKUP_EXT } from '../config/version';
import { BackupContainer, openBackup, sealBackup } from './container';
import { RestoreCounts, dumpUserData, restoreUserData } from './dump';
import { createSnapshot } from './snapshot';

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours(),
  )}${p(d.getMinutes())}`;
}

export interface ExportResult {
  uri: string;
  filename: string;
}

/** Create an encrypted backup file for the user and return its URI. */
export async function exportUserBackup(
  db: Database,
  userId: string,
  userName: string,
  passphrase: string,
): Promise<ExportResult> {
  const dump = await dumpUserData(db, userId);
  const container = await sealBackup(dump, passphrase);
  const safeName = userName.replace(/[^\w-]+/g, '_').slice(0, 20) || 'user';
  const filename = `fintrack-${safeName}-${stamp()}.${BACKUP_EXT}`;
  const uri = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(container));
  return { uri, filename };
}

/** Open the system share sheet for a previously exported backup file. */
export async function shareBackup(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartir no está disponible en este dispositivo.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Guardar backup de FinTrack',
  });
}

/** Let the user pick a backup file. Returns its URI, or null if cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: '*/*',
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0].uri;
}

/**
 * Restore a portable backup into the current user (REPLACE). A safety snapshot
 * is taken automatically before any destructive change.
 */
export async function importUserBackup(
  db: Database,
  userId: string,
  fileUri: string,
  passphrase: string,
): Promise<RestoreCounts> {
  const raw = await FileSystem.readAsStringAsync(fileUri);
  let container: BackupContainer;
  try {
    container = JSON.parse(raw) as BackupContainer;
  } catch {
    throw new Error('El archivo no es un backup válido de FinTrack.');
  }
  // Validates magic/version/checksum/passphrase and decrypts.
  const dump = await openBackup(container, passphrase);

  // Safety net before overwriting existing data.
  await createSnapshot();

  return restoreUserData(db, userId, dump);
}
