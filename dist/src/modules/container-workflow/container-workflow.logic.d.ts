import { type SamplingDecision } from '../../common/constants/production.constants';
export declare const FulfilmentStatus: {
    readonly NOT_FULFILLED: "NOT_FULFILLED";
    readonly PARTIALLY_FULFILLED: "PARTIALLY_FULFILLED";
    readonly FULFILLED: "FULFILLED";
};
export type FulfilmentStatus = (typeof FulfilmentStatus)[keyof typeof FulfilmentStatus];
export declare const ContainerSamplingStatus: {
    readonly NOT_REQUIRED: "NOT_REQUIRED";
    readonly NOT_STARTED: "NOT_STARTED";
    readonly PENDING: "PENDING";
    readonly SAMPLE_SENT: "SAMPLE_SENT";
    readonly AWAITING_RESULT: "AWAITING_RESULT";
    readonly RESULT_RECEIVED: "RESULT_RECEIVED";
    readonly APPROVED: "APPROVED";
    readonly REJECTED: "REJECTED";
};
export type ContainerSamplingStatus = (typeof ContainerSamplingStatus)[keyof typeof ContainerSamplingStatus];
export declare const DispatchState: {
    readonly NOT_READY: "NOT_READY";
    readonly READY: "READY";
    readonly DISPATCHED: "DISPATCHED";
};
export type DispatchState = (typeof DispatchState)[keyof typeof DispatchState];
export declare const WorkflowAction: {
    readonly UPDATE_DETAILS: "UPDATE_DETAILS";
    readonly CORRECT_DETAILS_AFTER_DISPATCH: "CORRECT_DETAILS_AFTER_DISPATCH";
    readonly PROCEED_TO_SAMPLING: "PROCEED_TO_SAMPLING";
    readonly MARK_SAMPLE_SENT: "MARK_SAMPLE_SENT";
    readonly MARK_AWAITING_RESULT: "MARK_AWAITING_RESULT";
    readonly RECORD_RESULT: "RECORD_RESULT";
    readonly APPROVE_SAMPLING: "APPROVE_SAMPLING";
    readonly MARK_READY_FOR_DISPATCH: "MARK_READY_FOR_DISPATCH";
    readonly MARK_DISPATCHED: "MARK_DISPATCHED";
    readonly MARK_REACHED_PORT: "MARK_REACHED_PORT";
    readonly MARK_SHIPPED: "MARK_SHIPPED";
    readonly PUT_ON_HOLD: "PUT_ON_HOLD";
    readonly RELEASE_HOLD: "RELEASE_HOLD";
};
export type WorkflowAction = (typeof WorkflowAction)[keyof typeof WorkflowAction];
export declare const POST_DISPATCH_STAGES: string[];
export declare const PRE_FULFILMENT_STAGES: string[];
export declare const MANDATORY_DETAIL_FIELDS: readonly [readonly ["containerNo", "Container Number"], readonly ["factorySealNo", "Factory Seal Number"], readonly ["shippingLineName", "Shipping Line Name"], readonly ["shippingLineSealNo", "Shipping Line Seal Number"]];
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
    samples: {
        status: string;
    }[];
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
    details: {
        status: 'PENDING' | 'COMPLETED';
        missing: string[];
    };
    samplingRequired: boolean;
    samplingStatus: ContainerSamplingStatus;
    dispatchStatus: DispatchState;
    readyStillValid: boolean;
    stage: string;
};
export declare function deriveFulfilment(lines: FulfilmentLine[]): WorkflowState['fulfilment'];
export declare function deriveSamplingStatus(required: boolean, samples: {
    status: string;
}[]): ContainerSamplingStatus;
export declare function deriveState(input: WorkflowInput): WorkflowState;
export declare function allowedActions(state: WorkflowState, role: string): WorkflowAction[];
export declare const STAGE_LABELS: Record<string, string>;
