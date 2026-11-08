/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MUDRAFORGE STATUTORY — SECURE WORKFLOW & GITHUB PUBLISHING ENGINE
 * ═══════════════════════════════════════════════════════════════════════════
 * Enforces Rule 18 (Feature Branch Isolation & GitHub Flow) and Rule 20 (Strictly Zero Emojis).
 * Controls, verifies, and journals every branch, commit, push, merge, and release through the CLI.
 *
 * Zero dependencies. Native ES Modules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');

export const ALLOWED_BRANCH_PREFIXES = [
    'feat/',
    'fix/',
    'refactor/',
    'docs/',
    'chore/',
    'test/',
    'ci/',
    'build/',
    'perf/'
];

export const CONVENTIONAL_COMMIT_PREFIXES = [
    'feat',
    'fix',
    'refactor',
    'docs',
    'chore',
    'test',
    'ci',
    'build',
    'perf'
];

export const EMOJI_DETECTION_RE = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

/**
 * Discovers the git root directory by walking upwards from a given path.
 *
 * @param {string} [startDir]
 * @returns {string}
 */
export function findGitRootDir(startDir = process.cwd()) {
    let current = path.resolve(startDir);
    while (true) {
        if (fs.existsSync(path.join(current, '.git'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
    }
    return DEFAULT_ROOT_DIR;
}

/**
 * Resolves the path to the durable MudraForge workflow journal.
 *
 * @param {string} [rootDir]
 * @returns {string}
 */
export function getWorkflowJournalPath(rootDir = DEFAULT_ROOT_DIR) {
    const dir = path.join(rootDir, '.mudraforge');
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (_) {}
    }
    return path.join(dir, 'workflow_journal.jsonl');
}

/**
 * Appends a verified workflow event to the durable journal.
 *
 * @param {Object} event
 * @param {Object} [options]
 * @returns {Object}
 */
export function appendWorkflowJournal(event, options = {}) {
    const rootDir = options.rootDir || DEFAULT_ROOT_DIR;
    const journalPath = getWorkflowJournalPath(rootDir);
    const entry = {
        timestamp: new Date().toISOString(),
        ...event
    };
    try {
        fs.appendFileSync(journalPath, JSON.stringify(entry) + '\n', 'utf8');
    } catch (err) {
        if (options.throwOnError) {
            throw err;
        }
    }
    return entry;
}

/**
 * Reads recent entries from the workflow journal in reverse chronological order.
 *
 * @param {Object} [options]
 * @param {number} [options.limit=20]
 * @param {string} [options.rootDir]
 * @returns {Array<Object>}
 */
export function getWorkflowJournal(options = {}) {
    const rootDir = options.rootDir || DEFAULT_ROOT_DIR;
    const journalPath = getWorkflowJournalPath(rootDir);
    if (!fs.existsSync(journalPath)) {
        return [];
    }
    try {
        const lines = fs.readFileSync(journalPath, 'utf8')
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);
        const limit = options.limit || 20;
        const entries = [];
        for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
            try {
                entries.push(JSON.parse(lines[i]));
            } catch (_) {}
        }
        return entries;
    } catch (_) {
        return [];
    }
}

