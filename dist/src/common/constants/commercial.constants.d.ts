export declare const PRODUCT_SPECIFICATIONS: readonly ["99.98%", "99.95%", "99.90%", "99%"];
export type ProductSpecification = (typeof PRODUCT_SPECIFICATIONS)[number];
export declare const FOB_DEDUCTION_SETTING_KEY = "FOB_DEDUCTION_AMOUNT";
export declare const DEFAULT_FOB_DEDUCTION = 70;
export declare const EXCHANGE_RATE_SOURCES: {
    readonly API: "API";
    readonly MANUAL: "MANUAL";
};
export declare const CONTAINER_STATUSES: {
    readonly DRAFT: "DRAFT";
    readonly UNDER_PREPARATION: "UNDER_PREPARATION";
    readonly PRODUCTION_ASSIGNED: "PRODUCTION_ASSIGNED";
    readonly UNDER_PROCESSING: "UNDER_PROCESSING";
    readonly PROCESSING_COMPLETED: "PROCESSING_COMPLETED";
    readonly READY_FOR_DISPATCH: "READY_FOR_DISPATCH";
    readonly DISPATCHED_FROM_FACTORY: "DISPATCHED_FROM_FACTORY";
    readonly REACHED_PORT: "REACHED_PORT";
    readonly SHIPPED: "SHIPPED";
    readonly COMPLETED: "COMPLETED";
    readonly ON_HOLD: "ON_HOLD";
    readonly CANCELLED: "CANCELLED";
    readonly PLANNED: "PLANNED";
};
export declare const AMENDMENT_ELIGIBLE_STATUSES: readonly ["REACHED_PORT", "READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED", "FULLY_DISPATCHED"];
