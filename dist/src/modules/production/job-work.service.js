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
exports.JobWorkService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const enums_1 = require("../../common/constants/enums");
const production_constants_1 = require("../../common/constants/production.constants");
const inventory_ledger_service_1 = require("./inventory-ledger.service");
const production_audit_service_1 = require("./production-audit.service");
let JobWorkService = class JobWorkService {
    prisma;
    ledger;
    audit;
    constructor(prisma, ledger, audit) {
        this.prisma = prisma;
        this.ledger = ledger;
        this.audit = audit;
    }
    tx(fn) {
        return this.prisma.$transaction(fn, { maxWait: 15000, timeout: 60000 });
    }
    async nextJwNumber() {
        const year = new Date().getFullYear();
        const prefix = `JW-${year}-`;
        const latest = await this.prisma.jobWork.findFirst({
            where: { jobWorkNumber: { startsWith: prefix } },
            orderBy: { jobWorkNumber: 'desc' },
        });
        let next = 1;
        if (latest) {
            const n = parseInt(latest.jobWorkNumber.split('-').pop() || '0', 10);
            if (!isNaN(n))
                next = n + 1;
        }
        return `${prefix}${String(next).padStart(5, '0')}`;
    }
    async nextOutwardNumber(jobWorkNumber) {
        const prefix = `${jobWorkNumber}-OUT-`;
        const latest = await this.prisma.jobWorkOutward.findFirst({
            where: { outwardNumber: { startsWith: prefix } },
            orderBy: { outwardNumber: 'desc' },
        });
        let next = 1;
        if (latest) {
            const n = parseInt(latest.outwardNumber.split('-').pop() || '0', 10);
            if (!isNaN(n))
                next = n + 1;
        }
        return `${prefix}${String(next).padStart(3, '0')}`;
    }
    async nextInwardNumber(jobWorkNumber) {
        const prefix = `${jobWorkNumber}-IN-`;
        const latest = await this.prisma.jobWorkInward.findFirst({
            where: { inwardNumber: { startsWith: prefix } },
            orderBy: { inwardNumber: 'desc' },
        });
        let next = 1;
        if (latest) {
            const n = parseInt(latest.inwardNumber.split('-').pop() || '0', 10);
            if (!isNaN(n))
                next = n + 1;
        }
        return `${prefix}${String(next).padStart(3, '0')}`;
    }
    async nextLotNumber(prefix, client = this.prisma) {
        const year = new Date().getFullYear();
        const full = `${prefix}-${year}-`;
        const row = await client.processedOutputLot.findFirst({
            where: { lotNumber: { startsWith: full } },
            orderBy: { lotNumber: 'desc' },
        });
        let next = 1;
        if (row) {
            const n = parseInt(row.lotNumber.split('-').pop() || '0', 10);
            if (!isNaN(n))
                next = n + 1;
        }
        return `${full}${String(next).padStart(5, '0')}`;
    }
    async nextWastageLotNumber(client = this.prisma) {
        const year = new Date().getFullYear();
        const full = `WL-${year}-`;
        const row = await client.wastageLot.findFirst({
            where: { lotNumber: { startsWith: full } },
            orderBy: { lotNumber: 'desc' },
        });
        let next = 1;
        if (row) {
            const n = parseInt(row.lotNumber.split('-').pop() || '0', 10);
            if (!isNaN(n))
                next = n + 1;
        }
        return `${full}${String(next).padStart(5, '0')}`;
    }
    createSeqAllocator(first) {
        const parts = first.split('-');
        const year = parts[1];
        const prefix = parts[0];
        let next = parseInt(parts[parts.length - 1] || '1', 10);
        return () => {
            const n = next++;
            return `${prefix}-${year}-${String(n).padStart(5, '0')}`;
        };
    }
    async nextRunNumber() {
        const year = new Date().getFullYear();
        const full = `PR-${year}-`;
        const row = await this.prisma.productionRun.findFirst({
            where: { productionNumber: { startsWith: full } },
            orderBy: { productionNumber: 'desc' },
        });
        let next = 1;
        if (row) {
            const n = parseInt(row.productionNumber.split('-').pop() || '0', 10);
            if (!isNaN(n))
                next = n + 1;
        }
        return `${full}${String(next).padStart(5, '0')}`;
    }
    listWorkers() {
        return this.prisma.jobWorker.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    }
    async createWorker(dto) {
        const code = dto.code?.trim().toUpperCase() ||
            `JW-P-${dto.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8)}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
        return this.prisma.jobWorker.create({
            data: { code, name: dto.name.trim(), phone: dto.phone },
        });
    }
    list(filters) {
        return this.prisma.jobWork.findMany({
            where: {
                ...(filters?.status ? { status: filters.status } : {}),
                ...(filters?.productId ? { productId: filters.productId } : {}),
                ...(filters?.jobWorkerId ? { jobWorkerId: filters.jobWorkerId } : {}),
            },
            include: {
                jobWorker: true,
                product: true,
                sourceLocation: true,
                outwards: true,
                inwards: { include: { lines: { include: { wastageType: true } }, receivingLocation: true } },
                wastageDispositions: { include: { wastageType: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getOne(id) {
        const jw = await this.prisma.jobWork.findUnique({
            where: { id },
            include: {
                jobWorker: true,
                product: true,
                sourceLocation: true,
                outwards: { orderBy: { createdAt: 'asc' } },
                inwards: {
                    include: { lines: { include: { wastageType: true } }, receivingLocation: true },
                    orderBy: { createdAt: 'asc' },
                },
                wastageDispositions: { include: { wastageType: true } },
                processedLots: true,
                wastageLots: { include: { wastageType: true } },
            },
        });
        if (!jw)
            throw new common_1.NotFoundException('Job Work not found');
        return { ...jw, reconciliation: this.buildReconciliation(jw) };
    }
    buildReconciliation(jw) {
        const totalSent = jw.totalSentKg || 0;
        const processedReceived = (jw.inwards || [])
            .flatMap((i) => i.lines || [])
            .filter((l) => l.returnCategory === production_constants_1.JobWorkReturnCategory.PROCESSED)
            .reduce((s, l) => s + l.quantityKg, 0);
        const wastageReceived = (jw.inwards || [])
            .flatMap((i) => i.lines || [])
            .filter((l) => l.returnCategory === production_constants_1.JobWorkReturnCategory.WASTAGE)
            .reduce((s, l) => s + l.quantityKg, 0);
        const unprocessedReturned = (jw.inwards || [])
            .flatMap((i) => i.lines || [])
            .filter((l) => l.returnCategory === production_constants_1.JobWorkReturnCategory.UNPROCESSED)
            .reduce((s, l) => s + l.quantityKg, 0);
        const wastageDiscarded = (jw.wastageDispositions || [])
            .filter((d) => d.disposition === production_constants_1.JobWorkWastageDisposition.DISCARDED_AT_WORKER)
            .reduce((s, d) => s + d.quantityKg, 0);
        const wastageExpectedReturn = (jw.wastageDispositions || [])
            .filter((d) => d.disposition === production_constants_1.JobWorkWastageDisposition.RETURNED)
            .reduce((s, d) => s + d.quantityKg, 0);
        const stillOutside = Math.round((totalSent - processedReceived - wastageReceived - unprocessedReturned - wastageDiscarded) * 1000) / 1000;
        const expectedProcessed = jw.netProcessedOutputKg || 0;
        const reconDiff = Math.round((expectedProcessed - processedReceived) * 1000) / 1000;
        return {
            totalSentKg: totalSent,
            totalProcessedInputKg: jw.totalProcessedInputKg || 0,
            processedOutputExpectedKg: expectedProcessed,
            processedOutputReceivedKg: processedReceived,
            wastageExpectedReturnKg: wastageExpectedReturn,
            wastageReceivedKg: wastageReceived,
            wastageDiscardedKg: wastageDiscarded,
            unprocessedReturnedKg: unprocessedReturned,
            quantityStillOutsideKg: stillOutside,
            reconciliationDifferenceKg: reconDiff,
            flagged: Math.abs(stillOutside) > 0.001 || Math.abs(reconDiff) > 0.001,
        };
    }
    async create(dto, user) {
        const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
        if (!product?.isActive)
            throw new common_1.BadRequestException('Product not found');
        if (dto.processType === production_constants_1.ProcessType.FULL_PROCESS && !product.allowsFullProcess) {
            throw new common_1.BadRequestException('Full Process is currently available only for Sesame Seed products.');
        }
        const jobWorkNumber = await this.nextJwNumber();
        const created = await this.prisma.jobWork.create({
            data: {
                jobWorkNumber,
                jobWorkerId: dto.jobWorkerId,
                sourceLocationId: dto.sourceLocationId,
                productId: dto.productId,
                processType: dto.processType,
                startDate: new Date(dto.startDate),
                remarks: dto.remarks,
                status: production_constants_1.JobWorkStatus.ACTIVE,
                createdById: user.sub,
            },
        });
        await this.audit.log({
            module: 'JOB_WORK',
            recordType: 'JobWork',
            recordNumber: jobWorkNumber,
            action: 'CREATED',
            changedById: user.sub,
        });
        return this.getOne(created.id);
    }
    async addOutward(id, dto, user) {
        const jw = await this.getOne(id);
        if ([production_constants_1.JobWorkStatus.CLOSED, production_constants_1.JobWorkStatus.CANCELLED].includes(jw.status)) {
            throw new common_1.BadRequestException('Cannot add outward to closed Job Work');
        }
        const qtyKg = (0, production_constants_1.toKg)(dto.quantity, dto.unit || 'KG');
        const sourceId = dto.sourceLocationId || jw.sourceLocationId;
        const avail = await this.ledger.getAvailableKg(jw.productId, sourceId, production_constants_1.StockCategory.RAW_MATERIAL);
        if (avail < qtyKg - 0.001) {
            throw new common_1.BadRequestException(`Insufficient raw material. Available: ${avail} KG`);
        }
        const outwardNumber = await this.nextOutwardNumber(jw.jobWorkNumber);
        await this.tx(async (tx) => {
            await tx.jobWorkOutward.create({
                data: {
                    outwardNumber,
                    jobWorkId: id,
                    outwardDate: new Date(dto.outwardDate),
                    sourceLocationId: sourceId,
                    productId: jw.productId,
                    quantityKg: qtyKg,
                    numberOfBags: dto.numberOfBags,
                    truckNumber: dto.truckNumber,
                    challanNumber: dto.challanNumber,
                    remarks: dto.remarks,
                    createdById: user.sub,
                },
            });
            const totalSent = Math.round((jw.totalSentKg + qtyKg) * 1000) / 1000;
            await tx.jobWork.update({
                where: { id },
                data: {
                    totalSentKg: totalSent,
                    status: jw.outwards.length === 0
                        ? production_constants_1.JobWorkStatus.MATERIAL_SENT
                        : production_constants_1.JobWorkStatus.MATERIAL_PARTIALLY_SENT,
                },
            });
            await this.ledger.postTxn(tx, {
                txnType: production_constants_1.LedgerTxnType.JOB_WORK_OUTWARD,
                productId: jw.productId,
                stockCategory: production_constants_1.StockCategory.RAW_MATERIAL,
                locationId: sourceId,
                fromCategory: production_constants_1.StockCategory.RAW_MATERIAL,
                toCategory: production_constants_1.StockCategory.MATERIAL_WITH_JOB_WORKER,
                quantityOutKg: qtyKg,
                quantityInKg: qtyKg,
                referenceType: 'JOB_WORK',
                referenceId: id,
                remarks: `Outward ${outwardNumber}`,
                createdById: user.sub,
            });
        });
        await this.audit.log({
            module: 'JOB_WORK',
            recordType: 'JobWorkOutward',
            recordNumber: outwardNumber,
            action: 'OUTWARD',
            changedById: user.sub,
            newValue: String(qtyKg),
        });
        return this.getOne(id);
    }
    async addInward(id, dto, user) {
        const jw = await this.getOne(id);
        if ([production_constants_1.JobWorkStatus.CLOSED, production_constants_1.JobWorkStatus.CANCELLED].includes(jw.status)) {
            throw new common_1.BadRequestException('Cannot add inward to closed Job Work');
        }
        if (!dto.lines?.length)
            throw new common_1.BadRequestException('At least one return line is required');
        const inwardNumber = await this.nextInwardNumber(jw.jobWorkNumber);
        await this.tx(async (tx) => {
            const inward = await tx.jobWorkInward.create({
                data: {
                    inwardNumber,
                    jobWorkId: id,
                    receiptDate: new Date(dto.receiptDate),
                    receivingLocationId: dto.receivingLocationId,
                    truckNumber: dto.truckNumber,
                    challanNumber: dto.challanNumber,
                    remarks: dto.remarks,
                    receivedById: user.sub,
                },
            });
            const nextOutLot = this.createSeqAllocator(await this.nextLotNumber('OUT', tx));
            const nextWlLot = this.createSeqAllocator(await this.nextWastageLotNumber(tx));
            for (const line of dto.lines) {
                const qtyKg = (0, production_constants_1.toKg)(line.quantity, line.unit || 'KG');
                if (line.returnCategory === production_constants_1.JobWorkReturnCategory.WASTAGE &&
                    !line.wastageTypeId) {
                    throw new common_1.BadRequestException('Wastage type required for wastage return lines');
                }
                await tx.jobWorkInwardLine.create({
                    data: {
                        inwardId: inward.id,
                        returnCategory: line.returnCategory,
                        wastageTypeId: line.wastageTypeId,
                        productId: jw.productId,
                        quantityKg: qtyKg,
                        numberOfBags: line.numberOfBags,
                        remarks: line.remarks,
                    },
                });
                if (line.returnCategory === production_constants_1.JobWorkReturnCategory.PROCESSED) {
                    const lotNumber = nextOutLot();
                    await tx.processedOutputLot.create({
                        data: {
                            lotNumber,
                            productId: jw.productId,
                            plantId: dto.receivingLocationId,
                            processType: jw.processType,
                            quantityKg: qtyKg,
                            availableKg: qtyKg,
                            completionDate: new Date(dto.receiptDate),
                            productionSource: production_constants_1.ProductionSource.JOB_WORK,
                            jobWorkId: id,
                            status: 'AVAILABLE',
                        },
                    });
                    await this.ledger.postTxn(tx, {
                        txnType: production_constants_1.LedgerTxnType.JOB_WORK_INWARD_PROCESSED,
                        productId: jw.productId,
                        stockCategory: production_constants_1.StockCategory.MATERIAL_WITH_JOB_WORKER,
                        sourceLocationId: jw.sourceLocationId,
                        quantityOutKg: qtyKg,
                        referenceType: 'JOB_WORK_INWARD',
                        referenceId: inward.id,
                        remarks: `Clear JW material ${inwardNumber}`,
                        createdById: user.sub,
                    });
                    await this.ledger.postTxn(tx, {
                        txnType: production_constants_1.LedgerTxnType.JOB_WORK_INWARD_PROCESSED,
                        productId: jw.productId,
                        stockCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                        destLocationId: dto.receivingLocationId,
                        quantityInKg: qtyKg,
                        referenceType: 'JOB_WORK_INWARD',
                        referenceId: inward.id,
                        remarks: `JW processed return ${inwardNumber}`,
                        createdById: user.sub,
                    });
                }
                else if (line.returnCategory === production_constants_1.JobWorkReturnCategory.WASTAGE && line.wastageTypeId) {
                    const wlNumber = nextWlLot();
                    await tx.wastageLot.create({
                        data: {
                            lotNumber: wlNumber,
                            productId: jw.productId,
                            wastageTypeId: line.wastageTypeId,
                            locationId: dto.receivingLocationId,
                            quantityKg: qtyKg,
                            availableKg: qtyKg,
                            jobWorkId: id,
                            processType: jw.processType,
                            status: production_constants_1.WastageLotStatus.AVAILABLE,
                            productionDate: new Date(dto.receiptDate),
                        },
                    });
                    await this.ledger.postTxn(tx, {
                        txnType: production_constants_1.LedgerTxnType.JOB_WORK_INWARD_WASTAGE,
                        productId: jw.productId,
                        stockCategory: production_constants_1.StockCategory.WASTAGE_INVENTORY,
                        destLocationId: dto.receivingLocationId,
                        quantityInKg: qtyKg,
                        referenceType: 'JOB_WORK_INWARD',
                        referenceId: inward.id,
                        createdById: user.sub,
                    });
                }
                else if (line.returnCategory === production_constants_1.JobWorkReturnCategory.UNPROCESSED) {
                    await this.ledger.postTxn(tx, {
                        txnType: production_constants_1.LedgerTxnType.JOB_WORK_INWARD_UNPROCESSED,
                        productId: jw.productId,
                        stockCategory: production_constants_1.StockCategory.MATERIAL_WITH_JOB_WORKER,
                        locationId: jw.sourceLocationId,
                        fromCategory: production_constants_1.StockCategory.MATERIAL_WITH_JOB_WORKER,
                        toCategory: production_constants_1.StockCategory.RAW_MATERIAL,
                        quantityOutKg: qtyKg,
                        quantityInKg: qtyKg,
                        destLocationId: dto.receivingLocationId,
                        referenceType: 'JOB_WORK_INWARD',
                        referenceId: inward.id,
                        createdById: user.sub,
                    });
                }
            }
            await tx.jobWork.update({
                where: { id },
                data: { status: production_constants_1.JobWorkStatus.PARTIALLY_RECEIVED },
            });
        });
        await this.audit.log({
            module: 'JOB_WORK',
            recordType: 'JobWorkInward',
            recordNumber: inwardNumber,
            action: 'INWARD',
            changedById: user.sub,
        });
        return this.getOne(id);
    }
    async submitProcessResult(id, dto, user) {
        const jw = await this.getOne(id);
        let cleaningWastage = 0;
        for (const line of dto.cleaningLines || []) {
            cleaningWastage += (0, production_constants_1.toKg)(line.quantity ?? 0, line.unit || 'KG');
        }
        let hullingWastage = 0;
        if (jw.processType === production_constants_1.ProcessType.FULL_PROCESS) {
            for (const line of dto.hullingLines || []) {
                let q = 0;
                if (line.numberOfBags != null && line.weightPerBag != null) {
                    q = (0, production_constants_1.toKg)(line.numberOfBags * line.weightPerBag, line.unit || 'KG');
                }
                else {
                    q = (0, production_constants_1.toKg)(line.quantity ?? 0, line.unit || 'KG');
                }
                hullingWastage += q;
            }
        }
        const totalWastage = Math.round((cleaningWastage + hullingWastage) * 1000) / 1000;
        const net = Math.round((dto.totalProcessedInputKg - totalWastage) * 1000) / 1000;
        if (net < 0)
            throw new common_1.BadRequestException('Net processed output cannot be negative');
        const allLines = [
            ...(dto.cleaningLines || []).map((l) => ({
                ...l,
                stage: production_constants_1.WastageStage.CLEANING,
                qty: (0, production_constants_1.toKg)(l.quantity ?? 0, l.unit || 'KG'),
            })),
            ...(dto.hullingLines || []).map((l) => {
                let q = 0;
                if (l.numberOfBags != null && l.weightPerBag != null) {
                    q = (0, production_constants_1.toKg)(l.numberOfBags * l.weightPerBag, l.unit || 'KG');
                }
                else {
                    q = (0, production_constants_1.toKg)(l.quantity ?? 0, l.unit || 'KG');
                }
                return { ...l, stage: production_constants_1.WastageStage.HULLING, qty: q };
            }),
        ].filter((l) => l.qty > 0);
        for (const line of allLines) {
            const disp = dto.dispositions.find((d) => d.wastageTypeId === line.wastageTypeId);
            if (!disp || ![production_constants_1.JobWorkWastageDisposition.RETURNED, production_constants_1.JobWorkWastageDisposition.DISCARDED_AT_WORKER, production_constants_1.WastageDisposition.STORE, production_constants_1.WastageDisposition.DISCARD].includes(disp.action)) {
                if (!disp)
                    throw new common_1.BadRequestException(`Disposition required for wastage type ${line.wastageTypeId}`);
            }
        }
        const thresholdRow = await this.prisma.appSetting.findUnique({
            where: { key: production_constants_1.WASTAGE_ALERT_THRESHOLD_KEY },
        });
        const threshold = Number(thresholdRow?.value ?? production_constants_1.DEFAULT_WASTAGE_ALERT_PCT);
        const pct = dto.totalProcessedInputKg > 0
            ? Math.round((totalWastage / dto.totalProcessedInputKg) * 10000) / 100
            : 0;
        await this.tx(async (tx) => {
            await tx.jobWorkWastageDisposition.deleteMany({ where: { jobWorkId: id } });
            for (const line of allLines) {
                const disp = dto.dispositions.find((d) => d.wastageTypeId === line.wastageTypeId);
                const action = disp.action === production_constants_1.WastageDisposition.STORE
                    ? production_constants_1.JobWorkWastageDisposition.RETURNED
                    : disp.action === production_constants_1.WastageDisposition.DISCARD
                        ? production_constants_1.JobWorkWastageDisposition.DISCARDED_AT_WORKER
                        : disp.action;
                await tx.jobWorkWastageDisposition.create({
                    data: {
                        jobWorkId: id,
                        wastageTypeId: line.wastageTypeId,
                        stage: line.stage,
                        quantityKg: line.qty,
                        disposition: action,
                    },
                });
            }
            await tx.jobWork.update({
                where: { id },
                data: {
                    totalProcessedInputKg: dto.totalProcessedInputKg,
                    totalWastageKg: totalWastage,
                    netProcessedOutputKg: net,
                    wastageAlert: pct > threshold,
                    processResultEnteredAt: new Date(),
                    status: production_constants_1.JobWorkStatus.AWAITING_RECONCILIATION,
                },
            });
        });
        await this.audit.log({
            module: 'JOB_WORK',
            recordType: 'JobWorkProcessResult',
            recordNumber: jw.jobWorkNumber,
            action: 'PROCESS_RESULT',
            changedById: user.sub,
            oldValue: JSON.stringify({
                totalProcessedInputKg: jw.totalProcessedInputKg,
                totalWastageKg: jw.totalWastageKg,
                netProcessedOutputKg: jw.netProcessedOutputKg,
            }),
            newValue: JSON.stringify({ totalWastage, net, pct, totalProcessedInputKg: dto.totalProcessedInputKg }),
        });
        return this.getOne(id);
    }
    async close(id, dto, user) {
        const jw = await this.getOne(id);
        if (!jw.processResultEnteredAt) {
            throw new common_1.BadRequestException('Process result must be entered before closing');
        }
        const recon = jw.reconciliation;
        if (Math.abs(recon.quantityStillOutsideKg) > 0.001) {
            const isAdmin = [enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN].includes(user.role);
            if (!isAdmin || dto.varianceKg == null || !dto.varianceReason?.trim()) {
                throw new common_1.BadRequestException(`Unreconciled difference: ${recon.quantityStillOutsideKg} KG. Admin-authorised variance with reason required to close.`);
            }
        }
        await this.prisma.jobWork.update({
            where: { id },
            data: {
                status: production_constants_1.JobWorkStatus.CLOSED,
                closedAt: new Date(),
                closedById: user.sub,
                closeVarianceKg: dto.varianceKg,
                closeVarianceReason: dto.varianceReason,
            },
        });
        await this.audit.log({
            module: 'JOB_WORK',
            recordType: 'JobWork',
            recordNumber: jw.jobWorkNumber,
            action: 'CLOSED',
            changedById: user.sub,
            oldValue: jw.status,
            newValue: production_constants_1.JobWorkStatus.CLOSED,
            reason: dto.varianceReason,
        });
        return this.getOne(id);
    }
    async reopen(id, dto, user) {
        const jw = await this.getOne(id);
        if (jw.status !== production_constants_1.JobWorkStatus.CLOSED) {
            throw new common_1.BadRequestException('Only closed Job Work can be reopened for correction');
        }
        const isAdmin = [enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN].includes(user.role);
        if (!isAdmin || !dto.varianceReason?.trim()) {
            throw new common_1.ForbiddenException('Admin-authorised reason is required to correct a closed Job Work');
        }
        await this.prisma.jobWork.update({
            where: { id },
            data: {
                status: production_constants_1.JobWorkStatus.AWAITING_RECONCILIATION,
                closedAt: null,
                closedById: null,
            },
        });
        await this.audit.log({
            module: 'JOB_WORK',
            recordType: 'JobWork',
            recordNumber: jw.jobWorkNumber,
            action: 'REOPENED_FOR_CORRECTION',
            changedById: user.sub,
            oldValue: production_constants_1.JobWorkStatus.CLOSED,
            newValue: production_constants_1.JobWorkStatus.AWAITING_RECONCILIATION,
            reason: dto.varianceReason,
        });
        return this.getOne(id);
    }
    async startReSortex(id, dto, user) {
        const jw = await this.getOne(id);
        const availableLots = await this.prisma.processedOutputLot.findMany({
            where: {
                jobWorkId: id,
                productionSource: production_constants_1.ProductionSource.JOB_WORK,
                availableKg: { gt: 0.001 },
                status: 'AVAILABLE',
            },
            orderBy: { completionDate: 'asc' },
        });
        const available = availableLots.reduce((s, l) => s + l.availableKg, 0);
        if (dto.quantityKg > available + 0.001) {
            throw new common_1.BadRequestException(`Only ${available} KG available for Re-Sortex`);
        }
        const plantId = dto.plantId || availableLots[0]?.plantId || jw.sourceLocationId;
        const productionNumber = await this.nextRunNumber();
        let remaining = dto.quantityKg;
        const run = await this.tx(async (tx) => {
            const created = await tx.productionRun.create({
                data: {
                    productionNumber,
                    plantId,
                    processType: production_constants_1.ProcessType.SORTEX,
                    productId: jw.productId,
                    status: production_constants_1.ProductionRunStatus.CLEANING_IN_PROGRESS,
                    startDate: new Date(dto.startDate),
                    totalInputKg: dto.quantityKg,
                    remarks: dto.remarks || `Re-Sortex from ${jw.jobWorkNumber}`,
                    productionSource: production_constants_1.ProductionSource.JOB_WORK,
                    jobWorkId: id,
                    createdById: user.sub,
                },
            });
            for (const lot of availableLots) {
                if (remaining <= 0.001)
                    break;
                const take = Math.min(lot.availableKg, remaining);
                await tx.processedOutputLot.update({
                    where: { id: lot.id },
                    data: { availableKg: { decrement: take } },
                });
                await tx.productionInput.create({
                    data: {
                        productionRunId: created.id,
                        inputDate: new Date(dto.startDate),
                        productId: jw.productId,
                        stockCategory: production_constants_1.InputStockCategory.JOB_WORK_RETURNED_PROCESSED,
                        processedLotId: lot.id,
                        quantityKg: take,
                        inputUnit: 'KG',
                        addedById: user.sub,
                    },
                });
                await this.ledger.postTxn(tx, {
                    txnType: production_constants_1.LedgerTxnType.PRODUCTION_ISSUE,
                    productId: jw.productId,
                    stockCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                    locationId: lot.plantId,
                    fromCategory: production_constants_1.StockCategory.PROCESSED_AVAILABLE,
                    toCategory: production_constants_1.StockCategory.WIP_CLEANING,
                    quantityOutKg: take,
                    quantityInKg: take,
                    referenceType: 'PRODUCTION_RUN',
                    referenceId: created.id,
                    createdById: user.sub,
                });
                remaining = Math.round((remaining - take) * 1000) / 1000;
            }
            return created;
        });
        await this.audit.log({
            module: 'JOB_WORK',
            recordType: 'ReSortex',
            recordNumber: productionNumber,
            action: 'START_RESORTEX',
            changedById: user.sub,
            newValue: JSON.stringify({ jobWorkId: id, quantityKg: dto.quantityKg }),
        });
        return this.prisma.productionRun.findUnique({
            where: { id: run.id },
            include: { product: true, plant: true, inputs: true },
        });
    }
    async dashboardStats() {
        const active = await this.prisma.jobWork.count({
            where: { status: { notIn: [production_constants_1.JobWorkStatus.CLOSED, production_constants_1.JobWorkStatus.CANCELLED] } },
        });
        const open = await this.prisma.jobWork.findMany({
            where: { status: { notIn: [production_constants_1.JobWorkStatus.CLOSED, production_constants_1.JobWorkStatus.CANCELLED] } },
            include: { inwards: { include: { lines: true } }, wastageDispositions: true },
        });
        let materialWithWorkers = 0;
        let pendingReturn = 0;
        for (const jw of open) {
            const recon = this.buildReconciliation(jw);
            materialWithWorkers += Math.max(0, recon.quantityStillOutsideKg);
            pendingReturn += Math.max(0, recon.processedOutputExpectedKg - recon.processedOutputReceivedKg);
        }
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const processedThisMonth = await this.prisma.processedOutputLot.aggregate({
            where: {
                productionSource: production_constants_1.ProductionSource.JOB_WORK,
                completionDate: { gte: startOfMonth },
            },
            _sum: { quantityKg: true },
        });
        const receivedThisMonth = processedThisMonth._sum.quantityKg || 0;
        return {
            activeJobWorks: active,
            materialWithJobWorkersKg: Math.round(materialWithWorkers * 1000) / 1000,
            jobWorkProcessedThisMonthKg: Math.round(receivedThisMonth * 1000) / 1000,
            jobWorkMaterialReceivedKg: Math.round(receivedThisMonth * 1000) / 1000,
            jobWorkPendingReturnKg: Math.round(pendingReturn * 1000) / 1000,
        };
    }
};
exports.JobWorkService = JobWorkService;
exports.JobWorkService = JobWorkService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        inventory_ledger_service_1.InventoryLedgerService,
        production_audit_service_1.ProductionAuditService])
], JobWorkService);
//# sourceMappingURL=job-work.service.js.map