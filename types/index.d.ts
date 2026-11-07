/**
 * TypeScript definitions for @mudraforge/statutory
 */

export interface StatutoryThresholds {
    buyerPriorYearTurnoverCr?: number;
    sellerPriorYearTurnoverCr?: number;
    annualPurchaseThresholdInr?: number;
    annualReceiptThresholdInr?: number;
    standardDeductionRatePercent?: number;
    inoperativePanPenaltyRatePercent?: number;
    standardTcsRatePercent?: number;
    statutoryDefaultTimelineDays?: number;
    maximumWrittenAgreementTimelineDays?: number;
    penalInterestRate?: string;
    applicableEnterprises?: string;
    traderExclusionRule?: string;
    taxableBaseScope?: string;
    [key: string]: any;
}

export interface OfficialCitation {
    authority: string;
    instrument: string;
    subject: string;
    officialUrl: string;
}

export interface StatutoryRecord {
    sectionId: string;
    sectionCode: string;
    aliases: string[];
    governingStatute: string;
    statutorySection: string;
    successorStatute: string;
    successorSection: string;
    title: string;
    effectivePeriod: {
        validFrom: string;
        validTo: string;
        annualReset?: string;
        sunsetNotes: string;
    };
    plainTextSummary: string;
    keyStatutoryThresholds: StatutoryThresholds;
    officialCitations: OfficialCitation[];
    requiredDocumentChecklist: string[];
    tier: 'PUBLIC_COMMONS_FREE' | 'ENTERPRISE_PAID';
    version: string;
}

export interface LookupResult {
    status: 'SUCCESS' | 'ERROR';
    temporalStatus: 'ACTIVE' | 'SUNSET_SUPERSEDED' | 'FUTURE_PENDING';
    asOfDate: string;
    source?: 'LOCAL_OKF_FS' | 'EDGE_API';
    retrievalMode?: 'LOCAL_SNAPSHOT' | 'EDGE_LIVE' | 'LOCAL_SNAPSHOT_FALLBACK';
    isOfflineSnapshot?: boolean;
    snapshotVersion?: string;
    advisory?: string;
    clientTier?: 'PUBLIC_COMMONS_FREE' | 'ENTERPRISE_PAID';
    authenticated?: boolean;
    statute: StatutoryRecord;
}

export interface SectionSummary {
    sectionId: string;
    sectionCode: string;
    statute: string;
    section: string;
    successorSection: string;
    title: string;
    validFrom: string;
    validTo: string;
    tier: string;
    version: string;
}

export interface LookupOptions {
    asOfDate?: string;
    baseUrl?: string;
    okfDir?: string;
    apiKey?: string;
    tier?: 'PUBLIC_COMMONS_FREE' | 'ENTERPRISE_PAID';
    mode?: 'auto' | 'local' | 'edge';
    forceEdge?: boolean;
}

export interface ClientOptions {
    apiKey?: string;
    tier?: 'PUBLIC_COMMONS_FREE' | 'ENTERPRISE_PAID';
    baseUrl?: string;
    okfDir?: string;
    offlineFirst?: boolean;
}

export interface CalculationPayload {
    section: string;
    invoiceAmount?: number;
    priorFyPurchases?: number;
    hasPan?: boolean;
    isPanInoperative?: boolean;
    buyerTurnoverCr?: number;
    sellerTurnoverCr?: number;
    paymentDelayDays?: number;
    isTrader?: boolean;
    transactionDate?: string;
    mode?: 'standard' | 'analysis';
    [key: string]: any;
}

export interface CalculationResult {
    status: 'SUCCESS' | 'ERROR';
    section: string;
    taxableBase: number;
    appliedRatePercent: number;
    taxAmount: number;
    netPayable: number;
    statutoryRationale: string;
    citations: OfficialCitation[];
    analysisReport?: {
        disallowanceRisk: string;
        suggestedJournalVoucher: any;
        requiredAuditDocuments: string[];
    };
}

export interface UpdateInfo {
    localVersion: string;
    latestVersion: string;
    isOutdated: boolean;
    publishedAt: string;
    changelog: string;
    totalSections: number;
}

export interface SyncResult {
    success: boolean;
    okfVersion: string;
    syncedSections: number;
    destDir: string;
}

export declare const DEFAULT_BASE_URL: string;
export declare const STATUTORY_CLIENT_VERSION: string;
export declare const DEFAULT_LOCAL_OKF_DIR: string;

