# Cloudstitch · 함선·무기 조화 합성

공통 계약 `docs/SHIP_WEAPON_MOUNTING.json`에 따라 최종 `ranks-1to5-v2`의 5성 기동/포격/인양과 기존 무기3을 별도 합성한다. 원본함선/무기/텍스처파일은 수정하지 않는다. 결과는 `outputs/ship-weapon-harmony-v1/`의 GLB3/placement/오프라인비교/PNG다.

`assembly.js`는 무기 uniform scale·기준점·yaw(-π/2)·맞춤목재안장·황동브래킷·케이블을 작성한다. 기존 독립전시용받침은 파싱된복사본에서만 제외한다. 포격은 Active cannon barrel 두복사그룹만 제거하고 기존 포방패/포대/반동지지 구조 앞에 로켓으로 교체한다. 함선root는[1,1,1]을유지한다. 원형GLB 하이라이트정점색중1초과는합성복사본에서만0~1정리하고개수를기록한다.

검토런타임은 같은 camera/조명/배율로 왼쪽bare ship과 오른쪽assembled를 그린다. 작은화면은 위/아래다. 합성GLB를 실제export한뒤 build가 다시내장하여 최종리뷰는 실제저장GLB를다시읽는다. geometry-only CPU검사는별도이며export된텍스처검사로주장하지않는다.

기존설치 Node/three/esbuild/playwright/gltf-validator/sharp를사용하며실제설치위치를 NODE_PATH/GLTF_VALIDATOR_PATH에설정한다. 공통package/lock/서버를수정하거나설치하지않는다.

```sh
node tools/ship-weapon-harmony-v1/check-source.cjs
node tools/ship-weapon-harmony-v1/build.cjs
```

중앙slot 명시START후에만 다음을실행한다. 전체검사와포격한정후속은다른증거다.

```sh
node tools/ship-weapon-harmony-v1/verify.cjs --slot-start
node tools/ship-weapon-harmony-v1/verify.cjs --slot-start --branch artillery
```

검사실행은소유출력을다시쓰므로이전revision/실패를보존한다. 최종소유파일과source/readonly SHA는READY-r2.json을따른다. STATIC 아트합성으로 게임socket/물리/조준/피해/저장/무게예산은없다. 동작영역/충돌은미검증이며정지미술확인과실제플레이를구분한다.
