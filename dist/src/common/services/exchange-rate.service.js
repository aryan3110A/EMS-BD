"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ExchangeRateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeRateService = void 0;
const common_1 = require("@nestjs/common");
const commercial_constants_1 = require("../constants/commercial.constants");
const CACHE_TTL_MS = 30 * 60 * 1000;
let ExchangeRateService = ExchangeRateService_1 = class ExchangeRateService {
    logger = new common_1.Logger(ExchangeRateService_1.name);
    cache = new Map();
    async fetchRate(fromCurrency, toCurrency = 'INR') {
        const from = fromCurrency.toUpperCase();
        const to = toCurrency.toUpperCase();
        if (from === to) {
            return {
                rate: 1,
                source: commercial_constants_1.EXCHANGE_RATE_SOURCES.API,
                fetchedAt: new Date(),
                fromCurrency: from,
                toCurrency: to,
            };
        }
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
            if (!res.ok)
                throw new Error(`Exchange rate API returned ${res.status}`);
            const data = (await res.json());
            const rate = data.rates?.[to];
            if (rate == null)
                throw new Error(`No rate for ${from} → ${to}`);
            const result = {
                rate,
                source: commercial_constants_1.EXCHANGE_RATE_SOURCES.API,
                fetchedAt: new Date(),
                fromCurrency: from,
                toCurrency: to,
            };
            this.cache.set(cacheKey, { ...result, cachedAt: Date.now() });
            return result;
        }
        catch (err) {
            this.logger.warn(`Exchange rate fetch failed: ${err instanceof Error ? err.message : err}`);
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
};
exports.ExchangeRateService = ExchangeRateService;
exports.ExchangeRateService = ExchangeRateService = ExchangeRateService_1 = __decorate([
    (0, common_1.Injectable)()
], ExchangeRateService);
//# sourceMappingURL=exchange-rate.service.js.map