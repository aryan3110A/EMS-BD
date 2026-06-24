export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OFFICE_ADMIN: 'OFFICE_ADMIN',
  CONTRACT_TEAM: 'CONTRACT_TEAM',
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
