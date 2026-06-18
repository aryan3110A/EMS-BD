import { UpdateBuyerDto } from '../masters/masters.dto';
import { CreateContractDto } from './contracts.dto';
import { PendingMastersDto } from './pending-masters.dto';
export declare class SubmitContractDto {
    contract: CreateContractDto;
    pendingMasters?: PendingMastersDto;
    buyerUpdate?: UpdateBuyerDto;
}
