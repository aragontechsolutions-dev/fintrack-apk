/**
 * Portable, passphrase-encrypted backup container.
 *
 * The container is a JSON envelope with a small cleartext header (magic,
 * versions, KDF params, IV) and an authenticated-encrypted payload. The
 * passphrase is stretched with Argon2id into a 256-bit key that encrypts the
 * gzip-free JSON dump under AES-256-GCM. The GCM tag authenticates the payload
 * (a wrong passphrase or tampering makes decryption throw); an extra SHA-256
 * checksum lets us detect plain file corruption before even deriving the key.
 *
 * The passphrase is independent of the login PIN so a backup stays portable
 * across devices/profiles.
 */

import * as ExpoCrypto from 'expo-crypto';

import { Argon2Params, DEFAULT_ARGON2_PARAMS, deriveKey } from '../crypto/argon2';
import { SealedData, open, seal } from '../crypto/aesGcm';
import { bytesToUtf8, utf8ToBytes } from '../crypto/bytes';
import { randomHex } from '../crypto/random';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_MAGIC,
  SCHEMA_VERSION,
} from '../config/version';
import { UserDump } from './dump';

export interface BackupContainer {
  magic: string;
  formatVersion: number;
  schemaVersion: number;
  createdAt: number;
  kdf: { algo: 'argon2id'; saltHex: string } & Argon2Params;
  cipher: 'aes-256-gcm';
  /** SHA-256 (hex) of the payload ciphertext hex, for corruption detection. */
  checksumSha256: string;
  payload: SealedData;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

async function sha256Hex(input: string): Promise<string> {
  return ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    input,
  );
}

/** Encrypt a dump into a container object (JSON-serialisable). */
export async function sealBackup(
  dump: UserDump,
  passphrase: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<BackupContainer> {
  const json = JSON.stringify(dump);
  const saltHex = randomHex(16);
  const key = await deriveKey(passphrase, saltHex, params);
  const payload = seal(key, utf8ToBytes(json));
  const checksumSha256 = await sha256Hex(payload.ciphertext);

  return {
    magic: BACKUP_MAGIC,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: dump.schemaVersion,
    createdAt: Date.now(),
    kdf: { algo: 'argon2id', saltHex, ...params },
    cipher: 'aes-256-gcm',
    checksumSha256,
    payload,
  };
}

/**
 * Decrypt and validate a container. Throws BackupError on bad magic,
 * unsupported version, corruption, wrong passphrase, or incompatible schema.
 */
export async function openBackup(
  container: BackupContainer,
  passphrase: string,
): Promise<UserDump> {
  if (container?.magic !== BACKUP_MAGIC) {
    throw new BackupError('El archivo no es un backup de FinTrack.');
  }
  if (container.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      'El backup fue creado con una versión más nueva de la app.',
    );
  }
  if (container.cipher !== 'aes-256-gcm') {
    throw new BackupError('Cifrado de backup no soportado.');
  }

  const checksum = await sha256Hex(container.payload.ciphertext);
  if (checksum !== container.checksumSha256) {
    throw new BackupError('El backup está dañado (checksum inválido).');
  }

  const { saltHex, algo, ...rest } = container.kdf;
  const params: Argon2Params = {
    memory: rest.memory,
    iterations: rest.iterations,
    parallelism: rest.parallelism,
    hashLength: rest.hashLength,
  };
  const key = await deriveKey(passphrase, saltHex, params);

  let json: string;
  try {
    json = bytesToUtf8(open(key, container.payload));
  } catch {
    throw new BackupError('Contraseña incorrecta o backup dañado.');
  }

  let dump: UserDump;
  try {
    dump = JSON.parse(json) as UserDump;
  } catch {
    throw new BackupError('Contenido del backup ilegible.');
  }

  if (dump.schemaVersion > SCHEMA_VERSION) {
    throw new BackupError(
      'El backup usa un esquema más nuevo que esta versión de la app.',
    );
  }
  return dump;
}
