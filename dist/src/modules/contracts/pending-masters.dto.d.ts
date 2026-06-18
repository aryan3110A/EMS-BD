export declare class PendingCountryDto {
    id: string;
    name: string;
    euClassification?: string;
}
export declare class PendingOfficeDto {
    id: string;
    name: string;
    city?: string;
}
export declare class PendingSalespersonDto {
    id: string;
    name: string;
}
export declare class PendingBuyerDto {
    id: string;
    name: string;
    countryId: string;
}
export declare class PendingProductVariantDto {
    id: string;
    name: string;
    code?: string;
    processingType?: string;
}
export declare class PendingProductDto {
    id: string;
    name: string;
    code: string;
    variants?: PendingProductVariantDto[];
}
export declare class PendingProductVariantLinkDto {
    id: string;
    productId: string;
    name: string;
    processingType?: string;
}
export declare class PendingPackagingTypeDto {
    id: string;
    name: string;
    code?: string;
}
export declare class PendingPackagingSizeDto {
    id: string;
    packagingTypeId: string;
    label: string;
    weightKg: number;
    weightUnit: string;
    weightValue: number;
}
export declare class PendingMastersDto {
    countries?: PendingCountryDto[];
    offices?: PendingOfficeDto[];
    salespersons?: PendingSalespersonDto[];
    buyers?: PendingBuyerDto[];
    products?: PendingProductDto[];
    productVariants?: PendingProductVariantLinkDto[];
    packagingTypes?: PendingPackagingTypeDto[];
    packagingSizes?: PendingPackagingSizeDto[];
}
