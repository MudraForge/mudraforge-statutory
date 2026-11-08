/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DETERMINISTIC STATUTORY & FINANCIAL CALCULATOR (v1.0 -- Adesha Invariants)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements deterministic arithmetic, temporal state machines, and statutory
 * conditionality trees across:
 * 1. MSMED Act Section 16: Exact compound interest with monthly rests at 3x Bank Rate.
 * 2. Section 43B(h) Temporal Engine: March 31 fiscal boundaries, dispute pauses, and trader exclusions.
 * 3. Cross-Border Withholding Engine: Income-tax Act 2025 vs 1961 dual-act mapping,
 *    Form 145/146 routing, and Supreme Court Engineering Analysis (2021) cloud characterization.
 *
 * COMMERCIAL & ARCHITECTURAL BOUNDARY (PUBLIC COMMONS TIER):
 * The zero-dependency functions in this module represent the complete public commons baseline
 * for statutory Accounts Payable withholding, MSME interest, and GST Rule 37 reversals.
 * Advanced enterprise engines (full Form 3CD audit schedule synthesis, Section 234B/C dynamic
 * forecasting, Pillar Two BEPS models, and live banking rail settlement dispatch) are hosted API
 * services and require an Enterprise License (hello@mudraforge.in / support@mudraforge.in).
 *
 * @deprecated PROCEDURAL CALCULATORS DEPRECATION NOTICE (v2.14.0):
 * The procedural calculators in this module are deprecated in favor of declarative
 * Abstract Syntax Tree (AST) evaluation via the Universal Statutory Virtual Machine
 * (USVM) in `@mudraforge/statutory/usvm` (`evaluateStatutoryAst`).
 * Procedural exports are retained for backward compatibility throughout v2.x and
 * will be sunset in v3.0.
 */

// Canonical OKF v0.2 Release Merkle Roots & Versions
export const CURRENT_RELEASE_MERKLE_ROOT = 'sha256-7ffc75e8611a9c966eea756dd544fdae9144e2318d3478633232bb876d05e364';
export const MERKLE_ROOT_OKF_V2 = CURRENT_RELEASE_MERKLE_ROOT;
export const STATUTORY_PACKAGE_VERSION = '2.15.0';
export const OKF_CORPUS_VERSION = '2.15.0';

import {
    MalformedNumericInputError,
    MissingMandatoryParameterError,
    assertMandatoryNumeric,
    cleanNumericAmount,
    toIntegerPaise,
    fromIntegerPaise,
    roundToPaisa,
    roundSection288B
} from '../numeric.js';

import {
    DEFAULT_RBI_BANK_RATE,
    MSMED_RATE_MULTIPLIER,
    RBI_BANK_RATE_SCHEDULE,
    getRbiBankRateForDate,
    resolveMissingPanPenaltyFloor
} from '../constants.js';

