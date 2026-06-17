export declare class CalculationService {
    calculateContainers(totalMt: number, capacityMt?: number): number;
    calculateFobInrPerKg(fobPrice: number, exchangeRate: number, unit?: string): number;
    calculateCif(fob: number, freight?: number, insurance?: number): number;
    getShipmentHalf(date: Date): 'FIRST_HALF' | 'SECOND_HALF';
    formatShipmentMonth(date: Date): string;
}
