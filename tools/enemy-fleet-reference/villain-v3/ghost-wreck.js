import { buildGhostChaser as buildGhostBase, buildDisguisedWreck as buildWreckBase } from '../villain-v2/ghost-wreck.js';
import { THREE, group, mesh, sphere, tube, beam, ring, cloth } from '../kit.js';
import { blade, spike, chain, eye } from '../villain-v2/style.js';

// V3: large sculpted masses first, functional middle layers next, seams last.
// All additions are visual assemblies. No new controls, weapons or weakpoints.
function finish(built, theme, features, note) {
  built.villainTheme = theme;
  built.features.push(...features);
  built.referenceNotes += ' 악당 외형v3 / 최신 10배 이상 대담한 표현 목표: ' + note + ' 실제 무장·피해·충돌·AI 및 원본 modules=null은 변경하지 않는다. 실제 렌더 비교와 사람의 미술 승인은 별도 검수한다.';
  return built;
}

// A wide curved fabric surface, deliberately leaving notches and open air.
function trailingShroud(parent, material, name, side, length, width, yOffset = 0) {
  const p=[], uv=[], ix=[], nx=30, ny=10;
  for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){
    const u=i/nx,v=j/ny;
    const spread=Math.sin(u*Math.PI*.87)*width;
    const torn=1-.23*Math.sin(u*34)**8;
    p.push(-1+u*length, yOffset+2.2*Math.sin(u*Math.PI)-u*1.9-v*1.4+Math.sin(u*14)*v*.28,
      side*(1.1+u*2+v*spread*torn)); uv.push(u,v);
  }
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
    if(j>6 && i%9===6)continue;
    const a=i*(ny+1)+j,b=a+ny+1;ix.push(a,b,a+1,a+1,b,b+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  return mesh(parent,g,material,name);
}

