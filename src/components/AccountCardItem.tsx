import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Building2,
  Banknote,
  ChevronRight,
  CreditCard,
  Smartphone,
  TrendingUp,
} from 'lucide-react-native';
import { ContactlessCardIcon } from './icons/ContactlessCardIcon';
import { ScalePressable } from './MotionPrimitives';
import { Palette, Typography } from '../theme/tokens';
import { Wallet } from '../types';
import { formatCurrency } from '../utils/formatters';

interface AccountCardItemProps {
  wallet: Wallet;
  privacyMode: boolean;
  onPress: (w: Wallet) => void;
  variant?: 'horizontal' | 'full';
}

function renderWalletIcon(rawType: string | undefined, size: number, color: string) {
  const t = (rawType || '').toLowerCase();
  if (t === 'cash') return <Banknote size={size} color={color} />;
  if (t === 'e-wallet' || t === 'ewallet') return <Smartphone size={size} color={color} />;
  if (t === 'credit card') return <CreditCard size={size} color={color} />;
  if (t === 'investment') return <TrendingUp size={size} color={color} />;
  if (t === 'e-money' || t === 'emoney') return <ContactlessCardIcon size={size} color={color} />;
  return <Building2 size={size} color={color} />;
}

export const AccountCardItem = React.memo<AccountCardItemProps>(({
  wallet: w,
  privacyMode,
  onPress,
  variant = 'full',
}) => {
  const displayName = w.name?.trim() || (w.type ? `${w.type} Account` : 'Account');

  if (variant === 'horizontal') {
    return (
      <ScalePressable
        style={styles.cardHorizontalOuter}
        contentStyle={styles.cardHorizontal}
        scaleTo={0.965}
        activeOpacity={0.94}
        onPress={() => onPress(w)}
      >
        {/* Symmetrical Top Row: Colored Icon + Type (left) | Currency Pill (right) */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.smallIconBox, { backgroundColor: w.color }]}>
              {renderWalletIcon(w.type, 13, Palette.white)}
            </View>
            <Text style={styles.typeLabel} numberOfLines={1}>
              {w.type}
            </Text>
          </View>
          <View style={styles.currencyPill}>
            <Text style={styles.currencyPillText}>{w.currency}</Text>
          </View>
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.cardName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.cardNumber} numberOfLines={1}>
            {w.accountNumber || 'Local Vault'}
          </Text>
        </View>

        <Text
          style={styles.cardBalance}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.76}
        >
          {formatCurrency(w.balance, w.currency, privacyMode)}
        </Text>
      </ScalePressable>
    );
  }

  return (
    <ScalePressable
      style={styles.cardFullOuter}
      contentStyle={styles.cardFull}
      scaleTo={0.975}
      activeOpacity={0.94}
      onPress={() => onPress(w)}
    >
      {/* Symmetrical Header: Icon + Name/Sub (left) | Currency Pill + Chevron (right) */}
      <View style={styles.fullTopRow}>
        <View style={styles.fullLeft}>
          <View style={[styles.largeIconBox, { backgroundColor: w.color }]}>
            {renderWalletIcon(w.type, 20, Palette.white)}
          </View>
          <View style={styles.fullTextCol}>
            <Text style={styles.fullTitle} numberOfLines={1} ellipsizeMode="tail">
              {displayName}
            </Text>
            <View style={styles.fullSubRow}>
              <Text style={styles.fullSubType} numberOfLines={1}>
                {w.type}
              </Text>
              {w.accountNumber ? (
                <>
                  <Text style={styles.fullSubDot}>·</Text>
                  <Text style={styles.fullSubNumber} numberOfLines={1}>
                    {w.accountNumber}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.fullRight}>
          <View style={styles.currencyPill}>
            <Text style={styles.currencyPillText}>{w.currency}</Text>
          </View>
          <ChevronRight size={16} color={Palette.mutedSoft} />
        </View>
      </View>

      <View style={styles.fullBottomRow}>
        <Text style={styles.balanceCaption}>Total Balance</Text>
        <Text
          style={styles.fullBalance}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {formatCurrency(w.balance, w.currency, privacyMode)}
        </Text>
      </View>
    </ScalePressable>
  );
});

AccountCardItem.displayName = 'AccountCardItem';

const styles = StyleSheet.create({
  // Horizontal Card (Overview)
  cardHorizontalOuter: {
    marginRight: 10,
  },
  cardHorizontal: {
    width: 184,
    height: 136,
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  smallIconBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typeLabel: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Palette.muted,
    flexShrink: 1,
  },
  currencyPill: {
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: Palette.surfaceSoft,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  currencyPillText: {
    ...Typography.code,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    color: Palette.bodyStrong,
    includeFontPadding: false,
  },
  nameBlock: {
    marginVertical: 6,
  },
  cardName: {
    ...Typography.body,
    fontWeight: '600',
    color: Palette.ink,
    fontSize: 14,
    lineHeight: 18,
  },
  cardNumber: {
    ...Typography.code,
    fontSize: 10.5,
    color: Palette.mutedSoft,
    marginTop: 2,
  },
  cardBalance: {
    ...Typography.mono,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },

  // Full Card (Accounts Tab)
  cardFullOuter: {
    marginBottom: 10,
  },
  cardFull: {
    backgroundColor: Palette.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  fullTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 13,
  },
  fullLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  largeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  fullTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  fullTitle: {
    ...Typography.subheading,
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '600',
    color: Palette.ink,
  },
  fullSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  fullSubType: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
    color: Palette.muted,
    flexShrink: 0,
  },
  fullSubDot: {
    fontSize: 12,
    lineHeight: 15,
    color: Palette.mutedSoft,
    flexShrink: 0,
  },
  fullSubNumber: {
    ...Typography.code,
    fontSize: 11,
    lineHeight: 15,
    color: Palette.mutedSoft,
    flex: 1,
    minWidth: 0,
  },
  fullRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  fullBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.hairline,
  },
  balanceCaption: {
    ...Typography.label,
    fontSize: 10.5,
    color: Palette.muted,
    flexShrink: 0,
  },
  fullBalance: {
    ...Typography.mono,
    fontSize: 17,
    fontWeight: '700',
    color: Palette.ink,
    flex: 1,
    textAlign: 'right',
  },
});
