/* Integration-only: --prepare performs JSON validation and an in-memory bundle;
 * actual capture requires the integration browser slot. No dependency install. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const root = path.resolve(__dirname, '../../../..');
const localDeps = path.join(root, 'work/combat-vfx-v2/deps/node_modules');
const searchPaths = [localDeps, ...(process.env.NODE_PATH || '').split(path.delimiter)].filter(Boolean);
process.env.NODE_PATH = searchPaths.join(path.delimiter);
Module._initPaths();

function inside(relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) throw new Error('Expected a repository-relative path');
  const absolute = path.resolve(root, relative);
  const rel = path.relative(root, absolute);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Path escapes repository');
  return absolute;
}
function realInside(absolute) {
  const real = fs.realpathSync(absolute);
  const rel = path.relative(fs.realpathSync(root), real);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Symlink escapes repository');
  return real;
}
function options() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg === '--prepare') args.prepare = true;
    else if (/^--(pairs|out)=/.test(arg)) {
      const at = arg.indexOf('='); const key = arg.slice(2, at);
      if (args[key]) throw new Error(`Duplicate --${key}`);
      args[key] = arg.slice(at + 1);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.pairs || !args.out) throw new Error('Usage: node capture.cjs --pairs=repoRelative.json --out=outputs/enemy-fleet-villain-v1/comparisons-r2 [--prepare]');
  return args;
}
function validateOutput(relative) {
  const out = inside(relative);
  const rel = path.relative(path.join(root, 'outputs/enemy-fleet-villain-v1'), out).replace(/\\/g, '/');
  if (!/^comparisons[-_a-zA-Z0-9]*(?:\/[-_a-zA-Z0-9]+)*$/.test(rel)) throw new Error('Output must be a NEW comparisons* directory under outputs/enemy-fleet-villain-v1');
  if (fs.existsSync(out)) throw new Error('Output exists; refusing to overwrite');
  let ancestor = path.dirname(out);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  realInside(ancestor);
  if (path.resolve(ancestor) !== fs.realpathSync(ancestor)) throw new Error('Output ancestors must not use symlinks');
  return out;
}
async function main() {
  const args = options();
  const out = validateOutput(args.out);
  const input = JSON.parse(fs.readFileSync(realInside(inside(args.pairs)), 'utf8'));
  if (!Array.isArray(input.pairs) || !input.pairs.length) throw new Error('pairs must be a nonempty array');
  const ids = new Set();
  for (const pair of input.pairs) {
    if (!pair || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(pair.id) || ids.has(pair.id)) throw new Error('Pair ids must be unique, filesystem-safe names');
    ids.add(pair.id);
    for (const side of ['before', 'after']) {
      if (!/\.glb$/i.test(pair[`${side}AssetPath`] || '')) throw new Error(`${pair.id}: expected GLB path`);
      inside(pair[`${side}AssetPath`]);
      if (!/^[0-9a-f]{64}$/i.test(pair[`${side}Sha256`] || '')) throw new Error(`${pair.id}: expected SHA256`);
    }
  }
  const esbuild = require('esbuild');
  const bundle = await esbuild.build({ entryPoints: [path.join(__dirname, 'render.js')], bundle: true, write: false, platform: 'browser', format: 'iife', nodePaths: searchPaths, logLevel: 'silent' });
  if (args.prepare) {
    console.log(JSON.stringify({status:'PREPARED_ONLY', pairs:input.pairs.length, bundleBytes:bundle.outputFiles[0].contents.length, glbRead:false, browserStarted:false, outputCreated:false}));
    return;
  }
  // Only integration invokes this branch: one browser, one page, sequential pairs.
  const { launchBrowser } = require(path.join(root, 'tools/lib/runtime.cjs'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(out);
  const browser = await launchBrowser({headless:true});
  const errors = []; const externalRequests = [];
  const report = {schemaVersion:1, passed:false, status:'RUNNING', width:900, height:700, dpr:1, sampleTimeSeconds:2, pairs:[], errors, externalRequests, artApproval:'PENDING_HUMAN_REVIEW', note:'Pixel differences are technical evidence, not automatic approval of the 10x artistic direction.'};
  try {
    const page = await browser.newPage({viewport:{width:900,height:700},deviceScaleFactor:1});
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
    await page.route('**/*', route => {const url=route.request().url();if(/^(?:data:|blob:)/.test(url))return route.continue();externalRequests.push(url);return route.abort();});
    await page.setContent('<!doctype html><meta charset="utf-8"><title>Cloudstitch actual GLB comparison</title><body style="margin:0"></body>');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    for (const pair of input.pairs) {
      const payload = {id:pair.id}; const hashes = {};
      for (const side of ['before','after']) {
        const bytes = fs.readFileSync(realInside(inside(pair[`${side}AssetPath`])));
        const sha = crypto.createHash('sha256').update(bytes).digest('hex');
        if (sha !== pair[`${side}Sha256`].toLowerCase()) throw new Error(`${pair.id}/${side}: source hash mismatch`);
        hashes[side] = {assetPath:pair[`${side}AssetPath`], sha256:sha, bytes:bytes.length};
        payload[side] = bytes.toString('base64');
      }
      const result = await page.evaluate(data => window.captureActualPair(data), payload);
      const pairOut = path.join(out,pair.id); fs.mkdirSync(pairOut);
      const pngHashes = {};
      for (const kind of ['before','after','pair']) {
        const encoded = result.images[kind];
        const png = Buffer.from(encoded.split(',')[1],'base64');
        pngHashes[`${kind}PngSha256`] = crypto.createHash('sha256').update(png).digest('hex');
        fs.writeFileSync(path.join(pairOut,`${kind}.png`),png,{flag:'wx'});
      }
      delete result.images;
      const evidence = {...result,sources:hashes,...pngHashes,beforeSha256:hashes.before.sha256,afterSha256:hashes.after.sha256,sameCamera:true,passed:true};
      fs.writeFileSync(path.join(pairOut,'metadata.json'),JSON.stringify(evidence,null,2),{flag:'wx'});
      report.pairs.push(evidence);
    }
    if (errors.length || externalRequests.length) throw new Error('Browser errors or attempted external requests; inspect report');
    report.status = 'TECHNICAL_CAPTURE_PASS';
    report.passed = true;
  } catch (error) {
    report.status = 'FAIL'; report.failure = String(error.stack || error); throw error;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  }
  console.log(JSON.stringify({status:report.status,out:args.out,pairs:report.pairs.length}));
}
main().catch(error => {console.error(error.stack || error); process.exitCode=1;});
