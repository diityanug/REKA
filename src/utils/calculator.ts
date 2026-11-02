import { CurrencyType } from '../services/database';

/**
 * Pure, safe mathematical expression evaluator (no eval)
 * Supports +, -, ×, ÷ with proper operator precedence (BODMAS: ×/÷ evaluated before +/-)
 */
export function evaluateMathExpression(expr: string, currency?: CurrencyType): number {
  if (!expr) return 0;
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '');
  const tokens = clean.match(/(\d+(?:\.\d+)?|[+\-*\/])/g);
  if (!tokens || tokens.length === 0) return 0;

  // Drop dangling trailing operator(s) if present (e.g. "1 + 2 +" -> "1 + 2")
  while (tokens.length > 0 && ['+', '-', '*', '/'].includes(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  if (tokens.length === 0) return 0;

  // Handle leading negative number (e.g. ["-", "5", "+", "10"] -> ["-5", "+", "10"])
  if (tokens[0] === '-' && tokens.length > 1) {
    tokens.shift();
    tokens[0] = '-' + tokens[0];
  }

  // Pass 1: Multiplication and Division (* and /)
  const pass1: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '*' || token === '/') {
      const prevVal = parseFloat(pass1.pop() || '0');
      const nextVal = parseFloat(tokens[++i] || '0');
      if (isNaN(nextVal)) {
        pass1.push(prevVal.toString());
        break;
      }
      const res = token === '*' ? prevVal * nextVal : (nextVal !== 0 ? prevVal / nextVal : prevVal);
      pass1.push(res.toString());
    } else {
      pass1.push(token);
    }
  }

  // Pass 2: Addition and Subtraction (+ and -)
  let result = parseFloat(pass1[0] || '0');
  if (isNaN(result)) return 0;

  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i];
    const val = parseFloat(pass1[i + 1] || '0');
    if (isNaN(val)) break;

    if (op === '+') result += val;
    else if (op === '-') result -= val;
  }

  if (isNaN(result) || !isFinite(result)) return 0;
  const maxCap = currency === 'USD' ? 999999999.99 : 9999999999999;
  const clamped = Math.min(Math.max(result, -maxCap), maxCap);
  if (currency === 'IDR') {
    return Math.round(clamped);
  }
  return Math.round(clamped * 100) / 100;
}

/**
 * Returns true if the expression contains at least one binary math operator (+, -, ×, ÷).
 */
export function hasMathOperator(expr: string): boolean {
  if (!expr) return false;
  const withoutLeadingMinus = expr.trimStart().replace(/^-/, '');
  return /[+\-×÷*/]/.test(withoutLeadingMinus);
}

/**
 * Normalizes expression spacing while preserving the trailing space after a trailing operator
 * (e.g. "50000 + " stays "50000 + ", and "50000 +2" becomes "50000 + 2").
 */
export function normalizeExpressionSpacing(raw: string): string {
  const trimmedStart = (raw || '').replace(/^\s+/, '');
  if (!trimmedStart) return '0';

  const normalized = trimmedStart
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    // Ensure binary operators always have single spaces around them
    .replace(/(\d|\.)\s*([+\-×÷])\s*/g, '$1 $2 ');

  // Strip accidental leading operator if first operand was deleted
  const cleanedLeading = normalized.replace(/^[+×÷]\s*/, '').replace(/^-\s+/, '');
  if (!cleanedLeading) return '0';

  if (/\s[+\-×÷]\s+$/.test(cleanedLeading)) {
    return cleanedLeading.replace(/\s+$/, ' ');
  }
  if (/\s[+\-×÷]$/.test(cleanedLeading)) {
    return cleanedLeading + ' ';
  }
  return cleanedLeading.trimEnd() || '0';
}

/**
 * Sanitizes an input expression for the target currency:
 * In IDR: decimals do not exist, so all decimal parts (e.g. .90) are discarded from numbers.
 */
export function sanitizeExpressionForCurrency(expr: string, currency: CurrencyType): string {
  if (!expr || expr === '0') return '0';
  const normalized = normalizeExpressionSpacing(expr);
  if (currency === 'IDR') {
    const parts = normalized.split(' ');
    const sanitized = parts
      .map((part) => {
        if (['+', '-', '×', '÷', '*', '/'].includes(part)) return part;
        if (!part) return '';
        const isNeg = part.startsWith('-');
        const absPart = isNeg ? part.slice(1) : part;
        const intOnly = absPart.split('.')[0] || '0';
        return (isNeg ? '-' : '') + intOnly;
      })
      .join(' ');
    return sanitized || '0';
  }
  return normalized;
}

/**
 * Format expression numbers with currency-appropriate thousand separators
 */
