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
  toKg,
} from '../../common/constants/production.constants';
import { NotificationService } from '../../common/services/notification.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { ProductionAuditService } from './production-audit.service';
import { ContainerWorkflowService, COUNTED_ALLOCATION_STATUSES, type SyncResult } from '../container-workflow/container-workflow.service';
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
  MergeWastageDto,
  SampleResultDto,
  StartProductionDto,
  StoreProcessedDto,
  WastageOutwardDto,
} from './production.dto';

@Injectable()
export class ProductionService {
  constructor(
    private prisma: PrismaService,
    private ledger: InventoryLedgerService,
    private audit: ProductionAuditService,
    private notifications: NotificationService,
    private workflow: ContainerWorkflowService,
  ) {}

  /** Containers that just became fully fulfilled → UI prompts for container details (PDF §8.1). */
  private fulfilledSummary(results: (SyncResult | null)[]) {
    const seen = new Set<string>();
    return results
      .filter((r): r is SyncResult => !!r && r.becameFulfilled && !seen.has(r.containerId) && !!seen.add(r.containerId))
      .map((r) => ({
        contractId: r.contractId,
        contractNumber: r.contractNumber,
        containerId: r.containerId,
        containerIndex: r.containerIndex,
        requiredKg: r.state.fulfilment.requiredKg,
        fulfilledKg: r.state.fulfilment.fulfilledKg,
      }));
  }

  private static isNaturalSesame(p?: { code: string; name: string } | null) {
    return !!p && (p.code === 'NSS' || /natural\s+sesame/i.test(p.name));
  }

  private static isHulledSesame(p?: { code: string; name: string } | null) {
    return !!p && (p.code === 'HSS' || /^hulled\s+sesame/i.test(p.name));
  }

  /**
   * Where a run's good output goes (ERP Changes 22.11.26 §2):
   *  - Natural Sesame + Hulling+Sortex → Hulled Sesame, FINAL processed stock
   *  - Natural Sesame + Cleaning or Sortex only → stays Natural Sesame, Raw / Awaiting Factory Processing
   *  - Hulled Sesame + Sortex → Hulled Sesame FINAL;  + Cleaning only → Hulled Sesame, Awaiting (Sortex still required)
   *  - every other product: unchanged, FINAL processed stock
   * There is never a "Natural Sesame Seeds (Processed)" finished product.
   */
  private async classifyOutput(run: { productId: string; processType: string }) {
    const input = await this.prisma.product.findUnique({ where: { id: run.productId } });
    const hullingSortex = run.processType === ProcessType.HULLING_SORTEX || run.processType === ProcessType.FULL_PROCESS;
    if (ProductionService.isNaturalSesame(input)) {
      if (!hullingSortex) {
        return { productId: run.productId, category: StockCategory.RAW_MATERIAL, note: 'Natural Sesame awaiting Hulling + Sortex' };
      }
      const hss = await this.prisma.product.findFirst({
        where: { OR: [{ code: 'HSS' }, { name: { equals: 'Hulled Sesame Seeds', mode: 'insensitive' } }], isActive: true },
      });
      if (!hss) {
        throw new BadRequestException('Active product "Hulled Sesame Seeds" (code HSS) is required to finalise Hulling + Sortex output');
      }
      return { productId: hss.id, category: StockCategory.PROCESSED_AVAILABLE, note: 'Natural Sesame → Hulled Sesame (Hulling + Sortex)' };
    }
    if (ProductionService.isHulledSesame(input) && run.processType === ProcessType.CLEANING) {
      return { productId: run.productId, category: StockCategory.RAW_MATERIAL, note: 'Hulled Sesame awaiting Sortex' };
    }
    return { productId: run.productId, category: StockCategory.PROCESSED_AVAILABLE, note: null as string | null };
  }

