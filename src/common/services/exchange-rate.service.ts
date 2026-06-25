import { Injectable, Logger } from '@nestjs/common';
import { EXCHANGE_RATE_SOURCES } from '../constants/commercial.constants';

export type ExchangeRateResult = {
  rate: number;
  source: string;
  fetchedAt: Date;
  fromCurrency: string;
  toCurrency: string;
};

type CachedRate = ExchangeRateResult & { cachedAt: number };

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly cache = new Map<string, CachedRate>();

  /** Fetch latest rate from Frankfurter (free ECB data, no API key). */
  async fetchRate(fromCurrency: string, toCurrency = 'INR'): Promise<ExchangeRateResult> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) {
      return {
        rate: 1,
        source: EXCHANGE_RATE_SOURCES.API,
        fetchedAt: new Date(),
        fromCurrency: from,
        toCurrency: to,
      };
    }

    // Check in-memory cache first
    const cacheKey = `${from}_${to}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      this.logger.debug(`Exchange rate cache HIT for ${from}→${to}: ${cached.rate}`);
      return {
        rate: cached.rate,
        source: cached.source,
        fetchedAt: cached.fetchedAt,
        fromCurrency: cached.fromCurrency,
        toCurrency: cached.toCurrency,
      };
    }

    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);
      const data = (await res.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.[to];
      if (rate == null) throw new Error(`No rate for ${from} → ${to}`);

      const result: ExchangeRateResult = {
        rate,
        source: EXCHANGE_RATE_SOURCES.API,
        fetchedAt: new Date(),
        fromCurrency: from,
        toCurrency: to,
      };

      // Store in cache
      this.cache.set(cacheKey, { ...result, cachedAt: Date.now() });

      return result;
    } catch (err) {
      this.logger.warn(`Exchange rate fetch failed: ${err instanceof Error ? err.message : err}`);
      // Return stale cache if available on error
      if (cached) {
        this.logger.warn(`Returning stale cached rate for ${from}→${to}`);
        return {
          rate: cached.rate,
          source: `${cached.source} (cached)`,
          fetchedAt: cached.fetchedAt,
          fromCurrency: cached.fromCurrency,
          toCurrency: cached.toCurrency,
        };
      }
      throw err;
    }
  }
}
