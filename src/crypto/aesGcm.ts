/**
 * AES-256-GCM authenticated encryption.
 *
 * Backed by `react-native-quick-crypto`, which exposes the Node `crypto` API
 * on top of a fast native (JSI) implementation. GCM provides confidentiality
 * AND integrity: decryption fails (throws) if the ciphertext or tag was
 * tampered with, which is exactly what we want for wrapped keys and backups.
 */

import { Buffer } from '@craftzdog/react-native-buffer';
import QuickCrypto from 'react-native-quick-crypto';

import { bytesToHex, hexToBytes } from './bytes';

const ALGORITHM = 'aes-256-gcm';
export const IV_LENGTH = 12; // 96-bit nonce, recommended for GCM
export const KEY_LENGTH = 32; // 256-bit key
export const TAG_LENGTH = 16; // 128-bit auth tag

export interface SealedData {
  /** Hex-encoded IV/nonce. */
  iv: string;
  /** Hex-encoded ciphertext. */
  ciphertext: string;
  /** Hex-encoded GCM auth tag. */
  tag: string;
}

const toBuf = (bytes: Uint8Array) => Buffer.from(bytes);

/**
 * Encrypt `plaintext` (bytes) under `key` (32 bytes). Generates a fresh random
 * IV each call — never reuse an IV/key pair with GCM.
 */
export function seal(key: Uint8Array, plaintext: Uint8Array): SealedData {
  if (key.length !== KEY_LENGTH) throw new Error('AES key must be 32 bytes');
  const iv = QuickCrypto.randomBytes(IV_LENGTH);

  const cipher = QuickCrypto.createCipheriv(ALGORITHM, toBuf(key), iv);
  const encrypted = Buffer.concat([
    cipher.update(toBuf(plaintext)),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt sealed data under `key`. Throws if the tag does not verify (wrong
 * key or tampered data).
 */
export function open(key: Uint8Array, sealed: SealedData): Uint8Array {
  if (key.length !== KEY_LENGTH) throw new Error('AES key must be 32 bytes');
  const decipher = QuickCrypto.createDecipheriv(
    ALGORITHM,
    toBuf(key),
    toBuf(hexToBytes(sealed.iv)),
  );
  decipher.setAuthTag(toBuf(hexToBytes(sealed.tag)));
  const decrypted = Buffer.concat([
    decipher.update(toBuf(hexToBytes(sealed.ciphertext))),
    decipher.final(),
  ]);
  return Uint8Array.from(decrypted);
}

// Re-exported for callers that only need the hex helper alongside sealing.
export { bytesToHex };
