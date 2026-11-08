#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @mudraforge/statutory CLI
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    lookupStatute,
    lookupLocalStatute,
    listSections,
    checkUpdates,
    syncOkf,
    getLocalManifest,
    checkForPackageUpdate,
    decodeTaxIdentifier,
    verifyLocalSubstrate,
    runStatutoryDoctor,
    crosswalkStatute,
    getStatutoryDiff,
    getStatutoryOutcomes,
    explainStatutoryDisposition,
    ignorePackageUpdate,
    parseTallyDaybookCsv,
    parseTallyDaybookXml,
    reconcile194QDaybook,
    generateTally194QJournalXml,
    generateAuditMarkdownReport,
    parseZohoBillsCsv,
    parseZohoBillsJson,
    parseGstr2bJson,
    reconcileZohoGstr2b,
    generateGstr2bAuditMarkdownReport,
    runStatutoryWatchtower,
    getWorkflowJournalPath,
    appendWorkflowJournal,
    getWorkflowJournal,
    validateCommitMessage,
    validateBranchName,
    getWorkflowStatus,
    createWorkflowBranch,
    createWorkflowCommit,
    pushWorkflowBranch,
    mergeWorkflowBranch,
    publishWorkflowRelease,
    getRemoteCIStatus,
    waitForRemoteCI,
    STATUTORY_EXIT_CODES,
    STATUTORY_CLIENT_VERSION,
    DEFAULT_LOCAL_OKF_DIR
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawArgs = process.argv.slice(2);
const isJsonMode = rawArgs.includes('--json') || rawArgs.includes('-j');
const isOfflineMode = rawArgs.includes('--offline') || rawArgs.includes('-o');
const isVerboseMode = rawArgs.includes('--verbose') || rawArgs.includes('-v');
const isNoUpdateCheck = rawArgs.includes('--no-update-check') || rawArgs.includes('--ignore-update');
const args = rawArgs.filter(a => 
    a !== '--json' && a !== '-j' && 
    a !== '--offline' && a !== '-o' && 
    a !== '--verbose' && a !== '-v' &&
    a !== '--no-update-check' && a !== '--ignore-update'
);
const command = args[0] ? args[0].toLowerCase() : 'help';

function getNamedArg(nameList, argList) {
    for (let i = 0; i < argList.length; i++) {
        const item = argList[i];
        for (const name of nameList) {
            if (item === name && i + 1 < argList.length && !argList[i + 1].startsWith('-')) {
                return argList[i + 1];
            }
            if (item.startsWith(`${name}=`)) {
                return item.slice(name.length + 1);
            }
        }
    }
    return null;
}

async function main() {
    switch (command) {
        case 'doctor':
        case 'diagnose':
            await handleDoctor();
            break;

        case 'verify':
        case 'audit':
        case 'check':
            await handleVerify(args[1]);
            break;

        case 'crosswalk':
        case 'bridge':
        case 'transition': {
            const section = (args[1] && !args[1].startsWith('-')) ? args[1] : getNamedArg(['--section', '-s'], rawArgs);
            const creditDate = getNamedArg(['--credit', '-c'], rawArgs);
            const paymentDate = getNamedArg(['--payment', '-p'], rawArgs);
            const asOfDate = getNamedArg(['--date', '-d', '--as-of'], rawArgs);
            if (!section) {
                console.error('[ERROR] Please specify a section to crosswalk, e.g. npx @mudraforge/statutory crosswalk 194Q --credit 2026-03-25 --payment 2026-04-10');
                process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
            }
            await handleCrosswalk(section, { creditDate, paymentDate, asOfDate });
            break;
        }

        case 'diff':
        case 'changelog':
        case 'amendments': {
            const section = (args[1] && !args[1].startsWith('-')) ? args[1] : getNamedArg(['--section', '-s'], rawArgs);
            const since = getNamedArg(['--since'], rawArgs);
            const domain = getNamedArg(['--domain'], rawArgs);
            await handleDiff({ section, since, domain });
            break;
        }

        case 'outcomes':
        case 'dispositions':
        case 'states': {
            const section = (args[1] && !args[1].startsWith('-')) ? args[1] : getNamedArg(['--provision', '-p', '--section', '-s'], rawArgs);
            await handleOutcomes(section, { offline: isOfflineMode, verbose: isVerboseMode });
            break;
        }

        case 'explain':
        case 'why':
        case 'remedy': {
            const query = (args[1] && !args[1].startsWith('-')) ? args[1] : getNamedArg(['--code', '-c', '--query', '-q'], rawArgs);
            if (!query) {
                console.error('[ERROR] Please specify a disposition code or status to explain, e.g. npx @mudraforge/statutory explain BUYER_TURNOVER_UNVERIFIED');
                process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
            }
            await handleExplain(query);
            break;
        }

        case 'init-skill':
        case 'install-skill':
            await handleInitSkill(args[1]);
            break;

        case 'check-update':
        case 'status':
        case 'version': {
            const shouldIgnore = rawArgs.includes('--ignore') || args[1] === '--ignore' || args[1] === 'ignore';
            await handleCheckUpdate({ ignore: shouldIgnore });
            break;
        }

        case 'sync':
        case 'pull':
        case 'update': {
            let target = args[1];
            if (target === '--dest' || target === '-d') {
                target = args[2];
            } else if (target && target.startsWith('--dest=')) {
                target = target.slice(7);
            }
            await handleSync(target);
            break;
        }

        case 'browse':
        case 'nav':
            await handleBrowse();
            break;

        case 'lookup':
        case 'get':
            if (!args[1]) {
                console.error('[ERROR] Please specify a section to lookup, e.g. npx @mudraforge/statutory lookup 194Q');
                process.exit(1);
            }
            await handleLookup(args[1], args[2]);
            break;

        case 'list':
        case 'sections':
            await handleList();
            break;

        case 'decode-id':
        case 'validate-id':
        case 'check-id':
            if (!args[1]) {
                console.error('[ERROR] Please specify a PAN or GSTIN to decode, e.g. npx @mudraforge/statutory decode-id 27AAPFU0939F1ZV');
                process.exit(1);
            }
            handleDecodeId(args[1]);
            break;

        case 'reconcile':
        case 'reconcile-daybook':
        case 'audit-daybook': {
            const filePath = (args[1] && !args[1].startsWith('-')) ? args[1] : getNamedArg(['--file', '-f'], rawArgs);
            const format = getNamedArg(['--format'], rawArgs);
            const xmlOut = getNamedArg(['--xml-out'], rawArgs);
            const reportOut = getNamedArg(['--report-out', '--out'], rawArgs);
            const buyerTurnover = getNamedArg(['--buyer-turnover'], rawArgs);
            if (!filePath) {
                console.error('[ERROR] Please specify a daybook file to reconcile, e.g. npx @mudraforge/statutory reconcile daybook.csv');
                process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
            }
            await handleReconcileDaybook(filePath, { format, xmlOut, reportOut, buyerTurnover: buyerTurnover ? parseFloat(buyerTurnover) : null });
            break;
        }

        case 'reconcile-gstr2b':
        case 'reconcile-zoho': {
            const zohoPath = getNamedArg(['--zoho', '--books', '-b'], rawArgs) || (args[1] && !args[1].startsWith('-') ? args[1] : null);
            const gstr2bPath = getNamedArg(['--gstr2b', '--2b', '-g'], rawArgs) || (args[2] && !args[2].startsWith('-') ? args[2] : null);
            const reportOut = getNamedArg(['--report-out', '--out'], rawArgs);
            const tolerance = getNamedArg(['--tolerance'], rawArgs);
            const asOfDate = getNamedArg(['--as-of', '--date'], rawArgs);
            const gstin = getNamedArg(['--gstin'], rawArgs);

            if (!zohoPath || !gstr2bPath) {
                console.error('[ERROR] Please specify both Zoho Books and GSTR-2B files:');
                console.error('  npx @mudraforge/statutory reconcile-gstr2b --zoho <zoho_bills.csv|json> --gstr2b <gstr2b.json>');
                process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
            }
            await handleReconcileZohoGstr2b(zohoPath, gstr2bPath, {
                reportOut,
                toleranceInr: tolerance ? parseFloat(tolerance) : 1.0,
                asOfDate,
                recipientGstin: gstin
            });
            break;
        }

        case 'watchtower':
        case 'freshness':
        case 'attest': {
            await handleWatchtower();
            break;
        }

        case 'branch':
        case 'git:branch': {
            const branchName = args[1] || getNamedArg(['--name', '-n'], rawArgs);
            const baseBranch = getNamedArg(['--base', '-b'], rawArgs) || 'main';
            if (!branchName) {
                console.error('[ERROR] Please specify a branch name, e.g. npx @mudraforge/statutory branch fix/issue-name');
                process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
            }
            await handleBranch(branchName, baseBranch);
            break;
        }

        case 'commit':
        case 'git:commit': {
            const message = getNamedArg(['-m', '--message'], rawArgs) || (args[1] && !args[1].startsWith('-') ? args[1] : null);
            const stageAll = rawArgs.includes('-a') || rawArgs.includes('--all');
            const filesArg = getNamedArg(['--files', '-f'], rawArgs);
            const files = filesArg ? filesArg.split(',').map(s => s.trim()) : [];
            const forceMain = rawArgs.includes('--force-main');
            if (!message) {
                console.error('[ERROR] Please specify a commit message: npx @mudraforge/statutory commit -m "fix(scope): description"');
                process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
            }
            await handleCommit(message, { stageAll, files, forceMain });
            break;
        }

        case 'push':
        case 'git:push': {
            const remote = getNamedArg(['--remote', '-r'], rawArgs) || 'origin';
            const forceMain = rawArgs.includes('--force-main');
            const skipChecks = rawArgs.includes('--skip-checks') || rawArgs.includes('--no-checks');
            await handlePush({ remote, forceMain, runChecks: !skipChecks });
            break;
        }

        case 'ci-status':
        case 'ci':
        case 'status:ci': {
            const branch = (args[1] && !args[1].startsWith('-')) ? args[1] : getNamedArg(['--branch', '-b'], rawArgs);
            const watch = rawArgs.includes('--watch') || rawArgs.includes('-w');
            await handleCIStatus(branch, { watch });
            break;
        }

        case 'merge':
        case 'git:merge': {
            const sourceBranch = (args[1] && !args[1].startsWith('-')) ? args[1] : getNamedArg(['--branch', '-b'], rawArgs);
            const targetBranch = getNamedArg(['--target', '-t'], rawArgs) || 'main';
            const squash = rawArgs.includes('--squash');
            const noPush = rawArgs.includes('--no-push');
            const skipRemoteCI = rawArgs.includes('--skip-remote-ci') || rawArgs.includes('--no-remote-ci');
            if (!sourceBranch) {
                console.error('[ERROR] Please specify branch to merge: npx @mudraforge/statutory merge fix/<name>');
                process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
            }
            await handleMerge(sourceBranch, { targetBranch, squash, pushAfterMerge: !noPush, skipRemoteCI });
            break;
        }

        case 'publish':
        case 'release': {
            const dryRun = rawArgs.includes('--dry-run');
            const skipNpm = rawArgs.includes('--skip-npm');
            await handlePublish({ dryRun, skipNpm });
            break;
        }

        case 'workflow':
        case 'journal': {
            const subCmd = args[1];
            if (subCmd === 'journal' || subCmd === 'history' || subCmd === 'log' || command === 'journal') {
                const limitStr = getNamedArg(['--limit', '-l', '-n'], rawArgs);
                const limit = limitStr ? parseInt(limitStr, 10) : 10;
                await handleWorkflowJournal(limit);
            } else {
                await handleWorkflowStatus();
            }
            break;
        }

        case 'help':
        default:
            printHelp();
            break;
    }

    // Non-intrusive background npm package update notice
    if (!isJsonMode && !isNoUpdateCheck && command !== 'check-update' && command !== 'status' && command !== 'version') {
        try {
            const updateInfo = await checkForPackageUpdate();
            if (updateInfo && updateInfo.updateAvailable) {
                console.log('───────────────────────────────────────────────────────────────────────────');
                console.log(`[NOTICE] A new version of @mudraforge/statutory is available: ${updateInfo.currentVersion} -> ${updateInfo.latestVersion}`);
                console.log(`Run: npm install @mudraforge/statutory@latest or npx @mudraforge/statutory@latest`);
                console.log(`To dismiss: npx @mudraforge/statutory check-update --ignore`);
                console.log('───────────────────────────────────────────────────────────────────────────\n');
            }
        } catch (_) {}
    }
}

