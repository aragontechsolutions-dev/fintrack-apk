/**
 * Biometric-gated secret storage, backed by the Android Keystore via
 * expo-secure-store (hardware-backed when a TEE/StrongBox is present).
 *
 * Used to store the raw DEK so a returning user can unlock with fingerprint/
 * face instead of re-typing their PIN. Biometrics do NOT replace the Argon2id
 * password path: the PIN remains the recovery fallback, because SecureStore
 * invalidates keys when the device's biometric enrolment changes.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { bytesToHex, hexToBytes } from './bytes';

const dekKeyFor = (userId: string) => `fintrack_dek_${userId}`;

export async function isBiometricAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

/** Store the DEK behind a biometric-protected Keystore entry. */
export async function storeBiometricDek(
  userId: string,
  dek: Uint8Array,
): Promise<void> {
  await SecureStore.setItemAsync(dekKeyFor(userId), bytesToHex(dek), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: true,
    authenticationPrompt: 'Desbloquear FinTrack',
  });
}

/**
 * Retrieve the DEK, prompting for biometrics. Returns null if not present or
 * the user cancels/fails auth.
 */
export async function getBiometricDek(
  userId: string,
): Promise<Uint8Array | null> {
  try {
    const hex = await SecureStore.getItemAsync(dekKeyFor(userId), {
      requireAuthentication: true,
      authenticationPrompt: 'Desbloquear FinTrack',
    });
    return hex ? hexToBytes(hex) : null;
  } catch {
    // User cancelled, auth failed, or key invalidated by new enrolment.
    return null;
  }
}

export async function clearBiometricDek(userId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(dekKeyFor(userId));
  } catch {
    // ignore
  }
}
