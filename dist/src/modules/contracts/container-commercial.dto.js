"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.incoterms = exports.AutosaveContractDto = exports.ExchangeRateQueryDto = exports.ManualExchangeRateDto = exports.AmendContainerCommercialDto = void 0;
const class_validator_1 = require("class-validator");
const enums_1 = require("../../common/constants/enums");
const incoterms = Object.values(enums_1.Incoterm);
exports.incoterms = incoterms;
class AmendContainerCommercialDto {
    reason;
    newPrice;
    currency;
}
exports.AmendContainerCommercialDto = AmendContainerCommercialDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AmendContainerCommercialDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AmendContainerCommercialDto.prototype, "newPrice", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AmendContainerCommercialDto.prototype, "currency", void 0);
class ManualExchangeRateDto {
    rate;
    currency;
}
exports.ManualExchangeRateDto = ManualExchangeRateDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.0001),
    __metadata("design:type", Number)
], ManualExchangeRateDto.prototype, "rate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ManualExchangeRateDto.prototype, "currency", void 0);
class ExchangeRateQueryDto {
    currency;
}
exports.ExchangeRateQueryDto = ExchangeRateQueryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ExchangeRateQueryDto.prototype, "currency", void 0);
class AutosaveContractDto {
}
exports.AutosaveContractDto = AutosaveContractDto;
//# sourceMappingURL=container-commercial.dto.js.map