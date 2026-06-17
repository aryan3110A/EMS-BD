import { MastersService } from './masters.service';
import { UpdateBuyerDto } from './masters.dto';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
export declare class MastersController {
    private mastersService;
    constructor(mastersService: MastersService);
    getSalespersons(): import(".prisma/client").Prisma.PrismaPromise<{
        phone: string | null;
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getBuyers(user: JwtPayload, officeId?: string): import(".prisma/client").Prisma.PrismaPromise<({
        country: {
            euClassification: string;
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            region: string | null;
        };
        defaultPort: {
            euClassification: string | null;
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            countryId: string;
            portType: string;
        } | null;
    } & {
        address: string | null;
        contactPerson: string | null;
        email: string | null;
        phone: string | null;
        euClassification: string | null;
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        officeId: string | null;
        countryId: string;
        defaultPortId: string | null;
        remarks: string | null;
    })[]>;
    getCountries(): import(".prisma/client").Prisma.PrismaPromise<{
        euClassification: string;
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        region: string | null;
    }[]>;
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
            euClassification: string;
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            region: string | null;
        };
    } & {
        euClassification: string | null;
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        countryId: string;
        portType: string;
    })[]>;
    updateBuyer(id: string, dto: UpdateBuyerDto): Promise<{
        country: {
            euClassification: string;
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            region: string | null;
        };
        defaultPort: {
            euClassification: string | null;
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            countryId: string;
            portType: string;
        } | null;
    } & {
        address: string | null;
        contactPerson: string | null;
        email: string | null;
        phone: string | null;
        euClassification: string | null;
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        officeId: string | null;
        countryId: string;
        defaultPortId: string | null;
        remarks: string | null;
    }>;
}
