/**
 * Argon2id key derivation.
 *
 * Backed by `react-native-argon2` (native libargon2). We derive a 32-byte Key
 * Encryption Key (KEK) from the user's PIN/password + a per-user random salt.
 *
 * Parameters follow the OWASP Password Storage Cheat Sheet minimum for
 * Argon2id: m = 19 MiB (19456 KiB), t = 2, p = 1. These are tuned toward the
 * lower bound because phones are RAM-constrained; aim for < ~1s derivation on
 * mid-range target devices and raise `memory`/`iterations` if you have headroom.
 */

import argon2 from 'react-native-argon2';

import { hexToBytes } from './bytes';

export interface Argon2Params {
  /** Memory cost in KiB. */
  memory: number;
  /** Iterations (time cost). */
  iterations: number;
  /** Degree of parallelism. */
  parallelism: number;
  /** Output length in bytes. */
  hashLength: number;
}

export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  memory: 19456, // 19 MiB
  iterations: 2,
  parallelism: 1,
  hashLength: 32, // 256-bit KEK
};

/**
 * Derive a raw key from a password and hex-encoded salt.
 * Returns the raw hash bytes (length = params.hashLength).
 */
export async function deriveKey(
  password: string,
  saltHex: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<Uint8Array> {
  const result = await argon2(password, saltHex, {
    iterations: params.iterations,
    memory: params.memory,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    mode: 'argon2id',
  });
  // `rawHash` is a hex string of length hashLength*2.
  return hexToBytes(result.rawHash);
}
