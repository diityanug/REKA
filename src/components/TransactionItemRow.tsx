import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, HandCoins, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import { Palette, Typography } from '../theme/tokens';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface TransactionItemRowProps {
  transaction: Transaction;
  categoryIcon: string;
  pocketName?: string;
  privacyMode: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onPress: (tx: Transaction) => void;
  onLongPress?: (tx: Transaction) => void;
}

export const TransactionItemRow = React.memo<TransactionItemRowProps>(({
  transaction: tx,
  categoryIcon,
  pocketName,
  privacyMode,
  selectionMode = false,
  isSelected = false,
  onPress,
  onLongPress,
}) => {
  const isTransfer = tx.category === 'Transfer' || !!tx.transferPairId;
  const isExpense = tx.type === 'expense';
  const formattedAmount = privacyMode
    ? '••••••'
    : isTransfer
      ? formatCurrency(Math.abs(tx.amount), tx.currency, false)
      : `${isExpense ? '- ' : '+ '}${formatCurrency(Math.abs(tx.amount), tx.currency, false)}`;

  // Keep amount font large and readable (14px-15px); right column expands up to ~58% (40/60 split) for billion-digit amounts
  const amountFontSize =
    formattedAmount.length > 18
      ? 13.5
      : formattedAmount.length > 15
        ? 14
        : 15;

  // Dedicated sub-bar info for transactions with extra context (Lent / Repayment)
  const isLent = Boolean(tx.isLent);
  const isRepayment = Boolean(tx.lentParentTxId);
  const hasExtraInfo = isLent || isRepayment;

  let extraIcon = null;
  let extraTitle = '';
  let extraBadgeLabel = '';
  let extraBadgeStyle = styles.subBarBadgeWarning;
  let extraBadgeTextStyle = styles.subBarBadgeWarningText;

  if (isLent) {
    const isSettled = tx.lentStatus === 'settled';
    const isPartial = tx.lentStatus === 'partial';
    const isBorrowed = tx.type === 'income';
    const counterparty = tx.lentTo?.trim();
    extraTitle = isBorrowed
      ? counterparty
        ? `Borrowed from ${counterparty}`
        : 'Borrowed Money'
      : counterparty
        ? `Lent to ${counterparty}`
        : 'Lent Money';
    extraIcon = (
      <HandCoins
        size={13}
        color={isSettled ? Palette.success : Palette.accentAmber}
        style={styles.subBarIcon}
      />
    );
    if (isSettled) {
      extraBadgeLabel = 'Settled';
      extraBadgeStyle = styles.subBarBadgeSuccess;
      extraBadgeTextStyle = styles.subBarBadgeSuccessText;
    } else if (isPartial) {
      extraBadgeLabel = 'Partial';
      extraBadgeStyle = styles.subBarBadgeWarning;
      extraBadgeTextStyle = styles.subBarBadgeWarningText;
    } else {
      extraBadgeLabel = 'Unsettled';
      extraBadgeStyle = styles.subBarBadgeWarning;
      extraBadgeTextStyle = styles.subBarBadgeWarningText;
    }
  } else if (isRepayment) {
    const isDebtRepayment = tx.type === 'expense';
    extraTitle = isDebtRepayment ? 'Debt Repayment' : 'Loan Repayment';
    extraIcon = isDebtRepayment ? (
      <ArrowUpRight
        size={13}
        color={Palette.primary}
        style={styles.subBarIcon}
      />
    ) : (
      <ArrowDownLeft
        size={13}
        color={Palette.accentTeal}
        style={styles.subBarIcon}
      />
    );
    extraBadgeLabel = 'Repayment';
    extraBadgeStyle = styles.subBarBadgeTeal;
    extraBadgeTextStyle = styles.subBarBadgeTealText;
  }

  return (
    <TouchableOpacity
      style={[
        styles.txCard,
        isSelected && styles.txCardSelected,
      ]}
      onPress={() => onPress(tx)}
      onLongPress={() => onLongPress?.(tx)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${tx.merchantName}, ${tx.category}${pocketName ? `, ${pocketName}` : ''}, ${
        privacyMode ? 'amount hidden' : formattedAmount
      }. Open details.`}
    >
      <View style={styles.txRow}>
        {/* Selection Checkbox */}
        {selectionMode ? (
          <View
            style={[
              styles.checkboxCircle,
              isSelected && styles.checkboxCircleSelected,
            ]}
          >
            {isSelected && <Check size={12} color={Palette.white} strokeWidth={3} />}
          </View>
        ) : null}

        {/* Leading Category Icon */}
        <View
          style={[
            styles.txIconBox,
            {
              backgroundColor: isTransfer
                ? Palette.surfaceSoft
                : isExpense
                  ? Palette.tintExpense
                  : Palette.tintIncome,
            },
          ]}
        >
          <CategoryIcon
            name={isTransfer ? 'Transfer' : categoryIcon}
            size={19}
            color={
              isTransfer
                ? Palette.primary
                : isExpense
                  ? Palette.primary
                  : Palette.accentTeal
            }
          />
        </View>

        {/* Center: Merchant Name & Context Metadata (wraps to new line at boundary, never truncated) */}
        <View style={styles.txInfoBox}>
          <Text style={styles.txMerchantName}>
            {tx.merchantName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.txMetaText}>
              {tx.category}{pocketName ? ` • ${pocketName}` : ''}
            </Text>
          </View>
        </View>

        {/* Trailing: Right-Aligned Amount (up to ~60% width for large digits so font stays large & crisp) */}
        <View style={styles.txAmountBox}>
          <Text
            style={[
              styles.txAmountText,
              {
                fontSize: amountFontSize,
                color: isTransfer
                  ? Palette.ink
                  : isExpense
                    ? Palette.error
                    : Palette.success,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.82}
          >
            {formattedAmount}
          </Text>
        </View>
      </View>

      {/* Dedicated Bottom Strip for Lent / Repayment */}
      {hasExtraInfo ? (
        <View style={styles.subBar}>
          <View style={styles.subBarLeft}>
            {extraIcon}
            <Text style={styles.subBarLeftText}>
              {extraTitle}
            </Text>
          </View>
          <View style={[styles.subBarBadge, extraBadgeStyle]}>
            <Text style={[styles.subBarBadgeText, extraBadgeTextStyle]}>
              {extraBadgeLabel}
            </Text>
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

TransactionItemRow.displayName = 'TransactionItemRow';

const styles = StyleSheet.create({
  txCard: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  txCardSelected: {
    borderColor: Palette.primary,
    backgroundColor: Palette.surfaceSoft,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: Palette.white,
  },
  checkboxCircleSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  txInfoBox: {
    flex: 1,
    paddingRight: 10,
    minWidth: 0,
    justifyContent: 'center',
  },
  txMerchantName: {
    ...Typography.body,
    fontWeight: '600',
    color: Palette.ink,
    fontSize: 15,
    lineHeight: 20,
  },
  txMetaText: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    lineHeight: 16,
    flexShrink: 1,
  },
  txAmountBox: {
    maxWidth: '58%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'right',
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  subBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    minWidth: 0,
  },
  subBarIcon: {
    marginRight: 6,
    flexShrink: 0,
  },
  subBarLeftText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
    flexShrink: 1,
  },
  subBarBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  subBarBadgeWarning: {
    backgroundColor: Palette.tintWarning,
    borderColor: Palette.tintWarningBorder,
  },
  subBarBadgeWarningText: {
    color: Palette.accentAmber,
  },
  subBarBadgeSuccess: {
    backgroundColor: Palette.tintIncome,
    borderColor: Palette.tintIncomeBorder,
  },
  subBarBadgeSuccessText: {
    color: Palette.success,
  },
  subBarBadgeTeal: {
    backgroundColor: Palette.tintIncome,
    borderColor: Palette.tintIncomeBorder,
  },
  subBarBadgeTealText: {
    color: Palette.accentTeal,
  },
  subBarBadgeText: {
    ...Typography.caption,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
