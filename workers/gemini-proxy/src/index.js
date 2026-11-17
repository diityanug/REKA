/**
 * REKA Gemini Proxy — Cloudflare Workers
 *
 * Keeps `GEMINI_API_KEY` strictly on the server so APK/IPA builds never contain API secrets.
 * Designed with zero-logging of user financial payloads, strict payload/MIME allowlists,
 * locked prompts/schemas, per-IP rate limiting, and an optional CBT access token gate.
 */

const DEFAULT_CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

const MAX_REQUEST_BYTES = 22_000_000;
const MAX_RECEIPT_BASE64_CHARS = 9_000_000;
const MAX_STATEMENT_BASE64_CHARS = 20_000_000;
const MAX_STATEMENT_TEXT_CHARS = 120_000;

const RECEIPT_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const STATEMENT_ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/csv',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const SECURITY_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

const RECEIPT_PROMPT = `
Carefully inspect this image of a receipt, cash slip, or digital payment proof (mobile banking, payment confirmation, or transfer receipt).
Read and extract the key transaction nominal and details into strict JSON:

Rules:
1. "totalAmount": The exact final total amount / nominal paid or received (pure number, no commas or currency symbols). Prioritize grand total / amount paid.
2. "merchantName": Official name of the store, merchant, or transfer recipient/sender.
3. "transactionDate": Date in YYYY-MM-DD format (or ISO-8601 if timestamp is visible).
4. "category": Choose one most accurate category from:
   - Expense categories (use when "type" is "expense"): "Food & Beverages", "Snacks", "Shopping", "Bills & Utilities", "Subscriptions", "Housing / Rent", "Internet & Phone", "Insurance", "Fitness & Gym", "Cloud & Storage", "Fuel", "Parking", "Vehicle Services", "Public Services", "Personal", "Home Services", "Furnishings", "Social", "Health & Medical", "Education", "Travel", "Others".
   - Income categories (use when "type" is "income"): "Salary", "Allowance", "Interest", "Investments", "Bonus", "Gift", "Others".
5. "type": "expense" for purchases/transfers sent, or "income" for incoming funds/deposits.
6. "currency": Detect whether the currency is "IDR" (Rupiah, Rp) or "USD" (Dollar, $).
7. "paymentMethod": e.g. "QRIS", "Debit Card", "Credit Card", "Cash", "Bank Transfer", "E-Wallet", or "E-Money".
8. "items": Extract ALL purchased products, services, or line items shown on the receipt as an array of objects:
   - "name": Clean item description / product name
   - "quantity": Number of units purchased (number, default 1)
   - "unitPrice": Price per single unit (pure number)
   - "totalPrice": Total line price (pure number)
   If no individual products or line items exist on the receipt (such as on a single-nominal QRIS payment proof, bank transfer screenshot, or parking slip), return an empty array [].
9. "taxAmount": Total tax / PPN amount if listed (number), otherwise 0.
10. "discountAmount": Total discount / promo amount if listed (number), otherwise 0.
`;

const RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    merchantName: { type: 'STRING' },
    transactionDate: { type: 'STRING' },
    category: { type: 'STRING' },
    type: { type: 'STRING', enum: ['expense', 'income'] },
    totalAmount: { type: 'NUMBER' },
    currency: { type: 'STRING', enum: ['IDR', 'USD'] },
    paymentMethod: { type: 'STRING' },
    taxAmount: { type: 'NUMBER' },
    discountAmount: { type: 'NUMBER' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          unitPrice: { type: 'NUMBER' },
          totalPrice: { type: 'NUMBER' },
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
};

