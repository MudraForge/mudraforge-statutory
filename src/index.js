/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @mudraforge/statutory
 * Open Knowledge Format (OKF) — Public Statutory Commons Client
 * ═══════════════════════════════════════════════════════════════════════════
 * Zero dependencies. Runs in Node.js (v18+), Bun, Deno, Cloudflare Workers.
 * Supports both local offline OKF filesystem queries and live edge requests.
 * Includes first-class StatutoryClient for Free Commons & Enterprise Paid tiers.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import {
    roundToPaisa,
    roundSection288B,
    cleanNumericAmount,
    toIntegerPaise,
    fromIntegerPaise,
    MalformedNumericInputError,
    MissingMandatoryParameterError,
    assertMandatoryNumeric,
    calculateCorporateTaxMatVsConcessional,
    evaluatePlaceOfSupplyAndLut,
    calculateTransferPricingAlp,
    evaluateSection79LossContinuity,
    evaluateSection281TaxClearance,
    revalueForeignExchangeIndAs109,
    calculateBusinessCombinationsIndAs103,
    calculateImpairmentIndAs36,
    calculateRevenueAllocationIndAs115,
    calculateLeaseAmortizationIndAs116,
    calculateExpectedCreditLossIndAs109,
    calculateEsopAmortizationIndAs102,
    calculateDeferredTaxIndAs12,
    evaluateProvisionsAndContingenciesIndAs37,
    calculateForeignCurrencyIndAs21,
    evaluateSection194Q,
    evaluateSection194C,
    evaluateSection194H,
    evaluateSection194I,
    evaluateSection194J,
    evaluateSection194A,
    evaluateSection194O,
    evaluateSection194IA,
    evaluateSection194IB,
    evaluateSection194M,
    evaluateSection194R,
    evaluateSection43BStatutoryPayables,
    calculateItcReversalRule37,
    calculateRule37ASupplierNonFilingReversal,
    evaluateSection206C1H,
    evaluateSection43bH,
    calculateMsmeCompoundInterest,
    calculateAdvanceTaxAndInterest,
    calculateRule42InputServiceReversal,
    reconcileRule42AnnualTrueUp,
    calculateRule43CapitalGoodsReversal,
    calculateGstItcApportionmentRule42_43,
    evaluateCrossBorderRemittance,
    generateMsme1AndScheduleThreeAging,
    evaluateLowerDeductionCertificateValidity,
    getRbiBankRateForDate,
    DEFAULT_RBI_BANK_RATE,
    MSMED_RATE_MULTIPLIER,
    RBI_BANK_RATE_SCHEDULE,
    AUTHORITATIVE_STATUTORY_RATES,
    VALID_194J_CATEGORIES
} from './calculators.js';
import { 
    getStatutoryOutcomes, 
    explainStatutoryDisposition, 
    STATUTORY_OUTCOMES_DICTIONARY,
    enrichWithOutcomeExplanation
} from './outcomes.js';
import {
    parseTallyDaybookCsv,
    parseTallyDaybookXml,
    reconcile194QDaybook,
    generateTally194QJournalXml,
    generateAuditMarkdownReport,
    getIndianFinancialYear
} from './tally.js';
import {
    parseZohoBillsCsv,
    parseZohoBillsJson,
    parseGstr2bJson,
    reconcileZohoGstr2b,
    generateGstr2bAuditMarkdownReport,
    normalizeInvoiceNumber,
    normalizeGstin,
    calculateOverdueStartDate,
    calculateEclUtilizationInterest,
    calculatePortfolioEclUtilizationInterest,
    buildEvidenceProvenance
} from './zoho_gstr2b.js';

import { STATUTORY_CLIENT_VERSION, DEFAULT_BASE_URL } from './constants.js';

let defaultOkfDir = null;
try {
    if (typeof import.meta?.url === 'string' && import.meta.url.startsWith('file:')) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        defaultOkfDir = path.resolve(__dirname, '..', 'okf');
    }
} catch (_) {
    defaultOkfDir = null;
}
export const DEFAULT_LOCAL_OKF_DIR = defaultOkfDir;
export { STATUTORY_CLIENT_VERSION, DEFAULT_BASE_URL };

/**
 * Current verified Merkle root digest for the active OKF v0.2 corpus.
 */
export const CURRENT_RELEASE_MERKLE_ROOT = 'sha256-b17c37b2724aece2a28beaab5720a777ae27e661ac51f1436be6eff3ca5ef64b';
export const MERKLE_ROOT_OKF_V2 = CURRENT_RELEASE_MERKLE_ROOT;

/**
 * Pinned official release Merkle root digests.
 * Prevents unauthorized bundle substitution attacks even if an attacker controls the remote endpoint.
 */
export const PINNED_RELEASE_ROOTS = new Set([
    'sha256-b17c37b2724aece2a28beaab5720a777ae27e661ac51f1436be6eff3ca5ef64b', // feat/okf-accounting-domain-expansion (46 Sections across 5 Domains, 52 Circulars, 47 Forms)
    'sha256-a94baf08cbdea064a7b1bd25c1e1311821bf75e9b0d15cc8e0648339d487c79b', // feat/zoho-gstr2b-ap-reconciliation (38 Sections across 5 Domains, 44 Circulars, 39 Forms)
    'sha256-df76c16ed86673426eeb87fafa1c23712830ce5314339ff17fbb2e0e1795e046', // feat/notification-07-2025-composition-rent-rcm-exclusion (38 Sections across 5 Domains, 42 Circulars)
    'sha256-f7709f6a77a3b5ae16d69baf49f6e5c69bb01e29a4f13a506eb757220bf68e03', // feat/notification-09-2024-commercial-rent-rcm (38 Sections across 5 Domains, 41 Circulars)
    'sha256-2e402bb02fe71939c79b9f11ad737d20faac21daf8e27417cb13ec1933511c19', // feat/gst-rule-42-43 (38 Sections across 5 Domains)
    'sha256-feb1555f10c9f5c70de18ef340e0ba6cf1f060fb19cae866aa36240345c46f3a', // feat/rent-194ib-contract-194m (37 Sections across 5 Domains)
    'sha256-02090e4063a863e3486401215469350c911dc0c9a24855e1d9db2903946aa644', // feat/perquisites-194r (35 Sections across 5 Domains)
    'sha256-bd351719a8235c44f2bac87cc347423baa8ac3ecb74c0ee63d1fffa9f33dbebe', // feat/property-194ia (35 Sections across 5 Domains)
    'sha256-fc208ff012bfc3044cfc6edc5fcbf1c0e445e387a8c7d806e271968b511919ce', // feat/mna-sec281 (34 Sections across 5 Domains)
    'sha256-7f2bd99d81a261743773230d2ab3e21717ac9ca02a55c867545f5777b1a7d69f', // feat/statutory-43b-payroll (33 Sections across 5 Domains)
    'sha256-bf547512a57f26eae9a5ebcb9f0ec41c397421366b1b4223ab9e17d282721ca7', // feat/ecommerce-194o (32 Sections across 5 Domains)
    'sha256-b12fab61f0ddcc8852a7db1b4831151163d1d0ff97112168d8dccf693cfe70a7', // v2.11.0 Complete Accounts Payable (31 Sections across 5 Domains)
    'sha256-4bbe36c3db841b833dd2bebbd6c1c5ed735498e7b20d1221c323ceb211529fe0', // v2.9.0 Corporate Finance 5 Domains Merkle Root (29 Sections across 5 Domains)
    'sha256-3fb34bdcd34eec794b1f8e6abb2c0e0e87664746ec2f50ad2599c34bf57565b3', // v2.8.1 Finance Act, 2025 Section 206AB Sunset Root (24 Sections across 5 Domains)
    'sha256-239641de2bef05917673f693f9ba4d14bd5e137d64554fba5db87e426bc13e14', // v2.8.0 Deep Semantic Citation Merkle Root (24 Sections across 5 Domains)
    'sha256-6953ce79b63bb2a5809dc928178b4631f08448aa2dcde107dde10f84890bf5cb', // v2.7.0 Edge Sync Bundle Root (24 Sections across 5 Domains)
    'sha256-ce88c2255df1c30c15bfe184c8117336ebc302c2ac5ef25e96a6957402ae11ae', // v2.6.0 Verified Citation Merkle Root (24 Sections across 5 Domains - 100% Complete AP)
    'sha256-3f25fc3941d29de5b8befc0ddb24d1bb2632067f00b200680cf784961616424c', // v2.5.0 Verified Citation Merkle Root (18 Sections across 5 Domains)
    'sha256-c32be389bfb82a52ffc40670b74103216c45f3b284c66d2b0020097eb36a25f9', // v2.5.0 Merkle Manifest Root (18 Sections across 5 Domains)
    'sha256-f3b230a0774eb55d607403b5a656bbe2950a32d07145a46f0eb083232ec12986', // v2.6.0 Edge Sync Bundle Root (12 Sections across 5 Domains)
    'sha256-4e9d9c064e55748dc6389eae1b5cb2fec1ad7f1c811097afd57e4fb0a6f6454e', // v2.6.0 Local Static Manifest Root (12 Sections across 5 Domains)
    'sha256-b421910e35f4f16321f6a72382377db66a05ead521ff09d18a91ec9d534d0069', // v2.6.0 Edge Sync Bundle Root (11 Sections)
    'sha256-dbbd3bc618b7807c4e76861329bd8c6903ef7f9cb28efc9a8693abc06915c9c1', // v2.6.0 Local Static Manifest Root (11 Sections)
    'sha256-7fe98cf432db5d31ee6b65bbb9d77575ce8c9192eec6f318e3ad3382af0ba900', // v2.5.0 Edge Sync Bundle Root
    'sha256-96089fe2835d0b9493293a1e5205e0b6b46f16771c9380d1f571969b453ba80d', // v2.4.0 Local Static Manifest Root
    'sha256-d9612074241f7c2cc1d05fa5eee254996f21db56ad1ab71ac36a084ffd4169e1'  // Baseline Release Root
]);

/**
 * Canonical MudraForge Statutory Root Ed25519 Public Key (SPKI DER Base64).
 * Used for verifying digital signatures on remote statutory update bundles.
 */
export const MUDRAFORGE_STATUTORY_ROOT_PUBLIC_KEY = 'MCowBQYDK2VwAyEAYN4ZtkUBOwybN68SiVUI9YMDlEBNiCa1CAgUNx6rXUo=';
export const LEGACY_STATUTORY_ROOT_PUBLIC_KEY = 'MCowBQYDK2VwAyEAw/XsE6QGtQzdq3EUP3xFpPFHu1x87VSNreXmXr6W17s=';

/**
 * Authoritative set of trusted MudraForge Root Public Keys.
 * Public keys supplied through options that are not present in this set are rejected.
 */
export const TRUSTED_STATUTORY_PUBLIC_KEYS = new Set([
    MUDRAFORGE_STATUTORY_ROOT_PUBLIC_KEY,
    LEGACY_STATUTORY_ROOT_PUBLIC_KEY
]);

/**
 * Key metadata and validity windows for authorized root signing keys.
 */
export const TRUSTED_STATUTORY_KEYS_METADATA = {
    [MUDRAFORGE_STATUTORY_ROOT_PUBLIC_KEY]: {
        keyId: 'mudraforge-root-2026-v1',
        algorithm: 'Ed25519',
        purpose: 'MudraForge Open Knowledge Format Statutory Root Authority (Active)',
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2027-12-31T23:59:59Z',
        status: 'ACTIVE'
    },
    [LEGACY_STATUTORY_ROOT_PUBLIC_KEY]: {
        keyId: 'mudraforge-root-2026-v0',
        algorithm: 'Ed25519',
        purpose: 'MudraForge Statutory Genesis Anchor (Legacy)',
        validFrom: '2026-01-01T00:00:00Z',
        validTo: '2027-12-31T23:59:59Z',
        status: 'ACTIVE'
    }
};

/**
 * Key Revocation List (CRL) for compromised or retired signing keys.
 * Signatures signed with any key in this set are strictly rejected, even if mathematically valid.
 */
export const REVOKED_STATUTORY_KEYS = new Set([]);
export const REVOKED_KEY_IDS = new Set([]);

/**
 * Baseline mandatory statutory provisions required in any synchronized OKF bundle.
 * If any of these provisions are missing, syncOkf() fails closed.
 */
export const MANDATORY_BASELINE_SECTIONS = ['194Q', '194J', '17(5)', 'MSMED-15-16', '393'];

/**
 * Determines whether the current process is running in a production environment across runtimes.
 */
export function isProductionEnvironment() {
    return process.env?.NODE_ENV === 'production'
        || process.env?.ENVIRONMENT === 'production'
        || process.env?.CF_PAGES === '1'
        || process.env?.CF_ENVIRONMENT === 'production'
        || process.env?.PRODUCTION === 'true';
}

/**
 * Verify Ed25519 digital signature of an OKF bundle payload.
 * Enforces key provenance, key revocation (CRL), expiration windows, and canonical hash binding.
 */
export function verifyBundleSignature(bundle, publicKeyBase64 = MUDRAFORGE_STATUTORY_ROOT_PUBLIC_KEY, options = {}) {
    if (!bundle || !bundle.signature || !publicKeyBase64) return false;

    // 1. Key Revocation Check
    if (REVOKED_STATUTORY_KEYS.has(publicKeyBase64) || (options.revokedKeys && options.revokedKeys.has(publicKeyBase64))) {
        return false;
    }
    if (bundle.keyId && (REVOKED_KEY_IDS.has(bundle.keyId) || (options.revokedKeyIds && options.revokedKeyIds.has(bundle.keyId)))) {
        return false;
    }

    // 2. Bundle Expiration & Staleness Check
    if (bundle.expiresAt) {
        const expTime = new Date(bundle.expiresAt).getTime();
        if (!isNaN(expTime) && Date.now() > expTime) {
            return false;
        }
    }

    try {
        const canonicalString = `${bundle.okfVersion || ''}|${bundle.rootHash || ''}|${bundle.publishedAt || ''}`;
        const dataBytes = Buffer.from(canonicalString, 'utf8');
        const pubKeyDer = Buffer.from(publicKeyBase64, 'base64');
        const pubKey = crypto.createPublicKey({
            key: pubKeyDer,
            format: 'der',
            type: 'spki'
        });
        const sigBytes = Buffer.from(bundle.signature, 'base64');
        return crypto.verify(null, dataBytes, pubKey, sigBytes);
    } catch (_) {
        return false;
    }
}

/**
 * Fail-Closed Statutory Exception.
 * Raised when a statutory provision or rate cannot be authoritatively resolved,
 * enforcing the critical invariant that financial agents must never default to 0% withholding.
 */
export class StatutoryIndeterminateError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'StatutoryIndeterminateError';
        this.code = details.code || 'STATUTORY_INDETERMINATE';
        this.failClosed = true;
        this.section = details.section || null;
        this.statutoryAdvice = details.statutoryAdvice || 'Fail-closed invariant triggered: Tax withholding must not default to 0% without authoritative statutory determination.';
        this.details = details;
    }
}

/**
 * Compare two semantic version strings (e.g. "2.4.0" vs "2.3.1").
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1, v2) {
    const parse = (v) => (v || '0.0.0').replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
    const p1 = parse(v1);
    const p2 = parse(v2);
    for (let i = 0; i < 3; i++) {
        if (p1[i] > p2[i]) return 1;
        if (p1[i] < p2[i]) return -1;
    }
    return 0;
}

/**
 * Builds standard User-Agent header while respecting privacy flags (DO_NOT_TRACK / MUDRA_NO_TELEMETRY).
 */
export function buildUserAgent() {
    if (process.env?.DO_NOT_TRACK === '1' || process.env?.MUDRA_NO_TELEMETRY === '1') {
        return `@mudraforge/statutory/${STATUTORY_CLIENT_VERSION} (anonymous)`;
    }
    const runtime = process.release?.name || 'node';
    const version = process.version || 'unknown';
    const platform = process.platform || 'unknown';
    return `@mudraforge/statutory/${STATUTORY_CLIENT_VERSION} (${runtime}/${version}; ${platform})`;
}

/**
 * Enforce HTTPS transport to prevent man-in-the-middle attacks, allowing HTTP only for local loopback.
 */
export function assertSecureEndpoint(urlStr) {
    const parsed = new URL(urlStr);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
    if (parsed.protocol !== 'https:' && !isLocal) {
        throw new Error(`[@mudraforge/statutory] Insecure transport rejected for host "${parsed.hostname}". HTTPS is required to ensure cryptographic integrity of statutory data.`);
    }
}

/**
 * Sanitize statutory section filename and prevent directory traversal,
 * prototype pollution, and Windows reserved device name collisions.
 */
export function resolveSafeStatuteFilename(statute) {
    if (!statute || typeof statute.sectionCode !== 'string' || !statute.sectionCode.trim()) {
        throw new Error('[@mudraforge/statutory] Invalid statute entry: missing required sectionCode.');
    }

    const rawCode = statute.sectionCode.trim();
    const lowerCode = rawCode.toLowerCase();

    // Prototype pollution prevention
    if (lowerCode === '__proto__' || lowerCode === 'constructor' || lowerCode === 'prototype') {
        throw new Error(`[@mudraforge/statutory] Security violation: Forbidden sectionCode name "${rawCode}".`);
    }

    let safeCode = rawCode.replace(/[()]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '-');

    // Windows Reserved Device Names Protection (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (WINDOWS_RESERVED.test(safeCode)) {
        safeCode = `sec_${safeCode}`;
    }

    const shortTitle = (statute.title || '')
        .slice(0, 200)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 45)
        .replace(/-+$/, '');

    const baseName = shortTitle ? `${safeCode}-${shortTitle}.json` : `${safeCode}.json`;
    let sanitized = path.basename(baseName).replace(/[^a-zA-Z0-9_\-\.]/g, '');

    if (!sanitized || sanitized === '.' || sanitized === '..') {
        throw new Error(`[@mudraforge/statutory] Security violation: Malformed filename generated for section "${statute.sectionCode}".`);
    }

    const stem = path.parse(sanitized).name;
    if (WINDOWS_RESERVED.test(stem)) {
        sanitized = `sec_${sanitized}`;
    }

    return sanitized;
}

