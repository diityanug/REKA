import { CurrencyType } from '../services/database';

/**
 * Pure, safe mathematical expression evaluator (no eval)
 * Supports +, -, ×, ÷ with chronological left-to-right evaluation
 */
export function evaluateMathExpression(expr: string): number {
  if (!expr) return 0;
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '');
  const tokens = clean.match(/(\d+(?:\.\d+)?|[+\-*\/])/g);
  if (!tokens || tokens.length === 0) return 0;

  // Drop dangling trailing operator if present
  if (['+', '-', '*', '/'].includes(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (tokens.length === 0) return 0;

  let result = parseFloat(tokens[0]);
  if (isNaN(result)) return 0;

  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const val = parseFloat(tokens[i + 1]);
    if (isNaN(val)) break;

    if (op === '+') result += val;
    else if (op === '-') result -= val;
    else if (op === '*') result *= val;
    else if (op === '/') result = val !== 0 ? result / val : result;
  }

  return isNaN(result) ? 0 : Math.round(result * 100) / 100;
}

/**
 * Format expression numbers with currency-appropriate thousand separators
 */
export function formatExpressionDisplay(expr: string, currency: CurrencyType): string {
  if (!expr || expr === '0') return '0';
  const parts = expr.split(' ');

  return parts
    .map((part) => {
      if (['+', '-', '×', '÷', '*', '/'].includes(part)) {
        return part === '*' ? '×' : part === '/' ? '÷' : part;
      }
      if (!part) return '';

      if (currency === 'IDR') {
        const isNeg = part.startsWith('-');
        const absStr = isNeg ? part.slice(1) : part;
        const sub = absStr.split('.');
        const intFormatted = sub[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (isNeg ? '-' : '') + intFormatted + (sub.length > 1 ? '.' + sub[1] : '');
      } else {
        const sub = part.split('.');
        sub[0] = sub[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return sub.join('.');
      }
    })
    .join(' ');
}

/**
 * Maps a formatted expression cursor position (0..formatted.length)
 * to raw expression character index (0..raw.length).
 */
export function formattedToRawCursor(
  formatted: string,
  raw: string,
  formattedCursor: number,
  currency: CurrencyType
): number {
  if (formattedCursor <= 0) return 0;
  if (formattedCursor >= formatted.length) return raw.length;

  const sep = currency === 'IDR' ? '.' : ',';
  let rawCount = 0;
  for (let i = 0; i < formattedCursor; i++) {
    if (formatted[i] === sep) continue;
    rawCount++;
  }
  return Math.min(rawCount, raw.length);
}

/**
 * Maps a raw character index (0..raw.length)
 * to formatted expression cursor position (0..formatted.length).
 */
export function rawToFormattedCursor(
  formatted: string,
  raw: string,
  rawCursor: number,
  currency: CurrencyType
): number {
  if (rawCursor <= 0) return 0;
  if (rawCursor >= raw.length) return formatted.length;

  const sep = currency === 'IDR' ? '.' : ',';
  let countedRaw = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] === sep) continue;
    countedRaw++;
    if (countedRaw === rawCursor) {
      return i + 1;
    }
  }
  return formatted.length;
}

/**
 * Compute the next expression state when a keypad button is pressed at a specific raw cursor position.
 */
