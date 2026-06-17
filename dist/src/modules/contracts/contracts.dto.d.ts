import { ContractStatus, PaymentType, Incoterm, EuClassification } from '../../common/constants/enums';
export declare class CreateLotDto {
    quantityMt: number;
    numberOfContainers?: number;
    expectedShipmentDate?: string;
    destinationPortId?: string;
    remarks?: string;
}
export declare class CreateContractDto {
    officeId: string;
    contractNumber?: string;
    contractSentDate?: string;
    receivedDate?: string;
    contractDate?: string;
    signedContractReceivedDate?: string;
    salespersonId?: string;
    contractOnBehalfOf?: string;
    invoiceNumber?: string;
    remarks?: string;
    internalRemarks?: string;
    buyerId: string;
    euClassification?: EuClassification;
    buyerRemarks?: string;
    buyerLotNo?: string;
    productId: string;
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
    packingDescription?: string;
    paymentType?: PaymentType;
    advancePercentage?: number;
    balancePaymentMode?: string;
    balancePaymentStage?: string;
    paymentDescription?: string;
    portOfLoadingId?: string;
    destinationPortId?: string;
    shipmentPeriodStart?: string;
    shipmentPeriodEnd?: string;
    expectedShipmentDate?: string;
    containerNo?: string;
    status?: ContractStatus;
    lots?: CreateLotDto[];
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
