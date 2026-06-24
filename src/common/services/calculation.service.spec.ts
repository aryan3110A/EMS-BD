import { CalculationService } from './calculation.service';
import { Incoterm } from '../constants/enums';

describe('CalculationService (Phase 1 PDF §24)', () => {
  const calc = new CalculationService();

  describe('Freight per MT', () => {
    it('divides total freight by container MT', () => {
      expect(calc.calculateFreightPerMt(2700, 27)).toBe(100);
    });

    it('returns 0 when container MT is zero', () => {
      expect(calc.calculateFreightPerMt(2700, 0)).toBe(0);
    });
  });

  describe('FOB INR per KG', () => {
    it('uses ((FOB - 70) × rate) / 1000', () => {
      // ((1900 - 70) × 83) / 1000 = 151.89
      expect(calc.calculateFobInrPerKg(1900, 83)).toBeCloseTo(151.89, 2);
    });
  });

  describe('CIF and CNF', () => {
    it('CIF = FOB + freight per MT + insurance', () => {
      expect(calc.calculateCif(1900, 100, 50)).toBe(2050);
    });

    it('CNF = FOB + freight per MT', () => {
      expect(calc.calculateCnf(1900, 100)).toBe(2000);
    });
  });

  describe('Shipment period', () => {
    it('First Half for days 1–15', () => {
      expect(calc.getShipmentHalf(new Date('2026-07-01'))).toBe('FIRST_HALF');
      expect(calc.getShipmentHalf(new Date('2026-07-15'))).toBe('FIRST_HALF');
    });

    it('Second Half for days 16–end', () => {
      expect(calc.getShipmentHalf(new Date('2026-07-16'))).toBe('SECOND_HALF');
      expect(calc.getShipmentHalf(new Date('2026-07-31'))).toBe('SECOND_HALF');
    });
  });

  describe('Shipment month', () => {
    it('formats as Mmm-YY from expected date', () => {
      expect(calc.formatShipmentMonth(new Date('2026-07-08'))).toBe('Jul-26');
    });
  });

  describe('enrichContainerCommercial', () => {
    it('does not calculate CIF in FOB mode', () => {
      const result = calc.enrichContainerCommercial({
        incoterm: Incoterm.FOB,
        fobPrice: 1900,
        exchangeRate: 83,
        quantityMt: 27,
        totalFreight: 2700,
        insurance: 50,
      });
      expect(result.cifPrice).toBeUndefined();
      expect(result.cnfPrice).toBeUndefined();
      expect(result.freightPerMt).toBeUndefined();
      expect(result.fobInrPerKg).toBeCloseTo(151.89, 2);
    });

    it('calculates CIF with freight per MT', () => {
      const result = calc.enrichContainerCommercial({
        incoterm: Incoterm.CIF,
        fobPrice: 1900,
        exchangeRate: 83,
        quantityMt: 27,
        totalFreight: 2700,
        insurance: 50,
      });
      expect(result.freightPerMt).toBe(100);
      expect(result.cifPrice).toBe(2050);
    });

    it('calculates CNF without insurance', () => {
      const result = calc.enrichContainerCommercial({
        incoterm: Incoterm.CNF,
        fobPrice: 1900,
        exchangeRate: 83,
        quantityMt: 27,
        totalFreight: 2700,
        insurance: 50,
      });
      expect(result.cnfPrice).toBe(2000);
      expect(result.cifPrice).toBeUndefined();
    });
  });

  describe('validateContainerQuantities', () => {
    it('passes when sum equals total', () => {
      expect(calc.validateContainerQuantities(56, [28, 28])).toBe(true);
    });

    it('fails when sum differs', () => {
      expect(calc.validateContainerQuantities(56, [28, 20])).toBe(false);
    });
  });
});