/**
 * Validates a commit message against Rule 20 (Strictly Zero Emojis) and Conventional Commits.
 *
 * @param {string} message
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCommitMessage(message) {
    const errors = [];
    if (!message || typeof message !== 'string' || !message.trim()) {
        errors.push('Commit message must be a non-empty string.');
        return { valid: false, errors };
    }

    const trimmed = message.trim();

    // Rule 20: Strictly Zero Emojis check
    if (EMOJI_DETECTION_RE.test(trimmed)) {
        errors.push('[RULE 20 VIOLATION] Commit message contains forbidden emoji characters. Strictly zero emojis are permitted.');
    }

    // Conventional commits structure check
    const conventionalRe = new RegExp(`^(?:${CONVENTIONAL_COMMIT_PREFIXES.join('|')})(?:\\([a-z0-9_-]+\\))?:\\s+.+$`, 'i');
    if (!conventionalRe.test(trimmed)) {
        errors.push(`Commit message must follow Conventional Commits format (e.g., "feat: ...", "fix(deps): ...", "docs: ..."). Recognized prefixes: ${CONVENTIONAL_COMMIT_PREFIXES.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validates a branch name against Rule 18 (Feature Branch Isolation).
 *
 * @param {string} branchName
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBranchName(branchName) {
    const errors = [];
    if (!branchName || typeof branchName !== 'string' || !branchName.trim()) {
        errors.push('Branch name must be a non-empty string.');
        return { valid: false, errors };
    }

    const trimmed = branchName.trim();

    if (trimmed === 'main' || trimmed === 'master') {
        errors.push('[RULE 18 VIOLATION] Cannot create or switch to protected default branch directly. Use a feature branch.');
    }

    const hasAllowedPrefix = ALLOWED_BRANCH_PREFIXES.some(prefix => trimmed.startsWith(prefix));
    if (!hasAllowedPrefix) {
        errors.push(`[RULE 18 VIOLATION] Branch name "${trimmed}" must start with an approved prefix: ${ALLOWED_BRANCH_PREFIXES.join(', ')}`);
    }

    if (/[^a-zA-Z0-9_\-\.\/]/.test(trimmed)) {
        errors.push('Branch name contains invalid characters. Use alphanumeric characters, hyphens, slashes, or underscores.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Safe wrapper for executing git commands with captured stdout.
 */
function runGit(args, cwd) {
    const res = spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    if (res.status !== 0) {
        const msg = (res.stderr || res.stdout || 'Git command failed').trim();
        const err = new Error(msg);
        err.exitCode = res.status;
        throw err;
    }
    return (res.stdout || '').replace(/\r?\n$/, '');
}

/**
 * Retrieves the current workflow and git state of the repository.
 *
 * @param {Object} [options]
 * @param {string} [options.rootDir]
 * @returns {Object}
 */
export function getWorkflowStatus(options = {}) {
    const cwd = findGitRootDir(options.rootDir || process.cwd());
    let currentBranch = 'unknown';
    let headSha = 'unknown';
    let isClean = true;
    const modifiedFiles = [];
    const untrackedFiles = [];
    let remoteTracking = null;

    try {
        currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
        headSha = runGit(['rev-parse', 'HEAD'], cwd);
        const statusOutput = runGit(['status', '--porcelain'], cwd);
        if (statusOutput) {
            isClean = false;
            for (const line of statusOutput.split('\n')) {
                if (!line || !line.trim()) continue;
                const m = line.match(/^(.{2})\s+(.+)$/);
                if (m) {
                    const status = m[1].trim();
                    const file = m[2].trim();
                    if (status === '??') {
                        untrackedFiles.push(file);
                    } else {
                        modifiedFiles.push(file);
                    }
                }
            }
        }
        try {
            remoteTracking = runGit(['rev-parse', '--abbrev-ref', '@{u}'], cwd);
        } catch (_) {}
    } catch (err) {
        return {
            error: err.message,
            currentBranch,
            headSha,
            isClean: false,
            modifiedFiles,
            untrackedFiles,
            isMainProtected: false,
            remoteTracking: null,
            journalPath: getWorkflowJournalPath(cwd),
            recentActions: []
        };
    }

    const isMain = currentBranch === 'main' || currentBranch === 'master';
    const recentActions = getWorkflowJournal({ limit: 5, rootDir: cwd });

    return {
        currentBranch,
        headSha,
        isClean,
        modifiedFiles,
        untrackedFiles,
        isMainProtected: isMain,
        remoteTracking,
        journalPath: getWorkflowJournalPath(cwd),
        recentActions
    };
}

/**
 * Creates and checks out a new feature branch enforcing Rule 18 isolation.
 *
 * @param {Object} params
 * @param {string} params.branchName
 * @param {string} [params.baseBranch='main']
 * @param {string} [params.rootDir]
 * @returns {Object}
 */
