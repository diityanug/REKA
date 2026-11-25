import React from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type MciGlyphName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function resolvePaymentGlyph(method?: string): MciGlyphName {
  const m = (method || '').trim().toLowerCase();
  if (m.includes('qris') || m.includes('qr')) return 'qrcode-scan';
  if (m.includes('virtual') || m === 'va') return 'receipt-text-outline';
  if (m.includes('transfer')) return 'bank-transfer';
  if (m.includes('credit')) return 'credit-card-chip-outline';
  if (m.includes('debit')) return 'credit-card-outline';
  if (m.includes('wallet') || m.includes('gopay') || m.includes('ovo') || m.includes('dana')) {
    return 'wallet-outline';
  }
  if (m.includes('cash') || m.includes('tunai')) return 'cash-multiple';
  if (m.includes('e-money') || m.includes('emoney') || m.includes('flazz') || m.includes('toll')) {
    return 'contactless-payment';
  }
  return 'credit-card-outline';
}

interface PaymentMethodIconProps {
  method?: string;
  size?: number;
  color?: string;
}

export const PaymentMethodIcon: React.FC<PaymentMethodIconProps> = ({
  method,
  size = 16,
  color = '#141413',
}) => {
  return (
    <MaterialCommunityIcons
      name={resolvePaymentGlyph(method)}
      size={size}
      color={color}
    />
  );
};
