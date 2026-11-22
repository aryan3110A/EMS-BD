import { decideSampling } from '../../common/constants/production.constants';
import { ContainerStatus, UserRole } from '../../common/constants/enums';
import {
  allowedActions,
  ContainerSamplingStatus,
  deriveState,
  deriveSamplingStatus,
  FulfilmentStatus,
  WorkflowAction,
  type WorkflowInput,
} from './container-workflow.logic';

const EU = decideSampling({ countryName: 'Germany', countryCode: 'DE', countryEuClassification: 'EU' });
const RU = decideSampling({ countryName: 'Russia', countryCode: 'RU', countryEuClassification: 'NON_EU' });
const UAE = decideSampling({ countryName: 'United Arab Emirates', countryCode: 'AE', countryEuClassification: 'NON_EU' });
const DETAILS = { containerNo: 'ABCD1234567', factorySealNo: 'FS-1025', shippingLineName: 'Example Line', shippingLineSealNo: 'SL-5098' };

function input(over: Partial<WorkflowInput> = {}): WorkflowInput {
  return {
    storedStatus: 'DRAFT',
    lines: [{ id: 'l1', productId: 'hss', requiredKg: 20000, fulfilledKg: 0 }],
    details: {},
    sampling: UAE,
    samples: [],
    readyForDispatchAt: null,
    dispatchedAt: null,
    ...over,
  };
}
const fulfilled = (kg = 20000) => [{ id: 'l1', productId: 'hss', requiredKg: 20000, fulfilledKg: kg }];

describe('Sampling rule — EU / Russia only (PDF §10)', () => {
  it.each([
    ['Germany', 'DE', 'EU', true],
    ['France', 'FR', 'EU', true],
    ['Italy', 'IT', 'EU', true],
    ['Russia', 'RU', 'NON_EU', true],
    ['United Arab Emirates', 'AE', 'NON_EU', false],
    ['Saudi Arabia', 'SA', 'NON_EU', false],
    ['United States', 'US', 'NON_EU', false],
  ])('%s → sampling %s', (name, code, eu, expected) => {
    expect(decideSampling({ countryName: name, countryCode: code, countryEuClassification: eu }).required).toBe(expected);
  });

  it('Russia is never classified as EU', () => {
    expect(RU.reason).toBe('RUSSIA');
    expect(RU.euClassification).toBe('NON_EU');
  });

  it('uses the stored country, not free-text "EU" matching', () => {
    // contract says EU but the destination country record says non-EU → country wins
    expect(
      decideSampling({ countryName: 'Israel', countryCode: 'IL', countryEuClassification: 'NON_EU', contractEuClassification: 'EU' }).required,
    ).toBe(false);
  });
});

describe('Fulfilment status is automatic (PDF §7, UAT-10/11)', () => {
  it('20,000 required, 12,000 fulfilled → Partially Fulfilled with 8,000 remaining', () => {
    const s = deriveState(input({ lines: fulfilled(12000) }));
    expect(s.fulfilment).toEqual({ status: FulfilmentStatus.PARTIALLY_FULFILLED, requiredKg: 20000, fulfilledKg: 12000, remainingKg: 8000 });
    expect(s.stage).toBe(ContainerStatus.PARTIALLY_FULFILLED);
  });
  it('remaining 8,000 fulfilled → Fulfilled — Container Details Pending (fulfilled ≠ dispatched)', () => {
    const s = deriveState(input({ lines: fulfilled(20000) }));
    expect(s.fulfilment.status).toBe(FulfilmentStatus.FULFILLED);
    expect(s.stage).toBe(ContainerStatus.FULFILLED);
    expect(s.dispatchStatus).toBe('NOT_READY');
  });
  it('multi-product container is fulfilled only when every line is', () => {
    const s = deriveState(
      input({
        lines: [
          { id: 'a', productId: 'p1', requiredKg: 10000, fulfilledKg: 10000 },
          { id: 'b', productId: 'p2', requiredKg: 5000, fulfilledKg: 4000 },
        ],
      }),
    );
    expect(s.fulfilment.status).toBe(FulfilmentStatus.PARTIALLY_FULFILLED);
  });
  it('legacy pre-fulfilment statuses still mean "not fulfilled"', () => {
    expect(deriveState(input({ storedStatus: 'UNDER_PREPARATION' })).stage).toBe('UNDER_PREPARATION');
  });
});

