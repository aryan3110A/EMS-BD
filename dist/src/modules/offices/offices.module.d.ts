import { PrismaService } from '../../prisma/prisma.service';
declare class CreateOfficeDto {
    name: string;
    city?: string;
    code?: string;
}
export declare class OfficesController {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string;
        name: string;
        city: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(dto: CreateOfficeDto): import(".prisma/client").Prisma.Prisma__OfficeClient<{
        id: string;
        code: string;
        name: string;
        city: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
export declare class OfficesModule {
}
export {};
