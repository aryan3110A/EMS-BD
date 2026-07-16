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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const contracts_service_1 = require("./contracts.service");
const contracts_dto_1 = require("./contracts.dto");
const container_commercial_dto_1 = require("./container-commercial.dto");
const submit_contract_dto_1 = require("./submit-contract.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const enums_1 = require("../../common/constants/enums");
let ContractsController = class ContractsController {
    contractsService;
    constructor(contractsService) {
        this.contractsService = contractsService;
    }
    getDashboard(query, user) {
        return this.contractsService.getDashboardStats(user, query);
    }
    findAll(query, user) {
        return this.contractsService.findAll(query, user);
    }
    getExchangeRate(currency) {
        return this.contractsService.fetchExchangeRate(currency || 'USD');
    }
    getAllAudits(user) {
        return this.contractsService.getAllAudits(user);
    }
    getAudit(id, user) {
        return this.contractsService.getContractAudit(id, user);
    }
    findOne(id, user) {
        return this.contractsService.findOne(id, user);
    }
    submit(dto, user) {
        return this.contractsService.submit(dto, user);
    }
    create(dto, user) {
        return this.contractsService.create(dto, user);
    }
    update(id, dto, user) {
        return this.contractsService.update(id, dto, user);
    }
    amendCommercial(id, containerId, dto, user) {
        return this.contractsService.amendContainerCommercial(id, containerId, dto, user);
    }
    updateContainerStatus(id, containerId, status, remarks, user) {
        return this.contractsService.updateContainerStatus(id, containerId, status, user, remarks);
    }
    updateStatus(id, status, remarks, user) {
        return this.contractsService.updateStatus(id, status, user, remarks);
    }
};
exports.ContractsController = ContractsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [contracts_dto_1.DashboardQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [contracts_dto_1.ContractQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('exchange-rate'),
    __param(0, (0, common_1.Query)('currency')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "getExchangeRate", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN),
    (0, common_1.Get)('audit/all'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "getAllAudits", null);
__decorate([
    (0, common_1.Get)(':id/audit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "getAudit", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "findOne", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.CONTRACT_TEAM, enums_1.UserRole.SUPER_SALES),
    (0, common_1.Post)('submit'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [submit_contract_dto_1.SubmitContractDto, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "submit", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.CONTRACT_TEAM, enums_1.UserRole.SUPER_SALES),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [contracts_dto_1.CreateContractDto, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.CONTRACT_TEAM, enums_1.UserRole.SUPER_SALES),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, contracts_dto_1.UpdateContractDto, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "update", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.CONTRACT_TEAM, enums_1.UserRole.SUPER_SALES),
    (0, common_1.Patch)(':id/containers/:containerId/amend-commercial'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('containerId')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, container_commercial_dto_1.AmendContainerCommercialDto, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "amendCommercial", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.CONTRACT_TEAM, enums_1.UserRole.PRODUCTION_TEAM, enums_1.UserRole.SUPER_SALES),
    (0, common_1.Patch)(':id/containers/:containerId/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('containerId')),
    __param(2, (0, common_1.Body)('status')),
    __param(3, (0, common_1.Body)('remarks')),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "updateContainerStatus", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.CONTRACT_TEAM, enums_1.UserRole.PRODUCTION_TEAM, enums_1.UserRole.SUPER_SALES),
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Body)('remarks')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], ContractsController.prototype, "updateStatus", null);
exports.ContractsController = ContractsController = __decorate([
    (0, swagger_1.ApiTags)('Contracts'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('contracts'),
    __metadata("design:paramtypes", [contracts_service_1.ContractsService])
], ContractsController);
//# sourceMappingURL=contracts.controller.js.map