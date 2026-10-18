const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'outputs/battlefield-v1');
(async () => {
  fs.mkdirSync(out, {recursive:true});
  await esbuild.build({entryPoints:[path.join(__dirname,'main.js')],outfile:path.join(out,'battlefield.js'),bundle:true,minify:true,format:'iife',target:['chrome100','safari16'],sourcemap:false});
  fs.copyFileSync(path.join(__dirname,'style.css'),path.join(out,'style.css'));
  fs.copyFileSync(path.join(__dirname,'index.html'),path.join(out,'index.html'));
  console.log('Built outputs/battlefield-v1/index.html');
})().catch(error => { console.error(error); process.exitCode=1; });
