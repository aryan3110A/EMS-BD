import { Injectable } from '@nestjs/common';

@Injectable()
export class CalculationService {
  calculateContainers(totalMt: number, capacityMt = 28): number {
    return Math.ceil(totalMt / capacityMt);
  }

  calculateFobInrPerKg(fobPrice: number, exchangeRate: number, unit = 'PER_MT'): number {
    if (unit === 'PER_MT') return (fobPrice * exchangeRate) / 1000;
    if (unit === 'PER_KG') return fobPrice * exchangeRate;
    return (fobPrice * exchangeRate) / 1000;
  }

  calculateCif(fob: number, freight = 0, insurance = 0): number {
    return fob + freight + insurance;
  }

  getShipmentHalf(date: Date): 'FIRST_HALF' | 'SECOND_HALF' {
    return date.getDate() <= 15 ? 'FIRST_HALF' : 'SECOND_HALF';
  }

  formatShipmentMonth(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
  }
}
