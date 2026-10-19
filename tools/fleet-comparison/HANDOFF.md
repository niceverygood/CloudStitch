# Cloudstitch 함대 비교판 인계

2026-10-18 **READY-2**. 사용자의 우리편/적군 비교·제작 비행선 전체·판별 중간/최종보스 열람 요청으로 별도 비교판을 만들었다. 기존 `fleet-v2` 174파일의 manifest SHA `916c3e9790818490ee6d4457b7e41d8fe23cc49130996f64512a3c2a2657f68e`를 보존하고 새 `tools/fleet-comparison/`, `outputs/fleet-comparison-v1/`만 쓴다.

## 화면과 정확한 범위

- 두 이미지 비교, 우리편/적군·우리편/보스·같은 편 비교 프리셋, 좌우 선택·카드 배치, 이름/세력/진영/보스 필터.
- 카탈로그71항목은 현재v2 62와 초기 대안의v1 리그 해석9다. 장비 구성·상태·역할·시설·기록을 포함하므로71고유 정사 함선이 아니다. 같은62항목의 과거v1 외형을 이전 보기로 연결한다.
- 기존v1 design-a1~c3를 raw고밀도 원본9개와 혼동하지 않는다. 원본은 `outputs/airship-models-9/model-manifest.json`의 A1~C3다. 별도 참고 영역에 기존 원본 렌더PNG9와 실제GLB 다운로드를 제공한다. 같은 디자인의 다른 출력을9새함종으로 합산하지 않는다.
- 우리편12·적군19·중립/상황별29·참고11. 참고11은 대안9와 기록1/미완골격1이다. 우리편12도 플레이어 한 척의 빌드/결말/지원과 동료 맥락이 포함된다. 상시 동시 출전 함대12척이 아니다. 라이벌6·왕의 시험은 세계관 전체의 영구 적대와 구별한다.
- 여섯 판은 현행 교전 시제품이다. 실제 catalog의 중간/최종12 assetId를 대조했다. 2/3판은 기존 일반선의 훈련용 지휘 역할이며 독립 정사 보스는 미정이다. 조선소 시설/지휘함3단계, 데모경비선/본편보스, 왕의 비살상 시험을 별도 설명한다.

## 이미지·보존·통합

정지캡처 슬롯: 2026-10-18 17:51:42 KST 시작, Node PID29312/session45447, exit0·프로세스/직계브라우저0 확인 후 통합담당에 슬롯 반환했다. 예정58신규에서 초기 대안9도 기존 캡처를 재사용할 수 있어 실제 새렌더49로 줄었다. 최신v2 SHA 일치 복사13과v1 리그 해석 복사9를 더해 주목록PNG71이다. 고밀도 원본 렌더9도 기존 파일을 복사했다. 새 GLB/유료 생성은 없다. 초기 생성·캡처 로그는 `previews.json`에 ID별 모델SHA/이미지SHA/방식을 기록한다.

기존 모델·뷰어·원화·교전·저장·공통 package/lock은 읽기 전용이다. 비교 화면은 기본0개 WebGL이고 선택한 한 척만 iframe으로 연다. 이전 것을 제거한 후 다음을 만든다. 정적 정책은 GPU 자원 해제 검증과 구별한다. 모델의 -X/+Y 축, 임시 크기와 기존 충돌/포구/소켓 연결을 바꾸지 않는다. battlefield의 유일한 상태/시간/피해 소유권을 유지한다.

## 검사·실행과 한계

READY-1은 실제 시제품12슬롯을 모두 표시했지만 정사 설명 집계가 중간보스 미정6칸을 숨겼다. 통합 담당의 import/브라우저 실행 전에 읽기 전용 감사에서 발견했다. 원95파일+manifest(`27a4a060a85f58f66762e9b68bb7b855a65ccc36bb7bebf5f352b988fa282e97`)를 `work/history/fleet-comparison-ready1-27a4a060/`에 실제SHA/크기 대조·복사 후 재확인해 보존했다. 이 로컬 history는 커밋 대상이 아니다.

READY-2는 정사6지역×중간/최종12칸과 미확정8칸을 각각 표시하며, 조선소 최종시설과 중복하지 않는 지휘함 구성 요소1행을 추가한다. `data-canon-stage-id/slot/status`로 실제DOM 검증할 수 있다. 브라우저QA에도 중간6·최종6·미정8·구성요소1과12개 개별 매핑 검사를 추가했다. UI/검사/버전 문서와 재빌드 출력만 바뀌며 PNG80/GLB/기존v2174는 변경하지 않았다.

`capture.cjs`는 새비교판 PNG만 만든다. `build.cjs`는 현재catalog/roster/이미지로 HTML과inventory를 생성한다. `verify.mjs`는 ID/근거/PNG해시/경로/크기/6판배정/기존manifest를 검사한다. 실제 정적검사 결과는 `outputs/fleet-comparison-v1/verification-structure.json`을 따른다. 모델 전체 재해시, 시각 선호 판정, 원본 전체 corpus 전후 재해시는 실행하지 않는다.

`browser-qa.cjs`는 통합담당의 예약된 단일Chrome/페이지1개용이다. 제작담당은 구문·도움말만 검사했고 브라우저QA를 실행하지 않았다. 기본 새 비교판 URL을 임시localhost에서 열고 이미지71+원본9 decode, 6판/12슬롯, 필터·좌우비교·프리셋, v2/v1/이전v1 실제GLB, 모바일390 넘침과 요청/페이지오류를 확인한다. 원본고밀도GLB9는 HEAD만 하며 렌더하지 않는다. 3모드/7클립·잔상·성능·전투·밸런스·최종 손그림 품질을 다시 검사하지 않는다. 보고서·스크린샷은 `outputs/fleet-comparison-browser-qa-v1/`의 별도 범위다. 원래fleet-v2 553검사/strictPNG실패25건·별도decoded진단을 덮어쓰지 않는다.

```sh
node tools/fleet-comparison/build.cjs
node tools/fleet-comparison/verify.mjs
node tools/fleet-comparison/browser-qa.cjs
node tools/fleet-comparison/snapshot.cjs
```

브라우저는 다른 담당의QA와 겹치지 않게 예약한다. 기존 설치 의존성을 사용하며 새설치/공통package 변경은 없다. 비교판 자체는 기존fleet-v1/v2와raw9 경로에 읽기 의존성이 있다. 원본을 복제해서 새모델로 세지 않는다. PNG는 기존LFS규칙 대상, 새HTML은 GLB를 내장하지 않는 비교UI다. commit/push/배포는 실행하지 않았다. 새 manifest는 소스/출력 실제파일SHA와 브라우저검사 대기 범위를 포함한다.
