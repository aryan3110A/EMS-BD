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
exports.ContractsService = void 0;
const common_1 = require("@nestjs/common");
const enums_1 = require("../../common/constants/enums");
const prisma_service_1 = require("../../prisma/prisma.service");
const calculation_service_1 = require("../../common/services/calculation.service");
const pending_masters_resolver_1 = require("./pending-masters.resolver");
let ContractsService = class ContractsService {
    prisma;
    calc;
    txOptions = { maxWait: 15000, timeout: 30000 };
    constructor(prisma, calc) {
        this.prisma = prisma;
        this.calc = calc;
    }
    detailInclude = {
        office: true,
        salesperson: true,
        buyer: { include: { country: true } },
        product: true,
        productVariant: true,
        packagingType: true,
        packagingSize: true,
        portOfLoading: true,
        destinationPort: { include: { country: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        lots: { include: { destinationPort: true }, orderBy: { lotNumber: 'asc' } },
        containers: {
            include: { product: true, productVariant: true, destinationPort: { include: { country: true } } },
            orderBy: { containerIndex: 'asc' },
        },
        amendments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
    };
    listInclude = {
        salesperson: { select: { id: true, name: true, code: true } },
        buyer: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, code: true, name: true } },
        destinationPort: { select: { id: true, name: true } },
        containers: {
            include: {
                product: { select: { id: true, code: true, name: true } },
                productVariant: { select: { id: true, name: true } },
                destinationPort: { select: { id: true, name: true } },
            },
            orderBy: { containerIndex: 'asc' },
        },
    };
    canAccessAnyOffice(user) {
        return user.role === enums_1.UserRole.SUPER_ADMIN || user.role === enums_1.UserRole.CONTRACT_TEAM;
    }
    scopeOffice(user, officeId) {
        if (this.canAccessAnyOffice(user))
            return officeId;
        return user.officeId;
    }
    async generateContractNumber(officeId) {
        const year = new Date().getFullYear();
        const prefix = `CONT/${year}/`;
        const latest = await this.prisma.contract.findFirst({
            where: { contractNumber: { startsWith: prefix } },
            orderBy: { contractNumber: 'desc' },
        });
        let next = 1;
        if (latest) {
            const parts = latest.contractNumber.split('/');
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num))
                next = num + 1;
        }
        return `${prefix}${String(next).padStart(4, '0')}`;
    }
    enrichCommercialFields(dto) {
        const capacity = dto.standardContainerMt ?? 28;
        const containers = dto.numberOfContainers ?? this.calc.calculateContainers(dto.totalMt, capacity);
        let fobInrPerKg;
        if (dto.fobPrice && dto.exchangeRate) {
            fobInrPerKg = this.calc.calculateFobInrPerKg(dto.fobPrice, dto.exchangeRate, dto.fobPriceUnit ?? 'PER_MT');
        }
        let cifPrice = dto.cifPrice;
        if (!dto.cifManualOverride && !cifPrice && dto.fobPrice != null) {
            cifPrice = this.calc.calculateCif(dto.fobPrice, dto.freight ?? 0, dto.insurance ?? 0);
        }
        let shipmentMonth = dto.shipmentMonth;
        let shipmentYear = dto.shipmentYear;
        let shipmentHalf = dto.shipmentHalf;
        if (dto.expectedShipmentDate) {
            const d = new Date(dto.expectedShipmentDate);
            if (!shipmentMonth)
                shipmentMonth = this.calc.formatShipmentMonth(d);
            if (!shipmentYear)
                shipmentYear = d.getFullYear();
            if (!shipmentHalf)
                shipmentHalf = this.calc.getShipmentHalf(d);
        }
        let advanceAmount;
        let balancePercentage;
        if (dto.advancePercentage && dto.fobPrice && dto.totalMt) {
            const total = dto.fobPrice * dto.totalMt;
            advanceAmount = (total * dto.advancePercentage) / 100;
            balancePercentage = 100 - dto.advancePercentage;
        }
        return {
            containers,
            fobInrPerKg,
            cifPrice,
            shipmentMonth,
            shipmentYear,
            shipmentHalf,
            advanceAmount,
            balancePercentage,
            capacity,
        };
    }
    async create(dto, user) {
        const contractId = await this.prisma.$transaction((tx) => this.createContractInTx(tx, dto, user), this.txOptions);
        return this.findOne(contractId, user);
    }
    async submit(dto, user) {
        const contractId = await this.prisma.$transaction(async (tx) => {
            const idMap = await (0, pending_masters_resolver_1.resolvePendingMastersInTx)(tx, dto.pendingMasters, dto.contract.officeId, dto.contract.buyerId, dto.buyerUpdate);
            const resolvedContract = (0, pending_masters_resolver_1.applyPendingIdsToContractDto)(dto.contract, idMap);
            if (dto.buyerUpdate && resolvedContract.buyerId) {
                await (0, pending_masters_resolver_1.updateBuyerInTx)(tx, resolvedContract.buyerId, dto.buyerUpdate, idMap);
            }
            return this.createContractInTx(tx, resolvedContract, user);
        }, this.txOptions);
        return this.findOne(contractId, user);
    }
    async createContractInTx(tx, dto, user) {
        const canSelectAnyOffice = this.canAccessAnyOffice(user);
        const officeId = canSelectAnyOffice ? dto.officeId : user.officeId;
        if (!officeId) {
            throw new common_1.ForbiddenException(canSelectAnyOffice ? 'Office is required' : 'Your account is not assigned to an office');
        }
        if (!canSelectAnyOffice && user.officeId !== officeId) {
            throw new common_1.ForbiddenException('Cannot create contract for another office');
        }
        const office = await tx.office.findFirst({
            where: { id: officeId, isActive: true },
        });
        if (!office) {
            throw new common_1.NotFoundException('Office not found');
        }
        const contractNumber = dto.contractNumber ?? (await this.generateContractNumber(officeId));
        const enriched = this.enrichCommercialFields(dto);
        const status = dto.status ?? enums_1.ContractStatus.DRAFT;
        const containerRows = dto.containerProducts?.length
            ? dto.containerProducts
            : [
                {
                    containerIndex: 1,
                    productId: dto.productId,
                    productVariantId: dto.productVariantId,
                    processingType: dto.processingType,
                    specification: dto.specification,
                    productRemarks: dto.productRemarks,
                    quantityMt: dto.totalMt / enriched.containers,
                },
            ];
        const primary = containerRows[0];
        const created = await tx.contract.create({
            data: {
                officeId,
                contractNumber,
                receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : null,
                contractDate: dto.contractDate ? new Date(dto.contractDate) : new Date(),
                contractSentDate: dto.contractSentDate ? new Date(dto.contractSentDate) : null,
                signedContractReceivedDate: dto.signedContractReceivedDate
                    ? new Date(dto.signedContractReceivedDate)
                    : null,
                contractOnBehalfOf: dto.contractOnBehalfOf,
                salespersonId: dto.salespersonId,
                buyerId: dto.buyerId,
                productId: primary.productId,
                productVariantId: primary.productVariantId,
                processingType: primary.processingType,
                buyerLotNo: dto.buyerLotNo,
                buyerRemarks: dto.buyerRemarks,
                invoiceNumber: dto.invoiceNumber,
                specification: primary.specification,
                qualityRequirement: dto.qualityRequirement,
                productRemarks: primary.productRemarks,
                quantityUnit: dto.quantityUnit ?? 'MT',
                totalMt: dto.totalMt,
                numberOfContainers: enriched.containers,
                numberOfLots: dto.lots?.length ?? 1,
                standardContainerMt: enriched.capacity,
                incoterm: dto.incoterm ?? 'FOB',
                fobPrice: dto.fobPrice,
                fobCurrency: dto.fobCurrency ?? 'USD',
                fobPriceUnit: dto.fobPriceUnit ?? 'PER_MT',
                freight: dto.freight,
                freightUnit: dto.freightUnit,
                insurance: dto.insurance,
                cifPrice: enriched.cifPrice,
                cifManualOverride: dto.cifManualOverride ?? false,
                exchangeRate: dto.exchangeRate,
                fobInrPerKg: enriched.fobInrPerKg,
                originalContractPrice: dto.originalContractPrice ?? dto.fobPrice,
                amendmentPrice: dto.amendmentPrice,
                amendmentCurrency: dto.amendmentCurrency,
                amendmentDate: dto.amendmentDate ? new Date(dto.amendmentDate) : null,
                amendmentReason: dto.amendmentReason,
                commercialRemarks: dto.commercialRemarks,
                packagingTypeId: dto.packagingTypeId,
                packagingSizeId: dto.packagingSizeId,
                packingDescription: dto.packingDescription,
                packingSizeValue: dto.packingSizeValue,
                packingSizeUnit: dto.packingSizeUnit,
                paymentType: dto.paymentType,
                advancePercentage: dto.advancePercentage,
                advanceAmount: enriched.advanceAmount,
                balancePercentage: enriched.balancePercentage,
                balancePaymentMode: dto.balancePaymentMode,
                balancePaymentStage: dto.balancePaymentStage,
                paymentDescription: dto.paymentDescription,
                portOfLoadingId: dto.portOfLoadingId,
                destinationPortId: dto.destinationPortId,
                euClassification: dto.euClassification,
                shipmentPeriodStart: dto.shipmentPeriodStart ? new Date(dto.shipmentPeriodStart) : null,
                shipmentPeriodEnd: dto.shipmentPeriodEnd ? new Date(dto.shipmentPeriodEnd) : null,
                expectedShipmentDate: dto.expectedShipmentDate ? new Date(dto.expectedShipmentDate) : null,
                shipmentMonth: enriched.shipmentMonth,
                shipmentYear: enriched.shipmentYear,
                shipmentHalf: enriched.shipmentHalf,
                containerNo: dto.containerNo,
                orderMt: dto.totalMt,
                remarks: dto.remarks,
                internalRemarks: dto.internalRemarks,
                status,
                createdById: user.sub,
                containers: {
                    create: containerRows.map((c) => ({
                        containerIndex: c.containerIndex,
                        productId: c.productId,
                        productVariantId: c.productVariantId || null,
                        processingType: c.processingType || null,
                        specification: c.specification || null,
                        productRemarks: c.productRemarks || null,
                        quantityMt: c.quantityMt ?? dto.totalMt / enriched.containers,
                        containerNo: c.containerNo || null,
                        destinationPortId: c.destinationPortId || null,
                        expectedShipmentDate: c.expectedShipmentDate ? new Date(c.expectedShipmentDate) : null,
                        shipmentMonth: c.shipmentMonth || null,
                        shipmentYear: c.shipmentYear ?? null,
                        shipmentHalf: c.shipmentHalf || null,
                    })),
                },
                lots: dto.lots?.length
                    ? {
                        create: dto.lots.map((lot, i) => {
                            const lotDate = lot.expectedShipmentDate
                                ? new Date(lot.expectedShipmentDate)
                                : dto.expectedShipmentDate
                                    ? new Date(dto.expectedShipmentDate)
                                    : null;
                            return {
                                lotNumber: `LOT-${String(i + 1).padStart(2, '0')}`,
                                quantityMt: lot.quantityMt,
                                numberOfContainers: lot.numberOfContainers ?? 1,
                                expectedShipmentDate: lotDate,
                                shipmentMonth: lotDate ? this.calc.formatShipmentMonth(lotDate) : enriched.shipmentMonth,
                                shipmentYear: lotDate?.getFullYear() ?? enriched.shipmentYear,
                                shipmentHalf: lotDate ? this.calc.getShipmentHalf(lotDate) : enriched.shipmentHalf,
                                destinationPortId: lot.destinationPortId ?? dto.destinationPortId,
                                remarks: lot.remarks,
                            };
                        }),
                    }
                    : {
                        create: [
                            {
                                lotNumber: 'LOT-01',
                                quantityMt: dto.totalMt,
                                numberOfContainers: enriched.containers,
                                expectedShipmentDate: dto.expectedShipmentDate
                                    ? new Date(dto.expectedShipmentDate)
                                    : null,
                                shipmentMonth: enriched.shipmentMonth,
                                shipmentYear: enriched.shipmentYear,
                                shipmentHalf: enriched.shipmentHalf,
                                destinationPortId: dto.destinationPortId,
                            },
                        ],
                    },
            },
            select: { id: true },
        });
        await tx.contractStatusHistory.create({
            data: {
                contractId: created.id,
                toStatus: status,
                changedBy: user.name,
                remarks: 'Contract created',
            },
        });
        return created.id;
    }
    async findAll(query, user) {
        const officeId = this.scopeOffice(user, query.officeId);
        const where = {
            ...(officeId ? { officeId } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.salespersonId ? { salespersonId: query.salespersonId } : {}),
            ...(query.buyerId ? { buyerId: query.buyerId } : {}),
            ...(query.shipmentMonth ? { shipmentMonth: query.shipmentMonth } : {}),
            ...(query.search
                ? { buyer: { name: { contains: query.search, mode: 'insensitive' } } }
                : {}),
        };
        return this.prisma.contract.findMany({
            where,
            include: this.listInclude,
            orderBy: [{ contractDate: 'desc' }, { createdAt: 'desc' }],
        });
    }
    async findOne(id, user) {
        const contract = await this.prisma.contract.findUnique({
            where: { id },
            include: this.detailInclude,
        });
        if (!contract)
            throw new common_1.NotFoundException('Contract not found');
        if (!this.canAccessAnyOffice(user) && user.officeId !== contract.officeId) {
            throw new common_1.ForbiddenException('Access denied');
        }
        return contract;
    }
    async update(id, dto, user) {
        await this.findOne(id, user);
        const enriched = this.enrichCommercialFields(dto);
        return this.prisma.contract.update({
            where: { id },
            data: {
                receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : undefined,
                contractDate: dto.contractDate ? new Date(dto.contractDate) : undefined,
                contractSentDate: dto.contractSentDate ? new Date(dto.contractSentDate) : undefined,
                signedContractReceivedDate: dto.signedContractReceivedDate
                    ? new Date(dto.signedContractReceivedDate)
                    : undefined,
                contractOnBehalfOf: dto.contractOnBehalfOf,
                salespersonId: dto.salespersonId,
                buyerId: dto.buyerId,
                buyerRemarks: dto.buyerRemarks,
                productId: dto.productId,
                productVariantId: dto.productVariantId,
                processingType: dto.processingType,
                buyerLotNo: dto.buyerLotNo,
                invoiceNumber: dto.invoiceNumber,
                specification: dto.specification,
                qualityRequirement: dto.qualityRequirement,
                productRemarks: dto.productRemarks,
                quantityUnit: dto.quantityUnit,
                totalMt: dto.totalMt,
                numberOfContainers: enriched.containers,
                incoterm: dto.incoterm,
                fobPrice: dto.fobPrice,
                fobCurrency: dto.fobCurrency,
                fobPriceUnit: dto.fobPriceUnit,
                freight: dto.freight,
                freightUnit: dto.freightUnit,
                insurance: dto.insurance,
                cifPrice: enriched.cifPrice,
                cifManualOverride: dto.cifManualOverride,
                exchangeRate: dto.exchangeRate,
                fobInrPerKg: enriched.fobInrPerKg,
                originalContractPrice: dto.originalContractPrice,
                amendmentPrice: dto.amendmentPrice,
                amendmentCurrency: dto.amendmentCurrency,
                amendmentDate: dto.amendmentDate ? new Date(dto.amendmentDate) : undefined,
                amendmentReason: dto.amendmentReason,
                commercialRemarks: dto.commercialRemarks,
                euClassification: dto.euClassification,
                packagingTypeId: dto.packagingTypeId,
                packagingSizeId: dto.packagingSizeId,
                packingDescription: dto.packingDescription,
                packingSizeValue: dto.packingSizeValue,
                packingSizeUnit: dto.packingSizeUnit,
                paymentType: dto.paymentType,
                advancePercentage: dto.advancePercentage,
                advanceAmount: enriched.advanceAmount,
                balancePercentage: enriched.balancePercentage,
                balancePaymentMode: dto.balancePaymentMode,
                balancePaymentStage: dto.balancePaymentStage,
                paymentDescription: dto.paymentDescription,
                portOfLoadingId: dto.portOfLoadingId,
                destinationPortId: dto.destinationPortId,
                expectedShipmentDate: dto.expectedShipmentDate ? new Date(dto.expectedShipmentDate) : undefined,
                shipmentMonth: enriched.shipmentMonth,
                shipmentYear: enriched.shipmentYear,
                shipmentHalf: enriched.shipmentHalf,
                containerNo: dto.containerNo,
                remarks: dto.remarks,
                internalRemarks: dto.internalRemarks,
                status: dto.status,
            },
            include: this.detailInclude,
        });
    }
    async updateStatus(id, status, user, remarks) {
        const contract = await this.findOne(id, user);
        const updated = await this.prisma.$transaction(async (tx) => {
            const u = await tx.contract.update({
                where: { id },
                data: {
                    status,
                    ...(status === enums_1.ContractStatus.CONFIRMED_FOR_PRODUCTION
                        ? { productionInformed: true, productionInformedDate: new Date() }
                        : {}),
                },
                select: { id: true },
            });
            await tx.contractStatusHistory.create({
                data: {
                    contractId: id,
                    fromStatus: contract.status,
                    toStatus: status,
                    changedBy: user.name,
                    remarks,
                },
            });
            return u.id;
        }, this.txOptions);
        return this.findOne(updated, user);
    }
    async getDashboardStats(user) {
        const officeId = this.scopeOffice(user);
        const where = officeId ? { officeId } : {};
        const [grouped, recent] = await Promise.all([
            this.prisma.contract.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
            }),
            this.prisma.contract.findMany({
                where,
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    contractNumber: true,
                    receivedDate: true,
                    totalMt: true,
                    status: true,
                    salesperson: { select: { name: true } },
                    buyer: { select: { name: true } },
                    product: { select: { code: true } },
                },
            }),
        ]);
        const countFor = (status) => grouped.find((g) => g.status === status)?._count._all ?? 0;
        const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
        return {
            total,
            draft: countFor(enums_1.ContractStatus.DRAFT),
            awaitingSigned: countFor(enums_1.ContractStatus.AWAITING_SIGNED),
            confirmed: countFor(enums_1.ContractStatus.CONFIRMED_FOR_PRODUCTION),
            inProduction: countFor(enums_1.ContractStatus.IN_PRODUCTION),
            ready: countFor(enums_1.ContractStatus.READY_FOR_DISPATCH),
            recent,
        };
    }
};
exports.ContractsService = ContractsService;
exports.ContractsService = ContractsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        calculation_service_1.CalculationService])
], ContractsService);
//# sourceMappingURL=contracts.service.js.map