import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  FolderOpen,
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
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onExportBackup,
  onExportCSV,
  onImportBackup,
  onWipeAllData,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportingCSV, setExportingCSV] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
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

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    type: AlertType = 'info'
  ) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: 'OK', style: 'default' }],
      type,
    });
  };

  const hideAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  const handleExport = async () => {
    Keyboard.dismiss();
    setExporting(true);
    try {
      AppHaptics.light();
      const jsonBackup = await onExportBackup();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `REKA_backup_${dateStr}.json`;

      const result = await saveTextFileDirectly(filename, jsonBackup, 'application/json');
      if (result.success) {
        AppHaptics.success();
        showAlert(
          'Backup Saved',
          `Your backup file "${filename}" has been saved successfully to your selected folder.`,
          undefined,
          'success'
        );
      }
    } catch (err: any) {
      AppHaptics.error();
      showAlert('Export Error', err.message || 'Failed to export backup.', undefined, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!onExportCSV) return;
    Keyboard.dismiss();
    setExportingCSV(true);
    try {
      AppHaptics.light();
      const csvData = await onExportCSV();
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `REKA_ledger_${dateStr}.csv`;

      const result = await saveTextFileDirectly(filename, csvData, 'text/csv');
      if (result.success) {
        AppHaptics.success();
        showAlert(
          'Ledger Exported',
          `Your CSV file "${filename}" has been saved successfully.`,
          undefined,
          'success'
        );
      }
    } catch (err: any) {
      AppHaptics.error();
      showAlert('CSV Export Error', err.message || 'Failed to export CSV ledger.', undefined, 'error');
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

  const handleWipeData = () => {
    Keyboard.dismiss();
    showAlert(
      'Wipe All Data',
      'This will permanently delete all transactions, accounts, and pockets. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Everything',
          style: 'destructive',
          onPress: async () => {
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
          },
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
              <ActivityIndicator size="small" color={Palette.white} />
            ) : (
              <>
                <Trash2 size={16} color={Palette.white} />
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
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.error,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dangerBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.white,
  },
});
