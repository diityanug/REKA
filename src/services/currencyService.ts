import { getSetting, setSetting } from './database';

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache window

export interface ExchangeRateResult {
  rate: number;
  lastUpdated: string;
  isLive: boolean;
  fromCache: boolean;
}

/**
 * Fetches the live USD to IDR exchange rate.
 * Uses a 6-hour SQLite cache for offline resilience and minimal network overhead.
 */
export async function getLiveExchangeRate(forceRefresh = false): Promise<ExchangeRateResult> {
  const cachedRateStr = await getSetting('usd_idr_rate', '16000');
  const cachedTimestamp = await getSetting('usd_idr_rate_updated_at', '');
  const cachedRate = Number(cachedRateStr) || 16000;

  const now = Date.now();
  const lastUpdatedTime = cachedTimestamp ? new Date(cachedTimestamp).getTime() : 0;
  const isCacheValid = !isNaN(lastUpdatedTime) && now - lastUpdatedTime < CACHE_TTL_MS;

  if (!forceRefresh && isCacheValid && cachedRate > 0) {
    return {
      rate: cachedRate,
      lastUpdated: cachedTimestamp,
      isLive: true,
      fromCache: true,
    };
  }

  // Fetch latest rate from open exchange rate API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(EXCHANGE_RATE_API_URL, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Exchange rate provider returned status ${response.status}`);
    }

    const data = await response.json();
    const rawRate = data?.rates?.IDR;

    if (typeof rawRate === 'number' && rawRate > 5000 && rawRate < 100000) {
      const roundedRate = Math.round(rawRate);
      const isoNow = new Date().toISOString();

      await setSetting('usd_idr_rate', String(roundedRate));
      await setSetting('usd_idr_rate_updated_at', isoNow);

      return {
        rate: roundedRate,
        lastUpdated: isoNow,
        isLive: true,
        fromCache: false,
      };
    }

    throw new Error('Invalid rate format received from provider');
  } catch {
    // Offline or network error: gracefully fall back to cached rate
    return {
      rate: cachedRate,
      lastUpdated: cachedTimestamp || new Date().toISOString(),
      isLive: false,
      fromCache: true,
    };
  }
}
