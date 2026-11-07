/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MUDRAFORGE UNIVERSAL STATUTORY VIRTUAL MACHINE (USVM) - EVALUATION KERNEL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements the stateless evaluation kernel for declarative statutory AST packages.
 * Evaluates predicates, triggers, thresholds, rational math, and dual-Act regimes
 * with sub-microsecond latency and zero external dependencies.
 *
 * Specification: RFC-009 (Revision 2.1)
 */

import { validateStatutoryAst } from './schemas/statutory_ast_schema.js';
import {
    toBigIntPaise,
    fromBigIntPaise,
    multiplyRational,
    quantizeCurrencyPaisa,
    roundStatutoryAssessment
} from './math_rational.js';
import {
    evaluateMsmeDelayedPaymentCompoundInterest,
    evaluateSection43bHFiscalBoundary,
    evaluateMsmeEnterpriseClassification,
    evaluateGstRule37ProportionalReversal,
    evaluateGstRule37ASupplierNonFiling,
    evaluateGstRule42CommonCreditApportionment,
    evaluateCrossBorderDtaaMatrix,
    evaluateTransferPricingPercentileAlp,
    evaluateSection79VotingContinuity,
    evaluateSection281VoidTransfer,
    evaluateCorporateTaxMatVsConcessionalUsvm,
    evaluateSalaryProgressiveTds,
    evaluateNonFilerPenalRate206AB,
    evaluateDeferredTaxIndAs12Usvm,
    evaluateBlockedCreditSection17_5,
    evaluateItcEligibilitySection16_2,
    evaluateRcmLiabilitySection9_3,
    evaluateCompositeMixedSuppliesSection8,
    evaluateCompositionLevySection10,
    evaluateCreditDebitNotesSection34,
    evaluateExportLutSection16,
    evaluateEInvoicingRule48_4,
    evaluateEWayBillRule138,
    evaluateGstTdsSection51,
    evaluateMcaMsme1Aging,
    evaluateMsmeDisclosuresSection22,
    evaluateLeaseAmortizationIndAs116Usvm,
    evaluateRevenueAllocationIndAs115Usvm,
    evaluateProvisionsAndContingenciesIndAs37Usvm,
    evaluateForeignExchangeRevaluationUsvm,
    evaluateExpectedCreditLossIndAs109Usvm,
    evaluateForeignTaxCreditRelief,
    evaluateSlumpSaleSection50B,
    evaluateBusinessCombinationsIndAs103Usvm,
    evaluateImpairmentIndAs36Usvm,
    evaluateShareBasedPaymentsIndAs102Usvm
} from './usvm_domain_evaluators.js';

/**
 * Safely extracts a nested property using dot-separated notation.
 */
function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = String(path).split('.');
    let curr = obj;
    for (const part of parts) {
        if (curr === null || curr === undefined) return undefined;
        curr = curr[part];
    }
    return curr;
}

/**
 * Evaluates a typed comparison operator against fact value and target value.
 */
function evaluateOperator(factValue, operator, targetValue) {
    switch (operator) {
        case 'EQ':
            return factValue === targetValue;
        case 'NEQ':
            return factValue !== targetValue;
        case 'GT':
            return factValue > targetValue;
        case 'GTE':
            return factValue >= targetValue;
        case 'LT':
            return factValue < targetValue;
        case 'LTE':
            return factValue <= targetValue;
        case 'IN':
            return Array.isArray(targetValue) && targetValue.includes(factValue);
        case 'NOT_IN':
            return Array.isArray(targetValue) && !targetValue.includes(factValue);
        case 'IS_TRUE':
            return Boolean(factValue) === true;
        case 'IS_FALSE':
            return Boolean(factValue) === false;
        case 'EXISTS':
            return factValue !== undefined && factValue !== null;
        case 'NOT_EXISTS':
            return factValue === undefined || factValue === null;
        default:
            return false;
    }
}

/**
 * Resolves the statutory crystallization date and governing regime (1961 vs 2025 Act)
 * based on the provision's trigger policy and transaction facts.
 */
