import * as FileSystem from 'expo-file-system/legacy';

const RECEIPTS_DIR_NAME = 'receipts';

function getReceiptsDir(): string | null {
  if (!FileSystem.documentDirectory) return null;
  const base = FileSystem.documentDirectory.endsWith('/')
    ? FileSystem.documentDirectory
    : `${FileSystem.documentDirectory}/`;
  return `${base}${RECEIPTS_DIR_NAME}/`;
}

async function ensureReceiptsDir(): Promise<string | null> {
  const dir = getReceiptsDir();
  if (!dir) return null;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    return dir;
  } catch {
    return null;
  }
}

/**
 * Persists a captured receipt image into the app's private document storage
 * so it remains viewable in Transaction Details after the temp cache is cleared.
 */
export async function saveReceiptImage(
  sourceUri?: string | null,
  base64?: string | null
): Promise<string> {
  const dir = await ensureReceiptsDir();
  if (!dir) return '';

  const filename = `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;
  const targetUri = `${dir}${filename}`;

  try {
    if (sourceUri) {
      // If it is already saved in our receipts dir, reuse it directly
      if (sourceUri.startsWith(dir)) {
        const existing = await FileSystem.getInfoAsync(sourceUri);
        if (existing.exists) return sourceUri;
      }
      const srcInfo = await FileSystem.getInfoAsync(sourceUri);
      if (srcInfo.exists) {
        await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
        return targetUri;
      }
    }

    if (base64) {
      await FileSystem.writeAsStringAsync(targetUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return targetUri;
    }
  } catch {
    return '';
  }

  return '';
}

/**
 * Deletes a receipt image only when it resides inside REKA's private receipts directory.
 */
export async function deleteReceiptImageIfLocal(uri?: string | null): Promise<void> {
  if (!uri) return;
  const dir = getReceiptsDir();
  if (!dir || !uri.startsWith(dir)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best-effort cleanup; never block transaction deletion
  }
}

/**
 * Removes all saved receipt images (called when wiping all data).
 */
export async function clearAllReceiptImages(): Promise<void> {
  const dir = getReceiptsDir();
  if (!dir) return;
  try {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch {
    // Ignore cleanup errors
  }
}
