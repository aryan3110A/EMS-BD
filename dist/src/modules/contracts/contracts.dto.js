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
exports.ContractQueryDto = exports.UpdateContractDto = exports.CreateContractDto = exports.CreateContainerProductDto = exports.CreateLotDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const enums_1 = require("../../common/constants/enums");
const contractStatuses = Object.values(enums_1.ContractStatus);
const paymentTypes = Object.values(enums_1.PaymentType);
const incoterms = Object.values(enums_1.Incoterm);
const euTypes = Object.values(enums_1.EuClassification);
const fobUnits = ['PER_MT', 'PER_KG'];
const freightUnits = ['PER_CONTAINER', 'PER_MT', 'TOTAL_CONTRACT'];
const quantityUnits = ['MT', 'KG'];
class CreateLotDto {
    quantityMt;
    numberOfContainers;
    expectedShipmentDate;
    destinationPortId;
    remarks;
}
exports.CreateLotDto = CreateLotDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.001),
    __metadata("design:type", Number)
], CreateLotDto.prototype, "quantityMt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateLotDto.prototype, "numberOfContainers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateLotDto.prototype, "expectedShipmentDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLotDto.prototype, "destinationPortId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLotDto.prototype, "remarks", void 0);
class CreateContainerProductDto {
    containerIndex;
    productId;
    productVariantId;
    processingType;
    specification;
    productRemarks;
    quantityMt;
    containerNo;
    destinationPortId;
    expectedShipmentDate;
    shipmentMonth;
    shipmentYear;
    shipmentHalf;
}
exports.CreateContainerProductDto = CreateContainerProductDto;
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateContainerProductDto.prototype, "containerIndex", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "productVariantId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "processingType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "specification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "productRemarks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContainerProductDto.prototype, "quantityMt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "containerNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "destinationPortId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "expectedShipmentDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "shipmentMonth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContainerProductDto.prototype, "shipmentYear", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['FIRST_HALF', 'SECOND_HALF']),
    __metadata("design:type", String)
], CreateContainerProductDto.prototype, "shipmentHalf", void 0);
class CreateContractDto {
    officeId;
    contractNumber;
    contractSentDate;
    receivedDate;
    contractDate;
    signedContractReceivedDate;
    salespersonId;
    contractOnBehalfOf;
    invoiceNumber;
    remarks;
    internalRemarks;
    buyerId;
    euClassification;
    buyerRemarks;
    buyerLotNo;
    productId;
    productVariantId;
    processingType;
    totalMt;
    quantityUnit;
    specification;
    qualityRequirement;
    productRemarks;
    standardContainerMt;
    incoterm;
    fobPrice;
    fobCurrency;
    fobPriceUnit;
    freight;
    freightUnit;
    insurance;
    cifPrice;
    cifManualOverride;
    exchangeRate;
    originalContractPrice;
    amendmentPrice;
    amendmentCurrency;
    amendmentDate;
    amendmentReason;
    commercialRemarks;
    packagingTypeId;
    packagingSizeId;
    packingSizeValue;
    packingSizeUnit;
    packingDescription;
    paymentType;
    advancePercentage;
    balancePaymentMode;
    balancePaymentStage;
    paymentDescription;
    portOfLoadingId;
    destinationPortId;
    shipmentPeriodStart;
    shipmentPeriodEnd;
    numberOfContainers;
    shipmentMonth;
    shipmentYear;
    shipmentHalf;
    expectedShipmentDate;
    containerNo;
    status;
    lots;
    containerProducts;
}
exports.CreateContractDto = CreateContractDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "officeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "contractNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "contractSentDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "receivedDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "contractDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "signedContractReceivedDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "salespersonId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "contractOnBehalfOf", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "invoiceNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "remarks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "internalRemarks", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "buyerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(euTypes),
    __metadata("design:type", String)
], CreateContractDto.prototype, "euClassification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "buyerRemarks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "buyerLotNo", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "productVariantId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "processingType", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.001),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "totalMt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(quantityUnits),
    __metadata("design:type", String)
], CreateContractDto.prototype, "quantityUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "specification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "qualityRequirement", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "productRemarks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "standardContainerMt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(incoterms),
    __metadata("design:type", String)
], CreateContractDto.prototype, "incoterm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "fobPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "fobCurrency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(fobUnits),
    __metadata("design:type", String)
], CreateContractDto.prototype, "fobPriceUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "freight", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(freightUnits),
    __metadata("design:type", String)
], CreateContractDto.prototype, "freightUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "insurance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "cifPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateContractDto.prototype, "cifManualOverride", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "exchangeRate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "originalContractPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "amendmentPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "amendmentCurrency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "amendmentDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "amendmentReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "commercialRemarks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "packagingTypeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "packagingSizeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "packingSizeValue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "packingSizeUnit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "packingDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(paymentTypes),
    __metadata("design:type", String)
], CreateContractDto.prototype, "paymentType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "advancePercentage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "balancePaymentMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "balancePaymentStage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "paymentDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "portOfLoadingId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "destinationPortId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "shipmentPeriodStart", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "shipmentPeriodEnd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "numberOfContainers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "shipmentMonth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateContractDto.prototype, "shipmentYear", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['FIRST_HALF', 'SECOND_HALF']),
    __metadata("design:type", String)
], CreateContractDto.prototype, "shipmentHalf", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "expectedShipmentDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateContractDto.prototype, "containerNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(contractStatuses),
    __metadata("design:type", String)
], CreateContractDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateLotDto),
    __metadata("design:type", Array)
], CreateContractDto.prototype, "lots", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CreateContainerProductDto),
    __metadata("design:type", Array)
], CreateContractDto.prototype, "containerProducts", void 0);
class UpdateContractDto extends CreateContractDto {
}
exports.UpdateContractDto = UpdateContractDto;
class ContractQueryDto {
    officeId;
    status;
    salespersonId;
    buyerId;
    search;
    shipmentMonth;
}
exports.ContractQueryDto = ContractQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContractQueryDto.prototype, "officeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContractQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContractQueryDto.prototype, "salespersonId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContractQueryDto.prototype, "buyerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContractQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContractQueryDto.prototype, "shipmentMonth", void 0);
//# sourceMappingURL=contracts.dto.js.map