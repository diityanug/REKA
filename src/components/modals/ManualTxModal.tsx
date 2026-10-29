import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Check, FolderTree, Calendar, Calculator } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import {
  Wallet,
  Pocket,
  Category,
  TransactionType,
  CurrencyType,
} from '../../types';
import { PAYMENT_METHODS } from '../../constants/presets';
import { AppHaptics } from '../../utils/haptics';
import { formatCurrency, parseAmount } from '../../utils/formatters';
import { useFooterKeyboardOffset } from '../../hooks/useKeyboardHeight';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { CategoryIcon } from '../CategoryIcon';
import { CalculatorKeypad } from '../CalculatorKeypad';
import { DatePickerModal } from './DatePickerModal';
import { BottomSheetModal } from '../BottomSheetModal';

interface ManualTxModalProps {
  visible: boolean;
  isEditing?: boolean;
  manMerchant: string;
  manAmount: string;
  manCategory: string;
  manType: TransactionType;
  manCurrency: CurrencyType;
  manMethod: string;
  manDate: string;
  manTime: string;
  manNotes: string;
  wallets: Wallet[];
  pockets: Pocket[];
  categories: Category[];
  privacyMode: boolean;
  selectedWalletId: string;
  selectedPocketId: string;
  onChangeMerchant: (text: string) => void;
  onChangeAmount: (text: string) => void;
  onChangeCategory: (cat: string) => void;
  onChangeType: (type: TransactionType) => void;
  onChangeCurrency: (currency: CurrencyType) => void;
  onChangeMethod: (method: string) => void;
  onChangeDate: (dateString: string) => void;
  onChangeTime: (time: string) => void;
  onChangeNotes: (notes: string) => void;
  onSelectWallet: (id: string) => void;
  onSelectPocket: (id: string) => void;
  onOpenAddAccount: () => void;
  onOpenAddPocket: () => void;
  onOpenCategoryManager: () => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export const ManualTxModal = React.memo<ManualTxModalProps>(({
  visible,
  isEditing = false,
  manMerchant,
  manAmount,
  manCategory,
  manType,
  manCurrency,
  manMethod,
  manDate,
  manTime,
  manNotes,
  wallets,
  pockets,
  categories,
  privacyMode,
  selectedWalletId,
  selectedPocketId,
  onChangeMerchant,
  onChangeAmount,
  onChangeCategory,
  onChangeType,
  onChangeCurrency,
  onChangeMethod,
  onChangeDate,
  onChangeTime,
  onChangeNotes,
  onSelectWallet,
  onSelectPocket,
  onOpenAddAccount,
  onOpenAddPocket,
  onOpenCategoryManager,
  onSave,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const relevantWallets = wallets.filter((w) => w.currency === manCurrency);
  const walletPockets = pockets.filter((p) => p.walletId === selectedWalletId);
  const activeCategories = categories.filter((c) => c.type === manType);

  const [datePickerVisible, setDatePickerVisible] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [keypadOpen, setKeypadOpen] = useState<boolean>(false);
  const footerKeyboardOffset = useFooterKeyboardOffset();

  const selectedWallet = relevantWallets.find((w) => w.id === selectedWalletId);
  const parsedAmount = useMemo(
    () => parseAmount(manAmount, manCurrency),
    [manAmount, manCurrency]
  );
  const exceedsBalance =
    manType === 'expense' && !!selectedWallet && parsedAmount > selectedWallet.balance;
  const categoryMissing = !activeCategories.some((c) => c.name === manCategory);

  // Keep the last strictly valid HH:mm so an invalid blur can revert to it
  const lastValidTimeRef = useRef<string>(manTime || '00:00');
  useEffect(() => {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(manTime)) {
      lastValidTimeRef.current = manTime;
    }
  }, [manTime]);

  const handleTimeBlur = () => {
    const trimmed = (manTime || '').trim();
    if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
      const [hour, minute] = trimmed.split(':');
      const normalized = `${hour.padStart(2, '0')}:${minute}`;
      lastValidTimeRef.current = normalized;
      if (normalized !== manTime) onChangeTime(normalized);
      return;
    }
    onChangeTime(lastValidTimeRef.current);
  };

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const isCustomDate = manDate !== todayStr && manDate !== yesterdayStr;

  const dateFormattedLabel = useMemo(() => {
    if (!manDate) return 'Pick Date';
    const parts = manDate.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    return manDate;
  }, [manDate]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="92%"
      maxHeight="94%"
      dismissOnBackdropPress={false}
    >
      <ModalHeader
        title={isEditing ? 'Edit Transaction' : 'New Transaction'}
        subtitle={isEditing ? 'Update transaction details' : 'Manual entry'}
        onClose={onClose}
      />

          <KeyboardSafeContainer extraBottomSpace={48}>
              {/* Type Switcher */}
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    manType === 'expense' && styles.segmentBtnActiveExpense,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeType('expense');
                  }}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      manType === 'expense' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    manType === 'income' && styles.segmentBtnActiveIncome,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeType('income');
                  }}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      manType === 'income' && styles.segmentBtnTextActive,
                    ]}
                  >
                    Income
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Merchant / Description */}
              <Text style={styles.inputLabel}>
                Merchant / Recipient <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInputBox}
                placeholder="e.g. Supermarket, Salary"
                placeholderTextColor={Palette.mutedSoft}
                value={manMerchant}
                onChangeText={onChangeMerchant}
                onFocus={() => setKeypadOpen(false)}
                maxLength={50}
                returnKeyType="next"
              />

              {/* Currency Selector */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Currency <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.currencyToggleBox}>
                <TouchableOpacity
                  style={[
                    styles.currencyBtn,
                    manCurrency === 'IDR' && styles.currencyBtnActive,
                  ]}
                  onPress={() => onChangeCurrency('IDR')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.currencyBtnText,
                      manCurrency === 'IDR' && styles.currencyBtnTextActive,
                    ]}
                  >
                    IDR (Rp)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.currencyBtn,
                    manCurrency === 'USD' && styles.currencyBtnActive,
                  ]}
                  onPress={() => onChangeCurrency('USD')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.currencyBtnText,
                      manCurrency === 'USD' && styles.currencyBtnTextActive,
                    ]}
                  >
                    USD ($)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount Input with Collapsible Calculator Keypad */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Amount <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.amountToolsRow}>
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    styles.calculatorChip,
                    keypadOpen && styles.presetChipActive,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    if (!keypadOpen) {
                      Keyboard.dismiss();
                    }
                    setKeypadOpen((open) => !open);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle calculator keypad"
                  accessibilityState={{ expanded: keypadOpen, selected: keypadOpen }}
                  activeOpacity={0.7}
                >
                  <Calculator
                    size={13}
                    color={keypadOpen ? Palette.white : Palette.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.presetChipText,
                      keypadOpen && styles.presetChipTextActive,
                    ]}
                  >
                    {keypadOpen ? 'Hide' : 'Calculator'}
                  </Text>
                </TouchableOpacity>
              </View>
              <CalculatorKeypad
                value={manAmount}
                currency={manCurrency}
                onChangeValue={onChangeAmount}
                showDisplay={true}
                showKeypad={keypadOpen}
                onPressDisplay={() => {
                  Keyboard.dismiss();
                  setKeypadOpen(true);
                }}
                onCloseKeypad={() => setKeypadOpen(false)}
              />
              {/* Dedicated fixed-height warning slot so layout never shifts/janks */}
              <View style={styles.balanceWarningSlot}>
                {exceedsBalance ? (
                  <Text style={styles.balanceWarning}>
                    This expense is larger than the account balance.
                  </Text>
                ) : null}
              </View>

              {/* Transaction Date & Time */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Date <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.dateTimeRow}>
              <View style={styles.dateSelectorCard}>
                <TouchableOpacity
                  style={[
                    styles.dateSegmentBtn,
                    manDate === todayStr && styles.dateSegmentBtnActive,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeDate(todayStr);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dateSegmentText,
                      manDate === todayStr && styles.dateSegmentTextActive,
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dateSegmentBtn,
                    manDate === yesterdayStr && styles.dateSegmentBtnActive,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeDate(yesterdayStr);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dateSegmentText,
                      manDate === yesterdayStr && styles.dateSegmentTextActive,
                    ]}
                  >
                    Yesterday
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dateSegmentBtn,
                    isCustomDate && styles.dateSegmentBtnActive,
                  ]}
                  onPress={() => {
                    AppHaptics.light();
                    setDatePickerVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Calendar
                    size={13}
                    color={isCustomDate ? Palette.white : Palette.ink}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.dateSegmentText,
                      isCustomDate && styles.dateSegmentTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {isCustomDate ? dateFormattedLabel : 'Pick Date'}
                  </Text>
                </TouchableOpacity>
              </View>

                <View style={styles.timeBox}>
                  <Text style={styles.timeLabel}>Time</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={manTime}
                    onChangeText={onChangeTime}
                    onFocus={() => setKeypadOpen(false)}
                    onBlur={handleTimeBlur}
                    placeholder="HH:mm"
                    placeholderTextColor={Palette.mutedSoft}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                    returnKeyType="done"
                  />
                </View>
              </View>

              <DatePickerModal
                visible={datePickerVisible}
                selectedDate={manDate}
                onSelectDate={(picked) => {
                  onChangeDate(picked);
                  setDatePickerVisible(false);
                }}
                onClose={() => setDatePickerVisible(false)}
              />

              {/* Select Account */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Account ({manCurrency}) <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.chipsRow}>
                {relevantWallets.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.presetChip,
                      styles.accountChip,
                      selectedWalletId === w.id && styles.presetChipActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      onSelectWallet(w.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${w.name}, balance ${formatCurrency(
                      w.balance,
                      w.currency,
                      privacyMode
                    )}`}
                    accessibilityState={{ selected: selectedWalletId === w.id }}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        selectedWalletId === w.id && styles.presetChipTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {w.name}
                    </Text>
                    <Text
                      style={[
                        styles.accountChipBalance,
                        selectedWalletId === w.id && styles.presetChipTextActive,
                      ]}
                    >
                      {formatCurrency(w.balance, w.currency, privacyMode)}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addChip}
                  onPress={onOpenAddAccount}
                >
                  <Plus size={14} color={Palette.primary} />
                  <Text style={styles.addChipText}>New Account</Text>
                </TouchableOpacity>
              </View>

              {/* Select Pocket */}
              {selectedWalletId ? (
                <>
                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                    Pocket
                  </Text>
                  <View style={styles.chipsRow}>
                    <TouchableOpacity
                      style={[
                        styles.presetChip,
                        selectedPocketId === '' && styles.presetChipActive,
                      ]}
                      onPress={() => {
                        AppHaptics.selection();
                        onSelectPocket('');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Main Balance"
                      accessibilityState={{ selected: selectedPocketId === '' }}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          selectedPocketId === '' && styles.presetChipTextActive,
                        ]}
                      >
                        Main Balance
                      </Text>
                    </TouchableOpacity>
                    {walletPockets.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.presetChip,
                          selectedPocketId === p.id && styles.presetChipActive,
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          onSelectPocket(p.id);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={p.name}
                        accessibilityState={{ selected: selectedPocketId === p.id }}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            selectedPocketId === p.id && styles.presetChipTextActive,
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.addChip}
                      onPress={onOpenAddPocket}
                    >
                      <Plus size={14} color={Palette.primary} />
                      <Text style={styles.addChipText}>New Pocket</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {/* 2-Column Category Selector */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Category <Text style={styles.requiredStar}>*</Text>
              </Text>
              {categoryMissing ? (
                <Text style={styles.categoryHint}>
                  Choose a category for this transaction.
                </Text>
              ) : null}
              <View style={styles.bentoGrid2Col}>
                {activeCategories.map((cat) => {
                  const isSelected = manCategory === cat.name;
                  const tint = manType === 'expense' ? Palette.primary : Palette.accentTeal;
                  const softBg = manType === 'expense' ? '#FDF0ED' : '#EBF7F4';
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryCard,
                        isSelected && {
                          borderColor: tint,
                          backgroundColor: softBg,
                        },
                      ]}
                      onPress={() => {
                        AppHaptics.selection();
                        onChangeCategory(cat.name);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={cat.name}
                      accessibilityState={{ selected: isSelected }}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.categoryIconBox,
                          { backgroundColor: isSelected ? tint : Palette.surfaceSoft },
                        ]}
                      >
                        <CategoryIcon
                          name={cat.icon}
                          size={16}
                          color={isSelected ? Palette.white : tint}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryLabel,
                          isSelected && { color: Palette.ink, fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Manage Categories Action */}
              <TouchableOpacity
                style={styles.manageCategoryBtn}
                onPress={onOpenCategoryManager}
                activeOpacity={0.8}
              >
                <FolderTree size={16} color={Palette.primary} />
                <Text style={styles.manageCategoryText}>Manage Categories</Text>
              </TouchableOpacity>

              {/* Payment Method */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Payment Method <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.chipsRow}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.presetChip,
                      manMethod === method && styles.presetChipActive,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      onChangeMethod(method);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={method}
                    accessibilityState={{ selected: manMethod === method }}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        manMethod === method && styles.presetChipTextActive,
                      ]}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Notes</Text>
              <TextInput
                style={styles.textInputBox}
                placeholder="e.g. Lunch with team"
                placeholderTextColor={Palette.mutedSoft}
                value={manNotes}
                onChangeText={onChangeNotes}
                onFocus={() => setKeypadOpen(false)}
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </KeyboardSafeContainer>

            <View
              style={[
                styles.stickyFooter,
                {
                  paddingBottom:
                    Math.max(insets.bottom, 14) + footerKeyboardOffset,
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.confirmBtn, saving && styles.confirmBtnDisabled]}
                onPress={handleSubmit}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={isEditing ? 'Save changes' : 'Save transaction'}
                accessibilityState={{ disabled: saving, busy: saving }}
              >
                {saving ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color={Palette.white}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.confirmBtnText}>Saving...</Text>
                  </>
                ) : (
                  <>
                    <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>
                      {isEditing ? 'Save Changes' : 'Save Transaction'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
    </BottomSheetModal>
  );
});

ManualTxModal.displayName = 'ManualTxModal';

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
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActiveExpense: {
    backgroundColor: Palette.primary,
  },
  segmentBtnActiveIncome: {
    backgroundColor: Palette.accentTeal,
  },
  segmentBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.muted,
  },
  segmentBtnTextActive: {
    color: Palette.white,
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 5,
  },
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
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
  amountCurrencyRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  currencyToggleBox: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Palette.hairline,
    height: 42,
    marginBottom: 4,
  },
  currencyBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  currencyBtnActive: {
    backgroundColor: Palette.white,
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  currencyBtnText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  currencyBtnTextActive: {
    color: Palette.ink,
  },
  currencyMiniPill: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Palette.hairline,
    height: 44,
    alignItems: 'center',
  },
  currencyMiniBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  currencyMiniBtnActive: {
    backgroundColor: Palette.white,
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  currencyMiniText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
  },
  currencyMiniTextActive: {
    color: Palette.ink,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateSelectorCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: Palette.hairline,
    height: 44,
    alignItems: 'center',
  },
  dateSegmentBtn: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingHorizontal: 4,
  },
  dateSegmentBtnActive: {
    backgroundColor: Palette.primary,
    shadowColor: Palette.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateSegmentText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  dateSegmentTextActive: {
    color: Palette.white,
    fontWeight: '700',
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  timeLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
  },
  timeInput: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '700',
    color: Palette.ink,
    width: 38,
    padding: 0,
    margin: 0,
  },
  amountToolsRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  calculatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountChip: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  accountChipBalance: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '500',
    color: Palette.muted,
    marginTop: 2,
  },
  presetChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  presetChipText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: Palette.ink,
  },
  presetChipTextActive: {
    color: Palette.white,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 10,
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
  bentoGrid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  categoryIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  categoryLabel: {
    ...Typography.body,
    fontSize: 12,
    color: Palette.ink,
    flex: 1,
  },
  categoryHint: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.error,
    marginBottom: 6,
  },
  balanceWarningSlot: {
    height: 22,
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  balanceWarning: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.error,
  },
  manageCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 9,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  manageCategoryText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.primary,
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
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
});