export function formatExpressionDisplay(expr: string, currency: CurrencyType): string {
  if (!expr || expr === '0') return '0';
  const normalized = normalizeExpressionSpacing(expr);
  const parts = normalized.split(' ');

  return parts
    .map((part) => {
      if (['+', '-', '×', '÷', '*', '/'].includes(part)) {
        return part === '*' ? '×' : part === '/' ? '÷' : part;
      }
      if (!part) return '';

      if (currency === 'IDR') {
        const isNeg = part.startsWith('-');
        const absStr = isNeg ? part.slice(1) : part;
        // In IDR, decimal parts do not exist - discard any decimal portion completely
        const intPart = absStr.split('.')[0] || '0';
        const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (isNeg ? '-' : '') + intFormatted;
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
  rawCursor: number,
  maxDigits: number = currency === 'IDR' ? 13 : 9
): { nextExpr: string; nextRawCursor: number } {
  let expr = normalizeExpressionSpacing(currentExpr || '0');
  if (currency === 'IDR' && expr.includes('.')) {
    expr = sanitizeExpressionForCurrency(expr, 'IDR');
  }
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
    // Check if deleting a math operator padded with spaces e.g. " + " or " +"
    const before3 = expr.slice(Math.max(0, validCursor - 3), validCursor);
    const before2 = expr.slice(Math.max(0, validCursor - 2), validCursor);
    let deleteCount = 1;
    let rightStart = validCursor;
    if ([' + ', ' - ', ' × ', ' ÷ '].includes(before3)) {
      deleteCount = 3;
    } else if ([' +', ' -', ' ×', ' ÷'].includes(before2)) {
      deleteCount = 2;
      if (expr[validCursor] === ' ') {
        rightStart = validCursor + 1;
      }
    }
    const left = expr.slice(0, validCursor - deleteCount);
    const right = expr.slice(rightStart);
    const rawCombined = left + right;
    const nextExpr = normalizeExpressionSpacing(rawCombined);
    const nextRawCursor =
      nextExpr === '0' && !rawCombined.trim()
        ? 1
        : Math.min(Math.max(0, validCursor - deleteCount), nextExpr.length);
    return { nextExpr, nextRawCursor };
  }

  // Equal / Evaluate
  if (key === '=') {
    const evaluated = Math.max(0, evaluateMathExpression(expr, currency));
    const nextExpr = evaluated.toString();
    return { nextExpr, nextRawCursor: nextExpr.length };
  }

  // Math Operators (+, -, ×, ÷)
  if (['+', '-', '×', '÷'].includes(key)) {
    if (expr === '0') {
      return { nextExpr: expr, nextRawCursor: validCursor };
    }
    const left = expr.slice(0, validCursor);
    const right = expr.slice(validCursor);
    if (!left.trim()) {
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
    if (
      left.endsWith(' +') ||
      left.endsWith(' -') ||
      left.endsWith(' ×') ||
      left.endsWith(' ÷')
    ) {
      const replacedLeft = left.slice(0, -2) + ' ' + key + ' ';
      const cleanRight = right.startsWith(' ') ? right.slice(1) : right;
      return {
        nextExpr: replacedLeft + cleanRight,
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
    const rawLeft = expr.slice(0, validCursor);
    const left = /\s[+\-×÷]$/.test(rawLeft) ? rawLeft + ' ' : rawLeft;
    const right = expr.slice(validCursor);
    const leftPart = left.split(/ [+\-×÷] /).pop() || '';
    const rightPart = right.split(/ [+\-×÷] /)[0] || '';
    if ((leftPart + rightPart).includes('.')) {
      return { nextExpr: expr, nextRawCursor: validCursor };
    }
    if (!leftPart || leftPart === '0') {
      const nextLeft = (left === '0' ? '' : left.endsWith('0') ? left.slice(0, -1) : left) + '0.';
      return { nextExpr: nextLeft + right, nextRawCursor: nextLeft.length };
    }
    return { nextExpr: left + '.' + right, nextRawCursor: left.length + 1 };
  }

  // Thousand Shortcut (IDR only, maxDigits limit)
  if (key === '000') {
    if (expr === '0' || currency !== 'IDR') return { nextExpr: expr, nextRawCursor: validCursor };
    const rawLeft = expr.slice(0, validCursor);
    const left = /\s[+\-×÷]$/.test(rawLeft) ? rawLeft + ' ' : rawLeft;
    const right = expr.slice(validCursor);
    const leftPart = left.split(/ [+\-×÷] /).pop() || '';
    const rightPart = right.split(/ [+\-×÷] /)[0] || '';
    if (!leftPart || leftPart === '0') {
      return { nextExpr: expr, nextRawCursor: validCursor };
    }
    const totalDigits = (leftPart + rightPart).replace(/\D/g, '').length;
    if (totalDigits >= maxDigits) return { nextExpr: expr, nextRawCursor: validCursor };
    const allowed = Math.min(3, maxDigits - totalDigits);
    if (allowed <= 0) return { nextExpr: expr, nextRawCursor: validCursor };
    const zeros = '0'.repeat(allowed);
    return {
      nextExpr: left + zeros + right,
      nextRawCursor: left.length + allowed,
    };
  }

  // Digits (0 - 9)
  if (/^[0-9]$/.test(key)) {
    if (expr === '0') {
      return { nextExpr: key, nextRawCursor: 1 };
    }
    const rawLeft = expr.slice(0, validCursor);
    const left = /\s[+\-×÷]$/.test(rawLeft) ? rawLeft + ' ' : rawLeft;
    const right = expr.slice(validCursor);
    const leftPart = left.split(/ [+\-×÷] /).pop() || '';
    const rightPart = right.split(/ [+\-×÷] /)[0] || '';

    // Prevent leading "00" or "05" on a new operand after an operator
    if (leftPart === '0' && rightPart === '') {
      if (key === '0') {
        return { nextExpr: expr, nextRawCursor: validCursor };
      }
      const replacedLeft = left.slice(0, -1) + key;
      return {
        nextExpr: replacedLeft + right,
        nextRawCursor: replacedLeft.length,
      };
    }

    if ((leftPart + rightPart).includes('.')) {
      const decPart = (leftPart + rightPart).split('.')[1] || '';
      if (decPart.length >= 2) return { nextExpr: expr, nextRawCursor: validCursor };
    } else {
      const intDigits = (leftPart + rightPart).replace(/\D/g, '').length;
      if (intDigits >= maxDigits) return { nextExpr: expr, nextRawCursor: validCursor };
    }
    return {
      nextExpr: left + key + right,
      nextRawCursor: left.length + 1,
    };
  }

  return { nextExpr: expr, nextRawCursor: validCursor };
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
