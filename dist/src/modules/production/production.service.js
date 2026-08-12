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
exports.ProductionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const enums_1 = require("../../common/constants/enums");
const production_constants_1 = require("../../common/constants/production.constants");
const notification_service_1 = require("../../common/services/notification.service");
const inventory_ledger_service_1 = require("./inventory-ledger.service");
const production_audit_service_1 = require("./production-audit.service");
let ProductionService = class ProductionService {
    prisma;
    ledger;
    audit;
    notifications;
    constructor(prisma, ledger, audit, notifications) {
        this.prisma = prisma;
        this.ledger = ledger;
        this.audit = audit;
        this.notifications = notifications;
    }
    tx(fn) {
        return this.prisma.$transaction(fn, { maxWait: 15000, timeout: 60000 });
    }
    async nextNumber(prefix, model) {
        const year = new Date().getFullYear();
        const full = `${prefix}-${year}-`;
        let latest = null;
        if (model === 'inward') {
            const row = await this.prisma.rawMaterialInward.findFirst({
                where: { inwardNumber: { startsWith: full } },
                orderBy: { inwardNumber: 'desc' },
            });
            latest = row ? { n: row.inwardNumber } : null;
        }
        else if (model === 'run') {
            const row = await this.prisma.productionRun.findFirst({
                where: { productionNumber: { startsWith: full } },
                orderBy: { productionNumber: 'desc' },
            });
            latest = row ? { n: row.productionNumber } : null;
        }
        else if (model === 'lot') {
            const row = await this.prisma.processedOutputLot.findFirst({
                where: { lotNumber: { startsWith: full } },
                orderBy: { lotNumber: 'desc' },
            });
            latest = row ? { n: row.lotNumber } : null;
        }
        else if (model === 'rejected') {
            const row = await this.prisma.sampleRejectedLot.findFirst({
                where: { lotNumber: { startsWith: full } },
                orderBy: { lotNumber: 'desc' },
            });
            latest = row ? { n: row.lotNumber } : null;
        }
        else {
            const row = await this.prisma.plantTransfer.findFirst({
                where: { transferNumber: { startsWith: full } },
                orderBy: { transferNumber: 'desc' },
            });
            latest = row ? { n: row.transferNumber } : null;
        }
        let next = 1;
        if (latest) {
            const n = parseInt(latest.n.split('-').pop() || '0', 10);
            if (!isNaN(n))
                next = n + 1;
        }
        return `${full}${String(next).padStart(5, '0')}`;
    }
    async wastageThreshold() {
        const s = await this.prisma.appSetting.findUnique({ where: { key: production_constants_1.WASTAGE_ALERT_THRESHOLD_KEY } });
        const v = s ? parseFloat(s.value) : NaN;
        return Number.isFinite(v) ? v : production_constants_1.DEFAULT_WASTAGE_ALERT_PCT;
    }
    listLocations() {
        return this.prisma.inventoryLocation.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    }
    listSuppliers() {
        return this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    }
    async createSupplier(dto) {
        const code = dto.code?.trim().toUpperCase() ||
            `SUP-${dto.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8)}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
        return this.prisma.supplier.create({
            data: { code, name: dto.name.trim(), phone: dto.phone, email: dto.email },
        });
    }
    listInwardTypes() {
        return this.prisma.inwardType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    }
    listWastageTypes(stage) {
        return this.prisma.wastageType.findMany({
            where: { isActive: true, ...(stage ? { stage } : {}) },
            orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
        });
    }
    async createInward(dto, user) {
        const type = await this.prisma.inwardType.findUnique({ where: { id: dto.inwardTypeId } });
        if (!type)
            throw new common_1.NotFoundException('Inward type not found');
        if (type.requiresDesc && !dto.otherTypeDesc?.trim()) {
            throw new common_1.BadRequestException('Other inward type description is required');
        }
        if (!dto.truckNumber?.trim())
            throw new common_1.BadRequestException('Truck number is required');
        const weightKg = (0, production_constants_1.toKg)(dto.weight, dto.unit);
        if (weightKg <= 0)
            throw new common_1.BadRequestException('Weight must be greater than zero');
        if ((dto.numberOfBags ?? 0) < 0)
            throw new common_1.BadRequestException('Number of bags cannot be negative');
        const inwardNumber = await this.nextNumber('INW', 'inward');
        const created = await this.tx(async (tx) => {
            const inward = await tx.rawMaterialInward.create({
                data: {
                    inwardNumber,
                    supplierId: dto.supplierId,
                    inwardDate: new Date(dto.inwardDate),
                    truckNumber: dto.truckNumber.trim(),
                    productId: dto.productId,
                    numberOfBags: dto.numberOfBags ?? 0,
                    weightKg,
                    inputUnit: dto.unit.toUpperCase(),
                    price: dto.price,
                    inwardTypeId: dto.inwardTypeId,
                    otherTypeDesc: dto.otherTypeDesc?.trim() || null,
                    locationId: dto.locationId,
                    remarks: dto.remarks,
                    createdById: user.sub,
                },
                include: {
                    supplier: true,
                    product: true,
                    location: true,
                    inwardType: true,
                },
            });
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.RAW_MATERIAL_INWARD,
                productId: dto.productId,
                stockCategory: production_constants_1.StockCategory.RAW_MATERIAL,
                destLocationId: dto.locationId,
                quantityInKg: weightKg,
                referenceType: 'INWARD',
                referenceId: inward.id,
                remarks: `Inward ${inwardNumber}`,
                createdById: user.sub,
            });
            return inward;
        });
        await this.audit.log({
            module: 'INWARD',
            recordType: 'RawMaterialInward',
            recordNumber: inwardNumber,
            action: 'CREATED',
            changedById: user.sub,
            newValue: JSON.stringify({ weightKg, productId: dto.productId }),
        });
        return created;
    }
    listInwards(query) {
        return this.prisma.rawMaterialInward.findMany({
            where: {
                ...(query.supplierId ? { supplierId: query.supplierId } : {}),
                ...(query.productId ? { productId: query.productId } : {}),
                ...(query.locationId ? { locationId: query.locationId } : {}),
                ...(query.inwardTypeId ? { inwardTypeId: query.inwardTypeId } : {}),
                ...(query.truckNumber ? { truckNumber: { contains: query.truckNumber, mode: 'insensitive' } } : {}),
                ...(query.inwardNumber ? { inwardNumber: { contains: query.inwardNumber, mode: 'insensitive' } } : {}),
                ...(query.startDate || query.endDate
                    ? {
                        inwardDate: {
                            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                        },
                    }
                    : {}),
            },
            include: {
                supplier: true,
                product: true,
                location: true,
                inwardType: true,
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { inwardDate: 'desc' },
            take: 200,
        });
    }
    getBalances(query) {
        return this.prisma.inventoryBalance.findMany({
            where: {
                ...(query.locationId ? { locationId: query.locationId } : {}),
                ...(query.productId ? { productId: query.productId } : {}),
                ...(query.stockCategory ? { stockCategory: query.stockCategory } : {}),
                quantityKg: { gt: 0 },
            },
            include: { product: true, location: true },
            orderBy: [{ product: { name: 'asc' } }, { location: { name: 'asc' } }],
        });
    }
    getLedger(query) {
        return this.prisma.inventoryLedgerEntry.findMany({
            where: { ...(query.productId ? { productId: query.productId } : {}) },
            include: {
                product: true,
                sourceLocation: true,
                destLocation: true,
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: query.take ?? 100,
        });
    }
    async getPendingContracts() {
        const contracts = await this.prisma.contract.findMany({
            where: {
                status: {
                    notIn: ['COMPLETED', 'CANCELLED', 'FULLY_DISPATCHED', 'DRAFT'],
                },
            },
            include: {
                buyer: { select: { id: true, name: true, code: true } },
                containers: {
                    include: {
                        product: { select: { id: true, code: true, name: true } },
                        products: { include: { product: { select: { id: true, code: true, name: true } } } },
                    },
                    orderBy: { containerIndex: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        const allocs = await this.prisma.containerAllocation.findMany({
            where: { status: 'ACTIVE' },
            select: { containerId: true, productId: true, quantityKg: true, containerProductId: true },
        });
        const fulfilledMap = new Map();
        for (const a of allocs) {
            const key = `${a.containerId}:${a.containerProductId || a.productId}`;
            fulfilledMap.set(key, (fulfilledMap.get(key) || 0) + a.quantityKg);
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rows = contracts
            .map((c) => {
            const containers = (c.containers || [])
                .filter((ct) => !['SHIPPED', 'COMPLETED', 'CANCELLED', 'DISPATCHED_FROM_FACTORY'].includes(ct.containerStatus || ''))
                .map((ct) => {
                const lines = ct.products?.length > 0
                    ? ct.products.map((p) => {
                        const requiredKg = (p.quantityMt || 0) * 1000;
                        const fulfilledKg = fulfilledMap.get(`${ct.id}:${p.id}`) || fulfilledMap.get(`${ct.id}:${p.productId}`) || 0;
                        return {
                            id: p.id,
                            productId: p.productId,
                            product: p.product,
                            requiredMt: p.quantityMt,
                            requiredKg,
                            fulfilledKg,
                            pendingKg: Math.max(0, requiredKg - fulfilledKg),
                        };
                    })
                    : [
                        {
                            id: null,
                            productId: ct.productId,
                            product: ct.product,
                            requiredMt: ct.quantityMt,
                            requiredKg: (ct.quantityMt || 0) * 1000,
                            fulfilledKg: fulfilledMap.get(`${ct.id}:${ct.productId}`) || 0,
                            pendingKg: Math.max(0, (ct.quantityMt || 0) * 1000 - (fulfilledMap.get(`${ct.id}:${ct.productId}`) || 0)),
                        },
                    ];
                const pendingKg = lines.reduce((s, l) => s + l.pendingKg, 0);
                return {
                    id: ct.id,
                    containerIndex: ct.containerIndex,
                    containerNo: ct.containerNo,
                    containerStatus: ct.containerStatus,
                    expectedShipmentDate: ct.expectedShipmentDate,
                    quantityMt: ct.quantityMt,
                    productLines: lines,
                    pendingKg,
                    pendingMt: pendingKg / 1000,
                };
            })
                .filter((ct) => ct.pendingKg > 0.001);
            if (!containers.length)
                return null;
            const dueDates = containers
                .map((ct) => (ct.expectedShipmentDate ? new Date(ct.expectedShipmentDate) : null))
                .filter(Boolean);
            const dueDate = dueDates.length
                ? new Date(Math.min(...dueDates.map((d) => d.getTime())))
                : c.expectedShipmentDate
                    ? new Date(c.expectedShipmentDate)
                    : null;
            let urgency = 'WHITE';
            let daysLabel = '—';
            if (dueDate) {
                const d0 = new Date(dueDate);
                d0.setHours(0, 0, 0, 0);
                const diff = Math.round((d0.getTime() - today.getTime()) / 86400000);
                if (diff < 0) {
                    urgency = 'RED';
                    daysLabel = `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`;
                }
                else if (diff <= 7) {
                    urgency = 'YELLOW';
                    daysLabel = `Due in ${diff} day${diff === 1 ? '' : 's'}`;
                }
                else {
                    daysLabel = `Due in ${diff} days`;
                }
            }
            const pendingKg = containers.reduce((s, ct) => s + ct.pendingKg, 0);
            const requiredKg = containers.reduce((s, ct) => s + ct.productLines.reduce((a, l) => a + l.requiredKg, 0), 0);
            const fulfilledKg = requiredKg - pendingKg;
            return {
                id: c.id,
                contractNumber: c.contractNumber,
                contractDate: c.contractDate,
                buyer: c.buyer,
                euClassification: c.euClassification,
                status: c.status,
                dueDate,
                urgency,
                daysLabel,
                numberOfContainers: c.numberOfContainers,
                containers,
                requiredMt: requiredKg / 1000,
                fulfilledMt: fulfilledKg / 1000,
                pendingMt: pendingKg / 1000,
            };
        })
            .filter(Boolean);
        rows.sort((a, b) => {
            const rank = { RED: 0, YELLOW: 1, WHITE: 2 };
            const r = (rank[a.urgency] ?? 9) - (rank[b.urgency] ?? 9);
            if (r !== 0)
                return r;
            const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return da - db;
        });
        return rows;
    }
    listRuns() {
        return this.prisma.productionRun.findMany({
            include: {
                plant: true,
                product: true,
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async getRun(id) {
        const run = await this.prisma.productionRun.findUnique({
            where: { id },
            include: {
                plant: true,
                product: true,
                createdBy: { select: { id: true, name: true } },
                inputs: {
                    include: { supplier: true, inward: true },
                    orderBy: { createdAt: 'asc' },
                },
                cleaning: { include: { wastageType: true } },
                hulling: { include: { wastageType: true } },
                outputLots: true,
                allocations: {
                    where: { status: 'ACTIVE' },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!run)
            throw new common_1.NotFoundException('Production run not found');
        return run;
    }
    async getSettings() {
        const [threshold, defaultProduct] = await Promise.all([
            this.prisma.appSetting.findUnique({ where: { key: production_constants_1.WASTAGE_ALERT_THRESHOLD_KEY } }),
            this.prisma.appSetting.findUnique({ where: { key: production_constants_1.FULL_PROCESS_DEFAULT_PRODUCT_KEY } }),
        ]);
        return {
            wastageAlertPct: Number(threshold?.value ?? production_constants_1.DEFAULT_WASTAGE_ALERT_PCT),
            fullProcessDefaultProductId: defaultProduct?.value || null,
        };
    }
    async startRun(dto, user) {
        if (dto.processType === production_constants_1.ProcessType.FULL_PROCESS && dto.stockCategory === production_constants_1.InputStockCategory.SAMPLE_REJECTED_STOCK) {
            throw new common_1.BadRequestException('Sample-rejected stock can only be used in Sortex');
        }
        const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
        if (!product?.isActive)
            throw new common_1.BadRequestException('Product not found or inactive');
        if (dto.processType === production_constants_1.ProcessType.FULL_PROCESS && product.allowsFullProcess === false) {
            throw new common_1.BadRequestException(`${product.name} is not allowed for Full Process`);
        }
        if (dto.processType === production_constants_1.ProcessType.SORTEX && product.allowsSortex === false) {
            throw new common_1.BadRequestException(`${product.name} is not allowed for Sortex`);
        }
        const qtyKg = (0, production_constants_1.toKg)(dto.quantity, dto.unit);
        const stockCat = dto.stockCategory === production_constants_1.InputStockCategory.SAMPLE_REJECTED_STOCK
            ? production_constants_1.StockCategory.SAMPLE_REJECTED
            : dto.stockCategory === production_constants_1.InputStockCategory.EXISTING_PROCESSED_STOCK
                ? production_constants_1.StockCategory.PROCESSED_AVAILABLE
                : production_constants_1.StockCategory.RAW_MATERIAL;
        if (dto.stockCategory === production_constants_1.InputStockCategory.SAMPLE_REJECTED_STOCK) {
            if (!dto.rejectedLotId)
                throw new common_1.BadRequestException('Rejected lot is required for Sortex from rejected stock');
            const lot = await this.prisma.sampleRejectedLot.findUnique({ where: { id: dto.rejectedLotId } });
            if (!lot || lot.availableKg < qtyKg - 0.001)
                throw new common_1.BadRequestException('Insufficient rejected stock');
        }
        else if (dto.stockCategory === production_constants_1.InputStockCategory.EXISTING_PROCESSED_STOCK) {
            if (!dto.processedLotId)
                throw new common_1.BadRequestException('Processed lot is required');
            const lot = await this.prisma.processedOutputLot.findUnique({ where: { id: dto.processedLotId } });
            if (!lot || lot.availableKg < qtyKg - 0.001)
                throw new common_1.BadRequestException('Insufficient processed stock');
        }
        else {
            const avail = await this.ledger.getAvailableKg(dto.productId, dto.plantId, production_constants_1.StockCategory.RAW_MATERIAL);
            if (avail < qtyKg - 0.001) {
                throw new common_1.BadRequestException(`Insufficient raw material. Available: ${avail} kg`);
            }
        }
        const productionNumber = await this.nextNumber('PR', 'run');
        const run = await this.tx(async (tx) => {
            const created = await tx.productionRun.create({
                data: {
                    productionNumber,
                    plantId: dto.plantId,
                    processType: dto.processType,
                    productId: dto.productId,
                    status: production_constants_1.ProductionRunStatus.CLEANING_IN_PROGRESS,
                    startDate: new Date(dto.startDate),
                    totalInputKg: qtyKg,
                    remarks: dto.remarks,
                    createdById: user.sub,
                },
            });
            await tx.productionInput.create({
                data: {
                    productionRunId: created.id,
                    inputDate: new Date(dto.startDate),
                    productId: dto.productId,
                    supplierId: dto.supplierId,
                    inwardId: dto.inwardId,
                    stockCategory: dto.stockCategory,
                    rejectedLotId: dto.rejectedLotId,
                    processedLotId: dto.processedLotId,
                    quantityKg: qtyKg,
                    inputUnit: dto.unit.toUpperCase(),
                    isAdditional: false,
                    addedById: user.sub,
                },
            });
            if (dto.rejectedLotId) {
                await tx.sampleRejectedLot.update({
                    where: { id: dto.rejectedLotId },
                    data: {
                        availableKg: { decrement: qtyKg },
                        reprocessedKg: { increment: qtyKg },
                        status: production_constants_1.RejectedStockStatus.UNDER_SORTEX,
                    },
                });
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.SORTEX_REUSE,
                    productId: dto.productId,
                    stockCategory: production_constants_1.StockCategory.SAMPLE_REJECTED,
                    locationId: dto.plantId,
                    fromCategory: production_constants_1.StockCategory.SAMPLE_REJECTED,
                    toCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    quantityOutKg: qtyKg,
                    quantityInKg: qtyKg,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: created.id,
                    createdById: user.sub,
                });
            }
            else if (dto.processedLotId) {
                await tx.processedOutputLot.update({
                    where: { id: dto.processedLotId },
                    data: { availableKg: { decrement: qtyKg } },
                });
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.PRODUCTION_ISSUE,
                    productId: dto.productId,
                    stockCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                    locationId: dto.plantId,
                    fromCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                    toCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    quantityOutKg: qtyKg,
                    quantityInKg: qtyKg,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: created.id,
                    createdById: user.sub,
                });
            }
            else {
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.PRODUCTION_ISSUE,
                    productId: dto.productId,
                    stockCategory: production_constants_1.StockCategory.RAW_MATERIAL,
                    locationId: dto.plantId,
                    fromCategory: production_constants_1.StockCategory.RAW_MATERIAL,
                    toCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    quantityOutKg: qtyKg,
                    quantityInKg: qtyKg,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: created.id,
                    createdById: user.sub,
                });
            }
            return created;
        });
        await this.audit.log({
            module: 'PRODUCTION',
            recordType: 'ProductionRun',
            recordNumber: productionNumber,
            action: 'STARTED',
            changedById: user.sub,
            newValue: JSON.stringify({ qtyKg, processType: dto.processType }),
        });
        return this.getRun(run.id);
    }
    async reopenCleaning(runId, user, reason) {
        if (![enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN].includes(user.role)) {
            throw new common_1.ForbiddenException('Only Admin can reopen cleaning');
        }
        const run = await this.getRun(runId);
        if (!run.cleaningFinalizedAt)
            throw new common_1.BadRequestException('Cleaning is not finalized');
        if (run.hullingFinalizedAt) {
            throw new common_1.BadRequestException('Cannot reopen cleaning after hulling is finalized');
        }
        const hullingQty = run.hullingInputKg || 0;
        await this.tx(async (tx) => {
            if (hullingQty > 0.001) {
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.STOCK_ADJUSTMENT,
                    productId: run.productId,
                    stockCategory: production_constants_1.StockCategory.WIP_HULLING,
                    locationId: run.plantId,
                    fromCategory: production_constants_1.StockCategory.WIP_HULLING,
                    toCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    quantityOutKg: hullingQty,
                    quantityInKg: hullingQty,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: runId,
                    remarks: `Reopen cleaning: ${reason || 'Admin reopen'}`,
                    createdById: user.sub,
                });
            }
            await tx.cleaningWastageEntry.deleteMany({ where: { productionRunId: runId } });
            await tx.productionRun.update({
                where: { id: runId },
                data: {
                    cleaningFinalizedAt: null,
                    cleaningWastageKg: 0,
                    hullingInputKg: 0,
                    status: production_constants_1.ProductionRunStatus.CLEANING_IN_PROGRESS,
                },
            });
        });
        await this.audit.log({
            module: 'PRODUCTION',
            recordType: 'ProductionRun',
            recordNumber: run.productionNumber,
            action: 'REOPEN_CLEANING',
            changedById: user.sub,
            newValue: reason || null,
        });
        return this.getRun(runId);
    }
    async addInput(runId, dto, user) {
        const run = await this.getRun(runId);
        if ([production_constants_1.ProductionRunStatus.COMPLETED, production_constants_1.ProductionRunStatus.CANCELLED].includes(run.status)) {
            throw new common_1.BadRequestException('Cannot add input to a completed/cancelled run');
        }
        if (run.cleaningFinalizedAt) {
            throw new common_1.BadRequestException('Cleaning is already finalized. Reopen cleaning with Admin permission before adding input, or update cleaning results.');
        }
        if (run.processType === production_constants_1.ProcessType.FULL_PROCESS && dto.stockCategory === production_constants_1.InputStockCategory.SAMPLE_REJECTED_STOCK) {
            throw new common_1.BadRequestException('Sample-rejected stock can only be used in Sortex');
        }
        const qtyKg = (0, production_constants_1.toKg)(dto.quantity, dto.unit);
        const avail = await this.ledger.getAvailableKg(run.productId, run.plantId, production_constants_1.StockCategory.RAW_MATERIAL);
        if (dto.stockCategory === production_constants_1.InputStockCategory.NORMAL_RAW_MATERIAL && avail < qtyKg - 0.001) {
            throw new common_1.BadRequestException(`Insufficient raw material. Available: ${avail} kg`);
        }
        await this.tx(async (tx) => {
            await tx.productionInput.create({
                data: {
                    productionRunId: runId,
                    inputDate: new Date(dto.inputDate),
                    productId: run.productId,
                    supplierId: dto.supplierId,
                    inwardId: dto.inwardId,
                    stockCategory: dto.stockCategory,
                    rejectedLotId: dto.rejectedLotId,
                    processedLotId: dto.processedLotId,
                    quantityKg: qtyKg,
                    inputUnit: dto.unit.toUpperCase(),
                    isAdditional: true,
                    remarks: dto.remarks,
                    addedById: user.sub,
                },
            });
            await tx.productionRun.update({
                where: { id: runId },
                data: { totalInputKg: { increment: qtyKg } },
            });
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.ADDITIONAL_PRODUCTION_INPUT,
                productId: run.productId,
                stockCategory: production_constants_1.StockCategory.RAW_MATERIAL,
                locationId: run.plantId,
                fromCategory: production_constants_1.StockCategory.RAW_MATERIAL,
                toCategory: production_constants_1.StockCategory.WIP_CLEANING,
                quantityOutKg: qtyKg,
                quantityInKg: qtyKg,
                referenceType: 'PRODUCTION_RUN',
                referenceId: runId,
                remarks: dto.remarks,
                createdById: user.sub,
            });
        });
        await this.audit.log({
            module: 'PRODUCTION',
            recordType: 'ProductionInput',
            recordNumber: run.productionNumber,
            action: 'ADDITIONAL_INPUT',
            changedById: user.sub,
            newValue: String(qtyKg),
            reason: dto.remarks,
        });
        return this.getRun(runId);
    }
    async submitCleaning(runId, dto, user) {
        const run = await this.getRun(runId);
        let totalWastage = 0;
        for (const line of dto.lines) {
            const q = (0, production_constants_1.toKg)(line.quantity ?? 0, line.unit || 'KG');
            if (q < 0)
                throw new common_1.BadRequestException('Wastage cannot be negative');
            totalWastage += q;
        }
        totalWastage = Math.round(totalWastage * 1000) / 1000;
        if (totalWastage > run.totalInputKg + 0.001) {
            throw new common_1.BadRequestException('Cleaning wastage cannot exceed input quantity');
        }
        const forwarded = Math.round((run.totalInputKg - totalWastage) * 1000) / 1000;
        if (forwarded < 0)
            throw new common_1.BadRequestException('Quantity forwarded to hulling cannot be negative');
        await this.tx(async (tx) => {
            await tx.cleaningWastageEntry.deleteMany({ where: { productionRunId: runId } });
            for (const line of dto.lines) {
                const q = (0, production_constants_1.toKg)(line.quantity ?? 0, line.unit || 'KG');
                if (q <= 0)
                    continue;
                await tx.cleaningWastageEntry.create({
                    data: {
                        productionRunId: runId,
                        wastageTypeId: line.wastageTypeId,
                        quantityKg: q,
                        inputUnit: (line.unit || 'KG').toUpperCase(),
                        remarks: line.remarks,
                    },
                });
            }
            await tx.productionRun.update({
                where: { id: runId },
                data: {
                    cleaningWastageKg: totalWastage,
                    hullingInputKg: forwarded,
                    cleaningFinalizedAt: new Date(),
                    status: production_constants_1.ProductionRunStatus.HULLING_IN_PROGRESS,
                },
            });
            if (totalWastage > 0) {
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.CLEANING_WASTAGE,
                    productId: run.productId,
                    stockCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    locationId: run.plantId,
                    fromCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    toCategory: production_constants_1.StockCategory.WASTAGE_BY_PRODUCT,
                    quantityOutKg: totalWastage,
                    quantityInKg: totalWastage,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: runId,
                    createdById: user.sub,
                });
            }
            if (forwarded > 0) {
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.TRANSFER_TO_HULLING,
                    productId: run.productId,
                    stockCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    locationId: run.plantId,
                    fromCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    toCategory: production_constants_1.StockCategory.WIP_HULLING,
                    quantityOutKg: forwarded,
                    quantityInKg: forwarded,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: runId,
                    createdById: user.sub,
                });
            }
        });
        await this.audit.log({
            module: 'PRODUCTION',
            recordType: 'Cleaning',
            recordNumber: run.productionNumber,
            action: 'CLEANING_FINALIZED',
            changedById: user.sub,
            newValue: JSON.stringify({ totalWastage, forwarded }),
        });
        return this.getRun(runId);
    }
    async submitHulling(runId, dto, user) {
        const run = await this.getRun(runId);
        if (!run.cleaningFinalizedAt)
            throw new common_1.BadRequestException('Complete cleaning before hulling');
        let totalWastage = 0;
        const resolved = [];
        for (const line of dto.lines) {
            let q = 0;
            if (line.numberOfBags != null && line.weightPerBag != null) {
                q = (0, production_constants_1.toKg)(line.numberOfBags * line.weightPerBag, line.unit || 'KG');
            }
            else {
                q = (0, production_constants_1.toKg)(line.quantity ?? 0, line.unit || 'KG');
            }
            if (q < 0)
                throw new common_1.BadRequestException('Wastage cannot be negative');
            if (q > 0) {
                resolved.push({
                    wastageTypeId: line.wastageTypeId,
                    quantityKg: q,
                    numberOfBags: line.numberOfBags,
                    weightPerBagKg: line.weightPerBag != null ? (0, production_constants_1.toKg)(line.weightPerBag, line.unit || 'KG') : undefined,
                    remarks: line.remarks,
                    unit: (line.unit || 'KG').toUpperCase(),
                });
                totalWastage += q;
            }
        }
        totalWastage = Math.round(totalWastage * 1000) / 1000;
        if (totalWastage > run.hullingInputKg + 0.001) {
            throw new common_1.BadRequestException('Hulling wastage cannot exceed hulling input');
        }
        const net = Math.round((run.hullingInputKg - totalWastage) * 1000) / 1000;
        const pct = run.hullingInputKg > 0 ? Math.round((totalWastage / run.hullingInputKg) * 10000) / 100 : 0;
        const threshold = await this.wastageThreshold();
        const alert = pct > threshold;
        const lotNumber = await this.nextNumber('OUT', 'lot');
        await this.tx(async (tx) => {
            await tx.hullingWastageEntry.deleteMany({ where: { productionRunId: runId } });
            for (const line of resolved) {
                await tx.hullingWastageEntry.create({
                    data: {
                        productionRunId: runId,
                        wastageTypeId: line.wastageTypeId,
                        numberOfBags: line.numberOfBags,
                        weightPerBagKg: line.weightPerBagKg,
                        directQtyKg: line.numberOfBags == null ? line.quantityKg : null,
                        quantityKg: line.quantityKg,
                        inputUnit: line.unit,
                        remarks: line.remarks,
                    },
                });
            }
            await tx.processedOutputLot.create({
                data: {
                    lotNumber,
                    productionRunId: runId,
                    productId: run.productId,
                    plantId: run.plantId,
                    processType: run.processType,
                    quantityKg: net,
                    availableKg: net,
                    completionDate: new Date(),
                    status: 'AVAILABLE',
                },
            });
            await tx.productionRun.update({
                where: { id: runId },
                data: {
                    hullingWastageKg: totalWastage,
                    hullingWastagePct: pct,
                    netOutputKg: net,
                    wastageAlert: alert,
                    hullingFinalizedAt: new Date(),
                    completionDate: new Date(),
                    daysSpanned: Math.floor((Date.now() - new Date(run.startDate).getTime()) / 86400000) + 1,
                    status: production_constants_1.ProductionRunStatus.ALLOCATION_PENDING,
                },
            });
            if (totalWastage > 0) {
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.HULLING_WASTAGE,
                    productId: run.productId,
                    stockCategory: production_constants_1.StockCategory.WIP_HULLING,
                    locationId: run.plantId,
                    fromCategory: production_constants_1.StockCategory.WIP_HULLING,
                    toCategory: production_constants_1.StockCategory.WASTAGE_BY_PRODUCT,
                    quantityOutKg: totalWastage,
                    quantityInKg: totalWastage,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: runId,
                    createdById: user.sub,
                });
            }
            if (net > 0) {
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.PROCESSED_OUTPUT,
                    productId: run.productId,
                    stockCategory: production_constants_1.StockCategory.WIP_HULLING,
                    locationId: run.plantId,
                    fromCategory: production_constants_1.StockCategory.WIP_HULLING,
                    toCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                    quantityOutKg: net,
                    quantityInKg: net,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: runId,
                    createdById: user.sub,
                });
            }
        });
        await this.audit.log({
            module: 'PRODUCTION',
            recordType: 'Hulling',
            recordNumber: run.productionNumber,
            action: 'HULLING_FINALIZED',
            changedById: user.sub,
            newValue: JSON.stringify({ totalWastage, net, pct, alert }),
        });
        return this.getRun(runId);
    }
    async refreshContainerStatus(tx, contractId, containerId, userId) {
        const contract = await tx.contract.findUnique({
            where: { id: contractId },
            select: { euClassification: true, contractNumber: true },
        });
        const container = await tx.contractContainer.findUnique({
            where: { id: containerId },
            include: { products: true },
        });
        if (!container)
            return;
        const allocs = await tx.containerAllocation.findMany({
            where: { containerId, status: 'ACTIVE' },
        });
        const lines = container.products.length > 0
            ? container.products.map((p) => ({
                id: p.id,
                productId: p.productId,
                requiredKg: (p.quantityMt || 0) * 1000,
                fulfilledKg: allocs
                    .filter((a) => a.containerProductId === p.id || (!a.containerProductId && a.productId === p.productId))
                    .reduce((s, a) => s + a.quantityKg, 0),
            }))
            : [
                {
                    id: null,
                    productId: container.productId,
                    requiredKg: (container.quantityMt || 0) * 1000,
                    fulfilledKg: allocs.filter((a) => a.productId === container.productId).reduce((s, a) => s + a.quantityKg, 0),
                },
            ];
        const allDone = lines.every((l) => l.fulfilledKg >= l.requiredKg - 0.001);
        const anyDone = lines.some((l) => l.fulfilledKg > 0.001);
        const isEu = (contract?.euClassification || '').toUpperCase() === enums_1.EuClassification.EU;
        let nextStatus = container.containerStatus;
        if (allDone) {
            nextStatus = isEu ? enums_1.ContainerStatus.READY_FOR_SAMPLING : enums_1.ContainerStatus.READY_FOR_DISPATCH;
        }
        else if (anyDone) {
            nextStatus = enums_1.ContainerStatus.PARTIALLY_FULFILLED;
        }
        if (nextStatus !== container.containerStatus) {
            await tx.contractContainer.update({
                where: { id: containerId },
                data: { containerStatus: nextStatus },
            });
            await tx.containerStatusHistory.create({
                data: {
                    containerId,
                    contractId,
                    fromStatus: container.containerStatus,
                    toStatus: nextStatus,
                    updatedById: userId,
                    remarks: 'Updated by production fulfilment',
                },
            });
        }
        if (allDone && isEu) {
            for (const line of lines) {
                const existing = await tx.sampleRecord.findFirst({
                    where: { containerId, productId: line.productId, status: { not: production_constants_1.SamplingStatus.FAILED } },
                });
                if (!existing) {
                    await tx.sampleRecord.create({
                        data: {
                            contractId,
                            containerId,
                            productId: line.productId,
                            status: production_constants_1.SamplingStatus.READY_FOR_SAMPLING,
                        },
                    });
                }
            }
        }
    }
    async allocateToContainer(runId, dto, user) {
        const run = await this.getRun(runId);
        if (!run.hullingFinalizedAt)
            throw new common_1.BadRequestException('Finalize hulling before allocation');
        const qtyKg = (0, production_constants_1.toKg)(dto.quantity, dto.unit);
        const remaining = Math.round((run.netOutputKg - run.allocatedKg - run.storedProcessedKg) * 1000) / 1000;
        if (qtyKg > remaining + 0.001)
            throw new common_1.BadRequestException(`Only ${remaining} kg available from this production`);
        const lot = run.outputLots.find((l) => l.availableKg > 0) || run.outputLots[0];
        if (!lot || lot.availableKg < qtyKg - 0.001)
            throw new common_1.BadRequestException('Insufficient output lot quantity');
        const pending = await this.getPendingContracts();
        const contract = pending.find((c) => c.id === dto.contractId);
        const container = contract?.containers.find((ct) => ct.id === dto.containerId);
        const line = container?.productLines.find((p) => p.productId === dto.productId && (!dto.containerProductId || p.id === dto.containerProductId));
        if (!line)
            throw new common_1.BadRequestException('Container product line not found or already fulfilled');
        if (qtyKg > line.pendingKg + 0.001) {
            throw new common_1.BadRequestException(`Cannot allocate above remaining requirement (${line.pendingKg} kg)`);
        }
        if (line.productId !== dto.productId)
            throw new common_1.BadRequestException('Wrong product for this line');
        await this.tx(async (tx) => {
            await tx.containerAllocation.create({
                data: {
                    productionRunId: runId,
                    processedLotId: lot.id,
                    contractId: dto.contractId,
                    containerId: dto.containerId,
                    containerProductId: dto.containerProductId,
                    productId: dto.productId,
                    quantityKg: qtyKg,
                    allocatedById: user.sub,
                    remarks: dto.remarks,
                },
            });
            await tx.processedOutputLot.update({
                where: { id: lot.id },
                data: { availableKg: { decrement: qtyKg }, reservedKg: { increment: qtyKg } },
            });
            const allocatedKg = Math.round((run.allocatedKg + qtyKg) * 1000) / 1000;
            const left = Math.round((run.netOutputKg - allocatedKg - run.storedProcessedKg) * 1000) / 1000;
            await tx.productionRun.update({
                where: { id: runId },
                data: {
                    allocatedKg,
                    status: left <= 0.001
                        ? production_constants_1.ProductionRunStatus.FULLY_ALLOCATED
                        : production_constants_1.ProductionRunStatus.PARTIALLY_ALLOCATED,
                },
            });
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.CONTAINER_ALLOCATION,
                productId: dto.productId,
                stockCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                locationId: run.plantId,
                fromCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                toCategory: production_constants_1.StockCategory.PROCESSED_RESERVED,
                quantityOutKg: qtyKg,
                quantityInKg: qtyKg,
                referenceType: 'ALLOCATION',
                referenceId: runId,
                createdById: user.sub,
            });
            await this.refreshContainerStatus(tx, dto.contractId, dto.containerId, user.sub);
        });
        await this.audit.log({
            module: 'FULFILMENT',
            recordType: 'ContainerAllocation',
            recordNumber: run.productionNumber,
            action: 'ALLOCATED',
            changedById: user.sub,
            newValue: JSON.stringify(dto),
        });
        const c = await this.prisma.contract.findUnique({
            where: { id: dto.contractId },
            select: { contractNumber: true },
        });
        const ct = await this.prisma.contractContainer.findUnique({
            where: { id: dto.containerId },
            select: { containerIndex: true, containerStatus: true },
        });
        await this.notifications.notifyChange({
            type: 'CONTAINER_FULFILMENT',
            message: `Container ${ct?.containerIndex} on ${c?.contractNumber} fulfilment updated → ${ct?.containerStatus?.replace(/_/g, ' ')}`,
            contractId: dto.contractId,
            containerId: dto.containerId,
            changedById: user.sub,
            targetRoles: [
                enums_1.UserRole.SUPER_ADMIN,
                enums_1.UserRole.OFFICE_ADMIN,
                enums_1.UserRole.PRODUCTION_TEAM,
                enums_1.UserRole.SUPER_SALES,
                enums_1.UserRole.CONTRACT_TEAM,
            ],
        });
        return this.getRun(runId);
    }
    async storeRemainingProcessed(runId, dto, user) {
        const run = await this.getRun(runId);
        const remaining = Math.round((run.netOutputKg - run.allocatedKg - run.storedProcessedKg) * 1000) / 1000;
        const qtyKg = dto.quantity != null ? (0, production_constants_1.toKg)(dto.quantity, dto.unit || 'KG') : remaining;
        if (qtyKg <= 0)
            throw new common_1.BadRequestException('No remaining quantity to store');
        if (qtyKg > remaining + 0.001)
            throw new common_1.BadRequestException(`Only ${remaining} kg remaining`);
        await this.tx(async (tx) => {
            const stored = Math.round((run.storedProcessedKg + qtyKg) * 1000) / 1000;
            const left = Math.round((run.netOutputKg - run.allocatedKg - stored) * 1000) / 1000;
            await tx.productionRun.update({
                where: { id: runId },
                data: {
                    storedProcessedKg: stored,
                    status: left <= 0.001 ? production_constants_1.ProductionRunStatus.COMPLETED : run.status,
                    completionDate: left <= 0.001 ? new Date() : run.completionDate,
                },
            });
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.PROCESSED_STOCK_BALANCE,
                productId: run.productId,
                stockCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                destLocationId: run.plantId,
                quantityInKg: 0,
                remarks: `Stored remaining ${qtyKg} kg against ${run.productionNumber}`,
                referenceType: 'PRODUCTION_RUN',
                referenceId: runId,
                createdById: user.sub,
            });
        });
        await this.audit.log({
            module: 'INVENTORY',
            recordType: 'ProcessedStock',
            recordNumber: run.productionNumber,
            action: 'STORE_REMAINING',
            changedById: user.sub,
            newValue: String(qtyKg),
        });
        return this.getRun(runId);
    }
    async allocateFromProcessedStock(dto, user) {
        const lot = await this.prisma.processedOutputLot.findUnique({ where: { id: dto.processedLotId } });
        if (!lot)
            throw new common_1.NotFoundException('Processed lot not found');
        const qtyKg = (0, production_constants_1.toKg)(dto.quantity, dto.unit);
        if (lot.availableKg < qtyKg - 0.001)
            throw new common_1.BadRequestException('Insufficient processed stock');
        await this.tx(async (tx) => {
            await tx.containerAllocation.create({
                data: {
                    productionRunId: lot.productionRunId,
                    processedLotId: lot.id,
                    contractId: dto.contractId,
                    containerId: dto.containerId,
                    containerProductId: dto.containerProductId,
                    productId: dto.productId,
                    quantityKg: qtyKg,
                    allocatedById: user.sub,
                },
            });
            await tx.processedOutputLot.update({
                where: { id: lot.id },
                data: { availableKg: { decrement: qtyKg }, reservedKg: { increment: qtyKg } },
            });
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.CONTAINER_ALLOCATION,
                productId: dto.productId,
                stockCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                locationId: lot.plantId,
                fromCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                toCategory: production_constants_1.StockCategory.PROCESSED_RESERVED,
                quantityOutKg: qtyKg,
                quantityInKg: qtyKg,
                referenceType: 'ALLOCATION',
                referenceId: lot.id,
                createdById: user.sub,
            });
            await this.refreshContainerStatus(tx, dto.contractId, dto.containerId, user.sub);
        });
        return { ok: true };
    }
    listProcessedLots() {
        return this.prisma.processedOutputLot.findMany({
            where: { availableKg: { gt: 0 }, status: 'AVAILABLE' },
            include: { product: true, plant: true, productionRun: { select: { productionNumber: true, processType: true } } },
            orderBy: { completionDate: 'desc' },
        });
    }
    async listSamples() {
        const samples = await this.prisma.sampleRecord.findMany({
            include: {
                product: true,
                productionRun: { select: { productionNumber: true } },
                updatedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
        const contractIds = [...new Set(samples.map((s) => s.contractId))];
        const containerIds = [...new Set(samples.map((s) => s.containerId))];
        const [contracts, containers] = await Promise.all([
            contractIds.length
                ? this.prisma.contract.findMany({
                    where: { id: { in: contractIds } },
                    select: { id: true, contractNumber: true },
                })
                : [],
            containerIds.length
                ? this.prisma.contractContainer.findMany({
                    where: { id: { in: containerIds } },
                    select: { id: true, containerIndex: true, containerStatus: true },
                })
                : [],
        ]);
        const cMap = new Map(contracts.map((c) => [c.id, c]));
        const ctMap = new Map(containers.map((c) => [c.id, c]));
        return samples.map((s) => ({
            ...s,
            contract: cMap.get(s.contractId) || null,
            container: ctMap.get(s.containerId) || null,
        }));
    }
    async updateSample(id, dto, user) {
        const sample = await this.prisma.sampleRecord.findUnique({ where: { id } });
        if (!sample)
            throw new common_1.NotFoundException('Sample not found');
        const result = (dto.result || dto.status || '').toUpperCase();
        const passed = result === 'PASSED' || dto.status === production_constants_1.SamplingStatus.PASSED;
        const failed = result === 'FAILED' || dto.status === production_constants_1.SamplingStatus.FAILED;
        await this.tx(async (tx) => {
            await tx.sampleRecord.update({
                where: { id },
                data: {
                    status: passed ? production_constants_1.SamplingStatus.PASSED : failed ? production_constants_1.SamplingStatus.FAILED : dto.status,
                    result: dto.result || (passed ? 'PASSED' : failed ? 'FAILED' : dto.status),
                    collectionDate: dto.collectionDate ? new Date(dto.collectionDate) : sample.collectionDate,
                    resultDate: dto.resultDate ? new Date(dto.resultDate) : new Date(),
                    testingAgency: dto.testingAgency,
                    reportReference: dto.reportReference,
                    remarks: dto.remarks,
                    updatedById: user.sub,
                },
            });
            if (passed) {
                const siblings = await tx.sampleRecord.findMany({ where: { containerId: sample.containerId } });
                const allPassed = siblings.every((s) => s.id === id ? true : s.status === production_constants_1.SamplingStatus.PASSED);
                if (allPassed) {
                    const container = await tx.contractContainer.findUnique({ where: { id: sample.containerId } });
                    await tx.contractContainer.update({
                        where: { id: sample.containerId },
                        data: { containerStatus: enums_1.ContainerStatus.READY_FOR_DISPATCH },
                    });
                    await tx.containerStatusHistory.create({
                        data: {
                            containerId: sample.containerId,
                            contractId: sample.contractId,
                            fromStatus: container?.containerStatus,
                            toStatus: enums_1.ContainerStatus.READY_FOR_DISPATCH,
                            updatedById: user.sub,
                            remarks: 'All required samples passed',
                        },
                    });
                }
            }
            if (failed) {
                const allocs = await tx.containerAllocation.findMany({
                    where: {
                        containerId: sample.containerId,
                        productId: sample.productId,
                        status: 'ACTIVE',
                    },
                });
                const qty = allocs.reduce((s, a) => s + a.quantityKg, 0);
                const plantId = (await tx.contractContainer.findUnique({ where: { id: sample.containerId } }))?.productionUnitId ||
                    (await tx.productionRun.findFirst({ where: { id: sample.productionRunId || undefined } }))?.plantId;
                const loc = plantId ||
                    (await tx.inventoryLocation.findFirst({ where: { isActive: true } }))?.id;
                if (!loc)
                    throw new common_1.BadRequestException('No plant location for rejected stock');
                const lotNumber = await this.nextNumber('REJ', 'rejected');
                const year = new Date().getFullYear();
                const prefix = `REJ-${year}-`;
                const latest = await tx.sampleRejectedLot.findFirst({
                    where: { lotNumber: { startsWith: prefix } },
                    orderBy: { lotNumber: 'desc' },
                });
                let next = 1;
                if (latest) {
                    const n = parseInt(latest.lotNumber.split('-').pop() || '0', 10);
                    if (!isNaN(n))
                        next = n + 1;
                }
                const rejNo = `${prefix}${String(next).padStart(5, '0')}`;
                await tx.sampleRejectedLot.create({
                    data: {
                        lotNumber: rejNo,
                        productId: sample.productId,
                        quantityKg: qty || 0,
                        availableKg: qty || 0,
                        plantId: loc,
                        productionRunId: sample.productionRunId,
                        contractId: sample.contractId,
                        containerId: sample.containerId,
                        sampleRecordId: sample.id,
                        failureDate: new Date(),
                        failureRemarks: dto.remarks,
                        status: production_constants_1.RejectedStockStatus.AVAILABLE_FOR_SORTEX,
                    },
                });
                for (const a of allocs) {
                    await tx.containerAllocation.update({
                        where: { id: a.id },
                        data: { status: 'REJECTED' },
                    });
                    if (a.processedLotId) {
                        await tx.processedOutputLot.update({
                            where: { id: a.processedLotId },
                            data: { reservedKg: { decrement: a.quantityKg } },
                        });
                    }
                }
                if (qty > 0) {
                    await this.ledger.postTxn(tx, {
                        txnType: production_constants_1.LedgerTxnType.SAMPLE_REJECTION,
                        productId: sample.productId,
                        stockCategory: production_constants_1.StockCategory.PROCESSED_RESERVED,
                        locationId: loc,
                        fromCategory: production_constants_1.StockCategory.PROCESSED_RESERVED,
                        toCategory: production_constants_1.StockCategory.SAMPLE_REJECTED,
                        quantityOutKg: qty,
                        quantityInKg: qty,
                        referenceType: 'SAMPLE',
                        referenceId: sample.id,
                        createdById: user.sub,
                    });
                }
                const container = await tx.contractContainer.findUnique({ where: { id: sample.containerId } });
                await tx.contractContainer.update({
                    where: { id: sample.containerId },
                    data: { containerStatus: enums_1.ContainerStatus.SAMPLING_FAILED },
                });
                await tx.containerStatusHistory.create({
                    data: {
                        containerId: sample.containerId,
                        contractId: sample.contractId,
                        fromStatus: container?.containerStatus,
                        toStatus: enums_1.ContainerStatus.SAMPLING_FAILED,
                        updatedById: user.sub,
                        remarks: 'Sample failed — quantity moved to rejected stock',
                    },
                });
            }
        });
        await this.audit.log({
            module: 'SAMPLING',
            recordType: 'SampleRecord',
            recordNumber: id,
            action: passed ? 'PASSED' : failed ? 'FAILED' : 'UPDATED',
            changedById: user.sub,
            reason: dto.remarks,
        });
        const contract = await this.prisma.contract.findUnique({
            where: { id: sample.contractId },
            select: { contractNumber: true },
        });
        await this.notifications.notifyChange({
            type: passed ? 'SAMPLE_PASSED' : failed ? 'SAMPLE_FAILED' : 'SAMPLE_UPDATED',
            message: `Sample ${passed ? 'passed' : failed ? 'failed' : 'updated'} for contract ${contract?.contractNumber || sample.contractId}`,
            contractId: sample.contractId,
            containerId: sample.containerId,
            changedById: user.sub,
            targetRoles: [
                enums_1.UserRole.SUPER_ADMIN,
                enums_1.UserRole.OFFICE_ADMIN,
                enums_1.UserRole.PRODUCTION_TEAM,
                enums_1.UserRole.SUPER_SALES,
                enums_1.UserRole.CONTRACT_TEAM,
            ],
        });
        return this.prisma.sampleRecord.findUnique({
            where: { id },
            include: { product: true },
        });
    }
    listRejectedLots() {
        return this.prisma.sampleRejectedLot.findMany({
            where: { availableKg: { gt: 0 } },
            include: { product: true, plant: true, productionRun: { select: { productionNumber: true } } },
            orderBy: { failureDate: 'desc' },
        });
    }
    listTransfers() {
        return this.prisma.plantTransfer.findMany({
            include: {
                sourceLocation: true,
                destLocation: true,
                product: true,
                createdBy: { select: { id: true, name: true } },
                receivedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async createTransfer(dto, user) {
        if (dto.sourceLocationId === dto.destLocationId) {
            throw new common_1.BadRequestException('Source and destination must differ');
        }
        const qtyKg = (0, production_constants_1.toKg)(dto.quantity, dto.unit);
        if (dto.stockCategory === production_constants_1.StockCategory.PROCESSED_RESERVED) {
            throw new common_1.BadRequestException('Cannot transfer reserved container stock');
        }
        const avail = await this.ledger.getAvailableKg(dto.productId, dto.sourceLocationId, dto.stockCategory);
        if (dto.rejectedLotId) {
            const lot = await this.prisma.sampleRejectedLot.findUnique({ where: { id: dto.rejectedLotId } });
            if (!lot || lot.availableKg < qtyKg - 0.001)
                throw new common_1.BadRequestException('Insufficient rejected stock');
        }
        else if (avail < qtyKg - 0.001 && !dto.processedLotId) {
            throw new common_1.BadRequestException(`Insufficient stock. Available: ${avail} kg`);
        }
        if (dto.processedLotId) {
            const lot = await this.prisma.processedOutputLot.findUnique({ where: { id: dto.processedLotId } });
            if (!lot || lot.availableKg < qtyKg - 0.001)
                throw new common_1.BadRequestException('Insufficient processed lot');
        }
        const transferNumber = await this.nextNumber('TRF', 'transfer');
        const row = await this.prisma.plantTransfer.create({
            data: {
                transferNumber,
                transferDate: new Date(dto.transferDate),
                sourceLocationId: dto.sourceLocationId,
                destLocationId: dto.destLocationId,
                stockCategory: dto.stockCategory,
                productId: dto.productId,
                processedLotId: dto.processedLotId,
                rejectedLotId: dto.rejectedLotId,
                productionRunId: dto.productionRunId,
                quantityKg: qtyKg,
                inputUnit: dto.unit.toUpperCase(),
                remarks: dto.remarks,
                status: production_constants_1.TransferStatus.DRAFT,
                createdById: user.sub,
            },
            include: { sourceLocation: true, destLocation: true, product: true },
        });
        await this.audit.log({
            module: 'TRANSFER',
            recordType: 'PlantTransfer',
            recordNumber: transferNumber,
            action: 'CREATED',
            changedById: user.sub,
        });
        return row;
    }
    async dispatchTransfer(id, user) {
        const t = await this.prisma.plantTransfer.findUnique({ where: { id } });
        if (!t)
            throw new common_1.NotFoundException('Transfer not found');
        if (![production_constants_1.TransferStatus.DRAFT, production_constants_1.TransferStatus.APPROVED].includes(t.status)) {
            throw new common_1.BadRequestException('Transfer cannot be dispatched');
        }
        await this.tx(async (tx) => {
            if (t.rejectedLotId) {
                await tx.sampleRejectedLot.update({
                    where: { id: t.rejectedLotId },
                    data: { availableKg: { decrement: t.quantityKg }, transferredKg: { increment: t.quantityKg }, status: production_constants_1.RejectedStockStatus.TRANSFERRED },
                });
            }
            if (t.processedLotId) {
                await tx.processedOutputLot.update({
                    where: { id: t.processedLotId },
                    data: { availableKg: { decrement: t.quantityKg } },
                });
            }
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.PLANT_TRANSFER_OUT,
                productId: t.productId,
                stockCategory: t.stockCategory,
                sourceLocationId: t.sourceLocationId,
                destLocationId: t.destLocationId,
                quantityOutKg: t.quantityKg,
                referenceType: 'TRANSFER',
                referenceId: t.id,
                createdById: user.sub,
            });
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.PLANT_TRANSFER_OUT,
                productId: t.productId,
                stockCategory: production_constants_1.StockCategory.STOCK_IN_TRANSIT,
                destLocationId: t.destLocationId,
                quantityInKg: t.quantityKg,
                referenceType: 'TRANSFER',
                referenceId: t.id,
                createdById: user.sub,
            });
            await tx.plantTransfer.update({
                where: { id },
                data: { status: production_constants_1.TransferStatus.IN_TRANSIT, dispatchDate: new Date() },
            });
        });
        await this.audit.log({
            module: 'TRANSFER',
            recordType: 'PlantTransfer',
            recordNumber: t.transferNumber,
            action: 'DISPATCHED',
            changedById: user.sub,
        });
        return this.prisma.plantTransfer.findUnique({
            where: { id },
            include: { sourceLocation: true, destLocation: true, product: true },
        });
    }
    async receiveTransfer(id, user) {
        const t = await this.prisma.plantTransfer.findUnique({ where: { id } });
        if (!t)
            throw new common_1.NotFoundException('Transfer not found');
        if (t.status !== production_constants_1.TransferStatus.IN_TRANSIT && t.status !== production_constants_1.TransferStatus.DISPATCHED) {
            throw new common_1.BadRequestException('Transfer is not in transit');
        }
        if (t.receivedDate)
            throw new common_1.BadRequestException('Transfer already received');
        await this.tx(async (tx) => {
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.PLANT_TRANSFER_IN,
                productId: t.productId,
                stockCategory: production_constants_1.StockCategory.STOCK_IN_TRANSIT,
                sourceLocationId: t.destLocationId,
                quantityOutKg: t.quantityKg,
                referenceType: 'TRANSFER',
                referenceId: t.id,
                createdById: user.sub,
            });
            const destCategory = t.stockCategory === production_constants_1.StockCategory.SAMPLE_REJECTED
                ? production_constants_1.StockCategory.SAMPLE_REJECTED
                : t.stockCategory;
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.PLANT_TRANSFER_IN,
                productId: t.productId,
                stockCategory: destCategory,
                destLocationId: t.destLocationId,
                quantityInKg: t.quantityKg,
                referenceType: 'TRANSFER',
                referenceId: t.id,
                createdById: user.sub,
            });
            if (t.rejectedLotId) {
                await tx.sampleRejectedLot.create({
                    data: {
                        lotNumber: `${t.transferNumber}-DST`,
                        productId: t.productId,
                        quantityKg: t.quantityKg,
                        availableKg: t.quantityKg,
                        plantId: t.destLocationId,
                        productionRunId: t.productionRunId,
                        failureDate: new Date(),
                        failureRemarks: `Transferred via ${t.transferNumber} — remains sample-rejected`,
                        status: production_constants_1.RejectedStockStatus.AVAILABLE_FOR_SORTEX,
                    },
                });
            }
            await tx.plantTransfer.update({
                where: { id },
                data: {
                    status: production_constants_1.TransferStatus.RECEIVED,
                    receivedDate: new Date(),
                    receivedById: user.sub,
                },
            });
            if (t.stockCategory === production_constants_1.StockCategory.RAW_MATERIAL) {
                const type = (await tx.inwardType.findFirst({ where: { code: 'DOMESTIC', isActive: true } })) ||
                    (await tx.inwardType.findFirst({ where: { isActive: true } }));
                const supplier = (await tx.supplier.findFirst({ where: { isActive: true } })) ||
                    (await tx.supplier.create({ data: { name: 'Plant Transfer', code: 'TRF-PARTY' } }));
                if (type && supplier) {
                    const year = new Date().getFullYear();
                    const prefix = `INW-${year}-`;
                    const latest = await tx.rawMaterialInward.findFirst({
                        where: { inwardNumber: { startsWith: prefix } },
                        orderBy: { inwardNumber: 'desc' },
                    });
                    let next = 1;
                    if (latest) {
                        const n = parseInt(latest.inwardNumber.split('-').pop() || '0', 10);
                        if (!isNaN(n))
                            next = n + 1;
                    }
                    const inwardNumber = `${prefix}${String(next).padStart(5, '0')}`;
                    const inward = await tx.rawMaterialInward.create({
                        data: {
                            inwardNumber,
                            supplierId: supplier.id,
                            inwardDate: new Date(),
                            truckNumber: `TRF-${t.transferNumber}`,
                            productId: t.productId,
                            numberOfBags: 0,
                            weightKg: t.quantityKg,
                            inputUnit: 'KG',
                            inwardTypeId: type.id,
                            locationId: t.destLocationId,
                            remarks: `Auto-linked from plant transfer ${t.transferNumber}`,
                            createdById: user.sub,
                        },
                    });
                    await tx.plantTransfer.update({
                        where: { id },
                        data: { linkedInwardId: inward.id },
                    });
                }
            }
        });
        await this.audit.log({
            module: 'TRANSFER',
            recordType: 'PlantTransfer',
            recordNumber: t.transferNumber,
            action: 'RECEIVED',
            changedById: user.sub,
        });
        return this.prisma.plantTransfer.findUnique({
            where: { id },
            include: { sourceLocation: true, destLocation: true, product: true },
        });
    }
    async getOwnerDashboard() {
        const balances = await this.prisma.inventoryBalance.findMany({
            where: { quantityKg: { gt: 0 } },
            include: { product: true, location: true },
        });
        const byCategory = {};
        const byLocation = {};
        const rawByProduct = {};
        for (const b of balances) {
            byCategory[b.stockCategory] = (byCategory[b.stockCategory] || 0) + b.quantityKg;
            byLocation[b.location.name] = (byLocation[b.location.name] || 0) + b.quantityKg;
            if (b.stockCategory === production_constants_1.StockCategory.RAW_MATERIAL) {
                const key = b.productId;
                if (!rawByProduct[key])
                    rawByProduct[key] = { name: b.product.name, total: 0, locations: {} };
                rawByProduct[key].total += b.quantityKg;
                rawByProduct[key].locations[b.location.name] = (rawByProduct[key].locations[b.location.name] || 0) + b.quantityKg;
            }
        }
        const wastageAlerts = await this.prisma.productionRun.findMany({
            where: { wastageAlert: true },
            include: {
                plant: true,
                product: true,
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
        });
        const sampling = await this.prisma.sampleRecord.groupBy({
            by: ['status'],
            _count: { _all: true },
        });
        const transfers = await this.prisma.plantTransfer.groupBy({
            by: ['status'],
            _count: { _all: true },
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in7 = new Date(today);
        in7.setDate(in7.getDate() + 7);
        const openContainers = await this.prisma.contractContainer.findMany({
            where: {
                containerStatus: {
                    notIn: ['SHIPPED', 'COMPLETED', 'CANCELLED', 'DISPATCHED_FROM_FACTORY', 'FULFILLED'],
                },
                contract: {
                    status: { notIn: ['COMPLETED', 'CANCELLED', 'FULLY_DISPATCHED', 'DRAFT'] },
                },
            },
            select: {
                id: true,
                expectedShipmentDate: true,
                quantityMt: true,
                productId: true,
                contractId: true,
                contract: { select: { contractNumber: true, euClassification: true, buyer: { select: { name: true } } } },
                products: { select: { id: true, productId: true, quantityMt: true } },
            },
            take: 300,
        });
        const allocs = await this.prisma.containerAllocation.groupBy({
            by: ['containerId'],
            where: { status: 'ACTIVE' },
            _sum: { quantityKg: true },
        });
        const fulfilledByContainer = new Map(allocs.map((a) => [a.containerId, a._sum.quantityKg || 0]));
        let overdue = 0;
        let dueSoon = 0;
        let other = 0;
        const pendingItems = [];
        for (const ct of openContainers) {
            const requiredKg = (ct.products?.length
                ? ct.products.reduce((s, p) => s + (p.quantityMt || 0) * 1000, 0)
                : (ct.quantityMt || 0) * 1000) || 0;
            const fulfilled = fulfilledByContainer.get(ct.id) || 0;
            if (requiredKg - fulfilled <= 0.001)
                continue;
            const due = ct.expectedShipmentDate ? new Date(ct.expectedShipmentDate) : null;
            let urgency = 'WHITE';
            if (due && due < today) {
                urgency = 'RED';
                overdue += 1;
            }
            else if (due && due <= in7) {
                urgency = 'YELLOW';
                dueSoon += 1;
            }
            else {
                other += 1;
            }
            if (pendingItems.length < 15) {
                pendingItems.push({
                    id: ct.contractId,
                    contractNumber: ct.contract.contractNumber,
                    buyer: ct.contract.buyer,
                    euClassification: ct.contract.euClassification,
                    dueDate: due,
                    urgency,
                    pendingMt: Math.max(0, requiredKg - fulfilled) / 1000,
                });
            }
        }
        const activeRuns = await this.prisma.productionRun.count({
            where: { status: { notIn: [production_constants_1.ProductionRunStatus.COMPLETED, production_constants_1.ProductionRunStatus.CANCELLED] } },
        });
        const completedToday = await this.prisma.productionRun.findMany({
            where: { hullingFinalizedAt: { gte: today } },
            include: { product: true, plant: true },
        });
        const unpaid = await this.prisma.contractContainer.findMany({
            where: {
                OR: [
                    { paymentStatus: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
                    { remainingAmount: { gt: 0 }, paymentStatus: { not: 'RECEIVED' } },
                ],
            },
            select: { remainingAmount: true, expectedShipmentDate: true },
            take: 500,
        });
        const paymentPending = unpaid.length;
        const overdueAmount = unpaid
            .filter((c) => c.expectedShipmentDate && c.expectedShipmentDate < today)
            .reduce((s, c) => s + Number(c.remainingAmount || 0), 0);
        return {
            inventory: {
                byCategory,
                byLocation,
                rawByProduct: Object.values(rawByProduct),
                totalRaw: byCategory[production_constants_1.StockCategory.RAW_MATERIAL] || 0,
                totalProcessed: byCategory[production_constants_1.StockCategory.PROCESSED_AVAILABLE] || 0,
                totalWip: (byCategory[production_constants_1.StockCategory.WIP_CLEANING] || 0) + (byCategory[production_constants_1.StockCategory.WIP_HULLING] || 0),
                totalRejected: byCategory[production_constants_1.StockCategory.SAMPLE_REJECTED] || 0,
                totalInTransit: byCategory[production_constants_1.StockCategory.STOCK_IN_TRANSIT] || 0,
            },
            wastageAlerts,
            sampling: sampling.map((s) => ({ status: s.status, count: s._count._all })),
            transfers: transfers.map((t) => ({ status: t.status, count: t._count._all })),
            pendingContracts: {
                overdue,
                dueSoon,
                other,
                items: pendingItems,
            },
            production: {
                activeRuns,
                completedToday: completedToday.map((r) => ({
                    productionNumber: r.productionNumber,
                    product: r.product.name,
                    plant: r.plant.name,
                    netOutputKg: r.netOutputKg,
                })),
            },
            payments: {
                pendingContainers: paymentPending,
                overdueAmount: overdueAmount,
            },
        };
    }
    listAudit(query) {
        return this.audit.list(query);
    }
};
exports.ProductionService = ProductionService;
exports.ProductionService = ProductionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_ledger_service_1.InventoryLedgerService,
        production_audit_service_1.ProductionAuditService,
        notification_service_1.NotificationService])
], ProductionService);
//# sourceMappingURL=production.service.js.map