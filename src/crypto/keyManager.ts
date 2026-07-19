/**
 * Key management: the "key-wrapping" scheme that protects the database key.
 *
 * Model (single encrypted DB shared by all local profiles):
 *   1. A single random 256-bit DEK (Data Encryption Key) is the SQLCipher DB
 *      key. It is generated once, when the first user is created.
 *   2. Each user's PIN/password is stretched with Argon2id (unique salt) into a
 *      KEK (Key Encryption Key).
 *   3. The KEK encrypts (AES-256-GCM wraps) the DEK. Only the wrapped blob +
 *      salt + params are stored — never the raw DEK.
 *   4. Login re-derives the KEK, unwraps the DEK, and opens SQLCipher with it.
 *
 * Because GCM is authenticated, a wrong password makes unwrap() throw, which we
 * treat as "invalid credentials". Between-user separation inside the shared DB
 * is enforced logically by `user_id` in every query.
 */

import { Argon2Params, DEFAULT_ARGON2_PARAMS, deriveKey } from './argon2';
import { SealedData, open, seal } from './aesGcm';
import { bytesToHex } from './bytes';
import { randomBytes, randomHex } from './random';

export interface WrappedKeyRecord {
  saltHex: string;
  params: Argon2Params;
  sealed: SealedData;
}

/** Generate a fresh 256-bit database key (raw, as bytes). */
export function generateDek(): Uint8Array {
  return randomBytes(32);
}

/** DEK as an uppercase hex string suitable for SQLCipher raw-key PRAGMA. */
export function dekToRawKeyHex(dek: Uint8Array): string {
  return bytesToHex(dek).toUpperCase();
}

/** Wrap a DEK with a KEK derived from `password`. */
export async function wrapDek(
  dek: Uint8Array,
  password: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<WrappedKeyRecord> {
  const saltHex = randomHex(16);
  const kek = await deriveKey(password, saltHex, params);
  const sealed = seal(kek, dek);
  return { saltHex, params, sealed };
}

/**
 * Unwrap a DEK using `password`. Throws if the password is wrong (GCM tag
 * verification fails) or the record is corrupt.
 */
export async function unwrapDek(
  record: WrappedKeyRecord,
  password: string,
): Promise<Uint8Array> {
  const kek = await deriveKey(password, record.saltHex, record.params);
  return open(kek, record.sealed);
}

/**
 * Re-wrap the same DEK for a new password (used when adding a user to the
 * shared DB, or when a user changes their PIN). Requires the raw DEK, which is
 * only available from an already-authenticated session.
 */
export async function rewrapDek(
  dek: Uint8Array,
  newPassword: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<WrappedKeyRecord> {
  return wrapDek(dek, newPassword, params);
}
