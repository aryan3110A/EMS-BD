"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculationService = void 0;
const common_1 = require("@nestjs/common");
const enums_1 = require("../constants/enums");
const commercial_constants_1 = require("../constants/commercial.constants");
let CalculationService = class CalculationService {
    calculateContainers(totalMt, capacityMt = 28) {
        return Math.ceil(totalMt / capacityMt);
    }
    calculateFobInrPerKg(fobPrice, exchangeRate, fobDeduction = commercial_constants_1.DEFAULT_FOB_DEDUCTION) {
        return ((fobPrice - fobDeduction) * exchangeRate) / 1000;
    }
    calculateFreightPerMt(totalFreight, containerMt) {
        if (!containerMt || containerMt <= 0)
            return 0;
        return totalFreight / containerMt;
    }
    calculateCif(fob, freightPerMt = 0, insurance = 0) {
        return fob + freightPerMt + insurance;
    }
    calculateCnf(fob, freightPerMt = 0) {
        return fob + freightPerMt;
    }
    getShipmentHalf(date) {
        return date.getDate() <= 15 ? 'FIRST_HALF' : 'SECOND_HALF';
    }
    formatShipmentMonth(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
    }
    formatShipmentPeriodLabel(half) {
        return half === 'FIRST_HALF' ? 'First Half' : 'Second Half';
    }
    deriveShipmentFromDate(date) {
        return {
            shipmentMonth: this.formatShipmentMonth(date),
            shipmentYear: date.getFullYear(),
            shipmentHalf: this.getShipmentHalf(date),
        };
    }
    enrichContainerCommercial(input, fobDeduction = commercial_constants_1.DEFAULT_FOB_DEDUCTION) {
        const incoterm = (input.incoterm ?? enums_1.Incoterm.FOB).toUpperCase();
        const fob = input.fobPrice ?? 0;
        const rate = input.exchangeRate ?? 0;
        const mt = input.quantityMt ?? 0;
        const totalFreight = input.totalFreight ?? 0;
        const insurance = input.insurance ?? 0;
        const freightPerMt = incoterm === enums_1.Incoterm.FOB ? undefined : this.calculateFreightPerMt(totalFreight, mt);
        const fobInrPerKg = fob > 0 && rate > 0 ? this.calculateFobInrPerKg(fob, rate, fobDeduction) : undefined;
        let cifPrice;
        let cnfPrice;
        if (incoterm === enums_1.Incoterm.CIF && freightPerMt != null) {
            cifPrice = this.calculateCif(fob, freightPerMt, insurance);
        }
        else if (incoterm === enums_1.Incoterm.CNF && freightPerMt != null) {
            cnfPrice = this.calculateCnf(fob, freightPerMt);
        }
        const originalCifCnfPrice = cifPrice ?? cnfPrice;
        const currentCifCnfPrice = originalCifCnfPrice;
        return {
            freightPerMt,
            fobInrPerKg,
            cifPrice: incoterm === enums_1.Incoterm.CIF ? cifPrice : undefined,
            cnfPrice: incoterm === enums_1.Incoterm.CNF ? cnfPrice : undefined,
            originalCifCnfPrice,
            currentCifCnfPrice,
        };
    }
    validateContainerQuantities(totalMt, containerMts) {
        const sum = containerMts.reduce((a, b) => a + b, 0);
        return Math.abs(sum - totalMt) < 0.001;
    }
};
exports.CalculationService = CalculationService;
exports.CalculationService = CalculationService = __decorate([
    (0, common_1.Injectable)()
], CalculationService);
//# sourceMappingURL=calculation.service.js.map