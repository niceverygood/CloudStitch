/** Lightweight Node checks only. This does not replace real browser QA. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('outputs/harbor-v1/index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'standalone bundle exists'); new vm.Script(script);
assert.ok(!/<script[^>]+src=/i.test(html));
assert.equal(html.includes('https://'),false);
assert.equal(html.includes('http://'),false);
const elements=new Map();
function el(id){
  if(!elements.has(id)) elements.set(id,{id,value:id==='location-filter'?'all':'',checked:false,hidden:false,disabled:false,textContent:'',innerHTML:'',dataset:{},classList:{toggle(){}},prepend(){},setAttribute(){},click(){this.onclick?.();}});
  return elements.get(id);
}
const memory=new Map();
const context={document:{getElementById:el,querySelectorAll:()=>[],createElement:()=>({click(){}}),body:{dataset:{}}},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},structuredClone,console,setTimeout,Blob,URL,confirm:()=>true};
context.window=context;vm.createContext(context);
// Keep cloned objects in the VM realm, like a real page's structuredClone.
vm.runInContext('globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));',context);
vm.runInContext(script,context);
const get=()=>context.cloudstitchHarbor.getState();
assert.equal(get().phase,'harbor');
for(let n=1;n<=2;n++){
  el('depart').click();assert.equal(get().phase,'sailing');
  el('return').click();assert.equal(get().settlements.length,n);
  el('store').click();el('quote').click();assert.equal(el('repair').disabled,false);el('repair').click();
}
el('load').click();
assert.equal(get().settlements.length,2);assert.equal(get().parts.length,9);
assert.deepEqual(JSON.parse(JSON.stringify(get().resources)),{S:284,F:34,C:3});
el('fail-save').checked=true;const raw=memory.get('cloudstitch.harbor.v1');el('save').click();
assert.equal(memory.get('cloudstitch.harbor.v1'),raw);assert.equal(el('status').textContent.includes('저장하지 못했습니다'),true);
const check={version:1,scope:'Node DOM shim; independent-example callbacks, not browser or actual voyage',checks:['bundle JavaScript syntax','no external script/remote asset URLs','initial state','two example departure-return-store-repair callbacks','load retains 2 settlements/9 parts/S284 F34 C3','write failure preserves last journal'],passed:true,actualBrowser:false,actualVoyage:false};
fs.writeFileSync('outputs/harbor-v1/verification.json',JSON.stringify(check,null,2)+'\n');
console.log(JSON.stringify(check,null,2));
