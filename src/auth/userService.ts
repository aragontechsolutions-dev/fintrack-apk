/**
 * User lifecycle + login orchestration.
 *
 * Ties together the auth store (metadata outside the DB), the key manager
 * (wrap/unwrap DEK), the biometric secure store, and the encrypted database.
 */

import { eq } from 'drizzle-orm';

import { CurrencyCode } from '../money/currency';
import { randomId } from '../crypto/random';
import {
  clearBiometricDek,
  getBiometricDek,
  storeBiometricDek,
} from '../crypto/secureStore';
import {
  WrappedKeyRecord,
  generateDek,
  unwrapDek,
  wrapDek,
} from '../crypto/keyManager';
import { closeDatabase, openDatabase } from '../db/client';
import {
  runMigrations,
  seedCurrencies,
  seedDefaultCategories,
} from '../db/migrate';
import { users } from '../db/schema';
import {
  AuthUserRecord,
  getUser,
  hasAnyUser,
  listUsers,
  removeUser,
  setBiometricEnabled,
  upsertUser,
} from './authStore';

export interface Session {
  userId: string;
  name: string;
  /** Raw DEK held in memory only for the session's lifetime. */
  dek: Uint8Array;
  baseCurrency: CurrencyCode;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Credenciales inválidas');
    this.name = 'InvalidCredentialsError';
  }
}

/** Bootstrap a freshly opened DB (migrations + shared seed + user profile). */
async function bootstrapDatabase(
  dek: Uint8Array,
  userId: string,
  name: string,
  baseCurrency: CurrencyCode,
): Promise<void> {
  const db = openDatabase(dek);
  await runMigrations(db);
  await seedCurrencies(db);

  // Ensure the user profile row exists inside the encrypted DB.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(users).values({ id: userId, name, baseCurrency });
  }
  await seedDefaultCategories(db, userId);
}

export async function isFirstRun(): Promise<boolean> {
  return !(await hasAnyUser());
}

export async function getProfiles(): Promise<AuthUserRecord[]> {
  return listUsers();
}

/**
 * Create the very first user of the device. Generates the master DEK that all
 * profiles will share, wraps it under this user's password, opens & bootstraps
 * the DB.
 */
export async function createFirstUser(
  name: string,
  password: string,
  baseCurrency: CurrencyCode = 'UYU',
): Promise<Session> {
  if (await hasAnyUser()) {
    throw new Error('Ya existe un usuario. Usá "agregar usuario".');
  }
  const dek = generateDek();
  const wrapped = await wrapDek(dek, password);
  const id = randomId();

  await bootstrapDatabase(dek, id, name, baseCurrency);
  await upsertUser({
    id,
    name,
    wrapped,
    biometricEnabled: false,
    createdAt: Date.now(),
  });

  return { userId: id, name, dek, baseCurrency };
}

/**
 * Add another profile to the shared encrypted DB. Requires an active session
 * (its DEK) because the same master DEK must be wrapped under the new
 * password.
 */
export async function addUser(
  activeDek: Uint8Array,
  name: string,
  password: string,
  baseCurrency: CurrencyCode = 'UYU',
): Promise<AuthUserRecord> {
  const wrapped: WrappedKeyRecord = await wrapDek(activeDek, password);
  const id = randomId();

  const db = openDatabase(activeDek);
  await db.insert(users).values({ id, name, baseCurrency });
  await seedDefaultCategories(db, id);

  const record: AuthUserRecord = {
    id,
    name,
    wrapped,
    biometricEnabled: false,
    createdAt: Date.now(),
  };
  await upsertUser(record);
  return record;
}

/** Log in with the profile's password. Throws InvalidCredentialsError. */
export async function loginWithPassword(
  userId: string,
  password: string,
): Promise<Session> {
  const record = await getUser(userId);
  if (!record) throw new InvalidCredentialsError();

  let dek: Uint8Array;
  try {
    dek = await unwrapDek(record.wrapped, password);
  } catch {
    // GCM tag verification failed -> wrong password.
    throw new InvalidCredentialsError();
  }

  const db = openDatabase(dek);
  await runMigrations(db);
  await seedCurrencies(db);

  const profile = await db
    .select({ baseCurrency: users.baseCurrency, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    userId,
    name: record.name,
    dek,
    baseCurrency: (profile[0]?.baseCurrency as CurrencyCode) ?? 'UYU',
  };
}

/** Log in using biometrics (DEK stored in the Keystore). Returns null if it
 * is unavailable or the user cancels/fails. */
export async function loginWithBiometrics(
  userId: string,
): Promise<Session | null> {
  const record = await getUser(userId);
  if (!record || !record.biometricEnabled) return null;

  const dek = await getBiometricDek(userId);
  if (!dek) return null;

  const db = openDatabase(dek);
  await runMigrations(db);
  await seedCurrencies(db);

  const profile = await db
    .select({ baseCurrency: users.baseCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    userId,
    name: record.name,
    dek,
    baseCurrency: (profile[0]?.baseCurrency as CurrencyCode) ?? 'UYU',
  };
}

/** Enable biometrics for the active session by stashing its DEK in Keystore. */
export async function enableBiometrics(session: Session): Promise<void> {
  await storeBiometricDek(session.userId, session.dek);
  await setBiometricEnabled(session.userId, true);
}

export async function disableBiometrics(userId: string): Promise<void> {
  await clearBiometricDek(userId);
  await setBiometricEnabled(userId, false);
}

/** Remove a profile entirely (auth record + biometric secret). The profile's
 * rows remain in the shared DB unless separately purged. */
export async function deleteProfile(userId: string): Promise<void> {
  await clearBiometricDek(userId);
  await removeUser(userId);
}

export function logout(): void {
  closeDatabase();
}
