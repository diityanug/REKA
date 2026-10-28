import { CurrencyType } from '../services/database';
import { evaluateMathExpression } from './calculator';

/**
 * Universal Currency & Numerical Formatter for AES
 * Caches Intl.NumberFormat instances to prevent wasteful object allocations on every render.
 */
const usdNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCurrency = (
  amount: number,
  currency: CurrencyType = 'IDR',
  isMasked: boolean = false
): string => {
  if (isMasked) return '••••••';
  const val = amount || 0;
  const isNegative = val < 0;
  const absVal = Math.abs(val);

  if (currency === 'IDR') {
    const formattedNumber = Math.round(absVal)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${isNegative ? '- ' : ''}Rp ${formattedNumber}`;
  }

  const parts = absVal.toFixed(2).split('.');
  const intFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const dec = parts[1] === '00' ? '' : `.${parts[1]}`;
  return `${isNegative ? '- ' : ''}$ ${intFormatted}${dec}`;
};

export const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp;
  const day = date.getDate();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const formatMonthYear = (timestampOrKey: string): string => {
  if (timestampOrKey.length === 7 && timestampOrKey.includes('-')) {
    const [year, monthStr] = timestampOrKey.split('-');
    const mIdx = parseInt(monthStr, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${MONTH_NAMES[mIdx]} ${year}`;
    }
  }
  const date = new Date(timestampOrKey);
  if (isNaN(date.getTime())) return timestampOrKey;
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatMonthShort = (monthKey: string): string => {
  if (monthKey.length === 7 && monthKey.includes('-')) {
    const [year, monthStr] = monthKey.split('-');
    const mIdx = parseInt(monthStr, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${MONTH_SHORT[mIdx]} '${year.slice(2)}`;
    }
  }
  return monthKey;
};

/**
 * Step one calendar month backward ('YYYY-MM' -> previous 'YYYY-MM')
 */
export const getPrevMonthKey = (currentKey?: string): string => {
  let y: number;
  let m: number;

  if (!currentKey || currentKey === 'all' || !currentKey.includes('-')) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1; // 1-12
  } else {
    const parts = currentKey.split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m)) {
      const now = new Date();
      y = now.getFullYear();
      m = now.getMonth() + 1;
    }
  }

  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }

  return `${y}-${String(m).padStart(2, '0')}`;
};

/**
 * Step one calendar month forward ('YYYY-MM' -> next 'YYYY-MM')
 */
export const getNextMonthKey = (currentKey?: string): string => {
  let y: number;
  let m: number;

  if (!currentKey || currentKey === 'all' || !currentKey.includes('-')) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1;
  } else {
    const parts = currentKey.split('-');
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m)) {
      const now = new Date();
      y = now.getFullYear();
      m = now.getMonth() + 1;
    }
  }

  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }

  return `${y}-${String(m).padStart(2, '0')}`;
};

export const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp;
  const day = date.getDate();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const month = months[date.getMonth()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${date.getFullYear()}, ${hours}:${minutes}`;
};

// Format user-typed input live with currency rules and configurable digit cap (default 13)
export const formatCurrencyInput = (
  raw: string,
  currency: CurrencyType = 'IDR',
  maxDigits: number = 13
): string => {
  if (!raw) return '';

  if (currency === 'IDR') {
    // Only digits, capped strictly at maxDigits
    const digits = raw.replace(/\D/g, '').slice(0, maxDigits);
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // USD: allow single dot, up to 2 decimal places, maxDigits integer digits max
  const hasDot = raw.includes('.');
  const parts = raw.replace(/,/g, '').split('.');
  const intRaw = parts[0].replace(/\D/g, '').slice(0, maxDigits);
  const intFormatted = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (!hasDot) {
    return intFormatted;
  }

  const decRaw = parts.slice(1).join('').replace(/\D/g, '').slice(0, 2);
  return `${intFormatted || '0'}.${decRaw}`;
};

// Parse user-typed amount ("5.000.000", "1,250.50", "15000 + 25000") into a number
export const parseAmount = (value: string, currency: CurrencyType = 'IDR'): number => {
  if (!value) return 0;
  const str = String(value).trim();
  if (
    str.includes('+') ||
    str.includes('-') ||
    str.includes('×') ||
    str.includes('÷') ||
    str.includes('*') ||
    str.includes('/')
  ) {
    return evaluateMathExpression(str);
  }
  const cleaned =
    currency === 'IDR'
      ? str.replace(/,\d{1,2}$/, '').replace(/\./g, '').replace(/[^0-9]/g, '')
      : str.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

// Get today's local date string formatted as YYYY-MM-DD
export const getTodayDateStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
