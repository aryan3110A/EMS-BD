import { ContractStatus, PaymentType, Incoterm, EuClassification } from '../../common/constants/enums';
export declare class CreateLotDto {
    quantityMt: number;
    numberOfContainers?: number;
    expectedShipmentDate?: string;
    destinationPortId?: string;
    remarks?: string;
}
export declare class ContainerProductLineDto {
    productIndex?: number;
    productId: string;
    productVariantId?: string;
    processingType?: string;
    specification?: string;
    quantityMt: number;
    packagingTypeId?: string;
    packagingSizeId?: string;
    packingDescription?: string;
    packingSizeValue?: number;
    packingSizeUnit?: string;
    productRemarks?: string;
}
export declare class CreateContainerProductDto {
    containerIndex: number;
    productId?: string;
    productVariantId?: string;
    processingType?: string;
    specification?: string;
    productRemarks?: string;
    quantityMt?: number;
    products?: ContainerProductLineDto[];
    containerNo?: string;
    factorySealNo?: string;
    shippingLineSealNo?: string;
    destinationPortId?: string;
    expectedShipmentDate?: string;
    shipmentMonth?: string;
    shipmentYear?: number;
    shipmentHalf?: string;
    packagingTypeId?: string;
    packagingSizeId?: string;
    packingDescription?: string;
    packingSizeValue?: number;
    packingSizeUnit?: string;
    incoterm?: Incoterm;
    fobPrice?: number;
    fobCurrency?: string;
    exchangeRate?: number;
    exchangeRateAt?: string;
    exchangeRateSource?: string;
    exchangeRateManual?: boolean;
    totalFreight?: number;
    insurance?: number;
    commercialRemarks?: string;
    invoiceNumber?: string;
    invoiceAmount?: number;
    invoiceDate?: string;
    paymentReceived?: boolean;
    paymentStatus?: string;
    receivedAmount?: number;
    paymentRemarks?: string;
    containerStatus?: string;
}
export declare class CreateContractDto {
    officeId: string;
    contractNumber?: string;
    contractSentDate?: string;
    receivedDate?: string;
    contractDate?: string;
    signedContractReceivedDate?: string;
    salespersonId?: string;
    salespersonIds?: string[];
    contractOnBehalfOf?: string;
    invoiceNumber?: string;
    remarks?: string;
    internalRemarks?: string;
    buyerId: string;
    euClassification?: EuClassification;
    buyerRemarks?: string;
    buyerLotNo?: string;
    productId?: string;
    productVariantId?: string;
    processingType?: string;
    totalMt: number;
    quantityUnit?: string;
    specification?: string;
    qualityRequirement?: string;
    productRemarks?: string;
    standardContainerMt?: number;
    incoterm?: Incoterm;
    fobPrice?: number;
    fobCurrency?: string;
    fobPriceUnit?: string;
    freight?: number;
    freightUnit?: string;
    insurance?: number;
    cifPrice?: number;
    cifManualOverride?: boolean;
    exchangeRate?: number;
    originalContractPrice?: number;
    amendmentPrice?: number;
    amendmentCurrency?: string;
    amendmentDate?: string;
    amendmentReason?: string;
    commercialRemarks?: string;
    packagingTypeId?: string;
    packagingSizeId?: string;
    packingSizeValue?: number;
    packingSizeUnit?: string;
    packingDescription?: string;
    paymentType?: PaymentType;
    advancePercentage?: number;
    balancePaymentMode?: string;
    balancePaymentStage?: string;
    otherPaymentMethod?: string;
    paymentDescription?: string;
    portOfLoadingId?: string;
    destinationPortId?: string;
    shipmentPeriodStart?: string;
    shipmentPeriodEnd?: string;
    numberOfContainers?: number;
    shipmentMonth?: string;
    shipmentYear?: number;
    shipmentHalf?: string;
    expectedShipmentDate?: string;
    containerNo?: string;
    status?: ContractStatus;
    lots?: CreateLotDto[];
    containerProducts?: CreateContainerProductDto[];
}
export declare class UpdateContractDto extends CreateContractDto {
}
export declare class ContractQueryDto {
    officeId?: string;
    status?: string;
    salespersonId?: string;
    buyerId?: string;
    search?: string;
    shipmentMonth?: string;
}
export declare class DashboardQueryDto {
    startDate?: string;
    endDate?: string;
    productId?: string;
    buyerId?: string;
    contractStatus?: string;
    containerStatus?: string;
    destinationPortId?: string;
    shipmentPeriod?: string;
    euClassification?: string;
    salespersonId?: string;
    superSalesUserId?: string;
    paymentStatus?: string;
}
export declare class UpdateContainerStatusDto {
    status: string;
    remarks?: string;
}
