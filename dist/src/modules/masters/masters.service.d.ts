import { PrismaService } from '../../prisma/prisma.service';
import { CreateBuyerDto, CreatePackagingSizeDto, CreatePackagingTypeDto, CreateProductDto, CreateProductVariantDto, CreateSalespersonDto } from './masters.dto';
export declare class MastersService {
    private prisma;
    constructor(prisma: PrismaService);
    getSalespersons(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
    }[]>;
    getBuyers(officeId?: string): import(".prisma/client").Prisma.PrismaPromise<({
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            region: string | null;
            euClassification: string;
        };
        defaultPort: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string | null;
            portType: string;
            countryId: string;
        } | null;
    } & {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        officeId: string | null;
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
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        region: string | null;
        euClassification: string;
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
        region: string | null;
        euClassification: string;
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
            packagingTypeId: string;
            label: string;
            weightKg: number;
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
    getPorts(): import(".prisma/client").Prisma.PrismaPromise<({
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            region: string | null;
            euClassification: string;
        };
    } & {
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        euClassification: string | null;
        portType: string;
        countryId: string;
    })[]>;
    updateBuyer(id: string, dto: {
        address?: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
        euClassification?: string;
        code?: string;
        countryId?: string;
    }): Promise<{
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            region: string | null;
            euClassification: string;
        };
        defaultPort: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string | null;
            portType: string;
            countryId: string;
        } | null;
    } & {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        officeId: string | null;
        phone: string | null;
        euClassification: string | null;
        countryId: string;
        address: string | null;
        contactPerson: string | null;
        defaultPortId: string | null;
        remarks: string | null;
    }>;
    createSalesperson(dto: CreateSalespersonDto): Promise<{
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
    }>;
    createBuyer(dto: CreateBuyerDto): Promise<{
        country: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            region: string | null;
            euClassification: string;
        };
        defaultPort: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            euClassification: string | null;
            portType: string;
            countryId: string;
        } | null;
    } & {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        officeId: string | null;
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
            packagingTypeId: string;
            label: string;
            weightKg: number;
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
        packagingTypeId: string;
        label: string;
        weightKg: number;
        weightUnit: string;
    }>;
}