const STATEMENT_PROMPT = `
Carefully read this bank, credit card, or e-wallet e-Statement / mutation history (mutasi rekening).
Extract the account header and EVERY individual transaction row into strict JSON.

Rules:
1. "bankName": Clean official short name of the bank, card issuer, or e-wallet (e.g. "SeaBank", "BCA", "Mandiri", "BNI", "BRI", "Bank Jago", "Blu", "Jenius", "BSI", "CIMB", "GoPay", "ShopeePay", "OVO", "DANA").
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
     * Expense categories: "Food & Beverages", "Snacks", "Shopping", "Bills & Utilities", "Subscriptions", "Housing / Rent", "Internet & Phone", "Insurance", "Fitness & Gym", "Cloud & Storage", "Fuel", "Parking", "Vehicle Services", "Public Services", "Personal", "Home Services", "Furnishings", "Social", "Health & Medical", "Education", "Travel", "Others"
     * Income categories: "Salary", "Allowance", "Interest", "Investments", "Bonus", "Gift", "Others"
   - "paymentMethod": e.g. "Bank Transfer", "QRIS", "Debit Card", "Credit Card", "E-Wallet", or "E-Money".
   - "notes": Keep the original bank description / reference code here for reference.
`;

const STATEMENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    bankName: { type: 'STRING' },
    accountNumber: { type: 'STRING' },
    accountType: {
      type: 'STRING',
      enum: ['Bank', 'E-Wallet', 'Credit Card', 'E-Money'],
    },
    currency: { type: 'STRING', enum: ['IDR', 'USD'] },
    periodLabel: { type: 'STRING' },
    openingBalance: { type: 'NUMBER' },
    closingBalance: { type: 'NUMBER' },
    transactions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          merchantName: { type: 'STRING' },
          transactionDate: { type: 'STRING' },
          transactionTime: { type: 'STRING' },
          type: { type: 'STRING', enum: ['expense', 'income'] },
          amount: { type: 'NUMBER' },
          category: { type: 'STRING' },
          paymentMethod: { type: 'STRING' },
          notes: { type: 'STRING' },
          cardIdentifier: { type: 'STRING' },
        },
        required: ['merchantName', 'transactionDate', 'type', 'amount', 'category'],
      },
    },
  },
  required: ['bankName', 'currency', 'transactions'],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function sanitizeFileName(raw) {
  if (typeof raw !== 'string') return 'statement';
  let clean = '';
  for (let i = 0; i < raw.length && clean.length < 120; i++) {
    const code = raw.charCodeAt(i);
    clean += code < 32 ? ' ' : raw[i];
  }
  return clean.trim() || 'statement';
}

function normalizeMimeType(raw) {
  const mime = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return mime === 'image/jpg' ? 'image/jpeg' : mime;
}

/**
 * Constant-CPU-time prefix/suffix base64 plausibility check so multi-MB payloads
 * do not burn Worker CPU budget on full-string regex passes.
 */
function isPlausibleBase64(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 32) return false;
  const head = trimmed.slice(0, 256);
  const tail = trimmed.slice(-64);
  const chunkPattern = /^[A-Za-z0-9+/\r\n=]+$/;
  return chunkPattern.test(head) && chunkPattern.test(tail);
}

/**
 * Compares two secrets via SHA-256 digests + constant-time byte XOR so
 * string lengths and prefixes are never leaked through timing side channels.
 */
async function timingSafeTokenEqual(expected, provided) {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

async function enforceRateLimit(request, env) {
  if (!env.SCAN_RATE_LIMITER || typeof env.SCAN_RATE_LIMITER.limit !== 'function') {
    return null;
  }
  const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
  const { success } = await env.SCAN_RATE_LIMITER.limit({ key: `ip:${clientIp}` });
  if (!success) {
    return jsonResponse(
      { error: 'Too many scan requests. Please wait a minute and try again.' },
      429,
      { 'Retry-After': '60' }
    );
  }
  return null;
}

async function verifyProxyToken(request, env) {
  const expectedToken = typeof env.PROXY_ACCESS_TOKEN === 'string'
    ? env.PROXY_ACCESS_TOKEN.trim()
    : '';
  if (!expectedToken) {
    return null;
  }
  const providedToken = (request.headers.get('X-REKA-Proxy-Token') || '').trim();
  if (!providedToken || !(await timingSafeTokenEqual(expectedToken, providedToken))) {
    return jsonResponse({ error: 'Unauthorized proxy access.' }, 401);
  }
  return null;
}

async function readJsonBody(request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return { errorResponse: jsonResponse({ error: 'Content-Type must be application/json.' }, 415) };
  }

  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return { errorResponse: jsonResponse({ error: 'Request payload is too large.' }, 413) };
    }
  }

  const rawText = await request.text();
  if (rawText.length > MAX_REQUEST_BYTES) {
    return { errorResponse: jsonResponse({ error: 'Request payload is too large.' }, 413) };
  }

  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { errorResponse: jsonResponse({ error: 'Request body must be a JSON object.' }, 400) };
    }
    return { body: parsed };
  } catch {
    return { errorResponse: jsonResponse({ error: 'Invalid JSON request body.' }, 400) };
  }
}