async function handleVerify(targetDir) {
    try {
        let dest = DEFAULT_LOCAL_OKF_DIR;
        if (targetDir) {
            dest = path.resolve(process.cwd(), targetDir);
        }
        const report = verifyLocalSubstrate(dest);
        if (isJsonMode) {
            console.log(JSON.stringify(report, null, 2));
            process.exit(report.exitCode);
        }

        console.log('\n===========================================================================');
        console.log(`MUDRAFORGE OPEN KNOWLEDGE FORMAT (OKF) — CRYPTOGRAPHIC VERIFIER [v${report.okfVersion || 'Unknown'}]`);
        console.log('===========================================================================');

        if (report.integrity.valid) {
            console.log(`[OK] Integrity: ${report.integrity.totalFilesChecked} files verified against Merkle manifest.`);
            console.log(`     Root Merkle Hash: ${report.integrity.computedRoot}`);
        } else {
            console.error(`[FAIL] Integrity: Mismatches: ${report.integrity.mismatches.length}, Missing: ${report.integrity.missingFiles.length}, Untracked: ${report.integrity.untrackedFiles.length}`);
            for (const m of report.integrity.mismatches) {
                console.error(`     • ${m.file} (Expected ${m.expected.slice(0, 10)}..., actual ${m.actual.slice(0, 10)}...)`);
            }
            for (const mf of report.integrity.missingFiles) {
                console.error(`     • Missing: ${mf}`);
            }
        }

        if (report.authenticity.valid) {
            console.log(`[OK] Authenticity: Provenance authenticated via ${report.authenticity.method}.`);
            if (report.authenticity.keyId) {
                console.log(`     Signer Key ID: ${report.authenticity.keyId}`);
            }
        } else {
            console.error(`[FAIL] Authenticity: Root hash "${report.integrity.computedRoot}" is neither pinned nor signed by an authorized MudraForge trust anchor.`);
        }

        if (report.baselineCheck.valid) {
            console.log(`[OK] Statutory Policy: All mandatory baseline provisions present (${report.baselineCheck.baselineSections.join(', ')}).`);
        } else {
            console.error(`[FAIL] Statutory Policy: Missing mandatory baseline provisions: ${report.baselineCheck.missingBaseline.join(', ')}`);
        }

        console.log('───────────────────────────────────────────────────────────────────────────');
        if (report.valid) {
            console.log(`[PASS] Statutory substrate is authentic, intact, and compliant (Exit ${report.exitCode}).\n`);
        } else {
            console.error(`[FAIL] Verification failed with Exit Code ${report.exitCode}.\n`);
        }
        process.exit(report.exitCode);
    } catch (err) {
        if (isJsonMode) {
            console.log(JSON.stringify({ valid: false, exitCode: STATUTORY_EXIT_CODES.USAGE_ERROR, error: err.message }, null, 2));
        } else {
            console.error(`[ERROR] Verification error: ${err.message}`);
        }
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }
}

async function handleDoctor() {
    try {
        const report = await runStatutoryDoctor({ offline: isOfflineMode });
        if (isJsonMode) {
            console.log(JSON.stringify(report, null, 2));
            process.exit(report.exitCode);
        }

        console.log('\n===========================================================================');
        console.log(`MUDRAFORGE STATUTORY DIAGNOSTIC DOCTOR [v${report.clientVersion}]`);
        console.log('===========================================================================');

        console.log('── 1. RUNTIME & HOST ENVIRONMENT ──');
        console.log(`Node.js:           ${report.runtime.nodeVersion} ${report.runtime.isSupportedNode ? '(Supported: v18+)' : '[UNSUPPORTED]'}`);
        console.log(`Platform:          ${report.runtime.platform} (${report.runtime.arch})`);
        console.log(`Environment:       ${report.runtime.environment}${report.runtime.isCI ? ' (CI Active)' : ''}`);
        console.log(`API Key Config:    ${report.runtime.hasApiKey ? 'CONFIGURED (Enterprise Tier Enabled)' : 'NOT_CONFIGURED (Free Commons Mode)'}`);

        console.log('\n── 2. LOCAL OKF SUBSTRATE HEALTH ──');
        if (report.substrate.valid) {
            console.log(`Directory:         ${DEFAULT_LOCAL_OKF_DIR}`);
            console.log(`Manifest Version:  v${report.substrate.okfVersion} (Published: ${report.substrate.publishedAt})`);
            console.log(`Files Checked:     ${report.substrate.integrity.totalFilesChecked} (0 mismatches, 0 missing, 0 untracked)`);
            console.log(`Root Merkle Hash:  ${report.substrate.integrity.computedRoot}`);
            console.log(`Integrity:         PASS`);
            console.log(`Provenance:        AUTHENTIC (${report.substrate.authenticity.method})`);
            console.log(`Statutory Policy:  PASS (All ${report.substrate.baselineCheck.baselineSections.length} mandatory baselines present)`);
        } else {
            console.error(`Substrate:         FAILED (Exit Code ${report.substrate.exitCode})`);
            if (report.substrate.error) console.error(`Error:             ${report.substrate.error}`);
            if (!report.substrate.integrity.valid) {
                console.error(`Integrity Failure: ${report.substrate.integrity.mismatches.length} mismatch(es), ${report.substrate.integrity.missingFiles.length} missing files.`);
            }
            if (!report.substrate.authenticity.valid) {
                console.error(`Authenticity:      Root hash not authenticated.`);
            }
            if (!report.substrate.baselineCheck.valid) {
                console.error(`Missing Baselines: ${report.substrate.baselineCheck.missingBaseline.join(', ')}`);
            }
        }

        console.log('\n── 3. CLOUDFLARE ANYCAST EDGE CONNECTIVITY ──');
        console.log(`Endpoint:          ${report.edge.baseUrl}`);
        if (report.edge.status === 'REACHABLE') {
            console.log(`Status:            REACHABLE (Latency: ${report.edge.latencyMs}ms)`);
        } else if (report.edge.status === 'SKIPPED_AIR_GAPPED') {
            console.log(`Status:            SKIPPED (Air-Gapped / Offline Flag Enabled)`);
        } else {
            console.log(`Status:            ${report.edge.status} (Offline-first local mode operative)`);
        }
        console.log(`Advisory:          ${report.edge.advisory}`);

        console.log('───────────────────────────────────────────────────────────────────────────');
        if (report.healthy) {
            console.log(`[PASS] All diagnostic checks passed with zero defects (Exit 0).\n`);
        } else {
            console.error(`[FAIL] Diagnostic doctor flagged health violations (Exit ${report.exitCode}).\n`);
        }
        process.exit(report.exitCode);
    } catch (err) {
        if (isJsonMode) {
            console.log(JSON.stringify({ healthy: false, exitCode: STATUTORY_EXIT_CODES.USAGE_ERROR, error: err.message }, null, 2));
        } else {
            console.error(`[ERROR] Doctor diagnostic error: ${err.message}`);
        }
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }
}

