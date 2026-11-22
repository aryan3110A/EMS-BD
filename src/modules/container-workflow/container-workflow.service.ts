import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../common/services/notification.service';
import { InventoryLedgerService } from '../production/inventory-ledger.service';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ContainerStatus, UserRole } from '../../common/constants/enums';
import {
  decideSampling,
  LedgerTxnType,
  RejectedStockStatus,
  SamplingStatus,
  StockCategory,
} from '../../common/constants/production.constants';
import {
  allowedActions,
  ContainerSamplingStatus,
  deriveState,
  FulfilmentStatus,
  MANDATORY_DETAIL_FIELDS,
  POST_DISPATCH_STAGES,
  STAGE_LABELS,
  WorkflowAction,
  type FulfilmentLine,
  type WorkflowState,
} from './container-workflow.logic';
import type { ContainerWorkflowActionDto, SampleRecordUpdateDto } from './container-workflow.dto';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

/** Allocations that count towards a container's fulfilled quantity. REJECTED (failed sample) does not. */
export const COUNTED_ALLOCATION_STATUSES = ['ACTIVE', 'DISPATCHED'];

const CONTAINER_INCLUDE = {
  product: { select: { id: true, code: true, name: true } },
  packagingType: { select: { id: true, name: true } },
  packagingSize: { select: { id: true, label: true } },
  destinationPort: { include: { country: true } },
  products: {
    orderBy: { productIndex: 'asc' },
    include: {
      product: { select: { id: true, code: true, name: true } },
      packagingType: { select: { id: true, name: true } },
      packagingSize: { select: { id: true, label: true } },
    },
  },
  contract: {
    select: {
      id: true,
      contractNumber: true,
      status: true,
      officeId: true,
      euClassification: true,
      destinationCountry: true,
      buyer: { select: { id: true, name: true } },
      destinationPort: { include: { country: true } },
    },
  },
} satisfies Prisma.ContractContainerInclude;

type LoadedContainer = Prisma.ContractContainerGetPayload<{ include: typeof CONTAINER_INCLUDE }>;
type LoadedAllocation = Prisma.ContainerAllocationGetPayload<{
  include: {
    processedLot: { select: { id: true; lotNumber: true; plantId: true; reservedKg: true; processType: true } };
    productionRun: { select: { id: true; productionNumber: true; plantId: true; processType: true } };
  };
}>;
type LoadedSample = Prisma.SampleRecordGetPayload<object>;

const ACTION_LABELS: Record<string, string> = {
  [WorkflowAction.UPDATE_DETAILS]: 'Container details updated',
  [WorkflowAction.CORRECT_DETAILS_AFTER_DISPATCH]: 'Container details corrected after dispatch',
  [WorkflowAction.PROCEED_TO_SAMPLING]: 'Proceeded to sampling',
  [WorkflowAction.MARK_SAMPLE_SENT]: 'Sample collected / sent',
  [WorkflowAction.MARK_AWAITING_RESULT]: 'Sample submitted — awaiting result',
  [WorkflowAction.RECORD_RESULT]: 'Sampling result recorded',
  [WorkflowAction.APPROVE_SAMPLING]: 'Sampling approved for dispatch',
  [WorkflowAction.MARK_READY_FOR_DISPATCH]: 'Marked ready for dispatch',
  [WorkflowAction.MARK_DISPATCHED]: 'Container dispatched',
  [WorkflowAction.MARK_REACHED_PORT]: 'Container reached port',
  [WorkflowAction.MARK_SHIPPED]: 'Container shipped',
  [WorkflowAction.PUT_ON_HOLD]: 'Container put on hold',
  [WorkflowAction.RELEASE_HOLD]: 'Hold released',
};

const dayMs = 86400000;
const daysSince = (d?: Date | null, until: Date = new Date()) =>
  d ? Math.max(0, Math.floor((until.getTime() - new Date(d).getTime()) / dayMs)) : null;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export type SyncResult = {
  containerId: string;
  contractId: string;
  contractNumber: string;
  containerIndex: number;
  previousStage: string | null;
  stage: string;
  becameFulfilled: boolean;
  state: WorkflowState;
};

/**
 * Single source of truth for a contract container's operational state (ERP Changes 22.11.26).
 * Production finalisation, the Fulfilment tab, sampling, dispatch, contract edits and the
 * dashboards all go through here and all use the same ContractContainer id.
 */
@Injectable()
export class ContainerWorkflowService {
  private readonly logger = new Logger(ContainerWorkflowService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: InventoryLedgerService,
    private notifications: NotificationService,
  ) {}

  // ── Loading & derivation ──────────────────────────────────────────────

  private async load(db: Db, where: Prisma.ContractContainerWhereInput) {
    const containers = await db.contractContainer.findMany({
      where,
      include: CONTAINER_INCLUDE,
      orderBy: [{ contractId: 'asc' }, { containerIndex: 'asc' }],
    });
    const ids = containers.map((c) => c.id);
    const [allocations, samples] = ids.length
      ? await Promise.all([
          db.containerAllocation.findMany({
            where: { containerId: { in: ids } },
            include: {
              processedLot: { select: { id: true, lotNumber: true, plantId: true, reservedKg: true, processType: true } },
              productionRun: { select: { id: true, productionNumber: true, plantId: true, processType: true } },
            },
            orderBy: { allocationDate: 'asc' },
          }),
          db.sampleRecord.findMany({ where: { containerId: { in: ids } }, orderBy: { createdAt: 'asc' } }),
        ])
      : [[], []];
    const allocByContainer = new Map<string, LoadedAllocation[]>();
    for (const a of allocations as LoadedAllocation[]) {
      allocByContainer.set(a.containerId, [...(allocByContainer.get(a.containerId) || []), a]);
    }
    const samplesByContainer = new Map<string, LoadedSample[]>();
    for (const s of samples as LoadedSample[]) {
      samplesByContainer.set(s.containerId, [...(samplesByContainer.get(s.containerId) || []), s]);
    }
    return containers.map((c) => ({
      container: c,
      allocations: allocByContainer.get(c.id) || [],
      samples: samplesByContainer.get(c.id) || [],
    }));
  }

