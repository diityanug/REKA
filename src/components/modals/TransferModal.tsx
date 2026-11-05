import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDown, ArrowLeftRight, ArrowRight, Plus, RefreshCw } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { useSyncOnChange } from '../../hooks/useSyncOnChange';
import { useFooterKeyboardOffset } from '../../hooks/useKeyboardHeight';
import { useLastDefined } from '../../hooks/useLastDefined';
import { Wallet, Pocket, CurrencyType } from '../../types';
import { UpdateTransferFundsParams } from '../../services/database';
import {
  formatCurrency,
  formatCurrencyInput,
  parseAmount,
} from '../../utils/formatters';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { BottomSheetModal } from '../BottomSheetModal';
import { AmountInputModal } from './AmountInputModal';
import { CustomAlertModal, AlertButton, AlertType } from '../CustomAlertModal';

// Fallback used when the typed exchange rate cannot be applied
const DEFAULT_EXCHANGE_RATE = 16000;
const MIN_EXCHANGE_RATE = 1;
const MAX_EXCHANGE_RATE = 1e9;

export interface EditingTransferData {
  txId: string;
  fromWalletId: string;
  toWalletId: string;
  fromPocketId: string;
  toPocketId: string;
  amount: number;
  targetAmount?: number;
  exchangeRate?: number;
  notes: string;
}

interface TransferModalProps {
  visible: boolean;
  wallets: Wallet[];
  pockets?: Pocket[];
  activeCurrency: CurrencyType;
  privacyMode: boolean;
  /** Persisted USD -> IDR rate, seeds the exchange rate input */
  initialExchangeRate: number;
  exchangeRateInfo?: {
    rate: number;
    lastUpdated: string;
    isLive: boolean;
  };
  onRefreshExchangeRate?: () => Promise<any>;
  /** Opens the create-account flow when a transfer needs another account */
  onOpenAddAccount?: () => void;
  editingTransfer?: EditingTransferData | null;
  onExecuteTransfer: (
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    notes: string,
    targetAmount?: number,
    exchangeRate?: number,
    fromPocketId?: string,
    toPocketId?: string
  ) => Promise<void>;
  onUpdateTransfer?: (params: UpdateTransferFundsParams) => Promise<void>;
  onClose: () => void;
}