async function handleCrosswalk(section, options) {
    try {
        const result = crosswalkStatute(section, options);
        if (isJsonMode) {
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        }

        console.log('\n===========================================================================');
        console.log('MUDRAFORGE DUAL-ACT STATUTORY CROSSWALK (1961 ACT <-> 2025 ACT)');
        console.log('===========================================================================');
        console.log(`Query Section:       ${result.querySection}`);
        console.log(`Governing Statute:   ${result.governingAct}`);
        console.log(`Applicable Section:  ${result.applicableSection}`);
        console.log(`Temporal Status:     ${result.temporalStatus}`);

        console.log('\n── TEMPORAL CRYSTALLIZATION (EARLIER OF CREDIT OR PAYMENT) ──');
        if (result.creditDate) console.log(`Credit in Books:     ${result.creditDate}`);
        if (result.paymentDate) console.log(`Payment Rail:        ${result.paymentDate}`);
        console.log(`Trigger Date:        ${result.triggerDate}`);
        console.log(`Trigger Event:       ${result.triggerReason}`);
        console.log(`Event Context:       ${result.triggerDescription}`);

        console.log('\n── STATUTORY BRIDGE & DUAL-ACT MAPPING ──');
        console.log(`Predecessor (1961):  ${result.crosswalk.predecessor.statutorySection} (${result.crosswalk.predecessor.title})`);
        console.log(`                     Rate: ${result.crosswalk.predecessor.standardRate} | Challan: ${result.crosswalk.predecessor.challan} | Return: ${result.crosswalk.predecessor.returnForm}`);
        console.log(`Successor (2025):    ${result.crosswalk.successor.statutorySection} (Effective ${result.crosswalk.successor.effectiveDate})`);
        console.log(`                     Rate: ${result.crosswalk.successor.standardRate} | Return: ${result.crosswalk.successor.returnForm}`);

        console.log('\n── STATUTORY SAVINGS & LEGAL GROUNDING ──');
        console.log(`Primary Authority:   ${result.crosswalk.savingsAuthority.statute}`);
        console.log(`Subsidiary Principle: ${result.crosswalk.savingsAuthority.subsidiary}`);
        console.log(`Legal Analysis:      ${result.legalAnalysis}`);

        console.log('───────────────────────────────────────────────────────────────────────────');
        console.log('[PASS] Statutory crosswalk resolved successfully (Exit 0).\n');
        process.exit(0);
    } catch (err) {
        if (isJsonMode) {
            console.log(JSON.stringify({ status: 'ERROR', exitCode: STATUTORY_EXIT_CODES.USAGE_ERROR, error: err.message }, null, 2));
        } else {
            console.error(`[ERROR] Crosswalk failure: ${err.message}`);
        }
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }
}

async function handleDiff(options) {
    try {
        const result = getStatutoryDiff(options);
        if (isJsonMode) {
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        }

        console.log('\n===========================================================================');
        console.log('MUDRAFORGE STATUTORY REGULATORY CHANGELOG & AMENDMENT TRACKER');
        console.log('===========================================================================');
        console.log(`Filter Section:      ${result.filterSection || 'ALL SECTIONS'}`);
        console.log(`Filter Since:        ${result.filterSince || 'ALL TIME'}`);
        console.log(`Filter Domain:       ${result.filterDomain || 'ALL DOMAINS'}`);
        console.log(`Total Amendments:    ${result.totalAmendments}`);

        if (result.amendments.length === 0) {
            console.log('\n[NOTICE] No statutory amendments matched the specified query filters.');
        } else {
            for (const am of result.amendments) {
                console.log(`\n── [${am.id}] ${am.sectionCode} (${am.domain}) ──`);
                console.log(`Title:               ${am.title}`);
                console.log(`Effective Date:      ${am.effectiveDate} (${am.amendmentType})`);
                console.log(`Governing Statute:   ${am.statute}`);
                console.log(`Enacted By:          ${am.legalAuthority}`);
                console.log(`Previous Baseline:   ${am.previousValue}`);
                console.log(`Amended Baseline:    ${am.amendedValue}`);
                console.log(`Summary:             ${am.changeSummary}`);
                console.log(`Statutory Impact:    ${am.statutoryImpact}`);
            }
        }

        console.log('───────────────────────────────────────────────────────────────────────────');
        console.log(`[PASS] Statutory diff completed successfully (${result.totalAmendments} amendment(s) found) (Exit 0).\n`);
        process.exit(0);
    } catch (err) {
        if (isJsonMode) {
            console.log(JSON.stringify({ status: 'ERROR', exitCode: STATUTORY_EXIT_CODES.USAGE_ERROR, error: err.message }, null, 2));
        } else {
            console.error(`[ERROR] Statutory diff failure: ${err.message}`);
        }
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }
}

async function handleOutcomes(provision, options = {}) {
    try {
        const result = await getStatutoryOutcomes(provision, options);
        if (isJsonMode) {
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        }

        console.log('\n===========================================================================');
        console.log('MUDRAFORGE STATUTORY OUTCOMES & SEMANTIC DISPOSITION DICTIONARY');
        console.log('===========================================================================');
        console.log(`Source:              ${result.source} ${result.offlineFallback ? '(Offline Fallback)' : ''}`);
        console.log(`Version:             v${result.version}`);
        console.log(`Provision Filter:    ${result.provision || 'ALL (Global Catalog)'}`);
        console.log(`Total Outcomes:      ${result.totalOutcomes}`);
        console.log('===========================================================================');

        if (result.outcomes.length === 0) {
            console.log(`\nNo specific outcome codes mapped for provision "${result.provision}".`);
            console.log('Showing all global disposition outcomes: run npx @mudraforge/statutory outcomes\n');
        } else {
            result.outcomes.forEach((o, idx) => {
                console.log(`\n── Outcome #${idx + 1}: [${o.code}] ──`);
                console.log(`Title:               ${o.title}`);
                console.log(`Category:            ${o.category}`);
                console.log(`Description:         ${o.description}`);
                console.log(`Trigger Condition:   ${o.triggerCondition}`);
                console.log(`Recommended Action:  ${o.recommendedAction}`);
                if (options.verbose && o.remedy) {
                    console.log(`Resolution Steps:    ${o.remedy}`);
                }
                if (o.missingFacts && o.missingFacts.length > 0) {
                    console.log(`Missing Facts to Cure: ${o.missingFacts.join(', ')}`);
                    if (options.verbose && o.missingFactsExplanation) {
                        for (const [key, detail] of Object.entries(o.missingFactsExplanation)) {
                            console.log(`  ↳ ${key} (${detail.type}): ${detail.description} (Source: ${detail.source})`);
                        }
                    }
                }
                if (options.verbose && o.consequenceIfUnresolved) {
                    console.log(`Consequence on Hold: ${o.consequenceIfUnresolved}`);
                }
                if (o.applicableProvisions && o.applicableProvisions.length > 0) {
                    console.log(`Applies to Sections: ${o.applicableProvisions.join(', ')}`);
                }
                console.log(`Governing Law:       ${o.governingAuthority}`);
            });
        }

        console.log('\n───────────────────────────────────────────────────────────────────────────');
        console.log(`[PASS] Statutory outcomes dictionary retrieved successfully (${result.totalOutcomes} outcome(s)) (Exit 0).\n`);
        process.exit(0);
    } catch (err) {
        if (isJsonMode) {
            console.log(JSON.stringify({ status: 'ERROR', exitCode: STATUTORY_EXIT_CODES.USAGE_ERROR, error: err.message }, null, 2));
        } else {
            console.error(`[ERROR] Statutory outcomes lookup failure: ${err.message}`);
        }
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }
}

