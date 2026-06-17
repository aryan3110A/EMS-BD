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
let CalculationService = class CalculationService {
    calculateContainers(totalMt, capacityMt = 28) {
        return Math.ceil(totalMt / capacityMt);
    }
    calculateFobInrPerKg(fobPrice, exchangeRate, unit = 'PER_MT') {
        if (unit === 'PER_MT')
            return (fobPrice * exchangeRate) / 1000;
        if (unit === 'PER_KG')
            return fobPrice * exchangeRate;
        return (fobPrice * exchangeRate) / 1000;
    }
    calculateCif(fob, freight = 0, insurance = 0) {
        return fob + freight + insurance;
    }
    getShipmentHalf(date) {
        return date.getDate() <= 15 ? 'FIRST_HALF' : 'SECOND_HALF';
    }
    formatShipmentMonth(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
    }
};
exports.CalculationService = CalculationService;
exports.CalculationService = CalculationService = __decorate([
    (0, common_1.Injectable)()
], CalculationService);
//# sourceMappingURL=calculation.service.js.map