export function buildGhostChaser(ctx) {
  const built=buildGhostBase(ctx),{id,m,motion,scene,controls}=ctx,n=id+'-v3-';
  const bone=m.bone.clone();bone.color.setHex(0xc5d5d2);bone.name=n+'cold-handpainted-bone';
  const cyan=m.evilGlow;
  const dorsal=group(motion,n+'great-reaping-arch');
  blade(dorsal,bone,n+'crescent-scythe-main-mass',[
    [-8.2,4.3],[-7.6,8.3],[-5.5,11.7],[-1.6,13.1],[3.8,12.1],[7.8,9.4],[10.2,5.4],
    [7.1,8.1],[3.1,9.9],[-1.4,10.9],[-4.3,10],[-6.2,7.4]],.42,[0,0,-.21]);
  tube(dorsal,m.iron,n+'crescent-inner-forged-edge',[[-7.6,5],[-5.7,8.7],[-1.5,11],[3.2,10.1],[7.2,8.2],[10.2,5.4]],.13,42);
  // Vertebral blocks and tendon seams break the arch into handmade bonework.
  for(let i=0;i<7;i++){
    const x=-5.4+i*1.78,y=11.8-Math.pow((x+.5)/4.7,2)*1.7;
    blade(dorsal,i%2?m.iron:bone,n+'vertebral-cap-'+i,[[-.4,-.32],[-.53,.61],[.12,.86],[.6,.24],[.4,-.4]],.74,[x,y,-.37],[0,0,-.08*i]);
    beam(dorsal,m.rope,n+'vertebral-binding-'+i,[x-.27,y-.15,-.43],[x+.27,y+.42,-.43],.055);
  }
  for(const side of [-1,1]){
    const wing=scene.getObjectByName(id+'-v2-curse-wing-'+side);
    if(!wing)throw new Error('V2 ghost wing pivot missing');
    trailingShroud(wing,m.gray,n+'great-flowing-shroud-'+side,side,16.5,5.8,.4);
    trailingShroud(wing,m.ivory,n+'lower-detached-shroud-'+side,side,13.8,3.7,-1.2);
    tube(wing,bone,n+'swept-shroud-leading-bone-'+side,[[-1,1.2,side*1.1],[3,2.5,side*3.2],[8,1.8,side*5.8],[12,-.4,side*6.3],[15.5,-1.6,side*5.5]],.16,35);
    // Broad ribs are supports; the torn linen remains the dominant area.
    for(let i=0;i<3;i++)tube(wing,m.iron,n+'shroud-stay-'+side+'-'+i,[[1+i*3,1.7,side*1.6],[2+i*3,1.1,side*(4+i*.45)],[4+i*3,-.4,side*(6+i*.4)]],.075,17);
    const heart=group(motion,n+'soul-organ-'+side,[1.6,4.5,side*2.25]);
    sphere(heart,m.iron,n+'soul-organ-cradle-'+side,[0,0,0],[2.2,2.35,.38],16);
    sphere(heart,cyan,n+'bright-cyan-soul-heart-'+side,[0,0,side*.37],[1.3,1.6,.24],18);
    ring(heart,bone,n+'broken-reliquary-rim-'+side,[0,0,side*.4],1.85,.18,'z');
    for(let rib=0;rib<3;rib++)tube(heart,bone,n+'soul-organ-cage-'+side+'-'+rib,[[-1.65+rib*.65,-1.3,side*.65],[-1.9+rib*1.1,.1,side*.8],[-1.2+rib*.9,1.8,side*.53]],.09,18);
    chain(heart,m,n+'organ-anchor-'+side,[[0,-1.7,0],[.4,-2.2,side*.15],[1.1,-2.5,0]],8);
    const mouth=group(motion,n+'spear-maw-'+side);
    blade(mouth,m.dark,n+'maw-negative-space-'+side,[[-10.4,.55],[-7.4,1.45],[-4.6,.7],[-6.8,-1.05],[-9,-.35]],.09,[0,0,side*.85]);
    for(let i=0;i<7;i++){
      const x=-9.6+i*.71,y=.67+Math.sin(i/6*Math.PI)*.6,z=side*(.6+i*.11);
      spike(mouth,bone,n+'long-maw-upper-fang-'+side+'-'+i,[x,y,z],[x+.23,y-.7-(i%2)*.28,z-side*.14],.13);
      spike(mouth,bone,n+'long-maw-lower-fang-'+side+'-'+i,[x+.22,-.48,z],[x+.02,.05+(i%2)*.25,z-side*.08],.11);
    }
    // Floating veils use existing wing controls, with no new animation tracks.
    for(let i=0;i<2;i++)cloth(wing,m.gray,n+'separated-floating-veil-'+side+'-'+i,{at:[7+i*3,-2.1-i*.4,side*(5+i)],width:3.1,height:3.8-i*.7,ragged:true,rotation:[side*.26,0,-.3],billow:side*.8});
  }
  for(const c of controls)if(c.bone.name.includes('-v2-curse-wing-'))c.amplitude=.048;
  return finish(built,'거대한 뼈 초승낫과 장막 꼬리, 청록 영혼 기관을 품은 망령 포식자',[
    'v3-sculpted-crescent-scythe-spine','v3-two-layer-wide-flowing-grey-tail-shrouds','v3-large-caged-cyan-soul-organs',
    'v3-open-air-separated-funeral-veils','v3-long-wood-spear-with-double-fang-maw','v3-existing-wing-sway-amplitude-048'],
  '상부 뼈척추를 거대한 곡선 낫의 넓은 주형태로 재설계하고 넓게 벌어진 회색 천·장막 후미와 큰 청록 영혼 기관·철제 우리·봉합 척추·겹이빨을 계층화했다. 긴 목재 창과 회색 린넨의 정체성을 유지하며 기존 날개 sail control의 amplitude만 .048로 조정해 무거운 후속 흔들림을 준다.');
}

// Curved shell gores, with all vertices in the SAME original fold's space.
function shellGore(parent,mat,name,side,x0,x1,a0,a1){
  const p=[],uv=[],ix=[],nx=10,ny=8;
  for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){
    const u=i/nx,v=j/ny,x=x0+(x1-x0)*u,a=a0+(a1-a0)*v;
    const round=.72+.28*Math.sin((x+7.2)/15*Math.PI);
    p.push(x, .1+6.8*round*Math.cos(a),side*(.25+4.25*round*Math.sin(a)));
    uv.push(u,v);
  }
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
    const a=i*(ny+1)+j,b=a+ny+1;ix.push(a,b,a+1,a+1,b,b+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return mesh(parent,g,mat,name);
}