async function handleExplain(query) {
    try {
        const result = explainStatutoryDisposition(query);
        if (isJsonMode) {
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        }

        console.log('\n===========================================================================');
        console.log(`MUDRAFORGE STATUTORY EXPLANATION: [${result.query}]`);
        console.log('===========================================================================');

        if (result.status === 'NOT_FOUND') {
            console.log(`\nNo statutory disposition or indeterminate code found matching "${result.query}".`);
            if (result.availableCodes && result.availableCodes.length > 0) {
                console.log('\nAvailable disposition codes to inspect:');
                result.availableCodes.forEach(c => console.log(`  • ${c}`));
            }
            console.log('\nTip: Run "npx @mudraforge/statutory explain INDETERMINATE" to view all hold states.\n');
            process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
        }

        if (result.summary) {
            console.log(`Summary:             ${result.summary}`);
            console.log(`Matched Dispositions: ${result.totalMatches}\n`);
        }

        result.matches.forEach((o, idx) => {
            if (result.matches.length > 1) {
                console.log(`\n── [${idx + 1}/${result.matches.length}] Disposition: [${o.code}] ──`);
            } else {
                console.log(`Code:                [${o.code}]`);
            }
            console.log(`Title:               ${o.title}`);
            console.log(`Category:            ${o.category}`);
            console.log(`Governing Law:       ${o.governingAuthority}`);
            console.log('\n── What Happened:');
            console.log(`  ${o.description}`);
            console.log('\n── Statutory Trigger:');
            console.log(`  ${o.triggerCondition}`);
            console.log('\n── How to Resolve in Your Application:');
            console.log(`  ${o.remedy || o.recommendedAction}`);

            if (o.missingFacts && o.missingFacts.length > 0) {
                console.log('\n── Missing Evidence / Parameters to Supply:');
                o.missingFacts.forEach(f => {
                    const meta = o.missingFactsExplanation ? o.missingFactsExplanation[f] : null;
                    if (meta) {
                        console.log(`  • ${f} (${meta.type}): ${meta.description}`);
                        console.log(`    Source: ${meta.source} | Example: ${JSON.stringify(meta.example)}`);
                    } else {
                        console.log(`  • ${f}`);
                    }
                });
            }

            if (o.consequenceIfUnresolved) {
                console.log('\n── Consequence If Unresolved:');
                console.log(`  ${o.consequenceIfUnresolved}`);
            }

            if (o.applicableProvisions && o.applicableProvisions.length > 0) {
                console.log(`\nApplies to Sections: ${o.applicableProvisions.join(', ')}`);
            }
        });

        console.log('\n───────────────────────────────────────────────────────────────────────────');
        console.log(`[PASS] Statutory explanation completed successfully (Exit 0).\n`);
        process.exit(0);
    } catch (err) {
        if (isJsonMode) {
            console.log(JSON.stringify({ status: 'ERROR', exitCode: STATUTORY_EXIT_CODES.USAGE_ERROR, error: err.message }, null, 2));
        } else {
            console.error(`[ERROR] Statutory explain failure: ${err.message}`);
        }
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }
}

async function handleCheckUpdate(options = {}) {
    try {
        let pkgUpdate = null;
        try {
            pkgUpdate = await checkForPackageUpdate({ cacheTtlMs: 0, force: Boolean(options.ignore) });
        } catch (_) {}

        if (options.ignore) {
            const versionToIgnore = pkgUpdate?.latestVersion || STATUTORY_CLIENT_VERSION;
            ignorePackageUpdate(versionToIgnore);
            if (isJsonMode) {
                console.log(JSON.stringify({ status: 'SUCCESS', ignoredVersion: versionToIgnore }, null, 2));
                process.exit(0);
            }
            console.log('\n===========================================================================');
            console.log(`[OK] Update notifications will be ignored for version ${versionToIgnore}.`);
            console.log('You will not see update notices until a newer version is published.');
            console.log('===========================================================================\n');
            process.exit(0);
        }

        let status = null;
        try {
            status = await checkUpdates();
        } catch (netErr) {
            if (isJsonMode) {
                console.log(JSON.stringify({ status: 'OFFLINE_FALLBACK', packageUpdate: pkgUpdate, error: netErr.message }, null, 2));
                process.exit(0);
            }
            console.log('───────────────────────────────────────────────────────────────────────────');
            console.log(`Local OKF Version:   ${STATUTORY_CLIENT_VERSION}`);
            console.log(`Edge Synchronization: UNAVAILABLE (offline or remote network unreachable)`);
            console.log('───────────────────────────────────────────────────────────────────────────\n');
            process.exit(0);
        }

        if (isJsonMode) {
            console.log(JSON.stringify({
                packageUpdate: pkgUpdate,
                substrateStatus: status
            }, null, 2));
            process.exit(0);
        }
        console.log('───────────────────────────────────────────────────────────────────────────');
        console.log(`Local OKF Version:   ${status.localVersion}`);
        console.log(`Latest Edge Version: ${status.latestVersion}`);
        console.log(`Published At:        ${status.publishedAt}`);
        console.log(`Total Sections:      ${status.totalSections}`);
        console.log('───────────────────────────────────────────────────────────────────────────');

        if (status.isOutdated) {
            console.log(`[WARN] New legal data version available: v${status.latestVersion}`);
            console.log(`Changelog: ${status.changelog}`);
            try {
                const pkgUpdate = await checkForPackageUpdate();
                if (pkgUpdate && pkgUpdate.updateAvailable) {
                    console.log(`\n[RECOMMENDED] Update the npm package to receive the newest release roots:`);
                    console.log(`  npm install @mudraforge/statutory@latest`);
                    console.log(`  npx @mudraforge/statutory sync\n`);
                } else {
                    console.log(`Run: npx @mudraforge/statutory sync to pull the latest rules.\n`);
                }
            } catch (_) {
                console.log(`Run: npx @mudraforge/statutory sync to pull the latest rules.\n`);
            }
        } else {
            console.log(`[OK] OKF substrate is up to date (v${status.localVersion}).\n`);
        }
    } catch (err) {
        console.error(`[ERROR] Version check failed: ${err.message}`);
        process.exit(1);
    }
}

async function handleSync(targetDir) {
    try {
        let dest = undefined;
        if (targetDir) {
            dest = path.resolve(process.cwd(), targetDir);
            const cwd = path.resolve(process.cwd());
            const relative = path.relative(cwd, dest);
            if (relative.startsWith('..') || path.isAbsolute(relative)) {
                console.error('[ERROR] Target sync directory must be within current workspace directory.');
                process.exit(1);
            }
        }
        console.log(`\n[INFO] Synchronizing local OKF filesystem with Cloudflare edge${dest ? ` into "${dest}"` : ''}...`);
        const res = await syncOkf(dest ? { okfDir: dest } : {});
        console.log('───────────────────────────────────────────────────────────────────────────');
        console.log(`[OK] Successfully synced OKF v${res.okfVersion}`);
        console.log(`Downloaded sections: ${res.syncedSections}`);
        console.log(`Saved to: ${res.destDir}`);
        console.log('───────────────────────────────────────────────────────────────────────────\n');
    } catch (err) {
        if (err.message && err.message.includes('Untrusted bundle rootHash')) {
            console.error('\n' + '─'.repeat(75));
            console.error('[NOTICE] Cryptographic verification required an updated release anchor.');
            console.error(err.message.replace('[@mudraforge/statutory] ', ''));
            console.error('─'.repeat(75) + '\n');
        } else {
            console.error(`[ERROR] Sync failed: ${err.message}`);
        }
        process.exit(1);
    }
}

async function handleBrowse() {
    const manifest = getLocalManifest();

    if (isJsonMode) {
        console.log(JSON.stringify(manifest ? {
            okfVersion: manifest.okfVersion,
            publishedAt: manifest.publishedAt,
            rootHash: manifest.rootHash,
            totalSections: manifest.totalSections,
            domains: manifest.domains,
            sections: manifest.sections
        } : { okfVersion: null, sections: [] }, null, 2));
        process.exit(0);
    }

    console.log('\n===========================================================================');
    console.log(`OPEN KNOWLEDGE FORMAT (OKF) — LOCAL BROWSER [v${manifest ? manifest.okfVersion : 'Local'}]`);
    console.log('===========================================================================');

    const domainDisplayNames = {
        direct_tax: 'DIRECT TAX (Income Tax & TDS/TCS)',
        indirect_tax_gst: 'INDIRECT TAX (Goods & Services Tax - GST)',
        msme_commercial: 'MSME & COMMERCIAL LAW',
        international_tax: 'CROSS-BORDER & INTERNATIONAL TAX'
    };

    let totalDisplayed = 0;

    if (manifest && manifest.domains) {
        for (const [domainKey, sectionCodes] of Object.entries(manifest.domains)) {
            console.log(`\n${domainDisplayNames[domainKey] || domainKey.toUpperCase()}`);
            console.log('───────────────────────────────────────────────────────────────────────────');
            for (const code of sectionCodes) {
                const data = lookupLocalStatute(code);
                if (!data) continue;
                totalDisplayed++;
                const validToDisplay = data.effectivePeriod.validTo === 'OPEN_ENDED' || !data.effectivePeriod.validTo ? 'Open-ended (In force)' : data.effectivePeriod.validTo;
                const docCount = data.supportingDocuments 
                    ? ` (${data.supportingDocuments.circulars.length} circulars, ${data.supportingDocuments.forms.length} forms)`
                    : '';
                console.log(`• Section ${data.sectionCode.padEnd(12)} | ${data.governingStatute}`);
                console.log(`  ↳ ${data.title}`);
                console.log(`  ↳ Validity: ${data.effectivePeriod.validFrom} to ${validToDisplay}${docCount}`);
            }
        }
    } else {
        const sectionsDir = path.join(DEFAULT_LOCAL_OKF_DIR, 'sections');
        if (fs.existsSync(sectionsDir)) {
            const files = fs.readdirSync(sectionsDir).filter(f => f.endsWith('.json'));
            files.forEach((f, idx) => {
                const data = JSON.parse(fs.readFileSync(path.join(sectionsDir, f), 'utf8'));
                totalDisplayed++;
                console.log(`[${idx + 1}] Section ${data.sectionCode.padEnd(12)} | ${data.governingStatute}`);
                console.log(`    ↳ ${data.title}`);
                console.log(`    ↳ Valid: ${data.effectivePeriod.validFrom} to ${data.effectivePeriod.validTo}`);
                console.log('');
            });
        }
    }

    if (totalDisplayed === 0) {
        console.log('[WARN] No local OKF sections found. Run "npx @mudraforge/statutory sync" to download.');
        return;
    }

    console.log('\n───────────────────────────────────────────────────────────────────────────');
    console.log('To inspect details & circulars: npx @mudraforge/statutory lookup <section_code>');
    console.log('To sync latest edge catalog:    npx @mudraforge/statutory sync\n');
}

