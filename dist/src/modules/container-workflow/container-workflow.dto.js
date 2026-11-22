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
exports.SampleRecordUpdateDto = exports.ContainerWorkflowActionDto = void 0;
const class_validator_1 = require("class-validator");
const container_workflow_logic_1 = require("./container-workflow.logic");
class ContainerWorkflowActionDto {
    action;
    containerNo;
    factorySealNo;
    shippingLineName;
    shippingLineSealNo;
    samplingDate;
    samplingType;
    sampleReference;
    testingAgency;
    result;
    resultDate;
    resultReference;
    dispatchDate;
    shipmentDate;
    remarks;
    reason;
}
exports.ContainerWorkflowActionDto = ContainerWorkflowActionDto;
__decorate([
    (0, class_validator_1.IsIn)(Object.values(container_workflow_logic_1.WorkflowAction)),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "containerNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "factorySealNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "shippingLineName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "shippingLineSealNo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "samplingDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "samplingType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "sampleReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "testingAgency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['PASSED', 'FAILED']),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "result", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "resultDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "resultReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "dispatchDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "shipmentDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "remarks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], ContainerWorkflowActionDto.prototype, "reason", void 0);
class SampleRecordUpdateDto {
    step;
    samplingDate;
    samplingType;
    sampleReference;
    testingAgency;
    result;
    resultDate;
    resultReference;
    remarks;
}
exports.SampleRecordUpdateDto = SampleRecordUpdateDto;
__decorate([
    (0, class_validator_1.IsIn)(['SENT', 'AWAITING_RESULT', 'RESULT', 'APPROVE']),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "step", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "samplingDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "samplingType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "sampleReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "testingAgency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['PASSED', 'FAILED']),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "result", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "resultDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "resultReference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], SampleRecordUpdateDto.prototype, "remarks", void 0);
//# sourceMappingURL=container-workflow.dto.js.map