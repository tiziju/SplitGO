const FX_CACHE: Record<string, { rates: Record<string, number>; fetchedAt: number }> = {};
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Fallback rates: 1 unit of foreign currency = X TWD (updated 2026-06)
const FALLBACK_RATES_TO_TWD: Record<string, number> = {
  TWD: 1,
  USD: 30.5,
  JPY: 0.21,
  EUR: 33.5,
  GBP: 39.0,
  KRW: 0.023,
  HKD: 3.9,
  SGD: 23.0,
  AUD: 20.0,
  CNY: 4.2,
  THB: 0.88,
};

/**
 * Compute fallback rates from `baseCurrency` perspective.
 * rates[X] = "how many X per 1 unit of baseCurrency"
 */
function computeFallbackRates(baseCurrency: string): Record<string, number> {
  const baseToTwd = FALLBACK_RATES_TO_TWD[baseCurrency] ?? 1;
  const rates: Record<string, number> = {};
  for (const [k, vToTwd] of Object.entries(FALLBACK_RATES_TO_TWD)) {
    // 1 baseCurrency = baseToTwd TWD = baseToTwd / vToTwd units of k
    rates[k] = baseToTwd / vToTwd;
  }
  return rates;
}

// Re-export from the client-safe module
export { SUPPORTED_CURRENCIES } from "./currencies";

export async function getFxRates(baseCurrency = "TWD"): Promise<Record<string, number>> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const now = Date.now();
  const cached = FX_CACHE[baseCurrency];

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  if (!apiKey || apiKey === "your-api-key-here") {
    return computeFallbackRates(baseCurrency);
  }

  try {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
    );
    const data = await res.json();
    if (data.result === "success") {
      FX_CACHE[baseCurrency] = { rates: data.conversion_rates, fetchedAt: now };
      return data.conversion_rates;
    }
  } catch {
    // fall through to fallback
  }

  // API failed — compute proper fallback rates
  return computeFallbackRates(baseCurrency);
}

/**
 * Convert amount from sourceCurrency to baseCurrency (TWD by default).
 * Returns { convertedAmount, fxRate } where fxRate is source→base.
 */
export async function convertToBase(
  amount: number,
  sourceCurrency: string,
  baseCurrency = "TWD",
  customFxRate?: number
): Promise<{ convertedAmount: number; fxRate: number }> {
  if (sourceCurrency === baseCurrency) {
    return { convertedAmount: amount, fxRate: 1 };
  }

  if (customFxRate != null) {
    return {
      convertedAmount: Math.round(amount * customFxRate * 100) / 100,
      fxRate: customFxRate,
    };
  }

  const rates = await getFxRates(sourceCurrency);
  const fxRate = rates[baseCurrency] ?? 1;
  return {
    convertedAmount: Math.round(amount * fxRate * 100) / 100,
    fxRate,
  };
}