  private async tx<T>(fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(fn, { maxWait: 20000, timeout: 60000 });
    } catch (err: any) {
      if (err?.code === 'P1017' || err?.message?.includes('closed the connection')) {
        return await this.prisma.$transaction(fn, { maxWait: 20000, timeout: 60000 });
      }
      throw err;
    }
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
    // Plant permissions check (§2)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: { office: true },
    });
    const userPlant = (user as any).plantCode || (user as any).plant || dbUser?.email || '';
    const isNedraUser = /nedra/i.test(userPlant) || /nedra/i.test(dbUser?.email || '');
    
    if (isNedraUser) {
      const nedraLoc = await this.prisma.inventoryLocation.findFirst({
        where: { code: 'NEDRA', isActive: true },
      });
      if (nedraLoc && dto.locationId !== nedraLoc.id) {
        throw new ForbiddenException('Nedra accounts cannot create inward entries at other locations.');
      }
    }

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
            packagingType: { select: { id: true, name: true } },
            packagingSize: { select: { id: true, label: true } },
          },
          orderBy: { containerIndex: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const allocs = await this.prisma.containerAllocation.findMany({
      where: { status: { in: COUNTED_ALLOCATION_STATUSES } },
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
          .filter(
            (ct) =>
              !['SHIPPED', 'COMPLETED', 'CANCELLED', 'DISPATCHED_FROM_FACTORY', 'REACHED_PORT', 'ON_HOLD'].includes(
                ct.containerStatus || '',
              ) && !ct.dispatchedAt,
          )
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
              packagingType: ct.packagingType?.name || null,
              packagingSize: ct.packagingSize?.label || null,
              packingDescription: ct.packingDescription || null,
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
  listRuns(includeDeleted = false) {
    return this.prisma.productionRun.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
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
    const isHullingSortex = dto.processType === ProcessType.HULLING_SORTEX || dto.processType === ProcessType.FULL_PROCESS;
    const isSortexOnly = dto.processType === ProcessType.SORTEX;
    const isCleaningOnly = dto.processType === ProcessType.CLEANING;

    if (
      isHullingSortex &&
      (dto.stockCategory === InputStockCategory.SAMPLE_REJECTED_STOCK ||
        dto.stockCategory === InputStockCategory.WASTAGE_INVENTORY)
    ) {
      throw new BadRequestException('Sample-rejected / wastage stock can only be used in Sortex');
    }
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product?.isActive) throw new BadRequestException('Product not found or inactive');

    // Section 5.3 & 20.E: Hulling + Sortex must only be available for Natural Sesame Seeds.
    if (isHullingSortex) {
      const isNaturalSesame = product.code === 'NSS' || /natural\s+sesame/i.test(product.name);
      if (!isNaturalSesame) {
        throw new BadRequestException(
          'Hulling + Sortex process is only permitted for Natural Sesame Seeds.',
        );
      }
    }
    if (isSortexOnly && product.allowsSortex === false) {
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

  /**
   * Back to Stage 1 (ERP Changes 22.11.26 §5.3): correct Stage 1 any time before the
   * production is finalised. Previous Stage 1 and Stage 2 entries are KEPT (as pre-filled
   * values); WIP moves back to cleaning; Stage 2 must be re-confirmed against the new
   * Stage 1 output. Finalised production cannot be reopened (posted stock never changes silently).
   */
  async reopenCleaning(runId: string, user: JwtPayload, reason?: string) {
    const run = await this.getRun(runId);
    if (run.deletedAt) throw new BadRequestException('This production run has been deleted');
    if (run.finalisedAt || run.status === ProductionRunStatus.COMPLETED || run.status === ProductionRunStatus.CANCELLED) {
      throw new BadRequestException('Finalised production cannot return to Stage 1. Use an authorised correction.');
    }
    if (!run.cleaningFinalizedAt) throw new BadRequestException('Stage 1 is not confirmed yet, so it is already editable');
    const hullingQty = run.processType === ProcessType.CLEANING ? 0 : run.hullingInputKg || 0;
    const previous = {
      stage1OutputKg: run.processType === ProcessType.CLEANING ? run.netOutputKg : run.hullingInputKg,
      cleaningWastageKg: run.cleaningWastageKg,
      stage2Confirmed: !!run.hullingFinalizedAt,
      stage2OutputKg: run.hullingFinalizedAt ? run.netOutputKg : null,
    };
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
          remarks: `Back to Stage 1: ${reason || 'Stage 1 correction'}`,
          createdById: user.sub,
        });
      }
      // Entries are intentionally NOT deleted: the UI pre-fills them for correction.
      await tx.productionRun.update({
        where: { id: runId },
        data: {
          cleaningFinalizedAt: null,
          hullingFinalizedAt: null,
          wastageAlert: false,
          status: ProductionRunStatus.CLEANING_IN_PROGRESS,
        },
      });
    });
    await this.audit.log({
      module: 'PRODUCTION',
      recordType: 'ProductionRun',
      recordNumber: run.productionNumber,
      action: 'BACK_TO_STAGE_1',
      changedById: user.sub,
      oldValue: JSON.stringify(previous),
      reason: reason || undefined,
    });
    return this.getRun(runId);
  }

  /** Who may delete production runs: Owner (SUPER_ADMIN) or users explicitly granted it (PDF §4.1). */
  private async canDeleteProduction(user: JwtPayload) {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    const u = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { canDeleteProduction: true, isActive: true } });
    return !!u?.isActive && !!u.canDeleteProduction;
  }

  /**
   * Soft-delete a production run with safe stock reversal (PDF §4.2).
   * - Not finalised: all WIP returns to the exact sources it was issued from.
   * - Finalised: allowed only while its output and wastage lots are untouched (no allocation,
   *   transfer, reuse, sampling, merge or outward); output + wastage are reversed and the
   *   inputs restored, so inventory ends exactly as before the run.
   * The run row, entries and audit history are preserved and marked deleted.
   */
  async deleteRun(runId: string, reason: string, user: JwtPayload) {
    if (!(await this.canDeleteProduction(user))) {
      throw new ForbiddenException('You are not authorised to delete production records');
    }
    if (!reason?.trim()) throw new BadRequestException('A reason is required to delete a production record');
    const run = await this.prisma.productionRun.findUnique({
      where: { id: runId },
      include: { inputs: true, outputLots: true, wastageLots: true, allocations: true },
    });
    if (!run) throw new NotFoundException('Production run not found');
    if (run.deletedAt) throw new BadRequestException('Production run is already deleted');

    const finalised = !!run.finalisedAt || run.status === ProductionRunStatus.COMPLETED;
    const blockers: string[] = [];
    if (run.allocations.length) blockers.push(`${run.allocations.length} container allocation(s) reference this run`);
    if (finalised) {
      for (const lot of run.outputLots) {
        if (Math.abs(lot.availableKg - lot.quantityKg) > 0.001 || (lot.reservedKg || 0) > 0.001 || lot.status !== 'AVAILABLE') {
          blockers.push(`output lot ${lot.lotNumber} has already been used (available ${lot.availableKg} of ${lot.quantityKg} KG)`);
        }
      }
      const lotIds = run.outputLots.map((l) => l.id);
      if (lotIds.length) {
        const [transfers, reuse, samples] = await Promise.all([
          this.prisma.plantTransfer.count({ where: { processedLotId: { in: lotIds } } }),
          this.prisma.productionInput.count({ where: { processedLotId: { in: lotIds } } }),
          this.prisma.sampleRecord.count({ where: { OR: [{ processedLotId: { in: lotIds } }, { productionRunId: runId }] } }),
        ]);
        if (transfers) blockers.push('output was transferred to another plant');
        if (reuse) blockers.push('output was used as input to another production run');
        if (samples) blockers.push('output is linked to sampling records');
      }
      for (const wl of run.wastageLots) {
        const untouched =
          Math.abs(wl.availableKg - wl.quantityKg) <= 0.001 &&
          (wl.reprocessedKg || 0) <= 0.001 &&
          (wl.discardedKg || 0) <= 0.001 &&
          wl.status === WastageLotStatus.AVAILABLE;
        if (!untouched) blockers.push(`wastage lot ${wl.lotNumber} has been reprocessed, merged, discarded or sold`);
      }
      const childLots = await this.prisma.wastageLot.count({ where: { parentWastageLotId: { in: run.wastageLots.map((w) => w.id) } } });
      if (childLots) blockers.push('wastage lots from this run were merged into other lots');
    }
    if (blockers.length) {
      throw new BadRequestException(`This production cannot be deleted safely: ${blockers.join('; ')}.`);
    }

    await this.tx(async (tx) => {
      const ref = { referenceType: 'PRODUCTION_RUN', referenceId: runId, createdById: user.sub };
      const note = `Delete ${run.productionNumber}: ${reason.trim()}`;
      if (finalised) {
        // 1) remove the run's output from where finalisation put it
        const outputLots = run.outputLots.filter((l) => l.quantityKg > 0.001);
        for (const lot of outputLots) {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.TRANSACTION_REVERSAL,
            productId: lot.productId,
            stockCategory: StockCategory.PROCESSED_AVAILABLE,
            sourceLocationId: lot.plantId,
            quantityOutKg: lot.quantityKg,
            remarks: `${note} (output lot ${lot.lotNumber})`,
            ...ref,
          });
          await tx.processedOutputLot.update({ where: { id: lot.id }, data: { availableKg: 0, status: 'DELETED' } });
        }
        if (run.outputStockCategory === StockCategory.RAW_MATERIAL && (run.netOutputKg || 0) > 0.001) {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.TRANSACTION_REVERSAL,
            productId: run.productId,
            stockCategory: StockCategory.RAW_MATERIAL,
            sourceLocationId: run.plantId,
            quantityOutKg: run.netOutputKg,
            remarks: `${note} (output returned to awaiting stock)`,
            ...ref,
          });
        }
        // 2) remove stored wastage lots
        for (const wl of run.wastageLots) {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.TRANSACTION_REVERSAL,
            productId: wl.productId,
            stockCategory: StockCategory.WASTAGE_INVENTORY,
            sourceLocationId: wl.locationId,
            quantityOutKg: wl.quantityKg,
            remarks: `${note} (wastage lot ${wl.lotNumber})`,
            ...ref,
          });
          await tx.wastageLot.update({ where: { id: wl.id }, data: { availableKg: 0, status: WastageLotStatus.CLOSED } });
        }
      } else if (run.cleaningFinalizedAt && run.processType !== ProcessType.CLEANING && (run.hullingInputKg || 0) > 0.001) {
        // not finalised: bring Stage 2 WIP back to Stage 1 so all WIP sits in WIP_CLEANING
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.TRANSACTION_REVERSAL,
          productId: run.productId,
          stockCategory: StockCategory.WIP_HULLING,
          locationId: run.plantId,
          fromCategory: StockCategory.WIP_HULLING,
          toCategory: StockCategory.WIP_CLEANING,
          quantityOutKg: run.hullingInputKg,
          quantityInKg: run.hullingInputKg,
          remarks: note,
          ...ref,
        });
      }

      // 3) return every input to its exact source
      for (const input of run.inputs) {
        const qty = input.quantityKg;
        if (qty <= 0.001) continue;
        const sourceCategory = input.rejectedLotId
          ? StockCategory.SAMPLE_REJECTED
          : input.wastageLotId
            ? StockCategory.WASTAGE_INVENTORY
            : input.processedLotId
              ? StockCategory.PROCESSED_AVAILABLE
              : StockCategory.RAW_MATERIAL;
        if (finalised) {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.TRANSACTION_REVERSAL,
            productId: input.productId,
            stockCategory: sourceCategory,
            destLocationId: run.plantId,
            quantityInKg: qty,
            remarks: `${note} (input restored)`,
            ...ref,
          });
        } else {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.TRANSACTION_REVERSAL,
            productId: input.productId,
            stockCategory: StockCategory.WIP_CLEANING,
            locationId: run.plantId,
            fromCategory: StockCategory.WIP_CLEANING,
            toCategory: sourceCategory,
            quantityOutKg: qty,
            quantityInKg: qty,
            remarks: `${note} (input returned)`,
            ...ref,
          });
        }
        if (input.processedLotId) {
          await tx.processedOutputLot.update({ where: { id: input.processedLotId }, data: { availableKg: { increment: qty } } });
        } else if (input.rejectedLotId) {
          const lot = await tx.sampleRejectedLot.findUnique({ where: { id: input.rejectedLotId } });
          if (lot) {
            await tx.sampleRejectedLot.update({
              where: { id: lot.id },
              data: {
                availableKg: { increment: qty },
                reprocessedKg: Math.max(0, (lot.reprocessedKg || 0) - qty),
                status: RejectedStockStatus.AVAILABLE_FOR_SORTEX,
              },
            });
          }
        } else if (input.wastageLotId) {
          const wl = await tx.wastageLot.findUnique({ where: { id: input.wastageLotId } });
          if (wl) {
            const reprocessed = Math.max(0, (wl.reprocessedKg || 0) - qty);
            await tx.wastageLot.update({
              where: { id: wl.id },
              data: {
                availableKg: { increment: qty },
                reprocessedKg: reprocessed,
                status: reprocessed > 0.001 ? WastageLotStatus.PARTIALLY_REPROCESSED : WastageLotStatus.AVAILABLE,
              },
            });
          }
        }
      }

      await tx.productionRun.update({
        where: { id: runId },
        data: {
          deletedAt: new Date(),
          deletedById: user.sub,
          deleteReason: reason.trim(),
          status: ProductionRunStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById: user.sub,
          cancelReason: `Deleted: ${reason.trim()}`,
        },
      });
    });

    await this.audit.log({
      module: 'PRODUCTION',
      recordType: 'ProductionRun',
      recordNumber: run.productionNumber,
      action: 'DELETED',
      changedById: user.sub,
      oldValue: JSON.stringify({
        status: run.status,
        processType: run.processType,
        totalInputKg: run.totalInputKg,
        netOutputKg: run.netOutputKg,
        finalised,
      }),
      newValue: 'DELETED (soft)',
      reason: reason.trim(),
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

    // Section 6.2 & 6.3: Cleaned output is manually entered.
    // If not provided, fallback to (input - wastage) for backward compatibility
    let actualCleaned = dto.actualCleanedOutputKg != null
      ? Math.round(dto.actualCleanedOutputKg * 1000) / 1000
      : Math.round((run.totalInputKg - totalWastage) * 1000) / 1000;

    if (actualCleaned < 0) throw new BadRequestException('Actual cleaned output cannot be negative');
    if (actualCleaned > run.totalInputKg + 0.001) {
      throw new BadRequestException('Actual cleaned output cannot exceed input quantity without an adjustment workflow');
    }

    const isCleaningOnly = run.processType === ProcessType.CLEANING;
    const isSortexOrHulling = run.processType === ProcessType.SORTEX || run.processType === ProcessType.HULLING_SORTEX || run.processType === ProcessType.FULL_PROCESS;

    // Weight difference alert for Cleaning-only (threshold > 15%)
    let wastageAlert = false;
    if (isCleaningOnly && run.totalInputKg > 0) {
      const diffKg = run.totalInputKg - actualCleaned;
      const diffPct = (diffKg / run.totalInputKg) * 100;
      wastageAlert = diffPct > 15.0; // Section 8.1: Exactly 15% should NOT trigger
    }

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

      if (isCleaningOnly) {
        // Cleaning only: skips Stage 2, goes directly to AWAITING_FINALISATION
        await tx.productionRun.update({
          where: { id: runId },
          data: {
            cleaningWastageKg: totalWastage,
            hullingInputKg: 0,
            netOutputKg: actualCleaned,
            wastageAlert,
            cleaningFinalizedAt: new Date(),
            status: ProductionRunStatus.AWAITING_FINALISATION,
          },
        });
      } else {
        // Sortex or Hulling + Sortex: forwards actual cleaned output as Stage 2 input
        await tx.productionRun.update({
          where: { id: runId },
          data: {
            cleaningWastageKg: totalWastage,
            hullingInputKg: actualCleaned,
            cleaningFinalizedAt: new Date(),
            status: ProductionRunStatus.HULLING_IN_PROGRESS,
          },
        });
        if (actualCleaned > 0) {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.TRANSFER_TO_HULLING,
            productId: run.productId,
            stockCategory: StockCategory.WIP_CLEANING,
            locationId: run.plantId,
            fromCategory: StockCategory.WIP_CLEANING,
            toCategory: StockCategory.WIP_HULLING,
            quantityOutKg: actualCleaned,
            quantityInKg: actualCleaned,
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
      newValue: JSON.stringify({ totalWastage, actualCleaned, isCleaningOnly }),
    });

    return this.getRun(runId);
  }

  async submitHulling(runId: string, dto: HullingResultDto, user: JwtPayload) {
    const run = await this.getRun(runId);
    if (run.processType === ProcessType.CLEANING) {
      throw new BadRequestException('Cleaning-only runs do not have a Stage 2');
    }
    if (!run.cleaningFinalizedAt) throw new BadRequestException('Complete cleaning before stage 2');
    if (run.hullingFinalizedAt) throw new BadRequestException('Stage 2 already finalized');
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
      throw new BadRequestException('Stage 2 wastage cannot exceed stage 2 input');
    }

    // Section 7.3 & 8.3: Final output is manually entered
    const net = dto.actualProcessedOutputKg != null
      ? Math.round(dto.actualProcessedOutputKg * 1000) / 1000
      : Math.round((run.hullingInputKg - totalWastage) * 1000) / 1000;

    if (net < 0) throw new BadRequestException('Actual processed output cannot be negative');
    if (net > run.hullingInputKg + 0.001) {
      throw new BadRequestException('Actual processed output cannot exceed stage 2 input quantity');
    }

    // Section 8.1 & 8.3: Overall production alert threshold is 15%.
    // Overall Difference = Original Input - Final Stage 2 Output
    // Difference % = (Overall Difference / Original Input) * 100
    // If difference > 15%, flag alert. Exactly 15% should NOT trigger.
    let alert = false;
    let pct = 0;
    if (run.totalInputKg > 0) {
      const overallDiffKg = run.totalInputKg - net;
      pct = Math.round((overallDiffKg / run.totalInputKg) * 10000) / 100;
      alert = pct > 15.0;
    }

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
      recordType: 'Stage2',
      recordNumber: run.productionNumber,
      action: 'STAGE2_FINALIZED',
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
    if (run.processType === ProcessType.CLEANING) {
      if (!run.cleaningFinalizedAt) throw new BadRequestException('Complete cleaning before finalisation');
    } else {
      if (!run.hullingFinalizedAt) throw new BadRequestException('Complete Stage 2 before finalisation');
    }

    const cleaning = await this.prisma.cleaningWastageEntry.findMany({ where: { productionRunId: runId } });
    const hulling = await this.prisma.hullingWastageEntry.findMany({ where: { productionRunId: runId } });
    const wastageLines = [
      ...cleaning.map((c) => ({ wastageTypeId: c.wastageTypeId, quantityKg: c.quantityKg, stage: WastageStage.CLEANING })),
      ...hulling.map((h) => ({ wastageTypeId: h.wastageTypeId, quantityKg: h.quantityKg, stage: WastageStage.HULLING })),
    ].filter((l) => l.quantityKg > 0.001);

    // Section 10.1: Default disposition is STORE if not provided or unspecified
    const effectiveDispositions = wastageLines.map((line) => {
      const d = (dto.dispositions || []).find((x) => x.wastageTypeId === line.wastageTypeId);
      return {
        wastageTypeId: line.wastageTypeId,
        action: d?.action === WastageDisposition.DISCARD ? WastageDisposition.DISCARD : WastageDisposition.STORE,
        stage: line.stage,
        quantityKg: line.quantityKg,
      };
    });

    const net = run.netOutputKg || 0;
    const totalWastage = Math.round(
      (wastageLines.reduce((s, l) => s + l.quantityKg, 0)) * 1000,
    ) / 1000;
    const lotNumber = await this.nextNumber('OUT', 'lot');

    // ERP 22.11.26 §2: output classification (final processed vs awaiting further process)
    const output = await this.classifyOutput(run);
    const outputProductId = output.productId;
    const outputIsFinal = output.category === StockCategory.PROCESSED_AVAILABLE;

    // Section 10.2: Direct Fulfillment allocation at finalization
    const directAllocs = dto.directAllocations || [];
    let directAllocTotalKg = 0;
    for (const alloc of directAllocs) {
      directAllocTotalKg += alloc.quantityKg;
    }
    directAllocTotalKg = Math.round(directAllocTotalKg * 1000) / 1000;
    if (directAllocTotalKg > net + 0.001) {
      throw new BadRequestException(
        `Total direct allocation (${directAllocTotalKg} KG) cannot exceed finished output (${net} KG)`,
      );
    }
    if (!outputIsFinal && directAllocs.length) {
      throw new BadRequestException(
        `${output.note}: this output is not a final product yet and cannot be allocated to a container`,
      );
    }
    // PDF §7.4 / §15.3: never fulfil beyond a container line's remaining quantity
    const plannedByLine = new Map<string, number>();
    for (const alloc of directAllocs) {
      const rem = await this.workflow.remainingFor(this.prisma, alloc.containerId);
      if (rem.container.contractId !== alloc.contractId) throw new BadRequestException('Contract and container mismatch');
      if (rem.dispatched) throw new BadRequestException(`Container ${rem.container.containerIndex} is already dispatched`);
      const line = alloc.containerProductId
        ? rem.lines.find((l) => l.id === alloc.containerProductId)
        : rem.lines.find((l) => l.productId === outputProductId);
      if (!line) {
        throw new BadRequestException(
          `Container ${rem.container.containerIndex} has no requirement for the finished product of this run`,
        );
      }
      const key = `${alloc.containerId}:${line.id ?? line.productId}`;
      const planned = Math.round(((plannedByLine.get(key) || 0) + alloc.quantityKg) * 1000) / 1000;
      if (planned > line.remainingKg + 0.001) {
        throw new BadRequestException(
          `Over-fulfilment: container ${rem.container.containerIndex} needs only ${line.remainingKg} KG more of ${line.productName || 'this product'}`,
        );
      }
      plannedByLine.set(key, planned);
      if (!alloc.containerProductId && line.id) alloc.containerProductId = line.id;
    }
    const remainingStoreKg = Math.round((net - directAllocTotalKg) * 1000) / 1000;
    const syncResults: (SyncResult | null)[] = [];

    const fromWip =
      run.processType === ProcessType.CLEANING ? StockCategory.WIP_CLEANING : StockCategory.WIP_HULLING;
    const wipForLine = (stage: string) =>
      run.processType === ProcessType.CLEANING || stage === WastageStage.CLEANING
        ? StockCategory.WIP_CLEANING
        : StockCategory.WIP_HULLING;

    await this.tx(async (tx) => {
      await tx.productionWastageDisposition.deleteMany({ where: { productionRunId: runId } });
      const nextWlNumber = await this.createNumberAllocator('WL', 'wastage', tx);

      for (const line of effectiveDispositions) {
        const action = line.action;
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

      let createdProcessedLot: any = null;
      if (net > 0.001 && !outputIsFinal) {
        // Not a final product (e.g. Cleaning-only Natural Sesame): stays identifiable as the
        // same product in Raw / Awaiting Factory Processing stock — no processed lot is created.
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.AWAITING_PROCESS_RETURN,
          productId: outputProductId,
          stockCategory: fromWip,
          locationId: run.plantId,
          fromCategory: fromWip,
          toCategory: StockCategory.RAW_MATERIAL,
          quantityOutKg: net,
          quantityInKg: net,
          referenceType: 'PRODUCTION_RUN',
          referenceId: runId,
          remarks: `${run.productionNumber}: ${output.note}`,
          createdById: user.sub,
        });
      }
      if (net > 0.001 && outputIsFinal) {
        createdProcessedLot = await tx.processedOutputLot.create({
          data: {
            lotNumber,
            productionRunId: runId,
            productId: outputProductId, // Converted product ID if Hulling+Sortex
            plantId: run.plantId,
            processType: run.processType,
            quantityKg: net,
            availableKg: remainingStoreKg, // Direct allocations deducted from available
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
          productId: outputProductId,
          fromProductId: run.productId,
          toProductId: outputProductId,
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

        // Apply direct fulfillment allocations if any
        for (const alloc of directAllocs) {
          // Validate contract/container product compatibility (Section 10.3)
          const container = await tx.contractContainer.findUnique({
            where: { id: alloc.containerId },
            include: { contract: true },
          });
          if (!container) throw new NotFoundException(`Container ${alloc.containerId} not found`);
          if (container.contractId !== alloc.contractId) {
            throw new BadRequestException('Contract and container mismatch');
          }
          if (container.productId !== outputProductId && container.contract.productId !== outputProductId) {
            throw new BadRequestException(
              `Direct fulfillment product mismatch: container requires product ${container.productId}, finished output is ${outputProductId}`,
            );
          }

          await tx.containerAllocation.create({
            data: {
              productionRunId: runId,
              processedLotId: createdProcessedLot.id,
              contractId: alloc.contractId,
              containerId: alloc.containerId,
              containerProductId: alloc.containerProductId || null,
              productId: outputProductId,
              quantityKg: alloc.quantityKg,
              remarks: alloc.remarks || 'Direct fulfillment at production finalization',
              allocatedById: user.sub,
              status: 'ACTIVE',
            },
          });

          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.CONTAINER_ALLOCATION,
            productId: outputProductId,
            stockCategory: StockCategory.PROCESSED_AVAILABLE,
            locationId: run.plantId,
            fromCategory: StockCategory.PROCESSED_AVAILABLE,
            toCategory: StockCategory.PROCESSED_RESERVED,
            quantityOutKg: alloc.quantityKg,
            quantityInKg: alloc.quantityKg,
            referenceType: 'CONTAINER_ALLOCATION',
            referenceId: alloc.containerId,
            createdById: user.sub,
          });

          syncResults.push(await this.refreshContainerStatus(tx, alloc.contractId, alloc.containerId, user.sub));
        }
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
          storedProcessedKg: outputIsFinal ? remainingStoreKg : 0,
          allocatedKg: directAllocTotalKg,
          outputStockCategory: output.category,
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
      newValue: JSON.stringify({
        net,
        storedKg: remainingStoreKg,
        directAllocTotalKg,
        outputProductId,
        outputStockCategory: output.category,
        outputNote: output.note,
        dispositions: effectiveDispositions,
      }),
    });

    const finalised = await this.getRun(runId);
    return { ...finalised, fulfilledContainers: this.fulfilledSummary(syncResults) };
  }

  // ── Fulfilment ───────────────────────────────────────────
  /** Recalculate the container's fulfilment + operational stage via the shared workflow engine. */
  private async refreshContainerStatus(
    tx: Prisma.TransactionClient,
    _contractId: string,
    containerId: string,
    userId: string,
  ): Promise<SyncResult | null> {
    return this.workflow.sync(tx, containerId, userId, 'Updated by production fulfilment');
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
      const rem = await this.workflow.remainingFor(this.prisma, dto.containerId);
      if (rem.container.contractId !== dto.contractId) throw new BadRequestException('Contract and container mismatch');
      if (rem.dispatched) throw new BadRequestException('Container is already dispatched');
      const line = dto.containerProductId
        ? rem.lines.find((l) => l.id === dto.containerProductId)
        : rem.lines.find((l) => l.productId === dto.productId);
      if (!line || line.productId !== dto.productId) throw new BadRequestException('Container has no requirement for this product');
      if (qtyKg > line.remainingKg + 0.001) {
        throw new BadRequestException(`Cannot allocate above pending quantity (${line.remainingKg} KG)`);
      }
      let synced: SyncResult | null = null;
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
        synced = await this.refreshContainerStatus(tx, dto.contractId, dto.containerId, user.sub);
      });
      await this.audit.log({
        module: 'FULFILMENT',
        recordType: 'ContainerAllocation',
        recordNumber: lot.lotNumber,
        action: 'ALLOCATED_FROM_STOCK',
        changedById: user.sub,
        newValue: String(qtyKg),
      });
      return { ok: true, fulfilledContainers: this.fulfilledSummary([synced]) };
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
          packagingType: ct.packagingType,
          packagingSize: ct.packagingSize,
          packingDescription: ct.packingDescription,
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
    let synced: SyncResult | null = null;

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
      synced = await this.refreshContainerStatus(tx, dto.contractId, dto.containerId, user.sub);
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

    return { ok: true, allocatedKg: qtyKg, consumedLots: consumed, fulfilledContainers: this.fulfilledSummary([synced]) };
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

  // Section 11: Wastage Inventory — Select & Merge Feature
  async mergeWastageLots(dto: MergeWastageDto, user: JwtPayload) {
    if (!dto.sourceLotIds || dto.sourceLotIds.length < 2) {
      throw new BadRequestException('At least 2 wastage lots are required to merge');
    }

    const sourceLots = await this.prisma.wastageLot.findMany({
      where: { id: { in: dto.sourceLotIds } },
      include: { product: true, location: true, wastageType: true },
    });

    if (sourceLots.length !== dto.sourceLotIds.length) {
      throw new NotFoundException('One or more selected wastage lots could not be found');
    }

    // Section 11.4: Mandatory Product Validation — Must be the exact same product ID
    const primaryProductId = sourceLots[0].productId;
    const sameProduct = sourceLots.every((l) => l.productId === primaryProductId);
    if (!sameProduct) {
      throw new BadRequestException(
        'Cannot merge wastage lots across different products. All selected lots must have the same exact product ID.',
      );
    }

    // Section 11.7: Location rule — all lots must belong to the same plant/location
    const primaryLocationId = sourceLots[0].locationId;
    const sameLocation = sourceLots.every((l) => l.locationId === primaryLocationId);
    if (!sameLocation) {
      throw new BadRequestException(
        'Cannot merge wastage lots located in different plants. Stock must first be transferred to the same location.',
      );
    }

    // Validate available stock
    for (const lot of sourceLots) {
      if (lot.availableKg <= 0.001 || lot.status === WastageLotStatus.DISCARDED || lot.status === WastageLotStatus.CLOSED) {
        throw new BadRequestException(`Lot ${lot.lotNumber} has no available stock to merge.`);
      }
    }

    const mergedQtyKg = Math.round(sourceLots.reduce((s, l) => s + l.availableKg, 0) * 1000) / 1000;
    const customName = dto.mergedLotName?.trim() || 'Merge Wastage';

    // Find or pick a representative wastage type for merged lots
    let mergedWastageType = await this.prisma.wastageType.findFirst({
      where: { OR: [{ code: 'MERGED' }, { nameEn: { contains: 'Merged', mode: 'insensitive' } }], isActive: true },
    });
    if (!mergedWastageType) {
      mergedWastageType = sourceLots[0].wastageType;
    }

    const newMergedLotNumber = await this.nextNumber('MWL', 'wastage');

    const created = await this.tx(async (tx) => {
      // Deduct source lots
      for (const lot of sourceLots) {
        await tx.wastageLot.update({
          where: { id: lot.id },
          data: {
            availableKg: 0,
            status: WastageLotStatus.CLOSED,
          },
        });
      }

      // Create consolidated merged lot
      const mergedLot = await tx.wastageLot.create({
        data: {
          lotNumber: newMergedLotNumber,
          productId: primaryProductId,
          wastageTypeId: mergedWastageType!.id,
          locationId: primaryLocationId,
          quantityKg: mergedQtyKg,
          availableKg: mergedQtyKg,
          status: WastageLotStatus.AVAILABLE,
          parentWastageLotId: sourceLots[0].id,
          originalProductionRunId: sourceLots[0].originalProductionRunId || sourceLots[0].productionRunId,
          reprocessingCycle: Math.max(...sourceLots.map((l) => l.reprocessingCycle || 1)),
          productionDate: new Date(),
        },
      });

      return mergedLot;
    });

    await this.audit.log({
      module: 'WASTAGE',
      recordType: 'WastageLot',
      recordNumber: newMergedLotNumber,
      action: 'MERGED',
      changedById: user.sub,
      newValue: JSON.stringify({
        mergedLotId: created.id,
        mergedLotName: customName,
        totalQuantityKg: mergedQtyKg,
        sourceLotNumbers: sourceLots.map((l) => l.lotNumber),
      }),
    });

    return created;
  }

  // Section 12: Wastage Outward & Truck Tracking
  async recordWastageOutward(dto: WastageOutwardDto, user: JwtPayload) {
    const lot = await this.prisma.wastageLot.findUnique({
      where: { id: dto.wastageLotId },
      include: { product: true, location: true },
    });
    if (!lot) throw new NotFoundException('Wastage lot not found');

    const qtyKg = Math.round(dto.quantityKg * 1000) / 1000;
    if (qtyKg <= 0.001) throw new BadRequestException('Outward quantity must be greater than zero');
    if (qtyKg > lot.availableKg + 0.001) {
      throw new BadRequestException(
        `Cannot outward ${qtyKg} KG. Only ${lot.availableKg} KG available in lot ${lot.lotNumber}.`,
      );
    }

    const trucks = dto.numberOfTrucks ?? 1;

    await this.tx(async (tx) => {
      const remaining = Math.round((lot.availableKg - qtyKg) * 1000) / 1000;
      await tx.wastageLot.update({
        where: { id: lot.id },
        data: {
          availableKg: remaining,
          status: remaining <= 0.001 ? WastageLotStatus.CLOSED : WastageLotStatus.PARTIALLY_REPROCESSED,
        },
      });

      await this.ledger.postTxn(tx, {
        txnType: LedgerTxnType.WASTAGE_DISCARD,
        productId: lot.productId,
        stockCategory: StockCategory.WASTAGE_INVENTORY,
        sourceLocationId: lot.locationId,
        quantityOutKg: qtyKg,
        referenceType: 'WASTAGE_OUTWARD',
        referenceId: lot.id,
        remarks: `Outward ${qtyKg} KG (${trucks} truck(s)) to ${dto.destination || 'External'}. ${dto.remarks || ''}`.trim(),
        createdById: user.sub,
      });
    });

    await this.audit.log({
      module: 'WASTAGE',
      recordType: 'WastageOutward',
      recordNumber: lot.lotNumber,
      action: 'OUTWARD',
      changedById: user.sub,
      newValue: JSON.stringify({
        lotNumber: lot.lotNumber,
        product: lot.product.name,
        plant: lot.location.name,
        quantityKg: qtyKg,
        numberOfTrucks: trucks,
        truckNumber: dto.truckNumber,
        destination: dto.destination,
        outwardDate: dto.outwardDate,
      }),
    });

    return { ok: true, lotNumber: lot.lotNumber, outwardKg: qtyKg, numberOfTrucks: trucks };
  }

  // Section 12.3: Yearly Wastage Outward Trucks Report
  async getWastageTruckReport(year?: number) {
    const selectedYear = year || new Date().getFullYear();
    const startOfYear = new Date(selectedYear, 0, 1);
    const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59);

    const logs = await this.prisma.productionAuditLog.findMany({
      where: {
        module: 'WASTAGE',
        recordType: 'WastageOutward',
        action: 'OUTWARD',
        createdAt: { gte: startOfYear, lte: endOfYear },
      },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyCounts: Record<number, number> = {};
    for (let m = 0; m < 12; m++) monthlyCounts[m] = 0;

    let totalTrucks = 0;
    for (const log of logs) {
      try {
        const parsed = JSON.parse(log.newValue || '{}');
        const trucks = Number(parsed.numberOfTrucks) || 1;
        const d = new Date(parsed.outwardDate || log.createdAt);
        const m = d.getMonth();
        monthlyCounts[m] = (monthlyCounts[m] || 0) + trucks;
        totalTrucks += trucks;
      } catch {}
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const monthly = monthNames.map((name, idx) => ({
      month: name,
      trucksOutward: monthlyCounts[idx] || 0,
    }));

    return { year: selectedYear, totalTrucks, monthly };
  }

  /**
   * Product stock summary in the PDF's terms (ERP 22.11.26 §3.1–3.2, §18):
   * Final Processed = Unassigned + Allocated (sub-divisions, never added again).
   */
  async productStockSummary(productId: string, locationId?: string, pending?: any[]) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const [balances, lots] = await Promise.all([
      this.prisma.inventoryBalance.findMany({ where: { productId, ...(locationId ? { locationId } : {}) } }),
      this.prisma.processedOutputLot.aggregate({
        where: { productId, status: 'AVAILABLE', availableKg: { gt: 0.001 }, ...(locationId ? { plantId: locationId } : {}) },
        _sum: { availableKg: true },
        _count: { _all: true },
      }),
    ]);
    const sum = (cats: string[]) =>
      Math.round(balances.filter((b) => cats.includes(b.stockCategory)).reduce((s, b) => s + b.quantityKg, 0) * 1000) / 1000;
    const rawKg = sum([StockCategory.RAW_MATERIAL]);
    const wipKg = sum([StockCategory.WIP_CLEANING, StockCategory.WIP_HULLING]);
    const allocatedKg = sum([StockCategory.PROCESSED_RESERVED]);
    const unassignedKg = Math.round((lots._sum.availableKg || 0) * 1000) / 1000;
    const finalProcessedKg = Math.round((unassignedKg + allocatedKg) * 1000) / 1000;
    const pendingRows = pending ?? (await this.getPendingContracts());
    const eligible = pendingRows.filter((c: any) =>
      (c.containers || []).some((ct: any) => (ct.productLines || []).some((l: any) => l.productId === productId && l.pendingKg > 0.001)),
    );
    const pendingKg = eligible.reduce(
      (s: number, c: any) =>
        s +
        c.containers.reduce(
          (a: number, ct: any) =>
            a + ct.productLines.filter((l: any) => l.productId === productId).reduce((x: number, l: any) => x + l.pendingKg, 0),
          0,
        ),
      0,
    );
    const nss = ProductionService.isNaturalSesame(product);
    const hss = ProductionService.isHulledSesame(product);
    const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 3 });
    return {
      productId,
      productCode: product.code,
      productName: product.name,
      rawLabel: hss
        ? 'Purchased Hulled Awaiting Sortex (Raw / Awaiting Factory Processing)'
        : nss
          ? 'Natural Sesame Awaiting Hulling + Sortex'
          : 'Raw / Awaiting Factory Processing',
      rawKg,
      wipKg,
      finalProcessedKg,
      unassignedKg,
      allocatedKg,
      unassignedLots: lots._count._all,
      eligiblePendingContracts: eligible.length,
      eligiblePendingKg: Math.round(pendingKg * 1000) / 1000,
      unassignedMessage:
        unassignedKg > 0.001
          ? eligible.length
            ? `${fmt(unassignedKg)} KG Unassigned — ${eligible.length} Pending Contract${eligible.length === 1 ? '' : 's'}`
            : `${fmt(unassignedKg)} KG Unassigned — No Contracts Available to Assign`
          : null,
      /** Natural Sesame is never a finished product (§2.1); flag any legacy processed stock left */
      legacyProcessedNaturalSesameKg: nss ? finalProcessedKg : 0,
    };
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

    const reserved = await this.prisma.inventoryBalance.groupBy({
      by: ['productId'],
      where: { stockCategory: StockCategory.PROCESSED_RESERVED, quantityKg: { gt: 0 }, ...(locationId ? { locationId } : {}) },
      _sum: { quantityKg: true },
    });
    const reservedMap = new Map(reserved.map((r) => [r.productId, r._sum.quantityKg || 0]));
    const pending = await this.getPendingContracts();
    const pendingCount = (pid: string) =>
      pending.filter((c: any) =>
        (c.containers || []).some((ct: any) => (ct.productLines || []).some((l: any) => l.productId === pid && l.pendingKg > 0.001)),
      ).length;
    return [...byProduct.values()]
      .map((r) => ({
        ...r,
        allocatedKg: Math.round((reservedMap.get(r.productId) || 0) * 1000) / 1000,
        finalProcessedKg: Math.round((r.processedKg + (reservedMap.get(r.productId) || 0)) * 1000) / 1000,
        eligiblePendingContracts: pendingCount(r.productId),
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
      summary: await this.productStockSummary(productId, locationId),
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

  /**
   * Legacy Sampling-screen update, mapped onto the container workflow rules
   * (sent → awaiting result → result received → approved). A passing result is no longer
   * treated as approval (PDF §12.3).
   */
  async updateSample(id: string, dto: SampleResultDto, user: JwtPayload) {
    const sample = await this.prisma.sampleRecord.findUnique({ where: { id } });
    if (!sample) throw new NotFoundException('Sample not found');
    const result = (dto.result || '').toUpperCase() || (['PASSED', 'FAILED'].includes(dto.status) ? dto.status : '');
    const common = {
      samplingDate: dto.collectionDate,
      testingAgency: dto.testingAgency,
      resultDate: dto.resultDate,
      resultReference: dto.reportReference,
      remarks: dto.remarks,
    };
    if (result === 'PASSED' || result === 'FAILED') {
      if ([SamplingStatus.READY_FOR_SAMPLING, SamplingStatus.NOT_READY].includes(sample.status as any)) {
        await this.workflow.updateSampleRecord(id, { step: 'SENT', ...common }, user);
      }
      return this.workflow.updateSampleRecord(id, { step: 'RESULT', result, ...common }, user);
    }
    if (dto.status === SamplingStatus.SAMPLE_COLLECTED) return this.workflow.updateSampleRecord(id, { step: 'SENT', ...common }, user);
    if (dto.status === SamplingStatus.TESTING_IN_PROGRESS) {
      return this.workflow.updateSampleRecord(id, { step: 'AWAITING_RESULT', ...common }, user);
    }
    throw new BadRequestException('Unsupported sampling update. Use Container Status actions.');
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

    // Section 14.1 & 14.2: Destination plant notification on transfer creation
    await this.notifications.notifyChange({
      type: 'INCOMING_TRANSFER',
      message: `Incoming Transfer from ${row.sourceLocation?.name || 'plant'} — ${qtyKg} KG ${row.product?.name || 'material'}`,
      changedById: user.sub,
      targetRoles: [
        UserRole.SUPER_ADMIN,
        UserRole.OFFICE_ADMIN,
        UserRole.PRODUCTION_TEAM,
        UserRole.INVENTORY_TEAM,
      ],
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
      } else if (t.stockCategory === StockCategory.PROCESSED_AVAILABLE) {
        // Product-level processed transfer: consume source lots FIFO so lot totals stay
        // equal to the ledger, and remember the oldest source run for traceability.
        const lots = await tx.processedOutputLot.findMany({
          where: { productId: t.productId, plantId: t.sourceLocationId, status: 'AVAILABLE', availableKg: { gt: 0.001 } },
          orderBy: { completionDate: 'asc' },
        });
        let remaining = t.quantityKg;
        for (const lot of lots) {
          if (remaining <= 0.001) break;
          const take = Math.min(lot.availableKg, remaining);
          await tx.processedOutputLot.update({ where: { id: lot.id }, data: { availableKg: { decrement: take } } });
          remaining = Math.round((remaining - take) * 1000) / 1000;
        }
        if (remaining > 0.001) throw new BadRequestException(`Only ${t.quantityKg - remaining} KG of processed lots available to transfer`);
        if (!t.productionRunId && lots[0]?.productionRunId) {
          await tx.plantTransfer.update({ where: { id }, data: { productionRunId: lots[0].productionRunId } });
        }
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

      if (t.stockCategory === StockCategory.PROCESSED_AVAILABLE) {
        // PDF §3.3: finalised stock keeps its Final Processed classification at the destination,
        // as a real lot (so Inventory and Fulfilment can see it) with its origin preserved.
        const srcLot = t.processedLotId ? await tx.processedOutputLot.findUnique({ where: { id: t.processedLotId } }) : null;
        const fresh = await tx.plantTransfer.findUnique({ where: { id }, select: { productionRunId: true } });
        await tx.processedOutputLot.create({
          data: {
            lotNumber: `${t.transferNumber}-DST`,
            productionRunId: srcLot?.productionRunId || fresh?.productionRunId || null,
            productId: t.productId,
            plantId: t.destLocationId,
            processType: srcLot?.processType || 'TRANSFER',
            quantityKg: t.quantityKg,
            availableKg: t.quantityKg,
            completionDate: srcLot?.completionDate || new Date(),
            status: 'AVAILABLE',
            productionSource: srcLot?.productionSource || ProductionSource.IN_HOUSE,
            jobWorkId: srcLot?.jobWorkId || null,
            reprocessingCycle: srcLot?.reprocessingCycle || 0,
          },
        });
      }
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

      // Section 14.2 & 14.4: Automatic linked Inward for all accepted transfers (Raw, Processed, Wastage, Rejected)
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
            remarks: `Auto-linked from plant transfer ${t.transferNumber} (${t.stockCategory})`,
            createdById: user.sub,
          },
        });
        await tx.plantTransfer.update({
          where: { id },
          data: { linkedInwardId: inward.id },
        });
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
      where: { wastageAlert: true, deletedAt: null },
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
      where: { deletedAt: null, status: { notIn: [ProductionRunStatus.COMPLETED, ProductionRunStatus.CANCELLED] } },
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

    // Section 17 & 18: Dashboard KPIs & Aging tracking
    const activeProductionRuns = await this.prisma.productionRun.findMany({
      where: { status: { notIn: [ProductionRunStatus.COMPLETED, ProductionRunStatus.CANCELLED] } },
      select: { totalInputKg: true, plantId: true },
    });
    const materialCurrentlyInProductionKg = Math.round(
      activeProductionRuns.reduce((s, r) => s + (r.totalInputKg || 0), 0) * 1000,
    ) / 1000;

    // 18.2 Unassigned Processed Inventory Aging
    const unallocatedProcessedLots = await this.prisma.processedOutputLot.findMany({
      where: { availableKg: { gt: 0.001 }, status: 'AVAILABLE' },
      include: { product: true, plant: true, productionRun: { select: { productionNumber: true, finalisedAt: true } } },
      orderBy: { completionDate: 'asc' },
      take: 50,
    });
    const unassignedInventoryAging = unallocatedProcessedLots.map((lot) => {
      const finalDate = lot.productionRun?.finalisedAt || lot.completionDate || lot.createdAt;
      const daysUnassigned = Math.max(0, Math.floor((today.getTime() - new Date(finalDate).getTime()) / 86400000));
      return {
        id: lot.id,
        productionNumber: lot.productionRun?.productionNumber || lot.lotNumber,
        product: lot.product?.name || '—',
        plant: lot.plant?.name || '—',
        availableUnassignedKg: lot.availableKg,
        finalizationDate: finalDate,
        daysUnassigned,
      };
    });

    // 18.3 Allocated but Not Dispatched Container Aging
    const allocatedActiveAllocations = await this.prisma.containerAllocation.findMany({
      where: { status: 'ACTIVE' },
      include: {
        productionRun: { select: { productionNumber: true } },
        processedLot: { select: { lotNumber: true } },
      },
      orderBy: { allocationDate: 'asc' },
      take: 50,
    });

    const allocContractIds = [...new Set(allocatedActiveAllocations.map((a) => a.contractId))];
    const allocContainerIds = [...new Set(allocatedActiveAllocations.map((a) => a.containerId))];
    const allocProductIds = [...new Set(allocatedActiveAllocations.map((a) => a.productId))];

    const [allocContracts, allocContainers, allocProducts] = await Promise.all([
      this.prisma.contract.findMany({
        where: { id: { in: allocContractIds } },
        select: { id: true, contractNumber: true },
      }),
      this.prisma.contractContainer.findMany({
        where: { id: { in: allocContainerIds } },
        select: {
          id: true,
          containerIndex: true,
          containerNo: true,
          containerStatus: true,
          packagingType: { select: { name: true } },
          packagingSize: { select: { label: true } },
        },
      }),
      this.prisma.product.findMany({
        where: { id: { in: allocProductIds } },
        select: { id: true, name: true },
      }),
    ]);

    const contractMap = new Map(allocContracts.map((c) => [c.id, c]));
    const containerMap = new Map(allocContainers.map((c) => [c.id, c]));
    const productMap = new Map(allocProducts.map((p) => [p.id, p]));

    const allocatedContainerAging = allocatedActiveAllocations.map((alloc) => {
      const c = containerMap.get(alloc.containerId);
      const ct = contractMap.get(alloc.contractId);
      const pr = productMap.get(alloc.productId);

      const allocDate = alloc.allocationDate || alloc.createdAt;
      const isDispatched = c?.containerStatus === 'DISPATCHED' || c?.containerStatus === 'SHIPPED';
      const daysWaiting = Math.max(0, Math.floor((today.getTime() - new Date(allocDate).getTime()) / 86400000));
      return {
        id: alloc.id,
        contractNumber: ct?.contractNumber || '—',
        containerNumber: c?.containerNo || `Container ${c?.containerIndex ?? '—'}`,
        product: pr?.name || '—',
        packaging: c?.packagingSize?.label || c?.packagingType?.name || '—',
        allocatedQtyKg: alloc.quantityKg,
        productionLotReference: alloc.productionRun?.productionNumber || alloc.processedLot?.lotNumber || '—',
        allocationDate: allocDate,
        dispatchStatus: isDispatched ? 'Dispatched' : 'Pending Dispatch',
        daysWaiting,
      };
    });

    // ERP 22.11.26 §18 inventory KPIs and §17.5 lot KPIs
    const allocatedKgTotal = byCategory[StockCategory.PROCESSED_RESERVED] || 0;
    const wipKgTotal = (byCategory[StockCategory.WIP_CLEANING] || 0) + (byCategory[StockCategory.WIP_HULLING] || 0);
    const [lotsUnassigned, lotsFinalised, allocatedLots] = await Promise.all([
      this.prisma.processedOutputLot.count({ where: { status: 'AVAILABLE', availableKg: { gt: 0.001 } } }),
      this.prisma.processedOutputLot.count({ where: { status: { notIn: ['DELETED', 'RECLASSIFIED_AWAITING'] } } }),
      this.prisma.containerAllocation.findMany({
        where: { status: 'ACTIVE', processedLotId: { not: null } },
        select: { processedLotId: true },
        distinct: ['processedLotId'],
      }),
    ]);
    const unassignedLotIds = await this.prisma.processedOutputLot.findMany({
      where: { status: 'AVAILABLE', availableKg: { gt: 0.001 } },
      select: { id: true },
    });
    const inFactory = new Set([...unassignedLotIds.map((l) => l.id), ...allocatedLots.map((a) => a.processedLotId as string)]);
    const hssProduct = await this.prisma.product.findFirst({ where: { code: 'HSS' } });
    const pendingForSummary = await this.getPendingContracts();

    return {
      kpis: {
        rawAwaitingKg: Math.round((byCategory[StockCategory.RAW_MATERIAL] || 0) * 1000) / 1000,
        finalProcessedKg: Math.round((processedAvailableKg + allocatedKgTotal) * 1000) / 1000,
        materialInProductionKg: Math.round(wipKgTotal * 1000) / 1000,
        unassignedKg: Math.round(processedAvailableKg * 1000) / 1000,
        allocatedKg: Math.round(allocatedKgTotal * 1000) / 1000,
      },
      lots: {
        inFactory: inFactory.size,
        inProduction: activeRuns,
        finalised: lotsFinalised,
        unassigned: lotsUnassigned,
        allocated: allocatedLots.length,
      },
      hulledSesame: hssProduct ? await this.productStockSummary(hssProduct.id, undefined, pendingForSummary) : null,
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
        totalCount: pendingItems.length,
        items: pendingItems,
      },
      production: {
        activeRuns,
        materialCurrentlyInProductionKg,
        completedToday: completedToday.map((r) => ({
          productionNumber: r.productionNumber,
          product: r.product.name,
          plant: r.plant.name,
          netOutputKg: r.netOutputKg,
        })),
      },
      aging: {
        unassignedInventory: unassignedInventoryAging,
        allocatedContainers: allocatedContainerAging,
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
