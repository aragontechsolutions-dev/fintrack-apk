/**
 * Opportunistic auto-backup — the reliable primary path.
 *
 * Runs while the app is in the foreground and unlocked (so it can checkpoint the
 * live DB before copying). Called on login and when the app returns to the
 * foreground. If a backup is due per the configured interval, it creates a
 * snapshot; failures are recorded in meta and never crash the app.
 */

import { isBackupDue, readMeta } from './meta';
import { createSnapshot } from './snapshot';

let running = false;

export async function maybeRunAutoBackup(): Promise<boolean> {
  if (running) return false;
  running = true;
  try {
    const meta = await readMeta();
    if (!isBackupDue(meta)) return false;
    await createSnapshot();
    return true;
  } catch {
    // createSnapshot already recorded lastError in meta.
    return false;
  } finally {
    running = false;
  }
}
