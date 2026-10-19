const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'outputs/combat-impact-comparison-v1');
const read=p=>JSON.parse(fs.readFileSync(path.join(OUT,p))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const visual=read('verification-final/browser.json'),timing=read('verification-timing/browser.json');
if(!visual.passed||!timing.passed||!visual.browserClosed||!timing.browserClosed)throw Error('Actual browser validation incomplete');
for(const p of read('baseline-inputs.json'))if(sha(fs.readFileSync(path.join(ROOT,p.path)))!==p.sha256)throw Error('Original changed: '+p.path);
const manifest=read('manifest.json'),html=fs.readFileSync(path.join(OUT,'index.html'));if(sha(html)!==manifest.output.sha256)throw Error('Runtime output differs from built manifest');
const text=`Cloudstitch · 함포 한 발 / 기관총 2초 연사 비교

열기: index.html을 Chrome/Edge 등 최신 브라우저에서 엽니다. HTML 자체에 실제 함선·무기·효과·음원이 포함되어 있어 서버 없이 사용할 수 있습니다.
1. 함포 한 발 또는 기관총 2초 연사를 고릅니다.
2. 소리와 함께 재생을 누릅니다. 왼쪽 기존, 오른쪽 신규입니다.
3. 소리 선택에서 기존/신규를 바꿔 다시 재생합니다. 비교 음량 보정은 기본 켜짐입니다.
4. 포구/발사체/명중면 버튼과 시간 슬라이더로 같은 순간을 비교합니다. 모바일은 신규 크게 보기로 시작합니다.

새 표현: 선체에 연결한 원형 무기 받침과 지지대, 큰 비대칭 입체 붓꽃, 노출된 크림빛 핵, 늦은 곱슬 연기, 실제 탄체 좌표의 굵은 붓꼬리, 무기별 빠른 반동과 복귀, 표적 목재 파열·잔해·분리된 포구압과 재료음.
최신 10배 이상 과감함은 질적 체감 목표입니다. 크기·gain 배수만으로 완료 판단하지 않습니다. 사람의 미술·청감·손맛 승인은 아직 별도입니다.

실제 검사: 기존 sim 기반 MG10발/10명중/80피해, 함포1발/1명중/9피해, 빗나감0명중, 실제 원GLB 포구/지지대/반동독립의 Node8검사. 첫 통합 브라우저31항목과 후속 오디오 시퀀스/절대clock/file URL14항목을 구분해 통과했습니다. 16 WAV 실제decode, 세 표시모드, 모드별120프레임 실제회전 후 동일출력, 390/768 넘침없음, 정지·재시작·수명, 원본11개SHA 유지, 외부HTTP0을 확인했습니다.

청취 파일: audio/comparison-cannon.wav(7.6초), audio/comparison-machinegun-2s.wav(6.4초). 모두 기존 → 0.4초 무음 → 신규입니다. 실제 이벤트의 시각으로 배치하고 전체클립 stereo RMS를 보정했습니다. LUFS 또는 동일 체감 음량 보장은 아닙니다.

한계: 독립 비교 시연입니다. 함포는 기존 적 훈련 함포의 실제 발사·충돌을 귀환호 장면에 대응시켰으며 플레이어 함포/캠페인에 새로 설치하지 않았습니다. 시험 표적은 원형 판정과 목재 형상이며 메시 삼각면 충돌·영구 파괴는 아닙니다. 단일 메시 무기는 전체 무기 반동이고 포신 부품 분해 리그는 아닙니다. 기존 큰 방패와 전개 받침발은 원 함선 GLB 구성입니다.

보존: 최초 verification/ 실패·포구가림 캡처, 수정 verification-r2/, 통합 verification-final/, 후속 verification-timing/을 그대로 보존합니다. 최초 외부요청 실패는 내장 blob URL을 외부로 잘못 분류한 검사 문제였으며 후속은 실제 HTTP만 검사했습니다. 원 함선/무기/VFX/음원/sim/공통package/다른 담당 출력은 덮어쓰지 않았습니다. 유료/API/다른채팅메시지/배포/commit/push0.
소스·재현·상세한계: tools/combat-impact-comparison-v1/README.md
`;
fs.writeFileSync(path.join(OUT,'README.txt'),text);
const scope=read('SCOPE.json');Object.assign(scope,{status:'READY_LOCAL_COMPARISON',browserOrExporterStarted:true,exporterRuns:0,isolatedLocalBrowserValidated:true,browserClosed:true,sourceOriginalsPreserved:true,visualChecks:31,timingChecks:14,humanArtApproved:false,humanListeningApproved:false});fs.writeFileSync(path.join(OUT,'SCOPE.json'),JSON.stringify(scope,null,2));
manifest.browserVerified=true;manifest.validation={visual:{report:'verification-final/browser.json',checks:visual.checks.length,scope:'prior visual/runtime31; preserved before audio-sequence followup'},timing:{report:'verification-timing/browser.json',checks:timing.checks.length,scope:'final file URL and sequence clock/Native audio/pause/resume/dispose14'},sourceAuthorityTests:8,humanArtApproved:false,humanListeningApproved:false};fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2));
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=[...walk(path.join(ROOT,'tools/combat-impact-comparison-v1')),...walk(OUT)].filter(p=>!p.endsWith(path.sep+'READY.json')).map(p=>{const b=fs.readFileSync(p);return{path:path.relative(ROOT,p).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};});
const ready={revision:manifest.revision,status:'READY_LOCAL_COMPARISON',createdAt:new Date().toISOString(),entry:'outputs/combat-impact-comparison-v1/index.html',files,artifactFileCount:files.length,artifactCountIsNotTestCount:true,readOnlyInputs:manifest.readOnlyInputs,validation:manifest.validation,initialFailuresPreserved:true,technicalPassed:true,humanArtApproved:false,humanListeningApproved:false,tenfoldExpressionApproved:false,gameplayInstalled:false,otherChatsMessaged:false,paidRequests:0,gitCommitPush:false};fs.writeFileSync(path.join(OUT,'READY.json'),JSON.stringify(ready,null,2));console.log(JSON.stringify({status:ready.status,files:files.length,visualChecks:visual.checks.length,timingChecks:timing.checks.length,sha256:manifest.output.sha256}));