export declare function getLocalManifest(okfDir?: string): any;
export declare function lookupLocalStatute(section: string, okfDir?: string): StatutoryRecord | null;
export declare function computeTemporalStatus(statute: StatutoryRecord, asOfDate?: string): 'ACTIVE' | 'SUNSET_SUPERSEDED' | 'FUTURE_PENDING';
export declare function checkUpdates(options?: { baseUrl?: string; okfDir?: string }): Promise<UpdateInfo>;
export declare function checkForPackageUpdate(options?: {
    currentVersion?: string;
    cacheTtlMs?: number;
    timeoutMs?: number;
    registryUrl?: string;
}): Promise<{ updateAvailable: boolean; currentVersion: string; latestVersion: string } | null>;
export declare function syncOkf(options?: { baseUrl?: string; okfDir?: string }): Promise<SyncResult>;

export declare function lookupStatute(
    section: string,
    options?: LookupOptions
): Promise<LookupResult>;

export declare function calculate(
    payload: CalculationPayload,
    options?: ClientOptions
): Promise<CalculationResult>;

export declare function listSections(
    options?: { baseUrl?: string }
): Promise<SectionSummary[]>;

export declare function isStatuteActive(
    section: string,
    asOfDate?: string
): Promise<boolean>;

export declare class StatutoryClient {
    apiKey: string | null;
    tier: 'PUBLIC_COMMONS_FREE' | 'ENTERPRISE_PAID';
    baseUrl: string;
    okfDir: string;
    offlineFirst: boolean;

    constructor(options?: ClientOptions);
    lookup(section: string, options?: LookupOptions): Promise<LookupResult>;
    calculate(payload: CalculationPayload): Promise<CalculationResult>;
    isStatuteActive(section: string, asOfDate?: string): Promise<boolean>;
    listSections(): Promise<SectionSummary[]>;
    checkUpdates(): Promise<UpdateInfo>;
    sync(): Promise<SyncResult>;
    crosswalk(section: string, options?: CrosswalkOptions): CrosswalkResult;
    diff(options?: StatutoryDiffOptions): StatutoryDiffResult;
    verify(targetDir?: string): any;
    doctor(options?: any): Promise<any>;
    calculateCorporateTaxMatVsConcessional(payload?: any): any;
    evaluatePlaceOfSupplyAndLut(payload?: any): any;
    calculateTransferPricingAlp(payload?: any): any;
    evaluateSection79LossContinuity(payload?: any): any;
    revalueForeignExchangeIndAs109(payload?: any): any;
    calculateBusinessCombinationsIndAs103(payload?: any): any;
    calculateImpairmentIndAs36(payload?: any): any;
    calculateRevenueAllocationIndAs115(payload?: any): any;
    calculateLeaseAmortizationIndAs116(payload?: any): any;
    calculateExpectedCreditLossIndAs109(payload?: any): any;
    calculateEsopAmortizationIndAs102(payload?: any): any;
    calculateDeferredTaxIndAs12(payload?: any): any;
    evaluateProvisionsAndContingenciesIndAs37(payload?: any): any;
    calculateForeignCurrencyIndAs21(payload?: any): any;
    evaluateSection194A(payload?: any): any;
    evaluateSection194O(payload?: any): any;
    evaluateSection194IA(payload?: any): any;
    evaluateSection194IB(payload?: any): any;
    evaluateSection194M(payload?: any): any;
    evaluateSection194R(payload?: any): any;
    evaluateSection43B(payload?: any): any;
    evaluateSection281(payload?: any): any;
    calculateItcReversalRule37(payload?: any): any;
    calculateRule37ASupplierNonFilingReversal(payload?: any): any;
    calculateRule42InputServiceReversal(payload?: any): any;
    reconcileRule42AnnualTrueUp(payload?: any): any;
    calculateRule43CapitalGoodsReversal(payload?: any): any;
    calculateGstItcApportionmentRule42_43(payload?: any): any;
    parseTallyDaybookCsv(csvText: string): DaybookVoucherInput[];
    parseTallyDaybookXml(xmlText: string): DaybookVoucherInput[];
    reconcileDaybook(vouchers: DaybookVoucherInput[], options?: ReconcileDaybookOptions): ReconcileDaybookResult;
    reconcile194QDaybook(vouchers: DaybookVoucherInput[], options?: ReconcileDaybookOptions): ReconcileDaybookResult;
    generateTallyJournalXml(reconciliationResult: ReconcileDaybookResult, options?: any): string;
    generateTally194QJournalXml(reconciliationResult: ReconcileDaybookResult, options?: any): string;
    generateAuditReport(reconciliationResult: ReconcileDaybookResult): string;
    generateAuditMarkdownReport(reconciliationResult: ReconcileDaybookResult): string;
    parseZohoBillsCsv(csvText: string): ZohoBillRecord[];
    parseZohoBillsJson(jsonData: any): ZohoBillRecord[];
    parseGstr2bJson(gstr2bData: any): Gstr2bRecord[];
    reconcileZohoGstr2b(params: ReconcileZohoGstr2bParams): ReconcileZohoGstr2bResult;
    generateGstr2bAuditMarkdownReport(reconResult: ReconcileZohoGstr2bResult): string;
    generateGstr2bAuditReport(reconResult: ReconcileZohoGstr2bResult): string;
    calculateOverdueStartDate(billDateIso: string): string | null;
    calculateEclUtilizationInterest(params: {
        unreversedItcInr: number | string;
        overdueStartDate: string;
        asOfDate: string;
        reversalDate?: string | null;
        eclLedgerHistory?: Array<{ date: string; balanceInr: number }>;
        annualInterestRate?: number;
    }): EclUtilizationAuditResult;
    calculatePortfolioEclUtilizationInterest(params: {
        overdueBills: Array<any>;
        eclLedgerHistory: Array<{ date: string; balanceInr: number }>;
        asOfDate?: string;
        annualInterestRate?: number;
    }): any;
    buildEvidenceProvenance(params: any): EvidenceProvenance;
    runWatchtower(options?: { okfDir?: string; verbose?: boolean }): Promise<WatchtowerReport>;
    normalizeInvoiceNumber(raw: string): { exactKey: string; alphaNumericKey: string };
    normalizeGstin(raw: string): { gstin: string | null; pan: string | null; stateCode: string | null; isValid: boolean };
    cleanNumericAmount(val: any, options?: CleanNumericAmountOptions): number;
    roundToPaisa(amount: number | string): number;
    toIntegerPaise(amount: number | string, options?: string | ToIntegerPaiseOptions): number;
    fromIntegerPaise(paise: number): number;
    getOutcomes(provision?: string, options?: StatutoryOutcomesOptions): Promise<StatutoryOutcomesResult>;
    explain(codeOrQuery: string, options?: any): any;
}