export {
    MalformedNumericInputError,
    MissingMandatoryParameterError,
    assertMandatoryNumeric,
    cleanNumericAmount,
    toIntegerPaise,
    fromIntegerPaise,
    roundToPaisa,
    roundSection288B,
    DEFAULT_RBI_BANK_RATE,
    MSMED_RATE_MULTIPLIER,
    RBI_BANK_RATE_SCHEDULE,
    getRbiBankRateForDate,
    resolveMissingPanPenaltyFloor
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. MSMED SECTION 16: DETERMINISTIC COMPOUND INTEREST ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Formula: Compound interest with monthly rests at 3x RBI Bank Rate.
 * For partial months, applies prorated day-count fractions.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateMsmeCompoundInterest({
    principal,
    // First-class MSMED statutory parameters:
    acceptanceDate = null,        // Day of acceptance / deemed acceptance u/s 2(h)
    deliveryDate = null,          // Day of actual delivery u/s 2(h)(i)
    writtenObjectionDate = null,  // Day of written objection u/s 2(h)(ii) (within 15 days of delivery)
    objectionRemovalDate = null,  // Day objection removed by supplier u/s 2(h)(ii)
    agreedPaymentDate = null,     // Date agreed upon in writing u/s 15
    hasWrittenAgreement = null,   // Boolean: true if written agreement exists, false if absent
    // Trader Exclusion & Enterprise Classification (Ministry of MSME OM 02.07.2021):
    vendorNicCode = null,         // 2-digit or 5-digit NIC code (e.g. '45', '46', '47')
    nicCode = null,               // Alias for vendorNicCode
    supplierType = null,          // 'MANUFACTURER' | 'SERVICE' | 'TRADER' | 'RETAIL_TRADER' | 'WHOLESALE_TRADER'
    isTrader = null,              // Explicit boolean override
    // Direct / legacy parameters:
    dueDate = null,
    accrualStartDate = null,
    paymentDate = new Date().toISOString(),
    rbiBankRate = null,
    dateConvention = 'START_DATE_INCLUSIVE', // 'START_DATE_INCLUSIVE' | 'SECTION_16_DAY_AFTER_DUE' | 'FROM_APPOINTED_DAY' | 'FROM_DAY_AFTER_AGREED_DATE'
    commenceDayAfter = false, // Legacy flag: when true, adds 1 day to dueDate per Section 16 agreed date rule
    includePaymentDate = false // When false, payment date is the settlement day (interest ceases at start of payment date)
} = {}) {
    const p = assertMandatoryNumeric(principal, 'principal', 'calculateMsmeCompoundInterest');
    if (p <= 0) {
        throw new Error("Invalid principal amount for MSME interest calculation.");
    }

    // ── 0A. TRADER EXCLUSION GATE (MINISTRY OF MSME OM DATED 02.07.2021) ──
    // Retail and Wholesale Trade (NIC Codes 45, 46, 47) were admitted to Udyam
    // solely for Priority Sector Lending (PSL) purposes. Delayed payment interest
    // under Chapter V of MSMED Act (Section 16) and Section 43B(h) disallowance
    // do NOT apply to traders.
    const resolvedNic = String(vendorNicCode || nicCode || '').trim();
    const isTraderByNic = /^(45|46|47)/.test(resolvedNic);
    const isTraderByType = typeof supplierType === 'string' && /TRADER|RETAIL|WHOLESALE/i.test(supplierType);
    const traderExclusionActive = isTrader === true || isTraderByNic || isTraderByType;

    if (traderExclusionActive) {
        return {
            principal: p,
            status: 'EXEMPT_TRADER_EXCLUSION',
            isTrader: true,
            isTraderExclusionApplied: true,
            vendorNicCode: resolvedNic || null,
            supplierType: supplierType || (isTraderByNic ? 'TRADER' : null),
            overdueDays: 0,
            totalInterest: 0,
            penalInterestAmount: 0,
            totalInterestRoundedSection288B: 0,
            totalPayable: p,
            effectiveAnnualRatePercent: 0,
            effectiveAnnualInterestRatePercent: 0,
            monthlyRestsCount: 0,
            monthlyRests: [],
            statutoryRule: 'MSME_TRADER_EXCLUSION_OM_2021',
            statutoryCitation: 'Ministry of MSME OM No. 5/2(2)/2021-E/P & G/Policy dated 02-07-2021 and RBI Circular FIDD.MSME & NFS.BC.No.13/06.02.31/2021-22',
            statutoryBasis: 'Wholesale and Retail Traders (NIC Codes 45, 46, 47) are admitted to Udyam solely for Priority Sector Lending (PSL). Chapter V delayed payment interest u/s 16 of MSMED Act and Section 43B(h) do NOT apply.',
            statutoryRationale: 'Enterprises registered under Retail and Wholesale Trade (NIC Codes 45, 46, 47) are restricted strictly to Priority Sector Lending (PSL) benefits. Delayed payment interest under Section 16 of MSMED Act and Section 43B(h) disallowance do NOT apply to traders.'
        };
    }

    if (!dueDate && !accrualStartDate && !acceptanceDate && !agreedPaymentDate && !deliveryDate) {
        throw new Error("Invalid statutory dates: at least one of acceptanceDate, deliveryDate, agreedPaymentDate, dueDate, or accrualStartDate must be provided for MSME interest calculation.");
    }

    // ── 0. SECTION 2(h) DAY OF ACCEPTANCE & DEEMED ACCEPTANCE RESOLUTION ──
    let effectiveAcceptanceDate = acceptanceDate;
    let acceptanceType = acceptanceDate ? 'EXPLICIT_ACCEPTANCE_DATE' : null;

    if (!effectiveAcceptanceDate && deliveryDate) {
        const dDelivery = new Date(String(deliveryDate).slice(0, 10) + 'T00:00:00.000Z');
        if (isNaN(dDelivery.getTime())) {
            throw new Error("Invalid deliveryDate format (expected YYYY-MM-DD).");
        }

        if (writtenObjectionDate) {
            const dObjection = new Date(String(writtenObjectionDate).slice(0, 10) + 'T00:00:00.000Z');
            const diffDays = Math.round((dObjection.getTime() - dDelivery.getTime()) / 86400000);

            // Section 2(h)(ii): Objection must be made within 15 days from delivery
            if (diffDays >= 0 && diffDays <= 15) {
                if (objectionRemovalDate) {
                    effectiveAcceptanceDate = String(objectionRemovalDate).slice(0, 10);
                    acceptanceType = 'ACCEPTANCE_UPON_OBJECTION_REMOVAL';
                } else {
                    return {
                        principal: p,
                        status: 'DISPUTE_CLOCK_PAUSED',
                        statutoryDetermination: 'INDETERMINATE_DISPUTE_UNRESOLVED',
                        isDisputePaused: true,
                        isAuthorizedToDisburse: false,
                        reason: 'Written objection filed within 15 days of delivery remains unresolved. Acceptance clock paused under Section 2(h)(ii). Objection removal date required to determine due date and interest.',
                        acceptanceDate: null,
                        statutoryDueDate: null,
                        overdueDays: null,
                        totalInterest: null,
                        penalInterestAmount: null,
                        totalInterestRoundedSection288B: null,
                        totalPayable: null,
                        monthlyRestsCount: 0,
                        monthlyRests: []
                    };
                }
            } else {
                effectiveAcceptanceDate = String(deliveryDate).slice(0, 10);
                acceptanceType = 'DEEMED_ACCEPTANCE_UNTIMELY_OBJECTION_DISREGARDED';
            }
        } else {
            effectiveAcceptanceDate = String(deliveryDate).slice(0, 10);
            acceptanceType = 'DEEMED_ACCEPTANCE_NO_OBJECTION';
        }
    }

    // ── 1. STATUTORY DATE RESOLUTION (MSMED ACT 2006 SECTIONS 15, 16 & 2(b)) ──
    // Section 16 prescribes two distinct commencement rules depending on whether a written agreement exists:
    //
    // Branch A (No written agreement):
    //   - Section 15: Buyer shall make payment "before the appointed day".
    //   - Section 2(b): "appointed day means the day following immediately after the expiry of the period of fifteen days from the day of acceptance".
    //   - Section 16: Buyer is liable to pay interest "from the appointed day".
    //   - Execution: Interest accrues ON the appointed day itself (acceptanceDate + 16 days).
    //
    // Branch B (Written agreement):
    //   - Section 15: Buyer shall make payment "on or before the date agreed upon".
    //   - Section 15 Proviso: In no case shall the agreed period exceed 45 days from acceptance.
    //   - Section 16: Buyer is liable to pay interest "from the date immediately following the date agreed upon".
    //   - Execution: Interest accrues starting agreedDate + 1 day (or cappedDate + 1 day).

    let startStr = null;
    let statutoryDueDateStr = null;
    let appointedDayStr = null;
    let effectiveAgreedDateStr = null;
    let statutoryCapApplied = false;
    let statutoryRule = 'LEGACY_DUE_DATE';
    let statutoryCitation = 'MSMED Act, 2006 Section 16';

    const endStr = String(paymentDate).slice(0, 10);
    const payment = new Date(endStr + 'T00:00:00.000Z');

    if (effectiveAcceptanceDate) {
        const dAccept = new Date(String(effectiveAcceptanceDate).slice(0, 10) + 'T00:00:00.000Z');
        if (isNaN(dAccept.getTime())) {
            throw new Error("Invalid acceptanceDate format (expected YYYY-MM-DD).");
        }

        // Section 2(b): Appointed day = day following immediately after expiry of 15 days
        const dAppointed = new Date(dAccept.getTime() + 16 * 86400000);
        appointedDayStr = dAppointed.toISOString().split('T')[0];

        const isWritten = hasWrittenAgreement === true || (hasWrittenAgreement === null && Boolean(agreedPaymentDate));

        if (isWritten && agreedPaymentDate) {
            // Branch B: Written agreement
            statutoryRule = 'SECTION_16_FROM_DAY_AFTER_AGREED_DATE';
            statutoryCitation = 'MSMED Act, 2006 Section 16 (interest running from date immediately following agreed date u/s 15 proviso)';
            
            const dAgreed = new Date(String(agreedPaymentDate).slice(0, 10) + 'T00:00:00.000Z');
            if (isNaN(dAgreed.getTime())) {
                throw new Error("Invalid agreedPaymentDate format (expected YYYY-MM-DD).");
            }

            // Section 15 Proviso: Maximum 45 days from day of acceptance
            const dCap = new Date(dAccept.getTime() + 45 * 86400000);
            if (dAgreed > dCap) {
                statutoryCapApplied = true;
                effectiveAgreedDateStr = dCap.toISOString().split('T')[0];
                statutoryDueDateStr = effectiveAgreedDateStr;
                const dAccrual = new Date(dCap.getTime() + 86400000);
                startStr = dAccrual.toISOString().split('T')[0];
            } else {
                statutoryCapApplied = false;
                effectiveAgreedDateStr = dAgreed.toISOString().split('T')[0];
                statutoryDueDateStr = effectiveAgreedDateStr;
                const dAccrual = new Date(dAgreed.getTime() + 86400000);
                startStr = dAccrual.toISOString().split('T')[0];
            }
        } else {
            // Branch A: No written agreement (Appointed Day rule)
            statutoryRule = 'SECTION_16_FROM_APPOINTED_DAY';
            statutoryCitation = 'MSMED Act, 2006 Section 16 (interest running from appointed day under Section 2(b))';
            
            // Payment due before appointed day (acceptance + 15 days)
            const dDue = new Date(dAccept.getTime() + 15 * 86400000);
            statutoryDueDateStr = dDue.toISOString().split('T')[0];
            // Interest runs FROM the appointed day (acceptance + 16 days)
            startStr = appointedDayStr;
        }
    } else {
        // Direct / legacy parameter fallback
        const dueDateStr = dueDate ? String(dueDate).slice(0, 10) : null;
        const isDayAfter = commenceDayAfter || dateConvention === 'SECTION_16_DAY_AFTER_DUE' || dateConvention === 'FROM_DAY_AFTER_AGREED_DATE';
        const isFromAppointed = dateConvention === 'FROM_APPOINTED_DAY';

        if (accrualStartDate) {
            startStr = String(accrualStartDate).slice(0, 10);
            statutoryDueDateStr = dueDateStr || startStr;
            statutoryRule = 'EXPLICIT_ACCRUAL_START_DATE';
        } else if (isFromAppointed && dueDateStr) {
            // Caller passed appointed day as dueDate; interest runs from appointed day
            startStr = dueDateStr;
            const dDue = new Date(dueDateStr + 'T00:00:00.000Z');
            const dBeforeAppointed = new Date(dDue.getTime() - 86400000);
            statutoryDueDateStr = dBeforeAppointed.toISOString().split('T')[0];
            statutoryRule = 'SECTION_16_FROM_APPOINTED_DAY';
            statutoryCitation = 'MSMED Act, 2006 Section 16 (interest running from appointed day under Section 2(b))';
        } else if (isDayAfter && dueDateStr) {
            // Caller passed agreed payment date; interest runs from day immediately following
            const dDue = new Date(dueDateStr + 'T00:00:00.000Z');
            if (isNaN(dDue.getTime())) {
                throw new Error("Invalid dueDate format (expected YYYY-MM-DD).");
            }
            statutoryDueDateStr = dueDateStr;
            const dAccrual = new Date(dDue.getTime() + 86400000);
            startStr = dAccrual.toISOString().split('T')[0];
            statutoryRule = 'SECTION_16_FROM_DAY_AFTER_AGREED_DATE';
            statutoryCitation = 'MSMED Act, 2006 Section 16 (interest running from date immediately following agreed date u/s 15 proviso)';
        } else {
            // Default legacy inclusive
            startStr = dueDateStr;
            statutoryDueDateStr = dueDateStr;
            statutoryRule = 'LEGACY_DUE_DATE';
        }
    }

    const start = new Date(startStr + 'T00:00:00.000Z');

    if (isNaN(start.getTime()) || isNaN(payment.getTime())) {
        throw new Error("Invalid dueDate or paymentDate format (expected YYYY-MM-DD).");
    }

    let effectiveBankRate = (rbiBankRate !== null && rbiBankRate !== undefined)
        ? Number(rbiBankRate)
        : getRbiBankRateForDate(statutoryDueDateStr || startStr || paymentDate);

    if (isNaN(effectiveBankRate) || !Number.isFinite(effectiveBankRate) || effectiveBankRate <= 0) {
        throw new Error(`Invalid rbiBankRate for MSME calculation: expected finite positive rate, received ${rbiBankRate}.`);
    }

    if (effectiveBankRate > 1) {
        // Defensive normalization: caller passed whole percentage e.g. 6.5 instead of 0.065
        effectiveBankRate = effectiveBankRate / 100;
    }

    const annualRate = effectiveBankRate * MSMED_RATE_MULTIPLIER; // e.g. 0.195 (19.5%)
    const activeDateConvention = dateConvention || 'START_DATE_INCLUSIVE';

    // Zero-Liability Check: Payment made on or before statutory due date
    const dDueRef = statutoryDueDateStr ? new Date(statutoryDueDateStr + 'T00:00:00.000Z') : start;
    if (payment <= dDueRef) {
        return {
            principal: p,
            effectiveAnnualRatePercent: Number((effectiveBankRate * MSMED_RATE_MULTIPLIER * 100).toFixed(2)),
            annualRateDecimal: effectiveBankRate * MSMED_RATE_MULTIPLIER,
            rbiBankRate: effectiveBankRate,
            statutoryRule,
            statutoryCitation,
            statutoryDueDate: statutoryDueDateStr,
            firstAccrualDate: startStr,
            paymentDate: endStr,
            acceptanceDate: effectiveAcceptanceDate ? String(effectiveAcceptanceDate).slice(0, 10) : null,
            acceptanceType,
            appointedDay: appointedDayStr,
            agreedPaymentDate: effectiveAgreedDateStr || (agreedPaymentDate ? String(agreedPaymentDate).slice(0, 10) : null),
            statutoryCapApplied,
            dateConvention: activeDateConvention,
            includePaymentDate,
            dayCountConvention: 'ACTUAL/365_OR_366',
            dayCountConventionBasis: 'DOCUMENTED_CALCULATION_CONVENTION',
            overdueDays: 0,
            totalInterest: 0,
            penalInterestAmount: 0,
            totalInterestRoundedSection288B: 0,
            totalPayable: p,
            monthlyRestsCount: 0,
            monthlyRests: [],
            statutoryBasis: `Payment made on or before statutory due date (${statutoryDueDateStr}). Zero penal interest accrued under Section 16 of MSMED Act, 2006.`
        };
    }

    // Accrual End Boundary:
    // If includePaymentDate is true, accrual continues through the end of paymentDate.
    // If includePaymentDate is false, accrual terminates at opening of paymentDate (paymentDate - 1 day).
    const accrualEnd = includePaymentDate
        ? new Date(payment.getTime() + 86400000)
        : payment;

    if (accrualEnd <= start) {
        return {
            principal: p,
            effectiveAnnualRatePercent: Number((annualRate * 100).toFixed(2)),
            annualRateDecimal: annualRate,
            rbiBankRate: effectiveBankRate,
            dueDate: dueDateStr,
            firstAccrualDate: startStr,
            paymentDate: endStr,
            dateConvention: activeDateConvention,
            includePaymentDate,
            dayCountConvention: 'ACTUAL/365_OR_366',
            overdueDays: 0,
            totalInterest: 0,
            penalInterestAmount: 0,
            totalInterestRoundedSection288B: 0,
            totalPayable: p,
            monthlyRestsCount: 0,
            monthlyRests: [],
            statutoryBasis: "Zero overdue accrual days under selected payment date boundary."
        };
    }

    const totalDays = Math.round((accrualEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate month-by-month compounding with monthly rests strictly in UTC
    const monthlyRests = [];
    let currentBalance = p;
    let iterDate = new Date(start.getTime());
    let restIndex = 1;

    while (iterDate < accrualEnd) {
        const year = iterDate.getUTCFullYear();
        const month = iterDate.getUTCMonth();
        // Start of next calendar month in UTC
        const nextMonthStart = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
        const restEnd = accrualEnd < nextMonthStart ? accrualEnd : nextMonthStart;

        const daysInRest = Math.round((restEnd.getTime() - iterDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysInRest > 0) {
            const daysInYear = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
            const periodInterest = currentBalance * annualRate * (daysInRest / daysInYear);
            const closing = currentBalance + periodInterest;

            const inclusivePeriodEnd = new Date(restEnd.getTime() - 86400000).toISOString().split('T')[0];

            monthlyRests.push({
                restNumber: restIndex++,
                periodStart: iterDate.toISOString().split('T')[0],
                periodEnd: inclusivePeriodEnd,
                daysInPeriod: daysInRest,
                yearDenominator: daysInYear,
                openingPrincipal: Number(currentBalance.toFixed(2)),
                openingPrincipalFullPrecision: currentBalance,
                interestAccrued: Number(periodInterest.toFixed(2)),
                interestAccruedFullPrecision: periodInterest,
                closingBalance: Number(closing.toFixed(2)),
                closingBalanceFullPrecision: closing,
                capitalizedAt: restEnd < accrualEnd ? `End of calendar month (${inclusivePeriodEnd} 24:00 UTC)` : `Payment settlement (${endStr})`
            });

            currentBalance = closing;
        }

        iterDate = restEnd;
    }

    const totalInterest = Number((currentBalance - p).toFixed(2));
    const totalPayable = Number(currentBalance.toFixed(2));

    return {
        principal: p,
        effectiveAnnualRatePercent: Number((annualRate * 100).toFixed(2)),
        annualRateDecimal: annualRate,
        rbiBankRate: effectiveBankRate,
        statutoryRule,
        statutoryCitation,
        statutoryDueDate: statutoryDueDateStr,
        dueDate: statutoryDueDateStr,
        firstAccrualDate: startStr,
        paymentDate: endStr,
        acceptanceDate: effectiveAcceptanceDate ? String(effectiveAcceptanceDate).slice(0, 10) : null,
        acceptanceType,
        appointedDay: appointedDayStr,
        agreedPaymentDate: effectiveAgreedDateStr || (agreedPaymentDate ? String(agreedPaymentDate).slice(0, 10) : null),
        statutoryCapApplied,
        dateConvention: activeDateConvention,
        includePaymentDate,
        dayCountConvention: 'ACTUAL/365_OR_366',
        dayCountConventionBasis: 'DOCUMENTED_CALCULATION_CONVENTION',
        overdueDays: totalDays,
        totalInterest,
        penalInterestAmount: totalInterest,
        totalInterestRoundedSection288B: roundSection288B(totalInterest),
        totalPayable,
        monthlyRestsCount: monthlyRests.length,
        monthlyRests,
        statutoryBasis: `${statutoryCitation} (Compound interest with monthly rests at 3x RBI Bank Rate: ${Number((annualRate * 100).toFixed(2))}%)`
    };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. SECTION 43B(h) TEMPORAL & FISCAL BOUNDARY STATE MACHINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Accurately branches:
 * - Trader vs Manufacturer qualification (NIC 45, 46, 47 exclusion)
 * - 45-day written contract vs 15-day statutory baseline
 * - Dispute clock pauses (Section 15 Explanation)
 * - Same FY (before March 31) payment vs crossing FY boundary
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function evaluateSection43bH({
    invoiceDate,
    acceptanceDate = null,
    agreedTermsDays = null,
    disputeStartDate = null,
    disputeEndDate = null,
    paymentDate = null,
    fyEndDate = null,
    supplierType = 'MANUFACTURER', // 'MICRO_MANUFACTURER', 'SMALL_MANUFACTURER', 'TRADER', 'MEDIUM'
    nicCode = null
} = {}) {
    const baseAcceptanceDate = new Date(acceptanceDate || invoiceDate);
    
    // Dynamically calculate fiscal year end based on invoice/acceptance date if not explicitly overridden
    let effectiveFyEndDate = fyEndDate;
    if (!effectiveFyEndDate) {
        const refDate = new Date(acceptanceDate || invoiceDate);
        if (!isNaN(refDate.getTime())) {
            const month = refDate.getMonth(); // Jan=0, Feb=1, Mar=2, Apr=3
            const year = refDate.getFullYear();
            const endYear = month >= 3 ? year + 1 : year;
            effectiveFyEndDate = `${endYear}-03-31`;
        } else {
            effectiveFyEndDate = '2026-03-31';
        }
    }
    const fyEnd = new Date(effectiveFyEndDate);
    const actualPayment = paymentDate ? new Date(paymentDate) : null;

    // ── GATE 1: SUPPLIER ELIGIBILITY CHECK ──
    const isTrader = supplierType?.toUpperCase()?.includes('TRADER') 
        || (nicCode && /^(45|46|47)/.test(String(nicCode).trim()));
    const isMedium = supplierType?.toUpperCase()?.includes('MEDIUM');

    if (isTrader) {
        return {
            isCoveredBy43Bh: false,
            qualificationStatus: 'EXCLUDED_TRADER',
            reason: 'Supplier is registered as a Retail or Wholesale Trader (NIC 45/46/47). Ministry of MSME OM No. 2/1(5)/2021-P&G/Policy dated 02.07.2021 restricts Chapter V and Section 43B(h) protection to Manufacturers and Service Providers only.',
            disallowedInCurrentFY: false,
            taxDeductionStatus: 'ALLOWABLE_ON_ACCRUAL',
            statutoryAction: 'Expense is 100% deductible in the current financial year on mercantile accrual basis, regardless of payment date.'
        };
    }

    if (isMedium) {
        return {
            isCoveredBy43Bh: false,
            qualificationStatus: 'EXCLUDED_MEDIUM_ENTERPRISE',
            reason: 'Supplier is a Medium Enterprise. Section 43B(h) exclusively protects Micro and Small enterprises. Medium enterprises are outside the purview.',
            disallowedInCurrentFY: false,
            taxDeductionStatus: 'ALLOWABLE_ON_ACCRUAL',
            statutoryAction: 'Expense is deductible on standard mercantile accrual basis.'
        };
    }

    // ── GATE 2: STATUTORY PAYMENT TIMELINE & DISPUTE PAUSE ──
    // Without written agreement: strictly 15 days from acceptance
    // With written agreement: agreed term up to a maximum cap of 45 days
    let allowedDays = 15;
    let agreementType = 'STATUTORY_DEFAULT_15_DAYS';

    if (agreedTermsDays && Number(agreedTermsDays) > 0) {
        const terms = Number(agreedTermsDays);
        if (terms <= 45) {
            allowedDays = terms;
            agreementType = `WRITTEN_AGREEMENT_${terms}_DAYS`;
        } else {
            allowedDays = 45; // Section 15 statutory cap
            agreementType = 'WRITTEN_AGREEMENT_CAPPED_AT_45_DAYS';
        }
    }

    // Check dispute pause (Section 15 Explanation)
    let disputeDurationDays = 0;
    if (disputeStartDate && disputeEndDate) {
        const dStart = new Date(disputeStartDate);
        const dEnd = new Date(disputeEndDate);
        if (dEnd > dStart) {
            disputeDurationDays = Math.ceil((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
        }
    }

    const statutoryDueDate = new Date(baseAcceptanceDate.getTime() + ((allowedDays + disputeDurationDays) * 24 * 60 * 60 * 1000));

    // ── GATE 3: TEMPORAL TAX ASSESSMENT (MARCH 31 FY BOUNDARY) ──
    const dueDateStr = statutoryDueDate.toISOString().split('T')[0];
    const fyEndStr = fyEnd.toISOString().split('T')[0];

    // Case A: Payment already made
    if (actualPayment) {
        const paymentDateStr = actualPayment.toISOString().split('T')[0];
        const isPaidWithinStatutoryTerms = actualPayment <= statutoryDueDate;
        const isPaidBeforeMarch31 = actualPayment <= fyEnd;

        if (isPaidWithinStatutoryTerms) {
            return {
                isCoveredBy43Bh: true,
                qualificationStatus: 'QUALIFIED_MICRO_SMALL',
                statutoryDueDate: dueDateStr,
                actualPaymentDate: paymentDateStr,
                disputeDurationDays,
                agreementType,
                isPaidWithinTerms: true,
                isPaidBeforeMarch31,
                disallowedInCurrentFY: false,
                taxDeductionStatus: 'FULLY_DEDUCTIBLE_CURRENT_FY',
                statutoryAction: `Payment made on ${paymentDateStr} within the statutory clock (due ${dueDateStr}). Expense is 100% allowable on accrual basis in the current assessment year.`
            };
        }

        // Paid LATE, but before March 31 of same FY:
        if (isPaidBeforeMarch31) {
            return {
                isCoveredBy43Bh: true,
                qualificationStatus: 'QUALIFIED_MICRO_SMALL',
                statutoryDueDate: dueDateStr,
                actualPaymentDate: paymentDateStr,
                disputeDurationDays,
                agreementType,
                isPaidWithinTerms: false,
                isPaidBeforeMarch31: true,
                disallowedInCurrentFY: false, // CRITICAL CA INVARIANT: Paid before March 31 = Deductible on actual payment in same FY!
                taxDeductionStatus: 'FULLY_DEDUCTIBLE_CURRENT_FY_ON_PAYMENT',
                msmePenalInterestApplicable: true,
                statutoryAction: `Payment was delayed past statutory due date (${dueDateStr}), but made BEFORE fiscal year-end (${paymentDateStr} <= ${fyEndStr}). Under Section 43B(h), the deduction is allowable on actual payment basis in this same financial year (ZERO year-end tax disallowance). Note: MSMED Section 16 compound interest remains payable to the supplier for the delayed days.`
            };
        }

        // Paid LATE and crossed March 31 into next FY:
        const currentFY = `${fyEnd.getFullYear() - 1}-${String(fyEnd.getFullYear()).slice(-2)}`;
        const nextFY = `${fyEnd.getFullYear()}-${String(fyEnd.getFullYear() + 1).slice(-2)}`;

        return {
            isCoveredBy43Bh: true,
            qualificationStatus: 'QUALIFIED_MICRO_SMALL',
            statutoryDueDate: dueDateStr,
            actualPaymentDate: paymentDateStr,
            disputeDurationDays,
            agreementType,
            isPaidWithinTerms: false,
            isPaidBeforeMarch31: false,
            disallowedInCurrentFY: true,
            assessmentYearDisallowed: `AY ${fyEnd.getFullYear() + 1}-${String(fyEnd.getFullYear() + 2).slice(-2)} (FY ${currentFY})`,
            assessmentYearAllowed: `AY ${actualPayment.getFullYear() + 1}-${String(actualPayment.getFullYear() + 2).slice(-2)} (FY ${nextFY})`,
            taxDeductionStatus: 'DISALLOWED_CURRENT_FY_CARRIED_FORWARD',
            msmePenalInterestApplicable: true,
            statutoryAction: `Overdue invoice remained unpaid as of March 31 (${fyEndStr}) and crossed into next FY. The expense is strictly DISALLOWED in FY ${currentFY} under Section 43B(h), and becomes deductible in FY ${nextFY} (the year of actual payment). MSMED Section 16 penal interest is applicable and is non-deductible under Section 23 of MSMED Act.`
        };
    }

    // Case B: Currently unpaid
    const today = new Date();
    const isCurrentlyOverdue = today > statutoryDueDate;

    return {
        isCoveredBy43Bh: true,
        qualificationStatus: 'QUALIFIED_MICRO_SMALL',
        statutoryDueDate: dueDateStr,
        actualPaymentDate: null,
        disputeDurationDays,
        agreementType,
        isCurrentlyOverdue,
        statutoryAction: isCurrentlyOverdue
            ? `Invoice is currently overdue past ${dueDateStr}. To prevent Section 43B(h) disallowance, payment must be completed before ${fyEndStr} (March 31).`
            : `Invoice is within terms until ${dueDateStr}. Ensure payment is settled before the due date.`
    };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2B. SECTION 43B STATUTORY PAYABLES & SECTION 36(1)(va) CHECKMATE ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Evaluates corporate statutory liabilities and payroll welfare deductions under:
 * - Section 43B(a): Taxes, duties, cess, fee (GST, Customs, Property Tax)
 * - Section 43B(b): Employer contribution to EPF, ESIC, gratuity, superannuation
 * - Section 43B(c): Bonus or commission to employees (Sec 36(1)(ii))
 * - Section 43B(d)/(da)/(e): Interest on loans from PFIs, NBFCs, scheduled banks
 * - Section 43B(f): Leave encashment provision
 * - Section 43B(g): Railway payables
 * - Section 36(1)(va) read with Section 2(24)(x): Employee welfare contributions
 *
 * Governing Legal Principles:
 * 1. First Proviso to Section 43B:
 *    - For 43B(a) through 43B(g), deduction is ALLOWED in the year of accrual
 *      if actually paid on or before the due date for filing return under Section 139(1).
 *    - If paid after Section 139(1) due date, deduction is disallowed in current FY
 *      and allowed in the subsequent FY when actually paid (timing difference).
 * 2. Supreme Court Checkmate Doctrine (Checkmate Services P. Ltd. v. CIT (2022) 448 ITR 518 (SC)):
 *    - First Proviso relaxation strictly DOES NOT APPLY to employee contributions (Sec 36(1)(va)).
 *    - Employee contributions withheld from salary constitute deemed income under Section 2(24)(x).
 *    - Allowable as deduction ONLY IF deposited on or before the statutory due date
 *      under the respective Act (e.g. 15th of following month for EPF/ESIC).
 *    - Late deposit results in PERMANENT DISALLOWANCE in that Assessment Year.
 * 3. Explanations 3C & 3D to Section 43B:
 *    - Conversion of unpaid interest into a loan, advance, debenture, or other instrument
 *      does NOT constitute actual payment and remains disallowed.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function evaluateCrossBorderRemittance({
    amountUsd,
    fxRate = 83.5,
    transactionDate = new Date().toISOString(),
    country = null,
    isAutomatedCloudInfra = true,
    hasHumanTechnicalServices = false,
    hasTrc = false,
    hasNoPe = false,
    hasForm10F = false,
    hasAoCertificate = false
} = {}) {
    const usd = cleanNumericAmount(amountUsd);
    const rate = cleanNumericAmount(fxRate) || 83.5;
    const amountInr = roundToPaisa(usd * rate);
    const txDate = new Date(transactionDate);

    // If treaty relief is claimed (TRC, No-PE, or Form 10F) but country is missing,
    // bilateral DTAA treaty benefits cannot be determined under Section 90 without knowing the Contracting State.
    if ((hasTrc || hasNoPe || hasForm10F) && (!country || typeof country !== 'string' || !country.trim())) {
        return {
            amountUsd: usd,
            amountInr,
            transactionDate,
            statutoryDetermination: 'INDETERMINATE',
            status: 'INDETERMINATE',
            isAuthorizedToDisburse: false,
            effectiveRatePercent: null,
            calculatedTdsInr: null,
            withholdingTaxInr: null,
            netRemittanceInr: null,
            indeterminacyReason: 'MISSING_RECIPIENT_COUNTRY_FOR_DTAA',
            characterization: 'Recipient country of tax residency is mandatory to evaluate bilateral DTAA treaty benefits and rates under Section 90.',
            taxabilityBasis: 'DTAA_TREATY_COUNTRY_REQUIRED',
            statutoryCitations: txDate >= new Date('2026-04-01') ? {
                act: "Income-tax Act, 2025",
                chargingSection: "Section 393(2)"
            } : {
                act: "Income-tax Act, 1961",
                chargingSection: "Section 195"
            },
            requiredDocumentation: ['Recipient Country of Tax Residency', 'Tax Residency Certificate (TRC)', 'Form 10F', 'No-PE Certificate']
        };
    }

    // ── TEMPORAL ACT BRIDGE (1 April 2026 Boundary) ──
    const isAct2025 = txDate >= new Date('2026-04-01');

    const statutoryCitations = isAct2025 ? {
        act: "Income-tax Act, 2025",
        chargingSection: "Section 393(2) (Non-Resident Non-Salary Withholding Table)",
        declarationForm: "Form 145",
        caCertificateForm: "Form 146",
        governingRule: "Rule 220 of Income-tax Rules, 2026",
        penaltySection: "Section 462 (Penalty for non-furnishing of Form 145, up to ₹1,00,000)"
    } : {
        act: "Income-tax Act, 1961",
        chargingSection: "Section 195 (Other Sums Payable to Non-Resident)",
        declarationForm: "Form 15CA",
        caCertificateForm: "Form 15CB",
        governingRule: "Rule 37BB of Income-tax Rules, 1962",
        penaltySection: "Section 271-I (Penalty for failure to furnish information, ₹1,00,000)"
    };

    // ── TAXABILITY & CLOUD CHARACTERIZATION ──
    // Engineering Analysis (2021) SC + Rackspace/AWS ITAT Rulings
    let characterization = "";
    let effectiveRatePercent = 20; // Default domestic non-treaty rate
    let taxabilityBasis = "";

    const isTaxHaven = country ? ['CYPRUS', 'CAYMAN', 'BERMUDA', 'BVI', 'PANAMA'].includes(String(country).toUpperCase().trim()) : false;
    if (isTaxHaven) {
        effectiveRatePercent = 30; // Section 94A NJA rate
        characterization = "Notified Jurisdictional Area (Tax Haven) under Section 94A / 2025 Act equivalent. Mandatory 30% withholding.";
        taxabilityBasis = "TAX_HAVEN_STATUTORY_OVERRIDE";
    } else if (isAutomatedCloudInfra && !hasHumanTechnicalServices) {
        // Pure automated SaaS/database infrastructure
        if (hasTrc && hasNoPe) {
            effectiveRatePercent = 0;
            characterization = "Business Profits under DTAA Article 7. Under Supreme Court Engineering Analysis (2021) and ITAT precedents, automated cloud hosting without human managerial/technical involvement does not constitute Royalty or FTS. In the absence of an Indian Permanent Establishment (PE), income is non-taxable in India.";
            taxabilityBasis = "DTAA_ARTICLE_7_BUSINESS_PROFITS_NON_TAXABLE";
        } else {
            effectiveRatePercent = 20;
            characterization = "Automated cloud infrastructure, but foreign vendor lacks TRC and No-PE certificate. Default domestic withholding applies under Section 195 / Section 393.";
            taxabilityBasis = "UNVERIFIED_TREATY_DOMESTIC_RATE";
        }
    } else {
        // Fees for Technical Services (FTS) / Royalty
        if (hasTrc && hasForm10F) {
            effectiveRatePercent = 10; // Standard DTAA Article 12 cap
            characterization = "Fees for Technical Services (FTS) / Royalty under DTAA Article 12. Eligible for concessional treaty rate of 10% (plus surcharge/cess as applicable).";
            taxabilityBasis = "DTAA_ARTICLE_12_FTS_TREATY_RATE";
        } else {
            effectiveRatePercent = 20;
            characterization = "FTS / Royalty without valid TRC and Form 10F. Defaults to domestic statutory rate of 20%.";
            taxabilityBasis = "DOMESTIC_STATUTORY_FTS_RATE";
        }
    }

    // ── FORM ROUTING CONDITIONALITY TREE (Part A vs Part B vs Part C) ──
    const FIVE_LAKHS_INR = 500000;
    let applicablePart = "";
    let caCertificateRequired = false;
    let proceduralSummary = "";

    if (amountInr <= FIVE_LAKHS_INR && effectiveRatePercent === 0) {
        applicablePart = "PART_A";
        caCertificateRequired = false;
        proceduralSummary = `Aggregate remittance in financial year does not exceed ₹5,00,000. File ${statutoryCitations.declarationForm} Part A only. CA Certificate (${statutoryCitations.caCertificateForm}) is not required.`;
    } else if (hasAoCertificate) {
        applicablePart = "PART_B";
        caCertificateRequired = false;
        proceduralSummary = `Lower/Nil withholding certificate or order obtained from Assessing Officer under Section 197 / Section 195(2). File ${statutoryCitations.declarationForm} Part B. CA Certificate (${statutoryCitations.caCertificateForm}) is waived under law.`;
    } else {
        applicablePart = "PART_C";
        caCertificateRequired = true;
        proceduralSummary = `Remittance exceeds ₹5,00,000 and no AO order has been obtained. Mandatory compliance: Obtain CA Certificate in ${statutoryCitations.caCertificateForm}, then file ${statutoryCitations.declarationForm} Part C online before initiating the bank transfer.`;
    }

    const calculatedTdsInr = Number(((amountInr * effectiveRatePercent) / 100).toFixed(2));
    const netRemittanceInr = Number((amountInr - calculatedTdsInr).toFixed(2));

    // Dual control check
    const requiresAdeshaTier2Card = usd > 500;

    return {
        amountUsd: usd,
        amountInr,
        transactionDate,
        statutoryCitations,
        characterization,
        taxabilityBasis,
        effectiveRatePercent,
        calculatedTdsInr,
        netRemittanceInr,
        applicablePart,
        caCertificateRequired,
        proceduralSummary,
        requiredDocumentation: [
            "Vendor Tax Residency Certificate (TRC) covering relevant financial year",
            "Form 10F (self-declaration filed on income tax portal)",
            "No Permanent Establishment (No-PE) certificate from vendor",
            "Invoice and Cloud Service Level Agreement (confirming hosted outside India)",
            caCertificateRequired ? `${statutoryCitations.caCertificateForm} (Chartered Accountant Certificate)` : null,
            `${statutoryCitations.declarationForm} (${applicablePart} acknowledgement)`
        ].filter(Boolean),
        governanceGate: {
            requiresAdeshaTier2Card,
            policy: requiresAdeshaTier2Card 
                ? "International SWIFT remittance exceeds $500 threshold. Bounded Human-in-the-Loop Attention Card + dual-control sign-off required before release."
                : "Within standard autonomous threshold."
        }
    };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. SECTION 194Q / 206C(1H) / 206AA: DETERMINISTIC GOODS WITHHOLDING ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes exact taxable base exceeding ₹50,00,000 annual threshold, applies
 * Section 206AA penalty rate (20%) if PAN is missing/inoperative, models the
 * Section 206C(1H) sunset effective 1 April 2025, and transitions to
 * Section 393(1) of the Income-tax Act, 2025 on 1 April 2026.
 */
/**
 * 3. LOWER DEDUCTION CERTIFICATE STATUTORY EVALUATOR (SECTION 197 / SECTION 395)
 * ─────────────────────────────────────────────────────────────────────────────
 * Evaluates the statutory validity of lower deduction certificates across regime transitions:
 * - Checks explicit cancellation or revocation status (Assessing Officer / TRACES).
 * - Checks covered period / validity window against transaction effective date.
 * - Enforces Section 536(2) transitional savings for legacy Section 197 certificates
 *   pre-issued for FY 2026-27 under the Income-tax Act, 2025.
 * - Rejects expired certificates (e.g. FY 2025-26 certificates used post-April 2026).
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateRule42InputServiceReversal({
    taxPeriod = 'CURRENT_PERIOD',
    totalItcInr,
    t1NonBusinessInr = 0,
    t2ExemptInr = 0,
    t3BlockedInr = 0,
    t4TaxableInr = 0,
    exemptTurnoverInr = 0,
    totalTurnoverInr = 0,
    hasNonBusinessUse = true,
    precedingExemptTurnoverInr = 0,
    precedingTotalTurnoverInr = 0
} = {}) {
    if (totalItcInr === undefined || totalItcInr === null) {
        throw new Error('[@mudraforge/statutory] calculateRule42InputServiceReversal: totalItcInr is required.');
    }

    const T = roundToPaisa(Math.max(0, cleanNumericAmount(totalItcInr)));
    const T1 = roundToPaisa(Math.max(0, cleanNumericAmount(t1NonBusinessInr)));
    const T2 = roundToPaisa(Math.max(0, cleanNumericAmount(t2ExemptInr)));
    const T3 = roundToPaisa(Math.max(0, cleanNumericAmount(t3BlockedInr)));
    const T4 = roundToPaisa(Math.max(0, cleanNumericAmount(t4TaxableInr)));
    const E = Math.max(0, cleanNumericAmount(exemptTurnoverInr));
    const F = Math.max(0, cleanNumericAmount(totalTurnoverInr));

    const directIneligible = roundToPaisa(T1 + T2 + T3);
    if (directIneligible > T) {
        throw new Error(`[@mudraforge/statutory] Sum of direct ineligible credits (T1 + T2 + T3 = ₹${directIneligible}) cannot exceed total ITC (T = ₹${T}).`);
    }

    // Step 2: C1 - Amount credited to Electronic Credit Ledger
    const C1 = roundToPaisa(T - directIneligible);

    // Step 3: T4 check
    if (T4 > C1) {
        throw new Error(`[@mudraforge/statutory] Exclusive taxable credit T4 (₹${T4}) cannot exceed available credit C1 (₹${C1}).`);
    }

    // Step 4: C2 - Common Input Credit
    const C2 = roundToPaisa(C1 - T4);

    // Step 5: Turnover Apportionment (E / F)
    let exemptRatio = 0;
    let turnoverBasis = 'CURRENT_TAX_PERIOD';

    if (C2 > 0) {
        if (F > 0) {
            exemptRatio = Math.min(1.0, E / F);
        } else if (E === 0 && F === 0) {
            const precE = Math.max(0, cleanNumericAmount(precedingExemptTurnoverInr));
            const precF = Math.max(0, cleanNumericAmount(precedingTotalTurnoverInr));
            if (precF > 0) {
                exemptRatio = Math.min(1.0, precE / precF);
                turnoverBasis = 'PRECEDING_TAX_PERIOD_PROVISO';
            } else {
                exemptRatio = 0;
                turnoverBasis = 'ZERO_TURNOVER_NO_REVERSAL';
            }
        } else {
            // E > 0 but F <= 0 (defensive full exempt cap)
            exemptRatio = 1.0;
            turnoverBasis = 'DEFENSIVE_FULL_EXEMPT_CAP';
        }
    }

    const D1 = C2 > 0 ? roundToPaisa(C2 * exemptRatio) : 0;
    const D2 = (C2 > 0 && hasNonBusinessUse) ? roundToPaisa(C2 * 0.05) : 0;
    const rule42Reversal = roundToPaisa(D1 + D2);
    const C3 = roundToPaisa(Math.max(0, C2 - rule42Reversal));
    const netEligibleInputsItc = roundToPaisa(T4 + C3);

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'RULE_42_APPORTIONMENT_CALCULATED',
        governingRules: 'Central Goods and Services Tax Rules, 2017: Rule 42 (Inputs and Input Services)',
        taxPeriod,
        totalItcT: T,
        directIneligibleCredits: {
            exclusiveNonBusinessT1: T1,
            exclusiveExemptT2: T2,
            blockedSection17_5_T3: T3,
            sumIneligible: directIneligible
        },
        creditedToElectronicCreditLedgerC1: C1,
        exclusiveTaxableT4: T4,
        commonCreditC2: C2,
        exemptTurnoverE: E,
        totalTurnoverF: F,
        turnoverRatioE_F: Number(exemptRatio.toFixed(6)),
        turnoverBasis,
        reversals: {
            ineligibleExemptCommonD1: D1,
            nonBusinessCommonD2: D2,
            totalRule42Reversal: rule42Reversal
        },
        eligibleCommonCreditC3: C3,
        netEligibleInputsItc,
        gstr3bReporting: {
            table4A5GrossIngestion: T,
            table4B1PermanentReversal: roundToPaisa(directIneligible + rule42Reversal),
            table4B1Rule42OnlyReversal: rule42Reversal,
            table4CNetItcAvailable: netEligibleInputsItc
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: `Rule 42 credited ₹${C1.toLocaleString('en-IN')} to ledger (after deducting ₹${directIneligible.toLocaleString('en-IN')} direct ineligible). Identified ₹${C2.toLocaleString('en-IN')} common credit, requiring ₹${rule42Reversal.toLocaleString('en-IN')} reversal (D1 exempt: ₹${D1}, D2 non-business: ₹${D2}). Net eligible credit: ₹${netEligibleInputsItc.toLocaleString('en-IN')}. Permanent reversal must be reported in GSTR-3B Table 4(B)(1).`
    };
}

/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function reconcileRule42AnnualTrueUp({
    financialYear = '2024-25',
    annualCommonCreditC2Inr,
    annualExemptTurnoverInr = 0,
    annualTotalTurnoverInr = 0,
    cumulativeMonthlyReversalsInr,
    trueUpExecutionDate = null,
    hasNonBusinessUse = true,
    annualInterestRatePercent = 18.0,
    isRealEstateProject = false
} = {}) {
    if (annualCommonCreditC2Inr === undefined || annualCommonCreditC2Inr === null) {
        throw new Error('[@mudraforge/statutory] reconcileRule42AnnualTrueUp: annualCommonCreditC2Inr is required.');
    }
    if (cumulativeMonthlyReversalsInr === undefined || cumulativeMonthlyReversalsInr === null) {
        throw new Error('[@mudraforge/statutory] reconcileRule42AnnualTrueUp: cumulativeMonthlyReversalsInr is required.');
    }

    const C2 = roundToPaisa(Math.max(0, cleanNumericAmount(annualCommonCreditC2Inr)));
    const priorReversals = roundToPaisa(Math.max(0, cleanNumericAmount(cumulativeMonthlyReversalsInr)));
    const annualE = Math.max(0, cleanNumericAmount(annualExemptTurnoverInr));
    const annualF = Math.max(0, cleanNumericAmount(annualTotalTurnoverInr));

    // Derive succeeding FY start date & statutory cutoff (30th November)
    let endYear = 2025;
    const fyMatch = String(financialYear).match(/^(\d{4})-(\d{2,4})$/);
    if (fyMatch) {
        const y1 = parseInt(fyMatch[1], 10);
        endYear = y1 + 1;
    }
    const succeedingFyStartDate = `${endYear}-04-01`;
    const statutoryCutoffDate = `${endYear}-11-30`;

    const execDateIso = trueUpExecutionDate ? String(trueUpExecutionDate).slice(0, 10) : statutoryCutoffDate;
    const isFiledBeforeCutoff = execDateIso <= statutoryCutoffDate;

    const annualRatio = annualF > 0 ? Math.min(1.0, annualE / annualF) : 0;
    const finalAnnualD1 = roundToPaisa(C2 * annualRatio);
    const finalAnnualD2 = hasNonBusinessUse ? roundToPaisa(C2 * 0.05) : 0;
    const finalAnnualReversalTotal = roundToPaisa(finalAnnualD1 + finalAnnualD2);

    const differential = roundToPaisa(finalAnnualReversalTotal - priorReversals);

    let reconciliationOutcome = 'BALANCED_ZERO_VARIANCE';
    let shortfallAmountInr = 0;
    let excessReversedInr = 0;
    let interestPayableInr = 0;
    let daysElapsed = 0;
    let statutoryAction = 'Annual true-up precisely matches cumulative monthly reversals. No adjustment required.';

    if (differential > 0) {
        reconciliationOutcome = 'SHORT_REVERSAL_PAYMENT_DUE';
        shortfallAmountInr = differential;
        
        // Interest under Section 50(1) from 1st April of succeeding FY
        const dStart = new Date(succeedingFyStartDate + 'T00:00:00.000Z').getTime();
        const dExec = new Date(execDateIso + 'T00:00:00.000Z').getTime();
        daysElapsed = Math.max(0, Math.floor((dExec - dStart) / (1000 * 60 * 60 * 24)));
        const rateFrac = (Number(annualInterestRatePercent) || 18.0) / 100;
        interestPayableInr = roundToPaisa(shortfallAmountInr * rateFrac * (daysElapsed / 365));

        statutoryAction = `Shortfall of ₹${shortfallAmountInr.toLocaleString('en-IN')} must be added to output tax liability / reversed in GSTR-3B Table 4(B)(1) on or before ${statutoryCutoffDate} along with ₹${interestPayableInr.toLocaleString('en-IN')} interest under Section 50(1) (${daysElapsed} days @ ${annualInterestRatePercent}% p.a.).`;
    } else if (differential < 0) {
        reconciliationOutcome = 'EXCESS_REVERSAL_RECLAIM_PERMITTED';
        excessReversedInr = roundToPaisa(Math.abs(differential));
        statutoryAction = `Excess reversal of ₹${excessReversedInr.toLocaleString('en-IN')} may be reclaimed as eligible ITC in Form GSTR-3B Table 4(A)(5) and reported in Table 4(D)(1) on or before ${statutoryCutoffDate}.`;
    }

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'ANNUAL_TRUE_UP_RECONCILED',
        governingRules: 'Central Goods and Services Tax Rules, 2017: Rule 42(2) & Finance Act, 2022',
        financialYear,
        statutoryCutoffDate,
        succeedingFyStartDate,
        trueUpExecutionDate: execDateIso,
        isFiledBeforeCutoff,
        annualCommonCreditC2Inr: C2,
        annualExemptTurnoverInr: annualE,
        annualTotalTurnoverInr: annualF,
        annualExemptRatio: Number(annualRatio.toFixed(6)),
        finalAnnualReversals: {
            finalAnnualD1ExemptInr: finalAnnualD1,
            finalAnnualD2NonBusinessInr: finalAnnualD2,
            finalAnnualRequiredTotalInr: finalAnnualReversalTotal
        },
        cumulativeMonthlyReversalsMadeInr: priorReversals,
        differentialAdjustmentInr: differential,
        reconciliationOutcome,
        shortfallAmountInr,
        excessReversedInr,
        interestAssessment: {
            interestRatePercent: annualInterestRatePercent,
            interestCommencementDate: succeedingFyStartDate,
            interestEndDate: execDateIso,
            daysElapsed,
            interestPayableInr
        },
        isRealEstateProject: !!isRealEstateProject,
        statutoryAction,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Annual common credit ₹${C2.toLocaleString('en-IN')} with annual exempt ratio ${annualRatio.toFixed(4)} requires aggregate annual reversal of ₹${finalAnnualReversalTotal.toLocaleString('en-IN')}. Cumulative monthly reversals made: ₹${priorReversals.toLocaleString('en-IN')}. Outcome: ${reconciliationOutcome} (${differential > 0 ? `Shortfall ₹${shortfallAmountInr} + Sec 50(1) Interest ₹${interestPayableInr}` : (differential < 0 ? `Reclaimable ₹${excessReversedInr}` : 'Zero Variance')}).`
    };
}

/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateRule43CapitalGoodsReversal({
    taxPeriod = 'CURRENT_PERIOD',
    taxPeriodDate = new Date().toISOString().slice(0, 10),
    exemptTurnoverInr = 0,
    totalTurnoverInr = 0,
    capitalGoodsList = [],
    precedingExemptTurnoverInr = 0,
    precedingTotalTurnoverInr = 0
} = {}) {
    if (!Array.isArray(capitalGoodsList)) {
        throw new Error('[@mudraforge/statutory] calculateRule43CapitalGoodsReversal: capitalGoodsList must be an array.');
    }

    const E = Math.max(0, cleanNumericAmount(exemptTurnoverInr));
    const F = Math.max(0, cleanNumericAmount(totalTurnoverInr));

    let exemptRatio = 0;
    let turnoverBasis = 'CURRENT_TAX_PERIOD';

    if (F > 0) {
        exemptRatio = Math.min(1.0, E / F);
    } else if (E === 0 && F === 0) {
        const precE = Math.max(0, cleanNumericAmount(precedingExemptTurnoverInr));
        const precF = Math.max(0, cleanNumericAmount(precedingTotalTurnoverInr));
        if (precF > 0) {
            exemptRatio = Math.min(1.0, precE / precF);
            turnoverBasis = 'PRECEDING_TAX_PERIOD_PROVISO';
        } else {
            exemptRatio = 0;
            turnoverBasis = 'ZERO_TURNOVER_NO_REVERSAL';
        }
    } else {
        exemptRatio = 1.0;
        turnoverBasis = 'DEFENSIVE_FULL_EXEMPT_CAP';
    }

    const DEEMED_USEFUL_LIFE_MONTHS = 60;
    const calcDate = new Date(String(taxPeriodDate).slice(0, 10) + 'T00:00:00.000Z');

    let totalCommonTc = 0;
    let totalMonthlySliceTr = 0;
    const assetSchedules = [];

    for (const asset of capitalGoodsList) {
        const assetId = asset.assetId || 'ASSET-UNKNOWN';
        const description = asset.description || 'Capital Good';
        const rawItc = roundToPaisa(Math.max(0, cleanNumericAmount(asset.itcAmountInr || asset.taxAmount)));
        const category = String(asset.category || asset.useCategory || 'COMMON').toUpperCase();
        const invoiceDateIso = asset.invoiceDate ? String(asset.invoiceDate).slice(0, 10) : taxPeriodDate;

        if (category === 'EXEMPT_ONLY') {
            assetSchedules.push({
                assetId,
                description,
                category,
                invoiceDate: invoiceDateIso,
                originalItcInr: rawItc,
                effectiveCommonCreditInr: 0,
                monthlyCreditTmInr: 0,
                monthlyReversalTeInr: 0,
                status: 'EXEMPT_EXCLUDED_FROM_LEDGER',
                statutoryNote: 'Under Rule 43(1)(a), capital goods used exclusively for exempt supplies are not credited to Electronic Credit Ledger.'
            });
            continue;
        }

        if (category === 'TAXABLE_ONLY') {
            assetSchedules.push({
                assetId,
                description,
                category,
                invoiceDate: invoiceDateIso,
                originalItcInr: rawItc,
                effectiveCommonCreditInr: 0,
                monthlyCreditTmInr: 0,
                monthlyReversalTeInr: 0,
                status: 'TAXABLE_FULL_CREDIT_NO_REVERSAL',
                statutoryNote: 'Under Rule 43(1)(b), capital goods used exclusively for taxable supplies are credited in full with zero monthly reversal.'
            });
            continue;
        }

        // Category is COMMON (or converted to COMMON)
        let effectiveItc = rawItc;
        let quartersElapsed = 0;
        let reductionPercent = 0;

        if (asset.priorCategory === 'EXEMPT_ONLY' && asset.conversionDate) {
            const convDateIso = String(asset.conversionDate).slice(0, 10);
            const dInv = new Date(invoiceDateIso + 'T00:00:00.000Z').getTime();
            const dConv = new Date(convDateIso + 'T00:00:00.000Z').getTime();
            const daysConv = Math.max(0, Math.floor((dConv - dInv) / (1000 * 60 * 60 * 24)));
            quartersElapsed = daysConv > 0 ? Math.ceil(daysConv / 91.25) : 0;
            reductionPercent = Math.min(100, quartersElapsed * 5);
            effectiveItc = roundToPaisa(rawItc * (1 - reductionPercent / 100));
        }

        // Calculate months elapsed from invoice date to calculation date
        const dInv = new Date(invoiceDateIso + 'T00:00:00.000Z');
        const monthsElapsed = (calcDate.getFullYear() - dInv.getFullYear()) * 12 + (calcDate.getMonth() - dInv.getMonth());

        let monthlyCreditTm = 0;
        let monthlyReversalTe = 0;
        let status = 'ACTIVE_IN_COMMON_POOL';

        if (monthsElapsed >= 0 && monthsElapsed < DEEMED_USEFUL_LIFE_MONTHS) {
            monthlyCreditTm = roundToPaisa(effectiveItc / DEEMED_USEFUL_LIFE_MONTHS);
            monthlyReversalTe = roundToPaisa(monthlyCreditTm * exemptRatio);
            totalCommonTc = roundToPaisa(totalCommonTc + effectiveItc);
            totalMonthlySliceTr = roundToPaisa(totalMonthlySliceTr + monthlyCreditTm);
        } else if (monthsElapsed >= DEEMED_USEFUL_LIFE_MONTHS) {
            status = 'EXPIRED_USEFUL_LIFE_60_MONTHS';
        } else {
            status = 'PRE_ACQUISITION_PERIOD';
        }

        assetSchedules.push({
            assetId,
            description,
            category: 'COMMON',
            invoiceDate: invoiceDateIso,
            originalItcInr: rawItc,
            effectiveCommonCreditInr: effectiveItc,
            reductionFactorAppliedPercent: reductionPercent,
            monthsElapsed,
            remainingUsefulLifeMonths: Math.max(0, DEEMED_USEFUL_LIFE_MONTHS - Math.max(0, monthsElapsed)),
            monthlyCreditTmInr: monthlyCreditTm,
            monthlyReversalTeInr: monthlyReversalTe,
            status,
            statutoryNote: status === 'ACTIVE_IN_COMMON_POOL'
                ? `Active in common pool (Month ${monthsElapsed + 1}/60). Tm = ₹${monthlyCreditTm}, Te reversal = ₹${monthlyReversalTe}.`
                : (status === 'EXPIRED_USEFUL_LIFE_60_MONTHS' ? 'Deemed useful life of 60 months has expired. No further reversal required.' : 'Asset acquired after tax period.')
        });
    }

    const totalPeriodReversalTe = roundToPaisa(totalMonthlySliceTr * exemptRatio);
    const netEligibleMonthlyCapitalItc = roundToPaisa(Math.max(0, totalMonthlySliceTr - totalPeriodReversalTe));

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'RULE_43_CAPITAL_GOODS_APPORTIONED',
        governingRules: 'Central Goods and Services Tax Rules, 2017: Rule 43 (Capital Goods)',
        taxPeriod,
        taxPeriodDate: String(taxPeriodDate).slice(0, 10),
        exemptTurnoverE: E,
        totalTurnoverF: F,
        turnoverRatioE_F: Number(exemptRatio.toFixed(6)),
        turnoverBasis,
        deemedUsefulLifeMonths: DEEMED_USEFUL_LIFE_MONTHS,
        summary: {
            totalAssetsAssessed: capitalGoodsList.length,
            activeCommonAssetsCount: assetSchedules.filter(a => a.status === 'ACTIVE_IN_COMMON_POOL').length,
            totalCommonCreditTcInr: totalCommonTc,
            monthlyCommonCreditSliceTrInr: totalMonthlySliceTr,
            monthlyReversalTeInr: totalPeriodReversalTe,
            netEligibleMonthlyCapitalItcInr: netEligibleMonthlyCapitalItc
        },
        gstr3bReporting: {
            reportingTable: 'Table 4(B)(1) (Permanent Reversals)',
            monthlyReversalAmountInr: totalPeriodReversalTe
        },
        assetSchedules,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Assessed ${capitalGoodsList.length} capital goods. Common pool ITC (Tc): ₹${totalCommonTc.toLocaleString('en-IN')}, monthly slice (Tr): ₹${totalMonthlySliceTr.toLocaleString('en-IN')}. Monthly exempt reversal (Te = Tr * E/F): ₹${totalPeriodReversalTe.toLocaleString('en-IN')}. Reversal must be added to output tax liability / reported in Table 4(B)(1).`
    };
}

export function calculateGstItcApportionmentRule42_43({
    taxPeriod = null,
    financialYear = '2025-26',
    // Rule 42 Inputs (Inputs & Input Services):
    totalInputTaxCreditT,
    exclusiveNonBusinessT1 = 0,
    exclusiveExemptT2 = 0,
    blockedSection17_5_T3 = 0,
    exclusiveTaxableT4 = 0,
    exemptTurnoverE = 0,
    totalTurnoverF = 0,
    hasNonBusinessUse = true,
    // Rule 43 Inputs (Capital Goods):
    capitalGoodsCommonCreditA = 0,
    capitalGoodsPriorQuartersExempt = 0,
    capitalGoodsList = null,
    // Annual True-Up Reconciliation parameters:
    isAnnualTrueUp = false,
    annualExemptTurnover = null,
    annualTotalTurnover = null,
    sumOfMonthlyReversalsD1 = 0,
    isRealEstateProject = false,
    trueUpExecutionDate = null
} = {}) {
    if (totalInputTaxCreditT === undefined || totalInputTaxCreditT === null) {
        return {
            status: 'INDETERMINATE',
            code: 'MISSING_TOTAL_ITC',
            statutoryDetermination: 'INDETERMINATE',
            message: 'Field "totalInputTaxCreditT" is required for GST Rule 42/43 apportionment.',
            netEligibleItc: null,
            totalReversal: null,
            isAuthorizedToDisburse: false
        };
    }

    // Step 1: Rule 42 Inputs & Input Services Evaluation
    const rule42Result = calculateRule42InputServiceReversal({
        taxPeriod: taxPeriod || 'CURRENT_MONTH',
        totalItcInr: totalInputTaxCreditT,
        t1NonBusinessInr: exclusiveNonBusinessT1,
        t2ExemptInr: exclusiveExemptT2,
        t3BlockedInr: blockedSection17_5_T3,
        t4TaxableInr: exclusiveTaxableT4,
        exemptTurnoverInr: exemptTurnoverE,
        totalTurnoverInr: totalTurnoverF,
        hasNonBusinessUse
    });

    // Step 2: Rule 43 Capital Goods Evaluation
    let capitalGoodsBreakdown = null;
    let capitalGoodsReversalTe = 0;
    let monthlyCapitalGoodsCreditTm = 0;
    const DEEMED_USEFUL_LIFE_MONTHS = 60;

    if (Array.isArray(capitalGoodsList) && capitalGoodsList.length > 0) {
        const rule43Result = calculateRule43CapitalGoodsReversal({
            taxPeriod: taxPeriod || 'CURRENT_MONTH',
            exemptTurnoverInr: exemptTurnoverE,
            totalTurnoverInr: totalTurnoverF,
            capitalGoodsList
        });
        capitalGoodsReversalTe = rule43Result.summary.monthlyReversalTeInr;
        monthlyCapitalGoodsCreditTm = rule43Result.summary.monthlyCommonCreditSliceTrInr;
        capitalGoodsBreakdown = {
            capitalGoodsCommonCreditA: rule43Result.summary.totalCommonCreditTcInr,
            deemedUsefulLifeMonths: DEEMED_USEFUL_LIFE_MONTHS,
            priorQuartersExempt: 0,
            reductionFactorAppliedPercent: 0,
            effectiveCommonCredit: rule43Result.summary.totalCommonCreditTcInr,
            monthlyCreditTm: monthlyCapitalGoodsCreditTm,
            monthlyReversalTe: capitalGoodsReversalTe,
            eligibleCapitalGoodsCreditMonthly: rule43Result.summary.netEligibleMonthlyCapitalItcInr,
            assetSchedules: rule43Result.assetSchedules
        };
    } else {
        const rawA = Math.max(0, Number(capitalGoodsCommonCreditA || 0));
        const priorQ = Math.max(0, Number(capitalGoodsPriorQuartersExempt || 0));
        const reductionFactor = Math.min(1.0, priorQ * 0.05);
        const effectiveA = roundToPaisa(rawA * (1 - reductionFactor));
        monthlyCapitalGoodsCreditTm = rawA > 0 ? roundToPaisa(effectiveA / DEEMED_USEFUL_LIFE_MONTHS) : 0;
        capitalGoodsReversalTe = monthlyCapitalGoodsCreditTm > 0 && Number(totalTurnoverF) > 0
            ? roundToPaisa(monthlyCapitalGoodsCreditTm * rule42Result.turnoverRatioE_F)
            : 0;

        capitalGoodsBreakdown = {
            capitalGoodsCommonCreditA: rawA,
            deemedUsefulLifeMonths: DEEMED_USEFUL_LIFE_MONTHS,
            priorQuartersExempt: priorQ,
            reductionFactorAppliedPercent: reductionFactor * 100,
            effectiveCommonCredit: effectiveA,
            monthlyCreditTm: monthlyCapitalGoodsCreditTm,
            monthlyReversalTe: capitalGoodsReversalTe,
            eligibleCapitalGoodsCreditMonthly: Math.max(0, monthlyCapitalGoodsCreditTm - capitalGoodsReversalTe)
        };
    }

    const totalPeriodReversal = roundToPaisa(rule42Result.reversals.totalRule42Reversal + capitalGoodsReversalTe);
    const totalNetEligibleItc = roundToPaisa(rule42Result.netEligibleInputsItc + Math.max(0, monthlyCapitalGoodsCreditTm - capitalGoodsReversalTe));

    // Step 3: Annual True-Up Reconciliation (Rule 42(2) & 43(2))
    let annualTrueUpDetails = null;
    if (isAnnualTrueUp && annualTotalTurnover !== null && annualExemptTurnover !== null) {
        const trueUpResult = reconcileRule42AnnualTrueUp({
            financialYear,
            annualCommonCreditC2Inr: rule42Result.commonCreditC2,
            annualExemptTurnoverInr: annualExemptTurnover,
            annualTotalTurnoverInr: annualTotalTurnover,
            cumulativeMonthlyReversalsInr: sumOfMonthlyReversalsD1,
            trueUpExecutionDate,
            hasNonBusinessUse,
            isRealEstateProject
        });

        annualTrueUpDetails = {
            isAnnualTrueUp: true,
            financialYear,
            annualExemptTurnover: trueUpResult.annualExemptTurnoverInr,
            annualTotalTurnover: trueUpResult.annualTotalTurnoverInr,
            annualExemptRatio: trueUpResult.annualExemptRatio,
            finalAnnualD1Inr: trueUpResult.finalAnnualReversals.finalAnnualD1ExemptInr,
            sumOfMonthlyD1ReversalsClaimedInr: trueUpResult.cumulativeMonthlyReversalsMadeInr,
            differentialAdjustmentInr: trueUpResult.differentialAdjustmentInr,
            adjustmentAction: trueUpResult.reconciliationOutcome === 'SHORT_REVERSAL_PAYMENT_DUE'
                ? 'ADD_TO_OUTPUT_LIABILITY_WITH_SECTION_50_INTEREST'
                : (trueUpResult.reconciliationOutcome === 'EXCESS_REVERSAL_RECLAIM_PERMITTED' ? 'RECLAIM_AS_ELIGIBLE_ITC' : 'ZERO_DIFFERENTIAL_MATCHED'),
            reconciliationOutcome: trueUpResult.reconciliationOutcome,
            shortfallAmountInr: trueUpResult.shortfallAmountInr,
            excessReversedInr: trueUpResult.excessReversedInr,
            interestAssessment: trueUpResult.interestAssessment,
            statutoryAction: trueUpResult.statutoryAction,
            statutoryFilingDeadlineNotice: isRealEstateProject
                ? 'Real estate project true-up governed by Annexure I/II of Notification 16/2019-CT.'
                : 'Annual adjustment due on or before filing return for month of September following FY end (or 30th November cutoff).'
        };
    }

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'APPLICABLE',
        governingRules: 'CGST Rules 2017: Rule 42 (Inputs & Services) & Rule 43 (Capital Goods)',
        taxPeriod: taxPeriod || 'CURRENT_MONTH',
        financialYear,
        rule42InputsBreakdown: {
            totalItcT: rule42Result.totalItcT,
            directIneligible: {
                exclusiveNonBusinessT1: rule42Result.directIneligibleCredits.exclusiveNonBusinessT1,
                exclusiveExemptT2: rule42Result.directIneligibleCredits.exclusiveExemptT2,
                blockedSection17_5_T3: rule42Result.directIneligibleCredits.blockedSection17_5_T3,
                sumIneligible: rule42Result.directIneligibleCredits.sumIneligible
            },
            creditedToElectronicLedgerC1: rule42Result.creditedToElectronicCreditLedgerC1,
            exclusiveTaxableT4: rule42Result.exclusiveTaxableT4,
            commonCreditC2: rule42Result.commonCreditC2,
            exemptTurnoverE: rule42Result.exemptTurnoverE,
            totalTurnoverF: rule42Result.totalTurnoverF,
            exemptRatio: rule42Result.turnoverRatioE_F,
            turnoverBasis: rule42Result.turnoverBasis,
            reversals: {
                ineligibleExemptCommonD1: rule42Result.reversals.ineligibleExemptCommonD1,
                nonBusinessCommonD2: rule42Result.reversals.nonBusinessCommonD2,
                totalRule42Reversal: rule42Result.reversals.totalRule42Reversal
            },
            eligibleCommonCreditC3: rule42Result.eligibleCommonCreditC3,
            netEligibleInputsItc: rule42Result.netEligibleInputsItc
        },
        rule43CapitalGoodsBreakdown: capitalGoodsBreakdown,
        summary: {
            totalGrossItcT: rule42Result.totalItcT,
            totalDirectIneligible: rule42Result.directIneligibleCredits.sumIneligible,
            totalCommonCreditApportioned: rule42Result.commonCreditC2,
            totalMonthlyReversalAddedToOutputLiability: totalPeriodReversal,
            netEligibleItcTotal: totalNetEligibleItc
        },
        annualTrueUp: annualTrueUpDetails,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Rule 42 credited ₹${rule42Result.creditedToElectronicCreditLedgerC1.toLocaleString('en-IN')} to ledger, identified ₹${rule42Result.commonCreditC2.toLocaleString('en-IN')} common credit, and calculated ₹${rule42Result.reversals.totalRule42Reversal.toLocaleString('en-IN')} reversal (D1: ₹${rule42Result.reversals.ineligibleExemptCommonD1}, D2: ₹${rule42Result.reversals.nonBusinessCommonD2}). Rule 43 capital goods reversal: ₹${capitalGoodsReversalTe.toLocaleString('en-IN')}. Net eligible ITC: ₹${totalNetEligibleItc.toLocaleString('en-IN')}. Reversal must be added to GSTR-3B Table 4(B).`
    };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GST RULE 37: 180-DAY VENDOR NON-PAYMENT ITC REVERSAL & INTEREST CALCULATOR
 * ─────────────────────────────────────────────────────────────────────────────
 * CGST Act, 2017: Section 16(2) second proviso read with Rule 37
 * Amended by Notification No. 19/2022-Central Tax w.e.f. 01.10.2022.
 *
 * Implements authoritative 180-day aging, proportional unpaid ITC computation,
 * Section 50(1) 18% annual interest, RCM/Schedule I exemptions, and GSTR-3B Table 4(B)(2) mapping.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateItcReversalRule37({
    invoiceNumber = 'INV-UNKNOWN',
    invoiceDate,
    calculationDate = new Date().toISOString().slice(0, 10),
    invoiceAmount, // Total invoice value (taxable + tax)
    taxAmount,    // Total ITC availed
    paidAmount = 0, // Amount paid to supplier towards invoice value + tax
    itcAvailmentDate = null,
    isRcm = false, // Supplies under Section 9(3)/9(4) RCM are exempt
    isScheduleISupply = false, // Deemed supplies without consideration under Schedule I are exempt
    annualInterestRatePercent = 18.0
} = {}) {
    const totalInvoice = cleanNumericAmount(invoiceAmount);
    const totalItc = cleanNumericAmount(taxAmount);
    const totalPaid = Math.max(0, cleanNumericAmount(paidAmount));
    const unpaidAmount = roundToPaisa(Math.max(0, totalInvoice - totalPaid));

    if (!invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(invoiceDate).slice(0, 10))) {
        throw new Error('[@mudraforge/statutory] calculateItcReversalRule37: invoiceDate must be a valid ISO YYYY-MM-DD date.');
    }

    const calcDateIso = String(calculationDate).slice(0, 10);
    const invDateIso = String(invoiceDate).slice(0, 10);
    const availDateIso = itcAvailmentDate ? String(itcAvailmentDate).slice(0, 10) : invDateIso;

    const invTime = new Date(invDateIso).getTime();
    const calcTime = new Date(calcDateIso).getTime();
    const daysElapsed = Math.max(0, Math.floor((calcTime - invTime) / (1000 * 60 * 60 * 24)));

    // Statutory 180-day grace period under Section 16(2) second proviso
    const GRACE_PERIOD_DAYS = 180;
    const isOverdue = daysElapsed > GRACE_PERIOD_DAYS;
    const daysOverdueBeyond180 = isOverdue ? daysElapsed - GRACE_PERIOD_DAYS : 0;

    // Exemptions under Section 16(2) provisos & Rule 37(1) provisos
    if (isRcm) {
        return {
            invoiceNumber,
            invoiceDate: invDateIso,
            calculationDate: calcDateIso,
            invoiceAmount: totalInvoice,
            taxAmount: totalItc,
            paidAmount: totalPaid,
            unpaidAmount,
            daysElapsed,
            isOverdue: false,
            isExempt: true,
            exemptionReason: 'RCM_SUPPLY_SECTION_9_3_9_4',
            reversalAmountInr: 0,
            interestPayableInr: 0,
            gstr3bReportingTable: null,
            canReclaimOnPayment: false,
            statutoryDisposition: 'EXEMPT_FROM_180_DAY_REVERSAL_RCM',
            statutoryRationale: 'Supplies subject to reverse charge mechanism under Section 9(3) or 9(4) are expressly excluded from the second proviso to Section 16(2).',
            isAuthorizedToDisburse: false
        };
    }

    if (isScheduleISupply) {
        return {
            invoiceNumber,
            invoiceDate: invDateIso,
            calculationDate: calcDateIso,
            invoiceAmount: totalInvoice,
            taxAmount: totalItc,
            paidAmount: totalPaid,
            unpaidAmount,
            daysElapsed,
            isOverdue: false,
            isExempt: true,
            exemptionReason: 'SCHEDULE_I_SUPPLY_WITHOUT_CONSIDERATION',
            reversalAmountInr: 0,
            interestPayableInr: 0,
            gstr3bReportingTable: null,
            canReclaimOnPayment: false,
            statutoryDisposition: 'EXEMPT_FROM_180_DAY_REVERSAL_SCHEDULE_I',
            statutoryRationale: 'Deemed supplies without consideration under Schedule I of the CGST Act are deemed paid under first proviso to Rule 37(1).',
            isAuthorizedToDisburse: false
        };
    }

    if (!isOverdue) {
        return {
            invoiceNumber,
            invoiceDate: invDateIso,
            calculationDate: calcDateIso,
            invoiceAmount: totalInvoice,
            taxAmount: totalItc,
            paidAmount: totalPaid,
            unpaidAmount,
            daysElapsed,
            daysRemainingInGracePeriod: GRACE_PERIOD_DAYS - daysElapsed,
            isOverdue: false,
            isExempt: false,
            reversalAmountInr: 0,
            interestPayableInr: 0,
            gstr3bReportingTable: null,
            canReclaimOnPayment: false,
            statutoryDisposition: 'WITHIN_180_DAYS_GRACE_PERIOD',
            statutoryRationale: `Invoice age is ${daysElapsed} days, which is within the statutory 180-day grace period under Section 16(2).`,
            isAuthorizedToDisburse: false
        };
    }

    // Days elapsed > 180 days: Evaluate unpaid portion
    if (unpaidAmount === 0) {
        return {
            invoiceNumber,
            invoiceDate: invDateIso,
            calculationDate: calcDateIso,
            invoiceAmount: totalInvoice,
            taxAmount: totalItc,
            paidAmount: totalPaid,
            unpaidAmount: 0,
            daysElapsed,
            isOverdue: false,
            isExempt: false,
            reversalAmountInr: 0,
            interestPayableInr: 0,
            gstr3bReportingTable: null,
            canReclaimOnPayment: false,
            statutoryDisposition: 'FULLY_PAID_NO_REVERSAL',
            statutoryRationale: 'Supplier has been fully paid within or prior to evaluation. Zero ITC reversal required.',
            isAuthorizedToDisburse: false
        };
    }

    // Proportionate Reversal: ITC to reverse = (Unpaid Amount / Total Invoice Value) * Total ITC availed
    const proportionUnpaid = totalInvoice > 0 ? (unpaidAmount / totalInvoice) : 1;
    const reversalAmountInr = roundToPaisa(totalItc * proportionUnpaid);

    // Interest calculation under Section 50(1) at 18% per annum
    // Under substituted Rule 37(1) w.e.f. 01.10.2022: interest runs from date of availing ITC till date of reversal
    const availTime = new Date(availDateIso).getTime();
    const interestDays = Math.max(0, Math.floor((calcTime - availTime) / (1000 * 60 * 60 * 24)));
    const annualRate = Number(annualInterestRatePercent) / 100;
    const interestPayableInr = roundToPaisa(reversalAmountInr * annualRate * (interestDays / 365));

    return {
        invoiceNumber,
        invoiceDate: invDateIso,
        calculationDate: calcDateIso,
        itcAvailmentDate: availDateIso,
        invoiceAmount: totalInvoice,
        taxAmount: totalItc,
        paidAmount: totalPaid,
        unpaidAmount,
        daysElapsed,
        daysOverdueBeyond180,
        isOverdue: true,
        isExempt: false,
        reversalAmountInr,
        interestDays,
        annualInterestRatePercent,
        interestPayableInr,
        gstr3bReportingTable: 'TABLE_4_B_2_OTHERS_RECLAIMABLE',
        reAvailmentTable: 'TABLE_4_A_5_AND_4_D_1',
        canReclaimOnPayment: true,
        statutoryDisposition: 'ITC_REVERSAL_MANDATORY_RULE_37',
        statutoryRationale: `Payment of ₹${unpaidAmount.toLocaleString('en-IN')} outstanding beyond 180 days (${daysElapsed} days elapsed). Proportional ITC of ₹${reversalAmountInr.toLocaleString('en-IN')} must be reversed in Form GSTR-3B Table 4(B)(2) along with ₹${interestPayableInr.toLocaleString('en-IN')} interest under Section 50(1). Reclaimable upon payment.`,
        isAuthorizedToDisburse: false
    };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GST RULE 37A: SUPPLIER GSTR-3B NON-FILING REVERSAL CALCULATOR
 * ─────────────────────────────────────────────────────────────────────────────
 * CGST Rules, 2017: Rule 37A (Inserted by Notification No. 26/2022-CT w.e.f. 26.12.2022)
 *
 * Where supplier reported invoice in GSTR-1/IFF but failed to file GSTR-3B by
 * 30th November following the end of the FY in which ITC was availed:
 * - Recipient must reverse ITC in GSTR-3B on or before 30th November.
 * - If delayed past 30th November: 18% annual interest applies u/s 50(1).
 * - Interest-free re-availment permitted once supplier subsequently furnishes GSTR-3B.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateRule37ASupplierNonFilingReversal({
    financialYear, // e.g. '2024-25'
    invoiceNumber = 'INV-UNKNOWN',
    invoiceDate,
    itcAmount,
    supplierGstr1Filed = true,
    supplierGstr3bFiled = false,
    calculationDate = new Date().toISOString().slice(0, 10),
    annualInterestRatePercent = 18.0
} = {}) {
    const rawItc = cleanNumericAmount(itcAmount);
    const calcDateIso = String(calculationDate).slice(0, 10);

    // Compute November 30 cutoff date for the given financial year
    let cutoffYear = null;
    if (financialYear && typeof financialYear === 'string') {
        const parts = financialYear.split('-');
        if (parts.length === 2 && parts[0].length === 4) {
            cutoffYear = parseInt(parts[0], 10) + 1;
        }
    } else if (invoiceDate) {
        const d = new Date(invoiceDate);
        const invYear = d.getFullYear();
        const invMonth = d.getMonth() + 1;
        cutoffYear = invMonth >= 4 ? invYear + 1 : invYear;
    } else {
        cutoffYear = new Date().getFullYear();
    }

    const cutoffDate = `${cutoffYear}-11-30`;
    const isPastCutoff = calcDateIso > cutoffDate;

    if (supplierGstr3bFiled) {
        return {
            invoiceNumber,
            financialYear,
            cutoffDate,
            calculationDate: calcDateIso,
            itcAmount: rawItc,
            supplierGstr3bFiled: true,
            isReversalRequired: false,
            reversalAmountInr: 0,
            interestPayableInr: 0,
            statutoryDisposition: 'SUPPLIER_GSTR3B_FILED_NO_REVERSAL',
            statutoryRationale: 'Supplier has furnished Form GSTR-3B. Section 16(2)(c) tax payment requirement satisfied.',
            isAuthorizedToDisburse: false
        };
    }

    if (!isPastCutoff) {
        return {
            invoiceNumber,
            financialYear,
            cutoffDate,
            calculationDate: calcDateIso,
            itcAmount: rawItc,
            supplierGstr3bFiled: false,
            isReversalRequired: false,
            reversalAmountInr: 0,
            interestPayableInr: 0,
            statutoryDisposition: 'WITHIN_RULE_37A_GRACE_PERIOD',
            statutoryRationale: `Supplier has not yet filed GSTR-3B, but calculation date ${calcDateIso} is on or before statutory cutoff ${cutoffDate}. Reversal not yet mandatory.`,
            isAuthorizedToDisburse: false
        };
    }

    // Past 30th November and supplier has not filed GSTR-3B: Reversal is mandatory!
    const cutoffTime = new Date(cutoffDate).getTime();
    const calcTime = new Date(calcDateIso).getTime();
    const delayDays = Math.max(0, Math.floor((calcTime - cutoffTime) / (1000 * 60 * 60 * 24)));
    const annualRate = Number(annualInterestRatePercent) / 100;
    const interestPayableInr = roundToPaisa(rawItc * annualRate * (delayDays / 365));

    return {
        invoiceNumber,
        financialYear,
        cutoffDate,
        calculationDate: calcDateIso,
        itcAmount: rawItc,
        supplierGstr3bFiled: false,
        isReversalRequired: true,
        reversalAmountInr: rawItc,
        delayDaysBeyondNovember30: delayDays,
        interestPayableInr,
        gstr3bReportingTable: 'TABLE_4_B_2_OTHERS_RECLAIMABLE',
        canReclaimOnSupplierFiling: true,
        statutoryDisposition: 'RULE_37A_REVERSAL_MANDATORY',
        statutoryRationale: `Supplier failed to furnish Form GSTR-3B on or before ${cutoffDate}. Input tax credit of ₹${rawItc.toLocaleString('en-IN')} must be reversed under Rule 37A. ${delayDays > 0 ? `Delayed by ${delayDays} days: interest of ₹${interestPayableInr.toLocaleString('en-IN')} payable under Section 50.` : 'Reversal within November returns carries zero interest.'} May be re-availed interest-free upon subsequent supplier GSTR-3B filing.`,
        isAuthorizedToDisburse: false
    };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CORPORATE FINANCE: MSME REPORTING & SCHEDULE III PAYABLE AGING
 * MCA Order 22.01.2019 (Form MSME-1) & Companies Act 2013 Schedule III
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Strictly separates:
 * 1. Accounting Age: Days from invoice date to reporting date (Schedule III brackets).
 * 2. Statutory Overdue Status: Days past Section 15 statutory due date (Appointed Day).
 * 3. MCA Form MSME-1: Bi-annual filing of Micro/Small dues exceeding 45 days.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function generateMsme1AndScheduleThreeAging({
    asOfDate = new Date().toISOString().slice(0, 10),
    halfYearPeriod = null, // 'APRIL_TO_SEPTEMBER' | 'OCTOBER_TO_MARCH'
    payables = []
} = {}) {
    if (!Array.isArray(payables)) {
        throw new Error('[@mudraforge/statutory] Invalid payables: expected an array of payable records.');
    }

    const dAsOf = new Date(String(asOfDate).slice(0, 10) + 'T00:00:00.000Z');
    if (isNaN(dAsOf.getTime())) {
        throw new Error(`[@mudraforge/statutory] Invalid asOfDate format "${asOfDate}". Expected YYYY-MM-DD.`);
    }

    // Schedule III 4-Tier Accumulators
    const agingMatrix = {
        msmeUndisputed: { lessThan1Year: 0, oneToTwoYears: 0, twoToThreeYears: 0, moreThan3Years: 0, total: 0 },
        msmeDisputed:   { lessThan1Year: 0, oneToTwoYears: 0, twoToThreeYears: 0, moreThan3Years: 0, total: 0 },
        othersUndisputed: { lessThan1Year: 0, oneToTwoYears: 0, twoToThreeYears: 0, moreThan3Years: 0, total: 0 },
        othersDisputed:   { lessThan1Year: 0, oneToTwoYears: 0, twoToThreeYears: 0, moreThan3Years: 0, total: 0 },
        unbilledDues: 0,
        grandTotalTradePayables: 0
    };

    const msme1ReportableList = [];
    const assessedPayables = [];

    for (const item of payables) {
        const amount = Math.max(0, cleanNumericAmount(item.amount || item.invoiceAmount));
        if (amount === 0) continue;

        const isUnbilled = item.isUnbilled === true;
        if (isUnbilled) {
            agingMatrix.unbilledDues = roundToPaisa(agingMatrix.unbilledDues + amount);
            agingMatrix.grandTotalTradePayables = roundToPaisa(agingMatrix.grandTotalTradePayables + amount);
            assessedPayables.push({
                invoiceNumber: item.invoiceNumber || 'UNBILLED',
                supplierName: item.supplierName || 'N/A',
                amount,
                isUnbilled: true,
                accountingAgeDays: 0,
                statutoryOverdueDays: 0,
                msme1Reportable: false
            });
            continue;
        }

        // 1. ACCOUNTING AGE (Schedule III): Days from invoice date to asOfDate
        const invDateStr = item.invoiceDate ? String(item.invoiceDate).slice(0, 10) : asOfDate;
        const dInvoice = new Date(invDateStr + 'T00:00:00.000Z');
        const accountingAgeDays = Math.max(0, Math.round((dAsOf.getTime() - dInvoice.getTime()) / 86400000));

        // Enterprise Classification: Micro vs Small vs Medium vs Others
        // Trader exclusion: Retail & Wholesale Trade (NIC 45/46/47) are NOT eligible for MSMED Chapter V / MSME-1
        const nic = String(item.nicCode || item.vendorNicCode || '').trim();
        const isTrader = item.isTrader === true || /^(45|46|47)/.test(nic);
        const isMicroOrSmall = (item.isMicro === true || item.isSmall === true || item.enterpriseType === 'MICRO' || item.enterpriseType === 'SMALL') && !isTrader;
        const isMsme = (isMicroOrSmall || item.isMedium === true || item.enterpriseType === 'MEDIUM') && !isTrader;
        const isDisputed = item.isDisputed === true || Boolean(item.writtenObjectionDate);

        // Map to Schedule III aging bucket
        let bracket = 'lessThan1Year';
        if (accountingAgeDays > 1095) {
            bracket = 'moreThan3Years'; // > 3 years
        } else if (accountingAgeDays > 730) {
            bracket = 'twoToThreeYears'; // 2–3 years
        } else if (accountingAgeDays > 365) {
            bracket = 'oneToTwoYears'; // 1–2 years
        }

        // Accumulate into Schedule III matrix
        let targetCategory;
        if (isMsme) {
            targetCategory = isDisputed ? agingMatrix.msmeDisputed : agingMatrix.msmeUndisputed;
        } else {
            targetCategory = isDisputed ? agingMatrix.othersDisputed : agingMatrix.othersUndisputed;
        }
        targetCategory[bracket] = roundToPaisa(targetCategory[bracket] + amount);
        targetCategory.total = roundToPaisa(targetCategory.total + amount);
        agingMatrix.grandTotalTradePayables = roundToPaisa(agingMatrix.grandTotalTradePayables + amount);

        // 2. STATUTORY OVERDUE STATUS (Section 15 MSMED Act)
        // Statutory due date: 15 days without written agreement; maximum 45 days with written agreement.
        // Day of acceptance: If delivery objection occurred within 15 days, acceptance is date objection removed.
        const deliveryStr = item.deliveryDate ? String(item.deliveryDate).slice(0, 10) : invDateStr;
        const dDelivery = new Date(deliveryStr + 'T00:00:00.000Z');
        
        let dAcceptance = dDelivery;
        let isDisputePaused = false;

        if (item.writtenObjectionDate) {
            const dObj = new Date(String(item.writtenObjectionDate).slice(0, 10) + 'T00:00:00.000Z');
            const objectionDays = Math.round((dObj.getTime() - dDelivery.getTime()) / 86400000);
            if (objectionDays <= 15) {
                if (item.objectionRemovalDate) {
                    dAcceptance = new Date(String(item.objectionRemovalDate).slice(0, 10) + 'T00:00:00.000Z');
                } else {
                    isDisputePaused = true; // Objection active and uncured
                }
            }
        }

        const hasAgreement = item.hasWrittenAgreement === true || Boolean(item.agreedPaymentDate);
        const maxDaysAllowed = hasAgreement ? 45 : 15;
        const dStatutoryDue = new Date(dAcceptance.getTime() + maxDaysAllowed * 86400000);

        let statutoryOverdueDays = 0;
        let isStatutoryOverdue = false;

        if (!isDisputePaused && dAsOf > dStatutoryDue) {
            statutoryOverdueDays = Math.round((dAsOf.getTime() - dStatutoryDue.getTime()) / 86400000);
            isStatutoryOverdue = statutoryOverdueDays > 0;
        }

        // 3. FORM MSME-1 REPORTABLE CRITERIA:
        // Must be Micro or Small enterprise (excluding traders) AND
        // Payment must exceed 45 days from date of acceptance/deemed acceptance AND
        // Outstanding as of half-year end.
        const daysFromAcceptance = isDisputePaused ? 0 : Math.round((dAsOf.getTime() - dAcceptance.getTime()) / 86400000);
        const isMsme1Reportable = isMicroOrSmall && !isDisputePaused && daysFromAcceptance > 45;

        if (isMsme1Reportable) {
            msme1ReportableList.push({
                supplierName: item.supplierName || 'Unknown Vendor',
                supplierPan: item.supplierPan || item.pan || 'PAN_NOT_PROVIDED',
                udyamRegistrationNumber: item.udyamRegistrationNumber || item.udyamRegNo || 'UDYAM_NOT_PROVIDED',
                invoiceNumber: item.invoiceNumber || 'INV_REF',
                invoiceDate: invDateStr,
                acceptanceDate: dAcceptance.toISOString().slice(0, 10),
                amountDueInr: amount,
                accountingAgeDays,
                statutoryOverdueDays,
                daysFromAcceptance,
                reasonForDelay: item.reasonForDelay || 'Operational billing reconciliation'
            });
        }

        assessedPayables.push({
            invoiceNumber: item.invoiceNumber || 'INV_REF',
            supplierName: item.supplierName || 'Unknown Vendor',
            amount,
            accountingAgeDays,
            accountingAgeBracket: bracket,
            isMicroOrSmall,
            isTrader,
            isDisputePaused,
            statutoryDueDate: isDisputePaused ? null : dStatutoryDue.toISOString().slice(0, 10),
            statutoryOverdueDays,
            isStatutoryOverdue,
            msme1Reportable: isMsme1Reportable
        });
    }

    const totalMsme1ReportableAmount = roundToPaisa(msme1ReportableList.reduce((sum, x) => sum + x.amountDueInr, 0));

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'APPLICABLE',
        governingLaw: 'Companies Act, 2013 Schedule III & MCA Order 22.01.2019 (Form MSME-1)',
        asOfDate,
        halfYearPeriod: halfYearPeriod || (dAsOf.getUTCMonth() >= 3 && dAsOf.getUTCMonth() <= 8 ? 'APRIL_TO_SEPTEMBER' : 'OCTOBER_TO_MARCH'),
        totalInvoicesEvaluated: payables.length,
        scheduleThreeAgingMatrix: agingMatrix,
        mcaFormMsme1: {
            reportableVendorsCount: msme1ReportableList.length,
            totalReportableAmountInr: totalMsme1ReportableAmount,
            filingDeadline: halfYearPeriod === 'APRIL_TO_SEPTEMBER' || (dAsOf.getUTCMonth() >= 3 && dAsOf.getUTCMonth() <= 8) ? 'October 31' : 'April 30',
            reportablePayables: msme1ReportableList
        },
        assessedPayablesSummary: {
            totalPayablesCount: assessedPayables.length,
            statutoryOverdueCount: assessedPayables.filter(x => x.isStatutoryOverdue).length,
            disputePausedCount: assessedPayables.filter(x => x.isDisputePaused).length
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: `Schedule III Trade Payables total: ₹${agingMatrix.grandTotalTradePayables.toLocaleString('en-IN')}. MCA Form MSME-1 identified ${msme1ReportableList.length} overdue Micro/Small items exceeding 45 days (₹${totalMsme1ReportableAmount.toLocaleString('en-IN')}). Accounting age is segregated from statutory overdue days.`
    };
}

/**
 * -----------------------------------------------------------------------------
 * 28. CORPORATE TAX: MAT (SECTION 115JB) VS CONCESSIONAL REGIME (SECTION 115BAA)
 * -----------------------------------------------------------------------------
 * Computes comparative corporate tax liability across:
 * 1. Normal Provisions: 25% (turnover <= 400Cr) or 30% (> 400Cr) + surcharge + cess.
 * 2. Section 115JB MAT: 15% on Adjusted Book Profit + surcharge + cess.
 * 3. Section 115JAA MAT Credit: Set-off against normal tax or newly generated.
 * 4. Section 115BAA Concessional Regime: Flat 22% + 10% surcharge + 4% cess = 25.168% effective.
 *    Exempt from Section 115JB MAT u/s 115JB(5A). Forfeits accumulated MAT credit.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateCorporateTaxMatVsConcessional({
    financialYear = '2025-26',
    assessmentYear = null,
    turnoverPrecedingFyInr = 0,
    netProfitBeforeTaxInr = 0,
    normalTaxAdditionsInr = 0,
    normalTaxDeductionsInr = 0,
    accumulatedMatCreditInr = 0,
    bookProfitAdjustments = null,
    adjustedBookProfitInr = null,
    optedSection115BAA = null
} = {}) {
    const fy = financialYear || '2025-26';
    const ay = assessmentYear || (fy === '2025-26' ? '2026-27' : '2027-28');
    const turnover = cleanNumericAmount(turnoverPrecedingFyInr);
    const npbt = cleanNumericAmount(netProfitBeforeTaxInr);
    const additions = cleanNumericAmount(normalTaxAdditionsInr);
    const deductions = cleanNumericAmount(normalTaxDeductionsInr);
    const priorMatCredit = cleanNumericAmount(accumulatedMatCreditInr);

    // A. Normal Corporate Tax Regime
    const taxableIncomeNormal = Math.max(0, roundToPaisa(npbt + additions - deductions));
    const baseRateNormal = turnover <= 4000000000 ? 0.25 : 0.30;
    const baseTaxNormal = roundToPaisa(taxableIncomeNormal * baseRateNormal);

    let surchargeRateNormal = 0;
    if (taxableIncomeNormal > 100000000) {
        surchargeRateNormal = 0.12;
    } else if (taxableIncomeNormal > 10000000) {
        surchargeRateNormal = 0.07;
    }
    const surchargeNormal = roundToPaisa(baseTaxNormal * surchargeRateNormal);
    const cessNormal = roundToPaisa((baseTaxNormal + surchargeNormal) * 0.04);
    const grossNormalTax = roundToPaisa(baseTaxNormal + surchargeNormal + cessNormal);

    // B. Minimum Alternate Tax (Section 115JB)
    let adjBookProfit = 0;
    if (adjustedBookProfitInr !== null && adjustedBookProfitInr !== undefined) {
        adjBookProfit = Math.max(0, Number(adjustedBookProfitInr) || 0);
    } else if (bookProfitAdjustments && typeof bookProfitAdjustments === 'object') {
        const bpAdditions = (Number(bookProfitAdjustments.incomeTaxProvision) || 0) +
            (Number(bookProfitAdjustments.reservesTransfer) || 0) +
            (Number(bookProfitAdjustments.contingentLiabilities) || 0) +
            (Number(bookProfitAdjustments.diminutionInAssetValue) || 0) +
            (Number(bookProfitAdjustments.exemptIncomeExpenses) || 0);
        const bfLoss = Number(bookProfitAdjustments.broughtForwardLoss) || 0;
        const unabsDep = Number(bookProfitAdjustments.unabsorbedDepreciation) || 0;
        const lossDepDeduction = (bfLoss > 0 && unabsDep > 0) ? Math.min(bfLoss, unabsDep) : Math.max(bfLoss, unabsDep);
        const bpDeductions = lossDepDeduction + (Number(bookProfitAdjustments.exemptIncome) || 0);
        adjBookProfit = Math.max(0, roundToPaisa(npbt + bpAdditions - bpDeductions));
    } else {
        adjBookProfit = npbt;
    }

    const baseMatRate = 0.15;
    const baseMatTax = roundToPaisa(adjBookProfit * baseMatRate);
    let surchargeRateMat = 0;
    if (adjBookProfit > 100000000) {
        surchargeRateMat = 0.12;
    } else if (adjBookProfit > 10000000) {
        surchargeRateMat = 0.07;
    }
    const surchargeMat = roundToPaisa(baseMatTax * surchargeRateMat);
    const cessMat = roundToPaisa((baseMatTax + surchargeMat) * 0.04);
    const grossMatTax = roundToPaisa(baseMatTax + surchargeMat + cessMat);

    // C. Old Regime Set-off & MAT Credit Determination (Section 115JAA)
    let matCreditUtilized = 0;
    let newMatCreditGenerated = 0;
    let netNormalTaxPayable = grossNormalTax;
    let taxPayableOldRegime = 0;

    if (grossMatTax > grossNormalTax) {
        taxPayableOldRegime = grossMatTax;
        newMatCreditGenerated = roundToPaisa(grossMatTax - grossNormalTax);
    } else {
        const maxCreditAllowable = roundToPaisa(grossNormalTax - grossMatTax);
        matCreditUtilized = Math.min(priorMatCredit, maxCreditAllowable);
        netNormalTaxPayable = roundToPaisa(grossNormalTax - matCreditUtilized);
        taxPayableOldRegime = netNormalTaxPayable;
    }
    const closingMatCreditOldRegime = roundToPaisa(priorMatCredit - matCreditUtilized + newMatCreditGenerated);

    // D. Section 115BAA Concessional Regime
    const taxableIncome115BAA = Math.max(0, roundToPaisa(npbt + additions));
    const baseRate115BAA = 0.22;
    const baseTax115BAA = roundToPaisa(taxableIncome115BAA * baseRate115BAA);
    const surcharge115BAA = roundToPaisa(baseTax115BAA * 0.10); // Flat 10% surcharge u/s 115BAA(1) proviso
    const cess115BAA = roundToPaisa((baseTax115BAA + surcharge115BAA) * 0.04);
    const totalTax115BAA = roundToPaisa(baseTax115BAA + surcharge115BAA + cess115BAA);

    // Under Section 115JB(5A), MAT does not apply to 115BAA companies
    // Under Section 115JAA, accumulated MAT credit cannot be utilized and is forfeited
    const forfeitedMatCredit115BAA = priorMatCredit;

    // E. Strategic Comparative Recommendation
    let recommendedRegime = 'SECTION_115BAA';
    let recommendationRationale = '';
    let netCashSavingsInr = 0;

    if (optedSection115BAA === true) {
        recommendedRegime = 'SECTION_115BAA';
        netCashSavingsInr = roundToPaisa(taxPayableOldRegime - totalTax115BAA);
        recommendationRationale = `Assessee has explicitly opted for Section 115BAA (25.168% effective rate). Section 115JB MAT is inapplicable u/s 115JB(5A). Accumulated MAT credit of INR ${forfeitedMatCredit115BAA.toLocaleString('en-IN')} is forfeited.`;
    } else if (optedSection115BAA === false) {
        recommendedRegime = 'OLD_REGIME';
        netCashSavingsInr = roundToPaisa(totalTax115BAA - taxPayableOldRegime);
        recommendationRationale = `Assessee remains under Old Regime. Applicable tax is INR ${taxPayableOldRegime.toLocaleString('en-IN')} (Normal Tax: INR ${grossNormalTax.toLocaleString('en-IN')}, MAT: INR ${grossMatTax.toLocaleString('en-IN')}). Closing MAT credit balance: INR ${closingMatCreditOldRegime.toLocaleString('en-IN')}.`;
    } else {
        if (taxPayableOldRegime < totalTax115BAA) {
            recommendedRegime = 'OLD_REGIME';
            netCashSavingsInr = roundToPaisa(totalTax115BAA - taxPayableOldRegime);
            recommendationRationale = `Old Regime is optimal for FY ${fy}: Net cash outflow is INR ${taxPayableOldRegime.toLocaleString('en-IN')} vs INR ${totalTax115BAA.toLocaleString('en-IN')} under Section 115BAA (Net saving: INR ${netCashSavingsInr.toLocaleString('en-IN')}). Utilizing MAT credit or Chapter VI-A deductions yields lower current cash drain.`;
        } else {
            recommendedRegime = 'SECTION_115BAA';
            netCashSavingsInr = roundToPaisa(taxPayableOldRegime - totalTax115BAA);
            recommendationRationale = `Section 115BAA is optimal for FY ${fy}: Net tax payable is INR ${totalTax115BAA.toLocaleString('en-IN')} vs INR ${taxPayableOldRegime.toLocaleString('en-IN')} under Old Regime (Net saving: INR ${netCashSavingsInr.toLocaleString('en-IN')}). Form 10-IC must be filed before the due date u/s 139(1). Note: INR ${forfeitedMatCredit115BAA.toLocaleString('en-IN')} in accumulated MAT credit will lapse.`;
        }
    }

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'APPLICABLE',
        governingLaw: 'Income-tax Act, 1961 Sections 115BAA, 115JB & 115JAA',
        financialYear: fy,
        assessmentYear: ay,
        taxableIncomeNormalInr: taxableIncomeNormal,
        adjustedBookProfitInr: adjBookProfit,
        normalTaxRegime: {
            turnoverPrecedingFyInr: turnover,
            baseTaxRate: baseRateNormal,
            baseTaxInr: baseTaxNormal,
            surchargeRate: surchargeRateNormal,
            surchargeInr: surchargeNormal,
            cessInr: cessNormal,
            grossNormalTaxInr: grossNormalTax,
            effectiveRate: taxableIncomeNormal > 0 ? roundToPaisa((grossNormalTax / taxableIncomeNormal) * 100) : 0
        },
        minimumAlternateTaxSec115JB: {
            baseMatRate: baseMatRate,
            baseMatTaxInr: baseMatTax,
            surchargeRate: surchargeRateMat,
            surchargeInr: surchargeMat,
            cessInr: cessMat,
            grossMatTaxInr: grossMatTax,
            effectiveMatRate: adjBookProfit > 0 ? roundToPaisa((grossMatTax / adjBookProfit) * 100) : 0
        },
        matCreditScheduleSec115JAA: {
            openingMatCreditInr: priorMatCredit,
            matCreditUtilizedInr: matCreditUtilized,
            newMatCreditGeneratedInr: newMatCreditGenerated,
            closingMatCreditInr: closingMatCreditOldRegime,
            expiryYears: '15 Assessment Years'
        },
        concessionalRegimeSec115BAA: {
            taxableIncomeInr: taxableIncome115BAA,
            baseTaxRate: 0.22,
            baseTaxInr: baseTax115BAA,
            surchargeRate: 0.10,
            surchargeInr: surcharge115BAA,
            cessInr: cess115BAA,
            totalTaxInr: totalTax115BAA,
            effectiveRate: 25.168,
            matApplicable: false,
            matExemptionClause: 'Section 115JB(5A)',
            forfeitedMatCreditInr: forfeitedMatCredit115BAA
        },
        comparisonSummary: {
            cashOutflowOldRegimeInr: taxPayableOldRegime,
            cashOutflowSection115BAAInr: totalTax115BAA,
            recommendedRegime,
            netCashSavingsInr,
            form10IcRequired: recommendedRegime === 'SECTION_115BAA'
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: recommendationRationale,
        citations: [
            'Income-tax Act, 1961 Section 115BAA (Tax on income of certain domestic companies)',
            'Income-tax Act, 1961 Section 115JB (Special provision for payment of tax by certain companies)',
            'Income-tax Act, 1961 Section 115JB(5A) (Non-applicability of MAT to Section 115BAA)',
            'Income-tax Act, 1961 Section 115JAA (Tax credit in respect of tax paid on deemed income)'
        ]
    };
}

/**
 * -----------------------------------------------------------------------------
 * 29. PLACE OF SUPPLY (POS) & ZERO-RATED EXPORT UNDER LUT (IGST ACT SECTIONS 10, 12, 16)
 * -----------------------------------------------------------------------------
 * Evaluates:
 * 1. Domestic B2B / B2C POS (Sec 10 for Goods, Sec 12 for Services).
 * 2. Intra-State (CGST + SGST) vs Inter-State (IGST) classification.
 * 3. Export of Services under Section 16 & Section 2(6) cumulative 5 conditions.
 * 4. Letter of Undertaking (LUT) zero-rate export vs tax payment refund.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateTransferPricingAlp({
    transactionDescription = 'International Transaction with Associated Enterprise',
    testedParty = 'Indian Enterprise',
    associatedEnterpriseName = 'Foreign AE',
    isAssociatedEnterprise = true,
    internationalTransactionAmountInr = 0,
    testedPartyOperatingMarginPercent = 0,
    isWholesaleTrading = false,
    comparablesData = [],
    transferPricingMethod = 'TNMM'
} = {}) {
    const amount = cleanNumericAmount(internationalTransactionAmountInr);
    const testedMargin = cleanNumericAmount(testedPartyOperatingMarginPercent);
    const tolerancePercent = isWholesaleTrading ? 3.0 : 1.0;

    if (!isAssociatedEnterprise) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'NOT_APPLICABLE',
            governingLaw: 'Income-tax Act, 1961 Section 92A & 92C',
            transactionDescription,
            isAssociatedEnterprise: false,
            statutoryRationale: 'Counterparty is not an Associated Enterprise under Section 92A. Transfer Pricing provisions u/s 92C do not apply to third-party transactions.',
            isAuthorizedToDisburse: false
        };
    }

    const comparables = Array.isArray(comparablesData)
        ? comparablesData.map(x => Number(typeof x === 'object' && x !== null ? (x.operatingMargin || x.margin || 0) : x)).filter(x => !isNaN(x)).sort((a, b) => a - b)
        : [];

    let isArmLengthCompliant = false;
    let primaryAdjustmentInr = 0;
    let percentile35 = null;
    let percentile65 = null;
    let median50 = null;
    let arithmeticMean = null;
    let appliedRule = '';

    if (comparables.length >= 6) {
        appliedRule = 'Rule 10CA Percentile Range (Dataset >= 6 Comparables)';
        const n = comparables.length;

        const getPercentileValue = (p) => {
            const index = (n * p);
            if (Number.isInteger(index)) {
                const i = index - 1;
                return (comparables[i] + comparables[Math.min(i + 1, n - 1)]) / 2;
            } else {
                const i = Math.floor(index);
                return comparables[Math.min(i, n - 1)];
            }
        };

        percentile35 = roundToPaisa(getPercentileValue(0.35));
        percentile65 = roundToPaisa(getPercentileValue(0.65));
        median50 = roundToPaisa(getPercentileValue(0.50));

        if (testedMargin >= percentile35 && testedMargin <= percentile65) {
            isArmLengthCompliant = true;
            primaryAdjustmentInr = 0;
        } else if (testedMargin > percentile65) {
            isArmLengthCompliant = true;
            primaryAdjustmentInr = 0;
        } else {
            isArmLengthCompliant = false;
            const marginShortfall = roundToPaisa(median50 - testedMargin);
            primaryAdjustmentInr = roundToPaisa(amount * (marginShortfall / 100));
        }
    } else if (comparables.length > 0) {
        appliedRule = 'Proviso to Section 92C(2) Arithmetic Mean & Tolerance Band (< 6 Comparables)';
        arithmeticMean = roundToPaisa(comparables.reduce((sum, x) => sum + x, 0) / comparables.length);
        const variationPercent = Math.abs(testedMargin - arithmeticMean);

        if (variationPercent <= tolerancePercent || testedMargin >= arithmeticMean) {
            isArmLengthCompliant = true;
            primaryAdjustmentInr = 0;
        } else {
            isArmLengthCompliant = false;
            const marginShortfall = roundToPaisa(arithmeticMean - testedMargin);
            primaryAdjustmentInr = roundToPaisa(amount * (marginShortfall / 100));
        }
    } else {
        appliedRule = 'Single Transaction Assessment (No Dataset)';
        isArmLengthCompliant = true;
        primaryAdjustmentInr = 0;
    }

    const requiresSecondaryAdjustment = primaryAdjustmentInr > 10000000;

    return {
        status: 'SUCCESS',
        statutoryDetermination: isArmLengthCompliant ? 'ARM_LENGTH_COMPLIANT' : 'PRIMARY_ADJUSTMENT_REQUIRED',
        governingLaw: 'Income-tax Act, 1961 Section 92C, Rule 10B & Rule 10CA',
        testedParty,
        associatedEnterpriseName,
        transferPricingMethod,
        internationalTransactionAmountInr: amount,
        testedPartyOperatingMarginPercent: testedMargin,
        appliedRule,
        toleranceBandPercent: tolerancePercent,
        datasetSummary: {
            comparablesCount: comparables.length,
            percentile35,
            percentile65,
            median50,
            arithmeticMean,
            armLengthRange: percentile35 !== null ? [percentile35, percentile65] : null
        },
        primaryAdjustmentInr,
        secondaryAdjustmentAlert: requiresSecondaryAdjustment ? {
            applicable: true,
            section: 'Section 92CE',
            threshold: 'Exceeds INR 1,00,00,000',
            repatriationPeriodDays: 90,
            statutoryConsequence: 'Excess money must be repatriated into India within 90 days, failing which interest at SBI 1-yr MCLR + 325 bps applies.'
        } : { applicable: false },
        isAuthorizedToDisburse: false,
        statutoryRationale: isArmLengthCompliant
            ? `Transfer Pricing Compliant: Tested party operating margin of ${testedMargin}% is within the statutory arm's length range [${percentile35 ?? arithmeticMean}%, ${percentile65 ?? arithmeticMean}%]. Primary adjustment is INR 0.`
            : `Primary Adjustment Required: Tested margin (${testedMargin}%) falls below statutory arm's length range. Under Rule 10CA(7), adjustment is made to the Median (50th percentile: ${median50}%). Primary TP addition to income: INR ${primaryAdjustmentInr.toLocaleString('en-IN')}.${requiresSecondaryAdjustment ? ' Section 92CE secondary adjustment mandatory.' : ''}`
    };
}

/**
 * -----------------------------------------------------------------------------
 * 31. SECTION 79 TAX LOSS CARRY-FORWARD & SHAREHOLDING CONTINUITY
 * -----------------------------------------------------------------------------
 * Evaluates carry forward and set off of accumulated business losses:
 * 1. General Rule (Sec 79(1)): Denied if >= 51% change in voting power.
 * 2. Startup Carve-Out (Sec 79(2)): Preserved for DPIIT startups u/s 80-IAC if all original shareholders continue.
 * 3. IBC Carve-Out (Sec 79(2)(c)): Preserved for NCLT resolution plans.
 * 4. Section 32(2) Invariant: Unabsorbed depreciation carries forward INDEFINITELY regardless of Section 79.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function evaluateSection79LossContinuity({
    companyType = 'CLOSELY_HELD_COMPANY',
    isDpiitRecognizedStartup = false,
    isIbcResolutionPlan = false,
    accumulatedBroughtForwardLossInr = 0,
    unabsorbedDepreciationInr = 0,
    shareholdingInLossYear = [],
    shareholdingInSetOffYear = [],
    votingPowerHeldByOriginalShareholdersPercent = null
} = {}) {
    const bfLoss = Math.max(0, cleanNumericAmount(accumulatedBroughtForwardLossInr));
    const unabsDep = Math.max(0, cleanNumericAmount(unabsorbedDepreciationInr));

    let continuityPercent = votingPowerHeldByOriginalShareholdersPercent !== null
        ? Number(votingPowerHeldByOriginalShareholdersPercent)
        : null;

    let allOriginalShareholdersContinue = false;

    if (continuityPercent === null && Array.isArray(shareholdingInLossYear) && shareholdingInLossYear.length > 0 && Array.isArray(shareholdingInSetOffYear)) {
        let commonVotingPower = 0;
        let originalFoundCount = 0;

        for (const orig of shareholdingInLossYear) {
            const pan = orig.shareholderPan || orig.pan || orig.name;
            const origPct = Number(orig.percentage || orig.votingPower || 0);
            const current = shareholdingInSetOffYear.find(x => (x.shareholderPan || x.pan || x.name) === pan);

            if (current && Number(current.percentage || current.votingPower || 0) > 0) {
                originalFoundCount++;
                commonVotingPower += Math.min(origPct, Number(current.percentage || current.votingPower || 0));
            }
        }
        continuityPercent = roundToPaisa(commonVotingPower);
        allOriginalShareholdersContinue = (originalFoundCount === shareholdingInLossYear.length);
    } else if (continuityPercent !== null) {
        allOriginalShareholdersContinue = continuityPercent > 0;
    } else {
        continuityPercent = 100;
        allOriginalShareholdersContinue = true;
    }

    let isLossCarryForwardAllowed = false;
    let governingClause = 'Section 79(1)';
    let rationale = '';

    if (isIbcResolutionPlan) {
        isLossCarryForwardAllowed = true;
        governingClause = 'Section 79(2)(c) (Insolvency and Bankruptcy Code Resolution Plan)';
        rationale = 'Accumulated business losses are protected under Section 79(2)(c): Change in shareholding pursuant to NCLT approved resolution plan under the IBC, 2016 is exempt from Section 79 restrictions.';
    } else if (isDpiitRecognizedStartup) {
        governingClause = 'Section 79(2) (DPIIT Recognized Startup under Section 80-IAC)';
        if (allOriginalShareholdersContinue) {
            isLossCarryForwardAllowed = true;
            rationale = `Accumulated business losses protected under Section 79(2) startup carve-out: Although original voting power is ${continuityPercent}%, all original shareholders continue to hold shares in the company.`;
        } else {
            isLossCarryForwardAllowed = continuityPercent >= 51.0;
            rationale = isLossCarryForwardAllowed
                ? `Section 79 satisfied: Original shareholders retain ${continuityPercent}% voting power (>= 51%).`
                : `Section 79(2) startup carve-out failed: Not all original shareholders continue to hold shares, and retained voting power (${continuityPercent}%) is below 51%. Business loss lapsed.`;
        }
    } else {
        governingClause = 'Section 79(1) General Corporate Rule';
        if (continuityPercent >= 51.0) {
            isLossCarryForwardAllowed = true;
            rationale = `Section 79(1) compliant: Original shareholders hold ${continuityPercent}% of voting power on the last day of the financial year (threshold: >= 51%). Business losses can be set off.`;
        } else {
            isLossCarryForwardAllowed = false;
            rationale = `Section 79(1) violation: Voting power held by original shareholders has fallen to ${continuityPercent}% (< 51%). Accumulated business losses of INR ${bfLoss.toLocaleString('en-IN')} are legally lapsed and forfeited.`;
        }
    }

    const allowableLossSetOffInr = isLossCarryForwardAllowed ? bfLoss : 0;
    const lapsedBusinessLossInr = isLossCarryForwardAllowed ? 0 : bfLoss;

    return {
        status: 'SUCCESS',
        statutoryDetermination: isLossCarryForwardAllowed ? 'LOSS_CARRYFORWARD_ALLOWED' : 'LOSS_CARRYFORWARD_DENIED',
        governingLaw: 'Income-tax Act, 1961 Section 79 & Section 32(2)',
        governingClause,
        companyType,
        isDpiitRecognizedStartup,
        isIbcResolutionPlan,
        beneficialOwnershipContinuityPercent: continuityPercent,
        allOriginalShareholdersContinue,
        lossSchedule: {
            broughtForwardBusinessLossInr: bfLoss,
            allowableLossSetOffInr,
            lapsedBusinessLossInr,
            unabsorbedDepreciationInr: unabsDep,
            unabsorbedDepreciationStatutoryStatus: 'Fully protected under Section 32(2) -- Indefinite carry forward unaffected by shareholding changes.'
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: `${rationale} Note: Unabsorbed depreciation of INR ${unabsDep.toLocaleString('en-IN')} is unaffected by Section 79 per Supreme Court precedent (CIT v. Virmani Industries) and carries forward indefinitely.`
    };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 31B. SECTION 281 TAX CLEARANCE & VOID TRANSFER RISK ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Evaluates asset transfer voidability and tax clearance safe harbors in corporate
 * restructuring, slump sales, and asset acquisitions under Section 281 of the
 * Income-tax Act, 1961 read with CBDT Circular No. 04/2011:
 * - Asset Scope: Land, buildings, machinery, plant, shares, securities, bank FDs > ₹10,000.
 * - Voidability Trigger: Transfer or charge creation during pending tax proceedings
 *   (Sec 143(2), 148, 153A, 250, 254) or outstanding demand under Section 156.
 * - Statutory Safe Harbors:
 *   1. Section 281(1) Proviso (ii): Prior written permission of Assessing Officer (Circular 04/2011).
 *   2. Section 281(1) Proviso (i): Bona fide purchaser for adequate consideration without notice.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function evaluateSection281TaxClearance({
    assetType = 'IMMOVABLE_PROPERTY', // 'IMMOVABLE_PROPERTY' | 'PLANT_AND_MACHINERY' | 'SHARES_AND_SECURITIES' | 'FIXED_DEPOSIT' | 'OTHER'
    assetDescription = 'Commercial Asset / Undertaking',
    assetValueInr = 0,
    transferNature = 'SALE', // 'SALE' | 'MORTGAGE' | 'GIFT' | 'EXCHANGE' | 'CHARGE_CREATION'
    hasPendingProceedings = false,
    pendingProceedings = [],
    hasOutstandingDemand = false,
    outstandingDemandInr = 0,
    hasPriorAoPermission = false,
    aoPermissionReference = null,
    aoPermissionDate = null,
    hasAdequateConsideration = true,
    hasNoticeOfProceedingsOrDemand = false,
    alternativeSecurityFurnishedInr = 0
} = {}) {
    const rawAssetVal = Math.max(0, Number(assetValueInr) || 0);
    const assetVal = roundToPaisa(rawAssetVal);
    const rawDemand = Math.max(0, Number(outstandingDemandInr) || 0);
    const demandInr = roundToPaisa(rawDemand);
    const rawAltSec = Math.max(0, Number(alternativeSecurityFurnishedInr) || 0);
    const altSecInr = roundToPaisa(rawAltSec);

    let totalPendingExposureInr = demandInr;
    if (Array.isArray(pendingProceedings)) {
        for (const proc of pendingProceedings) {
            const exp = Math.max(0, Number(proc.estimatedExposureInr || proc.exposureInr || proc.amountInr) || 0);
            totalPendingExposureInr = roundToPaisa(totalPendingExposureInr + exp);
        }
    }

    const hasAnyProceedings = Boolean(hasPendingProceedings || (Array.isArray(pendingProceedings) && pendingProceedings.length > 0));
    const hasAnyDemand = Boolean(hasOutstandingDemand || demandInr > 0);

    // ── GATE 1: DE MINIMIS STATUTORY EXCLUSION ──
    // Section 281 Explanation: Assets exceeding INR 10,000 in value
    if (assetVal <= 10000) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_DE_MINIMIS',
            isVoidableAgainstRevenue: false,
            riskLevel: 'NONE',
            governingLaw: 'Income-tax Act, 1961 Section 281 Explanation',
            assetParticulars: {
                assetType,
                assetDescription,
                assetValueInr: assetVal,
                transferNature
            },
            safeHarborQualification: 'EXEMPT_BELOW_STATUTORY_FLOOR',
            totalTaxExposureInr: totalPendingExposureInr,
            isAuthorizedToDisburse: false,
            statutoryRationale: `Asset value of INR ${assetVal.toLocaleString('en-IN')} does not exceed the statutory threshold of INR 10,000 under Section 281 Explanation. Section 281 voidability is inapplicable.`
        };
    }

    // ── GATE 2: CLEAN TRANSFEROR (NO PROCEEDINGS OR DEMANDS) ──
    if (!hasAnyProceedings && !hasAnyDemand) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'CLEAN_NO_PROCEEDINGS_PENDING',
            isVoidableAgainstRevenue: false,
            riskLevel: 'LOW',
            governingLaw: 'Income-tax Act, 1961 Section 281',
            assetParticulars: {
                assetType,
                assetDescription,
                assetValueInr: assetVal,
                transferNature
            },
            safeHarborQualification: 'NOT_APPLICABLE_NO_PENDING_PROCEEDINGS',
            totalTaxExposureInr: 0,
            isAuthorizedToDisburse: false,
            statutoryRationale: 'No proceedings under the Income-tax Act are pending against the transferor and no outstanding tax demands exist. Transfer/charge is not subject to statutory voidability under Section 281.'
        };
    }

    // ── GATE 3: SAFE HARBOR 2 — PRIOR ASSESSING OFFICER PERMISSION ──
    if (hasPriorAoPermission) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'PROTECTED_AO_PERMISSION',
            isVoidableAgainstRevenue: false,
            riskLevel: 'ZERO',
            governingLaw: 'Income-tax Act, 1961 Section 281(1) Proviso (ii) & CBDT Circular No. 04/2011',
            assetParticulars: {
                assetType,
                assetDescription,
                assetValueInr: assetVal,
                transferNature
            },
            safeHarborQualification: 'SECTION_281_PROVISO_II_AO_PERMISSION',
            clearanceDetails: {
                aoPermissionReference: aoPermissionReference || 'NOC_F_NO_SEC281_VERIFIED',
                aoPermissionDate: aoPermissionDate || new Date().toISOString().split('T')[0],
                alternativeSecurityFurnishedInr: altSecInr
            },
            totalTaxExposureInr: totalPendingExposureInr,
            isAuthorizedToDisburse: false,
            statutoryRationale: `Prior written permission of the Assessing Officer obtained under Section 281(1) Proviso (ii) pursuant to CBDT Circular No. 04/2011. Transfer/charge is legally protected against avoidance or attachment by the Tax Recovery Officer.`
        };
    }

    // ── GATE 4: SAFE HARBOR 1 — BONA FIDE PURCHASER FOR ADEQUATE CONSIDERATION WITHOUT NOTICE ──
    if (hasAdequateConsideration && !hasNoticeOfProceedingsOrDemand) {
        if (hasAnyDemand && demandInr > 0) {
            // Constructive notice risk: If notice of demand under Sec 156 has been served or recorded, Department may challenge lack of notice
            return {
                status: 'SUCCESS',
                statutoryDetermination: 'CONDITIONAL_BONA_FIDE_DEFENSE',
                isVoidableAgainstRevenue: false,
                riskLevel: 'MODERATE_NOTICE_DISPUTE_RISK',
                governingLaw: 'Income-tax Act, 1961 Section 281(1) Proviso (i)',
                assetParticulars: {
                    assetType,
                    assetDescription,
                    assetValueInr: assetVal,
                    transferNature
                },
                safeHarborQualification: 'SECTION_281_PROVISO_I_BONA_FIDE_PURCHASER',
                totalTaxExposureInr: totalPendingExposureInr,
                outstandingDemandInr: demandInr,
                isAuthorizedToDisburse: false,
                statutoryRationale: `Transaction qualifies prima facie as a bona fide transfer for adequate consideration without notice under Section 281(1) Proviso (i). However, due to existing outstanding demand of INR ${demandInr.toLocaleString('en-IN')}, buyer should secure an indemnity escrow holdback or seek formal AO clearance under Circular 04/2011 to preclude constructive notice litigation.`
            };
        }

        return {
            status: 'SUCCESS',
            statutoryDetermination: 'PROTECTED_BONA_FIDE_PURCHASER',
            isVoidableAgainstRevenue: false,
            riskLevel: 'LOW_WITH_WARRANTIES',
            governingLaw: 'Income-tax Act, 1961 Section 281(1) Proviso (i)',
            assetParticulars: {
                assetType,
                assetDescription,
                assetValueInr: assetVal,
                transferNature
            },
            safeHarborQualification: 'SECTION_281_PROVISO_I_BONA_FIDE_PURCHASER',
            totalTaxExposureInr: totalPendingExposureInr,
            isAuthorizedToDisburse: false,
            statutoryRationale: `Transfer is made for adequate consideration and without notice of pending tax proceedings. Fully qualifies for statutory protection under Section 281(1) Proviso (i).`
        };
    }

    // ── GATE 5: UNPROTECTED TRANSFER — STATUTORILY VOIDABLE AGAINST REVENUE ──
    return {
        status: 'SUCCESS',
        statutoryDetermination: 'STATUTORILY_VOIDABLE_AGAINST_REVENUE',
        isVoidableAgainstRevenue: true,
        riskLevel: 'HIGH_CRITICAL',
        governingLaw: 'Income-tax Act, 1961 Section 281(1)',
        assetParticulars: {
            assetType,
            assetDescription,
            assetValueInr: assetVal,
            transferNature
        },
        safeHarborQualification: 'NONE_STATUTORILY_VOIDABLE',
        totalTaxExposureInr: totalPendingExposureInr,
        outstandingDemandInr: demandInr,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Transfer/charge is legally void as against the Income Tax Department under Section 281(1) of the Income-tax Act, 1961. The Tax Recovery Officer can attach and auction the transferred asset to satisfy transferor tax liabilities of INR ${totalPendingExposureInr.toLocaleString('en-IN')}. Mandatory action: obtain AO NOC under CBDT Circular No. 04/2011 or establish an escrow holdback equal to 100% of tax exposure.`
    };
}

/**
 * -----------------------------------------------------------------------------
 * 32. FOREIGN EXCHANGE MONETARY REVALUATION (IND AS 21 & IND AS 109)
 * -----------------------------------------------------------------------------
 * Revalues foreign currency monetary items at closing reporting spot rates:
 * 1. Monetary Assets (Receivables, Bank) vs Monetary Liabilities (Payables, Loans).
 * 2. Net Unrealized Gain/Loss routing: P&L vs Other Comprehensive Income (OCI - Cash Flow Hedge Reserve).
 * 3. Ind AS 109 Balance Sheet schedule generation.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateBusinessCombinationsIndAs103(params = {}) {
    const acquisitionId = params.acquisitionId || 'ACQ-01';
    const acquirerName = params.acquirerName || 'Acquiring Enterprise';
    const acquireeName = params.acquireeName || 'Acquired Business Entity';
    const acquisitionDate = params.acquisitionDate || new Date().toISOString().split('T')[0];

    // 1. Consideration Transferred
    const rawCons = params.consideration || {};
    const cashConsideration = roundToPaisa(cleanNumericAmount(rawCons.upfrontCashInr, { defaultValue: 0 }));

    let equitySharesFairValue = 0;
    if (rawCons.equitySharesIssued && typeof rawCons.equitySharesIssued === 'object') {
        const count = cleanNumericAmount(rawCons.equitySharesIssued.count, { defaultValue: 0 });
        const price = cleanNumericAmount(rawCons.equitySharesIssued.sharePriceInr, { defaultValue: 0 });
        equitySharesFairValue = roundToPaisa(count * price);
    } else {
        equitySharesFairValue = roundToPaisa(cleanNumericAmount(rawCons.equitySharesFairValueInr, { defaultValue: 0 }));
    }

    const contingentConsideration = roundToPaisa(cleanNumericAmount(rawCons.contingentConsiderationFairValueInr, { defaultValue: 0 }));

    let deferredConsiderationPv = 0;
    if (rawCons.deferredCashConsideration && typeof rawCons.deferredCashConsideration === 'object') {
        const amt = cleanNumericAmount(rawCons.deferredCashConsideration.amountInr, { defaultValue: 0 });
        const r = cleanNumericAmount(rawCons.deferredCashConsideration.discountRate, { defaultValue: 0.10 });
        const yrs = cleanNumericAmount(rawCons.deferredCashConsideration.payableInYears, { defaultValue: 1 });
        deferredConsiderationPv = roundToPaisa(amt / Math.pow(1 + r, yrs));
    } else {
        deferredConsiderationPv = roundToPaisa(cleanNumericAmount(rawCons.deferredConsiderationPresentValueInr, { defaultValue: 0 }));
    }

    const preExistingInterest = roundToPaisa(cleanNumericAmount(rawCons.preExistingInterestFairValueInr, { defaultValue: 0 }));

    const totalConsiderationTransferred = roundToPaisa(
        cashConsideration + equitySharesFairValue + contingentConsideration + deferredConsiderationPv + preExistingInterest
    );

    // 2. Identifiable Assets Acquired
    const rawAssets = params.identifiableAssets || {};
    const tangibleAssets = roundToPaisa(cleanNumericAmount(rawAssets.tangibleAssetsFairValueInr, { defaultValue: 0 }));
    const identifiableIntangibles = roundToPaisa(cleanNumericAmount(rawAssets.identifiableIntangiblesFairValueInr, { defaultValue: 0 }));
    const otherAssets = roundToPaisa(cleanNumericAmount(rawAssets.otherAssetsFairValueInr, { defaultValue: 0 }));
    const totalGrossAssets = roundToPaisa(tangibleAssets + identifiableIntangibles + otherAssets);

    // 3. Liabilities Assumed
    const rawLiab = params.liabilitiesAssumed || {};
    const borrowings = roundToPaisa(cleanNumericAmount(rawLiab.borrowingsFairValueInr, { defaultValue: 0 }));
    const workingCapitalLiab = roundToPaisa(cleanNumericAmount(rawLiab.workingCapitalLiabilitiesInr, { defaultValue: 0 }));
    const contingentLiab = roundToPaisa(cleanNumericAmount(rawLiab.contingentLiabilitiesRecognizedInr, { defaultValue: 0 }));

    // Deferred Tax on Intangibles Step-Up
    const taxRate = cleanNumericAmount(params.taxRate, { defaultValue: 0.25168 });
    const intangiblesTaxBase = cleanNumericAmount(params.intangiblesTaxBaseInr, { defaultValue: 0 });
    const intangiblesStepUp = Math.max(0, identifiableIntangibles - intangiblesTaxBase);
    const deferredTaxLiability = roundToPaisa(intangiblesStepUp * taxRate);

    const totalLiabilitiesAssumed = roundToPaisa(borrowings + workingCapitalLiab + contingentLiab + deferredTaxLiability);
    const netIdentifiableAssets = roundToPaisa(totalGrossAssets - totalLiabilitiesAssumed);

    if (totalConsiderationTransferred <= 0 && netIdentifiableAssets <= 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 103 / IFRS 3 / US GAAP ASC 805',
            acquisitionId,
            isAuthorizedToDisburse: false,
            statutoryRationale: 'Consideration transferred or identifiable net assets must be greater than zero.'
        };
    }

    // 4. Non-Controlling Interest (NCI)
    const rawNci = params.nonControllingInterest || {};
    const nciMethod = String(rawNci.method || 'PROPORTIONATE_SHARE').toUpperCase();
    const nciPct = cleanNumericAmount(rawNci.percentage, { defaultValue: 0 });
    let nciAmount = 0;
    if (nciMethod === 'FAIR_VALUE' && rawNci.fairValueInr) {
        nciAmount = roundToPaisa(cleanNumericAmount(rawNci.fairValueInr, { defaultValue: 0 }));
    } else {
        nciAmount = roundToPaisa(Math.max(0, netIdentifiableAssets * (nciPct / 100)));
    }

    // 5. Acquisition Basis & Goodwill / Capital Reserve
    const acquisitionBasis = roundToPaisa(totalConsiderationTransferred + nciAmount);
    const excess = roundToPaisa(acquisitionBasis - netIdentifiableAssets);

    let goodwillInr = 0;
    let bargainPurchaseGainInr = 0;
    let disposition = '';
    let statutoryRationale = '';

    if (excess > 0) {
        goodwillInr = excess;
        disposition = 'GOODWILL_RECOGNIZED';
        statutoryRationale = `Ind AS 103 PPA complete: Consideration of INR ${totalConsiderationTransferred.toLocaleString('en-IN')} plus NCI of INR ${nciAmount.toLocaleString('en-IN')} exceeds Net Identifiable Assets of INR ${netIdentifiableAssets.toLocaleString('en-IN')}. Goodwill of INR ${goodwillInr.toLocaleString('en-IN')} capitalized on balance sheet. Mandatory annual impairment test under Ind AS 36 (amortization prohibited).`;
    } else if (excess < 0) {
        bargainPurchaseGainInr = Math.abs(excess);
        disposition = 'BARGAIN_PURCHASE_CAPITAL_RESERVE';
        statutoryRationale = `Ind AS 103 PPA complete: Net Identifiable Assets of INR ${netIdentifiableAssets.toLocaleString('en-IN')} exceed Acquisition Basis of INR ${acquisitionBasis.toLocaleString('en-IN')}. Bargain purchase gain of INR ${bargainPurchaseGainInr.toLocaleString('en-IN')} identified. After mandatory reassessment per Ind AS 103 paragraph 36, recognized in OCI and accumulated in Equity as Capital Reserve.`;
    } else {
        disposition = 'PAR_ACQUISITION';
        statutoryRationale = `Ind AS 103 PPA complete: Acquisition Basis exactly equals Net Identifiable Assets of INR ${netIdentifiableAssets.toLocaleString('en-IN')}. Zero goodwill or bargain purchase gain recognized.`;
    }

    // 6. Acquisition-Related Costs (Expensed immediately in P&L)
    const transactionCosts = roundToPaisa(cleanNumericAmount(params.acquisitionRelatedCostsInr, { defaultValue: 0 }));

    // 7. General Ledger Journal Entries
    const journalEntries = [];
    if (tangibleAssets > 0) {
        journalEntries.push({ account: 'Property, Plant & Equipment (Fair Value)', type: 'PPE', debitInr: tangibleAssets, creditInr: 0, reference: acquisitionId });
    }
    if (identifiableIntangibles > 0) {
        journalEntries.push({ account: 'Identifiable Intangible Assets (Fair Value)', type: 'INTANGIBLE', debitInr: identifiableIntangibles, creditInr: 0, reference: acquisitionId });
    }
    if (otherAssets > 0) {
        journalEntries.push({ account: 'Other Net Current Assets', type: 'CURRENT_ASSET', debitInr: otherAssets, creditInr: 0, reference: acquisitionId });
    }
    if (goodwillInr > 0) {
        journalEntries.push({ account: 'Goodwill on Consolidation', type: 'INTANGIBLE_GOODWILL', debitInr: goodwillInr, creditInr: 0, reference: acquisitionId });
    }
    if (borrowings > 0) {
        journalEntries.push({ account: 'Borrowings Assumed (Fair Value)', type: 'NON_CURRENT_LIABILITY', debitInr: 0, creditInr: borrowings, reference: acquisitionId });
    }
    if (workingCapitalLiab > 0) {
        journalEntries.push({ account: 'Working Capital Liabilities Assumed', type: 'CURRENT_LIABILITY', debitInr: 0, creditInr: workingCapitalLiab, reference: acquisitionId });
    }
    if (contingentLiab > 0) {
        journalEntries.push({ account: 'Contingent Liabilities Recognized', type: 'PROVISION', debitInr: 0, creditInr: contingentLiab, reference: acquisitionId });
    }
    if (deferredTaxLiability > 0) {
        journalEntries.push({ account: 'Deferred Tax Liability (Ind AS 12 / Step-Up)', type: 'DTL', debitInr: 0, creditInr: deferredTaxLiability, reference: acquisitionId });
    }
    if (nciAmount > 0) {
        journalEntries.push({ account: 'Non-Controlling Interest (Equity)', type: 'EQUITY_NCI', debitInr: 0, creditInr: nciAmount, reference: acquisitionId });
    }
    if (bargainPurchaseGainInr > 0) {
        journalEntries.push({ account: 'Capital Reserve (Bargain Purchase Gain in OCI)', type: 'EQUITY_CAPITAL_RESERVE', debitInr: 0, creditInr: bargainPurchaseGainInr, reference: acquisitionId });
    }
    if (cashConsideration > 0) {
        journalEntries.push({ account: 'Cash / Bank Rail Settlement', type: 'CURRENT_ASSET', debitInr: 0, creditInr: cashConsideration, reference: acquisitionId });
    }
    if (equitySharesFairValue > 0) {
        journalEntries.push({ account: 'Equity Share Capital & Securities Premium', type: 'EQUITY', debitInr: 0, creditInr: equitySharesFairValue, reference: acquisitionId });
    }
    if (contingentConsideration > 0) {
        journalEntries.push({ account: 'Contingent Consideration Liability', type: 'FINANCIAL_LIABILITY', debitInr: 0, creditInr: contingentConsideration, reference: acquisitionId });
    }
    if (deferredConsiderationPv > 0) {
        journalEntries.push({ account: 'Deferred Consideration Payable (PV)', type: 'NON_CURRENT_LIABILITY', debitInr: 0, creditInr: deferredConsiderationPv, reference: acquisitionId });
    }
    if (preExistingInterest > 0) {
        journalEntries.push({ account: 'Investment in Acquiree (Pre-existing Interest De-recognized)', type: 'INVESTMENT', debitInr: 0, creditInr: preExistingInterest, reference: acquisitionId });
    }

    if (transactionCosts > 0) {
        journalEntries.push({ account: 'Acquisition Transaction Costs (P&L Expense)', type: 'OPERATING_EXPENSE', debitInr: transactionCosts, creditInr: 0, reference: acquisitionId });
        journalEntries.push({ account: 'Accounts Payable / Bank (Advisory Fees)', type: 'CURRENT_LIABILITY', debitInr: 0, creditInr: transactionCosts, reference: acquisitionId });
    }

    const totalDebits = roundToPaisa(journalEntries.reduce((acc, e) => acc + e.debitInr, 0));
    const totalCredits = roundToPaisa(journalEntries.reduce((acc, e) => acc + e.creditInr, 0));
    const isDoubleEntryBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 103 / IFRS 3 / US GAAP ASC 805',
        acquisitionId,
        acquirerName,
        acquireeName,
        acquisitionDate,
        considerationSummary: {
            cashConsiderationInr: cashConsideration,
            equitySharesFairValueInr: equitySharesFairValue,
            contingentConsiderationFairValueInr: contingentConsideration,
            deferredConsiderationPresentValueInr: deferredConsiderationPv,
            preExistingInterestFairValueInr: preExistingInterest,
            totalConsiderationTransferredInr: totalConsiderationTransferred
        },
        netIdentifiableAssetsSummary: {
            tangibleAssetsFairValueInr: tangibleAssets,
            identifiableIntangiblesFairValueInr: identifiableIntangibles,
            otherAssetsFairValueInr: otherAssets,
            totalGrossAssetsFairValueInr: totalGrossAssets,
            borrowingsFairValueInr: borrowings,
            workingCapitalLiabilitiesInr: workingCapitalLiab,
            contingentLiabilitiesRecognizedInr: contingentLiab,
            deferredTaxLiabilityInr: deferredTaxLiability,
            totalLiabilitiesAssumedInr: totalLiabilitiesAssumed,
            netIdentifiableAssetsInr: netIdentifiableAssets
        },
        nonControllingInterestSummary: {
            measurementMethod: nciMethod,
            nciPercentage: nciPct,
            nciAmountInr: nciAmount
        },
        purchasePriceAllocationOutcome: {
            acquisitionBasisInr: acquisitionBasis,
            netIdentifiableAssetsInr: netIdentifiableAssets,
            disposition,
            goodwillRecognizedInr: goodwillInr,
            gainOnBargainPurchaseCapitalReserveInr: bargainPurchaseGainInr,
            transactionCostsExpensedInr: transactionCosts
        },
        journalEntries,
        isDoubleEntryBalanced,
        isAuthorizedToDisburse: false,
        statutoryRationale
    };
}

/**
 * Ind AS 115 / IFRS 15 / US GAAP ASC 606: 5-Step Revenue Recognition & Relative SSP Allocation Calculator.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateRevenueAllocationIndAs115(params = {}) {
    const rawPrice = cleanNumericAmount(params.transactionPrice, { defaultValue: 0 });
    const transactionPrice = roundToPaisa(rawPrice);
    const obligations = Array.isArray(params.performanceObligations) ? params.performanceObligations : [];

    if (transactionPrice <= 0 || obligations.length === 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 115 / IFRS 15 / US GAAP ASC 606',
            transactionPriceInr: transactionPrice,
            performanceObligationsCount: obligations.length,
            isAuthorizedToDisburse: false,
            statutoryRationale: 'Transaction price and at least one distinct performance obligation must be specified.'
        };
    }

    let totalSsp = 0;
    const prepped = obligations.map((ob, idx) => {
        const ssp = roundToPaisa(cleanNumericAmount(ob.standaloneSellingPrice, { defaultValue: 0 }));
        totalSsp += ssp;
        return {
            id: ob.id || `PO-${idx + 1}`,
            description: ob.description || `Performance Obligation ${idx + 1}`,
            standaloneSellingPrice: ssp,
            satisfactionPattern: ob.satisfactionPattern === 'POINT_IN_TIME' ? 'POINT_IN_TIME' : 'OVER_TIME',
            percentageCompletion: Math.min(100, Math.max(0, cleanNumericAmount(ob.percentageCompletion, { defaultValue: 0 }))),
            termMonths: Math.max(0, cleanNumericAmount(ob.termMonths, { defaultValue: 0 })),
            monthsElapsed: Math.max(0, cleanNumericAmount(ob.monthsElapsed, { defaultValue: 0 })),
            isPointInTimeSatisfied: Boolean(ob.isPointInTimeSatisfied),
            amountBilledToDate: roundToPaisa(cleanNumericAmount(ob.amountBilledToDate, { defaultValue: 0 }))
        };
    });

    totalSsp = roundToPaisa(totalSsp);
    const sspDenominator = totalSsp > 0 ? totalSsp : transactionPrice;
    const bundleDiscount = roundToPaisa(Math.max(0, totalSsp - transactionPrice));
    const bundleDiscountPercentage = totalSsp > 0 ? Number(((bundleDiscount / totalSsp) * 100).toFixed(2)) : 0;

    let allocatedSum = 0;
    let totalRevenueRecognized = 0;
    let totalBilled = 0;

    const allocatedObligations = prepped.map((ob, idx) => {
        let allocatedAmount = 0;
        if (idx === prepped.length - 1) {
            allocatedAmount = roundToPaisa(transactionPrice - allocatedSum);
        } else {
            const ratio = ob.standaloneSellingPrice / sspDenominator;
            allocatedAmount = roundToPaisa(transactionPrice * ratio);
            allocatedSum = roundToPaisa(allocatedSum + allocatedAmount);
        }

        let revenueRecognized = 0;
        let satisfactionProgressPercent = 0;

        if (ob.satisfactionPattern === 'POINT_IN_TIME') {
            if (ob.isPointInTimeSatisfied) {
                revenueRecognized = allocatedAmount;
                satisfactionProgressPercent = 100;
            }
        } else {
            if (ob.percentageCompletion > 0) {
                satisfactionProgressPercent = ob.percentageCompletion;
                revenueRecognized = roundToPaisa(allocatedAmount * (ob.percentageCompletion / 100));
            } else if (ob.termMonths > 0) {
                const fraction = Math.min(1, ob.monthsElapsed / ob.termMonths);
                satisfactionProgressPercent = Number((fraction * 100).toFixed(2));
                revenueRecognized = roundToPaisa(allocatedAmount * fraction);
            }
        }

        const unearnedDeferredRevenue = roundToPaisa(Math.max(0, allocatedAmount - revenueRecognized));
        totalRevenueRecognized = roundToPaisa(totalRevenueRecognized + revenueRecognized);
        totalBilled = roundToPaisa(totalBilled + ob.amountBilledToDate);

        return {
            id: ob.id,
            description: ob.description,
            standaloneSellingPriceInr: ob.standaloneSellingPrice,
            sspWeightPercentage: Number(((ob.standaloneSellingPrice / sspDenominator) * 100).toFixed(2)),
            allocatedTransactionPriceInr: allocatedAmount,
            satisfactionPattern: ob.satisfactionPattern,
            satisfactionProgressPercent,
            cumulativeRevenueRecognizedInr: revenueRecognized,
            unearnedDeferredRevenueInr: unearnedDeferredRevenue,
            amountBilledToDateInr: ob.amountBilledToDate
        };
    });

    const netContractPosition = roundToPaisa(totalRevenueRecognized - totalBilled);
    const contractAssetUnbilled = netContractPosition > 0 ? netContractPosition : 0;
    const contractLiabilityDeferred = netContractPosition < 0 ? Math.abs(netContractPosition) : 0;

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 115 / IFRS 15 / US GAAP ASC 606',
        contractId: params.contractId || 'CONTRACT-UNSPECIFIED',
        totalContractTransactionPriceInr: transactionPrice,
        totalStandaloneSellingPriceInr: totalSsp,
        bundleDiscountInr: bundleDiscount,
        bundleDiscountPercentage,
        allocatedObligations,
        totalCumulativeRevenueRecognizedInr: totalRevenueRecognized,
        totalBilledToDateInr: totalBilled,
        contractBalanceSummary: {
            netContractAssetUnbilledReceivableInr: contractAssetUnbilled,
            netContractLiabilityDeferredRevenueInr: contractLiabilityDeferred,
            disposition: contractAssetUnbilled > 0
                ? 'CONTRACT_ASSET_UNBILLED_RECEIVABLE'
                : (contractLiabilityDeferred > 0 ? 'CONTRACT_LIABILITY_DEFERRED_REVENUE' : 'CONTRACT_BALANCED')
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: `Ind AS 115 5-Step Evaluation complete: Relative SSP allocation on total contract price INR ${transactionPrice.toLocaleString('en-IN')} across ${allocatedObligations.length} obligations. Cumulative recognized revenue: INR ${totalRevenueRecognized.toLocaleString('en-IN')} vs billed INR ${totalBilled.toLocaleString('en-IN')}. Net contract balance: ${contractAssetUnbilled > 0 ? `Contract Asset INR ${contractAssetUnbilled.toLocaleString('en-IN')}` : `Contract Liability INR ${contractLiabilityDeferred.toLocaleString('en-IN')}`}.`
    };
}

/**
 * Ind AS 116 / IFRS 16 / US GAAP ASC 842: Right-of-Use (ROU) Asset & Lease Liability Amortization Schedule.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateLeaseAmortizationIndAs116(params = {}) {
    const monthlyPayment = roundToPaisa(cleanNumericAmount(params.monthlyPaymentInr, { defaultValue: 0 }));
    const termMonths = Math.max(0, Math.floor(cleanNumericAmount(params.leaseTermMonths, { defaultValue: 0 })));
    const annualRate = cleanNumericAmount(params.annualDiscountRate, { defaultValue: 0.085 });
    const isAdvance = String(params.paymentTiming || 'ARREARS').toUpperCase().trim() === 'ADVANCE';
    const directCosts = roundToPaisa(cleanNumericAmount(params.initialDirectCostsInr, { defaultValue: 0 }));
    const incentives = roundToPaisa(cleanNumericAmount(params.leaseIncentivesReceivedInr, { defaultValue: 0 }));

    if (params.electionShortTermExemption && termMonths <= 12) {
        return {
            status: 'EXEMPT_SHORT_TERM',
            standard: 'Ind AS 116 / IFRS 16 / US GAAP ASC 842',
            isCapitalizedOnBalanceSheet: false,
            statutoryStatus: 'SHORT_TERM_LEASE_OFF_BALANCE_SHEET',
            leaseTermMonths: termMonths,
            monthlyPaymentInr: monthlyPayment,
            monthlyStraightLinePnlExpenseInr: monthlyPayment,
            totalUndiscountedCashPaymentsInr: roundToPaisa(monthlyPayment * termMonths),
            initialPresentValueLeaseLiabilityInr: 0,
            initialRightOfUseAssetInr: 0,
            isAuthorizedToDisburse: false,
            statutoryRationale: `Short-term lease exemption elected under Ind AS 116. Lease term of ${termMonths} months is <= 12 months without purchase option. Lease payments recognized as rent expense on straight-line basis in P&L. Off-balance sheet.`
        };
    }

    if (params.electionLowValueExemption) {
        return {
            status: 'EXEMPT_LOW_VALUE',
            standard: 'Ind AS 116 / IFRS 16 / US GAAP ASC 842',
            isCapitalizedOnBalanceSheet: false,
            statutoryStatus: 'LOW_VALUE_LEASE_OFF_BALANCE_SHEET',
            leaseTermMonths: termMonths,
            monthlyPaymentInr: monthlyPayment,
            monthlyStraightLinePnlExpenseInr: monthlyPayment,
            totalUndiscountedCashPaymentsInr: roundToPaisa(monthlyPayment * termMonths),
            initialPresentValueLeaseLiabilityInr: 0,
            initialRightOfUseAssetInr: 0,
            isAuthorizedToDisburse: false,
            statutoryRationale: 'Low-value underlying asset exemption elected under Ind AS 116. Lease payments recognized in P&L on straight-line basis. Off-balance sheet.'
        };
    }

    if (monthlyPayment <= 0 || termMonths <= 0 || annualRate <= 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 116 / IFRS 16 / US GAAP ASC 842',
            isCapitalizedOnBalanceSheet: false,
            isAuthorizedToDisburse: false,
            statutoryRationale: 'Monthly payment, non-zero lease term, and positive incremental borrowing rate (IBR) are mandatory.'
        };
    }

    const monthlyRate = annualRate / 12;
    let pvMultiplier = (1 - Math.pow(1 + monthlyRate, -termMonths)) / monthlyRate;
    if (isAdvance) {
        pvMultiplier = pvMultiplier * (1 + monthlyRate);
    }

    const initialLiability = roundToPaisa(monthlyPayment * pvMultiplier);
    const initialRouAsset = roundToPaisa(initialLiability + directCosts - incentives);
    const monthlyDepreciation = roundToPaisa(initialRouAsset / termMonths);

    let runningLiability = initialLiability;
    let year1InterestTotal = 0;
    let year1DepreciationTotal = 0;
    let year1CashTotal = 0;
    const monthlySchedules = [];

    const previewMonths = Math.min(12, termMonths);
    for (let m = 1; m <= previewMonths; m++) {
        let interestExpense = 0;
        let principalReduction = 0;

        if (isAdvance && m === 1) {
            interestExpense = 0;
            principalReduction = monthlyPayment;
            runningLiability = roundToPaisa(runningLiability - principalReduction);
        } else {
            interestExpense = roundToPaisa(runningLiability * monthlyRate);
            principalReduction = roundToPaisa(monthlyPayment - interestExpense);
            runningLiability = roundToPaisa(Math.max(0, runningLiability - principalReduction));
        }

        year1InterestTotal = roundToPaisa(year1InterestTotal + interestExpense);
        year1DepreciationTotal = roundToPaisa(year1DepreciationTotal + monthlyDepreciation);
        year1CashTotal = roundToPaisa(year1CashTotal + monthlyPayment);

        monthlySchedules.push({
            month: m,
            openingLiabilityInr: isAdvance ? runningLiability : roundToPaisa(runningLiability + principalReduction),
            paymentInr: monthlyPayment,
            interestExpenseInr: interestExpense,
            principalReductionInr: principalReduction,
            closingLiabilityInr: runningLiability,
            monthlyRouDepreciationInr: monthlyDepreciation
        });
    }

    const totalUndiscountedCash = roundToPaisa(monthlyPayment * termMonths);
    const totalLifetimeInterest = roundToPaisa(totalUndiscountedCash - initialLiability);

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 116 / IFRS 16 / US GAAP ASC 842',
        isCapitalizedOnBalanceSheet: true,
        leaseTermMonths: termMonths,
        paymentTiming: isAdvance ? 'ADVANCE' : 'ARREARS',
        annualDiscountRate: annualRate,
        monthlyDiscountRate: Number(monthlyRate.toFixed(6)),
        monthlyContractualPaymentInr: monthlyPayment,
        totalUndiscountedCashPaymentsInr: totalUndiscountedCash,
        initialPresentValueLeaseLiabilityInr: initialLiability,
        initialRightOfUseAssetInr: initialRouAsset,
        monthlyStraightLineDepreciationInr: monthlyDepreciation,
        totalLifetimeInterestExpenseInr: totalLifetimeInterest,
        year1Summary: {
            year1CashPaymentsInr: year1CashTotal,
            year1InterestExpenseInr: year1InterestTotal,
            year1DepreciationExpenseInr: year1DepreciationTotal,
            year1TotalPnlExpenseInr: roundToPaisa(year1InterestTotal + year1DepreciationTotal),
            year1FrontLoadedVarianceInr: roundToPaisa((year1InterestTotal + year1DepreciationTotal) - year1CashTotal)
        },
        first12MonthsAmortizationPreview: monthlySchedules,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Ind AS 116 on-balance-sheet capitalization active: Present value of future lease payments discounted at ${(annualRate * 100).toFixed(2)}% IBR yields initial Lease Liability of INR ${initialLiability.toLocaleString('en-IN')} and initial ROU Asset of INR ${initialRouAsset.toLocaleString('en-IN')}. Monthly straight-line depreciation: INR ${monthlyDepreciation.toLocaleString('en-IN')}. Year 1 P&L charge: INR ${(year1InterestTotal + year1DepreciationTotal).toLocaleString('en-IN')} (Interest: INR ${year1InterestTotal.toLocaleString('en-IN')}, Depreciation: INR ${year1DepreciationTotal.toLocaleString('en-IN')}).`
    };
}

/**
 * Ind AS 109 / IFRS 9 / US GAAP ASC 326: Expected Credit Loss (ECL) Impairment Calculator.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateExpectedCreditLossIndAs109(params = {}) {
    const grossTotal = roundToPaisa(cleanNumericAmount(params.grossTradeReceivablesInr, { defaultValue: 0 }));
    const rawBuckets = Array.isArray(params.agingBuckets) ? params.agingBuckets : [];
    const macroFactor = cleanNumericAmount(params.macroeconomicAdjustmentFactor, { defaultValue: 1.0 });
    const lgdPercent = cleanNumericAmount(params.lossGivenDefaultPercent, { defaultValue: 100.0 });
    const asOfDate = params.reportingDate || new Date().toISOString().split('T')[0];

    if (grossTotal <= 0 && rawBuckets.length === 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 109 / IFRS 9 / US GAAP ASC 326',
            isAuthorizedToDisburse: false,
            statutoryRationale: 'Gross trade receivables or non-empty aging buckets are mandatory.'
        };
    }

    let totalComputedGross = 0;
    let totalLossAllowance = 0;
    let stage1Allowance = 0;
    let stage2Allowance = 0;
    let stage3Allowance = 0;
    let stage1Gross = 0;
    let stage2Gross = 0;
    let stage3Gross = 0;

    const evaluatedBuckets = rawBuckets.map((b, idx) => {
        const bucketGross = roundToPaisa(cleanNumericAmount(b.grossAmountInr, { defaultValue: 0 }));
        const histRate = cleanNumericAmount(b.historicalDefaultRatePercent, { defaultValue: 0 });
        const stage = Number(b.stage || (idx === 0 ? 1 : (idx === rawBuckets.length - 1 ? 3 : 2)));

        const effectiveLossRatePercent = Number(Math.min(100, Math.max(0, histRate * macroFactor * (lgdPercent / 100))).toFixed(4));
        const allowance = roundToPaisa(bucketGross * (effectiveLossRatePercent / 100));
        const netCarryingAmount = roundToPaisa(bucketGross - allowance);

        totalComputedGross = roundToPaisa(totalComputedGross + bucketGross);
        totalLossAllowance = roundToPaisa(totalLossAllowance + allowance);

        if (stage === 1) {
            stage1Gross = roundToPaisa(stage1Gross + bucketGross);
            stage1Allowance = roundToPaisa(stage1Allowance + allowance);
        } else if (stage === 2) {
            stage2Gross = roundToPaisa(stage2Gross + bucketGross);
            stage2Allowance = roundToPaisa(stage2Allowance + allowance);
        } else {
            stage3Gross = roundToPaisa(stage3Gross + bucketGross);
            stage3Allowance = roundToPaisa(stage3Allowance + allowance);
        }

        return {
            bucketLabel: b.bucketLabel || `Bracket-${idx + 1}`,
            grossAmountInr: bucketGross,
            stage,
            historicalDefaultRatePercent: histRate,
            effectiveLossRatePercent,
            lossAllowanceInr: allowance,
            netCarryingAmountInr: netCarryingAmount
        };
    });

    const reconciledGross = grossTotal > 0 ? grossTotal : totalComputedGross;
    const netReceivables = roundToPaisa(reconciledGross - totalLossAllowance);
    const overallEffectiveRate = reconciledGross > 0 ? Number(((totalLossAllowance / reconciledGross) * 100).toFixed(2)) : 0;

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 109 / IFRS 9 / US GAAP ASC 326',
        asOfDate,
        grossTradeReceivablesInr: reconciledGross,
        totalExpectedCreditLossAllowanceInr: totalLossAllowance,
        netTradeReceivablesCarryingAmountInr: netReceivables,
        overallEffectiveLossRatePercent: overallEffectiveRate,
        macroeconomicAdjustmentFactor: macroFactor,
        stagingSummary: {
            stage1: { grossInr: stage1Gross, allowanceInr: stage1Allowance, label: '12-Month ECL (Performing)' },
            stage2: { grossInr: stage2Gross, allowanceInr: stage2Allowance, label: 'Lifetime ECL (SICR / Underperforming)' },
            stage3: { grossInr: stage3Gross, allowanceInr: stage3Allowance, label: 'Lifetime ECL (Credit Impaired / Default)' }
        },
        agingBuckets: evaluatedBuckets,
        taxTreatment: {
            isTaxDeductibleInCurrentYear: false,
            statutoryAddBackSection: 'Section 36(1)(vii) read with Section 40A(9) Income-tax Act, 1961',
            taxConsequence: `ECL impairment provision of INR ${totalLossAllowance.toLocaleString('en-IN')} is not deductible for Indian corporate tax purposes until actual bad debt write-off. Recognizes a Deferred Tax Asset (DTA) under Ind AS 12.`
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: `Ind AS 109 Simplified Approach: Expected Credit Loss provision of INR ${totalLossAllowance.toLocaleString('en-IN')} computed on gross receivables of INR ${reconciledGross.toLocaleString('en-IN')} (overall rate: ${overallEffectiveRate}%). Net receivables on balance sheet: INR ${netReceivables.toLocaleString('en-IN')}. Accounting impairment does not authorize fund disbursement.`
    };
}

/**
 * Ind AS 102 / IFRS 2 / US GAAP ASC 718: ESOP Graded Vesting Amortization Calculator.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateEsopAmortizationIndAs102(params = {}) {
    const totalOptions = Math.max(0, Math.floor(cleanNumericAmount(params.totalOptionsGranted, { defaultValue: 0 })));
    const fairValuePerOption = roundToPaisa(cleanNumericAmount(params.grantDateFairValuePerOptionInr, { defaultValue: 0 }));
    const defaultTranches = [
        { trancheNumber: 1, vestingYears: 1, allocationPercentage: 25, expectedForfeitureRate: 0 },
        { trancheNumber: 2, vestingYears: 2, allocationPercentage: 25, expectedForfeitureRate: 0 },
        { trancheNumber: 3, vestingYears: 3, allocationPercentage: 25, expectedForfeitureRate: 0 },
        { trancheNumber: 4, vestingYears: 4, allocationPercentage: 25, expectedForfeitureRate: 0 }
    ];
    const tranches = Array.isArray(params.vestingTranches) && params.vestingTranches.length > 0 ? params.vestingTranches : defaultTranches;

    if (totalOptions <= 0 || fairValuePerOption <= 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 102 / IFRS 2 / US GAAP ASC 718',
            isAuthorizedToDisburse: false,
            statutoryRationale: 'Total options granted and positive grant-date fair value per option are mandatory.'
        };
    }

    const totalGrantDateFairValue = roundToPaisa(totalOptions * fairValuePerOption);
    let maxVestingYear = 1;
    let totalAllocatedOptions = 0;
    let totalAdjustedFairValue = 0;

    const processedTranches = tranches.map((t, idx) => {
        const trancheNum = t.trancheNumber || idx + 1;
        const years = Math.max(0.5, cleanNumericAmount(t.vestingYears, { defaultValue: idx + 1 }));
        if (years > maxVestingYear) maxVestingYear = Math.ceil(years);

        const allocPct = cleanNumericAmount(t.allocationPercentage, { defaultValue: 100 / tranches.length });
        const forfeitRate = cleanNumericAmount(t.expectedForfeitureRate, { defaultValue: 0 });

        const nominalOptions = Math.floor(totalOptions * (allocPct / 100));
        const effectiveOptions = Math.floor(nominalOptions * (1 - forfeitRate / 100));
        const trancheFairValue = roundToPaisa(effectiveOptions * fairValuePerOption);
        const annualAmortization = roundToPaisa(trancheFairValue / years);

        totalAllocatedOptions += effectiveOptions;
        totalAdjustedFairValue = roundToPaisa(totalAdjustedFairValue + trancheFairValue);

        return {
            trancheNumber: trancheNum,
            vestingYears: years,
            allocationPercentage: allocPct,
            expectedForfeitureRatePercent: forfeitRate,
            effectiveOptionsGranted: effectiveOptions,
            trancheGrantDateFairValueInr: trancheFairValue,
            annualAmortizationExpenseInr: annualAmortization
        };
    });

    const yearlyExpenseProfile = [];
    let cumulativeExpense = 0;
    for (let yr = 1; yr <= maxVestingYear; yr++) {
        let yearExpense = 0;
        for (const pt of processedTranches) {
            if (yr <= Math.ceil(pt.vestingYears)) {
                yearExpense = roundToPaisa(yearExpense + pt.annualAmortizationExpenseInr);
            }
        }
        cumulativeExpense = roundToPaisa(cumulativeExpense + yearExpense);
        yearlyExpenseProfile.push({
            year: yr,
            pnlCompensationExpenseInr: yearExpense,
            cumulativeExpenseRecognizedInr: cumulativeExpense,
            closingShareBasedPaymentReserveInr: cumulativeExpense
        });
    }

    const year1Expense = yearlyExpenseProfile.length > 0 ? yearlyExpenseProfile[0].pnlCompensationExpenseInr : 0;
    const flatStraightLineAverage = roundToPaisa(totalAdjustedFairValue / maxVestingYear);
    const isFrontLoaded = year1Expense > flatStraightLineAverage;

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 102 / IFRS 2 / US GAAP ASC 718',
        schemeName: params.schemeName || 'SCHEME-DEFAULT-ESOP',
        totalOptionsGranted: totalOptions,
        effectiveVestingOptions: totalAllocatedOptions,
        grantDateFairValuePerOptionInr: fairValuePerOption,
        totalNominalGrantDateFairValueInr: totalGrantDateFairValue,
        totalNetFairValueToExpenseInr: totalAdjustedFairValue,
        maxVestingYears: maxVestingYear,
        isGradedVestingFrontLoaded: isFrontLoaded,
        year1ExpenseComparison: {
            year1GradedVestingExpenseInr: year1Expense,
            hypotheticalFlatAverageInr: flatStraightLineAverage,
            frontLoadingAccelerationInr: roundToPaisa(year1Expense - flatStraightLineAverage)
        },
        vestingTranches: processedTranches,
        yearlyExpenseProfile,
        taxTreatment: {
            statutoryDeductionSection: 'Section 37(1) Income-tax Act, 1961 (Biocon Special Bench Principle)',
            perquisiteTaxSection: 'Section 17(2)(vi) read with Rule 3(8) Income-tax Rules, 1962',
            deductibilitySummary: `Company is eligible to claim ESOP discount as an allowable business deduction under Section 37(1) spread over the vesting period. Upon exercise, employee is subject to salary TDS under Section 192 on perquisite value (FMV on exercise date minus exercise price).`
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: `Ind AS 102 Graded Vesting: Total ESOP fair value INR ${totalAdjustedFairValue.toLocaleString('en-IN')} across ${processedTranches.length} tranches. Mandatory separate-tranche accounting produces Year 1 front-loaded expense of INR ${year1Expense.toLocaleString('en-IN')} (vs flat average INR ${flatStraightLineAverage.toLocaleString('en-IN')}). Share-based compensation does not authorize cash disbursement.`
    };
}

/**
 * Ind AS 12 / IAS 12 / US GAAP ASC 740: Income Taxes & Deferred Tax (DTA / DTL) Calculator.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateDeferredTaxIndAs12(params = {}) {
    const bookProfit = roundToPaisa(cleanNumericAmount(params.accountingProfitBeforeTaxInr, { defaultValue: 0 }));
    const taxRatePercent = cleanNumericAmount(params.enactedTaxRatePercent, { defaultValue: 25.168 });
    const taxRate = taxRatePercent / 100;
    const diffs = params.temporaryDifferences || {};
    const permanentDiffs = roundToPaisa(cleanNumericAmount(params.permanentDifferencesInr, { defaultValue: 0 }));
    const openingNetDta = roundToPaisa(cleanNumericAmount(params.openingNetDtaInr, { defaultValue: 0 }));
    const fy = params.financialYear || '2025-26';

    if (taxRate <= 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 12 / IAS 12 / US GAAP ASC 740',
            isAuthorizedToDisburse: false,
            statutoryRationale: 'Positive enacted tax rate is mandatory.'
        };
    }

    const msme43bH = roundToPaisa(cleanNumericAmount(diffs.msmeDisallowanceSec43bHInr, { defaultValue: 0 }));
    const statutory43B = roundToPaisa(cleanNumericAmount(diffs.statutoryDuesUnpaidSec43BInr, { defaultValue: 0 }));
    const ecl109 = roundToPaisa(cleanNumericAmount(diffs.eclLossAllowanceIndAs109Inr, { defaultValue: 0 }));
    const lease116 = roundToPaisa(cleanNumericAmount(diffs.leaseLiabilityNetIndAs116Inr, { defaultValue: 0 }));
    const esop102 = roundToPaisa(cleanNumericAmount(diffs.esopReserveUnvestedIndAs102Inr, { defaultValue: 0 }));
    const otherDeductible = roundToPaisa(cleanNumericAmount(diffs.otherDeductibleDifferencesInr, { defaultValue: 0 }));

    const totalDeductibleDifferences = roundToPaisa(msme43bH + statutory43B + ecl109 + lease116 + esop102 + otherDeductible);
    const grossDta = roundToPaisa(totalDeductibleDifferences * taxRate);

    const accelDep32 = roundToPaisa(cleanNumericAmount(diffs.acceleratedTaxDepreciationSec32Inr, { defaultValue: 0 }));
    const otherTaxable = roundToPaisa(cleanNumericAmount(diffs.otherTaxableDifferencesInr, { defaultValue: 0 }));

    const totalTaxableDifferences = roundToPaisa(accelDep32 + otherTaxable);
    const grossDtl = roundToPaisa(totalTaxableDifferences * taxRate);

    const netDeferredTaxBalance = roundToPaisa(grossDta - grossDtl);
    const closingNetDta = netDeferredTaxBalance > 0 ? netDeferredTaxBalance : 0;
    const closingNetDtl = netDeferredTaxBalance < 0 ? Math.abs(netDeferredTaxBalance) : 0;

    const taxableProfit = roundToPaisa(Math.max(0, bookProfit + totalDeductibleDifferences - totalTaxableDifferences + permanentDiffs));
    const currentTaxExpense = roundToPaisa(taxableProfit * taxRate);

    const deferredTaxPnlCharge = roundToPaisa(openingNetDta - netDeferredTaxBalance);
    const totalTaxExpense = roundToPaisa(currentTaxExpense + deferredTaxPnlCharge);

    const theoreticalTaxOnBookProfit = roundToPaisa(bookProfit * taxRate);
    const taxEffectPermanent = roundToPaisa(permanentDiffs * taxRate);
    const effectiveTaxRatePercent = bookProfit > 0 ? Number(((totalTaxExpense / bookProfit) * 100).toFixed(2)) : 0;

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 12 / IAS 12 / US GAAP ASC 740',
        financialYear: fy,
        accountingProfitBeforeTaxInr: bookProfit,
        enactedCorporateTaxRatePercent: taxRatePercent,
        taxableProfitForIncomeTaxInr: taxableProfit,
        currentTaxLiabilityInr: currentTaxExpense,
        temporaryDifferencesSummary: {
            totalDeductibleDifferencesInr: totalDeductibleDifferences,
            totalTaxableDifferencesInr: totalTaxableDifferences,
            netTemporaryDifferenceInr: roundToPaisa(totalDeductibleDifferences - totalTaxableDifferences),
            breakdown: {
                msmeDisallowanceSec43bHInr: msme43bH,
                statutoryDuesSec43BInr: statutory43B,
                eclLossAllowanceIndAs109Inr: ecl109,
                leaseNetIndAs116Inr: lease116,
                esopReserveIndAs102Inr: esop102,
                acceleratedTaxDepreciationSec32Inr: accelDep32
            }
        },
        balanceSheetPosition: {
            grossDeferredTaxAssetInr: grossDta,
            grossDeferredTaxLiabilityInr: grossDtl,
            netDeferredTaxAssetBalanceSheetInr: closingNetDta,
            netDeferredTaxLiabilityBalanceSheetInr: closingNetDtl,
            disposition: closingNetDta > 0 ? 'NET_DEFERRED_TAX_ASSET' : (closingNetDtl > 0 ? 'NET_DEFERRED_TAX_LIABILITY' : 'BALANCED')
        },
        statementOfProfitAndLossTaxExpense: {
            currentTaxExpenseInr: currentTaxExpense,
            deferredTaxExpenseOrCreditInr: deferredTaxPnlCharge,
            totalTaxExpenseInr: totalTaxExpense
        },
        effectiveTaxRateReconciliation: {
            theoreticalTaxExpenseAtStatutoryRateInr: theoreticalTaxOnBookProfit,
            taxEffectOfPermanentDifferencesInr: taxEffectPermanent,
            reconciledTotalTaxExpenseInr: totalTaxExpense,
            effectiveTaxRatePercent,
            statutoryTaxRatePercent: taxRatePercent,
            rateVariancePercent: Number((effectiveTaxRatePercent - taxRatePercent).toFixed(2))
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: `Ind AS 12 Balance Sheet Method: Current Tax of INR ${currentTaxExpense.toLocaleString('en-IN')} (Taxable Profit: INR ${taxableProfit.toLocaleString('en-IN')}). Closing Net ${closingNetDta > 0 ? `DTA of INR ${closingNetDta.toLocaleString('en-IN')}` : `DTL of INR ${closingNetDtl.toLocaleString('en-IN')}`}. Total P&L Tax Expense: INR ${totalTaxExpense.toLocaleString('en-IN')} (ETR: ${effectiveTaxRatePercent}% vs statutory ${taxRatePercent}%). Tax calculations do not authorize payment disbursement.`
    };
}

/**
 * Ind AS 37 / IAS 37 / US GAAP ASC 450: Provisions, Contingent Liabilities & Contingent Assets Evaluator.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function evaluateProvisionsAndContingenciesIndAs37(params = {}) {
    const rawItems = Array.isArray(params.exposureItems) ? params.exposureItems : [];
    const asOfDate = params.reportingDate || new Date().toISOString().split('T')[0];

    if (rawItems.length === 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 37 / IAS 37 / US GAAP ASC 450',
            isAuthorizedToDisburse: false,
            statutoryRationale: 'At least one exposure item must be provided for evaluation.'
        };
    }

    let totalProvisionsAccrued = 0;
    let totalContingentLiabilities = 0;
    let totalRemoteExposures = 0;
    let totalReimbursements = 0;

    const classifiedItems = rawItems.map((item, idx) => {
        const claimId = item.claimId || `EXP-${idx + 1}`;
        const desc = item.description || `Exposure item ${idx + 1}`;
        const claimedAmt = roundToPaisa(cleanNumericAmount(item.claimedAmountInr, { defaultValue: 0 }));
        const estimateAmt = roundToPaisa(cleanNumericAmount(item.bestEstimateAmountInr, { defaultValue: claimedAmt }));
        const prob = cleanNumericAmount(item.outflowProbabilityPercent, { defaultValue: 0 });
        const measurable = item.isReliablyMeasurable !== false;
        const reimb = roundToPaisa(cleanNumericAmount(item.expectedReimbursementInr, { defaultValue: 0 }));
        const disputeType = item.disputeType || 'STATUTORY_TAX_DISPUTE';

        let classification = '';
        let accountingTreatment = '';
        let provisionAmount = 0;
        let contingentAmount = 0;
        let remoteAmount = 0;

        if (prob > 50 && measurable) {
            classification = 'PROVISION_RECOGNIZED_ON_BALANCE_SHEET';
            provisionAmount = Math.max(0, roundToPaisa(estimateAmt - reimb));
            accountingTreatment = 'Recognize accrued liability on balance sheet and charge expense to profit or loss.';
            totalProvisionsAccrued = roundToPaisa(totalProvisionsAccrued + provisionAmount);
            totalReimbursements = roundToPaisa(totalReimbursements + reimb);
        } else if (prob >= 5 || (prob > 50 && !measurable)) {
            classification = 'CONTINGENT_LIABILITY_DISCLOSED_IN_NOTES';
            contingentAmount = estimateAmt;
            accountingTreatment = 'Do not recognize liability on balance sheet. Disclose in Schedule III Notes to Accounts.';
            totalContingentLiabilities = roundToPaisa(totalContingentLiabilities + contingentAmount);
        } else {
            classification = 'REMOTE_NO_DISCLOSURE_REQUIRED';
            remoteAmount = estimateAmt;
            accountingTreatment = 'Outflow probability is remote (< 5%). Neither recognition nor disclosure required.';
            totalRemoteExposures = roundToPaisa(totalRemoteExposures + remoteAmount);
        }

        return {
            claimId,
            description: desc,
            disputeType,
            claimedAmountInr: claimedAmt,
            bestEstimateAmountInr: estimateAmt,
            outflowProbabilityPercent: prob,
            isReliablyMeasurable: measurable,
            classification,
            accountingTreatment,
            provisionRecognizedInr: provisionAmount,
            contingentLiabilityDisclosedInr: contingentAmount,
            remoteAmountInr: remoteAmount,
            expectedReimbursementInr: reimb
        };
    });

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 37 / IAS 37 / US GAAP ASC 450',
        asOfDate,
        totalItemsEvaluated: classifiedItems.length,
        summary: {
            totalProvisionsAccruedOnBalanceSheetInr: totalProvisionsAccrued,
            totalContingentLiabilitiesDisclosedInNotesInr: totalContingentLiabilities,
            totalRemoteExposuresNoDisclosureInr: totalRemoteExposures,
            totalExpectedReimbursementsInr: totalReimbursements
        },
        classifiedExposures: classifiedItems,
        scheduleThreeDisclosureNote: `Contingent Liabilities and Commitments (to the extent not provided for): The company has contingent liabilities of INR ${totalContingentLiabilities.toLocaleString('en-IN')} in respect of disputed statutory demands and claims under appeal where adverse outflow is possible (5%-50%) but not probable. Balance sheet provisions of INR ${totalProvisionsAccrued.toLocaleString('en-IN')} have been recognized where outflow is probable (> 50%).`,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Ind AS 37 Evaluation complete: ${classifiedItems.length} exposures evaluated. Balance Sheet Provisions accrued: INR ${totalProvisionsAccrued.toLocaleString('en-IN')}; Footnote Contingent Liabilities: INR ${totalContingentLiabilities.toLocaleString('en-IN')}; Remote exclusions: INR ${totalRemoteExposures.toLocaleString('en-IN')}. Evaluation of legal claims does not authorize payment disbursement.`
    };
}

/**
 * Ind AS 21 / IAS 21 / US GAAP ASC 830: Foreign Currency Monetary Revaluation & FCTR Translation Calculator.
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateForeignCurrencyIndAs21(params = {}) {
    const asOfDate = params.asOfDate || new Date().toISOString().split('T')[0];
    const functionalCurrency = params.functionalCurrency || 'INR';
    const rawItems = Array.isArray(params.items) ? params.items : [];
    const foreignOps = Array.isArray(params.foreignOperations) ? params.foreignOperations : [];

    if (rawItems.length === 0 && foreignOps.length === 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 21 / IAS 21 / US GAAP ASC 830',
            asOfDate,
            itemsCount: 0,
            isAuthorizedToDisburse: false,
            statutoryRationale: 'At least one foreign currency item or foreign operation package must be provided for evaluation.'
        };
    }

    let totalOriginalBookValueInr = 0;
    let totalClosingBookValueInr = 0;
    let totalUnrealizedGainInr = 0;
    let totalUnrealizedLossInr = 0;
    const journalEntries = [];

    const revaluedItems = rawItems.map((item, idx) => {
        const id = item.id || `FX-ITEM-${idx + 1}`;
        const description = item.description || `Foreign Currency Exposure ${idx + 1}`;
        const itemType = String(item.itemType || 'MONETARY_ASSET').toUpperCase().trim();
        const foreignCurrency = item.foreignCurrency || 'USD';
        const foreignAmount = cleanNumericAmount(item.foreignAmount, { defaultValue: 0 });
        const bookingRate = cleanNumericAmount(item.bookingRate, { defaultValue: 1 });
        const closingRate = cleanNumericAmount(item.closingRate, { defaultValue: bookingRate });

        const originalBookValueInr = roundToPaisa(foreignAmount * bookingRate);
        totalOriginalBookValueInr = roundToPaisa(totalOriginalBookValueInr + originalBookValueInr);

        let closingBookValueInr = originalBookValueInr;
        let unrealizedGainLossInr = 0;
        let treatment = '';
        let glImpact = 'NONE';

        if (itemType === 'NON_MONETARY_HISTORICAL') {
            closingBookValueInr = originalBookValueInr;
            unrealizedGainLossInr = 0;
            treatment = 'Carried at historical exchange rate under Ind AS 21.23(b). No closing revaluation recognized.';
        } else if (itemType === 'MONETARY_ASSET') {
            closingBookValueInr = roundToPaisa(foreignAmount * closingRate);
            unrealizedGainLossInr = roundToPaisa(closingBookValueInr - originalBookValueInr);

            if (unrealizedGainLossInr > 0) {
                treatment = 'Unrealized foreign exchange gain credited to Statement of Profit & Loss.';
                glImpact = 'CREDIT_PL_GAIN';
                totalUnrealizedGainInr = roundToPaisa(totalUnrealizedGainInr + unrealizedGainLossInr);
                journalEntries.push({
                    account: `Foreign Trade Receivables (${foreignCurrency})`,
                    type: 'CURRENT_ASSET',
                    debitInr: unrealizedGainLossInr,
                    creditInr: 0,
                    reference: id
                });
                journalEntries.push({
                    account: 'Foreign Exchange Fluctuation Gain (P&L)',
                    type: 'OTHER_INCOME',
                    debitInr: 0,
                    creditInr: unrealizedGainLossInr,
                    reference: id
                });
            } else if (unrealizedGainLossInr < 0) {
                const lossAmt = Math.abs(unrealizedGainLossInr);
                treatment = 'Unrealized foreign exchange loss debited to Statement of Profit & Loss.';
                glImpact = 'DEBIT_PL_LOSS';
                totalUnrealizedLossInr = roundToPaisa(totalUnrealizedLossInr + lossAmt);
                journalEntries.push({
                    account: 'Foreign Exchange Fluctuation Loss (P&L)',
                    type: 'FINANCE_EXPENSE',
                    debitInr: lossAmt,
                    creditInr: 0,
                    reference: id
                });
                journalEntries.push({
                    account: `Foreign Trade Receivables (${foreignCurrency})`,
                    type: 'CURRENT_ASSET',
                    debitInr: 0,
                    creditInr: lossAmt,
                    reference: id
                });
            } else {
                treatment = 'No foreign exchange variance detected at reporting date.';
            }
        } else if (itemType === 'MONETARY_LIABILITY') {
            closingBookValueInr = roundToPaisa(foreignAmount * closingRate);
            unrealizedGainLossInr = roundToPaisa(originalBookValueInr - closingBookValueInr);

            if (unrealizedGainLossInr > 0) {
                treatment = 'Unrealized foreign exchange gain (liability reduction) credited to P&L.';
                glImpact = 'CREDIT_PL_GAIN';
                totalUnrealizedGainInr = roundToPaisa(totalUnrealizedGainInr + unrealizedGainLossInr);
                journalEntries.push({
                    account: `Foreign Trade Payables (${foreignCurrency})`,
                    type: 'CURRENT_LIABILITY',
                    debitInr: unrealizedGainLossInr,
                    creditInr: 0,
                    reference: id
                });
                journalEntries.push({
                    account: 'Foreign Exchange Fluctuation Gain (P&L)',
                    type: 'OTHER_INCOME',
                    debitInr: 0,
                    creditInr: unrealizedGainLossInr,
                    reference: id
                });
            } else if (unrealizedGainLossInr < 0) {
                const lossAmt = Math.abs(unrealizedGainLossInr);
                treatment = 'Unrealized foreign exchange loss (liability expansion) debited to P&L.';
                glImpact = 'DEBIT_PL_LOSS';
                totalUnrealizedLossInr = roundToPaisa(totalUnrealizedLossInr + lossAmt);
                journalEntries.push({
                    account: 'Foreign Exchange Fluctuation Loss (P&L)',
                    type: 'FINANCE_EXPENSE',
                    debitInr: lossAmt,
                    creditInr: 0,
                    reference: id
                });
                journalEntries.push({
                    account: `Foreign Trade Payables (${foreignCurrency})`,
                    type: 'CURRENT_LIABILITY',
                    debitInr: 0,
                    creditInr: lossAmt,
                    reference: id
                });
            } else {
                treatment = 'No foreign exchange variance detected at reporting date.';
            }
        }

        totalClosingBookValueInr = roundToPaisa(totalClosingBookValueInr + closingBookValueInr);

        return {
            id,
            description,
            itemType,
            foreignCurrency,
            foreignAmount,
            bookingRate,
            closingRate,
            originalBookValueInr,
            closingBookValueInr,
            unrealizedGainLossInr,
            treatment,
            glImpact
        };
    });

    const netUnrealizedPnLInr = roundToPaisa(totalUnrealizedGainInr - totalUnrealizedLossInr);

    let totalFctrReserveInr = 0;
    const translatedOperations = foreignOps.map((op, idx) => {
        const entityName = op.entityName || `Foreign Subsidiary ${idx + 1}`;
        const closingRate = cleanNumericAmount(op.closingRate, { defaultValue: 1 });
        const averageRate = cleanNumericAmount(op.averageRate, { defaultValue: closingRate });
        const assetsForeign = cleanNumericAmount(op.totalAssetsForeign, { defaultValue: 0 });
        const liabilitiesForeign = cleanNumericAmount(op.totalLiabilitiesForeign, { defaultValue: 0 });
        const netIncomeForeign = cleanNumericAmount(op.netIncomeForeign, { defaultValue: 0 });
        const shareCapitalInr = cleanNumericAmount(op.shareCapitalInr, { defaultValue: 0 });
        const openingRetainedEarningsInr = cleanNumericAmount(op.openingRetainedEarningsInr, { defaultValue: 0 });

        const assetsInr = roundToPaisa(assetsForeign * closingRate);
        const liabilitiesInr = roundToPaisa(liabilitiesForeign * closingRate);
        const netAssetsClosingInr = roundToPaisa(assetsInr - liabilitiesInr);
        const netIncomeAverageInr = roundToPaisa(netIncomeForeign * averageRate);
        const totalEquityPreFctrInr = roundToPaisa(shareCapitalInr + openingRetainedEarningsInr + netIncomeAverageInr);

        const fctrInr = roundToPaisa(netAssetsClosingInr - totalEquityPreFctrInr);
        totalFctrReserveInr = roundToPaisa(totalFctrReserveInr + fctrInr);

        return {
            entityName,
            closingRate,
            averageRate,
            totalAssetsInr: assetsInr,
            totalLiabilitiesInr: liabilitiesInr,
            netAssetsClosingInr,
            netIncomeInr: netIncomeAverageInr,
            fctrBalanceInr: fctrInr,
            treatment: 'Translation difference routed to Foreign Currency Translation Reserve (FCTR) in Other Comprehensive Income (OCI) under Ind AS 21.39.'
        };
    });

    const totalDebits = roundToPaisa(journalEntries.reduce((acc, e) => acc + e.debitInr, 0));
    const totalCredits = roundToPaisa(journalEntries.reduce((acc, e) => acc + e.creditInr, 0));
    const isDoubleEntryBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 21 / IAS 21 / US GAAP ASC 830',
        asOfDate,
        functionalCurrency,
        totalItemsEvaluated: revaluedItems.length,
        foreignOperationsCount: translatedOperations.length,
        summary: {
            totalOriginalBookValueInr,
            totalClosingBookValueInr,
            totalUnrealizedGainInr,
            totalUnrealizedLossInr,
            netUnrealizedPnLInr,
            totalFctrReserveInr,
            isDoubleEntryBalanced,
            totalDebitsInr: totalDebits,
            totalCreditsInr: totalCredits
        },
        revaluedItems,
        translatedForeignOperations: translatedOperations,
        journalEntries,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Ind AS 21 evaluation completed: ${revaluedItems.length} monetary/non-monetary exposures revalued. Net unrealized P&L variance: INR ${netUnrealizedPnLInr.toLocaleString('en-IN')}; Total FCTR in OCI: INR ${totalFctrReserveInr.toLocaleString('en-IN')}. General Ledger vouchers balanced at INR ${totalDebits.toLocaleString('en-IN')}. Foreign currency revaluation does not authorize payment disbursement.`
    };
}

/**
 * Ind AS 36 / IAS 36 / US GAAP ASC 360 & 350: Impairment of Assets & Cash-Generating Units (CGU).
 */
/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function calculateImpairmentIndAs36(params = {}) {
    const asOfDate = params.asOfDate || new Date().toISOString().split('T')[0];
    const cguId = params.cguId || 'CGU-01';
    const cguName = params.cguName || 'Corporate Cash-Generating Unit';

    const rawAmounts = params.carryingAmounts || {};
    const goodwill = roundToPaisa(cleanNumericAmount(rawAmounts.goodwill, { defaultValue: 0 }));
    const ppe = roundToPaisa(cleanNumericAmount(rawAmounts.propertyPlantEquipment, { defaultValue: 0 }));
    const intangibles = roundToPaisa(cleanNumericAmount(rawAmounts.intangibleAssets, { defaultValue: 0 }));
    const otherNonCurrent = roundToPaisa(cleanNumericAmount(rawAmounts.otherNonCurrentAssets, { defaultValue: 0 }));

    const totalCarryingAmount = roundToPaisa(goodwill + ppe + intangibles + otherNonCurrent);

    if (totalCarryingAmount <= 0) {
        return {
            status: 'INSUFFICIENT_DATA',
            standard: 'Ind AS 36 / IAS 36 / US GAAP ASC 360',
            cguId,
            totalCarryingAmountInr: 0,
            isAuthorizedToDisburse: false,
            statutoryRationale: 'Carrying amounts must be greater than zero for impairment evaluation.'
        };
    }

    const rad = params.recoverableAmountDetermination || {};
    const fvlcod = roundToPaisa(cleanNumericAmount(rad.fairValueLessCostsOfDisposal, { defaultValue: 0 }));

    let valueInUse = 0;
    let discountRate = 0;
    const discountedCashFlows = [];

    if (rad.valueInUse && typeof rad.valueInUse === 'object') {
        discountRate = cleanNumericAmount(rad.valueInUse.preTaxDiscountRatePercent, { defaultValue: 10 }) / 100;
        const cashFlows = Array.isArray(rad.valueInUse.projectedCashFlows) ? rad.valueInUse.projectedCashFlows : [];

        let pvSum = 0;
        cashFlows.forEach((cfRaw, idx) => {
            const year = idx + 1;
            const cf = cleanNumericAmount(cfRaw, { defaultValue: 0 });
            const discountFactor = 1 / Math.pow(1 + discountRate, year);
            const presentValue = roundToPaisa(cf * discountFactor);
            pvSum = roundToPaisa(pvSum + presentValue);
            discountedCashFlows.push({ year, cashFlow: cf, discountFactor: Number(discountFactor.toFixed(4)), presentValue });
        });

        let terminalPv = 0;
        if (rad.valueInUse.terminalValue) {
            const tv = cleanNumericAmount(rad.valueInUse.terminalValue, { defaultValue: 0 });
            const finalYear = cashFlows.length || 1;
            const tvDiscountFactor = 1 / Math.pow(1 + discountRate, finalYear);
            terminalPv = roundToPaisa(tv * tvDiscountFactor);
        } else if (rad.valueInUse.terminalGrowthRatePercent && cashFlows.length > 0) {
            const g = cleanNumericAmount(rad.valueInUse.terminalGrowthRatePercent, { defaultValue: 2 }) / 100;
            const finalCf = cleanNumericAmount(cashFlows[cashFlows.length - 1], { defaultValue: 0 });
            if (discountRate > g) {
                const tv = (finalCf * (1 + g)) / (discountRate - g);
                const finalYear = cashFlows.length;
                const tvDiscountFactor = 1 / Math.pow(1 + discountRate, finalYear);
                terminalPv = roundToPaisa(tv * tvDiscountFactor);
            }
        }

        valueInUse = roundToPaisa(pvSum + terminalPv);
    }

    const recoverableAmount = Math.max(fvlcod, valueInUse);
    const recoverableMethod = fvlcod >= valueInUse ? 'FAIR_VALUE_LESS_COSTS_OF_DISPOSAL' : 'VALUE_IN_USE';

    let impairmentRequired = false;
    let totalImpairmentLoss = 0;
    let postImpairmentCarryingAmount = totalCarryingAmount;
    let goodwillImpairment = 0;
    let ppeImpairment = 0;
    let intangiblesImpairment = 0;
    let otherImpairment = 0;
    const journalEntries = [];

    if (recoverableAmount < totalCarryingAmount) {
        impairmentRequired = true;
        totalImpairmentLoss = roundToPaisa(totalCarryingAmount - recoverableAmount);
        postImpairmentCarryingAmount = recoverableAmount;

        let remainingLoss = totalImpairmentLoss;
        if (goodwill > 0) {
            goodwillImpairment = Math.min(goodwill, remainingLoss);
            remainingLoss = roundToPaisa(remainingLoss - goodwillImpairment);
            journalEntries.push({
                account: 'Accumulated Impairment - Goodwill',
                type: 'INTANGIBLE_ASSET_CONTRA',
                debitInr: 0,
                creditInr: goodwillImpairment,
                rule: 'Ind AS 36.104(a) Goodwill Priority Write-Down'
            });
        }

        const floors = params.assetFloors || {};
        const ppeFloor = cleanNumericAmount(floors.propertyPlantEquipment, { defaultValue: 0 });
        const intFloor = cleanNumericAmount(floors.intangibleAssets, { defaultValue: 0 });
        const otherFloor = cleanNumericAmount(floors.otherNonCurrentAssets, { defaultValue: 0 });

        const ppeMaxWriteDown = Math.max(0, ppe - ppeFloor);
        const intMaxWriteDown = Math.max(0, intangibles - intFloor);
        const otherMaxWriteDown = Math.max(0, otherNonCurrent - otherFloor);
        const totalEligibleBase = ppeMaxWriteDown + intMaxWriteDown + otherMaxWriteDown;

        if (remainingLoss > 0 && totalEligibleBase > 0) {
            const ppeRatio = ppeMaxWriteDown / totalEligibleBase;
            const intRatio = intMaxWriteDown / totalEligibleBase;

            ppeImpairment = roundToPaisa(Math.min(ppeMaxWriteDown, remainingLoss * ppeRatio));
            intangiblesImpairment = roundToPaisa(Math.min(intMaxWriteDown, remainingLoss * intRatio));
            otherImpairment = roundToPaisa(remainingLoss - ppeImpairment - intangiblesImpairment);

            if (ppeImpairment > 0) {
                journalEntries.push({
                    account: 'Accumulated Impairment - Property, Plant & Equipment',
                    type: 'PPE_CONTRA',
                    debitInr: 0,
                    creditInr: ppeImpairment,
                    rule: 'Ind AS 36.104(b) Pro-rata PPE Allocation'
                });
            }
            if (intangiblesImpairment > 0) {
                journalEntries.push({
                    account: 'Accumulated Impairment - Intangible Assets',
                    type: 'INTANGIBLE_CONTRA',
                    debitInr: 0,
                    creditInr: intangiblesImpairment,
                    rule: 'Ind AS 36.104(b) Pro-rata Intangibles Allocation'
                });
            }
            if (otherImpairment > 0) {
                journalEntries.push({
                    account: 'Accumulated Impairment - Other Non-Current Assets',
                    type: 'NON_CURRENT_ASSET_CONTRA',
                    debitInr: 0,
                    creditInr: otherImpairment,
                    rule: 'Ind AS 36.104(b) Pro-rata Other Assets Allocation'
                });
            }
        }

        journalEntries.unshift({
            account: 'Impairment Loss on Assets (Statement of Profit & Loss)',
            type: 'OPERATING_EXPENSE',
            debitInr: totalImpairmentLoss,
            creditInr: 0,
            rule: 'Ind AS 36.60 Recognition in Profit or Loss'
        });
    }

    const totalDebits = roundToPaisa(journalEntries.reduce((acc, e) => acc + e.debitInr, 0));
    const totalCredits = roundToPaisa(journalEntries.reduce((acc, e) => acc + e.creditInr, 0));
    const isDoubleEntryBalanced = Math.abs(totalDebits - totalCredits) < 0.001;

    return {
        status: 'SUCCESS',
        standard: 'Ind AS 36 / IAS 36 / US GAAP ASC 360',
        asOfDate,
        cguId,
        cguName,
        valuation: {
            totalCarryingAmountInr: totalCarryingAmount,
            fairValueLessCostsOfDisposalInr: fvlcod,
            valueInUseInr: valueInUse,
            recoverableAmountInr: recoverableAmount,
            recoverableMethod,
            headroomInr: Math.max(0, recoverableAmount - totalCarryingAmount),
            impairmentRequired,
            totalImpairmentLossInr: totalImpairmentLoss,
            postImpairmentCarryingAmountInr: postImpairmentCarryingAmount
        },
        assetBreakdown: {
            goodwill: { initialCarryingInr: goodwill, impairmentInr: goodwillImpairment, closingCarryingInr: roundToPaisa(goodwill - goodwillImpairment) },
            propertyPlantEquipment: { initialCarryingInr: ppe, impairmentInr: ppeImpairment, closingCarryingInr: roundToPaisa(ppe - ppeImpairment) },
            intangibleAssets: { initialCarryingInr: intangibles, impairmentInr: intangiblesImpairment, closingCarryingInr: roundToPaisa(intangibles - intangiblesImpairment) },
            otherNonCurrentAssets: { initialCarryingInr: otherNonCurrent, impairmentInr: otherImpairment, closingCarryingInr: roundToPaisa(otherNonCurrent - otherImpairment) }
        },
        discountedCashFlowsSchedule: discountedCashFlows,
        journalEntries,
        isDoubleEntryBalanced,
        isAuthorizedToDisburse: false,
        statutoryRationale: impairmentRequired
            ? `Ind AS 36 Impairment Test: CGU "${cguName}" carrying value INR ${totalCarryingAmount.toLocaleString('en-IN')} exceeds recoverable amount INR ${recoverableAmount.toLocaleString('en-IN')} (${recoverableMethod}). Impairment loss of INR ${totalImpairmentLoss.toLocaleString('en-IN')} recognized in P&L. Goodwill reduced by INR ${goodwillImpairment.toLocaleString('en-IN')}; non-current assets reduced pro-rata by INR ${(totalImpairmentLoss - goodwillImpairment).toLocaleString('en-IN')}. Impairment assessment does not authorize payment disbursement.`
            : `Ind AS 36 Impairment Test: CGU "${cguName}" carrying value INR ${totalCarryingAmount.toLocaleString('en-IN')} is fully supported by recoverable amount INR ${recoverableAmount.toLocaleString('en-IN')} (${recoverableMethod}) with headroom of INR ${(recoverableAmount - totalCarryingAmount).toLocaleString('en-IN')}. No impairment recognized. Impairment assessment does not authorize payment disbursement.`
    };
}


// ===========================================================================
// COMMERCIAL TIER BOUNDARY SPECIFICATION (OKF v0.2 / ENTERPRISE BOUNDARY)
// ===========================================================================
// This completes the open-source Public Commons baseline tier for @mudraforge/statutory.
//
// Advanced enterprise financial engines are strictly hosted API services:
// - Automated Form 3CD Clauses 20(b), 26, 34 Tax Audit Schedules
// - Section 234B & Section 234C Dynamic Advance Tax Interest Forecasting
// - Multi-Jurisdiction BEPS Pillar Two Global Minimum Tax Computations
// - Model Context Protocol (MCP) Live Agent Financial Tools
// - Autonomous Multi-Process Banking Rail Settlement Dispatch
//
// To license hosted enterprise calculators or obtain an Enterprise API Key:
// Contact: hello@mudraforge.in / support@mudraforge.in
// ===========================================================================




/**
 * @deprecated Use `evaluateStatutoryAst` from `@mudraforge/statutory/usvm` with rule `ITA1961_SEC194S`.
 * DETERMINISTIC STATUTORY CALCULATOR: Section 194S (TDS on Virtual Digital Assets / Crypto)
 */
export function evaluateSection194S({
    considerationInr,
    cumulativePriorConsiderationInr = 0,
    isSpecifiedPerson = false,
    hasPan = true,
    isPanInoperative = false,
    isSellerResident = true,
    transactionDate = null,
    creditDate = null,
    paymentDate = null
} = {}) {
    const rawAmt = Math.max(0, assertMandatoryNumeric(considerationInr, 'considerationInr', 'evaluateSection194S'));
    const priorAmt = Math.max(0, cleanNumericAmount(cumulativePriorConsiderationInr));
    const totalCumulative = roundToPaisa(priorAmt + rawAmt);

    if (!isSellerResident) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'GOVERNED_BY_SECTION_195',
            applicableTdsRatePercent: null,
            taxableBaseInr: null,
            calculatedTdsInr: null,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 195 (Cross-Border)',
            statutoryRationale: 'Transferor is a non-resident. Withholding is governed by Section 195 DTAA framework, not Section 194S.'
        };
    }

    const thresholdCeiling = isSpecifiedPerson ? 50000 : 10000;
    if (totalCumulative <= thresholdCeiling) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_BELOW_THRESHOLD',
            applicableTdsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTdsInr: 0,
            currentPaymentInr: rawAmt,
            cumulativePriorPaymentsInr: priorAmt,
            totalCumulativeInr: totalCumulative,
            thresholdCeilingInr: thresholdCeiling,
            netPayableToPayeeInr: rawAmt,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 194S(1)',
            statutoryRationale: `Cumulative consideration (INR ${totalCumulative.toLocaleString('en-IN')}) does not exceed statutory threshold of INR ${thresholdCeiling.toLocaleString('en-IN')}. No tax deduction required.`
        };
    }

    let taxableBase = priorAmt < thresholdCeiling ? roundToPaisa(totalCumulative - thresholdCeiling) : rawAmt;
    let applicableRate = 1.0;
    let rateDescription = 'Section 194S standard rate (1%)';

    if (!hasPan || isPanInoperative) {
        applicableRate = 20.0;
        rateDescription = 'Section 206AA penal rate (20%) due to missing or inoperative PAN';
    }

    const calculatedTds = roundToPaisa((taxableBase * applicableRate) / 100);
    const netPayable = roundToPaisa(Math.max(0, rawAmt - calculatedTds));

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'DEDUCTION_MANDATORY',
        applicableTdsRatePercent: applicableRate,
        taxableBaseInr: taxableBase,
        calculatedTdsInr: calculatedTds,
        currentPaymentInr: rawAmt,
        cumulativePriorPaymentsInr: priorAmt,
        totalCumulativeInr: totalCumulative,
        thresholdCeilingInr: thresholdCeiling,
        netPayableToPayeeInr: netPayable,
        complianceRequirements: {
            challanCumStatementForm: isSpecifiedPerson ? 'Form 26QE' : 'Form 26Q',
            tdsCertificateForm: isSpecifiedPerson ? 'Form 16E' : 'Form 16A',
            challanFilingCutoff: 'Within 30 days from end of month'
        },
        governingLaw: `Income-tax Act, 1961 Section 194S read with ${rateDescription}`,
        isAuthorizedToDisburse: false,
        statutoryRationale: `VDA consideration exceeds INR ${thresholdCeiling.toLocaleString('en-IN')}. Taxable base INR ${taxableBase.toLocaleString('en-IN')} taxed at ${applicableRate}% = INR ${calculatedTds.toLocaleString('en-IN')}. Net payable: INR ${netPayable.toLocaleString('en-IN')}.`
    };
}

/**
 * @deprecated Use `evaluateStatutoryAst` from `@mudraforge/statutory/usvm` with rule `ITA1961_SEC194BA`.
 * DETERMINISTIC STATUTORY CALCULATOR: Section 194BA (TDS on Winnings from Online Games)
 */
export function evaluateSection194BA({
    netWinningsInr = null,
    withdrawalAmountInr = null,
    totalDepositsInr = 0,
    openingBalanceInr = 0,
    closingBalanceInr = 0,
    totalPriorWithdrawalsInr = 0,
    hasPan = true,
    isPanInoperative = false,
    transactionDate = null
} = {}) {
    let computedNetWinnings = 0;
    if (netWinningsInr !== null && netWinningsInr !== undefined) {
        computedNetWinnings = cleanNumericAmount(netWinningsInr);
    } else {
        const withdrawal = Math.max(0, cleanNumericAmount(withdrawalAmountInr));
        const priorWithdrawals = Math.max(0, cleanNumericAmount(totalPriorWithdrawalsInr));
        const closing = Math.max(0, cleanNumericAmount(closingBalanceInr));
        const deposits = Math.max(0, cleanNumericAmount(totalDepositsInr));
        const opening = Math.max(0, cleanNumericAmount(openingBalanceInr));
        computedNetWinnings = roundToPaisa((withdrawal + priorWithdrawals + closing) - (deposits + opening));
    }

    if (computedNetWinnings <= 0) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_ZERO_OR_NEGATIVE_NET_WINNINGS',
            applicableTdsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTdsInr: 0,
            netWinningsInr: computedNetWinnings,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 194BA read with Rule 133',
            statutoryRationale: 'Net winnings are zero or negative. No tax deduction is applicable.'
        };
    }

    let applicableRate = 30.0;
    let rateDescription = 'Section 194BA statutory rate (30% on net online gaming winnings)';

    if (!hasPan || isPanInoperative) {
        applicableRate = 30.0;
        rateDescription = 'Section 194BA/206AA statutory rate (30% applies regardless of PAN)';
    }

    const calculatedTds = roundToPaisa((computedNetWinnings * applicableRate) / 100);
    const netPayout = roundToPaisa(Math.max(0, computedNetWinnings - calculatedTds));

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'DEDUCTION_MANDATORY',
        applicableTdsRatePercent: applicableRate,
        taxableBaseInr: computedNetWinnings,
        calculatedTdsInr: calculatedTds,
        netWinningsInr: computedNetWinnings,
        netPayableToUserInr: netPayout,
        complianceRequirements: {
            statementForm: 'Form 26Q (Quarterly)',
            tdsCertificateForm: 'Form 16A',
            remittanceCutoff: '7th of subsequent month (30th April for March)'
        },
        governingLaw: `Income-tax Act, 1961 Section 194BA read with ${rateDescription}`,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Net winnings of INR ${computedNetWinnings.toLocaleString('en-IN')} taxed at ${applicableRate}% = INR ${calculatedTds.toLocaleString('en-IN')}. Net payout: INR ${netPayout.toLocaleString('en-IN')}.`
    };
}

/**
 * @deprecated Use `evaluateStatutoryAst` from `@mudraforge/statutory/usvm` with rule `ITA1961_SEC194N`.
 * DETERMINISTIC STATUTORY CALCULATOR: Section 194N (TDS on High-Value Cash Withdrawals)
 */
export function evaluateSection194N({
    withdrawalAmountInr,
    cumulativePriorWithdrawalsInr = 0,
    isNonFilerPast3Years = false,
    isExemptEntity = false,
    transactionDate = null
} = {}) {
    const rawAmt = Math.max(0, assertMandatoryNumeric(withdrawalAmountInr, 'withdrawalAmountInr', 'evaluateSection194N'));
    const priorAmt = Math.max(0, cleanNumericAmount(cumulativePriorWithdrawalsInr));
    const totalCumulative = roundToPaisa(priorAmt + rawAmt);

    if (isExemptEntity) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_ENTITY_FOURTH_PROVISO',
            applicableTdsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTdsInr: 0,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 194N Fourth Proviso',
            statutoryRationale: 'Entity is exempt from Section 194N (Government, banking company, co-operative society, business correspondent, white-label ATM operator).'
        };
    }

    const ONE_CRORE = 10000000;
    const TWENTY_LAKHS = 2000000;

    let calculatedTds = 0;
    let applicableRate = 0;
    let taxableBase = 0;
    let rateDescription = '';

    if (!isNonFilerPast3Years) {
        if (totalCumulative <= ONE_CRORE) {
            return {
                status: 'SUCCESS',
                statutoryDetermination: 'EXEMPT_BELOW_THRESHOLD',
                applicableTdsRatePercent: 0,
                taxableBaseInr: 0,
                calculatedTdsInr: 0,
                currentWithdrawalInr: rawAmt,
                cumulativePriorWithdrawalsInr: priorAmt,
                totalCumulativeInr: totalCumulative,
                thresholdCeilingInr: ONE_CRORE,
                isAuthorizedToDisburse: false,
                governingLaw: 'Income-tax Act, 1961 Section 194N(1)',
                statutoryRationale: `Cumulative cash withdrawals (INR ${totalCumulative.toLocaleString('en-IN')}) do not exceed INR 1 Crore. No TDS required.`
            };
        }

        taxableBase = priorAmt >= ONE_CRORE ? rawAmt : roundToPaisa(totalCumulative - ONE_CRORE);
        applicableRate = 2.0;
        calculatedTds = roundToPaisa((taxableBase * applicableRate) / 100);
        rateDescription = '2% on cash withdrawal in excess of INR 1 Crore (First Proviso)';
    } else {
        if (totalCumulative <= TWENTY_LAKHS) {
            return {
                status: 'SUCCESS',
                statutoryDetermination: 'EXEMPT_BELOW_THRESHOLD_NON_FILER',
                applicableTdsRatePercent: 0,
                taxableBaseInr: 0,
                calculatedTdsInr: 0,
                currentWithdrawalInr: rawAmt,
                cumulativePriorWithdrawalsInr: priorAmt,
                totalCumulativeInr: totalCumulative,
                thresholdCeilingInr: TWENTY_LAKHS,
                isAuthorizedToDisburse: false,
                governingLaw: 'Income-tax Act, 1961 Section 194N Second Proviso',
                statutoryRationale: `Cumulative cash withdrawals for non-filer (INR ${totalCumulative.toLocaleString('en-IN')}) do not exceed INR 20 Lakhs. No TDS required.`
            };
        }

        let tier1Taxable = 0;
        let tier2Taxable = 0;
        const effectiveStart = priorAmt;
        const effectiveEnd = totalCumulative;

        if (effectiveEnd > TWENTY_LAKHS) {
            const start1 = Math.max(TWENTY_LAKHS, effectiveStart);
            const end1 = Math.min(ONE_CRORE, effectiveEnd);
            if (end1 > start1) tier1Taxable = end1 - start1;
        }

        if (effectiveEnd > ONE_CRORE) {
            const start2 = Math.max(ONE_CRORE, effectiveStart);
            const end2 = effectiveEnd;
            if (end2 > start2) tier2Taxable = end2 - start2;
        }

        const tdsTier1 = roundToPaisa((tier1Taxable * 2.0) / 100);
        const tdsTier2 = roundToPaisa((tier2Taxable * 5.0) / 100);
        calculatedTds = roundToPaisa(tdsTier1 + tdsTier2);
        taxableBase = roundToPaisa(tier1Taxable + tier2Taxable);
        applicableRate = tier2Taxable > 0 ? (tier1Taxable > 0 ? 5.0 : 5.0) : 2.0;
        rateDescription = `Non-filer tiered rates: 2% on INR ${tier1Taxable.toLocaleString('en-IN')} (20L-1Cr) + 5% on INR ${tier2Taxable.toLocaleString('en-IN')} (>1Cr)`;
    }

    const netCashDisbursed = roundToPaisa(Math.max(0, rawAmt - calculatedTds));

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'DEDUCTION_MANDATORY',
        applicableTdsRatePercent: applicableRate,
        taxableBaseInr: taxableBase,
        calculatedTdsInr: calculatedTds,
        currentWithdrawalInr: rawAmt,
        cumulativePriorWithdrawalsInr: priorAmt,
        totalCumulativeInr: totalCumulative,
        netCashDisbursedInr: netCashDisbursed,
        governingLaw: `Income-tax Act, 1961 Section 194N (${rateDescription})`,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Cumulative withdrawals (INR ${totalCumulative.toLocaleString('en-IN')}) exceed statutory threshold. TDS of INR ${calculatedTds.toLocaleString('en-IN')} deducted. Net cash disbursed: INR ${netCashDisbursed.toLocaleString('en-IN')}.`
    };
}

/**
 * @deprecated Use `evaluateStatutoryAst` from `@mudraforge/statutory/usvm` with rule `ITA1961_SEC194DA`.
 * DETERMINISTIC STATUTORY CALCULATOR: Section 194DA (TDS on Life Insurance Policy Payouts)
 */
export function evaluateSection194DA({
    payoutAmountInr,
    totalPremiumsPaidInr = 0,
    cumulativePriorPayoutsInr = 0,
    isExemptUnderSection10_10D = false,
    hasPan = true,
    isPanInoperative = false,
    transactionDate = null
} = {}) {
    const rawAmt = Math.max(0, assertMandatoryNumeric(payoutAmountInr, 'payoutAmountInr', 'evaluateSection194DA'));
    const premiumsPaid = Math.max(0, cleanNumericAmount(totalPremiumsPaidInr));
    const priorAmt = Math.max(0, cleanNumericAmount(cumulativePriorPayoutsInr));
    const totalCumulative = roundToPaisa(priorAmt + rawAmt);

    if (isExemptUnderSection10_10D) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_SECTION_10_10D',
            applicableTdsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTdsInr: 0,
            netPayableInr: rawAmt,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 10(10D)',
            statutoryRationale: 'Life insurance payout is fully exempt under Section 10(10D). No tax deduction is applicable.'
        };
    }

    const THRESHOLD = 100000;
    if (totalCumulative < THRESHOLD) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_BELOW_THRESHOLD',
            applicableTdsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTdsInr: 0,
            currentPayoutInr: rawAmt,
            totalCumulativeInr: totalCumulative,
            thresholdCeilingInr: THRESHOLD,
            netPayableInr: rawAmt,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 194DA Proviso',
            statutoryRationale: `Aggregate life insurance payout in financial year (INR ${totalCumulative.toLocaleString('en-IN')}) is below INR 1 Lakh. No TDS required.`
        };
    }

    const netIncome = Math.max(0, roundToPaisa(rawAmt - premiumsPaid));
    if (netIncome <= 0) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_NO_INCOME_COMPONENT',
            applicableTdsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTdsInr: 0,
            netPayableInr: rawAmt,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 194DA Explanation',
            statutoryRationale: 'Premiums paid equal or exceed payout amount. No net income component exists.'
        };
    }

    let applicableRate = 5.0;
    let rateDescription = 'Section 194DA standard rate (5% on net income component)';

    if (!hasPan || isPanInoperative) {
        applicableRate = 20.0;
        rateDescription = 'Section 206AA penal rate (20% on net income component due to missing/inoperative PAN)';
    }

    const calculatedTds = roundToPaisa((netIncome * applicableRate) / 100);
    const netPayable = roundToPaisa(Math.max(0, rawAmt - calculatedTds));

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'DEDUCTION_MANDATORY',
        applicableTdsRatePercent: applicableRate,
        taxableBaseInr: netIncome,
        calculatedTdsInr: calculatedTds,
        grossPayoutInr: rawAmt,
        premiumsPaidInr: premiumsPaid,
        netPayableInr: netPayable,
        governingLaw: `Income-tax Act, 1961 Section 194DA read with ${rateDescription}`,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Non-exempt insurance payout of INR ${rawAmt.toLocaleString('en-IN')} has net income component of INR ${netIncome.toLocaleString('en-IN')}. Taxed at ${applicableRate}% = INR ${calculatedTds.toLocaleString('en-IN')}. Net payable: INR ${netPayable.toLocaleString('en-IN')}.`
    };
}

/**
 * @deprecated Use `evaluateStatutoryAst` from `@mudraforge/statutory/usvm` with rule `ITA1961_SEC194K`.
 * DETERMINISTIC STATUTORY CALCULATOR: Section 194K (TDS on Mutual Fund Income)
 */
export function evaluateSection194K({
    incomeAmountInr,
    cumulativePriorIncomeInr = 0,
    isCapitalGainDistribution = false,
    hasPan = true,
    isPanInoperative = false,
    transactionDate = null
} = {}) {
    const rawAmt = Math.max(0, assertMandatoryNumeric(incomeAmountInr, 'incomeAmountInr', 'evaluateSection194K'));
    const priorAmt = Math.max(0, cleanNumericAmount(cumulativePriorIncomeInr));
    const totalCumulative = roundToPaisa(priorAmt + rawAmt);

    if (isCapitalGainDistribution) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_CAPITAL_GAINS_EXCLUSION',
            applicableTdsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTdsInr: 0,
            netPayableInr: rawAmt,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 194K First Proviso',
            statutoryRationale: 'Section 194K excludes capital gains from transfer/redemption of mutual fund units. No tax deduction under this section.'
        };
    }

    const THRESHOLD = 5000;
    if (totalCumulative <= THRESHOLD) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_BELOW_THRESHOLD',
            applicableTdsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTdsInr: 0,
            currentIncomeInr: rawAmt,
            totalCumulativeInr: totalCumulative,
            thresholdCeilingInr: THRESHOLD,
            netPayableInr: rawAmt,
            isAuthorizedToDisburse: false,
            governingLaw: 'Income-tax Act, 1961 Section 194K Second Proviso',
            statutoryRationale: `Cumulative mutual fund income in financial year (INR ${totalCumulative.toLocaleString('en-IN')}) does not exceed statutory ceiling of INR 5,000. No TDS required.`
        };
    }

    let applicableRate = 10.0;
    let rateDescription = 'Section 194K standard rate (10%)';

    if (!hasPan || isPanInoperative) {
        applicableRate = 20.0;
        rateDescription = 'Section 206AA penal rate (20% due to missing/inoperative PAN)';
    }

    const calculatedTds = roundToPaisa((rawAmt * applicableRate) / 100);
    const netPayable = roundToPaisa(Math.max(0, rawAmt - calculatedTds));

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'DEDUCTION_MANDATORY',
        applicableTdsRatePercent: applicableRate,
        taxableBaseInr: rawAmt,
        calculatedTdsInr: calculatedTds,
        grossIncomeInr: rawAmt,
        netPayableInr: netPayable,
        governingLaw: `Income-tax Act, 1961 Section 194K read with ${rateDescription}`,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Mutual fund income exceeds INR 5,000 ceiling. Current distribution of INR ${rawAmt.toLocaleString('en-IN')} taxed at ${applicableRate}% = INR ${calculatedTds.toLocaleString('en-IN')}. Net payable: INR ${netPayable.toLocaleString('en-IN')}.`
    };
}

