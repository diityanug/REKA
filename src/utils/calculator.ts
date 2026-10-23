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
 * Compute the next expression state when a keypad button is pressed
 */
export function calculateNextExpression(
  currentExpr: string,
  key: string,
  currency: CurrencyType
): string {
  let expr = (currentExpr || '0').trim();

  // Clear all
  if (key === 'C') {
    return '0';
  }

  // Backspace
  if (key === '⌫') {
    if (
      expr.endsWith(' + ') ||
      expr.endsWith(' - ') ||
      expr.endsWith(' × ') ||
      expr.endsWith(' ÷ ')
    ) {
      return expr.slice(0, -3) || '0';
    }
    const next = expr.slice(0, -1);
    return next.trim() || '0';
  }

  // Equal / Evaluate
  if (key === '=') {
    const evaluated = evaluateMathExpression(expr);
    return evaluated.toString();
  }

  // Math Operators (+, -, ×, ÷)
  if (['+', '-', '×', '÷'].includes(key)) {
    if (
      expr.endsWith(' + ') ||
      expr.endsWith(' - ') ||
      expr.endsWith(' × ') ||
      expr.endsWith(' ÷ ')
    ) {
      return expr.slice(0, -3) + ' ' + key + ' ';
    }
    return expr + ' ' + key + ' ';
  }

  // Decimal Point (USD only, max 2 decimals)
  if (key === '.') {
    if (currency === 'IDR') return expr;
    const parts = expr.split(/ [+\-×÷] /);
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('.')) return expr;
    if (!lastPart || lastPart === '0') return expr === '0' ? '0.' : expr + '0.';
    return expr + '.';
  }

  // Thousand Shortcut (IDR only, max 13 digits)
  if (key === '000') {
    if (expr === '0' || expr.endsWith(' ') || currency !== 'IDR') return expr;
    const parts = expr.split(/ [+\-×÷] /);
    const lastPart = parts[parts.length - 1];
    const intPart = lastPart.replace(/\D/g, '');
    if (intPart.length >= 13) return expr;
    const allowed = Math.min(3, 13 - intPart.length);
    if (allowed <= 0) return expr;
    return expr + '0'.repeat(allowed);
  }

  // Digits (0 - 9, strictly capped at 13 integer digits, max 2 decimals for USD)
  if (/^[0-9]$/.test(key)) {
    const parts = expr.split(/ [+\-×÷] /);
    const lastPart = parts[parts.length - 1];
    if (lastPart.includes('.')) {
      const decPart = lastPart.split('.')[1] || '';
      if (decPart.length >= 2) return expr;
    } else {
      const intPart = lastPart.replace(/\D/g, '');
      if (intPart.length >= 13) return expr;
    }
    if (expr === '0') return key;
    return expr + key;
  }

  return expr;
}

/**
 * Quick increment presets tailored to active currency
 */
export function getQuickPresets(
  currency: CurrencyType
): Array<{ label: string; amount: number }> {
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
