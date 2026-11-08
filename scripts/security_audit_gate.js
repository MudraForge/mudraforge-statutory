/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SECURITY AUDIT GATE (CodeQL & Supply-Chain Parity)
 * 
 * Local static security analysis gate running before commit, push, and release.
 * Detects CodeQL vulnerability anti-patterns and supply-chain policy violations:
 *   1. Zero runtime dependencies verification (Rule 12.4)
 *   2. Strict zero emojis enforcement (Rule 20)
 *   3. Incomplete URL substring sanitization (CodeQL js/incomplete-url-substring-sanitization)
 *   4. Polynomial regular expression / ReDoS vulnerabilities (CodeQL js/polynomial-redos)
 *   5. Disabling TLS certificate validation (CodeQL js/disabling-certificate-validation)
 *   6. Incomplete multi-character sanitization / bad tag filter (CodeQL js/bad-tag-filter)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    '.wrangler',
    'scratch',
    'dist'
]);

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

function walkFiles(dir, filterFn, acc = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(fullPath, filterFn, acc);
        } else if (filterFn(fullPath)) {
            acc.push(fullPath);
        }
    }
    return acc;
}

const violations = [];

function recordViolation(file, line, ruleId, severity, message, snippet) {
    violations.push({
        file: path.relative(rootDir, file).replace(/\\/g, '/'),
        line,
        ruleId,
        severity,
        message,
        snippet: snippet ? snippet.trim() : ''
    });
}

console.log('===========================================================================');
console.log(' MUDRAFORGE STATUTORY — STATIC SECURITY AUDIT GATE');
console.log('===========================================================================');

// 1. Zero Runtime Dependencies Audit (Rule 12.4)
console.log('\n[AUDIT 1/5] Verifying zero runtime dependencies in package.json...');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const runtimeDeps = Object.keys(pkg.dependencies || {});
if (runtimeDeps.length > 0) {
    recordViolation(
        pkgPath,
        1,
        'mf/zero-runtime-dependencies',
        'FATAL',
        `Package declares ${runtimeDeps.length} runtime dependencies: ${runtimeDeps.join(', ')}. Rule 12.4 mandates zero runtime dependencies.`,
        JSON.stringify(pkg.dependencies)
    );
}

// 2. Scan JavaScript files for CodeQL anti-patterns
console.log('[AUDIT 2/5] Scanning codebase for CodeQL vulnerability anti-patterns...');
const jsFiles = walkFiles(rootDir, (f) => f.endsWith('.js') || f.endsWith('.mjs'));

for (const file of jsFiles) {
    // Skip self-check to avoid matching audit regex definitions
    if (file === __filename) continue;

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Skip comments
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }

        // Check A: Incomplete URL substring sanitization (js/incomplete-url-substring-sanitization)
        // Flag .includes('domain.ext') or .indexOf('domain.ext') used for origin verification
        if (/\.(?:includes|indexOf)\(['"](?:github\.com|incometaxindia\.gov\.in|cbic\.gov\.in)['"]\)/.test(line)) {
            recordViolation(
                file,
                lineNum,
                'js/incomplete-url-substring-sanitization',
                'HIGH',
                'Incomplete URL substring sanitization. Substring match allows domain spoofing. Use anchored regex or URL hostname parsing.',
                line
            );
        }

        // Check B: Disabling certificate validation (js/disabling-certificate-validation)
        if (/rejectUnauthorized\s*:\s*false/.test(line) || /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/.test(line)) {
            recordViolation(
                file,
                lineNum,
                'js/disabling-certificate-validation',
                'HIGH',
                'TLS certificate validation disabled. Never set rejectUnauthorized: false in production or verification code.',
                line
            );
        }

        // Check C: Polynomial ReDoS unanchored leading whitespace with alternation & end-anchor (js/polynomial-redos)
        if (/\/\s*\\s\*(?:\?:|\()[^)]*\\.\?\$[gimyus]*/.test(line)) {
            recordViolation(
                file,
                lineNum,
                'js/polynomial-redos',
                'HIGH',
                'Unanchored leading whitespace in regex ending at dollar anchor creates O(n^2) polynomial backtracking. Use string suffix check instead.',
                line
            );
        }

        // Check D: Bad tag filter (js/bad-tag-filter)
        // Flag naive attempts to sanitize HTML via regex replace like str.replace(/<[^>]*>/g, '')
        if (/\.replace\(\/\s*<[^>]*>\s*\/[gimyus]*\s*,\s*['"]['"]\)/.test(line) ||
            /\.replace\(\/\s*<.*?>\s*\/[gimyus]*\s*,\s*['"]['"]\)/.test(line)) {
            recordViolation(
                file,
                lineNum,
                'js/bad-tag-filter',
                'HIGH',
                'Naive HTML tag filtering regex replace is susceptible to bypass. Use structured sanitization or parser.',
                line
            );
        }
    }
}

// 3. Scan for Rule 20 Zero-Emoji Compliance across source files
console.log('[AUDIT 3/5] Verifying Rule 20 zero-emoji compliance across source files...');
const sourceFiles = walkFiles(rootDir, (f) => {
    return (f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.json')) &&
           !f.includes('.mudraforge') &&
           !f.includes('package-lock.json');
});

for (const file of sourceFiles) {
    if (file === __filename) continue;
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (EMOJI_REGEX.test(line)) {
            // Allow in test assertions that explicitly verify emoji rejection
            if (file.includes('test.js') && (line.includes('validateCommitMessage') || line.includes('Rule 20'))) {
                continue;
            }
            recordViolation(
                file,
                i + 1,
                'mf/rule-20-zero-emojis',
                'HIGH',
                'Emoji detected in source file. Rule 20 strictly prohibits emojis in all codebase files, comments, and messages.',
                line
            );
        }
    }
}

// 4. Verification Report
console.log('\n[AUDIT 4/5] Evaluating static security findings...');
if (violations.length > 0) {
    console.error(`\n[SECURITY FAILURE] ${violations.length} static security violation(s) detected:\n`);
    for (const v of violations) {
        console.error(`  [${v.severity}] ${v.ruleId} in ${v.file}:${v.line}`);
        console.error(`    Message: ${v.message}`);
        if (v.snippet) console.error(`    Snippet: ${v.snippet}`);
        console.error('');
    }
    console.error('Audit gate failed fail-closed. You must resolve all security violations before committing or pushing.\n');
    process.exit(1);
}

console.log('[AUDIT 5/5] Checking package-lock.json for known vulnerable transitive dependencies...');
const lockPath = path.join(rootDir, 'package-lock.json');
if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const packages = lock.packages || {};
    const vulnerable = [];
    for (const [pkgKey, pkgVal] of Object.entries(packages)) {
        if (pkgKey.includes('deepmerge') || pkgKey.includes('export-size')) {
            vulnerable.push(pkgKey);
        }
    }
    if (vulnerable.length > 0) {
        recordViolation(
            lockPath,
            1,
            'mf/vulnerable-transitive-dependency',
            'HIGH',
            `Vulnerable package detected in package-lock.json: ${vulnerable.join(', ')}`,
            ''
        );
        console.error(`[SECURITY FAILURE] Vulnerable packages found in lockfile: ${vulnerable.join(', ')}`);
        process.exit(1);
    }
}

console.log('\n===========================================================================');
console.log(' [PASS] ALL SECURITY AUDIT CHECKS PASSED (ZERO VULNERABILITIES DETECTED)');
console.log(' CodeQL anti-patterns, supply-chain invariants, and Rule 20 strictly satisfied.');
console.log('===========================================================================\n');
process.exit(0);
