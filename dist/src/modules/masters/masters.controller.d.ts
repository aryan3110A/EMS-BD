import { MastersService } from './masters.service';
import { UpdateBuyerDto, UpdatePortDto, CreateSalespersonDto, CreateBuyerDto, CreateProductDto, CreateProductVariantDto, CreatePackagingTypeDto, CreatePackagingSizeDto, CreateCountryDto, CreatePortDto } from './masters.dto';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
export declare class MastersController {
    private mastersService;
    constructor(mastersService: MastersService);
    getSalespersons(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        phone: string | null;
    }[]>;
    createSalesperson(dto: CreateSalespersonDto): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        phone: string | null;
    }>;
    getBuyers(user: JwtPayload, officeId?: string, search?: string, includeInactive?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    createBuyer(user: JwtPayload, dto: CreateBuyerDto): Promise<{
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
    createCountry(dto: CreateCountryDto): Promise<{
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
    getPorts(includeInactive?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
    createPort(user: JwtPayload, dto: CreatePortDto): Promise<{
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
    updateBuyer(id: string, user: JwtPayload, dto: UpdateBuyerDto): Promise<{
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
    deactivateBuyer(id: string, user: JwtPayload): Promise<{
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
    updatePort(id: string, user: JwtPayload, dto: UpdatePortDto): Promise<{
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
}
