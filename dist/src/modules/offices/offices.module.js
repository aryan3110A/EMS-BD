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
exports.OfficesModule = exports.OfficesController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const class_validator_1 = require("class-validator");
class CreateOfficeDto {
    name;
    city;
    code;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOfficeDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOfficeDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOfficeDto.prototype, "code", void 0);
function officeCode(name) {
    const base = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 6);
    return `${base || 'OFF'}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
let OfficesController = class OfficesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.office.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }
    create(dto) {
        return this.prisma.office.create({
            data: {
                code: dto.code?.trim().toUpperCase() || officeCode(dto.name),
                name: dto.name.trim(),
                city: dto.city?.trim() || dto.name.trim(),
            },
        });
    }
};
exports.OfficesController = OfficesController;
__decorate([
    (0, roles_decorator_1.Public)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OfficesController.prototype, "findAll", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateOfficeDto]),
    __metadata("design:returntype", void 0)
], OfficesController.prototype, "create", null);
exports.OfficesController = OfficesController = __decorate([
    (0, common_1.Controller)('offices'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OfficesController);
let OfficesModule = class OfficesModule {
};
exports.OfficesModule = OfficesModule;
exports.OfficesModule = OfficesModule = __decorate([
    (0, common_1.Module)({
        controllers: [OfficesController],
    })
], OfficesModule);
//# sourceMappingURL=offices.module.js.map