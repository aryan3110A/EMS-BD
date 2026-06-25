import { MastersService } from './masters.service';
import { UpdateBuyerDto, UpdatePortDto, CreateSalespersonDto, CreateBuyerDto, CreateProductDto, CreateProductVariantDto, CreatePackagingTypeDto, CreatePackagingSizeDto, CreateCountryDto, CreatePortDto } from './masters.dto';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
export declare class MastersController {
    private mastersService;
    constructor(mastersService: MastersService);
    getSalespersons(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    createSalesperson(dto: CreateSalespersonDto): Promise<{
        id: string;
        code: string;
        name: string;
        phone: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getBuyers(user: JwtPayload, officeId?: string, search?: string, includeInactive?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    createBuyer(user: JwtPayload, dto: CreateBuyerDto): Promise<{
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
    createCountry(dto: CreateCountryDto): Promise<{
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
    getPorts(includeInactive?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    createPort(user: JwtPayload, dto: CreatePortDto): Promise<{
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
    updateBuyer(id: string, user: JwtPayload, dto: UpdateBuyerDto): Promise<{
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
    deactivateBuyer(id: string, user: JwtPayload): Promise<{
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
    updatePort(id: string, user: JwtPayload, dto: UpdatePortDto): Promise<{
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
}