export function createWorkflowBranch(params) {
    const { branchName, baseBranch = 'main' } = params;
    const cwd = findGitRootDir(params.rootDir || process.cwd());

    const validation = validateBranchName(branchName);
    if (!validation.valid) {
        throw new Error(`[@mudraforge/statutory] Branch creation failed:\n${validation.errors.join('\n')}`);
    }

    runGit(['checkout', '-b', branchName], cwd);
    const headSha = runGit(['rev-parse', 'HEAD'], cwd);

    const event = appendWorkflowJournal({
        action: 'BRANCH_CREATED',
        branch: branchName,
        baseBranch,
        commitSha: headSha,
        ruleChecked: 'Rule 18: Feature Branch Isolation'
    }, { rootDir: cwd });

    return {
        status: 'SUCCESS',
        branch: branchName,
        commitSha: headSha,
        journalEntry: event
    };
}

/**
 * Creates a commit enforcing Rule 20 (Zero Emojis), Rule 18 (No Direct Commits to Main),
 * and running automated pre-commit gates.
 *
 * @param {Object} params
 * @param {string} params.message
 * @param {string[]} [params.files]
 * @param {boolean} [params.stageAll=false]
 * @param {boolean} [params.forceMain=false]
 * @param {boolean} [params.skipPreCommitChecks=false]
 * @param {string} [params.rootDir]
 * @returns {Object}
 */
export function createWorkflowCommit(params) {
    const { message, files = [], stageAll = false, forceMain = false, skipPreCommitChecks = false } = params;
    const cwd = findGitRootDir(params.rootDir || process.cwd());

    // 1. Validate Commit Message (Rule 20)
    const msgValidation = validateCommitMessage(message);
    if (!msgValidation.valid) {
        throw new Error(`[@mudraforge/statutory] Commit blocked:\n${msgValidation.errors.join('\n')}`);
    }

    // 2. Enforce Rule 18 (No direct commits to main unless explicit override)
    const currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    if ((currentBranch === 'main' || currentBranch === 'master') && !forceMain && process.env.ALLOW_MAIN_COMMIT !== '1') {
        throw new Error(`[@mudraforge/statutory] [RULE 18 VIOLATION] Direct commit to "${currentBranch}" prohibited. You must create and checkout a feature branch first: npx statutory branch feat/<name> or fix/<name>.`);
    }

    // 3. Stage changes
    if (stageAll) {
        runGit(['add', '-A'], cwd);
    } else if (Array.isArray(files) && files.length > 0) {
        runGit(['add', ...files], cwd);
    }

    // Check if anything is staged
    const stagedCheck = runGit(['diff', '--cached', '--name-only'], cwd);
    if (!stagedCheck) {
        throw new Error('[@mudraforge/statutory] Commit aborted: No staged changes found. Use --all or specify files to stage.');
    }
    const stagedFileList = stagedCheck.split('\n').filter(Boolean);

    // 4. Run automated pre-commit verification gates
    if (!skipPreCommitChecks) {
        const manifestCheckScript = path.join(cwd, 'scripts', 'generate_manifest.js');
        if (fs.existsSync(manifestCheckScript)) {
            const manifestRes = spawnSync('node', [manifestCheckScript, '--check'], { cwd, encoding: 'utf8' });
            if (manifestRes.status !== 0) {
                throw new Error(`[@mudraforge/statutory] Pre-commit Merkle manifest verification failed:\n${manifestRes.stderr || manifestRes.stdout}`);
            }
        }
    }

    // 5. Execute commit
    runGit(['commit', '-m', message.trim()], cwd);
    const newHeadSha = runGit(['rev-parse', 'HEAD'], cwd);

    const event = appendWorkflowJournal({
        action: 'COMMIT_CREATED',
        branch: currentBranch,
        commitSha: newHeadSha,
        message: message.trim(),
        stagedFilesCount: stagedFileList.length,
        policyEnforced: {
            zeroEmojiRule20: true,
            branchIsolationRule18: true
        }
    }, { rootDir: cwd });

    return {
        status: 'SUCCESS',
        branch: currentBranch,
        commitSha: newHeadSha,
        stagedFiles: stagedFileList,
        journalEntry: event
    };
}

