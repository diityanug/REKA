import { GoogleGenAI, Type } from '@google/genai';
import { getTodayDateStr } from '../utils/formatters';
import { toUserFriendlyErrorMessage } from '../utils/errorHandling';
import {
  CANDIDATE_MODELS,
  getGeminiScannerConfig,
  parseSafeAmount,
  postToGeminiProxy,
  sanitizeAiCategory,
  sleep,
  withTimeout,
} from './geminiProxyClient';

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
 * Security Best Practice:
 * - In shared/CBT and production builds, configure `EXPO_PUBLIC_GEMINI_PROXY_URL` to point to
 *   `workers/gemini-proxy` (Cloudflare Workers) so `GEMINI_API_KEY` stays strictly server-side
 *   and is never embedded in the client bundle. Do not set `EXPO_PUBLIC_GEMINI_API_KEY` in EAS
 *   when using a proxy build.
 */
// Lets the UI explain the situation instead of failing after a photo was taken
export const isReceiptScannerConfigured = getGeminiScannerConfig().isConfigured;

const REQUEST_TIMEOUT_MS = 30000;
const RECEIPT_TIMEOUT_MSG =
  'Receipt scanning took too long. Please try again or enter the details manually.';
const RECEIPT_CANCEL_MSG = 'Receipt scanning was cancelled.';

const sanitizeErrorMessage = (err: unknown): string => {
  return toUserFriendlyErrorMessage(err, 'receipt');
};

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

  const type: 'expense' | 'income' = parsed.type === 'income' ? 'income' : 'expense';
  return {
    merchantName: parsed.merchantName || 'Unknown Merchant',
    transactionDate: parsed.transactionDate || getTodayDateStr(),
    category: sanitizeAiCategory(parsed.category, type),
    type,
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
  const { proxyUrl, apiKey } = getGeminiScannerConfig();

  // 1. Prefer secure backend proxy if configured
  if (proxyUrl) {
    const data = await postToGeminiProxy<Partial<ExtractedReceiptData>>(
      { action: 'receipt', base64Image, mimeType },
      REQUEST_TIMEOUT_MS,
      signal,
      {
        serviceName: 'Receipt scanner',
        timeoutMessage: RECEIPT_TIMEOUT_MSG,
        cancelMessage: RECEIPT_CANCEL_MSG,
      }
    );
    return normalizeReceiptResult(data);
  }

  // 2. Fallback to direct client SDK call (local dev only)
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
4. "category": Choose one most accurate category from:
   - Expense categories (use when "type" is "expense"): "Food & Dining", "Coffee & Snacks", "Transport", "Vehicle & Fuel", "Shopping", "Housing & KPR", "Bills & Utilities", "Subscriptions", "Health & Medical", "Fitness & Gym", "Personal", "Family", "Charity & Gifts", "Entertainment", "Travel", "Education", "Insurance & Tax", "Others".
   - Income categories (use when "type" is "income"): "Salary", "Freelance / Business", "Bonus", "Investments", "Interest", "Allowance", "Gift", "Others".
5. "type": "expense" for purchases/transfers sent, or "income" for incoming funds/deposits.
6. "currency": Detect whether the currency is "IDR" (Rupiah, Rp) or "USD" (Dollar, $).
7. "paymentMethod": e.g. "QRIS", "Bank Transfer", "Virtual Account", "Debit Card", "Credit Card", "E-Wallet", "Cash", or "E-Money".
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
          signal,
          RECEIPT_TIMEOUT_MSG,
          RECEIPT_CANCEL_MSG
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

        if (isTemporary && attempt === 0 && !errMsg.includes('too long')) {
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