export interface CrosswalkOptions {
    creditDate?: string;
    paymentDate?: string;
    asOfDate?: string;
    date?: string;
    okfDir?: string;
}

export interface CrosswalkProvision {
    act: string;
    sectionCode: string;
    statutorySection: string;
    title: string;
    threshold?: string;
    standardRate?: string;
    penaltyRate?: string;
    challan?: string;
    returnForm?: string;
    effectiveDate?: string;
}

export interface CrosswalkResult {
    status: 'SUCCESS' | 'ERROR';
    isValid: boolean;
    querySection: string;
    triggerDate: string;
    triggerReason: string;
    triggerDescription: string;
    creditDate: string | null;
    paymentDate: string | null;
    transitionCutoffDate: string;
    governingAct: string;
    applicableSection: string;
    temporalStatus: 'GOVERNED_BY_1961_ACT' | 'GOVERNED_BY_2025_ACT' | 'SUNSET_OMITTED';
    savingsApplied: boolean;
    isOmittedSunset: boolean;
    crosswalk: {
        id: string;
        domain: string;
        predecessor: CrosswalkProvision;
        successor: CrosswalkProvision;
        savingsAuthority: {
            statute: string;
            subsidiary: string;
            legalPrinciple: string;
        };
    };
    legalAnalysis: string;
}

export interface StatutoryDiffOptions {
    section?: string;
    since?: string;
    domain?: string;
    okfDir?: string;
}

export interface StatutoryAmendment {
    id: string;
    sectionCode: string;
    domain: string;
    title: string;
    effectiveDate: string;
    amendmentType: string;
    statute: string;
    legalAuthority: string;
    previousValue: string;
    amendedValue: string;
    changeSummary: string;
    statutoryImpact: string;
    aliases?: string[];
}

export interface StatutoryDiffResult {
    status: 'SUCCESS' | 'ERROR';
    filterSection: string | null;
    filterSince: string | null;
    filterDomain: string | null;
    totalAmendments: number;
    amendments: StatutoryAmendment[];
}

export declare function crosswalkStatute(
    sectionCode: string,
    options?: CrosswalkOptions
): CrosswalkResult;

export declare function getStatutoryDiff(
    options?: StatutoryDiffOptions
): StatutoryDiffResult;

export declare function verifyLocalSubstrate(
    okfDir?: string,
    options?: any
): any;

export declare function runStatutoryDoctor(
    options?: any
): Promise<any>;

export interface TaxIdentifierResult {
    isValid: boolean;
    checksumValid?: boolean;
    type?: 'GSTIN' | 'PAN';
    gstin?: string;
    pan?: string;
    stateCode?: string;
    stateName?: string;
    entityCode?: string;
    entityType?: string;
    isIndividualOrHuf?: boolean;
    standard194cRatePercent?: number;
    error?: string | null;
}

export declare const INDIAN_STATE_CODES: Record<string, string>;
export declare const PAN_ENTITY_TYPES: Record<string, { code: string; name: string; isIndividualOrHuf: boolean; standard194cRatePercent: number }>;
export declare function isValidGstinChecksum(gstin: string): boolean;
export declare function decodeTaxIdentifier(rawId: string): TaxIdentifierResult;

