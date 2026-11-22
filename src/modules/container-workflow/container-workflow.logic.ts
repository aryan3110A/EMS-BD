/**
 * Pure container-workflow rules (ERP Changes 22.11.26 §6–§20). No database access here,
 * so every rule is unit-testable. ContainerWorkflowService feeds records in and persists
 * the result.
 */
import { ContainerStatus, UserRole } from '../../common/constants/enums';
import { SamplingStatus, type SamplingDecision } from '../../common/constants/production.constants';

export const FulfilmentStatus = {
  NOT_FULFILLED: 'NOT_FULFILLED',
  PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
  FULFILLED: 'FULFILLED',
} as const;
export type FulfilmentStatus = (typeof FulfilmentStatus)[keyof typeof FulfilmentStatus];

export const ContainerSamplingStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  SAMPLE_SENT: 'SAMPLE_SENT',
  AWAITING_RESULT: 'AWAITING_RESULT',
  RESULT_RECEIVED: 'RESULT_RECEIVED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ContainerSamplingStatus = (typeof ContainerSamplingStatus)[keyof typeof ContainerSamplingStatus];

export const DispatchState = {
  NOT_READY: 'NOT_READY',
  READY: 'READY',
  DISPATCHED: 'DISPATCHED',
} as const;
export type DispatchState = (typeof DispatchState)[keyof typeof DispatchState];

export const WorkflowAction = {
  UPDATE_DETAILS: 'UPDATE_DETAILS',
  CORRECT_DETAILS_AFTER_DISPATCH: 'CORRECT_DETAILS_AFTER_DISPATCH',
  PROCEED_TO_SAMPLING: 'PROCEED_TO_SAMPLING',
  MARK_SAMPLE_SENT: 'MARK_SAMPLE_SENT',
  MARK_AWAITING_RESULT: 'MARK_AWAITING_RESULT',
  RECORD_RESULT: 'RECORD_RESULT',
  APPROVE_SAMPLING: 'APPROVE_SAMPLING',
  MARK_READY_FOR_DISPATCH: 'MARK_READY_FOR_DISPATCH',
  MARK_DISPATCHED: 'MARK_DISPATCHED',
  MARK_REACHED_PORT: 'MARK_REACHED_PORT',
  MARK_SHIPPED: 'MARK_SHIPPED',
  PUT_ON_HOLD: 'PUT_ON_HOLD',
  RELEASE_HOLD: 'RELEASE_HOLD',
} as const;
export type WorkflowAction = (typeof WorkflowAction)[keyof typeof WorkflowAction];

/** Stages that mean "the container has physically left the factory". */
export const POST_DISPATCH_STAGES: string[] = [
  ContainerStatus.DISPATCHED_FROM_FACTORY,
  ContainerStatus.REACHED_PORT,
  ContainerStatus.SHIPPED,
  ContainerStatus.COMPLETED,
];
/** Stages that existed before fulfilment tracking (kept for compatibility, all mean "not fulfilled"). */
export const PRE_FULFILMENT_STAGES: string[] = [
  ContainerStatus.DRAFT,
  ContainerStatus.UNDER_PREPARATION,
  ContainerStatus.PRODUCTION_ASSIGNED,
  ContainerStatus.UNDER_PROCESSING,
  ContainerStatus.PROCESSING_COMPLETED,
  ContainerStatus.PLANNED,
  ContainerStatus.AWAITING_FULFILMENT,
];

/** Sample-record statuses that close a sampling cycle as rejected / on hold. */
const FAILED_SAMPLE_STATUSES: string[] = [SamplingStatus.FAILED];
const HOLD_SAMPLE_STATUSES: string[] = [SamplingStatus.REPROCESSING_REQUIRED, SamplingStatus.RESAMPLING_REQUIRED];
const SAMPLE_RANK: Record<string, number> = {
  [SamplingStatus.NOT_READY]: 1,
  [SamplingStatus.READY_FOR_SAMPLING]: 1,
  [SamplingStatus.SAMPLE_COLLECTED]: 2,
  [SamplingStatus.TESTING_IN_PROGRESS]: 3,
  [SamplingStatus.RESULT_RECEIVED]: 4,
  [SamplingStatus.PASSED]: 5,
};
const RANK_TO_STATUS: Record<number, ContainerSamplingStatus> = {
  1: ContainerSamplingStatus.PENDING,
  2: ContainerSamplingStatus.SAMPLE_SENT,
  3: ContainerSamplingStatus.AWAITING_RESULT,
  4: ContainerSamplingStatus.RESULT_RECEIVED,
  5: ContainerSamplingStatus.APPROVED,
};

