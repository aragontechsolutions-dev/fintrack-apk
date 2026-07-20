/**
 * Local notifications for backup status. Best-effort: if permissions are not
 * granted we silently skip (backups still run; the Settings screen shows state).
 */

import * as Notifications from 'expo-notifications';

let configured = false;

async function ensureConfigured(): Promise<boolean> {
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    configured = true;
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function notifyBackupOverdue(days: number): Promise<void> {
  if (!(await ensureConfigured())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Backup pendiente',
      body: `Hace ${days} día(s) que no se hace un backup. Abrí FinTrack para respaldar tus datos.`,
    },
    trigger: null,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  return ensureConfigured();
}