export declare const CURRENT_RELEASE_MERKLE_ROOT: string;
export declare const MERKLE_ROOT_OKF_V2: string;

export interface CleanNumericAmountOptions {
    strict?: boolean;
    fieldName?: string;
    interpretCreditAsNegative?: boolean;
}

export declare class MalformedNumericInputError extends Error {
    code: 'MALFORMED_NUMERIC_INPUT';
    field: string;
    rawValue: any;
    constructor(val: any, fieldName?: string);
}

export declare class MissingMandatoryParameterError extends Error {
    code: 'MISSING_MANDATORY_PARAMETER';
    field: string;
    functionName: string;
    constructor(fieldName: string, functionName: string);
}

export interface ToIntegerPaiseOptions {
    fieldName?: string;
    strict?: boolean;
    strictSubPaisa?: boolean;
}

export declare function assertMandatoryNumeric(val: any, fieldName: string, functionName: string, options?: CleanNumericAmountOptions): number;
export declare function toIntegerPaise(amount: number | string, options?: string | ToIntegerPaiseOptions): number;
export declare function fromIntegerPaise(paise: number): number;
export declare function roundToPaisa(amount: number | string): number;
export declare function roundSection288B(amount: number | string): number;
export declare function cleanNumericAmount(val: any, options?: CleanNumericAmountOptions): number;
export declare function calculateCorporateTaxMatVsConcessional(payload?: any): any;
export declare function evaluatePlaceOfSupplyAndLut(payload?: any): any;
export declare function calculateTransferPricingAlp(payload?: any): any;
export declare function evaluateSection79LossContinuity(payload?: any): any;
export declare function evaluateSection281TaxClearance(payload: any): any;
export declare function revalueForeignExchangeIndAs109(payload?: any): any;
export declare function calculateBusinessCombinationsIndAs103(payload?: any): any;
export declare function calculateImpairmentIndAs36(payload?: any): any;
export declare function calculateRevenueAllocationIndAs115(payload?: any): any;
export declare function calculateLeaseAmortizationIndAs116(payload?: any): any;
export declare function calculateExpectedCreditLossIndAs109(payload?: any): any;
export declare function calculateEsopAmortizationIndAs102(payload?: any): any;
export declare function calculateDeferredTaxIndAs12(payload?: any): any;
export declare function evaluateProvisionsAndContingenciesIndAs37(payload?: any): any;
export declare function calculateForeignCurrencyIndAs21(payload?: any): any;
export declare function resolveMissingPanPenaltyFloor(params?: any): any;
export declare function evaluateSection194Q(payload: any): any;
export declare function evaluateSection194C(payload: any): any;
export declare function evaluateSection194H(payload: any): any;
export declare function evaluateSection194I(payload: any): any;
export declare function evaluateSection194J(payload: any): any;
export declare function evaluateSection194A(payload: any): any;
export declare function evaluateSection194O(payload: any): any;
export declare function evaluateSection194IA(payload: any): any;
export declare function evaluateSection194IB(payload: any): any;
export declare function evaluateSection194M(payload: any): any;
export declare function evaluateSection194R(payload: any): any;
export declare function evaluateSection43BStatutoryPayables(payload: any): any;
export declare function calculateItcReversalRule37(payload: any): any;
export declare function calculateRule37ASupplierNonFilingReversal(payload: any): any;
export declare function evaluateSection206C1H(payload: any): any;
export declare function evaluateSection43bH(payload: any): any;
export declare function calculateMsmeCompoundInterest(payload: any): any;
export declare function calculateAdvanceTaxAndInterest(payload: any): any;
export declare function calculateRule42InputServiceReversal(payload: any): any;
export declare function reconcileRule42AnnualTrueUp(payload: any): any;
export declare function calculateRule43CapitalGoodsReversal(payload: any): any;
export declare function calculateGstItcApportionmentRule42_43(payload: any): any;
export declare function evaluateCrossBorderRemittance(payload: any): any;
export declare function getRbiBankRateForDate(dateString?: string): number;
export declare const DEFAULT_RBI_BANK_RATE: number;
export declare const MSMED_RATE_MULTIPLIER: number;
export declare const RBI_BANK_RATE_SCHEDULE: Array<{ effectiveFrom: string; effectiveTo: string | null; rate: number; notificationRef: string }>;
export declare const AUTHORITATIVE_STATUTORY_RATES: Record<string, any>;
export declare const VALID_194J_CATEGORIES: string[];

export interface StatutoryOutcome {
    code: string;
    category: string;
    title: string;
    description: string;
    triggerCondition: string;
    recommendedAction: string;
    remedy?: string;
    consequenceIfUnresolved?: string;
    missingFacts?: string[];
    missingFactsExplanation?: Record<string, { type: string; description: string; example: any; source: string }>;
    applicableProvisions?: string[];
    governingAuthority: string;
}

