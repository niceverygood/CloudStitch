# Cloudstitch 악당 외형 v3 인계

기준일: 2026-10-18. 상태: **ART READY / viewer UI QA 중앙 예약 pending**. 실제 산출물·구조·비교 캡처가 준비되었으며 최종 freeze는 통합 담당이 수행한다.

## 목적과 표현

기존 참고판 6척에 최신 ‘현재보다 10배 이상 과감하고 극적이며 풍성한’ 표현 기준을 적용하는 새 revision이다. 따뜻한 수공예 판타지와 손그림 같은 입체 3D, 세력별 재료·색을 유지한다. 단일 scale 배수가 아니라 큰 주형태→중간 기능 장치→작은 재료층과 부속의 후속 움직임으로 설계한다.

- 해적: 거대한 빈 턱과 단측 사냥돛.
- 교단: 계층 테라스와 거대한 열린 종 아치.
- 인양선: 선체급 낫 턱과 포획 쇄기.
- 수리대: 아치 화로와 절단팔.
- 망령: 초승 낫 척추, 넓은 후미 누더기와 영혼 기관.
- 잔해 위장선: 접힌 대형 덫과 밝은 핵.

이 형태들은 외형 제작 제안이다. 특정 영화의 고유 구조·장면을 재현하거나 정사에 새 적 종류를 추가하지 않는다. 실제 10배 체감 충족과 사람의 미술 승인은 렌더 확인 후에도 별도로 남는다.

## 계약과 보존

원래 6개 `id`를 유지하며 `variantId`는 `<id>--villain-v3`, `baseVariantId`는 `<id>--villain-v2`, `baseModelSha256`은 v2 GLB 해시를 사용한다. 원문 `modules`의 정수/미정 `null`을 유지하고 새 `artModules`를 실제 무장 수로 해석하지 않는다. sim 피해·충돌·socket·AI·저장 변경은 0이다.

원래 7클립 이름과 위장선 `AmbushReveal`을 보존하는 총 43클립, 약점 12개, 위장 전개 관절 3개를 실제 GLB 구조검사로 확인했다. 원 controls와 약점 정체성을 유지한다.

v2 ART49, v1 ART53, 이전 함대 174파일·비교판 95파일 동결 원본에 쓰지 않는다. v1 원화·painted atlas를 읽기 재사용하며 신규 ImageGen/Meshy 호출은 각각 0회다. 새 출력은 `outputs/enemy-fleet-reference-v3/`에 둔다. 새 19종 갤러리 담당은 별도 13종과 이 6종을 읽어 통합하며 동일 6종 모델을 중복 생성하지 않는다.

## 현재 검사와 미완

세 pair 소스의 메모리 조립에서 유한 기하, 약점, 원 controls와 `artModules` 유지가 PASS로 인계되었다. 이것은 실제 GLB·텍스처 디코딩·스킨·브라우저 검사 결과가 아니다.

실제 CPU GLB export 6척과 구조검사 6/6 PASS가 완료되었다. 합계 400,824삼각형 / 66,993,056바이트 / 43클립 / 약점12 / 전개관절3 / 유한 FLOAT 8,145,188값 / 외부 URI0이다. `structural-verification.json`이 실제 바이너리 검사 근거다.

`capture-receipt.json`과 `matched-execution-receipt.json`에서 실제 GLB 일반 PNG6·실루엣6·위장 전개1·종합판2 및 matched-before/after 6쌍 생성, capture/verify/preview binding 각각 exit0, code11 전후 SHA 보존과 browser finally close를 확인했다. `preview-bindings.json`은 PNG 자체 SHA와 해당 GLB source SHA를 결속한다. export 근거는 `export-receipt.json`에 보존한다.

ART READY는 산출물 인계 상태다. 뷰어 브라우저 `--quick` UI QA는 별도 중앙 예약 pending이며, 장기 성능·정밀 decoded 잔상·전투/게임 적용·사람의 미술 승인과 최신 10배 체감 목표의 최종 승인은 별도다. 최종 source/dependency manifest freeze는 문서 완료 후 통합 담당이 수행한다. 이 문서 작성 담당은 소형 보고서만 읽었으며 export·브라우저·설치 검사를 실행하지 않았다.

## 통합 실행과 비교

저장소 루트에서 기존 Node 런타임 및 설치된 의존성을 사용한다. 필요하면 기존 설치 위치를 `NODE_PATH`로 연결하되 계정별 절대 경로를 이식 의존성으로 기록하지 않는다. 공통 package/lock을 임의 변경하거나 새 설치하지 않는다. 재현 시 중앙 슬롯에서 다음 작업을 순차 실행한다. export·구조·capture는 완료했으며 UI QA는 아직 실행 대기다.

```sh
node tools/enemy-fleet-reference/villain-v3/build.cjs --resume
node tools/enemy-fleet-reference/villain-v3/verify.mjs
node tools/enemy-fleet-reference/villain-v3/capture.cjs
node tools/enemy-fleet-reference/villain-v3/browser-qa.cjs --quick
```

build/capture/브라우저 작업은 겹쳐 실행하지 않는다. 비교 PNG는 v2/v3를 같은 카메라·화면 범위·원점·scale 1·`FloatIdle` 2초로 고정한 matched-before/after 조건으로 제시한다. 모델별 화면 맞춤 thumbnail은 이 공정 비교의 대체 증거가 아니다. 실제 6쌍의 카메라·화면 범위·scale1·원점0·FloatIdle 2초 조건 strict 일치를 보고서로 확인했다.

뷰어는 실제 GLB 로드·세 표시 모드·약점·조작·위장 전개 복원·모바일·외부 요청을 검수하고 `OutlineEffect.autoClear = true`를 유지한다. `--quick`의 실제 범위만 기록하고 과거 전수 QA를 재실행한 것으로 표시하지 않는다. 최종 source/dependency manifest·실제 모델/preview 해시·구조/브라우저 보고서와 미완 한계를 결속해 최종 freeze한다. UI QA pending을 ART READY와 구분해 전달한다.
