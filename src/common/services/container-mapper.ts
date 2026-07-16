import { Incoterm, InvoicePaymentStatus } from '../../common/constants/enums';
import type { CalculationService } from './calculation.service';
import type {
  ContainerProductLineDto,
  CreateContainerProductDto,
} from '../../modules/contracts/contracts.dto';

export type ContainerCreatePayload = ReturnType<typeof mapContainerDtoToCreateData>;

export function resolveContainerProductLines(
  c: CreateContainerProductDto,
): ContainerProductLineDto[] {
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

export function computeRemainingAmount(
  invoiceAmount?: number | null,
  receivedAmount?: number | null,
): number | null {
  if (invoiceAmount == null) return null;
  return Math.round((invoiceAmount - (receivedAmount ?? 0)) * 1000) / 1000;
}

export function derivePaymentStatus(params: {
  invoiceNumber?: string | null;
  invoiceAmount?: number | null;
  receivedAmount?: number | null;
  paymentReceived?: boolean;
  explicit?: string | null;
}): string {
  if (params.explicit && params.explicit !== InvoicePaymentStatus.NOT_RAISED) {
    return params.explicit;
  }
  const amount = params.invoiceAmount ?? 0;
  const received = params.receivedAmount ?? 0;
  if (!params.invoiceNumber && !amount) return InvoicePaymentStatus.NOT_RAISED;
  if (params.paymentReceived || (amount > 0 && received >= amount - 0.001)) {
    return InvoicePaymentStatus.RECEIVED;
  }
  if (received > 0 && received < amount) return InvoicePaymentStatus.PARTIAL;
  if (params.invoiceNumber || amount > 0) return InvoicePaymentStatus.PENDING;
  return InvoicePaymentStatus.NOT_RAISED;
}

export function mapContainerDtoToCreateData(
  c: CreateContainerProductDto,
  calc: CalculationService,
  fobDeduction: number,
  contractFallback?: Partial<CreateContainerProductDto>,
) {
  const merged = { ...contractFallback, ...c };
  const lines = resolveContainerProductLines(merged as CreateContainerProductDto);
  const primary = lines[0];
  const quantityMt =
    merged.quantityMt ??
    lines.reduce((s, p) => s + (p.quantityMt ?? 0), 0) ??
    0;

  const incoterm = (merged.incoterm ?? Incoterm.FOB).toUpperCase();

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

  const commercial = calc.enrichContainerCommercial(
    {
      incoterm,
      fobPrice: merged.fobPrice,
      exchangeRate: merged.exchangeRate,
      quantityMt,
      totalFreight: incoterm === Incoterm.FOB ? undefined : merged.totalFreight,
      insurance: incoterm === Incoterm.CIF ? merged.insurance : undefined,
      fobDeduction,
    },
    fobDeduction,
  );

  const invoiceAmount = merged.invoiceAmount ?? null;
  const receivedAmount = merged.receivedAmount ?? null;
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
    productId: primary?.productId ?? merged.productId!,
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
    totalFreight: incoterm === Incoterm.FOB ? null : merged.totalFreight ?? null,
    freightPerMt: commercial.freightPerMt ?? null,
    insurance: incoterm === Incoterm.CIF ? merged.insurance ?? null : null,
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
    productLines: lines,
  };
}
