export const ACCOUNT_TYPES = [
  'Bank',
  'E-Wallet',
  'Cash',
  'Investment',
  'Credit Card',
  'E-Money',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_PRESETS = [
  'BCA',
  'Mandiri',
  'Cash Wallet',
  'GoPay',
  'Credit Card',
  'Flazz / E-Toll',
  'USD Vault',
];

export const POCKET_PRESETS = [
  'Emergency Fund',
  'Savings Goal',
  'Daily Budget',
  'Travel',
  'Tax Reserve',
];

export const PAYMENT_METHODS = [
  'QRIS',
  'Bank Transfer',
  'Debit Card',
  'Cash',
  'E-Wallet',
  'Credit Card',
];
