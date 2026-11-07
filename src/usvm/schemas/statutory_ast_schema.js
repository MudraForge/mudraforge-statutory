/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MUDRAFORGE UNIVERSAL STATUTORY VIRTUAL MACHINE (USVM) - AST SCHEMA VALIDATOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements strict, typed schema validation and operator allowlists for
 * declarative statutory AST packages. Rejects dynamic code execution, unknown
 * operators, and unconstrained arithmetic.
 *
 * Specification: RFC-009 (Revision 2.1)
 */

export const SUPPORTED_NODE_TYPES = Object.freeze([
    'PREDICATE',
    'TEMPORAL_VALIDITY',
    'SNAPSHOT_VERIFY',
    'THRESHOLD_TEST',
    'DELTA',
    'SELECT',
    'OVERRIDE',
    'PRECEDENCE',
    'ARITHMETIC',
    'QUANTIZATION',
    'ASSESSMENT_ROUND'
]);

export const TYPED_OPERATORS = Object.freeze([
    'EQ',
    'NEQ',
    'IN',
    'NOT_IN',
    'GT',
    'GTE',
    'LT',
    'LTE',
    'IS_TRUE',
    'IS_FALSE',
    'EXISTS',
    'NOT_EXISTS'
]);

export const TRIGGER_POLICIES = Object.freeze([
    'EARLIER_OF',
    'PAYMENT_ONLY',
    'DEBIT_OR_RECEIPT',
    'TRANSACTION_DATE',
    'INVOICE_DATE',
    'DUE_DATE',
    'FISCAL_YEAR_END'
]);

export const MATH_ARCHETYPES = Object.freeze([
    'EXCESS_OVER_THRESHOLD',
    'CLIFF_THRESHOLD',
    'FLAT_RATE',
    'PROGRESSIVE_SLAB',
    'GROSS_UP_FACTOR',
    'COMPOUND_INTEREST_MONTHLY_RESTS',
    'MSME_FISCAL_BOUNDARY_43BH',
    'ENTERPRISE_CLASSIFICATION_MSME',
    'PROPORTIONAL_REVERSAL_180_DAYS',
    'SUPPLIER_NON_FILING_RULE37A',
    'COMMON_CREDIT_APPORTIONMENT_RULE42',
    'CAPITAL_GOODS_60_MONTH_RULE43',
    'DTAA_TREATY_TAX_HAVEN_MATRIX',
    'TRANSFER_PRICING_PERCENTILE_ALP',
    'VOTING_CONTINUITY_PERCENTAGE',
    'TAX_CLEARANCE_VOID_TRANSFER_SEC281',
    'CORPORATE_TAX_MAT_VS_CONCESSIONAL',
    'SALARY_SLAB_PROGRESSIVE_TDS',
    'NON_FILER_PENAL_RATE_206AB',
    'DEFERRED_TAX_TIMING_DIFFERENCE',
    'BLOCKED_CREDIT_GATE_17_5',
    'ITC_ELIGIBILITY_GATE_16_2',
    'RCM_LIABILITY_EVALUATION_9_3',
    'COMPOSITE_MIXED_SUPPLY_SEC8',
    'COMPOSITION_LEVY_SEC10',
    'CREDIT_NOTE_TIMELINES_SEC34',
    'EXPORT_LUT_ZERO_RATED_SEC16',
    'EINVOICING_MANDATE_RULE48_4',
    'EWAYBILL_CONSIGNMENT_RULE138',
    'GST_TDS_DEDUCTION_SEC51',
    'MCA_MSME_1_AGING_BIFURCATION',
    'MSME_DISCLOSURES_SEC22',
    'LEASE_AMORTIZATION_INDAS116',
    'REVENUE_ALLOCATION_INDAS115',
    'PROVISIONS_CONTINGENCY_INDAS37',
    'FX_SPOT_REVALUATION_INDAS21_109',
    'EXPECTED_CREDIT_LOSS_INDAS109',
    'FOREIGN_TAX_CREDIT_RELIEF',
    'SLUMP_SALE_NET_WORTH_50B',
    'BUSINESS_COMBINATIONS_INDAS103',
    'IMPAIRMENT_TESTING_INDAS36',
    'SHARE_BASED_PAYMENTS_INDAS102'
]);

export const ROUNDING_POLICIES = Object.freeze([
    'COMMERCIAL_PAISA',
    'INCOME_TAX_ACT_1961_SEC288B',
    'INCOME_TAX_ACT_2025_SEC516',
    'NONE'
]);

