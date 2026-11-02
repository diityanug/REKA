import { Platform } from 'react-native';
import { GoogleGenAI, Type } from '@google/genai';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { AccountType, CurrencyType, Transaction, TransactionType, Wallet } from './database';
import { getTodayDateStr, getDateStrFromTimestamp } from '../utils/formatters';

export interface ExtractedStatementTx {
  id: string;
  merchantName: string;
  transactionDate: string; // YYYY-MM-DD
  transactionTime: string; // HH:mm
  category: string;
  type: TransactionType;
  amount: number;
  paymentMethod: string;
  notes: string;
  cardIdentifier?: string;
  selected: boolean;
  isDuplicate?: boolean;
}

export interface ExtractedStatementData {
  bankName: string;
  accountNumber: string;
  accountType: AccountType;
  currency: CurrencyType;
  periodLabel: string;
  openingBalance?: number;
  closingBalance?: number;
  fileName?: string;
  transactions: ExtractedStatementTx[];
}

const proxyUrl = process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const STATEMENT_TIMEOUT_MS = 65000;

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
  message: string = 'Statement analysis took too long. Please try a smaller file or fewer pages.'
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
      finish(() => reject(new Error('Statement scanning was cancelled.')));
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

function parseSafeAmount(val: any, currency: CurrencyType = 'IDR'): number {
  if (typeof val === 'number') {
    return currency === 'IDR'
      ? Math.round(Math.abs(val))
      : Math.round(Math.abs(val) * 100) / 100;
  }
  if (!val) return 0;
  let str = String(val).trim();
  if (currency === 'IDR') {
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

function normalizeDateStr(raw?: string): string {
  if (!raw) return getTodayDateStr();
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return getTodayDateStr();
}

function normalizeTimeStr(raw?: string, index: number = 0): string {
  if (raw && /^\d{2}:\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }
  // Space out fallback times slightly so statement order is preserved chronologically
  const baseMinutes = (9 * 60 + index) % (23 * 60 + 59);
  const hh = String(Math.floor(baseMinutes / 60)).padStart(2, '0');
  const mm = String(baseMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeAccountType(raw?: string): AccountType {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('credit')) return 'Credit Card';
  if (lower.includes('e-money') || lower.includes('emoney') || lower.includes('flazz') || lower.includes('brizzi') || lower.includes('tapcash')) {
    return 'E-Money';
  }
  if (
    lower.includes('wallet') ||
    lower.includes('gopay') ||
    lower.includes('ovo') ||
    lower.includes('dana') ||
    lower.includes('shopeepay') ||
    lower.includes('linkaja')
  ) {
    return 'E-Wallet';
  }
  return 'Bank';
}

function normalizeStatementResult(
  parsed: any,
  fileName?: string
): ExtractedStatementData {
  const currency: CurrencyType = parsed?.currency === 'USD' ? 'USD' : 'IDR';
  const bankName = String(parsed?.bankName || 'Bank Account').trim();
  const accountNumber = String(parsed?.accountNumber || '').replace(/\s+/g, '').trim();
  const accountType = normalizeAccountType(parsed?.accountType || bankName);
  const periodLabel = String(parsed?.periodLabel || '').trim();
  const rawTxs = Array.isArray(parsed?.transactions) ? parsed.transactions : [];

  const transactions: ExtractedStatementTx[] = rawTxs
    .map((tx: any, idx: number) => {
      const amount = parseSafeAmount(tx?.amount, currency);
      const type: TransactionType = tx?.type === 'income' ? 'income' : 'expense';
      const merchantName = String(tx?.merchantName || 'Statement Transaction').trim();
      const category =
        String(tx?.category || (type === 'income' ? 'Salary' : 'Shopping')).trim();
      const paymentMethod =
        String(tx?.paymentMethod || (accountType === 'Credit Card' ? 'Credit Card' : 'Bank Transfer')).trim();
      const notes = String(tx?.notes || '').trim();
      const cardIdentifier = tx?.cardIdentifier ? String(tx.cardIdentifier).trim() : undefined;

      return {
        id: `stx_${Date.now()}_${idx}`,
        merchantName,
        transactionDate: normalizeDateStr(tx?.transactionDate),
        transactionTime: normalizeTimeStr(tx?.transactionTime, idx),
        category,
        type,
        amount,
        paymentMethod,
        notes,
        cardIdentifier,
        selected: true,
        isDuplicate: false,
      };
    })
    .filter((tx: ExtractedStatementTx) => tx.amount > 0);

  return {
    bankName,
    accountNumber,
    accountType,
    currency,
    periodLabel,
    openingBalance: parsed?.openingBalance ? parseSafeAmount(parsed.openingBalance, currency) : undefined,
    closingBalance: parsed?.closingBalance ? parseSafeAmount(parsed.closingBalance, currency) : undefined,
    fileName,
    transactions,
  };
}

/**
 * Reads a local file, content:// URI (Android SAF), or cache URI into a base64 string
 * with multiple robust fallback layers to avoid "location isn't readable" errors.
 */
async function readFileAsBase64Robust(uri: string, filenameHint: string = 'statement.pdf'): Promise<string> {
  const safeFilename = filenameHint.replace(/[^a-zA-Z0-9._-]/g, '_') || 'statement.pdf';
  const cachePath = `${FileSystem.cacheDirectory}st_${Date.now()}_${safeFilename}`;

  // Strategy 1: Copy to app's own cacheDirectory first (solves Android content:// provider & scoped storage restrictions)
  try {
    await FileSystem.copyAsync({
      from: uri,
      to: cachePath,
    });
    const base64 = await FileSystem.readAsStringAsync(cachePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    FileSystem.deleteAsync(cachePath, { idempotent: true }).catch(() => {});
    if (base64) return base64;
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: If Android content:// URI, use StorageAccessFramework
  if (Platform.OS === 'android' && uri.startsWith('content://')) {
    try {
      const base64 = await FileSystem.StorageAccessFramework.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64) return base64;
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 3: Direct FileSystem.readAsStringAsync
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (base64) return base64;
  } catch {
    // Continue to next strategy
  }

  // Strategy 4: Native fetch + Blob + FileReader (Standard React Native networking/content resolver)
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const base64Data = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64Data);
        } else {
          reject(new Error('FileReader returned non-string result.'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
    if (base64) return base64;
  } catch {
    // Continue to error throw
  }

  throw new Error(`File "${filenameHint}" could not be read. Please save the file to local device storage and try again.`);
}

/**
 * Reads a text/CSV file with multiple robust fallback layers.
 */
async function readFileAsTextRobust(uri: string, filenameHint: string = 'statement.csv'): Promise<string> {
  const safeFilename = filenameHint.replace(/[^a-zA-Z0-9._-]/g, '_') || 'statement.csv';
  const cachePath = `${FileSystem.cacheDirectory}st_${Date.now()}_${safeFilename}`;

  try {
    await FileSystem.copyAsync({
      from: uri,
      to: cachePath,
    });
    const text = await FileSystem.readAsStringAsync(cachePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    FileSystem.deleteAsync(cachePath, { idempotent: true }).catch(() => {});
    if (text) return text;
  } catch {}

  if (Platform.OS === 'android' && uri.startsWith('content://')) {
    try {
      const text = await FileSystem.StorageAccessFramework.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (text) return text;
    } catch {}
  }

  try {
    const text = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (text) return text;
  } catch {}

  try {
    const response = await fetch(uri);
    return await response.text();
  } catch {}

  throw new Error(`Failed to read content from file "${filenameHint}".`);
}

/**
 * Pick an e-Statement file (PDF, image screenshot, or CSV) from the device.
 */
export async function pickStatementFile(): Promise<{
  cancelled: boolean;
  base64?: string;
  textContent?: string;
  mimeType?: string;
  fileName?: string;
}> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'image/*',
      'text/csv',
      'text/comma-separated-values',
      'text/plain',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { cancelled: true };
  }

  const asset = result.assets[0];
  const nameLower = (asset.name || '').toLowerCase();
  let mimeType = asset.mimeType || 'application/pdf';

  if (nameLower.endsWith('.pdf')) {
    mimeType = 'application/pdf';
  } else if (nameLower.endsWith('.csv') || mimeType.includes('csv') || mimeType.startsWith('text/')) {
    const textContent = await readFileAsTextRobust(asset.uri, asset.name);
    return {
      cancelled: false,
      textContent,
      mimeType: 'text/csv',
      fileName: asset.name,
    };
  } else if (nameLower.endsWith('.png')) {
    mimeType = 'image/png';
  } else if (nameLower.endsWith('.webp')) {
    mimeType = 'image/webp';
  } else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg')) {
    mimeType = 'image/jpeg';
  }

  const base64 = await readFileAsBase64Robust(asset.uri, asset.name);

  return {
    cancelled: false,
    base64,
    mimeType,
    fileName: asset.name,
  };
}

/**
 * Extract structured bank/e-wallet statement header and all transaction rows using Gemini AI.
 */
export async function extractStatementFromFile(
  input: {
    base64?: string;
    textContent?: string;
    mimeType: string;
    fileName?: string;
  },
  existingWalletNames: string[] = [],
  signal?: AbortSignal
): Promise<ExtractedStatementData> {
  if (!apiKey && !proxyUrl) {
    throw new Error(
      'AI statement scanner is not configured in this build. Please check your Gemini API configuration.'
    );
  }

  if (!apiKey) {
    throw new Error('Gemini API key is required to analyze e-Statement files.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const walletHint =
    existingWalletNames.length > 0
      ? `The user currently has these accounts in the app: ${existingWalletNames.map((n) => `"${n}"`).join(', ')}. If the statement belongs to one of these banks/accounts (e.g. SeaBank, BCA, Mandiri, BNI, BRI, Jago, Blu, Jenius, GoPay, OVO, ShopeePay), set "bankName" to match that bank's clean name.`
      : 'Set "bankName" to the clean official short name of the bank or e-wallet (e.g. "SeaBank", "BCA", "Mandiri", "BNI", "BRI", "Bank Jago", "Blu", "Jenius", "GoPay", "ShopeePay", "OVO").';

  const prompt = `
Carefully read this bank, credit card, or e-wallet e-Statement / mutation history (mutasi rekening).
Extract the account header and EVERY individual transaction row into strict JSON.

Rules:
1. "bankName": Clean name of the bank, card issuer, or e-wallet. ${walletHint}
2. "accountNumber": Account number or last 4 digits shown on the statement (or "" if not visible).
3. "accountType": One of "Bank", "E-Wallet", "Credit Card", or "E-Money".
4. "currency": "IDR" (Rupiah) or "USD" (US Dollar).
5. "periodLabel": Statement period if shown (e.g. "Oct 2026" or "01 Oct - 31 Oct 2026"), or "".
6. "openingBalance": Opening/starting balance number if shown, otherwise 0.
7. "closingBalance": Ending/closing balance number if shown, otherwise 0.
8. "transactions": Array of ALL transactions listed in the statement (skip "Saldo Awal" / "Opening Balance" summary rows that are not actual transactions):
   - "merchantName": Clean, human-readable merchant, recipient, sender, or transaction title. Strip noisy bank codes like "TRSF E-BANKING DB 1204/FTSCY/WS95031" or "QRIS 001928" and keep the meaningful name (e.g. "Tokopedia", "Indomaret", "Transfer ke Budi", "Bunga Tabungan SeaBank", "Pajak Bunga", "ShopeePay Top Up").
   - "transactionDate": Date of the transaction in YYYY-MM-DD format. If only DD/MM is shown, infer the year from the statement period or current year.
   - "transactionTime": Time in HH:mm (24h) if visible on the row, otherwise "".
   - "type":
     * For Bank / E-Wallet statements: Debit (DB / uang keluar / minus / payment / transfer out / tax / fee) = "expense"; Credit (CR / uang masuk / plus / deposit / transfer in / interest / cashback / salary) = "income".
     * For Credit Card billing statements: Purchases / charges / fees = "expense"; Refunds / cashback = "income".
   - "amount": Positive numeric amount of the transaction (pure number, no currency symbols or thousand separators).
   - "category": Pick the single most accurate category from:
     * Expense categories: "Food & Beverages", "Snacks", "Shopping", "Bills & Utilities", "Subscriptions", "Housing / Rent", "Internet & Phone", "Insurance", "Fitness & Gym", "Cloud & Storage", "Fuel", "Parking", "Vehicle Services", "Public Services", "Personal", "Home Services", "Furnisings", "Social", "Health & Medical", "Education", "Travel", "Others"
     * Income categories: "Salary", "Allowance", "Investments", "Bonus", "Gift", "Others"
   - "paymentMethod": e.g. "Bank Transfer", "QRIS", "Debit Card", "Credit Card", "E-Wallet", or "E-Money".
   - "notes": Keep the original bank description / reference code here for reference.
`;

  const userParts: any[] = [{ text: prompt }];
  if (input.textContent) {
    userParts.push({
      text: `CSV / Text Statement Content (${input.fileName || 'statement.csv'}):\n${input.textContent.slice(0, 120000)}`,
    });
  } else if (input.base64) {
    userParts.push({
      inlineData: {
        data: input.base64,
        mimeType: input.mimeType,
      },
    });
  } else {
    throw new Error('No readable content found in the selected statement file.');
  }

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
                parts: userParts,
              },
            ],
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  bankName: { type: Type.STRING },
                  accountNumber: { type: Type.STRING },
                  accountType: {
                    type: Type.STRING,
                    enum: ['Bank', 'E-Wallet', 'Credit Card', 'E-Money'],
                  },
                  currency: { type: Type.STRING, enum: ['IDR', 'USD'] },
                  periodLabel: { type: Type.STRING },
                  openingBalance: { type: Type.NUMBER },
                  closingBalance: { type: Type.NUMBER },
                  transactions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        merchantName: { type: Type.STRING },
                        transactionDate: { type: Type.STRING },
                        transactionTime: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ['expense', 'income'] },
                        amount: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                        paymentMethod: { type: Type.STRING },
                        notes: { type: Type.STRING },
                        cardIdentifier: { type: Type.STRING },
                      },
                      required: [
                        'merchantName',
                        'transactionDate',
                        'type',
                        'amount',
                        'category',
                      ],
                    },
                  },
                },
                required: ['bankName', 'currency', 'transactions'],
              },
            },
          }),
          STATEMENT_TIMEOUT_MS,
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
          await sleep(900);
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
    throw new Error('Statement scanning was cancelled.');
  }

  if (!response || !response.text) {
    const rawMsg =
      lastError?.message ||
      'Could not read the e-Statement file right now. Please make sure the PDF is not password-protected and try again.';
    throw new Error(sanitizeErrorMessage(rawMsg));
  }

  const cleanedText = response.text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanedText);
    return normalizeStatementResult(parsed, input.fileName);
  } catch {
    throw new Error(
      'Failed to parse statement transactions. If the PDF is password-protected, please unlock it first.'
    );
  }
}

