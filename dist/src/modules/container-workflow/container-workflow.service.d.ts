import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../common/services/notification.service';
import { InventoryLedgerService } from '../production/inventory-ledger.service';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ContainerSamplingStatus, FulfilmentStatus, WorkflowAction, type FulfilmentLine, type WorkflowState } from './container-workflow.logic';
import type { ContainerWorkflowActionDto, SampleRecordUpdateDto } from './container-workflow.dto';
type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;
export declare const COUNTED_ALLOCATION_STATUSES: string[];
declare const CONTAINER_INCLUDE: {
    product: {
        select: {
            id: true;
            code: true;
            name: true;
        };
    };
    packagingType: {
        select: {
            id: true;
            name: true;
        };
    };
    packagingSize: {
        select: {
            id: true;
            label: true;
        };
    };
    destinationPort: {
        include: {
            country: true;
        };
    };
    products: {
        orderBy: {
            productIndex: "asc";
        };
        include: {
            product: {
                select: {
                    id: true;
                    code: true;
                    name: true;
                };
            };
            packagingType: {
                select: {
                    id: true;
                    name: true;
                };
            };
            packagingSize: {
                select: {
                    id: true;
                    label: true;
                };
            };
        };
    };
    contract: {
        select: {
            id: true;
            contractNumber: true;
            status: true;
            officeId: true;
            euClassification: true;
            destinationCountry: true;
            buyer: {
                select: {
                    id: true;
                    name: true;
                };
            };
            destinationPort: {
                include: {
                    country: true;
                };
            };
        };
    };
};
type LoadedContainer = Prisma.ContractContainerGetPayload<{
    include: typeof CONTAINER_INCLUDE;
}>;
type LoadedAllocation = Prisma.ContainerAllocationGetPayload<{
    include: {
        processedLot: {
            select: {
                id: true;
                lotNumber: true;
                plantId: true;
                reservedKg: true;
                processType: true;
            };
        };
        productionRun: {
            select: {
                id: true;
                productionNumber: true;
                plantId: true;
                processType: true;
            };
        };
    };
}>;
type LoadedSample = Prisma.SampleRecordGetPayload<object>;
export type SyncResult = {
    containerId: string;
    contractId: string;
    contractNumber: string;
    containerIndex: number;
    previousStage: string | null;
    stage: string;
    becameFulfilled: boolean;
    state: WorkflowState;
};
export declare class ContainerWorkflowService {
    private prisma;
    private ledger;
    private notifications;
    private readonly logger;
    constructor(prisma: PrismaService, ledger: InventoryLedgerService, notifications: NotificationService);
    private load;
    samplingFor(c: LoadedContainer): import("../../common/constants/production.constants").SamplingDecision;
    lines(c: LoadedContainer, allocations: LoadedAllocation[]): FulfilmentLine[];
    private stateOf;
    sync(tx: Tx, containerId: string, userId: string | null, remark?: string): Promise<SyncResult | null>;
    syncContract(tx: Tx, contractId: string, userId: string | null, remark?: string): Promise<SyncResult[]>;
    resyncAll(userId: string | null, remark?: string): Promise<{
        containers: number;
        changed: number;
    }>;
    private canSeeAllOffices;
    private scopeWhere;
    private userNames;
    private buildView;
    getContractWorkflow(contractId: string, user: JwtPayload): Promise<{
        history: {
            fromStatus: string | null;
            fromLabel: string | null;
            toStatus: string;
            toLabel: string;
            remarks: string | null;
            changedBy: string;
            createdAt: Date;
        }[];
        containerId: string;
        containerIndex: number;
        stage: string;
        stageLabel: string;
        contract: {
            id: string;
            contractNumber: string;
            status: string;
            buyer: string | null;
            product: string;
            destinationCountry: string | null;
            destinationPort: string | null;
            euClassification: string | null;
            packaging: string | null;
            requiredKg: number;
            expectedShipmentDate: Date | null;
        };
        fulfilment: {
            lines: FulfilmentLine[];
            firstAllocationDate: Date;
            fullFulfilmentDate: Date | null;
            lots: {
                id: string;
                status: string;
                quantityKg: number;
                allocationDate: Date;
                lotNumber: string | null;
                productionNumber: string | null;
                productId: string;
            }[];
            status: FulfilmentStatus;
            requiredKg: number;
            fulfilledKg: number;
            remainingKg: number;
        };
        details: {
            status: "COMPLETED" | "PENDING";
            missing: string[];
            containerNo: string | null;
            factorySealNo: string | null;
            shippingLineName: string | null;
            shippingLineSealNo: string | null;
            remarks: string | null;
            updatedAt: Date | null;
            updatedBy: string | null;
        };
        sampling: {
            required: boolean;
            reason: string;
            status: ContainerSamplingStatus;
            samplingDate: Date | null;
            resultStatus: string | null;
            resultDate: Date | null;
            approvedAt: Date | null;
            records: {
                id: string;
                productId: string;
                status: string;
                result: string | null;
                samplingType: string | null;
                sampleReference: string | null;
                testingAgency: string | null;
                collectionDate: Date | null;
                resultDate: Date | null;
                reportReference: string | null;
                approvedAt: Date | null;
                remarks: string | null;
                updatedBy: string | null;
                createdAt: Date;
            }[];
        };
        dispatch: {
            status: import("./container-workflow.logic").DispatchState;
            readyForDispatchAt: Date | null;
            readyBy: string | null;
            dispatchedAt: Date | null;
            dispatchedBy: string | null;
            dispatchRemarks: string | null;
            actualShipmentDate: Date | null;
        };
        aging: {
            daysSinceFirstAllocation: number | null;
            daysSinceFullFulfilment: number | null;
            daysWaitingForSampling: number | null;
            daysAwaitingResult: number | null;
            daysReadyForDispatch: number | null;
        };
        availableActions: WorkflowAction[];
    }[]>;
    performAction(contractId: string, containerId: string, dto: ContainerWorkflowActionDto, user: JwtPayload): Promise<{
        history: {
            fromStatus: string | null;
            fromLabel: string | null;
            toStatus: string;
            toLabel: string;
            remarks: string | null;
            changedBy: string;
            createdAt: Date;
        }[];
        containerId: string;
        containerIndex: number;
        stage: string;
        stageLabel: string;
        contract: {
            id: string;
            contractNumber: string;
            status: string;
            buyer: string | null;
            product: string;
            destinationCountry: string | null;
            destinationPort: string | null;
            euClassification: string | null;
            packaging: string | null;
            requiredKg: number;
            expectedShipmentDate: Date | null;
        };
        fulfilment: {
            lines: FulfilmentLine[];
            firstAllocationDate: Date;
            fullFulfilmentDate: Date | null;
            lots: {
                id: string;
                status: string;
                quantityKg: number;
                allocationDate: Date;
                lotNumber: string | null;
                productionNumber: string | null;
                productId: string;
            }[];
            status: FulfilmentStatus;
            requiredKg: number;
            fulfilledKg: number;
            remainingKg: number;
        };
        details: {
            status: "COMPLETED" | "PENDING";
            missing: string[];
            containerNo: string | null;
            factorySealNo: string | null;
            shippingLineName: string | null;
            shippingLineSealNo: string | null;
            remarks: string | null;
            updatedAt: Date | null;
            updatedBy: string | null;
        };
        sampling: {
            required: boolean;
            reason: string;
            status: ContainerSamplingStatus;
            samplingDate: Date | null;
            resultStatus: string | null;
            resultDate: Date | null;
            approvedAt: Date | null;
            records: {
                id: string;
                productId: string;
                status: string;
                result: string | null;
                samplingType: string | null;
                sampleReference: string | null;
                testingAgency: string | null;
                collectionDate: Date | null;
                resultDate: Date | null;
                reportReference: string | null;
                approvedAt: Date | null;
                remarks: string | null;
                updatedBy: string | null;
                createdAt: Date;
            }[];
        };
        dispatch: {
            status: import("./container-workflow.logic").DispatchState;
            readyForDispatchAt: Date | null;
            readyBy: string | null;
            dispatchedAt: Date | null;
            dispatchedBy: string | null;
            dispatchRemarks: string | null;
            actualShipmentDate: Date | null;
        };
        aging: {
            daysSinceFirstAllocation: number | null;
            daysSinceFullFulfilment: number | null;
            daysWaitingForSampling: number | null;
            daysAwaitingResult: number | null;
            daysReadyForDispatch: number | null;
        };
        availableActions: WorkflowAction[];
    }>;
    private historyRow;
    private applyDetails;
    private startSampling;
    private updateCurrentSamples;
    private recordSampleResult;
    applySampleFailure(tx: Tx, sample: LoadedSample, userId: string, remarks?: string | null): Promise<void>;
    private dispatch;
    private notifyStage;
    updateSampleRecord(id: string, dto: SampleRecordUpdateDto, user: JwtPayload): Promise<({
        product: {
            id: string;
            code: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            category: string | null;
            defaultSpecification: string | null;
            standardContainerMt: number;
            defaultUnit: string;
            allowsFullProcess: boolean;
            allowsSortex: boolean;
            samplingNormallyApplicable: boolean;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        result: string | null;
        productId: string;
        remarks: string | null;
        status: string;
        productionRunId: string | null;
        processedLotId: string | null;
        contractId: string;
        containerId: string;
        samplingType: string | null;
        sampleReference: string | null;
        testingAgency: string | null;
        resultDate: Date | null;
        allocationId: string | null;
        collectionDate: Date | null;
        reportReference: string | null;
        reportPath: string | null;
        approvedAt: Date | null;
        approvedById: string | null;
        updatedById: string | null;
    }) | null>;
    getDashboard(user: JwtPayload): Promise<{
        containers: {
            notFulfilled: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            partiallyFulfilled: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            fulfilledPendingDispatch: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            readyForDispatch: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            dispatched: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            onHold: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            total: number;
        };
        sampling: {
            applicableContainers: number;
            notRequiredContainers: number;
            pending: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            sent: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            awaitingResult: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            resultReceived: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            approved: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
            rejectedOnHold: {
                count: number;
                containers: {
                    daysSinceFirstAllocation: number | null;
                    daysSinceFullFulfilment: number | null;
                    daysWaitingForSampling: number | null;
                    daysAwaitingResult: number | null;
                    daysReadyForDispatch: number | null;
                    contractId: string;
                    contractNumber: string;
                    containerId: string;
                    containerIndex: number;
                    containerNo: string | null;
                    buyer: string | null;
                    product: string;
                    destination: string | null;
                    stage: string;
                    stageLabel: string;
                    fulfilledKg: number;
                    requiredKg: number;
                    samplingStatus: ContainerSamplingStatus;
                }[];
            };
        };
        aging: {
            daysSinceFirstAllocation: number | null;
            daysSinceFullFulfilment: number | null;
            daysWaitingForSampling: number | null;
            daysAwaitingResult: number | null;
            daysReadyForDispatch: number | null;
            contractId: string;
            contractNumber: string;
            containerId: string;
            containerIndex: number;
            containerNo: string | null;
            buyer: string | null;
            product: string;
            destination: string | null;
            stage: string;
            stageLabel: string;
            fulfilledKg: number;
            requiredKg: number;
            samplingStatus: ContainerSamplingStatus;
        }[];
        generatedAt: Date;
    }>;
    remainingFor(tx: Db, containerId: string): Promise<{
        container: {
            product: {
                id: string;
                code: string;
                name: string;
            };
            packagingType: {
                id: string;
                name: string;
            } | null;
            packagingSize: {
                id: string;
                label: string;
            } | null;
            destinationPort: ({
                country: {
                    id: string;
                    code: string;
                    name: string;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    region: string | null;
                    euClassification: string;
                };
            } & {
                id: string;
                code: string | null;
                name: string;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                euClassification: string | null;
                portType: string;
                countryId: string;
            }) | null;
            contract: {
                id: string;
                officeId: string;
                euClassification: string | null;
                buyer: {
                    id: string;
                    name: string;
                };
                contractNumber: string;
                destinationCountry: string | null;
                status: string;
                destinationPort: ({
                    country: {
                        id: string;
                        code: string;
                        name: string;
                        isActive: boolean;
                        createdAt: Date;
                        updatedAt: Date;
                        region: string | null;
                        euClassification: string;
                    };
                } & {
                    id: string;
                    code: string | null;
                    name: string;
                    isActive: boolean;
                    createdAt: Date;
                    updatedAt: Date;
                    euClassification: string | null;
                    portType: string;
                    countryId: string;
                }) | null;
            };
            products: ({
                product: {
                    id: string;
                    code: string;
                    name: string;
                };
                packagingType: {
                    id: string;
                    name: string;
                } | null;
                packagingSize: {
                    id: string;
                    label: string;
                } | null;
            } & {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                productId: string;
                processingType: string | null;
                packagingTypeId: string | null;
                productVariantId: string | null;
                specification: string | null;
                productRemarks: string | null;
                packagingSizeId: string | null;
                packingDescription: string | null;
                packingSizeValue: number | null;
                packingSizeUnit: string | null;
                quantityMt: number;
                contractId: string;
                containerId: string;
                productIndex: number;
            })[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            productId: string;
            processingType: string | null;
            packagingTypeId: string | null;
            productVariantId: string | null;
            invoiceNumber: string | null;
            invoiceDate: Date | null;
            containerNo: string | null;
            specification: string | null;
            productRemarks: string | null;
            incoterm: string;
            fobPrice: number | null;
            fobCurrency: string | null;
            insurance: number | null;
            cifPrice: number | null;
            exchangeRate: number | null;
            fobInrPerKg: number | null;
            packagingSizeId: string | null;
            packingDescription: string | null;
            packingSizeValue: number | null;
            packingSizeUnit: string | null;
            destinationPortId: string | null;
            expectedShipmentDate: Date | null;
            shipmentMonth: string | null;
            shipmentYear: number | null;
            shipmentHalf: string | null;
            commercialRemarks: string | null;
            quantityMt: number | null;
            dispatchStatus: string;
            contractId: string;
            containerIndex: number;
            factorySealNo: string | null;
            shippingLineSealNo: string | null;
            exchangeRateAt: Date | null;
            exchangeRateSource: string | null;
            exchangeRateManual: boolean;
            totalFreight: number | null;
            invoiceAmount: number | null;
            paymentReceived: boolean;
            paymentStatus: string;
            receivedAmount: number | null;
            paymentRemarks: string | null;
            containerStatus: string;
            shippingLineName: string | null;
            freightPerMt: number | null;
            cnfPrice: number | null;
            originalCifCnfPrice: number | null;
            currentCifCnfPrice: number | null;
            remainingAmount: number | null;
            actualShipmentDate: Date | null;
            productionUnitId: string | null;
            productionRemarks: string | null;
            containerDetailsRemarks: string | null;
            detailsUpdatedAt: Date | null;
            detailsUpdatedById: string | null;
            detailsCompletedAt: Date | null;
            firstAllocatedAt: Date | null;
            fulfilledAt: Date | null;
            samplingStartedAt: Date | null;
            readyForDispatchAt: Date | null;
            readyForDispatchById: string | null;
            dispatchedAt: Date | null;
            dispatchedById: string | null;
            dispatchRemarks: string | null;
        };
        lines: {
            remainingKg: number;
            id: string | null;
            productId: string;
            productName?: string;
            requiredKg: number;
            fulfilledKg: number;
        }[];
        dispatched: boolean;
    }>;
}
export {};
