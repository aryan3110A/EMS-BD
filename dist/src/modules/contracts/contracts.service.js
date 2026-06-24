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
const exchange_rate_service_1 = require("../../common/services/exchange-rate.service");
const contract_audit_service_1 = require("../../common/services/contract-audit.service");
const notification_service_1 = require("../../common/services/notification.service");
const container_mapper_1 = require("../../common/services/container-mapper");
const enums_2 = require("../../common/constants/enums");
const commercial_constants_1 = require("../../common/constants/commercial.constants");
const pending_masters_resolver_1 = require("./pending-masters.resolver");
let ContractsService = class ContractsService {
    prisma;
    calc;
    exchangeRate;
    audit;
    notifications;
    txOptions = { maxWait: 15000, timeout: 30000 };
    constructor(prisma, calc, exchangeRate, audit, notifications) {
        this.prisma = prisma;
        this.calc = calc;
        this.exchangeRate = exchangeRate;
        this.audit = audit;
        this.notifications = notifications;
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
            include: {
                product: true,
                productVariant: true,
                destinationPort: { include: { country: true } },
                packagingType: true,
                packagingSize: true,
                amendments: { orderBy: { amendmentDate: 'desc' } },
            },
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
                packagingType: { select: { id: true, code: true, name: true } },
                packagingSize: { select: { id: true, label: true } },
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
    async getFobDeduction() {
        const setting = await this.prisma.appSetting.findUnique({
            where: { key: commercial_constants_1.FOB_DEDUCTION_SETTING_KEY },
        });
        const parsed = setting ? parseFloat(setting.value) : NaN;
        return Number.isFinite(parsed) ? parsed : commercial_constants_1.DEFAULT_FOB_DEDUCTION;
    }
    enrichCommercialFields(dto) {
        const capacity = dto.standardContainerMt ?? 28;
        const containers = dto.numberOfContainers ?? this.calc.calculateContainers(dto.totalMt, capacity);
        const incoterm = (dto.incoterm ?? enums_2.Incoterm.FOB).toUpperCase();
        let fobInrPerKg;
        if (dto.fobPrice && dto.exchangeRate) {
            fobInrPerKg = this.calc.calculateFobInrPerKg(dto.fobPrice, dto.exchangeRate);
        }
        let cifPrice = dto.cifPrice;
        if (incoterm === enums_2.Incoterm.FOB) {
            cifPrice = undefined;
        }
        else if (!dto.cifManualOverride && incoterm === enums_2.Incoterm.CIF && dto.fobPrice != null) {
            const freightPerMt = dto.freight && dto.totalMt ? dto.freight / dto.totalMt : 0;
            cifPrice = this.calc.calculateCif(dto.fobPrice, freightPerMt, dto.insurance ?? 0);
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
        this.assertContainerQuantities(dto);
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
        const normalizedRows = await this.normalizeContainerRows(tx, containerRows, status);
        const primary = normalizedRows[0];
        const fobDeduction = await this.getFobDeduction();
        const contractFallback = {
            incoterm: dto.incoterm,
            fobPrice: dto.fobPrice,
            fobCurrency: dto.fobCurrency,
            exchangeRate: dto.exchangeRate,
            totalFreight: dto.freight,
            insurance: dto.insurance,
            packagingTypeId: dto.packagingTypeId,
            packagingSizeId: dto.packagingSizeId,
            packingDescription: dto.packingDescription,
            packingSizeValue: dto.packingSizeValue,
            packingSizeUnit: dto.packingSizeUnit,
            destinationPortId: dto.destinationPortId,
        };
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
                    create: normalizedRows.map((c) => (0, container_mapper_1.mapContainerDtoToCreateData)(c, this.calc, fobDeduction, contractFallback)),
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
    assertContainerQuantities(dto) {
        if (!dto.containerProducts?.length || dto.totalMt == null)
            return;
        const mts = dto.containerProducts.map((c) => c.quantityMt ?? dto.totalMt / dto.containerProducts.length);
        if (mts.some((m) => m <= 0)) {
            throw new common_1.BadRequestException('Each container must have allocated MT greater than zero');
        }
        if (!this.calc.validateContainerQuantities(dto.totalMt, mts)) {
            const sum = mts.reduce((a, b) => a + b, 0);
            throw new common_1.BadRequestException(`Total allocated MT (${sum.toFixed(3)}) must equal contract quantity (${dto.totalMt} MT)`);
        }
    }
    isUnresolvedPendingId(id) {
        return !!id && id.startsWith('pending:');
    }
    async normalizeContainerRows(tx, containerRows, status) {
        const primary = containerRows[0];
        const primaryProductId = primary?.productId?.trim();
        if (!primaryProductId) {
            throw new common_1.BadRequestException('Product is required before saving the contract.');
        }
        if (this.isUnresolvedPendingId(primaryProductId)) {
            throw new common_1.BadRequestException('Product is still pending. Please save the product master first.');
        }
        const primaryProduct = await tx.product.findUnique({ where: { id: primaryProductId } });
        if (!primaryProduct) {
            throw new common_1.BadRequestException('Selected product was not found. Please choose a valid product.');
        }
        const isDraft = status === enums_1.ContractStatus.DRAFT;
        const normalized = containerRows.map((row, index) => {
            const productId = row.productId?.trim();
            if (productId) {
                if (this.isUnresolvedPendingId(productId)) {
                    throw new common_1.BadRequestException(`Container ${index + 1}: product is still pending. Please save the product master first.`);
                }
                return row;
            }
            if (!isDraft) {
                throw new common_1.BadRequestException(`Container ${index + 1}: product is required.`);
            }
            return {
                ...row,
                productId: primaryProductId,
                productVariantId: row.productVariantId || primary.productVariantId,
                processingType: row.processingType || primary.processingType,
                specification: row.specification || primary.specification,
                productRemarks: row.productRemarks || primary.productRemarks,
            };
        });
        for (let i = 0; i < normalized.length; i++) {
            const pid = normalized[i].productId?.trim();
            if (!pid) {
                throw new common_1.BadRequestException(`Container ${i + 1}: product is required.`);
            }
            const product = await tx.product.findUnique({ where: { id: pid } });
            if (!product) {
                throw new common_1.BadRequestException(`Container ${i + 1}: selected product was not found. Please choose a valid product.`);
            }
        }
        return normalized;
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
        const existing = await this.findOne(id, user);
        this.assertContainerQuantities(dto);
        const enriched = this.enrichCommercialFields(dto);
        const fobDeduction = await this.getFobDeduction();
        const auditChanges = [];
        const track = (fieldName, prev, next) => {
            const p = prev == null ? null : String(prev);
            const n = next == null ? null : String(next);
            if (p !== n && next !== undefined) {
                auditChanges.push({
                    contractId: id,
                    contractNumber: existing.contractNumber,
                    fieldName,
                    previousValue: p,
                    newValue: n,
                    changedById: user.sub,
                });
            }
        };
        if (dto.receivedDate !== undefined)
            track('receivedDate', existing.receivedDate, dto.receivedDate);
        if (dto.contractDate !== undefined)
            track('contractDate', existing.contractDate, dto.contractDate);
        if (dto.contractSentDate !== undefined)
            track('contractSentDate', existing.contractSentDate, dto.contractSentDate);
        if (dto.signedContractReceivedDate !== undefined) {
            track('signedContractReceivedDate', existing.signedContractReceivedDate, dto.signedContractReceivedDate);
        }
        if (dto.totalMt !== undefined)
            track('totalMt', existing.totalMt, dto.totalMt);
        if (dto.fobPrice !== undefined)
            track('fobPrice', existing.fobPrice, dto.fobPrice);
        if (dto.exchangeRate !== undefined)
            track('exchangeRate', existing.exchangeRate, dto.exchangeRate);
        if (dto.buyerId !== undefined)
            track('buyerId', existing.buyerId, dto.buyerId);
        if (dto.incoterm !== undefined)
            track('incoterm', existing.incoterm, dto.incoterm);
        if (dto.insurance !== undefined)
            track('insurance', existing.insurance, dto.insurance);
        if (dto.freight !== undefined)
            track('freight', existing.freight, dto.freight);
        const containerRows = dto.containerProducts?.length ? dto.containerProducts : undefined;
        const status = dto.status ?? existing.status;
        const normalizedRows = containerRows?.length
            ? await this.prisma.$transaction((tx) => this.normalizeContainerRows(tx, containerRows, status))
            : undefined;
        const primary = normalizedRows?.[0];
        const contractFallback = {
            incoterm: dto.incoterm,
            fobPrice: dto.fobPrice,
            fobCurrency: dto.fobCurrency,
            exchangeRate: dto.exchangeRate,
            totalFreight: dto.freight,
            insurance: dto.insurance,
            packagingTypeId: dto.packagingTypeId,
            packagingSizeId: dto.packagingSizeId,
            packingDescription: dto.packingDescription,
            packingSizeValue: dto.packingSizeValue,
            packingSizeUnit: dto.packingSizeUnit,
            destinationPortId: dto.destinationPortId,
        };
        await this.prisma.$transaction(async (tx) => {
            if (containerRows?.length) {
                await tx.contractContainer.deleteMany({ where: { contractId: id } });
                for (const c of containerRows) {
                    const data = (0, container_mapper_1.mapContainerDtoToCreateData)(c, this.calc, fobDeduction, contractFallback);
                    await tx.contractContainer.create({
                        data: { contractId: id, ...data },
                    });
                }
            }
            await tx.contract.update({
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
                    productId: primary?.productId ?? dto.productId,
                    productVariantId: primary?.productVariantId ?? dto.productVariantId,
                    processingType: primary?.processingType ?? dto.processingType,
                    buyerLotNo: dto.buyerLotNo,
                    invoiceNumber: dto.invoiceNumber,
                    specification: primary?.specification ?? dto.specification,
                    qualityRequirement: dto.qualityRequirement,
                    productRemarks: primary?.productRemarks ?? dto.productRemarks,
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
                    destinationPortId: primary?.destinationPortId ?? dto.destinationPortId,
                    expectedShipmentDate: dto.expectedShipmentDate ? new Date(dto.expectedShipmentDate) : undefined,
                    shipmentMonth: enriched.shipmentMonth,
                    shipmentYear: enriched.shipmentYear,
                    shipmentHalf: enriched.shipmentHalf,
                    containerNo: dto.containerNo,
                    remarks: dto.remarks,
                    internalRemarks: dto.internalRemarks,
                    status: dto.status,
                },
            });
            if (auditChanges.length) {
                await this.audit.logChanges(auditChanges);
            }
        }, this.txOptions);
        return this.findOne(id, user);
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
        const contractWhere = officeId ? { officeId } : {};
        const now = new Date();
        const in30 = new Date(now);
        in30.setDate(in30.getDate() + 30);
        const [grouped, recent, upcomingContainers, allContainers] = await Promise.all([
            this.prisma.contract.groupBy({
                by: ['status'],
                where: contractWhere,
                _count: { _all: true },
            }),
            this.prisma.contract.findMany({
                where: contractWhere,
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
            this.prisma.contractContainer.findMany({
                where: {
                    expectedShipmentDate: { gte: now, lte: in30 },
                    contract: contractWhere,
                },
                include: {
                    contract: {
                        select: {
                            id: true,
                            contractNumber: true,
                            status: true,
                            buyer: { select: { name: true } },
                        },
                    },
                    product: { select: { code: true, name: true } },
                    destinationPort: { select: { name: true } },
                },
                orderBy: { expectedShipmentDate: 'asc' },
            }),
            this.prisma.contractContainer.findMany({
                where: { contract: contractWhere },
                select: {
                    id: true,
                    quantityMt: true,
                    containerStatus: true,
                    dispatchStatus: true,
                    expectedShipmentDate: true,
                    productId: true,
                    product: { select: { code: true, name: true } },
                    contractId: true,
                    contract: { select: { contractNumber: true, status: true } },
                },
            }),
        ]);
        const countFor = (status) => grouped.find((g) => g.status === status)?._count._all ?? 0;
        const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
        const upcomingMt = upcomingContainers.reduce((s, c) => s + (c.quantityMt ?? 0), 0);
        const contractIds = new Set(upcomingContainers.map((c) => c.contractId));
        const productIds = new Set(upcomingContainers.map((c) => c.productId));
        const byProduct = new Map();
        for (const c of upcomingContainers) {
            const key = c.productId;
            const entry = byProduct.get(key) ?? {
                code: c.product.code,
                name: c.product.name,
                containers: 0,
                mt: 0,
                contracts: new Set(),
            };
            entry.containers += 1;
            entry.mt += c.quantityMt ?? 0;
            entry.contracts.add(c.contract.contractNumber);
            byProduct.set(key, entry);
        }
        const byPeriod = { FIRST_HALF: 0, SECOND_HALF: 0 };
        for (const c of upcomingContainers) {
            if (c.shipmentHalf === 'FIRST_HALF')
                byPeriod.FIRST_HALF += 1;
            else if (c.shipmentHalf === 'SECOND_HALF')
                byPeriod.SECOND_HALF += 1;
        }
        return {
            total,
            draft: countFor(enums_1.ContractStatus.DRAFT),
            awaitingSigned: countFor(enums_1.ContractStatus.AWAITING_SIGNED),
            confirmed: countFor(enums_1.ContractStatus.CONFIRMED_FOR_PRODUCTION),
            inProduction: countFor(enums_1.ContractStatus.IN_PRODUCTION),
            ready: countFor(enums_1.ContractStatus.READY_FOR_DISPATCH),
            underPreparation: countFor(enums_1.ContractStatus.UNDER_PREPARATION),
            recent,
            upcoming: {
                from: now.toISOString(),
                to: in30.toISOString(),
                totalContainers: upcomingContainers.length,
                totalMt: upcomingMt,
                contractCount: contractIds.size,
                productCount: productIds.size,
                byProduct: [...byProduct.values()].map((p) => ({
                    code: p.code,
                    name: p.name,
                    containers: p.containers,
                    mt: p.mt,
                    contracts: [...p.contracts],
                })),
                byPeriod,
                shipments: upcomingContainers.map((c) => ({
                    id: c.id,
                    contractId: c.contract.id,
                    contractNumber: c.contract.contractNumber,
                    containerIndex: c.containerIndex,
                    buyer: c.contract.buyer?.name,
                    product: c.product.code,
                    quantityMt: c.quantityMt,
                    expectedShipmentDate: c.expectedShipmentDate,
                    destinationPort: c.destinationPort?.name,
                    shipmentHalf: c.shipmentHalf,
                    status: c.contract.status,
                })),
            },
            containersShipped: allContainers.filter((c) => c.dispatchStatus === 'DISPATCHED' || c.dispatchStatus === 'SHIPPED').length,
            containersReachedPort: allContainers.filter((c) => c.containerStatus === 'REACHED_PORT').length,
        };
    }
    async fetchExchangeRate(currency) {
        return this.exchangeRate.fetchRate(currency, 'INR');
    }
    async amendContainerCommercial(contractId, containerId, dto, user) {
        const contract = await this.findOne(contractId, user);
        const container = contract.containers?.find((c) => c.id === containerId);
        if (!container)
            throw new common_1.NotFoundException('Container not found');
        const incoterm = (container.incoterm ?? enums_2.Incoterm.CIF).toUpperCase();
        if (incoterm === enums_2.Incoterm.FOB) {
            throw new common_1.ForbiddenException('Amendment not allowed for FOB containers');
        }
        if (container.containerStatus !== 'REACHED_PORT') {
            throw new common_1.ForbiddenException('Amendment is only allowed when container has reached port');
        }
        const previousValue = container.currentCifCnfPrice ?? container.cifPrice ?? container.cnfPrice ?? 0;
        await this.prisma.$transaction(async (tx) => {
            await tx.containerCommercialAmendment.create({
                data: {
                    contractId,
                    containerId,
                    incoterm,
                    previousValue,
                    amendedValue: dto.newPrice,
                    currency: dto.currency,
                    reason: dto.reason,
                    amendedById: user.sub,
                },
            });
            const updateData = incoterm === enums_2.Incoterm.CNF
                ? { cnfPrice: dto.newPrice, currentCifCnfPrice: dto.newPrice }
                : { cifPrice: dto.newPrice, currentCifCnfPrice: dto.newPrice };
            await tx.contractContainer.update({
                where: { id: containerId },
                data: updateData,
            });
            await tx.contractAuditLog.create({
                data: {
                    contractId,
                    contractNumber: contract.contractNumber,
                    containerId,
                    containerIndex: container.containerIndex,
                    fieldName: incoterm === enums_2.Incoterm.CNF ? 'cnfPrice' : 'cifPrice',
                    previousValue: String(previousValue),
                    newValue: String(dto.newPrice),
                    changedById: user.sub,
                },
            });
        });
        await this.notifications.notifyCommercialAmendment({
            contractId,
            containerId,
            contractNumber: contract.contractNumber,
            containerIndex: container.containerIndex,
            incoterm,
            previousValue,
            amendedValue: dto.newPrice,
            currency: dto.currency,
            reason: dto.reason,
            amendedByName: user.name ?? user.email,
        });
        return this.findOne(contractId, user);
    }
    getContractAudit(contractId, user) {
        return this.findOne(contractId, user).then(() => this.audit.findByContract(contractId));
    }
};
exports.ContractsService = ContractsService;
exports.ContractsService = ContractsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        calculation_service_1.CalculationService,
        exchange_rate_service_1.ExchangeRateService,
        contract_audit_service_1.ContractAuditService,
        notification_service_1.NotificationService])
], ContractsService);
//# sourceMappingURL=contracts.service.js.map