describe('Workflow A — non-EU / non-Russia (PDF §11, UAT-16/17/20)', () => {
  it('details pending blocks dispatch actions (UAT-15)', () => {
    const s = deriveState(input({ lines: fulfilled(), details: { containerNo: 'X' } }));
    expect(s.details.missing).toEqual(['Factory Seal Number', 'Shipping Line Name', 'Shipping Line Seal Number']);
    const a = allowedActions(s, UserRole.PRODUCTION_TEAM);
    expect(a).toContain(WorkflowAction.UPDATE_DETAILS);
    expect(a).not.toContain(WorkflowAction.MARK_READY_FOR_DISPATCH);
    expect(a).not.toContain(WorkflowAction.MARK_DISPATCHED);
  });
  it('details complete → can go straight to Ready for Dispatch, no sampling stages', () => {
    const s = deriveState(input({ lines: fulfilled(), details: DETAILS }));
    expect(s.samplingStatus).toBe(ContainerSamplingStatus.NOT_REQUIRED);
    expect(s.stage).toBe(ContainerStatus.CONTAINER_DETAILS_COMPLETED);
    const a = allowedActions(s, UserRole.PRODUCTION_TEAM);
    expect(a).toContain(WorkflowAction.MARK_READY_FOR_DISPATCH);
    expect(a).not.toContain(WorkflowAction.PROCEED_TO_SAMPLING);
  });
  it('ready → dispatch available; dispatched → shipping actions only', () => {
    const ready = deriveState(input({ lines: fulfilled(), details: DETAILS, readyForDispatchAt: new Date() }));
    expect(ready.stage).toBe(ContainerStatus.READY_FOR_DISPATCH);
    expect(allowedActions(ready, UserRole.PRODUCTION_TEAM)).toContain(WorkflowAction.MARK_DISPATCHED);
    const done = deriveState(
      input({ storedStatus: ContainerStatus.DISPATCHED_FROM_FACTORY, lines: fulfilled(), details: DETAILS, dispatchedAt: new Date() }),
    );
    expect(done.dispatchStatus).toBe('DISPATCHED');
    expect(allowedActions(done, UserRole.PRODUCTION_TEAM)).toEqual([WorkflowAction.MARK_REACHED_PORT, WorkflowAction.MARK_SHIPPED]);
  });
});

describe('Workflow B — EU / Russia (PDF §12, UAT-18/19/21–24)', () => {
  const base = (samples: { status: string }[], over: Partial<WorkflowInput> = {}) =>
    deriveState(input({ lines: fulfilled(), details: DETAILS, sampling: EU, samples, ...over }));

  it('details complete → Proceed to Sampling, not Ready for Dispatch', () => {
    const s = base([]);
    expect(s.stage).toBe(ContainerStatus.CONTAINER_DETAILS_COMPLETED);
    const a = allowedActions(s, UserRole.PRODUCTION_TEAM);
    expect(a).toContain(WorkflowAction.PROCEED_TO_SAMPLING);
    expect(a).not.toContain(WorkflowAction.MARK_READY_FOR_DISPATCH);
  });
  it.each([
    ['READY_FOR_SAMPLING', ContainerStatus.READY_FOR_SAMPLING, WorkflowAction.MARK_SAMPLE_SENT],
    ['SAMPLE_COLLECTED', ContainerStatus.SAMPLE_SENT, WorkflowAction.MARK_AWAITING_RESULT],
    ['TESTING_IN_PROGRESS', ContainerStatus.AWAITING_SAMPLING_RESULT, WorkflowAction.RECORD_RESULT],
    ['RESULT_RECEIVED', ContainerStatus.SAMPLING_RESULT_RECEIVED, WorkflowAction.APPROVE_SAMPLING],
  ])('sample %s → stage %s, next action %s', (status, stage, action) => {
    const s = base([{ status }]);
    expect(s.stage).toBe(stage);
    expect(allowedActions(s, UserRole.PRODUCTION_TEAM)).toContain(action);
    expect(allowedActions(s, UserRole.PRODUCTION_TEAM)).not.toContain(WorkflowAction.MARK_READY_FOR_DISPATCH);
  });
  it('result received is NOT approval; approval unlocks Ready for Dispatch', () => {
    expect(allowedActions(base([{ status: 'RESULT_RECEIVED' }]), UserRole.PRODUCTION_TEAM)).not.toContain(
      WorkflowAction.MARK_READY_FOR_DISPATCH,
    );
    const approved = base([{ status: 'PASSED' }]);
    expect(approved.stage).toBe(ContainerStatus.SAMPLING_PASSED);
    expect(allowedActions(approved, UserRole.PRODUCTION_TEAM)).toContain(WorkflowAction.MARK_READY_FOR_DISPATCH);
  });
  it('rejected sample blocks dispatch and offers a new sampling cycle (UAT-23)', () => {
    const s = base([{ status: 'FAILED' }]);
    expect(s.samplingStatus).toBe(ContainerSamplingStatus.REJECTED);
    expect(s.stage).toBe(ContainerStatus.SAMPLING_FAILED);
    const a = allowedActions(s, UserRole.PRODUCTION_TEAM);
    expect(a).not.toContain(WorkflowAction.MARK_READY_FOR_DISPATCH);
    expect(a).toContain(WorkflowAction.PROCEED_TO_SAMPLING);
  });
  it('a new cycle after a failure takes precedence over the failed history', () => {
    expect(deriveSamplingStatus(true, [{ status: 'FAILED' }, { status: 'SAMPLE_COLLECTED' }])).toBe(ContainerSamplingStatus.SAMPLE_SENT);
  });
  it('multi-product container waits for its least advanced sample', () => {
    expect(deriveSamplingStatus(true, [{ status: 'PASSED' }, { status: 'TESTING_IN_PROGRESS' }])).toBe(
      ContainerSamplingStatus.AWAITING_RESULT,
    );
  });
  it('Russia follows the sampling workflow too (UAT-19)', () => {
    const s = deriveState(input({ lines: fulfilled(), details: DETAILS, sampling: RU }));
    expect(s.samplingRequired).toBe(true);
    expect(allowedActions(s, UserRole.PRODUCTION_TEAM)).toContain(WorkflowAction.PROCEED_TO_SAMPLING);
  });
});