/**
 * Pushes a feature branch to remote GitHub origin, running supply chain gates and returning PR link.
 *
 * @param {Object} [params]
 * @param {string} [params.remote='origin']
 * @param {boolean} [params.forceMain=false]
 * @param {boolean} [params.runChecks=true]
 * @param {string} [params.rootDir]
 * @returns {Object}
 */
export function pushWorkflowBranch(params = {}) {
    const { remote = 'origin', forceMain = false, runChecks = true } = params;
    const cwd = findGitRootDir(params.rootDir || process.cwd());

    const currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    if ((currentBranch === 'main' || currentBranch === 'master') && !forceMain && process.env.ALLOW_MAIN_PUSH !== '1') {
        throw new Error(`[@mudraforge/statutory] [RULE 18 VIOLATION] Direct push to "${currentBranch}" prohibited. Feature branches must be pushed and reviewed via PR before merging into main.`);
    }

    // 1. Run supply-chain pre-push check if requested
    if (runChecks) {
        const prePushScript = path.join(cwd, 'scripts', 'prepublish_gate.js');
        if (fs.existsSync(prePushScript)) {
            const gateRes = spawnSync('node', [prePushScript], { cwd, encoding: 'utf8', stdio: 'inherit' });
            if (gateRes.status !== 0) {
                throw new Error('[@mudraforge/statutory] Pre-push verification gate failed. Push aborted.');
            }
        }
    }

    // 2. Push branch with upstream tracking
    runGit(['push', '-u', remote, currentBranch], cwd);
    const headSha = runGit(['rev-parse', 'HEAD'], cwd);

    // Compute GitHub Pull Request URL
    let repoUrl = '';
    try {
        repoUrl = runGit(['remote', 'get-url', remote], cwd);
    } catch (_) {}

    let prUrl = null;
    if (repoUrl.includes('github.com')) {
        const cleanRepo = repoUrl.replace(/^.*github\.com[:\/]/, '').replace(/\.git$/, '');
        prUrl = `https://github.com/${cleanRepo}/pull/new/${currentBranch}`;
    }

    const event = appendWorkflowJournal({
        action: 'BRANCH_PUSHED',
        branch: currentBranch,
        remote,
        commitSha: headSha,
        prUrl
    }, { rootDir: cwd });

    return {
        status: 'SUCCESS',
        branch: currentBranch,
        remote,
        commitSha: headSha,
        prUrl,
        journalEntry: event
    };
}

/**
 * Merges a reviewed feature branch into main with full CI parity check.
 *
 * @param {Object} params
 * @param {string} params.sourceBranch
 * @param {string} [params.targetBranch='main']
 * @param {boolean} [params.squash=false]
 * @param {boolean} [params.pushAfterMerge=true]
 * @param {string} [params.rootDir]
 * @returns {Object}
 */
