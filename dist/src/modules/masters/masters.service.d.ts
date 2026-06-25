import { PrismaService } from '../../prisma/prisma.service';
import { CreateBuyerDto, CreatePackagingSizeDto, CreatePackagingTypeDto, CreateProductDto, CreateProductVariantDto, CreateSalespersonDto } from './masters.dto';
export declare class MastersService {
    private prisma;
    constructor(prisma: PrismaService);
    getSalespersons(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getBuyers(officeId?: string, search?: string, includeInactive?: boolean): import(".prisma/client").Prisma.PrismaPromise<({
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string;
            region: string | null;
        };
        defaultPort: {
            id: string;
            code: string | null;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            countryId: string;
            euClassification: string | null;
            portType: string;
        } | null;
    } & {
        id: string;
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        countryId: string;
        officeId: string | null;
        address: string | null;
        contactPerson: string | null;
        email: string | null;
        euClassification: string | null;
        defaultPortId: string | null;
        remarks: string | null;
    })[]>;
    getCountries(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        euClassification: string;
        region: string | null;
    }[]>;
    createCountry(dto: {
        name: string;
        code?: string;
        euClassification?: string;
    }): Promise<{
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        euClassification: string;
        region: string | null;
    }>;
    getProducts(): import(".prisma/client").Prisma.PrismaPromise<({
        variants: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            productId: string;
            processingType: string | null;
        }[];
    } & {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        category: string | null;
        defaultSpecification: string | null;
        standardContainerMt: number;
    })[]>;
    getPackaging(): import(".prisma/client").Prisma.PrismaPromise<({
        sizes: {
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            weightKg: number;
            packagingTypeId: string;
            label: string;
            weightUnit: string;
        }[];
    } & {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        material: string;
    })[]>;
    getPorts(includeInactive?: boolean): import(".prisma/client").Prisma.PrismaPromise<({
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string;
            region: string | null;
        };
    } & {
        id: string;
        code: string | null;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        countryId: string;
        euClassification: string | null;
        portType: string;
    })[]>;
    createPort(dto: {
        name: string;
        countryId: string;
        code?: string;
        portType?: string;
    }, userId?: string): Promise<{
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string;
            region: string | null;
        };
    } & {
        id: string;
        code: string | null;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        countryId: string;
        euClassification: string | null;
        portType: string;
    }>;
    updateBuyer(id: string, dto: {
        address?: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
        euClassification?: string;
        code?: string;
        countryId?: string;
        defaultPortId?: string;
    }, userId?: string): Promise<{
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string;
            region: string | null;
        };
        defaultPort: {
            id: string;
            code: string | null;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            countryId: string;
            euClassification: string | null;
            portType: string;
        } | null;
    } & {
        id: string;
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        countryId: string;
        officeId: string | null;
        address: string | null;
        contactPerson: string | null;
        email: string | null;
        euClassification: string | null;
        defaultPortId: string | null;
        remarks: string | null;
    }>;
    deactivateBuyer(id: string, userId?: string): Promise<{
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string;
            region: string | null;
        };
        defaultPort: {
            id: string;
            code: string | null;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            countryId: string;
            euClassification: string | null;
            portType: string;
        } | null;
    } & {
        id: string;
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        countryId: string;
        officeId: string | null;
        address: string | null;
        contactPerson: string | null;
        email: string | null;
        euClassification: string | null;
        defaultPortId: string | null;
        remarks: string | null;
    }>;
    updatePort(id: string, dto: {
        name?: string;
        code?: string;
        countryId?: string;
        isActive?: boolean;
    }, userId?: string): Promise<{
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string;
            region: string | null;
        };
    } & {
        id: string;
        code: string | null;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        countryId: string;
        euClassification: string | null;
        portType: string;
    }>;
    createSalesperson(dto: CreateSalespersonDto): Promise<{
        id: string;
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createBuyer(dto: CreateBuyerDto, userId?: string): Promise<{
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string;
            region: string | null;
        };
        defaultPort: {
            id: string;
            code: string | null;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            countryId: string;
            euClassification: string | null;
            portType: string;
        } | null;
    } & {
        id: string;
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        countryId: string;
        officeId: string | null;
        address: string | null;
        contactPerson: string | null;
        email: string | null;
        euClassification: string | null;
        defaultPortId: string | null;
        remarks: string | null;
    }>;
    createProduct(dto: CreateProductDto): Promise<({
        variants: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            productId: string;
            processingType: string | null;
        }[];
    } & {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        category: string | null;
        defaultSpecification: string | null;
        standardContainerMt: number;
    }) | null>;
    createProductVariant(dto: CreateProductVariantDto): Promise<({
        variants: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            productId: string;
            processingType: string | null;
        }[];
    } & {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        category: string | null;
        defaultSpecification: string | null;
        standardContainerMt: number;
    }) | null>;
    createPackagingType(dto: CreatePackagingTypeDto): Promise<{
        sizes: {
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            weightKg: number;
            packagingTypeId: string;
            label: string;
            weightUnit: string;
        }[];
    } & {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        material: string;
    }>;
    createPackagingSize(dto: CreatePackagingSizeDto): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        weightKg: number;
        packagingTypeId: string;
        label: string;
        weightUnit: string;
    }>;
}