function trimIfNeeded(str) {
  if (typeof str !== 'string') return '';
  if (str.length === 0) return '';
  const first = str.charCodeAt(0);
  const last = str.charCodeAt(str.length - 1);
  if (first <= 32 || last <= 32) {
    return str.trim();
  }
  return str;
}

function buildGeminiTask(body) {
  const rawAction = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
  const action = rawAction || (body.base64Image ? 'receipt' : '');

  if (action === 'receipt') {
    const mimeType = normalizeMimeType(body.mimeType || 'image/jpeg');
    if (!RECEIPT_ALLOWED_MIMES.has(mimeType)) {
      return { errorResponse: jsonResponse({ error: 'Unsupported receipt image MIME type.' }, 400) };
    }
    const base64Image = trimIfNeeded(body.base64Image);
    if (!base64Image) {
      return { errorResponse: jsonResponse({ error: 'Missing receipt image data.' }, 400) };
    }
    if (base64Image.length > MAX_RECEIPT_BASE64_CHARS) {
      return { errorResponse: jsonResponse({ error: 'Receipt image exceeds maximum allowed size.' }, 413) };
    }
    if (!isPlausibleBase64(base64Image)) {
      return { errorResponse: jsonResponse({ error: 'Invalid receipt image encoding.' }, 400) };
    }

    return {
      action,
      totalBudgetMs: 27_000,
      modelTimeoutsMs: [9_000, 12_500],
      responseSchema: RECEIPT_SCHEMA,
      parts: [
        { text: RECEIPT_PROMPT },
        { inlineData: { data: base64Image, mimeType } },
      ],
    };
  }

  if (action === 'statement') {
    const mimeType = normalizeMimeType(body.mimeType || 'application/pdf');
    if (!STATEMENT_ALLOWED_MIMES.has(mimeType)) {
      return { errorResponse: jsonResponse({ error: 'Unsupported e-Statement MIME type.' }, 400) };
    }

    const safeFileName = sanitizeFileName(body.fileName);

    const textContent = typeof body.textContent === 'string'
      ? body.textContent.slice(0, MAX_STATEMENT_TEXT_CHARS).trim()
      : '';
    const base64 = trimIfNeeded(body.base64);

    const parts = [{ text: STATEMENT_PROMPT }];
    if (textContent) {
      parts.push({
        text: `CSV / Text Statement Content (${safeFileName}):\n${textContent}`,
      });
    } else if (base64) {
      if (base64.length > MAX_STATEMENT_BASE64_CHARS) {
        return {
          errorResponse: jsonResponse({ error: 'Statement file exceeds maximum allowed size.' }, 413),
        };
      }
      if (!isPlausibleBase64(base64)) {
        return { errorResponse: jsonResponse({ error: 'Invalid statement file encoding.' }, 400) };
      }
      parts.push({ inlineData: { data: base64, mimeType } });
    } else {
      return { errorResponse: jsonResponse({ error: 'Missing e-Statement file content.' }, 400) };
    }

    return {
      action,
      totalBudgetMs: 59_000,
      modelTimeoutsMs: [18_000, 22_000],
      responseSchema: STATEMENT_SCHEMA,
      parts,
    };
  }

  return { errorResponse: jsonResponse({ error: 'Unsupported scanner action.' }, 400) };
}

function getCandidateModels(env) {
  if (typeof env.GEMINI_MODELS === 'string' && env.GEMINI_MODELS.trim()) {
    const custom = env.GEMINI_MODELS
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (custom.length > 0) return custom;
  }
  return DEFAULT_CANDIDATE_MODELS;
}

