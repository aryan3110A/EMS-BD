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
exports.InventoryLedgerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const production_constants_1 = require("../../common/constants/production.constants");
let InventoryLedgerService = class InventoryLedgerService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async nextTxnNumber(tx) {
        const year = new Date().getFullYear();
        const prefix = `LED-${year}-`;
        const latest = await tx.inventoryLedgerEntry.findFirst({
            where: { txnNumber: { startsWith: prefix } },
            orderBy: { txnNumber: 'desc' },
        });
        let next = 1;
        if (latest) {
            const n = parseInt(latest.txnNumber.split('-').pop() || '0', 10);
            if (!isNaN(n))
                next = n + 1;
        }
        return `${prefix}${String(next).padStart(5, '0')}`;
    }
    async adjustBalance(tx, productId, locationId, stockCategory, deltaKg) {
        const existing = await tx.inventoryBalance.findUnique({
            where: {
                productId_locationId_stockCategory: { productId, locationId, stockCategory },
            },
        });
        const current = existing?.quantityKg ?? 0;
        const next = Math.round((current + deltaKg) * 1000) / 1000;
        if (next < -0.0001) {
            throw new common_1.BadRequestException(`Insufficient stock for ${stockCategory} (available ${current} kg, requested ${Math.abs(deltaKg)} kg).`);
        }
        const row = await tx.inventoryBalance.upsert({
            where: {
                productId_locationId_stockCategory: { productId, locationId, stockCategory },
            },
            create: {
                productId,
                locationId,
                stockCategory,
                quantityKg: Math.max(0, next),
            },
            update: { quantityKg: Math.max(0, next) },
        });
        return row.quantityKg;
    }
    async postTxn(tx, params) {
        const qtyIn = params.quantityInKg ?? 0;
        const qtyOut = params.quantityOutKg ?? 0;
        let balanceKg = null;
        if (params.fromCategory && params.toCategory && params.locationId) {
            await this.adjustBalance(tx, params.productId, params.locationId, params.fromCategory, -qtyOut);
            balanceKg = await this.adjustBalance(tx, params.productId, params.locationId, params.toCategory, qtyIn || qtyOut);
        }
        else {
            if (qtyOut > 0 && params.sourceLocationId) {
                await this.adjustBalance(tx, params.productId, params.sourceLocationId, params.stockCategory, -qtyOut);
            }
            if (qtyIn > 0 && params.destLocationId) {
                balanceKg = await this.adjustBalance(tx, params.productId, params.destLocationId, params.stockCategory, qtyIn);
            }
        }
        const txnNumber = await this.nextTxnNumber(tx);
        return tx.inventoryLedgerEntry.create({
            data: {
                txnNumber,
                txnType: params.txnType,
                productId: params.productId,
                stockCategory: params.toCategory || params.stockCategory,
                sourceLocationId: params.sourceLocationId || params.locationId || null,
                destLocationId: params.destLocationId || params.locationId || null,
                quantityInKg: qtyIn || (params.fromCategory ? qtyOut : 0),
                quantityOutKg: qtyOut,
                balanceKg,
                referenceType: params.referenceType,
                referenceId: params.referenceId,
                remarks: params.remarks,
                createdById: params.createdById,
            },
        });
    }
    async getAvailableKg(productId, locationId, stockCategory = production_constants_1.StockCategory.RAW_MATERIAL) {
        const row = await this.prisma.inventoryBalance.findUnique({
            where: {
                productId_locationId_stockCategory: { productId, locationId, stockCategory },
            },
        });
        return row?.quantityKg ?? 0;
    }
};
exports.InventoryLedgerService = InventoryLedgerService;
exports.InventoryLedgerService = InventoryLedgerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InventoryLedgerService);
//# sourceMappingURL=inventory-ledger.service.js.map