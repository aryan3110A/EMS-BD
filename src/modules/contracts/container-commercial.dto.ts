import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';
import { Incoterm } from '../../common/constants/enums';

const incoterms = Object.values(Incoterm);

export class AmendContainerCommercialDto {
  @IsString()
  reason: string;

  @IsNumber()
  @Min(0)
  newPrice: number;

  @IsString()
  currency: string;
}

export class ManualExchangeRateDto {
  @IsNumber()
  @Min(0.0001)
  rate: number;

  @IsString()
  currency: string;
}

export class ExchangeRateQueryDto {
  @IsString()
  currency: string;
}

export class AutosaveContractDto {
  /** Partial contract payload — same shape as UpdateContractDto fields */
  [key: string]: unknown;
}

export { incoterms };
