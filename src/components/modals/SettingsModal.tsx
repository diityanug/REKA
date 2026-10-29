import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Download,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  FolderOpen,
  ShieldCheck,
  Undo2,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { CustomAlertModal, AlertButton, AlertType } from '../CustomAlertModal';
import { saveTextFileDirectly, pickBackupFile } from '../../utils/fileStorage';

interface SettingsModalProps {
  visible: boolean;
  onExportBackup: () => Promise<string>;
  onExportCSV?: () => Promise<string>;
  onImportBackup: (jsonString: string) => Promise<void>;
  onWipeAllData: () => Promise<void>;
  canUndoRestore?: boolean;
  onUndoRestore?: () => Promise<void>;
  appVersion?: string;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onExportBackup,
  onExportCSV,
  onImportBackup,
  onWipeAllData,
  canUndoRestore = false,
  onUndoRestore,
  appVersion = '1.0.0',
  onClose,
}) => {
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportingCSV, setExportingCSV] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [undoing, setUndoing] = useState<boolean>(false);
  const [wiping, setWiping] = useState<boolean>(false);

  // Custom alert dialog state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AlertButton[];
    type?: AlertType;
  }>({
    visible: false,
    title: '',
  });

  // Alerts may chain (step 1 -> step 2). The button handler runs before the
  // alert closes, so a newer alert must survive that close call.
  const alertSeq = useRef<number>(0);
  const renderedSeq = alertSeq.current;

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type: AlertType = 'info'
  ) => {
    alertSeq.current += 1;
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK', style: 'default' }],
      type,
    });
  };

  const hideAlert = () => {
    if (alertSeq.current !== renderedSeq) return;
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  // Shared outcome handling for every file export path.
  const reportExportResult = (
    result: { success: boolean; cancelled?: boolean },
    kind: 'backup' | 'ledger',
    filename: string
  ) => {
    const label = kind === 'backup' ? 'Backup' : 'Ledger';
    if (result.cancelled) {
      showAlert('Export Cancelled', 'No file was created.', undefined, 'info');
      return;
    }
    if (!result.success) {
      showAlert(
        'Export Failed',
        `The ${kind === 'backup' ? 'backup' : 'CSV'} file could not be saved to your device.`,
        undefined,
        'error'
      );
      return;
    }

    AppHaptics.success();
    if (Platform.OS === 'ios') {
      // iOS hands the file to the system share sheet; the user still picks the destination.
      showAlert(
        `${label} Ready`,
        `${label} ready — choose where to save it in the share sheet.`,
        undefined,
        'success'
      );
    } else {
      showAlert(
        `${label} Saved`,
        `Your ${kind === 'backup' ? 'backup' : 'CSV'} file "${filename}" has been saved successfully.`,
        undefined,
        'success'
      );
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    Keyboard.dismiss();
    setExporting(true);
    try {
      AppHaptics.light();
      const jsonBackup = await onExportBackup();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `REKA_backup_${dateStr}.json`;

      const result = await saveTextFileDirectly(filename, jsonBackup, 'application/json');
      reportExportResult(result, 'backup', filename);
    } catch (err: any) {
      AppHaptics.error();
      showAlert('Export Failed', err.message || 'Failed to export backup.', undefined, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (exportingCSV || !onExportCSV) return;
    Keyboard.dismiss();
    setExportingCSV(true);
    try {
      AppHaptics.light();
      const csvData = await onExportCSV();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `REKA_ledger_${dateStr}.csv`;

      const result = await saveTextFileDirectly(filename, csvData, 'text/csv');
      reportExportResult(result, 'ledger', filename);
    } catch (err: any) {
      AppHaptics.error();
      showAlert('Export Failed', err.message || 'Failed to export CSV ledger.', undefined, 'error');
    } finally {
      setExportingCSV(false);
    }
  };

  const handlePickAndRestore = async () => {
    Keyboard.dismiss();
    try {
      AppHaptics.light();
      const picked = await pickBackupFile();
      if (picked.cancelled || !picked.content) return;

      showAlert(
        'Confirm Data Restore',
        `Restore database from "${picked.filename || 'selected file'}"? All current records will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore Now',
            style: 'destructive',
            onPress: async () => {
              setImporting(true);
              try {
                await onImportBackup(picked.content!);
                AppHaptics.success();
                showAlert(
                  'Restore Complete',
                  'Database has been restored successfully from your backup file.',
                  [
                    {
                      text: 'OK',
                      onPress: () => onClose(),
                    },
                  ],
                  'success'
                );
              } catch (err: any) {
                AppHaptics.error();
                showAlert('Restore Error', err.message || 'Failed to parse and restore backup file.', undefined, 'error');
              } finally {
                setImporting(false);
              }
            },
          },
        ],
        'confirm'
      );
    } catch (err: any) {
      AppHaptics.error();
      showAlert('File Picker Error', err.message || 'Could not read file from storage.', undefined, 'error');
    }
  };

  const handleUndoRestore = () => {
    if (!onUndoRestore || undoing) return;
    Keyboard.dismiss();
    showAlert(
      'Undo Last Restore',
      'Restore the data that existed before your last restore?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo Restore',
          style: 'destructive',
          onPress: async () => {
            setUndoing(true);
            try {
              await onUndoRestore();
              AppHaptics.success();
              showAlert(
                'Restore Undone',
                'The data from before your last restore is back.',
                [
                  {
                    text: 'OK',
                    onPress: () => onClose(),
                  },
                ],
                'success'
              );
            } catch (err: any) {
              AppHaptics.error();
              showAlert('Undo Failed', err.message || 'Could not undo the last restore.', undefined, 'error');
            } finally {
              setUndoing(false);
            }
          },
        },
      ],
      'confirm'
    );
  };

  const runWipe = async () => {
    if (wiping) return;
    setWiping(true);
    try {
      await onWipeAllData();
      AppHaptics.heavy();
      showAlert(
        'Database Reset',
        'All data has been cleared successfully.',
        [
          {
            text: 'OK',
            onPress: () => onClose(),
          },
        ],
        'success'
      );
    } catch (err: any) {
      AppHaptics.error();
      showAlert('Error', err.message || 'Failed to reset database.', undefined, 'error');
    } finally {
      setWiping(false);
    }
  };

  // Step 1 of the wipe confirmation.
  const handleWipeData = () => {
    if (wiping) return;
    Keyboard.dismiss();
    showAlert(
      'Wipe All Data',
      'This will permanently delete all transactions, accounts, and pockets. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          // Step 2: the final, explicit confirmation.
          onPress: () =>
            showAlert(
              'Are you absolutely sure?',
              'This deletes every account, transaction and pocket on this device.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Everything',
                  style: 'destructive',
                  onPress: runWipe,
                },
              ],
              'error'
            ),
        },
      ],
      'confirm'
    );
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="92%"
      maxHeight="94%"
    >
      <ModalHeader
        title="Settings"
        subtitle="Preferences & Data Management"
        onClose={onClose}
      />

      <KeyboardSafeContainer extraBottomSpace={40}>
        {/* Backup & Restore Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Download size={16} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Backup & Restore</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Save your data to your device storage or restore them from an existing file.
          </Text>

          {/* Direct Export JSON */}
          <TouchableOpacity
            style={styles.outlineActionBtn}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.7}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={Palette.primary} />
            ) : (
              <>
                <Download size={16} color={Palette.primary} />
                <Text style={styles.outlineActionBtnText}>Export Backup</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Direct Pick File & Restore */}
          <TouchableOpacity
            style={[styles.outlineActionBtn, { marginTop: 10 }]}
            onPress={handlePickAndRestore}
            disabled={importing}
            activeOpacity={0.7}
          >
            {importing ? (
              <ActivityIndicator size="small" color={Palette.primary} />
            ) : (
              <>
                <FolderOpen size={16} color={Palette.primary} />
                <Text style={styles.outlineActionBtnText}>Restore Data</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Undo the restore that replaced the current data */}
          {canUndoRestore && onUndoRestore ? (
            <TouchableOpacity
              style={[styles.outlineActionBtn, { marginTop: 10 }]}
              onPress={handleUndoRestore}
              disabled={undoing}
              activeOpacity={0.7}
            >
              {undoing ? (
                <ActivityIndicator size="small" color={Palette.primary} />
              ) : (
                <>
                  <Undo2 size={16} color={Palette.primary} />
                  <Text style={styles.outlineActionBtnText}>Undo Last Restore</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {/* Export CSV / Excel */}
          <TouchableOpacity
            style={[styles.outlineActionBtn, { marginTop: 10 }]}
            onPress={handleExportCSV}
            disabled={exportingCSV}
            activeOpacity={0.7}
          >
            {exportingCSV ? (
              <ActivityIndicator size="small" color={Palette.primary} />
            ) : (
              <>
                <FileSpreadsheet size={16} color={Palette.primary} />
                <Text style={styles.outlineActionBtnText}>Export Ledger</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Privacy & Data Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={16} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Privacy & Data</Text>
          </View>
          <Text style={styles.privacyLine}>
            All records are stored only on this device in a local database. REKA has no server and no account.
          </Text>
          <Text style={styles.privacyLine}>
            Scanning a receipt sends that photo to Google Gemini for text extraction. Manual entry never leaves the device.
          </Text>
          <Text style={styles.appVersionLine}>App version {appVersion}</Text>
        </View>

        {/* Danger Zone */}
        <View style={[styles.sectionCard, styles.dangerCard]}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={16} color={Palette.error} />
            <Text style={[styles.sectionTitle, { color: Palette.error }]}>
              Danger Zone
            </Text>
          </View>
          <Text style={styles.dangerDesc}>
            Reset all data to a clean initial state. All transaction history, custom pockets, and balances will be erased.
          </Text>

          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleWipeData}
            disabled={wiping}
            activeOpacity={0.8}
          >
            {wiping ? (
              <ActivityIndicator size="small" color={Palette.error} />
            ) : (
              <>
                <Trash2 size={16} color={Palette.error} />
                <Text style={styles.dangerBtnText}>Wipe All Data</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardSafeContainer>

      {/* Custom Alert Modal for Settings */}
      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  dangerCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
  },
  sectionDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    lineHeight: 18,
    marginBottom: 14,
  },
  dangerDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.error,
    lineHeight: 18,
    marginBottom: 14,
  },
  privacyLine: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    lineHeight: 18,
    marginBottom: 8,
  },
  appVersionLine: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.mutedSoft,
    marginTop: 2,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.white,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  outlineActionBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  // Destructive but visually secondary: outlined, not a solid red block.
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.white,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.error,
  },
});
