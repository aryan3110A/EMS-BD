export declare class CreateSupplierDto {
    name: string;
    code?: string;
    phone?: string;
    email?: string;
}
export declare class CreateInwardDto {
    supplierId: string;
    inwardDate: string;
    truckNumber: string;
    productId: string;
    numberOfBags?: number;
    weight: number;
    unit: string;
    price?: number;
    inwardTypeId: string;
    otherTypeDesc?: string;
    locationId: string;
    remarks?: string;
}
export declare class InwardQueryDto {
    startDate?: string;
    endDate?: string;
    supplierId?: string;
    productId?: string;
    locationId?: string;
    inwardTypeId?: string;
    truckNumber?: string;
    inwardNumber?: string;
}
export declare class StartProductionDto {
    plantId: string;
    processType: string;
    productId: string;
    supplierId?: string;
    inwardId?: string;
    stockCategory: string;
    rejectedLotId?: string;
    processedLotId?: string;
    quantity: number;
    unit: string;
    startDate: string;
    remarks?: string;
}
export declare class AddInputDto {
    inputDate: string;
    supplierId?: string;
    inwardId?: string;
    stockCategory: string;
    rejectedLotId?: string;
    processedLotId?: string;
    quantity: number;
    unit: string;
    remarks?: string;
}
export declare class WastageLineDto {
    wastageTypeId: string;
    quantity?: number;
    numberOfBags?: number;
    weightPerBag?: number;
    unit?: string;
    remarks?: string;
}
export declare class CleaningResultDto {
    lines: WastageLineDto[];
}
export declare class HullingResultDto {
    lines: WastageLineDto[];
}
export declare class AllocateContainerDto {
    contractId: string;
    containerId: string;
    containerProductId?: string;
    productId: string;
    quantity: number;
    unit: string;
    remarks?: string;
}
export declare class StoreProcessedDto {
    quantity?: number;
    unit?: string;
}
export declare class AllocateFromStockDto {
    processedLotId: string;
    contractId: string;
    containerId: string;
    containerProductId?: string;
    productId: string;
    quantity: number;
    unit: string;
}
export declare class SampleResultDto {
    status: string;
    result?: string;
    collectionDate?: string;
    resultDate?: string;
    testingAgency?: string;
    reportReference?: string;
    remarks?: string;
}
export declare class CreateTransferDto {
    transferDate: string;
    sourceLocationId: string;
    destLocationId: string;
    stockCategory: string;
    productId: string;
    processedLotId?: string;
    rejectedLotId?: string;
    productionRunId?: string;
    quantity: number;
    unit: string;
    remarks?: string;
}
