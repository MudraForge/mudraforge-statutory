/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MUDRAFORGE UNIVERSAL STATUTORY VIRTUAL MACHINE (USVM)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Zero-dependency declarative calculation and deontic evaluation runtime for
 * statutory tax, accounting, and computational law provisions.
 *
 * Specification: RFC-009 (Revision 3.1)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    evaluateStatutoryAst,
    resolveTemporalCrystallization
} from './evaluation_vm.js';

import {
    evaluateExpression,
    executeDeclarativePipeline,
    UNIVERSAL_OPERATORS,
    MAX_EXPRESSION_DEPTH,
    MAX_PIPELINE_STEPS,
    MAX_COLLECTION_ITEMS,
    MAX_TOTAL_QUANTIFIER_ITERATIONS,
    MAX_QUANTIFIER_NESTING
} from './universal_evaluator.js';

import {
    parseInfixExpression,
    tokenize
} from './infix_parser.js';

import {
    validateStatutoryAst,
    StatutoryAstValidationError,
    MATH_ARCHETYPES,
    TRIGGER_POLICIES,
    ROUNDING_POLICIES,
    TYPED_OPERATORS,
    QUANTIFIER_OPERATORS,
    RULE_DOMAINS,
    EXECUTION_MODES,
    OKF_LIFECYCLE_STATUSES
} from './schemas/statutory_ast_schema.js';

import {
    toBigIntPaise,
    fromBigIntPaise,
    multiplyRational,
    quantizeCurrencyPaisa,
    roundStatutoryAssessment
} from './math_rational.js';

import { classifyOkfRuleLifecycle } from './okf_lifecycle_monitor.js';

export {
    evaluateStatutoryAst,
    resolveTemporalCrystallization,
    evaluateExpression,
    executeDeclarativePipeline,
    UNIVERSAL_OPERATORS,
    MAX_EXPRESSION_DEPTH,
    MAX_PIPELINE_STEPS,
    MAX_COLLECTION_ITEMS,
    MAX_TOTAL_QUANTIFIER_ITERATIONS,
    MAX_QUANTIFIER_NESTING,
    parseInfixExpression,
    tokenize,
    validateStatutoryAst,
    StatutoryAstValidationError,
    MATH_ARCHETYPES,
    TRIGGER_POLICIES,
    ROUNDING_POLICIES,
    TYPED_OPERATORS,
    QUANTIFIER_OPERATORS,
    RULE_DOMAINS,
    EXECUTION_MODES,
    OKF_LIFECYCLE_STATUSES,
    toBigIntPaise,
    fromBigIntPaise,
    multiplyRational,
    quantizeCurrencyPaisa,
    roundStatutoryAssessment,
    classifyOkfRuleLifecycle
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULE_MAP = new Map();

/**
 * Loads and caches an AST rule by section key.
 */
export function getStatutoryAst(sectionKey) {
    const key = String(sectionKey || '').toUpperCase().trim();
    if (RULE_MAP.has(key)) return RULE_MAP.get(key);

    const rulesDir = path.resolve(__dirname, 'rules');
    if (!fs.existsSync(rulesDir)) return null;

    const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
        try {
            const raw = fs.readFileSync(path.join(rulesDir, f), 'utf8');
            const ast = JSON.parse(raw);
            if (
                ast.sectionId?.toUpperCase() === key ||
                ast.statutorySection?.toUpperCase().includes(key) ||
                f.toUpperCase().includes(key.replace(/[^A-Z0-9]/g, '_'))
            ) {
                RULE_MAP.set(key, ast);
                return ast;
            }
        } catch (_) {}
    }

    return null;
}

/**
 * High-level canonical Universal Statutory Virtual Machine (USVM) class.
 */
export class UniversalStatutoryVM {
    constructor(options = {}) {
        this.defaultMode = options.mode || 'DEVELOPMENT';
    }

    evaluate(ast, facts = {}, options = {}) {
        return evaluateStatutoryAst(ast, facts, { mode: this.defaultMode, ...options });
    }

    evaluatePipeline(pipeline, context = {}) {
        return executeDeclarativePipeline(pipeline, context);
    }

    evaluateExpression(expr, context = {}) {
        return evaluateExpression(expr, context);
    }

    parseInfix(formula) {
        return parseInfixExpression(formula);
    }

    validate(ast) {
        return validateStatutoryAst(ast);
    }

    classifyLifecycle(ast, baseline = null) {
        return classifyOkfRuleLifecycle(ast, baseline);
    }
}
