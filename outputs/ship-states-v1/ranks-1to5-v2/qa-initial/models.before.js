import * as THREE from 'three';
import {createLibrary as star2} from '../star2-assets-v1/models.js';
import {createLibrary as star3} from '../star3-assets-v1/models.js';
import {createLibrary as star4} from '../star4-assets-v1/models.js';
import {TYPES} from './catalog.js';
export {TYPES};
const colors={wood:0xc28b46,darkWood:0x72503a,teal:0x41837f,darkTeal:0x2e5557,cream:0xf7e7c7,brass:0xd4ae61,coral:0xc87056,rope:0xb79a67,black:0x263d3d},V=a=>new THREE.Vector3(...a);
export function createLibrary(gltf){
 const libs={2:star2(gltf),3:star3(gltf),4:star4(gltf)},owned=new Set(),paintMaps=new Map();
 function texture(kind){if(paintMaps.has(kind))return paintMaps.get(kind);const n=128,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const grain=kind==='wood'?Math.sin(y*.38+Math.sin(x*.04)*2)*17:kind==='cloth'?((x%8===0||y%8===0)?-18:1):Math.sin(y*.2+Math.sin(x*.07))*10;const c=Math.round(THREE.MathUtils.clamp(235+grain+Math.sin(x*3.3+y*5.3)*4,194,255)),i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=c;data[i+3]=255;}const t=new THREE.DataTexture(data,n,n);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;paintMaps.set(kind,t);owned.add(t);return t;}
 function create(id){
  const meta=TYPES.find(t=>t.id===id);if(!meta)throw Error('Unknown rank asset: '+id);const {rank,branch}=meta;
  const base=rank>=2&&rank<=4?libs[rank].create(branch):libs[2].create('original'),root=base.root,parts=base.parts;
  root.name='Cloudstitch_V2_'+id;root.userData={star:rank,lineage:branch,assetId:id,visualAsset:true,forward:'-X',up:'+Y',units:'source relative units',reviewMountOnly:true};
  const palette={};for(const[name,color]of Object.entries(colors)){const m=new THREE.MeshBasicMaterial({name:'V2 painted '+name,color,map:texture(/wood/i.test(name)?'wood':['cream','coral','rope'].includes(name)?'cloth':'metal'),vertexColors:true,side:THREE.DoubleSide});palette[name]=m;owned.add(m);}
  function paint(g){if(!g.attributes.normal)g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,c=[];for(let i=0;i<p.count;i++){const light=n.getX(i)*-.22+n.getY(i)*.75+n.getZ(i)*-.35;const band=light>.45?1:light>-.25?.90:.78;const grain=Math.sin(p.getX(i)*120+p.getY(i)*43)*Math.sin(p.getZ(i)*137)*.018;const v=band+grain;c.push(v,v*.992,v*.975);}g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));owned.add(g);return g;}
  function group(name,at=[0,0,0],parent=root){const g=new THREE.Group();g.name=name;g.position.fromArray(at);parent.add(g);return g;}
  function mesh(g,m,at=[0,0,0],s=[1,1,1],parent=root,name='Crafted surface'){const o=new THREE.Mesh(paint(g),palette[m]);o.name=name;o.position.fromArray(at);o.scale.fromArray(s);parent.add(o);return o;}
  function box(at,s,m='wood',parent=root){return mesh(new THREE.BoxGeometry(1,1,1),m,at,s,parent);}
  function orb(at,s,m='brass',parent=root){return mesh(new THREE.SphereGeometry(1,20,12),m,at,s,parent);}
  function rod(a,b,r=.008,m='brass',parent=root){const d=V(b).sub(V(a));const o=mesh(new THREE.CylinderGeometry(r,r,d.length(),12),m,V(a).add(V(b)).multiplyScalar(.5).toArray(),[1,1,1],parent);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
  function curve(points,r=.006,m='brass',parent=root){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)),Math.max(20,points.length*6),r,7,false),m,[0,0,0],[1,1,1],parent);}
  function ring(at,r,m='brass',axis='x',parent=root,tube=.007){const o=mesh(new THREE.TorusGeometry(r,tube,8,36),m,at,[1,1,1],parent);o.rotation.set(axis==='y'?Math.PI/2:0,axis==='x'?Math.PI/2:0,0);return o;}
  function plate(points,depth,m,at=[0,0,0],parent=root){const s=new THREE.Shape();s.moveTo(...points[0]);for(const p of points.slice(1))s.lineTo(...p);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:1});return mesh(g,m,at,[1,1,1],parent);}
  function deck(at,l,w,parent=root){const g=group('Wooden kit deck',at,parent);box([0,0,0],[l,.022,w],'wood',g);for(let i=0;i<8;i++)box([(i/7-.5)*l*.88,.012,0],[.002,.001,w*.94],'darkWood',g);for(const s of[-1,1]){curve([[-l*.48,.018,s*w*.49],[0,.025,s*w*.52],[l*.48,.018,s*w*.49]],.005,'brass',g);}return g;}
  function rivets(at,count,axis='x',parent=root){for(let i=0;i<count;i++){const p=[...at];p[axis==='x'?0:2]+=i*.035;orb(p,[.004,.004,.004],'brass',parent);}}
  function propeller(at,r,parent=root){const g=group('Tilt propeller rotor',at,parent);g.userData.viewerMotion='rotorX';for(let i=0;i<3;i++){const a=i*Math.PI*2/3;const blade=orb([0,Math.sin(a)*r*.5,Math.cos(a)*r*.5],[.008,r*.20,r*.49],'teal',g);blade.rotation.x=-a;rod([0,0,0],[0,Math.sin(a)*r*.73,Math.cos(a)*r*.73],.004,'brass',g);}orb([-.008,0,0],[.022,.022,.022],'brass',g);return g;}

  function canopy(at,l,w,rise,m='cream',parent=root){const g=group('Sewn curved canopy',at,parent),pos=[],uv=[],idx=[],nx=14,ny=8;for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/ny;pos.push((u-.5)*l,Math.sin(u*Math.PI)*rise+Math.sin(v*Math.PI)*rise*.28,(v-.5)*w);uv.push(u,v);}for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*(nx+1)+i;idx.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();mesh(geo,m,[0,0,0],[1,1,1],g,'Painted sewn membrane');for(const s of[-1,1])curve(Array.from({length:15},(_,i)=>{const u=i/14;return[(u-.5)*l,Math.sin(u*Math.PI)*rise,s*w*.5];}),.007,'darkWood',g);for(const u of[.2,.5,.8])curve(Array.from({length:9},(_,i)=>{const v=i/8;return[(u-.5)*l,Math.sin(u*Math.PI)*rise+Math.sin(v*Math.PI)*rise*.28,(v-.5)*w];}),.003,'brass',g);return g;}
  function lamp(at,r=.025,parent=root){const g=group('Warm navigation beacon',at,parent);orb([0,0,0],[r,r*1.3,r],'brass',g);orb([0,0,-r*.8],[r*.72,r*.9,r*.3],'cream',g);mesh(new THREE.ConeGeometry(r*1.25,r*.7,12),'teal',[0,r*1.4,0],[1,1,1],g);ring([0,-r*.95,0],r,'darkWood','y',g,.003);return g;}
  function barrel(parent,at,l=.30,r=.045){const g=group('Active cannon barrel',at,parent);rod([.03,0,0],[-l,0,0],r,'darkTeal',g);for(const x of[0,-l*.4,-l*.82,-l])ring([x,0,0],r*1.12,'brass','x',g,.005);const o=mesh(new THREE.CylinderGeometry(r*.76,r*.76,.004,24),'black',[-l-.003,0,0],[1,1,1],g,'Dark inset bore');o.rotation.z=Math.PI/2;return g;}
  function coil(at,r=.08,w=.12,parent=root){const g=group('Heavy recovery cable drum',at,parent);rod([0,0,-w/2],[0,0,w/2],r,'darkWood',g);for(const z of[-w*.6,w*.6]){orb([0,0,z],[r*1.2,r*1.2,.012],'wood',g);ring([0,0,z],r*1.22,'brass','z',g,.006);}for(let i=0;i<11;i++)ring([0,0,(i/10-.5)*w],r*1.015,'rope','z',g,.003);return g;}
  function shield(at,l=.4,h=.19,s=-1,parent=root){const g=group('Layered curved shoulder shield',at,parent);const o=plate([[-l*.5,0],[-l*.37,-h],[l*.28,-h*.9],[l*.52,0],[l*.20,h*.25],[-l*.30,h*.22]],.015,'teal',[0,0,0],g);if(s<0)o.scale.z=-1;curve([[-l*.5,0,s*.01],[-l*.37,-h,s*.01],[l*.28,-h*.9,s*.01],[l*.52,0,s*.01]],.008,'brass',g);for(let i=0;i<5;i++)orb([(i/4-.5)*l*.7,-h*.30,s*.02],[.005,.005,.004],'brass',g);return g;}
  // Shared hero vocabulary is structural: a swept lower hull, a hand-carved
  // double cloud-scroll prow below the firing lane and a small inhabited stern.
  const foundation=group('V2 heroic hull foundation');
  orb([.03,-.255,0],[.36,.10,.155],'wood',foundation);
  for(const s of[-1,1]){curve([[-.38,-.16,s*.09],[-.16,-.34,s*.135],[.22,-.32,s*.13],[.39,-.17,s*.08]],.014,'darkTeal',foundation);curve([[-.33,-.22,s*.09],[-.48,-.24,s*.11],[-.62,-.14,s*.06],[-.59,-.075,s*.035],[-.55,-.09,s*.04]],.020,'wood',foundation);curve([[-.33,-.20,s*.105],[-.48,-.22,s*.12],[-.60,-.13,s*.07]],.005,'brass',foundation);for(const x of[-.26,-.08,.10,.28])curve([[x,-.13,s*.10],[x,-.24,s*.16],[x,-.32,s*.09]],.006,'brass',foundation);}
  lamp([-.53,-.17,0],.028,foundation);deck([.41,-.025,0],.23,.30,foundation);box([.43,.018,0],[.16,.08,.21],'wood',foundation);canopy([.43,.063,0],.23,.26,.055,'teal',foundation);
  for(const s of[-1,1]){for(const x of[.37,.47]){ring([x,.025,s*.108],.021,'brass','z',foundation,.003);orb([x,.025,s*.11],[.015,.015,.004],'cream',foundation);}lamp([.32,.015,s*.17],.017,foundation);}
  if(rank===1){const aft=canopy([.22,.027,-.15],.24,.12,.06,'coral');for(const x of[.12,.32])rod([x,-.12,-.19],[x,.027,-.19],.005,'brass');const crest=group('Starter wind vane',[.28,.075,.12]);rod([0,0,0],[0,.13,0],.003,'brass',crest);plate([[0,.12],[.12,.13],[.08,.095],[0,.09]],.001,'coral',[0,0,0],crest);}
  if(rank>=2&&rank<=4){
   if(branch==='mobility'){
    const frame=group('V2 reinforced wind chassis');for(const s of[-1,1]){curve([[-.34,-.17,s*.12],[-.16,-.22,s*.24],[.25,-.20,s*.26],[.40,-.13,s*.14]],.017,'teal',frame);for(const x of[-.20,.20])rod([x,-.13,s*.09],[x,-.19,s*.29],.012,'brass',frame);}
    if(rank===2){const guard=group('Open rear propeller protective halo',[.445,-.137,.008]);ring([0,0,0],.14,'brass','x',guard,.009);for(const s of[-1,1])rod([-.10,0,s*.05],[0,0,s*.14],.008,'teal',guard);}
    if(rank===3){for(const s of[-1,1]){const g=group('Tilt gearbox shoulder',[.30,-.10,s*.23]);orb([0,0,0],[.07,.055,.065],'teal',g);ring([0,0,-.07],.044,'brass','z',g,.007);rod([-.13,-.025,-s*.12],[0,0,0],.021,'wood',g);lamp([.05,.05,-.02],.015,g);}canopy([.30,.13,-.27],.27,.20,.09,'coral');for(const x of[.18,.42])rod([x,-.10,-.28],[x,.13,-.28],.006,'brass');}
    if(rank===4){for(const s of[-1,1]){const fin=group('V2 swept outer foil tip',[-.12,-.235,s*.38]);fin.rotation.y=s*.09;const o=plate([[-.35,0],[-.21,.08],[.25,.045],[.37,-.035],[-.10,-.09]],.008,'teal',[0,0,0],fin);o.rotation.x=Math.PI/2;curve([[-.32,0,0],[-.14,.06,s*.09],[.28,.025,s*.05]],.006,'brass',fin);}for(const x of[-.17,.16])rod([x,-.16,-.13],[x,-.23,.36],.014,'wood');}
   }
   if(branch==='artillery'){
    for(const s of[-1,1]){shield([-.08,-.10,s*.16],rank===2?.36:.46,rank===4?.14:.20,s);curve([[-.38,-.17,s*.12],[-.17,-.34,s*.19],[.23,-.29,s*.16]],.014,'brass');}
    if(rank===2){const g=group('Round bow mantlet shoulder',[-.31,-.035,0]);for(const s of[-1,1])orb([.035,0,s*.068],[.078,.055,.043],'teal',g);}
    if(rank===3){for(const s of[-1,1]){const feed=group('Revolving breech feeder side casing',[-.27,-.04,s*.12]);ring([0,0,0],.075,'brass','z',feed,.009);orb([0,0,0],[.064,.064,.02],'teal',feed);for(let i=0;i<6;i++){const a=i*Math.PI/3;rod([Math.cos(a)*.04,Math.sin(a)*.04,-.028],[Math.cos(a)*.04,Math.sin(a)*.04,.028],.010,'brass',feed);}}}
    if(rank===4){const bridge=group('Siege rear counterweight cage',[-.09,-.02,0]);box([0,0,0],[.14,.10,.20],'darkWood',bridge);for(const z of[-.105,.105])for(const x of[-.05,.05])rod([x,-.06,z],[x,.07,z],.007,'brass',bridge);for(const s of[-1,1])rod([-.34,-.08,s*.09],[-.11,-.05,s*.14],.015,'teal');}
   }
   if(branch==='salvage'){
    for(const s of[-1,1])curve([[-.39,-.14,s*.11],[-.16,-.29,s*.18],[.26,-.23,s*.14]],.018,'darkWood');
    if(rank===2){for(const s of[-1,1]){const p=group('Padded tug prow fender',[-.32,-.16,s*.14]);orb([0,0,0],[.10,.055,.038],'teal',p);for(const x of[-.06,.06])ring([x,0,0],.045,'rope','x',p,.008);}canopy([.24,.02,.12],.22,.15,.07,'coral');}
    if(rank===3){const g=group('Crane braced winch tower',[.19,-.11,-.19]);for(const s of[-1,1]){rod([-.10,0,s*.06],[.09,.22,-.12+s*.03],.013,'darkWood',g);rod([.15,0,s*.06],[.09,.22,-.12+s*.03],.009,'brass',g);}ring([.09,.22,-.12],.033,'brass','z',g,.006);coil([-.055,.045,-.08],.06,.09,g);}
    if(rank===4){const g=group('Recovery dock roller gantry',[-.30,-.09,0]);for(const s of[-1,1]){rod([.05,-.06,s*.13],[0,.09,s*.22],.017,'teal',g);ring([0,.09,s*.22],.036,'brass','z',g,.006);for(let i=0;i<4;i++)rod([-.18-i*.10,-.025,s*.17],[-.18-i*.10,-.025,s*.24],.018,'brass',g);}rod([0,.09,-.22],[0,.09,.22],.016,'darkWood',g);canopy([.24,.04,.25],.24,.25,.06,'coral');for(const x of[.12,.36])rod([x,-.10,.31],[x,.04,.31],.006,'brass');}
   }
  }
  if(rank===5){parts.TurretAssembly.visible=false;
   if(branch==='mobility'){
    parts.EngineHousing.visible=false;parts.PropellerAssembly.visible=false;
    for(const s of[-1,1]){
     const hub=group('Storm fan wing root',[-.05,-.09,s*.20]);ring([0,0,0],.075,'brass','x',hub,.012);orb([0,0,0],[.04,.065,.065],'teal',hub);rod([.0,0,-s*.10],[.02,0,s*.05],.026,'darkWood',hub);
     for(let tier=0;tier<2;tier++)for(let i=0;i<3;i++){
      const wing=group('Articulated storm fan blade',[-.26+i*.18,.015+tier*.12,s*(.24+tier*.13)]);wing.rotation.y=s*(-.27+i*.15);wing.rotation.z=.10-i*.06;
      const g=canopy([0,0,s*.16],.55-.07*i,.38,.10,'cream',wing);g.rotation.x=-s*(.18+tier*.27);curve([[-.26,0,0],[0,.07,s*.30],[.26,.03,s*.25]],.012,'teal',wing);rod([.21,.0,s*.02],[-.05,.04,s*.30],.006,'brass',wing);rod([-.05,-tier*.05,-s*.09],[.06,.02,s*.16],.011,'darkWood',wing);
     }
     const boom=group('Raised twin storm drive',[.34,-.08,s*.30]);rod([-.20,-.08,-s*.17],[.09,.055,0],.025,'wood',boom);orb([.02,.04,0],[.13,.067,.067],'teal',boom);for(const x of[-.06,.09])ring([x,.04,0],.067,'brass','x',boom,.007);propeller([.16,.04,0],.16,boom);
    }
    const mast=group('Wind reader mast',[.28,.04,0]);rod([0,0,0],[0,.36,0],.008,'brass',mast);ring([0,.25,0],.06,'teal','x',mast,.006);plate([[0,.34],[.28,.37],[.20,.30],[.29,.27],[0,.29]],.002,'coral',[0,0,0],mast);
   }
   if(branch==='artillery'){
    const g=group('Integrated twin battery',[-.32,-.055,0]);deck([-.02,-.10,0],.55,.46,g);orb([.015,.0,0],[.18,.115,.20],'teal',g);for(const s of[-1,1]){barrel(g,[-.07,.025,s*.09],.31,.05);ring([-.08,.025,s*.09],.075,'brass','x',g,.009);shield([.06,-.065,s*.22],.42,.20,s,g);orb([.14,-.01,s*.22],[.09,.10,.09],'darkTeal',g);ring([.14,-.01,s*.23],.085,'brass','z',g,.008);rod([-.13,-.09,s*.15],[.14,-.14,s*.12],.025,'darkWood',g);}box([.18,.015,0],[.15,.13,.27],'wood',g);for(const z of[-.10,0,.10])box([.18,.045,z],[.17,.07,.018],'brass',g);for(const s of[-1,1])curve([[-.30,-.10,s*.16],[-.09,-.33,s*.22],[.27,-.25,s*.16]],.018,'teal');canopy([.52,.13,0],.29,.33,.08,'teal');for(const z of[-.13,.13])rod([.52,-.01,z],[.52,.13,z],.008,'brass');
   }
   if(branch==='salvage'){
    parts.WinchDrumMesh.visible=false;parts.HookAndChain.visible=false;deck([-.15,-.11,0],.78,.45);coil([.12,-.10,-.26],.105,.17);curve([[.11,-.20,-.25],[-.21,-.20,-.22],[-.49,-.16,-.12]],.006,'rope');
    for(const s of[-1,1]){
     const arm=group(s<0?'Soft holding arm':'Repair tool arm',[-.14,-.09,s*.20]);ring([0,0,0],.055,'brass','z',arm,.009);orb([0,0,0],[.05,.05,.04],'teal',arm);rod([0,0,0],[-.19,.16,s*.10],.028,'wood',arm);ring([-.19,.16,s*.10],.046,'brass','z',arm,.007);rod([-.19,.16,s*.10],[-.36,.05,s*.17],.021,'teal',arm);rod([-.10,.06,s*.03],[-.27,.10,s*.13],.010,'brass',arm);
     const tool=group('Replaceable review tool',[-.36,.05,s*.17],arm);if(s<0){for(const j of[-1,1])curve([[0,0,0],[-.08,j*.065,0],[-.16,j*.075,0],[-.19,j*.035,0]],.018,'brass',tool);for(const j of[-1,1])box([-.18,j*.04,0],[.035,.04,.055],'teal',tool);}else{rod([0,0,0],[-.12,0,0],.025,'darkTeal',tool);ring([-.12,0,0],.033,'brass','x',tool,.006);plate([[-.16,-.025],[-.22,0],[-.16,.025]],.01,'brass',[0,0,-.005],tool);}
    }
    const shop=group('Open service workshop',[.48,-.01,.06]);deck([0,-.07,0],.36,.47,shop);for(const x of[-.15,.15])for(const s of[-1,1])rod([x,-.06,s*.20],[x,.20,s*.20],.008,'darkWood',shop);canopy([0,.20,0],.42,.46,.10,'coral',shop);box([0,.025,.10],[.28,.045,.14],'wood',shop);for(const x of[-.09,.02,.10])orb([x,.065,.10],[.025,.024,.025],'brass',shop);lamp([-.15,.14,-.20],.022,shop);
    const load=group('Detachable service cargo cradle',[.02,-.43,0]);deck([0,0,0],.57,.43,load);for(const x of[-.22,.22])for(const s of[-1,1]){rod([x,.02,s*.17],[x,.26,s*.12],.004,'rope',load);rod([x,.02,s*.17],[x,.09,s*.17],.006,'darkWood',load);}for(const s of[-1,1])rod([-.22,.09,s*.17],[.22,.09,s*.17],.006,'brass',load);
   }
  }
  root.updateMatrixWorld(true);let triangles=0,meshes=0;root.traverseVisible(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
  const rotors=[];root.traverse(n=>{if(n.userData.viewerMotion==='rotorX')rotors.push({n,q:n.quaternion.clone()});});
  return{root,parts,counts:{triangles,meshes,sourceTriangles:11026},meta,update(t=0){base.update(t);for(const r of rotors)r.n.quaternion.copy(r.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),t*Math.PI*6));},dispose(){root.removeFromParent();base.dispose();}};
 }
 return{create,createOriginal(){return libs[2].create('original');},dispose(){Object.values(libs).forEach(l=>l.dispose());owned.forEach(o=>o.dispose());}};
}