export interface StatutoryOutcomesOptions {
    offline?: boolean;
    verbose?: boolean;
    baseUrl?: string;
    timeoutMs?: number;
}

export interface StatutoryOutcomesResult {
    status: 'SUCCESS' | 'ERROR';
    source: 'LIVE_EDGE' | 'LOCAL_OKF_SUBSTRATE';
    provision: string | null;
    totalOutcomes: number;
    outcomes: StatutoryOutcome[];
    version: string;
    offlineFallback?: boolean;
}

export declare const STATUTORY_OUTCOMES_DICTIONARY: StatutoryOutcome[];
export declare function getStatutoryOutcomes(
    provision?: string,
    options?: StatutoryOutcomesOptions
): Promise<StatutoryOutcomesResult>;

export declare function explainStatutoryDisposition(
    codeOrQuery: string,
    options?: any
): any;

export declare function enrichWithOutcomeExplanation<T extends Record<string, any>>(
    result: T,
    options?: { verbose?: boolean; explain?: boolean }
): T;

export declare function ignorePackageUpdate(
    versionToIgnore: string
): { status: 'SUCCESS' | 'ERROR'; ignoredVersion: string; error?: string };

export interface DaybookVoucherInput {
    date: string;
    voucherNo?: string;
    voucherType?: string;
    partyName: string;
    partyPan?: string | null;
    partyGstin?: string | null;
    grossAmount: number;
    gstAmount?: number;
    tdsDeducted?: number;
}

export interface ReconcileDaybookOptions {
    buyerTurnoverCr?: number | null;
    disallowancePercent?: number;
    corporateTaxRatePercent?: number;
    delayedInterestRateMonthlyPercent?: number;
    auditDate?: string | null;
}

export interface DaybookAuditSummary {
    totalVouchersScanned: number;
    uniqueVendorsCount: number;
    vendorsExceeding50LCount: number;
    vendorsWithExceptionsCount: number;
    totalPurchasesInr: number;
    totalExcessPurchasesOver50LInr: number;
    totalTdsPayableInr: number;
    totalTdsDeductedInr: number;
    totalTdsShortfallInr: number;
    totalSection40aDisallowanceInr: number;
    totalEstimatedTaxImpactInr: number;
    totalSection201InterestInr: number;
    totalAuditExposureInr: number;
    statutoryAuthority: string;
    isAuthorizedToDisburse: boolean;
}

export interface ReconcileDaybookResult {
    auditSummary: DaybookAuditSummary;
    exceptionVendors: any[];
    compliantVendors: any[];
    allVendors: any[];
    auditedVouchers: any[];
}

export declare function parseTallyDaybookCsv(csvText: string): DaybookVoucherInput[];
export declare function parseTallyDaybookXml(xmlText: string): DaybookVoucherInput[];
export declare function reconcile194QDaybook(
    vouchers: DaybookVoucherInput[],
    options?: ReconcileDaybookOptions
): ReconcileDaybookResult;
export declare function generateTally194QJournalXml(
    reconciliationResult: ReconcileDaybookResult,
    options?: { voucherDate?: string; creditLedgerName?: string; companyName?: string }
): string;
export declare function generateAuditMarkdownReport(
    reconciliationResult: ReconcileDaybookResult
): string;
export declare function getIndianFinancialYear(dateStr: string): string;

export interface ZohoBillRecord {
    source: string;
    rowNumber: number;
    billId?: string | null;
    billNumber: string;
    exactKey: string;
    alphaNumericKey: string;
    billDate: string | null;
    dueDate: string | null;
    vendorName: string;
    vendorGstin: string | null;
    vendorPan: string | null;
    isGstinValid: boolean;
    status: string;
    category: string;
    isBlocked17_5: boolean;
    taxableAmountInr: number;
    cgstInr: number;
    sgstInr: number;
    igstInr: number;
    totalTaxInr: number;
    totalAmountInr: number;
    balanceInr: number;
    isFullyPaid: boolean;
}

export interface Gstr2bRecord {
    source: string;
    docType: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
    invoiceNumber: string;
    originalInvoiceNumber?: string;
    exactKey: string;
    alphaNumericKey: string;
    invoiceDate: string | null;
    supplierGstin: string | null;
    supplierPan: string | null;
    supplierName: string;
    recipientGstin: string;
    posStateCode: string;
    isRcm: boolean;
    itcAvailable: boolean;
    itcRevReason?: string | null;
    taxableAmountInr: number;
    igstInr: number;
    cgstInr: number;
    sgstInr: number;
    cessInr: number;
    totalTaxInr: number;
    totalAmountInr: number;
}

