/**
 * Encrypted storage for receipt images.
 *
 * The captured photo is encrypted with the session DEK (AES-256-GCM) and stored
 * in the app's private documents. This satisfies the "store the receipt image
 * encrypted" requirement so it can be re-processed later without leaving a
 * plaintext copy at rest. Decryption writes a short-lived plaintext file to the
 * cache directory only when the image needs to be displayed.
 */

import * as FileSystem from 'expo-file-system';

import { SealedData, open, seal } from '../crypto/aesGcm';
import { base64ToBytes, bytesToBase64 } from '../crypto/bytes';
import { randomId } from '../crypto/random';

const DOC = FileSystem.documentDirectory ?? '';
const CACHE = FileSystem.cacheDirectory ?? '';
const RECEIPTS_DIR = DOC + 'receipts/';

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RECEIPTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECEIPTS_DIR, { intermediates: true });
  }
}

/**
 * Encrypt an image file and store it. Returns the stored file name (to persist
 * in `transactions.receiptImagePath`).
 */
export async function saveEncryptedImage(
  uri: string,
  dek: Uint8Array,
): Promise<string> {
  await ensureDir();
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const sealed = seal(dek, base64ToBytes(b64));
  const name = `${randomId()}.enc`;
  await FileSystem.writeAsStringAsync(RECEIPTS_DIR + name, JSON.stringify(sealed));
  return name;
}

/**
 * Decrypt a stored receipt to a temporary cache file and return its URI for
 * display in <Image>. Returns null if the file is missing/corrupt.
 */
export async function loadDecryptedImage(
  name: string,
  dek: Uint8Array,
): Promise<string | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(RECEIPTS_DIR + name);
    const sealed = JSON.parse(raw) as SealedData;
    const bytes = open(dek, sealed);
    const outUri = `${CACHE}receipt-${name}.jpg`;
    await FileSystem.writeAsStringAsync(outUri, bytesToBase64(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return outUri;
  } catch {
    return null;
  }
}

export async function deleteReceipt(name: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(RECEIPTS_DIR + name, { idempotent: true });
  } catch {
    /* ignore */
  }
}