/**
 * Read the local version manifest from the filesystem.
 */
export function getLocalManifest(okfDir = DEFAULT_LOCAL_OKF_DIR) {
    try {
        const manifestPath = path.join(okfDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) return null;
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
        return null;
    }
}

/**
 * MudraForge Custom CLI Exit Code Conventions
 */
export const STATUTORY_EXIT_CODES = {
    SUCCESS: 0,
    USAGE_ERROR: 1,
    INTEGRITY_OR_SECURITY_FAILURE: 2,
    STATUTORY_POLICY_FAILURE: 3
};

/**
 * Recursively scans a local OKF directory, verifies file-level SHA-256 hashes against
 * manifest.json (Integrity), validates the Merkle root hash against authorized release roots
 * or cryptographic Ed25519 signatures (Authenticity), and verifies mandatory statutory baselines.
 *
 * @param {string} [okfDir=DEFAULT_LOCAL_OKF_DIR] - Path to local OKF root directory.
 * @param {Object} [options={}]
 * @param {string} [options.publicKey] - Base64 SPKI public key for signature verification.
 * @param {string} [options.expectedRootHash] - Explicit root hash expected by caller.
 * @param {Array<string>} [options.requiredSections] - Baseline provisions required (defaults to MANDATORY_BASELINE_SECTIONS).
 * @param {boolean} [options.allowUnverifiedRoot] - Permitted only in non-production.
 * @returns {{
 *   valid: boolean,
 *   exitCode: number,
 *   okfVersion: string,
 *   publishedAt: string,
 *   integrity: {
 *     valid: boolean,
 *     totalFilesChecked: number,
 *     mismatches: Array<{ file: string, expected: string, actual: string }>,
 *     missingFiles: string[],
 *     untrackedFiles: string[],
 *     computedRoot: string,
 *     recordedRoot: string
 *   },
 *   authenticity: {
 *     valid: boolean,
 *     method: string,
 *     rootHash: string,
 *     isPinned: boolean,
 *     isSigned: boolean,
 *     keyId: string | null
 *   },
 *   baselineCheck: {
 *     valid: boolean,
 *     missingBaseline: string[],
 *     baselineSections: string[]
 *   }
 * }}
 */
export function verifyLocalSubstrate(okfDir = DEFAULT_LOCAL_OKF_DIR, options = {}) {
    const resolvedDir = path.resolve(okfDir);
    if (!fs.existsSync(resolvedDir)) {
        return {
            valid: false,
            exitCode: STATUTORY_EXIT_CODES.INTEGRITY_OR_SECURITY_FAILURE,
            error: `[@mudraforge/statutory] Local OKF directory not found at: ${resolvedDir}`,
            integrity: { valid: false, totalFilesChecked: 0, mismatches: [], missingFiles: [], untrackedFiles: [], computedRoot: null, recordedRoot: null },
            authenticity: { valid: false, method: 'NONE', rootHash: null, isPinned: false, isSigned: false, keyId: null },
            baselineCheck: { valid: false, missingBaseline: MANDATORY_BASELINE_SECTIONS, baselineSections: MANDATORY_BASELINE_SECTIONS }
        };
    }

    const manifestPath = path.join(resolvedDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        return {
            valid: false,
            exitCode: STATUTORY_EXIT_CODES.INTEGRITY_OR_SECURITY_FAILURE,
            error: `[@mudraforge/statutory] manifest.json missing in OKF directory: ${resolvedDir}`,
            integrity: { valid: false, totalFilesChecked: 0, mismatches: [], missingFiles: [], untrackedFiles: [], computedRoot: null, recordedRoot: null },
            authenticity: { valid: false, method: 'NONE', rootHash: null, isPinned: false, isSigned: false, keyId: null },
            baselineCheck: { valid: false, missingBaseline: MANDATORY_BASELINE_SECTIONS, baselineSections: MANDATORY_BASELINE_SECTIONS }
        };
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
        return {
            valid: false,
            exitCode: STATUTORY_EXIT_CODES.INTEGRITY_OR_SECURITY_FAILURE,
            error: `[@mudraforge/statutory] Corrupted manifest.json: ${err.message}`,
            integrity: { valid: false, totalFilesChecked: 0, mismatches: [], missingFiles: [], untrackedFiles: [], computedRoot: null, recordedRoot: null },
            authenticity: { valid: false, method: 'NONE', rootHash: null, isPinned: false, isSigned: false, keyId: null },
            baselineCheck: { valid: false, missingBaseline: MANDATORY_BASELINE_SECTIONS, baselineSections: MANDATORY_BASELINE_SECTIONS }
        };
    }

    // 1. Gather all files on disk recursively
    const fileList = [];
    function scanDir(dir) {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.') && !entry.name.startsWith('.staging-sync-')) {
                    scanDir(full);
                }
            } else if (entry.isFile() && entry.name !== 'manifest.json' && !entry.name.startsWith('.')) {
                fileList.push(full);
            }
        }
    }
    scanDir(resolvedDir);

    const onDiskFileHashes = {};
    const recordedFileHashes = manifest.files || manifest.fileHashes || {};
    const mismatches = [];
    const seenSections = new Set();

    for (const fullPath of fileList) {
        const relPath = path.relative(resolvedDir, fullPath).replace(/\\/g, '/');
        let content = fs.readFileSync(fullPath);
        if (fullPath.endsWith('.json') || fullPath.endsWith('.md')) {
            content = Buffer.from(content.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
        }
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        onDiskFileHashes[relPath] = hash;

        if (path.basename(fullPath) === 'section.json') {
            try {
                const sData = JSON.parse(content.toString('utf8'));
                if (sData.sectionCode) {
                    seenSections.add(sData.sectionCode.toLowerCase().trim());
                }
            } catch (_) {}
        }

        const expectedHash = recordedFileHashes[relPath];
        if (expectedHash && expectedHash !== hash) {
            mismatches.push({ file: relPath, expected: expectedHash, actual: hash });
        }
    }

    const missingFiles = [];
    for (const recordedRelPath of Object.keys(recordedFileHashes)) {
        if (!onDiskFileHashes[recordedRelPath]) {
            missingFiles.push(recordedRelPath);
        }
    }

    const untrackedFiles = [];
    for (const onDiskRelPath of Object.keys(onDiskFileHashes)) {
        if (!recordedFileHashes[onDiskRelPath]) {
            untrackedFiles.push(onDiskRelPath);
        }
    }

    // Compute deterministic root hash from on-disk file hashes
    const rootHasher = crypto.createHash('sha256');
    for (const [relPath, hash] of Object.entries(onDiskFileHashes).sort(([a], [b]) => a.localeCompare(b))) {
        rootHasher.update(`${relPath}:${hash}\n`);
    }
    const computedRoot = `sha256-${rootHasher.digest('hex')}`;

    const integrityValid = mismatches.length === 0 &&
        missingFiles.length === 0 &&
        untrackedFiles.length === 0 &&
        computedRoot === manifest.rootHash;

    const integrity = {
        valid: integrityValid,
        totalFilesChecked: fileList.length,
        mismatches,
        missingFiles,
        untrackedFiles,
        computedRoot,
        recordedRoot: manifest.rootHash
    };

    // 2. Authenticity Verification
    const isPinned = PINNED_RELEASE_ROOTS.has(manifest.rootHash);
    let isSigned = false;
    let signingKeyId = manifest.keyId || null;

    if (manifest.signature) {
        const pubKey = options.publicKey || MUDRAFORGE_STATUTORY_ROOT_PUBLIC_KEY;
        isSigned = verifyBundleSignature(manifest, pubKey, options);
    }

    const matchesExpected = options.expectedRootHash ? (options.expectedRootHash === manifest.rootHash) : false;
    const isAllowedUnverified = !isProductionEnvironment() && Boolean(options.allowUnverifiedRoot);

    let authenticityValid = false;
    let authMethod = 'UNAUTHENTICATED';

    if (isSigned) {
        authenticityValid = true;
        authMethod = 'ED25519_DIGITAL_SIGNATURE';
    } else if (isPinned) {
        authenticityValid = true;
        authMethod = 'PINNED_RELEASE_ROOT';
    } else if (matchesExpected) {
        authenticityValid = true;
        authMethod = 'EXPLICIT_EXPECTED_ROOT_PIN';
    } else if (isAllowedUnverified) {
        authenticityValid = true;
        authMethod = 'DEVELOPMENT_UNVERIFIED_BYPASS';
    }

    const authenticity = {
        valid: authenticityValid,
        method: authMethod,
        rootHash: manifest.rootHash,
        isPinned,
        isSigned,
        keyId: signingKeyId
    };

    // 3. Baseline Statutory Provisions Check
    const effectiveBaseline = Array.isArray(options.requiredSections)
        ? options.requiredSections
        : MANDATORY_BASELINE_SECTIONS;

    const manifestSectionSet = new Set((manifest.sections || []).map(s => s.toLowerCase().trim()));
    const missingBaseline = [];
    for (const reqCode of effectiveBaseline) {
        const codeNormalized = reqCode.toLowerCase().trim();
        if (!manifestSectionSet.has(codeNormalized) && !seenSections.has(codeNormalized)) {
            missingBaseline.push(reqCode);
        }
    }

    const baselineCheck = {
        valid: missingBaseline.length === 0,
        missingBaseline,
        baselineSections: effectiveBaseline
    };

    // Determine Exit Code based on MudraForge Custom Exit Code Contract:
    // 0 = Success
    // 2 = Cryptographic or file integrity failure
    // 3 = Statutory policy failure
    let exitCode = STATUTORY_EXIT_CODES.SUCCESS;
    if (!integrity.valid || !authenticity.valid) {
        exitCode = STATUTORY_EXIT_CODES.INTEGRITY_OR_SECURITY_FAILURE;
    } else if (!baselineCheck.valid) {
        exitCode = STATUTORY_EXIT_CODES.STATUTORY_POLICY_FAILURE;
    }

    return {
        valid: exitCode === STATUTORY_EXIT_CODES.SUCCESS,
        exitCode,
        okfVersion: manifest.okfVersion,
        publishedAt: manifest.publishedAt,
        integrity,
        authenticity,
        baselineCheck
    };
}

/**
 * MudraForge Statutory Environment & Substrate Doctor.
 * Diagnoses host runtime environment, local OKF file health, air-gap state,
 * and optional Cloudflare edge connectivity without failing offline verification.
 *
 * @param {Object} [options={}]
 * @param {string} [options.okfDir] - Path to local OKF directory.
 * @param {string} [options.baseUrl] - Base URL for edge endpoint.
 * @param {boolean} [options.offline] - Force offline/air-gapped check (bypasses network).
 * @param {number} [options.timeoutMs=2500] - Latency timeout for edge ping.
 * @returns {Promise<{
 *   healthy: boolean,
 *   exitCode: number,
 *   clientVersion: string,
 *   runtime: Object,
 *   substrate: Object,
 *   edge: Object
 * }>}
 */
export async function runStatutoryDoctor(options = {}) {
    const okfDir = options.okfDir || DEFAULT_LOCAL_OKF_DIR;
    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    const skipNetwork = Boolean(options.offline || options.skipNetwork || process.env.MUDRA_OFFLINE === '1');

    // 1. Host Runtime Diagnostics
    const nodeVersion = process.version;
    const majorMatch = nodeVersion.match(/^v(\d+)/);
    const majorVersion = majorMatch ? parseInt(majorMatch[1], 10) : 0;
    const runtime = {
        nodeVersion,
        isSupportedNode: majorVersion >= 18,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        environment: process.env.NODE_ENV || 'development',
        isCI: Boolean(process.env.CI === 'true'),
        hasApiKey: Boolean(process.env.MUDRA_STATUTORY_API_KEY || process.env.MUDRA_API_KEY)
    };

    // 2. Local Substrate Diagnostics
    const substrate = verifyLocalSubstrate(okfDir, options);

    // 3. Optional Edge Connectivity Diagnostics
    let edge = {
        status: 'SKIPPED_AIR_GAPPED',
        baseUrl,
        latencyMs: null,
        isReachable: null,
        advisory: 'Edge check bypassed via offline/air-gapped mode.'
    };

    if (!skipNetwork) {
        const start = Date.now();
        try {
            assertSecureEndpoint(baseUrl);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 2500);
            const pingUrl = new URL('/api/v1/statutory/manifest.json', baseUrl);
            const res = await fetch(pingUrl, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': buildUserAgent() }
            });
            clearTimeout(timeoutId);
            const latencyMs = Date.now() - start;
            edge = {
                status: res.ok ? 'REACHABLE' : `HTTP_${res.status}`,
                baseUrl,
                latencyMs,
                isReachable: res.ok,
                advisory: res.ok ? 'Edge service operational.' : `Edge returned status HTTP ${res.status}.`
            };
        } catch (err) {
            edge = {
                status: 'UNREACHABLE',
                baseUrl,
                latencyMs: null,
                isReachable: false,
                advisory: `Edge endpoint unreachable (${err.message}). Local offline substrate remains 100% operational.`
            };
        }
    }

    // Determine overall health & exit code
    let exitCode = STATUTORY_EXIT_CODES.SUCCESS;
    let isHealthy = true;

    if (!runtime.isSupportedNode) {
        isHealthy = false;
        exitCode = STATUTORY_EXIT_CODES.USAGE_ERROR;
    } else if (!substrate.valid) {
        isHealthy = false;
        exitCode = substrate.exitCode;
    }

    return {
        healthy: isHealthy,
        exitCode,
        clientVersion: STATUTORY_CLIENT_VERSION,
        runtime,
        substrate,
        edge
    };
}

/**
 * Safely parse JSON responses from remote endpoints, asserting Content-Type
 * to prevent uncaught SyntaxErrors when upstream proxies return HTML or text.
 */
async function safeJsonParse(res, contextMsg) {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
        const textSnippet = (await res.text().catch(() => '')).slice(0, 120).replace(/\s+/g, ' ');
        throw new Error(
            `[@mudraforge/statutory] ${contextMsg} failed: Expected "application/json" response from remote edge, but received "${contentType || 'unknown'}". Response snippet: "${textSnippet}"`
        );
    }
    return await res.json();
}

/**
 * Helper to recursively find all JSON files in a directory.
 * Hardened against:
 * 1. Symlink traversal & circular recursion loops (tracked realpaths)
 * 2. Abandoned staging directories (.staging-sync-*) and hidden dotfolders (.git)
 */
function findJsonFilesRecursively(dir, visited = new Set()) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    try {
        const realDir = fs.realpathSync(dir);
        if (visited.has(realDir)) return results;
        visited.add(realDir);

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            // Skip hidden dotfiles and staging folders (.staging-sync-*, .git, etc.)
            if (entry.name.startsWith('.')) continue;

            // Skip symbolic links to prevent directory escape and infinite traversal loops
            if (typeof entry.isSymbolicLink === 'function' && entry.isSymbolicLink()) continue;

            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results = results.concat(findJsonFilesRecursively(fullPath, visited));
            } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'manifest.json') {
                results.push(fullPath);
            }
        }
    } catch (_) {}
    return results;
}

/**
 * Look up a statutory provision directly from the local OKF filesystem (0 network calls).
 * Supports domain hierarchies (direct_tax, indirect_tax_gst, msme, international_tax)
 * as well as flat sections directories.
 * Returns the statutory record along with associated circulars and compliance forms.
 */
