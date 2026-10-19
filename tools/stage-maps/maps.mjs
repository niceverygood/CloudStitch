/**
 * Cloudstitch six-region playable spatial proposals, revision 2.
 * Coordinates are XZ/Y-up prototype LU, not metres or campaign geography.
 * This module owns no simulation time, unlocks, damage, cargo or saves.
 */
const FRAME = 'levels-lu-yup-v1';
const point = (x, z, y = 0) => [x, y, z];
const visual = (id, assetId, position, longestLU, priority = 'required', yawRadians = 0) => ({id, assetId, position, longestLU, priority, yawRadians, anchor:'center'});
const terrain = (id, assetId, x, z, radius, longestLU, yawRadians = 0) => ({
  visual: visual(id, assetId, point(x,z,-4), longestLU, 'required', yawRadians),
  collider: {id:`${id}-solid`, kind:'solid', center:point(x,z), halfExtents:[radius,9,radius], visualIds:[id], occludesCamera:true, cameraPolicy:'fade-visual-only', legacyCircleXZ:{id:`${id}-circle`,x,z,radius}, note:'Authored conservative planar footprint; not mesh physics.'}
});
const path = (id, name, coordinates, widthLU = 20) => ({id,name,widthLU,points:coordinates.map(([x,z])=>point(x,z))});
const objective = (id, label, x, z) => ({id,label,position:point(x,z)});
const sourceRefs = ['tools/encounters/catalog.json','outputs/08-world-map.txt','outputs/33-level-layouts.txt','outputs/69-regional-harbors.txt','outputs/world-assets/catalog.json','outputs/world-assets/scene-catalog.json'];

function map({id,order,stageId,name,region,sceneId,description,theme,landmark,obstacles,extraVisuals,keyVisualIds,spawns,objectives,corridors,pockets}) {
  const visibleIds = new Set([...obstacles.map(item=>item.visual.id),...keyVisualIds]);
  const visuals = [
    ...obstacles.map(item=>item.visual),...extraVisuals,
    visual('return-buoy-west','beacon-buoy',[-12,-1,67],4),
    visual('return-buoy-east','beacon-buoy',[12,-1,67],4),
    visual('return-console','departure-console',[0,-5,78],4,'landmark')
  ].map(item=>({...item,priority:visibleIds.has(item.id)?'required':'decoration'}));
  return {
    id,order,stageId,name,region,sceneId,description,theme,landmark,objectives,
    seaLevel:{
      id:`${id}-sea`, name, frameId:FRAME,
      provenance:{status:'new-stage-spatial-proposal',sourceRefs:[...sourceRefs],sceneReference:`outputs/world-assets/scenes/${sceneId}.glb`,note:'Independent placements reuse catalog assets. Original scenes and first-voyage are preserved. Stage selection is a prototype choice; no story unlock or weather damage is implied.',visualBudgetNote:'Exactly eight required catalog visuals: every solid footprint plus explicitly selected regional landmarks. Other preserved placements are deferred decorations. The unchanged renderer draws the actual return ring separately from catalog assets.'},
      bounds:{min:[-90,-10,-90],max:[90,10,90]},flightY:0,
      artFrame:{origin:[0,0,0],unitsPerArtUnit:1,yawRadians:0,hostUnitsPerLU:1,note:'XZ/Y-up prototype LU; no approved metre conversion.'},
      playerStart:{position:[0,0,55],headingRadians:Math.PI},
      camera:{elevationDegrees:55,projection:'orthographic',halfHeightLU:35,followOffsetLU:[0,55,38.51],occlusionSamples:['center','top','left','right'],fadeOpacity:.22,restoreOnClear:true},
      visuals,
      colliders:obstacles.map(item=>item.collider),
      spawnAnchors:spawns.map(([x,z],index)=>({id:`enemy-${index+1}`,position:point(x,z),headingRadians:0,tags:['enemy',...(index<2?['opening-candidate']:index<4?['mid-candidate']:['late-candidate'])]})),
      triggers:[{id:'return-to-jonghang',type:'return-request',center:[0,0,67],halfExtents:[8,5,8],target:'jonghang-harbor',owner:'harbor',requiresConfirmation:true,hostLegacyCircleXZ:{x:0,z:67,radius:12},note:'Availability only. Controller owns return confirmation, receipt and safe saving.'}],
      corridors,
      turningPockets:pockets.map(([x,z],index)=>({id:`turn-${index+1}`,center:point(x,z),radiusLU:9})),
      referenceTargets:objectives.map(item=>({id:`reference-${item.id}`,position:[...item.position],radiusLU:2,note:'Navigation/readability marker; not a spawned enemy, reward or story completion.'}))
    }
  };
}