export function resolveTemporalCrystallization(triggerPolicy, facts, cutoverDate = '2026-04-01') {
    const creditDate = facts.creditDate || facts.temporalFacts?.bookCreditDate || null;
    const paymentDate = facts.paymentDate || facts.temporalFacts?.paymentDate || null;
    const transactionDate = facts.transactionDate || facts.temporalFacts?.transactionDate || null;

    let crystallizedDate = null;
    let crystallizationEvent = 'UNDETERMINED';
    let isStraddling = false;

    const policyType = triggerPolicy?.type || 'EARLIER_OF';

    if (policyType === 'EARLIER_OF') {
        if (creditDate && paymentDate) {
            if (creditDate <= paymentDate) {
                crystallizedDate = creditDate;
                crystallizationEvent = 'BOOK_CREDIT';
            } else {
                crystallizedDate = paymentDate;
                crystallizationEvent = 'PAYMENT_DISBURSEMENT';
            }

            const creditIsPre = creditDate < cutoverDate;
            const paymentIsPre = paymentDate < cutoverDate;
            if (creditIsPre !== paymentIsPre) {
                isStraddling = true;
            }
        } else if (creditDate) {
            crystallizedDate = creditDate;
            crystallizationEvent = 'BOOK_CREDIT';
        } else if (paymentDate) {
            crystallizedDate = paymentDate;
            crystallizationEvent = 'PAYMENT_DISBURSEMENT';
        } else if (transactionDate) {
            crystallizedDate = transactionDate;
            crystallizationEvent = 'TRANSACTION_DATE';
        }
    } else if (policyType === 'PAYMENT_ONLY') {
        crystallizedDate = paymentDate || transactionDate || null;
        crystallizationEvent = 'PAYMENT_DISBURSEMENT';
    } else {
        crystallizedDate = transactionDate || creditDate || paymentDate || null;
        crystallizationEvent = 'TRANSACTION_DATE';
    }

    const hasDate = Boolean(crystallizedDate);
    const isAct2025 = hasDate ? crystallizedDate >= cutoverDate : false;
    const governingRegime = hasDate ? (isAct2025 ? 'ACT_2025' : 'ACT_1961') : 'INDETERMINATE_PENDING_TRANSACTION_DATE';

    return {
        crystallizedDate,
        crystallizationEvent,
        isAct2025,
        governingRegime,
        isStraddling,
        creditDate,
        paymentDate
    };
}

/**
 * Pure stateless evaluation kernel for the Universal Statutory Virtual Machine (USVM).
 * Evaluates an approved declarative AST rule package against transaction facts.
 *
 * @param {Object} ruleAst - Validated declarative AST package
 * @param {Object} facts - Ingress transaction facts
 * @returns {Object} Fiduciary statutory evaluation voucher
 */
