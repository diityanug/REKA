import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { StableTextInput } from '../StableTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  Check,
  FolderTree,
  Calendar,
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  CreditCard,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { ContactlessCardIcon } from '../icons/ContactlessCardIcon';
import { Palette, Typography } from '../../theme/tokens';
import {
  Wallet,
  Pocket,
  Category,
  Transaction,
  TransactionType,
  CurrencyType,
  filterSelectableCategories,
} from '../../types';
import { PAYMENT_METHODS } from '../../constants/presets';
import { AppHaptics } from '../../utils/haptics';
import { formatCurrency, parseAmount } from '../../utils/formatters';
import { useCurrentDate } from '../../hooks/useCurrentDate';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useLastDefined } from '../../hooks/useLastDefined';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { CategoryIcon } from '../CategoryIcon';
import { PaymentMethodIcon } from '../PaymentMethodIcon';
import { triggerSmoothLayout } from '../MotionPrimitives';
import { AmountInputModal } from './AmountInputModal';
import { DatePickerModal } from './DatePickerModal';
import { BottomSheetModal } from '../BottomSheetModal';

function chunkArray<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

const PAYMENT_METHOD_ROWS = chunkArray(PAYMENT_METHODS, 2);

function getAccountTypeIcon(rawType?: string) {
  const t = (rawType || '').toLowerCase();
  if (t === 'e-wallet' || t === 'ewallet') return Smartphone;
  if (t === 'cash') return Banknote;
  if (t === 'investment') return TrendingUp;
  if (t === 'credit card') return CreditCard;
  if (t === 'e-money' || t === 'emoney') return ContactlessCardIcon;
  return Building2;
}

