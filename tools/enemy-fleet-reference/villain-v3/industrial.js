/**
 * Villain v3: large functional silhouettes first, layered forged machinery second.
 * Preserve v2 and all original controls/weakpoints/art counts. These assemblies
 * are visual proposals: no additional weapons, collision, repair AI or sim rules.
 */
import { buildUnionSalvage as baseSalvage, buildUnionRepair as baseRepair } from '../villain-v2/industrial.js';
import { THREE, group, box, cyl, tube, beam, ring, panel } from '../kit.js';
import { blade, chain, eye } from '../villain-v2/style.js';

function need(ctx, suffix) {
  const node = ctx.motion.getObjectByName(ctx.id + '-' + suffix);
  if (!node) throw new Error('Missing retained industrial node: ' + suffix);
  return node;
}
function note(built, theme, features, text) {
  built.villainTheme = theme;
  built.features.push(...features);
  built.referenceNotes += ' 악당 외형v3 / 최신 10배 이상 과감한 표현 목표: ' + text + ' 큰 주형태→중간 기계층→작은 체결부 순서이며 원본 장치/약점/controls/모듈 수와 실제 규칙은 보존한다. 실제 렌더와 사람의 미술 승인은 통합 QA에서 별도 확인한다.';
  return built;
}
function gear(parent, m, name, at, radius, count = 12) {
  const root = group(parent, name, at);
  cyl(root, m.iron, name + '-body', [0, 0, 0], radius, .22, 'z', 20);
  cyl(root, m.blood, name + '-recess', [0, 0, -.15], radius * .62, .12, 'z', 16);
  ring(root, m.brass, name + '-ring', [0, 0, -.23], radius * .42, .075, 'z');
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count;
    box(root, m.iron, name + '-tooth-' + i, [Math.cos(a) * radius, Math.sin(a) * radius, 0], [.28, .35, .24], [0, 0, a]);
  }
  return root;
}
function binding(parent, m, name, a, b, width = .13) {
  beam(parent, m.brass, name, a, b, width);
}

