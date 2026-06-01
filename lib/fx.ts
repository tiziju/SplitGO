const FX_CACHE: Record<string, { rates: Record<string, number>; fetchedAt: number }> = {};
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Fallback static rates (TWD base) for when API is unavailable
const FALLBACK_RATES: Record<string, number> = {
  TWD: 1,
  USD: 32.5,
  JPY: 0.217,
  EUR: 35.2,
  GBP: 41.0,
  KRW: 0.024,
  HKD: 4.17,
  SGD: 24.0,
  AUD: 21.5,
  CNY: 4.5,
  THB: 0.92,
};

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
    // Return fallback rates relative to TWD
    const rates: Record<string, number> = {};
    if (baseCurrency === "TWD") {
      for (const [k, v] of Object.entries(FALLBACK_RATES)) {
        rates[k] = 1 / v;
      }
      rates["TWD"] = 1;
    } else {
      const baseInTwd = FALLBACK_RATES[baseCurrency] ?? 1;
      for (const [k, v] of Object.entries(FALLBACK_RATES)) {
        rates[k] = baseInTwd / v;
      }
    }
    return rates;
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

  return FALLBACK_RATES;
}

/**
 * Convert amount from sourceCurrency to targetCurrency (TWD by default).
 * Returns { convertedAmount, fxRate } where fxRate is source→target.
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
