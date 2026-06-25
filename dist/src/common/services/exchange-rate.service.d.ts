export type ExchangeRateResult = {
    rate: number;
    source: string;
    fetchedAt: Date;
    fromCurrency: string;
    toCurrency: string;
};
export declare class ExchangeRateService {
    private readonly logger;
    private readonly cache;
    fetchRate(fromCurrency: string, toCurrency?: string): Promise<ExchangeRateResult>;
}
