import { Injectable } from '@nestjs/common';
import { Incoterm } from '../constants/enums';
import { DEFAULT_FOB_DEDUCTION } from '../constants/commercial.constants';

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

@Injectable()
export class CalculationService {
  calculateContainers(totalMt: number, capacityMt = 28): number {
    return Math.ceil(totalMt / capacityMt);
  }

  /** PDF §11.2: FOB INR per KG = ((FOB Price - deduction) × Exchange Rate) ÷ 1000 */
  calculateFobInrPerKg(
    fobPrice: number,
    exchangeRate: number,
    fobDeduction = DEFAULT_FOB_DEDUCTION,
  ): number {
    return ((fobPrice - fobDeduction) * exchangeRate) / 1000;
  }

  /** PDF §12.2: Freight per MT = Total Freight for Container ÷ Container MT */
  calculateFreightPerMt(totalFreight: number, containerMt: number): number {
    if (!containerMt || containerMt <= 0) return 0;
    return totalFreight / containerMt;
  }

  /** PDF §13.3: CIF = FOB + Freight per MT + Insurance */
  calculateCif(fob: number, freightPerMt = 0, insurance = 0): number {
    return fob + freightPerMt + insurance;
  }

  /** PDF §14.3: CNF = FOB + Freight per MT */
  calculateCnf(fob: number, freightPerMt = 0): number {
    return fob + freightPerMt;
  }

  getShipmentHalf(date: Date): 'FIRST_HALF' | 'SECOND_HALF' {
    return date.getDate() <= 15 ? 'FIRST_HALF' : 'SECOND_HALF';
  }

  formatShipmentMonth(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
  }

  formatShipmentPeriodLabel(half: 'FIRST_HALF' | 'SECOND_HALF'): string {
    return half === 'FIRST_HALF' ? 'First Half' : 'Second Half';
  }

  deriveShipmentFromDate(date: Date) {
    return {
      shipmentMonth: this.formatShipmentMonth(date),
      shipmentYear: date.getFullYear(),
      shipmentHalf: this.getShipmentHalf(date),
    };
  }

  /** Full container commercial calculation per PDF §24 */
  enrichContainerCommercial(
    input: ContainerCommercialInput,
    fobDeduction = DEFAULT_FOB_DEDUCTION,
  ): ContainerCommercialResult {
    const incoterm = (input.incoterm ?? Incoterm.FOB).toUpperCase();
    const fob = input.fobPrice ?? 0;
    const rate = input.exchangeRate ?? 0;
    const mt = input.quantityMt ?? 0;
    const totalFreight = input.totalFreight ?? 0;
    const insurance = input.insurance ?? 0;

    const freightPerMt =
      incoterm === Incoterm.FOB ? undefined : this.calculateFreightPerMt(totalFreight, mt);

    const fobInrPerKg =
      fob > 0 && rate > 0 ? this.calculateFobInrPerKg(fob, rate, fobDeduction) : undefined;

    let cifPrice: number | undefined;
    let cnfPrice: number | undefined;

    if (incoterm === Incoterm.CIF && freightPerMt != null) {
      cifPrice = this.calculateCif(fob, freightPerMt, insurance);
    } else if (incoterm === Incoterm.CNF && freightPerMt != null) {
      cnfPrice = this.calculateCnf(fob, freightPerMt);
    }

    const originalCifCnfPrice = cifPrice ?? cnfPrice;
    const currentCifCnfPrice = originalCifCnfPrice;

    return {
      freightPerMt,
      fobInrPerKg,
      cifPrice: incoterm === Incoterm.CIF ? cifPrice : undefined,
      cnfPrice: incoterm === Incoterm.CNF ? cnfPrice : undefined,
      originalCifCnfPrice,
      currentCifCnfPrice,
    };
  }

  validateContainerQuantities(totalMt: number, containerMts: number[]): boolean {
    const sum = containerMts.reduce((a, b) => a + b, 0);
    return Math.abs(sum - totalMt) < 0.001;
  }
}
