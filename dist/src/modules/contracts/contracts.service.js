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
        amendments: { orderBy: { createdAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
    };
    listInclude = {
        salesperson: { select: { id: true, name: true, code: true } },
        buyer: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, code: true, name: true } },
        destinationPort: { select: { id: true, name: true } },
    };
    scopeOffice(user, officeId) {
        if (user.role === enums_1.UserRole.SUPER_ADMIN)
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
        const containers = this.calc.calculateContainers(dto.totalMt, capacity);
        let fobInrPerKg;
        if (dto.fobPrice && dto.exchangeRate) {
            fobInrPerKg = this.calc.calculateFobInrPerKg(dto.fobPrice, dto.exchangeRate, dto.fobPriceUnit ?? 'PER_MT');
        }
        let cifPrice = dto.cifPrice;
        if (!dto.cifManualOverride && !cifPrice && dto.fobPrice != null) {
            cifPrice = this.calc.calculateCif(dto.fobPrice, dto.freight ?? 0, dto.insurance ?? 0);
        }
        let shipmentMonth;
        let shipmentYear;
        let shipmentHalf;
        if (dto.expectedShipmentDate) {
            const d = new Date(dto.expectedShipmentDate);
            shipmentMonth = this.calc.formatShipmentMonth(d);
            shipmentYear = d.getFullYear();
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
        const officeId = dto.officeId;
        if (user.role !== enums_1.UserRole.SUPER_ADMIN && user.officeId !== officeId) {
            throw new common_1.ForbiddenException('Cannot create contract for another office');
        }
        const contractNumber = dto.contractNumber ?? (await this.generateContractNumber(officeId));
        const enriched = this.enrichCommercialFields(dto);
        const status = dto.status ?? enums_1.ContractStatus.DRAFT;
        const contractId = await this.prisma.$transaction(async (tx) => {
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
                    productId: dto.productId,
                    productVariantId: dto.productVariantId,
                    processingType: dto.processingType,
                    buyerLotNo: dto.buyerLotNo,
                    buyerRemarks: dto.buyerRemarks,
                    invoiceNumber: dto.invoiceNumber,
                    specification: dto.specification,
                    qualityRequirement: dto.qualityRequirement,
                    productRemarks: dto.productRemarks,
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
        }, this.txOptions);
        return this.findOne(contractId, user);
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
                ? {
                    OR: [
                        { contractNumber: { contains: query.search, mode: 'insensitive' } },
                        { buyer: { name: { contains: query.search, mode: 'insensitive' } } },
                        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
                    ],
                }
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
        if (user.role !== enums_1.UserRole.SUPER_ADMIN && user.officeId !== contract.officeId) {
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