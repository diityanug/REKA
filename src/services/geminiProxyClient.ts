/**
 * Shared client transport and normalization helpers for REKA's Gemini AI scanners.
 * Keeps `EXPO_PUBLIC_*` environment lookups static so Metro/Expo can inline them at build time.
 */

export const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
] as const;

const AI_EXPENSE_CATEGORIES = new Set([
  'Food & Dining',
  'Coffee & Snacks',
  'Transport',
  'Vehicle & Fuel',
  'Shopping',
  'Housing & KPR',
  'Bills & Utilities',
  'Subscriptions',
  'Health & Medical',
  'Fitness & Gym',
  'Personal',
  'Family',
  'Charity & Gifts',
  'Entertainment',
  'Travel',
  'Education',
  'Insurance & Tax',
  'Others',
]);

const AI_INCOME_CATEGORIES = new Set([
  'Salary',
  'Freelance / Business',
  'Bonus',
  'Investments',
  'Interest',
  'Allowance',
  'Gift',
  'Others',
]);

const AI_LEGACY_EXPENSE_ALIASES: Record<string, string> = {
  'food & beverages': 'Food & Dining',
  snacks: 'Coffee & Snacks',
  snack: 'Coffee & Snacks',
  'housing / rent': 'Housing & KPR',
  'home services': 'Housing & KPR',
  furnishings: 'Housing & KPR',
  furnisings: 'Housing & KPR',
  fuel: 'Vehicle & Fuel',
  parking: 'Vehicle & Fuel',
  'vehicle services': 'Vehicle & Fuel',
  'internet & phone': 'Bills & Utilities',
  bills: 'Bills & Utilities',
  'cloud & storage': 'Subscriptions',
  insurance: 'Insurance & Tax',
  'public services': 'Insurance & Tax',
  social: 'Entertainment',
  charity: 'Charity & Gifts',
  zakat: 'Charity & Gifts',
};

const AI_EXPENSE_CANONICAL = new Map<string, string>(
  Array.from(AI_EXPENSE_CATEGORIES).map((name) => [name.toLowerCase(), name])
);

const AI_INCOME_CANONICAL = new Map<string, string>(
  Array.from(AI_INCOME_CATEGORIES).map((name) => [name.toLowerCase(), name])
);

const AI_PAYMENT_METHODS_CANONICAL = new Map<string, string>([
  ['qris', 'QRIS'],
  ['bank transfer', 'Bank Transfer'],
  ['virtual account', 'Virtual Account'],
  ['debit card', 'Debit Card'],
  ['credit card', 'Credit Card'],
  ['e-wallet', 'E-Wallet'],
  ['cash', 'Cash'],
  ['e-money', 'E-Money'],
]);

/**
 * Normalizes AI-returned category strings to valid REKA default categories matching `type`,
 * case-insensitively, preventing phantom/typo/legacy labels from leaking.
 */
export function sanitizeAiCategory(
  rawCategory: unknown,
  type: 'expense' | 'income'
): string {
  const cleaned = String(rawCategory || '').trim();
  if (!cleaned) return 'Others';
  const lower = cleaned.toLowerCase();
  if (lower === 'transfer' || lower === 'general') return 'Others';
  const normalized =
    type === 'expense' && AI_LEGACY_EXPENSE_ALIASES[lower]
      ? AI_LEGACY_EXPENSE_ALIASES[lower]
      : type === 'income' && (lower === 'freelance' || lower === 'business')
        ? 'Freelance / Business'
        : cleaned;
  const canonicalMap = type === 'income' ? AI_INCOME_CANONICAL : AI_EXPENSE_CANONICAL;
  return canonicalMap.get(normalized.toLowerCase()) || 'Others';
}

/**
 * Normalizes AI-returned paymentMethod strings to supported REKA payment methods.
 * Critically, never returns bare `"Transfer"` (which is reserved for paired internal account transfers).
 */
