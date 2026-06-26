import { PrismaService } from '../../prisma/prisma.service';
import { CreateBuyerDto, CreatePackagingSizeDto, CreatePackagingTypeDto, CreateProductDto, CreateProductVariantDto, CreateSalespersonDto } from './masters.dto';
export declare class MastersService {
    private prisma;
    constructor(prisma: PrismaService);
    getSalespersons(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        phone: string | null;
    }[]>;
    getBuyers(officeId?: string, search?: string, includeInactive?: boolean): import(".prisma/client").Prisma.PrismaPromise<({
        country: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            region: string | null;
            euClassification: string;
        };
        defaultPort: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            euClassification: string | null;
            portType: string;
            countryId: string;
        } | null;
    } & {
        id: string;
        email: string | null;
        name: string;
        officeId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        phone: string | null;
        euClassification: string | null;
        countryId: string;
        address: string | null;
        contactPerson: string | null;
        defaultPortId: string | null;
        remarks: string | null;
    })[]>;
    getCountries(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        region: string | null;
        euClassification: string;
    }[]>;
    createCountry(dto: {
        name: string;
        code?: string;
        euClassification?: string;
    }): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        region: string | null;
        euClassification: string;
    }>;
    getProducts(): import(".prisma/client").Prisma.PrismaPromise<({
        variants: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            productId: string;
            processingType: string | null;
        }[];
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
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
            packagingTypeId: string;
            label: string;
            weightKg: number;
            weightUnit: string;
        }[];
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        material: string;
    })[]>;
    getPorts(includeInactive?: boolean): import(".prisma/client").Prisma.PrismaPromise<({
        country: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            region: string | null;
            euClassification: string;
        };
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        euClassification: string | null;
        portType: string;
        countryId: string;
    })[]>;
    createPort(dto: {
        name: string;
        countryId: string;
        code?: string;
        portType?: string;
    }, userId?: string): Promise<{
        country: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            region: string | null;
            euClassification: string;
        };
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        euClassification: string | null;
        portType: string;
        countryId: string;
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
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            region: string | null;
            euClassification: string;
        };
        defaultPort: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            euClassification: string | null;
            portType: string;
            countryId: string;
        } | null;
    } & {
        id: string;
        email: string | null;
        name: string;
        officeId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        phone: string | null;
        euClassification: string | null;
        countryId: string;
        address: string | null;
        contactPerson: string | null;
        defaultPortId: string | null;
        remarks: string | null;
    }>;
    deactivateBuyer(id: string, userId?: string): Promise<{
        country: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            region: string | null;
            euClassification: string;
        };
        defaultPort: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            euClassification: string | null;
            portType: string;
            countryId: string;
        } | null;
    } & {
        id: string;
        email: string | null;
        name: string;
        officeId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        phone: string | null;
        euClassification: string | null;
        countryId: string;
        address: string | null;
        contactPerson: string | null;
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
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            region: string | null;
            euClassification: string;
        };
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
        euClassification: string | null;
        portType: string;
        countryId: string;
    }>;
    createSalesperson(dto: CreateSalespersonDto): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        phone: string | null;
    }>;
    createBuyer(dto: CreateBuyerDto, userId?: string): Promise<{
        country: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            region: string | null;
            euClassification: string;
        };
        defaultPort: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string | null;
            euClassification: string | null;
            portType: string;
            countryId: string;
        } | null;
    } & {
        id: string;
        email: string | null;
        name: string;
        officeId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        phone: string | null;
        euClassification: string | null;
        countryId: string;
        address: string | null;
        contactPerson: string | null;
        defaultPortId: string | null;
        remarks: string | null;
    }>;
    createProduct(dto: CreateProductDto): Promise<({
        variants: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            productId: string;
            processingType: string | null;
        }[];
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        category: string | null;
        defaultSpecification: string | null;
        standardContainerMt: number;
    }) | null>;
    createProductVariant(dto: CreateProductVariantDto): Promise<({
        variants: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            productId: string;
            processingType: string | null;
        }[];
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
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
            packagingTypeId: string;
            label: string;
            weightKg: number;
            weightUnit: string;
        }[];
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        material: string;
    }>;
    createPackagingSize(dto: CreatePackagingSizeDto): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        packagingTypeId: string;
        label: string;
        weightKg: number;
        weightUnit: string;
    }>;
}
