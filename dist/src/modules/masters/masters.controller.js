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
exports.MastersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const masters_service_1 = require("./masters.service");
const masters_dto_1 = require("./masters.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const enums_1 = require("../../common/constants/enums");
let MastersController = class MastersController {
    mastersService;
    constructor(mastersService) {
        this.mastersService = mastersService;
    }
    getSalespersons() {
        return this.mastersService.getSalespersons();
    }
    createSalesperson(dto) {
        return this.mastersService.createSalesperson(dto);
    }
    getBuyers(user, officeId) {
        const canSeeAllBuyers = user.role === enums_1.UserRole.SUPER_ADMIN || user.role === enums_1.UserRole.CONTRACT_TEAM;
        if (canSeeAllBuyers) {
            return this.mastersService.getBuyers(officeId || undefined);
        }
        return this.mastersService.getBuyers(user.officeId);
    }
    createBuyer(user, dto) {
        return this.mastersService.createBuyer({
            ...dto,
            officeId: dto.officeId ?? user.officeId,
        });
    }
    getCountries() {
        return this.mastersService.getCountries();
    }
    createCountry(dto) {
        return this.mastersService.createCountry(dto);
    }
    getProducts() {
        return this.mastersService.getProducts();
    }
    createProduct(dto) {
        return this.mastersService.createProduct(dto);
    }
    createProductVariant(dto) {
        return this.mastersService.createProductVariant(dto);
    }
    getPackaging() {
        return this.mastersService.getPackaging();
    }
    createPackagingType(dto) {
        return this.mastersService.createPackagingType(dto);
    }
    createPackagingSize(dto) {
        return this.mastersService.createPackagingSize(dto);
    }
    getPorts() {
        return this.mastersService.getPorts();
    }
    updateBuyer(id, dto) {
        return this.mastersService.updateBuyer(id, dto);
    }
};
exports.MastersController = MastersController;
__decorate([
    (0, common_1.Get)('salespersons'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "getSalespersons", null);
__decorate([
    (0, common_1.Post)('salespersons'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [masters_dto_1.CreateSalespersonDto]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "createSalesperson", null);
__decorate([
    (0, common_1.Get)('buyers'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('officeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "getBuyers", null);
__decorate([
    (0, common_1.Post)('buyers'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, masters_dto_1.CreateBuyerDto]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "createBuyer", null);
__decorate([
    (0, common_1.Get)('countries'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "getCountries", null);
__decorate([
    (0, common_1.Post)('countries'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [masters_dto_1.CreateCountryDto]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "createCountry", null);
__decorate([
    (0, common_1.Get)('products'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Post)('products'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [masters_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Post)('product-variants'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [masters_dto_1.CreateProductVariantDto]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "createProductVariant", null);
__decorate([
    (0, common_1.Get)('packaging'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "getPackaging", null);
__decorate([
    (0, common_1.Post)('packaging'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [masters_dto_1.CreatePackagingTypeDto]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "createPackagingType", null);
__decorate([
    (0, common_1.Post)('packaging/sizes'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [masters_dto_1.CreatePackagingSizeDto]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "createPackagingSize", null);
__decorate([
    (0, common_1.Get)('ports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "getPorts", null);
__decorate([
    (0, common_1.Patch)('buyers/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, masters_dto_1.UpdateBuyerDto]),
    __metadata("design:returntype", void 0)
], MastersController.prototype, "updateBuyer", null);
exports.MastersController = MastersController = __decorate([
    (0, swagger_1.ApiTags)('Masters'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('masters'),
    __metadata("design:paramtypes", [masters_service_1.MastersService])
], MastersController);
//# sourceMappingURL=masters.controller.js.map