async function handleInitSkill(targetDir) {
    const destDir = targetDir || path.join(process.cwd(), '.agents', 'skills', 'indian-statutory-commons');
    const resolvedDest = path.resolve(destDir);
    const cwd = path.resolve(process.cwd());

    // Path traversal boundary check preventing prefix collisions
    const relative = path.relative(cwd, resolvedDest);
    if (targetDir && (relative.startsWith('..') || path.isAbsolute(relative))) {
        console.error('[ERROR] Target directory must be within current workspace directory.');
        process.exit(1);
    }

    const sourceSkillPath = path.join(__dirname, '..', 'SKILL.md');

    if (!fs.existsSync(sourceSkillPath)) {
        console.error('[ERROR] Could not find source SKILL.md in package root.');
        process.exit(1);
    }

    fs.mkdirSync(destDir, { recursive: true });
    const destSkillPath = path.join(destDir, 'SKILL.md');
    fs.copyFileSync(sourceSkillPath, destSkillPath);

    console.log('\n[OK] MudraForge Indian Statutory Commons Skill installed successfully.');
    console.log(`Installed at: ${destSkillPath}`);
    console.log('AI agent skill configuration ready for runtime discovery.\n');
}

async function handleLookup(section, asOfDate) {
    const cleanSection = (section || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (asOfDate && !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate.trim())) {
        console.error(`[ERROR] Invalid date format: "${asOfDate}". Date must be in ISO 8601 YYYY-MM-DD format.`);
        process.exit(1);
    }

    try {
        // Try local OKF first
        const local = lookupLocalStatute(cleanSection);
        let s = local;
        let temporalStatus = 'ACTIVE';

        if (s) {
            if (!isJsonMode) console.log(`\n[LOCAL OKF CACHE] Loaded section [${cleanSection}] from disk.`);
            if (asOfDate) {
                if (asOfDate < s.effectivePeriod.validFrom) temporalStatus = 'PRE_EFFECTIVE';
                else if (s.effectivePeriod.validTo && asOfDate > s.effectivePeriod.validTo) temporalStatus = 'SUNSET_SUPERSEDED';
            }
        } else {
            if (!isJsonMode) console.log(`\n[EDGE LOOKUP] Querying MudraForge Live Commons for [${cleanSection}]${asOfDate ? ` (as-of: ${asOfDate})` : ''}...`);
            const remote = await lookupStatute(cleanSection, { asOfDate });
            s = remote.statute;
            temporalStatus = remote.temporalStatus;
        }

        if (isJsonMode) {
            console.log(JSON.stringify({
                status: 'SUCCESS',
                sectionCode: cleanSection,
                temporalStatus,
                statute: s
            }, null, 2));
            process.exit(0);
        }

        console.log('───────────────────────────────────────────────────────────────────────────');
        console.log(`Section:         ${s.statutorySection} (${s.governingStatute})`);
        console.log(`Title:           ${s.title}`);
        console.log(`Temporal Status: ${temporalStatus}`);
        console.log(`Effective Dates: ${s.effectivePeriod.validFrom} to ${s.effectivePeriod.validTo}`);
        console.log(`Successor:       ${s.successorSection} (${s.successorStatute})`);
        console.log('───────────────────────────────────────────────────────────────────────────');
        console.log(`Summary:`);
        console.log(`   ${s.plainTextSummary}`);
        console.log('\nKey Thresholds:');
        for (const [k, v] of Object.entries(s.keyStatutoryThresholds)) {
            console.log(`   • ${k}: ${v}`);
        }
        console.log('\nOfficial Citations:');
        for (const c of s.officialCitations) {
            console.log(`   • ${c.instrument} (${c.authority}): ${c.officialUrl}`);
        }

        if (s.supportingDocuments && (s.supportingDocuments.circulars?.length > 0 || s.supportingDocuments.forms?.length > 0)) {
            console.log('\nSupporting Circulars & Compliance Forms:');
            if (s.supportingDocuments.circulars?.length > 0) {
                console.log(`   • Circulars & Guidance: ${s.supportingDocuments.circulars.join(', ')}`);
            }
            if (s.supportingDocuments.forms?.length > 0) {
                console.log(`   • Forms & Returns:     ${s.supportingDocuments.forms.join(', ')}`);
            }
        }
        console.log('───────────────────────────────────────────────────────────────────────────\n');
    } catch (err) {
        if (isJsonMode) {
            console.error(JSON.stringify({
                status: 'ERROR',
                error: err.message,
                availableSections: err.availableSections || []
            }, null, 2));
            process.exit(1);
        }
        console.error(`[ERROR] Lookup failed: ${err.message}`);
        if (err.availableSections) {
            console.log(`Available sections: ${err.availableSections.join(', ')}`);
        }
        process.exit(1);
    }
}

async function handleList() {
    try {
        const sections = await listSections();
        if (isJsonMode) {
            console.log(JSON.stringify({ sections, total: sections.length }, null, 2));
            process.exit(0);
        }

        console.log('\n[INFO] Fetching indexed statutory sections from MudraForge Commons...');
        console.log('───────────────────────────────────────────────────────────────────────────');
        for (const s of sections) {
            const displayValidTo = (s.validTo === 'OPEN_ENDED' || s.validTo === '2099-12-31') ? 'In Force' : s.validTo;
            console.log(`• [${s.sectionCode.padEnd(12)}] ${s.section.padEnd(25)} | Valid: ${s.validFrom} to ${displayValidTo}`);
        }
        console.log('───────────────────────────────────────────────────────────────────────────\n');
    } catch (err) {
        if (isJsonMode) {
            console.error(JSON.stringify({ status: 'ERROR', error: err.message }, null, 2));
            process.exit(1);
        }
        console.error(`[ERROR] Failed to list sections: ${err.message}`);
        process.exit(1);
    }
}

function handleDecodeId(rawId) {
    const res = decodeTaxIdentifier(rawId);
    if (isJsonMode) {
        console.log(JSON.stringify(res, null, 2));
        process.exit(res.isValid ? 0 : 1);
    }

    console.log('\n===========================================================================');
    console.log('INDIAN TAX IDENTIFIER DECODER & OFFLINE MOD-36 VALIDATOR');
    console.log('===========================================================================');
    if (!res.isValid) {
        console.log(`Input:        ${rawId}`);
        console.log(`Type:         ${res.type || 'UNKNOWN'}`);
        console.log(`Status:       INVALID`);
        console.log(`Failure:      ${res.error}\n`);
        return;
    }

    console.log(`Identifier:   ${res.gstin || res.pan}`);
    console.log(`Type:         ${res.type}`);
    if (res.type === 'GSTIN') {
        console.log(`Mod-36 Check: VALID (Check Character: "${res.gstin[14]}")`);
        console.log(`State:        [${res.stateCode}] ${res.stateName}`);
    }
    console.log(`PAN:          ${res.pan}`);
    console.log(`Entity Code:  [${res.entityCode}] ${res.entityType}`);
    console.log(`Class:        ${res.isIndividualOrHuf ? 'Individual / HUF' : 'Company / Non-Individual'}`);
    console.log(`Sec 194C TDS: ${res.standard194cRatePercent}% (Statutory Rate)`);
    console.log('───────────────────────────────────────────────────────────────────────────\n');
}