/**
 * @deprecated Use `evaluateStatutoryAst` from `@mudraforge/statutory/usvm` with rule `ITA1961_SEC206C1G`.
 * DETERMINISTIC STATUTORY CALCULATOR: Section 206C(1G) (TCS on Foreign Remittances under LRS and Tour Packages)
 */
export function evaluateSection206C1G({
    remittanceAmountInr,
    cumulativePriorRemittancesInr = 0,
    remittanceType = 'OTHER_REMITTANCE',
    hasPan = true,
    isPanInoperative = false,
    transactionDate = null
} = {}) {
    const rawAmt = Math.max(0, assertMandatoryNumeric(remittanceAmountInr, 'remittanceAmountInr', 'evaluateSection206C1G'));
    const priorAmt = Math.max(0, cleanNumericAmount(cumulativePriorRemittancesInr));
    const totalCumulative = roundToPaisa(priorAmt + rawAmt);

    const THRESHOLD = 700000;
    const type = String(remittanceType).toUpperCase();

    let calculatedTcs = 0;
    let applicableRate = 0;
    let taxableBase = 0;
    let rateDescription = '';

    if (type === 'OVERSEAS_TOUR_PACKAGE') {
        let tier1 = 0;
        let tier2 = 0;
        const effectiveStart = priorAmt;
        const effectiveEnd = totalCumulative;
        const start1 = effectiveStart;
        const end1 = Math.min(THRESHOLD, effectiveEnd);
        if (end1 > start1) tier1 = end1 - start1;

        if (effectiveEnd > THRESHOLD) {
            const start2 = Math.max(THRESHOLD, effectiveStart);
            const end2 = effectiveEnd;
            if (end2 > start2) tier2 = end2 - start2;
        }

        const tcsTier1 = roundToPaisa((tier1 * 5.0) / 100);
        const tcsTier2 = roundToPaisa((tier2 * 20.0) / 100);
        calculatedTcs = roundToPaisa(tcsTier1 + tcsTier2);
        taxableBase = rawAmt;
        applicableRate = tier2 > 0 ? (tier1 > 0 ? 20.0 : 20.0) : 5.0;
        rateDescription = `Overseas tour package: 5% on INR ${tier1.toLocaleString('en-IN')} + 20% on INR ${tier2.toLocaleString('en-IN')} (>7L)`;
    } else {
        if (totalCumulative <= THRESHOLD) {
            return {
                status: 'SUCCESS',
                statutoryDetermination: 'EXEMPT_BELOW_LRS_THRESHOLD',
                applicableTcsRatePercent: 0,
                taxableBaseInr: 0,
                calculatedTcsInr: 0,
                currentRemittanceInr: rawAmt,
                totalCumulativeInr: totalCumulative,
                thresholdCeilingInr: THRESHOLD,
                totalPayableByRemitterInr: rawAmt,
                isAuthorizedToDisburse: false,
                governingLaw: 'Income-tax Act, 1961 Section 206C(1G) Proviso',
                statutoryRationale: `Cumulative LRS remittances in FY (INR ${totalCumulative.toLocaleString('en-IN')}) do not exceed INR 7 Lakhs threshold. No TCS applicable.`
            };
        }

        taxableBase = priorAmt >= THRESHOLD ? rawAmt : roundToPaisa(totalCumulative - THRESHOLD);

        if (type === 'EDUCATION_LOAN') {
            applicableRate = 0.5;
            rateDescription = '0.5% on excess over INR 7 Lakhs (Education remittance funded by Section 80E loan)';
        } else if (type === 'EDUCATION_OR_MEDICAL') {
            applicableRate = 5.0;
            rateDescription = '5% on excess over INR 7 Lakhs (Education or medical treatment remittance)';
        } else {
            applicableRate = 20.0;
            rateDescription = '20% on excess over INR 7 Lakhs (General LRS remittance amended w.e.f. 1 Oct 2023)';
        }

        if (!hasPan || isPanInoperative) {
            applicableRate = Math.max(applicableRate, 20.0);
            rateDescription = `${rateDescription} - Penal rate (20%) due to missing/inoperative PAN`;
        }

        calculatedTcs = roundToPaisa((taxableBase * applicableRate) / 100);
    }

    const totalPayableByRemitter = roundToPaisa(rawAmt + calculatedTcs);

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'COLLECTION_MANDATORY',
        applicableTcsRatePercent: applicableRate,
        taxableBaseInr: taxableBase,
        calculatedTcsInr: calculatedTcs,
        remittanceAmountInr: rawAmt,
        totalPayableByRemitterInr: totalPayableByRemitter,
        governingLaw: `Income-tax Act, 1961 Section 206C(1G) (${rateDescription})`,
        isAuthorizedToDisburse: false,
        statutoryRationale: `LRS remittance taxable base INR ${taxableBase.toLocaleString('en-IN')} subject to TCS of ${applicableRate}% = INR ${calculatedTcs.toLocaleString('en-IN')}. Total collected from remitter: INR ${totalPayableByRemitter.toLocaleString('en-IN')}.`
    };
}

