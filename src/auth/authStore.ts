/**
 * Auth store: persists per-user authentication metadata OUTSIDE the encrypted
 * database.
 *
 * This is a chicken-and-egg necessity: the info needed to derive the DB key
 * (salt, Argon2 params, wrapped DEK) must be readable before the DB can be
 * opened. Storing it in plaintext is safe because the wrapped DEK is encrypted
 * with a key derived from the user's password — useless without that password.
 *
 * Stored as a JSON file in the app's document directory. Small and simple; the
 * number of local profiles on one device is tiny.
 */

import * as FileSystem from 'expo-file-system';

import { WrappedKeyRecord } from '../crypto/keyManager';

const AUTH_FILE = FileSystem.documentDirectory + 'auth.json';
const STORE_VERSION = 1;

export interface AuthUserRecord {
  id: string;
  name: string;
  wrapped: WrappedKeyRecord;
  biometricEnabled: boolean;
  createdAt: number;
}

interface AuthStoreFile {
  version: number;
  users: AuthUserRecord[];
}

async function readStore(): Promise<AuthStoreFile> {
  const info = await FileSystem.getInfoAsync(AUTH_FILE);
  if (!info.exists) return { version: STORE_VERSION, users: [] };
  const raw = await FileSystem.readAsStringAsync(AUTH_FILE);
  try {
    const parsed = JSON.parse(raw) as AuthStoreFile;
    if (!parsed.users) return { version: STORE_VERSION, users: [] };
    return parsed;
  } catch {
    return { version: STORE_VERSION, users: [] };
  }
}

async function writeStore(store: AuthStoreFile): Promise<void> {
  await FileSystem.writeAsStringAsync(AUTH_FILE, JSON.stringify(store));
}

export async function listUsers(): Promise<AuthUserRecord[]> {
  return (await readStore()).users;
}

export async function hasAnyUser(): Promise<boolean> {
  return (await listUsers()).length > 0;
}

export async function getUser(id: string): Promise<AuthUserRecord | undefined> {
  return (await readStore()).users.find((u) => u.id === id);
}

export async function findUserByName(
  name: string,
): Promise<AuthUserRecord | undefined> {
  const target = name.trim().toLowerCase();
  return (await readStore()).users.find(
    (u) => u.name.trim().toLowerCase() === target,
  );
}

export async function upsertUser(record: AuthUserRecord): Promise<void> {
  const store = await readStore();
  const idx = store.users.findIndex((u) => u.id === record.id);
  if (idx >= 0) store.users[idx] = record;
  else store.users.push(record);
  await writeStore(store);
}

export async function removeUser(id: string): Promise<void> {
  const store = await readStore();
  store.users = store.users.filter((u) => u.id !== id);
  await writeStore(store);
}

export async function setBiometricEnabled(
  id: string,
  enabled: boolean,
): Promise<void> {
  const user = await getUser(id);
  if (!user) return;
  user.biometricEnabled = enabled;
  await upsertUser(user);
}
