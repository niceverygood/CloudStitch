/* Read-only source/asset checks, with optional local evidence output. No browser/network. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'outputs/combat-vfx-v2'),TOOLS=__dirname;
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const rel=file=>path.relative(ROOT,file).replaceAll('\\','/');
const problems=[],check=(ok,message)=>{if(!ok)problems.push(message);};
const queue=read(path.join(OUT,'review-render-queue.json'));
check(queue.items.length===54&&new Set(queue.items.map(i=>i.id)).size===54,'Expected54unique queue items');
check(queue.items.filter(i=>!i.is_representative_control).length===48,'Expected48residual targets');
check(queue.batches.length===10,'Expected10comparison batches');
let modelChecks=0,pageChecks=0,syntaxChecks=0,linkChecks=0,jsonChecks=0;
for(const item of queue.items)for(const descriptor of [item.v1,item.v2]){
  const b=fs.readFileSync(path.join(ROOT,descriptor.path));modelChecks++;
  check(b.length===descriptor.bytes&&hash(b)===descriptor.sha256,'Stale model: '+descriptor.path);
}
for(const batch of queue.batches){const b=fs.readFileSync(path.join(ROOT,batch.page));pageChecks++;check(b.length===batch.page_bytes&&hash(b)===batch.page_sha256,'Stale page: '+batch.page);}
const preserved=read(path.join(ROOT,'work/combat-vfx-v2/representatives-before-followup.json'));
const controls=Array.isArray(preserved)?preserved:preserved.files||preserved.items;
if(!Array.isArray(controls))throw Error('Unknown representative baseline schema');
for(const item of controls){const current=queue.items.find(i=>i.id===item.id);check(current?.v2.sha256===item.sha256&&current?.v2.bytes===item.bytes,'Changed representative: '+item.id);}
check(hash(fs.readFileSync(path.join(OUT,'comparison.html')))==='533be1ea3b0bfc83728fd9c2dda480b01367c61c172f08e294d838caf5e0f6f2','Changed original representative comparison');
for(const name of fs.readdirSync(TOOLS).filter(n=>/\.(cjs|mjs|js)$/.test(n))){const r=spawnSync(process.execPath,['--check',path.join(TOOLS,name)],{encoding:'utf8'});syntaxChecks++;check(r.status===0,'Syntax: '+name);}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.name.endsWith('.json')){read(file);jsonChecks++;}}}walk(OUT);
for(const file of ['gallery.html','review/index.html']){
  const absolute=path.join(OUT,file),html=fs.readFileSync(absolute,'utf8');
  for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
    const href=match[1];if(/^(?:https?:|data:|mailto:)/.test(href))continue;
    const target=path.resolve(path.dirname(absolute),decodeURIComponent(href.split(/[?#]/)[0]));linkChecks++;
    const plannedInventory=target===path.join(OUT,'handoff-inventory.json')&&!fs.existsSync(target);
    check(fs.existsSync(target)||plannedInventory,'Broken link: '+file+' -> '+href);
  }
}
const preservation=spawnSync(process.execPath,[path.join(TOOLS,'record.cjs'),'verify'],{cwd:ROOT,encoding:'utf8',maxBuffer:4*1024*1024});
check(preservation.status===0,'Original preservation failed');
const preservationReport=JSON.parse(preservation.stdout);
const git=spawnSync('git',['diff','--quiet','--','package.json','package-lock.json','.gitattributes','README.md','docs/HANDOFF.md','docs/CONTINUE_PROMPT.md'],{cwd:ROOT,encoding:'utf8'});
check(git.status===0,'Tracked common files have changes');
const report={game_title:'Cloudstitch',checked_at_utc:new Date().toISOString(),passed:problems.length===0,scope:'Source/binary/links only; no fresh visual approval',models_checked:modelChecks,pages_checked:pageChecks,syntax_files_checked:syntaxChecks,json_files_checked:jsonChecks,local_links_checked:linkChecks,originals_unchanged:preservationReport.unchanged_count,representatives_unchanged:controls.length,common_tracked_files_unchanged:git.status===0,browser_started:false,paid_calls:0,problems};
if(process.argv.includes('--write')){
 fs.writeFileSync(path.join(OUT,'verification/source-preservation.json'),JSON.stringify(preservationReport,null,2)+'\n');
 fs.writeFileSync(path.join(OUT,'verification/followup-preflight.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
