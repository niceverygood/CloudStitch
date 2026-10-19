import * as THREE from 'three';
import {makeKit} from '../grounded-weapons-v1/kit.mjs';
export const PLANS=[
 {id:'mobility',name:'기동 · 선수 일체형 연발 쇠뇌',weapon:'outputs/grounded-weapons-v1/assets/03-repeating-crossbow.glb',weaponId:'03-repeating-crossbow',mountId:'mobility-prow-saddle',position:[-.43,-.055,0],scale:.075,datum:[0,.40,0],reason:'초기 중앙 후보는 부채돛에 가려져 선수 쪽으로 이동. 낮은 선수 안장에 결속하고 큰 날개·후방 추진기는 보존.',anchors:[[-.31,-.15,-.06],[-.31,-.15,.06]],cable:[[-.40,-.04,.08],[-.27,-.13,.10],[-.08,-.13,.10]]},
 {id:'artillery',name:'포격 · 기존 포대 교체형 로켓 선반',weapon:'outputs/grounded-weapons-v2/assets/13-comet-rocket-rack.glb',weaponId:'13-comet-rocket-rack',mountId:'artillery-battery-replacement',position:[-.52,.02,0],scale:.11,datum:[0,.75,0],replaceShipBarrels:true,reason:'쌍포 포신 두 개를 로켓으로 교체. 포대 몸체 안에 가리던 초기 배치를 앞쪽으로 옮기고, 기존 포방패·반동 지지 구조에서 이어진 경사 안장으로 지지.',anchors:[[-.28,-.17,-.15],[-.28,-.17,.15]],cable:[[-.48,.04,.12],[-.35,-.06,.15],[-.10,-.16,.12]]},
 {id:'salvage',name:'인양 · 우현 보조 작살 윈치',weapon:'outputs/grounded-weapons-v1/assets/04-harpoon-winch.glb',weaponId:'04-harpoon-winch',mountId:'salvage-starboard-winch-bracket',position:[.10,-.095,.29],scale:.055,datum:[0,.40,0],reason:'함선 담당의 후반 우현 후보 공간에 맞춘 작은 보조 작살. 중앙 회수 갑판·하부 화물받침·앞쪽 작업팔은 보존.',anchors:[[.02,-.17,.15],[.19,-.16,.16]],cable:[[.13,-.08,.29],[.20,-.12,.23],[.20,-.14,.14]]},
];
export const REMOVAL_PATTERNS=[
 /individual_wood_plinth/,/teal_mounting_skid/,/brass_anchor_shoe/,/cross_mount_rail/,
 /separate_deck_sill/,/deep_teal_skid/,/brass_anchor_plate/,/deck_lock_pin/,
];
// Modify only the independently parsed assembly copy; source GLBs are immutable.
export function compose(plan,ship,weapon){
 const assembly=new THREE.Group();assembly.name='Cloudstitch_harmony_'+plan.id;
 const hull=new THREE.Group();hull.name='hull_root_preserved';hull.scale.set(1,1,1);hull.add(ship);assembly.add(hull);
 let clampedColorComponents=0;
 // Source ship highlights slightly exceed glTF COLOR_0 range. Clamp only the
 // parsed assembly copy, retaining all source files and embedded texture maps.
 const geometries=new Set();ship.traverse(n=>{if(n.geometry)geometries.add(n.geometry)});
 for(const g of geometries){const a=g.getAttribute('color');if(!a||a.normalized)continue;for(let i=0;i<a.array.length;i++){const v=a.array[i];if(v<0||v>1){a.array[i]=Math.min(1,Math.max(0,v));clampedColorComponents++;}}a.needsUpdate=true;}
 const removed=[];
 function prune(parent){for(const child of [...parent.children]){if(REMOVAL_PATTERNS.some(p=>p.test(child.name))){removed.push(child.name);parent.remove(child);}else prune(child);}}
 prune(weapon);
 if(plan.id==='artillery'){
  const tripod=[];weapon.traverse(n=>{if(/rear_tripod_leg|front_tripod_leg|tilt_lock_pivot/.test(n.name))tripod.push(n);});
  for(const n of tripod){removed.push(n.name);n.removeFromParent();}
 }
 const shipCopyRemoved=[];
 if(plan.replaceShipBarrels){const targets=[];ship.traverse(n=>{if(/^Active[_ ]cannon[_ ]barrel(?:_\d+)?$/.test(n.name))targets.push(n);});for(const n of targets){shipCopyRemoved.push(n.name);n.removeFromParent();}if(targets.length!==2)throw new Error('Expected exactly two copied cannon barrel groups, got '+targets.length);}
 const mount=new THREE.Group();mount.name=plan.mountId;mount.position.fromArray(plan.position);mount.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);mount.scale.setScalar(plan.scale);
 const datum=new THREE.Group();datum.name='weapon_mount_datum_offset';datum.position.fromArray(plan.datum).multiplyScalar(-1);datum.add(weapon);mount.add(datum);assembly.add(mount);
 // Fitted joinery in hull units: no display plinth, no independent hull scale.
 const kit=makeKit({id:plan.id+'-fitted-adapter'}),p=kit.palette;
 const saddle=kit.root;saddle.name='fitted_adapter_and_load_path';
 const [x,y,z]=plan.position,w=plan.id==='mobility'?.22:plan.id==='artillery'?.34:.14,l=plan.id==='salvage'?.15:plan.id==='artillery'?.28:.18;
 kit.paintWood('fitted_oak_saddle',[l,.024,w],[x,y-.010,z]);
 for(const s of[-1,1]){
  kit.bevelBox('teal_continuous_side_band',[l+.025,.025,.014],[x,y-.006,z+s*w*.44],p.teal);
  for(const t of[-1,1])kit.bolt('brass_saddle_pin',[x+t*l*.35,y+.005,z+s*w*.37]).scale.setScalar(plan.id==='artillery'?.12:1);
 }
 for(const [i,anchor]of plan.anchors.entries()){
  const end=[x+(i-.5)*l*.55,y-.025,z];
  kit.beam('curved_hull_load_strut',anchor,end,.021,.026,p.honey);
  kit.bevelBox('hull_attachment_brass_shoe',[.054,.024,.041],anchor,p.brass);
  kit.beam('brass_reinforcement_tie',[anchor[0],anchor[1]-.009,anchor[2]],end,.007,.009,p.brass);
 }
 if(plan.id==='mobility'){
  // Two swept cheek fairings carry the gun bed directly into the prow gunnel.
  for(const s of[-1,1])kit.tube('swept_saddle_cheek',[[-.27,-.17,s*.06],[-.39,-.12,s*.08],[-.51,-.06,s*.10]],.009,p.teal);
 }else if(plan.id==='artillery'){
  for(const s of[-1,1])kit.tube('reused_gun_deck_bracket',[[-.18,-.19,s*.13],[-.35,-.13,s*.16],[-.58,.01,s*.16]],.011,p.teal);
 }else{
  for(const s of[-1,1])kit.tube('continuous_hull_bracket',[[x+s*l*.4,-.18,.12],[x+s*l*.42,-.18,z-.055],[x+s*l*.42,y-.01,z+.055]],.012,p.teal);
 }
 kit.tube('deliberate_control_cable',plan.cable,.006,p.ink);
 for(const pt of[plan.cable[0],plan.cable[plan.cable.length-1]])kit.sphere('brass_cable_gland',.012,pt,p.brass);
 let woodMap=null;ship.traverse(n=>{if(!n.isMesh||woodMap)return;for(const m of Array.isArray(n.material)?n.material:[n.material])if(/V2.*painted.*wood/i.test(m.name)&&m.map){woodMap=m.map;break;}});
 if(plan.id==='artillery'&&woodMap){const mat=kit.material.clone();mat.name='Adapter timber with source ship grain';mat.map=woodMap;saddle.traverse(n=>{if(!n.isMesh||!(/rounded_timber/.test(n.name)))return;const pos=n.geometry.attributes.position,uv=new Float32Array(pos.count*2);for(let i=0;i<pos.count;i++){uv[i*2]=pos.getX(i)*18;uv[i*2+1]=(pos.getY(i)+pos.getZ(i))*18;}n.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));n.material=mat;});}
 assembly.add(saddle);assembly.updateMatrixWorld(true);
 assembly.userData={purpose:'static art placement study',contract:'docs/SHIP_WEAPON_MOUNTING.json',hullRootScale:[1,1,1],shipForward:'-X',weaponForward:'+Z',gameplay:false};
 return {root:assembly,hull,mount,saddle,record:{id:plan.id,mount_id:plan.mountId,parent:'hull_root_preserved coordinate frame',position:plan.position,quaternion:mount.quaternion.toArray(),uniform_scale:plan.scale,weapon_local_mount_datum:plan.datum,source_forward:'+Z',assembly_forward:'-X',removed_source_copy_nodes:removed,ship_copy_removed_groups:shipCopyRemoved,copy_only_color_components_clamped:clampedColorComponents,added_groups:[saddle.name],load_path:plan.anchors,control_cable:plan.cable,static_clearance_notes:plan.reason,movement_clearance:'Unverified: static visual placement, no swept-volume physics or aim limits.'}};
}