export function sanitizeAiPaymentMethod(
  rawMethod: unknown,
  fallback: string = 'QRIS'
): string {
  const cleaned = String(rawMethod || '').trim();
  if (!cleaned) return fallback;
  const lower = cleaned.toLowerCase();

  const exact = AI_PAYMENT_METHODS_CANONICAL.get(lower);
  if (exact) return exact;

  if (lower.includes('qris') || lower === 'qr' || lower.includes('qr code')) return 'QRIS';
  if (lower.includes('virtual account') || /\bva\b/.test(lower) || lower.includes('briva')) {
    return 'Virtual Account';
  }
  if (lower.includes('credit') || lower.includes('visa') || lower.includes('mastercard') || lower === 'cc') {
    return 'Credit Card';
  }
  if (lower.includes('debit') || lower.includes('atm')) return 'Debit Card';
  if (
    lower.includes('e-money') ||
    lower.includes('emoney') ||
    lower.includes('flazz') ||
    lower.includes('brizzi') ||
    lower.includes('tapcash') ||
    lower.includes('e-toll') ||
    lower.includes('etoll')
  ) {
    return 'E-Money';
  }
  if (
    lower.includes('e-wallet') ||
    lower.includes('ewallet') ||
    lower.includes('gopay') ||
    lower.includes('ovo') ||
    lower.includes('dana') ||
    lower.includes('shopeepay') ||
    lower.includes('linkaja') ||
    lower.includes('wallet')
  ) {
    return 'E-Wallet';
  }
  if (lower.includes('cash') || lower.includes('tunai')) return 'Cash';
  if (
    lower.includes('transfer') ||
    lower.includes('trsf') ||
    lower.includes('bi-fast') ||
    lower.includes('bifast') ||
    lower.includes('wire') ||
    lower.includes('rtgs') ||
    lower.includes('skn')
  ) {
    return 'Bank Transfer';
  }

  return fallback;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function getGeminiScannerConfig() {
  const proxyUrl = (process.env.EXPO_PUBLIC_GEMINI_PROXY_URL || '').trim();
  const proxyToken = (process.env.EXPO_PUBLIC_GEMINI_PROXY_TOKEN || '').trim();
  const apiKey = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();

  return {
    proxyUrl,
    proxyToken,
    apiKey,
    isConfigured: Boolean(proxyUrl || apiKey),
  };
}

/**
 * Normalizes AI-extracted currency values (both numeric and formatted strings) safely.
 */
export function parseSafeAmount(val: unknown, currency: 'IDR' | 'USD' = 'IDR'): number {
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 0;
    return currency === 'IDR'
      ? Math.round(Math.abs(val))
      : Math.round(Math.abs(val) * 100) / 100;
  }
  if (!val) return 0;
  let str = String(val).trim();
  if (currency === 'IDR') {
    // Strip trailing sen/decimal cents (.00, ,00, .50) before stripping dots
    str = str.replace(/[.,]\d{1,2}$/, '');
    const cleaned = str.replace(/\./g, '').replace(/[^0-9]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  }
  const cleaned = str.replace(/,/g, '').replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(Math.abs(parsed) * 100) / 100;
}

/**
 * Rejects after `ms` or when `signal` aborts, ensuring scanner operations never hang indefinitely.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
  timeoutMessage: string = 'Request timed out. Please try again.',
  cancelMessage: string = 'Operation was cancelled.'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      fn();
    };
    const onAbort = () => finish(() => reject(new Error(cancelMessage)));
    const timer = setTimeout(() => finish(() => reject(new Error(timeoutMessage))), ms);

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort);
    }

    promise.then(
      (value) => finish(() => resolve(value)),
      (err) => finish(() => reject(err))
    );
  });
}

export interface ProxyRequestOptions {
  serviceName: string;
  timeoutMessage: string;
  cancelMessage: string;
}

/**
 * Sends a scan payload to the configured backend proxy with an aborted fetch lifecycle
 * and optional CBT access token header (`X-REKA-Proxy-Token`).
 */
export async function postToGeminiProxy<T extends Record<string, unknown>>(
  payload: Record<string, unknown>,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  options: ProxyRequestOptions
): Promise<T> {
  const { proxyUrl, proxyToken } = getGeminiScannerConfig();
  if (!proxyUrl || (!proxyUrl.startsWith('https://') && !proxyUrl.startsWith('http://'))) {
    throw new Error(`${options.serviceName} proxy URL is invalid or not configured.`);
  }

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      throw new Error(options.cancelMessage);
    }
    signal.addEventListener('abort', onParentAbort, { once: true });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (proxyToken) {
    headers['X-REKA-Proxy-Token'] = proxyToken;
  }

  try {
    const res = await withTimeout(
      fetch(proxyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      }),
      timeoutMs,
      signal,
      options.timeoutMessage,
      options.cancelMessage
    );

    if (!res.ok) {
      if (res.status === 413) {
        throw new Error(
          'The selected file is too large to process right now. Please try a smaller photo or fewer PDF pages.'
        );
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `${options.serviceName} could not authenticate with the server. Please update the app or try again later.`
        );
      }
      if (res.status === 429 || res.status === 503) {
        throw new Error(
          `${options.serviceName} is busy right now (status ${res.status}, too many requests).`
        );
      }
      throw new Error(`${options.serviceName} is unavailable right now (status ${res.status}).`);
    }

    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`Invalid format returned by ${options.serviceName.toLowerCase()}.`);
    }
    return data as T;
  } catch (err) {
    controller.abort();
    throw err;
  } finally {
    if (signal) {
      signal.removeEventListener('abort', onParentAbort);
    }
  }
}