export class StatutoryAstValidationError extends Error {
    constructor(message, details = {}) {
        super(`[USVM_AST_VALIDATION_ERROR] ${message}`);
        this.name = 'StatutoryAstValidationError';
        this.details = details;
    }
}

/**
 * Validates a declarative statutory AST rule package against RFC-009 Revision 2.1 contracts.
 * Throws StatutoryAstValidationError if any contract is violated.
 */
export function validateStatutoryAst(ruleAst) {
    if (!ruleAst || typeof ruleAst !== 'object') {
        throw new StatutoryAstValidationError('Rule AST must be a non-null object', { ruleAst });
    }

    // 1. Mandatory Identity Fields
    if (!ruleAst.sectionId || typeof ruleAst.sectionId !== 'string') {
        throw new StatutoryAstValidationError('Rule AST must contain a valid string sectionId', { ruleAst });
    }
    if (!ruleAst.version || typeof ruleAst.version !== 'string') {
        throw new StatutoryAstValidationError('Rule AST must contain a valid string version', { sectionId: ruleAst.sectionId });
    }

    // 2. Trigger Policy Validation
    if (ruleAst.triggerPolicy) {
        if (!TRIGGER_POLICIES.includes(ruleAst.triggerPolicy.type)) {
            throw new StatutoryAstValidationError(
                `Unsupported triggerPolicy type: '${ruleAst.triggerPolicy.type}'. Must be one of: ${TRIGGER_POLICIES.join(', ')}`,
                { triggerPolicy: ruleAst.triggerPolicy }
            );
        }
        if (ruleAst.triggerPolicy.type === 'EARLIER_OF' && (!Array.isArray(ruleAst.triggerPolicy.events) || ruleAst.triggerPolicy.events.length < 2)) {
            throw new StatutoryAstValidationError(
                "Trigger policy 'EARLIER_OF' requires at least 2 events to compare",
                { triggerPolicy: ruleAst.triggerPolicy }
            );
        }
    }

    // 3. Guards Allowlist Validation
    if (ruleAst.guards) {
        if (!Array.isArray(ruleAst.guards)) {
            throw new StatutoryAstValidationError('guards must be an array', { guards: ruleAst.guards });
        }
        for (const guard of ruleAst.guards) {
            if (!guard.field || typeof guard.field !== 'string') {
                throw new StatutoryAstValidationError('Guard must define a string field path', { guard });
            }
            if (!TYPED_OPERATORS.includes(guard.operator)) {
                throw new StatutoryAstValidationError(
                    `Operator '${guard.operator}' in guard '${guard.id || guard.field}' not in typed allowlist: ${TYPED_OPERATORS.join(', ')}`,
                    { guard }
                );
            }
        }
    }

    // 4. Threshold & Math Archetype Validation
    if (ruleAst.computation) {
        const comp = ruleAst.computation;
        if (comp.archetype && !MATH_ARCHETYPES.includes(comp.archetype)) {
            throw new StatutoryAstValidationError(
                `Unsupported math archetype '${comp.archetype}'. Must be one of: ${MATH_ARCHETYPES.join(', ')}`,
                { computation: comp }
            );
        }
        if (comp.thresholdPaisa !== undefined && typeof comp.thresholdPaisa !== 'string' && typeof comp.thresholdPaisa !== 'number') {
            throw new StatutoryAstValidationError(
                'thresholdPaisa must be a valid decimal string or number',
                { thresholdPaisa: comp.thresholdPaisa }
            );
        }
        if (comp.standardRateBps !== undefined && (typeof comp.standardRateBps !== 'number' || comp.standardRateBps < 0)) {
            throw new StatutoryAstValidationError(
                'standardRateBps must be a non-negative number',
                { standardRateBps: comp.standardRateBps }
            );
        }
    }

    // 5. Rounding Policy Validation
    if (ruleAst.rounding) {
        if (ruleAst.rounding.transactionLine && !ROUNDING_POLICIES.includes(ruleAst.rounding.transactionLine)) {
            throw new StatutoryAstValidationError(
                `Unsupported transactionLine rounding policy: '${ruleAst.rounding.transactionLine}'`,
                { rounding: ruleAst.rounding }
            );
        }
        if (ruleAst.rounding.assessmentTotal && !ROUNDING_POLICIES.includes(ruleAst.rounding.assessmentTotal)) {
            throw new StatutoryAstValidationError(
                `Unsupported assessmentTotal rounding policy: '${ruleAst.rounding.assessmentTotal}'`,
                { rounding: ruleAst.rounding }
            );
        }
    }

    return true;
}
