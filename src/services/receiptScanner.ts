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
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category?: string;
  }>;
}

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fast candidate model cascade for instant nominal reading
const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

export async function extractReceiptFromBase64(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<ExtractedReceiptData> {
  if (!apiKey) {
    throw new Error('Gemini API Key not found in .env configuration');
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
    throw (
      lastError ||
      new Error('The receipt scanning service is momentarily busy. Please try again or enter details manually.')
    );
  }

  const responseText = response.text;
  const cleanedText = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanedText) as ExtractedReceiptData;
    return {
      merchantName: parsed.merchantName || 'Unknown Merchant',
      transactionDate: parsed.transactionDate || new Date().toISOString().split('T')[0],
      category: parsed.category || 'General',
      type: parsed.type || 'expense',
      totalAmount: Math.abs(Number(parsed.totalAmount) || 0),
      currency: parsed.currency || 'IDR',
      paymentMethod: parsed.paymentMethod || 'QRIS',
      items: [],
    };
  } catch (err: any) {
    throw new Error('Invalid JSON format returned by receipt parser.');
  }
}
