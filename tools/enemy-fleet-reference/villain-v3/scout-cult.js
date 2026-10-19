import { buildPirateScout as buildV2Pirate, buildCultBlockade as buildV2Cult } from '../villain-v2/scout-cult.js';
import { group, box, tube, beam, ring, cloth } from '../kit.js';
import { blade, spike, chain, eye } from '../villain-v2/style.js';

// V3 visual structures only. The inherited art module, weakpoint and control
// contracts remain authoritative; these frames introduce no gameplay equipment.
const n=(id,s)=>`${id}-v3-${s}`;
const find=(ctx,s)=>ctx.motion.getObjectByName(`${ctx.id}-${s}`);
function finish(built,theme,features) {
  built.villainTheme=theme;
  built.features.push(...features);
  built.referenceNotes+=' 악당 외형v3 / 최신 10배 이상 대담함의 표현 목표: '+features.join('; ')+'. 단일 배율 확대가 아닌 큰 빈 공간·비대칭 주형태·중간 기능 구조·작은 재료층의 재설계. 기존 약점/controls/수량/전투 규칙 보존. 실제 렌더 비교 및 사람 미술 승인은 통합 QA에서 별도 확인.';
  return built;
}

function hunterMouth(ctx) {
  const {id,m,motion}=ctx;
  const mouth=group(motion,n(id,'open-predator-jaw'));
  for(const side of [-1,1]) {
    const z=side*1.83;
    // Two sweeping silhouettes enclose a deliberately EMPTY mouth, rather than
    // decorating the narrow old hull with another small tooth strip.
    blade(mouth,m.iron,n(id,'upper-jaw-'+side),[[-8.7,.64],[-6.95,2.18],[-3.8,2.68],[-.8,1.42],[1.5,.62],[-.8,1.97],[-4,3.3],[-7.2,2.92],[-9.42,1.22]],.3,[0,0,z]);
    blade(mouth,m.blood,n(id,'lower-jaw-'+side),[[-9.2,.24],[-7.25,-2.25],[-3.45,-2.96],[.8,-1.48],[2,.25],[.95,-.52],[-3.6,-2.22],[-6.85,-1.62],[-8.25,.47]],.34,[0,0,z]);
    tube(mouth,m.brass,n(id,'jaw-forged-trim-'+side),[[-9.1,.58,z+side*.35],[-7.15,-2.1,z+side*.35],[-3.5,-2.72,z+side*.35],[.85,-1.25,z+side*.35],[1.7,.1,z+side*.35]],.09,32);
    for(const [i,x,h] of [[0,-7.1,.9],[1,-5.4,1.18],[2,-3.65,1.32]]) {
      blade(mouth,m.bone,n(id,`upper-fang-${side}-${i}`),[[x-.43,2.48],[x+.48,2.61],[x+.24,2.2-h]],.22,[0,0,z+side*.15]);
      blade(mouth,m.bone,n(id,`lower-fang-${side}-${i}`),[[x-.45,-2.18],[x+.48,-2.38],[x+.16,-1.15+(i===1?.38:0)]],.24,[0,0,z+side*.18]);
    }
    eye(mouth,m,n(id,'great-predator-eye-'+side),[-2.65,2.54,z+side*.36],[1.32,.18,.13],[0,0,-.18]);
    blade(mouth,m.darkWood,n(id,'overlapping-cheek-'+side),[[-1.9,1.65],[.1,2.26],[2.8,.4],[1.9,-1.38],[.72,-.45]],.26,[0,0,side*2.16]);
    for(let i=0;i<3;i++)beam(mouth,m.brass,n(id,`cheek-seam-${side}-${i}`),[-.7+i*.63,1.4-i*.36,side*2.49],[-.1+i*.63,.36-i*.25,side*2.49],.045);
  }
  // Open cross ribs preserve sight through to the timber and existing gun.
  for(const [i,x,y]of [[0,-7.4,-1.82],[1,-3.6,-2.68],[2,.9,-1.1]])
    tube(mouth,m.darkWood,n(id,'mouth-crossrib-'+i),[[x,y, -1.8],[x-.35,y-.38,0],[x,y,1.8]],.13,16);
  blade(motion,m.brass,n(id,'swept-raptor-ram'),[[-6.4,.45],[-8.9,1.12],[-10.25,.35],[-9.55,-.08],[-8.15,.02],[-8.8,-.8],[-7,-.24]],.65,[0,0,-.325]);
}

