import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export declare class InventoryLedgerService {
    private prisma;
    constructor(prisma: PrismaService);
    private nextTxnNumber;
    private adjustBalance;
    postTxn(tx: Prisma.TransactionClient, params: {
        txnType: string;
        productId: string;
        stockCategory: string;
        sourceLocationId?: string | null;
        destLocationId?: string | null;
        quantityInKg?: number;
        quantityOutKg?: number;
        referenceType?: string;
        referenceId?: string;
        remarks?: string;
        createdById?: string;
        fromCategory?: string;
        toCategory?: string;
        locationId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        productId: string;
        remarks: string | null;
        createdById: string | null;
        txnNumber: string;
        txnType: string;
        stockCategory: string;
        sourceLocationId: string | null;
        destLocationId: string | null;
        quantityInKg: number;
        quantityOutKg: number;
        balanceKg: number | null;
        referenceType: string | null;
        referenceId: string | null;
    }>;
    getAvailableKg(productId: string, locationId: string, stockCategory?: string): Promise<number>;
}