  /** Destination resolution: container port → contract port → contract country text (PDF §10.2, §10.4). */
  samplingFor(c: LoadedContainer) {
    const country = c.destinationPort?.country || c.contract.destinationPort?.country || null;
    return decideSampling({
      countryName: country?.name,
      countryCode: country?.code,
      countryEuClassification: country?.euClassification,
      contractEuClassification: c.contract.euClassification,
      destinationCountryText: c.contract.destinationCountry,
    });
  }

  lines(c: LoadedContainer, allocations: LoadedAllocation[]): FulfilmentLine[] {
    const counted = allocations.filter((a) => COUNTED_ALLOCATION_STATUSES.includes(a.status));
    if (c.products.length > 0) {
      return c.products.map((p) => ({
        id: p.id,
        productId: p.productId,
        productName: p.product?.name,
        requiredKg: round3((p.quantityMt || 0) * 1000),
        fulfilledKg: round3(
          counted
            .filter((a) => a.containerProductId === p.id || (!a.containerProductId && a.productId === p.productId))
            .reduce((s, a) => s + a.quantityKg, 0),
        ),
      }));
    }
    return [
      {
        id: null,
        productId: c.productId,
        productName: c.product?.name,
        requiredKg: round3((c.quantityMt || 0) * 1000),
        fulfilledKg: round3(counted.filter((a) => a.productId === c.productId).reduce((s, a) => s + a.quantityKg, 0)),
      },
    ];
  }

  private stateOf(row: { container: LoadedContainer; allocations: LoadedAllocation[]; samples: LoadedSample[] }) {
    const c = row.container;
    return deriveState({
      storedStatus: c.containerStatus,
      lines: this.lines(c, row.allocations),
      details: c,
      sampling: this.samplingFor(c),
      samples: row.samples,
      readyForDispatchAt: c.readyForDispatchAt,
      dispatchedAt: c.dispatchedAt,
    });
  }

  // ── Sync: recompute and persist stage + timestamps ────────────────────

  async sync(tx: Tx, containerId: string, userId: string | null, remark?: string): Promise<SyncResult | null> {
    const [row] = await this.load(tx, { id: containerId });
    if (!row) return null;
    const c = row.container;
    const state = this.stateOf(row);
    const now = new Date();
    const counted = row.allocations.filter((a) => COUNTED_ALLOCATION_STATUSES.includes(a.status));
    const isFulfilled = state.fulfilment.status === FulfilmentStatus.FULFILLED;
    const detailsComplete = state.details.status === 'COMPLETED';

    const data: Prisma.ContractContainerUpdateInput = {};
    if (!c.firstAllocatedAt && counted.length) data.firstAllocatedAt = counted[0].allocationDate || now;
    if (isFulfilled && !c.fulfilledAt) data.fulfilledAt = now;
    if (!isFulfilled && c.fulfilledAt && !POST_DISPATCH_STAGES.includes(state.stage)) data.fulfilledAt = null;
    if (detailsComplete && !c.detailsCompletedAt) data.detailsCompletedAt = now;
    if (!detailsComplete && c.detailsCompletedAt) data.detailsCompletedAt = null;
    let revalidated = false;
    if (c.readyForDispatchAt && !state.readyStillValid && state.dispatchStatus !== 'DISPATCHED') {
      data.readyForDispatchAt = null;
      data.readyForDispatchById = null;
      revalidated = true;
    }
    if (state.stage !== c.containerStatus) data.containerStatus = state.stage;

    if (Object.keys(data).length) {
      await tx.contractContainer.update({ where: { id: containerId }, data });
    }
    if (state.stage !== c.containerStatus) {
      const why = revalidated
        ? 'Dispatch readiness revalidated (fulfilment, details or sampling requirement changed)'
        : remark || 'Status recalculated';
      await tx.containerStatusHistory.create({
        data: {
          containerId,
          contractId: c.contractId,
          fromStatus: c.containerStatus,
          toStatus: state.stage,
          updatedById: userId,
          remarks: why,
        },
      });
    }
    return {
      containerId,
      contractId: c.contractId,
      contractNumber: c.contract.contractNumber,
      containerIndex: c.containerIndex,
      previousStage: c.containerStatus,
      stage: state.stage,
      becameFulfilled: isFulfilled && !c.fulfilledAt,
      state,
    };
  }

  async syncContract(tx: Tx, contractId: string, userId: string | null, remark?: string) {
    const containers = await tx.contractContainer.findMany({ where: { contractId }, select: { id: true } });
    const results: SyncResult[] = [];
    for (const c of containers) {
      const r = await this.sync(tx, c.id, userId, remark);
      if (r) results.push(r);
    }
    return results;
  }

