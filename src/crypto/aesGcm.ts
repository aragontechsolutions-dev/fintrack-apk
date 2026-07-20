/**
 * AES-256-GCM authenticated encryption.
 *
 * Backed by `@noble/ciphers` — a pure-JavaScript, audited implementation. We
 * deliberately avoid a native OpenSSL-backed library (react-native-quick-crypto)
 * because it ships its own `libcrypto.so`, which collides at build time with the
 * `libcrypto.so` that expo-sqlite's SQLCipher already bundles. Pure JS sidesteps
 * that entirely; our payloads (wrapped keys, small backups, receipt images) are
 * well within pure-JS GCM's performance envelope.
 *
 * GCM provides confidentiality AND integrity: decryption throws if the
 * ciphertext or tag was tampered with, exactly what we want for wrapped keys and
 * backups.
 */

import { gcm } from '@noble/ciphers/aes';

import { bytesToHex, hexToBytes } from './bytes';
import { randomBytes } from './random';

export const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
export const KEY_LENGTH = 32; // 256-bit key
export const TAG_LENGTH = 16; // 128-bit auth tag

export interface SealedData {
  /** Hex-encoded IV/nonce. */
  iv: string;
  /** Hex-encoded ciphertext (without the tag). */
  ciphertext: string;
  /** Hex-encoded GCM auth tag. */
  tag: string;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * Encrypt `plaintext` (bytes) under `key` (32 bytes). Generates a fresh random
 * IV each call — never reuse an IV/key pair with GCM.
 */
export function seal(key: Uint8Array, plaintext: Uint8Array): SealedData {
  if (key.length !== KEY_LENGTH) throw new Error('AES key must be 32 bytes');
  const iv = randomBytes(IV_LENGTH);

  // noble returns ciphertext with the 16-byte tag appended.
  const combined = gcm(key, iv).encrypt(plaintext);
  const split = combined.length - TAG_LENGTH;
  const ciphertext = combined.subarray(0, split);
  const tag = combined.subarray(split);

  return {
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(ciphertext),
    tag: bytesToHex(tag),
  };
}

/**
 * Decrypt sealed data under `key`. Throws if the tag does not verify (wrong
 * key or tampered data).
 */
export function open(key: Uint8Array, sealed: SealedData): Uint8Array {
  if (key.length !== KEY_LENGTH) throw new Error('AES key must be 32 bytes');
  const combined = concat(hexToBytes(sealed.ciphertext), hexToBytes(sealed.tag));
  return gcm(key, hexToBytes(sealed.iv)).decrypt(combined);
}

// Re-exported for callers that only need the hex helper alongside sealing.
export { bytesToHex };
