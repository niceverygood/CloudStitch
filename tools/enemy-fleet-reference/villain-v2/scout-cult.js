import { buildPirateScout as buildReferencePirateScout, buildCultBlockade as buildReferenceCultBlockade } from '../scout-cult.js';
import { THREE, group, box, sphere, tube, beam, ring, cloth, panel } from '../kit.js';
import { blade, spike, chain, eye, describe } from './style.js';

// New wrappers only: source reference assets and their weakpoint names stay intact.
// Every added shape is ornament/paint, not another weapon, damage rule or control.
const name = (id, suffix) => `${id}-v2-${suffix}`;
const find = (ctx, suffix) => ctx.motion.getObjectByName(`${ctx.id}-${suffix}`);
const changeMaterial = (node, mat) => { if(node?.isMesh) node.material=mat; };

function curvedHorn(parent,m,id,suffix,points,radius=.15) {
  const holder=group(parent,name(id,suffix));
  tube(holder,m.bone,name(id,suffix+'-ivory-curve'),points.slice(0,-1),radius,30);
  tube(holder,m.brass,name(id,suffix+'-gold-seam'),points.slice(0,-1).map(p=>[p[0]-.07,p[1],p[2]-.035]),radius*.22,28);
  spike(holder,m.bone,name(id,suffix+'-swept-tip'),points.at(-2),points.at(-1),radius*1.04);
  return holder;
}

function scarredEnvelope(ctx) {
  const {id,m,motion}=ctx;
  const bag=find(ctx,'ochre-scout-envelope');
  // The reference builder intentionally authored an ochre clone. Override that
  // clone here so a crimson palette produces an actual crimson main envelope.
  bag?.traverse(node=>{if(node.isMesh&&node.name.endsWith('_canvas'))node.material=m.canvas;});
  for(const side of [-1,1]) {
    const patchPoints=[];
    for(let i=0;i<7;i++) {
      const x=-3.2+i*.74,r=Math.sqrt(Math.max(.05,1-Math.pow((x+.55)/4.1,2)));
      patchPoints.push([x,4.35+1.5*r*.55,side*1.5*r*.86]);
    }
    tube(motion,m.iron,name(id,'envelope-dark-brow-'+side),patchPoints,.085,28);
    for(let i=0;i<3;i++) {
      const x=-2.55+i*1.37;
      tube(motion,m.bone,name(id,`big-canvas-scar-${side}-${i}`),[[x-.32,4.9,side*1.24],[x-.02,4.57,side*1.46],[x+.25,4.2,side*1.5]],.046,12);
    }
  }
  return bag;
}

function predatorRam(ctx) {
  const {id,m,motion}=ctx;
  const oldTip=find(ctx,'red-spearhead');if(oldTip){oldTip.removeFromParent();oldTip.geometry.dispose();}
  const beak=group(motion,name(id,'predator-beak'));
  const outer=[[-4.75,.45],[-5.63,1.1],[-7.28,.76],[-8.25,-.12],[-7.24,-.36],[-7.52,-.88],[-6.32,-.46],[-5.07,-.61]];
  blade(beak,m.brass,name(id,'large-brass-hawk-beak'),outer,.98,[0,0,-.49]);
  blade(beak,m.blood,name(id,'beak-painted-face'),[[-4.94,.43],[-5.68,.92],[-7.12,.62],[-7.81,-.08],[-6.95,-.13],[-7.16,-.48],[-6.26,-.28],[-5.18,-.42]],1.045,[0,0,-.522]);
  for(const side of [-1,1]) {
    eye(beak,m,name(id,'hawk-eye-'+side),[-5.81,.39,side*.554],[.69,.115,.06],[0,0,side*.12]);
    blade(beak,m.iron,name(id,'beak-cheek-'+side),[[-5.25,.28],[-6.1,.02],[-5.48,-.43],[-4.87,-.25]],.1,[0,0,side*.62-.05]);
  }
  return beak;
}

