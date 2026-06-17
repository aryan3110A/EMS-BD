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
exports.MastersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let MastersService = class MastersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getSalespersons() {
        return this.prisma.salesperson.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }
    getBuyers(officeId) {
        return this.prisma.buyer.findMany({
            where: {
                isActive: true,
                ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {}),
            },
            include: { country: true, defaultPort: true },
            orderBy: { name: 'asc' },
        });
    }
    getCountries() {
        return this.prisma.country.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
    }
    getProducts() {
        return this.prisma.product.findMany({
            where: { isActive: true },
            include: { variants: { where: { isActive: true } } },
            orderBy: { name: 'asc' },
        });
    }
    getPackaging() {
        return this.prisma.packagingType.findMany({
            where: { isActive: true },
            include: { sizes: { where: { isActive: true } } },
            orderBy: { name: 'asc' },
        });
    }
    getPorts() {
        return this.prisma.port.findMany({
            where: { isActive: true },
            include: { country: true },
            orderBy: { name: 'asc' },
        });
    }
    async updateBuyer(id, dto) {
        const existing = await this.prisma.buyer.findUnique({ where: { id } });
        if (!existing || !existing.isActive) {
            throw new common_1.NotFoundException('Buyer not found');
        }
        return this.prisma.buyer.update({
            where: { id },
            data: {
                address: dto.address?.trim() || null,
                contactPerson: dto.contactPerson?.trim() || null,
                email: dto.email?.trim() || null,
                phone: dto.phone?.trim() || null,
                ...(dto.euClassification !== undefined ? { euClassification: dto.euClassification } : {}),
            },
            include: { country: true, defaultPort: true },
        });
    }
};
exports.MastersService = MastersService;
exports.MastersService = MastersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MastersService);
//# sourceMappingURL=masters.service.js.map