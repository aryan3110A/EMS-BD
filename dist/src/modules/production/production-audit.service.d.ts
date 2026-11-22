import { PrismaService } from '../../prisma/prisma.service';
export declare class ProductionAuditService {
    private prisma;
    constructor(prisma: PrismaService);
    log(params: {
        module: string;
        recordType: string;
        recordNumber?: string;
        action: string;
        fieldName?: string;
        oldValue?: string | null;
        newValue?: string | null;
        changedById?: string;
        reason?: string;
        ipAddress?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        module: string;
        recordType: string;
        recordNumber: string | null;
        action: string;
        fieldName: string | null;
        oldValue: string | null;
        newValue: string | null;
        reason: string | null;
        ipAddress: string | null;
        changedById: string | null;
    }>;
    list(query: {
        module?: string;
        recordNumber?: string;
        take?: number;
    }): import(".prisma/client").Prisma.PrismaPromise<({
        changedBy: {
            id: string;
            name: string;
            email: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        module: string;
        recordType: string;
        recordNumber: string | null;
        action: string;
        fieldName: string | null;
        oldValue: string | null;
        newValue: string | null;
        reason: string | null;
        ipAddress: string | null;
        changedById: string | null;
    })[]>;
}