export function buildDisguisedWreck(ctx){
  const built=buildWreckBase(ctx),{id,m,motion,scene}=ctx,n=id+'-v3-';
  const folds=built.deployRig.nodeNames.map(name=>scene.getObjectByName(name));
  if(folds.length!==3||folds.some(x=>!x))throw new Error('Three original camouflage folds required');
  for(const [foldIndex,side]of [[0,-1],[1,1]]){
    const shell=group(folds[foldIndex],n+'massive-folding-shell-'+side);
    for(let i=0;i<4;i++){
      const x=-7.1+i*3.65;
      shellGore(shell,i%2?m.canvas:m.gray,n+'broad-weighted-sewn-canvas-'+side+'-'+i,side,x,x+3.6,.12,1.69);
      shellGore(shell,m.iron,n+'curved-scrap-crown-'+side+'-'+i,side,x+.16,x+2.8,.18,.62);
      tube(shell,m.darkWood,n+'massive-curved-wood-rib-'+side+'-'+i,[[x,.1,side*4],[x+.1,3.4,side*3.9],[x+.3,5.8,side*2.8],[x+.4,6.7,side*.65]],.22,24);
      for(let stitch=0;stitch<5;stitch++){
        const a=.65+stitch*.19,r=.72+.28*Math.sin((x+7.2)/15*Math.PI);
        beam(shell,m.rope,n+'heavy-cross-seam-'+side+'-'+i+'-'+stitch,[x-.18,.1+6.85*r*Math.cos(a),side*(.25+4.3*r*Math.sin(a))],[x+.22,.1+6.85*r*Math.cos(a+.07),side*(.25+4.3*r*Math.sin(a+.07))],.057);
      }
    }
    tube(shell,m.iron,n+'giant-closed-trap-lip-'+side,[[-7.6,-.4,side*.6],[-8.2,2.1,side*2],[-6.8,5.4,side*2.7],[-4.4,6.8,side*1.4],[0,7.1,side*.4],[5.8,5.8,side*1]],.3,36);
    chain(shell,m,n+'heavy-slack-shell-chain-'+side,[[-6,4.8,side*3],[0,3.4,side*4.65],[6,5.2,side*2.1]],19);
    for(let i=0;i<6;i++){
      const x=-6+i*2.2;
      blade(shell,m.iron,n+'deep-inner-jaw-tooth-'+side+'-'+i,[[-.5,0],[.5,.1],[.19,1.4],[-.16,1.95]],.38,[x,.1,side*3.9],[side*.6,0,i%2*.14]);
    }
    // End-on tusks turn the closed silhouette into a clenched trap, not a crate.
    blade(shell,m.iron,n+'folded-bow-mandible-'+side,[[-8.5,.1],[-9.1,2.2],[-7.8,5.1],[-5.1,6.8],[-6,4.7],[-7.2,2.7],[-6.6,.35]],.55,[0,0,side*.5]);
  }
  const mask=group(folds[2],n+'massive-front-curtain');
  cloth(mask,m.canvas,n+'heavy-front-stitched-shroud',{at:[-.3,2.5,0],width:7.4,height:7,ragged:true,rotation:[0,Math.PI/2,0],billow:1.15});
  chain(mask,m,n+'front-shroud-ballast-chain',[[0,1.6,-3.2],[-.35,-2.7,0],[0,1.6,3.2]],17);
  const inside=group(motion,n+'revealed-trap-interior');
  sphere(inside,m.iron,n+'inner-furnace-cradle',[.4,.4,0],[2.5,1.25,1.35],16);
  sphere(inside,m.warning,n+'bright-ochre-inner-core',[.4,1,0],[1.6,.75,.88],16);
  for(const side of [-1,1]){
    sphere(inside,m.evilGlow,n+'hot-core-side-'+side,[.4,.75,side*1.12],[1.4,.48,.15],14);
    eye(inside,m,n+'large-concealed-red-eye-'+side,[-3.2,1.25,side*1.5],[2.15,.28,.15],[0,0,side*-.18]);
    tube(inside,m.iron,n+'massive-pincer-arm-'+side,[[-1,-.5,side*1.1],[-3,-1.25,side*2.7],[-5.7,-.8,side*3.2],[-7,-.1,side*2.6]],.27,26);
    for(const finger of [-1,1])tube(inside,m.iron,n+'hooked-pincer-finger-'+side+'-'+finger,[[-6.1,-.6,side*3],[-7.8,finger*.6,side*2.7],[-8.15,finger*.35,side*1.55]],.15,20);
  }
  built.deployRig.description+=' v3 곡면 폐철갑·큰 봉합천·사슬·턱외피는 전부 기존 fold3의 자식이며 같은 AmbushReveal을 상속한다. 내부 밝은 핵·큰 붉은 눈·집게는 표시용이다.';
  return finish(built,'둥근 폐선 외피 전체가 접힌 거대 봉합 덫, 전개 후 뜨거운 핵과 철제 집게',[
    'v3-massive-curved-clenched-trap-shell','v3-broad-sewn-weighted-canvas-under-scrap-crown',
    'v3-layered-deep-iron-inner-teeth','v3-heavy-ballast-chains-on-original-three-folds',
    'v3-bright-inner-core-and-large-red-eyes','v3-sculpted-hooked-iron-pincers'],
  '작은 갈비 폐선을 큰 곡면 봉합 몸통·접힌 턱·폐철갑 왕관으로 재구성하고 넓은 천의 면적과 무거운 사슬을 주형태로 삼았다. 열린 안쪽은 큰 철제 이빨층·황금색 밝은 핵·붉은 눈·쇠집게가 대비한다. 추가 외피는 모두 기존 외피3본에 종속되며 control 이름·수·전개각·약점을 유지한다.');
}
