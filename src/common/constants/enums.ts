export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OFFICE_ADMIN: 'OFFICE_ADMIN',
  CONTRACT_TEAM: 'CONTRACT_TEAM',
  SUPER_SALES: 'SUPER_SALES',
  PRODUCTION_TEAM: 'PRODUCTION_TEAM',
  INVENTORY_TEAM: 'INVENTORY_TEAM',
  ACCOUNTS_TEAM: 'ACCOUNTS_TEAM',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ContractStatus = {
  DRAFT: 'DRAFT',
  UNDER_PREPARATION: 'UNDER_PREPARATION',
  CONTRACT_SENT: 'CONTRACT_SENT',
  AWAITING_SIGNED: 'AWAITING_SIGNED',
  SIGNED_RECEIVED: 'SIGNED_RECEIVED',
  CONFIRMED_FOR_PRODUCTION: 'CONFIRMED_FOR_PRODUCTION',
  IN_PRODUCTION: 'IN_PRODUCTION',
  PARTIALLY_READY: 'PARTIALLY_READY',
  REACHED_PORT: 'REACHED_PORT',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  PARTIALLY_DISPATCHED: 'PARTIALLY_DISPATCHED',
  FULLY_DISPATCHED: 'FULLY_DISPATCHED',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  CANCELLED: 'CANCELLED',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

/** Container-wise status (PDF §10.4). Strings kept flexible for future production workflow. */
export const ContainerStatus = {
  DRAFT: 'DRAFT',
  UNDER_PREPARATION: 'UNDER_PREPARATION',
  PRODUCTION_ASSIGNED: 'PRODUCTION_ASSIGNED',
  UNDER_PROCESSING: 'UNDER_PROCESSING',
  PROCESSING_COMPLETED: 'PROCESSING_COMPLETED',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  DISPATCHED_FROM_FACTORY: 'DISPATCHED_FROM_FACTORY',
  REACHED_PORT: 'REACHED_PORT',
  SHIPPED: 'SHIPPED',
  COMPLETED: 'COMPLETED',
  ON_HOLD: 'ON_HOLD',
  CANCELLED: 'CANCELLED',
  /** Legacy aliases still accepted */
  PLANNED: 'PLANNED',
} as const;
export type ContainerStatus = (typeof ContainerStatus)[keyof typeof ContainerStatus];

export const InvoicePaymentStatus = {
  NOT_RAISED: 'NOT_RAISED',
  INVOICE_RAISED: 'INVOICE_RAISED',
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  RECEIVED: 'RECEIVED',
  OVERDUE: 'OVERDUE',
} as const;
export type InvoicePaymentStatus = (typeof InvoicePaymentStatus)[keyof typeof InvoicePaymentStatus];

export const PaymentType = {
  ADVANCE: 'ADVANCE',
  CAD: 'CAD',
  DIRECT: 'DIRECT',
  OTHERS: 'OTHERS',
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const Incoterm = { FOB: 'FOB', CIF: 'CIF', CNF: 'CNF' } as const;
export type Incoterm = (typeof Incoterm)[keyof typeof Incoterm];

export const EuClassification = { EU: 'EU', NON_EU: 'NON_EU' } as const;
export type EuClassification = (typeof EuClassification)[keyof typeof EuClassification];
