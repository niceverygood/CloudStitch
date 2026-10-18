/* Save evidence and file hashes after successful QA and preview capture. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { repoPath } = require('../lib/paths.cjs');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const output = repoPath('outputs/airship-rig-v1');
const work = repoPath('work/verification/airship-rig');
const qa = JSON.parse(fs.readFileSync(path.join(work, 'qa-result.json')));
const validator = JSON.parse(fs.readFileSync(path.join(work, 'gltf-validation.json')));
const video = JSON.parse(fs.readFileSync(path.join(work, 'video-decode.json')));
const modelHash = sha(fs.readFileSync(path.join(output, 'airship-rigged.glb')));
if (!qa.passed || qa.checks.asset.sha256 !== modelHash || qa.checks.download.sha256 !== modelHash) throw new Error('Passing QA does not match the delivered GLB.');
if (validator.issues.numErrors || validator.issues.numWarnings) throw new Error('glTF validation has unresolved errors or warnings.');
if (!video.passed || video.sha256 !== sha(fs.readFileSync(path.join(output, 'motion-preview.webm')))) throw new Error('Preview video decoding does not match the delivered video.');
qa.deliveredArtifacts = {
  modelSha256: modelHash,
  viewerSha256: sha(fs.readFileSync(path.join(output, 'viewer.html'))),
  videoSha256: sha(fs.readFileSync(path.join(output, 'motion-preview.webm'))),
};
qa.videoDecode = video;
fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(qa, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'gltf-validation.json'), JSON.stringify(validator, null, 2) + '\n');
const manifestPath = path.join(output, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
manifest.verification = { passed: true, report: 'verification.json', gltfValidator: 'gltf-validation.json', originalPositionUvTrianglesExact: true, errorCount: qa.errors.length, externalRequestCount: qa.externalRequests.length, previewVideoDecoded: true };
manifest.files = fs.readdirSync(output).filter(file => file !== 'manifest.json').sort().map(file => {
  const bytes = fs.readFileSync(path.join(output, file));
  const result = { file, bytes: bytes.length, sha256: sha(bytes) };
  if (file.endsWith('.png')) { result.width = bytes.readUInt32BE(16); result.height = bytes.readUInt32BE(20); }
  if (file.endsWith('.webm')) { result.width = video.width; result.height = video.height; result.durationSeconds = video.duration; }
  return result;
});
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, modelSha256: modelHash, files: manifest.files.map(f => f.file), sourcePreserved: qa.checks.originalSource.unchanged }));
