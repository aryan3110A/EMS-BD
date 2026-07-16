import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ContractStatus, UserRole } from '../../common/constants/enums';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationService } from '../../common/services/calculation.service';
import { ExchangeRateService } from '../../common/services/exchange-rate.service';
import { ContractAuditService, type AuditFieldChange } from '../../common/services/contract-audit.service';
import { NotificationService } from '../../common/services/notification.service';
import { mapContainerDtoToCreateData, resolveContainerProductLines } from '../../common/services/container-mapper';
import { Incoterm } from '../../common/constants/enums';
import { DEFAULT_FOB_DEDUCTION, FOB_DEDUCTION_SETTING_KEY } from '../../common/constants/commercial.constants';
import { AmendContainerCommercialDto } from './container-commercial.dto';
import { CreateContractDto, UpdateContractDto, ContractQueryDto, CreateContainerProductDto, DashboardQueryDto } from './contracts.dto';
import { SubmitContractDto } from './submit-contract.dto';
import {
  applyPendingIdsToContractDto,
  resolvePendingMastersInTx,
  updateBuyerInTx,
} from './pending-masters.resolver';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

function cleanRelationId(val: string | undefined | null): string | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val.trim() === '') return null;
  return val.trim();
}

@Injectable()
export class ContractsService {
  private readonly txOptions = { maxWait: 15000, timeout: 30000 };

  constructor(
    private prisma: PrismaService,
    private calc: CalculationService,
    private exchangeRate: ExchangeRateService,
    private audit: ContractAuditService,
    private notifications: NotificationService,
  ) {}

  private detailInclude = {
    office: true,
    salesperson: true,
    salesAttributions: {
      include: { salesperson: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'asc' as const },
    },
    buyer: { include: { country: true } },
    product: true,
    productVariant: true,
    packagingType: true,
    packagingSize: true,
    portOfLoading: true,
    destinationPort: { include: { country: true } },
    createdBy: { select: { id: true, name: true, email: true, role: true } },
    lots: { include: { destinationPort: true }, orderBy: { lotNumber: 'asc' as const } },
    containers: {
      include: {
        product: true,
        productVariant: true,
        destinationPort: { include: { country: true } },
        packagingType: true,
        packagingSize: true,
        products: {
          include: {
            product: true,
            productVariant: true,
            packagingType: true,
            packagingSize: true,
          },
          orderBy: { productIndex: 'asc' as const },
        },
        amendments: {
          orderBy: { amendmentDate: 'desc' as const },
          include: { amendedBy: { select: { id: true, name: true } } },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' as const },
          take: 20,
          include: { updatedBy: { select: { id: true, name: true } } },
        },
      },
      orderBy: { containerIndex: 'asc' as const },
    },
    amendments: { orderBy: { createdAt: 'desc' as const } },
    statusHistory: { orderBy: { createdAt: 'desc' as const }, take: 20 },
  };

