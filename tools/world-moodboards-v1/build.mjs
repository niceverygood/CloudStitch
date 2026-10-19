import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'outputs/world-moodboards-v2');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const plan = readJson(path.join(root, 'tools/world-moodboards-v1/stage-plan-v2.json'));
const h = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const relative = p => path.relative(root, p).split(path.sep).join('/');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const meta = p => {
  const b = fs.readFileSync(p);
  const entry = { path: relative(p), bytes: b.length, sha256: sha(b) };
  if (p.endsWith('.png')) {
    if (!b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error(`PNG signature: ${p}`);
    if (b.toString('ascii', 12, 16) !== 'IHDR' || b.toString('ascii', b.length - 8, b.length - 4) !== 'IEND') throw Error(`PNG chunks: ${p}`);
    entry.width = b.readUInt32BE(16); entry.height = b.readUInt32BE(20);
    if (entry.width !== 1536 || entry.height !== 1024) throw Error(`Unexpected size: ${p}`);
  }
  return entry;
};
const figure = (src, alt, caption, eager = false) => `<figure><a href="${h(src)}" target="_blank" rel="noopener"><img src="${h(src)}" alt="${h(alt)}" width="1536" height="1024" loading="${eager ? 'eager' : 'lazy'}"></a><figcaption>${h(caption)} · 이미지를 누르면 원본 크기로 열립니다.</figcaption></figure>`;
const referenceCards = [
  ['주인공 함선 · 선택한 세 계열', '../ship-states-v1/three-lineages-selected-v1/three-lineages.png'],
  ['1탄 · 철갑 봉쇄 기지', '../enemy-base-moodboard-v2/moodboard.png'],
  ['1탄 확정 보스 · 종을 삼킨 자', '../chapter1-final-boss-moodboard-v2/moodboard.png'],
  ['2탄 확정 방향 · 적조의 왕관', '../enemy-base-v1/chapter2-moodboard-v1/moodboard.png']
];
const overview = [
  ['01', '종항', '목재 테라스 · 작업 종 · 철갑 봉쇄', '생활의 따뜻함이 종 도난과 장례함의 위협으로 바뀐다.'],
  ['02', '공중 심해권', '나선 패각 · 뼈 관문 · 붉은 산호', '포획한 배를 끌어들이는 적조 항구. 2탄의 확정 방향을 중심에 둔다.'],
  ['03–04', '상승기류 협곡', '청록 광물 · 리본 · 수직 하늘 틈', '작은 절벽 쉼터를 지나 거대한 상승 통로를 통과한다.'],
  ['05–06', '폭풍권', '구리 접지봉 · 비 · 다층 구름벽', '방풍 커튼 뒤 온기와 폭풍 돌파의 거대한 해방감을 대비한다.'],
  ['07–08', '쇠갈비 조선소', '붉은 늑골 · 크레인 · 긴 용골', '사람이 일하는 공동 작업장과 봉쇄된 외곽을 나눈다.'],
  ['09–10', '저층 안개', '호박빛 등대 · 옛 함대 · 큰 여백', '기록과 기억을 대조하며 세계와 귀환호의 과거로 내려간다.'],
  ['11–12', '검은 천정·황궁', '크림 석재 · 황동 · 검은 봉인 천', '장엄한 궁전 아래 작은 준비 갑판에서 마지막 항해를 앞둔다.']
];
const stageHtml = plan.stages.map(s => `<article class="stage" id="stage-${s.id}">
<header class="stage-head"><span class="stage-no">${s.id}</span><div><p class="eyebrow">${h(s.region)}</p><h2>${h(s.name.split(' · ').slice(1).join(' · ') || s.name)}</h2><p class="mood">${h(s.mood)}</p></div></header>
${figure(s.image, `${s.id}탄 ${s.name} 환경 무드보드`, `${s.id}탄 · ${s.english}`)}
${s.extraImage ? figure(s.extraImage, '1탄 종 도난 외해와 확정 보스 대장례함', '1탄 후반 · 종을 삼킨 자와 빈 종틀') : ''}
<div class="stage-text"><div class="palette" aria-label="${s.id}탄 팔레트 제안">${s.palette.map(c=>`<span style="background:${c}" title="${c}"><span class="sr-only">${c}</span></span>`).join('')}</div>
<p>${h(s.scene)}</p><p class="next"><strong>다음 항로</strong> ${h(s.bridge)}</p>
<details><summary>장면의 역할과 설계 메모</summary><p>${h(s.voyage)}</p><p><strong>세부 패널</strong> ${h(s.detail)}</p>${s.extraScene ? `<p>${h(s.extraScene)}</p>` : ''}</details></div></article>`).join('\n');
const guide = fs.readFileSync(path.join(out, 'WORLD_GUIDE.txt'), 'utf8').replace(/^\uFEFF/, '');
const spoilerStart = guide.indexOf('5. 개발용 스포일러');
const spoilerEnd = guide.indexOf('6. 공통 표현');
const guidePublic = guide.slice(0, spoilerStart);
const guideSpoiler = guide.slice(spoilerStart, spoilerEnd);
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(plan.title)}</title>
<style>
:root{color-scheme:light;--ink:#243c42;--paper:#f5eddd;--teal:#296b70;--brass:#a87d42;--line:#d5c4a7}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif;line-height:1.8}main{max-width:1340px;margin:auto;padding:36px 24px 72px}a{color:var(--teal);text-underline-offset:3px}a:focus-visible,summary:focus-visible{outline:3px solid #b3624f;outline-offset:5px}h1,h2,h3,p,figure{margin:0}h1{font-size:clamp(30px,4vw,54px);line-height:1.25;letter-spacing:-.04em;margin:12px 0 18px}h2{line-height:1.35;font-size:clamp(23px,3vw,33px)}h3{font-size:20px}p+p{margin-top:14px}.eyebrow{font-size:13px;letter-spacing:.08em;color:#7a6344;font-weight:700}.lead{font-size:18px;max-width:940px}.badge{display:inline-block;border:1px solid var(--brass);padding:5px 12px;border-radius:30px;font-size:13px}.notice{margin:24px 0;padding:20px 24px;background:#e8e5d5;border-left:4px solid var(--teal)}section{margin-top:48px}.section-head{margin-bottom:22px}.section-head p{margin-top:12px;max-width:930px}figure{background:#fffaf1;border:1px solid var(--line)}img{display:block;width:100%;height:auto}figcaption{padding:10px 16px;font-size:13px;color:#645a4b}.overview,.principles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.tile{border:1px solid var(--line);padding:22px;background:#fbf6ec}.tile strong{color:var(--teal)}.tile p{font-size:15px}.tile h3{margin:5px 0 10px}.refs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.refs figcaption{font-size:12px}.route-nav{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}.route-nav a{font-size:14px;text-decoration:none;border:1px solid var(--line);background:#fffaf1;padding:8px 12px;border-radius:4px}.stage{scroll-margin-top:24px;margin-top:40px;border:1px solid var(--line);background:#fffaf1}.stage-head{display:flex;align-items:center;gap:24px;padding:24px}.stage-no{font-family:Georgia,serif;font-size:64px;line-height:1;color:var(--brass)}.mood{font-size:15px;color:#665b4b;margin-top:7px}.stage figure{border-width:1px 0 0}.stage-text{padding:24px 28px;max-width:1040px}.palette{display:flex;gap:8px;margin-bottom:20px}.palette>span{display:block;width:52px;height:16px;border:1px solid #0002;border-radius:2px}.next{border-left:2px solid var(--brass);padding-left:16px;color:#52635f}details{margin-top:18px;border-top:1px solid var(--line);padding-top:14px}summary{cursor:pointer;color:var(--teal);font-weight:600}details p{margin-top:14px}.guide{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;max-width:980px;padding:12px 0}.foot{border-top:1px solid var(--line);margin-top:48px;padding-top:24px;font-size:14px;color:#675e51}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:900px){.overview,.principles{grid-template-columns:repeat(2,minmax(0,1fr))}.refs{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:540px){main{padding:24px 14px 48px}.overview,.principles{grid-template-columns:1fr}.stage-head{padding:18px;gap:16px}.stage-no{font-size:48px}.stage-text{padding:18px}.notice{padding:18px}.refs{gap:8px}.refs figcaption{padding:8px}.lead{font-size:16px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><main>
<header><p class="eyebrow">CLOUDSTITCH · WORLD & MAP MOODBOARDS · 2026.10.19</p><h1>열두 항로와<br>적조의 왕관</h1><p class="lead">${h(plan.premise)}</p><p style="margin-top:20px"><span class="badge">7권역 · 12탄 · 맵 보드 13장 + 세계 총람 1장</span></p></header>
<div class="notice"><strong>1탄과 2탄 보스의 확정 방향을 중심으로 조정했습니다.</strong><p>1탄은 종항의 종을 빼앗은 대장례함, 2탄은 패각·뼈·붉은 산호로 만든 포식자 항구입니다. 지역 사이의 사건 연결과 3~12탄 구성은 이번 세계관 제안입니다.</p></div>
<section aria-labelledby="atlas-title"><div class="section-head"><h2 id="atlas-title">수리한 배 한 척으로 이어지는 세계</h2><p>따뜻한 목재 항구에서 공중 심해를 거쳐, 바람·폭풍·조선소·잊힌 함대·봉인된 궁전으로 나아갑니다. 총람의 점선은 분위기의 연결을 나타내며, 진행 순서는 아래 01~12 목록을 따릅니다.</p></div>${figure(plan.atlas,'1탄 철갑 장례함과 2탄 적조의 왕관을 포함한 7권역 세계 총람','세계 총람 · 지형·거리·좌표의 확정 전 시각 제안',true)}</section>
<section aria-labelledby="world-title"><div class="section-head"><h2 id="world-title">세계를 묶는 세 가지 감정</h2></div><div class="principles"><div class="tile"><h3>수리하며 살아가는 하늘</h3><p>천을 꿰매고, 목재를 덧대고, 황동 잠금쇠를 다시 조입니다. 거대한 풍경 안의 주전자·빨랫줄·작업등이 이 세계의 생활을 이어줍니다.</p></div><div class="tile"><h3>빼앗긴 것의 출처를 따라</h3><p>종항의 종에서 시작한 항해가 포획된 배와 회수물의 흔적으로 이어집니다. 부품에 남은 기억은 물건의 주인과 세계의 과거를 묻는 단서입니다.</p></div><div class="tile"><h3>고요함이 키우는 압도감</h3><p>작은 쉼터 뒤에 거대한 협곡과 폭풍을, 활기찬 공방 뒤에 적막한 옛 함대를 둡니다. 같은 성을 반복하는 대신 큰 지형과 구조부터 바꿉니다.</p></div></div></section>
<section aria-labelledby="regions-title"><div class="section-head"><h2 id="regions-title">7권역으로 이어지는 12탄</h2><p>1탄은 출항과 보스 외해의 두 보드로 구성했습니다. 2탄의 적조 권역을 새로 연결하고, 협곡은 3탄 이후로 배치했습니다.</p></div><div class="overview">${overview.map(([n,title,forms,text])=>`<div class="tile"><strong>${n}</strong><h3>${h(title)}</h3><p>${h(forms)}</p><p>${h(text)}</p></div>`).join('')}</div></section>
<nav class="route-nav" aria-label="탄별 무드보드 바로가기">${plan.stages.map(s=>`<a href="#stage-${s.id}">${s.id} ${h(s.name.split(' · ').at(-1))}</a>`).join('')}</nav>
${stageHtml}
<section aria-labelledby="refs-title"><div class="section-head"><h2 id="refs-title">이어받은 확정 방향과 기준 그림</h2><p>주인공 함선의 재료와 1탄·2탄의 서로 다른 위압감을 기준으로 사용했습니다. 기지의 상징·포대 수·크기는 후속 제작에서 별도로 정리합니다.</p></div><div class="refs">${referenceCards.map(([title,src])=>figure(src,title,title)).join('')}</div></section>
<section aria-labelledby="guide-title"><div class="section-head"><h2 id="guide-title">세계관과 이야기 연결</h2><p><a href="WORLD_GUIDE.txt">세계관 가이드 전문</a> · <a href="catalog.json">12탄 구성표</a> · <a href="manifest.json">파일 목록과 검수 기록</a></p></div><details><summary>문화·세계 법칙·12탄의 연결 제안 읽기</summary><pre class="guide">${h(guidePublic)}</pre></details><details><summary>개발용 스포일러 · 기억과 증거의 공개 순서</summary><pre class="guide">${h(guideSpoiler)}</pre></details></section>
<footer class="foot"><p>내장 image_gen으로 제작한 정지 콘셉트입니다. 생성 결과의 시각 확인과 PNG·경로·해시·LFS 검사를 기록했습니다. 실제 3D 맵·전투·날씨·저장·성능·플레이 검증은 이 산출물의 범위에 포함하지 않습니다. 새 보드의 사용자 미술 검토는 별도입니다.</p><p>기존 보스 원화와 v1을 보존했습니다. v2는 v1의 01·03~12 보드를 재사용하므로 두 폴더를 함께 유지하세요. 프롬프트는 각 버전의 prompts/에 저장했습니다.</p></footer>
</main></body></html>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(plan, null, 2) + '\n');

