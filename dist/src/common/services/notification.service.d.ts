import { EventEmitter } from 'events';
import { PrismaService } from '../../prisma/prisma.service';
export declare class NotificationService {
    private prisma;
    readonly emitter: EventEmitter<[never]>;
    constructor(prisma: PrismaService);
    notifyChange(params: {
        type: string;
        message: string;
        contractId?: string;
        containerId?: string;
        oldValue?: string;
        newValue?: string;
        changedById?: string;
        targetRoles?: string[];
        userIds?: string[];
    }): Promise<void>;
    notifyCommercialAmendment(params: {
        contractId: string;
        containerId: string;
        contractNumber: string;
        containerIndex: number;
        incoterm: string;
        previousValue: number;
        amendedValue: number;
        currency: string;
        reason: string;
        amendedByName: string;
        amendedById?: string;
    }): Promise<void>;
    findForUser(userId: string, role: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        oldValue: string | null;
        newValue: string | null;
        changedById: string | null;
        userId: string | null;
        contractId: string | null;
        containerId: string | null;
        targetRole: string | null;
        type: string;
        message: string;
        readAt: Date | null;
    }[]>;
    markRead(id: string, userId: string, role: string): Promise<{
        id: string;
    }>;
}
