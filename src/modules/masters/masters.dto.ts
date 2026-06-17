import { IsIn, IsOptional, IsString } from 'class-validator';
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
}