  /** One-off / maintenance: recompute every container (used once after the workflow upgrade). */
  async resyncAll(userId: string | null, remark = 'System re-sync after container workflow upgrade') {
    const ids = await this.prisma.contractContainer.findMany({ select: { id: true } });
    let changed = 0;
    for (const { id } of ids) {
      await this.prisma.$transaction(async (tx) => {
        const r = await this.sync(tx, id, userId, remark);
        if (r && r.previousStage !== r.stage) changed += 1;
      });
    }
    return { containers: ids.length, changed };
  }

  // ── Read models ───────────────────────────────────────────────────────

  private canSeeAllOffices(user: JwtPayload) {
    return [
      UserRole.SUPER_ADMIN,
      UserRole.CONTRACT_TEAM,
      UserRole.SUPER_SALES,
      UserRole.PRODUCTION_TEAM,
      UserRole.INVENTORY_TEAM,
    ].includes(user.role as any);
  }

  private scopeWhere(user: JwtPayload): Prisma.ContractWhereInput {
    return this.canSeeAllOffices(user) ? {} : { officeId: user.officeId ?? '__none__' };
  }

  private async userNames(ids: (string | null | undefined)[]) {
    const unique = [...new Set(ids.filter(Boolean))] as string[];
    if (!unique.length) return new Map<string, string>();
    const users = await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private buildView(
    row: { container: LoadedContainer; allocations: LoadedAllocation[]; samples: LoadedSample[] },
    role: string,
    names: Map<string, string>,
    history: { toStatus: string; createdAt: Date }[] = [],
  ) {
    const c = row.container;
    const state = this.stateOf(row);
    const sampling = this.samplingFor(c);
    const lines = this.lines(c, row.allocations);
    const now = new Date();
    const dispatched = state.dispatchStatus === 'DISPATCHED';
    const until = dispatched && c.dispatchedAt ? new Date(c.dispatchedAt) : now;
    const enteredStageAt = (stages: string[]) => {
      const h = [...history].reverse().find((x) => stages.includes(x.toStatus));
      return h ? h.createdAt : null;
    };
    const currentSamples = row.samples.filter((s) => s.status !== SamplingStatus.FAILED);
    const latest = (currentSamples.length ? currentSamples : row.samples).slice(-1)[0];
    const packaging = c.products.length
      ? c.products.map((p) => p.packagingSize?.label || p.packagingType?.name || p.packingDescription).filter(Boolean).join(', ')
      : c.packagingSize?.label || c.packagingType?.name || c.packingDescription || null;
    const productLabel = c.products.length
      ? c.products.map((p) => p.product?.name).filter(Boolean).join(', ')
      : c.product?.name;

    return {
      containerId: c.id,
      containerIndex: c.containerIndex,
      stage: state.stage,
      stageLabel: STAGE_LABELS[state.stage] || state.stage,
      contract: {
        id: c.contract.id,
        contractNumber: c.contract.contractNumber,
        status: c.contract.status,
        buyer: c.contract.buyer?.name || null,
        product: productLabel,
        destinationCountry: sampling.countryName,
        destinationPort: c.destinationPort?.name || c.contract.destinationPort?.name || null,
        euClassification: sampling.euClassification,
        packaging,
        requiredKg: state.fulfilment.requiredKg,
        expectedShipmentDate: c.expectedShipmentDate,
      },
      fulfilment: {
        ...state.fulfilment,
        lines,
        firstAllocationDate: c.firstAllocatedAt || row.allocations[0]?.allocationDate || null,
        fullFulfilmentDate: c.fulfilledAt,
        lots: row.allocations.map((a) => ({
          id: a.id,
          status: a.status,
          quantityKg: a.quantityKg,
          allocationDate: a.allocationDate,
          lotNumber: a.processedLot?.lotNumber || null,
          productionNumber: a.productionRun?.productionNumber || null,
          productId: a.productId,
        })),
      },
      details: {
        status: state.details.status,
        missing: state.details.missing,
        containerNo: c.containerNo,
        factorySealNo: c.factorySealNo,
        shippingLineName: c.shippingLineName,
        shippingLineSealNo: c.shippingLineSealNo,
        remarks: c.containerDetailsRemarks,
        updatedAt: c.detailsUpdatedAt,
        updatedBy: c.detailsUpdatedById ? names.get(c.detailsUpdatedById) || null : null,
      },
      sampling: {
        required: state.samplingRequired,
        reason: sampling.reason,
        status: state.samplingStatus,
        samplingDate: latest?.collectionDate || null,
        resultStatus: latest?.result || null,
        resultDate: latest?.resultDate || null,
        approvedAt: latest?.approvedAt || null,
        records: row.samples.map((s) => ({
          id: s.id,
          productId: s.productId,
          status: s.status,
          result: s.result,
          samplingType: s.samplingType,
          sampleReference: s.sampleReference,
          testingAgency: s.testingAgency,
          collectionDate: s.collectionDate,
          resultDate: s.resultDate,
          reportReference: s.reportReference,
          approvedAt: s.approvedAt,
          remarks: s.remarks,
          updatedBy: s.updatedById ? names.get(s.updatedById) || null : null,
          createdAt: s.createdAt,
        })),
      },
      dispatch: {
        status: state.dispatchStatus,
        readyForDispatchAt: c.readyForDispatchAt,
        readyBy: c.readyForDispatchById ? names.get(c.readyForDispatchById) || null : null,
        dispatchedAt: c.dispatchedAt,
        dispatchedBy: c.dispatchedById ? names.get(c.dispatchedById) || null : null,
        dispatchRemarks: c.dispatchRemarks,
        actualShipmentDate: c.actualShipmentDate,
      },
      aging: {
        daysSinceFirstAllocation: daysSince(c.firstAllocatedAt || row.allocations[0]?.allocationDate, until),
        daysSinceFullFulfilment: daysSince(c.fulfilledAt, until),
        daysWaitingForSampling:
          state.samplingRequired &&
          [ContainerSamplingStatus.NOT_STARTED, ContainerSamplingStatus.PENDING].includes(state.samplingStatus as any) &&
          state.fulfilment.status === FulfilmentStatus.FULFILLED
            ? daysSince(enteredStageAt([ContainerStatus.READY_FOR_SAMPLING]) || c.detailsCompletedAt || c.fulfilledAt)
            : null,
        daysAwaitingResult: [ContainerSamplingStatus.SAMPLE_SENT, ContainerSamplingStatus.AWAITING_RESULT].includes(
          state.samplingStatus as any,
        )
          ? daysSince(latest?.collectionDate || enteredStageAt([ContainerStatus.SAMPLE_SENT, ContainerStatus.AWAITING_SAMPLING_RESULT]))
          : null,
        daysReadyForDispatch: state.stage === ContainerStatus.READY_FOR_DISPATCH ? daysSince(c.readyForDispatchAt) : null,
      },
      availableActions: allowedActions(state, role),
    };
  }

  async getContractWorkflow(contractId: string, user: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId }, select: { id: true, officeId: true } });
    if (!contract) throw new NotFoundException('Contract not found');
    if (!this.canSeeAllOffices(user) && user.officeId !== contract.officeId) throw new ForbiddenException('Access denied');
    const rows = await this.load(this.prisma, { contractId });
    const history = await this.prisma.containerStatusHistory.findMany({
      where: { contractId },
      include: { updatedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const names = await this.userNames(
      rows.flatMap((r) => [
        r.container.detailsUpdatedById,
        r.container.readyForDispatchById,
        r.container.dispatchedById,
        ...r.samples.map((s) => s.updatedById),
      ]),
    );
    return rows.map((r) => {
      const h = history.filter((x) => x.containerId === r.container.id);
      return {
        ...this.buildView(r, user.role, names, h),
        history: h
          .slice()
          .reverse()
          .map((x) => ({
            fromStatus: x.fromStatus,
            fromLabel: x.fromStatus ? STAGE_LABELS[x.fromStatus] || x.fromStatus : null,
            toStatus: x.toStatus,
            toLabel: STAGE_LABELS[x.toStatus] || x.toStatus,
            remarks: x.remarks,
            changedBy: x.updatedBy?.name || 'System',
            createdAt: x.createdAt,
          })),
      };
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────

  async performAction(contractId: string, containerId: string, dto: ContainerWorkflowActionDto, user: JwtPayload) {
    const [row] = await this.load(this.prisma, { id: containerId, contractId });
    if (!row) throw new NotFoundException('Container not found on this contract');
    if (!this.canSeeAllOffices(user) && user.officeId !== row.container.contract.officeId) {
      throw new ForbiddenException('Access denied');
    }
    const state = this.stateOf(row);
    const allowed = allowedActions(state, user.role);
    if (!allowed.includes(dto.action as WorkflowAction)) {
      throw new BadRequestException(
        `"${dto.action.replace(/_/g, ' ').toLowerCase()}" is not available while the container is "${
          STAGE_LABELS[state.stage] || state.stage
        }"` + (allowed.length ? `. Available: ${allowed.map((a) => a.replace(/_/g, ' ').toLowerCase()).join(', ')}` : ''),
      );
    }
    const c = row.container;
    const now = new Date();
    const remark = [ACTION_LABELS[dto.action], dto.remarks?.trim()].filter(Boolean).join(' — ');

    const result = await this.prisma.$transaction(
      async (tx) => {
        switch (dto.action) {
          case WorkflowAction.UPDATE_DETAILS:
          case WorkflowAction.CORRECT_DETAILS_AFTER_DISPATCH:
            await this.applyDetails(tx, c, dto, user, dto.action === WorkflowAction.CORRECT_DETAILS_AFTER_DISPATCH);
            break;
          case WorkflowAction.PROCEED_TO_SAMPLING:
            await this.startSampling(tx, row);
            break;
          case WorkflowAction.MARK_SAMPLE_SENT:
            await this.updateCurrentSamples(tx, row.samples, {
              status: SamplingStatus.SAMPLE_COLLECTED,
              collectionDate: dto.samplingDate ? new Date(dto.samplingDate) : now,
              samplingType: dto.samplingType?.trim() || null,
              sampleReference: dto.sampleReference?.trim() || null,
              remarks: dto.remarks?.trim() || null,
              updatedById: user.sub,
            });
            break;
          case WorkflowAction.MARK_AWAITING_RESULT:
            await this.updateCurrentSamples(tx, row.samples, {
              status: SamplingStatus.TESTING_IN_PROGRESS,
              testingAgency: dto.testingAgency?.trim() || undefined,
              updatedById: user.sub,
            });
            break;
          case WorkflowAction.RECORD_RESULT: {
            if (!dto.result) throw new BadRequestException('Result (PASSED or FAILED) is required');
            const current = row.samples.filter((s) => s.status !== SamplingStatus.FAILED);
            for (const s of current) {
              await this.recordSampleResult(tx, s, {
                result: dto.result,
                resultDate: dto.resultDate ? new Date(dto.resultDate) : now,
                reportReference: dto.resultReference?.trim() || null,
                testingAgency: dto.testingAgency?.trim() || undefined,
                remarks: dto.remarks?.trim() || null,
              }, user.sub);
            }
            break;
          }
          case WorkflowAction.APPROVE_SAMPLING:
            await this.updateCurrentSamples(tx, row.samples, {
              status: SamplingStatus.PASSED,
              approvedAt: now,
              approvedById: user.sub,
              updatedById: user.sub,
            });
            break;
          case WorkflowAction.MARK_READY_FOR_DISPATCH:
            await tx.contractContainer.update({
              where: { id: c.id },
              data: { readyForDispatchAt: now, readyForDispatchById: user.sub },
            });
            break;
          case WorkflowAction.MARK_DISPATCHED:
            await this.dispatch(tx, row, dto, user);
            break;
          case WorkflowAction.MARK_REACHED_PORT:
            await tx.contractContainer.update({ where: { id: c.id }, data: { containerStatus: ContainerStatus.REACHED_PORT } });
            await this.historyRow(tx, c, ContainerStatus.REACHED_PORT, user.sub, remark);
            break;
          case WorkflowAction.MARK_SHIPPED:
            await tx.contractContainer.update({
              where: { id: c.id },
              data: {
                containerStatus: ContainerStatus.SHIPPED,
                dispatchStatus: 'SHIPPED',
                actualShipmentDate: dto.shipmentDate ? new Date(dto.shipmentDate) : now,
              },
            });
            await this.historyRow(tx, c, ContainerStatus.SHIPPED, user.sub, remark);
            break;
          case WorkflowAction.PUT_ON_HOLD:
            if (!dto.reason?.trim()) throw new BadRequestException('A reason is required to put a container on hold');
            await tx.contractContainer.update({ where: { id: c.id }, data: { containerStatus: ContainerStatus.ON_HOLD } });
            await this.historyRow(tx, c, ContainerStatus.ON_HOLD, user.sub, `${ACTION_LABELS[dto.action]} — ${dto.reason.trim()}`);
            break;
          case WorkflowAction.RELEASE_HOLD:
            await tx.contractContainer.update({
              where: { id: c.id },
              data: { containerStatus: ContainerStatus.AWAITING_FULFILMENT },
            });
            break;
          default:
            throw new BadRequestException('Unknown action');
        }
        return this.sync(tx, c.id, user.sub, remark);
      },
      { maxWait: 10000, timeout: 30000 },
    );

    if (result && result.previousStage !== result.stage) {
      await this.notifyStage(result, user);
    }
    const [view] = (await this.getContractWorkflow(contractId, user)).filter((v) => v.containerId === containerId);
    return view;
  }

  private async historyRow(tx: Tx, c: LoadedContainer, toStatus: string, userId: string, remarks: string) {
    if (c.containerStatus === toStatus) return;
    await tx.containerStatusHistory.create({
      data: { containerId: c.id, contractId: c.contractId, fromStatus: c.containerStatus, toStatus, updatedById: userId, remarks },
    });
  }

  private async applyDetails(tx: Tx, c: LoadedContainer, dto: ContainerWorkflowActionDto, user: JwtPayload, correction: boolean) {
    if (correction && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required to correct details after dispatch');
    }
    const fields: [keyof ContainerWorkflowActionDto & string, string][] = [
      ...MANDATORY_DETAIL_FIELDS.map(([k, l]) => [k, l] as [any, string]),
      ['remarks', 'Container Details Remarks'],
    ];
    const data: Record<string, unknown> = {};
    const audit: Prisma.ContractAuditLogCreateManyInput[] = [];
    for (const [key, label] of fields) {
      const incoming = dto[key];
      if (incoming === undefined) continue;
      const column = key === 'remarks' ? 'containerDetailsRemarks' : key;
      const next = typeof incoming === 'string' ? incoming.trim() || null : null;
      const prev = (c as any)[column] ?? null;
      if ((prev ?? null) === next) continue;
      data[column] = next;
      audit.push({
        contractId: c.contractId,
        contractNumber: c.contract.contractNumber,
        containerId: c.id,
        containerIndex: c.containerIndex,
        fieldName: correction ? `${label} (post-dispatch correction: ${dto.reason!.trim()})` : label,
        previousValue: prev,
        newValue: next,
        changedById: user.sub,
      });
    }
    if (!audit.length) throw new BadRequestException('No container details were changed');
    await tx.contractContainer.update({
      where: { id: c.id },
      data: { ...data, detailsUpdatedAt: new Date(), detailsUpdatedById: user.sub },
    });
    await tx.contractAuditLog.createMany({ data: audit });
  }

  private async startSampling(tx: Tx, row: { container: LoadedContainer; allocations: LoadedAllocation[] }) {
    const c = row.container;
    const productIds = [...new Set(this.lines(c, row.allocations).map((l) => l.productId))];
    for (const productId of productIds) {
      const alloc = row.allocations.find((a) => a.productId === productId && COUNTED_ALLOCATION_STATUSES.includes(a.status));
      await tx.sampleRecord.create({
        data: {
          contractId: c.contractId,
          containerId: c.id,
          productId,
          allocationId: alloc?.id,
          productionRunId: alloc?.productionRunId || null,
          processedLotId: alloc?.processedLotId || null,
          status: SamplingStatus.READY_FOR_SAMPLING,
        },
      });
    }
    await tx.contractContainer.update({ where: { id: c.id }, data: { samplingStartedAt: new Date() } });
  }

  private async updateCurrentSamples(tx: Tx, samples: LoadedSample[], data: Prisma.SampleRecordUncheckedUpdateManyInput) {
    const ids = samples.filter((s) => s.status !== SamplingStatus.FAILED).map((s) => s.id);
    if (!ids.length) throw new BadRequestException('No open sampling record for this container');
    await tx.sampleRecord.updateMany({ where: { id: { in: ids } }, data });
  }

  /** PASSED → Result Received (approval is a separate step). FAILED → existing rejection workflow. */
  private async recordSampleResult(
    tx: Tx,
    sample: LoadedSample,
    r: { result: string; resultDate: Date; reportReference: string | null; testingAgency?: string; remarks: string | null },
    userId: string,
  ) {
    const passed = r.result.toUpperCase() === 'PASSED';
    await tx.sampleRecord.update({
      where: { id: sample.id },
      data: {
        status: passed ? SamplingStatus.RESULT_RECEIVED : SamplingStatus.FAILED,
        result: passed ? 'PASSED' : 'FAILED',
        resultDate: r.resultDate,
        reportReference: r.reportReference,
        testingAgency: r.testingAgency,
        remarks: r.remarks,
        updatedById: userId,
      },
    });
    if (!passed) await this.applySampleFailure(tx, sample, userId, r.remarks);
  }

  /**
   * Failed sample: the allocated quantity for that product moves to Sample-Rejected stock
   * (available for Sortex reprocessing) and the allocation stops counting as fulfilled.
   * Reuses the pre-existing rejection workflow (PDF §12.3).
   */
  async applySampleFailure(tx: Tx, sample: LoadedSample, userId: string, remarks?: string | null) {
    const allocs = await tx.containerAllocation.findMany({
      where: { containerId: sample.containerId, productId: sample.productId, status: 'ACTIVE' },
      include: { processedLot: { select: { id: true, plantId: true, reservedKg: true } }, productionRun: { select: { plantId: true } } },
    });
    if (!allocs.length) return;
    const byPlant = new Map<string, number>();
    for (const a of allocs) {
      const plant = a.processedLot?.plantId || a.productionRun?.plantId;
      if (!plant) continue;
      byPlant.set(plant, (byPlant.get(plant) || 0) + a.quantityKg);
    }
    const year = new Date().getFullYear();
    for (const [plantId, qty] of byPlant) {
      const prefix = `REJ-${year}-`;
      const latest = await tx.sampleRejectedLot.findFirst({ where: { lotNumber: { startsWith: prefix } }, orderBy: { lotNumber: 'desc' } });
      const next = latest ? (parseInt(latest.lotNumber.split('-').pop() || '0', 10) || 0) + 1 : 1;
      await tx.sampleRejectedLot.create({
        data: {
          lotNumber: `${prefix}${String(next).padStart(5, '0')}`,
          productId: sample.productId,
          quantityKg: qty,
          availableKg: qty,
          plantId,
          productionRunId: sample.productionRunId,
          contractId: sample.contractId,
          containerId: sample.containerId,
          sampleRecordId: sample.id,
          failureDate: new Date(),
          failureRemarks: remarks || null,
          status: RejectedStockStatus.AVAILABLE_FOR_SORTEX,
        },
      });
      await this.ledger.postTxn(tx, {
        txnType: LedgerTxnType.SAMPLE_REJECTION,
        productId: sample.productId,
        stockCategory: StockCategory.PROCESSED_RESERVED,
        locationId: plantId,
        fromCategory: StockCategory.PROCESSED_RESERVED,
        toCategory: StockCategory.SAMPLE_REJECTED,
        quantityOutKg: qty,
        quantityInKg: qty,
        referenceType: 'SAMPLE',
        referenceId: sample.id,
        createdById: userId,
      });
    }
    for (const a of allocs) {
      await tx.containerAllocation.update({ where: { id: a.id }, data: { status: 'REJECTED' } });
      if (a.processedLot) {
        await tx.processedOutputLot.update({
          where: { id: a.processedLot.id },
          data: { reservedKg: Math.max(0, round3((a.processedLot.reservedKg || 0) - a.quantityKg)) },
        });
      }
    }
  }

  /** Physical dispatch: stock leaves PROCESSED_RESERVED exactly once (PDF §15.3, §21G). */
  private async dispatch(
    tx: Tx,
    row: { container: LoadedContainer; allocations: LoadedAllocation[] },
    dto: ContainerWorkflowActionDto,
    user: JwtPayload,
  ) {
    const c = row.container;
    const active = row.allocations.filter((a) => a.status === 'ACTIVE');
    const byKey = new Map<string, { productId: string; plantId: string; qty: number }>();
    for (const a of active) {
      const plantId = a.processedLot?.plantId || a.productionRun?.plantId;
      if (!plantId) throw new BadRequestException(`Allocation ${a.id} has no plant reference; cannot post dispatch stock movement`);
      const key = `${a.productId}:${plantId}`;
      const cur = byKey.get(key) || { productId: a.productId, plantId, qty: 0 };
      cur.qty = round3(cur.qty + a.quantityKg);
      byKey.set(key, cur);
    }
    for (const m of byKey.values()) {
      try {
        await this.ledger.postTxn(tx, {
          txnType: LedgerTxnType.CONTAINER_DISPATCH,
          productId: m.productId,
          stockCategory: StockCategory.PROCESSED_RESERVED,
          sourceLocationId: m.plantId,
          quantityOutKg: m.qty,
          referenceType: 'CONTAINER_DISPATCH',
          referenceId: c.id,
          remarks: `Dispatch ${c.contract.contractNumber} container ${c.containerIndex}${c.containerNo ? ` (${c.containerNo})` : ''}`,
          createdById: user.sub,
        });
      } catch (e) {
        throw new BadRequestException(
          `Cannot post dispatch stock movement: ${(e as Error).message}. Check the allocated stock for this container.`,
        );
      }
    }
    for (const a of active) {
      await tx.containerAllocation.update({ where: { id: a.id }, data: { status: 'DISPATCHED' } });
      if (a.processedLot) {
        await tx.processedOutputLot.update({
          where: { id: a.processedLot.id },
          data: { reservedKg: Math.max(0, round3((a.processedLot.reservedKg || 0) - a.quantityKg)) },
        });
      }
    }
    const dispatchedAt = dto.dispatchDate ? new Date(dto.dispatchDate) : new Date();
    await tx.contractContainer.update({
      where: { id: c.id },
      data: {
        containerStatus: ContainerStatus.DISPATCHED_FROM_FACTORY,
        dispatchStatus: 'DISPATCHED',
        dispatchedAt,
        dispatchedById: user.sub,
        dispatchRemarks: dto.remarks?.trim() || null,
      },
    });
    await this.historyRow(
      tx,
      c,
      ContainerStatus.DISPATCHED_FROM_FACTORY,
      user.sub,
      [ACTION_LABELS[WorkflowAction.MARK_DISPATCHED], dto.remarks?.trim()].filter(Boolean).join(' — '),
    );
  }

  private async notifyStage(r: SyncResult, user: JwtPayload) {
    await this.notifications
      .notifyChange({
        type: 'CONTAINER_STATUS',
        contractId: r.contractId,
        containerId: r.containerId,
        message: `Contract ${r.contractNumber}, Container ${r.containerIndex}: ${STAGE_LABELS[r.previousStage || ''] || r.previousStage || '—'} → ${
          STAGE_LABELS[r.stage] || r.stage
        } (by ${user.name})`,
        oldValue: r.previousStage || undefined,
        newValue: r.stage,
        changedById: user.sub,
        targetRoles: [
          UserRole.SUPER_ADMIN,
          UserRole.OFFICE_ADMIN,
          UserRole.CONTRACT_TEAM,
          UserRole.PRODUCTION_TEAM,
          UserRole.SUPER_SALES,
        ],
      })
      .catch((e) => this.logger.warn(`notification failed: ${(e as Error).message}`));
  }

  // ── Sampling page (per sample record) ─────────────────────────────────

  /**
   * Per-record update from the Sampling screen, using the same rules as the container
   * actions: a passing result is "Result Received" until explicitly approved.
   */
  async updateSampleRecord(id: string, dto: SampleRecordUpdateDto, user: JwtPayload) {
    const sample = await this.prisma.sampleRecord.findUnique({ where: { id } });
    if (!sample) throw new NotFoundException('Sample not found');
    if (sample.status === SamplingStatus.FAILED) {
      throw new BadRequestException('This sample is closed as failed. Start a new sampling cycle from Container Status.');
    }
    const [row] = await this.load(this.prisma, { id: sample.containerId });
    if (!row) throw new NotFoundException('Container not found');
    const state = this.stateOf(row);
    if (!state.samplingRequired) {
      throw new BadRequestException('Sampling is not required for this container destination');
    }
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const step = dto.step;
      if (step === 'SENT') {
        await tx.sampleRecord.update({
          where: { id },
          data: {
            status: SamplingStatus.SAMPLE_COLLECTED,
            collectionDate: dto.samplingDate ? new Date(dto.samplingDate) : now,
            samplingType: dto.samplingType?.trim() || null,
            sampleReference: dto.sampleReference?.trim() || null,
            remarks: dto.remarks?.trim() || null,
            updatedById: user.sub,
          },
        });
      } else if (step === 'AWAITING_RESULT') {
        if (sample.status !== SamplingStatus.SAMPLE_COLLECTED) throw new BadRequestException('Mark the sample as sent first');
        await tx.sampleRecord.update({
          where: { id },
          data: { status: SamplingStatus.TESTING_IN_PROGRESS, testingAgency: dto.testingAgency?.trim() || undefined, updatedById: user.sub },
        });
      } else if (step === 'RESULT') {
        if (![SamplingStatus.SAMPLE_COLLECTED, SamplingStatus.TESTING_IN_PROGRESS].includes(sample.status as any)) {
          throw new BadRequestException('A result can only be recorded after the sample has been sent');
        }
        if (!dto.result) throw new BadRequestException('Result (PASSED or FAILED) is required');
        await this.recordSampleResult(tx, sample, {
          result: dto.result,
          resultDate: dto.resultDate ? new Date(dto.resultDate) : now,
          reportReference: dto.resultReference?.trim() || null,
          testingAgency: dto.testingAgency?.trim() || undefined,
          remarks: dto.remarks?.trim() || null,
        }, user.sub);
      } else if (step === 'APPROVE') {
        if (![UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.PRODUCTION_TEAM].includes(user.role as any)) {
          throw new ForbiddenException('Only Admin or Production can approve sampling');
        }
        if (sample.status !== SamplingStatus.RESULT_RECEIVED) {
          throw new BadRequestException('Only a received passing result can be approved');
        }
        await tx.sampleRecord.update({
          where: { id },
          data: { status: SamplingStatus.PASSED, approvedAt: now, approvedById: user.sub, updatedById: user.sub },
        });
      } else {
        throw new BadRequestException('Unknown sampling step');
      }
      return this.sync(tx, sample.containerId, user.sub, `Sampling: ${step.toLowerCase().replace(/_/g, ' ')}`);
    });
    if (result && result.previousStage !== result.stage) await this.notifyStage(result, user);
    return this.prisma.sampleRecord.findUnique({ where: { id }, include: { product: true } });
  }

  // ── Dashboard (PDF §16, §17, §19) ─────────────────────────────────────

  async getDashboard(user: JwtPayload) {
    const rows = await this.load(this.prisma, {
      containerStatus: { not: ContainerStatus.CANCELLED },
      contract: { status: { notIn: ['CANCELLED', 'DRAFT'] }, ...this.scopeWhere(user) },
    });
    const containerIds = rows.map((r) => r.container.id);
    const history = containerIds.length
      ? await this.prisma.containerStatusHistory.findMany({
          where: { containerId: { in: containerIds } },
          select: { containerId: true, toStatus: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const names = new Map<string, string>();
    const views = rows.map((r) =>
      this.buildView(r, user.role, names, history.filter((h) => h.containerId === r.container.id)),
    );
    const item = (v: (typeof views)[number]) => ({
      contractId: v.contract.id,
      contractNumber: v.contract.contractNumber,
      containerId: v.containerId,
      containerIndex: v.containerIndex,
      containerNo: v.details.containerNo,
      buyer: v.contract.buyer,
      product: v.contract.product,
      destination: v.contract.destinationCountry,
      stage: v.stage,
      stageLabel: v.stageLabel,
      fulfilledKg: v.fulfilment.fulfilledKg,
      requiredKg: v.fulfilment.requiredKg,
      samplingStatus: v.sampling.status,
      ...v.aging,
    });
    const dispatched = (v: (typeof views)[number]) => v.dispatch.status === 'DISPATCHED';
    const bucket = (pred: (v: (typeof views)[number]) => boolean) => {
      const list = views.filter(pred).map(item);
      return { count: list.length, containers: list };
    };
    const notOnHold = (v: (typeof views)[number]) => v.stage !== ContainerStatus.ON_HOLD;

    const containers = {
      notFulfilled: bucket((v) => !dispatched(v) && notOnHold(v) && v.fulfilment.status === FulfilmentStatus.NOT_FULFILLED),
      partiallyFulfilled: bucket((v) => !dispatched(v) && v.fulfilment.status === FulfilmentStatus.PARTIALLY_FULFILLED),
      fulfilledPendingDispatch: bucket((v) => !dispatched(v) && v.fulfilment.status === FulfilmentStatus.FULFILLED),
      readyForDispatch: bucket((v) => v.stage === ContainerStatus.READY_FOR_DISPATCH),
      dispatched: bucket(dispatched),
      onHold: bucket((v) => v.stage === ContainerStatus.ON_HOLD),
      total: views.length,
    };

    // Sampling KPIs: EU / Russia containers only, not yet dispatched (PDF §17.1–17.3)
    const sampled = views.filter((v) => v.sampling.required && !dispatched(v));
    const sBucket = (statuses: string[]) => {
      const list = sampled.filter((v) => statuses.includes(v.sampling.status)).map(item);
      return { count: list.length, containers: list };
    };
    const sampling = {
      applicableContainers: sampled.length,
      notRequiredContainers: views.filter((v) => !v.sampling.required && !dispatched(v)).length,
      pending: sBucket([ContainerSamplingStatus.NOT_STARTED, ContainerSamplingStatus.PENDING]),
      sent: sBucket([ContainerSamplingStatus.SAMPLE_SENT]),
      awaitingResult: sBucket([ContainerSamplingStatus.AWAITING_RESULT]),
      resultReceived: sBucket([ContainerSamplingStatus.RESULT_RECEIVED]),
      approved: sBucket([ContainerSamplingStatus.APPROVED]),
      rejectedOnHold: sBucket([ContainerSamplingStatus.REJECTED]),
    };

    // Aging (PDF §19): undispatched containers with material assigned, oldest first
    const aging = views
      .filter((v) => !dispatched(v) && v.aging.daysSinceFirstAllocation != null)
      .map(item)
      .sort((a, b) => (b.daysSinceFirstAllocation ?? 0) - (a.daysSinceFirstAllocation ?? 0))
      .slice(0, 50);

    return { containers, sampling, aging, generatedAt: new Date() };
  }

  /** Remaining (unfulfilled) KG per container line — used to prevent over-fulfilment. */
  async remainingFor(tx: Db, containerId: string) {
    const [row] = await this.load(tx, { id: containerId });
    if (!row) throw new NotFoundException('Container not found');
    return {
      container: row.container,
      lines: this.lines(row.container, row.allocations).map((l) => ({ ...l, remainingKg: round3(Math.max(0, l.requiredKg - l.fulfilledKg)) })),
      dispatched: POST_DISPATCH_STAGES.includes(row.container.containerStatus) || !!row.container.dispatchedAt,
    };
  }
}
