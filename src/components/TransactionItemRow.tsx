import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Palette, Typography } from '../theme/tokens';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface TransactionItemRowProps {
  transaction: Transaction;
  categoryIcon: string;
  pocketName?: string;
  privacyMode: boolean;
  onPress: (tx: Transaction) => void;
}

export const TransactionItemRow = React.memo<TransactionItemRowProps>(({
  transaction: tx,
  categoryIcon,
  pocketName,
  privacyMode,
  onPress,
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
      style={styles.txCard}
      onPress={() => onPress(tx)}
      activeOpacity={0.7}
    >
      <View style={styles.txRow}>
        {/* Leading Category Icon */}
        <View
          style={[
            styles.txIconBox,
            {
              backgroundColor: isTransfer
                ? '#F5EFEB'
                : isExpense
                  ? '#FDF0ED'
                  : '#EBF7F4',
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
          <Text style={styles.txMetaText} numberOfLines={1}>
            {tx.category}{pocketName ? ` • ${pocketName}` : ''}
          </Text>
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
    borderColor: Palette.hairline,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
