/* Secondary VFX art studies. Geometry and TRS only; no submissions or engine state. */
'use strict';

function build(spec, k) {
  const ids = ['small-explosion','large-explosion','airburst','shrapnel-burst',
    'steam-vent','smoldering-fire','ember-drift','burning-state','heavy-smoke-state',
    'gas-leak-state','overheat-state','short-circuit-state','engine-stall-state',
    'envelope-rupture-state','module-detach-state','armor-block','healing-pulse',
    'salvage-tether','mount-lock'];
  if (!ids.includes(spec.id)) return false;
  const { P, THREE } = k;
  const root = k.group('secondary_art');
  // Boundary visibility is standard glTF scale. Smooth material fades below are
  // an explicit, separate viewer/engine recipe, never claimed as glTF animation.
  k.motion(root, { times:[0,.025,.975,1], scales:[.001,1,1,.001] });
  k.j.nodes[root].extras = { author_intent:'Restrained matte brush volumes; +Y outward surface normal.',
    runtime_note:'runtime_fade requires a material adapter; standard TRS remains playable without it.' };
  const stroke = (points, width, color, parent=root, name='pigment_stroke') =>
    k.stroke(points, width, color, parent, name);
  const frame = (name, position=[0,0,0], parent=root, rotation) => k.group(name,
    {translation:position,...(rotation?{rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)).toArray()}:{})},parent);
  const move = (n, times, positions, scales, rotations) => k.motion(n,{times,positions,scales,rotations});
  const bloom = (n,start=.02,peak=.16,end=.7,size=1) => k.envelope(n,start,peak,end,size);
  const base = (kind,name,position,scale,rotation=[0,0,0],parent=root) => {
    const n=frame(name,position,parent,rotation);
    const size=typeof scale==='number'?[scale,scale,scale]:scale;
    // Meshy's flame is X-long (0.9541 x 0.5278 x 0.1860), unlike its Y-long
    // smoke. Stand the imported shape up, below the animated parent, so flutter
    // rotation tracks cannot replace the correction. Swap X/Y scale with the
    // rotation to keep this helper's authored width/height/depth convention.
    k.importBase(kind,n,kind==='flame'
      ? {scale:[size[1],size[0],size[2]],rotation:[0,0,Math.SQRT1_2,Math.SQRT1_2]}
      : {scale:size});
    return n;
  };
  const curl = (position, size, start, end, color=P.smoke, side=1, parent=root) => {
    const n=frame('open_smoke_curl',position,parent);
    stroke([[0,0,0],[side*.10,.16,.02],[side*.14,.33,-.02],[0,.46,-.04],[-side*.10,.42,-.01]],.045,color,n);
    stroke([[side*.05,.11,.03],[-side*.08,.25,.01],[-side*.07,.36,-.01]],.022,P.cream,n,'dry_edge');
    const mid=(start+end)*.5;
    move(n,[0,start,mid,end,1],[[0,0,0],position,[position[0]+side*.08,position[1]+.14,position[2]],
      [position[0]+side*.16,position[1]+.28,position[2]],[position[0]+side*.16,position[1]+.28,position[2]]],
      [.001,.001,size,.001,.001]);
    k.fade(n,start,mid,end,.72);
    return n;
  };
  // An irregular, shallow extruded chip, unlike the old faceted ball particles.
  const chip = (name,color,w=.07,h=.13,parent=root) => {
    const shape=new THREE.Shape();
    shape.moveTo(-w*.5,-h*.45);shape.lineTo(w*.35,-h*.5);shape.lineTo(w*.5,h*.2);
    shape.lineTo(-w*.22,h*.5);shape.lineTo(-w*.5,h*.1);shape.closePath();
    return k.geo(new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:false}),color,parent,name);
  };
  const pressure = (angle,length,start,end,parent=root) => {
    const n=frame('pressure_brush',[0,.025,0],parent,[0,angle,0]);
    stroke([[.04,0,.03],[.08,.04,length*.45],[.02,.015,length]],.027,P.ivory,n,'pressure_direction');
    bloom(n,start,start+.09,end);return n;
  };

  switch (spec.id) {
    case 'small-explosion': {
      const fire=base('flame','brief_ignition',[0,.13,0],[.34,.43,.31]);
      move(fire,[0,.055,.18,.47,1],[[0,.03,0],[0,.08,0],[.02,.18,0],[.04,.28,0],[.04,.28,0]],
        [.001,.62,1,.001,.001]);k.fade(fire,0,.1,.46);
      for(const a of [-.7,1.45,3.1]) pressure(a,.36,.02,.38);
      const smoke=base('smoke','late_residue',[.04,.19,0],[.4,.37,.29]);
      move(smoke,[0,.24,.48,.88,1],[[0,.15,0],[0,.15,0],[.08,.28,0],[.17,.49,.02],[.17,.49,.02]],
        [.001,.001,.85,.42,.001]);k.fade(smoke,.24,.44,.94,.57);
      break;
    }
    case 'large-explosion': {
      // Three staggered lobes leave openings between flame and the structure.
      [[-.17,.24,.02,.64,0],[.19,.17,-.07,.46,.08],[.01,.47,.02,.38,.17]].forEach(([x,y,z,size,delay],i)=>{
        const n=base('flame','staggered_flame_'+i,[x,y,z],[size*.68,size,size*.54],[0,i*.8,i===1?-.3:.13]);
        move(n,[0,.03+delay,.12+delay,.46+delay,1],[[x,0,z],[x,.06,z],[x,y,z],[x*.8,y+.17,z],[x*.8,y+.17,z]],
          [.001,.001,1,.001,.001]);k.fade(n,delay,.13+delay,.52+delay,.9);
      });
      for(const a of [-1.2,.9,2.3,4.3]) pressure(a,.54,.02,.34);
      [[-.13,.34,.02,.55,.29],[.19,.46,-.04,.43,.41]].forEach(([x,y,z,size,start],i)=>{
        const n=base('smoke','rising_ash_'+i,[x,y,z],[size,size*1.05,size*.65]);
        move(n,[0,start,start+.18,.94,1],[[x,y,z],[x,y,z],[x+.03,y+.11,z],[x+.16,y+.45,z],[x+.18,y+.48,z]],
          [.001,.001,.9,.7,.001]);k.fade(n,start,start+.19,1,.58);
      });
      break;
    }
    case 'airburst': {
      // An open fan marks an aerial detonation, without a closed shock ring.
      const fan=frame('airborne_open_fan',[0,.07,0]);
      [-1.0,-.35,.38,1.1].forEach((a,i)=>{
        const n=frame('fan_ray_'+i,[0,0,0],fan,[0,a,0]);
        stroke([[0,0,.02],[.025,.12,.25],[.04,.08,.47]],.032,i%2?P.ivory:P.amber,n);
        bloom(n,.015+i*.025,.15+i*.025,.48+i*.035);
      });
      const f=base('flame','air_ignition',[0,.17,.1],[.3,.31,.2],[.3,0,.2]);bloom(f,.02,.12,.45);
      const s=base('smoke','air_residue',[0,.24,.07],[.39,.32,.22]);
      move(s,[0,.22,.48,1],[[0,.24,.07],[0,.24,.07],[.08,.36,.07],[.29,.52,.07]],[.001,.001,1,.001]);k.fade(s,.22,.46,1,.52);
      break;
    }
    case 'shrapnel-burst': {
      const dirs=[[-.36,.22,.17],[.32,.37,.05],[-.13,.41,-.27],[.18,.19,-.33]];
      dirs.forEach((d,i)=>{
        const n=frame('sparse_metal_chip_'+i);chip('torn_metal',i%2?P.brass:P.ink,.055,.095,n);
        move(n,[0,.05,.42,.91,1],[[0,.04,0],[d[0]*.12,.08,d[2]*.12],d,[d[0]*1.6,d[1]-.22,d[2]*1.6],[d[0]*1.6,d[1]-.22,d[2]*1.6]],
          [.001,1,1,.001,.001],[[0,0,0],[.1,0,.2],[1,i,.4],[2,i*2,1],[2,i*2,1]]);
        const t=frame('chip_pressure_'+i);stroke([[0,.03,0],[d[0]*.3,d[1]*.4,d[2]*.3],[d[0]*.62,d[1]*.7,d[2]*.62]],.016,P.cream,t);bloom(t,.02,.14,.35);
      });
      break;
    }
    case 'steam-vent': {
      const n=base('smoke','slender_steam',[0,.25,0],[.23,.63,.17],[0,0,-.13]);
      move(n,[0,.1,.47,.83,1],[[0,.04,0],[0,.11,0],[.04,.33,0],[.16,.55,.02],[.2,.61,.02]],
        [.001,.58,1,.66,.001]);k.fade(n,0,.25,1,.55);
      curl([-.04,.05,.04],.7,.05,.91,P.cream,-1);
      stroke([[-.035,0,0],[.005,.09,0],[.024,.18,.005]],.014,P.ivory,root,'thin_nozzle_gust');
      break;
    }
    case 'smoldering-fire': {
      const f=base('flame','low_ember_tongue',[0,.08,0],[.19,.23,.15]);
      move(f,[0,.1,.26,.42,.59,.8,1],Array(7).fill([0,.08,0]),
        [.001,.73,.44,.85,.53,.62,.001],[[0,0,.07],[0,0,-.08],[0,.1,.1],[0,.13,-.06],[0,0,.12],[0,0,-.03],[0,0,0]]);
      const s=base('smoke','thin_smolder',[.02,.3,0],[.3,.56,.21]);
      move(s,[0,.15,.6,1],[[0,.12,0],[.01,.23,0],[.09,.43,.01],[.16,.6,.02]],[.001,.75,.96,.001]);k.fade(s,.02,.25,1,.42);
      curl([-.03,.09,.04],.68,.1,.95,P.smoke,1);
      break;
    }
    case 'ember-drift': {
      [[-.14,.65,.1],[.14,.83,-.06],[.29,.51,.08],[-.26,.48,-.08]].forEach((d,i)=>{
        const n=frame('paper_ember_'+i);chip('warm_ash',i%2?P.coral:P.amber,.024,.05,n);
        move(n,[0,.08+i*.035,.42,.88,1],[[0,.02,0],[0,.02,0],[d[0]*.6,d[1]*.54,d[2]],d,[d[0]+.08,d[1]+.05,d[2]]],
          [.001,.6,1,.34,.001],[[0,0,0],[0,0,0],[.6,i*.4,.3],[1.1,i*.6,1],[1.1,i*.6,1]]);
      });
      break;
    }
    case 'burning-state': {
      [[-.09,.12,0,.35,.05],[.12,.15,-.03,.27,.17]].forEach(([x,y,z,size,delay],i)=>{
        const n=base('flame','uneven_flame_'+i,[x,y,z],[size*.67,size,size*.5],[0,i,-.08+i*.2]);
        move(n,[0,.05,.22,.4,.62,.82,1],Array(7).fill([x,y,z]),
          [.001,.65,1,.64,.91,.7,.001],[[0,0,0],[0,0,-.04],[0,.05,.09],[0,0,-.06],[0,.06,.1],[0,.02,.01],[0,0,0]]);
      });
      curl([-.02,.22,.035],.78,.06,.97,P.smoke,1);
      break;
    }
    case 'heavy-smoke-state': {
      [[-.06,.25,0,.47,0],[.11,.52,-.02,.46,.26]].forEach(([x,y,z,size,start],i)=>{
        const n=base('smoke','asymmetric_smoke_'+i,[x,y,z],[size*.79,size*1.15,size*.58],[0,i*.7,.16]);
        move(n,[0,.06+start,.25+start,.91,1],[[x,.12,z],[x,.16,z],[x,y,z],[x+.16,y+.4,z+.03],[x+.18,y+.44,z+.03]],
          [.001,.001,.83,.86,.001]);k.fade(n,start,.24+start,1,.56);
      });
      curl([-.05,.12,.07],1.08,.15,.96,P.smoke,-1);
      break;
    }
    case 'gas-leak-state': {
      // Pale teal open curls communicate a leak without opaque green clouds.
      curl([0,.02,0],.95,.02,.78,P.light,1);
      curl([.01,.09,-.03],.78,.28,.99,P.cream,-1);
      const n=frame('escaping_gas_thread');
      stroke([[0,0,0],[.08,.11,.01],[.04,.26,0],[.16,.39,-.01]],.022,P.light,n);
      move(n,[0,.09,.52,1],[[0,0,0],[0,0,0],[.12,.1,0],[.23,.18,0]],[.001,.7,1,.001]);k.fade(n,0,.16,1,.5);
      break;
    }
    case 'overheat-state': {
      [-.085,.09].forEach((x,i)=>{
        const n=frame('wavering_heat_'+i,[x,.02,0]);
        stroke([[0,0,0],[-.03,.1,.01],[.035,.22,0],[-.025,.35,0]],.017,i?P.coral:P.amber,n);
        move(n,[0,.12,.33,.55,.78,1],[[x,.02,0],[x,.02,0],[x+.02,.07,0],[x-.01,.12,0],[x+.025,.16,0],[x+.025,.19,0]],
          [.001,.8,1,.79,.55,.001],[[0,0,0],[0,0,-.05],[0,0,.08],[0,0,-.06],[0,0,.04],[0,0,0]]);k.fade(n,0,.2,1,.7);
      });
      break;
    }
    case 'short-circuit-state': {
      [[-.16,.15,.03],[.14,.23,-.02],[-.03,.29,.06]].forEach((p,i)=>{
        const n=frame('brief_circuit_'+i);
        stroke([[0,.02,0],[p[0]*.38,p[1]*.32,p[2]],[p[0]*.2,p[1]*.54,p[2]],[p[0],p[1],p[2]]],.012,i%2?P.ivory:P.light,n,'broken_electric_brush');
        const t=.07+i*.22;move(n,[0,t,t+.035,t+.12,1],Array(5).fill([0,0,0]),[.001,.001,1,.001,.001]);
      });
      break;
    }
    case 'engine-stall-state': {
      const n=base('smoke','faltering_exhaust',[0,.08,-.03],[.28,.28,.2]);
      move(n,[0,.08,.19,.36,.46,.7,1],[[0,0,0],[0,.06,0],[0,.14,-.03],[.03,.11,-.1],[.06,.07,-.15],[.12,-.03,-.23],[.17,-.08,-.3]],
        [.001,.9,.61,.85,.47,.22,.001]);k.fade(n,0,.14,.95,.6);
      for(const x of [-.08,.07]){
        const d=frame('descending_soot',[x,.015,0]);stroke([[0,0,0],[.018,-.1,.01],[.011,-.2,.02]],.013,P.ink,d);
        move(d,[0,.37,.6,.91,1],[[x,0,0],[x,0,0],[x+.02,-.08,0],[x+.03,-.2,0],[x+.03,-.2,0]],[.001,.001,1,.45,.001]);
      }
      break;
    }
    case 'envelope-rupture-state': {
      [-1,1].forEach((side,i)=>{
        const n=frame('torn_canvas_'+i,[side*.05,.02,0]);chip('cream_canvas',P.cream,.15,.24,n);
        stroke([[0,-.07,.025],[side*.025,0,.027],[0,.08,.025]],.009,P.wood,n,'cloth_seam');
        move(n,[0,.04,.26,.63,1],[[side*.025,0,0],[side*.04,.01,0],[side*.16,.09,0],[side*.28,.07,-.03],[side*.35,.02,-.04]],
          [.001,.75,1,.8,.001],[[Math.PI/2,0,0],[Math.PI/2,0,side*.1],[1.3,0,side*.6],[1.1,0,side*.9],[1.1,0,side]]);
      });
      const gust=frame('rupture_gust');
      stroke([[0,.01,0],[.02,.17,.01],[-.04,.36,0],[.06,.56,.01]],.027,P.ivory,gust);bloom(gust,.02,.15,.69);
      curl([.03,.1,-.02],.75,.11,.95,P.cream,-1);
      break;
    }
    case 'module-detach-state': {
      [-1,1].forEach((side,i)=>{
        const n=frame('broken_connector_'+i);
        stroke([[side*.23,0,0],[side*.13,.025,.015],[side*.035,.015,.005]],.014,P.brass,n,'connector_filament');
        move(n,[0,.06,.19,.49,1],[[0,0,0],[0,0,0],[side*.06,-.015,0],[side*.16,-.08,.01],[side*.23,-.15,.02]],
          [.001,1,1,.62,.001],[[0,0,0],[0,0,0],[0,0,-side*.15],[0,0,-side*.35],[0,0,-side*.6]]);
        const bolt=frame('loose_connector_bolt_'+i);chip('small_bolt',P.brass,.038,.052,bolt);
        move(bolt,[0,.07,.25,.86,1],[[side*.06,0,0],[side*.06,0,0],[side*.16,.06,.02],[side*.29,-.22,.04],[side*.32,-.28,.04]],
          [.001,1,1,.64,.001],[[0,0,0],[0,0,0],[.4,.6,.3],[1.5,.8,1],[1.8,.9,1.3]]);
      });
      const s=base('smoke','connector_dust',[0,.09,0],[.25,.18,.15]);bloom(s,.04,.17,.65);k.fade(s,.04,.19,.65,.45);
      break;
    }
    case 'armor-block': {
      // Two short opposed chevrons read as a deflection, never a shield ring.
      [-1,1].forEach((side,i)=>{
        const n=frame('armor_deflection_'+i,[side*.05,.03,0]);
        stroke([[side*.17,0,-.08],[side*.04,.11,0],[side*.17,0,.08]],.026,P.brass,n,'brass_chevron');
        stroke([[side*.17,.007,-.07],[side*.055,.09,0],[side*.17,.007,.07]],.01,P.ivory,n,'light_edge');
        move(n,[0,.045,.23,.65,1],[[0,0,0],[0,0,0],[side*.035,.02,0],[side*.14,.06,0],[side*.16,.07,0]],
          [.001,.6,1,.001,.001]);
      });
      break;
    }
    case 'healing-pulse': {
      // Rising leaf-shaped stitch marks distinguish healing from repair fabric.
      [[-.1,.13,0],[.11,.28,-.02],[-.02,.43,.02]].forEach((p,i)=>{
        const n=frame('rising_stitch_leaf_'+i);
        stroke([[0,0,0],[-.045,.06,.015],[0,.14,0],[.045,.07,-.015],[0,0,0]],.014,P.light,n,'open_leaf');
        stroke([[0,.015,0],[0,.085,0],[0,.135,0]],.007,P.cream,n,'leaf_thread');
        const start=.04+i*.13;
        move(n,[0,start,start+.14,.88,1],[[p[0],p[1]-.1,p[2]],[p[0],p[1]-.1,p[2]],p,[p[0]+.03,p[1]+.23,p[2]],[p[0]+.04,p[1]+.27,p[2]]],
          [.001,.001,1,.48,.001]);k.fade(n,start,start+.2,1,.8);
      });
      break;
    }
    case 'salvage-tether': {
      // A modest physical rope with slack and a reel gesture. Endpoint binding
      // belongs to the consuming engine; these keyframes are a local study.
      const rope=frame('tether_slack');
      stroke([[0,0,0],[.04,-.08,.23],[-.025,-.12,.5],[.025,-.05,.77],[0,0,1.02]],.016,P.wood,rope,'braided_rope');
      stroke([[0,.012,.05],[.03,-.066,.25],[-.022,-.105,.51],[.02,-.035,.77],[0,.01,.98]],.005,P.cream,rope,'rope_lit_strand');
      move(rope,[0,.09,.3,.73,.94,1],Array(6).fill([0,0,0]),[.001,[1,1,.56],[1,1,1],[1,.7,1],[1,.82,1],.001]);
      const reel=frame('open_reel_gesture',[0,0,0]);
      stroke([[.075,0,.015],[.055,.055,.005],[0,.075,0],[-.065,.025,-.005],[-.045,-.035,0],[.015,-.035,.01],[.035,.005,.015]],.013,P.brass,reel,'open_wound_rope');
      move(reel,[0,.1,.38,.7,1],Array(5).fill([0,0,0]),[.001,1,1,1,.001],[[0,0,0],[0,0,0],[0,0,.4],[0,0,.9],[0,0,1.1]]);
      break;
    }
    case 'mount-lock': {
      [-1,1].forEach((side,i)=>{
        const n=frame('sliding_mount_bracket_'+i);
        stroke([[side*.06,.02,-.11],[side*.16,.02,-.11],[side*.16,.02,.11],[side*.06,.02,.11]],.024,P.teal,n,'mount_bracket');
        stroke([[side*.16,.04,-.08],[side*.16,.04,.08]],.008,P.brass,n,'brass_lock_face');
        move(n,[0,.08,.32,.45,.82,1],[[side*.19,0,0],[side*.19,0,0],[0,0,0],[-side*.012,0,0],[0,0,0],[0,0,0]],
          [.001,.8,1,1,1,.001]);
      });
      const click=frame('lock_seating_tick');
      stroke([[-.06,.05,.02],[-.015,.1,.02],[.075,.16,.02]],.012,P.cream,click,'seated_tick');bloom(click,.35,.48,.82);
      break;
    }
  }
  return true;
}

module.exports={build};
