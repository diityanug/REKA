import { GoogleGenAI, Type } from '@google/genai';

export interface ExtractedReceiptData {
  merchantName: string;
  transactionDate: string; // ISO String or YYYY-MM-DD
  category: string;
  type: 'expense' | 'income';
  totalAmount: number;
  currency: 'IDR' | 'USD';
  paymentMethod: string;
  taxAmount?: number;
  discountAmount?: number;
  notes?: string;
  items?: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: string;
  }[];
}

/**
 * Security Best Practice (Item 1a):
 * - In production builds, set `EXPO_PUBLIC_GEMINI_PROXY_URL` to a backend/serverless proxy endpoint
 *   so the Gemini API key stays strictly server-side and is never embedded in the client bundle.
 * - If `EXPO_PUBLIC_GEMINI_API_KEY` is used directly for local/personal builds, restrict the key in
 *   Google Cloud Console to your Android package (`com.anonymous.projekamba`) + SHA-1 certificate
 *   fingerprint and iOS bundle identifier, and restrict API scope to Generative Language API only.
 */
const proxyUrl = process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Lets the UI explain the situation instead of failing after a photo was taken
export const isReceiptScannerConfigured = Boolean(proxyUrl || apiKey);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const REQUEST_TIMEOUT_MS = 30000;

// Rejects after `ms` or when the caller cancels, so the scanner can never hang forever
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
  message: string = 'Receipt scanning took too long. Please try again or enter the details manually.'
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
    const onAbort = () =>
      finish(() => reject(new Error('Receipt scanning was cancelled.')));
    const timer = setTimeout(() => finish(() => reject(new Error(message))), ms);

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

const sanitizeErrorMessage = (msg: string): string => {
  if (!apiKey) return msg;
  return msg.split(apiKey).join('[REDACTED_KEY]');
};

// Fast candidate model cascade for instant nominal reading
const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