function hunterJawArmor(ctx) {
  const {id,m,motion}=ctx;
  for(const side of [-1,1]) {
    const frame=group(motion,name(id,'predatory-side-jaw-'+side),[0,0,side*1.25]);
    blade(frame,m.iron,name(id,'long-jaw-armor-'+side),[[-4.55,.34],[-3.26,.7],[-1.17,.35],[.4,.48],[.08,-.48],[-2.6,-.74],[-4.45,-.36]],.18,[0,0,side*.09]);
    tube(frame,m.brass,name(id,'jaw-gold-edge-'+side),[[-4.5,.37,side*.14],[-3.25,.73,side*.14],[-1.15,.4,side*.14],[.35,.52,side*.14]],.055,20);
    // Four readable, irregular teeth; no blanket of tiny identical spikes.
    const teeth=[[-3.9,.6,.78],[-2.8,.68,1.12],[-1.58,.62,.88],[-.47,.53,.61]];
    teeth.forEach(([x,w,h],i)=>blade(frame,m.bone,name(id,`ivory-jaw-tooth-${side}-${i}`),[[x-w/2,-.1],[x+w/2,-.17],[x+.08,-h]],.17,[0,0,side*.21]));
    blade(motion,m.blood,name(id,'large-hunter-cheek-fin-'+side),[[-2.52,.65],[-.65,.63],[1.03,1.7],[.31,-.12],[-1.17,-.57]],.16,[0,0,side*1.68],[0,side*.13,side*.04]);
  }
  // A single asymmetric collection of stolen plates and a dragging gold chain.
  const trophies=group(motion,name(id,'asymmetric-stolen-plates'),[1.05,.23,-1.35]);
  chain(trophies,m,name(id,'trophy-chain'),[[0,.6,0],[.28,-.4,-.36],[.9,-1.36,-.5],[1.6,-1.76,-.26]],15);
  blade(trophies,m.brass,name(id,'stolen-rivet-shield'),[[-.44,-.35],[.39,-.45],[.51,-1.2],[-.1,-1.57],[-.52,-1.04]],.09,[.55,0,-.55],[0,0,.19]);
  blade(trophies,m.bone,name(id,'stolen-ivory-seal-fragment'),[[-.29,-.85],[.29,-.91],[.33,-1.49],[-.11,-1.75],[-.31,-1.3]],.08,[1.17,-.18,-.39],[0,0,-.2]);
  ring(trophies,m.brass,name(id,'broken-trophy-ring'),[1.56,-1.79,-.28],.24,.065,'z');
}

function hornSails(ctx) {
  const {id,m,motion}=ctx;
  const near=[ [2.4,4.65],[3.16,5.39],[3.36,6.64],[2.82,7.66],[1.68,8.23],[2.08,7.15],[2.13,6.49],[1.31,5.66],[.19,5.09] ];
  const far=[ [1.51,4.8],[2.5,5.53],[2.78,6.58],[2.1,7.48],[1.22,7.73],[1.53,6.85],[1.28,6.27],[.55,5.56],[-.26,5.12] ];
  blade(motion,m.blood,name(id,'large-hooked-crimson-sail'),near,.11,[0,0,-1.09],[0,.03,0]);
  blade(motion,m.iron,name(id,'shorter-hooked-black-sail'),far,.1,[0,0,1.13],[0,-.09,0]);
  curvedHorn(motion,m,id,'near-curved-sail-bone',[[2.39,4.71,-1.12],[3.12,5.39,-1.11],[3.3,6.59,-1.1],[2.78,7.57,-1.09],[1.68,8.23,-1.07]],.115);
  curvedHorn(motion,m,id,'far-curved-sail-bone',[[1.5,4.83,1.13],[2.45,5.55,1.13],[2.72,6.55,1.11],[2.1,7.42,1.09],[1.22,7.73,1.06]],.09);
  const mast=find(ctx,'pirate-flag-mast');if(mast){mast.position.x=3.5;mast.position.z=.38;mast.rotation.z=-.08;}
}

export function buildPirateScout(ctx) {
  const built=buildReferencePirateScout(ctx);
  scarredEnvelope(ctx);predatorRam(ctx);hunterJawArmor(ctx);hornSails(ctx);
  built.features=built.features.map(text=>text==='황토 타원 기낭과 밧줄망'?'검붉은 타원 기낭과 거친 봉제 흉터':text==='뾰족한 목재 스키프·붉은 충각'?'상어 턱 장갑과 맹금 부리 충각을 두른 목재 스키프':text);
  return describe(built,'거친 전리품을 매단 맹금·상어 해적 사냥꾼',[
    '황동 테두리의 크게 굽은 맹금 부리 충각과 불길한 눈매',
    '양옆 긴 턱 장갑과 크기 다른 아이보리 이빨',
    '높이와 곡선이 다른 검붉은 뿔돛 두 장',
    '한쪽에만 늘어진 전리품 방패·봉인 파편·사슬',
    '검붉은 기낭 위 큰 봉제 흉터와 밝은 황동/아이보리 대비',
  ]);
}

