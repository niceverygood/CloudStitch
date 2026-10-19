const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname,'../..');
const out = path.join(root,'outputs/hero-skill-tree-v1');
const data = require('./data.cjs');
fs.mkdirSync(out,{recursive:true});
const template = fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
const core = fs.readFileSync(path.join(__dirname,'core.cjs'),'utf8').replace("const data = require('./data.cjs');",'').replace('module.exports =','const core =');
const ui = fs.readFileSync(path.join(__dirname,'ui.js'),'utf8');
const json = JSON.stringify(data).replace(/</g,'\\u003c');
const script = `'use strict';\n(() => {\nconst data = ${json};\n${core}\n${ui}\n})();`;
new vm.Script(script);
fs.writeFileSync(path.join(out,'index.html'),template.replace('/*__APP__*/',script),'utf8');
fs.writeFileSync(path.join(out,'skill-tree.json'),JSON.stringify(data,null,2)+'\n');
const lines = [
  'Cloudstitch · 주인공 함선 세 유형 스킬트리 v1',
  '2026-10-19 / 새 별칭·전투 리듬·연출 제안 + 49번 원형 효과 보존',
  '',
  '규칙과 해석',
  '각 계열 7노드, 총21개. 기초1 → 일반 액티브2택1 → 전문화2택1 → 궁극2택1.',
  '선행은 같은 계열 바로 앞 단계에서 하나(OR). A를 골라도 다음 단계 B 선택 가능.',
  '일반1점·궁극2점. 출항 Lv1~9 총8점. 주력5+보조3 권장, 5+2+1·3+3+2도 가능.',
  '궁극은 Lv6 이상·해당 계열 전문화·2점·다른 궁극 미습득. 궁극 습득은 필수가 아니다.',
  '일반 Q/E 두 장착 슬롯, 궁극 R 하나. 세 액티브 습득 시 두 개만 Q/E 장착하는 해석이다.',
  '플래너는 Lv1=0점·매 레벨1점으로 가정한다. 실제 성장 속도·지급 시점·입력 방식은 미확정.',
  '함선 성급1~5·외형Lv1~30과 출항 스킬레벨은 별도다. 계열 열람은 선체 교체나 스탯 변경이 아니다.',
  '함선은 추천 주력을 안내한다. 타 계열 습득을 금지하거나 고유 스탯을 추가하지 않는다.',
  '',
];
for (const b of data.branches) {
  lines.push(`${b.type} / ${b.name}`,b.line,`형태: ${b.motif}`,`전투 리듬: ${b.rhythm.join(' → ')}`,`강점: ${b.strength}`,`약점: ${b.weakness}`,`장비: ${b.gear}`,`공통 연출: ${b.expression}`,'');
  for (const n of data.nodes.filter(n => n.branch === b.id)) lines.push(`${n.id} ${n.name} [원형: ${n.originalName}]`,`단계${n.tier} / ${n.kind} / ${n.cost}점${n.cooldown ? ` / 재사용${n.cooldown}초` : ''}`,`효과: ${n.effect}`,`제한: ${n.limits}`,`연출 제안: ${n.presentation}`,'');
  for (const p of data.presets.filter(p => p.branch === b.id)) lines.push(`추천: ${p.name} / ${p.nodes.join(' → ')} / Q:${p.slots.Q} E:${p.slots.E}`,p.sequence,'');
}
lines.push('기존 대비 변경과 한계','49번 원형의 효과21개·수치·중복제한을 새 규칙으로 대체하지 않는다. 새 파일에서 함선별 별칭·전투 리듬·장비 권장·실루엣과 연출의 연결을 제안했다.','최신 10배 이상 과감한 표현 기준을 스킬별 준비·작업/발사·접촉·반동·여운으로 구체화했다. 실제 VFX/음향/3D를 제작하거나 전후 재생 비교·사람의 미술/청감 승인을 완료한 것은 아니다.','이번 구현은 스킬 배분 플래너다. 실제 sim 피해·장전·AI·수리·회수·화물·저장·함선 장착은 연결하지 않았다.','C4B 무폭발 직사무기 특수탄 폭발반경, R3A 최종 확률 처리, 현장개조 보호내구 세부 등은 원형과 같이 통합 전 정의가 필요하다.','일반 과제의 필수단서와 핵심결말은 스킬·확률·동료완료율로 잠그지 않는다.','',...data.sources);
fs.writeFileSync(path.join(out,'DESIGN.txt'),lines.join('\n')+'\n');
const files = ['tools/hero-skill-tree-v1/data.cjs','tools/hero-skill-tree-v1/core.cjs','tools/hero-skill-tree-v1/build.cjs','tools/hero-skill-tree-v1/ui.js','tools/hero-skill-tree-v1/template.html','tools/hero-skill-tree-v1/verify.cjs','tools/hero-skill-tree-v1/smoke.cjs','outputs/hero-skill-tree-v1/index.html','outputs/hero-skill-tree-v1/skill-tree.json','outputs/hero-skill-tree-v1/DESIGN.txt','outputs/hero-skill-tree-v1/HANDOFF.txt',...['verification.json','ui-smoke.json'].map(f=>'outputs/hero-skill-tree-v1/'+f).filter(f=>fs.existsSync(path.join(root,f)))];
const references = [...data.sources,'outputs/ship-states-v1/three-lineages-selected-v1/three-lineages.png'];
const entry = relative => {const bytes=fs.readFileSync(path.join(root,relative));return {path:relative,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({title:data.title,revision:data.revision,status:'READY-design-and-planner',files:files.map(entr