function extractGeminiJsonText(apiResponse) {
  const parts = apiResponse?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  const combined = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
  return combined
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
}

function isTransientUpstreamFailure(status, errMessage) {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const lower = (errMessage || '').toLowerCase();
  return (
    lower.includes('demand') ||
    lower.includes('overload') ||
    lower.includes('quota') ||
    lower.includes('resource exhausted') ||
    lower.includes('unavailable') ||
    lower.includes('503') ||
    lower.includes('429')
  );
}

async function fetchGeminiWithTimeout(endpoint, apiKey, requestBody, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: requestBody,
      signal: controller.signal,
    });
    return { res, timedOut: false };
  } catch {
    return { res: null, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiWithCascade(env, task) {
  const apiKey = typeof env.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY.trim() : '';
  if (!apiKey) {
    return jsonResponse({ error: 'Scanner service is not configured on the server.' }, 500);
  }

  const models = getCandidateModels(env);
  const deadline = Date.now() + task.totalBudgetMs;
  let lastStatus = 502;
  let sawRateLimit = false;
  let sawTimeout = false;

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: task.parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: task.responseSchema,
    },
  });

  const maxAttemptsPerModel = models.length === 1 ? 2 : 1;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 0; attempt < maxAttemptsPerModel; attempt++) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 1_500) {
        return jsonResponse({ error: 'Scanner upstream request timed out.' }, 504);
      }

      const configuredCap = task.modelTimeoutsMs?.[i];
      const timeoutBudget =
        models.length - i > 1 && configuredCap
          ? Math.min(configuredCap, remainingMs)
          : remainingMs;

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const { res, timedOut } = await fetchGeminiWithTimeout(
        endpoint,
        apiKey,
        requestBody,
        timeoutBudget
      );

      if (!res) {
        if (timedOut) {
          sawTimeout = true;
          lastStatus = 504;
          // Never retry a timed-out model; fail over immediately to the next candidate
          break;
        }
        lastStatus = 502;
        if (attempt + 1 < maxAttemptsPerModel && deadline - Date.now() > 2_500) {
          await sleep(500);
          continue;
        }
        break;
      }

      if (res.ok) {
        const data = await res.json();
        const cleanedText = extractGeminiJsonText(data);
        if (cleanedText) {
          try {
            const parsed = JSON.parse(cleanedText);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return jsonResponse(parsed, 200);
            }
          } catch {
            // Try fallback model if response JSON was malformed
          }
        }
        lastStatus = 502;
        break;
      }

      lastStatus = res.status;
      if (res.status === 429) {
        sawRateLimit = true;
      }

      let errMessage = '';
      try {
        const errPayload = await res.json();
        errMessage = errPayload?.error?.message || '';
      } catch {
        errMessage = '';
      }

      if (
        isTransientUpstreamFailure(res.status, errMessage) &&
        attempt + 1 < maxAttemptsPerModel &&
        deadline - Date.now() > 2_500
      ) {
        await sleep(500);
        continue;
      }
      break;
    }
  }

  if (sawRateLimit || lastStatus === 429) {
    return jsonResponse(
      { error: 'Scanning service is temporarily busy. Please wait a moment and try again.' },
      429
    );
  }
  if (sawTimeout || lastStatus === 503 || lastStatus === 504) {
    return jsonResponse(
      { error: 'Scanning service is temporarily unavailable. Please try again shortly.' },
      lastStatus === 503 ? 503 : 504
    );
  }
  return jsonResponse(
    { error: 'Could not extract structured transaction data from the provided file.' },
    502
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return jsonResponse({ ok: true, service: 'reka-gemini-proxy' }, 200);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
    }

    const rateLimitResponse = await enforceRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;

    const authResponse = await verifyProxyToken(request, env);
    if (authResponse) return authResponse;

    const { body, errorResponse: bodyError } = await readJsonBody(request);
    if (bodyError) return bodyError;

    const task = buildGeminiTask(body);
    if (task.errorResponse) return task.errorResponse;

    return callGeminiWithCascade(env, task);
  },
};