export function buildUnionSalvage(ctx) {
  const built = baseSalvage(ctx), {id, motion, m} = ctx, n = id + '-v3-';
  const claw = need(ctx, 'three-jaw-salvage-claw');
  const crane = need(ctx, 'two-section-truss-crane');
  const winch = need(ctx, 'weakpoint-exposed-cable-drum');

  // A hull-sized, deliberately OPEN scythe trap rides the original hook pivot.
  // Three broad forgings replace the small tool reading without a global scale.
  for (let i = 0; i < 3; i++) {
    const jaw = need(ctx, 'three-jaw-salvage-claw-jaw-pivot-' + i);
    blade(jaw, m.iron, n + 'great-open-scythe-' + i,
      [[.12,.4],[1.25,.65],[3.5,-.15],[4.3,-1.45],[4.15,-2.75],[3.25,-4.05],[1.3,-4.75],[2.4,-3.4],[2.86,-2.3],[2.87,-1.25],[2.25,-.55],[.65,-.18]], .58, [0,0,-.29]);
    blade(jaw, m.blood, n + 'scythe-spine-' + i,
      [[.64,.39],[1.34,.43],[3.35,-.36],[3.98,-1.49],[3.82,-2.66],[3.23,-3.36],[3.33,-2.28],[3.25,-1.34],[2.75,-.74]], .19, [0,0,-.41]);
    blade(jaw, m.bone, n + 'hook-inner-cutting-edge-' + i,
      [[2.87,-1.25],[2.86,-2.3],[2.4,-3.4],[1.3,-4.75],[2.21,-4.17],[2.99,-3.09],[3.17,-1.61]], .13, [0,0,-.46]);
    // Only three large load-bearing teeth, rather than decorative spike rows.
    for (let k = 0; k < 3; k++) blade(jaw, m.bone, n + 'capture-lock-tooth-' + i + '-' + k,
      [[2.65,-1.4-k*.68],[2.13,-1.75-k*.68],[2.73,-1.86-k*.68]], .32, [0,0,-.2]);
    cyl(jaw,m.brass,n+'massive-jaw-pin-'+i,[.72,.13,-.51],.36,.24,'z',14);
    binding(jaw,m,n+'jaw-hydraulic-brace-'+i,[.46,.05,.35],[2.37,-.74,.35],.18);
  }
  cyl(claw,m.blood,n+'capture-crown',[0,.56,0],.84,.7,'y',12);
  ring(claw,m.brass,n+'capture-crown-collar',[0,.92,0],.8,.12,'y');

  // Broad cheek shields frame the drum; exposed cable and original weakpoint
  // remain above them. The winch itself carries its new reduction housing.
  for (const s of [-1,1]) {
    const cheek = group(motion,n+'predator-cheek-'+s,[-3.5,-.2,s*2.48]);
    blade(cheek,m.iron,n+'great-cheek-plate-'+s,[[-2,.6],[-1.5,1.6],[.8,1.25],[1.5,.18],[1,-1.55],[-.8,-2.12],[-1.9,-1.45]],.32);
    blade(cheek,m.blood,n+'cheek-painted-ridge-'+s,[[-1.75,.5],[-1.33,1.27],[.63,.95],[.9,.36],[.18,.55],[-.9,.4],[-1.53,-1.2]],.13,[0,0,s*.24]);
    eye(cheek,m,n+'cheek-watch-slit-'+s,[-.62,.67,s*.31],[1.6,.13,.12],[0,0,-.13]);
    // Rear prison/scrap cradle is a two-storey open cage, not another cabin.
    const cage=group(motion,n+'aft-scrap-cradle-'+s,[3.05,.4,s*2.22]);
    for (const y of [.16,1.55,2.8]) {
      box(cage,m.iron,n+'cradle-shelf-'+s+'-'+y,[0,y,0],[3.8,.2,1.08]);
      binding(cage,m,n+'cradle-brass-edge-'+s+'-'+y,[-1.9,y,.57],[1.9,y,.57],.065);
    }
    for (const x of [-1.78,0,1.78]) {
      beam(cage,m.iron,n+'cage-upright-'+s+'-'+x,[x,.1,s*.52],[x,2.8,s*.52],.12);
      beam(cage,m.blood,n+'cage-diagonal-'+s+'-'+x,[x-.45,.23,s*.56],[x+.5,1.4,s*.56],.1);
    }
    for (let i=0;i<3;i++) blade(cage,i%2?m.blood:m.warning,n+'scrap-cargo-'+s+'-'+i,[[-.65,-.25],[.68,-.18],[.8,.42],[.12,.8],[-.7,.53]],.5,[-1.15+i*1.1,.72,s*.1],[0,.23*i,.2-i*.23]);
    chain(cage,m,n+'cargo-lock-chain-'+s,[[-1.75,2.7,s*.65],[0,1.85,s*.85],[1.75,2.7,s*.65]],17);
  }
  gear(winch,m,n+'second-stage-drive',[1.55,-.58,-1.7],.8,12);
  binding(winch,m,n+'drive-connecting-rod',[.15,.18,-1.98],[1.55,-.58,-1.98],.11);
  panel(crane,m.iron,n+'massive-crane-root-shield',[.2,.3,-.85],[1.95,1.65,.3],[0,0,-.2],m.brass);
  gear(crane,m,n+'crane-load-reducer',[.2,.3,-1.08],.67,10);
  return note(built,'공중 고철 포식자 — 선체 크기의 열린 낫 집게와 다층 포획 적재실',
    ['hull-sized-open-three-scythe-capture-jaws','ivory-inner-cutting-edges-and-three-lock-teeth','paired-great-forged-predator-cheeks','two-storey-open-scrap-prison-cradles','offset-two-stage-drum-reduction-drive'],
    '인양선은 청록 기낭과 거대 드럼의 정체성을 남기고 열린 포획턱·쌍장갑 뺨·적재실의 주형태로 재설계. 거대 낫과 유압 버팀은 원래 세 jaw pivot과 hook의 자식이어서 크레인/집게 움직임을 그대로 따른다.');
}

