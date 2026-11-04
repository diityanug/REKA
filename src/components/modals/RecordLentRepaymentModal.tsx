import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  Building2,
  Smartphone,
  Banknote,
  TrendingUp,
  CreditCard,
  AlertCircle,
  HandCoins,
  User,
  Calculator,
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Transaction, Wallet } from '../../types';
import { formatCurrency, parseAmount, formatCurrencyInput } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { ContactlessCardIcon } from '../icons/ContactlessCardIcon';
import { AmountInputModal } from './AmountInputModal';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { useLastDefined } from '../../hooks/useLastDefined';
import { useFooterKeyboardOffset } from '../../hooks/useKeyboardHeight';

export interface RecordLentRepaymentModalProps {
  visible: boolean;
  parentTransaction: Transaction | null;
  wallets: Wallet[];
  privacyMode: boolean;
  onClose: () => void;
  onSubmit: (params: {
    parentTxId: string;
    walletId: string;
    amount: number;
    timestamp?: string;
    paymentMethod?: string;
    notes?: string;
  }) => Promise<void>;
}

const WalletIcon: React.FC<{ type?: string; size: number; color: string }> = ({
  type,
  size,
  color,
}) => {
  const t = (type || '').toLowerCase();
  if (t === 'e-wallet' || t === 'ewallet') return <Smartphone size={size} color={color} />;
  if (t === 'cash') return <Banknote size={size} color={color} />;
  if (t === 'investment') return <TrendingUp size={size} color={color} />;
  if (t === 'credit card' || t === 'creditcard') return <CreditCard size={size} color={color} />;
  if (t === 'e-money' || t === 'emoney') return <ContactlessCardIcon size={size} color={color} />;
  return <Building2 size={size} color={color} />;
};

