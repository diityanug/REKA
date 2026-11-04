import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
} from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Transaction, Wallet } from '../../types';
import { formatCurrency, parseAmount } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { BottomSheetModal } from '../BottomSheetModal';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { ContactlessCardIcon } from '../icons/ContactlessCardIcon';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';

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
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const currency = tx?.currency || 'IDR';
  const totalAmount = tx?.amount || 0;
  const repaidAmount = tx?.lentRepaidAmount || 0;
  const remainingDue = Math.max(0, totalAmount - repaidAmount);
  const borrower = tx?.lentTo?.trim() || tx?.merchantName || 'Borrower';

  // Compatible wallets that match loan currency
  const compatibleWallets = useMemo(() => {
    return wallets.filter((w) => w.currency === currency);
  }, [wallets, currency]);

  // Synchronize initial input when modal opens
  useSyncOnChange([visible, tx?.id], () => {
    if (visible && tx) {
      setAmountStr(remainingDue > 0 ? String(remainingDue) : '');
      const matchOrig = compatibleWallets.find((w) => w.id === tx.walletId);
      setSelectedWalletId(matchOrig ? matchOrig.id : compatibleWallets[0]?.id || '');
      setNotes('');
      setErrorMsg('');
      setIsSubmitting(false);
    }
  });

  const parsedAmount = parseAmount(amountStr, currency);
  const isAmountValid = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= remainingDue + 0.01;
  const isFullSettlement = isAmountValid && Math.abs(parsedAmount - remainingDue) < 0.01;
  const isOverRemaining = !isNaN(parsedAmount) && parsedAmount > remainingDue + 0.01;

  const handleConfirm = async () => {
    if (!tx) return;
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
      setErrorMsg('Please choose the destination account receiving the funds.');
      AppHaptics.error();
      return;
    }

    Keyboard.dismiss();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onSubmit({
        parentTxId: tx.id,
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

  if (!tx) return null;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
    >
      <ModalHeader
        title="Record Repayment"
        subtitle={`Borrower: ${borrower}`}
        onClose={onClose}
      />

      <KeyboardSafeContainer style={styles.container}>
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Loan Overview Card */}
          <View style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              <View style={styles.overviewCol}>
                <Text style={styles.overviewLabel}>Total Lent</Text>
                <Text style={styles.overviewValue}>
                  {formatCurrency(totalAmount, currency, privacyMode)}
                </Text>
              </View>
              <View style={[styles.overviewCol, { alignItems: 'center' }]}>
                <Text style={styles.overviewLabel}>Repaid</Text>
                <Text style={[styles.overviewValue, { color: Palette.success }]}>
                  {formatCurrency(repaidAmount, currency, privacyMode)}
                </Text>
              </View>
              <View style={[styles.overviewCol, { alignItems: 'flex-end' }]}>
                <Text style={styles.overviewLabel}>Remaining</Text>
                <Text style={[styles.overviewValue, { color: Palette.accentAmber }]}>
                  {formatCurrency(remainingDue, currency, privacyMode)}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${totalAmount > 0 ? Math.min(100, Math.round((repaidAmount / totalAmount) * 100)) : 0}%`,
                  },
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
                    setAmountStr(String(remainingDue));
                  }}
                  activeOpacity={0.7}
                  style={styles.quickFillPill}
                >
                  <Text style={styles.quickFillPillText}>Pay Full</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={[styles.inputBox, isOverRemaining && styles.inputBoxError]}>
              <Text style={styles.currencyPrefix}>{currency === 'IDR' ? 'Rp' : '$'}</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                value={amountStr}
                onChangeText={(text) => {
                  setAmountStr(text);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="0"
                placeholderTextColor={Palette.mutedSoft}
                selectTextOnFocus
              />
            </View>

            {/* Helper status text */}
            {isOverRemaining ? (
              <View style={styles.hintRow}>
                <AlertCircle size={13} color={Palette.error} />
                <Text style={[styles.hintText, { color: Palette.error }]}>
                  Amount exceeds remaining due of {formatCurrency(remainingDue, currency, false)}
                </Text>
              </View>
            ) : isFullSettlement ? (
              <View style={styles.hintRow}>
                <Check size={13} color={Palette.success} strokeWidth={3} />
                <Text style={[styles.hintText, { color: Palette.success }]}>
                  Full settlement • Loan status will change to Settled
                </Text>
              </View>
            ) : isAmountValid ? (
              <View style={styles.hintRow}>
                <Text style={styles.hintText}>
                  Partial repayment • Remaining: {formatCurrency(remainingDue - parsedAmount, currency, false)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 3. Destination Account Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receiving Account</Text>
            <Text style={styles.sectionSubtitle}>Select which account will receive the funds</Text>

            <View style={styles.walletGrid}>
              {compatibleWallets.map((w) => {
                const isSelected = selectedWalletId === w.id;
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.walletCard,
                      isSelected && styles.walletCardSelected,
                    ]}
                    onPress={() => {
                      AppHaptics.selection();
                      setSelectedWalletId(w.id);
                      if (errorMsg) setErrorMsg('');
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.walletIconBox,
                        { backgroundColor: isSelected ? Palette.primary : Palette.surfaceSoft },
                      ]}
                    >
                      <WalletIcon
                        type={w.type}
                        size={16}
                        color={isSelected ? Palette.white : Palette.ink}
                      />
                    </View>
                    <View style={styles.walletInfo}>
                      <Text
                        style={[
                          styles.walletName,
                          isSelected && styles.walletNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {w.name}
                      </Text>
                      <Text style={styles.walletBalance} numberOfLines={1}>
                        {formatCurrency(w.balance, w.currency, privacyMode)}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedCheck}>
                        <Check size={12} color={Palette.white} strokeWidth={3} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 4. Notes (Optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={`e.g. Paid in cash, transfer ref...`}
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

          {/* 5. Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!isAmountValid || isSubmitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!isAmountValid || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Palette.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isFullSettlement ? 'Confirm Full Settlement' : 'Confirm Repayment'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardSafeContainer>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  overviewCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  overviewCol: {
    flex: 1,
  },
  overviewLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginBottom: 3,
  },
  overviewValue: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 14,
    color: Palette.ink,
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
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 12,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.mutedSoft,
    marginTop: 2,
    marginBottom: 8,
  },
  quickFillPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  quickFillPillText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.primary,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 14,
    height: 48,
  },
  inputBoxError: {
    borderColor: Palette.error,
  },
  currencyPrefix: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 16,
    color: Palette.muted,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
    padding: 0,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  hintText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
  },
  walletGrid: {
    gap: 8,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  walletCardSelected: {
    borderColor: Palette.primary,
    backgroundColor: Palette.surfaceSoft,
  },
  walletIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  walletInfo: {
    flex: 1,
    minWidth: 0,
  },
  walletName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
    color: Palette.ink,
  },
  walletNameSelected: {
    color: Palette.primary,
  },
  walletBalance: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  selectedCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    backgroundColor: Palette.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Palette.ink,
    minHeight: 44,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.tintExpense,
    borderColor: Palette.tintExpenseBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 14,
  },
  errorText: {
    ...Typography.caption,
    color: Palette.error,
    fontSize: 12,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: Palette.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 15,
    color: Palette.white,
  },
});