export function evaluateStatutoryAst(ruleAst, facts = {}) {
    // 1. Strict AST validation
    validateStatutoryAst(ruleAst);

    const trace = [];

    // 2. Fiduciary base result initialization
    const result = {
        isAuthorizedToDisburse: false, // Fiduciary invariant: computation NEVER authorizes money movement
        ruleId: ruleAst.sectionId,
        ruleVersion: ruleAst.version,
        disposition: 'EVALUATING',
        isTdsApplicable: false,
        isSectionApplicable: false,
        invoiceAmountInr: 0,
        taxableBase: 0,
        tdsRatePercent: 0,
        calculatedTdsInr: 0,
        netWireInr: 0,
        executionTrace: trace
    };

    // 3. Temporal Crystallization & Dual-Act Resolution
    const cutoverDate = ruleAst.transitionalCutoverDate || '2026-04-01';
    const temporal = resolveTemporalCrystallization(ruleAst.triggerPolicy, facts, cutoverDate);

    result.isAct2025 = temporal.isAct2025;
    result.effectiveDate = temporal.crystallizedDate;
    result.regimeStatus = temporal.governingRegime === 'INDETERMINATE_PENDING_TRANSACTION_DATE' ? 'INDETERMINATE_PENDING_TRANSACTION_DATE' : 'DETERMINED';

    if (temporal.isStraddling) {
        result.temporalStraddlingAnalysis = {
            crystallizedDate: temporal.crystallizedDate,
            crystallizationEvent: temporal.crystallizationEvent,
            governingRegime: temporal.governingRegime,
            creditDate: temporal.creditDate,
            paymentDate: temporal.paymentDate,
            legalRule: 'Under Indian direct tax jurisprudence, tax deduction attaches at the earlier of credit or payment. Pre-1 April 2026 crystallization event cements Income-tax Act, 1961 regime.'
        };
    }

    const governingSection = temporal.isAct2025
        ? `${ruleAst.successorStatute || 'Income-tax Act, 2025'} ${ruleAst.successorSection || ''}`.trim()
        : `${ruleAst.governingStatute || 'Income-tax Act, 1961'} ${ruleAst.statutorySection || ''}`.trim();

    result.governingWithholdingSection = governingSection;
    result.governingSection = governingSection;
    result.governingStatute = temporal.governingRegime;

    // 4. Evaluate Guards (Pre-conditions & Penalties)
    let overrideRateBps = null;
    let panPenaltySection = null;

    if (Array.isArray(ruleAst.guards)) {
        for (const guard of ruleAst.guards) {
            // Check direct fact or nested path (supporting legacy and normalized facts)
            let factValue = getNestedValue(facts, guard.field);
            if (factValue === undefined && guard.field.startsWith('payee.')) {
                // Support flat legacy keys (e.g. payee.isResident -> isResident or hasPan)
                const flatKey = guard.field.replace('payee.', '');
                if (flatKey === 'isPanValid' && facts.hasPan !== undefined) {
                    factValue = Boolean(facts.hasPan) && !Boolean(facts.isPanInoperative);
                } else if (facts[flatKey] !== undefined) {
                    factValue = facts[flatKey];
                }
            }
            if (factValue === undefined && guard.field === 'payee.isResident' && facts.sellerIsNonResident !== undefined) {
                factValue = !Boolean(facts.sellerIsNonResident);
            }

            const isMatch = evaluateOperator(factValue, guard.operator, guard.value);

            if (isMatch) {
                trace.push(`Guard matched: ${guard.id}`);
                const onMatch = guard.onMatch;

                if (onMatch?.action === 'HALT_EXEMPT') {
                    const rawInvoice = Number(facts.invoiceAmount || facts.grossAmountInr || facts.lineItem?.grossAmountPaisa || 0);
                    result.disposition = onMatch.disposition || 'EXEMPT';
                    result.statutoryDisposition = onMatch.disposition || 'EXEMPT';
                    result.statutoryReason = onMatch.reason || 'Guard halted computation as exempt';
                    result.isExemptForeignImport = Boolean(facts.isImportOfGoods || facts.sellerIsNonResident);
                    result.invoiceAmountInr = rawInvoice;
                    result.netWireInr = rawInvoice;
                    result.governingSection = temporal.isAct2025
                        ? 'CBDT Circular No. 13 of 2021 Question 3 (Read with Section 393(2))'
                        : 'CBDT Circular No. 13 of 2021 Question 3 (Read with Section 195)';
                    return result;
                }

                if (onMatch?.action === 'OVERRIDE_RATE') {
                    overrideRateBps = onMatch.overrideRateBps;
                    panPenaltySection = temporal.isAct2025
                        ? onMatch.governingSection2025
                        : onMatch.governingSection1961;
                    trace.push(`Override applied: rate set to ${overrideRateBps} bps (${overrideRateBps / 100}%)`);
                }
            }
        }
    }

    result.governingPanPenaltySection = panPenaltySection || (temporal.isAct2025 ? 'Section 397 (PAN compliant)' : 'Section 206AA (PAN compliant)');

    const archetype = ruleAst.computation?.archetype || 'EXCESS_OVER_THRESHOLD';

    // Advanced Domain Archetype Dispatches
    if (archetype === 'COMPOUND_INTEREST_MONTHLY_RESTS') {
        return evaluateMsmeDelayedPaymentCompoundInterest(ruleAst, facts, trace);
    }
    if (archetype === 'MSME_FISCAL_BOUNDARY_43BH') {
        return evaluateSection43bHFiscalBoundary(ruleAst, facts, trace);
    }
    if (archetype === 'ENTERPRISE_CLASSIFICATION_MSME') {
        return evaluateMsmeEnterpriseClassification(ruleAst, facts, trace);
    }
    if (archetype === 'PROPORTIONAL_REVERSAL_180_DAYS') {
        return evaluateGstRule37ProportionalReversal(ruleAst, facts, trace);
    }
    if (archetype === 'SUPPLIER_NON_FILING_RULE37A') {
        return evaluateGstRule37ASupplierNonFiling(ruleAst, facts, trace);
    }
    if (archetype === 'COMMON_CREDIT_APPORTIONMENT_RULE42') {
        return evaluateGstRule42CommonCreditApportionment(ruleAst, facts, trace);
    }
    if (archetype === 'DTAA_TREATY_TAX_HAVEN_MATRIX') {
        return evaluateCrossBorderDtaaMatrix(ruleAst, facts, temporal, trace);
    }
    if (archetype === 'TRANSFER_PRICING_PERCENTILE_ALP') {
        return evaluateTransferPricingPercentileAlp(ruleAst, facts, trace);
    }
    if (archetype === 'VOTING_CONTINUITY_PERCENTAGE') {
        return evaluateSection79VotingContinuity(ruleAst, facts, trace);
    }
    if (archetype === 'TAX_CLEARANCE_VOID_TRANSFER_SEC281') {
        return evaluateSection281VoidTransfer(ruleAst, facts, trace);
    }
    if (archetype === 'CORPORATE_TAX_MAT_VS_CONCESSIONAL') {
        return evaluateCorporateTaxMatVsConcessionalUsvm(ruleAst, facts, trace);
    }
    if (archetype === 'SALARY_SLAB_PROGRESSIVE_TDS') {
        return evaluateSalaryProgressiveTds(ruleAst, facts, trace);
    }
    if (archetype === 'NON_FILER_PENAL_RATE_206AB') {
        return evaluateNonFilerPenalRate206AB(ruleAst, facts, trace);
    }
    if (archetype === 'DEFERRED_TAX_TIMING_DIFFERENCE') {
        return evaluateDeferredTaxIndAs12Usvm(ruleAst, facts, trace);
    }
    if (archetype === 'BLOCKED_CREDIT_GATE_17_5') {
        return evaluateBlockedCreditSection17_5(ruleAst, facts, trace);
    }
    if (archetype === 'ITC_ELIGIBILITY_GATE_16_2') {
        return evaluateItcEligibilitySection16_2(ruleAst, facts, trace);
    }
    if (archetype === 'RCM_LIABILITY_EVALUATION_9_3') {
        return evaluateRcmLiabilitySection9_3(ruleAst, facts, trace);
    }
    if (archetype === 'COMPOSITE_MIXED_SUPPLY_SEC8') {
        return evaluateCompositeMixedSuppliesSection8(ruleAst, facts, trace);
    }
    if (archetype === 'COMPOSITION_LEVY_SEC10') {
        return evaluateCompositionLevySection10(ruleAst, facts, trace);
    }
    if (archetype === 'CREDIT_NOTE_TIMELINES_SEC34') {
        return evaluateCreditDebitNotesSection34(ruleAst, facts, trace);
    }
    if (archetype === 'EXPORT_LUT_ZERO_RATED_SEC16') {
        return evaluateExportLutSection16(ruleAst, facts, trace);
    }
    if (archetype === 'EINVOICING_MANDATE_RULE48_4') {
        return evaluateEInvoicingRule48_4(ruleAst, facts, trace);
    }
    if (archetype === 'EWAYBILL_CONSIGNMENT_RULE138') {
        return evaluateEWayBillRule138(ruleAst, facts, trace);
    }
    if (archetype === 'GST_TDS_DEDUCTION_SEC51') {
        return evaluateGstTdsSection51(ruleAst, facts, trace);
    }
    if (archetype === 'MCA_MSME_1_AGING_BIFURCATION') {
        return evaluateMcaMsme1Aging(ruleAst, facts, trace);
    }
    if (archetype === 'MSME_DISCLOSURES_SEC22') {
        return evaluateMsmeDisclosuresSection22(ruleAst, facts, trace);
    }
    if (archetype === 'LEASE_AMORTIZATION_INDAS116') {
        return evaluateLeaseAmortizationIndAs116Usvm(ruleAst, facts, trace);
    }
    if (archetype === 'REVENUE_ALLOCATION_INDAS115') {
        return evaluateRevenueAllocationIndAs115Usvm(ruleAst, facts, trace);
    }
    if (archetype === 'PROVISIONS_CONTINGENCY_INDAS37') {
        return evaluateProvisionsAndContingenciesIndAs37Usvm(ruleAst, facts, trace);
    }
    if (archetype === 'FX_SPOT_REVALUATION_INDAS21_109') {
        return evaluateForeignExchangeRevaluationUsvm(ruleAst, facts, trace);
    }
    if (archetype === 'EXPECTED_CREDIT_LOSS_INDAS109') {
        return evaluateExpectedCreditLossIndAs109Usvm(ruleAst, facts, trace);
    }
    if (archetype === 'FOREIGN_TAX_CREDIT_RELIEF') {
        return evaluateForeignTaxCreditRelief(ruleAst, facts, trace);
    }
    if (archetype === 'SLUMP_SALE_NET_WORTH_50B') {
        return evaluateSlumpSaleSection50B(ruleAst, facts, trace);
    }
    if (archetype === 'BUSINESS_COMBINATIONS_INDAS103') {
        return evaluateBusinessCombinationsIndAs103Usvm(ruleAst, facts, trace);
    }
    if (archetype === 'IMPAIRMENT_TESTING_INDAS36') {
        return evaluateImpairmentIndAs36Usvm(ruleAst, facts, trace);
    }
    if (archetype === 'SHARE_BASED_PAYMENTS_INDAS102') {
        return evaluateShareBasedPaymentsIndAs102Usvm(ruleAst, facts, trace);
    }

    // 5. Ingress Invoice Consideration Quantization
    let currentInvoicePaise = 0n;
    let rawInvoiceInr = 0;

    if (facts.lineItem?.grossAmountPaisa !== undefined) {
        currentInvoicePaise = BigInt(facts.lineItem.grossAmountPaisa);
        rawInvoiceInr = fromBigIntPaise(currentInvoicePaise);
    } else {
        rawInvoiceInr = Number(facts.invoiceAmount ?? facts.grossAmountInr ?? 0);
        const gstAmountInr = Number(facts.gstAmountInr || 0);
        const isAdvancePayment = Boolean(facts.isAdvancePayment);
        const creditNoteInr = Number(facts.creditNoteInr || 0);
        const creditNoteTiming = facts.creditNoteTiming || 'BEFORE_TAX_DEDUCTION';

        // CBDT Circular No. 13 of 2021 Question 1: GST excluded when separately indicated & not advance
        const effectivePurchaseInr = isAdvancePayment
            ? rawInvoiceInr
            : Math.max(0, rawInvoiceInr - gstAmountInr);

        // CBDT Circular No. 13 of 2021 Question 4: Credit Note treatment
        const isCreditNoteBefore = creditNoteTiming !== 'AFTER_TAX_DEDUCTION';
        const amountInr = isCreditNoteBefore
            ? Math.max(0, effectivePurchaseInr - creditNoteInr)
            : effectivePurchaseInr;

        currentInvoicePaise = toBigIntPaise(amountInr);
    }

    // 6. Cumulative Threshold Consideration Evaluation
    let priorPurchasesPaise = 0n;
    if (facts.aggregateSnapshot?.aggregatePaisa !== undefined) {
        priorPurchasesPaise = BigInt(facts.aggregateSnapshot.aggregatePaisa);
    } else {
        const priorPurchasesInr = Number(
            facts.priorPurchasesInCurrentFyInr ??
            facts.currentFyPriorPurchasesInr ??
            facts.priorFyPurchases ??
            0
        );
        priorPurchasesPaise = toBigIntPaise(priorPurchasesInr);
    }

    const thresholdPaise = ruleAst.computation?.thresholdPaisa !== undefined
        ? BigInt(ruleAst.computation.thresholdPaisa)
        : 500000000n; // Default ₹50L = 500,000,000 paise

    const cumulativeBeforePaise = priorPurchasesPaise;
    const cumulativeAfterPaise = priorPurchasesPaise + currentInvoicePaise;

    let taxableBasePaise = 0n;
    let isThresholdBreached = false;

    if (archetype === 'EXCESS_OVER_THRESHOLD') {
        if (cumulativeAfterPaise <= thresholdPaise) {
            taxableBasePaise = 0n;
            isThresholdBreached = false;
        } else if (cumulativeBeforePaise >= thresholdPaise) {
            // Threshold was already fully breached by prior purchases; entire current invoice is in excess
            taxableBasePaise = currentInvoicePaise;
            isThresholdBreached = true;
        } else {
            // Breaches threshold during this specific invoice: tax strictly on the incremental excess
            taxableBasePaise = cumulativeAfterPaise - thresholdPaise;
            isThresholdBreached = true;
        }
    } else if (archetype === 'CLIFF_THRESHOLD') {
        if (cumulativeAfterPaise > thresholdPaise) {
            taxableBasePaise = currentInvoicePaise;
            isThresholdBreached = true;
        }
    } else if (archetype === 'FLAT_RATE') {
        taxableBasePaise = currentInvoicePaise;
        isThresholdBreached = true;
    }

    // 7. Rate Resolution & 5-Stage Rational Arithmetic
    const standardRateBps = ruleAst.computation?.standardRateBps ?? 10; // Default 10 bps (0.1%)
    const effectiveRateBps = overrideRateBps !== null ? overrideRateBps : standardRateBps;

    let lineItemTdsPaise = 0n;

    if (taxableBasePaise > 0n && effectiveRateBps > 0) {
        // Stage 1 & 2: Exact Rational Multiplication & Remainder Extraction
        const { quotientPaise, subPaisaRemainder } = multiplyRational(taxableBasePaise, effectiveRateBps, 10000n);

        // Stage 3: Currency Quantization (Commercial Paisa Rounding)
        lineItemTdsPaise = quantizeCurrencyPaisa(quotientPaise, subPaisaRemainder, 10000n);
    }

    // Stage 4: Statutory Assessment Rounding (Section 288B / 516)
    const assessmentRoundingPolicy = temporal.isAct2025 ? 'INCOME_TAX_ACT_2025_SEC516' : 'INCOME_TAX_ACT_1961_SEC288B';
    const assessmentTdsPaise = roundStatutoryAssessment(lineItemTdsPaise, assessmentRoundingPolicy);

    // 8. Final Fiduciary Return Formulation
    const taxableBaseInr = fromBigIntPaise(taxableBasePaise);
    const calculatedTdsInr = fromBigIntPaise(lineItemTdsPaise);
    const netWireInr = Math.max(0, rawInvoiceInr - calculatedTdsInr);

    result.invoiceAmountInr = rawInvoiceInr;
    result.taxableBase = taxableBaseInr;
    result.tdsRatePercent = effectiveRateBps / 100;
    result.calculatedTdsInr = calculatedTdsInr;
    result.assessmentRoundedTdsInr = fromBigIntPaise(assessmentTdsPaise);
    result.netWireInr = netWireInr;
    result.isTdsApplicable = calculatedTdsInr > 0;
    result.isSection194QApplicable = isThresholdBreached;
    result.disposition = isThresholdBreached ? 'TAX_DEDUCTIBLE' : 'THRESHOLD_NOT_BREACHED';
    result.statutoryDisposition = isThresholdBreached ? 'SECTION_194Q_DEDUCTION_MANDATORY' : 'EXEMPT_BELOW_STATUTORY_THRESHOLD';

    return result;
}
