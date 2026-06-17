"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EuClassification = exports.Incoterm = exports.PaymentType = exports.ContractStatus = exports.UserRole = void 0;
exports.UserRole = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    OFFICE_ADMIN: 'OFFICE_ADMIN',
    CONTRACT_TEAM: 'CONTRACT_TEAM',
    PRODUCTION_TEAM: 'PRODUCTION_TEAM',
    INVENTORY_TEAM: 'INVENTORY_TEAM',
    ACCOUNTS_TEAM: 'ACCOUNTS_TEAM',
};
exports.ContractStatus = {
    DRAFT: 'DRAFT',
    UNDER_PREPARATION: 'UNDER_PREPARATION',
    CONTRACT_SENT: 'CONTRACT_SENT',
    AWAITING_SIGNED: 'AWAITING_SIGNED',
    SIGNED_RECEIVED: 'SIGNED_RECEIVED',
    CONFIRMED_FOR_PRODUCTION: 'CONFIRMED_FOR_PRODUCTION',
    IN_PRODUCTION: 'IN_PRODUCTION',
    PARTIALLY_READY: 'PARTIALLY_READY',
    READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
    PARTIALLY_DISPATCHED: 'PARTIALLY_DISPATCHED',
    FULLY_DISPATCHED: 'FULLY_DISPATCHED',
    COMPLETED: 'COMPLETED',
    ON_HOLD: 'ON_HOLD',
    CANCELLED: 'CANCELLED',
};
exports.PaymentType = {
    ADVANCE: 'ADVANCE',
    CAD: 'CAD',
    DIRECT: 'DIRECT',
    OTHERS: 'OTHERS',
};
exports.Incoterm = { FOB: 'FOB', CIF: 'CIF', CNF: 'CNF' };
exports.EuClassification = { EU: 'EU', NON_EU: 'NON_EU' };
//# sourceMappingURL=enums.js.map