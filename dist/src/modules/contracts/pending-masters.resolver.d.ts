import { Prisma } from '@prisma/client';
import type { CreateContractDto } from './contracts.dto';
import { PendingMastersDto } from './pending-masters.dto';
export type BuyerUpdatePayload = {
    address?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    euClassification?: string;
    code?: string;
    countryId?: string;
};
declare function resolveId(id: string | undefined, idMap: Map<string, string>): string | undefined;
export declare function resolvePendingMastersInTx(tx: Prisma.TransactionClient, pending: PendingMastersDto | undefined, officeId: string, contractBuyerId?: string, buyerUpdate?: BuyerUpdatePayload): Promise<Map<string, string>>;
export declare function applyPendingIdMap<T extends Record<string, unknown>>(idMap: Map<string, string>, values: T, keys: (keyof T)[]): T;
export declare function applyPendingIdsToContractDto(dto: CreateContractDto, idMap: Map<string, string>): CreateContractDto;
export declare function updateBuyerInTx(tx: Prisma.TransactionClient, buyerId: string, dto: BuyerUpdatePayload, idMap: Map<string, string>): Promise<void>;
export { resolveId };
