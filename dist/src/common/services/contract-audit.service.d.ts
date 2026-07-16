import { PrismaService } from '../../prisma/prisma.service';
export type AuditFieldChange = {
    contractId: string;
    contractNumber?: string;
    containerId?: string;
    containerIndex?: number;
    fieldName: string;
    previousValue?: string | null;
    newValue?: string | null;
    changedById: string;
};
export declare class ContractAuditService {
    private prisma;
    constructor(prisma: PrismaService);
    logChanges(changes: AuditFieldChange[]): Promise<void>;
    logChange(change: AuditFieldChange): Promise<void>;
    findByContract(contractId: string): import(".prisma/client").Prisma.PrismaPromise<({
        changedBy: {
            id: string;
            name: string;
            email: string;
        };
    } & {
        id: string;
        createdAt: Date;
        contractNumber: string | null;
        previousValue: string | null;
        newValue: string | null;
        contractId: string;
        containerId: string | null;
        containerIndex: number | null;
        fieldName: string;
        changedById: string;
    })[]>;
}
