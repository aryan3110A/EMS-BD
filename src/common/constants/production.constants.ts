/** Production / Inventory / QC constants (FRD) */

export const ProcessType = {
  SORTEX: 'SORTEX',
  FULL_PROCESS: 'FULL_PROCESS',
} as const;
export type ProcessType = (typeof ProcessType)[keyof typeof ProcessType];

export const InputStockCategory = {
  NORMAL_RAW_MATERIAL: 'NORMAL_RAW_MATERIAL',
  EXISTING_PROCESSED_STOCK: 'EXISTING_PROCESSED_STOCK',
  SAMPLE_REJECTED_STOCK: 'SAMPLE_REJECTED_STOCK',
} as const;
export type InputStockCategory = (typeof InputStockCategory)[keyof typeof InputStockCategory];

export const StockCategory = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  WIP_CLEANING: 'WIP_CLEANING',
  WIP_HULLING: 'WIP_HULLING',
  PROCESSED_AVAILABLE: 'PROCESSED_AVAILABLE',
  PROCESSED_RESERVED: 'PROCESSED_RESERVED',
  SAMPLE_REJECTED: 'SAMPLE_REJECTED',
  WASTAGE_BY_PRODUCT: 'WASTAGE_BY_PRODUCT',
  STOCK_IN_TRANSIT: 'STOCK_IN_TRANSIT',
} as const;
export type StockCategory = (typeof StockCategory)[keyof typeof StockCategory];

export const ProductionRunStatus = {
  DRAFT: 'DRAFT',
  CLEANING_IN_PROGRESS: 'CLEANING_IN_PROGRESS',
  CLEANING_RESULT_PENDING: 'CLEANING_RESULT_PENDING',
  CLEANING_COMPLETED: 'CLEANING_COMPLETED',
  HULLING_IN_PROGRESS: 'HULLING_IN_PROGRESS',
  HULLING_RESULT_PENDING: 'HULLING_RESULT_PENDING',
  HULLING_COMPLETED: 'HULLING_COMPLETED',
  ALLOCATION_PENDING: 'ALLOCATION_PENDING',
  PARTIALLY_ALLOCATED: 'PARTIALLY_ALLOCATED',
  FULLY_ALLOCATED: 'FULLY_ALLOCATED',
  SAMPLING_PENDING: 'SAMPLING_PENDING',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  CANCELLED: 'CANCELLED',
} as const;
export type ProductionRunStatus = (typeof ProductionRunStatus)[keyof typeof ProductionRunStatus];

export const SamplingStatus = {
  NOT_READY: 'NOT_READY',
  READY_FOR_SAMPLING: 'READY_FOR_SAMPLING',
  SAMPLE_COLLECTED: 'SAMPLE_COLLECTED',
  TESTING_IN_PROGRESS: 'TESTING_IN_PROGRESS',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  REPROCESSING_REQUIRED: 'REPROCESSING_REQUIRED',
  RESAMPLING_REQUIRED: 'RESAMPLING_REQUIRED',
} as const;
export type SamplingStatus = (typeof SamplingStatus)[keyof typeof SamplingStatus];

export const TransferStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  DISPATCHED: 'DISPATCHED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const LedgerTxnType = {
  RAW_MATERIAL_INWARD: 'RAW_MATERIAL_INWARD',
  PRODUCTION_ISSUE: 'PRODUCTION_ISSUE',
  ADDITIONAL_PRODUCTION_INPUT: 'ADDITIONAL_PRODUCTION_INPUT',
  CLEANING_WASTAGE: 'CLEANING_WASTAGE',
  TRANSFER_TO_HULLING: 'TRANSFER_TO_HULLING',
  HULLING_WASTAGE: 'HULLING_WASTAGE',
  PROCESSED_OUTPUT: 'PROCESSED_OUTPUT',
  CONTAINER_ALLOCATION: 'CONTAINER_ALLOCATION',
  CONTAINER_DEALLOCATION: 'CONTAINER_DEALLOCATION',
  PROCESSED_STOCK_BALANCE: 'PROCESSED_STOCK_BALANCE',
  SAMPLE_REJECTION: 'SAMPLE_REJECTION',
  SORTEX_REUSE: 'SORTEX_REUSE',
  PLANT_TRANSFER_OUT: 'PLANT_TRANSFER_OUT',
  PLANT_TRANSFER_IN: 'PLANT_TRANSFER_IN',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  TRANSACTION_REVERSAL: 'TRANSACTION_REVERSAL',
} as const;
export type LedgerTxnType = (typeof LedgerTxnType)[keyof typeof LedgerTxnType];

export const InwardTypeCode = {
  DOMESTIC: 'DOMESTIC',
  INTERNATIONAL: 'INTERNATIONAL',
  OTHER: 'OTHER',
} as const;

export const WastageStage = {
  CLEANING: 'CLEANING',
  HULLING: 'HULLING',
} as const;
export type WastageStage = (typeof WastageStage)[keyof typeof WastageStage];

export const RejectedStockStatus = {
  AVAILABLE_FOR_SORTEX: 'AVAILABLE_FOR_SORTEX',
  PARTIALLY_USED: 'PARTIALLY_USED',
  FULLY_USED: 'FULLY_USED',
  UNDER_SORTEX: 'UNDER_SORTEX',
  TRANSFERRED: 'TRANSFERRED',
  CLOSED: 'CLOSED',
} as const;

export const WeightUnit = {
  KG: 'KG',
  MT: 'MT',
  BAGS: 'BAGS',
} as const;

export const KG_PER_MT = 1000;

export const WASTAGE_ALERT_THRESHOLD_KEY = 'HULLING_WASTAGE_ALERT_PCT';
export const DEFAULT_WASTAGE_ALERT_PCT = 12;
export const FULL_PROCESS_DEFAULT_PRODUCT_KEY = 'FULL_PROCESS_DEFAULT_PRODUCT_ID';

/** Convert UI quantity to kilograms for storage. */
export function toKg(quantity: number, unit: string): number {
  const u = (unit || 'KG').toUpperCase();
  if (u === 'MT') return Math.round(quantity * KG_PER_MT * 1000) / 1000;
  return Math.round(quantity * 1000) / 1000;
}

export function fromKg(kg: number, unit: string): number {
  const u = (unit || 'KG').toUpperCase();
  if (u === 'MT') return Math.round((kg / KG_PER_MT) * 1000) / 1000;
  return Math.round(kg * 1000) / 1000;
}