function huntingRig(ctx) {
  const {id,m,motion}=ctx;
  // A single vast, torn hunting wing overwhelms the old cigar silhouette.
  // It follows the existing envelope flex bone, with no additional controls.
  const flex=ctx.controls.find(c=>c.role==='envelope')?.bone||motion;
  const root=group(flex,n(id,'asymmetric-hunting-sail'),flex===motion?[0,0,0]:[.55,-4.35,0]);
  blade(root,m.blood,n(id,'great-torn-hunting-wing'),[[-3.15,4.5],[-2.5,7.4],[.8,11.5],[4.85,10.25],[3.5,8.8],[4.35,8.2],[2.55,7.6],[3.35,6.72],[1.55,6.18],[.8,4.65]],.12,[0,0,-1.55]);
  tube(root,m.darkWood,n(id,'wing-swept-yard'),[[-3.15,4.5,-1.61],[-2.5,7.4,-1.61],[.8,11.5,-1.61],[4.85,10.25,-1.61]],.145,28);
  tube(root,m.brass,n(id,'wing-leading-seam'),[[-2.87,4.7,-1.71],[-2.22,7.42,-1.71],[.91,11.2,-1.71],[4.6,10.18,-1.71]],.045,28);
  for(let i=0;i<3;i++)tube(root,m.bone,n(id,'wing-patch-stitch-'+i),[[-1.3+i*.78,6.7,-1.7],[-.94+i*.78,7.7,-1.7],[.1+i*.78,9.1,-1.7]],.042,12);
  for(const [i,x,h]of [[0,-2.9,2.7],[1,-.7,1.8],[2,1.4,1.25]])
    blade(motion,m.iron,n(id,'shark-dorsal-'+i),[[x-.8,5],[x-.35,5+h],[x+.7,5.8],[x+1.15,4.8]],.24,[0,0,.62]);
  const deck=group(motion,n(id,'splayed-trophy-working-deck'));
  // Wider side galleries remain open, with large material planes and sparse props.
  for(const side of [-1,1]) {
    box(deck,m.wood,n(id,'working-gallery-'+side),[.15,.42,side*1.85],[4.5,.19,1.03],[side*.08,0,0]);
    for(const x of [-1.7,.3,2.1])beam(deck,m.darkWood,n(id,`gallery-outrigger-${side}-${x}`),[x,-.55,side*.7],[x,.37,side*2.35],.09);
    tube(deck,m.rope,n(id,'gallery-rail-'+side),[[-2,.9,side*2.37],[0,1.12,side*2.4],[2.3,.9,side*2.37]],.045,16);
  }
  chain(deck,m,n(id,'massive-trophy-hanger'),[[1.7,1.0,-2.46],[2.05,-.7,-2.7],[.6,-2.5,-2.65],[-.6,-1.15,-2.45]],15);
  blade(deck,m.warning,n(id,'stolen-warning-shield'),[[-.7,.7],[.65,.6],[.9,-.48],[0,-1.2],[-.8,-.5]],.12,[1.2,-.9,-2.73],[0,0,-.25]);
  cloth(deck,m.canvas,n(id,'seized-sail-bundle'),{at:[.4,.57,2.25],width:2.1,height:1.05,ragged:true,billow:.25});
}

export function buildPirateScout(ctx) {
  const built=buildV2Pirate(ctx);hunterMouth(ctx);huntingRig(ctx);
  return finish(built,'빈 거대 포식자 턱과 편측 사냥돛의 약탈 맹금선',[
    '선체 앞을 둘러싸는 거대한 빈 포식자 턱: 위아래의 벌어진 프레임·6쌍 큰 송곳니·드러난 목재와 기관총',
    '기낭을 넘어서는 단측 찢긴 사냥돛과 높이가 다른 상어 등갑, 원 기낭 flex에 결속한 후속 움직임',
    '양옆으로 벌어진 전리품 작업갑판·묵직한 방패 사슬·앞으로 꺾여 나온 맹금 충각',
  ]);
}

function funeraryTerraces(ctx) {
  const {id,m,motion}=ctx;
  for(const [i,x,y,w,l] of [[0,2.65,2.7,6.9,5.5],[1,3.1,4.25,5.5,3.8],[2,3.65,5.65,3.9,2.1]]) {
    const floor=group(motion,n(id,'funeral-terrace-'+i));
    box(floor,m.darkWood,n(id,'terrace-underbeam-'+i),[x,y-.19,0],[l,.42,w]);
    box(floor,m.wood,n(id,'terrace-timber-floor-'+i),[x,y+.08,0],[l,.16,w-.22]);
    for(const side of [-1,1]) {
      const z=side*w*.5;
      blade(floor,m.iron,n(id,`terrace-side-${i}-${side}`),[[x-l*.5,y-.1],[x+l*.5,y-.1],[x+l*.42,y+1.15],[x-l*.38,y+.8]],.2,[0,0,z]);
      tube(floor,m.brass,n(id,`terrace-gold-rim-${i}-${side}`),[[x-l*.5,y+.05,z],[x-l*.38,y+.8,z],[x+l*.42,y+1.15,z]],.07,16);
    }
  }
  // Exterior buttresses join deck levels, creating a stepped procession instead
  // of a flat black box with four equally important tank cylinders.
  for(const side of [-1,1])for(const [i,x,y,z]of [[0,-.2,2.7,3.5],[1,1.8,4.3,2.85],[2,4.4,5.7,2.1]]) {
    tube(motion,m.darkWood,n(id,`tier-buttress-${side}-${i}`),[[x,-1.15,side*2.4],[x-.65,1,side*(z+.5)],[x,y,side*z]],.21,18);
    tube(motion,m.brass,n(id,`buttress-brass-seam-${side}-${i}`),[[x-.11,-1,side*2.51],[x-.76,1,side*(z+.61)],[x-.11,y,side*(z+.11)]],.045,18);
  }
}

