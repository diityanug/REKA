import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Pocket, Wallet, CurrencyType } from '../../types';
import { formatCurrency, parseAmount } from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { useLastDefined } from '../../hooks/useLastDefined';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';

interface AdjustPocketModalProps {
  pocket: Pocket | null;
  wallets: Wallet[];
  pockets?: Pocket[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  mode: 'allocate' | 'release';
  amount: string;
  onChangeMode: (mode: 'allocate' | 'release') => void;
  onChangeAmount: (text: string) => void;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const AdjustPocketModal: React.FC<AdjustPocketModalProps> = ({
  pocket: propPocket,
  wallets,
  pockets = [],
  activeCurrency,
  privacyMode,
  mode,
  amount,
  onChangeMode,
  onChangeAmount,
  onConfirm,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [showAmountModal, setShowAmountModal] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const pocket = useLastDefined(propPocket);
  if (!pocket) return null;

  const parentWallet = wallets.find((w) => w.id === pocket.walletId);
  const pCurrency = parentWallet ? parentWallet.currency : activeCurrency;

  // Funds of the parent account that are not assigned to any pocket yet.
  const walletPockets =
    pockets.length > 0 ? pockets : [pocket];
  const allocatedInWallet = walletPockets
    .filter((p) => p.walletId === pocket.walletId)
    .reduce((sum, p) => sum + p.balance, 0);
  const availableToAllocate = Math.max(
    (parentWallet ? parentWallet.balance : 0) - allocatedInWallet,
    0
  );
  const releaseLimit = pocket.balance;
  const limit = mode === 'allocate' ? availableToAllocate : releaseLimit;

  const typedAmount = parseAmount(amount, pCurrency);
  const exceedsLimit = !!amount && !isNaN(typedAmount) && typedAmount > limit;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onConfirm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheetModal
      visible={!!propPocket}
      onClose={onClose}
      height="88%"
      maxHeight="92%"
    >
      <ModalHeader
        title={pocket.name}
        subtitle="Transfer funds with main account"
        onClose={onClose}
      />

            <KeyboardSafeContainer>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Current Balance</Text>
                <Text style={styles.summaryAmount}>
                  {formatCurrency(pocket.balance, pCurrency, privacyMode)}
                </Text>
                <View style={styles.divider} />
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>
                    {mode === 'allocate' ? 'Available to allocate' : 'Can release up to'}
                  </Text>
                  <Text style={styles.metaValue}>
                    {formatCurrency(
                      mode === 'allocate' ? availableToAllocate : releaseLimit,
                      pCurrency,
                      privacyMode
                    )}
                  </Text>
                </View>
                {pocket.targetAmount > 0 ? (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Target Goal</Text>
                      <Text style={styles.metaValue}>
                        {formatCurrency(pocket.targetAmount, pCurrency, privacyMode)}
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>

              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    mode === 'allocate' && styles.segmentBtnActiveIncome,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeMode('allocate');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Allocate funds into this pocket"
                  accessibilityState={{ selected: mode === 'allocate' }}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      mode === 'allocate' && styles.segmentBtnTextActive,
                    ]}
                  >
                    ( + ) Allocate
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentBtn,
                    mode === 'release' && styles.segmentBtnActiveExpense,
                  ]}
                  onPress={() => {
                    AppHaptics.selection();
                    onChangeMode('release');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Release funds from this pocket"
                  accessibilityState={{ selected: mode === 'release' }}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      mode === 'release' && styles.segmentBtnTextActive,
                    ]}
                  >
                    ( - ) Release
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Amount to {mode === 'allocate' ? 'Allocate' : 'Release'} <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.amountPickerBox}
                onPress={() => {
                  AppHaptics.light();
                  Keyboard.dismiss();
                  setShowAmountModal(true);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Amount to ${mode === 'allocate' ? 'allocate' : 'release'}, ${amount || '0'} ${pCurrency}`}
              >
                <View style={styles.amountPrefixTag}>
                  <Text style={styles.amountPrefixTagText}>
                    {pCurrency === 'IDR' ? 'Rp' : '$'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.amountPickerValue,
                    !amount && styles.amountPickerPlaceholder,
                  ]}
                  numberOfLines={1}
                >
                  {amount || (pCurrency === 'IDR' ? '0' : '0.00')}
                </Text>
              </TouchableOpacity>

              {exceedsLimit ? (
                <Text style={styles.inlineError}>
                  {mode === 'allocate'
                    ? 'More than the available unallocated funds.'
                    : 'More than the pocket balance.'}
                </Text>
              ) : null}
            </KeyboardSafeContainer>

            <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor:
                      mode === 'allocate' ? Palette.accentTeal : Palette.primary,
                  },
                  (exceedsLimit || saving) && styles.confirmBtnDisabled,
                ]}
                onPress={submit}
                disabled={exceedsLimit || saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={mode === 'allocate' ? 'Confirm allocation' : 'Confirm release'}
                accessibilityState={{ disabled: exceedsLimit || saving }}
              >
                {saving ? (
                  <>
                    <ActivityIndicator size="small" color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Saving...</Text>
                  </>
                ) : (
                  <>
                    <Check size={18} color={Palette.white} style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>
                      {mode === 'allocate' ? 'Confirm Allocation' : 'Confirm Release'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

      <AmountInputModal
        visible={showAmountModal}
        title={mode === 'allocate' ? 'Allocate to Pocket' : 'Release from Pocket'}
        subtitle={`Adjust balance between ${parentWallet?.name || 'Account'} and ${pocket.name}`}
        initialAmount={amount}
        currency={pCurrency}
        onConfirm={(formatted) => {
          onChangeAmount(formatted);
          setShowAmountModal(false);
        }}
        onClose={() => setShowAmountModal(false)}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  summaryLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    ...Typography.mono,
    fontSize: 20,
    fontWeight: '700',
    color: Palette.ink,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.hairline,
    marginVertical: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLabel: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
  },
  metaValue: {
    ...Typography.mono,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActiveIncome: {
    backgroundColor: Palette.accentTeal,
  },
  segmentBtnActiveExpense: {
    backgroundColor: Palette.primary,
  },
  segmentBtnText: {
    ...Typography.body,
    fontSize: 12,
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
  inlineError: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '500',
    color: Palette.error,
    marginTop: 6,
  },
  amountPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  amountPrefixTag: {
    backgroundColor: Palette.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10,
  },
  amountPrefixTagText: {
    ...Typography.body,
    fontWeight: '700',
    color: Palette.ink,
    fontSize: 14,
  },
  amountPickerValue: {
    ...Typography.body,
    fontWeight: '600',
    color: Palette.ink,
    fontSize: 16,
    flex: 1,
  },
  amountPickerPlaceholder: {
    color: Palette.mutedSoft,
    fontWeight: '400',
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
    paddingVertical: 13,
    borderRadius: 14,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
});
