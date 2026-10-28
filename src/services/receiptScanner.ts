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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeErrorMessage = (msg: string): string => {
  if (!apiKey) return msg;
  return msg.split(apiKey).join('[REDACTED_KEY]');
};

// Fast candidate model cascade for instant nominal reading
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

function normalizeReceiptResult(parsed: Partial<ExtractedReceiptData>): ExtractedReceiptData {
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .map((it) => {
      const name = String(it.name || '').trim();
      const quantity = Math.max(Number(it.quantity) || 1, 1);
      const unitPrice = Math.abs(Number(it.unitPrice) || 0);
      const totalPrice = Math.abs(Number(it.totalPrice) || (quantity * unitPrice));
      return {
        name: name || 'Item',
        quantity,
        unitPrice: unitPrice > 0 ? unitPrice : totalPrice,
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
    totalAmount: Math.abs(Number(parsed.totalAmount) || 0),
    currency: parsed.currency === 'USD' ? 'USD' : 'IDR',
    paymentMethod: parsed.paymentMethod || 'QRIS',
    taxAmount: Math.abs(Number(parsed.taxAmount) || 0),
    discountAmount: Math.abs(Number(parsed.discountAmount) || 0),
    notes: parsed.notes || '',
    items,
  };
}

export async function extractReceiptFromBase64(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ExtractedReceiptData> {
  // 1. Prefer secure backend proxy if configured
  if (proxyUrl) {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, mimeType }),
    });
    if (!res.ok) {
      throw new Error(`Receipt proxy returned status ${res.status}`);
    }
    const data = (await res.json()) as Partial<ExtractedReceiptData>;
    return normalizeReceiptResult(data);
  }

  // 2. Fallback to direct client SDK call
  if (!apiKey) {
    throw new Error(
      'Receipt scanner is not configured. Set EXPO_PUBLIC_GEMINI_PROXY_URL or EXPO_PUBLIC_GEMINI_API_KEY in .env'
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
8. "items": If individual line items or products/services are listed on the receipt, extract them as an array of objects with:
   - "name": Item or product description
   - "quantity": Number of units purchased (number, default 1)
   - "unitPrice": Price per single unit (number)
   - "totalPrice": Total line price (number)
9. "taxAmount": Total tax / PPN amount if listed (number), otherwise 0.
10. "discountAmount": Total discount / promo amount if listed (number), otherwise 0.
`;

  let response: any = null;
  let lastError: any = null;

  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await ai.models.generateContent({
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
              ],
            },
          },
        });

        if (response && response.text) {
          break;
        }
      } catch (err: any) {
        lastError = err;
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
          await sleep(1200);
        } else {
          break;
        }
      }
    }

    if (response && response.text) {
      break;
    }
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