describe('Destination change revalidates dispatch readiness (PDF §20.5, UAT-33)', () => {
  it('non-EU container marked ready becomes invalid when destination changes to EU', () => {
    const s = deriveState(input({ lines: fulfilled(), details: DETAILS, sampling: EU, readyForDispatchAt: new Date() }));
    expect(s.readyStillValid).toBe(false);
    expect(s.stage).toBe(ContainerStatus.CONTAINER_DETAILS_COMPLETED);
    expect(allowedActions(s, UserRole.PRODUCTION_TEAM)).not.toContain(WorkflowAction.MARK_DISPATCHED);
  });
});

describe('Permissions and invalid transitions (PDF §9.3, §21E)', () => {
  const ready = deriveState(input({ lines: fulfilled(), details: DETAILS, readyForDispatchAt: new Date() }));
  it('contract / accounts users cannot run factory actions', () => {
    expect(allowedActions(ready, UserRole.CONTRACT_TEAM)).toEqual([]);
    expect(allowedActions(ready, UserRole.ACCOUNTS_TEAM)).toEqual([]);
  });
  it('inventory team can update details but not dispatch', () => {
    const s = deriveState(input({ lines: fulfilled(), details: {} }));
    expect(allowedActions(s, UserRole.INVENTORY_TEAM)).toEqual([WorkflowAction.UPDATE_DETAILS]);
    expect(allowedActions(ready, UserRole.INVENTORY_TEAM)).not.toContain(WorkflowAction.MARK_DISPATCHED);
  });
  it('on hold: only admins can release; nothing else is possible', () => {
    const s = deriveState(input({ storedStatus: ContainerStatus.ON_HOLD, lines: fulfilled(), details: DETAILS }));
    expect(allowedActions(s, UserRole.SUPER_ADMIN)).toEqual([WorkflowAction.RELEASE_HOLD]);
    expect(allowedActions(s, UserRole.PRODUCTION_TEAM)).toEqual([]);
  });
  it('after dispatch, only SUPER_ADMIN may correct details', () => {
    const d = deriveState(input({ storedStatus: ContainerStatus.DISPATCHED_FROM_FACTORY, lines: fulfilled(), details: DETAILS, dispatchedAt: new Date() }));
    expect(allowedActions(d, UserRole.SUPER_ADMIN)).toContain(WorkflowAction.CORRECT_DETAILS_AFTER_DISPATCH);
    expect(allowedActions(d, UserRole.OFFICE_ADMIN)).not.toContain(WorkflowAction.CORRECT_DETAILS_AFTER_DISPATCH);
  });
});
