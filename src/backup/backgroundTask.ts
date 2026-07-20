/**
 * Best-effort periodic backup via WorkManager (expo-background-fetch).
 *
 * IMPORTANT limitations (surfaced to the user in the Backups screen):
 *  - Android enforces a MINIMUM interval of 15 minutes and never guarantees an
 *    exact time; real execution depends on Doze/App-Standby and the OEM.
 *  - This task can only make a file-level SNAPSHOT (the DB is encrypted at
 *    rest), because the DEK is not in memory while the app is locked.
 *
 * "Every 24h" is therefore implemented as "on the first available window after
 * 24h have passed", using `lastBackupAt`. The opportunistic backup on app
 * unlock (see autoBackup.ts) is the reliable primary path; this is a backstop.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { isBackupDue, readMeta, updateMeta } from './meta';
import { notifyBackupOverdue } from './notify';
import { createSnapshot } from './snapshot';

export const BACKUP_TASK = 'fintrack-daily-backup';
const OVERDUE_NOTIFY_DAYS = 3;

// Task definition MUST live at module scope (registered at import time).
TaskManager.defineTask(BACKUP_TASK, async () => {
  try {
    const meta = await readMeta();
    if (isBackupDue(meta)) {
      await createSnapshot();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    // Not due, but warn if a real backup hasn't happened in a while.
    if (meta.lastBackupAt != null) {
      const days = Math.floor(
        (Date.now() - meta.lastBackupAt) / (24 * 3600 * 1000),
      );
      if (days >= OVERDUE_NOTIFY_DAYS) await notifyBackupOverdue(days);
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (e) {
    await updateMeta({
      lastError: e instanceof Error ? e.message : 'error en background',
    });
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/** Register (or refresh) the periodic task. Safe to call on every app start. */
export async function registerBackupTask(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }
    await BackgroundFetch.registerTaskAsync(BACKUP_TASK, {
      minimumInterval: 15 * 60, // seconds; Android clamps to >= 15 min
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Registration can fail on some OEMs; the opportunistic path still runs.
  }
}

export async function unregisterBackupTask(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKUP_TASK)) {
      await BackgroundFetch.unregisterTaskAsync(BACKUP_TASK);
    }
  } catch {
    /* ignore */
  }
}
