import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDown, ArrowLeftRight, ArrowRight } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Wallet, CurrencyType } from '../../types';
import { formatCurrency, parseAmount, formatCurrencyInput } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { CalculatorKeypad } from '../CalculatorKeypad';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';
import { CustomAlertModal, AlertButton, AlertType } from '../CustomAlertModal';

interface TransferModalProps {
  visible: boolean;
  wallets: Wallet[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  onExecuteTransfer: (
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    notes: string,
    targetAmount?: number,
    exchangeRate?: number
  ) => Promise<void>;
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  visible,
  wallets,
  activeCurrency,
  privacyMode,
  onExecuteTransfer,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const eligibleWallets = wallets;

  const [fromWalletId, setFromWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [exchangeRateStr, setExchangeRateStr] = useState<string>('16.000');
  const [rateModalVisible, setRateModalVisible] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
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

  // Initialize selected accounts whenever modal becomes visible
  useEffect(() => {
    if (visible && eligibleWallets.length >= 2) {
      if (!fromWalletId || !eligibleWallets.some((w) => w.id === fromWalletId)) {
        setFromWalletId(eligibleWallets[0].id);
      }
      if (!toWalletId || !eligibleWallets.some((w) => w.id === toWalletId) || toWalletId === eligibleWallets[0].id) {
        setToWalletId(eligibleWallets[1].id);
      }
    } else if (visible && eligibleWallets.length === 1) {
      setFromWalletId(eligibleWallets[0].id);
      setToWalletId('');
    }
  }, [visible, eligibleWallets]);

  const selectedFromWallet = eligibleWallets.find((w) => w.id === fromWalletId);
  const selectedToWallet = eligibleWallets.find((w) => w.id === toWalletId);
  const fromCurrency = selectedFromWallet ? selectedFromWallet.currency : activeCurrency;
  const toCurrency = selectedToWallet ? selectedToWallet.currency : activeCurrency;
  const isCrossCurrency = selectedFromWallet && selectedToWallet && selectedFromWallet.currency !== selectedToWallet.currency;

  const parsedRate = parseAmount(exchangeRateStr, 'IDR') || 16000;
  const numericAmount = parseAmount(amountStr, fromCurrency);

  let targetAmount = numericAmount;
  if (isCrossCurrency) {
    if (fromCurrency === 'USD' && toCurrency === 'IDR') {
      targetAmount = Math.round(numericAmount * parsedRate);
    } else if (fromCurrency === 'IDR' && toCurrency === 'USD') {
      targetAmount = Math.round((numericAmount / parsedRate) * 100) / 100;
    }
  }

  const handleQuickPercent = (pct: number) => {
    if (!selectedFromWallet || selectedFromWallet.balance <= 0) return;
    AppHaptics.selection();
    const val = fromCurrency === 'IDR'
      ? Math.floor(selectedFromWallet.balance * pct)
      : Math.round(selectedFromWallet.balance * pct * 100) / 100;
    setAmountStr(val > 0 ? val.toString() : '');
  };

  const handleSwap = () => {
    if (!fromWalletId || !toWalletId) return;
    AppHaptics.selection();
    const temp = fromWalletId;
    setFromWalletId(toWalletId);
    setToWalletId(temp);
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!fromWalletId || !toWalletId) {
      showAlert('Selection Required', 'Please select both source and destination accounts.', undefined, 'warning');
      return;
    }

    if (fromWalletId === toWalletId) {
      showAlert('Invalid Selection', 'Source and destination accounts must be different.', undefined, 'warning');
      return;
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      showAlert('Invalid Amount', 'Please enter a valid transfer amount.', undefined, 'warning');
      return;
    }

    if (selectedFromWallet && selectedFromWallet.balance < numericAmount) {
      showAlert(
        'Insufficient Balance',
        `The source account only has ${formatCurrency(selectedFromWallet.balance, fromCurrency, false)}.`,
        undefined,
        'warning'
      );
      return;
    }

    try {
      setSubmitting(true);
      AppHaptics.heavy();
      await onExecuteTransfer(
        fromWalletId,
        toWalletId,
        numericAmount,
        notes,
        isCrossCurrency ? targetAmount : undefined,
        isCrossCurrency ? parsedRate : undefined
      );
      setAmountStr('');
      setNotes('');
      onClose();
    } catch (err: any) {
      showAlert('Transfer Error', err.message || 'Failed to complete fund transfer.', undefined, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="92%"
      maxHeight="94%"
    >
      <ModalHeader
        title="Transfer Funds"
        subtitle={
          isCrossCurrency
            ? `Cross-Currency Transfer (${fromCurrency} → ${toCurrency})`
            : `Move money across accounts (${fromCurrency})`
        }
        onClose={onClose}
      />

          <KeyboardSafeContainer extraBottomSpace={32}>
            {eligibleWallets.length < 2 ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>At least two accounts needed</Text>
                <Text style={styles.noticeDesc}>
                  You need at least two accounts to perform a transfer.
                </Text>
              </View>
            ) : (
              <>
                {/* Source Account Selector */}
                <View style={styles.fieldSection}>
                  <Text style={styles.inputLabel}>From Account</Text>
                  <View style={styles.accountChipsRow}>
                    {eligibleWallets.map((w) => {
                      const isSelected = w.id === fromWalletId;
                      return (
                        <TouchableOpacity
                          key={`from_${w.id}`}
                          style={[
                            styles.accountChip,
                            isSelected && styles.accountChipActive,
                          ]}
                          onPress={() => {
                            AppHaptics.selection();
                            setFromWalletId(w.id);
                            if (toWalletId === w.id) {
                              const other = eligibleWallets.find((ow) => ow.id !== w.id);
                              if (other) setToWalletId(other.id);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.chipTopRow}>
                            <Text
                              style={[
                                styles.accountChipName,
                                isSelected && styles.accountChipTextActive,
                              ]}
                              numberOfLines={1}
                            >
                              {w.name}
                            </Text>
                            <View
                              style={[
                                styles.currencyPill,
                                isSelected && styles.currencyPillActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.currencyPillText,
                                  isSelected && styles.currencyPillTextActive,
                                ]}
                              >
                                {w.currency}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.accountChipBalance,
                              isSelected && styles.accountChipTextActive,
                            ]}
                          >
                            {formatCurrency(w.balance, w.currency, privacyMode)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Transfer Direction Indicator & Swap Button */}
                <View style={styles.swapDividerRow}>
                  <View style={styles.swapLine} />
                  <TouchableOpacity
                    style={styles.swapIconButton}
                    onPress={handleSwap}
                    activeOpacity={0.85}
                  >
                    <ArrowDown size={18} color={Palette.ink} />
                  </TouchableOpacity>
                  <View style={styles.swapLine} />
                </View>

                {/* Destination Account Selector */}
                <View style={styles.fieldSection}>
                  <Text style={styles.inputLabel}>To Account</Text>
                  <View style={styles.accountChipsRow}>
                    {eligibleWallets.map((w) => {
                      const isSelected = w.id === toWalletId;
                      const isSource = w.id === fromWalletId;
                      return (
                        <TouchableOpacity
                          key={`to_${w.id}`}
                          style={[
                            styles.accountChip,
                            isSelected && styles.accountChipActiveTo,
                            isSource && styles.accountChipDisabled,
                          ]}
                          disabled={isSource}
                          onPress={() => {
                            AppHaptics.selection();
                            setToWalletId(w.id);
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.chipTopRow}>
                            <Text
                              style={[
                                styles.accountChipName,
                                isSelected && styles.accountChipTextActive,
                                isSource && styles.accountChipTextDisabled,
                              ]}
                              numberOfLines={1}
                            >
                              {w.name}
                            </Text>
                            <View
                              style={[
                                styles.currencyPill,
                                isSelected && styles.currencyPillActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.currencyPillText,
                                  isSelected && styles.currencyPillTextActive,
                                ]}
                              >
                                {w.currency}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.accountChipBalance,
                              isSelected && styles.accountChipTextActive,
                              isSource && styles.accountChipTextDisabled,
                            ]}
                          >
                            {formatCurrency(w.balance, w.currency, privacyMode)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Cross-Currency FX Exchange Card */}
                {isCrossCurrency && (
                  <View style={styles.fxCard}>
                    <View style={styles.fxHeaderRow}>
                      <Text style={styles.fxTitle}>Exchange Rate & Conversion</Text>
                    </View>

                    <View style={styles.fxRateRow}>
                      <Text style={styles.fxRateLabel}>Rate (1 USD):</Text>
                      <TouchableOpacity
                        style={styles.fxRatePickerBox}
                        onPress={() => {
                          AppHaptics.light();
                          Keyboard.dismiss();
                          setRateModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.fxRatePrefixTag}>
                          <Text style={styles.fxRatePrefixText}>Rp</Text>
                        </View>
                        <Text style={styles.fxRatePickerValue}>
                          {exchangeRateStr || '16.000'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fxSummaryBox}>
                      <View style={styles.fxSummaryCol}>
                        <Text style={styles.fxSummaryLabel}>You Send ({fromCurrency})</Text>
                        <Text style={styles.fxSummaryValFrom} numberOfLines={1}>
                          {formatCurrency(numericAmount, fromCurrency, privacyMode)}
                        </Text>
                      </View>
                      <ArrowRight size={16} color={Palette.muted} style={{ marginHorizontal: 6 }} />
                      <View style={[styles.fxSummaryCol, { alignItems: 'flex-end' }]}>
                        <Text style={styles.fxSummaryLabel}>Recipient Gets ({toCurrency})</Text>
                        <Text style={styles.fxSummaryValTo} numberOfLines={1}>
                          {formatCurrency(targetAmount, toCurrency, privacyMode)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Transfer Amount Input with Custom Calculator Keypad */}
                <View style={styles.fieldSection}>
                  <Text style={styles.inputLabel}>Transfer Amount ({fromCurrency})</Text>

                  {/* Quick percentage chips */}
                  <View style={styles.quickPercentRow}>
                    <TouchableOpacity
                      style={styles.quickPercentBtn}
                      onPress={() => handleQuickPercent(0.25)}
                    >
                      <Text style={styles.quickPercentText}>25%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickPercentBtn}
                      onPress={() => handleQuickPercent(0.5)}
                    >
                      <Text style={styles.quickPercentText}>50%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickPercentBtn}
                      onPress={() => handleQuickPercent(1.0)}
                    >
                      <Text style={styles.quickPercentText}>All Balance</Text>
                    </TouchableOpacity>
                  </View>

                  <CalculatorKeypad
                    value={amountStr}
                    currency={fromCurrency}
                    onChangeValue={setAmountStr}
                    showDisplay={true}
                  />
                </View>

                {/* Optional Notes */}
                <View style={styles.fieldSection}>
                  <Text style={styles.inputLabel}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.textInputBox}
                    placeholder="e.g. Allocation, Savings, Bill share"
                    placeholderTextColor={Palette.mutedSoft}
                    value={notes}
                    onChangeText={setNotes}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>
              </>
            )}
          </KeyboardSafeContainer>

          {/* Sticky Bottom Action */}
          {eligibleWallets.length >= 2 && (
            <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  submitting && { opacity: 0.7 },
                ]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <ArrowLeftRight size={18} color={Palette.white} style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>
                  {submitting ? 'Processing...' : 'Transfer Funds'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

      <AmountInputModal
        visible={rateModalVisible}
        title="Set Exchange Rate"
        subtitle="1 USD equivalent in IDR"
        initialAmount={exchangeRateStr}
        currency="IDR"
        onConfirm={(formatted) => {
          setExchangeRateStr(formatted && formatted !== '0' ? formatted : '16.000');
          setRateModalVisible(false);
        }}
        onClose={() => setRateModalVisible(false)}
      />

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    maxHeight: '94%',
    overflow: 'hidden',
  },
  fieldSection: {
    marginBottom: 16,
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 6,
  },
  accountChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  currencyPill: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  currencyPillActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  currencyPillText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.muted,
  },
  currencyPillTextActive: {
    color: Palette.white,
  },
  accountChip: {
    flex: 1,
    minWidth: '47%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  accountChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  accountChipActiveTo: {
    backgroundColor: Palette.accentTeal,
    borderColor: Palette.accentTeal,
  },
  accountChipDisabled: {
    opacity: 0.4,
    backgroundColor: '#F5F5F5',
  },
  accountChipName: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  accountChipBalance: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginTop: 2,
  },
  accountChipTextActive: {
    color: Palette.white,
  },
  accountChipTextDisabled: {
    color: Palette.mutedSoft,
  },
  swapDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    marginBottom: 12,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: Palette.hairline,
  },
  swapIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginHorizontal: 12,
  },
  fxCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginTop: 4,
    marginBottom: 14,
  },
  fxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fxTitle: {
    ...Typography.subheading,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  fxBadge: {
    backgroundColor: '#FDF0ED',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fxBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.primary,
  },
  fxRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  fxRateLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  fxRatePickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  fxRatePrefixTag: {
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fxRatePrefixText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.muted,
  },
  fxRatePickerValue: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  fxSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.white,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  fxSummaryCol: {
    flex: 1,
  },
  fxSummaryLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.muted,
    marginBottom: 2,
  },
  fxSummaryValFrom: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  fxSummaryValTo: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.success,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    height: 52,
  },
  currencyPrefix: {
    ...Typography.subheading,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
    marginRight: 8,
  },
  amountInput: {
    ...Typography.display,
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: Palette.ink,
    height: '100%',
  },
  quickPercentRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  quickPercentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  quickPercentText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  textInputBox: {
    ...Typography.body,
    fontSize: 14,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    color: Palette.ink,
  },
  noticeCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  noticeTitle: {
    ...Typography.subheading,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 6,
  },
  noticeDesc: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
    backgroundColor: Palette.white,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.ink,
    paddingVertical: 13,
    borderRadius: 14,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
});