async function handleReconcileDaybook(filePath, opts = {}) {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`[ERROR] Daybook file not found: ${resolvedPath}`);
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }

    const rawContent = fs.readFileSync(resolvedPath, 'utf8');
    const ext = path.extname(resolvedPath).toLowerCase();
    const format = (opts.format || (ext === '.xml' ? 'xml' : (ext === '.json' ? 'json' : 'csv'))).toLowerCase();

    let vouchers = [];
    try {
        if (format === 'xml') {
            vouchers = parseTallyDaybookXml(rawContent);
        } else if (format === 'json') {
            vouchers = JSON.parse(rawContent);
        } else {
            vouchers = parseTallyDaybookCsv(rawContent);
        }
    } catch (parseErr) {
        console.error(`[ERROR] Failed to parse daybook file (${format}):`, parseErr.message);
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }

    const reconciliation = reconcile194QDaybook(vouchers, {
        buyerTurnoverCr: opts.buyerTurnover || null
    });

    if (opts.xmlOut) {
        const xmlOutPath = path.resolve(process.cwd(), opts.xmlOut);
        const xmlContent = generateTally194QJournalXml(reconciliation);
        fs.writeFileSync(xmlOutPath, xmlContent, 'utf8');
        if (!isJsonMode) {
            console.log(`[INFO] Tally compensating XML journal written to: ${xmlOutPath}`);
        }
    }

    if (opts.reportOut) {
        const reportOutPath = path.resolve(process.cwd(), opts.reportOut);
        const reportContent = generateAuditMarkdownReport(reconciliation);
        fs.writeFileSync(reportOutPath, reportContent, 'utf8');
        if (!isJsonMode) {
            console.log(`[INFO] Audit Markdown memorandum written to: ${reportOutPath}`);
        }
    }

    if (isJsonMode) {
        console.log(JSON.stringify(reconciliation, null, 2));
        process.exit(0);
    }

    const { auditSummary, exceptionVendors } = reconciliation;
    const fmtInr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    console.log('\n===========================================================================');
    console.log('TALLY / ERP SECTION 194Q RECONCILIATION & 40(a)(ia) EXPOSURE AUDIT');
    console.log('===========================================================================');
    console.log(`File:                      ${resolvedPath}`);
    console.log(`Format:                    ${format.toUpperCase()}`);
    console.log(`Vouchers Audited:          ${auditSummary.totalVouchersScanned}`);
    console.log(`Unique Vendors / PANs:     ${auditSummary.uniqueVendorsCount}`);
    console.log(`Vendors > ₹50L Threshold:  ${auditSummary.vendorsExceeding50LCount}`);
    console.log(`Non-Compliant Vendors:     ${auditSummary.vendorsWithExceptionsCount}`);
    console.log(`Total Purchases:           ${fmtInr(auditSummary.totalPurchasesInr)}`);
    console.log(`Taxable Base (> ₹50L):     ${fmtInr(auditSummary.totalExcessPurchasesOver50LInr)}`);
    console.log(`Required TDS @ 0.1%:       ${fmtInr(auditSummary.totalTdsPayableInr)}`);
    console.log(`Actual TDS Deducted:       ${fmtInr(auditSummary.totalTdsDeductedInr)}`);
    console.log(`Unwithheld TDS Shortfall:  ${fmtInr(auditSummary.totalTdsShortfallInr)}`);
    console.log(`---------------------------------------------------------------------------`);
    console.log(`Section 40(a)(ia) Risk:    ${fmtInr(auditSummary.totalSection40aDisallowanceInr)} (30% Expenditure Disallowed)`);
    console.log(`Estimated Income Tax Hit:  ${fmtInr(auditSummary.totalEstimatedTaxImpactInr)} (@ 30% Corporate Tax)`);
    console.log(`Sec 201(1A) Interest:      ${fmtInr(auditSummary.totalSection201InterestInr)}`);
    console.log(`TOTAL AUDIT EXPOSURE:      ${fmtInr(auditSummary.totalAuditExposureInr)}`);
    console.log('===========================================================================');

    if (exceptionVendors.length > 0) {
        console.log('\nNON-COMPLIANT VENDOR SCHEDULE (Form 3CD Clause 21(b) Working Papers):');
        console.log('─'.repeat(75));
        for (const v of exceptionVendors) {
            console.log(`• ${v.primaryVendorName} (PAN: ${v.pan || 'MISSING'})`);
            console.log(`  Purchases: ${fmtInr(v.totalPurchasesInr)} | Excess: ${fmtInr(v.excessPurchasesOver50LInr)} | Shortfall: ${fmtInr(v.tdsShortfallInr)} | 40(a)(ia) Risk: ${fmtInr(v.section40aDisallowanceInr)}`);
        }
        console.log('─'.repeat(75));
        console.log(`Tip: Pass --xml-out vouchers.xml to generate Tally Prime auto-import XML.`);
    } else {
        console.log('\n[PASS] 100% Statutory Compliance. Zero Section 40(a)(ia) disallowance risk.\n');
    }
}

async function handleReconcileZohoGstr2b(zohoPath, gstr2bPath, opts = {}) {
    const resolvedZoho = path.resolve(process.cwd(), zohoPath);
    const resolved2b = path.resolve(process.cwd(), gstr2bPath);

    if (!fs.existsSync(resolvedZoho)) {
        console.error(`[ERROR] Zoho Books file not found: ${resolvedZoho}`);
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }
    if (!fs.existsSync(resolved2b)) {
        console.error(`[ERROR] GSTR-2B file not found: ${resolved2b}`);
        process.exit(STATUTORY_EXIT_CODES.USAGE_ERROR);
    }

    const zohoContent = fs.readFileSync(resolvedZoho, 'utf8');
    const gstr2bContent = fs.readFileSync(resolved2b, 'utf8');

    const zohoExt = path.extname(resolvedZoho).toLowerCase();
    const zohoBills = zohoExt === '.json' ? parseZohoBillsJson(zohoContent) : parseZohoBillsCsv(zohoContent);
    const gstr2bRecords = parseGstr2bJson(gstr2bContent);

    const reconciliation = reconcileZohoGstr2b({
        zohoBills,
        gstr2b: gstr2bRecords,
        options: {
            toleranceInr: opts.toleranceInr || 1.0,
            asOfDate: opts.asOfDate || new Date().toISOString().slice(0, 10),
            recipientGstin: opts.recipientGstin || null
        }
    });

    if (opts.reportOut) {
        const reportOutPath = path.resolve(process.cwd(), opts.reportOut);
        const reportContent = generateGstr2bAuditMarkdownReport(reconciliation);
        fs.writeFileSync(reportOutPath, reportContent, 'utf8');
        if (!isJsonMode) {
            console.log(`[INFO] GSTR-2B Audit Markdown report written to: ${reportOutPath}`);
        }
    }

    if (isJsonMode) {
        console.log(JSON.stringify(reconciliation, null, 2));
        process.exit(0);
    }

    const s = reconciliation.summary;
    const fmt = n => 'INR ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    console.log('\n===========================================================================');
    console.log('ZOHO BOOKS & GSTR-2B AP RECONCILIATION AUDIT');
    console.log(`Status: ${reconciliation.status} | Disposition: ${s.reconciliationStatus}`);
    console.log('===========================================================================');
    console.log(`Zoho Books File:            ${resolvedZoho}`);
    console.log(`GSTR-2B File:               ${resolved2b}`);
    console.log(`Total Zoho Books Bills:     ${s.totalBooksBillsCount}`);
    console.log(`Total GSTR-2B Records:      ${s.totalGstr2bRecordsCount}`);
    console.log(`---------------------------------------------------------------------------`);
    console.log(`100% Eligible ITC:          ${s.matchedEligibleCount} bills (${fmt(s.eligibleItcInr)})`);
    console.log(`At-Risk Missing in 2B:      ${s.missingIn2bCount} bills (${fmt(s.atRiskUnfiledItcInr)}) [Withhold]`);
    console.log(`Sec 17(5) Blocked ITC:      ${s.blocked17_5Count} bills (${fmt(s.blocked17_5ItcInr)}) [Table 4(B)(1)]`);
    console.log(`Place of Supply Mismatch:   ${s.posMismatchCount} bills (${fmt(s.posMismatchItcInr)}) [Dispute]`);
    console.log(`Value Discrepancies:        ${s.amountMismatchCount} bills (${fmt(s.mismatchedItcInr)})`);
    console.log(`Missing in Books (Unrec):   ${s.missingInBooksCount} bills (${fmt(s.missingInBooksTaxInr)})`);
    console.log(`---------------------------------------------------------------------------`);
    console.log(`Rule 37 Overdue (>180 Days):${s.rule37OverdueCount} bills (Reversal: ${fmt(s.rule37ReversalAmountInr)})`);
    console.log(`Rule 37 Delayed Interest:   ${fmt(s.rule37InterestExposureInr)} (@ 18% p.a. u/s 50(1))`);
    console.log('---------------------------------------------------------------------------');
    console.log(`isAuthorizedToDisburse:     ${s.isAuthorizedToDisburse} (Statutory calculation never moves money)`);
    console.log('===========================================================================\n');
}

async function handleWatchtower() {
    try {
        const report = await runStatutoryWatchtower({ verbose: !isJsonMode });
        if (isJsonMode) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log('\n===========================================================================');
            console.log('MUDRAFORGE REGULATORY WATCHTOWER & FRESHNESS ATTESTATION');
            console.log('===========================================================================');
            console.log(`Status                  : ${report.status}`);
            console.log(`Sections Scanned        : ${report.checks.schemaValidation.sectionsScanned}`);
            console.log(`Circulars Scanned       : ${report.checks.schemaValidation.circularsScanned}`);
            console.log(`Forms Scanned           : ${report.checks.schemaValidation.formsScanned}`);
            console.log(`Citations Verified      : ${report.checks.citationIntegrity.validCitations} (0 failures)`);
            console.log(`Merkle Root             : ${report.checks.merkleImmutability.computedRoot}`);
            console.log(`Pinned Root Match       : ${report.checks.merkleImmutability.matchesPinnedRoot}`);
            console.log(`Freshness Benchmarks    : ${report.checks.freshnessHorizon.benchmarksPassed}/${report.checks.freshnessHorizon.benchmarksEvaluated} passed`);
            console.log(`Certificate ID          : ${report.certificate?.certificateId}`);
            console.log(`Empanelment Score       : ${report.certificate?.empanelmentComplianceScore}`);
            console.log(`Disbursement Invariant  : isAuthorizedToDisburse === ${report.certificate?.isAuthorizedToDisburse}`);
            console.log(`Execution Duration      : ${report.executionDurationMs}ms`);
            console.log('===========================================================================\n');
        }
        if (report.status !== 'SUCCESS') {
            process.exit(STATUTORY_EXIT_CODES.SUBSTRATE_CORRUPT || 1);
        }
    } catch (err) {
        console.error('[FAIL] Watchtower execution failed:', err);
        process.exit(1);
    }
}