export function calculateNextExpressionWithCursor(
  currentExpr: string,
  key: string,
  currency: CurrencyType,
  rawCursor: number
): { nextExpr: string; nextRawCursor: number } {
  let expr = (currentExpr || '0').trim();
  const validCursor = Math.max(0, Math.min(rawCursor, expr.length));

  // Clear all
  if (key === 'C') {
    return { nextExpr: '0', nextRawCursor: 1 };
  }

  // Backspace (⌫)
  if (key === '⌫') {
    if (validCursor <= 0) {
      return { nextExpr: expr, nextRawCursor: 0 };
    }
    // Check if deleting a math operator padded with spaces e.g. " + "
    const before3 = expr.slice(Math.max(0, validCursor - 3), validCursor);
    let deleteCount = 1;
    if ([' + ', ' - ', ' × ', ' ÷ '].includes(before3)) {
      deleteCount = 3;
    }
    const left = expr.slice(0, validCursor - deleteCount);
    const right = expr.slice(validCursor);
    const combined = (left + right).trim();
    const nextExpr = combined || '0';
    const nextRawCursor = combined ? Math.max(0, validCursor - deleteCount) : 1;
    return { nextExpr, nextRawCursor };
  }

  // Equal / Evaluate
  if (key === '=') {
    const evaluated = evaluateMathExpression(expr);
    const nextExpr = evaluated.toString();
    return { nextExpr, nextRawCursor: nextExpr.length };
  }

  // Math Operators (+, -, ×, ÷)
  if (['+', '-', '×', '÷'].includes(key)) {
    const left = expr.slice(0, validCursor);
    const right = expr.slice(validCursor);
    if (!left && key !== '-') {
      return { nextExpr: expr, nextRawCursor: validCursor };
    }
    if (
      left.endsWith(' + ') ||
      left.endsWith(' - ') ||
      left.endsWith(' × ') ||
      left.endsWith(' ÷ ')
    ) {
      const replacedLeft = left.slice(0, -3) + ' ' + key + ' ';
      return {
        nextExpr: replacedLeft + right,
        nextRawCursor: replacedLeft.length,
      };
    }
    const insertedLeft = left + ' ' + key + ' ';
    return {
      nextExpr: insertedLeft + right,
      nextRawCursor: insertedLeft.length,
    };
  }

  // Decimal Point (USD only, max 2 decimals)
  if (key === '.') {
    if (currency === 'IDR') return { nextExpr: expr, nextRawCursor: validCursor };
    const left = expr.slice(0, validCursor);
    const right = expr.slice(validCursor);
    const leftPart = left.split(/ [+\-×÷] /).pop() || '';
    const rightPart = right.split(/ [+\-×÷] /)[0] || '';
    if ((leftPart + rightPart).includes('.')) {
      return { nextExpr: expr, nextRawCursor: validCursor };
    }
    if (!leftPart || leftPart === '0') {
      const nextLeft = (left === '0' ? '' : left) + '0.';
      return { nextExpr: nextLeft + right, nextRawCursor: nextLeft.length };
    }
    return { nextExpr: left + '.' + right, nextRawCursor: validCursor + 1 };
  }

  // Thousand Shortcut (IDR only, max 13 digits)
  if (key === '000') {
    if (expr === '0' || currency !== 'IDR') return { nextExpr: expr, nextRawCursor: validCursor };
    const left = expr.slice(0, validCursor);
    const right = expr.slice(validCursor);
    const leftPart = left.split(/ [+\-×÷] /).pop() || '';
    const rightPart = right.split(/ [+\-×÷] /)[0] || '';
    const totalDigits = (leftPart + rightPart).replace(/\D/g, '').length;
    if (totalDigits >= 13) return { nextExpr: expr, nextRawCursor: validCursor };
    const allowed = Math.min(3, 13 - totalDigits);
    if (allowed <= 0) return { nextExpr: expr, nextRawCursor: validCursor };
    const zeros = '0'.repeat(allowed);
    return {
      nextExpr: left + zeros + right,
      nextRawCursor: validCursor + allowed,
    };
  }

  // Digits (0 - 9)
  if (/^[0-9]$/.test(key)) {
    if (expr === '0') {
      return { nextExpr: key, nextRawCursor: 1 };
    }
    const left = expr.slice(0, validCursor);
    const right = expr.slice(validCursor);
    const leftPart = left.split(/ [+\-×÷] /).pop() || '';
    const rightPart = right.split(/ [+\-×÷] /)[0] || '';
    if ((leftPart + rightPart).includes('.')) {
      const decPart = (leftPart + rightPart).split('.')[1] || '';
      if (decPart.length >= 2) return { nextExpr: expr, nextRawCursor: validCursor };
    } else {
      const intDigits = (leftPart + rightPart).replace(/\D/g, '').length;
      if (intDigits >= 13) return { nextExpr: expr, nextRawCursor: validCursor };
    }
    return {
      nextExpr: left + key + right,
      nextRawCursor: validCursor + 1,
    };
  }

  return { nextExpr: expr, nextRawCursor: validCursor };
}

/**
 * Compute the next expression state when a keypad button is pressed (defaulting to end of string)
 */
export function calculateNextExpression(
  currentExpr: string,
  key: string,
  currency: CurrencyType
): string {
  return calculateNextExpressionWithCursor(
    currentExpr,
    key,
    currency,
    (currentExpr || '').length
  ).nextExpr;
}

/**
 * Quick increment presets tailored to active currency
 */
export function getQuickPresets(
  currency: CurrencyType
): { label: string; amount: number }[] {
  if (currency === 'IDR') {
    return [
      { label: '+10k', amount: 10000 },
      { label: '+50k', amount: 50000 },
      { label: '+100k', amount: 100000 },
      { label: '+500k', amount: 500000 },
    ];
  }
  return [
    { label: '+$5', amount: 5 },
    { label: '+$10', amount: 10 },
    { label: '+$25', amount: 25 },
    { label: '+$50', amount: 50 },
  ];
}
