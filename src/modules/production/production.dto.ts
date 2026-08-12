import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

export class CreateInwardDto {
  @IsString()
  supplierId: string;

  @IsDateString()
  inwardDate: string;

  @IsString()
  truckNumber: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  numberOfBags?: number;

  @IsNumber()
  @Min(0.001)
  weight: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsString()
  inwardTypeId: string;

  @IsOptional()
  @IsString()
  otherTypeDesc?: string;

  @IsString()
  locationId: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class InwardQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  inwardTypeId?: string;

  @IsOptional()
  @IsString()
  truckNumber?: string;

  @IsOptional()
  @IsString()
  inwardNumber?: string;
}

export class StartProductionDto {
  @IsString()
  plantId: string;

  @IsString()
  processType: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  inwardId?: string;

  @IsString()
  stockCategory: string;

  @IsOptional()
  @IsString()
  rejectedLotId?: string;

  @IsOptional()
  @IsString()
  processedLotId?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  unit: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class AddInputDto {
  @IsDateString()
  inputDate: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  inwardId?: string;

  @IsString()
  stockCategory: string;

  @IsOptional()
  @IsString()
  rejectedLotId?: string;

  @IsOptional()
  @IsString()
  processedLotId?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class WastageLineDto {
  @IsString()
  wastageTypeId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  numberOfBags?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightPerBag?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CleaningResultDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WastageLineDto)
  lines: WastageLineDto[];
}

export class HullingResultDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WastageLineDto)
  lines: WastageLineDto[];
}

export class AllocateContainerDto {
  @IsString()
  contractId: string;

  @IsString()
  containerId: string;

  @IsOptional()
  @IsString()
  containerProductId?: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class StoreProcessedDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class AllocateFromStockDto {
  @IsString()
  processedLotId: string;

  @IsString()
  contractId: string;

  @IsString()
  containerId: string;

  @IsOptional()
  @IsString()
  containerProductId?: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  unit: string;
}

export class SampleResultDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsDateString()
  collectionDate?: string;

  @IsOptional()
  @IsDateString()
  resultDate?: string;

  @IsOptional()
  @IsString()
  testingAgency?: string;

  @IsOptional()
  @IsString()
  reportReference?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateTransferDto {
  @IsDateString()
  transferDate: string;

  @IsString()
  sourceLocationId: string;

  @IsString()
  destLocationId: string;

  @IsString()
  stockCategory: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  processedLotId?: string;

  @IsOptional()
  @IsString()
  rejectedLotId?: string;

  @IsOptional()
  @IsString()
  productionRunId?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
