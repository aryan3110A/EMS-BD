export type ContainerCommercialInput = {
    incoterm?: string;
    fobPrice?: number;
    exchangeRate?: number;
    quantityMt?: number;
    totalFreight?: number;
    insurance?: number;
    fobDeduction?: number;
};
export type ContainerCommercialResult = {
    freightPerMt?: number;
    fobInrPerKg?: number;
    cifPrice?: number;
    cnfPrice?: number;
    originalCifCnfPrice?: number;
    currentCifCnfPrice?: number;
};
export declare class CalculationService {
    calculateContainers(totalMt: number, capacityMt?: number): number;
    calculateFobInrPerKg(fobPrice: number, exchangeRate: number, fobDeduction?: number): number;
    calculateFreightPerMt(totalFreight: number, containerMt: number): number;
    calculateCif(fob: number, freightPerMt?: number, insurance?: number): number;
    calculateCnf(fob: number, freightPerMt?: number): number;
    getShipmentHalf(date: Date): 'FIRST_HALF' | 'SECOND_HALF';
    formatShipmentMonth(date: Date): string;
    formatShipmentPeriodLabel(half: 'FIRST_HALF' | 'SECOND_HALF'): string;
    deriveShipmentFromDate(date: Date): {
        shipmentMonth: string;
        shipmentYear: number;
        shipmentHalf: "FIRST_HALF" | "SECOND_HALF";
    };
    enrichContainerCommercial(input: ContainerCommercialInput, fobDeduction?: number): ContainerCommercialResult;
    validateContainerQuantities(totalMt: number, containerMts: number[]): boolean;
}
