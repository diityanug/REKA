import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';

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
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [showImportBox, setShowImportBox] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportingCSV, setExportingCSV] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [wiping, setWiping] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setImportJsonText('');
      setShowImportBox(false);
    }
  }, [visible]);

  const handleExport = async () => {
    Keyboard.dismiss();
    setExporting(true);
    try {
      AppHaptics.light();
      const jsonBackup = await onExportBackup();
      await Share.share({
        title: 'AES Finance Unified Backup',
        message: jsonBackup,
      });
      AppHaptics.success();
    } catch (err: any) {
      if (err.message !== 'User did not share') {
        Alert.alert('Export Error', err.message || 'Failed to export backup.');
      }
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
      await Share.share({
        title: 'AES Finance Ledger Export (CSV)',
        message: csvData,
      });
      AppHaptics.success();
    } catch (err: any) {
      if (err.message !== 'User did not share') {
        Alert.alert('CSV Export Error', err.message || 'Failed to export CSV ledger.');
      }
    } finally {
      setExportingCSV(false);
    }
  };

  const handleConfirmImport = async () => {
    Keyboard.dismiss();
    if (!importJsonText.trim()) {
      Alert.alert('Missing Data', 'Please paste valid backup JSON data.');
      return;
    }

    Alert.alert(
      'Confirm Data Restore',
      'Restoring from backup will replace all current database records. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Data',
          style: 'destructive',
          onPress: async () => {
            setImporting(true);
            try {
              await onImportBackup(importJsonText.trim());
              setImportJsonText('');
              setShowImportBox(false);
              AppHaptics.success();
              Alert.alert('Restore Complete', 'Database has been restored successfully.');
              onClose();
            } catch (err: any) {
              AppHaptics.error();
              Alert.alert('Import Error', err.message || 'Failed to restore backup.');
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  const handleWipeData = () => {
    Keyboard.dismiss();
    Alert.alert(
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
              Alert.alert('Database Reset', 'All data has been cleared.');
              onClose();
            } catch (err: any) {
              AppHaptics.error();
              Alert.alert('Error', err.message || 'Failed to reset database.');
            } finally {
              setWiping(false);
            }
          },
        },
      ]
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
                Export your accounts, pockets, categories, and transactions into a unified portable JSON backup.
              </Text>

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
                    <Text style={styles.outlineActionBtnText}>Export Backup (JSON)</Text>
                  </>
                )}
              </TouchableOpacity>

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
                    <Text style={styles.outlineActionBtnText}>Export Ledger (CSV / Excel)</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.outlineActionBtn, { marginTop: 10 }]}
                onPress={() => {
                  AppHaptics.light();
                  setShowImportBox((prev) => !prev);
                }}
                activeOpacity={0.7}
              >
                <Upload size={16} color={Palette.primary} />
                <Text style={styles.outlineActionBtnText}>
                  {showImportBox ? 'Hide Restore Console' : 'Import / Restore Backup'}
                </Text>
              </TouchableOpacity>

              {showImportBox ? (
                <View style={styles.importBox}>
                  <Text style={styles.inputLabel}>Paste Backup JSON</Text>
                  <TextInput
                    style={styles.jsonTextArea}
                    value={importJsonText}
                    onChangeText={setImportJsonText}
                    placeholder="Paste exported JSON payload here..."
                    placeholderTextColor={Palette.muted}
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={handleConfirmImport}
                    disabled={importing}
                    activeOpacity={0.8}
                  >
                    {importing ? (
                      <ActivityIndicator size="small" color={Palette.white} />
                    ) : (
                      <>
                        <Upload size={16} color={Palette.white} />
                        <Text style={styles.restoreBtnText}>Restore From JSON</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
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
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    maxHeight: '94%',
    width: '100%',
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sectionCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  sectionDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    lineHeight: 17,
    marginBottom: 12,
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 6,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  outlineActionBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  importBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
  },
  jsonTextArea: {
    ...Typography.caption,
    fontSize: 12,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    color: Palette.ink,
    minHeight: 88,
    fontFamily: 'monospace',
    marginBottom: 10,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.ink,
    borderRadius: 12,
    paddingVertical: 11,
  },
  restoreBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.white,
  },
  dangerCard: {
    borderColor: '#F8D7DA',
    backgroundColor: '#FEF8F8',
  },
  dangerDesc: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    lineHeight: 17,
    marginBottom: 12,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.error,
    borderRadius: 12,
    paddingVertical: 11,
  },
  dangerBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.white,
  },
});