export function lookupLocalStatute(section, okfDir = DEFAULT_LOCAL_OKF_DIR) {
    if (!section || typeof section !== 'string') {
        throw new Error('[@mudraforge/statutory] Section query must be a non-empty string.');
    }

    const rawClean = section.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
    const normalized = rawClean.replace(/[()_-\s]+/g, '');

    if (!fs.existsSync(okfDir)) {
        throw new Error(`[@mudraforge/statutory] Local OKF directory not found at: ${okfDir}`);
    }

    const files = findJsonFilesRecursively(okfDir);
    const records = [];
    for (const filePath of files) {
        let data;
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (_) {
            continue;
        }
        if (!data || !data.sectionCode || typeof data.sectionCode !== 'string') continue;
        records.push({ filePath, data });
    }

    let matchedRecord = null;

    // Pass 1: Authoritative exact match on sectionCode, sectionId, or aliases
    for (const rec of records) {
        const { data } = rec;
        const secCode = data.sectionCode.toLowerCase();
        const secId = (data.sectionId && typeof data.sectionId === 'string') ? data.sectionId.toLowerCase() : '';

        // 1. Direct sectionCode / sectionId match
        if (secCode === rawClean || (secId && secId === rawClean)) {
            matchedRecord = rec;
            break;
        }

        // 2. Normalized alphanumeric match (handles "17_5", "17(5)", "17-5", "msmed_15_16")
        if (
            secCode.replace(/[()_-\s]+/g, '') === normalized ||
            (secId && secId.replace(/[()_-\s]+/g, '') === normalized)
        ) {
            matchedRecord = rec;
            break;
        }

        // 3. Aliases match
        if (
            data.aliases &&
            data.aliases.some(
                a => a.toLowerCase() === rawClean || a.toLowerCase().replace(/[()_-\s]+/g, '') === normalized
            )
        ) {
            matchedRecord = rec;
            break;
        }
    }

    // Pass 2: Heuristic folder or filename match (only if no authoritative code match found)
    if (!matchedRecord) {
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const tokenRegex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
        for (const rec of records) {
            const { filePath } = rec;
            const fileName = path.basename(filePath).toLowerCase().replace(/\.json$/, '');
            const folderName = path.basename(path.dirname(filePath)).toLowerCase();

            if (
                fileName.startsWith(`${rawClean}-`) || fileName.startsWith(`${normalized}-`) ||
                tokenRegex.test(folderName) || tokenRegex.test(fileName)
            ) {
                matchedRecord = rec;
                break;
            }
        }
    }

    // Pass 3: Token / keyword search across aliases, title, and plainTextSummary
    if (!matchedRecord) {
        const stopWords = new Set(['and', 'for', 'the', 'with', 'from', 'under', 'etc', 'to', 'in', 'of', 'a', 'an', 'is', 'by', 'section', 'sec', 'act', 'rule', 'non', 'not', 'no', 'any', 'all', 'existent']);
        const tokens = rawClean.split(/[\s,+/_-]+/).filter(t => t.length >= 2 && !stopWords.has(t));
        let bestRec = null;
        let bestScore = 0;

        for (const rec of records) {
            let score = 0;
            const { data } = rec;
            const title = (data.title || '').toLowerCase();
            const summary = (data.plainTextSummary || '').toLowerCase();
            const statute = (data.statutorySection || '').toLowerCase();

            for (const alias of data.aliases || []) {
                const cleanAlias = alias.toLowerCase();
                if (rawClean.includes(cleanAlias) || cleanAlias.includes(rawClean)) {
                    score += 50;
                }
            }

            for (const token of tokens) {
                for (const alias of data.aliases || []) {
                    if (alias.toLowerCase().includes(token)) score += 15;
                }
                if (title.includes(token)) score += 10;
                if (statute.includes(token)) score += 8;
                if (summary.includes(token)) score += 3;
            }

            if (score > bestScore) {
                bestScore = score;
                bestRec = rec;
            }
        }

        if (bestScore >= 35) {
            matchedRecord = bestRec;
        }
    }

    if (matchedRecord) {
        const { filePath, data } = matchedRecord;
        // Attach supporting circulars and compliance forms if present in domain hierarchy
        const parentDir = path.dirname(filePath);
            const circularsDir = path.join(parentDir, 'circulars');
            const formsDir = path.join(parentDir, 'forms');

            data.supportingDocuments = {
                circulars: fs.existsSync(circularsDir) ? fs.readdirSync(circularsDir).filter(f => f.endsWith('.md')) : [],
                forms: fs.existsSync(formsDir) ? fs.readdirSync(formsDir).filter(f => f.endsWith('.json') || f.endsWith('.md')) : []
            };

            return data;
    }
    return null;
}

/**
 * Check if a newer version of the OKF knowledge base is available on Cloudflare edge.
 * Supports HTTP 304 Not Modified validation via Merkle root ETag.
 */
export async function checkUpdates(options = {}) {
    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    assertSecureEndpoint(baseUrl);

    const okfDir = options.okfDir || DEFAULT_LOCAL_OKF_DIR;
    const localManifest = getLocalManifest(okfDir) || { okfVersion: '0.0.0', rootHash: null };

    const url = new URL('/api/v1/statutory/manifest.json', baseUrl);
    const headers = {
        'Accept': 'application/json',
        'User-Agent': buildUserAgent()
    };
    if (localManifest.rootHash) {
        headers['If-None-Match'] = `"${localManifest.rootHash}"`;
    }

    const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(options.timeoutMs || 15000)
    });

    if (res.status === 304) {
        return {
            localVersion: localManifest.okfVersion,
            latestVersion: localManifest.okfVersion,
            isOutdated: false,
            notModified: true,
            publishedAt: localManifest.publishedAt,
            changelog: localManifest.changelog || 'Up to date with edge Merkle digest',
            totalSections: localManifest.totalSections || localManifest.sections?.length || 0
        };
    }

    if (!res.ok) {
        throw new Error(`Failed to check remote version: HTTP ${res.status}`);
    }

    const remote = await safeJsonParse(res, 'checkUpdates');
    const isOutdated = remote.okfVersion !== localManifest.okfVersion || (remote.rootHash && remote.rootHash !== localManifest.rootHash);

    return {
        localVersion: localManifest.okfVersion,
        latestVersion: remote.okfVersion,
        isOutdated,
        notModified: false,
        publishedAt: remote.publishedAt,
        changelog: remote.changelog,
        totalSections: remote.totalSections,
        rootHash: remote.rootHash
    };
}

/**
 * Check if a newer version of the @mudraforge/statutory npm package is published on npmjs.com.
 * Uses a lightweight cached file in os.tmpdir() to prevent frequent network roundtrips.
 *
 * @param {Object} [options]
 * @param {string} [options.currentVersion] - Current installed version (defaults to STATUTORY_CLIENT_VERSION).
 * @param {number} [options.cacheTtlMs] - Cache duration in milliseconds (default: 24 hours).
 * @param {number} [options.timeoutMs] - Request timeout in milliseconds (default: 1500ms).
 * @param {string} [options.registryUrl] - Registry endpoint (default: https://registry.npmjs.org/@mudraforge/statutory/latest).
 * @returns {Promise<{ updateAvailable: boolean, currentVersion: string, latestVersion: string } | null>}
 */
export async function checkForPackageUpdate(options = {}) {
    if (!options.force && (
        process.env.NO_UPDATE_NOTIFIER === '1' || 
        process.env.MUDRA_NO_UPDATE_NOTIFIER === '1' || 
        (process.env.CI === 'true' && !options.registryUrl)
    )) {
        return null;
    }

    const currentVersion = options.currentVersion || STATUTORY_CLIENT_VERSION;
    const cacheTtlMs = options.cacheTtlMs !== undefined ? options.cacheTtlMs : 24 * 60 * 60 * 1000;
    const timeoutMs = options.timeoutMs || 1500;
    const cacheFile = path.join(os.tmpdir(), '.mudraforge_statutory_npm_update.json');

    let cached = null;
    if (cacheTtlMs > 0) {
        try {
            if (fs.existsSync(cacheFile)) {
                const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
                if (data && typeof data.lastChecked === 'number' && (Date.now() - data.lastChecked < cacheTtlMs)) {
                    cached = data;
                }
            }
        } catch (_) {}
    }

    let latestVersion = cached?.latestVersion;

    if (!latestVersion) {
        try {
            const url = options.registryUrl || 'https://registry.npmjs.org/@mudraforge/statutory/latest';
            const res = await fetch(url, {
                signal: AbortSignal.timeout(timeoutMs),
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                const json = await res.json();
                if (json && json.version && typeof json.version === 'string') {
                    latestVersion = json.version;
                    if (cacheTtlMs > 0) {
                        try {
                            const prev = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
                            fs.writeFileSync(cacheFile, JSON.stringify({
                                ...prev,
                                lastChecked: Date.now(),
                                latestVersion
                            }), 'utf8');
                        } catch (_) {}
                    }
                }
            }
        } catch (_) {
            // Fail open and silent on network error, offline, or timeout
            return null;
        }
    }

    if (!latestVersion) return null;

    const cmp = compareSemver(latestVersion, currentVersion);
    const isIgnored = Boolean(cached?.ignoredVersion && cached.ignoredVersion === latestVersion);

    return {
        updateAvailable: cmp > 0 && (!isIgnored || Boolean(options.force)),
        isIgnored,
        currentVersion,
        latestVersion
    };
}

/**
 * Configure the CLI to ignore update notifications for a specific version.
 * @param {string} versionToIgnore Package version to suppress notifications for
 * @returns {{ status: 'SUCCESS' | 'ERROR', ignoredVersion: string, error?: string }}
 */
export function ignorePackageUpdate(versionToIgnore) {
    if (!versionToIgnore || typeof versionToIgnore !== 'string') {
        throw new Error('[@mudraforge/statutory] A valid version string is required to ignore update notifications.');
    }
    const cacheFile = path.join(os.tmpdir(), '.mudraforge_statutory_npm_update.json');
    let current = {};
    try {
        if (fs.existsSync(cacheFile)) {
            current = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) || {};
        }
    } catch (_) {}

    current.ignoredVersion = versionToIgnore.trim();
    current.ignoredAt = Date.now();

    try {
        fs.writeFileSync(cacheFile, JSON.stringify(current, null, 2), 'utf8');
        return { status: 'SUCCESS', ignoredVersion: versionToIgnore.trim() };
    } catch (err) {
        return { status: 'ERROR', ignoredVersion: versionToIgnore.trim(), error: err.message };
    }
}

/**
 * Download and synchronize the latest OKF knowledge bundle to disk.
 * Hardened with:
 * 1. Transport Security (Enforced HTTPS)
 * 2. Pre-write integrity and schema validation
 * 3. Path Traversal & Containment Assertions
 * 4. Atomic Staging Directory Writes (Fail-closed)
 * 5. HTTP ETag 304 Cache Optimization
 */