function parseSafeAmount(val: any, currency: 'IDR' | 'USD' = 'IDR'): number {
  if (typeof val === 'number') {
    return currency === 'IDR' ? Math.round(Math.abs(val)) : Math.round(Math.abs(val) * 100) / 100;
  }
  if (!val) return 0;
  let str = String(val).trim();
  if (currency === 'IDR') {
    // Strip trailing sen/decimal cents (.00, ,00, .50) before stripping dots
    str = str.replace(/[.,]\d{1,2}$/, '');
    const cleaned = str.replace(/\./g, '').replace(/[^0-9]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : Math.abs(parsed);
  } else {
    const cleaned = str.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.round(Math.abs(parsed) * 100) / 100;
  }
}

function normalizeReceiptResult(parsed: Partial<ExtractedReceiptData>): ExtractedReceiptData {
  const currency: 'IDR' | 'USD' = parsed.currency === 'USD' ? 'USD' : 'IDR';
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .map((it) => {
      const name = String(it.name || '').trim();
      const quantity = Math.max(parseSafeAmount(it.quantity, currency) || 1, 1);
      const unitPrice = parseSafeAmount(it.unitPrice, currency);
      const totalPrice = parseSafeAmount(it.totalPrice, currency) || (quantity * unitPrice);
      return {
        name: name || 'Item',
        quantity,
        unitPrice: unitPrice > 0 ? unitPrice : (quantity > 0 ? Math.round(totalPrice / quantity) : totalPrice),
        totalPrice,
        category: it.category,
      };
    })
    .filter((it) => it.name.length > 0 && it.totalPrice > 0);

  return {
    merchantName: parsed.merchantName || 'Unknown Merchant',
    transactionDate: parsed.transactionDate || new Date().toISOString().split('T')[0],
    category: parsed.category || 'General',
    type: parsed.type === 'income' ? 'income' : 'expense',
    totalAmount: parseSafeAmount(parsed.totalAmount, currency),
    currency,
    paymentMethod: parsed.paymentMethod || 'QRIS',
    taxAmount: parseSafeAmount(parsed.taxAmount, currency),
    discountAmount: parseSafeAmount(parsed.discountAmount, currency),
    notes: parsed.notes || '',
    items,
  };
}

export async function extractReceiptFromBase64(
  base64Image: string,
  mimeType: string = 'image/jpeg',
  signal?: AbortSignal
): Promise<ExtractedReceiptData> {
  // 1. Prefer secure backend proxy if configured
  if (proxyUrl) {
    const res = await withTimeout(
      fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image, mimeType }),
      }),
      REQUEST_TIMEOUT_MS,
      signal
    );
    if (!res.ok) {
      throw new Error(`Receipt scanner is unavailable right now (status ${res.status}).`);
    }
    const data = (await res.json()) as Partial<ExtractedReceiptData>;
    return normalizeReceiptResult(data);
  }

  // 2. Fallback to direct client SDK call
  if (!apiKey) {
    throw new Error(
      'Receipt scanning is not set up for this build. Add a receipt photo manually instead.'
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Carefully inspect this image of a receipt, cash slip, or digital payment proof (mobile banking, payment confirmation, or transfer receipt).
Read and extract the key transaction nominal and details into strict JSON:

Rules:
1. "totalAmount": The exact final total amount / nominal paid or received (pure number, no commas or currency symbols). Prioritize grand total / amount paid.
2. "merchantName": Official name of the store, merchant, or transfer recipient/sender.
3. "transactionDate": Date in YYYY-MM-DD format (or ISO-8601 if timestamp is visible).
4. "category": Choose one most accurate category from: "Food & Beverages", "Snacks", "Shopping", "Bills & Utilities", "Subscriptions", "Housing / Rent", "Internet & Phone", "Insurance", "Fitness & Gym", "Cloud & Storage", "Fuel", "Parking", "Vehicle Services", "Public Services", "Personal", "Home Services", "Furnisings", "Social", "Health & Medical", "Education", "Travel", "Salary", "Allowance", "Investments", "Bonus", "Gift", or "Others".
5. "type": "expense" for purchases/transfers sent, or "income" for incoming funds/deposits.
6. "currency": Detect whether the currency is "IDR" (Rupiah, Rp) or "USD" (Dollar, $).
7. "paymentMethod": e.g. "QRIS", "Debit Card", "Credit Card", "Cash", "Bank Transfer", or "Digital Wallet".
8. "items": Extract ALL purchased products, services, or line items shown on the receipt as an array of objects:
   - "name": Clean item description / product name
   - "quantity": Number of units purchased (number, default 1)
   - "unitPrice": Price per single unit (pure number)
   - "totalPrice": Total line price (pure number)
   If no individual products or line items exist on the receipt (such as on a single-nominal QRIS payment proof, bank transfer screenshot, or parking slip), return an empty array [].
9. "taxAmount": Total tax / PPN amount if listed (number), otherwise 0.
10. "discountAmount": Total discount / promo amount if listed (number), otherwise 0.
`;

  let response: any = null;
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    data: base64Image,
                    mimeType: mimeType,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                merchantName: { type: Type.STRING },
                transactionDate: { type: Type.STRING },
                category: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['expense', 'income'] },
                totalAmount: { type: Type.NUMBER },
                currency: { type: Type.STRING, enum: ['IDR', 'USD'] },
                paymentMethod: { type: Type.STRING },
                taxAmount: { type: Type.NUMBER },
                discountAmount: { type: Type.NUMBER },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unitPrice: { type: Type.NUMBER },
                      totalPrice: { type: Type.NUMBER },
                    },
                    required: ['name', 'totalPrice'],
                  },
                },
              },
              required: [
                'merchantName',
                'transactionDate',
                'category',
                'type',
                'totalAmount',
                'currency',
                'items',
              ],
            },
          },
          }),
          REQUEST_TIMEOUT_MS,
          signal
        );

        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        if (signal?.aborted) break;
        const errMsg = (err?.message || '').toLowerCase();
        const isTemporary =
          errMsg.includes('demand') ||
          errMsg.includes('overload') ||
          errMsg.includes('503') ||
          errMsg.includes('429') ||
          errMsg.includes('quota') ||
          errMsg.includes('resource exhausted') ||
          errMsg.includes('unavailable');

        if (isTemporary && attempt === 0) {
          await sleep(800);
        } else {
          break;
        }
      }
    }

    if ((response && response.text) || signal?.aborted) {
      break;
    }
  }

  if (signal?.aborted) {
    throw new Error('Receipt scanning was cancelled.');
  }

  if (!response || !response.text) {
    const rawMsg =
      lastError?.message ||
      'The receipt scanning service is momentarily busy. Please try again or enter details manually.';
    throw new Error(sanitizeErrorMessage(rawMsg));
  }

  const responseText = response.text;
  const cleanedText = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanedText) as Partial<ExtractedReceiptData>;
    return normalizeReceiptResult(parsed);
  } catch {
    throw new Error('Invalid JSON format returned by receipt parser.');
  }
}