export const stageMaps = [
  map({
    id:'map-01-harbor',order:1,stageId:'stage-01-harbor',name:'1 · 종항 잔해 삼거리',region:'종항 잔해해역',sceneId:'jonghang-harbor',
    description:'따뜻한 종항 불빛을 등지고 중앙 잔해의 동쪽 길과 서쪽 넓은 우회를 골라 항해한다.',
    theme:{sky:'#c2dcdd',cloud:'#faf4e5',accent:'#c77955'},landmark:'중앙 난파선과 멀리 보이는 빈 종틀',
    keyVisualIds:['empty-bell','wreck-crane','return-buoy-west'],
    obstacles:[
      terrain('central-wreck','wreckage-shoal',-8,2,11,24),terrain('east-island','island-grass-medium',55,5,11,25),
      terrain('west-rock','island-rock-tall',-61,-48,10,26),terrain('north-island','island-grass-small',48,-62,9,21),
      terrain('home-island','island-grass-small',-62,35,9,21)
    ],
    extraVisuals:[
      visual('empty-bell','empty-bell-frame',[-62,7,35],8,'landmark'),
      visual('wreck-crane','salvage-crane',[-8,5,2],10,'landmark'),
      visual('west-cloud','cloud-bank',[-55,-25,-8],50,'decoration'),visual('east-cloud','cloud-bank',[58,-27,-38],42,'decoration')
    ],
    spawns:[[18,15],[42,-18],[-22,-30],[8,-50],[-44,-5],[24,-66]],
    objectives:[objective('approach','잔해 동쪽 항로 확인',25,15),objective('destination','북쪽 회수 해역',0,-48)],
    corridors:[
      path('main-flight','잔해 동쪽 항로',[[0,55],[25,30],[25,-5],[0,-40],[0,-55]]),
      path('west-bypass','서쪽 넓은 우회',[[0,55],[-35,20],[-35,-40],[0,-55]]),
      path('return-approach','종항 귀환',[[0,-55],[-35,-40],[-35,20],[0,55],[0,67]])
    ],pockets:[[0,55],[25,30],[0,-55],[-35,-40]]
  }),
  map({
    id:'map-02-canyon',order:2,stageId:'stage-02-canyon',name:'2 · 상승기류 사슬 협곡',region:'청록빛 상승기류 협곡',sceneId:'updraft-canyon',
    description:'청록 절벽 사이 두 번 꺾이는 넓은 항로를 따른다. 구름 기둥과 풍향계는 지역 장식이며 바람 피해를 만들지 않는다.',
    theme:{sky:'#beddd9',cloud:'#edf5e9',accent:'#4c9690'},landmark:'교차하는 절벽 턱과 청록 광물',
    keyVisualIds:['teal-mineral','wind-vane'],
    obstacles:[
      terrain('north-east-ledge','cliff-ledge',24,28,9,22,-.2),terrain('middle-west-ledge','cliff-ledge',-28,-1,9,22,.2),
      terrain('south-east-ledge','cliff-ledge',22,-43,8,20,-.25),terrain('west-cliff','island-rock-tall',-55,18,10,30),
      terrain('east-cliff','cliff-arch',55,-12,10,26,Math.PI/2),terrain('south-west-cliff','island-rock-tall',-51,-52,10,30)
    ],
    extraVisuals:[
      visual('teal-mineral','mineral-outcrop-teal',[24,7,28],10,'landmark'),visual('wind-vane','wind-vane',[-28,8,-1],6,'landmark'),
      visual('updraft-west','cloud-column',[-65,-20,-20],45,'decoration'),visual('updraft-east','cloud-column',[68,-20,40],44,'decoration')
    ],
    spawns:[[-20,29],[18,2],[-15,-29],[0,-60],[-24,53],[45,30]],
    objectives:[objective('first-bend','첫 굴곡 통과',-22,28),objective('second-bend','두 번째 굴곡',18,0),objective('destination','협곡 끝 회전 공간',0,-58)],
    corridors:[
      path('main-flight','넓은 두 굴곡',[[0,55],[-22,28],[18,0],[-18,-28],[0,-58]],18),
      path('return-approach','굴곡을 따라 귀환',[[0,-58],[-18,-28],[18,0],[-22,28],[0,55],[0,67]],18)
    ],pockets:[[0,55],[-22,28],[18,0],[-18,-28],[0,-58]]
  }),
  map({
    id:'map-03-storm',order:3,stageId:'stage-03-storm',name:'3 · 폭풍벽 바깥 인양장',region:'천둥 폭풍벽',sceneId:'storm-shelter',
    description:'중앙 암초와 폭풍 구름을 크게 감싸는 양쪽 우회로. 어두운 전경과 낮은 황색 계류등으로 귀환 방향을 읽는다.',
    theme:{sky:'#aebed0',cloud:'#e3e7ed',accent:'#d4af61'},landmark:'중앙 암초 뒤의 큰 폭풍 구름',
    keyVisualIds:['storm-wall','grounding-marker'],
    obstacles:[
      terrain('storm-center-rock','island-rock-tall',0,0,16,36),terrain('south-metal-wreck','wreckage-shoal',8,-32,12,27),
      terrain('west-shelter-rock','island-rock-small',-68,-12,7,18),terrain('east-shelter-rock','island-rock-small',72,28,7,18),
      terrain('western-entry-rock','island-rock-tall',-70,55,10,26),terrain('north-east-rock','island-rock-small',62,-76,8,20)
    ],
    extraVisuals:[
      visual('storm-wall','storm-cloud-mass',[0,-22,-16],75,'decoration'),
      visual('storm-west','storm-cloud-mass',[-60,-28,-68],50,'decoration'),
      visual('grounding-marker','warning-arch',[8,8,-32],8,'landmark'),
      visual('shelter-lantern','lantern-standing',[-68,6,-12],6,'landmark')
    ],
    spawns:[[-35,26],[-49,-18],[-24,-55],[22,-62],[53,-25],[45,30],[-22,47]],
    objectives:[objective('bypass','폭풍 서쪽 우회',-48,-20),objective('destination','폭풍 뒤 회수 해역',0,-62)],
    corridors:[
      path('main-flight','서쪽 넓은 우회',[[0,55],[-40,30],[-48,-20],[-30,-55],[0,-62]]),
      path('east-bypass','동쪽 넓은 우회',[[0,55],[40,40],[54,0],[42,-56],[0,-62]]),
      path('return-approach','동쪽 철수 항로',[[0,-62],[42,-56],[54,0],[40,40],[0,55],[0,67]])
    ],pockets:[[0,55],[-40,30],[-48,-20],[0,-62],[54,0]]
  }),
  map({
    id:'map-04-industry',order:4,stageId:'stage-04-industry',name:'4 · 쇠갈비 공용 작업장',region:'쇠갈비 공업지대',sceneId:'iron-rib-yard',
    description:'반복 철골 사이 세 개의 세로 통로와 앞뒤 가로 통로가 만나는 격자. 공구와 크레인은 작업장의 형태를 표시한다.',
    theme:{sky:'#c8c2b2',cloud:'#eee9dc',accent:'#a9674d'},landmark:'네 구역의 철골과 인양 크레인',
    keyVisualIds:['yard-crane','yard-tools'],
    obstacles:[
      terrain('rib-north-west','industrial-rib',-25,18,8,22),terrain('rib-north-east','industrial-rib',25,18,8,22),
      terrain('rib-south-west','industrial-rib',-25,-22,8,22),terrain('rib-south-east','industrial-rib',25,-22,8,22),
      terrain('far-west-rib','industrial-rib',-78,-12,7,20),terrain('far-east-rib','industrial-rib',78,5,7,20)
    ],
    extraVisuals:[
      visual('yard-crane','salvage-crane',[25,8,-22],11,'landmark'),visual('yard-tools','tool-rack',[-25,7,18],7,'landmark'),
      visual('yard-workbench','workbench-static',[-25,6,-22],7,'landmark'),
      visual('yard-cloud-west','cloud-bank',[-65,-28,-50],46,'decoration'),visual('yard-cloud-east','cloud-bank',[65,-28,45],42,'decoration')
    ],
    spawns:[[-49,18],[0,18],[49,18],[-49,-24],[0,-24],[49,-24],[0,-60]],
    objectives:[objective('crossing','중앙 작업장 통로',0,18),objective('destination','후방 작업 공간',0,-55)],
    corridors:[
      path('main-flight','중앙 세로 통로',[[0,55],[0,42],[0,-55]]),
      path('west-grid','서쪽 격자 통로',[[0,55],[0,42],[-50,42],[-50,-48],[0,-48],[0,-55]]),
      path('east-grid','동쪽 격자 통로',[[0,55],[0,42],[50,42],[50,-48],[0,-48],[0,-55]]),
      path('return-approach','열린 중앙 귀환',[[0,-55],[0,42],[0,55],[0,67]])
    ],pockets:[[0,55],[0,42],[-50,42],[50,42],[0,-55]]
  }),
  map({
    id:'map-05-fog',order:5,stageId:'stage-05-fog',name:'5 · 저층 안개 계류등 항로',region:'이름 없는 함대의 저층 안개',sceneId:'lower-fog-mooring',
    description:'낮게 깔린 안개 위 계류등을 따라 오래된 등대의 바깥을 돈다. 항로 표식은 관찰 지점이며 기억·대화 완료를 뜻하지 않는다.',
    theme:{sky:'#a7b7c5',cloud:'#e4e9ea',accent:'#749ba8'},landmark:'중앙의 오래된 등대와 한 줄 계류등',
    keyVisualIds:['old-lighthouse','fog-beacon-1','fog-beacon-2'],
    obstacles:[
      terrain('old-lighthouse-base','island-rock-small',4,-5,11,24),terrain('west-fog-wreck','wreckage-shoal',-65,10,9,21),
      terrain('east-fog-wreck','wreckage-shoal',65,20,9,21),terrain('south-west-wreck','wreckage-shoal',-45,-55,8,19),
      terrain('south-east-wreck','wreckage-shoal',62,-62,9,21)
    ],
    extraVisuals:[
      visual('old-lighthouse','beacon-lighthouse',[4,9,-5],22,'landmark'),
      visual('fog-beacon-1','beacon-buoy',[-34,-1,26],4),visual('fog-beacon-2','beacon-buoy',[-47,-1,-8],4),
      visual('fog-beacon-3','beacon-buoy',[-27,-1,-40],4),visual('fog-beacon-4','beacon-buoy',[27,-1,-57],4),
      visual('low-fog-west','fog-layer',[-35,-25,-8],68,'decoration'),visual('low-fog-east','fog-layer',[40,-27,-25],65,'decoration')
    ],
    spawns:[[-20,25],[-34,-8],[-16,-36],[15,-57],[43,-31],[39,18]],
    objectives:[objective('observation','등대 바깥 관찰 항로',-35,-8),objective('destination','북쪽 계류등 확인',15,-57)],
    corridors:[
      path('main-flight','계류등을 따라 우회',[[0,55],[-22,26],[-35,-8],[-15,-40],[15,-57]]),
      path('east-bypass','등대 동쪽 우회',[[0,55],[40,18],[45,-32],[15,-57]]),
      path('return-approach','안개 밖 귀환',[[15,-57],[45,-32],[40,18],[0,55],[0,67]])
    ],pockets:[[0,55],[-22,26],[-35,-8],[15,-57],[40,18]]
  }),
  map({
    id:'map-06-palace',order:6,stageId:'stage-06-palace',name:'6 · 황궁 외곽 서비스 구역',region:'황궁 검은 천정',sceneId:'royal-service-deck',
    description:'크림 석재와 봉인 조각 사이 대칭으로 열린 중앙·양쪽 서비스 항로. 조용한 외곽 공간만 배치하며 결말이나 최종 선택을 공개하지 않는다.',
    theme:{sky:'#9caaaf',cloud:'#dce2df',accent:'#c6a35d'},landmark:'대칭 석재판과 먼 봉인 조각',
    keyVisualIds:['sealed-west'],
    obstacles:[
      terrain('stone-north-west','royal-stone-platform',-27,17,9,23),terrain('stone-north-east','royal-stone-platform',27,17,9,23),
      terrain('stone-south-west','royal-stone-platform',-27,-17,9,23),terrain('stone-south-east','royal-stone-platform',27,-17,9,23),
      terrain('distant-seal','sealed-stone-fragment',0,-78,7,17),terrain('entry-west-stone','sealed-stone-fragment',-65,62,7,17),
      terrain('entry-east-stone','sealed-stone-fragment',65,62,7,17)
    ],
    extraVisuals:[
      visual('sealed-west','sealed-stone-fragment',[-27,8,-17],11,'landmark'),visual('sealed-east','sealed-stone-fragment',[27,8,-17],11,'landmark'),
      visual('service-platform','royal-stone-platform',[0,-12,-55],20,'decoration'),
      visual('palace-cloud-west','cloud-bank',[-65,-28,-36],43,'decoration'),visual('palace-cloud-east','cloud-bank',[65,-28,-36],43,'decoration')
    ],
    spawns:[[0,20],[0,-18],[0,-56],[-54,18],[54,18],[-54,-20],[54,-20]],
    objectives:[objective('service-passage','중앙 서비스 통로',0,17),objective('destination','외곽 준비 공간',0,-55)],
    corridors:[
      path('main-flight','중앙 서비스 항로',[[0,55],[0,43],[0,-55]]),
      path('west-bypass','서쪽 대칭 항로',[[0,55],[0,43],[-55,43],[-55,-45],[0,-45],[0,-55]]),
      path('east-bypass','동쪽 대칭 항로',[[0,55],[0,43],[55,43],[55,-45],[0,-45],[0,-55]]),
      path('return-approach','종항 귀환 요청 경로',[[0,-55],[0,43],[0,55],[0,67]])
    ],pockets:[[0,55],[0,43],[-55,43],[55,43],[0,-55]]
  })
];
