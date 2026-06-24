import { Injectable, Logger } from '@nestjs/common';
import { EXCHANGE_RATE_SOURCES } from '../constants/commercial.constants';

export type ExchangeRateResult = {
  rate: number;
  source: string;
  fetchedAt: Date;
  fromCurrency: string;
  toCurrency: string;
};

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

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

    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);
      const data = (await res.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.[to];
      if (rate == null) throw new Error(`No rate for ${from} → ${to}`);

      return {
        rate,
        source: EXCHANGE_RATE_SOURCES.API,
        fetchedAt: new Date(),
        fromCurrency: from,
        toCurrency: to,
      };
    } catch (err) {
      this.logger.warn(`Exchange rate fetch failed: ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }
}