export interface ReconcileZohoGstr2bOptions {
    toleranceInr?: number;
    asOfDate?: string;
    recipientGstin?: string | null;
    recipientTaxScheme?: 'REGULAR' | 'COMPOSITION' | 'UNKNOWN' | 'INDETERMINATE';
    recipientRegisteredStates?: string[];
    recipientRegisteredGstins?: string[];
    paymentAppropriationMethod?: 'PROPORTIONATE' | 'VALUE_FIRST' | 'TAX_FIRST';
    minimumEclBalanceInr?: number;
    eclLedgerHistory?: Array<{ date: string; balanceInr: number }>;
    eclUtilizationStatus?: 'UTILIZED' | 'UNUTILIZED' | 'UNKNOWN';
    goodsInTransitWindowDays?: number;
}

export interface ReconcileZohoGstr2bParams {
    zohoBills: ZohoBillRecord[] | string;
    gstr2b: Gstr2bRecord[] | string | any;
    options?: ReconcileZohoGstr2bOptions;
}

export type Gstr2bDisposition =
    | 'MATCHED_ELIGIBLE'
    | 'RCM_UNREGISTERED_SUPPLIER_ELIGIBLE'
    | 'COMPOSITION_EXCLUDED_RCM_SUPPLY'
    | 'RCM_COMPOSITION_INTERVENING_REGULARIZED_PAID'
    | 'RCM_COMPOSITION_INTERVENING_REGULARIZED_UNPAID'
    | 'MISMATCH_AMOUNT_VALUE'
    | 'MATCHED_INELIGIBLE_STATUTORY_BLOCK_17_5'
    | 'MATCHED_ROUTABLE_TO_BRANCH_GSTIN'
    | 'MATCHED_INELIGIBLE_STRANDED_LOCAL_CGST_SGST'
    | 'MATCHED_INELIGIBLE_PLACE_OF_SUPPLY_MISMATCH'
    | 'GSTR2B_INELIGIBLE_FLAGGED_BY_GSTN'
    | 'REQUIRES_HUMAN_VERIFICATION'
    | 'MISSING_IN_GSTR2B'
    | 'MISSING_IN_GSTR2B_TIMING'
    | 'MISSING_IN_BOOKS'
    | 'MISSING_IN_BOOKS_GOODS_IN_TRANSIT';

export interface JurisdictionDecisions {
    taxClassification: 'INTRASTATE_CORRECT' | 'INTERSTATE_CORRECT' | 'ERRONEOUS_INTRASTATE_LEVY' | 'ERRONEOUS_INTERSTATE_LEVY' | 'INDETERMINATE';
    recipientJurisdiction: 'FILING_GSTIN_MATCHES_POS' | 'REGISTERED_DISTINCT_PERSON_BRANCH' | 'UNREGISTERED_IN_POS_STATE' | 'INDETERMINATE';
    itcEligibility: 'ELIGIBLE_NORMAL' | 'ELIGIBLE_IN_BRANCH_RETURN' | 'INELIGIBLE_STRANDED_LOCAL_LEVY' | 'INELIGIBLE_BLOCKED_SEC_17_5' | 'INELIGIBLE_DEFECTIVE_INVOICE' | 'INELIGIBLE_PORTAL_FLAGGED' | 'PROVISIONAL_PENDING_FILING' | 'INDETERMINATE';
    operationalRouting: 'CLAIM_IN_CURRENT_GSTR3B_TABLE_4A5' | 'ROUTE_TO_BRANCH_GSTIN' | 'BOOK_AS_EXPENSE_NO_ITC' | 'REPORT_IN_GSTR3B_TABLE_4B1_PERMANENT_REVERSAL' | 'REQUEST_VENDOR_CREDIT_NOTE_AMENDMENT' | 'WITHHOLD_CLAIM_PENDING_SUPPLIER_GSTR1' | 'PHYSICAL_GOODS_RECEIPT_VERIFICATION_PENDING' | 'MANUAL_HUMAN_INVESTIGATION_REQUIRED';
}

export interface EvidenceProvenance {
    provenanceId: string;
    provenanceTimestamp: string;
    source: {
        sourceSystem: string;
        docType: string;
        billId: string | null;
        billNumber: string | null;
        rowNumber: number | null;
    };
    externalEvidence: {
        sourceSystem: string;
        presentInGstr2b: boolean;
        invoiceNumber: string | null;
        filingPeriod: string | null;
        supplierFilingStatus: string;
        portalRevReason: string | null;
    };
    matchingMethod: string;
    statutoryBasis: {
        governingStatute: string;
        primarySection: string;
        officialCitations: string[];
    };
    inputSnapshot: {
        billNumber: string | null;
        billDate: string | null;
        vendorGstin: string | null;
        taxableAmountInr: number;
        totalTaxInr: number;
        totalAmountInr: number;
        balanceInr: number;
        posStateCode: string | null;
        isRcm: boolean;
        category: string | null;
    };
    jurisdictionDecisions: {
        taxClassification: string;
        recipientJurisdiction: string;
        itcEligibility: string;
        operationalRouting: string;
    };
    uncertaintyAssessment: {
        isCertain: boolean;
        uncertaintyReason: string;
        actionableRemedy: string;
    };
    governanceTrail: {
        requiresHumanReview: boolean;
        auditVerificationDate: string;
        engineIdentity: string;
        merkleSubstrateRoot: string;
        isAuthorizedToDisburse: boolean;
    };
}

