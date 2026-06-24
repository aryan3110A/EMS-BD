export type ExchangeRateResult = {
    rate: number;
    source: string;
    fetchedAt: Date;
    fromCurrency: string;
    toCurrency: string;
};
export declare class ExchangeRateService {
    private readonly logger;
    fetchRate(fromCurrency: string, toCurrency?: string): Promise<ExchangeRateResult>;
}
