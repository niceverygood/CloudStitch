import * as THREE from 'three';
import {createVariantLibrary} from '../variants.js';
export const TYPES=[{id:'mobility',name:'기동 · 바람길잡이',kit:'가변 안정돛 · 쌍 틸트 추진',file:'star3-mobility.glb'},{id:'artillery',name:'포격 · 철갑형',kit:'삼실 회전 약실 · 통합 급탄 포대',file:'star3-artillery.glb'},{id:'salvage',name:'인양 · 구름 예인선',kit:'접이식 크레인 · 인양 슬링',file:'star3-salvage.glb'}];
const colors={wood:0xc28b46,darkWood:0x72503a,teal:0x41837f,darkTeal:0x2e5557,cream:0xf7e7c7,brass:0xd4ae61,coral:0xc87056,rope:0xb79a67,black:0x263d3d};
const V=a=>new THREE.Vector3(...a);
export function createLibrary(gltf){
 const library=createVariantLibrary(gltf),owned=new Set(),paintMaps=new Map();
 function paintedMap(kind){if(paintMaps.has(kind))return paintMaps.get(kind);const n=128,data=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const rough=Math.sin(x*1.9+y*2.7)*Math.sin(x*.37-y*.71)*5;const brush=kind==='wood'?Math.sin(y*.45+Math.sin(x*.044)*2.1)*15+Math.sin(y*1.55+x*.019)*5:kind==='cloth'?((x%8<1||y%8<1)?-17:1)+Math.sin(x*.055+y*.045)*7:Math.sin(y*.18+Math.sin(x*.03))*9+Math.sin(x*.12)*4;const c=Math.round(THREE.MathUtils.clamp(238+brush+rough,195,255)),i=(y*n+x)*4;data[i]=c;data[i+1]=c;data[i+2]=c;data[i+3]=255;}const t=new THREE.DataTexture(data,n,n);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=t.minFilter=THREE.LinearFilter;t.name='Hand painted '+kind+' grain';t.needsUpdate=true;paintMaps.set(kind,t);owned.add(t);return t;}
 function create(type='original'){
  if(type!=='original'&&!TYPES.some(t=>t.id===type))throw Error('Unknown type');
  const base=library.create('normal',0),root=base.root;root.name='Cloudstitch_Star3_'+type;root.userData={star:type==='original'?1:3,lineage:type,visualAsset:true,forward:'-X',up:'+Y',units:'source units; not certified metres'};
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
   base.parts.TurretAssembly.visible=false;base.parts.PropellerAssembly.visible=false;base.parts.EngineHousing.visible=false;
   // A crescent membrane with swept wooden tips. Each surface is curved in3D,
   // thick at its rim, stitched and supported by a visible three-rib frame.
   for(const side of[-1,1]){
    const bracket=group(side<0?'Port sail swivel':'Starboard sail swivel',[-.17,-.09,side*.14]);
    ring([0,0,0],.039,'teal','x',bracket,.009);ring([0,0,0],.027,'brass','x',bracket,.005);rod([0,0,0],[.06,.075,side*.075],.014,'darkWood',bracket);rod([.06,.075,side*.075],[.06,.01,side*.13],.009,'brass',bracket);
    const g=group(side<0?'Port variable sail':'Starboard variable sail',[-.17,-.04,side*.23]);g.rotation.x=-side*(side<0?.46:.18);g.userData.reviewHinge='Fixed exported flight pose; viewer node may be posed';
    const nx=20,ny=10,pos=[],uv=[],ind=[];
    function point(u,v){const x=-.36+.69*u,reach=Math.sin(Math.PI*u)*(.31-.13*u);return[x,.065+reach*.23+Math.sin(v*Math.PI)*.035,side*(.025+reach*v+.075*u)];}
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/ny;pos.push(...point(u,v));uv.push(u,v);}
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*(nx+1)+i;ind.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ind);geo.computeVertexNormals();mesh(geo,'cream',[0,0,0],[1,1,1],g,'Stitched curved sail membrane');
    curve(Array.from({length:21},(_,i)=>point(i/20,1)),.012,'teal',g);curve(Array.from({length:21},(_,i)=>point(i/20,0)),.008,'darkWood',g);
    for(const u of[.2,.46,.72]){curve(Array.from({length:9},(_,i)=>point(u,i/8)),.0045,'brass',g);for(let j=1;j<7;j++){const q=point(u,j/8);rod([q[0]-.006,q[1]+.002,q[2]],[q[0]+.006,q[1]+.002,q[2]],.0015,'darkWood',g);}}
    rod([-.14,-.01,0],[-.12,.09,side*.14],.012,'brass',g);ring([-.14,0,0],.023,'brass','z',g);orb([-.14,0,side*.012],[.008,.008,.006],'teal',g);
   }
   curve([[-.42,-.14,0],[-.54,-.13,0],[-.61,-.02,0],[-.58,.015,0],[-.55,-.005,0]],.022,'wood');curve([[-.42,-.121,-.009],[-.54,-.11,-.009],[-.59,-.01,-.009]],.004,'brass');
   for(const s of[-1,1])curve([[-.45,-.14,s*.016],[-.55,-.115,s*.018],[-.599,-.02,s*.018],[-.577,.003,s*.016]],.0025,'darkWood');
   for(const s of[-1,1])rod([.30,-.13,s*.06],[.48,-.15,s*.12],.012,'teal');
   for(const s of[-1,1]){const arm=group(s<0?'Port tilt drive':'Starboard tilt drive',[.29,-.11,s*.22]);rod([-.10,0,-s*.14],[.04,.015,0],.024,'wood',arm);ring([.025,0,0],.041,'brass','z',arm,.006);const pivot=group('Tilting propulsion cradle',[.06,0,0],arm);pivot.rotation.z=s<0?-.22:.14;orb([0,0,0],[.11,.054,.054],'teal',pivot);for(const x of[-.075,.035])ring([x,0,0],.055,'brass','x',pivot,.006);curve([[.04,-.03,-.055],[.12,-.07,0],[.04,-.03,.055]],.009,'darkWood',pivot);propeller([.115,0,0],.13,pivot);}
   const mast=group('Coral wind pennant',[.28,.025,.075]);rod([0,0,0],[0,.17,0],.003,'brass',mast);plate([[0,.15],[.14,.14],[.10,.10],[.15,.085],[0,.11]],.001,'coral',[0,0,0],mast);
  }
  if(type==='artillery'){
   base.parts.TurretAssembly.visible=false;
   const kit=group('Revolving chamber gun platform',[-.31,-.093,0]);deck([-.06,-.035,0],.38,.31,kit);
   for(const s of[-1,1]){rod([-.19,-.055,s*.12],[.11,-.065,s*.09],.016,'brass',kit);curve([[-.19,-.02,s*.13],[-.10,.11,s*.14],[.08,.085,s*.12]],.012,'teal',kit);rivets([-.15,.02,s*.143],5,'x',kit);}
   mesh(new THREE.CylinderGeometry(.075,.09,.035,24),'darkTeal',[.0,-.005,0],[1,1,1],kit,'Turret azimuth bearing');ring([0,.018,0],.078,'brass','y',kit);
   const gun=group('Three chamber revolving breech',[-.005,.08,0],kit);gun.userData.reviewRole='Three-chamber concept, one active barrel; no firing rules';
   rod([.06,0,0],[-.10,0,0],.10,'teal',gun);for(const x of[-.105,.065])ring([x,0,0],.103,'brass','x',gun,.009);
   for(let i=0;i<3;i++){const a=i*Math.PI*2/3,y=Math.cos(a)*.054,z=Math.sin(a)*.054;rod([.075,y,z],[-.11,y,z],.036,'darkTeal',gun);ring([-.115,y,z],.035,'brass','x',gun,.006);const bore=mesh(new THREE.CylinderGeometry(.026,.026,.003,20),'black',[-.12,y,z],[1,1,1],gun,'Inset chamber '+i);bore.rotation.z=Math.PI/2;for(const x of[-.06,.03])ring([x,y,z],.036,'brass','x',gun,.003);}
   const active=group('Single active barrel',[-.11,.054,0],gun);rod([0,0,0],[-.19,0,0],.033,'teal',active);for(const x of[-.035,-.12,-.19])ring([x,0,0],.035,'brass','x',active,.005);const muzzle=mesh(new THREE.CylinderGeometry(.026,.026,.003,24),'black',[-.193,0,0],[1,1,1],active,'Active dark muzzle');muzzle.rotation.z=Math.PI/2;
   const loader=group('Rear ammunition carousel',[.13,.045,0],kit);rod([0,-.02,0],[0,.08,0],.055,'darkTeal',loader);ring([0,.08,0],.062,'brass','y',loader);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;rod([Math.cos(a)*.044,0,Math.sin(a)*.044],[Math.cos(a)*.044,.075,Math.sin(a)*.044],.012,'brass',loader);}
   for(const s of[-1,1]){rod([.04,.01,s*.07],[-.12,-.03,s*.10],.012,'darkWood',kit);box([.11,-.005,s*.06],[.065,.05,.055],'wood',kit);}
   for(const s of[-1,1]){const o=plate([[-.29,-.12],[-.20,-.23],[.14,-.23],[.24,-.12],[.13,-.085],[-.17,-.085]],.016,'teal',[0,0,s*.13]);if(s<0)o.scale.z=-1;curve([[-.29,-.12,s*.146],[-.20,-.23,s*.146],[.14,-.23,s*.146]],.008,'brass');for(let i=0;i<5;i++)orb([-.19+i*.07,-.17,s*.15],[.005,.005,.004],'brass');}
  }
  if(type==='salvage'){
   base.parts.TurretAssembly.visible=false;base.parts.WinchDrumMesh.visible=false;base.parts.HookAndChain.visible=false;
   deck([-.31,-.105,0],.38,.28);const yoke=group('Bow rope guide replacing fixed U cradle',[-.48,-.115,0]);
   box([0,0,0],[.12,.025,.22],'wood',yoke);for(const s of[-1,1]){rod([0,.02,s*.08],[0,.09,s*.08],.021,'teal',yoke);ring([0,.07,s*.08],.026,'brass','y',yoke);orb([0,.10,s*.08],[.025,.012,.025],'brass',yoke);}rod([0,.025,-.065],[0,.025,.065],.018,'brass',yoke);
   const winch=group('Large side cable reel',[.035,-.12,-.20]);const reel=mesh(new THREE.CylinderGeometry(.072,.072,.12,24),'darkWood',[0,0,0],[1,1,1],winch);reel.rotation.x=Math.PI/2;
   for(const z of[-.068,.068]){const rim=mesh(new THREE.CylinderGeometry(.092,.092,.015,24),'wood',[0,0,z],[1,1,1],winch);rim.rotation.x=Math.PI/2;ring([0,0,z-.01],.084,'brass','z',winch);}
   for(let i=0;i<12;i++)ring([0,0,-.055+i*.010],.074,'rope','z',winch,.004);rod([0,0,-.09],[0,0,.10],.013,'brass',winch);rod([0,0,-.10],[.06,.02,-.10],.007,'brass',winch);orb([.065,.02,-.10],[.014,.012,.015],'teal',winch);
   curve([[.035,-.19,-.20],[-.19,-.19,-.21],[-.4,-.14,-.17],[-.63,-.12,-.16]],.005,'rope');
   const crane=group('Folding salvage crane',[.14,-.10,-.23]);deck([0,-.015,0],.23,.19,crane);rod([0,0,0],[0,.055,0],.046,'teal',crane);ring([0,.055,0],.047,'brass','y',crane);
   const arm=group('Crane lower joint',[0,.06,0],crane);for(const s of[-1,1]){rod([0,0,s*.03],[.11,.18,-.12+s*.03],.017,'wood',arm);rod([.11,.18,-.12+s*.03],[.37,.25,-.18+s*.03],.014,'teal',arm);}for(const p of[[0,0,0],[.11,.18,-.12],[.37,.25,-.18]]){ring(p,.027,'brass','z',arm,.007);orb([p[0],p[1],p[2]-.012],[.009,.009,.008],'darkWood',arm);}
   rod([.04,.02,-.01],[.14,.16,-.12],.011,'darkTeal',arm);rod([.10,.10,-.08],[.14,.16,-.12],.006,'brass',arm);curve([[.00,.015,-.04],[.10,.20,-.15],[.37,.27,-.18]],.003,'rope',arm);
   rod([.37,.24,-.18],[.37,-.025,-.18],.004,'rope',arm);curve([[.37,-.025,-.18],[.36,-.055,-.18],[.38,-.07,-.18],[.405,-.045,-.18]],.008,'brass',arm);
   const sling=group('Four rope lifting sling',[.515,-.30,-.41]);for(const x of[-.09,.09])for(const s of[-1,1])rod([-.005,.195,0],[x,0,s*.075],.003,'rope',sling);deck([0,-.02,0],.24,.19,sling);for(const s of[-1,1])for(const x of[-.10,.10])rod([x,-.01,s*.08],[x,.065,s*.08],.004,'darkWood',sling);for(const s of[-1,1])rod([-.1,.065,s*.08],[.1,.065,s*.08],.004,'rope',sling);
   for(const s of[-1,1]){box([.12,-.07,s*.06],[.11,.06,.075],'wood');for(const x of[.08,.16])box([x,-.07,s*.061],[.007,.064,.080],'darkWood');}
  }
  // The borrowed original atlas stays intact. A lighting-independent copy of
  // its material is exported with KHR_materials_unlit; source files never change.
  const cache=new Map();root.traverse(n=>{if(!n.isMesh)return;if(!n.geometry.attributes.color&&!n.material.vertexColors){const src=n.material;if(!cache.has(src)){const m=new THREE.MeshBasicMaterial({name:'Original painted atlas',map:src.map,color:src.color,side:src.side});cache.set(src,m);owned.add(m);}n.material=cache.get(src);}n.userData.reviewPart=true;});
  root.updateMatrixWorld(true);let triangles=0,meshes=0;root.traverseVisible(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
  const prop=base.parts.PropellerAssembly,q=prop.quaternion.clone(),rotors=[];root.traverse(n=>{if(n.userData.viewerMotion==='rotorX')rotors.push({n,q:n.quaternion.clone()});});return{root,parts:base.parts,counts:{triangles,meshes,sourceTriangles:11026},update(t=0){prop.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),t*Math.PI*6));for(const r of rotors)r.n.quaternion.copy(r.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),t*Math.PI*6));},dispose(){root.removeFromParent();base.dispose();}};
 }
 return{create,dispose(){library.dispose();owned.forEach(o=>o.dispose());}};
}
