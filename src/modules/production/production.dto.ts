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

  @IsOptional()
  @IsString()
  unit?: string;

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

  @IsOptional()
  @IsString()
  wastageLotId?: string;

  @IsOptional()
  @IsString()
  jobWorkId?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class WastageDispositionLineDto {
  @IsString()
  wastageTypeId: string;

  @IsString()
  action: string; // STORE | DISCARD
}

export class FinaliseProductionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WastageDispositionLineDto)
  dispositions: WastageDispositionLineDto[];
}

export class FulfilmentAllocateDto {
  @IsString()
  productId: string;

  @IsString()
  locationId: string;

  @IsString()
  contractId: string;

  @IsString()
  containerId: string;

  @IsOptional()
  @IsString()
  containerProductId?: string;

  @IsNumber()
  @Min(0.001)
  quantityKg: number;

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

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  wastageLotId?: string;

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
  @IsOptional()
  @IsString()
  processedLotId?: string;

  @IsString()
  contractId: string;

  @IsString()
  containerId: string;

  @IsOptional()
  @IsString()
  containerProductId?: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

/** Job Work DTOs */
export class CreateJobWorkerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateJobWorkDto {
  @IsString()
  jobWorkerId: string;

  @IsString()
  sourceLocationId: string;

  @IsString()
  productId: string;

  @IsString()
  processType: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class JobWorkOutwardDto {
  @IsDateString()
  outwardDate: string;

  @IsOptional()
  @IsString()
  sourceLocationId?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  numberOfBags?: number;

  @IsOptional()
  @IsString()
  truckNumber?: string;

  @IsOptional()
  @IsString()
  challanNumber?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class JobWorkInwardLineDto {
  @IsString()
  returnCategory: string;

  @IsOptional()
  @IsString()
  wastageTypeId?: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  numberOfBags?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class JobWorkInwardDto {
  @IsDateString()
  receiptDate: string;

  @IsString()
  receivingLocationId: string;

  @IsOptional()
  @IsString()
  truckNumber?: string;

  @IsOptional()
  @IsString()
  challanNumber?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobWorkInwardLineDto)
  lines: JobWorkInwardLineDto[];
}

export class JobWorkProcessResultDto {
  @IsNumber()
  @Min(0)
  totalProcessedInputKg: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WastageLineDto)
  cleaningLines: WastageLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WastageLineDto)
  hullingLines?: WastageLineDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WastageDispositionLineDto)
  dispositions: WastageDispositionLineDto[];
}

export class CloseJobWorkDto {
  @IsOptional()
  @IsNumber()
  varianceKg?: number;

  @IsOptional()
  @IsString()
  varianceReason?: string;
}

export class StartReSortexDto {
  @IsNumber()
  @Min(0.001)
  quantityKg: number;

  @IsOptional()
  @IsString()
  plantId?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  remarks?: string;
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
