// Standalone rules/allocation verification; no browser, battle sim, or dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('./data.cjs');
const core = require('./core.cjs');
const results = [];
function check(name, run) {
  try { run(); results.push({ name, status:'PASS' }); }
  catch (error) { results.push({ name, status:'FAIL', error:error.message }); }
}
function build(ids, level=9) {
  let state=core.createState(level);
  for (const id of ids) {
    assert.equal(core.learnReason(state,id),'',`Cannot learn ${id}`);
    state=core.learn(state,id);
  }
  assert.deepEqual(core.validate(state),[]);
  return state;
}
const byId=Object.fromEntries(data.nodes.map(n=>[n.id,n]));
check('21 canonical skills, costs, cooldowns, and previous-tier OR prerequisites',()=>{
  const originals={M1:'바람 읽기',M2A:'긴급 가속',M2B:'급선회',M3A:'구름 사냥꾼',M3B:'회피 항법',M4A:'폭풍 질주',M4B:'구름 장막',C1:'포술 숙련',C2A:'일제 사격',C2B:'사슬탄 사격',C3A:'약점 조준',C3B:'제압 사격',C4A:'탄막 전개',C4B:'공성 포격',R1:'잔해 감별',R2A:'긴급 수리',R2B:'인양 펄스',R3A:'정밀 해체',R3B:'현장 개조',R4A:'전장 재조립',R4B:'강제 인양'};
  const cooldowns={M2A:10,M2B:12,M4A:45,M4B:50,C2A:14,C2B:16,C4A:50,C4B:55,R2A:18,R2B:15,R4A:60,R4B:55};
  assert.equal(data.nodes.length,21);
  assert.equal(new Set(data.nodes.map(n=>n.id)).size,21);
  assert.deepEqual(Object.keys(byId).sort(),Object.keys(originals).sort());
  for (const [id,name] of Object.entries(originals)) {
    const n=byId[id], tier=Number(id[1]), p=id[0];
    assert.equal(n.originalName,name);
    assert.equal(n.cost,tier===4?2:1);
    assert.equal(n.kind,tier===4?'ultimate':tier===2?'active':'passive');
    assert.equal(n.cooldown,cooldowns[id]??null);
    assert.deepEqual(n.requiresAny,tier===1?[]:tier===2?[p+'1']:[p+(tier-1)+'A',p+(tier-1)+'B']);
    assert.equal(n.minLevel,tier===4?6:null);
  }
});
check('Lv1..9 earns level−1 points, independent of appearance growth',()=>{
  for(let level=1;level<=9;level++) {
    const state=core.createState(level);
    assert.equal(state.level,level); assert.equal(core.points(state),0);
    assert.equal(core.availablePoints(state),level-1);
    assert.deepEqual(core.validate(state),[]);
  }
  let state=core.createState(1);
  assert.ok(core.learnReason(state,'M1'));
  assert.deepEqual(core.learn(state,'M1'),state);
  state=core.createState(2);
  assert.equal(core.learnReason(state,'M1'),'');
  state=core.learn(state,'M1');
  assert.ok(core.learnReason(state,'M2A'));
});
check('Every branch supports both OR predecessors and rejects siblings/skipping',()=>{
  for(const prefix of ['M','C','R']) {
    assert.ok(core.learnReason(core.createState(),'MISSING'));
    assert.ok(core.learnReason(core.createState(),prefix+'2A'));
    for(const a of ['A','B'])for(const s of ['A','B'])for(const u of ['A','B']) {
      let state=build([prefix+'1',prefix+'2'+a,prefix+'3'+s,prefix+'4'+u]);
      assert.equal(core.points(state),5);
      for(const [tier,chosen] of [[2,a],[3,s],[4,u]]) {
        assert.ok(core.learnReason(state,prefix+tier+(chosen==='A'?'B':'A')));
      }
      assert.ok(core.learnReason(state,prefix+'1'));
    }
  }
});
check('Ultimate requires Lv6, two remaining points, and global limit one',()=>{
  const base=['M1','M2B','M3A'];
  let state=build(base,5);
  assert.ok(core.learnReason(state,'M4B'));
  state=build(base,6);
  assert.equal(core.learnReason(state,'M4B'),'');
  state=core.learn(state,'M4B');
  assert.equal(core.ultimate(state).id,'M4B');
  const both=build(['M1','M2A','M3B','M4A','C1','C2B','C3A']);
  assert.ok(core.learnReason(both,'C4B'));
  const short=build(['M1','M2A','M3A','C1'],6);
  assert.ok(core.learnReason(short,'M4A'));
});
check('Exhaustive Lv9 eight-point allocations: 192 + 96 + 96 = 384',()=>{
  function branchPaths(p) {
    const paths=[[],[p+'1']];
    for(const a of ['A','B']) {
      const active=[p+'1',p+'2'+a]; paths.push(active);
      for(const s of ['A','B']) {
        const spec=[...active,p+'3'+s]; paths.push(spec);
        for(const u of ['A','B'])paths.push([...spec,p+'4'+u]);
      }
    }
    return paths;
  }
  const costs=ids=>ids.reduce((sum,id)=>sum+byId[id].cost,0);
  const counts={'5+3+0':0,'5+2+1':0,'3+3+2':0};
  for(const m of branchPaths('M'))for(const c of branchPaths('C'))for(const r of branchPaths('R')) {
    const parts=[m,c,r],ids=parts.flat();
    if(costs(ids)!==8 || ids.filter(id=>byId[id].kind==='ultimate').length>1)continue;
    const state=build(ids);
    assert.equal(core.availablePoints(state),0);
    assert.equal(core.points(state),8);
    counts[parts.map(costs).sort((a,b)=>b-a).join('+')]++;
  }
  assert.deepEqual(counts,{'5+3+0':192,'5+2+1':96,'3+3+2':96});
});
check('Refund cancels descendants only and clears affected Q/E assignments',()=>{
  let state=build(['M1','M2B','M3A','M4B','C1','C2A','C3B']);
  state=core.assign(state,'Q','M2B'); state=core.assign(state,'E','C2A');
  const original=JSON.stringify(state);
  const next=core.refund(state,'M2B');
  assert.equal(JSON.stringify(state),original,'Refund mutated input');
  assert.deepEqual(new Set(next.selected),new Set(['M1','C1','C2A','C3B']));
  assert.equal(next.slots.Q,null); assert.equal(next.slots.E,'C2A');
  assert.equal(core.points(next),4); assert.deepEqual(core.validate(next),[]);
  assert.equal(core.ultimate(next),null);
  const root=core.refund(state,'M1');
  assert.deepEqual(new Set(root.selected),new Set(['C1','C2A','C3B']));
});
check('Level reduction removes unavailable ultimate and refunds reverse-order overflow',()=>{
  const original=build(['M1','M2A','M3B','M4B','C1','C2A','C3A']);
  for(let level=1;level<=9;level++) {
    const next=core.setLevel(original,level);
    assert.equal(next.level,level); assert.ok(core.points(next)<=level-1);
    assert.deepEqual(core.validate(next),[]);
    if(level<6)assert.equal(core.ultimate(next),null);
    for(const id of next.selected)assert.ok(original.selected.includes(id));
  }
  assert.deepEqual(core.setLevel(original,8).selected,['M1','M2A','M3B','M4B','C1','C2A']);
  const increased=core.setLevel(core.createState(1),9);
  assert.deepEqual(increased.selected,[],'Raising level auto-learned nodes');
  assert.equal(core.points(original),8,'setLevel mutated input');
});
check('Three learned actives are allowed, Q/E equip two, unique assignment is maintained',()=>{
  let state=build(['M1','M2A','M3B','C1','C2B','C3A','R1','R2B']);
  assert.equal(state.selected.filter(id=>byId[id].kind==='active').length,3);
  state=core.assign(state,'Q','M2A'); state=core.assign(state,'E','C2B');
  state=core.assign(state,'Q','R2B');
  assert.deepEqual(state.slots,{Q:'R2B',E:'C2B'});
  state=core.assign(state,'E','R2B');
  assert.deepEqual(state.slots,{Q:null,E:'R2B'});
  for(const invalid of ['M1','M2B','M4A','NOPE']) {
    const next=core.assign(state,'Q',invalid);
    assert.deepEqual(next,state);
  }
  state=core.assign(state,'E',null);
  assert.deepEqual(state.slots,{Q:null,E:null});
  assert.deepEqual(core.validate(state),[]);
});
check('Six presets are complete five-plus-three builds with two learned equipped actives',()=>{
  assert.equal(data.presets.length,6);
  assert.equal(new Set(data.presets.map(p=>p.id)).size,6);
  for(const preset of data.presets) {
    const state=core.applyPreset(preset.id);
    assert.equal(state.level,9); assert.equal(core.points(state),8);
    assert.deepEqual(new Set(state.selected),new Set(preset.nodes));
    assert.deepEqual(state.slots,preset.slots);
    assert.ok(core.ultimate(state)); assert.deepEqual(core.validate(state),[]);
    const distribution=data.branches.map(b=>state.selected.filter(id=>byId[id].branch===b.id).reduce((n,id)=>n+byId[id].cost,0)).sort((a,b)=>b-a);
    assert.deepEqual(distribution,[5,3,0]);
  }
});
check('Validation rejects malformed rule states',()=>{
  const invalidStates=[
    {level:9,selected:['M2A'],slots:{Q:null,E:null}},
    {level:9,selected:['M1','M2A','M2B'],slots:{Q:null,E:null}},
    {level:5,selected:['M1','M2A','M3A','M4A'],slots:{Q:null,E:null}},
    {level:9,selected:['M1','M2A','M3A','M4A','C1','C2A','C3A','C4A'],slots:{Q:null,E:null}},
    {level:1,selected:['M1'],slots:{Q:null,E:null}},
    {level:9,selected:[],slots:{Q:'M2A',E:null}},
  ];
  for(const state of invalidStates)assert.ok(core.validate(state).length>0);
});
const report={schemaVersion:1,revision:data.revision,status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',checkedAt:new Date().toISOString(),scope:'Node data and allocation logic only; not battle-effect implementation or gameplay balance.',browser:{executed:false,reason:'No browser slot used; UI interaction, rendering and responsive layout remain unverified.'},artApproval:false,results};
const destination=path.resolve(__dirname,'../../outputs/hero-skill-tree-v1/verification.json');
fs.mkdirSync(path.dirname(destination),{recursive:true});
fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,passed:results.filter(r=>r.status==='PASS').length,total:results.length,failures:results.filter(r=>r.status==='FAIL'),report:'outputs/hero-skill-tree-v1/verification.json'},null,2));
if(report.status!=='PASS')process.exitCode=1;
