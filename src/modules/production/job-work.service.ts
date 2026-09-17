import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/constants/enums';
import {
  DEFAULT_WASTAGE_ALERT_PCT,
  InputStockCategory,
  JobWorkReturnCategory,
  JobWorkStatus,
  JobWorkWastageDisposition as JWDisposition,
  LedgerTxnType,
  ProcessType,
  ProductionRunStatus,
  ProductionSource,
  StockCategory,
  WASTAGE_ALERT_THRESHOLD_KEY,
  WastageDisposition,
  WastageLotStatus,
  WastageStage,
  toKg,
} from '../../common/constants/production.constants';
import { InventoryLedgerService } from './inventory-ledger.service';
import { ProductionAuditService } from './production-audit.service';
import {
  CloseJobWorkDto,
  CreateJobWorkDto,
  CreateJobWorkerDto,
  JobWorkInwardDto,
  JobWorkOutwardDto,
  JobWorkProcessResultDto,
  StartReSortexDto,
} from './production.dto';

@Injectable()
export class JobWorkService {
  constructor(
    private prisma: PrismaService,
    private ledger: InventoryLedgerService,
    private audit: ProductionAuditService,
  ) {}

  private tx<T>(fn: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn, { maxWait: 15000, timeout: 60000 });
  }

  private async nextJwNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JW-${year}-`;
    const latest = await this.prisma.jobWork.findFirst({
      where: { jobWorkNumber: { startsWith: prefix } },
      orderBy: { jobWorkNumber: 'desc' },
    });
    let next = 1;
    if (latest) {
      const n = parseInt(latest.jobWorkNumber.split('-').pop() || '0', 10);
      if (!isNaN(n)) next = n + 1;
    }
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private async nextOutwardNumber(jobWorkNumber: string): Promise<string> {
    const prefix = `${jobWorkNumber}-OUT-`;
    const latest = await this.prisma.jobWorkOutward.findFirst({
      where: { outwardNumber: { startsWith: prefix } },
      orderBy: { outwardNumber: 'desc' },
    });
    let next = 1;
    if (latest) {
      const n = parseInt(latest.outwardNumber.split('-').pop() || '0', 10);
      if (!isNaN(n)) next = n + 1;
    }
    return `${prefix}${String(next).padStart(3, '0')}`;
  }

  private async nextInwardNumber(jobWorkNumber: string): Promise<string> {
    const prefix = `${jobWorkNumber}-IN-`;
    const latest = await this.prisma.jobWorkInward.findFirst({
      where: { inwardNumber: { startsWith: prefix } },
      orderBy: { inwardNumber: 'desc' },
    });
    let next = 1;
    if (latest) {
      const n = parseInt(latest.inwardNumber.split('-').pop() || '0', 10);
      if (!isNaN(n)) next = n + 1;
    }
    return `${prefix}${String(next).padStart(3, '0')}`;
  }

  private async nextLotNumber(
    prefix: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const full = `${prefix}-${year}-`;
    const row = await client.processedOutputLot.findFirst({
      where: { lotNumber: { startsWith: full } },
      orderBy: { lotNumber: 'desc' },
    });
    let next = 1;
    if (row) {
      const n = parseInt(row.lotNumber.split('-').pop() || '0', 10);
      if (!isNaN(n)) next = n + 1;
    }
    return `${full}${String(next).padStart(5, '0')}`;
  }

  private async nextWastageLotNumber(
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const full = `WL-${year}-`;
    const row = await client.wastageLot.findFirst({
      where: { lotNumber: { startsWith: full } },
      orderBy: { lotNumber: 'desc' },
    });
    let next = 1;
    if (row) {
      const n = parseInt(row.lotNumber.split('-').pop() || '0', 10);
      if (!isNaN(n)) next = n + 1;
    }
    return `${full}${String(next).padStart(5, '0')}`;
  }

  private createSeqAllocator(first: string): () => string {
    const parts = first.split('-');
    const year = parts[1];
    const prefix = parts[0];
    let next = parseInt(parts[parts.length - 1] || '1', 10);
    return () => {
      const n = next++;
      return `${prefix}-${year}-${String(n).padStart(5, '0')}`;
    };
  }

  private async nextRunNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const full = `PR-${year}-`;
    const row = await this.prisma.productionRun.findFirst({
      where: { productionNumber: { startsWith: full } },
      orderBy: { productionNumber: 'desc' },
    });
    let next = 1;
    if (row) {
      const n = parseInt(row.productionNumber.split('-').pop() || '0', 10);
      if (!isNaN(n)) next = n + 1;
    }
    return `${full}${String(next).padStart(5, '0')}`;
  }

  listWorkers() {
    return this.prisma.jobWorker.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  async createWorker(dto: CreateJobWorkerDto) {
    const code =
      dto.code?.trim().toUpperCase() ||
      `JW-P-${dto.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8)}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
    return this.prisma.jobWorker.create({
      data: { code, name: dto.name.trim(), phone: dto.phone },
    });
  }

  list(filters?: { status?: string; productId?: string; jobWorkerId?: string }) {
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

  async getOne(id: string) {
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
    if (!jw) throw new NotFoundException('Job Work not found');
    return { ...jw, reconciliation: this.buildReconciliation(jw) };
  }

  private buildReconciliation(jw: any) {
    const totalSent = jw.totalSentKg || 0;
    const processedReceived = (jw.inwards || [])
      .flatMap((i: any) => i.lines || [])
      .filter((l: any) => l.returnCategory === JobWorkReturnCategory.PROCESSED)
      .reduce((s: number, l: any) => s + l.quantityKg, 0);
    const wastageReceived = (jw.inwards || [])
      .flatMap((i: any) => i.lines || [])
      .filter((l: any) => l.returnCategory === JobWorkReturnCategory.WASTAGE)
      .reduce((s: number, l: any) => s + l.quantityKg, 0);
    const unprocessedReturned = (jw.inwards || [])
      .flatMap((i: any) => i.lines || [])
      .filter((l: any) => l.returnCategory === JobWorkReturnCategory.UNPROCESSED)
      .reduce((s: number, l: any) => s + l.quantityKg, 0);
    const wastageDiscarded = (jw.wastageDispositions || [])
      .filter((d: any) => d.disposition === JWDisposition.DISCARDED_AT_WORKER)
      .reduce((s: number, d: any) => s + d.quantityKg, 0);
    const wastageExpectedReturn = (jw.wastageDispositions || [])
      .filter((d: any) => d.disposition === JWDisposition.RETURNED)
      .reduce((s: number, d: any) => s + d.quantityKg, 0);
    const stillOutside = Math.round(
      (totalSent - processedReceived - wastageReceived - unprocessedReturned - wastageDiscarded) * 1000,
    ) / 1000;
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

  async create(dto: CreateJobWorkDto, user: JwtPayload) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product?.isActive) throw new BadRequestException('Product not found');
    if (dto.processType === ProcessType.FULL_PROCESS && !product.allowsFullProcess) {
      throw new BadRequestException('Full Process is currently available only for Sesame Seed products.');
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
        status: JobWorkStatus.ACTIVE,
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

  async addOutward(id: string, dto: JobWorkOutwardDto, user: JwtPayload) {
    const jw = await this.getOne(id);
    if ([JobWorkStatus.CLOSED, JobWorkStatus.CANCELLED].includes(jw.status as any)) {
      throw new BadRequestException('Cannot add outward to closed Job Work');
    }
    const qtyKg = toKg(dto.quantity, dto.unit || 'KG');
    const sourceId = dto.sourceLocationId || jw.sourceLocationId;
    const avail = await this.ledger.getAvailableKg(jw.productId, sourceId, StockCategory.RAW_MATERIAL);
    if (avail < qtyKg - 0.001) {
      throw new BadRequestException(`Insufficient raw material. Available: ${avail} KG`);
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
          status:
            jw.outwards.length === 0
              ? JobWorkStatus.MATERIAL_SENT
              : JobWorkStatus.MATERIAL_PARTIALLY_SENT,
        },
      });
      await this.ledger.postTxn(tx, {
        txnType: LedgerTxnType.JOB_WORK_OUTWARD,
        productId: jw.productId,
        stockCategory: StockCategory.RAW_MATERIAL,
        locationId: sourceId,
        fromCategory: StockCategory.RAW_MATERIAL,
        toCategory: StockCategory.MATERIAL_WITH_JOB_WORKER,
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

  async addInward(id: string, dto: JobWorkInwardDto, user: JwtPayload) {
    const jw = await this.getOne(id);
    if ([JobWorkStatus.CLOSED, JobWorkStatus.CANCELLED].includes(jw.status as any)) {
      throw new BadRequestException('Cannot add inward to closed Job Work');
    }
    if (!dto.lines?.length) throw new BadRequestException('At least one return line is required');
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
        const qtyKg = toKg(line.quantity, line.unit || 'KG');
        if (
          line.returnCategory === JobWorkReturnCategory.WASTAGE &&
          !line.wastageTypeId
        ) {
          throw new BadRequestException('Wastage type required for wastage return lines');
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

        if (line.returnCategory === JobWorkReturnCategory.PROCESSED) {
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
              productionSource: ProductionSource.JOB_WORK,
              jobWorkId: id,
              status: 'AVAILABLE',
            },
          });
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.JOB_WORK_INWARD_PROCESSED,
            productId: jw.productId,
            stockCategory: StockCategory.MATERIAL_WITH_JOB_WORKER,
            sourceLocationId: jw.sourceLocationId,
            quantityOutKg: qtyKg,
            referenceType: 'JOB_WORK_INWARD',
            referenceId: inward.id,
            remarks: `Clear JW material ${inwardNumber}`,
            createdById: user.sub,
          });
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.JOB_WORK_INWARD_PROCESSED,
            productId: jw.productId,
            stockCategory: StockCategory.PROCESSED_AVAILABLE,
            destLocationId: dto.receivingLocationId,
            quantityInKg: qtyKg,
            referenceType: 'JOB_WORK_INWARD',
            referenceId: inward.id,
            remarks: `JW processed return ${inwardNumber}`,
            createdById: user.sub,
          });
        } else if (line.returnCategory === JobWorkReturnCategory.WASTAGE && line.wastageTypeId) {
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
              status: WastageLotStatus.AVAILABLE,
              productionDate: new Date(dto.receiptDate),
            },
          });
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.JOB_WORK_INWARD_WASTAGE,
            productId: jw.productId,
            stockCategory: StockCategory.WASTAGE_INVENTORY,
            destLocationId: dto.receivingLocationId,
            quantityInKg: qtyKg,
            referenceType: 'JOB_WORK_INWARD',
            referenceId: inward.id,
            createdById: user.sub,
          });
        } else if (line.returnCategory === JobWorkReturnCategory.UNPROCESSED) {
          await this.ledger.postTxn(tx, {
            txnType: LedgerTxnType.JOB_WORK_INWARD_UNPROCESSED,
            productId: jw.productId,
            stockCategory: StockCategory.MATERIAL_WITH_JOB_WORKER,
            locationId: jw.sourceLocationId,
            fromCategory: StockCategory.MATERIAL_WITH_JOB_WORKER,
            toCategory: StockCategory.RAW_MATERIAL,
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
        data: { status: JobWorkStatus.PARTIALLY_RECEIVED },
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

  async submitProcessResult(id: string, dto: JobWorkProcessResultDto, user: JwtPayload) {
    const jw = await this.getOne(id);
    let cleaningWastage = 0;
    for (const line of dto.cleaningLines || []) {
      cleaningWastage += toKg(line.quantity ?? 0, line.unit || 'KG');
    }
    let hullingWastage = 0;
    if (jw.processType === ProcessType.FULL_PROCESS) {
      for (const line of dto.hullingLines || []) {
        let q = 0;
        if (line.numberOfBags != null && line.weightPerBag != null) {
          q = toKg(line.numberOfBags * line.weightPerBag, line.unit || 'KG');
        } else {
          q = toKg(line.quantity ?? 0, line.unit || 'KG');
        }
        hullingWastage += q;
      }
    }
    const totalWastage = Math.round((cleaningWastage + hullingWastage) * 1000) / 1000;
    const net = Math.round((dto.totalProcessedInputKg - totalWastage) * 1000) / 1000;
    if (net < 0) throw new BadRequestException('Net processed output cannot be negative');

    const allLines = [
      ...(dto.cleaningLines || []).map((l) => ({
        ...l,
        stage: WastageStage.CLEANING,
        qty: toKg(l.quantity ?? 0, l.unit || 'KG'),
      })),
      ...(dto.hullingLines || []).map((l) => {
        let q = 0;
        if (l.numberOfBags != null && l.weightPerBag != null) {
          q = toKg(l.numberOfBags * l.weightPerBag, l.unit || 'KG');
        } else {
          q = toKg(l.quantity ?? 0, l.unit || 'KG');
        }
        return { ...l, stage: WastageStage.HULLING, qty: q };
      }),
    ].filter((l) => l.qty > 0);

    for (const line of allLines) {
      const disp = dto.dispositions.find((d) => d.wastageTypeId === line.wastageTypeId);
      if (!disp || ![JWDisposition.RETURNED, JWDisposition.DISCARDED_AT_WORKER, WastageDisposition.STORE, WastageDisposition.DISCARD].includes(disp.action as any)) {
        // Map STORE->RETURNED conceptually for JW; accept RETURNED / DISCARDED_AT_WORKER
        if (!disp) throw new BadRequestException(`Disposition required for wastage type ${line.wastageTypeId}`);
      }
    }

    const thresholdRow = await this.prisma.appSetting.findUnique({
      where: { key: WASTAGE_ALERT_THRESHOLD_KEY },
    });
    const threshold = Number(thresholdRow?.value ?? DEFAULT_WASTAGE_ALERT_PCT);
    const pct =
      dto.totalProcessedInputKg > 0
        ? Math.round((totalWastage / dto.totalProcessedInputKg) * 10000) / 100
        : 0;

    await this.tx(async (tx) => {
      await tx.jobWorkWastageDisposition.deleteMany({ where: { jobWorkId: id } });
      for (const line of allLines) {
        const disp = dto.dispositions.find((d) => d.wastageTypeId === line.wastageTypeId)!;
        const action =
          disp.action === WastageDisposition.STORE
            ? JWDisposition.RETURNED
            : disp.action === WastageDisposition.DISCARD
              ? JWDisposition.DISCARDED_AT_WORKER
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
          status: JobWorkStatus.AWAITING_RECONCILIATION,
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

  async close(id: string, dto: CloseJobWorkDto, user: JwtPayload) {
    const jw = await this.getOne(id);
    if (!jw.processResultEnteredAt) {
      throw new BadRequestException('Process result must be entered before closing');
    }
    const recon = jw.reconciliation;
    if (Math.abs(recon.quantityStillOutsideKg) > 0.001) {
      const isAdmin = [UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN].includes(user.role as any);
      if (!isAdmin || dto.varianceKg == null || !dto.varianceReason?.trim()) {
        throw new BadRequestException(
          `Unreconciled difference: ${recon.quantityStillOutsideKg} KG. Admin-authorised variance with reason required to close.`,
        );
      }
    }
    await this.prisma.jobWork.update({
      where: { id },
      data: {
        status: JobWorkStatus.CLOSED,
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
      newValue: JobWorkStatus.CLOSED,
      reason: dto.varianceReason,
    });
    return this.getOne(id);
  }

  async reopen(id: string, dto: CloseJobWorkDto, user: JwtPayload) {
    const jw = await this.getOne(id);
    if (jw.status !== JobWorkStatus.CLOSED) {
      throw new BadRequestException('Only closed Job Work can be reopened for correction');
    }
    const isAdmin = [UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN].includes(user.role as any);
    if (!isAdmin || !dto.varianceReason?.trim()) {
      throw new ForbiddenException('Admin-authorised reason is required to correct a closed Job Work');
    }
    await this.prisma.jobWork.update({
      where: { id },
      data: {
        status: JobWorkStatus.AWAITING_RECONCILIATION,
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
      oldValue: JobWorkStatus.CLOSED,
      newValue: JobWorkStatus.AWAITING_RECONCILIATION,
      reason: dto.varianceReason,
    });
    return this.getOne(id);
  }

  async startReSortex(id: string, dto: StartReSortexDto, user: JwtPayload) {
    const jw = await this.getOne(id);
    const availableLots = await this.prisma.processedOutputLot.findMany({
      where: {
        jobWorkId: id,
        productionSource: ProductionSource.JOB_WORK,
        availableKg: { gt: 0.001 },
        status: 'AVAILABLE',
      },
      orderBy: { completionDate: 'asc' },
    });
    const available = availableLots.reduce((s, l) => s + l.availableKg, 0);
    if (dto.quantityKg > available + 0.001) {
      throw new BadRequestException(`Only ${available} KG available for Re-Sortex`);
    }
    const plantId = dto.plantId || availableLots[0]?.plantId || jw.sourceLocationId;
    const productionNumber = await this.nextRunNumber();
    let remaining = dto.quantityKg;

    const run = await this.tx(async (tx) => {
      const created = await tx.productionRun.create({
        data: {
          productionNumber,
          plantId,
          processType: ProcessType.SORTEX,
          productId: jw.productId,
          status: ProductionRunStatus.CLEANING_IN_PROGRESS,
          startDate: new Date(dto.startDate),
          totalInputKg: dto.quantityKg,
          remarks: dto.remarks || `Re-Sortex from ${jw.jobWorkNumber}`,
          productionSource: ProductionSource.JOB_WORK,
          jobWorkId: id,
          createdById: user.sub,
        },
      });

      for (const lot of availableLots) {
        if (remaining <= 0.001) break;
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
            stockCategory: InputStockCategory.JOB_WORK_RETURNED_PROCESSED,
            processedLotId: lot.id,
            quantityKg: take,
            inputUnit: 'KG',
            addedById: user.sub,
          },
        });
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.PRODUCTION_ISSUE,
          productId: jw.productId,
          stockCategory: StockCategory.PROCESSED_AVAILABLE,
          locationId: lot.plantId,
          fromCategory: StockCategory.PROCESSED_AVAILABLE,
          toCategory: StockCategory.WIP_CLEANING,
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
      where: { status: { notIn: [JobWorkStatus.CLOSED, JobWorkStatus.CANCELLED] } },
    });
    const open = await this.prisma.jobWork.findMany({
      where: { status: { notIn: [JobWorkStatus.CLOSED, JobWorkStatus.CANCELLED] } },
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
        productionSource: ProductionSource.JOB_WORK,
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
}
