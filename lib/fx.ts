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
    rates[k] = baseToTwd / vToTwd;
  }
  return rates;
}

// Re-export from the client-safe module
export { SUPPORTED_CURRENCIES } from "./currencies";

/**
 * Fetch rates using USD as the pivot currency (works with free plan).
 * Converts USD-based rates to any baseCurrency perspective.
 */
async function fetchRatesViaUsd(apiKey: string, baseCurrency: string): Promise<Record<string, number> | null> {
  // Check USD cache first
  const now = Date.now();
  const usdCached = FX_CACHE["USD"];
  let usdRates: Record<string, number>;

  if (usdCached && now - usdCached.fetchedAt < CACHE_TTL_MS) {
    usdRates = usdCached.rates;
  } else {
    try {
      const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`);
      const data = await res.json();
      if (data.result !== "success") return null;
      usdRates = data.conversion_rates;
      FX_CACHE["USD"] = { rates: usdRates, fetchedAt: now };
    } catch {
      return null;
    }
  }

  // Convert: usdRates[X] = "1 USD = X units"
  // We want: rates[X] = "1 baseCurrency = X units"
  // Formula: rates[X] = usdRates[X] / usdRates[baseCurrency]
  const baseInUsd = usdRates[baseCurrency];
  if (!baseInUsd) return null;

  const rates: Record<string, number> = {};
  for (const [k, v] of Object.entries(usdRates)) {
    rates[k] = v / baseInUsd;
  }
  return rates;
}

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

  // Use USD as pivot — works on free plan
  const rates = await fetchRatesViaUsd(apiKey, baseCurrency);
  if (rates) {
    FX_CACHE[baseCurrency] = { rates, fetchedAt: now };
    return rates;
  }

  // All failed — use static fallback
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
