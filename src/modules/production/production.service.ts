import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ContainerStatus, UserRole } from '../../common/constants/enums';
import {
  DEFAULT_WASTAGE_ALERT_PCT,
  FULL_PROCESS_DEFAULT_PRODUCT_KEY,
  InputStockCategory,
  LedgerTxnType,
  ProcessType,
  ProductionRunStatus,
  ProductionSource,
  RejectedStockStatus,
  SamplingStatus,
  StockCategory,
  TransferStatus,
  WASTAGE_ALERT_THRESHOLD_KEY,
  WastageDisposition,
  WastageLotStatus,
  WastageStage,
  requiresSampling,
  toKg,
} from '../../common/constants/production.constants';
import { NotificationService } from '../../common/services/notification.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { ProductionAuditService } from './production-audit.service';
import {
  AddInputDto,
  AllocateContainerDto,
  AllocateFromStockDto,
  CleaningResultDto,
  CreateInwardDto,
  CreateSupplierDto,
  CreateTransferDto,
  FinaliseProductionDto,
  FulfilmentAllocateDto,
  HullingResultDto,
  InwardQueryDto,
  SampleResultDto,
  StartProductionDto,
  StoreProcessedDto,
} from './production.dto';

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private ledger: InventoryLedgerService,
    private audit: ProductionAuditService,
    private notifications: NotificationService,
  ) {}

  private tx<T>(fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { maxWait: 15000, timeout: 60000 });
  }

  private async nextNumber(
    prefix: string,
    model: 'inward' | 'run' | 'lot' | 'rejected' | 'transfer' | 'wastage',
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const year = new Date().getFullYear();
    const full = `${prefix}-${year}-`;
    let latest: { n: string } | null = null;
    if (model === 'inward') {
      const row = await client.rawMaterialInward.findFirst({
        where: { inwardNumber: { startsWith: full } },
        orderBy: { inwardNumber: 'desc' },
      });
      latest = row ? { n: row.inwardNumber } : null;
    } else if (model === 'run') {
      const row = await client.productionRun.findFirst({
        where: { productionNumber: { startsWith: full } },
        orderBy: { productionNumber: 'desc' },
      });
      latest = row ? { n: row.productionNumber } : null;
    } else if (model === 'lot') {
      const row = await client.processedOutputLot.findFirst({
        where: { lotNumber: { startsWith: full } },
        orderBy: { lotNumber: 'desc' },
      });
      latest = row ? { n: row.lotNumber } : null;
    } else if (model === 'rejected') {
      const row = await client.sampleRejectedLot.findFirst({
        where: { lotNumber: { startsWith: full } },
        orderBy: { lotNumber: 'desc' },
      });
      latest = row ? { n: row.lotNumber } : null;
    } else if (model === 'wastage') {
      const row = await client.wastageLot.findFirst({
        where: { lotNumber: { startsWith: full } },
        orderBy: { lotNumber: 'desc' },
      });
      latest = row ? { n: row.lotNumber } : null;
    } else {
      const row = await client.plantTransfer.findFirst({
        where: { transferNumber: { startsWith: full } },
        orderBy: { transferNumber: 'desc' },
      });
      latest = row ? { n: row.transferNumber } : null;
    }
    let next = 1;
    if (latest) {
      const n = parseInt(latest.n.split('-').pop() || '0', 10);
      if (!isNaN(n)) next = n + 1;
    }
    return `${full}${String(next).padStart(5, '0')}`;
  }

  /** Allocate sequential year-numbers inside one transaction without colliding. */
  private async createNumberAllocator(
    prefix: string,
    model: 'inward' | 'run' | 'lot' | 'rejected' | 'transfer' | 'wastage',
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const first = await this.nextNumber(prefix, model, client);
    let next = parseInt(first.split('-').pop() || '1', 10);
    const year = new Date().getFullYear();
    return () => {
      const n = next++;
      return `${prefix}-${year}-${String(n).padStart(5, '0')}`;
    };
  }

  private async wastageThreshold(): Promise<number> {
    const s = await this.prisma.appSetting.findUnique({ where: { key: WASTAGE_ALERT_THRESHOLD_KEY } });
    const v = s ? parseFloat(s.value) : NaN;
    return Number.isFinite(v) ? v : DEFAULT_WASTAGE_ALERT_PCT;
  }

  // ── Masters ──────────────────────────────────────────────
  listLocations() {
    return this.prisma.inventoryLocation.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  listSuppliers() {
    return this.prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createSupplier(dto: CreateSupplierDto) {
    const code =
      dto.code?.trim().toUpperCase() ||
      `SUP-${dto.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8)}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
    return this.prisma.supplier.create({
      data: { code, name: dto.name.trim(), phone: dto.phone, email: dto.email },
    });
  }

  listInwardTypes() {
    return this.prisma.inwardType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  listWastageTypes(stage?: string) {
    return this.prisma.wastageType.findMany({
      where: { isActive: true, ...(stage ? { stage } : {}) },
      orderBy: [{ stage: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  // ── Inward ───────────────────────────────────────────────
  async createInward(dto: CreateInwardDto, user: JwtPayload) {
    const type = await this.prisma.inwardType.findUnique({ where: { id: dto.inwardTypeId } });
    if (!type) throw new NotFoundException('Inward type not found');
    if (type.requiresDesc && !dto.otherTypeDesc?.trim()) {
      throw new BadRequestException('Other inward type description is required');
    }
    if (!dto.truckNumber?.trim()) throw new BadRequestException('Truck number is required');
    const weightKg = toKg(dto.weight, dto.unit || 'KG');
    if (weightKg <= 0) throw new BadRequestException('Weight must be greater than zero');
    if ((dto.numberOfBags ?? 0) < 0) throw new BadRequestException('Number of bags cannot be negative');

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
          inputUnit: (dto.unit || 'KG').toUpperCase(),
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
        txnType: LedgerTxnType.RAW_MATERIAL_INWARD,
        productId: dto.productId,
        stockCategory: StockCategory.RAW_MATERIAL,
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

  listInwards(query: InwardQueryDto) {
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

  // ── Inventory ────────────────────────────────────────────
  getBalances(query: { locationId?: string; productId?: string; stockCategory?: string }) {
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

  getLedger(query: { productId?: string; take?: number }) {
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

  // ── Pending contracts ────────────────────────────────────
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
    const fulfilledMap = new Map<string, number>();
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
            const lines =
              ct.products?.length > 0
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
                      id: null as string | null,
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

        if (!containers.length) return null;

        const dueDates = containers
          .map((ct) => (ct.expectedShipmentDate ? new Date(ct.expectedShipmentDate) : null))
          .filter(Boolean) as Date[];
        const dueDate = dueDates.length
          ? new Date(Math.min(...dueDates.map((d) => d.getTime())))
          : c.expectedShipmentDate
            ? new Date(c.expectedShipmentDate)
            : null;

        let urgency: 'RED' | 'YELLOW' | 'WHITE' = 'WHITE';
        let daysLabel = '—';
        if (dueDate) {
          const d0 = new Date(dueDate);
          d0.setHours(0, 0, 0, 0);
          const diff = Math.round((d0.getTime() - today.getTime()) / 86400000);
          if (diff < 0) {
            urgency = 'RED';
            daysLabel = `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'}`;
          } else if (diff <= 7) {
            urgency = 'YELLOW';
            daysLabel = `Due in ${diff} day${diff === 1 ? '' : 's'}`;
          } else {
            daysLabel = `Due in ${diff} days`;
          }
        }

        const pendingKg = containers.reduce((s, ct) => s + ct.pendingKg, 0);
        const requiredKg = containers.reduce(
          (s, ct) => s + ct.productLines.reduce((a, l) => a + l.requiredKg, 0),
          0,
        );
        const fulfilledKg = requiredKg - pendingKg;

        return {
          id: c.id,
          contractNumber: c.contractNumber,
          contractDate: c.contractDate,
          buyer: c.buyer,
          euClassification: c.euClassification,
          destinationCountry: c.destinationCountry,
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
      .filter(Boolean) as any[];

    rows.sort((a, b) => {
      const rank: Record<string, number> = { RED: 0, YELLOW: 1, WHITE: 2 };
      const r = (rank[a.urgency] ?? 9) - (rank[b.urgency] ?? 9);
      if (r !== 0) return r;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });

    return rows;
  }

  // ── Production runs ──────────────────────────────────────
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

  async getRun(id: string) {
    const run = await this.prisma.productionRun.findUnique({
      where: { id },
      include: {
        plant: true,
        product: true,
        createdBy: { select: { id: true, name: true } },
        inputs: {
          include: { supplier: true, inward: true, wastageLot: { include: { wastageType: true } } },
          orderBy: { createdAt: 'asc' },
        },
        cleaning: { include: { wastageType: true } },
        hulling: { include: { wastageType: true } },
        wastageDispositions: true,
        wastageLots: { include: { wastageType: true } },
        outputLots: true,
        allocations: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!run) throw new NotFoundException('Production run not found');
    return run;
  }

  async getSettings() {
    const [threshold, defaultProduct] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: WASTAGE_ALERT_THRESHOLD_KEY } }),
      this.prisma.appSetting.findUnique({ where: { key: FULL_PROCESS_DEFAULT_PRODUCT_KEY } }),
    ]);
    return {
      wastageAlertPct: Number(threshold?.value ?? DEFAULT_WASTAGE_ALERT_PCT),
      fullProcessDefaultProductId: defaultProduct?.value || null,
    };
  }

  async startRun(dto: StartProductionDto, user: JwtPayload) {
    if (
      dto.processType === ProcessType.FULL_PROCESS &&
      (dto.stockCategory === InputStockCategory.SAMPLE_REJECTED_STOCK ||
        dto.stockCategory === InputStockCategory.WASTAGE_INVENTORY)
    ) {
      throw new BadRequestException('Sample-rejected / wastage stock can only be used in Sortex');
    }
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product?.isActive) throw new BadRequestException('Product not found or inactive');
    if (dto.processType === ProcessType.FULL_PROCESS && product.allowsFullProcess === false) {
      throw new BadRequestException(
        'Full Process is currently available only for Sesame Seed products.',
      );
    }
    if (dto.processType === ProcessType.SORTEX && product.allowsSortex === false) {
      throw new BadRequestException(`${product.name} is not allowed for Sortex`);
    }
    const qtyKg = toKg(dto.quantity, dto.unit || 'KG');

    if (dto.stockCategory === InputStockCategory.SAMPLE_REJECTED_STOCK) {
      if (!dto.rejectedLotId) throw new BadRequestException('Rejected lot is required for Sortex from rejected stock');
      const lot = await this.prisma.sampleRejectedLot.findUnique({ where: { id: dto.rejectedLotId } });
      if (!lot || lot.availableKg < qtyKg - 0.001) throw new BadRequestException('Insufficient rejected stock');
    } else if (dto.stockCategory === InputStockCategory.EXISTING_PROCESSED_STOCK || dto.stockCategory === InputStockCategory.JOB_WORK_RETURNED_PROCESSED) {
      if (!dto.processedLotId) throw new BadRequestException('Processed lot is required');
      const lot = await this.prisma.processedOutputLot.findUnique({ where: { id: dto.processedLotId } });
      if (!lot || lot.availableKg < qtyKg - 0.001) throw new BadRequestException('Insufficient processed stock');
    } else if (dto.stockCategory === InputStockCategory.WASTAGE_INVENTORY) {
      if (!dto.wastageLotId) throw new BadRequestException('Wastage lot is required');
      const lot = await this.prisma.wastageLot.findUnique({ where: { id: dto.wastageLotId } });
      if (!lot || lot.availableKg < qtyKg - 0.001) throw new BadRequestException('Insufficient wastage stock');
      if (lot.productId !== dto.productId) throw new BadRequestException('Wastage lot product mismatch');
    } else {
      const avail = await this.ledger.getAvailableKg(dto.productId, dto.plantId, StockCategory.RAW_MATERIAL);
      if (avail < qtyKg - 0.001) {
        throw new BadRequestException(`Insufficient raw material. Available: ${avail} KG`);
      }
    }

    let productionSource: ProductionSource = ProductionSource.IN_HOUSE;
    let reprocessingCycle = 0;
    let parentWastageLotId: string | undefined;
    let sampleRejectedLotId: string | undefined;
    if (dto.stockCategory === InputStockCategory.WASTAGE_INVENTORY && dto.wastageLotId) {
      productionSource = ProductionSource.WASTAGE_REPROCESSING;
      const wl = await this.prisma.wastageLot.findUnique({ where: { id: dto.wastageLotId } });
      reprocessingCycle = (wl?.reprocessingCycle || 1) + 1;
      parentWastageLotId = dto.wastageLotId;
    } else if (dto.stockCategory === InputStockCategory.SAMPLE_REJECTED_STOCK) {
      productionSource = ProductionSource.SAMPLING_REJECTED_REPROCESSING;
      sampleRejectedLotId = dto.rejectedLotId;
    } else if (dto.jobWorkId || dto.stockCategory === InputStockCategory.JOB_WORK_RETURNED_PROCESSED) {
      productionSource = ProductionSource.JOB_WORK;
    }

    const productionNumber = await this.nextNumber('PR', 'run');
    const run = await this.tx(async (tx) => {
      const created = await tx.productionRun.create({
        data: {
          productionNumber,
          plantId: dto.plantId,
          processType: dto.processType,
          productId: dto.productId,
          status: ProductionRunStatus.CLEANING_IN_PROGRESS,
          startDate: new Date(dto.startDate),
          totalInputKg: qtyKg,
          remarks: dto.remarks,
          productionSource,
          jobWorkId: dto.jobWorkId || null,
          parentWastageLotId: parentWastageLotId || null,
          sampleRejectedLotId: sampleRejectedLotId || null,
          reprocessingCycle,
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
          wastageLotId: dto.wastageLotId,
          quantityKg: qtyKg,
          inputUnit: (dto.unit || 'KG').toUpperCase(),
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
            status: RejectedStockStatus.UNDER_SORTEX,
          },
        });
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.SORTEX_REUSE,
          productId: dto.productId,
          stockCategory: StockCategory.SAMPLE_REJECTED,
          locationId: dto.plantId,
          fromCategory: StockCategory.SAMPLE_REJECTED,
          toCategory: StockCategory.WIP_CLEANING,
          quantityOutKg: qtyKg,
          quantityInKg: qtyKg,
          referenceType: 'PRODUCTION_RUN',
          referenceId: created.id,
          createdById: user.sub,
        });
      } else if (dto.wastageLotId) {
        await tx.wastageLot.update({
          where: { id: dto.wastageLotId },
          data: {
            availableKg: { decrement: qtyKg },
            reprocessedKg: { increment: qtyKg },
            status: WastageLotStatus.PARTIALLY_REPROCESSED,
          },
        });
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.WASTAGE_REPROCESS_ISSUE,
          productId: dto.productId,
          stockCategory: StockCategory.WASTAGE_INVENTORY,
          locationId: dto.plantId,
          fromCategory: StockCategory.WASTAGE_INVENTORY,
          toCategory: StockCategory.WIP_CLEANING,
          quantityOutKg: qtyKg,
          quantityInKg: qtyKg,
          referenceType: 'PRODUCTION_RUN',
          referenceId: created.id,
          createdById: user.sub,
        });
      } else if (dto.processedLotId) {
        await tx.processedOutputLot.update({
          where: { id: dto.processedLotId },
          data: { availableKg: { decrement: qtyKg } },
        });
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.PRODUCTION_ISSUE,
          productId: dto.productId,
          stockCategory: StockCategory.PROCESSED_AVAILABLE,
          locationId: dto.plantId,
          fromCategory: StockCategory.PROCESSED_AVAILABLE,
          toCategory: StockCategory.WIP_CLEANING,
          quantityOutKg: qtyKg,
          quantityInKg: qtyKg,
          referenceType: 'PRODUCTION_RUN',
          referenceId: created.id,
          createdById: user.sub,
        });
      } else {
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.PRODUCTION_ISSUE,
          productId: dto.productId,
          stockCategory: StockCategory.RAW_MATERIAL,
          locationId: dto.plantId,
          fromCategory: StockCategory.RAW_MATERIAL,
          toCategory: StockCategory.WIP_CLEANING,
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
      newValue: JSON.stringify({ qtyKg, processType: dto.processType, productionSource }),
    });

    return this.getRun(run.id);
  }

  async reopenCleaning(runId: string, user: JwtPayload, reason?: string) {
    if (![UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN].includes(user.role as any)) {
      throw new ForbiddenException('Only Admin can reopen cleaning');
    }
    const run = await this.getRun(runId);
    if (!run.cleaningFinalizedAt) throw new BadRequestException('Cleaning is not finalized');
    if (run.hullingFinalizedAt) {
      throw new BadRequestException('Cannot reopen cleaning after hulling is finalized');
    }
    const hullingQty = run.hullingInputKg || 0;
    await this.tx(async (tx) => {
      if (hullingQty > 0.001) {
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.STOCK_ADJUSTMENT,
          productId: run.productId,
          stockCategory: StockCategory.WIP_HULLING,
          locationId: run.plantId,
          fromCategory: StockCategory.WIP_HULLING,
          toCategory: StockCategory.WIP_CLEANING,
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
          status: ProductionRunStatus.CLEANING_IN_PROGRESS,
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

  async addInput(runId: string, dto: AddInputDto, user: JwtPayload) {
    const run = await this.getRun(runId);
    if ([ProductionRunStatus.COMPLETED, ProductionRunStatus.CANCELLED].includes(run.status as any)) {
      throw new BadRequestException('Cannot add input to a completed/cancelled run');
    }
    if (run.cleaningFinalizedAt) {
      throw new BadRequestException(
        'Cleaning is already finalized. Reopen cleaning with Admin permission before adding input, or update cleaning results.',
      );
    }
    if (run.processType === ProcessType.FULL_PROCESS && dto.stockCategory === InputStockCategory.SAMPLE_REJECTED_STOCK) {
      throw new BadRequestException('Sample-rejected stock can only be used in Sortex');
    }

    const qtyKg = toKg(dto.quantity, dto.unit);
    const avail = await this.ledger.getAvailableKg(run.productId, run.plantId, StockCategory.RAW_MATERIAL);
    if (dto.stockCategory === InputStockCategory.NORMAL_RAW_MATERIAL && avail < qtyKg - 0.001) {
      throw new BadRequestException(`Insufficient raw material. Available: ${avail} kg`);
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
          inputUnit: (dto.unit || 'KG').toUpperCase(),
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
        txnType: LedgerTxnType.ADDITIONAL_PRODUCTION_INPUT,
        productId: run.productId,
        stockCategory: StockCategory.RAW_MATERIAL,
        locationId: run.plantId,
        fromCategory: StockCategory.RAW_MATERIAL,
        toCategory: StockCategory.WIP_CLEANING,
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

  async submitCleaning(runId: string, dto: CleaningResultDto, user: JwtPayload) {
    const run = await this.getRun(runId);
    if (run.cleaningFinalizedAt) throw new BadRequestException('Cleaning already finalized');
    let totalWastage = 0;
    for (const line of dto.lines) {
      const q = toKg(line.quantity ?? 0, line.unit || 'KG');
      if (q < 0) throw new BadRequestException('Wastage cannot be negative');
      totalWastage += q;
    }
    totalWastage = Math.round(totalWastage * 1000) / 1000;
    if (totalWastage > run.totalInputKg + 0.001) {
      throw new BadRequestException('Cleaning wastage cannot exceed input quantity');
    }
    const forwarded = Math.round((run.totalInputKg - totalWastage) * 1000) / 1000;
    if (forwarded < 0) throw new BadRequestException('Net quantity cannot be negative');

    const isSortex = run.processType === ProcessType.SORTEX;

    await this.tx(async (tx) => {
      await tx.cleaningWastageEntry.deleteMany({ where: { productionRunId: runId } });
      for (const line of dto.lines) {
        const q = toKg(line.quantity ?? 0, line.unit || 'KG');
        if (q <= 0) continue;
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

      if (isSortex) {
        // Sortex: no hulling — hold wastage in WIP until finalisation Store/Discard
        await tx.productionRun.update({
          where: { id: runId },
          data: {
            cleaningWastageKg: totalWastage,
            hullingInputKg: 0,
            netOutputKg: forwarded,
            cleaningFinalizedAt: new Date(),
            status: ProductionRunStatus.AWAITING_FINALISATION,
          },
        });
        // Wastage stays conceptually in WIP until disposition; move net to a holding concept via netOutputKg only
      } else {
        await tx.productionRun.update({
          where: { id: runId },
          data: {
            cleaningWastageKg: totalWastage,
            hullingInputKg: forwarded,
            cleaningFinalizedAt: new Date(),
            status: ProductionRunStatus.HULLING_IN_PROGRESS,
          },
        });
        if (forwarded > 0) {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.TRANSFER_TO_HULLING,
            productId: run.productId,
            stockCategory: StockCategory.WIP_CLEANING,
            locationId: run.plantId,
            fromCategory: StockCategory.WIP_CLEANING,
            toCategory: StockCategory.WIP_HULLING,
            quantityOutKg: forwarded,
            quantityInKg: forwarded,
            referenceType: 'PRODUCTION_RUN',
            referenceId: runId,
            createdById: user.sub,
          });
        }
      }
    });

    await this.audit.log({
      module: 'PRODUCTION',
      recordType: 'Cleaning',
      recordNumber: run.productionNumber,
      action: 'CLEANING_FINALIZED',
      changedById: user.sub,
      newValue: JSON.stringify({ totalWastage, forwarded, isSortex }),
    });

    return this.getRun(runId);
  }

  async submitHulling(runId: string, dto: HullingResultDto, user: JwtPayload) {
    const run = await this.getRun(runId);
    if (run.processType === ProcessType.SORTEX) {
      throw new BadRequestException('Sortex runs do not have a Hulling stage');
    }
    if (!run.cleaningFinalizedAt) throw new BadRequestException('Complete cleaning before hulling');
    if (run.hullingFinalizedAt) throw new BadRequestException('Hulling already finalized');
    let totalWastage = 0;
    const resolved: {
      wastageTypeId: string;
      quantityKg: number;
      numberOfBags?: number;
      weightPerBagKg?: number;
      remarks?: string;
      unit: string;
    }[] = [];

    for (const line of dto.lines) {
      let q = 0;
      if (line.numberOfBags != null && line.weightPerBag != null) {
        q = toKg(line.numberOfBags * line.weightPerBag, line.unit || 'KG');
      } else {
        q = toKg(line.quantity ?? 0, line.unit || 'KG');
      }
      if (q < 0) throw new BadRequestException('Wastage cannot be negative');
      if (q > 0) {
        resolved.push({
          wastageTypeId: line.wastageTypeId,
          quantityKg: q,
          numberOfBags: line.numberOfBags,
          weightPerBagKg: line.weightPerBag != null ? toKg(line.weightPerBag, line.unit || 'KG') : undefined,
          remarks: line.remarks,
          unit: (line.unit || 'KG').toUpperCase(),
        });
        totalWastage += q;
      }
    }
    totalWastage = Math.round(totalWastage * 1000) / 1000;
    if (totalWastage > run.hullingInputKg + 0.001) {
      throw new BadRequestException('Hulling wastage cannot exceed hulling input');
    }
    const net = Math.round((run.hullingInputKg - totalWastage) * 1000) / 1000;
    const pct = run.hullingInputKg > 0 ? Math.round((totalWastage / run.hullingInputKg) * 10000) / 100 : 0;
    const threshold = await this.wastageThreshold();
    const alert = pct > threshold;

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
      // Do NOT create processed lot yet — wait for finalise with Store/Discard
      await tx.productionRun.update({
        where: { id: runId },
        data: {
          hullingWastageKg: totalWastage,
          hullingWastagePct: pct,
          netOutputKg: net,
          wastageAlert: alert,
          hullingFinalizedAt: new Date(),
          status: ProductionRunStatus.AWAITING_FINALISATION,
        },
      });
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

  async finaliseProduction(runId: string, dto: FinaliseProductionDto, user: JwtPayload) {
    const run = await this.getRun(runId);
    if (run.status === ProductionRunStatus.COMPLETED) {
      throw new BadRequestException('Production already finalised');
    }
    if (run.processType === ProcessType.SORTEX) {
      if (!run.cleaningFinalizedAt) throw new BadRequestException('Complete cleaning before finalisation');
    } else {
      if (!run.hullingFinalizedAt) throw new BadRequestException('Complete hulling before finalisation');
    }

    const cleaning = await this.prisma.cleaningWastageEntry.findMany({ where: { productionRunId: runId } });
    const hulling = await this.prisma.hullingWastageEntry.findMany({ where: { productionRunId: runId } });
    const wastageLines = [
      ...cleaning.map((c) => ({ wastageTypeId: c.wastageTypeId, quantityKg: c.quantityKg, stage: WastageStage.CLEANING })),
      ...hulling.map((h) => ({ wastageTypeId: h.wastageTypeId, quantityKg: h.quantityKg, stage: WastageStage.HULLING })),
    ].filter((l) => l.quantityKg > 0.001);

    for (const line of wastageLines) {
      const d = dto.dispositions.find((x) => x.wastageTypeId === line.wastageTypeId);
      if (!d || ![WastageDisposition.STORE, WastageDisposition.DISCARD].includes(d.action as any)) {
        throw new BadRequestException(
          `Store/Discard disposition required for every non-zero wastage type (missing: ${line.wastageTypeId})`,
        );
      }
    }

    const net = run.netOutputKg || 0;
    const totalWastage = Math.round(
      (wastageLines.reduce((s, l) => s + l.quantityKg, 0)) * 1000,
    ) / 1000;
    const lotNumber = await this.nextNumber('OUT', 'lot');
    const fromWip =
      run.processType === ProcessType.SORTEX ? StockCategory.WIP_CLEANING : StockCategory.WIP_HULLING;
    const wipForLine = (stage: string) =>
      run.processType === ProcessType.SORTEX || stage === WastageStage.CLEANING
        ? StockCategory.WIP_CLEANING
        : StockCategory.WIP_HULLING;

    await this.tx(async (tx) => {
      await tx.productionWastageDisposition.deleteMany({ where: { productionRunId: runId } });
      const nextWlNumber = await this.createNumberAllocator('WL', 'wastage', tx);

      for (const line of wastageLines) {
        const action = dto.dispositions.find((x) => x.wastageTypeId === line.wastageTypeId)!.action;
        const lineWip = wipForLine(line.stage);
        let wastageLotId: string | null = null;
        if (action === WastageDisposition.STORE) {
          const wlNumber = nextWlNumber();
          const wl = await tx.wastageLot.create({
            data: {
              lotNumber: wlNumber,
              productId: run.productId,
              wastageTypeId: line.wastageTypeId,
              locationId: run.plantId,
              quantityKg: line.quantityKg,
              availableKg: line.quantityKg,
              productionRunId: runId,
              parentWastageLotId: run.parentWastageLotId || null,
              originalProductionRunId: run.parentWastageLotId
                ? (
                    await tx.wastageLot.findUnique({
                      where: { id: run.parentWastageLotId },
                      select: { originalProductionRunId: true, productionRunId: true },
                    })
                  )?.originalProductionRunId ||
                  (
                    await tx.wastageLot.findUnique({
                      where: { id: run.parentWastageLotId },
                      select: { productionRunId: true },
                    })
                  )?.productionRunId ||
                  runId
                : runId,
              processType: run.processType,
              reprocessingCycle: run.reprocessingCycle || 1,
              status: WastageLotStatus.AVAILABLE,
              productionDate: new Date(),
            },
          });
          wastageLotId = wl.id;
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.WASTAGE_STORE,
            productId: run.productId,
            stockCategory: lineWip,
            locationId: run.plantId,
            fromCategory: lineWip,
            toCategory: StockCategory.WASTAGE_INVENTORY,
            quantityOutKg: line.quantityKg,
            quantityInKg: line.quantityKg,
            referenceType: 'WASTAGE_LOT',
            referenceId: wl.id,
            createdById: user.sub,
          });
        } else {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.WASTAGE_DISCARD,
            productId: run.productId,
            stockCategory: lineWip,
            sourceLocationId: run.plantId,
            quantityOutKg: line.quantityKg,
            referenceType: 'PRODUCTION_RUN',
            referenceId: runId,
            remarks: `Discarded ${line.quantityKg} KG`,
            createdById: user.sub,
          });
        }

        await tx.productionWastageDisposition.create({
          data: {
            productionRunId: runId,
            wastageTypeId: line.wastageTypeId,
            stage: line.stage,
            quantityKg: line.quantityKg,
            action,
            wastageLotId,
          },
        });

        if (line.stage === WastageStage.CLEANING) {
          await tx.cleaningWastageEntry.updateMany({
            where: { productionRunId: runId, wastageTypeId: line.wastageTypeId },
            data: { disposition: action },
          });
        } else {
          await tx.hullingWastageEntry.updateMany({
            where: { productionRunId: runId, wastageTypeId: line.wastageTypeId },
            data: { disposition: action },
          });
        }
      }

      if (net > 0.001) {
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
            productionSource: run.productionSource || ProductionSource.IN_HOUSE,
            jobWorkId: run.jobWorkId || null,
            parentWastageLotId: run.parentWastageLotId || null,
            sampleRejectedLotId: run.sampleRejectedLotId || null,
            reprocessingCycle: run.reprocessingCycle || 0,
          },
        });
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.PROCESSED_OUTPUT,
          productId: run.productId,
          stockCategory: fromWip,
          locationId: run.plantId,
          fromCategory: fromWip,
          toCategory: StockCategory.PROCESSED_AVAILABLE,
          quantityOutKg: net,
          quantityInKg: net,
          referenceType: 'PRODUCTION_RUN',
          referenceId: runId,
          createdById: user.sub,
        });
      }

      // Mark parent wastage lot fully used if depleted
      if (run.parentWastageLotId) {
        const parent = await tx.wastageLot.findUnique({ where: { id: run.parentWastageLotId } });
        if (parent && parent.availableKg <= 0.001) {
          await tx.wastageLot.update({
            where: { id: parent.id },
            data: { status: WastageLotStatus.FULLY_REPROCESSED },
          });
        }
      }

      await tx.productionRun.update({
        where: { id: runId },
        data: {
          storedProcessedKg: net,
          finalisedAt: new Date(),
          completionDate: new Date(),
          daysSpanned: Math.floor((Date.now() - new Date(run.startDate).getTime()) / 86400000) + 1,
          status: ProductionRunStatus.COMPLETED,
        },
      });
    });

    await this.audit.log({
      module: 'PRODUCTION',
      recordType: 'ProductionRun',
      recordNumber: run.productionNumber,
      action: 'FINALISED',
      changedById: user.sub,
      newValue: JSON.stringify({ net, totalWastage, dispositions: dto.dispositions }),
    });

    return this.getRun(runId);
  }

  // ── Fulfilment ───────────────────────────────────────────
  private async refreshContainerStatus(tx: Prisma.TransactionClient, contractId: string, containerId: string, userId: string) {
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      select: {
        euClassification: true,
        contractNumber: true,
        destinationCountry: true,
        destinationPort: { include: { country: true } },
      },
    });
    const container = await tx.contractContainer.findUnique({
      where: { id: containerId },
      include: {
        products: true,
        destinationPort: { include: { country: true } },
      },
    });
    if (!container) return;

    const allocs = await tx.containerAllocation.findMany({
      where: { containerId, status: 'ACTIVE' },
    });
    const lines =
      container.products.length > 0
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
              id: null as string | null,
              productId: container.productId,
              requiredKg: (container.quantityMt || 0) * 1000,
              fulfilledKg: allocs.filter((a) => a.productId === container.productId).reduce((s, a) => s + a.quantityKg, 0),
            },
          ];

    const allDone = lines.every((l) => l.fulfilledKg >= l.requiredKg - 0.001);
    const anyDone = lines.some((l) => l.fulfilledKg > 0.001);
    const destCountry =
      contract?.destinationCountry ||
      container.destinationPort?.country?.name ||
      contract?.destinationPort?.country?.name ||
      '';
    const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))] as string[];
    const products =
      productIds.length > 0
        ? await tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, samplingNormallyApplicable: true },
          })
        : [];
    const productSampling = products.some((p) => p.samplingNormallyApplicable);
    const needsSampling = requiresSampling(contract?.euClassification, destCountry, productSampling);

    let nextStatus = container.containerStatus;
    if (allDone) {
      nextStatus = needsSampling ? ContainerStatus.READY_FOR_SAMPLING : ContainerStatus.READY_FOR_DISPATCH;
    } else if (anyDone) {
      nextStatus = ContainerStatus.PARTIALLY_FULFILLED;
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
          toStatus: nextStatus!,
          updatedById: userId,
          remarks: 'Updated by production fulfilment',
        },
      });
    }

    if (allDone && needsSampling) {
      // One sampling workflow per container (not per product line duplication for Russia+EU)
      const existingAny = await tx.sampleRecord.findFirst({
        where: { containerId, status: { not: SamplingStatus.FAILED } },
      });
      if (!existingAny) {
        for (const line of lines) {
          const existing = await tx.sampleRecord.findFirst({
            where: { containerId, productId: line.productId },
          });
          if (!existing) {
            await tx.sampleRecord.create({
              data: {
                contractId,
                containerId,
                productId: line.productId,
                status: SamplingStatus.READY_FOR_SAMPLING,
              },
            });
          }
        }
      }
    }
  }

  /** @deprecated Fulfilment removed from Production Run — use allocateFulfilmentFifo */
  async allocateToContainer(_runId: string, _dto: AllocateContainerDto, _user: JwtPayload) {
    throw new BadRequestException(
      'Container allocation from Production Run is no longer supported. Use Fulfilment from Processed Inventory.',
    );
  }

  async storeRemainingProcessed(_runId: string, _dto: StoreProcessedDto, _user: JwtPayload) {
    throw new BadRequestException(
      'Store remaining from run is obsolete. Finalise Production moves all good output to Processed Inventory.',
    );
  }

  async allocateFromProcessedStock(dto: AllocateFromStockDto, user: JwtPayload) {
    if (dto.processedLotId) {
      const lot = await this.prisma.processedOutputLot.findUnique({ where: { id: dto.processedLotId } });
      if (!lot) throw new NotFoundException('Processed lot not found');
      if (lot.productId !== dto.productId) throw new BadRequestException('Product mismatch with processed lot');
      const qtyKg = toKg(dto.quantity, dto.unit || 'KG');
      if (lot.availableKg < qtyKg - 0.001) {
        throw new BadRequestException(`Only ${lot.availableKg} KG is available`);
      }
      await this.tx(async (tx) => {
        await this.applyLotAllocation(tx, {
          lot,
          contractId: dto.contractId,
          containerId: dto.containerId,
          containerProductId: dto.containerProductId,
          productId: dto.productId,
          qtyKg,
          userId: user.sub,
        });
        await this.refreshContainerStatus(tx, dto.contractId, dto.containerId, user.sub);
      });
      await this.audit.log({
        module: 'FULFILMENT',
        recordType: 'ContainerAllocation',
        recordNumber: lot.lotNumber,
        action: 'ALLOCATED_FROM_STOCK',
        changedById: user.sub,
        newValue: String(qtyKg),
      });
      return { ok: true };
    }
    if (!dto.locationId) throw new BadRequestException('locationId is required for product-based fulfilment');
    return this.allocateFulfilmentFifo(
      {
        productId: dto.productId,
        locationId: dto.locationId,
        contractId: dto.contractId,
        containerId: dto.containerId,
        containerProductId: dto.containerProductId,
        quantityKg: toKg(dto.quantity, dto.unit || 'KG'),
      },
      user,
    );
  }

  private async applyLotAllocation(
    tx: Prisma.TransactionClient,
    args: {
      lot: { id: string; plantId: string; productionRunId: string | null; lotNumber?: string };
      contractId: string;
      containerId: string;
      containerProductId?: string;
      productId: string;
      qtyKg: number;
      userId: string;
    },
  ) {
    await tx.containerAllocation.create({
      data: {
        productionRunId: args.lot.productionRunId,
        processedLotId: args.lot.id,
        contractId: args.contractId,
        containerId: args.containerId,
        containerProductId: args.containerProductId,
        productId: args.productId,
        quantityKg: args.qtyKg,
        allocatedById: args.userId,
      },
    });
    await tx.processedOutputLot.update({
      where: { id: args.lot.id },
      data: { availableKg: { decrement: args.qtyKg }, reservedKg: { increment: args.qtyKg } },
    });
    await this.ledger.postTxn(tx, {
      txnType: LedgerTxnType.CONTAINER_ALLOCATION,
      productId: args.productId,
      stockCategory: StockCategory.PROCESSED_AVAILABLE,
      locationId: args.lot.plantId,
      fromCategory: StockCategory.PROCESSED_AVAILABLE,
      toCategory: StockCategory.PROCESSED_RESERVED,
      quantityOutKg: args.qtyKg,
      quantityInKg: args.qtyKg,
      referenceType: 'ALLOCATION',
      referenceId: args.lot.id,
      createdById: args.userId,
    });
  }

  /** Authoritative available processed qty by product/location (lots). */
  async getProcessedStockForFulfilment(productId?: string, locationId?: string) {
    const lots = await this.prisma.processedOutputLot.findMany({
      where: {
        availableKg: { gt: 0.001 },
        status: 'AVAILABLE',
        ...(productId ? { productId } : {}),
        ...(locationId ? { plantId: locationId } : {}),
      },
      include: {
        product: true,
        plant: true,
        productionRun: { select: { productionNumber: true, processType: true } },
      },
      orderBy: { completionDate: 'asc' },
    });
    const byLocation = new Map<string, { locationId: string; locationName: string; availableKg: number }>();
    let totalAvailableKg = 0;
    for (const lot of lots) {
      totalAvailableKg += lot.availableKg;
      const cur = byLocation.get(lot.plantId) || {
        locationId: lot.plantId,
        locationName: lot.plant?.name || lot.plantId,
        availableKg: 0,
      };
      cur.availableKg += lot.availableKg;
      byLocation.set(lot.plantId, cur);
    }
    return {
      productId,
      totalAvailableKg: Math.round(totalAvailableKg * 1000) / 1000,
      byLocation: [...byLocation.values()].map((x) => ({
        ...x,
        availableKg: Math.round(x.availableKg * 1000) / 1000,
      })),
      lots: lots.map((l) => ({
        id: l.id,
        lotNumber: l.lotNumber,
        availableKg: l.availableKg,
        quantityKg: l.quantityKg,
        reservedKg: l.reservedKg,
        plantId: l.plantId,
        plant: l.plant,
        product: l.product,
        productionNumber: l.productionRun?.productionNumber,
        completionDate: l.completionDate,
        productionSource: l.productionSource,
      })),
    };
  }

  async getMatchingContainersForProduct(productId: string) {
    const pending = await this.getPendingContracts();
    const matched: any[] = [];
    for (const c of pending) {
      for (const ct of c.containers || []) {
        const lines = (ct.productLines || []).filter((p: any) => p.productId === productId && p.pendingKg > 0.001);
        if (!lines.length) continue;
        matched.push({
          contractId: c.id,
          contractNumber: c.contractNumber,
          buyer: c.buyer,
          country: c.buyer?.country || c.destinationCountry,
          euClassification: c.euClassification,
          containerId: ct.id,
          containerIndex: ct.containerIndex,
          expectedShipmentDate: ct.expectedShipmentDate,
          productLines: lines.map((l: any) => ({
            id: l.id,
            productId: l.productId,
            productName: l.productName,
            requiredKg: l.requiredKg,
            fulfilledKg: l.fulfilledKg,
            pendingKg: l.pendingKg,
          })),
        });
      }
    }
    return matched;
  }

  async allocateFulfilmentFifo(dto: FulfilmentAllocateDto, user: JwtPayload) {
    const qtyKg = dto.quantityKg;
    if (qtyKg <= 0) throw new BadRequestException('Quantity must be positive');

    const stock = await this.getProcessedStockForFulfilment(dto.productId, dto.locationId);
    if (stock.totalAvailableKg < qtyKg - 0.001) {
      throw new BadRequestException(`Only ${stock.totalAvailableKg} KG is available`);
    }

    const matching = await this.getMatchingContainersForProduct(dto.productId);
    const target = matching.find(
      (m) =>
        m.contractId === dto.contractId &&
        m.containerId === dto.containerId &&
        (!dto.containerProductId || m.productLines.some((l: any) => l.id === dto.containerProductId)),
    );
    if (!target) throw new BadRequestException('No matching container requirement for this product');
    const line = dto.containerProductId
      ? target.productLines.find((l: any) => l.id === dto.containerProductId)
      : target.productLines[0];
    if (!line || line.productId !== dto.productId) throw new BadRequestException('Product mismatch');
    if (qtyKg > line.pendingKg + 0.001) {
      throw new BadRequestException(`Cannot allocate above pending quantity (${line.pendingKg} KG)`);
    }

    const lots = await this.prisma.processedOutputLot.findMany({
      where: {
        productId: dto.productId,
        plantId: dto.locationId,
        availableKg: { gt: 0.001 },
        status: 'AVAILABLE',
      },
      orderBy: { completionDate: 'asc' },
    });

    let remaining = qtyKg;
    const consumed: { lotId: string; lotNumber: string; quantityKg: number }[] = [];

    await this.tx(async (tx) => {
      for (const lot of lots) {
        if (remaining <= 0.001) break;
        const take = Math.min(lot.availableKg, remaining);
        await this.applyLotAllocation(tx, {
          lot,
          contractId: dto.contractId,
          containerId: dto.containerId,
          containerProductId: dto.containerProductId || line.id,
          productId: dto.productId,
          qtyKg: take,
          userId: user.sub,
        });
        consumed.push({ lotId: lot.id, lotNumber: lot.lotNumber, quantityKg: take });
        remaining = Math.round((remaining - take) * 1000) / 1000;
      }
      if (remaining > 0.001) {
        throw new BadRequestException(`Only ${qtyKg - remaining} KG could be allocated`);
      }
      await this.refreshContainerStatus(tx, dto.contractId, dto.containerId, user.sub);
    });

    await this.audit.log({
      module: 'FULFILMENT',
      recordType: 'ContainerAllocation',
      recordNumber: target.contractNumber,
      action: 'FIFO_ALLOCATED',
      changedById: user.sub,
      newValue: JSON.stringify({ quantityKg: qtyKg, consumed }),
    });

    await this.notifications.notifyChange({
      type: 'CONTAINER_FULFILMENT',
      message: `Container ${target.containerIndex} on ${target.contractNumber} fulfilled ${qtyKg} KG`,
      contractId: dto.contractId,
      containerId: dto.containerId,
      changedById: user.sub,
      targetRoles: [
        UserRole.SUPER_ADMIN,
        UserRole.OFFICE_ADMIN,
        UserRole.PRODUCTION_TEAM,
        UserRole.SUPER_SALES,
        UserRole.CONTRACT_TEAM,
      ],
    });

    return { ok: true, allocatedKg: qtyKg, consumedLots: consumed };
  }

  listProcessedLots() {
    return this.prisma.processedOutputLot.findMany({
      where: { availableKg: { gt: 0 }, status: 'AVAILABLE' },
      include: { product: true, plant: true, productionRun: { select: { productionNumber: true, processType: true } } },
      orderBy: { completionDate: 'asc' },
    });
  }

  listWastageLots(filters?: { productId?: string; locationId?: string }) {
    return this.prisma.wastageLot.findMany({
      where: {
        availableKg: { gt: 0.001 },
        status: { in: [WastageLotStatus.AVAILABLE, WastageLotStatus.PARTIALLY_REPROCESSED] },
        ...(filters?.productId ? { productId: filters.productId } : {}),
        ...(filters?.locationId ? { locationId: filters.locationId } : {}),
      },
      include: {
        product: true,
        wastageType: true,
        location: true,
        productionRun: { select: { productionNumber: true } },
        jobWork: { select: { jobWorkNumber: true } },
      },
      orderBy: { productionDate: 'asc' },
    });
  }

  async discardWastageLot(id: string, user: JwtPayload, reason?: string) {
    const lot = await this.prisma.wastageLot.findUnique({ where: { id } });
    if (!lot) throw new NotFoundException('Wastage lot not found');
    if (lot.availableKg <= 0.001) throw new BadRequestException('No available quantity');
    const qty = lot.availableKg;
    await this.tx(async (tx) => {
      await tx.wastageLot.update({
        where: { id },
        data: {
          availableKg: 0,
          discardedKg: { increment: qty },
          status: WastageLotStatus.DISCARDED,
        },
      });
      await this.ledger.postTxn(tx, {
        txnType: LedgerTxnType.WASTAGE_DISCARD,
        productId: lot.productId,
        stockCategory: StockCategory.WASTAGE_INVENTORY,
        sourceLocationId: lot.locationId,
        quantityOutKg: qty,
        referenceType: 'WASTAGE_LOT',
        referenceId: id,
        remarks: reason || 'Discarded from wastage inventory',
        createdById: user.sub,
      });
    });
    await this.audit.log({
      module: 'WASTAGE',
      recordType: 'WastageLot',
      recordNumber: lot.lotNumber,
      action: 'DISCARDED',
      changedById: user.sub,
      reason,
      newValue: String(qty),
    });
    return { ok: true };
  }

  async getInventoryByProduct(locationId?: string) {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        quantityKg: { gt: 0 },
        ...(locationId ? { locationId } : {}),
        stockCategory: {
          notIn: [StockCategory.PROCESSED_RESERVED], // avoid double-count with PROCESSED_AVAILABLE
        },
      },
      include: { product: true, location: true },
    });
    const byProduct = new Map<
      string,
      {
        productId: string;
        productCode: string;
        productName: string;
        totalKg: number;
        rawKg: number;
        wipKg: number;
        processedKg: number;
        wastageKg: number;
        rejectedKg: number;
        transitKg: number;
      }
    >();

    for (const b of balances) {
      // Skip Material with Job Worker from physical totals (tracked operationally)
      if (b.stockCategory === StockCategory.MATERIAL_WITH_JOB_WORKER) continue;
      const row = byProduct.get(b.productId) || {
        productId: b.productId,
        productCode: b.product.code,
        productName: b.product.name,
        totalKg: 0,
        rawKg: 0,
        wipKg: 0,
        processedKg: 0,
        wastageKg: 0,
        rejectedKg: 0,
        transitKg: 0,
      };
      const q = b.quantityKg;
      if (b.stockCategory === StockCategory.RAW_MATERIAL) row.rawKg += q;
      else if (
        b.stockCategory === StockCategory.WIP_CLEANING ||
        b.stockCategory === StockCategory.WIP_HULLING
      )
        row.wipKg += q;
      else if (b.stockCategory === StockCategory.PROCESSED_AVAILABLE) {
        // Processed available is overwritten from lots below (same formula as fulfilment).
      }
      else if (
        b.stockCategory === StockCategory.WASTAGE_INVENTORY ||
        b.stockCategory === StockCategory.WASTAGE_BY_PRODUCT
      )
        row.wastageKg += q;
      else if (b.stockCategory === StockCategory.SAMPLE_REJECTED) row.rejectedKg += q;
      else if (b.stockCategory === StockCategory.STOCK_IN_TRANSIT) row.transitKg += q;
      else continue;
      row.totalKg = row.rawKg + row.wipKg + row.processedKg + row.wastageKg + row.rejectedKg + row.transitKg;
      byProduct.set(b.productId, row);
    }

    const lotAvail = await this.prisma.processedOutputLot.groupBy({
      by: ['productId'],
      where: {
        availableKg: { gt: 0.001 },
        status: 'AVAILABLE',
        ...(locationId ? { plantId: locationId } : {}),
      },
      _sum: { availableKg: true },
    });
    for (const lot of lotAvail) {
      const kg = lot._sum.availableKg || 0;
      const row = byProduct.get(lot.productId);
      if (!row) {
        const product = await this.prisma.product.findUnique({ where: { id: lot.productId } });
        if (!product) continue;
        byProduct.set(lot.productId, {
          productId: lot.productId,
          productCode: product.code,
          productName: product.name,
          totalKg: kg,
          rawKg: 0,
          wipKg: 0,
          processedKg: kg,
          wastageKg: 0,
          rejectedKg: 0,
          transitKg: 0,
        });
      } else {
        row.processedKg = kg;
        row.totalKg = row.rawKg + row.wipKg + row.processedKg + row.wastageKg + row.rejectedKg + row.transitKg;
      }
    }

    return [...byProduct.values()]
      .map((r) => ({
        ...r,
        totalKg: Math.round(r.totalKg * 1000) / 1000,
        rawKg: Math.round(r.rawKg * 1000) / 1000,
        wipKg: Math.round(r.wipKg * 1000) / 1000,
        processedKg: Math.round(r.processedKg * 1000) / 1000,
        wastageKg: Math.round(r.wastageKg * 1000) / 1000,
        rejectedKg: Math.round(r.rejectedKg * 1000) / 1000,
        transitKg: Math.round(r.transitKg * 1000) / 1000,
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }

  async getInventoryProductDetail(productId: string, locationId?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        productId,
        ...(locationId ? { locationId } : {}),
        stockCategory: { notIn: [StockCategory.PROCESSED_RESERVED, StockCategory.MATERIAL_WITH_JOB_WORKER] },
      },
      include: { location: true },
    });
    const locations = await this.prisma.inventoryLocation.findMany({ where: { isActive: true } });
    const byLoc = locations.map((loc) => {
      const rows = balances.filter((b) => b.locationId === loc.id);
      const raw = rows.filter((r) => r.stockCategory === StockCategory.RAW_MATERIAL).reduce((s, r) => s + r.quantityKg, 0);
      const wip = rows
        .filter((r) => r.stockCategory === StockCategory.WIP_CLEANING || r.stockCategory === StockCategory.WIP_HULLING)
        .reduce((s, r) => s + r.quantityKg, 0);
      const processed = rows
        .filter((r) => r.stockCategory === StockCategory.PROCESSED_AVAILABLE)
        .reduce((s, r) => s + r.quantityKg, 0);
      const wastage = rows
        .filter(
          (r) =>
            r.stockCategory === StockCategory.WASTAGE_INVENTORY ||
            r.stockCategory === StockCategory.WASTAGE_BY_PRODUCT,
        )
        .reduce((s, r) => s + r.quantityKg, 0);
      const rejected = rows
        .filter((r) => r.stockCategory === StockCategory.SAMPLE_REJECTED)
        .reduce((s, r) => s + r.quantityKg, 0);
      return {
        locationId: loc.id,
        locationName: loc.name,
        rawKg: raw,
        wipKg: wip,
        processedKg: processed,
        wastageKg: wastage,
        rejectedKg: rejected,
        totalKg: raw + wip + processed + wastage + rejected,
      };
    }).filter((r) => r.totalKg > 0.001 || locationId);

    const lotAvail = await this.prisma.processedOutputLot.groupBy({
      by: ['plantId'],
      where: {
        productId,
        availableKg: { gt: 0.001 },
        status: 'AVAILABLE',
        ...(locationId ? { plantId: locationId } : {}),
      },
      _sum: { availableKg: true },
    });
    const lotByPlant = new Map(lotAvail.map((l) => [l.plantId, l._sum.availableKg || 0]));
    for (const loc of byLoc) {
      loc.processedKg = lotByPlant.get(loc.locationId) || 0;
      loc.totalKg = loc.rawKg + loc.wipKg + loc.processedKg + loc.wastageKg + loc.rejectedKg;
    }
    const locIds = new Set(byLoc.map((l) => l.locationId));
    for (const loc of locations) {
      if (locIds.has(loc.id)) continue;
      const kg = lotByPlant.get(loc.id) || 0;
      if (kg < 0.001) continue;
      byLoc.push({
        locationId: loc.id,
        locationName: loc.name,
        rawKg: 0,
        wipKg: 0,
        processedKg: kg,
        wastageKg: 0,
        rejectedKg: 0,
        totalKg: kg,
      });
    }

    const wastageLots = await this.prisma.wastageLot.findMany({
      where: {
        productId,
        availableKg: { gt: 0 },
        ...(locationId ? { locationId } : {}),
      },
      include: { wastageType: true },
    });
    const wastageByType: Record<string, number> = {};
    for (const wl of wastageLots) {
      const key = wl.wastageType?.nameEn || wl.wastageTypeId;
      wastageByType[key] = (wastageByType[key] || 0) + wl.availableKg;
    }

    const ledger = await this.prisma.inventoryLedgerEntry.findMany({
      where: {
        productId,
        ...(locationId
          ? {
              OR: [{ sourceLocationId: locationId }, { destLocationId: locationId }],
            }
          : {}),
      },
      include: {
        sourceLocation: true,
        destLocation: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      product,
      locations: byLoc,
      wastageByType,
      ledger,
    };
  }

  // ── Sampling ─────────────────────────────────────────────
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

  async updateSample(id: string, dto: SampleResultDto, user: JwtPayload) {
    const sample = await this.prisma.sampleRecord.findUnique({ where: { id } });
    if (!sample) throw new NotFoundException('Sample not found');

    const result = (dto.result || dto.status || '').toUpperCase();
    const passed = result === 'PASSED' || dto.status === SamplingStatus.PASSED;
    const failed = result === 'FAILED' || dto.status === SamplingStatus.FAILED;

    await this.tx(async (tx) => {
      await tx.sampleRecord.update({
        where: { id },
        data: {
          status: passed ? SamplingStatus.PASSED : failed ? SamplingStatus.FAILED : dto.status,
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
        const allPassed = siblings.every((s) =>
          s.id === id ? true : s.status === SamplingStatus.PASSED,
        );
        if (allPassed) {
          const container = await tx.contractContainer.findUnique({ where: { id: sample.containerId } });
          await tx.contractContainer.update({
            where: { id: sample.containerId },
            data: { containerStatus: ContainerStatus.READY_FOR_DISPATCH },
          });
          await tx.containerStatusHistory.create({
            data: {
              containerId: sample.containerId,
              contractId: sample.contractId,
              fromStatus: container?.containerStatus,
              toStatus: ContainerStatus.READY_FOR_DISPATCH,
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
        const plantId =
          (await tx.contractContainer.findUnique({ where: { id: sample.containerId } }))?.productionUnitId ||
          (await tx.productionRun.findFirst({ where: { id: sample.productionRunId || undefined } }))?.plantId;

        const loc =
          plantId ||
          (await tx.inventoryLocation.findFirst({ where: { isActive: true } }))?.id;
        if (!loc) throw new BadRequestException('No plant location for rejected stock');

        const lotNumber = await this.nextNumber('REJ', 'rejected');
        // nextNumber uses prisma root — call outside or inline
        const year = new Date().getFullYear();
        const prefix = `REJ-${year}-`;
        const latest = await tx.sampleRejectedLot.findFirst({
          where: { lotNumber: { startsWith: prefix } },
          orderBy: { lotNumber: 'desc' },
        });
        let next = 1;
        if (latest) {
          const n = parseInt(latest.lotNumber.split('-').pop() || '0', 10);
          if (!isNaN(n)) next = n + 1;
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
            status: RejectedStockStatus.AVAILABLE_FOR_SORTEX,
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
            txnType: LedgerTxnType.SAMPLE_REJECTION,
            productId: sample.productId,
            stockCategory: StockCategory.PROCESSED_RESERVED,
            locationId: loc,
            fromCategory: StockCategory.PROCESSED_RESERVED,
            toCategory: StockCategory.SAMPLE_REJECTED,
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
          data: { containerStatus: ContainerStatus.SAMPLING_FAILED },
        });
        await tx.containerStatusHistory.create({
          data: {
            containerId: sample.containerId,
            contractId: sample.contractId,
            fromStatus: container?.containerStatus,
            toStatus: ContainerStatus.SAMPLING_FAILED,
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
      oldValue: sample.status,
      newValue: passed ? 'PASSED' : failed ? 'FAILED' : dto.status || sample.status,
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
        UserRole.SUPER_ADMIN,
        UserRole.OFFICE_ADMIN,
        UserRole.PRODUCTION_TEAM,
        UserRole.SUPER_SALES,
        UserRole.CONTRACT_TEAM,
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

  // ── Plant transfer ───────────────────────────────────────
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

  async createTransfer(dto: CreateTransferDto, user: JwtPayload) {
    if (dto.sourceLocationId === dto.destLocationId) {
      throw new BadRequestException('Source and destination must differ');
    }
    const qtyKg = toKg(dto.quantity, dto.unit);
    if (dto.stockCategory === StockCategory.PROCESSED_RESERVED) {
      throw new BadRequestException('Cannot transfer reserved container stock');
    }
    const avail = await this.ledger.getAvailableKg(dto.productId, dto.sourceLocationId, dto.stockCategory);
    if (dto.rejectedLotId) {
      const lot = await this.prisma.sampleRejectedLot.findUnique({ where: { id: dto.rejectedLotId } });
      if (!lot || lot.availableKg < qtyKg - 0.001) throw new BadRequestException('Insufficient rejected stock');
    } else if (avail < qtyKg - 0.001 && !dto.processedLotId) {
      throw new BadRequestException(`Insufficient stock. Available: ${avail} kg`);
    }
    if (dto.processedLotId) {
      const lot = await this.prisma.processedOutputLot.findUnique({ where: { id: dto.processedLotId } });
      if (!lot || lot.availableKg < qtyKg - 0.001) throw new BadRequestException('Insufficient processed lot');
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
        status: TransferStatus.DRAFT,
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

  async dispatchTransfer(id: string, user: JwtPayload) {
    const t = await this.prisma.plantTransfer.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Transfer not found');
    if (![TransferStatus.DRAFT, TransferStatus.APPROVED].includes(t.status as any)) {
      throw new BadRequestException('Transfer cannot be dispatched');
    }

    await this.tx(async (tx) => {
      if (t.rejectedLotId) {
        await tx.sampleRejectedLot.update({
          where: { id: t.rejectedLotId },
          data: { availableKg: { decrement: t.quantityKg }, transferredKg: { increment: t.quantityKg }, status: RejectedStockStatus.TRANSFERRED },
        });
      }
      if (t.processedLotId) {
        await tx.processedOutputLot.update({
          where: { id: t.processedLotId },
          data: { availableKg: { decrement: t.quantityKg } },
        });
      }
      await this.ledger.postTxn(tx, {
        txnType: LedgerTxnType.PLANT_TRANSFER_OUT,
        productId: t.productId,
        stockCategory: t.stockCategory,
        sourceLocationId: t.sourceLocationId,
        destLocationId: t.destLocationId,
        quantityOutKg: t.quantityKg,
        referenceType: 'TRANSFER',
        referenceId: t.id,
        createdById: user.sub,
      });
      // move to in-transit category at conceptual level
      await this.ledger.postTxn(tx, {
        txnType: LedgerTxnType.PLANT_TRANSFER_OUT,
        productId: t.productId,
        stockCategory: StockCategory.STOCK_IN_TRANSIT,
        destLocationId: t.destLocationId,
        quantityInKg: t.quantityKg,
        referenceType: 'TRANSFER',
        referenceId: t.id,
        createdById: user.sub,
      });
      await tx.plantTransfer.update({
        where: { id },
        data: { status: TransferStatus.IN_TRANSIT, dispatchDate: new Date() },
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

  async receiveTransfer(id: string, user: JwtPayload) {
    const t = await this.prisma.plantTransfer.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Transfer not found');
    if (t.status !== TransferStatus.IN_TRANSIT && t.status !== TransferStatus.DISPATCHED) {
      throw new BadRequestException('Transfer is not in transit');
    }
    if (t.receivedDate) throw new BadRequestException('Transfer already received');

    await this.tx(async (tx) => {
      // reduce in-transit
      await this.ledger.postTxn(tx, {
        txnType: LedgerTxnType.PLANT_TRANSFER_IN,
        productId: t.productId,
        stockCategory: StockCategory.STOCK_IN_TRANSIT,
        sourceLocationId: t.destLocationId,
        quantityOutKg: t.quantityKg,
        referenceType: 'TRANSFER',
        referenceId: t.id,
        createdById: user.sub,
      });
      const destCategory =
        t.stockCategory === StockCategory.SAMPLE_REJECTED
          ? StockCategory.SAMPLE_REJECTED
          : t.stockCategory;
      await this.ledger.postTxn(tx, {
        txnType: LedgerTxnType.PLANT_TRANSFER_IN,
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
            status: RejectedStockStatus.AVAILABLE_FOR_SORTEX,
          },
        });
      }

      await tx.plantTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.RECEIVED,
          receivedDate: new Date(),
          receivedById: user.sub,
        },
      });

      // PDF §26: destination linked inward for raw-material transfers
      if (t.stockCategory === StockCategory.RAW_MATERIAL) {
        const type =
          (await tx.inwardType.findFirst({ where: { code: 'DOMESTIC', isActive: true } })) ||
          (await tx.inwardType.findFirst({ where: { isActive: true } }));
        const supplier =
          (await tx.supplier.findFirst({ where: { isActive: true } })) ||
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
            if (!isNaN(n)) next = n + 1;
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

  // ── Dashboard ────────────────────────────────────────────
  async getOwnerDashboard() {
    const balances = await this.prisma.inventoryBalance.findMany({
      where: { quantityKg: { gt: 0 } },
      include: { product: true, location: true },
    });
    const byCategory: Record<string, number> = {};
    const byLocation: Record<string, number> = {};
    const rawByProduct: Record<string, { name: string; total: number; locations: Record<string, number> }> = {};
    for (const b of balances) {
      byCategory[b.stockCategory] = (byCategory[b.stockCategory] || 0) + b.quantityKg;
      byLocation[b.location.name] = (byLocation[b.location.name] || 0) + b.quantityKg;
      if (b.stockCategory === StockCategory.RAW_MATERIAL) {
        const key = b.productId;
        if (!rawByProduct[key]) rawByProduct[key] = { name: b.product.name, total: 0, locations: {} };
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

    // Lightweight pending urgency counts (avoid full getPendingContracts on dashboard)
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
    const pendingItems: any[] = [];

    for (const ct of openContainers) {
      const requiredKg =
        (ct.products?.length
          ? ct.products.reduce((s, p) => s + (p.quantityMt || 0) * 1000, 0)
          : (ct.quantityMt || 0) * 1000) || 0;
      const fulfilled = fulfilledByContainer.get(ct.id) || 0;
      if (requiredKg - fulfilled <= 0.001) continue;

      const due = ct.expectedShipmentDate ? new Date(ct.expectedShipmentDate) : null;
      let urgency = 'WHITE';
      if (due && due < today) {
        urgency = 'RED';
        overdue += 1;
      } else if (due && due <= in7) {
        urgency = 'YELLOW';
        dueSoon += 1;
      } else {
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
      where: { status: { notIn: [ProductionRunStatus.COMPLETED, ProductionRunStatus.CANCELLED] } },
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

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const processedBySource = await this.prisma.processedOutputLot.groupBy({
      by: ['productionSource'],
      where: { completionDate: { gte: startOfMonth } },
      _sum: { quantityKg: true },
    });
    const wastageLotsAvail = await this.prisma.wastageLot.aggregate({
      where: { availableKg: { gt: 0 } },
      _sum: { availableKg: true },
    });
    const wastageByType = await this.prisma.wastageLot.groupBy({
      by: ['wastageTypeId'],
      where: { availableKg: { gt: 0 } },
      _sum: { availableKg: true },
    });
    const types = await this.prisma.wastageType.findMany({
      where: { id: { in: wastageByType.map((w) => w.wastageTypeId) } },
    });
    const typeMap = new Map(types.map((t) => [t.id, t.nameEn]));
    const samplingReady = await this.prisma.sampleRecord.count({
      where: { status: SamplingStatus.READY_FOR_SAMPLING },
    });
    const processedLotsAvail = await this.prisma.processedOutputLot.aggregate({
      where: { availableKg: { gt: 0.001 }, status: 'AVAILABLE' },
      _sum: { availableKg: true },
    });
    const processedAvailableKg = processedLotsAvail._sum.availableKg || 0;

    return {
      inventory: {
        byCategory,
        byLocation,
        rawByProduct: Object.values(rawByProduct),
        totalRaw: byCategory[StockCategory.RAW_MATERIAL] || 0,
        totalProcessed: processedAvailableKg,
        totalWip:
          (byCategory[StockCategory.WIP_CLEANING] || 0) + (byCategory[StockCategory.WIP_HULLING] || 0),
        totalRejected: byCategory[StockCategory.SAMPLE_REJECTED] || 0,
        totalInTransit: byCategory[StockCategory.STOCK_IN_TRANSIT] || 0,
        totalWastageInventory:
          (byCategory[StockCategory.WASTAGE_INVENTORY] || 0) +
          (byCategory[StockCategory.WASTAGE_BY_PRODUCT] || 0) ||
          wastageLotsAvail._sum.availableKg ||
          0,
        processedAvailableForFulfilment: processedAvailableKg,
      },
      wastageAlerts,
      wastageInventory: {
        totalAvailableKg: wastageLotsAvail._sum.availableKg || 0,
        byType: wastageByType.map((w) => ({
          wastageTypeId: w.wastageTypeId,
          name: typeMap.get(w.wastageTypeId) || w.wastageTypeId,
          availableKg: w._sum.availableKg || 0,
        })),
      },
      productionSourceThisMonth: processedBySource.map((p) => ({
        source: p.productionSource,
        quantityKg: p._sum.quantityKg || 0,
      })),
      sampling: sampling.map((s) => ({ status: s.status, count: s._count._all })),
      samplingRequiredCount: samplingReady,
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

  listAudit(query: { module?: string; recordNumber?: string }) {
    return this.audit.list(query);
  }
}
