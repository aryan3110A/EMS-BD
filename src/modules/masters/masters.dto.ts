import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { EuClassification } from '../../common/constants/enums';

const euTypes = Object.values(EuClassification);

export class UpdateBuyerDto {
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(euTypes)
  euClassification?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  countryId?: string;
}

export class CreateSalespersonDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateOfficeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  code?: string;
}

export class CreateBuyerDto {
  @IsString()
  name: string;

  @IsString()
  countryId: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  officeId?: string;
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  defaultSpecification?: string;
}

export class CreateProductVariantDto {
  @IsString()
  productId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  processingType?: string;
}

export class CreatePackagingTypeDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  material?: string;
}

export class CreatePackagingSizeDto {
  @IsString()
  packagingTypeId: string;

  @IsNumber()
  @Min(0.001)
  weightValue: number;

  @IsOptional()
  @IsString()
  weightUnit?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

export class CreateCountryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsIn(euTypes)
  euClassification?: string;
}
