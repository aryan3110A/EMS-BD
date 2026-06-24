export declare class UpdateBuyerDto {
    address?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    euClassification?: string;
    code?: string;
    countryId?: string;
    defaultPortId?: string;
}
export declare class UpdatePortDto {
    name?: string;
    code?: string;
    countryId?: string;
    isActive?: boolean;
}
export declare class CreateSalespersonDto {
    name: string;
    phone?: string;
}
export declare class CreateOfficeDto {
    name: string;
    city?: string;
    code?: string;
}
export declare class CreateBuyerDto {
    name: string;
    countryId: string;
    code?: string;
    officeId?: string;
}
export declare class CreateProductDto {
    name: string;
    code?: string;
    category?: string;
    defaultSpecification?: string;
}
export declare class CreateProductVariantDto {
    productId: string;
    name: string;
    code?: string;
    processingType?: string;
}
export declare class CreatePackagingTypeDto {
    name: string;
    code?: string;
    material?: string;
}
export declare class CreatePackagingSizeDto {
    packagingTypeId: string;
    weightValue: number;
    weightUnit?: string;
    label?: string;
}
export declare class CreateCountryDto {
    name: string;
    code?: string;
    euClassification?: string;
}
export declare class CreatePortDto {
    name: string;
    countryId: string;
    code?: string;
    portType?: string;
}