function layeredCultArmor(ctx) {
  const {id,m,motion}=ctx;
  const core=find(ctx,'black-plated-cliff-hull');if(core)core.scale.set(1.035,1.055,1.085);
  for(const side of [-1,1]) {
    const holder=group(motion,name(id,'oppressive-side-shields-'+side));
    for(let i=0;i<4;i++) {
      const x=-4.26+i*2.32,y=.41+(i%2)*.23,z=side*(3.12+(i%2)*.08),rot=[0,side<0?Math.PI:0,0];
      panel(holder,m.brass,name(id,`gold-shield-frame-${side}-${i}`),[x,y,z],[2.1,2.22,.2],rot,m.bone);
      panel(holder,m.iron,name(id,`heavy-shield-inset-${side}-${i}`),[x,y,z+side*.15],[1.85,1.96,.15],rot);
      blade(holder,m.blood,name(id,`shield-chevron-${side}-${i}`),[[-.54,.51],[0,.1],[.54,.51],[0,-.71]],.055,[x,y,z+side*.26],[0,side<0?Math.PI:0,0]);
    }
    tube(holder,m.brass,name(id,'long-gold-upper-bulwark-'+side),[[-5.1,1.67,side*3.23],[-2.6,1.83,side*3.36],[.1,1.84,side*3.36],[3.85,1.63,side*3.2]],.095,24);
  }
  const bow=group(motion,name(id,'stacked-front-wall'),[-6.25,.03,0],[0,-Math.PI/2,0]);
  blade(bow,m.brass,name(id,'large-ceremonial-bow-shield'),[[-2.58,2.42],[2.58,2.42],[2.71,-1.04],[1.77,-2.28],[-1.77,-2.28],[-2.71,-1.04]],.24);
  blade(bow,m.iron,name(id,'large-front-shield-inset'),[[-2.32,2.2],[2.32,2.2],[2.44,-.95],[1.61,-2.01],[-1.61,-2.01],[-2.44,-.95]],.2,[0,0,.22]);
  for(const s of [-1,1])beam(bow,m.brass,name(id,'front-wall-gold-bone-'+s),[s*1.71,-1.78,.48],[s*1.92,2.1,.48],.07);
  sealGlyph(bow,m,id,'bow-curse-seal',[0,.07,.47],1.15);
}

function sealGlyph(parent,m,id,suffix,at,scale=1) {
  const root=group(parent,name(id,suffix),at);root.scale.setScalar(scale);
  // Angular seal built from opaque geometry; no generated or unreadable text.
  blade(root,m.bone,name(id,suffix+'-ivory-diamond'),[[0,1.08],[.62,.2],[0,-.83],[-.62,.2]],.035);
  blade(root,m.blood,name(id,suffix+'-crimson-diamond'),[[0,.93],[.47,.18],[0,-.66],[-.47,.18]],.045,[0,0,.04]);
  box(root,m.blood,name(id,suffix+'-vertical-seal'),[0,.06,.11],[.14,2.6,.07]);
  for(const side of [-1,1])blade(root,m.blood,name(id,suffix+'-hook-'+side),[[side*.1,.15],[side*.88,.61],[side*.7,-.08],[side*.34,-.33]],.06,[0,0,.1]);
  ring(root,m.brass,name(id,suffix+'-seal-collar'),[0,.22,.14],.77,.055,'z');
  return root;
}

