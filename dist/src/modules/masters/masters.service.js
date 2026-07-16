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
function slugCode(prefix, name) {
    const base = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24);
    const suffix = Date.now().toString(36).slice(-4).toUpperCase();
    return `${prefix}-${base || 'NEW'}-${suffix}`;
}
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
    getBuyers(officeId, search, includeInactive = false) {
        return this.prisma.buyer.findMany({
            where: {
                ...(includeInactive ? {} : { isActive: true }),
                ...(officeId ? { OR: [{ officeId }, { officeId: null }] } : {}),
                ...(search
                    ? {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' } },
                            { code: { contains: search, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
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
    async createCountry(dto) {
        const code = dto.code?.trim().toUpperCase() ||
            `${dto.name
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, 6) || 'CN'}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        return this.prisma.country.create({
            data: {
                name: dto.name.trim(),
                code,
                region: dto.name.trim(),
                euClassification: dto.euClassification || 'NON_EU',
            },
        });
    }
    getProducts() {
        return this.prisma.product.findMany({
            where: { isActive: true },
            include: { variants: { where: { isActive: true }, orderBy: { name: 'asc' } } },
            orderBy: { name: 'asc' },
        });
    }
    getPackaging() {
        return this.prisma.packagingType.findMany({
            where: { isActive: true },
            include: { sizes: { where: { isActive: true }, orderBy: { weightKg: 'asc' } } },
            orderBy: { name: 'asc' },
        });
    }
    getPorts(includeInactive = false) {
        return this.prisma.port.findMany({
            where: includeInactive ? {} : { isActive: true },
            include: { country: true },
            orderBy: { name: 'asc' },
        });
    }
    async createPort(dto, userId) {
        const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
        if (!country)
            throw new common_1.NotFoundException('Country not found');
        const port = await this.prisma.port.create({
            data: {
                name: dto.name.trim(),
                code: dto.code?.trim() || null,
                countryId: dto.countryId,
                portType: dto.portType ?? 'DESTINATION',
                euClassification: country.euClassification,
            },
            include: { country: true },
        });
        await this.prisma.auditLog.create({
            data: {
                userId,
                module: 'Port',
                action: 'CREATE',
                recordId: port.id,
                newValue: JSON.stringify({ name: port.name, code: port.code, countryId: port.countryId }),
            },
        });
        return port;
    }
    async updateBuyer(id, dto, userId) {
        const existing = await this.prisma.buyer.findUnique({ where: { id } });
        if (!existing || !existing.isActive) {
            throw new common_1.NotFoundException('Buyer not found');
        }
        if (dto.countryId) {
            const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
            if (!country)
                throw new common_1.NotFoundException('Country not found');
        }
        const data = {
            address: dto.address?.trim() || null,
            contactPerson: dto.contactPerson?.trim() || null,
            email: dto.email?.trim() || null,
            phone: dto.phone?.trim() || null,
            ...(dto.euClassification !== undefined ? { euClassification: dto.euClassification } : {}),
            ...(dto.countryId !== undefined ? { countryId: dto.countryId } : {}),
            ...(dto.defaultPortId !== undefined ? { defaultPortId: dto.defaultPortId || null } : {}),
        };
        const requestedCode = dto.code?.trim();
        if (requestedCode && requestedCode.toUpperCase() !== existing.code.toUpperCase()) {
            const taken = await this.prisma.buyer.findFirst({
                where: {
                    code: { equals: requestedCode.toUpperCase(), mode: 'insensitive' },
                    id: { not: id },
                },
                select: { name: true, code: true },
            });
            if (taken) {
                throw new common_1.ConflictException(`Buyer code "${requestedCode.toUpperCase()}" is already used by "${taken.name}" (${taken.code})`);
            }
            data.code = requestedCode.toUpperCase();
        }
        const buyer = await this.prisma.buyer.update({
            where: { id },
            data,
            include: { country: true, defaultPort: true },
        });
        await this.prisma.auditLog.create({
            data: {
                userId,
                module: 'Buyer',
                action: 'UPDATE',
                recordId: buyer.id,
                previousValue: JSON.stringify({ name: existing.name, code: existing.code, address: existing.address, contactPerson: existing.contactPerson, email: existing.email, phone: existing.phone }),
                newValue: JSON.stringify({ name: buyer.name, code: buyer.code, address: buyer.address, contactPerson: buyer.contactPerson, email: buyer.email, phone: buyer.phone }),
            },
        });
        return buyer;
    }
    async deactivateBuyer(id, userId) {
        const existing = await this.prisma.buyer.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Buyer not found');
        const buyer = await this.prisma.buyer.update({
            where: { id },
            data: { isActive: false },
            include: { country: true, defaultPort: true },
        });
        await this.prisma.auditLog.create({
            data: {
                userId,
                module: 'Buyer',
                action: 'DEACTIVATE',
                recordId: buyer.id,
                previousValue: 'ACTIVE',
                newValue: 'INACTIVE',
            },
        });
        return buyer;
    }
    async updatePort(id, dto, userId) {
        const existing = await this.prisma.port.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Port not found');
        if (dto.countryId) {
            const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
            if (!country)
                throw new common_1.NotFoundException('Country not found');
        }
        const port = await this.prisma.port.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.code !== undefined ? { code: dto.code.trim() || null } : {}),
                ...(dto.countryId !== undefined ? { countryId: dto.countryId } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
            include: { country: true },
        });
        await this.prisma.auditLog.create({
            data: {
                userId,
                module: 'Port',
                action: 'UPDATE',
                recordId: port.id,
                previousValue: JSON.stringify({ name: existing.name, code: existing.code, isActive: existing.isActive }),
                newValue: JSON.stringify({ name: port.name, code: port.code, isActive: port.isActive }),
            },
        });
        return port;
    }
    async createSalesperson(dto) {
        const code = slugCode('SP', dto.name);
        return this.prisma.salesperson.create({
            data: {
                code,
                name: dto.name.trim(),
                phone: dto.phone?.trim() || null,
            },
        });
    }
    async createBuyer(dto, userId) {
        const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
        if (!country)
            throw new common_1.NotFoundException('Country not found');
        const code = (dto.code?.trim() || slugCode('BUY', dto.name)).toUpperCase();
        const taken = await this.prisma.buyer.findFirst({
            where: { code: { equals: code, mode: 'insensitive' } },
            select: { name: true, code: true },
        });
        if (taken) {
            throw new common_1.ConflictException(`Buyer code "${code}" is already used by "${taken.name}" (${taken.code}). Please choose a different code.`);
        }
        const buyer = await this.prisma.buyer.create({
            data: {
                code,
                name: dto.name.trim(),
                countryId: dto.countryId,
                officeId: dto.officeId || null,
                euClassification: country.euClassification,
            },
            include: { country: true, defaultPort: true },
        });
        await this.prisma.auditLog.create({
            data: {
                userId,
                module: 'Buyer',
                action: 'CREATE',
                recordId: buyer.id,
                newValue: JSON.stringify({ name: buyer.name, code: buyer.code, countryId: buyer.countryId }),
            },
        });
        return buyer;
    }
    async createProduct(dto) {
        const code = dto.code?.trim().toUpperCase() ||
            dto.name
                .split(/\s+/)
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 8) ||
            slugCode('PRD', dto.name);
        const product = await this.prisma.product.create({
            data: {
                code,
                name: dto.name.trim(),
                category: dto.category || 'Seeds & Spices',
                defaultSpecification: dto.defaultSpecification || null,
            },
        });
        await this.prisma.productVariant.create({
            data: {
                productId: product.id,
                code: 'NORMAL',
                name: 'Normal',
                processingType: 'Normal',
            },
        });
        return this.prisma.product.findUnique({
            where: { id: product.id },
            include: { variants: { where: { isActive: true }, orderBy: { name: 'asc' } } },
        });
    }
    async createProductVariant(dto) {
        const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
        if (!product || !product.isActive)
            throw new common_1.NotFoundException('Product not found');
        const code = dto.code?.trim().toUpperCase() || dto.name.toUpperCase().replace(/\s+/g, '_').slice(0, 20);
        await this.prisma.productVariant.create({
            data: {
                productId: dto.productId,
                code,
                name: dto.name.trim(),
                processingType: dto.processingType?.trim() || dto.name.trim(),
            },
        });
        return this.prisma.product.findUnique({
            where: { id: dto.productId },
            include: { variants: { where: { isActive: true }, orderBy: { name: 'asc' } } },
        });
    }
    async createPackagingType(dto) {
        const code = dto.code?.trim().toUpperCase() || slugCode('PKG', dto.name);
        return this.prisma.packagingType.create({
            data: {
                code,
                name: dto.name.trim(),
                material: dto.material?.trim() || dto.name.trim(),
                description: dto.description?.trim() || null,
            },
            include: { sizes: { where: { isActive: true } } },
        });
    }
    async createPackagingSize(dto) {
        const packagingType = await this.prisma.packagingType.findUnique({ where: { id: dto.packagingTypeId } });
        if (!packagingType)
            throw new common_1.NotFoundException('Packaging type not found');
        const unit = (dto.weightUnit || 'KG').toUpperCase();
        const label = dto.label?.trim() || `${packagingType.name.toUpperCase()} OF ${dto.weightValue} ${unit} NET`;
        return this.prisma.packagingSize.create({
            data: {
                packagingTypeId: dto.packagingTypeId,
                label,
                weightKg: unit === 'G' ? dto.weightValue / 1000 : dto.weightValue,
                weightUnit: unit,
                description: dto.description?.trim() || null,
            },
        });
    }
    getUsers(role) {
        return this.prisma.user.findMany({
            where: {
                isActive: true,
                ...(role ? { role } : {}),
            },
            select: { id: true, name: true, email: true, role: true },
            orderBy: { name: 'asc' },
        });
    }
};
exports.MastersService = MastersService;
exports.MastersService = MastersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MastersService);
//# sourceMappingURL=masters.service.js.map