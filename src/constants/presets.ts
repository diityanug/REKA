export const ACCOUNT_TYPES = [
  'Bank',
  'E-Wallet',
  'Cash',
  'Investment',
  'Credit Card',
  'E-Money',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Bills & Utilities',
  'Subscriptions',
  'Housing / Rent',
  'Internet & Phone',
  'Insurance',
  'Fitness & Gym',
  'Cloud & Storage',
  'Food & Beverages',
  'Snacks',
  'Shopping',
  'Fuel',
  'Parking',
  'Vehicle Services',
  'Public Services',
  'Personal',
  'Home Services',
  'Furnisings',
  'Social',
  'Health & Medical',
  'Education',
  'Travel',
  'Others',
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  'Salary',
  'Allowance',
  'Interest',
  'Investments',
  'Bonus',
  'Gift',
  'Others',
] as const;

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

export const CHART_PALETTE = [
  '#CC785C',
  '#5DB8A6',
  '#E8A55A',
  '#4A6FA5',
  '#9B51E0',
  '#252523',
  '#C64545',
];
