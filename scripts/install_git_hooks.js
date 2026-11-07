/**
 * MUDRAFORGE STATUTORY — GIT HOOKS INSTALLER
 * Installs pre-commit and pre-push hooks to enforce Rule 18 and Rule 20.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const hooksDir = path.join(rootDir, '.git', 'hooks');

if (!fs.existsSync(hooksDir)) {
    console.log('[WARN] .git/hooks directory not found. Skipping hook installation.');
    process.exit(0);
}

// 1. PRE-PUSH HOOK (Blocks direct push to main and runs local CI verification)
const prePushContent = `#!/bin/sh
# Rule 18: Feature Branch Isolation & CI Parity Pre-Push Guardrail

remote="$1"
url="$2"

z40="0000000000000000000000000000000000000000"

while read local_ref local_sha remote_ref remote_sha
do
    if [ "$local_sha" = $z40 ]; then
        # Branch deletion, allow
        continue
    fi

    # Block direct push to main unless ALLOW_MAIN_PUSH=1
    if [ "$remote_ref" = "refs/heads/main" ]; then
        if [ "$ALLOW_MAIN_PUSH" != "1" ]; then
            echo ""
            echo "==========================================================================="
            echo "[BLOCKED BY RULE 18] DIRECT PUSH TO MAIN PROHIBITED"
            echo "==========================================================================="
            echo "Pushing directly to 'main' is blocked by Rule 18 to ensure all changes are"
            echo "tested on a feature branch (feat/* or fix/*) via remote GitHub Actions CI"
            echo "before merging."
            echo ""
            echo "Required Workflow:"
            echo "  1. git checkout -b fix/<name> (or feat/<name>)"
            echo "  2. git push -u origin fix/<name>"
            echo "  3. Wait for remote GitHub Actions CI matrix to pass 100% green"
            echo "  4. Obtain explicit user approval before merging into main"
            echo ""
            echo "If you have explicit authorization to push to main, run with:"
            echo "  ALLOW_MAIN_PUSH=1 git push origin main"
            echo "==========================================================================="
            echo ""
            exit 1
        fi
    fi
done

# Run package export and TypeScript checks before any push
echo "[PRE-PUSH] Running export and type integrity check..."
node scripts/prepublish_gate.js
if [ $? -ne 0 ]; then
    echo "[ERROR] Pre-push verification gate failed. Push aborted."
    exit 1
fi

exit 0
`;

const prePushPath = path.join(hooksDir, 'pre-push');
fs.writeFileSync(prePushPath, prePushContent, { mode: 0o755 });
console.log(`[PASS] Installed pre-push hook at: ${prePushPath}`);

// 2. PRE-COMMIT HOOK (Rule 20 zero-emoji enforcement)
const preCommitContent = `#!/bin/sh
# Rule 20: Pre-Commit Zero-Emoji Guardrail Hook

# Check staged files for emojis
staged_files=$(git diff --cached --name-only --diff-filter=ACM)

if [ -n "$staged_files" ]; then
    node -e "
    import fs from 'node:fs';
    const files = process.argv.slice(1);
    const emojiRegex = /[\\\\uD83C-\\\\uDBFF\\\\uDC00-\\\\uDFFF]/;
    let failed = false;
    for (const f of files) {
        if (!fs.existsSync(f) || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.tgz')) continue;
        const content = fs.readFileSync(f, 'utf8');
        if (emojiRegex.test(content)) {
            console.error('[ERROR] Rule 20 Violation: Staged file contains emojis: ' + f);
            failed = true;
        }
    }
    if (failed) process.exit(1);
    " $staged_files

    if [ $? -ne 0 ]; then
        echo "[ERROR] Pre-commit checks failed (Rule 20). Commit aborted."
        exit 1
    fi
fi

exit 0
`;

const preCommitPath = path.join(hooksDir, 'pre-commit');
fs.writeFileSync(preCommitPath, preCommitContent, { mode: 0o755 });
console.log(`[PASS] Installed pre-commit hook at: ${preCommitPath}`);
