/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DETERMINISTIC NUMERIC & CURRENCY NORMALIZATION UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════
 * Pure, zero-dependency mathematical and currency normalization routines.
 * Enforces IEEE-754 floating point drift elimination and Number.MAX_SAFE_INTEGER bounds.
 */

/**
 * Error thrown when a required numeric field cannot be parsed from input.
 */
export class MalformedNumericInputError extends Error {
    constructor(val, fieldName = 'amount') {
        super(`[@mudraforge/statutory] Malformed numeric input for field "${fieldName}": "${val}". Input could not be safely resolved to a finite number.`);
        this.name = 'MalformedNumericInputError';
        this.code = 'MALFORMED_NUMERIC_INPUT';
        this.field = fieldName;
        this.rawValue = val;
    }
}

/**
 * Error thrown when a mandatory statutory calculation parameter is missing or null.
 */
export class MissingMandatoryParameterError extends Error {
    constructor(fieldName, functionName) {
        super(`[@mudraforge/statutory] ${functionName}: Mandatory parameter "${fieldName}" is missing or undefined.`);
        this.name = 'MissingMandatoryParameterError';
        this.code = 'MISSING_MANDATORY_PARAMETER';
        this.field = fieldName;
        this.functionName = functionName;
    }
}

/**
 * Validates that a required statutory input parameter is present and resolves cleanly
 * to a finite numeric value, rejecting missing, null, or malformed input without silent coercion.
 * 
 * @param {any} val - The input value to validate
 * @param {string} fieldName - The parameter name for diagnostics
 * @param {string} functionName - The calling calculator function name
 * @param {Object} [options]
 * @param {boolean} [options.interpretCreditAsNegative=false]
 * @returns {number} Clean normalized number
 */
export function assertMandatoryNumeric(val, fieldName, functionName, options = {}) {
    if (val === undefined || val === null) {
        throw new MissingMandatoryParameterError(fieldName, functionName);
    }
    return cleanNumericAmount(val, {
        strict: true,
        fieldName,
        interpretCreditAsNegative: options.interpretCreditAsNegative || false
    });
}

/**
 * Safely normalizes numeric inputs from numbers, strings with currency symbols (₹, $, €, Rs, INR),
 * thousands separators (commas), and whitespace into valid finite numbers.
 * 
 * Accounting conventions handled:
 * - Parentheses: "(1,500.00)" or "(₹ 1,500.00)" -> -1500.00
 * - Trailing minus: "1,500.00-" -> -1500.00
 * - Leading minus with spaces: "- ₹ 1,500.00" -> -1500.00
 * - Credit suffix: "1,500.00 CR" -> magnitude 1500.00. Negated only if interpretCreditAsNegative: true.
 * - Negative zero (-0) normalized to unsigned 0.
 * 
 * @param {any} val - Input number or formatted numeric string
 * @param {Object} [options]
 * @param {boolean} [options.strict=false] - When true, throws MalformedNumericInputError on unparseable strings
 * @param {string} [options.fieldName='amount'] - Diagnostic field name for error reporting
 * @param {boolean} [options.interpretCreditAsNegative=false] - Whether "CR" suffix inverts sign
 * @returns {number} Normalized float
 */
export function cleanNumericAmount(val, options = {}) {
    const {
        strict = false,
        fieldName = 'amount',
        interpretCreditAsNegative = false,
        defaultValue = 0
    } = options;

    if (typeof val === 'number') {
        if (!Number.isFinite(val) || isNaN(val)) {
            if (strict) {
                throw new MalformedNumericInputError(val, fieldName);
            }
            return defaultValue;
        }
        return Object.is(val, -0) ? 0 : val;
    }
    if (val === null || val === undefined || typeof val === 'boolean') {
        return defaultValue;
    }
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed) return defaultValue;

        let isNegative = false;
        let s = trimmed;

        // Financial malformation checks:
        // 1. Digits separated by whitespace (e.g. "100 200" or concatenated invoice numbers)
        // 2. Double commas or double decimal points (e.g. "1,,000" or "100..50")
        // 3. Comma appearing after a decimal point (e.g. "100.50,25")
        if (/\d\s+\d/.test(s) || /(?:,,|\.\.)/.test(s) || /\.\d*,/.test(s)) {
            if (strict) {
                throw new MalformedNumericInputError(val, fieldName);
            }
            return defaultValue;
        }

        // Strip leading currency label before parenthesis or sign: "₹ (50,000.00)" or "INR -50,000"
        s = s.replace(/^(?:₹|\$|€|INR|Rs\.?)\s*/i, '');

        // Accounting parentheses: (1,500.00) or (₹ 1,500.00)
        if (/^\(.*\)$/.test(s)) {
            isNegative = true;
            s = s.slice(1, -1).trim();
        } else if (/-\s*$/.test(s)) {
            // Trailing minus from legacy ERP dumps: "1,500.00-"
            isNegative = true;
            s = s.replace(/-\s*$/, '').trim();
        } else if (/^\s*-\s*/.test(s)) {
            // Explicit leading minus with possible whitespace: "- ₹ 1,500.00" or "-1500"
            isNegative = true;
            s = s.replace(/^\s*-\s*/, '').trim();
        } else if (/(?:\s+)?(?:cr|credit)\.?$/i.test(s)) {
            // Accounting credit suffix: "1,500.00 CR"
            if (interpretCreditAsNegative) {
                isNegative = true;
            }
            s = s.replace(/(?:\s+)?(?:cr|credit)\.?$/i, '').trim();
        } else if (/(?:\s+)?(?:dr|debit)\.?$/i.test(s)) {
            // Accounting debit suffix: "1,500.00 DR"
            s = s.replace(/(?:\s+)?(?:dr|debit)\.?$/i, '').trim();
        }

        // Strip remaining currency symbols, commas, and currency labels
        const cleaned = s.replace(/[₹$€,\s]|(?:INR|Rs\.?)/gi, '');
        const n = parseFloat(cleaned);
        
        // Check for malformed strings that had non-numeric text left over
        const isCleanNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(cleaned);
        if (!isCleanNumber || !Number.isFinite(n) || isNaN(n)) {
            if (strict) {
                throw new MalformedNumericInputError(val, fieldName);
            }
            return defaultValue;
        }

        const res = isNegative ? -Math.abs(n) : n;
        return Object.is(res, -0) ? 0 : res;
    }
    return defaultValue;
}

