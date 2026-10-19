import * as THREE from 'three';
import {createVariantLibrary} from '../variants.js';
export const TYPES=[{id:'mobility',name:'기동 · 바람길잡이',kit:'하부 분절 활주판 · 꼬리 안정돛',file:'star4-mobility.glb'},{id:'artillery',name:'포격 · 철갑형',kit:'반동 레일 단포 · 전개 방패와 지지대',file:'star4-artillery.glb'},{id:'salvage',name:'인양 · 구름 예인선',kit:'선수 전개 회수 도크 · 하부 화물 플랫폼',file:'star4-salvage.glb'}];
const colors={wood:0xc28b46,darkWood:0x72503a,teal:0x41837f,darkTeal:0x2e5557,cream:0xf7e7c7,brass:0xd4ae61,coral:0xc87056,rope:0xb79a67,black:0x263d3d};
const V=a=>new THREE.Vector3(...a);
export function createLibrary(gltf){
 const library=createVariantLibrary(gltf),owned=new Set(),paintMaps=new Map();
 function paintedMap(kind){if(paintMaps.has(kind))return paintMaps.get(kind);const n=128,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const rough=Math.sin(x*1.9+y*2.7)*Math.sin(x*.37-y*.71)*5;const brush=kind==='wood'?Math.sin(y*.45+Math.sin(x*.044)*2.1)*15+Math.sin(y*1.55+x*.019)*5:kind==='cloth'?((x%8<1||y%8<1)?-17:1)+Math.sin(x*.055+y*.045)*7:Math.sin(y*.18+Math.sin(x*.03))*9+Math.sin(x*.12)*4;const c=Math.round(THREE.MathUtils.clamp(238+brush+rough,195,255)),i=(y*n+x)*4;data[i]=c;data[i+1]=c;data[i+2]=c;data[i+3]=255;}const t=new THREE.DataTexture(data,n,n);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=t.minFilter=THREE.LinearFilter;t.name='Hand painted '+kind+' grain';t.needsUpdate=true;paintMaps.set(kind,t);owned.add(t);return t;}
 function create(type='original'){
  if(type!=='original'&&!TYPES.some(t=>t.id===type))throw Error('Unknown type');
  const base=library.create('normal',0),root=base.root;root.name='Cloudstitch_Star4_'+type;root.userData={star:type==='original'?1:4,lineage:type,visualAsset:true,forward:'-X',up:'+Y',units:'source units; not certified metres'};
  base.update(0);const palette={};
  for(const [name,color]of Object.entries(colors)){const kind=/wood/i.test(name)?'wood':['cream','coral','rope'].includes(name)?'cloth':'metal';palette[name]=new THREE.MeshBasicMaterial({name:'Painted '+name,color,map:paintedMap(kind),vertexColors:true,side:THREE.DoubleSide});owned.add(palette[name]);}
  // Bake a soft painted light ramp into the new surfaces. GLB exports unlit
  // materials and vertex colours, so their volume does not require a custom shader.
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
  if(type==='mobility'){
   base.parts.TurretAssembly.visible=false;base.parts.EngineHousing.visible=false;base.parts.PropellerAssembly.visible=false;
   const frame=group('Lower windrunner chassis',[0,-.23,0]);
   for(const x of[-.30,.23]){rod([x,.09,-.085],[x,0,-.23],.014,'brass',frame);rod([x,.09,.085],[x,0,.23],.014,'brass',frame);rod([x,0,-.22],[x,0,.22],.018,'darkWood',frame);}
   for(const s of[-1,1]){
    const foil=group(s<0?'Port segmented wind foil':'Starboard segmented wind foil',[0,0,0],frame);foil.userData.reviewRole='Three hinged segments fixed in deployed flight pose';
    function pt(u,v){const x=-.50+.99*u,width=.15+.12*Math.sin(Math.PI*u);return[x,.027*Math.sin(Math.PI*u)-.065*v,s*(.15+width*v)];}
    for(let panel=0;panel<3;panel++){const pos=[],uv=[],ind=[],nx=8,ny=5;for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=(panel+(i/nx)*.94)/3,v=j/ny;pos.push(...pt(u,v));uv.push(i/nx,v);}for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*(nx+1)+i;ind.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();mesh(g,'cream',[0,0,0],[1,1,1],foil,'Stitched folding foil panel '+panel);const a=panel/3,b=(panel+.94)/3;curve(Array.from({length:10},(_,i)=>pt(a+(b-a)*i/9,1)),.010,'teal',foil);curve(Array.from({length:6},(_,i)=>pt(a,i/5)),.006,'brass',foil);for(const v of[.12,.86]){const q=pt(a,v);ring(q,.013,'brass','x',foil,.003);}}
    curve(Array.from({length:21},(_,i)=>pt(i/20,0)),.012,'darkWood',foil);for(const x of[-.30,.20]){rod([x,.06,s*.10],[x,-.01,s*.26],.012,'teal',frame);orb([x,-.01,s*.26],[.022,.013,.022],'brass',frame);}
   }
   const keel=plate([[-.22,-.25],[-.12,-.40],[.16,-.38],[.29,-.25],[.08,-.29]],.012,'teal',[0,0,-.006]);keel.name='Ventral wind rudder';curve([[-.22,-.25,0],[-.12,-.40,0],[.16,-.38,0]],.005,'brass');
   for(const s of[-1,1]){const drive=group(s<0?'Port stern drive':'Starboard stern drive',[.34,-.13,s*.25]);rod([-.13,0,-s*.15],[.06,0,0],.021,'wood',drive);ring([-.02,0,0],.030,'brass','z',drive);orb([.02,0,0],[.105,.054,.054],'teal',drive);for(const x of[-.05,.07])ring([x,0,0],.055,'brass','x',drive,.006);propeller([.13,0,0],.12,drive);}
   for(const s of[-1,1]){curve([[.16,-.17,s*.075],[.29,-.14,s*.08],[.41,-.075,s*.075],[.45,.025,s*.075]],.021,'wood');rod([.22,-.15,s*.08],[.34,-.062,s*.075],.014,'brass');rod([.34,-.062,s*.075],[.46,.03,s*.075],.012,'darkWood');const fin=group('High split stern stabilizer',[.34,-.07,s*.075]);const f=plate([[0,0],[.13,.25],[.15,.25],[.19,.09],[.06,.035]],.007,'teal',[0,0,0],fin);f.rotation.x=s*.2;curve([[0,0,0],[.13,.25,0],[.15,.25,0]],.005,'brass',fin);}
   curve([[-.41,-.14,0],[-.53,-.12,0],[-.59,-.03,0],[-.55,-.01,0]],.018,'wood');const vane=group('Coral tail wind vane',[.40,.12,.03]);rod([0,0,0],[0,.13,0],.003,'brass',vane);plate([[0,.12],[.15,.14],[.10,.10],[.15,.08],[0,.09]],.001,'coral',[0,0,0],vane);
  }
  if(type==='artillery'){
   base.parts.TurretAssembly.visible=false;
   const kit=group('Deployable siege chassis',[-.27,-.12,0]);deck([-.10,-.025,0],.52,.34,kit);
   const rail=group('Sliding recoil rail replacing revolving chamber',[-.07,.015,0],kit);rail.userData.reviewRole='Fixed recoil sled concept; no fire or collision logic';
   for(const s of[-1,1]){box([-.04,0,s*.065],[.42,.037,.025],'darkWood',rail);box([-.04,.021,s*.065],[.44,.012,.012],'brass',rail);for(const x of[-.16,.06])orb([x,.035,s*.065],[.021,.017,.018],'teal',rail);rod([.14,.055,s*.07],[-.09,.055,s*.07],.014,'darkTeal',rail);rod([-.09,.055,s*.07],[-.19,.055,s*.07],.008,'brass',rail);}
   const sled=group('Recoil gun carriage',[-.11,.062,0],rail);box([.045,-.015,0],[.19,.045,.15],'teal',sled);rod([.10,.055,0],[-.22,.055,0],.045,'darkTeal',sled);orb([.06,.055,0],[.09,.065,.06],'teal',sled);for(const x of[-.18,-.07,.04])ring([x,.055,0],.047,'brass','x',sled,.006);const bore=mesh(new THREE.CylinderGeometry(.034,.034,.004,24),'black',[-.227,.055,0],[1,1,1],sled,'Single siege muzzle');bore.rotation.z=Math.PI/2;ring([-.231,.055,0],.043,'brass','x',sled,.008);
   for(const s of[-1,1]){
    const shield=group(s<0?'Port open blast shield':'Starboard open blast shield',[-.07,.025,s*.12],kit);shield.rotation.x=-s*.63;const o=plate([[-.20,0],[-.18,.19],[.09,.23],[.16,.04]],.015,'teal',[0,0,0],shield);if(s<0)o.scale.z=-1;curve([[-.20,0,s*.008],[-.18,.19,s*.008],[.09,.23,s*.008]],.008,'brass',shield);for(const x of[-.14,-.05,.04])orb([x,.12,s*.020],[.005,.005,.004],'brass',shield);
    for(const x of[-.23,.14]){const brace=group('Deployed recoil support',[x,-.02,s*.10],kit);rod([0,0,0],[0,-.12,s*.20],.021,'darkWood',brace);rod([.04,.01,0],[0,-.12,s*.20],.010,'brass',brace);box([0,-.145,s*.20],[.15,.036,.12],'teal',brace);box([0,-.168,s*.20],[.17,.014,.14],'brass',brace);}
   }
   const breech=group('Rear breech loading hatch',[.13,.08,0],kit);box([0,0,0],[.08,.095,.13],'wood',breech);ring([-.045,.02,0],.038,'brass','x',breech);rod([-.055,.02,0],[-.09,.06,0],.006,'brass',breech);
  }
  if(type==='salvage'){
   base.parts.TurretAssembly.visible=false;base.parts.WinchDrumMesh.visible=false;base.parts.HookAndChain.visible=false;
   deck([-.33,-.11,0],.39,.34);
   // Split fore rails dock a recovered module; the3-star suspended sling and
   // tall deployed crane are replaced rather than accumulated.
   for(const s of[-1,1]){
    const hinge=group(s<0?'Port docking hinge':'Starboard docking hinge',[-.32,-.13,s*.14]);ring([0,0,0],.039,'brass','y',hinge);rod([0,0,0],[-.08,-.02,s*.07],.025,'teal',hinge);
    const dock=group(s<0?'Port deployed recovery rail':'Starboard deployed recovery rail',[-.36,-.15,s*.20]);dock.rotation.y=-s*.10;box([-.22,0,0],[.58,.035,.075],'darkWood',dock);box([-.22,.022,0],[.56,.023,.081],'wood',dock);box([-.22,.038,-s*.026],[.49,.020,.036],'cream',dock);for(const x of[-.46,-.24,-.02]){box([x,0,0],[.026,.066,.092],'brass',dock);ring([x,-.003,0],.024,'teal','z',dock,.004);}box([-.51,.008,0],[.055,.080,.115],'teal',dock);rod([.01,.03,-s*.09],[-.19,-.015,0],.013,'brass',dock);
   }
   const hoist=group('Underslung cable cargo platform',[-.04,-.40,0]);deck([0,0,0],.50,.38,hoist);for(const s of[-1,1])for(const x of[-.19,.19]){rod([x,.015,s*.15],[x,.11,s*.15],.006,'darkWood',hoist);rod([x,.11,s*.15],[x,.26,s*.10],.003,'rope',hoist);}for(const s of[-1,1]){rod([-.19,.11,s*.15],[.19,.11,s*.15],.006,'brass',hoist);box([0,.047,s*.17],[.44,.06,.015],'wood',hoist);}box([0,.065,0],[.20,.10,.16],'wood',hoist);for(const x of[-.07,.07])box([x,.065,0],[.014,.11,.17],'darkWood',hoist);
   const reel=group('Dock winch and guide cable',[.03,-.12,-.22]);rod([0,0,-.07],[0,0,.07],.075,'darkWood',reel);for(const z of[-.075,.075]){ring([0,0,z],.09,'brass','z',reel,.009);orb([0,0,z],[.078,.078,.009],'wood',reel);}for(let i=0;i<11;i++)ring([0,0,-.06+i*.012],.076,'rope','z',reel,.004);curve([[0,-.07,0],[-.12,-.09,.03],[-.25,-.08,.02],[-.44,-.05,.0]],.005,'rope',reel);
   const folded=group('Stowed compact rear lifting arm',[.22,-.10,-.17]);rod([0,0,0],[.10,.07,-.03],.020,'wood',folded);rod([.10,.07,-.03],[-.01,.095,-.05],.015,'teal',folded);for(const p of[[0,0,0],[.10,.07,-.03],[-.01,.095,-.05]])ring(p,.023,'brass','z',folded,.005);curve([[-.01,.09,-.05],[-.02,.04,-.05],[0,.026,-.05],[.012,.044,-.05]],.005,'brass',folded);
   for(const s of[-1,1]){rod([-.15,-.15,s*.12],[-.15,-.33,s*.17],.004,'rope');ring([-.15,-.15,s*.12],.022,'brass','z');}
  }
  // The borrowed original atlas stays intact. A lighting-independent copy of
  // its material is exported with KHR_materials_unlit; source files never change.
  const cache=new Map();root.traverse(n=>{if(!n.isMesh)return;if(!n.geometry.attributes.color&&!n.material.vertexColors){const src=n.material;if(!cache.has(src)){const m=new THREE.MeshBasicMaterial({name:'Original painted atlas',map:src.map,color:src.color,side:src.side});cache.set(src,m);owned.add(m);}n.material=cache.get(src);}n.userData.reviewPart=true;});
  root.updateMatrixWorld(true);let triangles=0,meshes=0;root.traverseVisible(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
  const prop=base.parts.PropellerAssembly,q=prop.quaternion.clone(),rotors=[];root.traverse(n=>{if(n.userData.viewerMotion==='rotorX')rotors.push({n,q:n.quaternion.clone()});});return{root,parts:base.parts,counts:{triangles,meshes,sourceTriangles:11026},update(t=0){prop.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),t*Math.PI*6));for(const r of rotors)r.n.quaternion.copy(r.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),t*Math.PI*6));},dispose(){root.removeFromParent();base.dispose();}};
 }
 return{create,dispose(){library.dispose();owned.forEach(o=>o.dispose());}};
}
