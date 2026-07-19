/**
 * Cryptographically secure random bytes.
 *
 * Uses expo-crypto's getRandomBytes, which is backed by the platform CSPRNG
 * (SecRandomCopyBytes / SecureRandom). Do not use Math.random for anything
 * security-sensitive.
 */

import * as ExpoCrypto from 'expo-crypto';

import { bytesToHex } from './bytes';

export function randomBytes(length: number): Uint8Array {
  return ExpoCrypto.getRandomBytes(length);
}

export function randomHex(length: number): string {
  return bytesToHex(randomBytes(length));
}

/** Generate a random 128-bit id as a 32-char hex string. */
export function randomId(): string {
  return randomHex(16);
}