export interface EclUtilizationInterval {
    intervalIndex: number;
    startDate: string;
    endDate: string;
    daysInInterval: number;
    eclBalanceInr: number;
    utilizedInr: number;
    annualInterestRatePercent: number;
    intervalInterestInr: number;
}

export interface EclUtilizationAuditResult {
    totalInterestInr: number;
    totalInterestPaise: number;
    totalOverdueDays: number;
    utilizedDaysCount: number;
    zeroUtilizationDaysCount: number;
    maxWrongfulUtilizationInr: number;
    chronologicalIntervals: EclUtilizationInterval[];
    explanation: string;
    isAuthorizedToDisburse: boolean;
}

export interface ReconcileItem {
    disposition: Gstr2bDisposition;
    uncertaintyReason?: string;
    itcStatus: string;
    statutorySection: string;
    vendorName: string;
    vendorGstin: string | null;
    billNumber: string;
    billDate: string | null;
    booksTaxableInr: number;
    booksTaxInr: number;
    gstr2bTaxableInr: number;
    gstr2bTaxInr: number;
    varianceTaxableInr: number;
    varianceTaxInr: number;
    isRule37Overdue: boolean;
    daysElapsedSinceBill: number;
    rule37Status: string;
    rule37ReversalTaxInr: number;
    rule37InterestInr: number;
    rule37InterestExplanation?: string;
    isReclaimableUponPayment: boolean;
    isRcm?: boolean;
    paymentAppropriationDetails?: Record<string, any> | null;
    jurisdictionDecisions?: JurisdictionDecisions;
    statutoryAction: string;
    auditEvidence: Record<string, any>;
    evidenceProvenance?: EvidenceProvenance;
}

export interface ReconcileZohoGstr2bSummary {
    totalBooksBillsCount: number;
    totalGstr2bRecordsCount: number;
    matchedEligibleCount: number;
    rcmUnregisteredEligibleCount: number;
    compositionExcludedCount: number;
    interveningRegularizedPaidCount: number;
    interveningRegularizedUnpaidCount: number;
    amountMismatchCount: number;
    blocked17_5Count: number;
    posMismatchCount: number;
    routableToBranchCount: number;
    strandedLocalCount: number;
    gstr2bPortalIneligibleCount: number;
    requiresHumanVerificationCount: number;
    missingIn2bCount: number;
    missingInBooksCount: number;
    rule37OverdueCount: number;
    totalBooksTaxableInr: number;
    totalBooksTaxInr: number;
    totalGstr2bTaxableInr: number;
    totalGstr2bTaxInr: number;
    eligibleItcInr: number;
    rcmUnregisteredEligibleItcInr: number;
    compositionExcludedItcInr: number;
    interveningRegularizedTaxInr: number;
    atRiskUnfiledItcInr: number;
    blocked17_5ItcInr: number;
    posMismatchItcInr: number;
    routableToBranchItcInr: number;
    strandedLocalItcInr: number;
    gstr2bPortalIneligibleItcInr: number;
    requiresHumanVerificationItcInr: number;
    mismatchedItcInr: number;
    missingInBooksTaxInr: number;
    rule37ReversalAmountInr: number;
    rule37InterestExposureInr: number;
    paymentAppropriationMethod: 'PROPORTIONATE' | 'VALUE_FIRST' | 'TAX_FIRST';
    paymentAppropriationLegalStatus: 'STATUTORY_MANDATE' | 'ACCOUNTING_ALLOCATION_ASSUMPTION';
    recipientTaxScheme: 'REGULAR' | 'COMPOSITION' | 'INDETERMINATE';
    minimumEclBalanceInr: number | null;
    eclUtilizationStatus: 'UTILIZED' | 'UNUTILIZED' | 'UNKNOWN';
    eclLedgerHistoryAudit: boolean;
    cumulativePortfolioEclAudit?: any;
    reconciliationStatus: 'FULLY_RECONCILED' | 'EXCEPTIONS_IDENTIFIED';
    isAuthorizedToDisburse: boolean;
}