const BANK_ALIASES: Record<string, string[]> = {
  seabank: ['seabank', 'sea bank', 'bank seabank'],
  bca: ['bca', 'bank central asia', 'mybca', 'klikbca', 'tahapan'],
  mandiri: ['mandiri', 'livin', 'bank mandiri'],
  bni: ['bni', 'bank negara indonesia', 'wondr'],
  bri: ['bri', 'bank rakyat indonesia', 'brimo', 'britama', 'simpedes'],
  jago: ['jago', 'bank jago'],
  blu: ['blu', 'bca digital'],
  jenius: ['jenius', 'btpn', 'smbc'],
  bsi: ['bsi', 'bank syariah indonesia', 'byond'],
  cimb: ['cimb', 'cimb niaga', 'octo'],
  permata: ['permata', 'permatabank', 'permatame'],
  danamon: ['danamon', 'd-bank'],
  ocbc: ['ocbc', 'nyala'],
  gopay: ['gopay', 'go-pay'],
  ovo: ['ovo'],
  shopeepay: ['shopeepay', 'shopee pay'],
  dana: ['dana'],
};

function cleanToken(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Automatically match the extracted statement's bankName and/or accountNumber
 * against the user's existing Wallets list.
 */
export function matchWalletForStatement(
  statement: Pick<ExtractedStatementData, 'bankName' | 'accountNumber' | 'currency'>,
  wallets: Wallet[],
  preferredWalletId?: string
): { matchedWallet: Wallet | null; isAutoMatched: boolean } {
  const currencyWallets = wallets.filter((w) => w.currency === statement.currency);
  if (currencyWallets.length === 0) {
    return { matchedWallet: null, isAutoMatched: false };
  }

  // 0. If user initiated import directly inside a specific Account Detail modal and currency matches
  if (preferredWalletId) {
    const preferred = currencyWallets.find((w) => w.id === preferredWalletId);
    if (preferred) {
      return { matchedWallet: preferred, isAutoMatched: true };
    }
  }

  // 1. Match by last 4 digits of account number if present on both statement and wallet
  const stmtDigits = (statement.accountNumber || '').replace(/\D/g, '');
  if (stmtDigits.length >= 4) {
    const last4 = stmtDigits.slice(-4);
    const byAccNum = currencyWallets.find((w) => {
      const wDigits = (w.accountNumber || '').replace(/\D/g, '');
      return wDigits.length >= 4 && wDigits.endsWith(last4);
    });
    if (byAccNum) {
      return { matchedWallet: byAccNum, isAutoMatched: true };
    }
  }

  // 2. Match by exact or substring bank name / alias
  const rawBankLower = (statement.bankName || '').toLowerCase().trim();
  const cleanBank = cleanToken(rawBankLower);

  if (cleanBank) {
    // Direct name match (e.g., statement "SeaBank" <-> wallet "SeaBank" or "SeaBank Tabungan")
    const directMatch = currencyWallets.find((w) => {
      const wClean = cleanToken(w.name);
      return (
        wClean.length >= 2 &&
        (wClean.includes(cleanBank) || cleanBank.includes(wClean))
      );
    });
    if (directMatch) {
      return { matchedWallet: directMatch, isAutoMatched: true };
    }

    // Alias group match
    for (const aliases of Object.values(BANK_ALIASES)) {
      const statementMatchesGroup = aliases.some(
        (alias) => rawBankLower.includes(alias) || cleanBank.includes(cleanToken(alias))
      );
      if (statementMatchesGroup) {
        const walletInGroup = currencyWallets.find((w) => {
          const wLower = w.name.toLowerCase();
          const wClean = cleanToken(w.name);
          return aliases.some(
            (alias) => wLower.includes(alias) || wClean.includes(cleanToken(alias))
          );
        });
        if (walletInGroup) {
          return { matchedWallet: walletInGroup, isAutoMatched: true };
        }
      }
    }
  }

  // 3. Fallback: pick first wallet of the same currency (not auto-matched by bank name)
  return { matchedWallet: currencyWallets[0], isAutoMatched: false };
}

/**
 * Mark statement transactions that already exist in the selected wallet
 * (same type, exact same amount, and date within ±1 day) so they are unchecked by default.
 */
export function markDuplicateStatementTransactions(
  statementTxs: ExtractedStatementTx[],
  existingTransactions: Transaction[],
  walletId: string
): ExtractedStatementTx[] {
  if (!walletId) return statementTxs;
  const walletTxs = existingTransactions.filter((t) => t.walletId === walletId);
  if (walletTxs.length === 0) {
    return statementTxs.map((stx) => ({
      ...stx,
      isDuplicate: false,
      selected: true,
    }));
  }

  // Track which existing transactions have already been paired so 2 identical coffees on the same day aren't both collapsed to 1 existing row
  const usedExistingIds = new Set<string>();

  return statementTxs.map((stx) => {
    const stxTime = new Date(`${stx.transactionDate}T12:00:00`).getTime();
    const match = walletTxs.find((existing) => {
      if (usedExistingIds.has(existing.id)) return false;
      if (existing.type !== stx.type) return false;
      if (Math.abs(existing.amount - stx.amount) > 0.01) return false;
      const existingDateStr = getDateStrFromTimestamp(existing.timestamp);
      if (existingDateStr === stx.transactionDate) return true;
      const existingTime = new Date(`${existingDateStr}T12:00:00`).getTime();
      const diffDays = Math.abs(stxTime - existingTime) / (1000 * 60 * 60 * 24);
      return diffDays <= 1.05;
    });

    if (match) {
      usedExistingIds.add(match.id);
      return {
        ...stx,
        isDuplicate: true,
        selected: false,
      };
    }

    return {
      ...stx,
      isDuplicate: false,
      selected: true,
    };
  });
}