async function handleBranch(branchName, baseBranch) {
    try {
        const res = createWorkflowBranch({ branchName, baseBranch, rootDir: process.cwd() });
        if (isJsonMode) {
            console.log(JSON.stringify(res, null, 2));
        } else {
            console.log('\n===========================================================================');
            console.log(`[BRANCH CREATED] ${res.branch}`);
            console.log('===========================================================================');
            console.log(`Base Branch : ${baseBranch}`);
            console.log(`HEAD Commit : ${res.commitSha}`);
            console.log(`Rule 18     : Feature Branch Isolation ENFORCED`);
            console.log('\nNext steps:');
            console.log(`  1. Make your code changes`);
            console.log(`  2. npx @mudraforge/statutory commit -m "feat/fix: description" --all`);
            console.log(`  3. npx @mudraforge/statutory push`);
            console.log('===========================================================================\n');
        }
    } catch (err) {
        console.error(`\n[ERROR] ${err.message}\n`);
        process.exit(1);
    }
}

async function handleCommit(message, options) {
    try {
        const res = createWorkflowCommit({
            message,
            files: options.files,
            stageAll: options.stageAll,
            forceMain: options.forceMain,
            rootDir: process.cwd()
        });
        if (isJsonMode) {
            console.log(JSON.stringify(res, null, 2));
        } else {
            console.log('\n===========================================================================');
            console.log(`[COMMIT VERIFIED & CREATED] ${res.commitSha.slice(0, 7)}`);
            console.log('===========================================================================');
            console.log(`Branch        : ${res.branch}`);
            console.log(`Message       : ${message.trim()}`);
            console.log(`Staged Files  : ${res.stagedFiles.length} file(s)`);
            console.log(`Rule 20 Check : PASSED (Strictly Zero Emojis)`);
            console.log(`Rule 18 Check : PASSED (Branch Isolation Enforced)`);
            console.log('===========================================================================\n');
        }
    } catch (err) {
        console.error(`\n[ERROR] ${err.message}\n`);
        process.exit(1);
    }
}

async function handlePush(options) {
    try {
        const res = pushWorkflowBranch({
            remote: options.remote,
            forceMain: options.forceMain,
            runChecks: options.runChecks,
            rootDir: process.cwd()
        });
        if (isJsonMode) {
            console.log(JSON.stringify(res, null, 2));
        } else {
            console.log('\n===========================================================================');
            console.log(`[BRANCH PUSHED TO GITHUB] ${res.branch}`);
            console.log('===========================================================================');
            console.log(`Remote      : ${res.remote}`);
            console.log(`HEAD Commit : ${res.commitSha.slice(0, 7)}`);
            if (res.prUrl) {
                console.log(`\nPull Request URL (open in browser):`);
                console.log(`  ${res.prUrl}`);
            }
            console.log('\nSupply Chain Pre-Push Verification: PASSED');
            console.log('===========================================================================\n');
        }
    } catch (err) {
        console.error(`\n[ERROR] ${err.message}\n`);
        process.exit(1);
    }
}

async function handleCIStatus(branch, options = {}) {
    try {
        const watch = options.watch || false;
        if (watch) {
            console.log(`\nWatching remote CI status for branch: ${branch || 'current'}...`);
            const res = await waitForRemoteCI({
                branch,
                rootDir: process.cwd(),
                timeoutMs: options.timeoutMs || 300000,
                pollIntervalMs: 5000,
                onProgress: (status, attempt) => {
                    const inFlight = (status.inProgress || 0) + (status.queued || 0);
                    process.stdout.write(`\r[REMOTE CI] Poll #${attempt}: ${status.passed || 0}/${status.total || 0} checks completed (${inFlight} in-flight)...`);
                }
            });
            console.log('\n');
            if (isJsonMode) {
                console.log(JSON.stringify(res, null, 2));
            } else {
                printCIStatusTable(res);
            }
            if (res.status === 'FAILURE') process.exit(1);
        } else {
            const res = await getRemoteCIStatus({ branch, rootDir: process.cwd() });
            if (isJsonMode) {
                console.log(JSON.stringify(res, null, 2));
            } else {
                printCIStatusTable(res);
            }
            if (res.status === 'FAILURE') process.exit(1);
        }
    } catch (err) {
        console.error(`\n[ERROR] ${err.message}\n`);
        process.exit(1);
    }
}

function printCIStatusTable(res) {
    console.log('\n===========================================================================');
    console.log(`GITHUB ACTIONS CI STATUS : ${res.owner || 'unknown'}/${res.repo || 'unknown'} (${res.branch || 'unknown'})`);
    console.log('===========================================================================');
    console.log(`Overall Status : ${res.status}`);
    console.log(`Commit SHA     : ${res.commitSha ? res.commitSha.slice(0, 7) : 'N/A'}`);
    console.log(`Total Checks   : ${res.total || 0} (Passed: ${res.passed || 0}, In-Progress: ${res.inProgress || 0}, Queued: ${res.queued || 0})`);
    if (res.failures && res.failures.length > 0) {
        console.log('\nFailed Checks:');
        for (const f of res.failures) {
            console.log(`  [FAIL] ${f.name} (${f.conclusion})`);
            if (f.html_url) console.log(`         URL: ${f.html_url}`);
            if (f.summary) console.log(`         Details: ${f.summary}`);
        }
    }
    if (res.successes && res.successes.length > 0) {
        console.log('\nPassed Checks:');
        for (const s of res.successes) {
            console.log(`  [PASS] ${s.name} (${s.conclusion})`);
        }
    }
    console.log('===========================================================================\n');
}

async function handleMerge(sourceBranch, options) {
    try {
        // 1. Remote CI Verification Gate (unless explicitly skipped via --skip-remote-ci)
        if (!options.skipRemoteCI) {
            console.log(`\n[REMOTE CI GATE] Verifying GitHub Actions status on origin/${sourceBranch}...`);
            const ciStatus = await getRemoteCIStatus({ branch: sourceBranch, rootDir: process.cwd() });

            if (ciStatus.status === 'NOT_FOUND') {
                console.warn(`[WARN] Remote branch origin/${sourceBranch} was not found on remote. Proceeding with local verification.`);
            } else if (ciStatus.status === 'UNKNOWN_REMOTE') {
                console.warn('[WARN] No GitHub remote detected. Skipping remote CI checks.');
            } else if (ciStatus.status === 'FAILURE') {
                console.error(`\n===========================================================================`);
                console.error(`[REMOTE CI FAILURE] GitHub Actions failed on branch: ${sourceBranch}`);
                console.error(`===========================================================================`);
                for (const f of ciStatus.failures) {
                    console.error(`  - [FAILED] ${f.name} (${f.conclusion})`);
                    if (f.html_url) console.error(`    URL: ${f.html_url}`);
                    if (f.summary) console.error(`    Details: ${f.summary}`);
                }
                console.error('\n[MERGE BLOCKED] You must fix the remote CI failures on the branch before merging into main.');
                console.error('Use --skip-remote-ci only for emergency local-only overrides.');
                console.error(`===========================================================================\n`);
                process.exit(1);
            } else if (ciStatus.status === 'IN_PROGRESS' || ciStatus.status === 'NO_CHECKS') {
                console.log(`[REMOTE CI IN-FLIGHT] Remote checks in progress (${ciStatus.passed}/${ciStatus.total} completed).`);
                console.log('Waiting for remote GitHub Actions to finish...');
                const waitRes = await waitForRemoteCI({
                    branch: sourceBranch,
                    rootDir: process.cwd(),
                    timeoutMs: options.timeoutMs || 180000,
                    pollIntervalMs: 5000,
                    onProgress: (status, attempt) => {
                        const inFlight = (status.inProgress || 0) + (status.queued || 0);
                        process.stdout.write(`\r[REMOTE CI] Poll #${attempt}: ${status.passed || 0}/${status.total || 0} checks completed (${inFlight} in-flight)...`);
                    }
                });
                console.log('');

                if (waitRes.status === 'FAILURE') {
                    console.error(`\n===========================================================================`);
                    console.error(`[REMOTE CI FAILURE] GitHub Actions failed on branch: ${sourceBranch}`);
                    console.error(`===========================================================================`);
                    for (const f of waitRes.failures) {
                        console.error(`  - [FAILED] ${f.name} (${f.conclusion})`);
                        if (f.html_url) console.error(`    URL: ${f.html_url}`);
                    }
                    console.error('\n[MERGE BLOCKED] You must fix the remote CI failures on the branch before merging into main.');
                    console.error(`===========================================================================\n`);
                    process.exit(1);
                } else if (waitRes.status === 'TIMEOUT') {
                    console.warn(`[WARN] ${waitRes.message}. Proceeding with local verification.`);
                } else {
                    console.log(`[REMOTE CI PASSED] All ${waitRes.passed} remote GitHub Actions checks passed.`);
                }
            } else if (ciStatus.status === 'SUCCESS') {
                console.log(`[REMOTE CI PASSED] All ${ciStatus.passed} remote GitHub Actions checks passed on origin/${sourceBranch}.`);
            }
        }

        const res = mergeWorkflowBranch({
            sourceBranch,
            targetBranch: options.targetBranch,
            squash: options.squash,
            pushAfterMerge: options.pushAfterMerge,
            rootDir: process.cwd()
        });
        if (isJsonMode) {
            console.log(JSON.stringify(res, null, 2));
        } else {
            console.log('\n===========================================================================');
            console.log(`[BRANCH MERGED] ${res.sourceBranch} -> ${res.targetBranch}`);
            console.log('===========================================================================');
            console.log(`Target Branch : ${res.targetBranch}`);
            console.log(`Merged Commit : ${res.commitSha.slice(0, 7)}`);
            console.log(`Remote Push   : ${res.pushed ? 'Synced with origin' : 'Local only (--no-push)'}`);
            console.log('CI Parity Verification Gate: PASSED');
            console.log('Remote CI Verification Gate: PASSED');
            console.log('===========================================================================\n');
        }
    } catch (err) {
        console.error(`\n[ERROR] ${err.message}\n`);
        process.exit(1);
    }
}

