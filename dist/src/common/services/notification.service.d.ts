import { EventEmitter } from 'events';
import { PrismaService } from '../../prisma/prisma.service';
export declare class NotificationService {
    private prisma;
    readonly emitter: EventEmitter<[never]>;
    constructor(prisma: PrismaService);
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
    }): Promise<void>;
    findForUser(userId: string, role: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        userId: string | null;
        targetRole: string | null;
        contractId: string | null;
        containerId: string | null;
        type: string;
        message: string;
        readAt: Date | null;
        createdAt: Date;
    }[]>;
    markRead(id: string): import(".prisma/client").Prisma.Prisma__NotificationClient<{
        id: string;
        userId: string | null;
        targetRole: string | null;
        contractId: string | null;
        containerId: string | null;
        type: string;
        message: string;
        readAt: Date | null;
        createdAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
}
