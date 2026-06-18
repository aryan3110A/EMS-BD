import { Type } from 'class-transformer';
import { IsDefined, IsOptional, ValidateNested } from 'class-validator';
import { UpdateBuyerDto } from '../masters/masters.dto';
import { CreateContractDto } from './contracts.dto';
import { PendingMastersDto } from './pending-masters.dto';

export class SubmitContractDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateContractDto)
  contract!: CreateContractDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PendingMastersDto)
  pendingMasters?: PendingMastersDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateBuyerDto)
  buyerUpdate?: UpdateBuyerDto;
}