interface ManualTxModalProps {
  visible: boolean;
  isEditing?: boolean;
  editingTransaction?: Transaction | null;
  manMerchant: string;
  manAmount: string;
  manCategory: string;
  manType: TransactionType;
  manCurrency: CurrencyType;
  manMethod: string;
  manDate: string;
  manTime: string;
  manNotes: string;
  manIsLent?: boolean;
  manLentTo?: string;
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
  onChangeIsLent?: (isLent: boolean) => void;
  onChangeLentTo?: (lentTo: string) => void;
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
  editingTransaction = null,
  manMerchant,
  manAmount,
  manCategory,
  manType,
  manCurrency,
  manMethod,
  manDate,
  manTime,
  manNotes,
  manIsLent = false,
  manLentTo = '',
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
  onChangeIsLent,
  onChangeLentTo,
  onSelectWallet,
  onSelectPocket,
  onOpenAddAccount,
  onOpenAddPocket,
  onOpenCategoryManager,
  onSave,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [datePickerVisible, setDatePickerVisible] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [amountModalVisible, setAmountModalVisible] = useState<boolean>(false);
  const [showOptionalDetails, setShowOptionalDetails] = useState<boolean>(false);
  const [wasVisible, setWasVisible] = useState<boolean>(visible);
  const isKeyboardVisible = useKeyboardHeight() > 0;

  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setShowOptionalDetails(
        Boolean(
          manNotes.trim() ||
            manIsLent ||
            (isEditing && editingTransaction?.lentParentTxId)
        )
      );
    }
  }

  // Freeze wallets and pockets while saving or closing so account/pocket balances and warnings never jump
  const isStable = !saving && visible;
  const stableWallets = useLastDefined(isStable ? wallets : null) ?? wallets;
  const stablePockets = useLastDefined(isStable ? pockets : null) ?? pockets;

  const relevantWallets = isEditing
    ? stableWallets.filter((w) => w.currency === manCurrency)
    : stableWallets;
  const walletPockets = stablePockets.filter((p) => p.walletId === selectedWalletId);
  const activeCategories = filterSelectableCategories(categories, manType);

  const selectedWallet = relevantWallets.find((w) => w.id === selectedWalletId);
  const selectedPocket = walletPockets.find((p) => p.id === selectedPocketId);
  const selectedWalletAllocated = walletPockets.reduce((sum, p) => sum + p.balance, 0);
  const selectedWalletMainBalance = selectedWallet
    ? Math.max(selectedWallet.balance - selectedWalletAllocated, 0)
    : 0;
  const pocketChoices = useMemo(() => {
    const mainChoice = {
      id: '',
      name: 'Main Balance',
      balance: selectedWalletMainBalance,
      icon: 'Wallet',
      color: Palette.primary,
      isMain: true as const,
    };
    const subChoices = walletPockets.map((p) => ({
      id: p.id,
      name: p.name,
      balance: p.balance,
      icon: p.icon || 'Briefcase',
      color: p.color || Palette.accentTeal,
      isMain: false as const,
    }));
    return [mainChoice, ...subChoices];
  }, [walletPockets, selectedWalletMainBalance]);
  const categoryRows = useMemo(() => chunkArray(activeCategories, 3), [activeCategories]);
  const parsedAmount = useMemo(
    () => parseAmount(manAmount, manCurrency),
    [manAmount, manCurrency]
  );

  const isEditingRepayment = Boolean(isEditing && editingTransaction?.lentParentTxId);
  const hasRecordedRepayments = Boolean(
    isEditing && editingTransaction && (editingTransaction.lentRepaidAmount || 0) > 0
  );
  const loanTypeLocked = isEditingRepayment || hasRecordedRepayments;

  const revertOldDelta =
    isEditing &&
    editingTransaction &&
    editingTransaction.walletId === selectedWalletId
      ? editingTransaction.type === 'expense'
        ? editingTransaction.amount
        : -editingTransaction.amount
      : 0;
  const effectiveWalletBalance = selectedWallet
    ? selectedWallet.balance + revertOldDelta
    : 0;
  const samePocketRevert =
    isEditing &&
    editingTransaction &&
    selectedPocket &&
    editingTransaction.walletId === selectedWalletId &&
    (editingTransaction.pocketId || '') === selectedPocket.id
      ? revertOldDelta
      : 0;
  const effectivePocketBalance = selectedPocket
    ? selectedPocket.balance + samePocketRevert
    : 0;

  const eps = manCurrency === 'USD' ? 0.0001 : 0;
  const exceedsPocketBalance =
    manType === 'expense' &&
    !!selectedPocket &&
    parsedAmount > effectivePocketBalance + eps;
  const exceedsBalance =
    manType === 'expense' &&
    !!selectedWallet &&
    parsedAmount > effectiveWalletBalance + eps;
  const categoryMissing = !activeCategories.some(
    (c) => c.name.toLowerCase() === manCategory.toLowerCase()
  );

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

  const canSubmit =
    !saving &&
    !!manMerchant.trim() &&
    !!manCurrency &&
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    !!manDate.trim() &&
    !!selectedWalletId &&
    !!selectedWallet &&
    !!manCategory.trim() &&
    !categoryMissing &&
    !!manMethod.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  const { todayStr, yesterdayStr } = useCurrentDate(visible);

  // If the modal stays open across midnight on a new entry, roll "Today" forward automatically
  const prevTodayRef = useRef<string>(todayStr);
  useEffect(() => {
    if (prevTodayRef.current !== todayStr) {
      if (!isEditing && manDate === prevTodayRef.current) {
        onChangeDate(todayStr);
      }
      prevTodayRef.current = todayStr;
    }
  }, [todayStr, isEditing, manDate, onChangeDate]);

  const isCustomDate = manDate !== todayStr && manDate !== yesterdayStr;

  const dateFormattedLabel = useMemo(() => {
    if (!manDate) return 'Pick Date';
    const parts = manDate.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(y, m, day);
      if (!isNaN(d.getTime())) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${months[d.getMonth()]} '${String(y).slice(-2)}`;
      }
    }
    return manDate;
  }, [manDate]);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      fullPage={true}
      dismissOnBackdropPress={false}
    >
      <ModalHeader
        title={isEditing ? 'Edit Transaction' : 'New Transaction'}
        subtitle={isEditing ? 'Update transaction details' : 'Manual entry'}
        onClose={onClose}
        leadingIcon="close"
      />

          <KeyboardSafeContainer extraBottomSpace={48}>
              {/* Type Switcher */}
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    manType === 'expense' && styles.segmentBtnActiveExpense,
                    loanTypeLocked && manType !== 'expense' && { opacity: 0.45 },
                  ]}
                  disabled={loanTypeLocked}
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
                    loanTypeLocked && manType !== 'income' && { opacity: 0.45 },
                  ]}
                  disabled={loanTypeLocked}
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
              <StableTextInput
                style={styles.textInputBox}
                placeholder="e.g. Supermarket, Salary"
                placeholderTextColor={Palette.mutedSoft}
                value={manMerchant}
                onChangeText={onChangeMerchant}
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              {/* Amount Input with Calculator Modal (Currency follows selected Account) */}
              <View style={styles.amountHeaderRow}>
                <Text style={styles.sectionHeaderLabel}>
                  Amount <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.amountCurrencyChip}>
                  <Text style={styles.amountCurrencyChipText} numberOfLines={1} ellipsizeMode="tail">
                    {selectedWallet
                      ? `${manCurrency} · ${selectedWallet.name?.trim() || selectedWallet.type}`
                      : manCurrency}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.amountInputContainer}
                onPress={() => {
                  AppHaptics.light();
                  Keyboard.dismiss();
                  setAmountModalVisible(true);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Transaction amount, ${manAmount || '0'} ${manCurrency}`}
              >
                <View style={styles.currencyPrefixBadge}>
                  <Text style={styles.currencyPrefixText}>
                    {manCurrency === 'IDR' ? 'Rp' : '$'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.amountDisplayText,
                    !manAmount && styles.amountPlaceholderText,
                  ]}
                  numberOfLines={1}
                >
                  {manAmount || '0'}
                </Text>
              </TouchableOpacity>
              {/* Dedicated fixed-height warning slot so layout never shifts/janks */}
              <View style={styles.balanceWarningSlot}>
                {exceedsPocketBalance ? (
                  <Text style={styles.balanceWarning} numberOfLines={1}>
                    This expense exceeds the selected pocket balance.
                  </Text>
                ) : exceedsBalance ? (
                  <Text style={styles.balanceWarning} numberOfLines={1}>
                    This expense is larger than the account balance.
                  </Text>
                ) : null}
              </View>

              {/* Transaction Date & Time — Full-width date bar + inline time pill in header */}
              <View style={styles.dateHeaderRow}>
                <Text style={styles.sectionHeaderLabel}>
                  Date & Time <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.timeBox}>
                  <Text style={styles.timeLabel}>Time</Text>
                  <StableTextInput
                    style={styles.timeInput}
                    value={manTime}
                    onChangeText={onChangeTime}
                    onBlur={handleTimeBlur}
                    placeholder="HH:mm"
                    placeholderTextColor={Palette.mutedSoft}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>
              </View>
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
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
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
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
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
                    size={12}
                    color={isCustomDate ? Palette.white : Palette.ink}
                    style={styles.dateSegmentIcon}
                  />
                  <Text
                    style={[
                      styles.dateSegmentText,
                      isCustomDate && styles.dateSegmentTextActive,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {isCustomDate ? dateFormattedLabel : 'Pick Date'}
                  </Text>
                </TouchableOpacity>
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

              {/* Select Account — Symmetrical 2-Column Grid */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderLabel}>
                  Account <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.sectionHeaderAction}
                  onPress={() => {
                    AppHaptics.light();
                    onOpenAddAccount();
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="New Account"
                >
                  <Plus size={12} color={Palette.primary} strokeWidth={2.4} />
                  <Text style={styles.sectionHeaderActionText}>New</Text>
                </TouchableOpacity>
              </View>
              {relevantWallets.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptySelectorCard}
                  onPress={() => {
                    AppHaptics.light();
                    onOpenAddAccount();
                  }}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color={Palette.primary} />
                  <Text style={styles.emptySelectorText}>Add your first account</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.selectorListCard}>
                  {relevantWallets.map((w, idx) => {
                    const isSelected = selectedWalletId === w.id;
                    const isLast = idx === relevantWallets.length - 1;
                    const AccIcon = getAccountTypeIcon(w.type);
                    const accDisplayName =
                      w.name?.trim() || (w.type ? `${w.type} Account` : 'Account');
                    return (
                      <TouchableOpacity
                        key={w.id}
                        style={[
                          styles.selectorListRow,
                          !isLast && styles.selectorListRowBorder,
                          isSelected && styles.selectorListRowActive,
                        ]}
                        onPress={() => {
                          AppHaptics.selection();
                          if (w.currency !== manCurrency) {
                            onChangeCurrency(w.currency);
                          }
                          if (w.id !== selectedWalletId) {
                            onSelectWallet(w.id);
                            onSelectPocket('');
                          }
                        }}
                        activeOpacity={0.78}
                        accessibilityRole="button"
                        accessibilityLabel={`${accDisplayName}, balance ${formatCurrency(
                          w.balance,
                          w.currency,
                          privacyMode
                        )}`}
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View
                          style={[
                            styles.selectorRowIconBox,
                            isSelected && styles.selectorRowIconBoxActive,
                          ]}
                        >
                          <AccIcon
                            size={16}
                            color={isSelected ? Palette.white : Palette.primary}
                          />
                        </View>
                        <View style={styles.selectorRowCenter}>
                          <Text
                            style={[
                              styles.selectorRowName,
                              isSelected && styles.selectorRowNameActive,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.84}
                          >
                            {accDisplayName}
                          </Text>
                          <Text style={styles.selectorRowMeta} numberOfLines={1}>
                            {w.type ? `${w.type} · ${w.currency}` : w.currency}
                          </Text>
                        </View>
                        <View style={styles.selectorRowRight}>
                          <Text
                            style={[
                              styles.selectorRowBalance,
                              isSelected && styles.selectorRowBalanceActive,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                          >
                            {formatCurrency(w.balance, w.currency, privacyMode)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.selectorRowRadio,
                            isSelected && styles.selectorRowRadioActive,
                          ]}
                        >
                          {isSelected ? (
                            <Check size={10} color={Palette.white} strokeWidth={3} />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Select Pocket — Fixed Full-Width List */}
              {selectedWalletId ? (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderLabel}>Pocket</Text>
                    <TouchableOpacity
                      style={styles.sectionHeaderAction}
                      onPress={() => {
                        AppHaptics.light();
                        onOpenAddPocket();
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="New Pocket"
                    >
                      <Plus size={12} color={Palette.primary} strokeWidth={2.4} />
                      <Text style={styles.sectionHeaderActionText}>New</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.selectorListCard}>
                    {pocketChoices.map((choice, idx) => {
                      const isSelected = selectedPocketId === choice.id;
                      const isLast = idx === pocketChoices.length - 1;
                      const accentColor = choice.isMain ? Palette.primary : choice.color;
                      return (
                        <TouchableOpacity
                          key={choice.id || 'main-balance'}
                          style={[
                            styles.selectorListRow,
                            !isLast && styles.selectorListRowBorder,
                            isSelected && styles.selectorListRowActive,
                          ]}
                          onPress={() => {
                            AppHaptics.selection();
                            onSelectPocket(choice.id);
                          }}
                          activeOpacity={0.78}
                          accessibilityRole="button"
                          accessibilityLabel={`${choice.name}, ${formatCurrency(
                            choice.balance,
                            selectedWallet?.currency || manCurrency,
                            privacyMode
                          )}`}
                          accessibilityState={{ selected: isSelected }}
                        >
                          <View
                            style={[
                              styles.selectorRowIconBox,
                              {
                                backgroundColor: isSelected
                                  ? accentColor
                                  : Palette.surfaceSoft,
                              },
                            ]}
                          >
                            {choice.isMain ? (
                              <Layers
                                size={15}
                                color={isSelected ? Palette.white : Palette.primary}
                              />
                            ) : (
                              <CategoryIcon
                                name={choice.icon}
                                size={15}
                                color={isSelected ? Palette.white : accentColor}
                              />
                            )}
                          </View>
                          <View style={styles.selectorRowCenter}>
                            <Text
                              style={[
                                styles.selectorRowName,
                                isSelected && styles.selectorRowNameActive,
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.84}
                            >
                              {choice.name}
                            </Text>
                            <Text style={styles.selectorRowMeta} numberOfLines={1}>
                              {choice.isMain ? 'Unallocated balance' : 'Pocket'}
                            </Text>
                          </View>
                          <View style={styles.selectorRowRight}>
                            <Text
                              style={[
                                styles.selectorRowBalance,
                                isSelected && styles.selectorRowBalanceActive,
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                            >
                              {formatCurrency(
                                choice.balance,
                                selectedWallet?.currency || manCurrency,
                                privacyMode
                              )}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.selectorRowRadio,
                              isSelected && styles.selectorRowRadioActive,
                            ]}
                          >
                            {isSelected ? (
                              <Check size={10} color={Palette.white} strokeWidth={3} />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Compact 3-Column Square Category Selector */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderLabel}>
                  Category <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.sectionHeaderAction}
                  onPress={() => {
                    AppHaptics.light();
                    onOpenCategoryManager();
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Manage Categories"
                >
                  <FolderTree size={12} color={Palette.primary} strokeWidth={2.2} />
                  <Text style={styles.sectionHeaderActionText}>Manage</Text>
                </TouchableOpacity>
              </View>
              {categoryMissing ? (
                <Text
                  style={[
                    styles.categoryHintInline,
                    Boolean(manCategory.trim()) && styles.categoryHintError,
                  ]}
                  numberOfLines={1}
                >
                  {manCategory.trim()
                    ? 'Previous category is unavailable — please pick another.'
                    : 'Tap a category below to select.'}
                </Text>
              ) : null}
              <View style={styles.gridBlock}>
                {categoryRows.map((row, rowIdx) => {
                  const tint = manType === 'expense' ? Palette.primary : Palette.accentTeal;
                  const softBg =
                    manType === 'expense' ? Palette.tintExpense : Palette.tintIncome;
                  return (
                    <View key={`cat-row-${rowIdx}`} style={styles.gridRow3Col}>
                      {row.map((cat) => {
                        const isSelected =
                          manCategory.toLowerCase() === cat.name.toLowerCase();
                        return (
                          <View key={cat.id} style={styles.gridCol}>
                            <TouchableOpacity
                              style={[
                                styles.categorySquareTile,
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
                                  styles.categorySquareIconBox,
                                  {
                                    backgroundColor: isSelected ? tint : Palette.surfaceSoft,
                                  },
                                ]}
                              >
                                <CategoryIcon
                                  name={cat.icon}
                                  size={18}
                                  color={isSelected ? Palette.white : tint}
                                />
                              </View>
                              <Text
                                style={[
                                  styles.categorySquareLabel,
                                  isSelected && styles.categorySquareLabelActive,
                                ]}
                                numberOfLines={2}
                                adjustsFontSizeToFit
                                minimumFontScale={0.84}
                              >
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                      {row.length < 3
                        ? Array.from({ length: 3 - row.length }).map((_, emptyIdx) => (
                            <View
                              key={`cat-empty-${rowIdx}-${emptyIdx}`}
                              style={styles.gridSlotEmpty}
                            />
                          ))
                        : null}
                    </View>
                  );
                })}
              </View>

              {/* Payment Method — Editorial Grouped 2-Column Ledger Grid */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderLabel}>
                  Payment Method <Text style={styles.requiredStar}>*</Text>
                </Text>
                {manMethod ? (
                  <Text style={styles.methodSelectedBadge} numberOfLines={1}>
                    {manMethod}
                  </Text>
                ) : null}
              </View>
              <View style={styles.methodLedgerCard}>
                {PAYMENT_METHOD_ROWS.map((row, rowIdx) => {
                  const isLastRow = rowIdx === PAYMENT_METHOD_ROWS.length - 1;
                  return (
                    <View
                      key={`pm-row-${rowIdx}`}
                      style={[
                        styles.methodLedgerRow,
                        !isLastRow && styles.methodLedgerRowBorder,
                      ]}
                    >
                      {row.map((method, colIdx) => {
                        const isSelected = manMethod === method;
                        return (
                          <TouchableOpacity
                            key={method}
                            style={[
                              styles.methodLedgerCell,
                              colIdx === 0 && styles.methodLedgerCellLeft,
                              isSelected && styles.methodLedgerCellActive,
                            ]}
                            onPress={() => {
                              AppHaptics.selection();
                              onChangeMethod(method);
                            }}
                            activeOpacity={0.78}
                            accessibilityRole="button"
                            accessibilityLabel={method}
                            accessibilityState={{ selected: isSelected }}
                          >
                            <View
                              style={[
                                styles.methodIconWrap,
                                isSelected && styles.methodIconWrapActive,
                              ]}
                            >
                              <PaymentMethodIcon
                                method={method}
                                size={15}
                                color={isSelected ? Palette.white : Palette.ink}
                              />
                            </View>
                            <Text
                              style={[
                                styles.methodLedgerLabel,
                                isSelected && styles.methodLedgerLabelActive,
                              ]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.82}
                            >
                              {method}
                            </Text>
                            <View
                              style={[
                                styles.methodRadioDot,
                                isSelected && styles.methodRadioDotActive,
                              ]}
                            >
                              {isSelected ? (
                                <Check size={9} color={Palette.white} strokeWidth={3} />
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>

              {/* Optional Details — Collapsible Notes & Lent/Borrowed Split */}
              <TouchableOpacity
                style={styles.optionalToggleRow}
                onPress={() => {
                  AppHaptics.selection();
                  triggerSmoothLayout();
                  setShowOptionalDetails((prev) => !prev);
                }}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="Toggle optional notes and lent split"
                accessibilityState={{ expanded: showOptionalDetails }}
              >
                <View style={styles.optionalToggleLeft}>
                  <Text style={styles.optionalToggleTitle}>Notes & Lent Split</Text>
                  <Text style={styles.optionalToggleHint} numberOfLines={1}>
                    {manNotes.trim() || manIsLent || isEditingRepayment
                      ? [
                          manNotes.trim() ? 'Note added' : '',
                          manIsLent
                            ? manType === 'income'
                              ? 'Borrowed'
                              : 'Lent'
                            : isEditingRepayment
                              ? 'Repayment'
                              : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Optional'}
                  </Text>
                </View>
                <View style={styles.optionalChevronBox}>
                  {showOptionalDetails ? (
                    <ChevronUp size={15} color={Palette.muted} />
                  ) : (
                    <ChevronDown size={15} color={Palette.muted} />
                  )}
                </View>
              </TouchableOpacity>

              {showOptionalDetails ? (
                <View style={styles.optionalContent}>
                  {/* Notes */}
                  <Text style={styles.inputLabel}>Notes</Text>
                  <StableTextInput
                    style={styles.textInputBox}
                    placeholder="e.g. Lunch with team"
                    placeholderTextColor={Palette.mutedSoft}
                    value={manNotes}
                    onChangeText={onChangeNotes}
                    maxLength={100}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  {/* Lent / Borrowed Split Tagging */}
                  <View style={styles.lentCard}>
                    <View style={styles.lentHeaderRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.lentTitle}>
                          {isEditingRepayment
                            ? 'Loan Repayment Record'
                            : manType === 'income'
                              ? 'Borrowed Money'
                              : 'Lent Money'}
                        </Text>
                        <Text style={styles.lentSubtitle}>
                          {isEditingRepayment
                            ? 'Linked to a parent loan — delete this entry instead of converting it'
                            : hasRecordedRepayments
                              ? 'Locked while repayment entries are linked to this record'
                              : manType === 'income'
                                ? 'Mark as money borrowed from someone else to repay later'
                                : 'Mark as money lent to someone else for tracking'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.lentToggleBtn,
                          manIsLent && styles.lentToggleBtnActive,
                          loanTypeLocked && { opacity: 0.5 },
                        ]}
                        disabled={loanTypeLocked}
                        onPress={() => {
                          AppHaptics.selection();
                          triggerSmoothLayout();
                          onChangeIsLent?.(!manIsLent);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.lentToggleText,
                            manIsLent && styles.lentToggleTextActive,
                          ]}
                        >
                          {manIsLent ? (manType === 'income' ? 'Borrowed' : 'Lent') : 'Off'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {manIsLent ? (
                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.lentInputLabel}>
                          {manType === 'income' ? 'Borrowed from (Lender)' : 'Lent to (Borrower)'}
                        </Text>
                        <StableTextInput
                          style={styles.lentInput}
                          placeholder="e.g. John Doe, Sarah"
                          placeholderTextColor={Palette.mutedSoft}
                          value={manLentTo}
                          onChangeText={onChangeLentTo}
                          maxLength={50}
                          returnKeyType="done"
                          onSubmitEditing={Keyboard.dismiss}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </KeyboardSafeContainer>

            {!isKeyboardVisible && (
              <View
                style={[
                  styles.stickyFooter,
                  {
                    paddingBottom: Math.max(insets.bottom, 14),
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isEditing ? 'Save changes' : 'Save transaction'}
                  accessibilityState={{ disabled: !canSubmit, busy: saving }}
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
            )}

      <AmountInputModal
        visible={amountModalVisible}
        title={isEditing ? 'Edit Amount' : 'Enter Amount'}
        subtitle={`Transaction amount in ${manCurrency}`}
        initialAmount={manAmount}
        currency={manCurrency}
        onConfirm={(formatted) => onChangeAmount(formatted)}
        onClose={() => setAmountModalVisible(false)}
      />
    </BottomSheetModal>
  );
});

ManualTxModal.displayName = 'ManualTxModal';

const styles = StyleSheet.create({
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
    ...Typography.label,
    color: Palette.muted,
    marginBottom: 6,
  },
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
  },
  textInputBox: {
    ...Typography.body,
    fontSize: 14,
    backgroundColor: Palette.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    color: Palette.ink,
  },
  amountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 6,
  },
  amountCurrencyChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    maxWidth: '62%',
  },
  amountCurrencyChipText: {
    ...Typography.code,
    fontSize: 10.5,
    fontWeight: '500',
    color: Palette.muted,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  dateSelectorCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: Palette.hairline,
    height: 42,
    alignItems: 'center',
  },
  dateSegmentBtn: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  dateSegmentIcon: {
    marginRight: 4,
    flexShrink: 0,
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
    flexShrink: 1,
    textAlign: 'center',
  },
  dateSegmentTextActive: {
    color: Palette.white,
    fontWeight: '700',
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    flexShrink: 0,
  },
  timeLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
  },
  timeInput: {
    ...Typography.code,
    fontSize: 11.5,
    fontWeight: '500',
    color: Palette.ink,
    width: 46,
    textAlign: 'center',
    padding: 0,
    margin: 0,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    overflow: 'hidden',
    height: 48,
  },
  currencyPrefixBadge: {
    width: 52,
    height: '100%',
    backgroundColor: '#EBE5DF',
    borderRightWidth: 1,
    borderRightColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyPrefixText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  amountDisplayText: {
    flex: 1,
    ...Typography.mono,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
    paddingHorizontal: 14,
  },
  amountPlaceholderText: {
    color: Palette.muted,
    fontWeight: '400',
  },
  methodSelectedBadge: {
    ...Typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
    color: Palette.primary,
  },
  methodLedgerCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    overflow: 'hidden',
  },
  methodLedgerRow: {
    flexDirection: 'row',
  },
  methodLedgerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.hairline,
  },
  methodLedgerCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: Palette.white,
  },
  methodLedgerCellLeft: {
    borderRightWidth: 1,
    borderRightColor: Palette.hairline,
  },
  methodLedgerCellActive: {
    backgroundColor: Palette.tintExpense,
  },
  methodIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodIconWrapActive: {
    backgroundColor: Palette.primary,
  },
  methodLedgerLabel: {
    flex: 1,
    ...Typography.caption,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: Palette.ink,
  },
  methodLedgerLabelActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  methodRadioDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  methodRadioDotActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderLabel: {
    ...Typography.label,
    color: Palette.muted,
  },
  sectionHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Palette.tintExpense,
    borderWidth: 1,
    borderColor: Palette.tintExpenseBorder,
  },
  sectionHeaderActionText: {
    ...Typography.caption,
    fontSize: 11.5,
    fontWeight: '600',
    color: Palette.primary,
  },
  emptySelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    borderStyle: 'dashed',
  },
  emptySelectorText: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.primary,
  },
  gridBlock: {
    gap: 8,
  },
  gridRow2Col: {
    flexDirection: 'row',
    gap: 8,
  },
  gridRow3Col: {
    flexDirection: 'row',
    gap: 8,
  },
  gridCol: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  gridSlotEmpty: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  selectorListCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
    overflow: 'hidden',
  },
  selectorListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingHorizontal: 13,
    gap: 10,
    backgroundColor: Palette.white,
  },
  selectorListRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Palette.hairline,
  },
  selectorListRowActive: {
    backgroundColor: Palette.tintExpense,
  },
  selectorRowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectorRowIconBoxActive: {
    backgroundColor: Palette.primary,
  },
  selectorRowCenter: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  selectorRowName: {
    ...Typography.body,
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
    color: Palette.ink,
  },
  selectorRowNameActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  selectorRowMeta: {
    ...Typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: Palette.muted,
    marginTop: 1,
  },
  selectorRowRight: {
    maxWidth: '42%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectorRowBalance: {
    ...Typography.mono,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '600',
    color: Palette.bodyStrong,
    textAlign: 'right',
  },
  selectorRowBalanceActive: {
    color: Palette.primaryActive,
    fontWeight: '700',
  },
  selectorRowRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectorRowRadioActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  categoryHintInline: {
    ...Typography.caption,
    fontSize: 11.5,
    color: Palette.muted,
    marginBottom: 8,
    marginTop: -2,
  },
  categoryHintError: {
    color: Palette.error,
  },
  categorySquareTile: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    overflow: 'hidden',
  },
  categorySquareIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  categorySquareLabel: {
    ...Typography.caption,
    fontSize: 11,
    lineHeight: 13.5,
    fontWeight: '500',
    color: Palette.bodyStrong,
    textAlign: 'center',
    width: '100%',
  },
  categorySquareLabelActive: {
    color: Palette.ink,
    fontWeight: '700',
  },
  balanceWarningSlot: {
    height: 20,
    justifyContent: 'center',
    marginTop: 4,
  },
  balanceWarning: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.error,
  },
  optionalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  optionalToggleLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  optionalToggleTitle: {
    ...Typography.body,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '600',
    color: Palette.ink,
  },
  optionalToggleHint: {
    ...Typography.caption,
    fontSize: 11.5,
    lineHeight: 15,
    color: Palette.muted,
    marginTop: 1,
  },
  optionalChevronBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionalContent: {
    marginTop: 12,
  },
  lentCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    marginTop: 16,
  },
  lentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lentTitle: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Palette.ink,
  },
  lentSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  lentToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  lentToggleBtnActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  lentToggleText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  lentToggleTextActive: {
    color: Palette.white,
  },
  lentInputLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
    marginBottom: 6,
  },
  lentInput: {
    backgroundColor: Palette.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Palette.ink,
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
