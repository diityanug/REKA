import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import {
  Download,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ShieldCheck,
  Undo2,
  DollarSign,
  RefreshCw,
  Lock,
  KeyRound,
  ExternalLink,
  CalendarDays,
  Minus,
  Plus,
  FlaskConical,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { AppHaptics } from '../../utils/haptics';
import { BillingCycleConfig } from '../../types';
import {
  DEFAULT_BILLING_CYCLE,
  getCurrentPeriodKey,
  formatCycleRangeShort,
} from '../../utils/billingCycle';
import { buildDevDummyBackupJson } from '../../utils/devDummyData';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { CustomAlertModal } from '../CustomAlertModal';
import { useLocalAlert } from '../../hooks/useLocalAlert';
import { saveTextFileDirectly, pickBackupFile } from '../../utils/fileStorage';
import { getTodayDateStr } from '../../utils/formatters';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';
import { BiometricType } from '../../services/authService';

const PRIVACY_POLICY_URL = (process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '').trim();
const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '').trim();

interface SettingsModalProps {
  visible: boolean;
  onExportBackup: () => Promise<string>;
  onExportCSV?: () => Promise<string>;
  onExportStatementPdf?: () => Promise<string>;
  onImportBackup: (jsonString: string) => Promise<void>;
  onWipeAllData: () => Promise<void>;
  canUndoRestore?: boolean;
  onUndoRestore?: () => Promise<void>;
  exchangeRate?: number;
  exchangeRateInfo?: {
    rate: number;
    lastUpdated: string;
    isLive: boolean;
  };
  onRefreshExchangeRate?: () => Promise<any>;
  isLockEnabled?: boolean;
  isBiometricsEnabled?: boolean;
  biometricType?: BiometricType;
  hasPin?: boolean;
  onToggleLock?: () => void;
  onChangePin?: () => void;
  onToggleBiometrics?: () => void;
  billingCycle?: BillingCycleConfig;
  onChangeBillingCycle?: (config: BillingCycleConfig) => void | Promise<void>;
  appVersion?: string;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onExportBackup,
  onExportCSV,
  onExportStatementPdf,
  onImportBackup,
  onWipeAllData,
  canUndoRestore = false,
  onUndoRestore,
  exchangeRate = 16000,
  exchangeRateInfo,
  onRefreshExchangeRate,
  isLockEnabled = false,
  isBiometricsEnabled = true,
  biometricType = 'None',
  onToggleLock,
  onChangePin,
  onToggleBiometrics,
  billingCycle = DEFAULT_BILLING_CYCLE,
  onChangeBillingCycle,
  appVersion = '1.0.0',
  onClose,
}) => {
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportingCSV, setExportingCSV] = useState<boolean>(false);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [seedingDummy, setSeedingDummy] = useState<boolean>(false);
  const [undoing, setUndoing] = useState<boolean>(false);
  const [wiping, setWiping] = useState<boolean>(false);
  const [refreshingRate, setRefreshingRate] = useState<boolean>(false);
  const [spinAnim] = useState(() => new Animated.Value(0));
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startSpin = () => {
    spinAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoopRef.current = loop;
    loop.start();
  };

  const stopSpin = () => {
    if (spinLoopRef.current) {
      spinLoopRef.current.stop();
      spinLoopRef.current = null;
    }
    Animated.timing(spinAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const handleExportPDF = async () => {
    if (!onExportStatementPdf || exportingPDF) return;
    setExportingPDF(true);
    try {
      await onExportStatementPdf();
      AppHaptics.success();
    } catch (err: any) {
      AppHaptics.error();
      showAlert('PDF Export Notice', toUserFriendlyErrorMessage(err, 'file'), undefined, 'error');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleRefreshLiveRate = async () => {
    if (!onRefreshExchangeRate || refreshingRate) return;
    setRefreshingRate(true);
    startSpin();
    try {
      await onRefreshExchangeRate();
    } finally {
      stopSpin();
      setRefreshingRate(false);
    }
  };

  // Custom alert dialog state
  const { alertConfig, showAlert, hideAlert } = useLocalAlert();

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
      const dateStr = getTodayDateStr();
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
      const dateStr = getTodayDateStr();
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
                showAlert('Restore Notice', toUserFriendlyErrorMessage(err, 'file'), undefined, 'error');
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
      showAlert('File Picker Notice', toUserFriendlyErrorMessage(err, 'file'), undefined, 'error');
    }
  };

  const handleLoadDummyData = () => {
    if (!__DEV__ || seedingDummy) return;
    Keyboard.dismiss();
    showAlert(
      'Load Dummy Test Data',
      'Replace current local data with 6 months of realistic test data (IDR & USD accounts, pockets, 10+ categories, category budgets, transfers, and loans)?\n\nYour previous data is saved automatically so you can use "Undo Last Restore" anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Dummy Data',
          onPress: async () => {
            setSeedingDummy(true);
            try {
              const dummyJson = buildDevDummyBackupJson();
              await onImportBackup(dummyJson);
              AppHaptics.success();
              showAlert(
                'Dummy Data Loaded',
                '6 months of sample data is ready to test! Try Analytics (Donut, 6-Month Trend, Category Budgets), Payday Cycle (24th), History Filters, and Pocket Transfers.',
                [{ text: 'OK', onPress: () => onClose() }],
                'success'
              );
            } catch (err: any) {
              AppHaptics.error();
              showAlert('Error', err?.message || 'Failed to load dummy data.', undefined, 'error');
            } finally {
              setSeedingDummy(false);
            }
          },
        },
      ],
      'confirm'
    );
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
      fullPage={true}
      presentation="push"
    >
      <ModalHeader
        title="Settings"
        subtitle="Preferences & Data Management"
        onClose={onClose}
        leadingIcon="back"
      />

      <KeyboardSafeContainer extraBottomSpace={40}>
        {/* Billing & Payday Cycle Section */}
        {onChangeBillingCycle ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <CalendarDays size={16} color={Palette.primary} />
              <Text style={styles.sectionTitle}>Payday & Budget Cycle</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Align monthly Overview, Budget, and Analytics with your payday. Use Day 1 for standard calendar months (1–31), or pick your payday (e.g. 24).
            </Text>

            {/* Quick Presets */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {[
                { day: 1, label: '1st (Calendar)' },
                { day: 24, label: '24th (Payday)' },
                { day: 25, label: '25th' },
                { day: 28, label: '28th' },
              ].map((preset) => {
                const active = billingCycle.startDay === preset.day;
                return (
                  <TouchableOpacity
                    key={preset.day}
                    style={[
                      {
                        paddingHorizontal: 11,
                        paddingVertical: 7,
                        borderRadius: 10,
                        backgroundColor: active ? Palette.ink : Palette.surfaceSoft,
                        borderWidth: 1,
                        borderColor: active ? Palette.ink : Palette.hairline,
                      },
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      onChangeBillingCycle({
                        ...billingCycle,
                        startDay: preset.day,
                      });
                    }}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={{
                        ...Typography.caption,
                        fontSize: 12,
                        fontWeight: '600',
                        color: active ? Palette.white : Palette.ink,
                      }}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Fine-grained Day Stepper (1..28) */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: Palette.surfaceSoft,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginBottom: billingCycle.startDay > 1 ? 10 : 0,
              }}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ ...Typography.body, fontSize: 13, fontWeight: '600', color: Palette.ink }}>
                  Cycle Start Day
                </Text>
                <Text style={{ ...Typography.caption, fontSize: 11, color: Palette.muted }}>
                  {billingCycle.startDay <= 1
                    ? 'Standard calendar month (1st – end of month)'
                    : `Current cycle: ${formatCycleRangeShort(
                        getCurrentPeriodKey(billingCycle),
                        billingCycle
                      )}`}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    backgroundColor: Palette.white,
                    borderWidth: 1,
                    borderColor: Palette.hairline,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: billingCycle.startDay <= 1 ? 0.4 : 1,
                  }}
                  disabled={billingCycle.startDay <= 1}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeBillingCycle({
                      ...billingCycle,
                      startDay: Math.max(1, billingCycle.startDay - 1),
                    });
                  }}
                  activeOpacity={0.75}
                >
                  <Minus size={14} color={Palette.ink} />
                </TouchableOpacity>
                <Text
                  style={{
                    ...Typography.heading,
                    fontSize: 15,
                    fontWeight: '700',
                    color: Palette.ink,
                    minWidth: 26,
                    textAlign: 'center',
                  }}
                >
                  {billingCycle.startDay}
                </Text>
                <TouchableOpacity
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    backgroundColor: Palette.white,
                    borderWidth: 1,
                    borderColor: Palette.hairline,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: billingCycle.startDay >= 28 ? 0.4 : 1,
                  }}
                  disabled={billingCycle.startDay >= 28}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeBillingCycle({
                      ...billingCycle,
                      startDay: Math.min(28, billingCycle.startDay + 1),
                    });
                  }}
                  activeOpacity={0.75}
                >
                  <Plus size={14} color={Palette.ink} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Weekend Shift to Friday Toggle */}
            {billingCycle.startDay > 1 ? (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: Palette.surfaceSoft,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
                onPress={() => {
                  AppHaptics.selection();
                  onChangeBillingCycle({
                    ...billingCycle,
                    adjustWeekendToFriday: !billingCycle.adjustWeekendToFriday,
                  });
                }}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ ...Typography.body, fontSize: 13, fontWeight: '600', color: Palette.ink }}>
                    Shift Weekend Payday to Friday
                  </Text>
                  <Text style={{ ...Typography.caption, fontSize: 11, color: Palette.muted, marginTop: 1 }}>
                    If day {billingCycle.startDay} falls on Sat/Sun, start on Friday (day{' '}
                    {Math.max(1, billingCycle.startDay - 1)}/{Math.max(1, billingCycle.startDay - 2)})
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 10,
                    backgroundColor: billingCycle.adjustWeekendToFriday
                      ? Palette.primary
                      : Palette.hairline,
                  }}
                >
                  <Text
                    style={{
                      ...Typography.caption,
                      fontSize: 11,
                      fontWeight: '700',
                      color: billingCycle.adjustWeekendToFriday ? Palette.white : Palette.muted,
                    }}
                  >
                    {billingCycle.adjustWeekendToFriday ? 'On' : 'Off'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Developer Testing Section (strictly hidden in release/preview APK builds) */}
        {__DEV__ ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FlaskConical size={16} color={Palette.primary} />
              <Text style={styles.sectionTitle}>Developer Tools (Dev Only)</Text>
            </View>
            <Text style={styles.sectionDesc}>
              Quickly populate 6 months of multi-currency test data to test Category Budgets, Payday Cycle, Donut Colors, 6-Month Trend, History Filters, and Pocket Transfers. Hidden automatically in release APK builds.
            </Text>
            <TouchableOpacity
              style={styles.outlineActionBtn}
              onPress={handleLoadDummyData}
              disabled={seedingDummy}
              activeOpacity={0.7}
            >
              {seedingDummy ? (
                <ActivityIndicator size="small" color={Palette.primary} />
              ) : (
                <>
                  <FlaskConical size={16} color={Palette.primary} />
                  <Text style={styles.outlineActionBtnText}>Load Dummy Test Data</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Backup & Restore Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Download size={16} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Backup & Restore</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Save your data to your device storage or restore them from an existing file. Exported JSON, CSV, and PDF files are unencrypted — store them in a safe location.
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

          {/* Export Monthly Statement PDF */}
          {onExportStatementPdf ? (
            <TouchableOpacity
              style={[styles.outlineActionBtn, { marginTop: 10 }]}
              onPress={handleExportPDF}
              disabled={exportingPDF}
              activeOpacity={0.7}
            >
              {exportingPDF ? (
                <ActivityIndicator size="small" color={Palette.primary} />
              ) : (
                <>
                  <FileText size={16} color={Palette.primary} />
                  <Text style={styles.outlineActionBtnText}>Export Statement (PDF)</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Currency & Live Exchange Rate Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <DollarSign size={16} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Currency & Live Exchange Rate</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Used for cross-currency transfers and multi-currency portfolio valuation.
          </Text>

          <View style={styles.rateDisplayRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rateTitle}>USD / IDR</Text>
              <Text style={styles.rateValue}>
                $1 = Rp {exchangeRate.toLocaleString('id-ID')}
              </Text>
              <Text style={styles.rateStatusText}>
                {exchangeRateInfo?.isLive ? 'Live Market Rate · Synchronized' : 'Offline / Estimated Rate'}
              </Text>
            </View>

            {onRefreshExchangeRate ? (
              <TouchableOpacity
                style={styles.refreshRateActionBtn}
                onPress={handleRefreshLiveRate}
                disabled={refreshingRate}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Refresh live exchange rate"
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: spinAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                    marginRight: 6,
                  }}
                >
                  <RefreshCw size={13} color={Palette.primary} />
                </Animated.View>
                <Text style={styles.refreshRateActionText}>
                  {refreshingRate ? 'Updating' : 'Update'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Security & App Lock Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Lock size={16} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Security & App Lock</Text>
          </View>
          <Text style={styles.sectionDesc}>
            Protect your accounts, transactions, and balances with a 4-digit PIN and biometric authentication.
          </Text>

          <View style={styles.securityRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.securityTitle}>App Lock</Text>
              <Text style={styles.securitySubtitle}>
                {isLockEnabled
                  ? isBiometricsEnabled && biometricType !== 'None'
                    ? `Protected by ${biometricType} & PIN`
                    : 'Protected by 4-digit PIN'
                  : 'Disabled · Anyone can view app data'}
              </Text>
            </View>
            {onToggleLock ? (
              <TouchableOpacity
                style={[
                  styles.securityActionBtn,
                  isLockEnabled && styles.securityActionBtnActive,
                ]}
                onPress={onToggleLock}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.securityActionText,
                    isLockEnabled && styles.securityActionTextActive,
                  ]}
                >
                  {isLockEnabled ? 'Disable' : 'Enable'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isLockEnabled ? (
            <>
              {/* Change PIN Button */}
              {onChangePin ? (
                <TouchableOpacity
                  style={[styles.outlineActionBtn, { marginTop: 10 }]}
                  onPress={onChangePin}
                  activeOpacity={0.7}
                >
                  <KeyRound size={16} color={Palette.primary} />
                  <Text style={styles.outlineActionBtnText}>Change PIN</Text>
                </TouchableOpacity>
              ) : null}

              {/* Biometrics Toggle (if device has biometric hardware) */}
              {biometricType !== 'None' && onToggleBiometrics ? (
                <View style={[styles.securityRow, { marginTop: 10 }]}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={styles.securityTitle}>{`Unlock with ${biometricType}`}</Text>
                    <Text style={styles.securitySubtitle}>
                      {isBiometricsEnabled
                        ? `Use ${biometricType} on app launch`
                        : 'Manual PIN entry required'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.securityActionBtn,
                      isBiometricsEnabled && styles.securityActionBtnActive,
                    ]}
                    onPress={onToggleBiometrics}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.securityActionText,
                        isBiometricsEnabled && styles.securityActionTextActive,
                      ]}
                    >
                      {isBiometricsEnabled ? 'On' : 'Off'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Privacy & Data Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={16} color={Palette.primary} />
            <Text style={styles.sectionTitle}>Privacy & Data</Text>
          </View>
          <Text style={styles.privacyLine}>
            All accounts, pockets, and transactions live only on your device in a local SQLite database. REKA has no user accounts or cloud backend.
          </Text>
          <Text style={styles.privacyLine}>
            Optional AI scanning (receipts & e-Statements) sends only the selected file over HTTPS to Google Gemini for text extraction. Manual entry stays completely offline.
          </Text>
          <Text style={styles.privacyLine}>
            Live currency lookup fetches public USD/IDR rates from open.er-api.com without sending personal or transaction data. App Lock PIN credentials stay in device SecureStore and are excluded from backups.
          </Text>
          <Text style={styles.privacyLine}>
            Analytics metrics and scores are informational tools only and are not professional financial or investment advice.
          </Text>

          <TouchableOpacity
            style={[styles.outlineActionBtn, { marginTop: 4, marginBottom: 8 }]}
            onPress={() => {
              AppHaptics.light();
              showAlert(
                'Data & Privacy Summary',
                '• Storage: Local SQLite only; delete anytime via Wipe All Data.\n• Security: App Lock PIN uses salted stretched hashes inside hardware-backed device SecureStore (excluded from JSON backups).\n• AI Features: Only triggered by you; photos/statements go to Google Gemini AI strictly for extraction.\n• Exports: JSON, CSV, and PDF exports are unencrypted plaintext — store exported files securely.' +
                  (SUPPORT_EMAIL ? `\n• Support: ${SUPPORT_EMAIL}` : ''),
                undefined,
                'info'
              );
            }}
            activeOpacity={0.7}
          >
            <ShieldCheck size={16} color={Palette.primary} />
            <Text style={styles.outlineActionBtnText}>Data & Privacy Notice</Text>
          </TouchableOpacity>

          {PRIVACY_POLICY_URL ? (
            <TouchableOpacity
              style={[styles.outlineActionBtn, { marginBottom: 8 }]}
              onPress={async () => {
                AppHaptics.light();
                try {
                  const canOpen = await Linking.canOpenURL(PRIVACY_POLICY_URL);
                  if (canOpen) {
                    await Linking.openURL(PRIVACY_POLICY_URL);
                  } else {
                    showAlert('Unavailable', 'Could not open the privacy policy URL on this device.', undefined, 'warning');
                  }
                } catch {
                  showAlert('Unavailable', 'Could not open the privacy policy URL.', undefined, 'warning');
                }
              }}
              activeOpacity={0.7}
            >
              <ExternalLink size={16} color={Palette.primary} />
              <Text style={styles.outlineActionBtnText}>Online Privacy Policy</Text>
            </TouchableOpacity>
          ) : null}

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
        alertId={alertConfig.id}
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
    backgroundColor: Palette.white,
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
  rateDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginTop: 4,
  },
  rateTitle: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rateValue: {
    ...Typography.mono,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
    marginTop: 2,
  },
  rateStatusText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  refreshRateActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    minWidth: 84,
    height: 36,
  },
  refreshRateActionText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.primary,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginTop: 4,
  },
  securityTitle: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  securitySubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  securityActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  securityActionBtnActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  securityActionText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  securityActionTextActive: {
    color: Palette.white,
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