/**
 * @deprecated Use `evaluateStatutoryAst` from `@mudraforge/statutory/usvm` with rule `CGST2017_SEC52_TCS_ECOMMERCE`.
 * DETERMINISTIC STATUTORY CALCULATOR: GST Section 52 (TCS by E-Commerce Operators)
 */
export function evaluateSection52GstTcs({
    grossTaxableSuppliesInr,
    returnedSuppliesInr = 0,
    isInterState = false,
    isSec9_5SpecifiedService = false,
    transactionDate = null
} = {}) {
    const grossSupplies = Math.max(0, assertMandatoryNumeric(grossTaxableSuppliesInr, 'grossTaxableSuppliesInr', 'evaluateSection52GstTcs'));
    const returns = Math.max(0, cleanNumericAmount(returnedSuppliesInr));

    if (isSec9_5SpecifiedService) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_SECTION_9_5_SUPPLY',
            applicableTcsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTcsInr: 0,
            isAuthorizedToDisburse: false,
            governingLaw: 'CGST Act, 2017 Section 52(1) Explanation (Section 9(5) excluded)',
            statutoryRationale: 'Services notified under Section 9(5) are subject to direct reverse charge by ECO, and excluded from Section 52 TCS.'
        };
    }

    const netValue = Math.max(0, roundToPaisa(grossSupplies - returns));
    if (netValue <= 0) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'EXEMPT_NET_VALUE_ZERO',
            applicableTcsRatePercent: 0,
            taxableBaseInr: 0,
            calculatedTcsInr: 0,
            netValueInr: netValue,
            isAuthorizedToDisburse: false,
            governingLaw: 'CGST Act, 2017 Section 52(1)',
            statutoryRationale: 'Net value of taxable supplies after adjusting sales returns is zero or negative. No TCS applicable.'
        };
    }

    const totalRate = 1.0;
    const calculatedTcs = roundToPaisa((netValue * totalRate) / 100);
    const cgstTcs = isInterState ? 0 : roundToPaisa(calculatedTcs / 2);
    const sgstTcs = isInterState ? 0 : roundToPaisa(calculatedTcs - cgstTcs);
    const igstTcs = isInterState ? calculatedTcs : 0;
    const netDisbursedToSupplier = roundToPaisa(Math.max(0, grossSupplies - calculatedTcs));

    return {
        status: 'SUCCESS',
        statutoryDetermination: 'COLLECTION_MANDATORY',
        applicableTcsRatePercent: totalRate,
        taxableBaseInr: netValue,
        calculatedTcsInr: calculatedTcs,
        bifurcation: {
            cgstInr: cgstTcs,
            sgstInr: sgstTcs,
            igstInr: igstTcs
        },
        grossSuppliesInr: grossSupplies,
        returnedSuppliesInr: returns,
        netDisbursedToSupplierInr: netDisbursedToSupplier,
        complianceRequirements: {
            monthlyReturnForm: 'GSTR-8',
            filingCutoff: '10th of subsequent calendar month'
        },
        governingLaw: 'CGST Act, 2017 Section 52 / SGST Act Section 52 / IGST Act Section 20',
        isAuthorizedToDisburse: false,
        statutoryRationale: `E-commerce net supplies of INR ${netValue.toLocaleString('en-IN')} subject to 1% TCS = INR ${calculatedTcs.toLocaleString('en-IN')}. Net disbursed to supplier: INR ${netDisbursedToSupplier.toLocaleString('en-IN')}. File Form GSTR-8 by 10th.`
    };
}


