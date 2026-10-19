import { group, box, sphere, beam, tube, ring, cloth, hull, balloon, engine, plate, gun, chain, gear, claw, lantern, threat } from './core.js';

// Entire replacement silhouettes, in art units. No source GLB or gameplay state.
export function buildIndustrial(ctx) {
  const { id, motion, controls, m } = ctx;
  if (!['enemy-tax-cutter', 'mission-union-guard', 'mission-bridge-tug', 'role-enemy-artillery'].includes(id)) return null;
  const name = suffix => suffix.startsWith(`${id}-bold-`) ? suffix : `${id}-bold-${suffix}`;
  const root = group(motion, name('body'));
  const b = (p, mat, n, at, size, rot) => box(p, mat, name(n), at, size, rot);
  const s = (p, mat, n, at, size) => sphere(p, mat, name(n), at, size, 20);
  const rod = (p, mat, n, a, z, r = .12) => beam(p, mat, name(n), a, z, r);
  const pipe = (p, mat, n, points, r = .16) => tube(p, mat, name(n), points, r, 24);
  const hoop = (p, mat, n, at, r, thick = .12, axis = 'x') => ring(p, mat, name(n), at, r, thick, axis);
  const skin = (p, mat, n, xy, depth, at, rot) => plate(p, mat, name(n), xy, depth, at, rot);
  const puff = (p, n, at, length, radius, material) => balloon(p, m, name(n), { at, length, radius, flatten: .84, material, net: true }, controls);
  const motor = (p, n, at, scale, rotation) => engine(p, m, name(n), { at, scale, rotation }, controls);
  const tooth = (p, n, at, height, width, rot) => skin(p, m.ivory, n, [[-width,0],[0,height],[width,0]], .5, at, rot);
  const horn = (p, n, points, r) => pipe(p, m.ivory, n, points, r);
  const rivets = (p, n, at, count, spacing, axis = 'x') => {
    for (let i = 0; i < count; i++) {
      const v = [...at]; v[{ x:0,y:1,z:2 }[axis]] += i * spacing;
      s(p, m.brass, `${n}-${i}`, v, [.13,.13,.13]);
    }
  };
  const vent = (p, n, at, size) => {
    b(p, m.ink, `${n}-void`, at, size);
    for (let i = 0; i < 5; i++) b(p, m.brass, `${n}-slat-${i}`, [at[0], at[1] + (i-2)*size[1]/6, at[2]+size[2]*.55], [size[0]*.9,.08,.1], [0,0,-.12]);
  };

  if (id === 'enemy-tax-cutter') {
    // The buoyant body IS a gallows/toll gate: the mouth owns the bow.
    hull(root,m,name('coffin-keel'),{length:15.5,width:6.6,depth:3.5,at:[.5,0,0],bow:.3,style:'metal'});
    s(root,m.dark,name('coffin-stern'),[5,1.2,0],[4.5,2.5,3.1]);
    skin(root,m.red,'coffin-face',[[-7,-1],[-9,1],[-6,4],[3,4.3],[6,1.5],[5,-1]],5.5);
    // Open black throat with upper brow and moving lower execution jaw.
    s(root,m.ink,name('throat'),[-6.7,2.5,0],[3.3,2.7,3.4]);
    skin(root,m.iron,'upper-biting-brow',[[-11,3],[-7.4,6],[-3.4,5.5],[-3,3.8],[-8,3.5]],6.4);
    const jaw = group(root,name('hinged-lower-jaw'),[-3.4,.4,0]);
    skin(jaw,m.iron,'lower-jaw',[[-8,-.3],[-7,-2],[.5,-1.5],[1.3,.3],[-1.6,.8]],7);
    for(let i=0;i<5;i++) {
      tooth(jaw,`bottom-tooth-${i}`,[-7+i*1.3,.05,i%2?.55:-.55],1.65,.48);
      tooth(root,`top-tooth-${i}`,[-10+i*1.25,3.8,i%2?.55:-.55],1.45,.42,[0,0,Math.PI]);
    }
    threat(ctx,jaw,'z',-.24);
    for (const z of [-3.5,3.5]) {
      hoop(root,m.brass,`jaw-hinge-${z}`,[-3,.65,z],.85,.22,'z');
      chain(root,m,name(`jaw-chain-${z}`),[[-9,1,z],[-6,4.5,z],[-3,6,z]],12);
      rod(root,m.iron,`gate-upright-${z}`,[0,2,z],[0,13.5,z],.5);
      skin(root,m.brass,`gate-foot-${z}`,[[-1,0],[1,0],[.7,3],[-.3,4]],.32,[-.3,1,z]);
    }
    puff(root,'bloated-blood-red-lift',[3.6,10.3,0],15.2,4.1,'red');
    for(const z of [-3.9,3.9]) {
      cloth(root,m.canvas,name(`ragged-seal-${z}`),{at:[3.2,10,z],width:3.5,height:3.8,ragged:true,billow:.18,rotation:[0,z<0?Math.PI:0,.18]});
      s(root,m.red,name(`large-wax-seal-${z}`),[2.6,8.7,z*1.03],[1.05,1.05,.18]);
      skin(root,m.brass,`seal-cleft-${z}`,[[-.12,-.65],[.12,-.65],[.12,.65],[-.12,.65]],.12,[2.6,8.7,z*1.08],[0,0,-.45]);
    }
    const balance = group(root,name('unfair-balance'),[-.5,14.3,0]);
    rod(balance,m.brass,'balance-beam',[-6,.8,0],[7,-.8,0],.4);
    s(balance,m.iron,name('balance-hub'),[0,0,0],[1,.9,1]);
    for (const [x,y,z] of [[-5.5,-3.2,1.4],[6.3,-4,-1.1]]) {
      chain(balance,m,name(`hanging-cage-chain-${x}`),[[x,.1,z],[x,y+1.6,z]],9);
      const cage=group(balance,name(`sealed-cage-${x}`),[x,y,z]);
      s(cage,m.dark,name(`cage-weight-${x}`),[0,0,0],[1.35,1.8,1.25]);
      for(let i=0;i<8;i++) { const a=i*Math.PI/4; rod(cage,m.brass,`cage-rib-${x}-${i}`,[Math.cos(a)*1.45,-1.7,Math.sin(a)*1.3],[Math.cos(a)*1.45,1.7,Math.sin(a)*1.3],.13); }
      hoop(cage,m.iron,`cage-band-${x}`,[0,-1.4,0],1.5,.2,'y');
    }
    threat(ctx,balance,'z',.1);
    motor(root,'rear-pressure-mill',[8.6,2.5,-2.2],1.7);
    pipe(root,m.brass,'crooked-stack',[[5,3,2],[5.4,6,2],[7.3,7.3,2],[8,7.3,2]],.46);
    lantern(root,m,name('prison-lantern'),[-1.5,6,4.2],1.2);
    rivets(root,'coffin-nails',[-4,1.8,2.94],9,1.15);
    return {theme:'입을 벌린 처형 관문과 기울어진 징세 저울',features:['선수 전체를 삼킨 거대 철제 턱과 상아 톱니','붉은 봉제 기낭을 꿰뚫는 높은 징세 관문','서로 다른 높이의 봉인 철창 저울추','관 모양의 두꺼운 적갈색 판금 선체','턱 벌림과 불공평한 저울의 위협 동작','왁스 봉인·황동 사슬·따뜻한 감옥등'],artModules:{body:'coffin-toll-gate',signature:'hinged-execution-jaw',lift:'swollen-crimson-sealed-bag',visualOnly:true}};
  }

  if (id === 'mission-union-guard') {
    // A charging armored rhinoceros, with the head wider than its cockpit.
    s(root,m.gray,name('rhino-shoulder'),[.8,2.7,0],[6.5,3.8,4.6]);
    s(root,m.iron,name('massive-forehead'),[-5,2.8,0],[4.6,3.6,4.1]);
    s(root,m.dark,name('low-rhino-muzzle'),[-8.3,1.2,0],[3.1,2.1,3.1]);
    hull(root,m,name('armored-belly'),{length:15,width:7,depth:2.3,at:[0,-.7,0],style:'metal'});
    const head=group(root,name('horn-head-pivot'),[-6.5,2.6,0]);
    horn(head,'great-swept-horn',[[-2,0,0],[-4.2,1.1,0],[-5.1,3.4,0],[-5.3,5.7,0]],.72);
    horn(head,'secondary-horn',[[0,1.3,0],[-.6,2.6,0],[-1.8,3.6,0]],.42);
    hoop(head,m.brass,'horn-root',[-2.1,.15,0],1,.21,'x');
    threat(ctx,head,'z',.15);
    for (const z of [-1,1]) {
      skin(root,m.gray,`rhino-cheek-${z}`,[[-9,1],[-7,4.8],[-3,5],[-1,2.5],[-4,-.2]],.72,[0,0,z*3.45],[0,z*.1,0]);
      skin(root,m.ink,`angry-eye-socket-${z}`,[[-7,3.9],[-3.8,3.1],[-6.5,2.8]],.24,[0,0,z*3.93]);
      b(root,m.cold,`eye-slit-${z}`,[-5.5,3.2,z*4.12],[1.5,.15,.12],[0,0,-.18]);
      puff(root,`short-chain-lift-${z}`,[2.1,9,z*4.35],11.8,2.8,'gray');
      chain(root,m,name(`great-lift-chain-${z}`),[[-2,3.6,z*3.6],[-1,7.5,z*5.6],[4.5,7.5,z*5.6],[5.4,3.5,z*3.2]],17);
      skin(root,m.red,`shoulder-guard-${z}`,[[-1,0],[-2,2],[0,4],[4,3.5],[5,1],[3,-1]],1.3,[.8,1.6,z*4],[0,z*.09,0]);
      rivets(root,`shoulder-rivets-${z}`,[.5,3.2,z*4.75],5,.8);
      motor(root,`enormous-stern-booster-${z}`,[7.1,2,z*3.2],2.25);
      pipe(root,m.brass,`booster-feed-${z}`,[[3,3.5,z*4.2],[4,5.4,z*4.8],[6.5,5.4,z*3.7],[7.1,3,z*3.2]],.24);
    }
    const cannon=group(root,name('left-shoulder-cannon'),[-.8,6,-2.3],[0,.08,0]);
    gun(cannon,m,name('heavy-shoulder-gun'),{at:[0,0,0],scale:1.4,barrelRadius:.72,barrelLength:5.5},controls);
    s(root,m.teal,name('back-command-shell'),[4,5.7,0],[2.4,1.7,2]);
    vent(root,'snarling-nostril',[-8.3,1.8,2.9],[2.2,1,.28]);
    gear(root,m.brass,name('neck-lock'),[-2,2.3,4.6],1.1,'z');
    cloth(root,m.red,name('torn-regimental-cloth'),{at:[5.5,7,1],width:2.5,height:3,ragged:true,billow:.3,rotation:[0,0,-.1]});
    return {theme:'돌진하는 갑주 코뿔소형 노조 경비함',features:['거대한 이마·낮은 주둥이·굽은 돌진 뿔','머리보다 뒤로 뭉친 판금 어깨와 포대','어깨 양옆을 감싼 짧고 굵은 쌍기낭','선체까지 내려오는 굵은 구속 사슬','대형 쌍추진기와 비대칭 어깨 중포','노려보는 잔광 눈과 머리 들이밀기 동작'],artModules:{body:'armored-rhino-head',signature:'swept-ram-horn',lift:'short-chained-twin-bags',visualOnly:true}};
  }

  if (id === 'mission-bridge-tug') {
    // A broad bison/work crane; the two pontoons replace a conventional boat.
    for(const z of [-4.5,4.5]) {
      hull(root,m,name(`split-working-pontoon-${z}`),{length:17,width:3.6,depth:3.3,at:[0,-.8,z],style:'metal'});
      s(root,m.teal,name(`round-pontoon-nose-${z}`),[-6.5,-.4,z],[3,2,2]);
      b(root,m.wood,`pontoon-walking-deck-${z}`,[.5,1.1,z],[14,.5,2.9]);
      motor(root,`pontoon-drive-${z}`,[7.6,.2,z],1.5);
      pipe(root,m.brass,`horn-${z}`,[[-4,5,z*.65],[-7,7,z],[-9.2,9,z*1.3],[-8.4,11,z*1.38]],.63);
      hoop(root,m.iron,`drum-flange-${z}`,[-3.2,3,z],2.9,.34,'z');
      const drum=group(root,name(`winch-drum-${z}`),[-3.2,3,z]);
      s(drum,m.darkWood,name(`drum-core-${z}`),[0,0,0],[2.5,2.5,1.25]);
      for(let j=-4;j<=4;j++) hoop(drum,m.rope,`wrapped-haul-line-${z}-${j}`,[0,0,j*.26],2.4,.16,'z');
      gear(root,m.brass,name(`great-winch-gear-${z}`),[-3.2,3,z*1.28],2.35,'z');
      threat(ctx,drum,'z',.38);
      rod(root,m.iron,`crane-rear-leg-${z}`,[5,1,z],[0,13,z*.7],.5);
      rod(root,m.teal,`tilted-crane-front-leg-${z}`,[-5,1,z],[-1.8,13.3,z*.7],.6);
      chain(root,m,name(`forward-hook-haul-${z}`),[[-1,12.5,z*.7],[-7.3,7,z*.84],[-11.5,2.1,z]],18);
      const hook=group(root,name(`forked-hauling-hook-${z}`),[-11.2,1.1,z]);
      claw(hook,m,name(`hook-claw-${z}`),[0,0,0],1.8);
      horn(hook,`hook-return-${z}`,[[0,1,0],[-1.6,-.3,0],[-1.5,-2.1,0],[.5,-2.5,0],[1.3,-1,0]],.4);
      lantern(root,m,name(`work-lamp-${z}`),[-5.8,5,z*1.15],1.2);
    }
    b(root,m.iron,'wide-bridge-crossbeam',[1,1,0],[10,1,10]);
    b(root,m.wood,'bridge-floor',[2,1.7,0],[8,.4,7]);
    rod(root,m.brass,'a-frame-crown',[-1.8,13.3,-3.15],[-1.8,13.3,3.15],.64);
    puff(root,'bison-humped-lift',[4.3,7,0],11.4,4.3,'teal');
    s(root,m.iron,name('bison-brow'),[-5.5,5.8,0],[2.5,2.5,3.3]);
    skin(root,m.red,'nose-armored-mask',[[-8,2],[-9,4.5],[-7,7.3],[-3,7],[-1,4],[-3,1]],4.4);
    for(const z of [-2.4,2.4]) b(root,m.glow,`low-work-eye-${z}`,[-7,5.2,z],[1.4,.22,.3],[0,0,-.15]);
    pipe(root,m.iron,'overworked-exhaust',[[4,2,2.4],[5,5,2.4],[4.2,10.8,2.4],[5.6,11.7,2.4]],.5);
    cloth(root,m.canvas,name('striped-work-apron'),{at:[2.2,4.8,4.2],width:4.2,height:3,ragged:true,billow:.2,rotation:[0,0,.12]});
    rivets(root,'mask-bolts',[-7.5,3.3,2.3],6,.95);
    return {theme:'쌍드럼과 뿔을 세운 들소형 교량 예인함',features:['배 대신 넓게 벌어진 두 작업용 부력 선체','앞으로 기운 거대 A프레임과 높은 가로보','얼굴 양옆을 차지하는 굵은 감김 드럼','위로 솟은 들소 뿔과 낮게 노려보는 철가면','앞으로 길게 내민 쌍갈고리와 늘어진 사슬','청록색 어깨 기낭·목재 발판·살아 움직이는 윈치'],artModules:{body:'split-pontoon-bison',signature:'tilted-a-frame-twin-winches',lift:'humped-teal-work-bag',visualOnly:true}};
  }

  // A gun barrel beast: its barrels consume the entire forward half.
  hull(root,m,name('low-recoil-crescent'),{length:13,width:10,depth:2.6,at:[1,-.6,0],style:'metal'});
  skin(root,m.iron,'crescent-bow',[[-7,-.5],[-8,1.3],[-5,3],[1,3.7],[6,2.4],[8,.1],[3,-1.7],[-3,-1.7]],8.6);
  s(root,m.red,name('plump-breech-back'),[4.6,2.7,0],[4.6,3.4,4.5]);
  puff(root,'short-plump-stitchbag',[5.4,8.4,0],10.5,3.8,'gray');
  const battery=group(root,name('twin-barrel-cradle'),[-1,3.8,0]);
  for(const z of [-2.5,2.5]) {
    s(battery,m.iron,name(`great-breech-${z}`),[0,0,z],[3,2.3,2]);
    gun(battery,m,name(`dominant-twin-barrel-${z}`),{at:[-1,0,z],scale:1.6,barrelRadius:1.1,barrelLength:8},controls);
    rod(root,m.brass,`recoil-rail-${z}`,[-5,1.6,z],[6,1.6,z],.26);
    pipe(root,m.brass,`recoil-piston-${z}`,[[-1,2.3,z*1.5],[3.6,2.3,z*1.5],[5,4.6,z*1.4]],.34);
    pipe(root,m.iron,`sweeping-heat-pipe-${z}`,[[2,3,z],[2.8,6,z*1.7],[6,6,z*1.6],[7.6,9,z*1.4]],.38);
    motor(root,`low-rear-drive-${z}`,[7.5,-.1,z*1.2],1.55);
  }
  threat(ctx,battery,'x',.035);
  // The giant exposed elevation cog is intentionally one-sided.
  gear(root,m.brass,name('immense-elevation-cog'),[.1,3.2,5.5],3.9,'z');
  hoop(root,m.iron,'elevation-rim',[.1,3.2,5.6],3.1,.3,'z');
  s(root,m.darkWood,name('elevation-axle'),[.1,3.2,5.9],[1.1,1.1,.6]);
  for(let i=0;i<6;i++) { const a=i*Math.PI/3; rod(root,m.iron,`cog-spoke-${i}`,[.1,3.2,5.7],[.1+Math.cos(a)*3.1,3.2+Math.sin(a)*3.1,5.7],.23); }
  s(root,m.teal,name('offset-sighting-turret'),[4.7,5.1,-3.6],[1.8,1.5,1.9]);
  b(root,m.ink,'targeting-brow',[3.9,5.6,-5.05],[2.5,.8,.3],[0,0,-.15]);
  b(root,m.glow,'targeting-eye',[3.7,5.5,-5.25],[1.4,.16,.12]);
  for(const z of [-3.6,3.6]) {
    chain(root,m,name(`bag-anchor-${z}`),[[1,3,z],[2.6,7.3,z],[7,6.7,z],[7,1.6,z]],15);
    cloth(root,m.red,name(`bag-scorched-patch-${z}`),{at:[5,9,z],width:3.5,height:2.4,ragged:true,billow:.15,rotation:[0,z<0?Math.PI:0,.2]});
  }
  vent(root,'hot-breech-vents',[5.7,3.2,4],[3,1.8,.4]);
  lantern(root,m,name('amber-pressure-lamp'),[7.4,4.9,-3],1.1);
  rivets(root,'crescent-rivets',[-5,.6,4.45],11,1.1);
  return {theme:'쌍포신이 몸의 절반을 차지한 짧고 육중한 포수 짐승',features:['전방 절반을 압도하는 굵고 긴 쌍포신','낮고 넓은 초승달 반동 갑판','한쪽 옆구리를 채운 거대한 노출 승강 톱니','짧고 통통한 봉제 기낭과 붉은 그을림 천','포미 압력실·반동 레일·굽은 열 배출 배관','비대칭 조준 눈과 미세하게 비트는 위협 포가'],artModules:{body:'stubby-barrel-beast',signature:'giant-twin-muzzles-crescent-cradle',lift:'short-plump-stitchbag',visualOnly:true}};
}
