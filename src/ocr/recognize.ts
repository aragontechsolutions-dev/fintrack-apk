/**
 * On-device OCR + image capture.
 *
 * Uses Google ML Kit Text Recognition v2 (offline, free) via
 * @react-native-ml-kit/text-recognition, and expo-image-picker for capture.
 * Both require a development build (not Expo Go) and Google Play Services.
 */

import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import { RecognizedLine } from './parseReceipt';

/** Capture a photo with the camera. Returns the file URI, or null if cancelled. */
export async function captureReceiptPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Se necesita permiso de cámara.');
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.6,
    allowsEditing: false,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

/** Pick an existing photo from the library. */
export async function pickReceiptPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Se necesita permiso de galería.');
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.6,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

/**
 * Run OCR on an image and return recognised lines with vertical position so the
 * parser can order them top-to-bottom.
 */
export async function recognizeReceiptLines(
  uri: string,
): Promise<RecognizedLine[]> {
  const result = await TextRecognition.recognize(uri);
  const lines: RecognizedLine[] = [];
  for (const block of result.blocks) {
    for (const line of block.lines) {
      const text = line.text.trim();
      if (text.length === 0) continue;
      lines.push({ text, top: line.frame?.top ?? block.frame?.top ?? 0 });
    }
  }
  return lines;
}