export const MANDATORY_DETAIL_FIELDS = [
  ['containerNo', 'Container Number'],
  ['factorySealNo', 'Factory Seal Number'],
  ['shippingLineName', 'Shipping Line Name'],
  ['shippingLineSealNo', 'Shipping Line Seal Number'],
] as const;

export type FulfilmentLine = {
  id: string | null;
  productId: string;
  productName?: string;
  requiredKg: number;
  fulfilledKg: number;
};

export type WorkflowInput = {
  storedStatus: string | null;
  lines: FulfilmentLine[];
  details: {
    containerNo?: string | null;
    factorySealNo?: string | null;
    shippingLineName?: string | null;
    shippingLineSealNo?: string | null;
  };
  sampling: SamplingDecision;
  samples: { status: string }[];
  readyForDispatchAt: Date | null;
  dispatchedAt: Date | null;
};

export type WorkflowState = {
  fulfilment: {
    status: FulfilmentStatus;
    requiredKg: number;
    fulfilledKg: number;
    remainingKg: number;
  };
  details: { status: 'PENDING' | 'COMPLETED'; missing: string[] };
  samplingRequired: boolean;
  samplingStatus: ContainerSamplingStatus;
  dispatchStatus: DispatchState;
  /** False when a recorded "Ready for Dispatch" is no longer valid (e.g. destination changed) */
  readyStillValid: boolean;
  stage: string;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const EPS = 0.001;

export function deriveFulfilment(lines: FulfilmentLine[]): WorkflowState['fulfilment'] {
  const requiredKg = round3(lines.reduce((s, l) => s + (l.requiredKg || 0), 0));
  const fulfilledKg = round3(lines.reduce((s, l) => s + (l.fulfilledKg || 0), 0));
  const remainingKg = round3(lines.reduce((s, l) => s + Math.max(0, (l.requiredKg || 0) - (l.fulfilledKg || 0)), 0));
  const anyFulfilled = fulfilledKg > EPS;
  const allFulfilled = lines.length > 0 && requiredKg > EPS && lines.every((l) => l.fulfilledKg >= l.requiredKg - EPS);
  const status = allFulfilled
    ? FulfilmentStatus.FULFILLED
    : anyFulfilled
      ? FulfilmentStatus.PARTIALLY_FULFILLED
      : FulfilmentStatus.NOT_FULFILLED;
  return { status, requiredKg, fulfilledKg, remainingKg };
}

export function deriveSamplingStatus(required: boolean, samples: { status: string }[]): ContainerSamplingStatus {
  if (!required) return ContainerSamplingStatus.NOT_REQUIRED;
  // The current cycle = records not closed as FAILED. Failed cycles remain as history.
  const active = samples.filter((s) => !FAILED_SAMPLE_STATUSES.includes(s.status));
  if (!active.length) {
    return samples.length ? ContainerSamplingStatus.REJECTED : ContainerSamplingStatus.NOT_STARTED;
  }
  if (active.some((s) => HOLD_SAMPLE_STATUSES.includes(s.status))) return ContainerSamplingStatus.REJECTED;
  // A container is only as far along as its least advanced product sample.
  const minRank = Math.min(...active.map((s) => SAMPLE_RANK[s.status] ?? 1));
  return RANK_TO_STATUS[minRank] ?? ContainerSamplingStatus.PENDING;
}

export function deriveState(input: WorkflowInput): WorkflowState {
  const fulfilment = deriveFulfilment(input.lines);
  const missing = MANDATORY_DETAIL_FIELDS.filter(([key]) => !String(input.details[key] ?? '').trim()).map(([, label]) => label);
  const detailsComplete = missing.length === 0;
  const samplingRequired = input.sampling.required;
  const samplingStatus = deriveSamplingStatus(samplingRequired, input.samples);
  const stored = input.storedStatus || ContainerStatus.DRAFT;
  const isFulfilled = fulfilment.status === FulfilmentStatus.FULFILLED;
  const samplingClear = !samplingRequired || samplingStatus === ContainerSamplingStatus.APPROVED;
  const readyStillValid = !input.readyForDispatchAt || (isFulfilled && detailsComplete && samplingClear);

  let stage: string;
  if (stored === ContainerStatus.CANCELLED) stage = ContainerStatus.CANCELLED;
  else if (input.dispatchedAt || POST_DISPATCH_STAGES.includes(stored)) {
    stage = POST_DISPATCH_STAGES.includes(stored) ? stored : ContainerStatus.DISPATCHED_FROM_FACTORY;
  } else if (stored === ContainerStatus.ON_HOLD) stage = ContainerStatus.ON_HOLD;
  else if (fulfilment.status === FulfilmentStatus.NOT_FULFILLED) {
    if (samplingRequired && samplingStatus === ContainerSamplingStatus.REJECTED) stage = ContainerStatus.SAMPLING_FAILED;
    else stage = PRE_FULFILMENT_STAGES.includes(stored) ? stored : ContainerStatus.AWAITING_FULFILMENT;
  } else if (fulfilment.status === FulfilmentStatus.PARTIALLY_FULFILLED) stage = ContainerStatus.PARTIALLY_FULFILLED;
  else if (!detailsComplete) stage = ContainerStatus.FULFILLED;
  else if (input.readyForDispatchAt && readyStillValid) stage = ContainerStatus.READY_FOR_DISPATCH;
  else if (!samplingRequired) stage = ContainerStatus.CONTAINER_DETAILS_COMPLETED;
  else {
    const bySampling: Record<string, string> = {
      [ContainerSamplingStatus.NOT_STARTED]: ContainerStatus.CONTAINER_DETAILS_COMPLETED,
      [ContainerSamplingStatus.PENDING]: ContainerStatus.READY_FOR_SAMPLING,
      [ContainerSamplingStatus.SAMPLE_SENT]: ContainerStatus.SAMPLE_SENT,
      [ContainerSamplingStatus.AWAITING_RESULT]: ContainerStatus.AWAITING_SAMPLING_RESULT,
      [ContainerSamplingStatus.RESULT_RECEIVED]: ContainerStatus.SAMPLING_RESULT_RECEIVED,
      [ContainerSamplingStatus.APPROVED]: ContainerStatus.SAMPLING_PASSED,
      [ContainerSamplingStatus.REJECTED]: ContainerStatus.SAMPLING_FAILED,
    };
    stage = bySampling[samplingStatus] ?? ContainerStatus.CONTAINER_DETAILS_COMPLETED;
  }

  const dispatched = POST_DISPATCH_STAGES.includes(stage);
  const dispatchStatus: DispatchState = dispatched
    ? DispatchState.DISPATCHED
    : stage === ContainerStatus.READY_FOR_DISPATCH
      ? DispatchState.READY
      : DispatchState.NOT_READY;

  return {
    fulfilment,
    details: { status: detailsComplete ? 'COMPLETED' : 'PENDING', missing },
    samplingRequired,
    samplingStatus,
    dispatchStatus,
    readyStillValid,
    stage,
  };
}

const CONTAINER_OPS: string[] = [UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.PRODUCTION_TEAM, UserRole.INVENTORY_TEAM];
const PRODUCTION_OPS: string[] = [UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN, UserRole.PRODUCTION_TEAM];
const SHIPPING_OPS: string[] = [
  UserRole.SUPER_ADMIN,
  UserRole.OFFICE_ADMIN,
  UserRole.PRODUCTION_TEAM,
  UserRole.CONTRACT_TEAM,
  UserRole.SUPER_SALES,
];
const ADMINS: string[] = [UserRole.SUPER_ADMIN, UserRole.OFFICE_ADMIN];

/** Only the next actions that are valid for the current stage AND the user's role (PDF §9.3, §14F). */
export function allowedActions(state: WorkflowState, role: string): WorkflowAction[] {
  const a: WorkflowAction[] = [];
  const { stage } = state;
  const dispatched = state.dispatchStatus === DispatchState.DISPATCHED;
  const fulfilled = state.fulfilment.status === FulfilmentStatus.FULFILLED;
  const detailsComplete = state.details.status === 'COMPLETED';
  const s = state.samplingStatus;

  if (stage === ContainerStatus.CANCELLED) return a;
  if (stage === ContainerStatus.ON_HOLD) {
    if (ADMINS.includes(role)) a.push(WorkflowAction.RELEASE_HOLD);
    return a;
  }

  if (dispatched) {
    if (role === UserRole.SUPER_ADMIN) a.push(WorkflowAction.CORRECT_DETAILS_AFTER_DISPATCH);
    if (SHIPPING_OPS.includes(role)) {
      if (stage === ContainerStatus.DISPATCHED_FROM_FACTORY) a.push(WorkflowAction.MARK_REACHED_PORT);
      if (stage === ContainerStatus.DISPATCHED_FROM_FACTORY || stage === ContainerStatus.REACHED_PORT) {
        a.push(WorkflowAction.MARK_SHIPPED);
      }
    }
    return a;
  }

  if (CONTAINER_OPS.includes(role) && state.fulfilment.status !== FulfilmentStatus.NOT_FULFILLED) {
    a.push(WorkflowAction.UPDATE_DETAILS);
  }

  if (PRODUCTION_OPS.includes(role) && fulfilled && detailsComplete) {
    if (state.samplingRequired) {
      if (s === ContainerSamplingStatus.NOT_STARTED || s === ContainerSamplingStatus.REJECTED) {
        a.push(WorkflowAction.PROCEED_TO_SAMPLING);
      }
      if (s === ContainerSamplingStatus.PENDING) a.push(WorkflowAction.MARK_SAMPLE_SENT);
      if (s === ContainerSamplingStatus.SAMPLE_SENT) a.push(WorkflowAction.MARK_AWAITING_RESULT);
      if (s === ContainerSamplingStatus.SAMPLE_SENT || s === ContainerSamplingStatus.AWAITING_RESULT) {
        a.push(WorkflowAction.RECORD_RESULT);
      }
      if (s === ContainerSamplingStatus.RESULT_RECEIVED) a.push(WorkflowAction.APPROVE_SAMPLING);
    }
    const samplingClear = !state.samplingRequired || s === ContainerSamplingStatus.APPROVED;
    if (samplingClear && stage !== ContainerStatus.READY_FOR_DISPATCH) a.push(WorkflowAction.MARK_READY_FOR_DISPATCH);
    if (stage === ContainerStatus.READY_FOR_DISPATCH) a.push(WorkflowAction.MARK_DISPATCHED);
  }

  if (ADMINS.includes(role)) a.push(WorkflowAction.PUT_ON_HOLD);
  return a;
}

/** Human labels used by API consumers (UI may override). */
export const STAGE_LABELS: Record<string, string> = {
  [ContainerStatus.DRAFT]: 'Awaiting Fulfillment',
  [ContainerStatus.UNDER_PREPARATION]: 'Awaiting Fulfillment',
  [ContainerStatus.PRODUCTION_ASSIGNED]: 'Awaiting Fulfillment',
  [ContainerStatus.UNDER_PROCESSING]: 'Awaiting Fulfillment',
  [ContainerStatus.PROCESSING_COMPLETED]: 'Awaiting Fulfillment',
  [ContainerStatus.PLANNED]: 'Awaiting Fulfillment',
  [ContainerStatus.AWAITING_FULFILMENT]: 'Awaiting Fulfillment',
  [ContainerStatus.PARTIALLY_FULFILLED]: 'Partially Fulfilled',
  [ContainerStatus.FULFILLED]: 'Fulfilled — Container Details Pending',
  [ContainerStatus.CONTAINER_DETAILS_COMPLETED]: 'Container Details Completed',
  [ContainerStatus.READY_FOR_SAMPLING]: 'Sampling Pending',
  [ContainerStatus.SAMPLE_SENT]: 'Sample Collected / Sent',
  [ContainerStatus.AWAITING_SAMPLING_RESULT]: 'Awaiting Sampling Result',
  [ContainerStatus.SAMPLING_RESULT_RECEIVED]: 'Sampling Result Received',
  [ContainerStatus.SAMPLING_PASSED]: 'Sampling Approved',
  [ContainerStatus.SAMPLING_FAILED]: 'Sampling Rejected / On Hold',
  [ContainerStatus.READY_FOR_DISPATCH]: 'Ready for Dispatch',
  [ContainerStatus.DISPATCHED_FROM_FACTORY]: 'Dispatched',
  [ContainerStatus.REACHED_PORT]: 'Reached Port',
  [ContainerStatus.SHIPPED]: 'Shipped',
  [ContainerStatus.COMPLETED]: 'Completed',
  [ContainerStatus.ON_HOLD]: 'On Hold',
  [ContainerStatus.CANCELLED]: 'Cancelled',
};
