/**
 * MUDRAFORGE UNIVERSAL STATUTORY VIRTUAL MACHINE (USVM)
 * Zero-dependency declarative calculation runtime for statutory tax & accounting.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export {
    evaluateStatutoryAst,
    resolveTemporalCrystallization
} from './evaluation_vm.js';

export {
    validateStatutoryAst,
    StatutoryAstValidationError,
    MATH_ARCHETYPES,
    TRIGGER_POLICIES,
    ROUNDING_POLICIES,
    TYPED_OPERATORS
} from './schemas/statutory_ast_schema.js';

export {
    toBigIntPaise,
    fromBigIntPaise,
    multiplyRational,
    quantizeCurrencyPaisa,
    roundStatutoryAssessment
} from './math_rational.js';

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

    // Search rules dir for matching sectionId or filename
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
