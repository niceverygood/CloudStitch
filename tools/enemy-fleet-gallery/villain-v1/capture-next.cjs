'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ids=['enemy-tax-cutter','mission-union-guard','mission-bridge-tug','mission-guard-scout','mission-cult-purifier','mission-ghost-artillery','role-enemy-artillery','role-enemy-defense','mini-funeral-guard','boss-shipyard-ribs','boss-shipwright-command','boss-last-inhale'];
const args=process.argv.slice(2),selection=args.find(a=>a.startsWith('--ids='))?.slice(6).split(',')||ids;
if(selection.some(id=>!ids.includes(id)))throw Error('Only owned12 model capture is allowed; reference6 and standalone boss are read-only');
const result=cp.spawnSync(process.execPath,[path.join(__dirname,'capture.cjs'),'--ids='+selection.join(',')],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;if(result.status!==0){process.exitCode=result.status||1;}else{
 const file=path.resolve(__dirname,'../../../outputs/enemy-fleet-villain-v1/capture-models.json'),report=JSON.parse(fs.readFileSync(file,'utf8'));
 report.scope='Owned12 production whitelist only; selected subset explicitly recorded. Reference6 and new standalone boss are read-only.';report.selectedIds=selection;
 fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
}
