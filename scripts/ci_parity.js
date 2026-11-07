/**
 * CI PARITY CHECKER
 * Mirrors the exact 10 steps executed by GitHub Actions CI (.github/workflows/ci.yml).
 * Ensures zero discrepancies between local development and remote CI.
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const steps = [
    { name: '1. Verify Cryptographic Manifest Integrity', cmd: 'node scripts/generate_manifest.js --check' },
    { name: '2. Validate OKF Schemas & Circulars', cmd: 'node scripts/validate_okf.js' },
    { name: '3. Verify Deep Citation Integrity', cmd: 'node scripts/verify_citation_links.js' },
    { name: '4. Run OKF Conformance Test Suite', cmd: 'node conformance/test_conformance.js' },
    { name: '5. Lint Package Exports (publint)', cmd: 'npx --yes publint' },
    { name: '6. Verify TypeScript Export Resolution (attw)', cmd: 'npx --yes @arethetypeswrong/cli --pack . --profile esm-only' },
    { name: '7. Generate and Verify Corpus Quality Card', cmd: 'node scripts/corpus_quality_report.js' },
    { name: '8. Verify End-to-End AP Execution Trace', cmd: 'node examples/simulate_end_to_end_trace.js' },
    { name: '9. Verify Documentation Links and Anchors', cmd: 'node scripts/verify_doc_links.js' },
    { name: '10. Run Multi-Domain Regression Test Suite', cmd: 'node test.js' }
];

console.log('===========================================================================');
console.log(' MUDRAFORGE STATUTORY — FULL LOCAL CI PARITY CHECKER');
console.log('===========================================================================');

for (const step of steps) {
    console.log(`\n[CI STEP] ${step.name}...`);
    try {
        execSync(step.cmd, { cwd: rootDir, stdio: 'inherit' });
    } catch (err) {
        console.error(`\n[FATAL] Local CI parity check failed at: ${step.name}`);
        console.error(`Process aborted fail-closed: ${err.message}`);
        process.exit(1);
    }
}

console.log('\n===========================================================================');
console.log(' [PASS] ALL 10 LOCAL CI PARITY STEPS COMPLETED SUCCESSFULLY.');
console.log('===========================================================================\n');
process.exit(0);
