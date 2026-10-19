'use strict';
// Current production whitelist. Historical SOURCE_READY1/build.cjs stay intact.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ids=['enemy-tax-cutter','mission-union-guard','mission-bridge-tug','mission-guard-scout','mission-cult-purifier','mission-ghost-artillery','role-enemy-artillery','role-enemy-defense','mini-funeral-guard','boss-shipyard-ribs','boss-shipwright-command','boss-last-inhale'];
const args=process.argv.slice(2),requested=args.find(a=>a.startsWith('--ids='))?.slice(6).split(',')||ids;
if(requested.some(id=>!ids.includes(id)))throw Error('New production owns12 only; reference6 and boss-bell-devourer are read-only dependencies');
const childArgs=args.filter(a=>!a.startsWith('--ids=')).concat('--ids='+requested.join(','));
const result=cp.spawnSync(process.execPath,[path.join(__dirname,'build.cjs'),...childArgs],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;if(result.status!==0){process.exitCode=result.status||1;}else if(args.includes('--execute')){
 const file=path.resolve(__dirname,'../../../outputs/enemy-fleet-villain-v1/models.json'),catalog=JSON.parse(fs.readFileSync(file,'utf8'));
 catalog.ownedModelCount=12;catalog.productionWhitelist=ids;catalog.readOnlyBoss='boss-bell-devourer';
 catalog.ships=catalog.ships.map(s=>s.id==='boss-bell-devourer'?{...s,status:'delegated-readonly',productionNote:'Historical source candidate only; new art owned by chapter1-boss-review.'}:s);
 fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');console.log(JSON.stringify({ownedProduction:12,readOnlyReference:6,readOnlyBoss:1}));
}