export function mergeWorkflowBranch(params) {
    const { sourceBranch, targetBranch = 'main', squash = false, pushAfterMerge = true } = params;
    const cwd = findGitRootDir(params.rootDir || process.cwd());

    if (!sourceBranch) {
        throw new Error('[@mudraforge/statutory] sourceBranch must be specified for merge.');
    }

    // 1. Ensure working directory is clean
    const status = runGit(['status', '--porcelain'], cwd);
    if (status) {
        throw new Error('[@mudraforge/statutory] Working tree must be clean before merging branches.');
    }

    // 2. Run CI parity check on source branch first
    const ciScript = path.join(cwd, 'scripts', 'ci_parity.js');
    if (fs.existsSync(ciScript)) {
        const ciRes = spawnSync('node', [ciScript], { cwd, encoding: 'utf8', stdio: 'inherit' });
        if (ciRes.status !== 0) {
            throw new Error(`[@mudraforge/statutory] CI parity check failed on branch ${sourceBranch}. Merge aborted.`);
        }
    }

    // 3. Checkout target branch
    runGit(['checkout', targetBranch], cwd);

    // 4. Merge
    if (squash) {
        runGit(['merge', '--squash', sourceBranch], cwd);
        runGit(['commit', '-m', `merge(squash): merge ${sourceBranch} into ${targetBranch}`], cwd);
    } else {
        runGit(['merge', sourceBranch, '-m', `merge: merge branch '${sourceBranch}' into ${targetBranch}`], cwd);
    }

    const mergedSha = runGit(['rev-parse', 'HEAD'], cwd);

    // 5. Push target branch
    if (pushAfterMerge) {
        process.env.ALLOW_MAIN_PUSH = '1';
        try {
            runGit(['push', 'origin', targetBranch], cwd);
        } finally {
            delete process.env.ALLOW_MAIN_PUSH;
        }
    }

    const event = appendWorkflowJournal({
        action: 'BRANCH_MERGED',
        sourceBranch,
        targetBranch,
        commitSha: mergedSha,
        pushedToRemote: pushAfterMerge
    }, { rootDir: cwd });

    return {
        status: 'SUCCESS',
        sourceBranch,
        targetBranch,
        commitSha: mergedSha,
        pushed: pushAfterMerge,
        journalEntry: event
    };
}

/**
 * Publishes a verified release to npm and GitHub.
 *
 * @param {Object} [params]
 * @param {string} [params.rootDir]
 * @param {boolean} [params.dryRun=false]
 * @param {boolean} [params.skipNpm=false]
 * @returns {Object}
 */
export function publishWorkflowRelease(params = {}) {
    const { dryRun = false, skipNpm = false } = params;
    const cwd = findGitRootDir(params.rootDir || process.cwd());

    // 1. Verify on main branch
    const currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    if (currentBranch !== 'main' && currentBranch !== 'master') {
        throw new Error(`[@mudraforge/statutory] Releases can only be published from 'main'. Currently on '${currentBranch}'.`);
    }

    // 2. Verify clean working directory
    const status = runGit(['status', '--porcelain'], cwd);
    if (status) {
        throw new Error('[@mudraforge/statutory] Working tree must be completely clean before releasing.');
    }

    // 3. Read package.json version
    const pkgPath = path.join(cwd, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const version = pkg.version;
    const tagName = `v${version}`;

    // 4. Run CI parity check
    const ciScript = path.join(cwd, 'scripts', 'ci_parity.js');
    if (fs.existsSync(ciScript)) {
        const ciRes = spawnSync('node', [ciScript], { cwd, encoding: 'utf8', stdio: 'inherit' });
        if (ciRes.status !== 0) {
            throw new Error('[@mudraforge/statutory] Pre-release CI parity check failed. Release aborted.');
        }
    }

    if (dryRun) {
        return {
            status: 'DRY_RUN_PASSED',
            package: pkg.name,
            version,
            tag: tagName
        };
    }

    // 5. Publish to npm registry
    if (!skipNpm) {
        const publishRes = spawnSync('npm', ['publish', '--access', 'public'], { cwd, encoding: 'utf8', stdio: 'inherit' });
        if (publishRes.status !== 0) {
            throw new Error(`[@mudraforge/statutory] NPM publish failed with code ${publishRes.status}.`);
        }
    }

    // 6. Create Git Tag
    try {
        runGit(['tag', '-a', tagName, '-m', `Release ${tagName}`], cwd);
    } catch (err) {
        if (!err.message.includes('already exists')) {
            throw err;
        }
    }

    // 7. Push Tag to GitHub
    runGit(['push', 'origin', tagName], cwd);
    const headSha = runGit(['rev-parse', 'HEAD'], cwd);

    const event = appendWorkflowJournal({
        action: 'PACKAGE_PUBLISHED',
        package: pkg.name,
        version,
        tag: tagName,
        commitSha: headSha,
        npmPublished: !skipNpm
    }, { rootDir: cwd });

    return {
        status: 'SUCCESS',
        package: pkg.name,
        version,
        tag: tagName,
        commitSha: headSha,
        journalEntry: event
    };
}
