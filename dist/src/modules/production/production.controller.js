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
exports.ProductionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const enums_1 = require("../../common/constants/enums");
const production_service_1 = require("./production.service");
const production_dto_1 = require("./production.dto");
const PROD_ROLES = [
    enums_1.UserRole.SUPER_ADMIN,
    enums_1.UserRole.OFFICE_ADMIN,
    enums_1.UserRole.PRODUCTION_TEAM,
    enums_1.UserRole.INVENTORY_TEAM,
];
const PRODUCTION_OPS = [
    enums_1.UserRole.SUPER_ADMIN,
    enums_1.UserRole.OFFICE_ADMIN,
    enums_1.UserRole.PRODUCTION_TEAM,
];
const INVENTORY_OPS = [
    enums_1.UserRole.SUPER_ADMIN,
    enums_1.UserRole.OFFICE_ADMIN,
    enums_1.UserRole.PRODUCTION_TEAM,
    enums_1.UserRole.INVENTORY_TEAM,
];
const READ_ROLES = [
    ...PROD_ROLES,
    enums_1.UserRole.CONTRACT_TEAM,
    enums_1.UserRole.SUPER_SALES,
    enums_1.UserRole.ACCOUNTS_TEAM,
];
let ProductionController = class ProductionController {
    production;
    constructor(production) {
        this.production = production;
    }
    locations() {
        return this.production.listLocations();
    }
    settings() {
        return this.production.getSettings();
    }
    suppliers() {
        return this.production.listSuppliers();
    }
    createSupplier(dto) {
        return this.production.createSupplier(dto);
    }
    inwardTypes() {
        return this.production.listInwardTypes();
    }
    wastageTypes(stage) {
        return this.production.listWastageTypes(stage);
    }
    createInward(dto, user) {
        return this.production.createInward(dto, user);
    }
    listInwards(query) {
        return this.production.listInwards(query);
    }
    balances(locationId, productId, stockCategory) {
        return this.production.getBalances({ locationId, productId, stockCategory });
    }
    ledger(productId) {
        return this.production.getLedger({ productId });
    }
    pendingContracts() {
        return this.production.getPendingContracts();
    }
    listRuns() {
        return this.production.listRuns();
    }
    startRun(dto, user) {
        return this.production.startRun(dto, user);
    }
    getRun(id) {
        return this.production.getRun(id);
    }
    addInput(id, dto, user) {
        return this.production.addInput(id, dto, user);
    }
    reopenCleaning(id, body, user) {
        return this.production.reopenCleaning(id, user, body?.reason);
    }
    cleaning(id, dto, user) {
        return this.production.submitCleaning(id, dto, user);
    }
    hulling(id, dto, user) {
        return this.production.submitHulling(id, dto, user);
    }
    allocate(id, dto, user) {
        return this.production.allocateToContainer(id, dto, user);
    }
    storeProcessed(id, dto, user) {
        return this.production.storeRemainingProcessed(id, dto, user);
    }
    fromStock(dto, user) {
        return this.production.allocateFromProcessedStock(dto, user);
    }
    processedLots() {
        return this.production.listProcessedLots();
    }
    samples() {
        return this.production.listSamples();
    }
    updateSample(id, dto, user) {
        return this.production.updateSample(id, dto, user);
    }
    rejectedLots() {
        return this.production.listRejectedLots();
    }
    transfers() {
        return this.production.listTransfers();
    }
    createTransfer(dto, user) {
        return this.production.createTransfer(dto, user);
    }
    dispatchTransfer(id, user) {
        return this.production.dispatchTransfer(id, user);
    }
    receiveTransfer(id, user) {
        return this.production.receiveTransfer(id, user);
    }
    dashboard() {
        return this.production.getOwnerDashboard();
    }
    audit(module, recordNumber) {
        return this.production.listAudit({ module, recordNumber });
    }
};
exports.ProductionController = ProductionController;
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('masters/locations'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "locations", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('settings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "settings", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('masters/suppliers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "suppliers", null);
__decorate([
    (0, roles_decorator_1.Roles)(...INVENTORY_OPS),
    (0, common_1.Post)('masters/suppliers'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [production_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "createSupplier", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('masters/inward-types'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "inwardTypes", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('masters/wastage-types'),
    __param(0, (0, common_1.Query)('stage')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "wastageTypes", null);
__decorate([
    (0, roles_decorator_1.Roles)(...INVENTORY_OPS),
    (0, common_1.Post)('inwards'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [production_dto_1.CreateInwardDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "createInward", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('inwards'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [production_dto_1.InwardQueryDto]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "listInwards", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('inventory/balances'),
    __param(0, (0, common_1.Query)('locationId')),
    __param(1, (0, common_1.Query)('productId')),
    __param(2, (0, common_1.Query)('stockCategory')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "balances", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('inventory/ledger'),
    __param(0, (0, common_1.Query)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "ledger", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('pending-contracts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "pendingContracts", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('runs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "listRuns", null);
__decorate([
    (0, roles_decorator_1.Roles)(...PRODUCTION_OPS),
    (0, common_1.Post)('runs'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [production_dto_1.StartProductionDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "startRun", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('runs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "getRun", null);
__decorate([
    (0, roles_decorator_1.Roles)(...PRODUCTION_OPS),
    (0, common_1.Post)('runs/:id/inputs'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.AddInputDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "addInput", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN),
    (0, common_1.Post)('runs/:id/reopen-cleaning'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "reopenCleaning", null);
__decorate([
    (0, roles_decorator_1.Roles)(...PRODUCTION_OPS),
    (0, common_1.Post)('runs/:id/cleaning'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.CleaningResultDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "cleaning", null);
__decorate([
    (0, roles_decorator_1.Roles)(...PRODUCTION_OPS),
    (0, common_1.Post)('runs/:id/hulling'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.HullingResultDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "hulling", null);
__decorate([
    (0, roles_decorator_1.Roles)(...PRODUCTION_OPS),
    (0, common_1.Post)('runs/:id/allocate'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.AllocateContainerDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "allocate", null);
__decorate([
    (0, roles_decorator_1.Roles)(...PRODUCTION_OPS),
    (0, common_1.Post)('runs/:id/store-processed'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.StoreProcessedDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "storeProcessed", null);
__decorate([
    (0, roles_decorator_1.Roles)(...INVENTORY_OPS),
    (0, common_1.Post)('fulfilment/from-stock'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [production_dto_1.AllocateFromStockDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "fromStock", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('processed-lots'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "processedLots", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('sampling'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "samples", null);
__decorate([
    (0, roles_decorator_1.Roles)(...PRODUCTION_OPS),
    (0, common_1.Patch)('sampling/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, production_dto_1.SampleResultDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "updateSample", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('rejected-lots'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "rejectedLots", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('transfers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "transfers", null);
__decorate([
    (0, roles_decorator_1.Roles)(...INVENTORY_OPS),
    (0, common_1.Post)('transfers'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [production_dto_1.CreateTransferDto, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "createTransfer", null);
__decorate([
    (0, roles_decorator_1.Roles)(...INVENTORY_OPS),
    (0, common_1.Post)('transfers/:id/dispatch'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "dispatchTransfer", null);
__decorate([
    (0, roles_decorator_1.Roles)(...INVENTORY_OPS),
    (0, common_1.Post)('transfers/:id/receive'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "receiveTransfer", null);
__decorate([
    (0, roles_decorator_1.Roles)(...READ_ROLES),
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "dashboard", null);
__decorate([
    (0, roles_decorator_1.Roles)(enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.PRODUCTION_TEAM),
    (0, common_1.Get)('audit'),
    __param(0, (0, common_1.Query)('module')),
    __param(1, (0, common_1.Query)('recordNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProductionController.prototype, "audit", null);
exports.ProductionController = ProductionController = __decorate([
    (0, swagger_1.ApiTags)('Production'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('production'),
    __metadata("design:paramtypes", [production_service_1.ProductionService])
], ProductionController);
//# sourceMappingURL=production.controller.js.map