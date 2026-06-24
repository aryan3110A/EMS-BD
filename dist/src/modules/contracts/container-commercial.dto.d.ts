declare const incoterms: ("FOB" | "CIF" | "CNF")[];
export declare class AmendContainerCommercialDto {
    reason: string;
    newPrice: number;
    currency: string;
}
export declare class ManualExchangeRateDto {
    rate: number;
    currency: string;
}
export declare class ExchangeRateQueryDto {
    currency: string;
}
export declare class AutosaveContractDto {
    [key: string]: unknown;
}
export { incoterms };