  /** Lightweight relations for contract register / list views */
  private listInclude = {
    salesperson: { select: { id: true, name: true, code: true } },
    salesAttributions: {
      include: { salesperson: { select: { id: true, name: true, code: true } } },
    },
    createdBy: { select: { id: true, name: true, role: true } },
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
        products: {
          include: {
            product: { select: { id: true, code: true, name: true } },
          },
          orderBy: { productIndex: 'asc' as const },
        },
      },
      orderBy: { containerIndex: 'asc' as const },
    },
  };

  private canAccessAnyOffice(user: JwtPayload) {
    return (
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.CONTRACT_TEAM ||
      user.role === UserRole.SUPER_SALES
    );
  }

  private scopeOffice(user: JwtPayload, officeId?: string): string | undefined {
    if (this.canAccessAnyOffice(user)) return officeId;
    return user.officeId;
  }

  async generateContractNumber(officeId: string): Promise<string> {
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
      if (!isNaN(num)) next = num + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private async getFobDeduction(): Promise<number> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key: FOB_DEDUCTION_SETTING_KEY },
    });
    const parsed = setting ? parseFloat(setting.value) : NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_FOB_DEDUCTION;
  }

  private enrichCommercialFields(dto: CreateContractDto | UpdateContractDto) {
    const capacity = dto.standardContainerMt ?? 28;
    const containers = dto.numberOfContainers ?? this.calc.calculateContainers(dto.totalMt, capacity);
    const incoterm = (dto.incoterm ?? Incoterm.FOB).toUpperCase();

    let fobInrPerKg: number | undefined;
    if (dto.fobPrice && dto.exchangeRate) {
      fobInrPerKg = this.calc.calculateFobInrPerKg(dto.fobPrice, dto.exchangeRate);
    }

    // PDF §11.3: FOB mode must NOT calculate CIF
    let cifPrice = dto.cifPrice;
    if (incoterm === Incoterm.FOB) {
      cifPrice = undefined;
    } else if (!dto.cifManualOverride && incoterm === Incoterm.CIF && dto.fobPrice != null) {
      const freightPerMt = dto.freight && dto.totalMt ? dto.freight / dto.totalMt : 0;
      cifPrice = this.calc.calculateCif(dto.fobPrice, freightPerMt, dto.insurance ?? 0);
    }
    let shipmentMonth: string | undefined = dto.shipmentMonth;
    let shipmentYear: number | undefined = dto.shipmentYear;
    let shipmentHalf: string | undefined = dto.shipmentHalf;
    if (dto.expectedShipmentDate) {
      const d = new Date(dto.expectedShipmentDate);
      if (!shipmentMonth) shipmentMonth = this.calc.formatShipmentMonth(d);
      if (!shipmentYear) shipmentYear = d.getFullYear();
      if (!shipmentHalf) shipmentHalf = this.calc.getShipmentHalf(d);
    }
    let advanceAmount: number | undefined;
    let balancePercentage: number | undefined;
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

  async create(dto: CreateContractDto, user: JwtPayload) {
    const contractId = await this.prisma.$transaction(
      (tx) => this.createContractInTx(tx, dto, user),
      this.txOptions,
    );
    return this.findOne(contractId, user);
  }

  async submit(dto: SubmitContractDto, user: JwtPayload) {
    const contractId = await this.prisma.$transaction(async (tx) => {
      const idMap = await resolvePendingMastersInTx(
        tx,
        dto.pendingMasters,
        dto.contract.officeId,
        dto.contract.buyerId,
        dto.buyerUpdate,
      );
      const resolvedContract = applyPendingIdsToContractDto(dto.contract, idMap);

      if (dto.buyerUpdate && resolvedContract.buyerId) {
        await updateBuyerInTx(tx, resolvedContract.buyerId, dto.buyerUpdate, idMap);
      }

      return this.createContractInTx(tx, resolvedContract, user);
    }, this.txOptions);

    return this.findOne(contractId, user);
  }

  private async createContractInTx(
    tx: Prisma.TransactionClient,
    dto: CreateContractDto,
    user: JwtPayload,
  ): Promise<string> {
    const canSelectAnyOffice = this.canAccessAnyOffice(user);

    const officeId = canSelectAnyOffice ? dto.officeId : user.officeId;

    if (!officeId) {
      throw new ForbiddenException(
        canSelectAnyOffice ? 'Office is required' : 'Your account is not assigned to an office',
      );
    }

    if (!canSelectAnyOffice && user.officeId !== officeId) {
      throw new ForbiddenException('Cannot create contract for another office');
    }

    const office = await tx.office.findFirst({
      where: { id: officeId, isActive: true },
    });
    if (!office) {
      throw new NotFoundException('Office not found');
    }

    const contractNumber = dto.contractNumber ?? (await this.generateContractNumber(officeId));
    this.assertContainerQuantities(dto);
    const enriched = this.enrichCommercialFields(dto);
    const status = dto.status ?? ContractStatus.DRAFT;

    const containerRows =
      dto.containerProducts?.length
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

    const contractFallback: Partial<CreateContainerProductDto> = {
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
          salespersonId: cleanRelationId(dto.salespersonId) ?? cleanRelationId(this.attributionIds(dto)[0]),
          buyerId: dto.buyerId,
          productId: primary.productId!,
          productVariantId: cleanRelationId(primary.productVariantId),
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
          packagingTypeId: cleanRelationId(dto.packagingTypeId),
          packagingSizeId: cleanRelationId(dto.packagingSizeId),
          packingDescription: dto.packingDescription,
          packingSizeValue: dto.packingSizeValue,
          packingSizeUnit: dto.packingSizeUnit,
          paymentType: dto.paymentType,
          advancePercentage: dto.advancePercentage,
          advanceAmount: enriched.advanceAmount,
          balancePercentage: enriched.balancePercentage,
          balancePaymentMode: dto.balancePaymentMode,
          balancePaymentStage: dto.balancePaymentStage,
          otherPaymentMethod: dto.otherPaymentMethod,
          paymentDescription: dto.paymentDescription,
          portOfLoadingId: cleanRelationId(dto.portOfLoadingId),
          destinationPortId: cleanRelationId(dto.destinationPortId),
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
                    destinationPortId: cleanRelationId(lot.destinationPortId ?? dto.destinationPortId),
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
                    destinationPortId: cleanRelationId(dto.destinationPortId),
                  },
                ],
              },
        },
      select: { id: true },
    });

    for (const row of normalizedRows) {
      const mapped = mapContainerDtoToCreateData(row, this.calc, fobDeduction, contractFallback);
      const { productLines, ...containerData } = mapped;
      const container = await tx.contractContainer.create({
        data: { contractId: created.id, ...containerData },
        select: { id: true },
      });
      if (productLines?.length) {
        await tx.contractContainerProduct.createMany({
          data: productLines.map((p, i) => ({
            contractId: created.id,
            containerId: container.id,
            productIndex: p.productIndex ?? i + 1,
            productId: p.productId,
            productVariantId: cleanRelationId(p.productVariantId) || null,
            processingType: p.processingType || null,
            specification: p.specification || null,
            quantityMt: p.quantityMt,
            packagingTypeId: cleanRelationId(p.packagingTypeId) || null,
            packagingSizeId: cleanRelationId(p.packagingSizeId) || null,
            packingDescription: p.packingDescription || null,
            packingSizeValue: p.packingSizeValue ?? null,
            packingSizeUnit: p.packingSizeUnit || null,
            productRemarks: p.productRemarks || null,
          })),
        });
      }
      await tx.containerStatusHistory.create({
        data: {
          containerId: container.id,
          contractId: created.id,
          fromStatus: null,
          toStatus: containerData.containerStatus || 'DRAFT',
          updatedById: user.sub,
          remarks: 'Container created',
        },
      });
    }

    const attributionIds = this.attributionIds(dto);
    if (attributionIds.length) {
      await tx.contractSalesAttribution.createMany({
        data: attributionIds.map((salespersonId) => ({
          contractId: created.id,
          salespersonId,
          addedById: user.sub,
        })),
        skipDuplicates: true,
      });
      if (!dto.salespersonId) {
        await tx.contract.update({
          where: { id: created.id },
          data: { salespersonId: attributionIds[0] },
        });
      }
    }

    await tx.contractStatusHistory.create({
      data: {
        contractId: created.id,
        toStatus: status,
        changedBy: user.name,
        remarks: 'Contract created',
      },
    });

    await this.notifications.notifyChange({
      type: 'CONTRACT_CREATED',
      contractId: created.id,
      message: `New contract ${contractNumber} created by ${user.name}.`,
      changedById: user.sub,
      targetRoles: [UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.ACCOUNTS_TEAM, UserRole.SUPER_SALES],
    });

    return created.id;
  }

  async findAll(query: ContractQueryDto, user: JwtPayload) {
    const officeId = this.scopeOffice(user, query.officeId);
    const where: Prisma.ContractWhereInput = {
      ...(officeId ? { officeId } : {}),
      ...(query.status ? { status: query.status as ContractStatus } : {}),
      ...(query.salespersonId ? { salespersonId: query.salespersonId } : {}),
      ...(query.buyerId ? { buyerId: query.buyerId } : {}),
      ...(query.shipmentMonth ? { shipmentMonth: query.shipmentMonth } : {}),
      ...(query.search
        ? { buyer: { name: { contains: query.search, mode: 'insensitive' as const } } }
        : {}),
    };

    return this.prisma.contract.findMany({
      where,
      include: this.listInclude,
      orderBy: [{ contractDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private assertContainerQuantities(dto: CreateContractDto) {
    if (!dto.containerProducts?.length || dto.totalMt == null) return;
    const mts = dto.containerProducts.map((c) => c.quantityMt ?? dto.totalMt! / dto.containerProducts!.length);
    if (mts.some((m) => m <= 0)) {
      throw new BadRequestException('Each container must have allocated MT greater than zero');
    }
    if (!this.calc.validateContainerQuantities(dto.totalMt, mts)) {
      const sum = mts.reduce((a, b) => a + b, 0);
      throw new BadRequestException(
        `Total allocated MT (${sum.toFixed(3)}) must equal contract quantity (${dto.totalMt} MT)`,
      );
    }
  }

  private isUnresolvedPendingId(id?: string | null): boolean {
    return !!id && id.startsWith('pending:');
  }

  private async normalizeContainerRows(
    tx: Prisma.TransactionClient,
    containerRows: CreateContainerProductDto[],
    status: ContractStatus,
  ): Promise<CreateContainerProductDto[]> {
    const isDraft = status === ContractStatus.DRAFT;

    const normalized = containerRows.map((row, index) => {
      const lines = resolveContainerProductLines(row);
      if (lines.length === 0) {
        if (!isDraft) {
          throw new BadRequestException(`Container ${index + 1}: at least one product is required.`);
        }
        return row;
      }

      for (const line of lines) {
        if (this.isUnresolvedPendingId(line.productId)) {
          throw new BadRequestException(
            `Container ${index + 1}: product is still pending. Please save the product master first.`,
          );
        }
      }

      const productSum = lines.reduce((s, p) => s + (p.quantityMt ?? 0), 0);
      const containerMt = row.quantityMt ?? productSum;
      if (!isDraft && containerMt > 0 && Math.abs(productSum - containerMt) > 0.001) {
        throw new BadRequestException(
          `Container ${index + 1}: total product quantity (${productSum.toFixed(3)} MT) must match the container quantity (${containerMt} MT).`,
        );
      }

      const primary = lines[0];
      return {
        ...row,
        products: lines,
        productId: primary.productId,
        productVariantId: primary.productVariantId,
        processingType: primary.processingType,
        specification: primary.specification,
        productRemarks: primary.productRemarks,
        packagingTypeId: primary.packagingTypeId ?? row.packagingTypeId,
        packagingSizeId: primary.packagingSizeId ?? row.packagingSizeId,
        packingDescription: primary.packingDescription ?? row.packingDescription,
        quantityMt: containerMt,
      };
    });

    // Draft: fill missing products from first container that has products
    const seed = normalized.find((r) => resolveContainerProductLines(r).length > 0);
    const seedLines = seed ? resolveContainerProductLines(seed) : [];
    const withFallback = normalized.map((row, index) => {
      const lines = resolveContainerProductLines(row);
      if (lines.length > 0) return row;
      if (!isDraft || !seedLines.length) {
        throw new BadRequestException(`Container ${index + 1}: product is required.`);
      }
      return {
        ...row,
        products: seedLines.map((l, i) => ({ ...l, productIndex: i + 1 })),
        productId: seedLines[0].productId,
        productVariantId: seedLines[0].productVariantId,
        quantityMt: row.quantityMt ?? seedLines.reduce((s, p) => s + p.quantityMt, 0),
      };
    });

    const allProductIds = [
      ...new Set(
        withFallback
          .flatMap((r) => resolveContainerProductLines(r).map((p) => p.productId?.trim()))
          .filter((id): id is string => !!id),
      ),
    ];
    if (!allProductIds.length) {
      throw new BadRequestException('Product is required before saving the contract.');
    }
    const foundProducts = await tx.product.findMany({
      where: { id: { in: allProductIds } },
      select: { id: true },
    });
    const foundProductIds = new Set(foundProducts.map((p) => p.id));
    for (const id of allProductIds) {
      if (!foundProductIds.has(id)) {
        throw new BadRequestException(`Selected product was not found (${id}). Please choose a valid product.`);
      }
    }

    return withFallback;
  }

  private attributionIds(dto: CreateContractDto | UpdateContractDto): string[] {
    const ids = [
      ...(dto.salespersonIds ?? []),
      ...(dto.salespersonId ? [dto.salespersonId] : []),
    ]
      .map((id) => id?.trim())
      .filter((id): id is string => !!id && !id.startsWith('pending:'));
    return [...new Set(ids)];
  }

  async findOne(id: string, user: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!this.canAccessAnyOffice(user) && user.officeId !== contract.officeId) {
      throw new ForbiddenException('Access denied');
    }
    return contract;
  }

  async update(id: string, dto: UpdateContractDto, user: JwtPayload) {
    // Lightweight fetch for access check + audit diffing (avoids full detailInclude)
    const existing = await this.prisma.contract.findUnique({
      where: { id },
      select: {
        id: true, officeId: true, contractNumber: true, status: true,
        receivedDate: true, contractDate: true, contractSentDate: true,
        signedContractReceivedDate: true, totalMt: true, fobPrice: true,
        exchangeRate: true, buyerId: true, incoterm: true, insurance: true,
        freight: true,
      },
    });
    if (!existing) throw new NotFoundException('Contract not found');
    if (!this.canAccessAnyOffice(user) && user.officeId !== existing.officeId) {
      throw new ForbiddenException('Access denied');
    }
    this.assertContainerQuantities(dto);
    const enriched = this.enrichCommercialFields(dto);
    const fobDeduction = await this.getFobDeduction();

    const auditChanges: AuditFieldChange[] = [];
    const track = (fieldName: string, prev: unknown, next: unknown) => {
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

    if (dto.receivedDate !== undefined) track('receivedDate', existing.receivedDate, dto.receivedDate);
    if (dto.contractDate !== undefined) track('contractDate', existing.contractDate, dto.contractDate);
    if (dto.contractSentDate !== undefined) track('contractSentDate', existing.contractSentDate, dto.contractSentDate);
    if (dto.signedContractReceivedDate !== undefined) {
      track('signedContractReceivedDate', existing.signedContractReceivedDate, dto.signedContractReceivedDate);
    }
    if (dto.totalMt !== undefined) track('totalMt', existing.totalMt, dto.totalMt);
    if (dto.fobPrice !== undefined) track('fobPrice', existing.fobPrice, dto.fobPrice);
    if (dto.exchangeRate !== undefined) track('exchangeRate', existing.exchangeRate, dto.exchangeRate);
    if (dto.buyerId !== undefined) track('buyerId', existing.buyerId, dto.buyerId);
    if (dto.incoterm !== undefined) track('incoterm', existing.incoterm, dto.incoterm);
    if (dto.insurance !== undefined) track('insurance', existing.insurance, dto.insurance);
    if (dto.freight !== undefined) track('freight', existing.freight, dto.freight);

    const containerRows = dto.containerProducts?.length ? dto.containerProducts : undefined;
    const status = (dto.status as ContractStatus) ?? (existing.status as ContractStatus);
    const normalizedRows = containerRows?.length
      ? await this.prisma.$transaction((tx) => this.normalizeContainerRows(tx, containerRows, status))
      : undefined;
    const primary = normalizedRows?.[0];

    const contractFallback: Partial<CreateContainerProductDto> = {
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
        const existingContainers = await tx.contractContainer.findMany({
          where: { contractId: id },
          orderBy: { containerIndex: 'asc' },
        });

        // Track container additions, removals and edits
        for (const c of normalizedRows!) {
          const existingC = existingContainers.find((ec) => ec.containerIndex === c.containerIndex);
          if (!existingC) {
            auditChanges.push({
              contractId: id,
              contractNumber: existing.contractNumber,
              containerIndex: c.containerIndex,
              fieldName: `Container ${c.containerIndex}`,
              newValue: 'Added',
              changedById: user.sub,
            });
          } else {
            if (c.quantityMt !== undefined && c.quantityMt !== existingC.quantityMt) {
              auditChanges.push({
                contractId: id,
                contractNumber: existing.contractNumber,
                containerIndex: c.containerIndex,
                fieldName: 'containerQuantityMt',
                previousValue: existingC.quantityMt ? String(existingC.quantityMt) : null,
                newValue: String(c.quantityMt),
                changedById: user.sub,
              });
            }
            if (c.expectedShipmentDate !== undefined) {
              const prevDateStr = existingC.expectedShipmentDate ? new Date(existingC.expectedShipmentDate).toISOString().split('T')[0] : '';
              const newDateStr = c.expectedShipmentDate ? new Date(c.expectedShipmentDate).toISOString().split('T')[0] : '';
              if (prevDateStr !== newDateStr) {
                auditChanges.push({
                  contractId: id,
                  contractNumber: existing.contractNumber,
                  containerIndex: c.containerIndex,
                  fieldName: 'containerExpectedShipmentDate',
                  previousValue: existingC.expectedShipmentDate ? String(existingC.expectedShipmentDate) : null,
                  newValue: String(c.expectedShipmentDate),
                  changedById: user.sub,
                });
              }
            }
            if (c.exchangeRate !== undefined && c.exchangeRate !== existingC.exchangeRate) {
              auditChanges.push({
                contractId: id,
                contractNumber: existing.contractNumber,
                containerIndex: c.containerIndex,
                fieldName: c.exchangeRateManual ? 'containerExchangeRateOverride' : 'containerExchangeRate',
                previousValue: existingC.exchangeRate ? String(existingC.exchangeRate) : null,
                newValue: String(c.exchangeRate),
                changedById: user.sub,
              });
            }
          }
        }

        for (const ec of existingContainers) {
          const incomingC = containerRows.find((c) => c.containerIndex === ec.containerIndex);
          if (!incomingC) {
            auditChanges.push({
              contractId: id,
              contractNumber: existing.contractNumber,
              containerIndex: ec.containerIndex,
              fieldName: `Container ${ec.containerIndex}`,
              previousValue: 'Exists',
              newValue: 'Removed',
              changedById: user.sub,
            });
          }
        }

        await tx.contractContainerProduct.deleteMany({ where: { contractId: id } });
        await tx.contractContainer.deleteMany({ where: { contractId: id } });
        for (const c of normalizedRows!) {
          const mapped = mapContainerDtoToCreateData(c, this.calc, fobDeduction, contractFallback);
          const { productLines, ...containerData } = mapped;
          const container = await tx.contractContainer.create({
            data: { contractId: id, ...containerData },
            select: { id: true },
          });
          if (productLines?.length) {
            await tx.contractContainerProduct.createMany({
              data: productLines.map((p, i) => ({
                contractId: id,
                containerId: container.id,
                productIndex: p.productIndex ?? i + 1,
                productId: p.productId,
                productVariantId: cleanRelationId(p.productVariantId) || null,
                processingType: p.processingType || null,
                specification: p.specification || null,
                quantityMt: p.quantityMt,
                packagingTypeId: cleanRelationId(p.packagingTypeId) || null,
                packagingSizeId: cleanRelationId(p.packagingSizeId) || null,
                packingDescription: p.packingDescription || null,
                packingSizeValue: p.packingSizeValue ?? null,
                packingSizeUnit: p.packingSizeUnit || null,
                productRemarks: p.productRemarks || null,
              })),
            });
          }
        }
      }

      const attributionIds = this.attributionIds(dto);
      if (attributionIds.length) {
        await tx.contractSalesAttribution.deleteMany({ where: { contractId: id } });
        await tx.contractSalesAttribution.createMany({
          data: attributionIds.map((salespersonId) => ({
            contractId: id,
            salespersonId,
            addedById: user.sub,
          })),
          skipDuplicates: true,
        });
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
          salespersonId: cleanRelationId(dto.salespersonId) ?? (attributionIds[0] || undefined),
          buyerId: dto.buyerId,
          buyerRemarks: dto.buyerRemarks,
          productId: primary?.productId ?? dto.productId,
          productVariantId: cleanRelationId(primary?.productVariantId ?? dto.productVariantId),
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
          packagingTypeId: cleanRelationId(dto.packagingTypeId),
          packagingSizeId: cleanRelationId(dto.packagingSizeId),
          packingDescription: dto.packingDescription,
          packingSizeValue: dto.packingSizeValue,
          packingSizeUnit: dto.packingSizeUnit,
          paymentType: dto.paymentType,
          advancePercentage: dto.advancePercentage,
          advanceAmount: enriched.advanceAmount,
          balancePercentage: enriched.balancePercentage,
          balancePaymentMode: dto.balancePaymentMode,
          balancePaymentStage: dto.balancePaymentStage,
          otherPaymentMethod: dto.otherPaymentMethod,
          paymentDescription: dto.paymentDescription,
          portOfLoadingId: cleanRelationId(dto.portOfLoadingId),
          destinationPortId: cleanRelationId(primary?.destinationPortId ?? dto.destinationPortId),
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
        await tx.contractAuditLog.createMany({
          data: auditChanges.map((c) => ({
            contractId: c.contractId,
            contractNumber: c.contractNumber,
            containerId: c.containerId,
            containerIndex: c.containerIndex,
            fieldName: c.fieldName,
            previousValue: c.previousValue ?? null,
            newValue: c.newValue ?? null,
            changedById: c.changedById,
          })),
        });
      }
    }, this.txOptions);

    return this.findOne(id, user);
  }

  async updateStatus(id: string, status: ContractStatus, user: JwtPayload, remarks?: string) {
    const contract = await this.findOne(id, user);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.contract.update({
        where: { id },
        data: {
          status,
          ...(status === ContractStatus.CONFIRMED_FOR_PRODUCTION
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
      await tx.contractAuditLog.create({
        data: {
          contractId: id,
          contractNumber: contract.contractNumber,
          fieldName: 'status',
          previousValue: contract.status,
          newValue: status,
          changedById: user.sub,
        },
      });
      return u.id;
    }, this.txOptions);
    return this.findOne(updated, user);
  }

  async getDashboardStats(user: JwtPayload, query: DashboardQueryDto = {}) {
    const officeId = this.scopeOffice(user);
    
    const fromDate = query.startDate ? new Date(query.startDate) : new Date();
    const toDate = query.endDate ? new Date(query.endDate) : (() => {
      const d = new Date(fromDate);
      d.setDate(d.getDate() + 30);
      return d;
    })();

    const contractWhere: Prisma.ContractWhereInput = {
      ...(officeId ? { officeId } : {}),
      ...(user.role === UserRole.SUPER_SALES ? { createdById: user.sub } : {}),
      ...(query.superSalesUserId ? { createdById: query.superSalesUserId } : {}),
      ...(query.salespersonId
        ? {
            OR: [
              { salespersonId: query.salespersonId },
              { salesAttributions: { some: { salespersonId: query.salespersonId } } },
            ],
          }
        : {}),
      ...(query.productId
        ? {
            OR: [
              { productId: query.productId },
              { containers: { some: { products: { some: { productId: query.productId } } } } },
            ],
          }
        : {}),
      ...(query.buyerId ? { buyerId: query.buyerId } : {}),
      ...(query.contractStatus ? { status: query.contractStatus as any } : {}),
      ...(query.euClassification ? { euClassification: query.euClassification as any } : {}),
      ...(query.destinationPortId ? { destinationPortId: query.destinationPortId } : {}),
      ...(query.paymentStatus
        ? { containers: { some: { paymentStatus: query.paymentStatus } } }
        : {}),
      ...(query.containerStatus || query.shipmentPeriod || query.startDate || query.endDate
        ? {
            containers: {
              some: {
                ...(query.containerStatus ? { containerStatus: query.containerStatus } : {}),
                ...(query.shipmentPeriod ? { shipmentHalf: query.shipmentPeriod } : {}),
                ...(query.startDate || query.endDate
                  ? {
                      expectedShipmentDate: {
                        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
                        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
    };

    const upcomingWhere: Prisma.ContractContainerWhereInput = {
      expectedShipmentDate: { gte: fromDate, lte: toDate },
      contract: {
        ...(officeId ? { officeId } : {}),
        ...(user.role === UserRole.SUPER_SALES ? { createdById: user.sub } : {}),
        ...(query.superSalesUserId ? { createdById: query.superSalesUserId } : {}),
        ...(query.salespersonId
          ? {
              OR: [
                { salespersonId: query.salespersonId },
                { salesAttributions: { some: { salespersonId: query.salespersonId } } },
              ],
            }
          : {}),
        ...(query.buyerId ? { buyerId: query.buyerId } : {}),
        ...(query.contractStatus ? { status: query.contractStatus as any } : {}),
        ...(query.euClassification ? { euClassification: query.euClassification as any } : {}),
      },
      ...(query.productId
        ? {
            OR: [
              { productId: query.productId },
              { products: { some: { productId: query.productId } } },
            ],
          }
        : {}),
      ...(query.destinationPortId ? { destinationPortId: query.destinationPortId } : {}),
      ...(query.containerStatus ? { containerStatus: query.containerStatus } : {}),
      ...(query.shipmentPeriod ? { shipmentHalf: query.shipmentPeriod } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    };

    const shippedWhere: Prisma.ContractContainerWhereInput = {
      dispatchStatus: { in: ['SHIPPED', 'DISPATCHED'] },
      contract: {
        ...(officeId ? { officeId } : {}),
        ...(user.role === UserRole.SUPER_SALES ? { createdById: user.sub } : {}),
        ...(query.superSalesUserId ? { createdById: query.superSalesUserId } : {}),
        ...(query.salespersonId
          ? {
              OR: [
                { salespersonId: query.salespersonId },
                { salesAttributions: { some: { salespersonId: query.salespersonId } } },
              ],
            }
          : {}),
        ...(query.buyerId ? { buyerId: query.buyerId } : {}),
        ...(query.contractStatus ? { status: query.contractStatus as any } : {}),
        ...(query.euClassification ? { euClassification: query.euClassification as any } : {}),
      },
      ...(query.productId
        ? {
            OR: [
              { productId: query.productId },
              { products: { some: { productId: query.productId } } },
            ],
          }
        : {}),
      ...(query.destinationPortId ? { destinationPortId: query.destinationPortId } : {}),
      ...(query.shipmentPeriod ? { shipmentHalf: query.shipmentPeriod } : {}),
      ...(query.startDate || query.endDate
        ? {
            actualShipmentDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const allContainersWhere: Prisma.ContractContainerWhereInput = {
          contract: contractWhere,
          ...(query.productId ? { productId: query.productId } : {}),
          ...(query.destinationPortId ? { destinationPortId: query.destinationPortId } : {}),
          ...(query.containerStatus ? { containerStatus: query.containerStatus } : {}),
          ...(query.shipmentPeriod ? { shipmentHalf: query.shipmentPeriod } : {}),
    };

    const [
      grouped,
      recent,
      upcomingContainers,
      containerStatusCounts,
      dispatchStatusCounts,
      shippedContainers,
      paymentAggregate,
      paymentStatusGrouped,
      remainingInvoices,
      attributionRows,
    ] = await Promise.all([
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
        where: upcomingWhere,
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
          products: {
            include: { product: { select: { code: true, name: true } } },
          },
          destinationPort: { select: { name: true } },
        },
        orderBy: { expectedShipmentDate: 'asc' },
      }),
      // Lightweight groupBy counts instead of loading all containers
      this.prisma.contractContainer.groupBy({
        by: ['containerStatus'],
        where: allContainersWhere,
        _count: { _all: true },
      }),
      this.prisma.contractContainer.groupBy({
        by: ['dispatchStatus'],
        where: allContainersWhere,
        _count: { _all: true },
      }),
      this.prisma.contractContainer.findMany({
        where: shippedWhere,
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              buyer: { select: { name: true } },
            },
          },
          product: { select: { code: true, name: true } },
          products: {
            include: { product: { select: { code: true, name: true } } },
          },
        },
        orderBy: { actualShipmentDate: 'desc' },
        take: 200,
      }),
      this.prisma.contractContainer.aggregate({
        where: allContainersWhere,
        _sum: {
          invoiceAmount: true,
          receivedAmount: true,
          remainingAmount: true,
        },
      }),
      this.prisma.contractContainer.groupBy({
        by: ['paymentStatus'],
        where: allContainersWhere,
        _count: { _all: true },
        _sum: { remainingAmount: true, invoiceAmount: true },
      }),
      this.prisma.contractContainer.findMany({
        where: {
          ...allContainersWhere,
          remainingAmount: { gt: 0 },
        },
        select: {
          id: true,
          containerIndex: true,
          invoiceNumber: true,
          invoiceAmount: true,
          receivedAmount: true,
          remainingAmount: true,
          paymentStatus: true,
          contract: {
            select: {
              id: true,
              contractNumber: true,
              buyer: { select: { name: true } },
            },
          },
        },
        take: 50,
        orderBy: { remainingAmount: 'desc' },
      }),
      this.prisma.contractSalesAttribution.findMany({
        where: { contract: contractWhere },
        include: {
          salesperson: { select: { id: true, name: true, code: true } },
          contract: { select: { id: true, totalMt: true, numberOfContainers: true } },
        },
      }),
    ]);

    const paymentAgg = paymentAggregate;
    const paymentStatusGroups = paymentStatusGrouped;

    /** Equal-credit salesperson breakdown (Phase 1 — no % UI). */
    const salespersonMap = new Map<
      string,
      { salespersonId: string; name: string; code?: string; contracts: number; totalMt: number; containers: number }
    >();
    for (const row of attributionRows) {
      const key = row.salespersonId;
      const entry = salespersonMap.get(key) ?? {
        salespersonId: key,
        name: row.salesperson?.name ?? 'Unknown',
        code: row.salesperson?.code,
        contracts: 0,
        totalMt: 0,
        containers: 0,
      };
      entry.contracts += 1;
      entry.totalMt += row.contract?.totalMt ?? 0;
      entry.containers += row.contract?.numberOfContainers ?? 0;
      salespersonMap.set(key, entry);
    }

    const countFor = (status: ContractStatus) =>
      grouped.find((g) => g.status === status)?._count._all ?? 0;

    const total = grouped.reduce((sum, g) => sum + g._count._all, 0);

    const upcomingMt = upcomingContainers.reduce((s, c) => s + (c.quantityMt ?? 0), 0);
    const contractIds = new Set(upcomingContainers.map((c) => c.contractId));
    const productIds = new Set(upcomingContainers.map((c) => c.productId));

    const byProduct = new Map<string, { code: string; name: string; containers: number; mt: number; contracts: Set<string> }>();
    for (const c of upcomingContainers) {
      const key = c.productId;
      const entry = byProduct.get(key) ?? {
        code: c.product.code,
        name: c.product.name,
        containers: 0,
        mt: 0,
        contracts: new Set<string>(),
      };
      entry.containers += 1;
      entry.mt += c.quantityMt ?? 0;
      entry.contracts.add(c.contract.contractNumber);
      byProduct.set(key, entry);
    }

    const byPeriod = { FIRST_HALF: 0, SECOND_HALF: 0 };
    for (const c of upcomingContainers) {
      if (c.shipmentHalf === 'FIRST_HALF') byPeriod.FIRST_HALF += 1;
      else if (c.shipmentHalf === 'SECOND_HALF') byPeriod.SECOND_HALF += 1;
    }

    const shippedByProduct = new Map<string, { code: string; name: string; quantity: number; containers: number; contracts: Set<string>; contractMap: Record<string, string> }>();
    for (const c of shippedContainers) {
      const key = c.productId;
      const entry = shippedByProduct.get(key) ?? {
        code: c.product.code,
        name: c.product.name,
        quantity: 0,
        containers: 0,
        contracts: new Set<string>(),
        contractMap: {},
      };
      entry.containers += 1;
      entry.quantity += c.quantityMt ?? 0;
      entry.contracts.add(c.contract.contractNumber);
      entry.contractMap[c.contract.contractNumber] = c.contract.id;
      shippedByProduct.set(key, entry);
    }

    // Compute counts from groupBy results instead of scanning all rows
    const containersShippedCount =
      dispatchStatusCounts
        .filter((g) => g.dispatchStatus === 'DISPATCHED' || g.dispatchStatus === 'SHIPPED')
        .reduce((sum, g) => sum + g._count._all, 0);
    const containersReachedPortCount =
      containerStatusCounts
        .find((g) => g.containerStatus === 'REACHED_PORT')?._count._all ?? 0;

    return {
      total,
      draft: countFor(ContractStatus.DRAFT),
      awaitingSigned: countFor(ContractStatus.AWAITING_SIGNED),
      confirmed: countFor(ContractStatus.CONFIRMED_FOR_PRODUCTION),
      inProduction: countFor(ContractStatus.IN_PRODUCTION),
      ready: countFor(ContractStatus.READY_FOR_DISPATCH),
      underPreparation: countFor(ContractStatus.UNDER_PREPARATION),
      recent,
      upcoming: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
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
      shipped: {
        totalContainers: shippedContainers.length,
        totalMt: shippedContainers.reduce((sum, c) => sum + (c.quantityMt ?? 0), 0),
        byProduct: [...shippedByProduct.values()].map((p) => ({
          code: p.code,
          name: p.name,
          quantity: p.quantity,
          containers: p.containers,
          contracts: [...p.contracts],
          contractMap: p.contractMap,
        })),
      },
      containersShipped: containersShippedCount,
      containersReachedPort: containersReachedPortCount,
      allContainers: [],
      salespersonBreakdown: [...salespersonMap.values()].sort((a, b) => b.contracts - a.contracts),
      scopedToSuperSales: user.role === UserRole.SUPER_SALES,
      payment: {
        totalInvoiceAmount: paymentAgg._sum.invoiceAmount ?? 0,
        totalReceived: paymentAgg._sum.receivedAmount ?? 0,
        totalRemaining: paymentAgg._sum.remainingAmount ?? 0,
        byStatus: paymentStatusGroups.map((g) => ({
          status: g.paymentStatus,
          count: g._count._all,
          remaining: g._sum.remainingAmount ?? 0,
          invoiceAmount: g._sum.invoiceAmount ?? 0,
        })),
        remainingInvoices: remainingInvoices.map((c) => ({
          invoiceNumber: c.invoiceNumber,
          contractId: c.contract.id,
          contractNumber: c.contract.contractNumber,
          containerIndex: c.containerIndex,
          buyer: c.contract.buyer?.name,
          invoiceAmount: c.invoiceAmount,
          receivedAmount: c.receivedAmount,
          remainingAmount: c.remainingAmount,
          paymentStatus: c.paymentStatus,
        })),
      },
    };
  }

  async fetchExchangeRate(currency: string) {
    return this.exchangeRate.fetchRate(currency, 'INR');
  }

  async amendContainerCommercial(
    contractId: string,
    containerId: string,
    dto: AmendContainerCommercialDto,
    user: JwtPayload,
  ) {
    const contract = await this.findOne(contractId, user);
    const container = contract.containers?.find((c) => c.id === containerId);
    if (!container) throw new NotFoundException('Container not found');

    const incoterm = (container.incoterm ?? Incoterm.CIF).toUpperCase();
    if (incoterm === Incoterm.FOB) {
      throw new ForbiddenException('Amendment not allowed for FOB containers');
    }
    const previousValue = container.currentCifCnfPrice ?? container.cifPrice ?? container.cnfPrice ?? 0;

    await this.prisma.$transaction(async (tx) => {
      await tx.containerCommercialAmendment.create({
        data: {
          contractId,
          containerId,
          incoterm,
          priceType: incoterm === Incoterm.CNF ? 'CNF' : 'CIF',
          invoiceNumber: container.invoiceNumber ?? null,
          previousValue,
          amendedValue: dto.newPrice,
          currency: dto.currency,
          reason: dto.reason,
          amendedById: user.sub,
        },
      });

      const updateData =
        incoterm === Incoterm.CNF
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
          fieldName: incoterm === Incoterm.CNF ? 'cnfPrice' : 'cifPrice',
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
      amendedById: user.sub,
    });

    return this.findOne(contractId, user);
  }

  async updateContainerStatus(
    contractId: string,
    containerId: string,
    status: string,
    user: JwtPayload,
    remarks?: string,
  ) {
    const contract = await this.findOne(contractId, user);
    const container = contract.containers?.find((c) => c.id === containerId);
    if (!container) throw new NotFoundException('Container not found');

    const fromStatus = container.containerStatus;
    if (fromStatus === status) return contract;

    await this.prisma.$transaction(async (tx) => {
      await tx.contractContainer.update({
        where: { id: containerId },
        data: { containerStatus: status },
      });
      await tx.containerStatusHistory.create({
        data: {
          containerId,
          contractId,
          fromStatus,
          toStatus: status,
          updatedById: user.sub,
          remarks: remarks || null,
        },
      });
    });

    await this.notifications.notifyChange({
      type: 'CONTAINER_STATUS',
      contractId,
      containerId,
      message:
        `Container status changed for Contract ${contract.contractNumber}, Container ${container.containerIndex}. ` +
        `Old Status: ${fromStatus}. New Status: ${status}. Changed By: ${user.name}.`,
      oldValue: fromStatus,
      newValue: status,
      changedById: user.sub,
      targetRoles: [UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.CONTRACT_TEAM, UserRole.PRODUCTION_TEAM, UserRole.SUPER_SALES],
    });

    return this.findOne(contractId, user);
  }

  async getAllAudits(user: JwtPayload) {
    if (!this.canAccessAnyOffice(user) && user.role !== UserRole.OFFICE_ADMIN) {
      throw new ForbiddenException('Access denied');
    }
    const [contractAudits, genericAudits] = await Promise.all([
      this.prisma.contractAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          changedBy: { select: { id: true, name: true, email: true } },
          contract: { select: { id: true, contractNumber: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const formattedContract = contractAudits.map((a) => ({
      id: a.id,
      timestamp: a.createdAt,
      type: 'CONTRACT',
      user: a.changedBy?.name || a.changedBy?.email || 'System',
      module: 'Contract',
      action: `EDIT (${a.fieldName})`,
      recordId: a.contractId,
      contractNumber: a.contract?.contractNumber || a.contractNumber || 'Unknown',
      previousValue: a.previousValue,
      newValue: a.newValue,
    }));

    const formattedGeneric = genericAudits.map((a) => ({
      id: a.id,
      timestamp: a.createdAt,
      type: 'MASTER',
      user: a.user?.name || a.user?.email || 'System',
      module: a.module,
      action: a.action,
      recordId: a.recordId,
      contractNumber: undefined,
      previousValue: a.previousValue,
      newValue: a.newValue,
    }));

    return [...formattedContract, ...formattedGeneric].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getContractAudit(contractId: string, user: JwtPayload) {
    return this.findOne(contractId, user).then(() =>
      this.audit.findByContract(contractId),
    );
  }
}