export const RecordLentRepaymentModal: React.FC<RecordLentRepaymentModalProps> = ({
  visible,
  parentTransaction: tx,
  wallets,
  privacyMode,
  onClose,
  onSubmit,
}) => {
  const insets = useSafeAreaInsets();
  const footerKeyboardOffset = useFooterKeyboardOffset();
  const currentTx = useLastDefined(tx);
  const [amountStr, setAmountStr] = useState<string>('');
  const [amountModalVisible, setAmountModalVisible] = useState<boolean>(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const isBorrowed = currentTx?.type === 'income';
  const currency = currentTx?.currency || 'IDR';
  const totalAmount = currentTx?.amount || 0;
  const repaidAmount = currentTx?.lentRepaidAmount || 0;
  const remainingDue = Math.max(0, totalAmount - repaidAmount);
  const borrower =
    currentTx?.lentTo?.trim() ||
    currentTx?.merchantName ||
    (isBorrowed ? 'Lender' : 'Borrower');
  const progressPercent =
    totalAmount > 0 ? Math.min(100, Math.round((repaidAmount / totalAmount) * 100)) : 0;

  // Compatible wallets that match loan currency
  const compatibleWallets = useMemo(() => {
    return wallets.filter((w) => w.currency === currency);
  }, [wallets, currency]);

  // Synchronize initial input when modal opens
  useSyncOnChange([visible, currentTx?.id], () => {
    if (visible && currentTx) {
      const rem = Math.max(0, currentTx.amount - (currentTx.lentRepaidAmount || 0));
      setAmountStr(rem > 0 ? formatCurrencyInput(String(rem), currentTx.currency) : '');
      const matchOrig = compatibleWallets.find((w) => w.id === currentTx.walletId);
      setSelectedWalletId(matchOrig ? matchOrig.id : compatibleWallets[0]?.id || '');
      setNotes('');
      setErrorMsg('');
      setIsSubmitting(false);
      setAmountModalVisible(false);
    }
  });

  const parsedAmount = parseAmount(amountStr, currency);
  const isAmountValid = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= remainingDue + 0.01;
  const isFullSettlement = isAmountValid && Math.abs(parsedAmount - remainingDue) < 0.01;
  const isOverRemaining = !isNaN(parsedAmount) && parsedAmount > remainingDue + 0.01;

  const handleConfirm = async () => {
    if (!currentTx) return;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid repayment amount greater than 0.');
      AppHaptics.error();
      return;
    }
    if (parsedAmount > remainingDue + 0.01) {
      setErrorMsg(`Amount cannot exceed the remaining balance of ${formatCurrency(remainingDue, currency, false)}.`);
      AppHaptics.error();
      return;
    }
    if (!selectedWalletId) {
      setErrorMsg(
        isBorrowed
          ? 'Please choose the account to pay this debt from.'
          : 'Please choose the destination account receiving the funds.'
      );
      AppHaptics.error();
      return;
    }
    if (isBorrowed) {
      const sourceWallet = compatibleWallets.find((w) => w.id === selectedWalletId);
      if (sourceWallet && sourceWallet.balance < parsedAmount - 0.005) {
        setErrorMsg(
          `Insufficient balance in ${sourceWallet.name} (${formatCurrency(sourceWallet.balance, currency, false)} available).`
        );
        AppHaptics.error();
        return;
      }
    }

    Keyboard.dismiss();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onSubmit({
        parentTxId: currentTx.id,
        walletId: selectedWalletId,
        amount: parsedAmount,
        notes: notes.trim() || undefined,
      });
      AppHaptics.success();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record repayment.');
      AppHaptics.error();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentTx) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="88%"
      maxHeight="92%"
    >
      <ModalHeader
        title={isBorrowed ? 'Pay Back Debt' : 'Record Repayment'}
        subtitle={`${isBorrowed ? 'Lender' : 'Borrower'}: ${borrower}`}
        onClose={onClose}
      />

      <KeyboardSafeContainer
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        extraBottomSpace={24}
      >
        {/* 1. Spacious Hero Loan Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.borrowerTag}>
              <User size={13} color={Palette.muted} style={{ marginRight: 5 }} />
              <Text style={styles.borrowerTagText} numberOfLines={1}>
                {borrower}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                remainingDue <= 0.01
                  ? styles.statusBadgeSettled
                  : repaidAmount > 0
                  ? styles.statusBadgePartial
                  : styles.statusBadgeUnsettled,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  remainingDue <= 0.01
                    ? styles.statusBadgeTextSettled
                    : repaidAmount > 0
                    ? styles.statusBadgeTextPartial
                    : styles.statusBadgeTextUnsettled,
                ]}
              >
                {remainingDue <= 0.01
                  ? 'Settled'
                  : repaidAmount > 0
                  ? 'Partially Paid'
                  : 'Unsettled'}
              </Text>
            </View>
          </View>

          <Text style={styles.heroMetricLabel}>
            {isBorrowed ? 'Remaining Debt to Pay' : 'Remaining Balance to Collect'}
          </Text>
          <Text style={styles.heroMetricValue}>
            {formatCurrency(remainingDue, currency, privacyMode)}
          </Text>

          <View style={styles.heroStatsRow}>
            <Text style={styles.heroStatItem}>
              {isBorrowed ? 'Total Borrowed' : 'Total Loan'}: <Text style={styles.heroStatValue}>{formatCurrency(totalAmount, currency, privacyMode)}</Text>
            </Text>
            <Text style={styles.heroStatDivider}>•</Text>
            <Text style={styles.heroStatItem}>
              Repaid: <Text style={[styles.heroStatValue, { color: Palette.success }]}>{formatCurrency(repaidAmount, currency, privacyMode)}</Text>
              {` (${progressPercent}%)`}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
        </View>

        {/* 2. Repayment Amount Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Repayment Amount</Text>
            {remainingDue > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  AppHaptics.selection();
                  setAmountStr(formatCurrencyInput(String(remainingDue), currency));
                  if (errorMsg) setErrorMsg('');
                }}
                activeOpacity={0.7}
                style={styles.quickFillPill}
              >
                <Text style={styles.quickFillPillText}>Pay Full</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.inputBox, isOverRemaining && styles.inputBoxError]}
            activeOpacity={0.8}
            onPress={() => {
              AppHaptics.light();
              Keyboard.dismiss();
              setAmountModalVisible(true);
            }}
          >
            <View style={styles.currencyBadge}>
              <Text style={styles.currencyBadgeText}>{currency === 'IDR' ? 'Rp' : '$'}</Text>
            </View>
            <Text
              style={[
                styles.amountInput,
                !amountStr && styles.amountInputPlaceholder,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amountStr || (currency === 'IDR' ? '0' : '0.00')}
            </Text>
            <Calculator size={16} color={Palette.mutedSoft} />
          </TouchableOpacity>

          {/* Contextual Feedback Hint */}
          {isOverRemaining ? (
            <View style={styles.hintRow}>
              <AlertCircle size={13} color={Palette.error} />
              <Text style={[styles.hintText, { color: Palette.error }]}>
                Amount exceeds remaining balance of {formatCurrency(remainingDue, currency, false)}
              </Text>
            </View>
          ) : isFullSettlement ? (
            <View style={styles.hintRow}>
              <Check size={13} color={Palette.success} strokeWidth={3} />
              <Text style={[styles.hintText, { color: Palette.success }]}>
                Full settlement • {isBorrowed ? 'Debt' : 'Loan'} status will become Settled
              </Text>
            </View>
          ) : isAmountValid ? (
            <View style={styles.hintRow}>
              <Text style={styles.hintText}>
                Remaining after repayment: {formatCurrency(remainingDue - parsedAmount, currency, false)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 3. Account Selection (Sleek Account Chips) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isBorrowed ? 'Pay From Account' : 'Receiving Account'}
          </Text>
          <Text style={styles.sectionSubtitle}>
            {isBorrowed ? 'Select account to pay the debt from' : 'Select account to receive the funds'}
          </Text>

          <View style={styles.accountChipsRow}>
            {compatibleWallets.map((w) => {
              const isSelected = selectedWalletId === w.id;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.accountChip,
                    isSelected && styles.accountChipSelected,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    setSelectedWalletId(w.id);
                    if (errorMsg) setErrorMsg('');
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.chipTopRow}>
                    <View style={styles.chipNameRow}>
                      <WalletIcon
                        type={w.type}
                        size={14}
                        color={isSelected ? Palette.primary : Palette.ink}
                      />
                      <Text
                        style={[
                          styles.chipWalletName,
                          isSelected && styles.chipWalletNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {w.name}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedDot}>
                        <Check size={10} color={Palette.white} strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={styles.currencyPill}>
                        <Text style={styles.currencyPillText}>{w.currency}</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.chipBalance,
                      isSelected && styles.chipBalanceSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {formatCurrency(w.balance, w.currency, privacyMode)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. Notes (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Paid in cash, bank transfer ref..."
            placeholderTextColor={Palette.mutedSoft}
          />
        </View>

        {/* Error Message */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <AlertCircle size={15} color={Palette.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}
      </KeyboardSafeContainer>

      {/* 5. Sticky Action Footer */}
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
            styles.submitBtn,
            (!isAmountValid || isSubmitting) && styles.submitBtnDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!isAmountValid || isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Palette.white} size="small" />
          ) : (
            <View style={styles.submitBtnInner}>
              <HandCoins size={17} color={Palette.white} style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>
                {isFullSettlement ? 'Confirm Full Settlement' : 'Confirm Repayment'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <AmountInputModal
        visible={amountModalVisible}
        title={isBorrowed ? 'Set Debt Payment Amount' : 'Set Repayment Amount'}
        subtitle={`Remaining balance: ${formatCurrency(remainingDue, currency, false)}`}
        initialAmount={amountStr}
        currency={currency}
        onConfirm={(formatted) => {
          setAmountStr(formatted);
          if (errorMsg) setErrorMsg('');
        }}
        onClose={() => setAmountModalVisible(false)}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  heroCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  borrowerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Palette.hairline,
    maxWidth: '65%',
  },
  borrowerTagText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeUnsettled: {
    backgroundColor: Palette.tintExpense,
  },
  statusBadgePartial: {
    backgroundColor: Palette.tintIncome,
  },
  statusBadgeSettled: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextUnsettled: {
    color: Palette.accentAmber,
  },
  statusBadgeTextPartial: {
    color: Palette.primary,
  },
  statusBadgeTextSettled: {
    color: Palette.success,
  },
  heroMetricLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroMetricValue: {
    ...Typography.heading,
    fontSize: 26,
    fontWeight: '800',
    color: Palette.ink,
    marginTop: 4,
    marginBottom: 8,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  heroStatItem: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
  },
  heroStatValue: {
    fontWeight: '700',
    color: Palette.ink,
  },
  heroStatDivider: {
    color: Palette.mutedSoft,
    fontSize: 10,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Palette.hairline,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Palette.success,
    borderRadius: 3,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 12,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.mutedSoft,
    marginTop: 2,
    marginBottom: 10,
  },
  quickFillPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  quickFillPillText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    paddingHorizontal: 12,
    height: 54,
  },
  inputBoxError: {
    borderColor: Palette.error,
  },
  currencyBadge: {
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10,
  },
  currencyBadgeText: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 14,
    color: Palette.primary,
  },
  amountInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 20,
    fontWeight: '700',
    color: Palette.ink,
    padding: 0,
  },
  amountInputPlaceholder: {
    color: Palette.mutedSoft,
    fontWeight: '600',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  hintText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  accountChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  accountChip: {
    flex: 1,
    minWidth: '47%',
    padding: 12,
    borderRadius: 14,
    backgroundColor: Palette.white,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
  },
  accountChipSelected: {
    borderColor: Palette.primary,
    backgroundColor: Palette.surfaceSoft,
  },
  chipTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chipNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 6,
  },
  chipWalletName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 13,
    color: Palette.ink,
    flexShrink: 1,
  },
  chipWalletNameSelected: {
    color: Palette.primary,
  },
  currencyPill: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  currencyPillText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Palette.muted,
  },
  selectedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBalance: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    fontWeight: '500',
  },
  chipBalanceSelected: {
    color: Palette.primary,
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: Palette.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    fontSize: 14,
    color: Palette.ink,
    minHeight: 48,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.tintExpense,
    borderColor: Palette.tintExpenseBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    ...Typography.caption,
    color: Palette.error,
    fontSize: 12,
    flex: 1,
  },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.hairline,
    backgroundColor: Palette.white,
  },
  submitBtn: {
    backgroundColor: Palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 15,
    color: Palette.white,
  },
});
