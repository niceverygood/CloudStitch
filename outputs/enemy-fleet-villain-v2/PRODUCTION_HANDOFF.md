# Cloudstitch · 적선 주형태 재설계 v2

사용자 요청: 훨씬 악당답게, 각 세력과 기체의 캐릭터를 과할 정도로 구별한다. 공통 최신 기준은 10배 이상 과감한 형태·재료·움직임이다. 표현 목표이며 scale나 장식 개수의 배수가 아니다.

v1 실제 전후 4종은 기술 캡처 PASS와 별개로 미술 목표 미달이다. 그 GLB와 PNG, SOURCE_READY_3 및 이전 교정 기록은 보존한다. v2는 기존 GLB 위에 부착물을 더하지 않는다. 빈 씬에서 새 주선체를 구성한다.

소유 범위는 기존 ID 12종. reference6과 boss-bell-devourer는 읽기 전용이며 별도 소유자가 제작한다. 새 종류를 추가하지 않는다. 기획 modules·통계와 원 ID는 보존하고, 새 artModules·8개 표시용 클립(기존 형식 7개 + ThreatDisplay)은 시각 제안으로 분리한다. 실제 충돌·피해·장착·저장 구현은 없다.

대표 검토 순서는 징세정 + 최후의 들숨 2종 → 실제 같은 카메라/FloatIdle 2초 비교 → 정화선/망령선 → 나머지8이다. 준비된 소스12가 모델12 완료나 미술 승인을 뜻하지 않는다. 다음 중앙 단일 브라우저/export 슬롯에서 대표2만 우선 출력한다. 통합이 대표4로 승인하면 해당 4 ID를 명시한다.

주형태: 징세의 거대 처형 관문/턱/비뚤어진 철창 저울, 정화의 매달린 장례 성당/열린 늑골/3향로, 망령의 찢어진 가오리/실제 날개 구멍/척추포, 마지막 들숨의 한 기계 심장/3개 비틀린 봉인탑/깨진 순환 고리. 나머지는 코뿔소 경비, 들소 예인, 맹금 정찰, 쌍포신 야수, 삼중 성문, 관 마차, 고래 뼈 건선거, 절단 왕좌다. 따뜻한 수공예 재료와 붓결 atlas·단순 정점 명암을 재사용한다.

경량 검사: preflight.cjs의 dummy material/빈 씬 12종 geometry·UV·재질·고유 이름·유한 변환/ThreatDisplay 검사 PASS. 마지막 심장1/봉인탑3 확인. GLB/브라우저/export/rigskin 실행0. build --prepare의 browser bundle 성공, 모델 읽기0. 실제 렌더와 사람의 미술 승인은 미완이다.

기존 로컬 의존성 work/combat-vfx-v2/deps/node_modules의 three/esbuild를 사용한다. Playwright 제공 경로는 실행 환경의 NODE_PATH로 주입한다. 설치나 공통 package/lock 변경은 없다.

슬롯 승인 후 실행:

```
node tools/enemy-fleet-gallery/villain-v2/build.cjs --execute --ids=enemy-tax-cutter,boss-last-inhale
node tools/enemy-fleet-gallery/villain-v2/comparison/pairs-from-models.cjs --out=outputs/enemy-fleet-villain-v2/pairs-first2.json --ids=enemy-tax-cutter,boss-last-inhale
node tools/enemy-fleet-gallery/villain-v2/comparison/capture.cjs --pairs=outputs/enemy-fleet-villain-v2/pairs-first2.json --out=outputs/enemy-fleet-villain-v2/comparisons-first2
```

실제 baseline GLB는 해시만 확인하고 새 형상 제작에는 로드하지 않는다. 새 모델의 공통 아트 단위를 이전 관측 X길이/18로 매핑하고 이전 minY/중심 XZ에 맞춘다. 비교는 전후 bounds 합집합에 단 하나의 orthographic camera를 적용한다. 개별 모델 화면 크기 맞춤은 없다. 비교기는 두 모델의 동일한 FloatIdle 2초를 사용한다. 별도 위협 동작은 뷰어 ‘위협 장치’에서 확인한다. PNG는 실제 GLB를 렌더한 결과이며 미술 승인 자동 판정은 하지 않는다.

브라우저·export는 finally close. 출력 모델은 덮어쓰지 않으며 새 출력은 새 revision을 쓴다. OutlineEffect.autoClear=true는 기존 뷰어/비교기에 명시 유지한다. 새 출력의 ships HTML은 해당 폴더 .gitattributes로 LFS 추적한다. 원 atlas·원 GLB·frozen gallery-v1 17개 파일은 변경하지 않는다.

새 통합19 갤러리 소비자는 별도 경량 준비 중이며 이 producer freeze에는 포함하지 않는다. reference6 최신 actual READY와 독립 보스의 PNG/GLB SHA 결합이 제공된 뒤 별도 freeze한다.
