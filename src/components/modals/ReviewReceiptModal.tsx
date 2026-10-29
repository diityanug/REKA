import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Check, Pencil } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { useFooterKeyboardOffset } from '../../hooks/useKeyboardHeight';
import { Wallet, Pocket, ExtractedReceiptData, CurrencyType } from '../../types';
import { formatCurrency, formatCurrencyInput, formatDate } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';
import { CustomAlertModal, AlertButton, AlertType } from '../CustomAlertModal';

interface ReviewReceiptModalProps {
  visible: boolean;
  extractedData: ExtractedReceiptData | null;
  wallets: Wallet[];
  pockets: Pocket[];
  selectedWalletId: string;
  selectedPocketId: string;
  activeCurrency: CurrencyType;
  onSelectWallet: (id: string) => void;
  onSelectPocket: (id: string) => void;
  onOpenAddAccount: () => void;
  onOpenAddPocket: () => void;
  onConfirm: (
    notes?: string,
    merchant?: string,
    amountOverride?: number
  ) => Promise<void>;
  onClose: () => void;
}

export const ReviewReceiptModal: React.FC<ReviewReceiptModalProps> = ({
  visible,
  extractedData,
  wallets,
  pockets,
  selectedWalletId,
  selectedPocketId,
  activeCurrency,
  onSelectWallet,
  onSelectPocket,
  onOpenAddAccount,
  onOpenAddPocket,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const footerKeyboardOffset = useFooterKeyboardOffset();
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [merchantName, setMerchantName] = useState<string>('');
  const [amountOverride, setAmountOverride] = useState<number | null>(null);
  const [amountModalVisible, setAmountModalVisible] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
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

  // Only wallets matching the receipt currency are safe to save into
  const displayWallets = useMemo(() => {
    if (!extractedData) return [];
    return wallets.filter((w) => w.currency === extractedData.currency);
  }, [wallets, extractedData]);

  const walletPockets = useMemo(() => {
    return pockets.filter((p) => p.walletId === selectedWalletId);
  }, [pockets, selectedWalletId]);

  useSyncOnChange([visible, extractedData], () => {
    if (visible && extractedData) {
      setMerchantName(extractedData.merchantName || '');
      setReviewNotes('');
      setAmountOverride(null);
      setSaving(false);
    }
  });

  useEffect(() => {
    if (visible && displayWallets.length > 0) {
      if (!selectedWalletId || !displayWallets.some((w) => w.id === selectedWalletId)) {
        onSelectWallet(displayWallets[0].id);
      }
    }
  }, [visible, displayWallets, selectedWalletId, onSelectWallet]);

  if (!visible || !extractedData) return null;

  const receiptCurrency = extractedData.currency;
  const selectedDisplayWallet = displayWallets.find((w) => w.id === selectedWalletId);
  const hasWalletForCurrency = displayWallets.length > 0;
  const finalAmount = amountOverride ?? extractedData.totalAmount;
  const amountUnreadable = extractedData.totalAmount <= 0;
  const itemCount = extractedData.items ? extractedData.items.length : 0;
  const canConfirm = hasWalletForCurrency && !!selectedDisplayWallet && !saving;

  const handleConfirm = async () => {
    if (!hasWalletForCurrency || !selectedDisplayWallet) {
      showAlert(
        'Account Required',
        `Create a ${receiptCurrency} account first to record this receipt.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create Account', onPress: onOpenAddAccount },
        ],
        'warning'
      );
      return;
    }
    if (saving) return;

    const finalMerchant = merchantName.trim() || extractedData.merchantName || 'Receipt Transaction';
    try {
      setSaving(true);
      await onConfirm(reviewNotes, finalMerchant, finalAmount);
    } catch (err: any) {
      showAlert('Save Failed', err?.message || 'Could not save this transaction.', undefined, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="92%"
      maxHeight="94%"
      dismissOnBackdropPress={false}
    >
      <ModalHeader
        title="Review Receipt"
        subtitle="Check the details before saving"
        onClose={onClose}
      />

            <KeyboardSafeContainer>
              <View style={styles.summaryCard}>
                <View style={styles.amountLabelRow}>
                  <Text style={styles.summaryLabel}>Nominal Amount</Text>
                  <View style={styles.currencyTag}>
                    <Text style={styles.currencyTagText}>{receiptCurrency}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.amountTapRow}
                  onPress={() => {
                    AppHaptics.light();
                    Keyboard.dismiss();
                    setAmountModalVisible(true);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Amount ${formatCurrency(finalAmount, receiptCurrency)}. Tap to edit.`}
                >
                  <Text style={styles.summaryAmount} numberOfLines={1}>
                    {formatCurrency(finalAmount, receiptCurrency)}
                  </Text>
                  <View style={styles.tapToEditRow}>
                    <Pencil size={11} color={Palette.primary} style={{ marginRight: 3 }} />
                    <Text style={styles.tapToEditHint}>Tap to edit</Text>
                  </View>
                </TouchableOpacity>

                {amountUnreadable && amountOverride === null ? (
                  <Text style={styles.amountErrorNote}>
                    The amount could not be read — tap the amount to enter it.
                  </Text>
                ) : null}

                <View style={styles.divider} />

                {/* Editable Merchant Name */}
                <View style={styles.merchantEditBox}>
                  <View style={styles.merchantLabelRow}>
                    <Text style={styles.metaLabel}>Merchant / Store</Text>
                    <View style={styles.tapToEditRow}>
                      <Pencil size={11} color={Palette.primary} style={{ marginRight: 3 }} />
                      <Text style={styles.tapToEditHint}>Tap to edit</Text>
                    </View>
                  </View>
                  <TextInput
                    style={styles.merchantInput}
                    value={merchantName}
                    onChangeText={setMerchantName}
                    placeholder="Merchant / store name"
                    placeholderTextColor={Palette.mutedSoft}
                    returnKeyType="done"
                    autoCapitalize="words"
                    maxLength={50}
                  />
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Category</Text>
                  <Text style={styles.metaValue}>{extractedData.category}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={styles.metaValue}>{formatDate(extractedData.transactionDate)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Payment Method</Text>
                  <Text style={styles.metaValue}>
                    {extractedData.paymentMethod || 'QRIS'}
                  </Text>
                </View>
              </View>

              {/* Line items are informational, the amount stays editable */}
              <Text style={styles.sectionTitle}>
                {itemCount} items detected
              </Text>
              {extractedData.items && extractedData.items.length > 0 ? (
                <View style={{ marginBottom: 14 }}>
                  {extractedData.items.map((it, idx) => (
                    <View key={`item_${idx}`} style={styles.itemCard}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.itemName}>{it.name}</Text>
                        <Text style={styles.itemQty}>
                          Qty: {it.quantity} × {formatCurrency(it.unitPrice, extractedData.currency)}
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>
                        {formatCurrency(it.totalPrice, extractedData.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>
                Account <Text style={styles.requiredStar}>*</Text>
              </Text>

              {hasWalletForCurrency ? (
                <View style={styles.chipRow}>
                  {displayWallets.map((w) => {
                    const isSelected = selectedWalletId === w.id;
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[
                          styles.chip,
                          isSelected && styles.chipActive,
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          onSelectWallet(w.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${w.name}, ${w.currency} account`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isSelected && styles.chipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {w.name} ({w.currency})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={styles.addChip}
                    onPress={onOpenAddAccount}
                    accessibilityRole="button"
                    accessibilityLabel="New account"
                  >
                    <Plus size={14} color={Palette.primary} />
                    <Text style={styles.addChipText}>New Account</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.noWalletNotice}>
                  <Text style={styles.noWalletNoticeText}>
                    No {receiptCurrency} account yet. Create one to save this receipt.
                  </Text>
                  <TouchableOpacity
                    style={styles.noWalletBtn}
                    onPress={() => {
                      AppHaptics.light();
                      onOpenAddAccount();
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Create ${receiptCurrency} Account`}
                  >
                    <Plus size={16} color={Palette.white} style={{ marginRight: 6 }} />
                    <Text style={styles.noWalletBtnText}>
                      Create {receiptCurrency} Account
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedDisplayWallet ? (
                <>
                  <Text style={styles.sectionTitle}>Pocket</Text>
                  <View style={styles.chipRow}>
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        selectedPocketId === '' && styles.chipActive,
                      ]}
                      onPress={() => onSelectPocket('')}
                      accessibilityRole="button"
                      accessibilityLabel="Main balance pocket"
                      accessibilityState={{ selected: selectedPocketId === '' }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedPocketId === '' && styles.chipTextActive,
                        ]}
                      >
                        Main Balance
                      </Text>
                    </TouchableOpacity>
                    {walletPockets.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.chip,
                          selectedPocketId === p.id && styles.chipActive,
                        ]}
                        onPress={() => onSelectPocket(p.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`${p.name} pocket`}
                        accessibilityState={{ selected: selectedPocketId === p.id }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedPocketId === p.id && styles.chipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.addChip}
                      onPress={onOpenAddPocket}
                      accessibilityRole="button"
                      accessibilityLabel="New pocket"
                    >
                      <Plus size={14} color={Palette.primary} />
                      <Text style={styles.addChipText}>New Pocket</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              <Text style={styles.sectionTitle}>Notes</Text>
              <TextInput
                style={styles.textInputBox}
                placeholder="e.g. Lunch with team, monthly wifi"
                placeholderTextColor={Palette.mutedSoft}
                value={reviewNotes}
                onChangeText={setReviewNotes}
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </KeyboardSafeContainer>

            <View
              style={[
                styles.stickyFooter,
                {
                  paddingBottom: Math.max(insets.bottom, 14) + footerKeyboardOffset,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  !canConfirm && styles.confirmBtnDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!canConfirm}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Save transaction of ${formatCurrency(finalAmount, receiptCurrency)}`}
                accessibilityState={{ disabled: !canConfirm, busy: saving }}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color={Palette.white}
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
                )}
                <Text style={styles.confirmBtnText}>
                  {saving ? 'Saving...' : 'Save Transaction'}
                </Text>
              </TouchableOpacity>
            </View>

      <AmountInputModal
        visible={amountModalVisible}
        title="Edit Amount"
        subtitle={`Receipt total in ${receiptCurrency}`}
        initialAmount={formatCurrencyInput(String(finalAmount), receiptCurrency)}
        currency={receiptCurrency}
        allowZero={false}
        onConfirm={(_formatted, numericVal) => {
          setAmountOverride(numericVal);
          setAmountModalVisible(false);
        }}
        onClose={() => setAmountModalVisible(false)}
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
  summaryCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  summaryLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryMerchant: {
    ...Typography.heading,
    fontSize: 18,
    color: Palette.ink,
    marginTop: 2,
    marginBottom: 12,
  },
  summaryAmount: {
    ...Typography.display,
    fontSize: 26,
    fontWeight: '700',
    color: Palette.ink,
    flexShrink: 1,
  },
  amountLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyTag: {
    backgroundColor: Palette.surfaceCard,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  currencyTagText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.muted,
  },
  amountTapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 44,
    marginTop: 2,
    marginBottom: 10,
  },
  amountErrorNote: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.error,
    marginBottom: 8,
  },
  noWalletNotice: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginBottom: 16,
  },
  noWalletNoticeText: {
    ...Typography.body,
    fontSize: 13,
    color: Palette.muted,
    lineHeight: 18,
    marginBottom: 12,
  },
  noWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
  },
  noWalletBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.white,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.hairline,
    marginBottom: 12,
  },
  merchantEditBox: {
    marginBottom: 12,
  },
  merchantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tapToEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tapToEditHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.primary,
    fontWeight: '600',
  },
  merchantInput: {
    backgroundColor: Palette.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metaLabel: {
    ...Typography.caption,
    fontSize: 13,
    color: Palette.muted,
  },
  metaValue: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: Palette.ink,
  },
  metaAmount: {
    ...Typography.mono,
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  sectionTitle: {
    ...Typography.subheading,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 10,
    marginTop: 4,
  },
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  chipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  chipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: Palette.ink,
  },
  chipTextActive: {
    color: Palette.white,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderStyle: 'dashed',
  },
  addChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: Palette.primary,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  itemName: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: Palette.ink,
  },
  itemQty: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  itemTotal: {
    ...Typography.mono,
    fontSize: 13,
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
    marginTop: 6,
    marginBottom: 8,
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
    backgroundColor: Palette.primary,
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