if (plan.stages.length !== 12 || new Set(plan.stages.map(s=>s.id)).size !== 12) throw Error('Expected 12 distinct stages');
if (new Set(plan.stages.map(s=>s.region)).size !== 7) throw Error('Expected 7 regions');
const imagePaths = [plan.atlas, ...plan.stages.flatMap(s=>[s.image, ...(s.extraImage ? [s.extraImage] : [])])];
const images = imagePaths.map(p=>meta(path.resolve(out,p)));
if (images.length !== 14 || new Set(images.map(i=>i.path)).size !== 14) throw Error('Expected 14 distinct final images');
const references = referenceCards.map(([,p])=>meta(path.resolve(out,p)));
const before = readJson(path.join(root,'outputs/world-moodboards-v1/records/reference-before.json'));
for (const ref of before) if (meta(path.join(root,ref.path)).sha256 !== ref.sha256) throw Error(`Source changed: ${ref.path}`);
if (references[3].sha256 !== '41d2d5856fe540d2c4cae01fb37507c365f883e93cf89ac622349c908a321192') throw Error('Chapter2 original changed');
const links = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
const visibleText = html.replace(/<details\b[\s\S]*?<\/details>/g,'');
if (/선장의 부활|13세에 죽|12년 전13세/.test(visibleText)) throw Error('Explicit story spoiler outside collapsed development notes');
const fragments = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for (const link of links) {
  if (/^(?:https?:|\/\/|file:|[A-Z]:)/i.test(link)) throw Error(`Nonportable link: ${link}`);
  if (link.startsWith('#')) { if (!fragments.has(link.slice(1))) throw Error(`Fragment: ${link}`); }
  else if (!['manifest.json'].includes(link) && !fs.existsSync(path.resolve(out,link))) throw Error(`Missing: ${link}`);
}
const attr = spawnSync('git',['check-attr','filter','--',...images.map(i=>i.path)],{cwd:root,encoding:'utf8'});
if (attr.status !== 0 || attr.stdout.trim().split(/\r?\n/).length !== 14 || !attr.stdout.trim().split(/\r?\n/).every(l=>l.endsWith(': lfs'))) throw Error('LFS coverage');
const promptFiles = ['outputs/world-moodboards-v1/prompts','outputs/world-moodboards-v2/prompts'].flatMap(dir=>fs.readdirSync(path.join(root,dir)).filter(n=>n.endsWith('.txt')).map(n=>meta(path.join(root,dir,n))));
const report = {
  revision:'world-moodboards-v2', date:plan.date, title:plan.title,
  userConfirmed:['1탄 종을 삼킨 자·대장례함 비주얼','2탄 적조의 왕관 보스권역 비주얼 방향'],
  proposals:['7권역·12탄의 공간과 사건 연결','3~12탄의 환경 구성','2탄과 기존 조선소 정사의 연결'],
  counts:{regions:7,stages:12,mapBoards:13,atlas:1,finalImageFiles:14,reusedV1Images:11,newV2Images:3},
  generation:{mode:'built-in image_gen',fallbackCLI:false,rawImagesReencoded:false,totalCallsAcrossRevisions:21,v1Calls:17,v2Calls:4,prompts:promptFiles},
  images,references,
  documents:['index.html','catalog.json','WORLD_GUIDE.txt','HANDOFF.txt'].map(p=>meta(path.join(out,p))),
  verification:{pngSignatureIHDRIEND:true,dimensionsAll:'1536x1024',sha256Recorded:true,relativeLinksChecked:links.length,missingLinks:0,lfsAllFinalImages:true,referenceImagesUnchanged:4,knownExplicitSpoilerPhrasesOutsideCollapsedNotes:0,assistantVisualReview:true,browserLayoutTest:false,userArtApproval:'new boards awaiting review; two boss visual directions user-confirmed'},
  limitations:['정지 콘셉트. 실제 게임 맵·3D·전투·밸런스 검증 아님','총람 점선은 분위기 연결로 실제 진행순서·거리·좌표를 확정하지 않음','11탄 상승 비의 방향은 정지 이미지로 확정하기 어려움','생성 이미지의 작은 문양·포대 수·장치 배치를 시스템 명세로 삼지 않음','v2는 v1의 채택 보드를 상대경로로 참조하므로 두 폴더를 함께 보존'],
  sources:['tools/world-moodboards-v1/stage-plan.json','tools/world-moodboards-v1/stage-plan-v2.json','tools/world-moodboards-v1/build.mjs','outputs/world-moodboards-v1/records/05-08.json','outputs/world-moodboards-v1/records/09-12.json','outputs/world-moodboards-v2/records/02.json']
};
fs.writeFileSync(path.join(out,'manifest.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',...report.counts,pngSize:'1536x1024',relativeLinks:links.length,referencesPreserved:4,browserTest:false}));