export interface ReconcileZohoGstr2bResult {
    status: 'SUCCESS' | 'ERROR';
    auditDate: string;
    summary: ReconcileZohoGstr2bSummary;
    reconciliationItems: ReconcileItem[];
}

export declare function parseZohoBillsCsv(csvText: string): ZohoBillRecord[];
export declare function parseZohoBillsJson(jsonData: any): ZohoBillRecord[];
export declare function parseGstr2bJson(gstr2bData: any): Gstr2bRecord[];
export declare function reconcileZohoGstr2b(params: ReconcileZohoGstr2bParams): ReconcileZohoGstr2bResult;
export declare function generateGstr2bAuditMarkdownReport(reconResult: ReconcileZohoGstr2bResult): string;
export declare function normalizeInvoiceNumber(raw: string): { exactKey: string; alphaNumericKey: string };
export declare function normalizeGstin(raw: string): { gstin: string | null; pan: string | null; stateCode: string | null; isValid: boolean };
export declare function calculateOverdueStartDate(billDateIso: string): string | null;
export declare function calculateEclUtilizationInterest(params: {
    unreversedItcInr: number | string;
    overdueStartDate: string;
    asOfDate: string;
    reversalDate?: string | null;
    eclLedgerHistory?: Array<{ date: string; balanceInr: number }>;
    annualInterestRate?: number;
}): EclUtilizationAuditResult;
export declare function calculatePortfolioEclUtilizationInterest(params: {
    overdueBills: Array<any>;
    eclLedgerHistory: Array<{ date: string; balanceInr: number }>;
    asOfDate?: string;
    annualInterestRate?: number;
}): any;
export declare function buildEvidenceProvenance(params: any): EvidenceProvenance;

export interface EmpanelmentCertificate {
    certificateId: string;
    attestationType: string;
    attestationNotice: string;
    attestationTimestamp: string;
    merkleSubstrateRoot: string;
    governingSpecification: string;
    sectionsCount: number;
    circularsCount: number;
    formsCount: number;
    citationsVerified: number;
    freshnessStatus: 'FRESH_AND_AUDIT_READY' | 'ACTION_REQUIRED';
    regulatoryHorizon: string;
    empanelmentComplianceScore: string;
    isAuthorizedToDisburse: false;
}

export interface WatchtowerReport {
    status: 'SUCCESS' | 'FAILED';
    watchtowerVersion: string;
    auditTimestamp: string;
    okfDirectory: string;
    checks: {
        schemaValidation: { status: 'PASSED' | 'FAILED'; sectionsScanned: number; circularsScanned: number; formsScanned: number; errors: string[] };
        citationIntegrity: { status: 'PASSED' | 'FAILED'; totalCitations: number; validCitations: number; failedCitations: number; errors: any[] };
        merkleImmutability: { status: 'PASSED' | 'FAILED'; computedRoot: string; matchesPinnedRoot: boolean; fileCount: number };
        freshnessHorizon: { status: 'PASSED' | 'FAILED'; benchmarksEvaluated: number; benchmarksPassed: number; benchmarks: any[] };
        statutoryInvariants: { status: 'PASSED' | 'FAILED'; disburseInvariantSatisfied: boolean };
    };
    certificate: EmpanelmentCertificate | null;
    executionDurationMs: number;
}

export declare function runStatutoryWatchtower(options?: { okfDir?: string; verbose?: boolean }): Promise<WatchtowerReport>;

// Universal Statutory Virtual Machine (USVM) Declarative Kernel
export interface UsvmAstRule {
    sectionId: string;
    sectionCode: string;
    governingStatute: string;
    statutorySection: string;
    successorSection?: string;
    mathArchetype: string;
    triggerPolicy: string;
    roundingPolicy: string;
    rules?: any[];
    [key: string]: any;
}

export interface UsvmEvaluationResult {
    statuteCode: string;
    governingStatute: string;
    statutorySection: string;
    isAuthorizedToDisburse: false;
    calculatedTdsInr?: number;
    calculatedTcsInr?: number;
    effectiveRatePercent?: number;
    taxableBaseInr?: number;
    taxPayableInr?: number;
    disposition?: string;
    [key: string]: any;
}

export declare function evaluateStatutoryAst(ast: UsvmAstRule, facts: Record<string, any>, options?: { asOfDate?: string; trace?: boolean }): UsvmEvaluationResult;
export declare function validateStatutoryAst(ast: unknown): { valid: boolean; errors?: string[] };
export declare function toBigIntPaise(amountInr: number | string | bigint): bigint;
export declare function fromBigIntPaise(paiseBigInt: bigint): number;
export declare function getStatutoryAst(sectionKey: string): UsvmAstRule | null;
export declare class StatutoryAstValidationError extends Error {
    errors: string[];
    constructor(message: string, errors?: string[]);
}