export async function syncOkf(options = {}) {
    // Production Security Guard: Development bypasses cannot accidentally be enabled in production
    const isProduction = isProductionEnvironment();
    if (isProduction && options.allowUnverifiedRoot) {
        throw new Error('[@mudraforge/statutory] Security violation: options.allowUnverifiedRoot is strictly forbidden in production environments.');
    }
    if (isProduction && options.allowDowngrade) {
        throw new Error('[@mudraforge/statutory] Security violation: options.allowDowngrade is strictly forbidden in production environments.');
    }
    const effectiveKey = options.publicKey || MUDRAFORGE_STATUTORY_ROOT_PUBLIC_KEY;
    if (REVOKED_STATUTORY_KEYS.has(effectiveKey) || (options.revokedKeys && options.revokedKeys.has(effectiveKey))) {
        throw new Error('[@mudraforge/statutory] Security violation: Statutory root signing key has been revoked by the MudraForge Root Authority.');
    }

    if (options.publicKey && !TRUSTED_STATUTORY_PUBLIC_KEYS.has(options.publicKey)) {
        if (isProduction) {
            throw new Error('[@mudraforge/statutory] Security violation: Untrusted public key provided. Only keys registered with the MudraForge Root Authority are accepted in production environments.');
        }
        if (!options.allowUntrustedPublicKey) {
            throw new Error('[@mudraforge/statutory] Security violation: Untrusted public key provided. Set options.allowUntrustedPublicKey=true for non-production testing fixtures.');
        }
    }

    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    assertSecureEndpoint(baseUrl);

    const okfDir = options.okfDir || DEFAULT_LOCAL_OKF_DIR;
    const localManifest = getLocalManifest(okfDir);

    const bundleUrl = new URL('/api/v1/statutory/bundle.json', baseUrl);
    const headers = {
        'Accept': 'application/json',
        'User-Agent': buildUserAgent()
    };

    // If local manifest has rootHash and force is not requested, check ETag
    if (!options.force && localManifest && localManifest.rootHash) {
        headers['If-None-Match'] = `"${localManifest.rootHash}"`;
    }

    const res = await fetch(bundleUrl.toString(), {
        headers,
        signal: AbortSignal.timeout(options.timeoutMs || 25000)
    });

    if (res.status === 304) {
        return {
            success: true,
            notModified: true,
            okfVersion: localManifest.okfVersion,
            syncedSections: localManifest.sections?.length || 0,
            destDir: okfDir,
            message: 'Local OKF snapshot already matches edge Merkle root (HTTP 304).'
        };
    }

    if (!res.ok) {
        throw new Error(`Failed to download OKF bundle: HTTP ${res.status}`);
    }

    // Guard against memory bombs (> 10MB)
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > 10485760) {
        throw new Error(`[@mudraforge/statutory] Bundle size exceeds 10MB security threshold (${contentLength} bytes).`);
    }

    const bundle = await safeJsonParse(res, 'syncOkf');

    // 1. Structural & Cryptographic Pre-validation
    if (!bundle || typeof bundle !== 'object') {
        throw new Error('[@mudraforge/statutory] Invalid bundle payload: expected JSON object.');
    }
    if (!Array.isArray(bundle.statutes) || bundle.statutes.length === 0) {
        throw new Error('[@mudraforge/statutory] Invalid bundle payload: missing statutes array.');
    }
    if (bundle.statutes.length > 500) {
        throw new Error(`[@mudraforge/statutory] Security violation: Bundle exceeds maximum allowable section ceiling of 500 (received ${bundle.statutes.length}).`);
    }
    if (!bundle.okfVersion || typeof bundle.okfVersion !== 'string') {
        throw new Error('[@mudraforge/statutory] Invalid bundle payload: missing okfVersion.');
    }
    if (!bundle.rootHash || !bundle.rootHash.startsWith('sha256-')) {
        throw new Error('[@mudraforge/statutory] Invalid bundle payload: missing or malformed SHA-256 rootHash.');
    }

    // 1.5 Monotonic Rollback & Downgrade Attack Prevention
    if (!options.allowDowngrade) {
        // Authoritative baseline: use local manifest version if present;
        // if manifest is wiped or missing, anchor to the hardcoded package version.
        const baselineVersion = (localManifest && localManifest.okfVersion) 
            ? localManifest.okfVersion 
            : STATUTORY_CLIENT_VERSION;

        const cmp = compareSemver(bundle.okfVersion, baselineVersion);
        if (cmp < 0) {
            throw new Error(`[@mudraforge/statutory] Security violation: Rollback attack detected. Remote bundle version (v${bundle.okfVersion}) is older than installed baseline (v${baselineVersion}). Set options.allowDowngrade=true to force downgrade.`);
        }
        if (cmp === 0 && localManifest && bundle.publishedAt && localManifest.publishedAt) {
            const remoteTime = new Date(bundle.publishedAt).getTime();
            const localTime = new Date(localManifest.publishedAt).getTime();
            if (!isNaN(remoteTime) && !isNaN(localTime) && remoteTime < localTime) {
                throw new Error(`[@mudraforge/statutory] Security violation: Rollback attack detected. Remote bundle published timestamp (${bundle.publishedAt}) is older than installed snapshot (${localManifest.publishedAt}). Set options.allowDowngrade=true to force downgrade.`);
            }
        }
    }

    // 2. Atomic Staging Pipeline
    const stagingDir = path.join(okfDir, `.staging-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    fs.mkdirSync(stagingDir, { recursive: true });

    try {
        const fileHashes = {};
        const syncedSectionCodes = [];
        const seenCodes = new Set();
        const stagedRelPaths = [];

        for (const statute of bundle.statutes) {
            // Verify core required statutory fields
            if (!statute.sectionCode || !statute.title || !statute.effectivePeriod) {
                throw new Error(`[@mudraforge/statutory] Malformed statute record: missing required metadata for ${JSON.stringify(statute.sectionCode || 'unknown')}.`);
            }

            const codeKey = statute.sectionCode.toLowerCase().trim();
            if (seenCodes.has(codeKey)) {
                throw new Error(`[@mudraforge/statutory] Integrity violation: Duplicate sectionCode "${statute.sectionCode}" detected in bundle.`);
            }
            seenCodes.add(codeKey);

            // Determine relative deployment target:
            // If statute provides relPath, preserve domain hierarchy (e.g. "direct_tax/tds_goods_194q/section.json")
            // Otherwise, fall back to flat "sections/<filename>.json" for legacy compatibility
            const relTarget = statute.relPath 
                ? statute.relPath.replace(/\\/g, '/')
                : path.join('sections', resolveSafeStatuteFilename(statute));

            const targetPath = path.resolve(stagingDir, relTarget);

            // Path Traversal Containment Assertion
            if (!targetPath.startsWith(path.resolve(stagingDir) + path.sep)) {
                throw new Error(`[@mudraforge/statutory] Security violation: Path traversal detected in target "${relTarget}".`);
            }

            fs.mkdirSync(path.dirname(targetPath), { recursive: true });

            const jsonStr = JSON.stringify(statute, null, 2);
            fs.writeFileSync(targetPath, jsonStr, 'utf8');

            const fileName = resolveSafeStatuteFilename(statute);
            const fileHash = crypto.createHash('sha256').update(jsonStr).digest('hex');
            fileHashes[fileName] = fileHash;
            syncedSectionCodes.push(statute.sectionCode);
            stagedRelPaths.push(relTarget);
        }

        // 2.5 Cryptographic Root Merkle Digest Verification
        // Deterministically compute root hash and verify against bundle.rootHash
        const rootHasher = crypto.createHash('sha256');
        for (const [relPath, hash] of Object.entries(fileHashes).sort(([a], [b]) => a.localeCompare(b))) {
            rootHasher.update(`${relPath}:${hash}\n`);
        }
        const computedRoot = `sha256-${rootHasher.digest('hex')}`;
        if (bundle.rootHash !== computedRoot) {
            throw new Error(`[@mudraforge/statutory] Cryptographic integrity violation: Bundle rootHash mismatch. Expected "${bundle.rootHash}", computed "${computedRoot}".`);
        }

        // 2.6 Cryptographic Trust Anchor & Origin Authenticity Enforcement
        // Production Guard: Development bypasses cannot accidentally be enabled in production
        if (isProduction && options.allowUnverifiedRoot) {
            throw new Error('[@mudraforge/statutory] Security violation: options.allowUnverifiedRoot is strictly forbidden in production environments.');
        }

        // Caller-specified expected root constraints (exact pinning)
        if (options.expectedRootHash && bundle.rootHash !== options.expectedRootHash) {
            throw new Error(`[@mudraforge/statutory] Security violation: Bundle rootHash "${bundle.rootHash}" is not authorized. Expected rootHash "${options.expectedRootHash}".`);
        }

        if (Array.isArray(options.authorizedRootHashes) && !options.authorizedRootHashes.includes(bundle.rootHash)) {
            throw new Error(`[@mudraforge/statutory] Security violation: Bundle rootHash "${bundle.rootHash}" is not present in authorized root digests.`);
        }

        // Authenticity Anchor:
        // Supplying expectedRootHash or authorizedRootHashes does NOT bypass origin authentication.
        // Every bundle must either be signed by an authorized Ed25519 key or match an immutable pinned root,
        // unless explicitly opted into allowUnverifiedRoot in non-production environments.
        if (!options.allowUnverifiedRoot) {
            let isSignatureValid = false;
            if (bundle.signature) {
                isSignatureValid = verifyBundleSignature(bundle, options.publicKey || MUDRAFORGE_STATUTORY_ROOT_PUBLIC_KEY, options);
            }
            const isPinned = PINNED_RELEASE_ROOTS.has(bundle.rootHash);

            if (!isSignatureValid && !isPinned) {
                const isEdgeNewer = bundle.okfVersion && compareSemver(bundle.okfVersion, STATUTORY_CLIENT_VERSION) >= 0;
                const remediation = isEdgeNewer
                    ? `The remote legal bundle (OKF v${bundle.okfVersion}) has a newer cryptographic release root than recognized by your installed package (v${STATUTORY_CLIENT_VERSION}).\n` +
                      `  To receive the updated release roots and trust anchors, update your client:\n` +
                      `    npm install @mudraforge/statutory@latest\n` +
                      `    npx @mudraforge/statutory@latest sync`
                    : `Bundle is neither cryptographically signed by MudraForge Root Authority nor pinned in authorized release roots. Set options.allowUnverifiedRoot=true for local non-production fixtures.`;
                throw new Error(`[@mudraforge/statutory] Security violation: Untrusted bundle rootHash "${bundle.rootHash}". ${remediation}`);
            }
        }

        // 2.7 Required & Allowed Sections Verification
        // If requiredSections is omitted, default to MANDATORY_BASELINE_SECTIONS unless explicitly opted out
        const effectiveRequired = Array.isArray(options.requiredSections)
            ? options.requiredSections
            : (options.skipMandatoryBaselineCheck ? [] : MANDATORY_BASELINE_SECTIONS);

        for (const reqCode of effectiveRequired) {
            if (!seenCodes.has(reqCode.toLowerCase().trim())) {
                throw new Error(`[@mudraforge/statutory] Integrity violation: Bundle is missing required statutory provision "${reqCode}".`);
            }
        }

        if (Array.isArray(options.allowedSections)) {
            const allowedSet = new Set(options.allowedSections.map(s => s.toLowerCase().trim()));
            for (const code of seenCodes) {
                if (!allowedSet.has(code)) {
                    throw new Error(`[@mudraforge/statutory] Security violation: Bundle contains unexpected unauthorized section "${code}".`);
                }
            }
        }

        // 3. Atomically deploy from staging to destination
        for (const relTarget of stagedRelPaths) {
            const srcPath = path.join(stagingDir, relTarget);
            const destPath = path.join(okfDir, relTarget);

            // Safety assertion on destination path containment
            const resolvedDest = path.resolve(destPath);
            if (!resolvedDest.startsWith(path.resolve(okfDir) + path.sep)) {
                throw new Error(`[@mudraforge/statutory] Security violation: Destination path traversal detected in "${relTarget}".`);
            }

            fs.mkdirSync(path.dirname(destPath), { recursive: true });

            try {
                fs.renameSync(srcPath, destPath);
            } catch {
                fs.copyFileSync(srcPath, destPath);
                fs.unlinkSync(srcPath);
            }
        }

        // 4. Write verified manifest
        const manifestDomains = {};
        for (const statute of bundle.statutes) {
            const domain = statute.domain || (statute.relPath ? statute.relPath.split('/')[0] : 'sections');
            if (!manifestDomains[domain]) manifestDomains[domain] = [];
            if (statute.sectionCode) manifestDomains[domain].push(statute.sectionCode);
        }

        const manifest = {
            okfVersion: bundle.okfVersion,
            publishedAt: bundle.publishedAt || new Date().toISOString(),
            rootHash: bundle.rootHash,
            totalSections: bundle.statutes.length,
            changelog: bundle.changelog || 'Synchronized from Cloudflare Edge API',
            domains: manifestDomains,
            sections: syncedSectionCodes
        };
        fs.writeFileSync(path.join(okfDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

        return {
            success: true,
            notModified: false,
            okfVersion: bundle.okfVersion,
            rootHash: bundle.rootHash,
            syncedSections: bundle.statutes.length,
            destDir: okfDir
        };
    } finally {
        // Clean up temporary staging directory
        try {
            if (fs.existsSync(stagingDir)) {
                fs.rmSync(stagingDir, { recursive: true, force: true });
            }
        } catch (_) {}
    }
}

/**
 * Compute the temporal validity status of a statutory record as of a specific date.
 * If asOfDate is omitted or 'CURRENT_ACTIVE', evaluates against active baseline.
 * Returns 'ACTIVE', 'SUNSET_SUPERSEDED', or 'FUTURE_PENDING'.
 */
export function computeTemporalStatus(statute, asOfDate) {
    if (!statute || !statute.effectivePeriod) return 'ACTIVE';
    const queryDate = (!asOfDate || asOfDate === 'CURRENT_ACTIVE')
        ? new Date().toISOString().split('T')[0]
        : asOfDate.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
        throw new Error(`[@mudraforge/statutory] Invalid date format "${asOfDate}". Date must be in ISO 8601 YYYY-MM-DD format.`);
    }

    const { validFrom, validTo } = statute.effectivePeriod;

    if (validFrom && queryDate < validFrom) {
        return 'FUTURE_PENDING';
    }
    if (validTo && validTo !== 'OPEN_ENDED' && queryDate > validTo) {
        return 'SUNSET_SUPERSEDED';
    }
    return 'ACTIVE';
}

/**
 * Look up a statutory provision by section code or alias.
 * 
 * Supports explicit retrieval modes:
 * - 'auto' (default): Checks local OKF snapshot first; queries Cloudflare Edge API if unbundled or stale.
 * - 'local': Resolves strictly from local filesystem (0 network calls; fails if provision not bundled).
 * - 'edge': Resolves directly against Cloudflare Edge API (requires network connectivity).
 * 
 * To ensure epistemic rigor, responses explicitly distinguish between an offline static snapshot
 * and a live, edge-verified statutory lookup.
 */
export async function lookupStatute(section, options = {}) {
    if (!section || typeof section !== 'string' || !section.trim()) {
        throw new Error('[@mudraforge/statutory] Section query must be a non-empty string.');
    }

    const cleanSection = section.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (cleanSection.length > 64) {
        throw new Error('[@mudraforge/statutory] Section query exceeds maximum allowable length of 64 characters.');
    }

    const mode = options.mode || (options.forceEdge ? 'edge' : 'auto');
    const okfDir = options.okfDir || DEFAULT_LOCAL_OKF_DIR;
    const asOfDate = options.asOfDate ? options.asOfDate.trim() : 'CURRENT_ACTIVE';

    if (asOfDate !== 'CURRENT_ACTIVE' && !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
        throw new Error(`[@mudraforge/statutory] Invalid date format "${asOfDate}". Date must be in ISO 8601 YYYY-MM-DD format.`);
    }

    // 1. Strict Local Mode
    if (mode === 'local') {
        if (!fs.existsSync(okfDir)) {
            const dirErr = new Error(`[@mudraforge/statutory] Local OKF directory not found at: ${okfDir}`);
            dirErr.code = 'DIRECTORY_NOT_FOUND';
            throw dirErr;
        }
        const local = lookupLocalStatute(cleanSection, okfDir);
        if (!local) {
            const notFoundErr = new Error(`[@mudraforge/statutory] Section [${cleanSection}] not found in local OKF snapshot (${okfDir}).`);
            notFoundErr.code = 'SECTION_NOT_FOUND';
            throw notFoundErr;
        }
        return {
            status: 'SUCCESS',
            temporalStatus: computeTemporalStatus(local, asOfDate),
            asOfDate,
            source: 'LOCAL_OKF_FS',
            retrievalMode: 'LOCAL_SNAPSHOT',
            snapshotVersion: local.version || '2.4.0',
            isOfflineSnapshot: true,
            advisory: 'Offline statutory snapshot. For real-time gazetted amendments, sync with Edge API or run in edge mode.',
            statute: local
        };
    }

    // 2. Auto Mode: Local-first check
    if (mode === 'auto' && fs.existsSync(okfDir)) {
        try {
            const local = lookupLocalStatute(cleanSection, okfDir);
            if (local) {
                return {
                    status: 'SUCCESS',
                    temporalStatus: computeTemporalStatus(local, asOfDate),
                    asOfDate,
                    source: 'LOCAL_OKF_FS',
                    retrievalMode: 'LOCAL_SNAPSHOT',
                    snapshotVersion: local.version || '2.4.0',
                    isOfflineSnapshot: true,
                    advisory: 'Offline statutory snapshot. For real-time gazetted amendments, sync with Edge API or run in edge mode.',
                    statute: local
                };
            }
        } catch (_) {}
    }

    // 3. Edge API query
    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    assertSecureEndpoint(baseUrl);

    const url = new URL('/api/v1/statutory/lookup', baseUrl);
    url.searchParams.set('section', cleanSection);

    if (options.asOfDate) {
        url.searchParams.set('asOfDate', options.asOfDate.trim());
    }

    const headers = {
        'Accept': 'application/json',
        'User-Agent': buildUserAgent()
    };

    if (options.apiKey) {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
    }
    if (options.tier) {
        headers['X-Mudra-Tier'] = options.tier;
    }

    let response;
    try {
        response = await fetch(url.toString(), {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(options.timeoutMs || 15000)
        });
    } catch (netErr) {
        // In auto mode, if network failed but local is available, fall back with explicit flag
        if (mode === 'auto' && fs.existsSync(okfDir)) {
            const local = lookupLocalStatute(cleanSection, okfDir);
            if (local) {
                return {
                    status: 'SUCCESS',
                    temporalStatus: computeTemporalStatus(local, asOfDate),
                    asOfDate,
                    source: 'LOCAL_OKF_FS',
                    retrievalMode: 'LOCAL_SNAPSHOT_FALLBACK',
                    snapshotVersion: local.version || '2.4.0',
                    isOfflineSnapshot: true,
                    advisory: `Edge query unreachable (${netErr.message}); degraded to offline snapshot.`,
                    statute: local
                };
            }
        }
        const connErr = new Error(`[@mudraforge/statutory] Edge query failed: ${netErr.message}`);
        connErr.code = 'EDGE_NETWORK_ERROR';
        throw connErr;
    }

    if (!response.ok) {
        const isJson = (response.headers.get('content-type') || '').toLowerCase().includes('application/json');
        const errorJson = isJson ? await response.json().catch(() => ({})) : {};
        const err = new Error(errorJson.message || `Statutory lookup failed with HTTP ${response.status}`);
        err.status = response.status;
        err.code = response.status === 404 ? 'SECTION_NOT_FOUND' : 'EDGE_API_ERROR';
        err.error = errorJson.error;
        err.availableSections = errorJson.availableSections;
        throw err;
    }

    const data = await safeJsonParse(response, 'lookupStatute');
    return {
        ...data,
        source: 'EDGE_API',
        retrievalMode: 'EDGE_LIVE',
        isOfflineSnapshot: false
    };
}

/**
 * List all statutory sections currently indexed in the Open Knowledge Commons.
 * Attempts Edge API first, gracefully falling back to local OKF filesystem if offline.
 */
export async function listSections(options = {}) {
    const okfDir = options.okfDir || DEFAULT_LOCAL_OKF_DIR;

    function getLocalSections() {
        const results = [];
        if (!fs.existsSync(okfDir)) return results;
        const files = findJsonFilesRecursively(okfDir);
        for (const file of files) {
            if (path.basename(file) === 'section.json') {
                try {
                    const sec = JSON.parse(fs.readFileSync(file, 'utf8'));
                    if (sec.sectionCode) {
                        results.push({
                            sectionCode: sec.sectionCode,
                            section: sec.statutorySection || sec.title || sec.sectionCode,
                            validFrom: sec.effectivePeriod?.validFrom || '',
                            validTo: sec.effectivePeriod?.validTo || 'OPEN_ENDED',
                            governingStatute: sec.governingStatute || '',
                            tier: sec.tier || 'PUBLIC_COMMONS_FREE'
                        });
                    }
                } catch (_) {}
            }
        }
        return results;
    }

    if (options.localOnly) {
        return getLocalSections();
    }

    const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    assertSecureEndpoint(baseUrl);
    const url = new URL('/api/v1/statutory/sections', baseUrl);

    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': buildUserAgent()
            },
            signal: AbortSignal.timeout(options.timeoutMs || 15000)
        });

        if (response.ok) {
            const data = await safeJsonParse(response, 'listSections');
            if (data.sections && data.sections.length > 0) {
                // Merge local sections if local filesystem has newly added or unbundled provisions
                const localSecs = getLocalSections();
                const remoteCodes = new Set(data.sections.map(s => (s.sectionCode || '').toLowerCase()));
                const merged = [...data.sections];
                for (const loc of localSecs) {
                    if (!remoteCodes.has((loc.sectionCode || '').toLowerCase())) {
                        merged.push(loc);
                    }
                }
                return merged;
            }
        }
    } catch (_) {
        // Fall back gracefully to local OKF filesystem
    }

    return getLocalSections();
}

/**
 * Check if a statute was actively in force as of a specific date (or today).
 * Enforces fail-closed invariants: if failClosed is enabled, network or parse failures
 * raise StatutoryIndeterminateError rather than falsely reporting inactive status (preventing 0% withholding defaults).
 */
export async function isStatuteActive(section, asOfDate, options = {}) {
    try {
        const result = await lookupStatute(section, { ...options, asOfDate });
        return result.temporalStatus === 'ACTIVE';
    } catch (err) {
        if (err.code === 'SECTION_NOT_FOUND') {
            return false;
        }
        if (options.failClosed) {
            throw new StatutoryIndeterminateError(
                `Fail-closed check blocked: Unable to determine temporal status for [${section}]: ${err.message}`,
                { section, asOfDate, originalError: err }
            );
        }
        return false;
    }
}

/**
 * Execute a deterministic statutory calculation via the MudraForge Cloudflare Edge API.
 * Note: Calculation engines are NOT bundled locally in this client package.
 * They execute on the MudraForge edge runtime and require an Enterprise API key.
 * To obtain an API key, email MudraForge directly at hello@mudraforge.in or support@mudraforge.in.
 */
export async function calculate(payload = {}, options = {}) {
    const apiKey = options.apiKey || process.env?.MUDRA_STATUTORY_API_KEY || null;
    const client = new StatutoryClient({ ...options, apiKey });
    return await client.calculate(payload);
}

/**
 * Formalized Enterprise & Commons Client Class.
 * Provides offline-first resolution, automatic Cloudflare edge fallbacks,
 * and authenticated enterprise tier entitlements with System-1 reasoning & analysis modes.
 */
export class StatutoryClient {
    /**
     * @param {Object} [options]
     * @param {string} [options.apiKey] Enterprise API key (obtain from hello@mudraforge.in)
     * @param {'PUBLIC_COMMONS_FREE' | 'ENTERPRISE_PAID'} [options.tier] Client-side telemetry tier hint. Note: Edge server authorizes and throttles strictly based on the Bearer token, ignoring client tier claims.
     * @param {string} [options.baseUrl] Custom edge base URL
     * @param {string} [options.okfDir] Path to local OKF directory
     * @param {boolean} [options.offlineFirst=true] Query local filesystem before hitting edge
     * @param {boolean} [options.preferIpv4=false] Opt-in preference for IPv4 DNS resolution (calls node:dns.setDefaultResultOrder('ipv4first')). Note: In Node.js this operates at process scope to resolve Windows IPv6 Anycast timeouts.
     */
    constructor(options = {}) {
        this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.MUDRA_STATUTORY_API_KEY : null) || null;
        this.tier = options.tier || (this.apiKey ? 'ENTERPRISE_PAID' : 'PUBLIC_COMMONS_FREE');
        this.baseUrl = options.baseUrl || (typeof process !== 'undefined' ? process.env?.MUDRA_STATUTORY_BASE_URL : null) || DEFAULT_BASE_URL;
        this.okfDir = options.okfDir || DEFAULT_LOCAL_OKF_DIR;
        this.offlineFirst = options.offlineFirst !== false;
        this.preferIpv4 = options.preferIpv4 === true || (typeof process !== 'undefined' && process.env?.MUDRA_STATUTORY_PREFER_IPV4 === '1');
        if (this.preferIpv4 && typeof dns?.setDefaultResultOrder === 'function') {
            try {
                dns.setDefaultResultOrder('ipv4first');
            } catch (_) {}
        }
    }

    /**
     * Resolve a statutory provision with offline-first speed and enterprise tier attestation.
     */
    async lookup(section, options = {}) {
        const res = await lookupStatute(section, {
            ...options,
            baseUrl: this.baseUrl,
            okfDir: this.okfDir,
            apiKey: this.apiKey,
            tier: this.tier,
            forceEdge: !this.offlineFirst
        });

        return {
            ...res,
            tier: this.tier,
            clientTier: this.tier,
            authenticated: Boolean(this.apiKey)
        };
    }

    /**
     * Request a deterministic statutory calculation via the Cloudflare Edge API.
     * Requires an Enterprise API key.
     */
    async calculate(payload = {}, options = {}) {
        if (!this.apiKey) {
            const err = new Error(
                '[@mudraforge/statutory] The hosted cloud calculation endpoint (\'/api/v1/statutory/calculate\') requires an Enterprise API key.\n' +
                'To calculate deterministically offline without an API key or remote server, import pure calculation functions directly:\n' +
                '  import { calculateCorporateTaxMatVsConcessional, evaluatePlaceOfSupplyAndLut, calculateTransferPricingAlp, evaluateSection79LossContinuity, revalueForeignExchangeIndAs109 } from \'@mudraforge/statutory\';\n' +
                'For hosted cloud edge calculation access or custom enterprise models, contact hello@mudraforge.in or support@mudraforge.in.'
            );
            err.code = 'API_KEY_REQUIRED';
            err.contact = 'hello@mudraforge.in';
            err.support = 'support@mudraforge.in';
            throw err;
        }

        // Validate safe integer financial thresholds
        if (payload.invoiceAmount !== undefined && (
            typeof payload.invoiceAmount !== 'number' || 
            !Number.isFinite(payload.invoiceAmount) || 
            payload.invoiceAmount < 0 || 
            payload.invoiceAmount > Number.MAX_SAFE_INTEGER
        )) {
            throw new Error('[@mudraforge/statutory] Financial numerical validation error: invoiceAmount must be a non-negative finite number not exceeding Number.MAX_SAFE_INTEGER.');
        }
        if (payload.priorFyPurchases !== undefined && (
            typeof payload.priorFyPurchases !== 'number' || 
            !Number.isFinite(payload.priorFyPurchases) || 
            payload.priorFyPurchases < 0 || 
            payload.priorFyPurchases > Number.MAX_SAFE_INTEGER
        )) {
            throw new Error('[@mudraforge/statutory] Financial numerical validation error: priorFyPurchases must be a non-negative finite number not exceeding Number.MAX_SAFE_INTEGER.');
        }
        if (payload.principal !== undefined && (
            typeof payload.principal !== 'number' || 
            !Number.isFinite(payload.principal) || 
            payload.principal < 0 || 
            payload.principal > Number.MAX_SAFE_INTEGER
        )) {
            throw new Error('[@mudraforge/statutory] Financial numerical validation error: principal must be a non-negative finite number not exceeding Number.MAX_SAFE_INTEGER.');
        }

        assertSecureEndpoint(this.baseUrl);

        const url = new URL('/api/v1/statutory/calculate', this.baseUrl);
        let res;
        try {
            res = await fetch(url.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Mudra-Tier': this.tier,
                    'User-Agent': `@mudraforge/statutory/${STATUTORY_CLIENT_VERSION} (${this.tier})`
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(options.timeoutMs || 20000)
            });
        } catch (fetchErr) {
            const isTimeout = fetchErr.name === 'TimeoutError' || 
                              fetchErr.code === 'UND_ERR_CONNECT_TIMEOUT' || 
                              fetchErr.code === 'ETIMEDOUT' ||
                              fetchErr.message?.includes('timeout') || 
                              fetchErr.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
            if (isTimeout) {
                const timeoutErr = new Error(
                    `[@mudraforge/statutory] Connection timeout reaching ${this.baseUrl}.\n` +
                    `Diagnostic advice: On Windows environments, broken or unrouted IPv6 Anycast routing can cause connection timeouts to Cloudflare edge IPs.\n` +
                    `To resolve, enable IPv4-first resolution on the client by passing { preferIpv4: true } to StatutoryClient or setting environment variable MUDRA_STATUTORY_PREFER_IPV4=1.`
                );
                timeoutErr.code = 'CONNECTION_TIMEOUT';
                timeoutErr.cause = fetchErr;
                throw timeoutErr;
            }
            throw fetchErr;
        }

        if (!res.ok) {
            const isJson = (res.headers.get('content-type') || '').toLowerCase().includes('application/json');
            const errJson = isJson ? await res.json().catch(() => ({})) : {};
            const err = new Error(errJson.message || `Statutory calculation failed with HTTP ${res.status}`);
            err.status = res.status;
            err.error = errJson.error;
            err.contact = errJson.contact || 'hello@mudraforge.in';
            throw err;
        }

        const parsedResult = await safeJsonParse(res, 'StatutoryClient.calculate');
        return enrichWithOutcomeExplanation(parsedResult, { ...options, verbose: options.verbose || payload.verbose });
    }

    /**
     * Check active status with optional fail-closed protection.
     */
    async isStatuteActive(section, asOfDate, options = {}) {
        return await isStatuteActive(section, asOfDate, { ...options, baseUrl: this.baseUrl, okfDir: this.okfDir });
    }

    /**
     * List all indexed sections.
     */
    async listSections() {
        return await listSections({ baseUrl: this.baseUrl });
    }

    /**
     * Check for newer upstream OKF releases on edge.
     */
    async checkUpdates() {
        return await checkUpdates({ baseUrl: this.baseUrl, okfDir: this.okfDir });
    }

    /**
     * Sync local filesystem with upstream edge bundle.
     */
    async sync() {
        return await syncOkf({ baseUrl: this.baseUrl, okfDir: this.okfDir });
    }

    /**
     * Crosswalk a statutory provision across the 1961 Act and 2025 Act regimes
     * resolving the crystallization date against the earlier of credit or payment.
     */
    crosswalk(section, options = {}) {
        return crosswalkStatute(section, { ...options, okfDir: this.okfDir });
    }

    /**
     * Query the statutory regulatory changelog and amendment tracker.
     */
    diff(options = {}) {
        return getStatutoryDiff({ ...options, okfDir: this.okfDir });
    }

    /**
     * Cryptographically verify the local OKF substrate authenticity and integrity.
     */
    verify(targetDir) {
        return verifyLocalSubstrate(targetDir || this.okfDir);
    }

    /**
     * Run statutory diagnostic doctor.
     */
    async doctor(options = {}) {
        return await runStatutoryDoctor(options);
    }

    /**
     * Evaluate Corporate Tax: Normal MAT (Section 115JB) vs Concessional Regime (Section 115BAA).
     */
    calculateCorporateTaxMatVsConcessional(payload) {
        return calculateCorporateTaxMatVsConcessional(payload);
    }

    /**
     * Evaluate Place of Supply (POS) & Zero-Rated Export of Services under LUT (IGST Sections 10, 12, 13, 16).
     */
    evaluatePlaceOfSupplyAndLut(payload) {
        return evaluatePlaceOfSupplyAndLut(payload);
    }

    /**
     * Compute Transfer Pricing Arm's Length Price (ALP) under Section 92C & Rule 10CA.
     */
    calculateTransferPricingAlp(payload) {
        return calculateTransferPricingAlp(payload);
    }

    /**
     * Evaluate Section 79 Loss Carry-Forward & Shareholding Continuity with unabsorbed depreciation protection.
     */
    evaluateSection79LossContinuity(payload) {
        return evaluateSection79LossContinuity(payload);
    }

    /**
     * Revalue foreign exchange monetary items at closing spot rates under Ind AS 21 and Ind AS 109.
     */
    revalueForeignExchangeIndAs109(payload) {
        return revalueForeignExchangeIndAs109(payload);
    }

    /**
     * Business Combinations & Purchase Price Allocation (PPA) under Ind AS 103 / IFRS 3 / ASC 805.
     */
    calculateBusinessCombinationsIndAs103(payload) {
        return calculateBusinessCombinationsIndAs103(payload);
    }

    /**
     * Asset & CGU Impairment Testing & DCF Value in Use under Ind AS 36 / IAS 36 / ASC 360.
     */
    calculateImpairmentIndAs36(payload) {
        return calculateImpairmentIndAs36(payload);
    }

    /**
     * 5-Step Revenue Recognition & Relative SSP Allocation under Ind AS 115 / IFRS 15 / ASC 606.
     */
    calculateRevenueAllocationIndAs115(payload) {
        return calculateRevenueAllocationIndAs115(payload);
    }

    /**
     * Right-of-Use Asset & Lease Liability Amortization under Ind AS 116 / IFRS 16 / ASC 842.
     */
    calculateLeaseAmortizationIndAs116(payload) {
        return calculateLeaseAmortizationIndAs116(payload);
    }

    /**
     * Expected Credit Loss (ECL) Impairment under Ind AS 109 / IFRS 9 / ASC 326.
     */
    calculateExpectedCreditLossIndAs109(payload) {
        return calculateExpectedCreditLossIndAs109(payload);
    }

    /**
     * ESOP Graded Vesting Front-Loaded Amortization under Ind AS 102 / IFRS 2 / ASC 718.
     */
    calculateEsopAmortizationIndAs102(payload) {
        return calculateEsopAmortizationIndAs102(payload);
    }

    /**
     * Balance Sheet Deferred Tax (DTA / DTL) and ETR Reconciliation under Ind AS 12 / IAS 12 / ASC 740.
     */
    calculateDeferredTaxIndAs12(payload) {
        return calculateDeferredTaxIndAs12(payload);
    }

    /**
     * Provisions, Contingent Liabilities & Tax Dispute Triangulation under Ind AS 37 / IAS 37 / ASC 450.
     */
    evaluateProvisionsAndContingenciesIndAs37(payload) {
        return evaluateProvisionsAndContingenciesIndAs37(payload);
    }

    /**
     * Foreign Currency Monetary Revaluation & FCTR Translation under Ind AS 21 / IAS 21 / ASC 830.
     */
    calculateForeignCurrencyIndAs21(payload) {
        return calculateForeignCurrencyIndAs21(payload);
    }

    /**
     * Section 194Q: Deduction of tax at source on purchase of goods exceeding ₹50 Lakh.
     */
    evaluateSection194Q(payload) {
        return evaluateSection194Q(payload);
    }

    /**
     * Section 194C: Withholding on contractor and sub-contractor payments.
     */
    evaluateSection194C(payload) {
        return evaluateSection194C(payload);
    }

    /**
     * Section 194H: Withholding on commission and brokerage payments.
     */
    evaluateSection194H(payload) {
        return evaluateSection194H(payload);
    }

    /**
     * Section 194I: Withholding on rent (land/building vs plant/machinery).
     */
    evaluateSection194I(payload) {
        return evaluateSection194I(payload);
    }

    /**
     * Section 194J: Withholding on professional and technical services (FTS).
     */
    evaluateSection194J(payload) {
        return evaluateSection194J(payload);
    }

    /**
     * Section 194A: Withholding on interest other than interest on securities.
     */
    evaluateSection194A(payload) {
        return evaluateSection194A(payload);
    }

    /**
     * Section 194O: E-commerce operator marketplace withholding & 194Q/206C(1H) override.
     */
    evaluateSection194O(payload) {
        return evaluateSection194O(payload);
    }

    /**
     * Section 194-IA: Immovable property transfer TDS (higher of consideration or SDV) & Form 26QB.
     */
    evaluateSection194IA(payload) {
        return evaluateSection194IA(payload);
    }

    /**
     * Section 194-IB: Individual/HUF rent TDS, 2% rate cut, Form 26QC, and Section 194-IB(4) last-month rent ceiling.
     */
    evaluateSection194IB(payload) {
        return evaluateSection194IB(payload);
    }

    /**
     * Section 194M: Individual/HUF contract/commission/professional TDS, 2% rate cut, Form 26QD, and 50L threshold.
     */
    evaluateSection194M(payload) {
        return evaluateSection194M(payload);
    }

    /**
     * Section 194R: Benefit or perquisite in business or profession TDS, in-kind advance tax, and de minimis threshold.
     */
    evaluateSection194R(payload) {
        return evaluateSection194R(payload);
    }

    /**
     * Section 43B / Section 36(1)(va): Statutory payables disallowance & Supreme Court Checkmate Doctrine.
     */
    evaluateSection43B(payload) {
        return evaluateSection43BStatutoryPayables(payload);
    }

    /**
     * Section 281: M&A asset transfer tax clearance & voidability evaluation under CBDT Circular 04/2011.
     */
    evaluateSection281(payload) {
        return evaluateSection281TaxClearance(payload);
    }

    /**
     * Rule 37: 180-day vendor non-payment ITC reversal & Section 50(1) 18% interest.
     */
    calculateItcReversalRule37(payload) {
        return calculateItcReversalRule37(payload);
    }

    /**
     * Rule 37A: Reversal of ITC where supplier failed to furnish Form GSTR-3B by November 30.
     */
    calculateRule37ASupplierNonFilingReversal(payload) {
        return calculateRule37ASupplierNonFilingReversal(payload);
    }

    /**
     * Rule 42: Inputs and input services common ITC reversal (monthly provisional).
     */
    calculateRule42InputServiceReversal(payload) {
        return calculateRule42InputServiceReversal(payload);
    }

    /**
     * Rule 42(2): Annual common credit true-up reconciliation & Section 50(1) interest.
     */
    reconcileRule42AnnualTrueUp(payload) {
        return reconcileRule42AnnualTrueUp(payload);
    }

    /**
     * Rule 43: Capital goods common ITC 60-month amortisation and reversal.
     */
    calculateRule43CapitalGoodsReversal(payload) {
        return calculateRule43CapitalGoodsReversal(payload);
    }

    /**
     * Rule 42 & 43: Combined input tax credit apportionment orchestrator.
     */
    calculateGstItcApportionmentRule42_43(payload) {
        return calculateGstItcApportionmentRule42_43(payload);
    }

    /**
     * MSMED Act Section 16: Compound interest with monthly rests at 3x RBI Bank Rate.
     */
    calculateMsmeCompoundInterest(payload) {
        return calculateMsmeCompoundInterest(payload);
    }

    /**
     * Section 43B(h): Year-end tax disallowance on overdue MSME invoices.
     */
    evaluateSection43bH(payload) {
        return evaluateSection43bH(payload);
    }

    /**
     * Section 195: Cross-border foreign remittance tax withholding.
     */
    evaluateCrossBorderRemittance(payload) {
        return evaluateCrossBorderRemittance(payload);
    }

    /**
     * Parse raw Tally or ERP daybook CSV text into normalized vouchers.
     * @param {string} csvText
     */
    parseTallyDaybookCsv(csvText) {
        return parseTallyDaybookCsv(csvText);
    }

    /**
     * Parse raw Tally XML daybook export into normalized vouchers.
     * @param {string} xmlText
     */
    parseTallyDaybookXml(xmlText) {
        return parseTallyDaybookXml(xmlText);
    }

    /**
     * Reconcile daybook vouchers against Section 194Q and Section 40(a)(ia) rules.
     * @param {Array<Object>} vouchers
     * @param {Object} [options]
     */
    reconcileDaybook(vouchers, options = {}) {
        return reconcile194QDaybook(vouchers, options);
    }

    /**
     * Programmatic alias for reconcileDaybook.
     */
    reconcile194QDaybook(vouchers, options = {}) {
        return reconcile194QDaybook(vouchers, options);
    }

    /**
     * Generate Tally-compliant XML compensating journal vouchers for unwithheld TDS.
     * @param {Object} reconciliationResult
     * @param {Object} [options]
     */
    generateTallyJournalXml(reconciliationResult, options = {}) {
        return generateTally194QJournalXml(reconciliationResult, options);
    }

    /**
     * Programmatic alias for generateTallyJournalXml.
     */
    generateTally194QJournalXml(reconciliationResult, options = {}) {
        return generateTally194QJournalXml(reconciliationResult, options);
    }

    /**
     * Format a clean Markdown audit exception report for Form 3CD working papers.
     * @param {Object} reconciliationResult
     */
    generateAuditReport(reconciliationResult) {
        return generateAuditMarkdownReport(reconciliationResult);
    }

    /**
     * Parse raw Zoho Books Bills CSV text into normalized bill records.
     * @param {string} csvText
     */
    parseZohoBillsCsv(csvText) {
        return parseZohoBillsCsv(csvText);
    }

    /**
     * Parse raw Zoho Books API JSON payload into normalized bill records.
     * @param {Object|string} jsonData
     */
    parseZohoBillsJson(jsonData) {
        return parseZohoBillsJson(jsonData);
    }

    /**
     * Parse raw GST Portal Form GSTR-2B JSON payload into normalized invoice and CDNR records.
     * @param {Object|string} gstr2bData
     */
    parseGstr2bJson(gstr2bData) {
        return parseGstr2bJson(gstr2bData);
    }

    /**
     * Reconcile Zoho Books AP Bills with Form GSTR-2B and audit Rule 37 180-day aging.
     * @param {Object} params
     * @param {Array<Object>|string} params.zohoBills
     * @param {Array<Object>|string} params.gstr2b
     * @param {Object} [params.options]
     */
    reconcileZohoGstr2b(params) {
        return reconcileZohoGstr2b(params);
    }

    /**
     * Generate an executive Markdown audit exception memorandum for Zoho Books & GSTR-2B.
     * @param {Object} reconResult
     */
    generateGstr2bAuditMarkdownReport(reconResult) {
        return generateGstr2bAuditMarkdownReport(reconResult);
    }

    /**
     * Programmatic alias for generateGstr2bAuditMarkdownReport.
     */
    generateGstr2bAuditReport(reconResult) {
        return generateGstr2bAuditMarkdownReport(reconResult);
    }

    /**
     * Reconstruct cumulative portfolio ECL utilization for multiple overlapping overdue invoices under Rule 88B(3).
     * @param {Object} params
     */
    calculatePortfolioEclUtilizationInterest(params) {
        return calculatePortfolioEclUtilizationInterest(params);
    }

    /**
     * Run regulatory watchtower surveillance and generate Empanelment Freshness Certificate.
     * @param {Object} [options]
     */
    async runWatchtower(options = {}) {
        const { runStatutoryWatchtower: runner } = await import('../scripts/watchtower.js');
        return runner({ okfDir: this.okfDir, ...options });
    }

    /**
     * Calculate exact Day 180 overdue start date for an invoice.
     * @param {string} billDateIso
     */
    calculateOverdueStartDate(billDateIso) {
        return calculateOverdueStartDate(billDateIso);
    }

    /**
     * Calculate chronological interest under Section 50(1) read with Rule 88B(3)
     * across Electronic Credit Ledger (ECL) movements.
     * @param {Object} params
     */
    calculateEclUtilizationInterest(params) {
        return calculateEclUtilizationInterest(params);
    }

    /**
     * Construct an immutable evidence provenance record for a reconciliation item.
     * @param {Object} params
     */
    buildEvidenceProvenance(params) {
        return buildEvidenceProvenance(params);
    }

    /**
     * Normalize invoice number for exact and alphanumeric canonical matching.
     * @param {string} raw
     */
    normalizeInvoiceNumber(raw) {
        return normalizeInvoiceNumber(raw);
    }

    /**
     * Normalize and validate GSTIN string.
     * @param {string} raw
     */
    normalizeGstin(raw) {
        return normalizeGstin(raw);
    }

    /**
     * Programmatic alias for generateAuditReport.
     */
    generateAuditMarkdownReport(reconciliationResult) {
        return generateAuditMarkdownReport(reconciliationResult);
    }

    /**
     * Clean and normalize raw accounting numeric input.
     * @param {any} val
     * @param {Object} [options]
     */
    cleanNumericAmount(val, options = {}) {
        return cleanNumericAmount(val, options);
    }

    /**
     * Round an amount to paisa precision (2 decimal places).
     * @param {any} amount
     */
    roundToPaisa(amount) {
        return roundToPaisa(amount);
    }

    /**
     * Convert rupee amount to integer paise for zero-drift arithmetic.
     * @param {any} amount
     * @param {string} [fieldName='amount']
     */
    toIntegerPaise(amount, fieldName = 'amount') {
        return toIntegerPaise(amount, fieldName);
    }

    /**
     * Convert integer paise back to rounded rupees.
     * @param {number} paise
     */
    fromIntegerPaise(paise) {
        return fromIntegerPaise(paise);
    }

    /**
     * Retrieve statutory outcomes and disposition codes.
     * @param {string} [provision] Optional section code or provision alias
     * @param {Object} [options]
     */
    async getOutcomes(provision = null, options = {}) {
        return await getStatutoryOutcomes(provision, {
            ...options,
            baseUrl: this.baseUrl
        });
    }

    /**
     * Retrieve in-depth explanation and remediation steps for a disposition code.
     * @param {string} codeOrQuery Disposition code (e.g. 'BUYER_TURNOVER_UNVERIFIED', 'INDETERMINATE')
     * @param {Object} [options]
     */
    explain(codeOrQuery, options = {}) {
        return explainStatutoryDisposition(codeOrQuery, options);
    }
}

/**
 * Standard Indian State & Union Territory Codes (Census 2011 / GSTN 2-digit prefix).
 */
export const INDIAN_STATE_CODES = {
    '01': 'Jammu & Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '26': 'Dadra & Nagar Haveli and Daman & Diu',
    '27': 'Maharashtra',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman & Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh',
    '97': 'Other Territory',
    '99': 'Centre Jurisdiction'
};

/**
 * Statutory 4th character legal status classification for Indian Permanent Account Numbers (PAN).
 * Enacted under Section 139A of the Income-tax Act, 1961 read with Rule 114 of Income Tax Rules.
 */
export const PAN_ENTITY_TYPES = {
    'P': { code: 'P', name: 'Individual', isIndividualOrHuf: true, standard194cRatePercent: 1.0 },
    'H': { code: 'H', name: 'Hindu Undivided Family (HUF)', isIndividualOrHuf: true, standard194cRatePercent: 1.0 },
    'C': { code: 'C', name: 'Company', isIndividualOrHuf: false, standard194cRatePercent: 2.0 },
    'F': { code: 'F', name: 'Partnership Firm / LLP', isIndividualOrHuf: false, standard194cRatePercent: 2.0 },
    'T': { code: 'T', name: 'Trust', isIndividualOrHuf: false, standard194cRatePercent: 2.0 },
    'A': { code: 'A', name: 'Association of Persons (AOP)', isIndividualOrHuf: false, standard194cRatePercent: 2.0 },
    'B': { code: 'B', name: 'Body of Individuals (BOI)', isIndividualOrHuf: false, standard194cRatePercent: 2.0 },
    'L': { code: 'L', name: 'Local Authority', isIndividualOrHuf: false, standard194cRatePercent: 2.0 },
    'J': { code: 'J', name: 'Artificial Juridical Person', isIndividualOrHuf: false, standard194cRatePercent: 2.0 },
    'G': { code: 'G', name: 'Government Agency', isIndividualOrHuf: false, standard194cRatePercent: 2.0 }
};

const BASE36_ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates the check digit of a 15-character Goods and Services Tax Identification Number (GSTIN)
 * using the official ISO/IEC 7064 Mod 36, 36 check digit algorithm.
 * 
 * Offline, zero-dependency, and deterministic. Requires zero network calls.
 * 
 * @param {string} gstin 15-character alphanumeric GSTIN string
 * @returns {boolean} True if the 15th character exactly matches the calculated check character
 */
export function isValidGstinChecksum(gstin) {
    if (!gstin || typeof gstin !== 'string') return false;
    const clean = gstin.trim().toUpperCase();

    // Structural syntax: State (2 digits) + PAN (10 chars) + Entity (1 char) + Z (1 char) + Check (1 char)
    const pattern = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
    if (!pattern.test(clean)) return false;

    let total = 0;
    for (let i = 0; i < 14; i++) {
        const val = BASE36_ALPHANUMERIC.indexOf(clean[i]);
        if (val === -1) return false;
        const factor = (i % 2 === 0) ? 1 : 2;
        const product = val * factor;
        total += Math.floor(product / 36) + (product % 36);
    }

    const expectedIndex = (36 - (total % 36)) % 36;
    const expectedChar = BASE36_ALPHANUMERIC[expectedIndex];
    return clean[14] === expectedChar;
}

/**
 * Deterministically decodes an Indian Tax Identifier (PAN or GSTIN).
 * 
 * Capabilities:
 * - Structural regular expression pattern validation
 * - Offline ISO/IEC 7064 Mod 36, 36 checksum calculation for GSTIN
 * - State code and name extraction from GSTIN prefix
 * - Embedded 10-character PAN extraction from GSTIN positions 3..12
 * - Statutory legal entity classification via 4th character of PAN (Individual, HUF, Company, Firm, etc.)
 * - Statutory Section 194C withholding rate derivation (1% for Individual/HUF vs 2% for Other Entities)
 * 
 * Zero dependencies, 0-neuron, zero network calls.
 * 
 * @param {string} rawId PAN (10 characters) or GSTIN (15 characters)
 * @returns {Object} Decoded tax entity metadata
 */
export function decodeTaxIdentifier(rawId) {
    if (!rawId || typeof rawId !== 'string') {
        return {
            isValid: false,
            error: 'Tax identifier must be a non-empty string.'
        };
    }

    const clean = rawId.trim().toUpperCase();

    // 1. Process 15-character GSTIN
    if (clean.length === 15) {
        const pattern = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
        if (!pattern.test(clean)) {
            return {
                isValid: false,
                type: 'GSTIN',
                gstin: clean,
                error: 'Malformed GSTIN format: expected 2 digits state + 10 chars PAN + 1 entity char + Z + 1 check char.'
            };
        }

        const isChecksumValid = isValidGstinChecksum(clean);
        const stateCode = clean.slice(0, 2);
        const pan = clean.slice(2, 12);
        const entityCode = pan[3];
        const entityMeta = PAN_ENTITY_TYPES[entityCode] || {
            code: entityCode,
            name: 'Other Entity / Non-Individual',
            isIndividualOrHuf: false,
            standard194cRatePercent: 2.0
        };

        return {
            isValid: isChecksumValid,
            checksumValid: isChecksumValid,
            type: 'GSTIN',
            gstin: clean,
            pan,
            stateCode,
            stateName: INDIAN_STATE_CODES[stateCode] || 'Unknown Territory',
            entityCode,
            entityType: entityMeta.name,
            isIndividualOrHuf: entityMeta.isIndividualOrHuf,
            standard194cRatePercent: entityMeta.standard194cRatePercent,
            error: isChecksumValid ? null : 'GSTIN checksum mismatch under ISO/IEC 7064 Mod 36, 36.'
        };
    }

    // 2. Process 10-character PAN
    if (clean.length === 10) {
        const panPattern = /^[A-Z]{5}\d{4}[A-Z]$/;
        if (!panPattern.test(clean)) {
            return {
                isValid: false,
                type: 'PAN',
                pan: clean,
                error: 'Malformed PAN format: expected 5 letters + 4 digits + 1 letter.'
            };
        }

        const entityCode = clean[3];
        const entityMeta = PAN_ENTITY_TYPES[entityCode] || {
            code: entityCode,
            name: 'Other Entity / Non-Individual',
            isIndividualOrHuf: false,
            standard194cRatePercent: 2.0
        };

        return {
            isValid: true,
            type: 'PAN',
            pan: clean,
            entityCode,
            entityType: entityMeta.name,
            isIndividualOrHuf: entityMeta.isIndividualOrHuf,
            standard194cRatePercent: entityMeta.standard194cRatePercent,
            error: null
        };
    }

    return {
        isValid: false,
        error: `Invalid identifier length (${clean.length}): Expected 10 characters for PAN or 15 characters for GSTIN.`
    };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Authoritative Dual-Act Statutory Crosswalk Catalog
 * Bridges provisions of the Income-tax Act, 1961 (Act No. 43 of 1961) with
 * the Income-tax Act, 2025 (Act No. 1 of 2025, taking effect 1 April 2026).
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const STATUTORY_CROSSWALK_CATALOG = [
    {
        id: 'CROSSWALK_194Q_393_TABLE8_II',
        domain: 'direct_tax',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '194Q',
            statutorySection: 'Section 194Q',
            title: 'Deduction of tax at source on payment of a certain sum for purchase of goods',
            threshold: 'Buyer turnover > ₹10 Cr in preceding FY; annual purchases > ₹50 Lakhs in current FY',
            standardRate: '0.1%',
            penaltyRate: '5.0% (Section 206AA inoperative / non-furnished PAN)',
            challan: 'ITNS 281',
            returnForm: 'Form 26Q (Quarterly Return of TDS)'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
            sectionCode: '393',
            statutorySection: 'Section 393(1), Table 8, Item (ii)',
            title: 'Deduction of tax at source on payment of a certain sum for purchase of goods',
            effectiveDate: '2026-04-01',
            threshold: 'Buyer turnover > ₹10 Cr in preceding FY; annual purchases > ₹50 Lakhs in current FY',
            standardRate: '0.1%',
            penaltyRate: '5.0% (Section 397(2) Proviso)',
            challan: 'Challan under Income-tax Act, 2025',
            returnForm: 'Quarterly Statement of Tax Withholding (2025 Act Rules)'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Tax withholding liability crystallizes on the earlier of credit to payee account in books or payment disbursement. If the trigger event occurred on or before 31 March 2026, the 1961 Act governs the deduction, remittance, and compliance obligations, notwithstanding subsequent settlement.'
        },
        aliases: ['194q', 'sec194q', 'section 194q', '393', 'sec393', 'section 393', '393(1)', '393(1)(table 8)(ii)', 'goods tds', 'purchase of goods']
    },
    {
        id: 'CROSSWALK_194J_393_TABLE6_III',
        domain: 'direct_tax',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '194J',
            statutorySection: 'Section 194J',
            title: 'Deduction of tax at source on fees for professional or technical services',
            threshold: '₹30,000 aggregate in financial year per category',
            standardRate: '2.0% (Technical Services / Royalty / Call Centre) / 10.0% (Professional Fees)',
            penaltyRate: '20.0% (Section 206AA)',
            challan: 'ITNS 281',
            returnForm: 'Form 26Q'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
            sectionCode: '393',
            statutorySection: 'Section 393(1), Table 6, Item (iii)',
            title: 'Deduction of tax at source on fees for professional or technical services',
            effectiveDate: '2026-04-01',
            threshold: '₹30,000 aggregate in financial year per category',
            standardRate: '2.0% (FTS) / 10.0% (Professional)',
            penaltyRate: '20.0% (Section 397(2))',
            challan: 'Challan under Income-tax Act, 2025',
            returnForm: 'Quarterly Statement of Tax Withholding (2025 Act Rules)'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Liability crystallizes on earlier of credit or payment. Pre-April 1, 2026 events are saved and governed under the 1961 Act.'
        },
        aliases: ['194j', 'sec194j', 'section 194j', '393(1)(table 6)', 'technical services tds', 'professional fees tds', 'fts']
    },
    {
        id: 'CROSSWALK_194C_393_TABLE3_I',
        domain: 'direct_tax',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '194C',
            statutorySection: 'Section 194C',
            title: 'Deduction of tax at source on payments to contractors',
            threshold: 'Single contract > ₹30,000 or aggregate > ₹1,00,000 in FY',
            standardRate: '1.0% (Individual/HUF payee) / 2.0% (Company/Firm payee)',
            penaltyRate: '20.0% (Section 206AA)',
            challan: 'ITNS 281',
            returnForm: 'Form 26Q'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
            sectionCode: '393',
            statutorySection: 'Section 393(1), Table 3, Item (i)',
            title: 'Deduction of tax at source on payments to contractors',
            effectiveDate: '2026-04-01',
            threshold: 'Single contract > ₹30,000 or aggregate > ₹1,00,000 in FY',
            standardRate: '1.0% (Individual/HUF) / 2.0% (Company/Firm)',
            penaltyRate: '20.0% (Section 397(2))',
            challan: 'Challan under Income-tax Act, 2025',
            returnForm: 'Quarterly Statement of Tax Withholding (2025 Act Rules)'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Liability crystallizes on earlier of credit or payment. Pre-April 1, 2026 events are saved and governed under the 1961 Act.'
        },
        aliases: ['194c', 'sec194c', 'section 194c', '393(1)(table 3)', 'contractor tds', 'subcontractor tds']
    },
    {
        id: 'CROSSWALK_194I_393_TABLE5_I',
        domain: 'direct_tax',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '194I',
            statutorySection: 'Section 194I',
            title: 'Deduction of tax at source on rent',
            threshold: '₹2,40,000 aggregate in financial year',
            standardRate: '2.0% (Plant & Machinery) / 10.0% (Land & Building)',
            penaltyRate: '20.0% (Section 206AA)',
            challan: 'ITNS 281',
            returnForm: 'Form 26Q'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
            sectionCode: '393',
            statutorySection: 'Section 393(1), Table 5, Item (i)',
            title: 'Deduction of tax at source on rent',
            effectiveDate: '2026-04-01',
            threshold: '₹2,40,000 aggregate in financial year',
            standardRate: '2.0% (Plant & Machinery) / 10.0% (Land & Building)',
            penaltyRate: '20.0% (Section 397(2))',
            challan: 'Challan under Income-tax Act, 2025',
            returnForm: 'Quarterly Statement of Tax Withholding (2025 Act Rules)'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Liability crystallizes on earlier of credit or payment. Pre-April 1, 2026 events are saved and governed under the 1961 Act.'
        },
        aliases: ['194i', 'sec194i', 'section 194i', '393(1)(table 5)', 'rent tds']
    },
    {
        id: 'CROSSWALK_194H_393_TABLE4_I',
        domain: 'direct_tax',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '194H',
            statutorySection: 'Section 194H',
            title: 'Deduction of tax at source on commission or brokerage',
            threshold: '₹15,000 aggregate in financial year',
            standardRate: '2.0% (Amended from 5% w.e.f. 01-10-2024 by Finance Act, 2024)',
            penaltyRate: '20.0% (Section 206AA)',
            challan: 'ITNS 281',
            returnForm: 'Form 26Q'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
            sectionCode: '393',
            statutorySection: 'Section 393(1), Table 4, Item (i)',
            title: 'Deduction of tax at source on commission or brokerage',
            effectiveDate: '2026-04-01',
            threshold: '₹15,000 aggregate in financial year',
            standardRate: '2.0%',
            penaltyRate: '20.0% (Section 397(2))',
            challan: 'Challan under Income-tax Act, 2025',
            returnForm: 'Quarterly Statement of Tax Withholding (2025 Act Rules)'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Liability crystallizes on earlier of credit or payment. Pre-April 1, 2026 events are saved and governed under the 1961 Act.'
        },
        aliases: ['194h', 'sec194h', 'section 194h', '393(1)(table 4)', 'commission tds', 'brokerage tds']
    },
    {
        id: 'CROSSWALK_194R_393_TABLE8_12',
        domain: 'direct_tax',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '194R',
            statutorySection: 'Section 194R',
            title: 'Deduction of tax at source on benefit or perquisite in respect of business or profession',
            threshold: '₹20,000 aggregate value in financial year',
            standardRate: '10.0%',
            penaltyRate: '20.0% (Section 206AA)',
            challan: 'ITNS 281',
            returnForm: 'Form 26Q'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
            sectionCode: '393',
            statutorySection: 'Section 393(1), Table 8, Item 12',
            title: 'Deduction of tax at source on benefit or perquisite in respect of business or profession',
            effectiveDate: '2026-04-01',
            threshold: '₹20,000 aggregate value in financial year',
            standardRate: '10.0%',
            penaltyRate: '20.0% (Section 397(2))',
            challan: 'Challan under Income-tax Act, 2025',
            returnForm: 'Quarterly Statement of Tax Withholding (2025 Act Rules)'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Liability crystallizes on earlier of credit or payment. Pre-April 1, 2026 events are saved and governed under the 1961 Act.'
        },
        aliases: ['194r', 'sec194r', 'section 194r', 'perquisites tds', 'business benefits tds']
    },
    {
        id: 'CROSSWALK_195_393_2',
        domain: 'international_tax',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '195',
            statutorySection: 'Section 195',
            title: 'Deduction of tax at source on payment of other sums to non-residents',
            threshold: 'Any sum chargeable under the provisions of this Act (no de minimis threshold)',
            standardRate: 'Rates in force (or DTAA rate under Section 90(2), whichever is more beneficial)',
            penaltyRate: '20.0% (Section 206AA subject to DTAA TRC exceptions)',
            challan: 'ITNS 281',
            returnForm: 'Form 27Q (Quarterly Return of TDS for Non-Residents)'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
            sectionCode: '393(2)',
            statutorySection: 'Section 393(2)',
            title: 'Deduction of tax at source on payment of other sums to non-residents',
            effectiveDate: '2026-04-01',
            threshold: 'Any sum chargeable under the provisions of the 2025 Act',
            standardRate: 'Rates in force or DTAA rate under Section 158(2)',
            penaltyRate: '20.0% (Section 397(2))',
            challan: 'Challan under Income-tax Act, 2025',
            returnForm: 'Non-Resident Tax Withholding Statement (2025 Act Rules)'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Liability crystallizes on earlier of credit or payment. Pre-April 1, 2026 events are saved and governed under the 1961 Act.'
        },
        aliases: ['195', 'sec195', 'section 195', '393(2)', 'foreign remittance tds', 'non resident tds']
    },
    {
        id: 'CROSSWALK_206AB_SUNSET',
        domain: 'direct_tax',
        isOmittedSunset: true,
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '206AB',
            statutorySection: 'Section 206AB',
            title: 'Special provision for deduction of tax at source for non-filers of income-tax return',
            threshold: 'Aggregate TDS/TCS >= ₹50,000 in preceding FY and return not filed u/s 139(1)',
            standardRate: 'Higher of: 2x specified rate, 2x rates in force, or 5.0%',
            penaltyRate: 'Higher rate applies automatically',
            challan: 'ITNS 281',
            returnForm: 'Form 26Q'
        },
        successor: {
            act: 'Finance Act, 2025 (Statutory Sunset & Omission)',
            sectionCode: '206AB [OMITTED]',
            statutorySection: 'Section 206AB Omitted',
            title: 'Formally omitted by Finance Act, 2025 effective 1 April 2025 (No higher rate for non-filers)',
            effectiveDate: '2025-04-01',
            threshold: 'N/A (Provision repealed; compliance check utility discontinued)',
            standardRate: '0.0%',
            penaltyRate: '0.0%',
            challan: 'N/A',
            returnForm: 'N/A'
        },
        transitionCutoffDate: '2025-04-01',
        savingsAuthority: {
            statute: 'Finance Act, 2025 Section 206AB Sunset Clause',
            subsidiary: 'General Clauses Act, 1897 Section 6',
            legalPrinciple: 'Deductions on or before 31 March 2025 remain assessable under Section 206AB. Deductions on or after 1 April 2025 attract ZERO non-filer penalty rate; standard statutory rates apply. Higher rates under Section 206AA for invalid/inoperative PAN remain independent and fully active at 20%.'
        },
        aliases: ['206ab', 'sec206ab', 'section 206ab', 'non filer higher tds', '206ab sunset', 'non filer sunset']
    },
    {
        id: 'CROSSWALK_206C_1H_SUNSET',
        domain: 'direct_tax',
        isOmittedSunset: true,
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '206C(1H)',
            statutorySection: 'Section 206C(1H)',
            title: 'Collection of tax at source by seller on receipt of consideration for sale of goods',
            threshold: 'Seller turnover > ₹10 Cr in preceding FY; receipts from buyer > ₹50 Lakhs in FY',
            standardRate: '0.1%',
            penaltyRate: '1.0% (Section 206CC non-furnishing of PAN)',
            challan: 'ITNS 281 (TCS Code 0021/0020)',
            returnForm: 'Form 27EQ (Quarterly Statement of TCS)'
        },
        successor: {
            act: 'Finance Act, 2025 (Statutory Sunset & Omission)',
            sectionCode: '206C(1H) [OMITTED]',
            statutorySection: 'Section 206C(1H) Omitted',
            title: 'Formally omitted by Finance Act, 2025 effective 1 April 2025 (No successor in 2025 Act)',
            effectiveDate: '2025-04-01',
            threshold: 'N/A (Provision repealed; zero seller collection obligation)',
            standardRate: '0.0%',
            penaltyRate: '0.0%',
            challan: 'N/A',
            returnForm: 'N/A'
        },
        transitionCutoffDate: '2025-04-01',
        savingsAuthority: {
            statute: 'Finance Act, 2025 Section 206C(1H) Sunset Clause',
            subsidiary: 'General Clauses Act, 1897 Section 6',
            legalPrinciple: 'Receipts on or before 31 March 2025 remain assessable under 1961 Act. Receipts on or after 1 April 2025 attract ZERO seller TCS; tax withholding is governed strictly by buyer TDS under Section 194Q / Section 393.'
        },
        aliases: ['206c(1h)', 'sec206c(1h)', 'section 206c(1h)', '206c1h', 'seller tcs', 'tcs goods sunset']
    },
    {
        id: 'CROSSWALK_50B_78',
        domain: 'corporate_ma_restructuring',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961)',
            sectionCode: '50B',
            statutorySection: 'Section 50B',
            title: 'Special provision for computation of capital gains in case of slump sale',
            threshold: 'Transfer of one or more undertakings as a result of the sale for a lump sum consideration without values being assigned to individual assets',
            standardRate: '20.0% (LTCG) / Normal corporate rate (STCG if undertaking held <= 36 months)',
            penaltyRate: 'N/A',
            challan: 'Advance Tax / Self-Assessment Tax',
            returnForm: 'Form 3CEA (Accountant Net Worth & Rule 11UAE Report)'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
            sectionCode: '78',
            statutorySection: 'Section 78',
            title: 'Capital gains on slump sale of undertakings',
            effectiveDate: '2026-04-01',
            threshold: 'Transfer of one or more undertakings for a lump sum consideration without individual asset values',
            standardRate: 'Statutory capital gains rates under 2025 Act',
            penaltyRate: 'N/A',
            challan: 'Advance Tax / Self-Assessment Tax (2025 Act)',
            returnForm: 'Accountant Report under 2025 Act Rules'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Slump sales executed prior to 1 April 2026 governed by Section 50B and Rule 11UAE.'
        },
        aliases: ['50b', 'sec50b', 'section 50b', '78', 'sec78', 'section 78', 'slump sale']
    },
    {
        id: 'CROSSWALK_MSMED_43BH_37_2_G',
        domain: 'msme_commercial',
        predecessor: {
            act: 'Income-tax Act, 1961 (Act No. 43 of 1961) read with MSMED Act, 2006',
            sectionCode: 'MSMED-15-16',
            statutorySection: 'Section 43B(h) read with Sections 15 & 16 of MSMED Act, 2006',
            title: 'Timely payment to Micro and Small Enterprises and deduction disallowance for delayed payments',
            threshold: '15 days without written agreement; maximum 45 days under written agreement',
            standardRate: 'Disallowance of 100% overdue sum; compound interest at 3x RBI Bank Rate',
            penaltyRate: 'Section 23 MSMED permanent income-tax addback on penal interest',
            challan: 'N/A (Business Income Adjustment)',
            returnForm: 'ITR-6 Schedule BP & Tax Audit Form 3CD Clause 22'
        },
        successor: {
            act: 'Income-tax Act, 2025 (Act No. 1 of 2025) read with MSMED Act, 2006',
            sectionCode: '37(2)(g)',
            statutorySection: 'Section 37(2)(g) of Income-tax Act, 2025 read with MSMED Act, 2006',
            title: 'Disallowance of expenditure for delayed payments to Micro and Small Enterprises',
            effectiveDate: '2026-04-01',
            threshold: '15 days default / maximum 45 days under written agreement',
            standardRate: '100% expenditure disallowance in year of incurrence; deductible in year of actual payment',
            penaltyRate: 'Penal interest disallowed under Section 37(2)(g)',
            challan: 'N/A',
            returnForm: 'Corporate Tax Return & Tax Audit Report under 2025 Act Rules'
        },
        transitionCutoffDate: '2026-04-01',
        savingsAuthority: {
            statute: 'Income-tax Act, 2025 Section 536 (Repeals and Savings)',
            subsidiary: 'General Clauses Act, 1897 Section 6 (Effect of Repeal)',
            legalPrinciple: 'Deductions disallowed in FY 2023-24 / 2024-25 / 2025-26 under Section 43B(h) remain eligible for deduction upon actual payment under savings provisions.'
        },
        aliases: ['msmed', 'msmed-15-16', '43b(h)', '43bh', 'sec43b(h)', '37(2)(g)', 'msme delayed payments']
    }
];

/**
 * Crosswalk a statutory section between the Income-tax Act, 1961 and Income-tax Act, 2025,
 * rigorously resolving the applicable governing law based on the earlier of credit or payment.
 * 
 * @param {string} sectionCode Section code or alias (e.g. '194Q', '393', '194J', '206C(1H)')
 * @param {Object} [options]
 * @param {string} [options.creditDate] ISO date string (YYYY-MM-DD) of credit in books
 * @param {string} [options.paymentDate] ISO date string (YYYY-MM-DD) of payment disbursement
 * @param {string} [options.asOfDate] ISO date string (YYYY-MM-DD) fallback audit reference date
 * @param {string} [options.date] Alias for asOfDate
 * @param {string} [options.okfDir] Local OKF directory path
 * @returns {Object} Deterministic crosswalk report
 */
export function crosswalkStatute(sectionCode, options = {}) {
    if (!sectionCode || typeof sectionCode !== 'string' || !sectionCode.trim()) {
        throw new Error('[@mudraforge/statutory] Section code query must be a non-empty string.');
    }

    const clean = sectionCode.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();

    // Match crosswalk entry
    const entry = STATUTORY_CROSSWALK_CATALOG.find(c => {
        if (c.predecessor.sectionCode.toLowerCase() === clean) return true;
        if (c.successor.sectionCode.toLowerCase() === clean) return true;
        if (c.aliases.includes(clean)) return true;
        if (c.predecessor.statutorySection.toLowerCase() === clean) return true;
        if (c.successor.statutorySection.toLowerCase() === clean) return true;
        return false;
    });

    if (!entry) {
        throw new Error(
            `[@mudraforge/statutory] Section "${sectionCode}" could not be resolved to a known statutory crosswalk provision. ` +
            `Supported provisions include: 194Q, 194J, 194C, 194I, 194H, 194R, 195, 206AB, 206C(1H), 50B, MSMED-15-16, 393.`
        );
    }

    // Validate dates if provided
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (options.creditDate) {
        const cd = options.creditDate.trim();
        if (!datePattern.test(cd) || isNaN(new Date(cd).getTime())) {
            throw new Error(`[@mudraforge/statutory] Invalid creditDate format "${options.creditDate}". Expected ISO 8601 YYYY-MM-DD.`);
        }
    }
    if (options.paymentDate) {
        const pd = options.paymentDate.trim();
        if (!datePattern.test(pd) || isNaN(new Date(pd).getTime())) {
            throw new Error(`[@mudraforge/statutory] Invalid paymentDate format "${options.paymentDate}". Expected ISO 8601 YYYY-MM-DD.`);
        }
    }
    const asOf = options.asOfDate || options.date;
    if (asOf && asOf !== 'CURRENT_ACTIVE') {
        const ad = asOf.trim();
        if (!datePattern.test(ad) || isNaN(new Date(ad).getTime())) {
            throw new Error(`[@mudraforge/statutory] Invalid date format "${asOf}". Expected ISO 8601 YYYY-MM-DD.`);
        }
    }

    const creditDate = options.creditDate ? options.creditDate.trim() : null;
    const paymentDate = options.paymentDate ? options.paymentDate.trim() : null;

    let triggerDate = null;
    let triggerReason = '';
    let triggerDescription = '';

    if (creditDate && paymentDate) {
        if (creditDate < paymentDate) {
            triggerDate = creditDate;
            triggerReason = 'EARLIER_EVENT_CREDIT_IN_BOOKS';
            triggerDescription = `Credit to payee account in books occurred on ${creditDate}, prior to payment disbursement on ${paymentDate}.`;
        } else if (paymentDate < creditDate) {
            triggerDate = paymentDate;
            triggerReason = 'EARLIER_EVENT_PAYMENT_DISBURSEMENT';
            triggerDescription = `Payment disbursement occurred on ${paymentDate}, prior to credit in books on ${creditDate}.`;
        } else {
            triggerDate = creditDate;
            triggerReason = 'SIMULTANEOUS_CREDIT_AND_PAYMENT';
            triggerDescription = `Credit in books and payment disbursement occurred simultaneously on ${creditDate}.`;
        }
    } else if (creditDate) {
        triggerDate = creditDate;
        triggerReason = 'SPECIFIED_CREDIT_DATE';
        triggerDescription = `Evaluated against date of credit to payee account in books (${creditDate}).`;
    } else if (paymentDate) {
        triggerDate = paymentDate;
        triggerReason = 'SPECIFIED_PAYMENT_DATE';
        triggerDescription = `Evaluated against date of payment disbursement (${paymentDate}).`;
    } else if (asOf && asOf !== 'CURRENT_ACTIVE') {
        triggerDate = asOf.trim();
        triggerReason = 'SPECIFIED_AS_OF_DATE';
        triggerDescription = `Evaluated against explicit reference date (${triggerDate}).`;
    } else {
        triggerDate = new Date().toISOString().slice(0, 10);
        triggerReason = 'DEFAULT_CURRENT_DATE';
        triggerDescription = `Evaluated against current runtime timestamp (${triggerDate}).`;
    }

    const cutoff = entry.transitionCutoffDate;
    let governingAct = '';
    let applicableSection = '';
    let temporalStatus = '';
    let legalAnalysis = '';
    let savingsApplied = false;
    let isOmitted = Boolean(entry.isOmittedSunset);

    if (entry.isOmittedSunset) {
        // e.g. 206C(1H), 206AB
        if (triggerDate < cutoff) {
            governingAct = entry.predecessor.act;
            applicableSection = entry.predecessor.statutorySection;
            temporalStatus = 'GOVERNED_BY_1961_ACT';
            if (entry.predecessor.sectionCode === '206AB') {
                legalAnalysis = `Trigger event crystallized on ${triggerDate} (prior to 1 April 2025 sunset). Governed by Section 206AB of the Income-tax Act, 1961. Higher withholding rate (twice applicable rate or 5%) applied to non-filer specified persons.`;
            } else {
                legalAnalysis = `Trigger event crystallized on ${triggerDate} (prior to 1 April 2025 sunset). Governed by ${entry.predecessor.statutorySection} of the ${entry.predecessor.act}. Seller was obligated to collect 0.1% TCS on receipts exceeding ₹50 Lakhs unless buyer was liable and deducted TDS u/s 194Q.`;
            }
        } else {
            governingAct = entry.successor.act;
            applicableSection = entry.successor.statutorySection;
            temporalStatus = 'SUNSET_OMITTED';
            if (entry.predecessor.sectionCode === '206AB') {
                legalAnalysis = `Section 206AB was formally omitted by the Finance Act, 2025 w.e.f. 1 April 2025. No non-filer punitive TDS rate applies on or after 1 April 2025; standard statutory TDS rates apply. Higher rates under Section 206AA for missing/inoperative PAN remain independent and fully active at 20%.`;
            } else {
                legalAnalysis = `Section 206C(1H) was formally omitted by the Finance Act, 2025 w.e.f. 1 April 2025 to eliminate double-compliance overlap. No seller TCS liability attaches to transactions on or after 1 April 2025. Tax withholding on sale of goods is governed exclusively by buyer TDS under Section 194Q / Section 393.`;
            }
        }
    } else {
        // Standard transition to 2025 Act
        if (triggerDate < cutoff) {
            governingAct = entry.predecessor.act;
            applicableSection = entry.predecessor.statutorySection;
            temporalStatus = 'GOVERNED_BY_1961_ACT';
            savingsApplied = true;
            legalAnalysis = `Because the statutory withholding event crystallized on ${triggerDate} (${triggerReason}), the transaction is governed by ${entry.predecessor.act} ${entry.predecessor.statutorySection}. Under ${entry.savingsAuthority.statute} read with ${entry.savingsAuthority.subsidiary}, pre-April 1, 2026 liabilities are preserved and enforced under the 1961 Act regime (Challan ${entry.predecessor.challan}, ${entry.predecessor.returnForm}), even if remittance or payment settlement occurs on or after 1 April 2026.`;
        } else {
            governingAct = entry.successor.act;
            applicableSection = entry.successor.statutorySection;
            temporalStatus = 'GOVERNED_BY_2025_ACT';
            savingsApplied = false;
            legalAnalysis = `The trigger event crystallized on ${triggerDate} (on or after 1 April 2026). The transaction is governed by the successor provision ${entry.successor.statutorySection} of the ${entry.successor.act}. This provision directly supersedes ${entry.predecessor.statutorySection} of the 1961 Act.`;
        }
    }

    return {
        status: 'SUCCESS',
        isValid: true,
        querySection: sectionCode,
        triggerDate,
        triggerReason,
        triggerDescription,
        creditDate,
        paymentDate,
        transitionCutoffDate: cutoff,
        governingAct,
        applicableSection,
        temporalStatus,
        savingsApplied,
        isOmittedSunset: isOmitted,
        crosswalk: {
            id: entry.id,
            domain: entry.domain,
            predecessor: entry.predecessor,
            successor: entry.successor,
            savingsAuthority: entry.savingsAuthority
        },
        legalAnalysis
    };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Authoritative Semantic Regulatory Amendments Changelog
 * Curated timeline of major legislative, regulatory, and procedural amendments.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const STATUTORY_AMENDMENTS_CHANGELOG = [
    {
        id: 'DIFF-2021-05-24-50B',
        sectionCode: '50B',
        domain: 'corporate_ma_restructuring',
        title: 'Capital Gains on Slump Sale — Rule 11UAE Fair Market Value Mandate',
        effectiveDate: '2021-05-24',
        amendmentType: 'VALUATION_MANDATE',
        statute: 'Income-tax Act, 1961',
        legalAuthority: 'Finance Act, 2021 & CBDT Notification No. 68/2021 (Rule 11UAE)',
        previousValue: 'Book value of undertaking accepted as Net Worth',
        amendedValue: 'Deemed full value of consideration determined as higher of FMV1 (market value of transferred capital assets) or FMV2 (market value of consideration received)',
        changeSummary: 'CBDT notified Rule 11UAE prescribing mandatory fair market value computation for slump sale undertakings to prevent tax avoidance via undervalued asset transfers.',
        statutoryImpact: 'Mandatory Form 3CEA report by an Accountant verifying net worth and Rule 11UAE calculation.',
        aliases: ['50b', 'slump sale']
    },
    {
        id: 'DIFF-2021-07-01-194Q',
        sectionCode: '194Q',
        domain: 'direct_tax',
        title: 'Introduction of TDS on Purchase of Goods',
        effectiveDate: '2021-07-01',
        amendmentType: 'NEW_WITHHOLDING_LEVY',
        statute: 'Income-tax Act, 1961',
        legalAuthority: 'Finance Act, 2021 & CBDT Circular No. 13 of 2021',
        previousValue: 'No withholding tax by buyers on purchase of goods',
        amendedValue: '0.1% TDS on aggregate purchases exceeding ₹50 Lakhs where buyer turnover > ₹10 Cr',
        changeSummary: 'Mandated 0.1% TDS on purchase of goods exceeding ₹50 Lakhs in a financial year at earlier of credit or payment.',
        statutoryImpact: 'Buyer TDS overrides seller TCS u/s 206C(1H). Requires PAN validation; 5% penalty rate for inoperative PAN.',
        aliases: ['194q', 'goods tds']
    },
    {
        id: 'DIFF-2022-01-01-16_2',
        sectionCode: '16(2)',
        domain: 'indirect_tax_gst',
        title: 'Introduction of Section 16(2)(aa) — Mandatory Invoice Upload Matching',
        effectiveDate: '2022-01-01',
        amendmentType: 'ITC_RESTRICTION',
        statute: 'Central Goods and Services Tax Act, 2017',
        legalAuthority: 'Finance Act, 2021 (Notified w.e.f. 1 January 2022) & Notification No. 39/2021-CT',
        previousValue: 'Provisional ITC permitted under Rule 36(4) with 5% provisional cushion',
        amendedValue: 'Zero provisional ITC; invoice details must be furnished by supplier in GSTR-1 and communicated to recipient in GSTR-2B',
        changeSummary: 'Sub-clause (aa) inserted into Section 16(2), making supplier filing in GSTR-1 and reflection in GSTR-2B an absolute statutory precondition for claiming input tax credit.',
        statutoryImpact: 'Eliminates provisional credit; recipients cannot take credit unless invoice appears in auto-populated GSTR-2B.',
        aliases: ['16(2)', '16_2', 'itc eligibility', 'gstr 2b']
    },
    {
        id: 'DIFF-2022-04-01-206AB',
        sectionCode: '206AB',
        domain: 'direct_tax',
        title: 'Relaxation of Higher TDS Non-Filer Lookback Period',
        effectiveDate: '2022-04-01',
        amendmentType: 'COMPLIANCE_ADJUSTMENT',
        statute: 'Income-tax Act, 1961',
        legalAuthority: 'Finance Act, 2022',
        previousValue: '2 preceding financial years non-filing requirement',
        amendedValue: '1 preceding financial year non-filing requirement with aggregate TDS/TCS >= ₹50,000',
        changeSummary: 'Reduced the non-filing lookback threshold under Section 206AB from 2 years to 1 year preceding the relevant financial year.',
        statutoryImpact: 'Payers must verify non-filer status using the Compliance Check functionality on the Income Tax Portal.',
        aliases: ['206ab', 'non filer']
    },
    {
        id: 'DIFF-2025-04-01-206AB',
        sectionCode: '206AB',
        domain: 'direct_tax',
        title: 'Statutory Sunset & Omission of Section 206AB Higher Non-Filer TDS',
        effectiveDate: '2025-04-01',
        amendmentType: 'STATUTORY_OMISSION',
        statute: 'Finance Act, 2025',
        legalAuthority: 'Finance Act, 2025 (Section 206AB Sunset Clause)',
        previousValue: 'Higher TDS rate (higher of 2x specified rate, 2x rates in force, or 5%) for non-filers',
        amendedValue: 'OMITTED (Section 206AB repealed; standard TDS rates apply without non-filer penalty)',
        changeSummary: 'Finance Act, 2025 formally omitted Section 206AB and Section 206CCA effective 1 April 2025 to relieve deductors from non-filer compliance checks.',
        statutoryImpact: 'Tax deductors are no longer required to run portal compliance checks for specified persons; standard statutory rates apply. Higher rates under Section 206AA for invalid/inoperative PAN remain active.',
        aliases: ['206ab', 'non filer sunset', '206ab omitted']
    },
    {
        id: 'DIFF-2022-07-01-194R',
        sectionCode: '194R',
        domain: 'direct_tax',
        title: 'Introduction of TDS on Business Perquisites and Benefits',
        effectiveDate: '2022-07-01',
        amendmentType: 'NEW_WITHHOLDING_LEVY',
        statute: 'Income-tax Act, 1961',
        legalAuthority: 'Finance Act, 2022 & CBDT Circular No. 12 of 2022',
        previousValue: 'No withholding tax on business gifts, dealer incentives, or perquisites',
        amendedValue: '10% TDS on value or aggregate value of benefits/perquisites exceeding ₹20,000 in FY',
        changeSummary: 'Enacted Section 194R imposing 10% withholding tax on any benefit or perquisite arising from business or exercise of profession.',
        statutoryImpact: 'Applies to non-cash benefits; deductor must ensure tax is paid prior to releasing benefit in kind.',
        aliases: ['194r', 'perquisites']
    },
    {
        id: 'DIFF-2022-07-16-195',
        sectionCode: '195',
        domain: 'international_tax',
        title: 'Mandatory Electronic Filing of Form 10F for Foreign Remittances',
        effectiveDate: '2022-07-16',
        amendmentType: 'PROCEDURAL_DIGITIZATION',
        statute: 'Income-tax Act, 1961',
        legalAuthority: 'CBDT Notification No. 03/2022',
        previousValue: 'Manual physical signed paper Form 10F accepted for Treaty relief u/s 90(2)',
        amendedValue: 'Mandatory electronic submission of Form 10F on the Income Tax e-filing portal',
        changeSummary: 'CBDT mandated electronic filing of Form 10F for non-resident payees claiming DTAA benefits where TRC lacks specific details.',
        statutoryImpact: 'Foreign payees must obtain PAN or use non-resident portal credentials to generate electronic Form 10F.',
        aliases: ['195', 'form 10f', 'foreign remittance']
    },
    {
        id: 'DIFF-2023-08-01-RULE48_4',
        sectionCode: 'RULE-48(4)',
        domain: 'indirect_tax_gst',
        title: 'E-Invoicing Turnover Threshold Lowered to ₹5 Crore',
        effectiveDate: '2023-08-01',
        amendmentType: 'THRESHOLD_LOWERING',
        statute: 'Central Goods and Services Tax Rules, 2017',
        legalAuthority: 'CBIC Notification No. 10/2023-Central Tax',
        previousValue: '₹10 Crore aggregate turnover threshold',
        amendedValue: '₹5 Crore aggregate turnover threshold in any preceding FY from 2017-18 onward',
        changeSummary: 'Lowered the mandatory e-invoicing threshold under Rule 48(4) from ₹10 Crore to ₹5 Crore.',
        statutoryImpact: 'Invoices issued without 64-character IRN and signed QR code are deemed void under Rule 48(5); buyer ITC blocked.',
        aliases: ['rule-48(4)', 'rule 48(4)', 'einvoicing', 'irn']
    },
    {
        id: 'DIFF-2024-04-01-MSMED_43B_H',
        sectionCode: 'MSMED-15-16',
        domain: 'msme_commercial',
        title: 'Enforcement of Section 43B(h) — Timely Payment to Micro & Small Enterprises',
        effectiveDate: '2024-04-01',
        amendmentType: 'DISALLOWANCE_ENFORCEMENT',
        statute: 'Income-tax Act, 1961',
        legalAuthority: 'Finance Act, 2023',
        previousValue: 'Deduction allowable on accrual basis if paid before tax return filing date u/s 139(1)',
        amendedValue: 'Proviso to Section 43B removed for MSE dues; deduction disallowed in FY unless paid within Section 15 MSMED timeline (15 or 45 days)',
        changeSummary: 'Enacted clause (h) in Section 43B disallowing deductions for sums payable to Micro and Small Enterprises if not paid within MSMED Section 15 timelines.',
        statutoryImpact: 'Overdue amounts added back to taxable income; allowable only in year of actual payment. Compound interest u/s 16 is permanently disallowed u/s 23.',
        aliases: ['msmed', 'msmed-15-16', '43b(h)', '43bh']
    },
    {
        id: 'DIFF-2024-10-01-194H',
        sectionCode: '194H',
        domain: 'direct_tax',
        title: 'Section 194H Commission & Brokerage Rate Cut from 5% to 2%',
        effectiveDate: '2024-10-01',
        amendmentType: 'RATE_REDUCTION',
        statute: 'Income-tax Act, 1961',
        legalAuthority: 'Finance (No. 2) Act, 2024',
        previousValue: '5.0% TDS',
        amendedValue: '2.0% TDS',
        changeSummary: 'Reduced statutory withholding tax rate on commission and brokerage payments from 5% to 2% to improve working capital for agents and distributors.',
        statutoryImpact: 'All credits or payments on or after 1 October 2024 attract 2% TDS. Cumulative ₹15,000 threshold remains unchanged.',
        aliases: ['194h', 'commission tds', 'brokerage tds']
    },
    {
        id: 'DIFF-2025-04-01-206C_1H',
        sectionCode: '206C(1H)',
        domain: 'direct_tax',
        title: 'Statutory Sunset & Formal Omission of Section 206C(1H) Seller TCS',
        effectiveDate: '2025-04-01',
        amendmentType: 'STATUTORY_OMISSION',
        statute: 'Income-tax Act, 1961',
        legalAuthority: 'Finance Act, 2025',
        previousValue: '0.1% TCS on sale of goods receipts exceeding ₹50 Lakhs',
        amendedValue: 'OMITTED (Section 206C(1H) repealed; 0% TCS / No collection obligation)',
        changeSummary: 'Finance Act, 2025 formally omitted Section 206C(1H) effective 1 April 2025 to eliminate regulatory overlap with buyer TDS under Section 194Q.',
        statutoryImpact: 'Sellers no longer collect TCS on sale of goods. Tax withholding attaches solely through Section 194Q buyer TDS where buyer criteria are met.',
        aliases: ['206c(1h)', 'tcs goods', 'seller tcs']
    },
    {
        id: 'DIFF-2026-04-01-ITA2025',
        sectionCode: '393',
        domain: 'direct_tax',
        title: 'Enactment of Income-tax Act, 2025 — Unified Table-Based Withholding Regime',
        effectiveDate: '2026-04-01',
        amendmentType: 'ACT_TRANSITION',
        statute: 'Income-tax Act, 2025 (Act No. 1 of 2025)',
        legalAuthority: 'Parliament of India / Income-tax Act, 2025',
        previousValue: 'Income-tax Act, 1961 (Scattered Chapter XVII-B sections: 194C, 194J, 194Q, 194I, 194H, 194R, 195)',
        amendedValue: 'Income-tax Act, 2025 Section 393 Tables (Table 3: Contractors, Table 4: Commission, Table 5: Rent, Table 6: Professional/FTS, Table 8: Goods/Perquisites)',
        changeSummary: 'The Income-tax Act, 2025 consolidates and restructures direct tax withholding into unified schedules under Section 393, repealing the 1961 Act subject to Section 536 savings.',
        statutoryImpact: 'Withholding liabilities on or after 1 April 2026 are governed by 2025 Act section references and procedural compliance.',
        aliases: ['393', 'income tax act 2025', '2025 act']
    }
];

/**
 * Retrieve statutory amendments and regulatory diffs filtered by section, date, and domain.
 * 
 * @param {Object} [options]
 * @param {string} [options.section] Filter by section code or alias (e.g. '194H', '206C(1H)', '16(2)')
 * @param {string} [options.since] ISO date string (YYYY-MM-DD); returns amendments taking effect on or after this date
 * @param {string} [options.domain] Filter by statutory domain (e.g. 'direct_tax', 'indirect_tax_gst')
 * @param {string} [options.okfDir] Local OKF directory path
 * @returns {Object} Deterministic diff report
 */
export function getStatutoryDiff(options = {}) {
    const since = options.since ? options.since.trim() : null;
    if (since) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || isNaN(new Date(since).getTime())) {
            throw new Error(`[@mudraforge/statutory] Invalid since date format "${options.since}". Expected ISO 8601 YYYY-MM-DD.`);
        }
    }

    const sectionFilter = options.section ? options.section.trim().toLowerCase() : null;
    const domainFilter = options.domain ? options.domain.trim().toLowerCase() : null;

    let matched = STATUTORY_AMENDMENTS_CHANGELOG.filter(item => {
        if (since && item.effectiveDate < since) {
            return false;
        }
        if (domainFilter && item.domain.toLowerCase() !== domainFilter) {
            return false;
        }
        if (sectionFilter) {
            const matchesCode = item.sectionCode.toLowerCase() === sectionFilter;
            const matchesAlias = item.aliases && item.aliases.some(a => a.toLowerCase() === sectionFilter);
            if (!matchesCode && !matchesAlias) {
                return false;
            }
        }
        return true;
    });

    matched.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

    return {
        status: 'SUCCESS',
        filterSection: options.section || null,
        filterSince: since,
        filterDomain: options.domain || null,
        totalAmendments: matched.length,
        amendments: matched
    };
}

// ── Deterministic Zero-Dependency Statutory Calculators Export ──────────────
async function runStatutoryWatchtower(options = {}) {
    const { runStatutoryWatchtower: runner } = await import('../scripts/watchtower.js');
    return runner(options);
}

export {
    roundToPaisa,
    roundSection288B,
    cleanNumericAmount,
    toIntegerPaise,
    fromIntegerPaise,
    MalformedNumericInputError,
    MissingMandatoryParameterError,
    assertMandatoryNumeric,
    calculateCorporateTaxMatVsConcessional,
    evaluatePlaceOfSupplyAndLut,
    calculateTransferPricingAlp,
    evaluateSection79LossContinuity,
    evaluateSection281TaxClearance,
    revalueForeignExchangeIndAs109,
    calculateBusinessCombinationsIndAs103,
    calculateImpairmentIndAs36,
    calculateRevenueAllocationIndAs115,
    calculateLeaseAmortizationIndAs116,
    calculateExpectedCreditLossIndAs109,
    calculateEsopAmortizationIndAs102,
    calculateDeferredTaxIndAs12,
    evaluateProvisionsAndContingenciesIndAs37,
    calculateForeignCurrencyIndAs21,
    evaluateSection194Q,
    evaluateSection194C,
    evaluateSection194H,
    evaluateSection194I,
    evaluateSection194J,
    evaluateSection194A,
    evaluateSection194O,
    evaluateSection194IA,
    evaluateSection194IB,
    evaluateSection194M,
    evaluateSection194R,
    evaluateSection43BStatutoryPayables,
    calculateItcReversalRule37,
    calculateRule37ASupplierNonFilingReversal,
    evaluateSection206C1H,
    evaluateSection43bH,
    calculateMsmeCompoundInterest,
    calculateAdvanceTaxAndInterest,
    calculateRule42InputServiceReversal,
    reconcileRule42AnnualTrueUp,
    calculateRule43CapitalGoodsReversal,
    calculateGstItcApportionmentRule42_43,
    evaluateCrossBorderRemittance,
    generateMsme1AndScheduleThreeAging,
    evaluateLowerDeductionCertificateValidity,
    getRbiBankRateForDate,
    DEFAULT_RBI_BANK_RATE,
    MSMED_RATE_MULTIPLIER,
    RBI_BANK_RATE_SCHEDULE,
    AUTHORITATIVE_STATUTORY_RATES,
    VALID_194J_CATEGORIES,
    getStatutoryOutcomes,
    explainStatutoryDisposition,
    STATUTORY_OUTCOMES_DICTIONARY,
    enrichWithOutcomeExplanation,
    parseTallyDaybookCsv,
    parseTallyDaybookXml,
    reconcile194QDaybook,
    generateTally194QJournalXml,
    generateAuditMarkdownReport,
    getIndianFinancialYear,
    parseZohoBillsCsv,
    parseZohoBillsJson,
    parseGstr2bJson,
    reconcileZohoGstr2b,
    generateGstr2bAuditMarkdownReport,
    normalizeInvoiceNumber,
    normalizeGstin,
    calculateOverdueStartDate,
    calculateEclUtilizationInterest,
    calculatePortfolioEclUtilizationInterest,
    buildEvidenceProvenance,
    runStatutoryWatchtower
};



