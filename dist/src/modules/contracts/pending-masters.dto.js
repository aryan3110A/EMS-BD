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
exports.PendingMastersDto = exports.PendingPackagingSizeDto = exports.PendingPackagingTypeDto = exports.PendingProductVariantLinkDto = exports.PendingProductDto = exports.PendingProductVariantDto = exports.PendingBuyerDto = exports.PendingSalespersonDto = exports.PendingOfficeDto = exports.PendingCountryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class PendingCountryDto {
    id;
    name;
    euClassification;
}
exports.PendingCountryDto = PendingCountryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingCountryDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingCountryDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingCountryDto.prototype, "euClassification", void 0);
class PendingOfficeDto {
    id;
    name;
    city;
}
exports.PendingOfficeDto = PendingOfficeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingOfficeDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingOfficeDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingOfficeDto.prototype, "city", void 0);
class PendingSalespersonDto {
    id;
    name;
}
exports.PendingSalespersonDto = PendingSalespersonDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingSalespersonDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingSalespersonDto.prototype, "name", void 0);
class PendingBuyerDto {
    id;
    name;
    countryId;
}
exports.PendingBuyerDto = PendingBuyerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingBuyerDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingBuyerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingBuyerDto.prototype, "countryId", void 0);
class PendingProductVariantDto {
    id;
    name;
    code;
    processingType;
}
exports.PendingProductVariantDto = PendingProductVariantDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductVariantDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductVariantDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductVariantDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductVariantDto.prototype, "processingType", void 0);
class PendingProductDto {
    id;
    name;
    code;
    variants;
}
exports.PendingProductDto = PendingProductDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingProductVariantDto),
    __metadata("design:type", Array)
], PendingProductDto.prototype, "variants", void 0);
class PendingProductVariantLinkDto {
    id;
    productId;
    name;
    processingType;
}
exports.PendingProductVariantLinkDto = PendingProductVariantLinkDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductVariantLinkDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductVariantLinkDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductVariantLinkDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingProductVariantLinkDto.prototype, "processingType", void 0);
class PendingPackagingTypeDto {
    id;
    name;
    code;
}
exports.PendingPackagingTypeDto = PendingPackagingTypeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingPackagingTypeDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingPackagingTypeDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingPackagingTypeDto.prototype, "code", void 0);
class PendingPackagingSizeDto {
    id;
    packagingTypeId;
    label;
    weightKg;
    weightUnit;
    weightValue;
}
exports.PendingPackagingSizeDto = PendingPackagingSizeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingPackagingSizeDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingPackagingSizeDto.prototype, "packagingTypeId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingPackagingSizeDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PendingPackagingSizeDto.prototype, "weightKg", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PendingPackagingSizeDto.prototype, "weightUnit", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PendingPackagingSizeDto.prototype, "weightValue", void 0);
class PendingMastersDto {
    countries;
    offices;
    salespersons;
    buyers;
    products;
    productVariants;
    packagingTypes;
    packagingSizes;
}
exports.PendingMastersDto = PendingMastersDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingCountryDto),
    __metadata("design:type", Array)
], PendingMastersDto.prototype, "countries", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingOfficeDto),
    __metadata("design:type", Array)
], PendingMastersDto.prototype, "offices", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingSalespersonDto),
    __metadata("design:type", Array)
], PendingMastersDto.prototype, "salespersons", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingBuyerDto),
    __metadata("design:type", Array)
], PendingMastersDto.prototype, "buyers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingProductDto),
    __metadata("design:type", Array)
], PendingMastersDto.prototype, "products", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingProductVariantLinkDto),
    __metadata("design:type", Array)
], PendingMastersDto.prototype, "productVariants", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingPackagingTypeDto),
    __metadata("design:type", Array)
], PendingMastersDto.prototype, "packagingTypes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PendingPackagingSizeDto),
    __metadata("design:type", Array)
], PendingMastersDto.prototype, "packagingSizes", void 0);
//# sourceMappingURL=pending-masters.dto.js.map