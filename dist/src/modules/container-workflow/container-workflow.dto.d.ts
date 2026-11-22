export declare class ContainerWorkflowActionDto {
    action: string;
    containerNo?: string;
    factorySealNo?: string;
    shippingLineName?: string;
    shippingLineSealNo?: string;
    samplingDate?: string;
    samplingType?: string;
    sampleReference?: string;
    testingAgency?: string;
    result?: string;
    resultDate?: string;
    resultReference?: string;
    dispatchDate?: string;
    shipmentDate?: string;
    remarks?: string;
    reason?: string;
}
export declare class SampleRecordUpdateDto {
    step: 'SENT' | 'AWAITING_RESULT' | 'RESULT' | 'APPROVE';
    samplingDate?: string;
    samplingType?: string;
    sampleReference?: string;
    testingAgency?: string;
    result?: string;
    resultDate?: string;
    resultReference?: string;
    remarks?: string;
}