export const TransferModal = React.memo<TransferModalProps>(({
  visible,
  wallets,
  pockets = [],
  activeCurrency,
  privacyMode,
  initialExchangeRate,
  exchangeRateInfo,
  onRefreshExchangeRate,
  onOpenAddAccount,
  editingTransfer,
  onExecuteTransfer,
  onUpdateTransfer,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const footerKeyboardOffset = useFooterKeyboardOffset();

  const [fromWalletId, setFromWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [fromPocketId, setFromPocketId] = useState<string>('');
  const [toPocketId, setToPocketId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [amountModalVisible, setAmountModalVisible] = useState<boolean>(false);
  const [exchangeRateStr, setExchangeRateStr] = useState<string>(() =>
    formatCurrencyInput(String(initialExchangeRate), 'IDR')
  );
  const [rateModalVisible, setRateModalVisible] = useState<boolean>(false);
  const [quickPercentHint, setQuickPercentHint] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
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

  const handleRefreshLiveRate = async () => {
    if (!onRefreshExchangeRate || refreshingRate || submitting) return;
    setRefreshingRate(true);
    startSpin();
    try {
      const res = await onRefreshExchangeRate();
      if (res && res.rate > 0) {
        setExchangeRateStr(formatCurrencyInput(String(res.rate), 'IDR'));
      }
    } finally {
      stopSpin();
      setRefreshingRate(false);
    }
  };

  // Freeze wallet and pocket balances while submitting or closing so chips and warnings never jump on save/close
  const eligibleWallets =
    useLastDefined(!submitting && visible ? wallets : null) ?? wallets;
  const eligiblePockets =
    useLastDefined(!submitting && visible ? pockets : null) ?? pockets;
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

  const handleModalClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  // Re-seed the rate and reset/populate inputs only when the modal opens
  useSyncOnChange([visible, editingTransfer], () => {
    if (visible) {
      setQuickPercentHint('');
      setSubmitting(false);
      setAmountModalVisible(false);

      if (editingTransfer) {
        setFromWalletId(editingTransfer.fromWalletId);
        setToWalletId(editingTransfer.toWalletId);
        setFromPocketId(editingTransfer.fromPocketId || '');
        setToPocketId(editingTransfer.toPocketId || '');
        const fromW = eligibleWallets.find((w) => w.id === editingTransfer.fromWalletId);
        const fromCurr = fromW ? fromW.currency : activeCurrency;
        setAmountStr(formatCurrencyInput(String(editingTransfer.amount), fromCurr));
        setNotes(editingTransfer.notes || '');
        const rateToUse =
          editingTransfer.exchangeRate && editingTransfer.exchangeRate > 0
            ? editingTransfer.exchangeRate
            : exchangeRateInfo?.rate && exchangeRateInfo.rate > 0
              ? exchangeRateInfo.rate
              : initialExchangeRate;
        setExchangeRateStr(formatCurrencyInput(String(rateToUse), 'IDR'));
      } else {
        setFromPocketId('');
        setToPocketId('');
        setAmountStr('');
        setNotes('');
        const activeRate =
          exchangeRateInfo?.rate && exchangeRateInfo.rate > 0
            ? exchangeRateInfo.rate
            : initialExchangeRate;
        setExchangeRateStr(formatCurrencyInput(String(activeRate), 'IDR'));
      }
    }
  });

  // Initialize selected accounts whenever modal is visible in create mode
  useSyncOnChange([visible, eligibleWallets, editingTransfer], () => {
    if (visible && !editingTransfer) {
      if (eligibleWallets.length >= 2) {
        if (!fromWalletId || !eligibleWallets.some((w) => w.id === fromWalletId)) {
          setFromWalletId(eligibleWallets[0].id);
          setFromPocketId('');
        }
        if (!toWalletId || !eligibleWallets.some((w) => w.id === toWalletId) || toWalletId === eligibleWallets[0].id) {
          setToWalletId(eligibleWallets[1].id);
          setToPocketId('');
        }
      } else if (eligibleWallets.length === 1) {
        setFromWalletId(eligibleWallets[0].id);
        setFromPocketId('');
        setToWalletId('');
        setToPocketId('');
      }
    }
  });

  const selectedFromWallet = eligibleWallets.find((w) => w.id === fromWalletId);
  const selectedToWallet = eligibleWallets.find((w) => w.id === toWalletId);
  const fromWalletPockets = eligiblePockets.filter((p) => p.walletId === fromWalletId);
  const toWalletPockets = eligiblePockets.filter((p) => p.walletId === toWalletId);
  const selectedFromPocket = fromWalletPockets.find((p) => p.id === fromPocketId);
  const toAllocatedSum = toWalletPockets.reduce((sum, p) => sum + p.balance, 0);
  const toUnallocatedDisplay = selectedToWallet
    ? Math.max(0, selectedToWallet.balance - toAllocatedSum)
    : 0;

  const fromAllocatedSum = fromWalletPockets.reduce((sum, p) => sum + p.balance, 0);
  const rawFromUnallocated = selectedFromWallet
    ? selectedFromWallet.balance - fromAllocatedSum
    : 0;
  const fromUnallocatedDisplay = Math.max(0, rawFromUnallocated);

  // When editing an existing transfer, add back the old amount if the same source is still selected
  const isSameSourceAsEditing =
    !!editingTransfer &&
    editingTransfer.fromWalletId === fromWalletId &&
    (editingTransfer.fromPocketId || '') === (fromPocketId || '');
  const editingRefund = isSameSourceAsEditing ? editingTransfer!.amount : 0;

  const effectiveSourceBalance = selectedFromPocket
    ? Math.max(0, selectedFromPocket.balance + editingRefund)
    : selectedFromWallet
      ? Math.max(
          0,
          (fromWalletPockets.length > 0 ? rawFromUnallocated : selectedFromWallet.balance) +
            editingRefund
        )
      : 0;

  const fromCurrency = selectedFromWallet ? selectedFromWallet.currency : activeCurrency;
  const toCurrency = selectedToWallet ? selectedToWallet.currency : activeCurrency;
  const isCrossCurrency = selectedFromWallet && selectedToWallet && selectedFromWallet.currency !== selectedToWallet.currency;

  const parsedRate = parseAmount(exchangeRateStr, 'IDR');
  const rateInvalid = parsedRate < MIN_EXCHANGE_RATE || parsedRate > MAX_EXCHANGE_RATE;
  // Always convert and display the rate that is actually applied
  const appliedRate = rateInvalid ? DEFAULT_EXCHANGE_RATE : parsedRate;
  const appliedRateLabel = formatCurrencyInput(String(appliedRate), 'IDR');
  const numericAmount = parseAmount(amountStr, fromCurrency);

  let targetAmount = numericAmount;
  if (isCrossCurrency) {
    if (fromCurrency === 'USD' && toCurrency === 'IDR') {
      targetAmount = Math.round(numericAmount * appliedRate);
    } else if (fromCurrency === 'IDR' && toCurrency === 'USD') {
      targetAmount = Math.round((numericAmount / appliedRate) * 100) / 100;
    }
  }

  // Non-blocking sanity warning for the USD/IDR pair
  const isUsdIdrPair =
    isCrossCurrency &&
    ((fromCurrency === 'USD' && toCurrency === 'IDR') ||
      (fromCurrency === 'IDR' && toCurrency === 'USD'));
  const rateLooksUnusual =
    isUsdIdrPair &&
    numericAmount > 0 &&
    targetAmount > 0 &&
    (targetAmount > numericAmount * 100 || numericAmount > targetAmount * 100);

  const quickPercentUnavailable = !selectedFromWallet || effectiveSourceBalance <= 0;
  const submitDisabled =
    submitting ||
    !fromWalletId ||
    !toWalletId ||
    fromWalletId === toWalletId ||
    !(numericAmount > 0) ||
    (isCrossCurrency && rateInvalid);

  const handleQuickPercent = (pct: number) => {
    if (!selectedFromWallet || effectiveSourceBalance <= 0) {
      AppHaptics.error();
      setQuickPercentHint(
        selectedFromPocket
          ? `No balance available in "${selectedFromPocket.name}".`
          : fromWalletPockets.length > 0
            ? 'No unallocated balance in Main Account — select a pocket or release funds.'
            : 'No balance available — add funds to this account first.'
      );
      return;
    }
    AppHaptics.selection();
    setQuickPercentHint('');
    const val = fromCurrency === 'IDR'
      ? Math.floor(effectiveSourceBalance * pct)
      : Math.round(effectiveSourceBalance * pct * 100) / 100;
    setAmountStr(val > 0 ? formatCurrencyInput(val.toString(), fromCurrency) : '');
  };

  const handleSwap = () => {
    if (!fromWalletId || !toWalletId) return;
    AppHaptics.selection();
    const tempWallet = fromWalletId;
    const tempPocket = fromPocketId;
    setFromWalletId(toWalletId);
    setToWalletId(tempWallet);
    setFromPocketId(toPocketId);
    setToPocketId(tempPocket);
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

    if (isCrossCurrency && rateInvalid) {
      showAlert(
        'Invalid Exchange Rate',
        'Enter an exchange rate between Rp 1 and Rp 1.000.000.000.',
        undefined,
        'warning'
      );
      return;
    }

    if (selectedFromPocket) {
      if (effectiveSourceBalance + 0.005 < numericAmount) {
        showAlert(
          'Insufficient Pocket Balance',
          `"${selectedFromPocket.name}" only has ${formatCurrency(effectiveSourceBalance, fromCurrency, privacyMode)} available.`,
          undefined,
          'warning'
        );
        return;
      }
    } else if (selectedFromWallet) {
      if (fromWalletPockets.length > 0 && effectiveSourceBalance + 0.005 < numericAmount) {
        showAlert(
          'Insufficient Main Account Balance',
          `${selectedFromWallet.name} only has ${formatCurrency(effectiveSourceBalance, fromCurrency, privacyMode)} unallocated in Main Account. Select a source pocket or release funds first.`,
          undefined,
          'warning'
        );
        return;
      }
      if (effectiveSourceBalance + 0.005 < numericAmount) {
        showAlert(
          'Insufficient Balance',
          `The source account only has ${formatCurrency(effectiveSourceBalance, fromCurrency, privacyMode)}.`,
          undefined,
          'warning'
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      AppHaptics.heavy();
      if (editingTransfer && onUpdateTransfer) {
        await onUpdateTransfer({
          txId: editingTransfer.txId,
          fromWalletId,
          toWalletId,
          amount: numericAmount,
          notes,
          targetAmount: isCrossCurrency ? targetAmount : undefined,
          exchangeRate: isCrossCurrency ? appliedRate : undefined,
          fromPocketId: fromPocketId || undefined,
          toPocketId: toPocketId || undefined,
        });
      } else {
        await onExecuteTransfer(
          fromWalletId,
          toWalletId,
          numericAmount,
          notes,
          isCrossCurrency ? targetAmount : undefined,
          isCrossCurrency ? appliedRate : undefined,
          fromPocketId || undefined,
          toPocketId || undefined
        );
      }
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
      onClose={handleModalClose}
      height="92%"
      maxHeight="94%"
    >
      <ModalHeader
        title={editingTransfer ? 'Edit Transfer' : 'Transfer Funds'}
        subtitle={
          isCrossCurrency
            ? `Cross - Currency Transfer (${fromCurrency} → ${toCurrency})`
            : `Move money across accounts (${fromCurrency})`
        }
        onClose={handleModalClose}
      />

          <KeyboardSafeContainer extraBottomSpace={32}>
            {eligibleWallets.length < 2 ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>At least two accounts needed</Text>
                <Text style={styles.noticeDesc}>
                  You need at least two accounts to perform a transfer.
                </Text>
                {onOpenAddAccount ? (
                  <TouchableOpacity
                    style={styles.noticeActionBtn}
                    onPress={() => {
                      AppHaptics.light();
                      onOpenAddAccount();
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Create Account"
                  >
                    <Plus size={16} color={Palette.white} style={{ marginRight: 6 }} />
                    <Text style={styles.noticeActionBtnText}>Create Account</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <>
                {/* Source Account Selector */}
                <View style={styles.fieldSection}>
                  <Text style={styles.inputLabel}>
                    From Account <Text style={styles.requiredStar}>*</Text>
                  </Text>
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
                            if (fromWalletId !== w.id) {
                              setFromWalletId(w.id);
                              setFromPocketId('');
                            }
                            if (toWalletId === w.id) {
                              const other = eligibleWallets.find((ow) => ow.id !== w.id);
                              if (other) {
                                setToWalletId(other.id);
                                setToPocketId('');
                              }
                            }
                          }}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`From account ${w.name}, ${w.currency}, balance ${formatCurrency(w.balance, w.currency, privacyMode)}`}
                          accessibilityState={{ selected: isSelected }}
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

                  {/* Source Pocket Selector (shown when From Account has pockets) */}
                  {fromWalletPockets.length > 0 && selectedFromWallet && (
                    <View style={styles.pocketSubSection}>
                      <Text style={styles.pocketSubLabel}>Source Balance / Pocket</Text>
                      <View style={styles.pocketChipsRow}>
                        <TouchableOpacity
                          style={[
                            styles.pocketChip,
                            !fromPocketId && styles.pocketChipActiveFrom,
                          ]}
                          onPress={() => {
                            AppHaptics.selection();
                            setFromPocketId('');
                          }}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`From Main Account, unallocated balance ${formatCurrency(fromUnallocatedDisplay, selectedFromWallet.currency, privacyMode)}`}
                          accessibilityState={{ selected: !fromPocketId }}
                        >
                          <Text
                            style={[
                              styles.pocketChipName,
                              !fromPocketId && styles.pocketChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            Main Account
                          </Text>
                          <Text
                            style={[
                              styles.pocketChipBalance,
                              !fromPocketId && styles.pocketChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {formatCurrency(fromUnallocatedDisplay, selectedFromWallet.currency, privacyMode)}
                          </Text>
                        </TouchableOpacity>

                        {fromWalletPockets.map((p) => {
                          const isSelected = p.id === fromPocketId;
                          return (
                            <TouchableOpacity
                              key={`from_pocket_${p.id}`}
                              style={[
                                styles.pocketChip,
                                isSelected && styles.pocketChipActiveFrom,
                              ]}
                              onPress={() => {
                                AppHaptics.selection();
                                setFromPocketId(p.id);
                              }}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel={`From pocket ${p.name}, balance ${formatCurrency(p.balance, selectedFromWallet.currency, privacyMode)}`}
                              accessibilityState={{ selected: isSelected }}
                            >
                              <Text
                                style={[
                                  styles.pocketChipName,
                                  isSelected && styles.pocketChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {p.name}
                              </Text>
                              <Text
                                style={[
                                  styles.pocketChipBalance,
                                  isSelected && styles.pocketChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {formatCurrency(p.balance, selectedFromWallet.currency, privacyMode)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
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
                  <Text style={styles.inputLabel}>
                    To Account <Text style={styles.requiredStar}>*</Text>
                  </Text>
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
                            if (toWalletId !== w.id) {
                              setToWalletId(w.id);
                              setToPocketId('');
                            }
                          }}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`To account ${w.name}, ${w.currency}, balance ${formatCurrency(w.balance, w.currency, privacyMode)}`}
                          accessibilityState={{ selected: isSelected, disabled: isSource }}
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

                  {/* Destination Pocket Selector (shown when To Account has pockets) */}
                  {toWalletPockets.length > 0 && selectedToWallet && (
                    <View style={styles.pocketSubSection}>
                      <Text style={styles.pocketSubLabel}>Destination Balance / Pocket</Text>
                      <View style={styles.pocketChipsRow}>
                        <TouchableOpacity
                          style={[
                            styles.pocketChip,
                            !toPocketId && styles.pocketChipActiveTo,
                          ]}
                          onPress={() => {
                            AppHaptics.selection();
                            setToPocketId('');
                          }}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`To Main Account, unallocated balance ${formatCurrency(toUnallocatedDisplay, selectedToWallet.currency, privacyMode)}`}
                          accessibilityState={{ selected: !toPocketId }}
                        >
                          <Text
                            style={[
                              styles.pocketChipName,
                              !toPocketId && styles.pocketChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            Main Account
                          </Text>
                          <Text
                            style={[
                              styles.pocketChipBalance,
                              !toPocketId && styles.pocketChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {formatCurrency(toUnallocatedDisplay, selectedToWallet.currency, privacyMode)}
                          </Text>
                        </TouchableOpacity>

                        {toWalletPockets.map((p) => {
                          const isSelected = p.id === toPocketId;
                          return (
                            <TouchableOpacity
                              key={`to_pocket_${p.id}`}
                              style={[
                                styles.pocketChip,
                                isSelected && styles.pocketChipActiveTo,
                              ]}
                              onPress={() => {
                                AppHaptics.selection();
                                setToPocketId(p.id);
                              }}
                              activeOpacity={0.8}
                              accessibilityRole="button"
                              accessibilityLabel={`To pocket ${p.name}, balance ${formatCurrency(p.balance, selectedToWallet.currency, privacyMode)}`}
                              accessibilityState={{ selected: isSelected }}
                            >
                              <Text
                                style={[
                                  styles.pocketChipName,
                                  isSelected && styles.pocketChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {p.name}
                              </Text>
                              <Text
                                style={[
                                  styles.pocketChipBalance,
                                  isSelected && styles.pocketChipTextActive,
                                ]}
                                numberOfLines={1}
                              >
                                {formatCurrency(p.balance, selectedToWallet.currency, privacyMode)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
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
                        disabled={submitting}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Exchange rate, 1 USD equals ${appliedRateLabel} Rupiah. Tap to edit.`}
                      >
                        <View style={styles.fxRatePrefixTag}>
                          <Text style={styles.fxRatePrefixText}>Rp</Text>
                        </View>
                        <Text style={styles.fxRatePickerValue}>{appliedRateLabel}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.fxLiveStatusRow}>
                      <Text style={styles.fxLiveStatusText} numberOfLines={1}>
                        {exchangeRateInfo?.isLive ? 'Live Market Rate' : 'Estimated Rate'} · $ 1 = Rp {appliedRateLabel}
                      </Text>
                      {onRefreshExchangeRate ? (
                        <TouchableOpacity
                          style={styles.fxRefreshBtn}
                          onPress={handleRefreshLiveRate}
                          disabled={refreshingRate || submitting}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel="Refresh live exchange rate"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                            }}
                          >
                            <RefreshCw size={13} color={Palette.primary} />
                          </Animated.View>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {rateInvalid ? (
                      <Text style={styles.fxRateError}>
                        Enter a valid rate between Rp 1 and Rp 1.000.000.000.
                      </Text>
                    ) : null}

                    {rateLooksUnusual ? (
                      <Text style={styles.fxRateWarning}>
                        This rate looks unusual — double-check it.
                      </Text>
                    ) : null}

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

                {/* Transfer Amount Input with Calculator Modal */}
                <View style={styles.fieldSection}>
                  <Text style={styles.inputLabel}>
                    Transfer Amount ({fromCurrency}) <Text style={styles.requiredStar}>*</Text>
                  </Text>

                  <TouchableOpacity
                    style={styles.amountInputContainer}
                    onPress={() => {
                      AppHaptics.light();
                      Keyboard.dismiss();
                      setAmountModalVisible(true);
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Transfer amount, ${amountStr || '0'} ${fromCurrency}`}
                  >
                    <View style={styles.currencyPrefixBadge}>
                      <Text style={styles.currencyPrefixText}>
                        {fromCurrency === 'IDR' ? 'Rp' : '$'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.amountDisplayText,
                        !amountStr && styles.amountPlaceholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {amountStr || '0'}
                    </Text>
                  </TouchableOpacity>

                  {/* Quick percentage chips */}
                  <View style={styles.quickPercentRow}>
                    <TouchableOpacity
                      style={[
                        styles.quickPercentBtn,
                        quickPercentUnavailable && styles.quickPercentBtnDimmed,
                      ]}
                      onPress={() => handleQuickPercent(0.25)}
                      accessibilityRole="button"
                      accessibilityLabel="Use 25 percent of balance"
                      accessibilityState={{ selected: false, disabled: quickPercentUnavailable }}
                    >
                      <Text style={styles.quickPercentText}>25%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.quickPercentBtn,
                        quickPercentUnavailable && styles.quickPercentBtnDimmed,
                      ]}
                      onPress={() => handleQuickPercent(0.5)}
                      accessibilityRole="button"
                      accessibilityLabel="Use 50 percent of balance"
                      accessibilityState={{ selected: false, disabled: quickPercentUnavailable }}
                    >
                      <Text style={styles.quickPercentText}>50%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.quickPercentBtn,
                        quickPercentUnavailable && styles.quickPercentBtnDimmed,
                      ]}
                      onPress={() => handleQuickPercent(1.0)}
                      accessibilityRole="button"
                      accessibilityLabel="Use all available balance"
                      accessibilityState={{ selected: false, disabled: quickPercentUnavailable }}
                    >
                      <Text style={styles.quickPercentText}>All Balance</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.quickPercentHintSlot}>
                    {quickPercentHint ? (
                      <Text style={styles.quickPercentHint} numberOfLines={1}>
                        {quickPercentHint}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Optional Notes */}
                <View style={styles.fieldSection}>
                  <Text style={styles.inputLabel}>Notes</Text>
                  <TextInput
                    style={styles.textInputBox}
                    placeholder="e.g. Allocation, Savings, Bill share"
                    placeholderTextColor={Palette.mutedSoft}
                    value={notes}
                    onChangeText={setNotes}
                    maxLength={100}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>
              </>
            )}
          </KeyboardSafeContainer>

          {/* Sticky Bottom Action */}
          {eligibleWallets.length >= 2 && (
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
                  submitDisabled && styles.confirmBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitDisabled}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={editingTransfer ? 'Save transfer changes' : 'Transfer funds'}
                accessibilityState={{ disabled: submitDisabled, busy: submitting }}
              >
                <ArrowLeftRight size={18} color={Palette.white} style={{ marginRight: 8 }} />
                <Text style={styles.confirmBtnText}>
                  {submitting
                    ? 'Processing...'
                    : editingTransfer
                      ? 'Save Changes'
                      : 'Transfer Funds'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

      <AmountInputModal
        visible={amountModalVisible}
        title="Transfer Amount"
        subtitle={
          selectedFromWallet
            ? `From ${selectedFromWallet.name}${selectedFromPocket ? ` • ${selectedFromPocket.name}` : ''} (${fromCurrency})`
            : `Transfer Amount (${fromCurrency})`
        }
        initialAmount={amountStr}
        currency={fromCurrency}
        onConfirm={(formatted) => {
          setAmountStr(formatted);
          setAmountModalVisible(false);
        }}
        onClose={() => setAmountModalVisible(false)}
      />

      <AmountInputModal
        visible={rateModalVisible}
        title="Set Exchange Rate"
        subtitle="1 USD equivalent in IDR"
        initialAmount={appliedRateLabel}
        currency="IDR"
        allowZero={false}
        onConfirm={(formatted) => {
          // Keep the raw input so an unreadable rate surfaces the inline error
          setExchangeRateStr(formatted);
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
});

TransferModal.displayName = 'TransferModal';

const styles = StyleSheet.create({
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
  requiredStar: {
    color: Palette.primary,
    fontWeight: '700',
  },
  accountChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pocketSubSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  pocketSubLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
    marginBottom: 6,
  },
  pocketChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pocketChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    minWidth: '30%',
    flexGrow: 1,
  },
  pocketChipActiveFrom: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  pocketChipActiveTo: {
    backgroundColor: Palette.accentTeal,
    borderColor: Palette.accentTeal,
  },
  pocketChipName: {
    ...Typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  pocketChipBalance: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  pocketChipTextActive: {
    color: Palette.white,
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
    minHeight: 44,
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
  fxLiveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
    marginTop: -4,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  fxLiveStatusText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    flex: 1,
    marginRight: 8,
  },
  fxRefreshBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Palette.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fxRateError: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.error,
    marginTop: -6,
    marginBottom: 10,
  },
  fxRateWarning: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.accentAmber,
    marginTop: -6,
    marginBottom: 10,
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
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    overflow: 'hidden',
    height: 48,
  },
  currencyPrefixBadge: {
    paddingHorizontal: 14,
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
    ...Typography.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
    paddingHorizontal: 14,
  },
  amountPlaceholderText: {
    color: Palette.muted,
    fontWeight: '400',
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
    minHeight: 36,
    justifyContent: 'center',
  },
  quickPercentBtnDimmed: {
    opacity: 0.5,
  },
  quickPercentText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
  },
  quickPercentHintSlot: {
    height: 18,
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  quickPercentHint: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.error,
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
  noticeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    minHeight: 44,
    alignSelf: 'stretch',
  },
  noticeActionBtnText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.white,
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
    minHeight: 44,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.white,
  },
});
