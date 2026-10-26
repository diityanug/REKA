import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Building2,
  Banknote,
  ChevronRight,
  CreditCard,
  Smartphone,
  TrendingUp,
} from 'lucide-react-native';
import { ContactlessCardIcon } from './icons/ContactlessCardIcon';
import { Palette, Typography } from '../theme/tokens';
import { Wallet, Pocket } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AccountCardItemProps {
  wallet: Wallet;
  pockets?: Pocket[];
  totalLiquidity?: number;
  privacyMode: boolean;
  onPress: (w: Wallet) => void;
  variant?: 'horizontal' | 'full';
}

export const AccountCardItem: React.FC<AccountCardItemProps> = ({
  wallet: w,
  privacyMode,
  onPress,
  variant = 'full',
}) => {
  if (variant === 'horizontal') {
    return (
      <TouchableOpacity
        style={styles.cardHorizontal}
        onPress={() => onPress(w)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={[styles.colorBadge, { backgroundColor: w.color }]} />
          <Text style={styles.typeLabel}>
            {w.currency} • {w.type.toUpperCase()}
          </Text>
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.cardName} numberOfLines={1}>
            {w.name}
          </Text>
          <Text style={styles.cardNumber} numberOfLines={1}>
            {w.accountNumber || 'Local Vault'}
          </Text>
        </View>

        <Text style={styles.cardBalance} numberOfLines={1} adjustsFontSizeToFit>
          {formatCurrency(w.balance, w.currency, privacyMode)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.cardFull}
      onPress={() => onPress(w)}
      activeOpacity={0.85}
    >
      <View style={styles.fullTopRow}>
        <View style={styles.fullLeft}>
          <View style={[styles.largeIconBox, { backgroundColor: w.color }]}>
            {(() => {
              const t = (w.type || '').toLowerCase();
              if (t === 'cash') return <Banknote size={20} color={Palette.white} />;
              if (t === 'e-wallet' || t === 'ewallet') return <Smartphone size={20} color={Palette.white} />;
              if (t === 'credit card') return <CreditCard size={20} color={Palette.white} />;
              if (t === 'investment') return <TrendingUp size={20} color={Palette.white} />;
              if (t === 'e-money') return <ContactlessCardIcon size={20} color={Palette.white} />;
              return <Building2 size={20} color={Palette.white} />;
            })()}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fullTitle}>{w.name}</Text>
            <Text style={styles.fullMeta}>
              {w.currency} • {w.type.toUpperCase()}
              {w.accountNumber ? ` • ${w.accountNumber}` : ''}
            </Text>
          </View>
        </View>
        <ChevronRight size={18} color={Palette.muted} />
      </View>

      <View style={styles.fullBottomRow}>
        <Text style={styles.balanceCaption}>Total Balance</Text>
        <Text style={styles.fullBalance}>
          {formatCurrency(w.balance, w.currency, privacyMode)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardHorizontal: {
    width: 172,
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.muted,
  },
  nameBlock: {
    marginVertical: 8,
  },
  cardName: {
    ...Typography.body,
    fontWeight: '600',
    color: Palette.ink,
    fontSize: 14,
  },
  cardNumber: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 2,
  },
  cardBalance: {
    ...Typography.mono,
    fontSize: 15,
    fontWeight: '600',
    color: Palette.ink,
  },

  // Full Variant
  cardFull: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  fullTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  fullLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  largeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fullTitle: {
    ...Typography.subheading,
    fontSize: 16,
    color: Palette.ink,
  },
  fullMeta: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    marginTop: 2,
  },
  fullBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  balanceCaption: {
    ...Typography.caption,
    fontSize: 12,
    color: Palette.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullBalance: {
    ...Typography.mono,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
  },
});
