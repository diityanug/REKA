import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

/**
 * Saves a file by letting the user choose a target folder directly via StorageAccessFramework (Android)
 * or via system file sharing / save to files (iOS / Fallback).
 */
export async function saveTextFileDirectly(
  filename: string,
  content: string,
  mimeType: string = 'application/json'
): Promise<{ success: boolean; uri?: string; cancelled?: boolean }> {
  if (Platform.OS === 'android') {
    try {
      // 1. Request user to pick a folder in My Files / File Manager
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return { success: false, cancelled: true };
      }

      // 2. Create the file inside user-selected folder
      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        filename,
        mimeType
      );

      // 3. Write content into the file
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return { success: true, uri: fileUri };
    } catch (err: any) {
      // If user dismisses or SAF fails, fallback to temporary file with Sharing dialog
      console.warn('StorageAccessFramework save error, falling back to Sharing:', err);
    }
  }

  // iOS or Android Fallback: Write to cacheDirectory, then open system Share/Save to Files
  try {
    const tempUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(tempUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(tempUri, {
        mimeType,
        dialogTitle: `Save ${filename}`,
        UTI: mimeType === 'application/json' ? 'public.json' : 'public.comma-separated-values-text',
      });
      return { success: true, uri: tempUri };
    }

    return { success: false };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to save file');
  }
}

/**
 * Opens "My Files" / system document picker so the user can select their JSON backup file directly.
 */
export async function pickBackupFile(): Promise<{
  success: boolean;
  content?: string;
  filename?: string;
  cancelled?: boolean;
}> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/*', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, cancelled: true };
    }

    const asset = result.assets[0];
    let fileContent = '';

    try {
      fileContent = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch {
      // Fallback 1: StorageAccessFramework on Android
      if (Platform.OS === 'android' && asset.uri.startsWith('content://')) {
        try {
          fileContent = await FileSystem.StorageAccessFramework.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        } catch {}
      }
      // Fallback 2: copy to cache directory then read
      if (!fileContent) {
        try {
          const cachePath = `${FileSystem.cacheDirectory}bk_${Date.now()}_backup.json`;
          await FileSystem.copyAsync({ from: asset.uri, to: cachePath });
          fileContent = await FileSystem.readAsStringAsync(cachePath, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          FileSystem.deleteAsync(cachePath, { idempotent: true }).catch(() => {});
        } catch {}
      }
      // Fallback 3: native fetch
      if (!fileContent) {
        try {
          const res = await fetch(asset.uri);
          fileContent = await res.text();
        } catch {}
      }
    }

    if (!fileContent) {
      throw new Error('Could not read the selected backup file content.');
    }

    return {
      success: true,
      content: fileContent,
      filename: asset.name,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Failed to read selected file');
  }
}
