import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class PendingCountryDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  euClassification?: string;
}

export class PendingOfficeDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  city?: string;
}

export class PendingSalespersonDto {
  @IsString()
  id: string;

  @IsString()
  name: string;
}

export class PendingBuyerDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  countryId: string;
}

export class PendingProductVariantDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  processingType?: string;
}

export class PendingProductDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingProductVariantDto)
  variants?: PendingProductVariantDto[];
}

export class PendingProductVariantLinkDto {
  @IsString()
  id: string;

  @IsString()
  productId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  processingType?: string;
}

export class PendingPackagingTypeDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class PendingPackagingSizeDto {
  @IsString()
  id: string;

  @IsString()
  packagingTypeId: string;

  @IsString()
  label: string;

  @IsNumber()
  weightKg: number;

  @IsString()
  weightUnit: string;

  @IsNumber()
  weightValue: number;
}

export class PendingMastersDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingCountryDto)
  countries?: PendingCountryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingOfficeDto)
  offices?: PendingOfficeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingSalespersonDto)
  salespersons?: PendingSalespersonDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingBuyerDto)
  buyers?: PendingBuyerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingProductDto)
  products?: PendingProductDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingProductVariantLinkDto)
  productVariants?: PendingProductVariantLinkDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingPackagingTypeDto)
  packagingTypes?: PendingPackagingTypeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PendingPackagingSizeDto)
  packagingSizes?: PendingPackagingSizeDto[];
}
