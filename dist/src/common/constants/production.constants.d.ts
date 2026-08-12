export declare const ProcessType: {
    readonly SORTEX: "SORTEX";
    readonly FULL_PROCESS: "FULL_PROCESS";
};
export type ProcessType = (typeof ProcessType)[keyof typeof ProcessType];
export declare const InputStockCategory: {
    readonly NORMAL_RAW_MATERIAL: "NORMAL_RAW_MATERIAL";
    readonly EXISTING_PROCESSED_STOCK: "EXISTING_PROCESSED_STOCK";
    readonly SAMPLE_REJECTED_STOCK: "SAMPLE_REJECTED_STOCK";
};
export type InputStockCategory = (typeof InputStockCategory)[keyof typeof InputStockCategory];
export declare const StockCategory: {
    readonly RAW_MATERIAL: "RAW_MATERIAL";
    readonly WIP_CLEANING: "WIP_CLEANING";
    readonly WIP_HULLING: "WIP_HULLING";
    readonly PROCESSED_AVAILABLE: "PROCESSED_AVAILABLE";
    readonly PROCESSED_RESERVED: "PROCESSED_RESERVED";
    readonly SAMPLE_REJECTED: "SAMPLE_REJECTED";
    readonly WASTAGE_BY_PRODUCT: "WASTAGE_BY_PRODUCT";
    readonly STOCK_IN_TRANSIT: "STOCK_IN_TRANSIT";
};
export type StockCategory = (typeof StockCategory)[keyof typeof StockCategory];
export declare const ProductionRunStatus: {
    readonly DRAFT: "DRAFT";
    readonly CLEANING_IN_PROGRESS: "CLEANING_IN_PROGRESS";
    readonly CLEANING_RESULT_PENDING: "CLEANING_RESULT_PENDING";
    readonly CLEANING_COMPLETED: "CLEANING_COMPLETED";
    readonly HULLING_IN_PROGRESS: "HULLING_IN_PROGRESS";
    readonly HULLING_RESULT_PENDING: "HULLING_RESULT_PENDING";
    readonly HULLING_COMPLETED: "HULLING_COMPLETED";
    readonly ALLOCATION_PENDING: "ALLOCATION_PENDING";
    readonly PARTIALLY_ALLOCATED: "PARTIALLY_ALLOCATED";
    readonly FULLY_ALLOCATED: "FULLY_ALLOCATED";
    readonly SAMPLING_PENDING: "SAMPLING_PENDING";
    readonly READY_FOR_DISPATCH: "READY_FOR_DISPATCH";
    readonly COMPLETED: "COMPLETED";
    readonly ON_HOLD: "ON_HOLD";
    readonly CANCELLED: "CANCELLED";
};
export type ProductionRunStatus = (typeof ProductionRunStatus)[keyof typeof ProductionRunStatus];
export declare const SamplingStatus: {
    readonly NOT_READY: "NOT_READY";
    readonly READY_FOR_SAMPLING: "READY_FOR_SAMPLING";
    readonly SAMPLE_COLLECTED: "SAMPLE_COLLECTED";
    readonly TESTING_IN_PROGRESS: "TESTING_IN_PROGRESS";
    readonly PASSED: "PASSED";
    readonly FAILED: "FAILED";
    readonly REPROCESSING_REQUIRED: "REPROCESSING_REQUIRED";
    readonly RESAMPLING_REQUIRED: "RESAMPLING_REQUIRED";
};
export type SamplingStatus = (typeof SamplingStatus)[keyof typeof SamplingStatus];
export declare const TransferStatus: {
    readonly DRAFT: "DRAFT";
    readonly APPROVED: "APPROVED";
    readonly DISPATCHED: "DISPATCHED";
    readonly IN_TRANSIT: "IN_TRANSIT";
    readonly RECEIVED: "RECEIVED";
    readonly CANCELLED: "CANCELLED";
};
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];
export declare const LedgerTxnType: {
    readonly RAW_MATERIAL_INWARD: "RAW_MATERIAL_INWARD";
    readonly PRODUCTION_ISSUE: "PRODUCTION_ISSUE";
    readonly ADDITIONAL_PRODUCTION_INPUT: "ADDITIONAL_PRODUCTION_INPUT";
    readonly CLEANING_WASTAGE: "CLEANING_WASTAGE";
    readonly TRANSFER_TO_HULLING: "TRANSFER_TO_HULLING";
    readonly HULLING_WASTAGE: "HULLING_WASTAGE";
    readonly PROCESSED_OUTPUT: "PROCESSED_OUTPUT";
    readonly CONTAINER_ALLOCATION: "CONTAINER_ALLOCATION";
    readonly CONTAINER_DEALLOCATION: "CONTAINER_DEALLOCATION";
    readonly PROCESSED_STOCK_BALANCE: "PROCESSED_STOCK_BALANCE";
    readonly SAMPLE_REJECTION: "SAMPLE_REJECTION";
    readonly SORTEX_REUSE: "SORTEX_REUSE";
    readonly PLANT_TRANSFER_OUT: "PLANT_TRANSFER_OUT";
    readonly PLANT_TRANSFER_IN: "PLANT_TRANSFER_IN";
    readonly STOCK_ADJUSTMENT: "STOCK_ADJUSTMENT";
    readonly TRANSACTION_REVERSAL: "TRANSACTION_REVERSAL";
};
export type LedgerTxnType = (typeof LedgerTxnType)[keyof typeof LedgerTxnType];
export declare const InwardTypeCode: {
    readonly DOMESTIC: "DOMESTIC";
    readonly INTERNATIONAL: "INTERNATIONAL";
    readonly OTHER: "OTHER";
};
export declare const WastageStage: {
    readonly CLEANING: "CLEANING";
    readonly HULLING: "HULLING";
};
export type WastageStage = (typeof WastageStage)[keyof typeof WastageStage];
export declare const RejectedStockStatus: {
    readonly AVAILABLE_FOR_SORTEX: "AVAILABLE_FOR_SORTEX";
    readonly PARTIALLY_USED: "PARTIALLY_USED";
    readonly FULLY_USED: "FULLY_USED";
    readonly UNDER_SORTEX: "UNDER_SORTEX";
    readonly TRANSFERRED: "TRANSFERRED";
    readonly CLOSED: "CLOSED";
};
export declare const WeightUnit: {
    readonly KG: "KG";
    readonly MT: "MT";
    readonly BAGS: "BAGS";
};
export declare const KG_PER_MT = 1000;
export declare const WASTAGE_ALERT_THRESHOLD_KEY = "HULLING_WASTAGE_ALERT_PCT";
export declare const DEFAULT_WASTAGE_ALERT_PCT = 12;
export declare const FULL_PROCESS_DEFAULT_PRODUCT_KEY = "FULL_PROCESS_DEFAULT_PRODUCT_ID";
export declare function toKg(quantity: number, unit: string): number;
export declare function fromKg(kg: number, unit: string): number;
