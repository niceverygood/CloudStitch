/* Khronos glTF 2.0 validation, entirely local. */
const fs = require('node:fs');
const path = require('node:path');
const validator = require('gltf-validator');
const { repoPath } = require('../lib/paths.cjs');

(async () => {
  const input = repoPath(process.argv[2] || 'outputs/airship-rig-v1/airship-rigged.glb');
  const output = repoPath(process.argv[3] || 'work/verification/airship-rig/gltf-validation.json');
  const result = await validator.validateBytes(new Uint8Array(fs.readFileSync(input)), { uri: path.basename(input), maxIssues: 10000, writeTimestamp: false });
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  const counts = {}; for (const m of result.issues.messages) counts[m.code] = (counts[m.code] || 0) + 1;
  console.log(JSON.stringify({ validator: validator.version(), file: path.basename(input), errors: result.issues.numErrors, warnings: result.issues.numWarnings, infos: result.issues.numInfos, hints: result.issues.numHints, issueCodes: counts, examples: result.issues.messages.slice(0, 3) }, null, 2));
  if (result.issues.numErrors || result.issues.numWarnings) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
