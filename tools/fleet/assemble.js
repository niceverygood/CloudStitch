import * as THREE from 'three';
import { bone, tube, makeHull, makeCabin, makeEnvelope } from './body.js';
import { makeDevice } from './devices.js';

const keys={balloons:'balloon',engines:'engine',machineGuns:'machinegun',cannons:'cannon',mortars:'mortar',harpoons:'harpoon',chainCannons:'chainshot',flamethrowers:'flame',winches:'hook',armor:'armor',repairArms:'repair',rescueCapsules:'rescue',smokeEmitters:'smoke'};
const extraTypes=['bell','tank','rail','storage','crane','sail'];
const base={balloons:1,engines:1,machineGuns:0,cannons:0,mortars:0,harpoons:0,chainCannons:0,flamethrowers:0,winches:0,armor:0,repairArms:0,rescueCapsules:0,smokeEmitters:0,bell:0,tank:0,rail:0,storage:0,crane:0,sail:0};
const layouts={
  'enemy-pirate-scout':{machineGuns:1,winches:1,sail:1},
  'enemy-cult-blockade':{balloons:2,engines:2,cannons:2,armor:3,bell:1,smokeEmitters:1,tank:2},
  'enemy-union-salvage':{balloons:2,engines:2,harpoons:1,winches:2,crane:1},
  'enemy-union-repair':{balloons:2,engines:2,repairArms:2,rescueCapsules:1,tank:2},
  'enemy-ghost-chaser':{engines:2,harpoons:1,sail:2},
  'enemy-disguised-wreck':{machineGuns:2,sail:1},
  'enemy-tax-cutter':{balloons:2,engines:2,cannons:1,armor:2},
  'faction-cult-modular':{balloons:2,cannons:1,bell:1,tank:2,armor:1},
  'faction-ghost-modular':{engines:2,cannons:1,sail:2},
  'faction-salvager-modular':{winches:1,machineGuns:1,cannons:1,crane:1},
  'rival-change':{cannons:1,armor:7,storage:1,sail:1},
  'rival-debts-end':{balloons:2,engines:2,winches:2,cannons:1,storage:1},
  'rival-quiet-answer':{balloons:2,cannons:1,bell:1,smokeEmitters:1,tank:2},
  'rival-night-shift':{balloons:2,engines:2,flamethrowers:2,tank:3,armor:3},
  'rival-go-first':{engines:2,sail:1},
  'rival-unfinished':{balloons:2,engines:2,cannons:1,machineGuns:1,winches:1,rail:2,storage:3,crane:1},
  'boss-bell-devourer':{balloons:3,engines:3,cannons:6,winches:2,armor:6,bell:1,tank:3},
  'boss-shipwright-command':{balloons:2,engines:2,cannons:3,harpoons:1,crane:2,armor:4},
  'boss-fleet-king':{balloons:3,engines:3,harpoons:3,sail:4,armor:3,storage:3},
  'mini-funeral-guard':{cannons:2,bell:1,armor:2},
  'mission-union-guard':{cannons:1,armor:2},'mission-bridge-tug':{winches:2,crane:1},
  'mission-guard-scout':{machineGuns:1,smokeEmitters:1},'mission-cult-purifier':{balloons:2,flamethrowers:2,bell:1,tank:2},
  'mission-ghost-artillery':{balloons:2,cannons:3,sail:2},'role-enemy-artillery':{balloons:2,cannons:2,mortars:1},
  'role-enemy-defense':{balloons:2,armor:4,cannons:2},
  'story-mara-repair':{repairArms:1,rescueCapsules:1,winches:1},'story-or-ship':{winches:1,crane:1,storage:2},
  'story-compressor-wreck':{tank:3,sail:1},'story-cult-storage':{balloons:2,storage:4,tank:2,bell:1},
  'story-union-cooling':{tank:4,repairArms:1},'story-mothers-escort':{machineGuns:1,sail:1},
  'story-turret-owner':{cannons:1,sail:1},'story-cult-transport':{balloons:2,storage:3,bell:1},
  'story-union-contact':{engines:2,storage:1},'story-union-carrier':{balloons:2,storage:4,crane:1},
  'story-morning':{rescueCapsules:2,tank:2},'story-royal-funeral':{balloons:3,storage:2,bell:2,tank:2},
  'civil-maintenance':{repairArms:1,storage:2},'civil-transport':{balloons:2,storage:3},
  'civil-merchant':{storage:4,sail:1},'civil-relief':{rescueCapsules:2,repairArms:1},
  'civil-research':{tank:2,rail:1,sail:1},'civil-salvager':{winches:1,crane:1,storage:2},
  'civil-mail':{engines:2,storage:2,sail:1},'civil-ghost-signal':{sail:2,bell:1},
  'civil-evacuation':{balloons:2,rescueCapsules:3},'record-descent-ship':{tank:2,storage:1},
  'support-independent-rescue':{rescueCapsules:1},'ending-mobile-harbor':{balloons:3,engines:3,storage:4,repairArms:2,winches:2,rescueCapsules:2,crane:2},
  'ending-light-descent':{balloons:1,engines:1,storage:1},
};
function styleFor(ship){const t=[ship.faction,ship.name,...(ship.shape.palette||[])].join(' ');if(/망령|이름 없는|잔류|남색|강하|함대 왕/.test(t))return'ghost';if(/교단|장례|봉인천/.test(t))return'cult';if(/연합|녹슨|쇠갈비|용광로|조선공/.test(t))return'union';return'warm';}
function shapeFor(ship){
  let s={length:10,width:3,depth:1.4,bow:.5,radius:1.3,flatten:1};
  const cls=ship.shape.scaleClass||'';if(/medium/.test(cls))s={...s,length:12,width:3.8,depth:1.7,radius:1.45};if(/large/.test(cls))s={...s,length:16,width:5,depth:2,radius:1.6};
  const id=ship.id;
  if(/broadside|bell-devourer|fleet-king|mobile-harbor/.test(id))s={...s,length:id.includes('player')?16:22,width:6,depth:2.4,radius:1.65};
  if(/go-first|ghost-chaser|mail|design-c1|design-c3/.test(id))s={...s,length:14,width:2.35,depth:1.25,radius:1.05,flatten:.92};
  if(/rival-change/.test(id))s={...s,length:9,width:4.8,depth:1.65,radius:1.8,flatten:.7};
  if(/rescue-workshop|mixed-raider|control|close-flame/.test(id))s={...s,length:14,width:5,depth:1.9,radius:1.45};
  if(/salvage|night-shift|command/.test(id))s={...s,length:14,width:4.3,depth:2,radius:1.5};
  if(id==='design-a2')s={...s,length:12,width:3.2,depth:1.15,flatten:.65};if(id==='design-a3')s={...s,length:9,width:3.4,depth:2.1,bow:1.2};
  if(id==='design-b1')s={...s,length:11,width:3.7,depth:1.7};if(id==='design-b2')s={...s,length:11,width:2.7,depth:2.7,bow:.85};if(id==='design-b3')s={...s,length:9,width:4,depth:1.6};
  if(id==='design-c2')s={...s,length:12,width:2.8,depth:1.45,bow:1.2};
  if(id==='design-c3')s={...s,length:12.8,width:2.6,depth:.95,bow:.16,bowClip:.30,sternClip:.18,radius:1.05,flatten:.80};
  if(/support-independent|light-descent/.test(id))s={...s,length:7,width:2.5,depth:1.1,radius:1};
  if(/disguised-wreck|compressor-wreck/.test(id))s={...s,length:11,width:3.4,depth:1.5,flatten:.55};
  return s;
}
function addMesh(parent,geometry,material,name,position=[0,0,0]){const m=new THREE.Mesh(geometry,material);m.name=name;m.position.fromArray(position);parent.add(m);return m;}