function furnaceStack(parent,m,name,at,height,radius,lean) {
  const g=group(parent,name,at);
  tube(g,m.iron,name+'-body',[[0,0,0],[0,height*.65,0],[lean,height,0]],radius,16);
  for (const [i,y] of [[0,.3],[1,height*.48],[2,height*.7]]) ring(g,m.blood,name+'-thick-binding-'+i,[i===2?lean*.15:0,y,0],radius*1.12,.11,'y');
  cyl(g,m.blood,name+'-flared-outlet',[lean,height,0],radius*1.42,.4,'y',12,radius*1.2);
  cyl(g,m.dark,name+'-open-soot-throat',[lean,height+.23,0],radius*1.03,.035,'y',12);
  ring(g,m.brass,name+'-outlet-rim',[lean,height+.25,0],radius*1.2,.075,'y');
}
export function buildUnionRepair(ctx) {
  const built = baseRepair(ctx), {id,motion,m} = ctx, n=id+'-v3-';
  const workshop=need(ctx,'long-multiwindow-workshop');
  const high=need(ctx,'high-side-hydraulic-repair-boom-lantern-basket');
  const low=need(ctx,'lower-side-hydraulic-repair-boom-lantern-basket');
  // A tall horseshoe furnace takes the ENTIRE bow, with visible dark throat.
  const mouth=group(motion,n+'great-bow-furnace',[-5.0,.55,0],[0,-Math.PI/2,0]);
  box(mouth,m.dark,n+'deep-furnace-throat',[0,.65,-.38],[4.4,3.55,1.2]);
  box(mouth,m.evilGlow,n+'deep-orange-hot-core',[0,.72,.25],[3.72,2.8,.1]);
  // Heavy arched shell follows the open inner contour; no solid glowing face.
  const arch=[[-2.85,-1.65],[-3.05,1.1],[-2.52,2.65],[-1.45,3.38],[1.45,3.38],[2.52,2.65],[3.05,1.1],[2.85,-1.65],[1.95,-1.65],[2.13,.8],[1.72,1.96],[.95,2.5],[-.95,2.5],[-1.72,1.96],[-2.13,.8],[-1.95,-1.65]];
  blade(mouth,m.iron,n+'cathedral-forge-arch',arch,1.0,[0,0,.12]);
  tube(mouth,m.brass,n+'arched-forge-binding',[[-2.48,-1.5,1.2],[-2.67,1.0,1.2],[-1.98,2.5,1.2],[0,2.99,1.2],[1.98,2.5,1.2],[2.67,1,1.2],[2.48,-1.5,1.2]],.09,26);
  for (const s of [-1,1]) {
    const door=group(mouth,n+'half-open-forge-door-'+s,[s*2.15,.35,1.18],[0,s*.66,0]);
    panel(door,m.blood,n+'red-forge-door-plate-'+s,[-s*.66,.15,0],[1.32,2.62,.25],[0,0,0],m.brass);
    for (let i=0;i<3;i++) box(door,m.iron,n+'door-crossbar-'+s+'-'+i,[-s*.66,-.74+i*.79,.2],[1.6,.17,.19]);
    ring(door,m.brass,n+'door-ring-handle-'+s,[-s*1.08,.17,.25],.19,.065,'z');
    for (let i=0;i<3;i++) blade(mouth,m.bone,n+'forge-upper-fang-'+s+'-'+i,[[0,0],[.48,0],[.25,-.7]],.35,[s*(.45+i*.56),2.35-i*.12,1.15]);
    blade(mouth,m.iron,n+'lower-forge-tusk-'+s,[[0,0],[.65,0],[.8,1.15],[.32,.63]],.45,[s*1.12,-1.2,1.25],[0,0,s*.16]);
  }
  box(mouth,m.iron,n+'lower-furnace-jaw',[0,-1.56,.84],[5.4,.57,1.25]);
  for(let i=0;i<5;i++) box(mouth,m.iron,n+'throat-grate-'+i,[-1.35+i*.68,.4,.52],[.13,2.6,.16]);
  // Roof/workshop becomes layered iron cladding while narrow hot windows stay.
  for(const s of [-1,1]) {
    for(let i=0;i<3;i++) {
      panel(workshop,i===1?m.blood:m.iron,n+'great-flank-plate-'+s+'-'+i,[-1.93+i*1.92,.4,s*2.27],[1.78,1.02,.27],[0,0,(i-1)*.045],m.brass);
      panel(workshop,m.iron,n+'window-shutter-hood-'+s+'-'+i,[-1.93+i*1.92,1.89,s*2.25],[1.78,.55,.32],[0,0,-.05],m.brass);
    }
    tube(workshop,m.brass,n+'hot-external-return-pipe-'+s,[[-2.8,.2,s*2.6],[-1.7,-.3,s*2.75],[1.9,-.3,s*2.75],[2.8,.7,s*2.6],[2.8,2.45,s*2.6]],.15,20);
    furnaceStack(motion,m,n+'great-outboard-chimney-'+s,[2.4,.7,s*2.85],s===1?5.75:4.65,s===1?.5:.42,s*.52);
    furnaceStack(motion,m,n+'secondary-chimney-'+s,[4.55,1.1,s*2.65],s===1?3.45:4.1,.31,-.42);
  }
  // High hydraulic end is now a great open pair of shears, low end a 3m disc.
  for(const s of [-1,1]) {
    const shear=group(high,n+'high-open-shear-'+s,[s*.24,.15,-.7],[0,0,s*.27]);
    blade(shear,m.iron,n+'great-shear-blade-'+s,[[0,.7],[s*.65,.45],[s*1.15,-.4],[s*.99,-2.6],[s*.35,-3.35],[s*.52,-1.24],[s*.18,-.35]],.36);
    blade(shear,m.bone,n+'shear-cutting-edge-'+s,[[s*.35,-3.35],[s*.52,-1.24],[s*.18,-.35],[s*.45,-.58],[s*.75,-1.55]],.12,[0,0,-.15]);
    cyl(shear,m.brass,n+'shear-hinge-'+s,[s*.22,.02,-.23],.3,.19,'z',12);
  }
  const saw=group(low,n+'great-low-cutting-wheel',[-.12,-.25,-.9]);
  gear(saw,m,n+'wheel-hub',[0,0,0],.66,12);
  ring(saw,m.iron,n+'great-saw-annulus',[0,0,.12],1.37,.26,'z');
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8;
    const tooth=group(saw,n+'saw-tooth-root-'+i,[0,0,0],[0,0,a]);
    blade(tooth,m.bone,n+'great-wheel-tooth-'+i,[[1.3,-.18],[1.95,-.08],[1.56,.31],[1.35,.22]],.24);
    if(i%2===0) beam(saw,m.iron,n+'wheel-spoke-'+i,[0,0,.1],[1.31*Math.cos(a),1.31*Math.sin(a),.1],.12);
  }
  blade(saw,m.blood,n+'great-saw-half-hood',[[-1.65,.2],[-1.62,.85],[-.8,1.67],[.65,1.77],[1.56,.91],[1.75,.22],[1.16,.22],[.68,1.03],[-.63,1.03],[-1.12,.2]],.38,[0,0,.22]);
  return note(built,'해체 용광로선 — 붉은 철문을 벌린 거대 아치 화로와 고가위·절단원판',
    ['entire-bow-open-arched-furnace-mouth','parted-crimson-forge-doors-and-recessed-hot-grate','four-mismatched-outboard-layered-chimneys','great-open-high-arm-disassembly-shears','three-metre-low-arm-cutting-annulus','layered-iron-workshop-cladding-and-heavy-return-pipes'],
    '수리선의 목재 창공방 인상을 큰 아치형 선수 화로·반열린 붉은 철문·좁은 뜨거운 창·비대칭 연통으로 해체 용광로로 바꾼다. 고가위와 하부 절단원판은 기존 양팔 끝 바스켓 bone의 자식이므로 기존 수리팔 움직임을 유지한다.');
}
