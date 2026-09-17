/** Production / Inventory / QC / Job Work constants (ERP Changes 10.09.26) */

export const ProcessType = {
  SORTEX: 'SORTEX',
  FULL_PROCESS: 'FULL_PROCESS',
} as const;
export type ProcessType = (typeof ProcessType)[keyof typeof ProcessType];

export const InputStockCategory = {
  NORMAL_RAW_MATERIAL: 'NORMAL_RAW_MATERIAL',
  EXISTING_PROCESSED_STOCK: 'EXISTING_PROCESSED_STOCK',
  SAMPLE_REJECTED_STOCK: 'SAMPLE_REJECTED_STOCK',
  WASTAGE_INVENTORY: 'WASTAGE_INVENTORY',
  JOB_WORK_RETURNED_PROCESSED: 'JOB_WORK_RETURNED_PROCESSED',
} as const;
export type InputStockCategory = (typeof InputStockCategory)[keyof typeof InputStockCategory];

export const StockCategory = {
  RAW_MATERIAL: 'RAW_MATERIAL',
  WIP_CLEANING: 'WIP_CLEANING',
  WIP_HULLING: 'WIP_HULLING',
  PROCESSED_AVAILABLE: 'PROCESSED_AVAILABLE',
  PROCESSED_RESERVED: 'PROCESSED_RESERVED',
  SAMPLE_REJECTED: 'SAMPLE_REJECTED',
  WASTAGE_INVENTORY: 'WASTAGE_INVENTORY',
  /** @deprecated use WASTAGE_INVENTORY — kept for historical ledger rows */
  WASTAGE_BY_PRODUCT: 'WASTAGE_BY_PRODUCT',
  STOCK_IN_TRANSIT: 'STOCK_IN_TRANSIT',
  MATERIAL_WITH_JOB_WORKER: 'MATERIAL_WITH_JOB_WORKER',
} as const;
export type StockCategory = (typeof StockCategory)[keyof typeof StockCategory];

export const ProductionSource = {
  IN_HOUSE: 'IN_HOUSE',
  JOB_WORK: 'JOB_WORK',
  WASTAGE_REPROCESSING: 'WASTAGE_REPROCESSING',
  SAMPLING_REJECTED_REPROCESSING: 'SAMPLING_REJECTED_REPROCESSING',
} as const;
export type ProductionSource = (typeof ProductionSource)[keyof typeof ProductionSource];

export const ProductionRunStatus = {
  DRAFT: 'DRAFT',
  CLEANING_IN_PROGRESS: 'CLEANING_IN_PROGRESS',
  CLEANING_RESULT_PENDING: 'CLEANING_RESULT_PENDING',
  CLEANING_COMPLETED: 'CLEANING_COMPLETED',
  HULLING_IN_PROGRESS: 'HULLING_IN_PROGRESS',
  HULLING_RESULT_PENDING: 'HULLING_RESULT_PENDING',
  HULLING_COMPLETED: 'HULLING_COMPLETED',
  AWAITING_FINALISATION: 'AWAITING_FINALISATION',
  /** @deprecated — fulfilment removed from runs */
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

export const WastageDisposition = {
  STORE: 'STORE',
  DISCARD: 'DISCARD',
} as const;
export type WastageDisposition = (typeof WastageDisposition)[keyof typeof WastageDisposition];

export const WastageLotStatus = {
  AVAILABLE: 'AVAILABLE',
  PARTIALLY_REPROCESSED: 'PARTIALLY_REPROCESSED',
  FULLY_REPROCESSED: 'FULLY_REPROCESSED',
  DISCARDED: 'DISCARDED',
  CLOSED: 'CLOSED',
} as const;
export type WastageLotStatus = (typeof WastageLotStatus)[keyof typeof WastageLotStatus];

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

export const JobWorkStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  MATERIAL_PARTIALLY_SENT: 'MATERIAL_PARTIALLY_SENT',
  MATERIAL_SENT: 'MATERIAL_SENT',
  PROCESSING: 'PROCESSING',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  AWAITING_REMAINING_MATERIAL: 'AWAITING_REMAINING_MATERIAL',
  AWAITING_RECONCILIATION: 'AWAITING_RECONCILIATION',
  READY_TO_CLOSE: 'READY_TO_CLOSE',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type JobWorkStatus = (typeof JobWorkStatus)[keyof typeof JobWorkStatus];

export const JobWorkReturnCategory = {
  PROCESSED: 'PROCESSED',
  UNPROCESSED: 'UNPROCESSED',
  WASTAGE: 'WASTAGE',
} as const;
export type JobWorkReturnCategory = (typeof JobWorkReturnCategory)[keyof typeof JobWorkReturnCategory];

export const JobWorkWastageDisposition = {
  RETURNED: 'RETURNED',
  DISCARDED_AT_WORKER: 'DISCARDED_AT_WORKER',
} as const;
export type JobWorkWastageDisposition =
  (typeof JobWorkWastageDisposition)[keyof typeof JobWorkWastageDisposition];

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
  WASTAGE_STORE: 'WASTAGE_STORE',
  WASTAGE_DISCARD: 'WASTAGE_DISCARD',
  WASTAGE_REPROCESS_ISSUE: 'WASTAGE_REPROCESS_ISSUE',
  JOB_WORK_OUTWARD: 'JOB_WORK_OUTWARD',
  JOB_WORK_INWARD_PROCESSED: 'JOB_WORK_INWARD_PROCESSED',
  JOB_WORK_INWARD_WASTAGE: 'JOB_WORK_INWARD_WASTAGE',
  JOB_WORK_INWARD_UNPROCESSED: 'JOB_WORK_INWARD_UNPROCESSED',
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

/** Countries that always require sampling regardless of EU classification */
export const SAMPLING_REQUIRED_COUNTRIES = ['RUSSIA', 'RU'] as const;

export function requiresSampling(
  euClassification?: string | null,
  destinationCountry?: string | null,
  productSamplingNormallyApplicable?: boolean | null,
): boolean {
  const eu = (euClassification || '').toUpperCase() === 'EU';
  const country = (destinationCountry || '').trim().toUpperCase();
  const russia =
    country === 'RUSSIA' ||
    country === 'RU' ||
    country.includes('RUSSIA');
  // Other Non-EU skip sampling unless the product is flagged for sampling.
  return eu || russia || !!productSamplingNormallyApplicable;
}

/** Convert UI quantity to kilograms for storage. Default unit is KG. */
export function toKg(quantity: number, unit?: string): number {
  const u = (unit || 'KG').toUpperCase();
  if (u === 'MT') return Math.round(quantity * KG_PER_MT * 1000) / 1000;
  return Math.round(quantity * 1000) / 1000;
}

export function fromKg(kg: number, unit?: string): number {
  const u = (unit || 'KG').toUpperCase();
  if (u === 'MT') return Math.round((kg / KG_PER_MT) * 1000) / 1000;
  return Math.round(kg * 1000) / 1000;
}