/**
 * High-precision conversion of rupees to integer paise.
 * Avoids IEEE-754 floating point drift during threshold and summation operations.
 * 
 * Safety Bounds & Precision Policy:
 * - Bounds: Asserts absolute value does not exceed JavaScript Number.MAX_SAFE_INTEGER (53-bit integer limit).
 * - Precision: Applies standard statutory half-up rounding (Math.round) to the nearest integer paisa.
 * - Strict sub-paisa: When options.strictSubPaisa is true, rejects amounts having fractional sub-paisa (>2 decimals).
 * 
 * @param {any} amount - Rupees amount or formatted string
 * @param {string|Object} [options='amount'] - Diagnostic field name or options object
 * @param {string} [options.fieldName='amount']
 * @param {boolean} [options.strict=false]
 * @param {boolean} [options.strictSubPaisa=false]
 * @returns {number} Integer paise (e.g. 50.25 -> 5025)
 */
export function toIntegerPaise(amount, options = 'amount') {
    const opts = typeof options === 'string' ? { fieldName: options } : (options || {});
    const {
        fieldName = 'amount',
        strict = false,
        strictSubPaisa = false
    } = opts;

    const n = cleanNumericAmount(amount, { strict, fieldName });
    const rawPaise = n * 100;

    // Safe integer boundary assertion (9 quadrillion paise / ~₹90 Trillion limit)
    if (Math.abs(rawPaise) > Number.MAX_SAFE_INTEGER) {
        throw new RangeError(`[@mudraforge/statutory] Amount exceeds JavaScript MAX_SAFE_INTEGER (53-bit limit) in field "${fieldName}".`);
    }

    const roundedPaise = Math.round(rawPaise);

    // Explicit sub-paisa fractional detection
    if (strictSubPaisa && Math.abs(rawPaise - roundedPaise) > 1e-4) {
        throw new MalformedNumericInputError(amount, fieldName);
    }

    return roundedPaise;
}

/**
 * Converts integer paise back to rupees with 2 decimal places.
 * 
 * Safety Bounds:
 * - Asserts input paise does not exceed Number.MAX_SAFE_INTEGER.
 * 
 * @param {number} paise - Integer paise
 * @returns {number} Rounded rupees
 */
export function fromIntegerPaise(paise) {
    if (!Number.isFinite(paise) || isNaN(paise)) return 0;
    if (Math.abs(paise) > Number.MAX_SAFE_INTEGER) {
        throw new RangeError('[@mudraforge/statutory] Integer paise exceeds JavaScript MAX_SAFE_INTEGER (53-bit limit).');
    }
    const rupees = paise / 100;
    return Object.is(rupees, -0) ? 0 : Math.round(rupees * 100) / 100;
}

/**
 * Standard Paisa Precision Rounding (2 decimal places) using integer math.
 * Eliminates floating point drift (e.g. 0.00000000001).
 * Rejects negative zero (-0 normalized to 0).
 */
export function roundToPaisa(amount) {
    const n = cleanNumericAmount(amount);
    if (!Number.isFinite(n) || isNaN(n) || Object.is(n, -0)) return 0;
    return fromIntegerPaise(Math.round(n * 100));
}

/**
 * Section 288B Rounding (Rounding off of tax):
 * Under Section 288B of the Income-tax Act, 1961 (as substituted by the Taxation Laws
 * (Amendment) Act, 2006 w.e.f. 13-07-2006), the amount of tax payable/deductible,
 * interest, penalty or refund is rounded off to the nearest multiple of ten rupees:
 * 1. Part of a rupee consisting of paise: >= 50 paise is rounded up to ₹1, < 50 paise ignored.
 * 2. If the last digit of the resulting whole rupees is 5 or more, increased to next higher multiple of ₹10.
 * 3. If the last digit is less than 5, reduced to next lower multiple of ₹10.
 */
export function roundSection288B(amount) {
    const n = cleanNumericAmount(amount);
    if (!Number.isFinite(n) || isNaN(n) || Object.is(n, -0)) return 0;
    const wholeRupees = Math.round(n);
    return Math.round(wholeRupees / 10) * 10;
}
