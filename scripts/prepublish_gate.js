/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PREPUBLISH VERIFICATION GATE
 * Deterministic supply-chain integrity verification executed prior to `npm publish`.
 * Enforces:
 *   1. Cryptographic Manifest Check (SHA-256 Merkle root verification)
 *   2. OKF v0.2 Schema Validation across all provisions, circulars, and forms
 *   3. Deep Semantic Citation Verification against official government whitelist
 *   4. OKF Conformance Specification Suite
 *   5. Multi-Domain Regression Test Suite
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const steps = [
    { name: '1/7: Cryptographic Merkle Manifest Verification', cmd: 'node scripts/generate_manifest.js --check' },
    { name: '2/7: OKF v0.2 Schema & Provenance Validation', cmd: 'node scripts/validate_okf.js' },
    { name: '3/7: Primary Citation & Trust Anchor Integrity Audit', cmd: 'node scripts/verify_citation_links.js' },
    { name: '4/7: OKF Conformance Specification Suite', cmd: 'node conformance/test_conformance.js' },
    { name: '5/7: Package Export Linting (publint)', cmd: 'npx --yes publint' },
    { name: '6/7: TypeScript Export Resolution (@arethetypeswrong/cli)', cmd: 'npx --yes @arethetypeswrong/cli --pack . --profile esm-only' },
    { name: '7/7: Multi-Domain Ground Truth Regression Test Suite', cmd: 'node test.js' }
];

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log(' MUDRAFORGE STATUTORY — PREPUBLISH SUPPLY CHAIN VERIFICATION GATE');
console.log('═══════════════════════════════════════════════════════════════════════════');

for (const step of steps) {
    console.log(`\n[GATE] Executing [${step.name}]...`);
    try {
        execSync(step.cmd, { cwd: rootDir, stdio: 'inherit' });
    } catch (err) {
        console.error(`\n[FATAL] Prepublish verification gate failed at step [${step.name}]!`);
        console.error(`Publish aborted fail-closed. Reason: ${err.message}`);
        process.exit(1);
    }
}

console.log('\n═══════════════════════════════════════════════════════════════════════════');
console.log(' [GATE PASSED] ALL 5 SUPPLY-CHAIN INTEGRITY CHECKS VERIFIED.');
console.log(' Package is cryptographically verified and authorized for publication.');
console.log('═══════════════════════════════════════════════════════════════════════════\n');
process.exit(0);
