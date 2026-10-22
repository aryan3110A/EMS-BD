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
    unit?: string;
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
    wastageLotId?: string;
    jobWorkId?: string;
    quantity: number;
    unit?: string;
    startDate: string;
    remarks?: string;
}
export declare class WastageDispositionLineDto {
    wastageTypeId: string;
    action: string;
}
export declare class DirectAllocationLineDto {
    contractId: string;
    containerId: string;
    containerProductId?: string;
    quantityKg: number;
    remarks?: string;
}
export declare class FinaliseProductionDto {
    dispositions?: WastageDispositionLineDto[];
    directAllocations?: DirectAllocationLineDto[];
}
export declare class MergeWastageDto {
    sourceLotIds: string[];
    mergedLotName?: string;
}
export declare class WastageOutwardDto {
    outwardDate: string;
    wastageLotId: string;
    quantityKg: number;
    numberOfTrucks?: number;
    truckNumber?: string;
    destination?: string;
    remarks?: string;
}
export declare class FulfilmentAllocateDto {
    productId: string;
    locationId: string;
    contractId: string;
    containerId: string;
    containerProductId?: string;
    quantityKg: number;
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
    unit?: string;
    wastageLotId?: string;
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
    actualCleanedOutputKg?: number;
}
export declare class HullingResultDto {
    lines: WastageLineDto[];
    actualProcessedOutputKg?: number;
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
    processedLotId?: string;
    contractId: string;
    containerId: string;
    containerProductId?: string;
    productId: string;
    locationId?: string;
    quantity: number;
    unit?: string;
}
export declare class CreateJobWorkerDto {
    name: string;
    code?: string;
    phone?: string;
}
export declare class CreateJobWorkDto {
    jobWorkerId: string;
    sourceLocationId: string;
    productId: string;
    processType: string;
    startDate: string;
    remarks?: string;
}
export declare class JobWorkOutwardDto {
    outwardDate: string;
    sourceLocationId?: string;
    quantity: number;
    unit?: string;
    numberOfBags?: number;
    truckNumber?: string;
    challanNumber?: string;
    remarks?: string;
}
export declare class JobWorkInwardLineDto {
    returnCategory: string;
    wastageTypeId?: string;
    quantity: number;
    unit?: string;
    numberOfBags?: number;
    remarks?: string;
}
export declare class JobWorkInwardDto {
    receiptDate: string;
    receivingLocationId: string;
    truckNumber?: string;
    challanNumber?: string;
    remarks?: string;
    lines: JobWorkInwardLineDto[];
}
export declare class JobWorkProcessResultDto {
    totalProcessedInputKg: number;
    cleaningLines: WastageLineDto[];
    hullingLines?: WastageLineDto[];
    dispositions: WastageDispositionLineDto[];
}
export declare class CloseJobWorkDto {
    varianceKg?: number;
    varianceReason?: string;
}
export declare class StartReSortexDto {
    quantityKg: number;
    plantId?: string;
    startDate: string;
    remarks?: string;
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
