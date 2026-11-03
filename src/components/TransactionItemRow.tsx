import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
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
            size={18}
            color={
              isTransfer
                ? Palette.primary
                : isExpense
                  ? Palette.primary
                  : Palette.accentTeal
            }
          />
        </View>

        {/* Center: Merchant Name & Context Metadata */}
        <View style={styles.txInfoBox}>
          <Text style={styles.txMerchantName} numberOfLines={3}>
            {tx.merchantName}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.txMetaText} numberOfLines={1}>
              {tx.category}{pocketName ? ` • ${pocketName}` : ''}
            </Text>
            {tx.isLent ? (
              <View style={styles.lentBadge}>
                <Text style={styles.lentBadgeText}>
                  {tx.lentTo ? `Lent to ${tx.lentTo}` : 'Lent'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Trailing: Right-Aligned Amount */}
        <View style={styles.txAmountBox}>
          <Text
            style={[
              styles.txAmountText,
              {
                color: isTransfer
                  ? Palette.ink
                  : isExpense
                    ? Palette.error
                    : Palette.success,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            minimumFontScale={0.75}
          >
            {formattedAmount}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

TransactionItemRow.displayName = 'TransactionItemRow';

const styles = StyleSheet.create({
  txCard: {
    backgroundColor: Palette.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  txCardSelected: {
    borderColor: Palette.primary,
    backgroundColor: Palette.surfaceSoft,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 8,
    backgroundColor: Palette.white,
  },
  checkboxCircleSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  lentBadge: {
    backgroundColor: Palette.tintWarning,
    borderColor: Palette.tintWarningBorder,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  lentBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: Palette.accentAmber,
  },
  txIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
    flexShrink: 0,
  },
  txInfoBox: {
    flex: 1,
    paddingRight: 8,
    minWidth: 0,
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
    marginTop: 3,
    lineHeight: 16,
  },
  txAmountBox: {
    maxWidth: '48%',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 1,
    flexShrink: 0,
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'right',
  },
});
