import { Incoterm } from '../../common/constants/enums';
import type { CalculationService } from './calculation.service';
import type { CreateContainerProductDto } from '../../modules/contracts/contracts.dto';

export type ContainerCreatePayload = ReturnType<typeof mapContainerDtoToCreateData>;

export function mapContainerDtoToCreateData(
  c: CreateContainerProductDto,
  calc: CalculationService,
  fobDeduction: number,
  contractFallback?: Partial<CreateContainerProductDto>,
) {
  const merged = { ...contractFallback, ...c };
  const incoterm = (merged.incoterm ?? Incoterm.FOB).toUpperCase();
  const quantityMt = merged.quantityMt ?? 0;

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

  return {
    containerIndex: merged.containerIndex,
    productId: merged.productId,
    productVariantId: merged.productVariantId || null,
    processingType: merged.processingType || null,
    specification: merged.specification || null,
    productRemarks: merged.productRemarks || null,
    quantityMt,
    containerNo: merged.containerNo || null,
    destinationPortId: merged.destinationPortId || null,
    expectedShipmentDate: merged.expectedShipmentDate ? new Date(merged.expectedShipmentDate) : null,
    shipmentMonth: shipmentMonth ?? null,
    shipmentYear: shipmentYear ?? null,
    shipmentHalf: shipmentHalf ?? null,
    packagingTypeId: merged.packagingTypeId || null,
    packagingSizeId: merged.packagingSizeId || null,
    packingDescription: merged.packingDescription || null,
    packingSizeValue: merged.packingSizeValue ?? null,
    packingSizeUnit: merged.packingSizeUnit || null,
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
  };
}