function dreadBell(ctx) {
  const {id,m,motion}=ctx;
  const support=find(ctx,'open-central-bell-support'),bell=find(ctx,'exposed-hanging-bell');
  if(bell){bell.scale.setScalar(1.85);bell.position.set(-.65,4.05,0);}
  for(const side of [-1,1]) {const post=find(ctx,'bell-post-'+side);if(post)post.position.z=side*1.22;}
  const yoke=find(ctx,'bell-top-yoke');if(yoke)yoke.scale.y=1.6;
  if(support) {
    for(const side of [-1,1])beam(support,m.brass,name(id,'splayed-bell-post-frame-'+side),[.2,.12,side*1.27],[.12,4.6,side*1.29],.11);
    const frontFace=group(bell||support,name(id,'bell-red-seal-face'),[-.42,-.08,0],[0,-Math.PI/2,0]);
    sealGlyph(frontFace,m,id,'bell-bound-omen',[0,0,0],.32);
  }
  curvedHorn(motion,m,id,'left-great-bell-horn',[[-3.02,5.92,-1.25],[-3.2,7.05,-1.87],[-4.04,8.1,-1.66],[-5.1,8.51,-.91],[-4.8,7.8,-.43]],.18);
  curvedHorn(motion,m,id,'right-great-bell-horn',[[-3.02,5.92,1.25],[-3.2,7.05,1.87],[-4.04,8.1,1.66],[-5.1,8.51,.91],[-4.8,7.8,.43]],.18);
  chain(motion,m,name(id,'bell-ritual-chain'),[[-3.15,6.9,-1.91],[-3.9,6.4,-1.43],[-4.38,6.3,0],[-3.9,6.4,1.43],[-3.15,6.9,1.91]],18);
}

function crownedSealTowers(ctx) {
  const {id,m,motion}=ctx;
  const tanks=[[-2.5,1.25,-1.65,4.2],[-.2,1.25,-1.7,5.1],[2.2,1.25,1.65,4.75],[3.6,1.25,-1.7,3.6]];
  tanks.forEach(([x,y,z,h],i)=>{
    const crown=group(motion,name(id,'tower-crown-'+i),[x,y+h,z]);
    ring(crown,m.brass,name(id,'tower-crown-gold-ring-'+i),[0,.15,0],.78,.09,'y');
    for(const side of [-1,1])blade(crown,m.iron,name(id,`large-crown-petal-${i}-${side}`),[[-.68,0],[-.35,.83],[0,1.35],[.3,.78],[.68,0]],.13,[0,.12,side*.5],[0,side*.18,0]);
    spike(crown,m.brass,name(id,'single-tall-crown-finial-'+i),[0,.15,0],[-.17,1.9+(i%2)*.32,0],.23);
    sphere(crown,m.evilGlow,name(id,'crown-sealed-warning-'+i),[-.17,1.36,0],[.1,.16,.1],12);
  });
  for(const side of [-1,1]) {
    const pole=group(motion,name(id,'ceremonial-crimson-standard-'+side),[.25,1.35,side*2.48]);
    beam(pole,m.brass,name(id,'tall-ritual-standard-pole-'+side),[0,0,0],[0,6.25,0],.07);
    spike(pole,m.bone,name(id,'ritual-standard-finial-'+side),[0,6.17,0],[-.13,7.03,0],.17);
    cloth(pole,m.blood,name(id,'long-crimson-ritual-banner-'+side),{at:[.3,5.91,0],width:1.15,height:3.95,ragged:true,billow:side*.18});
    const emblem=group(pole,name(id,'banner-seal-'+side),[.3,4.55,side*.12],[0,side<0?Math.PI:0,0]);
    sealGlyph(emblem,m,id,'banner-binding-mark-'+side,[0,0,0],.43);
  }
}

export function buildCultBlockade(ctx) {
  const built=buildReferenceCultBlockade(ctx);
  layeredCultArmor(ctx);dreadBell(ctx);crownedSealTowers(ctx);
  built.features=built.features.map(text=>text==='중앙 열린 통로의 좁은 황동 종'?'넓은 종틀 사이로 돌출한 거대한 불길한 황동 종':text);
  return describe(built,'왕관 봉인탑과 굽은 종뿔을 두른 압제의 장례 성벽',[
    '금테가 두꺼운 겹장갑과 큰 붉은 봉인 문양의 전면 방패',
    '넓힌 종틀과 앞으로 돌출한 거대 황동 종',
    '수직 봉인통4개 위의 왕관형 침탑과 높은 중앙 핀',
    '종실 양쪽의 크게 굽은 아이보리 의례 뿔',
    '길게 늘어진 붉은 의례 깃발과 사슬·기하학 봉인',
    '검은 판금의 부피를 읽게 하는 밝은 황동·아이보리 윤곽',
  ]);
}
