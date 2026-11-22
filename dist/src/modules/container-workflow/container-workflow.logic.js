"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGE_LABELS = exports.MANDATORY_DETAIL_FIELDS = exports.PRE_FULFILMENT_STAGES = exports.POST_DISPATCH_STAGES = exports.WorkflowAction = exports.DispatchState = exports.ContainerSamplingStatus = exports.FulfilmentStatus = void 0;
exports.deriveFulfilment = deriveFulfilment;
exports.deriveSamplingStatus = deriveSamplingStatus;
exports.deriveState = deriveState;
exports.allowedActions = allowedActions;
const enums_1 = require("../../common/constants/enums");
const production_constants_1 = require("../../common/constants/production.constants");
exports.FulfilmentStatus = {
    NOT_FULFILLED: 'NOT_FULFILLED',
    PARTIALLY_FULFILLED: 'PARTIALLY_FULFILLED',
    FULFILLED: 'FULFILLED',
};
exports.ContainerSamplingStatus = {
    NOT_REQUIRED: 'NOT_REQUIRED',
    NOT_STARTED: 'NOT_STARTED',
    PENDING: 'PENDING',
    SAMPLE_SENT: 'SAMPLE_SENT',
    AWAITING_RESULT: 'AWAITING_RESULT',
    RESULT_RECEIVED: 'RESULT_RECEIVED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
};
exports.DispatchState = {
    NOT_READY: 'NOT_READY',
    READY: 'READY',
    DISPATCHED: 'DISPATCHED',
};
exports.WorkflowAction = {
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
};
exports.POST_DISPATCH_STAGES = [
    enums_1.ContainerStatus.DISPATCHED_FROM_FACTORY,
    enums_1.ContainerStatus.REACHED_PORT,
    enums_1.ContainerStatus.SHIPPED,
    enums_1.ContainerStatus.COMPLETED,
];
exports.PRE_FULFILMENT_STAGES = [
    enums_1.ContainerStatus.DRAFT,
    enums_1.ContainerStatus.UNDER_PREPARATION,
    enums_1.ContainerStatus.PRODUCTION_ASSIGNED,
    enums_1.ContainerStatus.UNDER_PROCESSING,
    enums_1.ContainerStatus.PROCESSING_COMPLETED,
    enums_1.ContainerStatus.PLANNED,
    enums_1.ContainerStatus.AWAITING_FULFILMENT,
];
const FAILED_SAMPLE_STATUSES = [production_constants_1.SamplingStatus.FAILED];
const HOLD_SAMPLE_STATUSES = [production_constants_1.SamplingStatus.REPROCESSING_REQUIRED, production_constants_1.SamplingStatus.RESAMPLING_REQUIRED];
const SAMPLE_RANK = {
    [production_constants_1.SamplingStatus.NOT_READY]: 1,
    [production_constants_1.SamplingStatus.READY_FOR_SAMPLING]: 1,
    [production_constants_1.SamplingStatus.SAMPLE_COLLECTED]: 2,
    [production_constants_1.SamplingStatus.TESTING_IN_PROGRESS]: 3,
    [production_constants_1.SamplingStatus.RESULT_RECEIVED]: 4,
    [production_constants_1.SamplingStatus.PASSED]: 5,
};
const RANK_TO_STATUS = {
    1: exports.ContainerSamplingStatus.PENDING,
    2: exports.ContainerSamplingStatus.SAMPLE_SENT,
    3: exports.ContainerSamplingStatus.AWAITING_RESULT,
    4: exports.ContainerSamplingStatus.RESULT_RECEIVED,
    5: exports.ContainerSamplingStatus.APPROVED,
};
exports.MANDATORY_DETAIL_FIELDS = [
    ['containerNo', 'Container Number'],
    ['factorySealNo', 'Factory Seal Number'],
    ['shippingLineName', 'Shipping Line Name'],
    ['shippingLineSealNo', 'Shipping Line Seal Number'],
];
const round3 = (n) => Math.round(n * 1000) / 1000;
const EPS = 0.001;
function deriveFulfilment(lines) {
    const requiredKg = round3(lines.reduce((s, l) => s + (l.requiredKg || 0), 0));
    const fulfilledKg = round3(lines.reduce((s, l) => s + (l.fulfilledKg || 0), 0));
    const remainingKg = round3(lines.reduce((s, l) => s + Math.max(0, (l.requiredKg || 0) - (l.fulfilledKg || 0)), 0));
    const anyFulfilled = fulfilledKg > EPS;
    const allFulfilled = lines.length > 0 && requiredKg > EPS && lines.every((l) => l.fulfilledKg >= l.requiredKg - EPS);
    const status = allFulfilled
        ? exports.FulfilmentStatus.FULFILLED
        : anyFulfilled
            ? exports.FulfilmentStatus.PARTIALLY_FULFILLED
            : exports.FulfilmentStatus.NOT_FULFILLED;
    return { status, requiredKg, fulfilledKg, remainingKg };
}
function deriveSamplingStatus(required, samples) {
    if (!required)
        return exports.ContainerSamplingStatus.NOT_REQUIRED;
    const active = samples.filter((s) => !FAILED_SAMPLE_STATUSES.includes(s.status));
    if (!active.length) {
        return samples.length ? exports.ContainerSamplingStatus.REJECTED : exports.ContainerSamplingStatus.NOT_STARTED;
    }
    if (active.some((s) => HOLD_SAMPLE_STATUSES.includes(s.status)))
        return exports.ContainerSamplingStatus.REJECTED;
    const minRank = Math.min(...active.map((s) => SAMPLE_RANK[s.status] ?? 1));
    return RANK_TO_STATUS[minRank] ?? exports.ContainerSamplingStatus.PENDING;
}
function deriveState(input) {
    const fulfilment = deriveFulfilment(input.lines);
    const missing = exports.MANDATORY_DETAIL_FIELDS.filter(([key]) => !String(input.details[key] ?? '').trim()).map(([, label]) => label);
    const detailsComplete = missing.length === 0;
    const samplingRequired = input.sampling.required;
    const samplingStatus = deriveSamplingStatus(samplingRequired, input.samples);
    const stored = input.storedStatus || enums_1.ContainerStatus.DRAFT;
    const isFulfilled = fulfilment.status === exports.FulfilmentStatus.FULFILLED;
    const samplingClear = !samplingRequired || samplingStatus === exports.ContainerSamplingStatus.APPROVED;
    const readyStillValid = !input.readyForDispatchAt || (isFulfilled && detailsComplete && samplingClear);
    let stage;
    if (stored === enums_1.ContainerStatus.CANCELLED)
        stage = enums_1.ContainerStatus.CANCELLED;
    else if (input.dispatchedAt || exports.POST_DISPATCH_STAGES.includes(stored)) {
        stage = exports.POST_DISPATCH_STAGES.includes(stored) ? stored : enums_1.ContainerStatus.DISPATCHED_FROM_FACTORY;
    }
    else if (stored === enums_1.ContainerStatus.ON_HOLD)
        stage = enums_1.ContainerStatus.ON_HOLD;
    else if (fulfilment.status === exports.FulfilmentStatus.NOT_FULFILLED) {
        if (samplingRequired && samplingStatus === exports.ContainerSamplingStatus.REJECTED)
            stage = enums_1.ContainerStatus.SAMPLING_FAILED;
        else
            stage = exports.PRE_FULFILMENT_STAGES.includes(stored) ? stored : enums_1.ContainerStatus.AWAITING_FULFILMENT;
    }
    else if (fulfilment.status === exports.FulfilmentStatus.PARTIALLY_FULFILLED)
        stage = enums_1.ContainerStatus.PARTIALLY_FULFILLED;
    else if (!detailsComplete)
        stage = enums_1.ContainerStatus.FULFILLED;
    else if (input.readyForDispatchAt && readyStillValid)
        stage = enums_1.ContainerStatus.READY_FOR_DISPATCH;
    else if (!samplingRequired)
        stage = enums_1.ContainerStatus.CONTAINER_DETAILS_COMPLETED;
    else {
        const bySampling = {
            [exports.ContainerSamplingStatus.NOT_STARTED]: enums_1.ContainerStatus.CONTAINER_DETAILS_COMPLETED,
            [exports.ContainerSamplingStatus.PENDING]: enums_1.ContainerStatus.READY_FOR_SAMPLING,
            [exports.ContainerSamplingStatus.SAMPLE_SENT]: enums_1.ContainerStatus.SAMPLE_SENT,
            [exports.ContainerSamplingStatus.AWAITING_RESULT]: enums_1.ContainerStatus.AWAITING_SAMPLING_RESULT,
            [exports.ContainerSamplingStatus.RESULT_RECEIVED]: enums_1.ContainerStatus.SAMPLING_RESULT_RECEIVED,
            [exports.ContainerSamplingStatus.APPROVED]: enums_1.ContainerStatus.SAMPLING_PASSED,
            [exports.ContainerSamplingStatus.REJECTED]: enums_1.ContainerStatus.SAMPLING_FAILED,
        };
        stage = bySampling[samplingStatus] ?? enums_1.ContainerStatus.CONTAINER_DETAILS_COMPLETED;
    }
    const dispatched = exports.POST_DISPATCH_STAGES.includes(stage);
    const dispatchStatus = dispatched
        ? exports.DispatchState.DISPATCHED
        : stage === enums_1.ContainerStatus.READY_FOR_DISPATCH
            ? exports.DispatchState.READY
            : exports.DispatchState.NOT_READY;
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
const CONTAINER_OPS = [enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.PRODUCTION_TEAM, enums_1.UserRole.INVENTORY_TEAM];
const PRODUCTION_OPS = [enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN, enums_1.UserRole.PRODUCTION_TEAM];
const SHIPPING_OPS = [
    enums_1.UserRole.SUPER_ADMIN,
    enums_1.UserRole.OFFICE_ADMIN,
    enums_1.UserRole.PRODUCTION_TEAM,
    enums_1.UserRole.CONTRACT_TEAM,
    enums_1.UserRole.SUPER_SALES,
];
const ADMINS = [enums_1.UserRole.SUPER_ADMIN, enums_1.UserRole.OFFICE_ADMIN];
function allowedActions(state, role) {
    const a = [];
    const { stage } = state;
    const dispatched = state.dispatchStatus === exports.DispatchState.DISPATCHED;
    const fulfilled = state.fulfilment.status === exports.FulfilmentStatus.FULFILLED;
    const detailsComplete = state.details.status === 'COMPLETED';
    const s = state.samplingStatus;
    if (stage === enums_1.ContainerStatus.CANCELLED)
        return a;
    if (stage === enums_1.ContainerStatus.ON_HOLD) {
        if (ADMINS.includes(role))
            a.push(exports.WorkflowAction.RELEASE_HOLD);
        return a;
    }
    if (dispatched) {
        if (role === enums_1.UserRole.SUPER_ADMIN)
            a.push(exports.WorkflowAction.CORRECT_DETAILS_AFTER_DISPATCH);
        if (SHIPPING_OPS.includes(role)) {
            if (stage === enums_1.ContainerStatus.DISPATCHED_FROM_FACTORY)
                a.push(exports.WorkflowAction.MARK_REACHED_PORT);
            if (stage === enums_1.ContainerStatus.DISPATCHED_FROM_FACTORY || stage === enums_1.ContainerStatus.REACHED_PORT) {
                a.push(exports.WorkflowAction.MARK_SHIPPED);
            }
        }
        return a;
    }
    if (CONTAINER_OPS.includes(role) && state.fulfilment.status !== exports.FulfilmentStatus.NOT_FULFILLED) {
        a.push(exports.WorkflowAction.UPDATE_DETAILS);
    }
    if (PRODUCTION_OPS.includes(role) && fulfilled && detailsComplete) {
        if (state.samplingRequired) {
            if (s === exports.ContainerSamplingStatus.NOT_STARTED || s === exports.ContainerSamplingStatus.REJECTED) {
                a.push(exports.WorkflowAction.PROCEED_TO_SAMPLING);
            }
            if (s === exports.ContainerSamplingStatus.PENDING)
                a.push(exports.WorkflowAction.MARK_SAMPLE_SENT);
            if (s === exports.ContainerSamplingStatus.SAMPLE_SENT)
                a.push(exports.WorkflowAction.MARK_AWAITING_RESULT);
            if (s === exports.ContainerSamplingStatus.SAMPLE_SENT || s === exports.ContainerSamplingStatus.AWAITING_RESULT) {
                a.push(exports.WorkflowAction.RECORD_RESULT);
            }
            if (s === exports.ContainerSamplingStatus.RESULT_RECEIVED)
                a.push(exports.WorkflowAction.APPROVE_SAMPLING);
        }
        const samplingClear = !state.samplingRequired || s === exports.ContainerSamplingStatus.APPROVED;
        if (samplingClear && stage !== enums_1.ContainerStatus.READY_FOR_DISPATCH)
            a.push(exports.WorkflowAction.MARK_READY_FOR_DISPATCH);
        if (stage === enums_1.ContainerStatus.READY_FOR_DISPATCH)
            a.push(exports.WorkflowAction.MARK_DISPATCHED);
    }
    if (ADMINS.includes(role))
        a.push(exports.WorkflowAction.PUT_ON_HOLD);
    return a;
}
exports.STAGE_LABELS = {
    [enums_1.ContainerStatus.DRAFT]: 'Awaiting Fulfillment',
    [enums_1.ContainerStatus.UNDER_PREPARATION]: 'Awaiting Fulfillment',
    [enums_1.ContainerStatus.PRODUCTION_ASSIGNED]: 'Awaiting Fulfillment',
    [enums_1.ContainerStatus.UNDER_PROCESSING]: 'Awaiting Fulfillment',
    [enums_1.ContainerStatus.PROCESSING_COMPLETED]: 'Awaiting Fulfillment',
    [enums_1.ContainerStatus.PLANNED]: 'Awaiting Fulfillment',
    [enums_1.ContainerStatus.AWAITING_FULFILMENT]: 'Awaiting Fulfillment',
    [enums_1.ContainerStatus.PARTIALLY_FULFILLED]: 'Partially Fulfilled',
    [enums_1.ContainerStatus.FULFILLED]: 'Fulfilled — Container Details Pending',
    [enums_1.ContainerStatus.CONTAINER_DETAILS_COMPLETED]: 'Container Details Completed',
    [enums_1.ContainerStatus.READY_FOR_SAMPLING]: 'Sampling Pending',
    [enums_1.ContainerStatus.SAMPLE_SENT]: 'Sample Collected / Sent',
    [enums_1.ContainerStatus.AWAITING_SAMPLING_RESULT]: 'Awaiting Sampling Result',
    [enums_1.ContainerStatus.SAMPLING_RESULT_RECEIVED]: 'Sampling Result Received',
    [enums_1.ContainerStatus.SAMPLING_PASSED]: 'Sampling Approved',
    [enums_1.ContainerStatus.SAMPLING_FAILED]: 'Sampling Rejected / On Hold',
    [enums_1.ContainerStatus.READY_FOR_DISPATCH]: 'Ready for Dispatch',
    [enums_1.ContainerStatus.DISPATCHED_FROM_FACTORY]: 'Dispatched',
    [enums_1.ContainerStatus.REACHED_PORT]: 'Reached Port',
    [enums_1.ContainerStatus.SHIPPED]: 'Shipped',
    [enums_1.ContainerStatus.COMPLETED]: 'Completed',
    [enums_1.ContainerStatus.ON_HOLD]: 'On Hold',
    [enums_1.ContainerStatus.CANCELLED]: 'Cancelled',
};
//# sourceMappingURL=container-workflow.logic.js.map