/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function evaluatePlaceOfSupplyAndLut({
    transactionType = 'DOMESTIC_SERVICES',
    supplierStateCode = null,
    supplierGstin = null,
    recipientStateCode = null,
    recipientGstin = null,
    recipientCountryCode = 'IN',
    invoiceAmountInr = 0,
    gstRate = 0.18,
    isB2B = true,
    placeOfSupplyStateCode = null,
    immovablePropertyLocationStateCode = null,
    isSupplierInIndia = true,
    isRecipientOutsideIndia = null,
    isPlaceOfSupplyOutsideIndia = null,
    isConvertibleForexReceivedOrRbiInr = null,
    isDistinctPersonEstablishment = false,
    isIntermediaryService = false,
    hasValidLut = false,
    lutArn = null
} = {}) {
    const amount = cleanNumericAmount(invoiceAmountInr);
    const rate = Number(gstRate) || 0.18;
    const isTransExport = transactionType === 'EXPORT_SERVICES' || transactionType === 'EXPORT_GOODS' || (recipientCountryCode && recipientCountryCode.toUpperCase() !== 'IN');

    // Extract state codes
    let supState = supplierStateCode;
    if (!supState && supplierGstin && typeof supplierGstin === 'string' && supplierGstin.length >= 2) {
        supState = supplierGstin.slice(0, 2);
    }
    let recState = recipientStateCode;
    if (!recState && recipientGstin && typeof recipientGstin === 'string' && recipientGstin.length >= 2) {
        recState = recipientGstin.slice(0, 2);
    }

    if (isTransExport) {
        // Evaluate Section 2(6) 5 Cumulative Conditions for Export of Services
        const cond1SupplierInIndia = isSupplierInIndia === true;
        const cond2RecipientOutsideIndia = recipientCountryCode.toUpperCase() !== 'IN' && (isRecipientOutsideIndia === null || isRecipientOutsideIndia === true);
        // Intermediary services under Section 13(8)(b) have POS at supplier location in India!
        const cond3PosOutsideIndia = !isIntermediaryService && (isPlaceOfSupplyOutsideIndia === null || isPlaceOfSupplyOutsideIndia === true);
        const cond4ForexReceived = isConvertibleForexReceivedOrRbiInr === true;
        const cond5NotDistinctPersons = isDistinctPersonEstablishment === false;

        const conditionAudit = [
            { condition: '1. Supplier located in India (Sec 2(6)(i))', status: cond1SupplierInIndia ? 'PASS' : 'FAIL' },
            { condition: '2. Recipient located outside India (Sec 2(6)(ii))', status: cond2RecipientOutsideIndia ? 'PASS' : 'FAIL' },
            { condition: '3. Place of supply outside India (Sec 2(6)(iii) & Sec 13)', status: cond3PosOutsideIndia ? 'PASS' : (isIntermediaryService ? 'FAIL_INTERMEDIARY_SEC_13_8_B' : 'FAIL') },
            { condition: '4. Convertible forex / RBI permitted INR received (Sec 2(6)(iv))', status: cond4ForexReceived ? 'PASS' : 'FAIL_NO_FIRC_EBRC' },
            { condition: '5. Not merely establishments of distinct persons (Sec 2(6)(v))', status: cond5NotDistinctPersons ? 'PASS' : 'FAIL_DISTINCT_PERSON_BRANCH' }
        ];

        const isFullyQualifiedExport = cond1SupplierInIndia && cond2RecipientOutsideIndia && cond3PosOutsideIndia && cond4ForexReceived && cond5NotDistinctPersons;

        if (isFullyQualifiedExport) {
            if (hasValidLut) {
                return {
                    status: 'SUCCESS',
                    statutoryDetermination: 'ZERO_RATED_EXPORT_UNDER_LUT',
                    governingLaw: 'IGST Act, 2017 Sections 2(6), 16(1)(a) & 16(3)(a); CGST Rules, 2017 Rule 96A',
                    transactionType: 'EXPORT_SERVICES',
                    invoiceAmountInr: amount,
                    gstRate: 0,
                    igstPayableInr: 0,
                    cgstPayableInr: 0,
                    sgstPayableInr: 0,
                    lutArn: lutArn || 'LUT_ARN_ACTIVE_ON_RECORD',
                    isZeroRated: true,
                    itcRefundEligible: true,
                    reportingTable: 'GSTR-1 Table 6A (Export without payment of tax)',
                    conditionAudit,
                    isAuthorizedToDisburse: false,
                    statutoryRationale: `Zero-Rated Export of Services under LUT: All 5 conditions of Section 2(6) IGST Act verified. Export proceeds in convertible foreign exchange/RBI INR confirmed. Supply is zero-rated at 0% IGST under valid LUT ARN ${lutArn || 'ACTIVE'}. Accumulated unutilized ITC is eligible for refund under Section 54(3).`
                };
            } else {
                const igstTax = roundToPaisa(amount * rate);
                return {
                    status: 'SUCCESS',
                    statutoryDetermination: 'ZERO_RATED_EXPORT_WITH_TAX_PAYMENT',
                    governingLaw: 'IGST Act, 2017 Sections 2(6), 16(1)(a) & 16(3)(b); CGST Act Section 54',
                    transactionType: 'EXPORT_SERVICES',
                    invoiceAmountInr: amount,
                    gstRate: rate,
                    igstPayableInr: igstTax,
                    cgstPayableInr: 0,
                    sgstPayableInr: 0,
                    isZeroRated: true,
                    itcRefundEligible: true,
                    reportingTable: 'GSTR-1 Table 6A (Export with payment of tax)',
                    conditionAudit,
                    isAuthorizedToDisburse: false,
                    statutoryRationale: `Zero-Rated Export with payment of tax: All 5 conditions of Section 2(6) satisfied, but no valid LUT on record. IGST of INR ${igstTax.toLocaleString('en-IN')} (at ${(rate * 100)}%) is charged and eligible for refund under Section 54(1).`
                };
            }
        } else {
            const igstTax = roundToPaisa(amount * rate);
            const failedReasons = conditionAudit.filter(c => c.status !== 'PASS').map(c => c.condition);
            return {
                status: 'SUCCESS',
                statutoryDetermination: 'DISQUALIFIED_FROM_ZERO_RATING',
                governingLaw: 'IGST Act, 2017 Sections 2(6), 7(5)(a) & 13',
                transactionType: 'DISQUALIFIED_EXPORT_SERVICES',
                invoiceAmountInr: amount,
                gstRate: rate,
                igstPayableInr: igstTax,
                cgstPayableInr: 0,
                sgstPayableInr: 0,
                isZeroRated: false,
                itcRefundEligible: false,
                disqualificationReasons: failedReasons,
                conditionAudit,
                isAuthorizedToDisburse: false,
                statutoryRationale: `Disqualified from Zero-Rated Export: Supply failed statutory condition(s): ${failedReasons.join('; ')}. Treated as standard domestic inter-state supply to foreign person subject to standard ${(rate * 100)}% IGST (INR ${igstTax.toLocaleString('en-IN')}).`
            };
        }
    }

    // Domestic Transaction Place of Supply Determination
    let posState = placeOfSupplyStateCode;
    let posLegalRule = '';

    if (immovablePropertyLocationStateCode) {
        posState = immovablePropertyLocationStateCode;
        posLegalRule = 'IGST Act Section 12(3) (Directly related to immovable property - location of property)';
    } else if (transactionType === 'DOMESTIC_GOODS') {
        posState = posState || recState || supState;
        posLegalRule = 'IGST Act Section 10(1)(a) (Location of goods at termination of delivery)';
    } else {
        if (isB2B && recState) {
            posState = recState;
            posLegalRule = 'IGST Act Section 12(2)(a) (B2B supply - location of registered recipient)';
        } else if (recState) {
            posState = recState;
            posLegalRule = 'IGST Act Section 12(2)(b) (B2C supply with address on record)';
        } else {
            posState = supState;
            posLegalRule = 'IGST Act Section 12(2)(b) proviso (B2C supply without address - location of supplier)';
        }
    }

    const isIntraState = supState && posState && (supState === posState);
    let cgstRate = 0, sgstRate = 0, igstRate = 0;
    let cgstAmountInr = 0, sgstAmountInr = 0, igstAmountInr = 0;

    if (isIntraState) {
        cgstRate = rate / 2;
        sgstRate = rate / 2;
        cgstAmountInr = roundToPaisa(amount * cgstRate);
        sgstAmountInr = roundToPaisa(amount * sgstRate);
    } else {
        igstRate = rate;
        igstAmountInr = roundToPaisa(amount * igstRate);
    }
    const totalGstInr = roundToPaisa(cgstAmountInr + sgstAmountInr + igstAmountInr);

    return {
        status: 'SUCCESS',
        statutoryDetermination: isIntraState ? 'INTRA_STATE_SUPPLY' : 'INTER_STATE_SUPPLY',
        governingLaw: isIntraState ? 'CGST Act Section 9 & SGST Act Section 9' : 'IGST Act Section 5 & Section 7',
        posLegalRule,
        supplierStateCode: supState,
        placeOfSupplyStateCode: posState,
        recipientStateCode: recState,
        invoiceAmountInr: amount,
        supplyNature: isIntraState ? 'INTRA_STATE' : 'INTER_STATE',
        taxBreakdown: {
            cgstRate,
            cgstAmountInr,
            sgstRate,
            sgstAmountInr,
            igstRate,
            igstAmountInr,
            totalGstAmountInr: totalGstInr
        },
        isAuthorizedToDisburse: false,
        statutoryRationale: isIntraState
            ? `Intra-State Supply: Supplier state (${supState}) matches Place of Supply (${posState}). CGST (${(cgstRate * 100)}%: INR ${cgstAmountInr.toLocaleString('en-IN')}) and SGST (${(sgstRate * 100)}%: INR ${sgstAmountInr.toLocaleString('en-IN')}) levied under Section 9.`
            : `Inter-State Supply: Supplier state (${supState}) differs from Place of Supply (${posState}). IGST (${(igstRate * 100)}%: INR ${igstAmountInr.toLocaleString('en-IN')}) levied under Section 5 of IGST Act.`
    };
}

