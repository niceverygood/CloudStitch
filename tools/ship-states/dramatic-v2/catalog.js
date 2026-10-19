import {LEVELS} from '../evolution30/catalog.js';
export {LEVELS};
export const CATEGORIES=[
 {id:'normal',number:'01',name:'평소의 귀환호',subtitle:'따뜻한 생활선 · 순항 · 바람을 가르는 경계',stages:[['정박 · 살아 있는 기계','풍성한 기낭, 황동 골조와 큰 보조 추진기.'],['순항 · 펼쳐진 바람돛','측면 돛을 펼치고 힘 있게 전진하는 모습.'],['경계 · 항로를 지키는 배','높은 깃발과 관측 장치, 또렷한 포탑 선회.']]},
 {id:'damage',number:'02',name:'극적인 피해',subtitle:'천의 파열 · 처짐 · 부러진 외판 · 불안정한 엔진',stages:[['온전함 · 100%','상처를 입기 전의 완전한 귀환호.'],['손상 · 75%','길게 벌어진 천과 흩날리는 파열 조각.'],['중상 · 45%','크게 처진 기낭과 짙은 연기, 매달린 외판.'],['위기 · 15%','끊어진 골조와 엔진, 크게 기울어 버티는 배.']]},
 {id:'weapons',number:'03',name:'과감한 무장',subtitle:'쌍열 기관총 → 중함포 → 박격포대 → 대형 작살',stages:[['W0 · 전방 기관총','전방 무기와 황동 보호 거치대.'],['W1 · 쌍열 회전 기관총','외부 전투 갑판 위의 굵은 쌍열 포탑.'],['W2 · 대구경 함포','옆으로 뻗은 중함포와 큰 반동 지지대.'],['W3 · 곡사 포대','높낮이가 다른 박격포와 곡면 방호판.'],['W4 · 대형 작살 장비','긴 작살 레일과 케이블 드럼을 더한 복합 무장.']]},
 {id:'armor',number:'04',name:'겹겹의 장갑',subtitle:'황동 갈비뼈 · 청록 방패 · 선수 방호 · 중첩 성곽',stages:[['A0 · 수공예 선체','원래 목재 선체와 보강 프레임.'],['A1 · 황동 골조','선체를 감싸는 두껍고 둥근 보강대.'],['A2 · 청록 방패판','겹쳐진 곡면 장갑과 황동 테두리.'],['A3 · 선수 보호대','넓은 선수 방호와 선장실 지붕의 보호 골조.'],['A4 · 중첩 방호선','큰 방패·겹판·엔진 보호대가 이어지는 모습.']]},
 {id:'growth',number:'05',name:'Lv.1–30 진화',subtitle:'작은 배 → 공중 공방 → 다층 구름 항해선',stages:LEVELS.map(l=>[`Lv.${l.level} · ${l.name}`,l.description])},
 {id:'explosion',number:'06',name:'에너지 0 · 대파열',subtitle:'압축 전조 → 대분출 → 연쇄 파열 → 거대한 연기와 잔해',stages:[['01 · 동력 소진','추진기가 멎고 압축된 빛이 모이는 전조.'],['02 · 파열 직전','엔진과 연결부의 빛이 커지며 팽팽해지는 순간.'],['03 · 대분출','큰 주화염, 꽃잎 같은 폭압과 겹충격 고리.'],['04 · 연쇄 파열','나무·천·기계 부품이 흩어지고 연기가 뒤따름.'],['05 · 마지막 여운','큰 연기 기둥과 떨어지는 천, 사라지는 불씨.']]},
];
export const REPRESENTATIVES={normal:1,damage:3,weapons:4,armor:4,growth:29,explosion:2};
export const EXPLOSION_TIMES=[0,.75,1.6,3.2,5.3];
export const TOTAL_STAGES=52;
export const levelFor=(category,stage)=>category==='growth'?Number(stage)+1:1;
