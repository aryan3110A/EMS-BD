export declare const UserRole: {
    readonly SUPER_ADMIN: "SUPER_ADMIN";
    readonly OFFICE_ADMIN: "OFFICE_ADMIN";
    readonly CONTRACT_TEAM: "CONTRACT_TEAM";
    readonly SUPER_SALES: "SUPER_SALES";
    readonly PRODUCTION_TEAM: "PRODUCTION_TEAM";
    readonly INVENTORY_TEAM: "INVENTORY_TEAM";
    readonly ACCOUNTS_TEAM: "ACCOUNTS_TEAM";
};
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export declare const ContractStatus: {
    readonly DRAFT: "DRAFT";
    readonly UNDER_PREPARATION: "UNDER_PREPARATION";
    readonly CONTRACT_SENT: "CONTRACT_SENT";
    readonly AWAITING_SIGNED: "AWAITING_SIGNED";
    readonly SIGNED_RECEIVED: "SIGNED_RECEIVED";
    readonly CONFIRMED_FOR_PRODUCTION: "CONFIRMED_FOR_PRODUCTION";
    readonly IN_PRODUCTION: "IN_PRODUCTION";
    readonly PARTIALLY_READY: "PARTIALLY_READY";
    readonly REACHED_PORT: "REACHED_PORT";
    readonly READY_FOR_DISPATCH: "READY_FOR_DISPATCH";
    readonly PARTIALLY_DISPATCHED: "PARTIALLY_DISPATCHED";
    readonly FULLY_DISPATCHED: "FULLY_DISPATCHED";
    readonly COMPLETED: "COMPLETED";
    readonly ON_HOLD: "ON_HOLD";
    readonly CANCELLED: "CANCELLED";
};
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];
export declare const ContainerStatus: {
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
export type ContainerStatus = (typeof ContainerStatus)[keyof typeof ContainerStatus];
export declare const InvoicePaymentStatus: {
    readonly NOT_RAISED: "NOT_RAISED";
    readonly INVOICE_RAISED: "INVOICE_RAISED";
    readonly PENDING: "PENDING";
    readonly PARTIAL: "PARTIAL";
    readonly RECEIVED: "RECEIVED";
    readonly OVERDUE: "OVERDUE";
};
export type InvoicePaymentStatus = (typeof InvoicePaymentStatus)[keyof typeof InvoicePaymentStatus];
export declare const PaymentType: {
    readonly ADVANCE: "ADVANCE";
    readonly CAD: "CAD";
    readonly DIRECT: "DIRECT";
    readonly OTHERS: "OTHERS";
};
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];
export declare const Incoterm: {
    readonly FOB: "FOB";
    readonly CIF: "CIF";
    readonly CNF: "CNF";
};
export type Incoterm = (typeof Incoterm)[keyof typeof Incoterm];
export declare const EuClassification: {
    readonly EU: "EU";
    readonly NON_EU: "NON_EU";
};
export type EuClassification = (typeof EuClassification)[keyof typeof EuClassification];