export function assembleShip(ship,materials){
  const scene=new THREE.Scene();scene.name=`Cloudstitch_${ship.id}`;
  const rigRoot=bone('RigRoot',scene),hullMotion=bone('HullMotion',rigRoot);
  hullMotion.userData={moduleId:'root',moduleType:'assembly',parentId:null};
  addMesh(hullMotion,new THREE.TorusGeometry(.18,.045,5,12),materials.brass,`${ship.id}-central-structural-joint`,[0,-.15,0]);
  const controls=[];const features=[];const moduleRoots=[];
  const style=styleFor(ship),shape=shapeFor(ship);
  const addModule=(root,parent=hullMotion,position=[0,0,0])=>{root.position.fromArray(position);parent.add(root);root.userData.parentId=parent.userData.moduleId||parent.name;moduleRoots.push(root);return root;};
  const device=(type,id,position,parent=hullMotion,scale=1,extra={})=>{const materialOverrides=style==='cult'&&type==='tank'?{teal:'dark',metal:'dark'}:style==='cult'&&type==='sail'?{navy:'canvas'}:{};const item=makeDevice(THREE,{id,type,materials,style:{torn:style==='ghost'||ship.id.includes('wreck'),materials:materialOverrides}});item.root.scale.setScalar(scale);addModule(item.root,parent,position);Object.assign(item.root.userData,extra);controls.push(...item.controls);features.push(...item.features);return item;};
  const feature=(id,key,parent=hullMotion,position=[0,0,0])=>{const b=bone(id,parent,position);b.userData={moduleId:id,moduleType:key,structuralRole:key,featureId:key,parentId:parent.userData.moduleId||parent.name};moduleRoots.push(b);return b;};
  const art={...base,...(layouts[ship.id]||{})};
  if(ship.category==='preexisting-variant')Object.assign(art,{machineGuns:1,winches:1});
  for(const [key,value]of Object.entries(ship.modules))if(Number.isInteger(value))art[key]=value;
  for(const required of ship.requiredFeatures||[]){const countKey=Object.keys(keys).find(k=>keys[k]===required)||(extraTypes.includes(required)?required:null);if(countKey&&ship.modules[countKey]!==0)art[countKey]=Math.max(art[countKey]||0,1);}
  if(ship.scopeKind==='environment'&&ship.id!=='unfinished-stitch-hull'){
    for(const k of Object.keys(art))art[k]=0;
    if(ship.id==='boss-last-inhale'){
      const heart=feature(`${ship.id}-heart`,'centralSealedHeart',hullMotion,[0,1,0]);
      addMesh(heart,new THREE.IcosahedronGeometry(3.6,2),materials.dark,'sealed-pressure-chamber');
      for(const axis of ['x','y','z']){const ring=addMesh(heart,new THREE.TorusGeometry(3.75,.18,8,48),materials.brass,`seal-ring-${axis}`);if(axis==='x')ring.rotation.x=Math.PI/2;if(axis==='y')ring.rotation.y=Math.PI/2;}
      controls.push({bone:heart,role:'envelope',axis:'y',amplitude:.004});
      for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3,tower=feature(`${ship.id}-tower-${i}`,'sealingTowers',hullMotion,[Math.cos(a)*10,0,Math.sin(a)*10]);
        addMesh(tower,new THREE.CylinderGeometry(1,1.5,6,8),materials.dark,`seal-tower-${i}`,[0,1,0]);
        addMesh(tower,new THREE.TorusGeometry(1.1,.13,6,24),materials.brass,`tower-seal-${i}`,[0,2.5,0]);
        const lid=bone(`${ship.id}_TowerPlate_${i}`,tower,[0,3.6,0]);addMesh(lid,new THREE.ConeGeometry(1.4,1.3,8),materials.brass,`tower-cap-${i}`);controls.push({bone:lid,role:'valve',axis:'y',amplitude:.15,motion:'rotation'});
        const c=feature(`${ship.id}-connection-${i}`,'heartConnectionPoints',heart,[Math.cos(a)*3.7,0,Math.sin(a)*3.7]);addMesh(c,new THREE.TorusGeometry(.44,.12,6,18),materials.teal,`heart-connector-${i}`);
        tube(hullMotion,[[Math.cos(a)*3.8,0,Math.sin(a)*3.8],[Math.cos(a)*7,-1.2,Math.sin(a)*7],[Math.cos(a)*10,0,Math.sin(a)*10]],.1,materials.rope,`pressure-cable-${i}`,20);
      }
      for(let i=0;i<4;i++){const a=i*Math.PI/2+.4,b=feature(`${ship.id}-debris-${i}`,'movingDebrisCover',hullMotion,[Math.cos(a)*7,-2,Math.sin(a)*7]);addMesh(b,new THREE.DodecahedronGeometry(1.1,0),materials.metal,`cover-${i}`);controls.push({bone:b,role:'sail',axis:'y',amplitude:.03});}
      for(let i=0;i<2;i++){const b=feature(`${ship.id}-pocket-${i}`,'safeRepairPockets',hullMotion,[i?-13:13,-1,5]);addMesh(b,new THREE.CylinderGeometry(1.6,1.8,.4,12),materials.wood,`safe-pocket-${i}`);device('repair',`${ship.id}-pocket-repair-${i}`,[0,.3,0],b,.7);art.repairArms++;}
    }else{
      for(let zone=0;zone<3;zone++){
        const b=feature(`${ship.id}-zone-${zone}`,'horizontalDockZones',hullMotion,[(zone-1)*11,0,0]);
        for(const side of [-1,1]){
          addMesh(b,new THREE.BoxGeometry(10,.5,2.2),materials.metal,`dock-side-${zone}-${side}`,[0,-.5,side*4.5]);
          for(let r=0;r<4;r++)tube(b,[[r*2.7-4,0,side*4.7],[r*2.7-4,3,side*5],[r*2.7-4,5.5,side*3.2]],.22,materials.dark,`ribs-${zone}-${side}-${r}`,14);
        }
        for(const side of [-1,1])addMesh(b,new THREE.BoxGeometry(.35,3,1.5),materials.teal,`dock-gate-${zone}-${side}`,[-5,1,side*3]);
      }
      for(let i=0;i<2;i++){const d=device('crane',`${ship.id}-crane-${i}`,[-11+i*3,.2,i?-4.5:4.5],hullMotion,1.6,{structuralRole:'stage1HookCranes',featureId:'stage1HookCranes'});art.crane++;}
      for(let i=0;i<3;i++){const b=feature(`${ship.id}-vent-${i}`,'stage2Vents',hullMotion,[i*2.2-2.2,.5,4]);addMesh(b,new THREE.CylinderGeometry(.65,.75,1.4,12),materials.coral,`furnace-vent-${i}`);const lid=bone(`${ship.id}_VentLid_${i}`,b,[0,.9,0]);addMesh(lid,new THREE.CylinderGeometry(.8,.8,.14,12),materials.metal,`vent-lid-${i}`);controls.push({bone:lid,role:'valve',axis:'x',amplitude:.3,motion:'rotation'});}
      for(let i=0;i<2;i++){const b=feature(`${ship.id}-pump-${i}`,'stage2CoolingPumps',hullMotion,[i?3:-3,.5,-4]);addMesh(b,new THREE.CylinderGeometry(.7,.8,1.8,14),materials.teal,`coolant-pump-${i}`);tube(b,[[0,.7,0],[0,1.5,.5],[0,1.5,1.3]],.13,materials.brass,`coolant-pipe-${i}`);}
    }
  }else{
    const hull=makeHull({id:`${ship.id}-hull`,...shape,style,materials});addModule(hull.root);hull.root.userData.structuralRole='rootHull';
    if(ship.id==='unfinished-stitch-hull'){
      art.balloons=0;art.engines=0;
      const frame=feature(`${ship.id}-open-frame`,'unfinishedHullFrame');
      for(let i=0;i<5;i++){
        const x=i*2-4,t=x/shape.length+.5,w=hull.halfWidth(t)*.98,y=hull.rise(t)+.08;
        tube(frame,[[x,y,-w],[x,2.8,-w*1.05],[x,3.5,0],[x,2.8,w*1.05],[x,y,w]],.11,materials.brass,`unfinished-frame-${i}`,22);
        for(const side of [-1,1])addMesh(frame,new THREE.BoxGeometry(.25,.24,.25),materials.metal,`unfinished-frame-bracket-${i}-${side}`,[x,y,side*w]);
        addMesh(frame,new THREE.SphereGeometry(.13,8,6),materials.teal,`unfinished-worklight-${i}`,[x,3.45,0]);
      }
    }else{
      const cabin=makeCabin({id:ship.id,materials,width:shape.width*.52,length:shape.length*.22,height:shape.depth*.83,style});addModule(cabin.root,hullMotion,[shape.length*.22,.04,0]);
    }
    let externalDeck=null;
    if(ship.id==='enemy-tax-cutter'){
      const conn=feature(`${ship.id}-connector`,'starboardConnector',hull.root,[0,-.2,shape.width*.55]);
      addMesh(conn,new THREE.BoxGeometry(1,.36,1.8),materials.metal,'large-cuttable-square-connector',[0,0,.8]);
      externalDeck=feature(`${ship.id}-external-deck`,'externalDeck',conn,[0,.2,2]);
      addMesh(externalDeck,new THREE.BoxGeometry(4,.2,2.1),materials.wood,'external-deck-platform');
      externalDeck.userData.subtreeTypes=['cannon','auxiliaryEngine','auxiliaryBalloon'];
    }
    for(let i=0;i<art.balloons;i++){
      const isAux=!!externalDeck&&i===1;
      const count=art.balloons;
      const radius=count>1?shape.radius*.8:shape.radius;
      const env=makeEnvelope({id:`${ship.id}-balloon-${i+1}`,materials,length:shape.length*(count===1?.91:.75)*(isAux?.55:1),radius:isAux?.8:radius,flatten:shape.flatten,style,patched:ship.faction==='플레이어'||ship.category==='preexisting-variant'});
      const z=count===1?0:(i-(count-1)/2)*(radius*1.85);
      const offsetX=ship.id==='boss-bell-devourer'?shape.length*.18:0;
      addModule(env.root,isAux?externalDeck:hullMotion,isAux?[0,2.7,.15]:[offsetX,shape.depth+radius*1.18+1,z]);
      if(isAux)env.root.userData.role='auxiliaryBalloon';
      controls.push(...env.controls);
      const actualRadius=isAux?.8:radius;
      const anchorY=env.root.position.y-actualRadius*.72;
      if(isAux)for(const x of [-1.2,1.2])for(const side of [-1,1]){
        const start=[x,.12,side*.65],end=[x,anchorY,.15+side*actualRadius*.65];
        tube(externalDeck,[start,[(start[0]+end[0])/2,(start[1]+end[1])/2,(start[2]+end[2])/2],end],.045,materials.rope,`${ship.id}-aux-suspension-${x}-${side}`,12);
        addMesh(externalDeck,new THREE.BoxGeometry(.18,.18,.18),materials.brass,`${ship.id}-aux-bracket-${x}-${side}`,start);
      }
      if(!isAux)for(const x of [-shape.length*.20,shape.length*.20])for(const side of [-1,1]){
        const start=[x,.1,side*shape.width*.36],end=[x+offsetX,anchorY,z+side*radius*.65];
        tube(hullMotion,[start,[(start[0]+end[0])/2,(start[1]+end[1])/2,(start[2]+end[2])/2],end],.055,materials.rope,`${ship.id}-suspension-${i}-${x}-${side}`,14);
        addMesh(hullMotion,new THREE.BoxGeometry(.22,.24,.22),materials.brass,`${ship.id}-suspension-bracket-${i}-${x}-${side}`,start);
      }
    }
    for(let i=0;i<art.engines;i++){
      const aux=!!externalDeck&&i===1;
      const z=art.engines===1?0:(i-(art.engines-1)/2)*shape.width*.62;
      const p=aux?[1.2,.35,-.85]:[shape.length*.46,-.25,z];
      const engine=device('engine',`${ship.id}-engine-${i+1}`,p,aux?externalDeck:hullMotion,/go-first|ghost-chaser/.test(ship.id)?1.2:1);
      // Every engine has a visible structural pylon back to its own deck;
      // wide stern pods must not look detached when more engines are fitted.
      const anchor=aux?[.6,.05,0]:[shape.length*.30,-.35,Math.sign(z)*shape.width*.27];
      const bracketEnd=[p[0]-.35,p[1]-.13,p[2]];
      tube(aux?externalDeck:hullMotion,[anchor,[(anchor[0]+bracketEnd[0])/2,-.38,(anchor[2]+bracketEnd[2])/2],bracketEnd],.13,materials.metal,`${ship.id}-engine-pylon-${i}`,12);
      tube(aux?externalDeck:hullMotion,[[anchor[0]-.4,anchor[1]-.35,anchor[2]],bracketEnd],.08,materials.brass,`${ship.id}-engine-brace-${i}`,8);
      if(aux)engine.root.userData.role='auxiliaryEngine';
    }
    const gunTypes=['machineGuns','cannons','mortars','harpoons','chainCannons','flamethrowers'];
    let gunIndex=0;const totalGuns=gunTypes.reduce((n,k)=>n+art[k],0);
    for(const key of gunTypes)for(let i=0;i<art[key];i++){
      const aux=!!externalDeck&&key==='cannons';let p;
      const broad=totalGuns>=3;
      if(!broad)p=[-shape.length*.29+i*.9,.1,((gunIndex%2)*2-1)*(totalGuns===1?0:shape.width*.25)];
      else p=[-shape.length*.33+Math.floor(gunIndex/2)*shape.length*.17,.12,(gunIndex%2?1:-1)*shape.width*.35];
      if(aux)p=[-.5,.15,0];
      const d=device(keys[key],`${ship.id}-${keys[key]}-${i+1}`,p,aux?externalDeck:hullMotion,ship.id==='boss-bell-devourer'?1.3:1);
      if(broad&&key==='cannons')d.root.rotation.y=gunIndex%2?-Math.PI/2:Math.PI/2;
      if(aux){d.root.rotation.y=-Math.PI/2;d.root.userData.role='cannon';}
      gunIndex++;
    }
    for(let i=0;i<art.winches;i++)device('hook',`${ship.id}-winch-${i+1}`,[-.4+i*1.2,.2,(i%2?1:-1)*shape.width*.5]);
    for(let i=0;i<art.armor;i++){
      const side=i%2?1:-1,slot=Math.floor(i/2);const d=device('armor',`${ship.id}-armor-${i+1}`,[(-.3+slot*.16)*shape.length,-.55,side*shape.width*.48],hullMotion,ship.id==='rival-change'?1.15:1);
      if(side<0)d.root.rotation.y=Math.PI;
      if(ship.id==='rival-change'){d.root.userData.featureId='deployableBarrier';d.root.userData.structuralRole='deployableBarrier';controls.push({bone:d.root,role:'crane',axis:'x',amplitude:.25,motion:'rotation'});}
    }
    for(let i=0;i<art.repairArms;i++)device('repair',`${ship.id}-repair-${i+1}`,[shape.length*.03+i*1.4,.12,(i%2?1:-1)*shape.width*.4]);
    for(let i=0;i<art.rescueCapsules;i++)device('rescue',`${ship.id}-rescue-${i+1}`,[.3+i*1.4,-shape.depth*.3,shape.width*.51],hullMotion,.8);
    for(let i=0;i<art.smokeEmitters;i++)device('smoke',`${ship.id}-smoke-${i+1}`,[shape.length*.35,.4,shape.width*.30],hullMotion,.8);
    for(let i=0;i<art.bell;i++)device('bell',`${ship.id}-bell-${i+1}`,[-shape.length*(ship.id==='boss-bell-devourer'?.31:.04)+i*1.4,.25,0],hullMotion,/bell-devourer|quiet-answer/.test(ship.id)?2.1:1.2);
    for(let i=0;i<art.tank;i++)device('tank',`${ship.id}-tank-${i+1}`,[shape.length*.08+i*.85,.2,shape.width*.28],hullMotion,.85);
    for(let i=0;i<art.rail;i++)device('rail',`${ship.id}-rail-${i+1}`,[-1+i*2.2,.1,shape.width*.23],hullMotion,1);
    for(let i=0;i<art.storage;i++)device('storage',`${ship.id}-storage-${i+1}`,[.2+Math.floor(i/2)*1.25,.1,(i%2?1:-1)*shape.width*.25],hullMotion,.8);
    for(let i=0;i<art.crane;i++)device('crane',`${ship.id}-crane-${i+1}`,[shape.length*.14,.1,(i%2?1:-1)*shape.width*.42],hullMotion,1.1);
    for(let i=0;i<art.sail;i++)device('sail',`${ship.id}-sail-${i+1}`,[shape.length*(i%2?.32:-.33),.3,(i%2?1:-1)*shape.width*.2],hullMotion,/fleet-king/.test(ship.id)?1.5:.9);
    if(/night-shift|cooling|purifier/.test(ship.id))for(const side of [-1,1])tube(hullMotion,[[shape.length*.2,.3,side*shape.width*.3],[shape.length*.2,1.1,side*shape.width*.4],[-shape.length*.18,1.1,side*shape.width*.4],[-shape.length*.3,.4,side*shape.width*.3]],.12,materials.brass,`${ship.id}-thermal-pipe-${side}`,22);
    if(style==='cult')for(const side of [-1,1]){
      addMesh(hullMotion,new THREE.PlaneGeometry(shape.length*.23,1.35,6,2),materials.canvas,`${ship.id}-white-seal-curtain-${side}`,[shape.length*.18,1.15,side*shape.width*.43]);
      for(const x of [shape.length*.065,shape.length*.295])tube(hullMotion,[[x,.1,side*shape.width*.38],[x,1.87,side*shape.width*.43]],.045,materials.rope,`${ship.id}-curtain-rope-${side}-${x}`,6);
    }
    if(ship.id==='civil-research'){const mast=feature(`${ship.id}-lightning-mast`,'lightningRod',hullMotion,[0,0,shape.width*.35]);addMesh(mast,new THREE.CylinderGeometry(.05,.11,7,8),materials.brass,'lightning-rod',[0,3.5,0]);}
  }
  const hasWeapons=['machineGuns','cannons','mortars','harpoons','chainCannons','flamethrowers'].some(k=>art[k]>0);
  const availableProfiles=['FloatIdle','Cruise','BankTurn','GustRecovery'];if(hasWeapons)availableProfiles.push('TurretScan','FireBurst');if(art.winches||art.repairArms||art.crane||art.rail||ship.scopeKind==='environment')availableProfiles.push('WinchCycle');
  scene.userData={title:'Cloudstitch',assetId:ship.id,assetName:ship.name,category:ship.category,scopeKind:ship.scopeKind,sourceFiles:ship.sourceFiles,confirmedModules:ship.modules,artModules:art,requiredFeatures:ship.requiredFeatures,structuralFeatures:ship.structuralFeatures,availableProfiles,shapeProposal:shape,style,units:'Relative art units; engine and metre scale unassigned',authoredUnits:'fleet-kit',nominalHullLength:shape.length,recommendedFleetScale:1,scaleNote:'Base kit hull is 10 relative units. This is a visual assembly convention, not metres or gameplay scale.',purpose:'Authored 3D art assets with rigged presentation motion. No gameplay AI, combat, physics or balance implementation.',detailStatus:ship.definitionLevel,originalAssetsPreserved:true};
  scene.updateMatrixWorld(true);
  return{scene,controls,artModules:art,shape,style,moduleRoots,availableProfiles};
}