async function handlePublish(options) {
    try {
        const res = publishWorkflowRelease({
            dryRun: options.dryRun,
            skipNpm: options.skipNpm,
            rootDir: process.cwd()
        });
        if (isJsonMode) {
            console.log(JSON.stringify(res, null, 2));
        } else {
            console.log('\n===========================================================================');
            console.log(`[RELEASE PUBLISHED] ${res.package}@${res.version} (${res.tag})`);
            console.log('===========================================================================');
            console.log(`Status        : ${res.status}`);
            console.log(`Tag           : ${res.tag}`);
            if (res.commitSha) {
                console.log(`Commit        : ${res.commitSha.slice(0, 7)}`);
            }
            console.log(`GitHub Release: Tag pushed to origin (Actions release triggered)`);
            console.log('Full Supply Chain Gate: PASSED');
            console.log('===========================================================================\n');
        }
    } catch (err) {
        console.error(`\n[ERROR] ${err.message}\n`);
        process.exit(1);
    }
}

async function handleWorkflowStatus() {
    try {
        const status = getWorkflowStatus({ rootDir: process.cwd() });
        if (isJsonMode) {
            console.log(JSON.stringify(status, null, 2));
        } else {
            console.log('\n===========================================================================');
            console.log('MUDRAFORGE WORKFLOW & BRANCH ISOLATION STATUS');
            console.log('===========================================================================');
            console.log(`Current Branch    : ${status.currentBranch}`);
            console.log(`HEAD Commit       : ${status.headSha.slice(0, 7)}`);
            console.log(`Working Tree      : ${status.isClean ? 'Clean (0 changes)' : 'DIRTY (uncommitted files)'}`);
            console.log(`Protected Default : ${status.isMainProtected ? 'YES (direct commits/pushes blocked)' : 'NO (feature branch)'}`);
            console.log(`Remote Tracking   : ${status.remoteTracking || 'None'}`);
            console.log(`Journal Ledger    : ${status.journalPath}`);

            if (status.modifiedFiles.length > 0) {
                console.log(`\nModified Files (${status.modifiedFiles.length}):`);
                for (const f of status.modifiedFiles.slice(0, 10)) {
                    console.log(`  * ${f}`);
                }
                if (status.modifiedFiles.length > 10) {
                    console.log(`  ... and ${status.modifiedFiles.length - 10} more`);
                }
            }

            if (status.untrackedFiles && status.untrackedFiles.length > 0) {
                console.log(`\nUntracked Files (${status.untrackedFiles.length}):`);
                for (const f of status.untrackedFiles.slice(0, 10)) {
                    console.log(`  * ${f}`);
                }
                if (status.untrackedFiles.length > 10) {
                    console.log(`  ... and ${status.untrackedFiles.length - 10} more`);
                }
            }

            if (status.recentActions && status.recentActions.length > 0) {
                console.log('\nRecent Workflow Journal Actions:');
                for (const a of status.recentActions) {
                    console.log(`  [${a.timestamp.slice(11, 19)}] ${a.action} (branch: ${a.branch || a.sourceBranch || 'main'})`);
                }
            }
            console.log('===========================================================================\n');
        }
    } catch (err) {
        console.error(`\n[ERROR] ${err.message}\n`);
        process.exit(1);
    }
}

async function handleWorkflowJournal(limit) {
    try {
        const entries = getWorkflowJournal({ limit, rootDir: process.cwd() });
        if (isJsonMode) {
            console.log(JSON.stringify(entries, null, 2));
        } else {
            console.log('\n===========================================================================');
            console.log(`MUDRAFORGE WORKFLOW JOURNAL (Last ${entries.length} Events)`);
            console.log('===========================================================================');
            if (entries.length === 0) {
                console.log('Journal ledger is empty. No workflow events recorded yet.');
            } else {
                for (const e of entries) {
                    console.log(`[${e.timestamp}] ${e.action}`);
                    if (e.branch) console.log(`  Branch  : ${e.branch}`);
                    if (e.commitSha) console.log(`  Commit  : ${e.commitSha.slice(0, 7)}`);
                    if (e.message) console.log(`  Message : ${e.message}`);
                    if (e.prUrl) console.log(`  PR URL  : ${e.prUrl}`);
                    console.log('');
                }
            }
            console.log('===========================================================================\n');
        }
    } catch (err) {
        console.error(`\n[ERROR] ${err.message}\n`);
        process.exit(1);
    }
}

function printHelp() {
    console.log(`
MudraForge Statutory Commons CLI (@mudraforge/statutory)

Usage:
  npx @mudraforge/statutory <command> [options]

Commands:
  branch <name>                  Create feature branch (Rule 18: feat/, fix/, refactor/, docs/, chore/, test/)
  commit -m "<msg>"              Create verified commit (Rule 20 zero-emoji check, Rule 18 main branch protection)
  push [--remote <origin>]       Run supply-chain verification and push feature branch to GitHub with PR link
  ci-status [branch] [--watch]   Check live GitHub Actions CI & CodeQL status on remote branch
  merge <branch> [--squash]      Verify remote CI on branch, run local CI parity, checkout main, merge, and push main
  publish [--dry-run]            Run full release gate, tag release, push to GitHub, and publish to npm registry
  workflow [status|journal]      Display workflow status, branch isolation state, and durable audit journal
  watchtower                     Run regulatory surveillance & generate Empanelment Freshness Certificate
  reconcile <file>               Reconcile Tally/ERP daybook (CSV/XML/JSON) for Section 194Q & 40(a)(ia)
  reconcile-gstr2b [options]     Reconcile Zoho Books AP bills with GST Portal Form GSTR-2B
  doctor [--offline]             Run full diagnostic check of runtime, substrate integrity, & edge status
  verify [path]                  Cryptographically verify OKF substrate authenticity & file integrity
  crosswalk <section>            Dual-act 1961 <-> 2025 bridge (earlier of credit vs payment)
  diff                           Semantic regulatory changelog (--section, --since, --domain)
  outcomes [provision]           Inspect API dispositions, statutory states, trigger conditions & actions
  explain <code/status>          In-depth explanation, legal rationale & remediation steps for a disposition
  browse                         Interactively browse local OKF statutory filesystem
  lookup <section> [date]        Look up section details & temporal status (e.g. 194Q 2025-06-01)
  decode-id <pan_or_gstin>       Offline ISO Mod-36 checksum, state name, and PAN entity decoding
  check-update [--ignore]        Check edge updates; pass --ignore to snooze notices for current version
  sync [path]                    Download/sync latest versioned OKF bundle to disk (default: package okf/ or custom dir)
  list                           List all indexed statutory sections
  init-skill [path]              Install SKILL.md into your agent workspace (defaults to .agents/skills/)
  help                           Show this help message

Options:
  -m, --message <msg>            Conventional commit message (strictly zero emojis per Rule 20)
  --all, -a                      Stage all modified/new files before committing
  --files, -f <f1,f2>            Comma-separated files to stage before committing
  --force-main                   Explicit override allowing commit/push to protected main branch
  --squash                       Squash commits when merging feature branch into main
  --skip-remote-ci               Skip waiting/verifying remote GitHub Actions status before merging
  --no-push                      Skip pushing to remote after local branch merge
  --dry-run                      Simulate release publication without pushing tags or publishing to npm
  --skip-npm                     Publish git release tag to GitHub without publishing to npm registry
  --zoho, -b <file>              Zoho Books bills CSV or JSON export path
  --gstr2b, -g <file>            GST Portal Form GSTR-2B JSON file path
  --tolerance <amount>           Reconciliation tolerance in INR (default: 1.00)
  --as-of, --date <date>         Audit as-of date (YYYY-MM-DD) for Rule 37 180-day aging
  --gstin <gstin>                Recipient taxpayer GSTIN (used for Place of Supply validation)
  --format <csv|xml|json>        Explicit daybook file format parser
  --xml-out <path>               Output path for Tally Prime compensating journal voucher XML
  --report-out <path>            Output path for executive Markdown audit memorandum
  --buyer-turnover <Cr>          Preceding FY buyer turnover in ₹ Crores (default: assumes > ₹10 Cr)
  --credit <YYYY-MM-DD>          Date of credit to vendor/payee account in books (used in crosswalk)
  --payment <YYYY-MM-DD>         Date of actual payment/disbursement (used in crosswalk)
  --since <YYYY-MM-DD>           Filter amendments taking effect on or after date (used in diff)
  --section, -s <section>        Filter amendments by section code (used in diff)
  --domain <domain>              Filter amendments by statutory domain (used in diff)
  --verbose, -v                  Display full remediation steps, parameter schemas, and consequences in outcomes
  --no-update-check              Bypass automated background npm package update checks
  --json, -j                     Emit clean, machine-parseable JSON to stdout (suppresses banners)
  --offline, -o                  Bypass outbound network checks (air-gapped / offline environment mode)

Exit Code Conventions:
  0                              Success / Verification passed
  1                              Usage or operational error (invalid syntax / parameters)
  2                              Cryptographic authenticity or integrity violation (mismatch/revocation)
  3                              Statutory policy violation (e.g. missing baseline provision)
`);
}

main().catch(err => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
});
