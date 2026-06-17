import { PrismaService } from '../../prisma/prisma.service';
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
}
export declare class OfficesModule {
}
