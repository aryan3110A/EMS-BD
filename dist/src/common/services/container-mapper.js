"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContainerProductLines = resolveContainerProductLines;
exports.computeRemainingAmount = computeRemainingAmount;
exports.derivePaymentStatus = derivePaymentStatus;
exports.mapContainerDtoToCreateData = mapContainerDtoToCreateData;
const enums_1 = require("../../common/constants/enums");
function resolveContainerProductLines(c) {
    if (c.products?.length) {
        return c.products.map((p, i) => ({
            ...p,
            productIndex: p.productIndex ?? i + 1,
        }));
    }
    if (c.productId) {
        return [
            {
                productIndex: 1,
                productId: c.productId,
                productVariantId: c.productVariantId,
                processingType: c.processingType,
                specification: c.specification,
                quantityMt: c.quantityMt ?? 0,
                packagingTypeId: c.packagingTypeId,
                packagingSizeId: c.packagingSizeId,
                packingDescription: c.packingDescription,
                packingSizeValue: c.packingSizeValue,
                packingSizeUnit: c.packingSizeUnit,
                productRemarks: c.productRemarks,
            },
        ];
    }
    return [];
}
function computeRemainingAmount(invoiceAmount, receivedAmount) {
    if (invoiceAmount == null)
        return null;
    return Math.round((invoiceAmount - (receivedAmount ?? 0)) * 100) / 100;
}
function derivePaymentStatus(params) {
    if (params.explicit && params.explicit !== enums_1.InvoicePaymentStatus.NOT_RAISED) {
        return params.explicit;
    }
    const amount = params.invoiceAmount ?? 0;
    const received = params.receivedAmount ?? 0;
    if (!params.invoiceNumber && !amount)
        return enums_1.InvoicePaymentStatus.NOT_RAISED;
    if (params.paymentReceived || (amount > 0 && received >= amount - 0.001)) {
        return enums_1.InvoicePaymentStatus.RECEIVED;
    }
    if (received > 0 && received < amount)
        return enums_1.InvoicePaymentStatus.PARTIAL;
    if (params.invoiceNumber || amount > 0)
        return enums_1.InvoicePaymentStatus.PENDING;
    return enums_1.InvoicePaymentStatus.NOT_RAISED;
}
function mapContainerDtoToCreateData(c, calc, fobDeduction, contractFallback) {
    const merged = { ...contractFallback, ...c };
    const lines = resolveContainerProductLines(merged);
    const primary = lines[0];
    const quantityMt = Math.round((merged.quantityMt ??
        lines.reduce((s, p) => s + (p.quantityMt ?? 0), 0) ??
        0) * 1000) / 1000;
    const invoiceAmount = merged.invoiceAmount == null ? null : Math.round(merged.invoiceAmount * 100) / 100;
    const receivedAmount = merged.receivedAmount == null ? null : Math.round(merged.receivedAmount * 100) / 100;
    const incoterm = (merged.incoterm ?? enums_1.Incoterm.FOB).toUpperCase();
    let shipmentMonth = merged.shipmentMonth;
    let shipmentYear = merged.shipmentYear;
    let shipmentHalf = merged.shipmentHalf;
    if (merged.expectedShipmentDate) {
        const d = new Date(merged.expectedShipmentDate);
        const derived = calc.deriveShipmentFromDate(d);
        shipmentMonth = derived.shipmentMonth;
        shipmentYear = derived.shipmentYear;
        shipmentHalf = derived.shipmentHalf;
    }
    const commercial = calc.enrichContainerCommercial({
        incoterm,
        fobPrice: merged.fobPrice,
        exchangeRate: merged.exchangeRate,
        quantityMt,
        totalFreight: incoterm === enums_1.Incoterm.FOB ? undefined : merged.totalFreight,
        insurance: incoterm === enums_1.Incoterm.CIF ? merged.insurance : undefined,
        fobDeduction,
    }, fobDeduction);
    const remainingAmount = computeRemainingAmount(invoiceAmount, receivedAmount);
    const paymentStatus = derivePaymentStatus({
        invoiceNumber: merged.invoiceNumber,
        invoiceAmount,
        receivedAmount,
        paymentReceived: merged.paymentReceived,
        explicit: merged.paymentStatus,
    });
    return {
        containerIndex: merged.containerIndex,
        productId: primary?.productId ?? merged.productId,
        productVariantId: primary?.productVariantId || merged.productVariantId || null,
        processingType: primary?.processingType || merged.processingType || null,
        specification: primary?.specification || merged.specification || null,
        productRemarks: primary?.productRemarks || merged.productRemarks || null,
        quantityMt,
        containerNo: merged.containerNo || null,
        factorySealNo: merged.factorySealNo || null,
        shippingLineSealNo: merged.shippingLineSealNo || null,
        destinationPortId: merged.destinationPortId || null,
        expectedShipmentDate: merged.expectedShipmentDate ? new Date(merged.expectedShipmentDate) : null,
        shipmentMonth: shipmentMonth ?? null,
        shipmentYear: shipmentYear ?? null,
        shipmentHalf: shipmentHalf ?? null,
        packagingTypeId: primary?.packagingTypeId || merged.packagingTypeId || null,
        packagingSizeId: primary?.packagingSizeId || merged.packagingSizeId || null,
        packingDescription: primary?.packingDescription || merged.packingDescription || null,
        packingSizeValue: primary?.packingSizeValue ?? merged.packingSizeValue ?? null,
        packingSizeUnit: primary?.packingSizeUnit || merged.packingSizeUnit || null,
        incoterm,
        fobPrice: merged.fobPrice ?? null,
        fobCurrency: merged.fobCurrency ?? 'USD',
        exchangeRate: merged.exchangeRate ?? null,
        exchangeRateAt: merged.exchangeRateAt ? new Date(merged.exchangeRateAt) : null,
        exchangeRateSource: merged.exchangeRateSource ?? null,
        exchangeRateManual: merged.exchangeRateManual ?? false,
        fobInrPerKg: commercial.fobInrPerKg ?? null,
        totalFreight: incoterm === enums_1.Incoterm.FOB ? null : merged.totalFreight ?? null,
        freightPerMt: commercial.freightPerMt ?? null,
        insurance: incoterm === enums_1.Incoterm.CIF ? merged.insurance ?? null : null,
        cifPrice: commercial.cifPrice ?? null,
        cnfPrice: commercial.cnfPrice ?? null,
        originalCifCnfPrice: commercial.originalCifCnfPrice ?? null,
        currentCifCnfPrice: commercial.currentCifCnfPrice ?? null,
        commercialRemarks: merged.commercialRemarks || null,
        invoiceNumber: merged.invoiceNumber || null,
        invoiceAmount,
        invoiceDate: merged.invoiceDate ? new Date(merged.invoiceDate) : null,
        paymentReceived: merged.paymentReceived ?? false,
        paymentStatus,
        receivedAmount,
        remainingAmount,
        paymentRemarks: merged.paymentRemarks || null,
        containerStatus: merged.containerStatus || 'DRAFT',
        productLines: lines.map((l) => ({
            ...l,
            quantityMt: Math.round((l.quantityMt ?? 0) * 1000) / 1000,
        })),
    };
}
//# sourceMappingURL=container-mapper.js.map