function cathedralBell(ctx) {
  const {id,m,motion,controls}=ctx;
  const support=find(ctx,'open-central-bell-support');
  const bell=find(ctx,'exposed-hanging-bell');
  // Reuse the original animated bell and weakpoint support. The pointed arch
  // surrounds empty air, so the bell/hanger remain visible from bow and sides.
  if(bell){bell.position.set(-1.25,7.5,0);bell.scale.set(3.45,4.1,3.45);}
  const bellControl=controls.find(c=>c.role==='bell');if(bellControl)bellControl.amplitude=.15;
  const arch=group(support||motion,n(id,'open-great-bell-arch'));
  for(const side of [-1,1]) {
    const points=[[.3,0,side*3.2],[-.2,5.9,side*3.15],[-.7,9.1,side*2.62],[-1,10.65,side*1.48],[-1.15,11.25,0]];
    tube(arch,m.iron,n(id,'pointed-arch-frame-'+side),points,.34,30);
    tube(arch,m.brass,n(id,'pointed-arch-gold-edge-'+side),points.map(p=>[p[0]-.3,p[1],p[2]]),.085,30);
    tube(arch,m.darkWood,n(id,'rear-arch-rib-'+side),points.map(p=>[p[0]+1.1,p[1]-.25,p[2]]),.19,26);
    for(const h of [2.7,5.6,8.2])beam(arch,m.brass,n(id,`arch-cross-brace-${side}-${h}`),[-.25,h,side*3.05],[.8,h+.7,side*2.85],.09);
    const horn=[[-.6,9.3,side*2.5],[-1.9,11.2,side*3.4],[-3.1,11.65,side*3.1],[-3.9,10.7,side*2.55]];
    tube(arch,m.bone,n(id,'curved-plate-horn-'+side),horn.slice(0,3),.27,22);
    spike(arch,m.bone,n(id,'hooked-horn-tip-'+side),horn[2],horn[3],.29);
    tube(arch,m.brass,n(id,'horn-plate-seam-'+side),horn.slice(0,3).map(p=>[p[0]-.16,p[1],p[2]]),.05,20);
    cloth(arch,m.blood,n(id,'vast-ritual-drape-'+side),{at:[2.9,9.1,side*3.42],width:4.35,height:5.55,ragged:true,billow:side*.42});
    beam(arch,m.brass,n(id,'drape-spreader-'+side),[.5,9.15,side*3.42],[5.3,9.15,side*3.42],.095);
    blade(arch,m.bone,n(id,'large-drape-seal-'+side),[[2.25,7.9],[2.9,8.55],[3.55,7.9],[2.9,6.35]],.07,[0,0,side*3.48]);
    blade(arch,m.iron,n(id,'inner-drape-binding-'+side),[[2.8,8.7],[3,8.7],[3,5.65],[2.8,5.35]],.08,[0,0,side*3.57]);
  }
  beam(arch,m.brass,n(id,'exposed-bell-hanging-link'),[-1.15,11.15,0],[-1.25,9.7,0],.16);
  // Add the crown to the existing bell pivot, ensuring its motion is inherited.
  if(bell)ring(bell,m.iron,n(id,'bell-forged-crown'),[0,.27,0],.29,.06,'y');
  chain(arch,m,n(id,'bell-great-chain'),[[-1.2,9.7,-.48],[-1.3,9.25,0],[-1.2,9.7,.48]],11);
}

export function buildCultBlockade(ctx) {
  const built=buildV2Cult(ctx);funeraryTerraces(ctx);cathedralBell(ctx);
  return finish(built,'열린 거대 종아치와 계단식 장례 테라스의 봉쇄 성당',[
    '평평한 상자 후미를 세 높이의 장례 테라스·벌어진 버팀골조·따뜻한 목재 바닥으로 재구성',
    '선체보다 높은 빈 첨두 종아치와 원 animated bell에 연결된 대형 열린 종, 노출된 약점 지지대',
    '휘어진 판금 뿔·뒤로 펼친 대형 붉은 의례 장막·먹색 보강층과 황동 윤곽; bell 진폭 .08→.15로 무거운 후속 움직임',
  ]);
}