/**
 * @deprecated Use evaluateStatutoryAst from '@mudraforge/statutory/usvm' for declarative AST evaluation. Legacy procedural functions are retained for backward compatibility throughout v2.x and will be sunset in v3.0.
 */
export function evaluateSection43BStatutoryPayables({
    financialYear = '2025-26',
    assessmentYear = null,
    itrFilingDueDate = '2026-10-31', // Section 139(1) due date for assessees subject to tax audit
    payables = []
} = {}) {
    const defaultAy = assessmentYear || (() => {
        const parts = String(financialYear).split('-');
        if (parts.length === 2 && !isNaN(Number(parts[0]))) {
            const startYr = Number(parts[0]);
            return `${startYr + 1}-${String(startYr + 2).slice(-2)}`;
        }
        return '2026-27';
    })();

    if (!Array.isArray(payables) || payables.length === 0) {
        return {
            status: 'SUCCESS',
            statutoryDetermination: 'NO_PAYABLES_EVALUATED',
            financialYear,
            assessmentYear: defaultAy,
            itrFilingDueDate,
            totalPayablesCount: 0,
            summary: {
                totalIncurredInr: 0,
                totalAllowedInr: 0,
                totalDisallowedInr: 0,
                totalTimingDifferencesInr: 0,
                totalPermanentDisallowancesInr: 0,
                form3CdClause26DisallowanceInr: 0,
                form3CdClause20bDisallowanceInr: 0
            },
            evaluatedPayables: [],
            isAuthorizedToDisburse: false,
            statutoryRationale: 'No statutory payable items submitted for Section 43B / 36(1)(va) evaluation.'
        };
    }

    const evaluatedPayables = [];
    let totalIncurredInr = 0;
    let totalAllowedInr = 0;
    let totalDisallowedInr = 0;
    let totalTimingDifferencesInr = 0;
    let totalPermanentDisallowancesInr = 0;
    let form3CdClause26DisallowanceInr = 0;
    let form3CdClause20bDisallowanceInr = 0;

    const clauseBreakdown = {};

    payables.forEach((item, idx) => {
        const payableId = item.payableId || `PAY-${String(idx + 1).padStart(3, '0')}`;
        const rawClause = String(item.clause || '43B(a)').trim();
        const normalizedClause = rawClause.toLowerCase().includes('36')
            ? '36(1)(va)'
            : rawClause.toUpperCase(); // e.g. '43B(A)', '43B(B)', '43B(C)', etc.
        const description = item.description || `Statutory Liability under ${normalizedClause}`;
        const amountInr = roundToPaisa(Math.max(0, Number(item.amountInr) || 0));
        const statutoryDueDate = item.statutoryDueDate ? String(item.statutoryDueDate).trim() : null;
        const paidDate = item.paidDate ? String(item.paidDate).trim() : null;
        const paidAmountInr = paidDate
            ? roundToPaisa(item.paidAmountInr !== undefined && item.paidAmountInr !== null
                ? Math.max(0, Number(item.paidAmountInr) || 0)
                : amountInr)
            : 0;
        const isInterestConvertedToLoan = Boolean(item.isInterestConvertedToLoan);

        totalIncurredInr = roundToPaisa(totalIncurredInr + amountInr);

        if (!clauseBreakdown[normalizedClause]) {
            clauseBreakdown[normalizedClause] = {
                incurredInr: 0,
                allowedInr: 0,
                disallowedInr: 0
            };
        }
        clauseBreakdown[normalizedClause].incurredInr = roundToPaisa(clauseBreakdown[normalizedClause].incurredInr + amountInr);

        // ── CATEGORY 1: EMPLOYEE WELFARE CONTRIBUTIONS (Section 36(1)(va)) ──
        if (normalizedClause === '36(1)(va)') {
            // Checkmate Doctrine: Must be deposited on or before statutory due date under EPF/ESIC regulations
            const effectiveDueDate = statutoryDueDate || '2026-04-15';
            const isOnTime = Boolean(paidDate && paidDate <= effectiveDueDate);

            if (isOnTime) {
                const allowedAmt = roundToPaisa(Math.min(paidAmountInr, amountInr));
                const disallowedAmt = roundToPaisa(amountInr - allowedAmt);

                totalAllowedInr = roundToPaisa(totalAllowedInr + allowedAmt);
                clauseBreakdown[normalizedClause].allowedInr = roundToPaisa(clauseBreakdown[normalizedClause].allowedInr + allowedAmt);

                if (disallowedAmt > 0) {
                    totalDisallowedInr = roundToPaisa(totalDisallowedInr + disallowedAmt);
                    totalPermanentDisallowancesInr = roundToPaisa(totalPermanentDisallowancesInr + disallowedAmt);
                    form3CdClause20bDisallowanceInr = roundToPaisa(form3CdClause20bDisallowanceInr + disallowedAmt);
                    clauseBreakdown[normalizedClause].disallowedInr = roundToPaisa(clauseBreakdown[normalizedClause].disallowedInr + disallowedAmt);
                }

                evaluatedPayables.push({
                    payableId,
                    clause: normalizedClause,
                    description,
                    amountInr,
                    statutoryDueDate: effectiveDueDate,
                    paidDate,
                    paidAmountInr,
                    isAllowed: disallowedAmt === 0,
                    allowedAmountInr: allowedAmt,
                    disallowedAmountInr: disallowedAmt,
                    disallowanceType: disallowedAmt > 0 ? 'PERMANENT_ADD_BACK' : 'NONE',
                    governingRule: 'Section 36(1)(va) read with Section 2(24)(x) & Checkmate Doctrine',
                    taxAuditReporting: {
                        form: 'Form 3CD',
                        clause: 'Clause 20(b)',
                        status: disallowedAmt > 0 ? 'PARTIAL_DISALLOWANCE_REPORTABLE' : 'COMPLIANT'
                    },
                    statutoryOutcome: disallowedAmt > 0 ? 'DISALLOWED_PERMANENT_CHECKMATE' : 'ALLOWED',
                    statutoryAction: disallowedAmt > 0
                        ? `Unpaid portion of INR ${disallowedAmt.toLocaleString('en-IN')} permanently disallowed under Section 36(1)(va).`
                        : `Employee contribution deposited on or before statutory due date (${effectiveDueDate}). Fully deductible under Section 36(1)(va).`
                });
            } else {
                // Late deposit or unpaid -> Permanent Disallowance under Checkmate Services (2022)
                totalDisallowedInr = roundToPaisa(totalDisallowedInr + amountInr);
                totalPermanentDisallowancesInr = roundToPaisa(totalPermanentDisallowancesInr + amountInr);
                form3CdClause20bDisallowanceInr = roundToPaisa(form3CdClause20bDisallowanceInr + amountInr);
                clauseBreakdown[normalizedClause].disallowedInr = roundToPaisa(clauseBreakdown[normalizedClause].disallowedInr + amountInr);

                evaluatedPayables.push({
                    payableId,
                    clause: normalizedClause,
                    description,
                    amountInr,
                    statutoryDueDate: effectiveDueDate,
                    paidDate,
                    paidAmountInr,
                    isAllowed: false,
                    allowedAmountInr: 0,
                    disallowedAmountInr: amountInr,
                    disallowanceType: 'PERMANENT_ADD_BACK',
                    governingRule: 'Section 36(1)(va) read with Section 2(24)(x) & Supreme Court ruling in Checkmate Services (2022) 448 ITR 518 (SC)',
                    taxAuditReporting: {
                        form: 'Form 3CD',
                        clause: 'Clause 20(b)',
                        status: 'MANDATORY_PERMANENT_DISALLOWANCE'
                    },
                    statutoryOutcome: 'DISALLOWED_PERMANENT_CHECKMATE',
                    statutoryAction: paidDate
                        ? `Deposited after statutory due date (${paidDate} > ${effectiveDueDate}). Under Supreme Court Checkmate Doctrine read with Explanation 5 to Section 36(1)(va) and Section 2(24)(x), late deposit of employee contribution is permanently disallowed. Cannot be claimed under Section 43B or in any subsequent year.`
                        : `Unpaid employee contribution past statutory due date (${effectiveDueDate}). Permanently disallowed under Section 36(1)(va) read with Section 2(24)(x).`
                });
            }
        }
        // ── CATEGORY 2: EMPLOYER STATUTORY PAYABLES (Section 43B(a) to 43B(g)) ──
        else {
            // Check Explanation 3C & 3D for loan conversion
            if (isInterestConvertedToLoan) {
                totalDisallowedInr = roundToPaisa(totalDisallowedInr + amountInr);
                totalTimingDifferencesInr = roundToPaisa(totalTimingDifferencesInr + amountInr);
                form3CdClause26DisallowanceInr = roundToPaisa(form3CdClause26DisallowanceInr + amountInr);
                clauseBreakdown[normalizedClause].disallowedInr = roundToPaisa(clauseBreakdown[normalizedClause].disallowedInr + amountInr);

                evaluatedPayables.push({
                    payableId,
                    clause: normalizedClause,
                    description,
                    amountInr,
                    itrFilingDueDate,
                    paidDate,
                    paidAmountInr,
                    isAllowed: false,
                    allowedAmountInr: 0,
                    disallowedAmountInr: amountInr,
                    disallowanceType: 'TIMING_DIFFERENCE_ADD_BACK',
                    governingRule: 'Section 43B Explanations 3C & 3D (No actual payment via debt restructuring)',
                    taxAuditReporting: {
                        form: 'Form 3CD',
                        clause: 'Clause 26',
                        status: 'DISALLOWANCE_REPORTABLE'
                    },
                    statutoryOutcome: 'DISALLOWED_INTEREST_CONVERSION',
                    statutoryAction: 'Conversion of unpaid interest into a loan, advance, debenture, or funded interest term loan does NOT constitute actual payment under Explanation 3C/3D to Section 43B. Disallowed until actual cash/bank outflow occurs.'
                });
            } else {
                // First Proviso evaluation: Paid on or before Section 139(1) due date
                const isPaidBeforeItrDue = Boolean(paidDate && paidDate <= itrFilingDueDate);

                if (isPaidBeforeItrDue) {
                    const allowedAmt = roundToPaisa(Math.min(paidAmountInr, amountInr));
                    const disallowedAmt = roundToPaisa(amountInr - allowedAmt);

                    totalAllowedInr = roundToPaisa(totalAllowedInr + allowedAmt);
                    clauseBreakdown[normalizedClause].allowedInr = roundToPaisa(clauseBreakdown[normalizedClause].allowedInr + allowedAmt);

                    if (disallowedAmt > 0) {
                        totalDisallowedInr = roundToPaisa(totalDisallowedInr + disallowedAmt);
                        totalTimingDifferencesInr = roundToPaisa(totalTimingDifferencesInr + disallowedAmt);
                        form3CdClause26DisallowanceInr = roundToPaisa(form3CdClause26DisallowanceInr + disallowedAmt);
                        clauseBreakdown[normalizedClause].disallowedInr = roundToPaisa(clauseBreakdown[normalizedClause].disallowedInr + disallowedAmt);
                    }

                    evaluatedPayables.push({
                        payableId,
                        clause: normalizedClause,
                        description,
                        amountInr,
                        itrFilingDueDate,
                        paidDate,
                        paidAmountInr,
                        isAllowed: disallowedAmt === 0,
                        allowedAmountInr: allowedAmt,
                        disallowedAmountInr: disallowedAmt,
                        disallowanceType: disallowedAmt > 0 ? 'TIMING_DIFFERENCE_ADD_BACK' : 'NONE',
                        governingRule: 'Section 43B First Proviso (Actual payment before return filing cutoff)',
                        taxAuditReporting: {
                            form: 'Form 3CD',
                            clause: 'Clause 26',
                            status: disallowedAmt > 0 ? 'PARTIAL_DISALLOWANCE_REPORTABLE' : 'COMPLIANT'
                        },
                        statutoryOutcome: disallowedAmt > 0 ? 'DISALLOWED_TIMING_DIFFERENCE' : 'ALLOWED_FIRST_PROVISO',
                        statutoryAction: disallowedAmt > 0
                            ? `Unpaid balance of INR ${disallowedAmt.toLocaleString('en-IN')} disallowed in current FY; allowable upon actual payment in subsequent FY.`
                            : `Paid on or before Section 139(1) return filing due date (${paidDate} <= ${itrFilingDueDate}). Fully deductible in current financial year (${financialYear}) under Section 43B First Proviso.`
                    });
                } else {
                    // Late payment or unpaid -> Timing Difference Disallowance under Section 43B
                    totalDisallowedInr = roundToPaisa(totalDisallowedInr + amountInr);
                    totalTimingDifferencesInr = roundToPaisa(totalTimingDifferencesInr + amountInr);
                    form3CdClause26DisallowanceInr = roundToPaisa(form3CdClause26DisallowanceInr + amountInr);
                    clauseBreakdown[normalizedClause].disallowedInr = roundToPaisa(clauseBreakdown[normalizedClause].disallowedInr + amountInr);

                    evaluatedPayables.push({
                        payableId,
                        clause: normalizedClause,
                        description,
                        amountInr,
                        itrFilingDueDate,
                        paidDate,
                        paidAmountInr,
                        isAllowed: false,
                        allowedAmountInr: 0,
                        disallowedAmountInr: amountInr,
                        disallowanceType: 'TIMING_DIFFERENCE_ADD_BACK',
                        governingRule: 'Section 43B (Payment not made on or before Section 139(1) due date)',
                        taxAuditReporting: {
                            form: 'Form 3CD',
                            clause: 'Clause 26',
                            status: 'MANDATORY_DISALLOWANCE_REPORTABLE'
                        },
                        statutoryOutcome: 'DISALLOWED_TIMING_DIFFERENCE',
                        statutoryAction: paidDate
                            ? `Paid after Section 139(1) return filing due date (${paidDate} > ${itrFilingDueDate}). Strictly DISALLOWED in current FY (${financialYear}) and carried forward as deductible in the subsequent FY of actual disbursement.`
                            : `Unpaid as of Section 139(1) return filing due date (${itrFilingDueDate}). Disallowed in current FY (${financialYear}); will become deductible upon actual payment in subsequent financial year.`
                    });
                }
            }
        }
    });

    let overallDetermination = 'ALL_PAYABLES_QUALIFIED';
    if (totalPermanentDisallowancesInr > 0 && totalTimingDifferencesInr > 0) {
        overallDetermination = 'DISALLOWED_MIXED_PERMANENT_AND_TIMING';
    } else if (totalPermanentDisallowancesInr > 0) {
        overallDetermination = 'DISALLOWED_PERMANENT_CHECKMATE';
    } else if (totalTimingDifferencesInr > 0) {
        overallDetermination = 'DISALLOWED_TIMING_DIFFERENCE';
    }

    return {
        status: 'SUCCESS',
        statutoryDetermination: overallDetermination,
        financialYear,
        assessmentYear: defaultAy,
        itrFilingDueDate,
        totalPayablesCount: evaluatedPayables.length,
        summary: {
            totalIncurredInr,
            totalAllowedInr,
            totalDisallowedInr,
            totalTimingDifferencesInr,
            totalPermanentDisallowancesInr,
            form3CdClause26DisallowanceInr,
            form3CdClause20bDisallowanceInr,
            clauseBreakdown
        },
        evaluatedPayables,
        isAuthorizedToDisburse: false,
        statutoryRationale: `Section 43B / 36(1)(va) Evaluation: Evaluated ${evaluatedPayables.length} liabilities (Total INR ${totalIncurredInr.toLocaleString('en-IN')}). Allowed: INR ${totalAllowedInr.toLocaleString('en-IN')}; Total Disallowed: INR ${totalDisallowedInr.toLocaleString('en-IN')} (Permanent Clause 20(b) Checkmate: INR ${totalPermanentDisallowancesInr.toLocaleString('en-IN')}; Timing Difference Clause 26: INR ${totalTimingDifferencesInr.toLocaleString('en-IN')}). Statutory audit calculations do not authorize payment disbursement.`
    };
}
