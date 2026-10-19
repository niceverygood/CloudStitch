import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), output = 'outputs/levels-v1/handoff-files.json';
const files = [];
for (const directory of ['tools/levels', 'outputs/levels-v1']) for (const file of fs.readdirSync(path.join(root, directory)).sort()) {
  const relative = `${directory}/${file}`; if (/^playable-/.test(file) || relative === output || !fs.statSync(path.join(root, relative)).isFile()) continue;
  const bytes = fs.readFileSync(path.join(root, relative)); files.push({ path: relative, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}
fs.writeFileSync(path.join(root, output), JSON.stringify({ schemaVersion: 1, status: 'ready-for-integration', snapshot: '2026-10-18-levels-v1-ready-4', baseline: 'fb850f7', restoredSourceReference: 'e65ab87d2af0c4b08e51f312c9eb0998aa895c69', scope: ['tools/levels/', 'outputs/levels-v1/'], excludedBasenamePattern: '^playable-', browserQA: 'ready-3-22-checks-passed-by-integration-owner; pending-ready-4-reselection-resource-rerun', selfExcluded: output, files }, null, 2) + '\n');
console.log(JSON.stringify({ output, files: files.length, snapshot: '2026-10-18-levels-v1-ready-4', sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, output))).digest('hex') }));
