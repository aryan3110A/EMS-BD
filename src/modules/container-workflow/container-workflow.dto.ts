import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { WorkflowAction } from './container-workflow.logic';

export class ContainerWorkflowActionDto {
  @IsIn(Object.values(WorkflowAction))
  action: string;

  // Container details (PDF §8.2)
  @IsOptional() @IsString() @MaxLength(40) containerNo?: string;
  @IsOptional() @IsString() @MaxLength(60) factorySealNo?: string;
  @IsOptional() @IsString() @MaxLength(120) shippingLineName?: string;
  @IsOptional() @IsString() @MaxLength(60) shippingLineSealNo?: string;

  // Sampling (PDF §12.2)
  @IsOptional() @IsDateString() samplingDate?: string;
  @IsOptional() @IsString() @MaxLength(80) samplingType?: string;
  @IsOptional() @IsString() @MaxLength(120) sampleReference?: string;
  @IsOptional() @IsString() @MaxLength(120) testingAgency?: string;
  @IsOptional() @IsIn(['PASSED', 'FAILED']) result?: string;
  @IsOptional() @IsDateString() resultDate?: string;
  @IsOptional() @IsString() @MaxLength(160) resultReference?: string;

  // Dispatch / shipping
  @IsOptional() @IsDateString() dispatchDate?: string;
  @IsOptional() @IsDateString() shipmentDate?: string;

  @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
  /** Required for hold and post-dispatch corrections */
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class SampleRecordUpdateDto {
  @IsIn(['SENT', 'AWAITING_RESULT', 'RESULT', 'APPROVE'])
  step: 'SENT' | 'AWAITING_RESULT' | 'RESULT' | 'APPROVE';

  @IsOptional() @IsDateString() samplingDate?: string;
  @IsOptional() @IsString() @MaxLength(80) samplingType?: string;
  @IsOptional() @IsString() @MaxLength(120) sampleReference?: string;
  @IsOptional() @IsString() @MaxLength(120) testingAgency?: string;
  @IsOptional() @IsIn(['PASSED', 'FAILED']) result?: string;
  @IsOptional() @IsDateString() resultDate?: string;
  @IsOptional() @IsString() @MaxLength(160) resultReference?: string;
  @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}
