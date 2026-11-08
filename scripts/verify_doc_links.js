import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

function slugify(text) {
    return text.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
}

function verifyDocLinks() {
    const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
    let totalIssues = 0;

    for (const file of files) {
        const filePath = path.join(DOCS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');

        const anchors = new Set();
        const headingRegex = /^#{1,6}\s+(.+)$/gm;
        let hm;
        while ((hm = headingRegex.exec(content)) !== null) {
            anchors.add(slugify(hm[1]));
        }

        const explicitAnchorRegex = /<a\s+(?:id|name)=["']([^"']+)["']/gi;
        let am;
        while ((am = explicitAnchorRegex.exec(content)) !== null) {
            anchors.add(am[1].toLowerCase());
        }

        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lm;
        while ((lm = linkRegex.exec(content)) !== null) {
            const rawLink = lm[2].trim();
            if (rawLink.startsWith('http:') || rawLink.startsWith('https:') || rawLink.startsWith('mailto:')) {
                continue;
            }

            if (rawLink.startsWith('#')) {
                const anchor = rawLink.slice(1).toLowerCase();
                if (!anchors.has(anchor)) {
                    console.error(`[BROKEN ANCHOR] ${file} -> #${anchor}`);
                    totalIssues++;
                }
            } else {
                const [targetPath, anchor] = rawLink.split('#');
                if (targetPath.startsWith('file:///')) {
                    console.error(`[HARDCODED ABSOLUTE LINK] ${file} -> ${rawLink}`);
                    totalIssues++;
                    continue;
                }

                const resolved = path.resolve(DOCS_DIR, targetPath);
                if (!fs.existsSync(resolved)) {
                    console.error(`[BROKEN RELATIVE LINK] ${file} -> ${rawLink} (does not exist: ${resolved})`);
                    totalIssues++;
                }
            }
        }
    }

    if (totalIssues > 0) {
        console.error(`\nFound ${totalIssues} link issues across docs directory.`);
        process.exit(1);
    } else {
        console.log(`[PASS] All documentation links and anchors in docs/ are 100% valid.`);
    }
}

verifyDocLinks();
