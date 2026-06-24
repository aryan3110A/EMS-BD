import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContractStatus, PaymentType, Incoterm, EuClassification } from '../../common/constants/enums';
import { PRODUCT_SPECIFICATIONS } from '../../common/constants/commercial.constants';

const contractStatuses = Object.values(ContractStatus);
const paymentTypes = Object.values(PaymentType);
const incoterms = Object.values(Incoterm);
const euTypes = Object.values(EuClassification);
const fobUnits = ['PER_MT', 'PER_KG'];
const freightUnits = ['PER_CONTAINER', 'PER_MT', 'TOTAL_CONTRACT'];
const quantityUnits = ['MT', 'KG'];
const productSpecs = [...PRODUCT_SPECIFICATIONS];

export class CreateLotDto {
  @IsNumber()
  @Min(0.001)
  quantityMt: number;

  @IsOptional()
  @IsNumber()
  numberOfContainers?: number;

  @IsOptional()
  @IsDateString()
  expectedShipmentDate?: string;

  @IsOptional()
  @IsString()
  destinationPortId?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class CreateContainerProductDto {
  @IsNumber()
  @Min(1)
  containerIndex: number;

  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productVariantId?: string;

  @IsOptional()
  @IsString()
  processingType?: string;

  @IsOptional()
  @IsIn(productSpecs)
  specification?: string;

  @IsOptional()
  @IsString()
  productRemarks?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantityMt?: number;

  @IsOptional()
  @IsString()
  containerNo?: string;

  @IsOptional()
  @IsString()
  destinationPortId?: string;

  @IsOptional()
  @IsDateString()
  expectedShipmentDate?: string;

  @IsOptional()
  @IsString()
  shipmentMonth?: string;

  @IsOptional()
  @IsNumber()
  shipmentYear?: number;

  @IsOptional()
  @IsIn(['FIRST_HALF', 'SECOND_HALF'])
  shipmentHalf?: string;

  @IsOptional()
  @IsString()
  packagingTypeId?: string;

  @IsOptional()
  @IsString()
  packagingSizeId?: string;

  @IsOptional()
  @IsString()
  packingDescription?: string;

  @IsOptional()
  @IsNumber()
  packingSizeValue?: number;

  @IsOptional()
  @IsString()
  packingSizeUnit?: string;

  @IsOptional()
  @IsIn(incoterms)
  incoterm?: Incoterm;

  @IsOptional()
  @IsNumber()
  fobPrice?: number;

  @IsOptional()
  @IsString()
  fobCurrency?: string;

  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @IsOptional()
  @IsDateString()
  exchangeRateAt?: string;

  @IsOptional()
  @IsString()
  exchangeRateSource?: string;

  @IsOptional()
  @IsBoolean()
  exchangeRateManual?: boolean;

  @IsOptional()
  @IsNumber()
  totalFreight?: number;

  @IsOptional()
  @IsNumber()
  insurance?: number;

  @IsOptional()
  @IsString()
  commercialRemarks?: string;
}

export class CreateContractDto {
  @IsString()
  officeId: string;

  // Section A — Basic
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @IsOptional()
  @IsDateString()
  contractSentDate?: string;

  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsDateString()
  contractDate?: string;

  @IsOptional()
  @IsDateString()
  signedContractReceivedDate?: string;

  @IsOptional()
  @IsString()
  salespersonId?: string;

  @IsOptional()
  @IsString()
  contractOnBehalfOf?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  internalRemarks?: string;

  // Section B — Buyer
  @IsString()
  buyerId: string;

  @IsOptional()
  @IsIn(euTypes)
  euClassification?: EuClassification;

  @IsOptional()
  @IsString()
  buyerRemarks?: string;

  @IsOptional()
  @IsString()
  buyerLotNo?: string;

  // Section C — Product
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productVariantId?: string;

  @IsOptional()
  @IsString()
  processingType?: string;

  @IsNumber()
  @Min(0.001)
  totalMt: number;

  @IsOptional()
  @IsIn(quantityUnits)
  quantityUnit?: string;

  @IsOptional()
  @IsString()
  specification?: string;

  @IsOptional()
  @IsString()
  qualityRequirement?: string;

  @IsOptional()
  @IsString()
  productRemarks?: string;

  @IsOptional()
  @IsNumber()
  standardContainerMt?: number;

  // Section D — Commercial
  @IsOptional()
  @IsIn(incoterms)
  incoterm?: Incoterm;

  @IsOptional()
  @IsNumber()
  fobPrice?: number;

  @IsOptional()
  @IsString()
  fobCurrency?: string;

  @IsOptional()
  @IsIn(fobUnits)
  fobPriceUnit?: string;

  @IsOptional()
  @IsNumber()
  freight?: number;

  @IsOptional()
  @IsIn(freightUnits)
  freightUnit?: string;

  @IsOptional()
  @IsNumber()
  insurance?: number;

  @IsOptional()
  @IsNumber()
  cifPrice?: number;

  @IsOptional()
  @IsBoolean()
  cifManualOverride?: boolean;

  @IsOptional()
  @IsNumber()
  exchangeRate?: number;

  @IsOptional()
  @IsNumber()
  originalContractPrice?: number;

  @IsOptional()
  @IsNumber()
  amendmentPrice?: number;

  @IsOptional()
  @IsString()
  amendmentCurrency?: string;

  @IsOptional()
  @IsDateString()
  amendmentDate?: string;

  @IsOptional()
  @IsString()
  amendmentReason?: string;

  @IsOptional()
  @IsString()
  commercialRemarks?: string;

  // Later sections
  @IsOptional()
  @IsString()
  packagingTypeId?: string;

  @IsOptional()
  @IsString()
  packagingSizeId?: string;

  @IsOptional()
  @IsNumber()
  packingSizeValue?: number;

  @IsOptional()
  @IsString()
  packingSizeUnit?: string;

  @IsOptional()
  @IsString()
  packingDescription?: string;

  @IsOptional()
  @IsIn(paymentTypes)
  paymentType?: PaymentType;

  @IsOptional()
  @IsNumber()
  advancePercentage?: number;

  @IsOptional()
  @IsString()
  balancePaymentMode?: string;

  @IsOptional()
  @IsString()
  balancePaymentStage?: string;

  @IsOptional()
  @IsString()
  paymentDescription?: string;

  @IsOptional()
  @IsString()
  portOfLoadingId?: string;

  @IsOptional()
  @IsString()
  destinationPortId?: string;

  @IsOptional()
  @IsDateString()
  shipmentPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  shipmentPeriodEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  numberOfContainers?: number;

  @IsOptional()
  @IsString()
  shipmentMonth?: string;

  @IsOptional()
  @IsNumber()
  shipmentYear?: number;

  @IsOptional()
  @IsIn(['FIRST_HALF', 'SECOND_HALF'])
  shipmentHalf?: string;

  @IsOptional()
  @IsDateString()
  expectedShipmentDate?: string;

  @IsOptional()
  @IsString()
  containerNo?: string;

  @IsOptional()
  @IsIn(contractStatuses)
  status?: ContractStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLotDto)
  lots?: CreateLotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContainerProductDto)
  containerProducts?: CreateContainerProductDto[];
}

export class UpdateContractDto extends CreateContractDto {}

export class ContractQueryDto {
  @IsOptional()
  @IsString()
  officeId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  salespersonId?: string;

  @IsOptional()
  @IsString()
  buyerId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  shipmentMonth?: string;
}
