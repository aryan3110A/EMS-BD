export declare const PRODUCT_SPECIFICATIONS: readonly ["99.98%", "99.95%", "99.90%", "99%"];
export type ProductSpecification = (typeof PRODUCT_SPECIFICATIONS)[number];
export declare const FOB_DEDUCTION_SETTING_KEY = "FOB_DEDUCTION_AMOUNT";
export declare const DEFAULT_FOB_DEDUCTION = 70;
export declare const EXCHANGE_RATE_SOURCES: {
    readonly API: "API";
    readonly MANUAL: "MANUAL";
};
export declare const CONTAINER_STATUSES: {
    readonly PLANNED: "PLANNED";
    readonly IN_PRODUCTION: "IN_PRODUCTION";
    readonly READY: "READY";
    readonly REACHED_PORT: "REACHED_PORT";
    readonly SHIPPED: "SHIPPED";
    readonly DISPATCHED: "DISPATCHED";
};
export declare const AMENDMENT_ELIGIBLE_STATUSES: readonly ["REACHED_PORT", "READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED", "FULLY_DISPATCHED"];
