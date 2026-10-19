import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createVariantLibrary as createOriginalLibrary} from '../variants.js';
import {LEVELS,levelFor} from './catalog.js';

const V=a=>new THREE.Vector3(...a),TAU=Math.PI*2;
// Sculpted additions use source units, +Y up and -X forward. No whole-ship scaling.
export function createVariantLibrary(gltf){
 const original=createOriginalLibrary(gltf),modules=[],geometries=new Set(),textures=[],compiled=new Map();
 function grain(kind){const n=96,a=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const wave=kind==='wood'?Math.sin(y*.65+Math.sin(x*.08))*12:kind==='cloth'?((x%5===0||y%5===0)?-12:2):Math.sin(y*.6+x*.07)*6;const c=Math.round(THREE.MathUtils.clamp(240+wave+Math.sin(x*7+y*13)*5,207,255)),i=(y*n+x)*4;a[i]=a[i+1]=a[i+2]=c;a[i+3]=255;}const t=new THREE.DataTexture(a,n,n);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;textures.push(t);return t;}
 const tex={wood:grain('wood'),cloth:grain('cloth'),metal:grain('metal')};
 const colors={wood:0xbd823f,lightWood:0xdfb475,darkWood:0x765039,teal:0x397d7c,darkTeal:0x29575a,cream:0xf8e6c6,coral:0xc96b50,brass:0xd2a451,rope:0x967347,glass:0xf6ce78,leaf:0x789071};
 const materials=Object.fromEntries(Object.entries(colors).map(([name,color])=>[name,new THREE.MeshStandardMaterial({name:'Painted '+name,color,roughness:1,metalness:0,flatShading:!['cream','glass'].includes(name),map:tex[/wood/i.test(name)?'wood':['cream','coral','rope'].includes(name)?'cloth':'metal']})]));
 const primitives={box:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,18,10),cylinder:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,16),torus:new THREE.TorusGeometry(1,.065,6,36)};
 Object.values(primitives).forEach(g=>geometries.add(g));
 function group(p,name,at=[0,0,0]){const g=new THREE.Group();g.name=name;g.position.fromArray(at);p.add(g);return g;}
 function mesh(p,g,m,at=[0,0,0],scale=[1,1,1],rot=[0,0,0]){geometries.add(g);const o=new THREE.Mesh(g,materials[m]);o.position.fromArray(at);o.scale.fromArray(scale);o.rotation.fromArray(rot);p.add(o);return o;}
 const box=(p,at,size,m='wood',rot)=>mesh(p,primitives.box,m,at,size,rot);
 const orb=(p,at,size,m='cream')=>mesh(p,primitives.sphere,m,at,size);
 function rod(p,a,b,r=.008,m='brass'){const d=V(b).sub(V(a)),o=mesh(p,primitives.cylinder,m,V(a).add(V(b)).multiplyScalar(.5).toArray(),[r,d.length(),r]);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
 function ring(p,at,r,m='brass',axis='x'){return mesh(p,primitives.torus,m,at,[r,r,r],axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0]);}
 function curve(p,points,r=.006,m='brass'){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)),24,r,5,false);geometries.add(g);return mesh(p,g,m);}
 function flag(p,at,size=.14){const mast=group(p,'Stitched pennant',at);rod(mast,[0,0,0],[0,size*1.6,0],.0035,'brass');const shape=new THREE.Shape();shape.moveTo(0,size*1.55);shape.lineTo(-size,size*1.15);shape.lineTo(-size*.66,size*.9);shape.lineTo(0,size*.85);shape.closePath();const g=new THREE.ShapeGeometry(shape);g.computeVertexNormals();geometries.add(g);const o=mesh(mast,g,'coral');o.material=materials.coral;o.material.side=THREE.DoubleSide;return mast;}
 function lamp(p,at,s=1){const g=group(p,'Warm navigation lamp',at);rod(g,[0,0,0],[0,.045*s,0],.004*s);orb(g,[0,.055*s,0],[.017*s,.023*s,.017*s],'glass');mesh(g,primitives.cone,'teal',[0,.08*s,0],[.026*s,.018*s,.026*s]);}
 function rail(p,l,w,y=0){for(const s of[-1,1]){const points=[];for(let i=0;i<6;i++){const x=(i/5-.5)*l,z=s*w*.46;rod(p,[x,y,z],[x,y+.06,z],.004,'darkWood');points.push([x,y+.06,z]);}curve(p,points,.0045,'brass');}}
 function deck(p,at,l,w,{rails=true}={}){const g=group(p,'Curved wooden deck',at);const shape=new THREE.Shape();shape.moveTo(-l*.54,0);shape.bezierCurveTo(-l*.43,-w*.53,l*.34,-w*.54,l*.5,-w*.28);shape.quadraticCurveTo(l*.59,0,l*.5,w*.28);shape.bezierCurveTo(l*.34,w*.54,-l*.43,w*.53,-l*.54,0);const geo=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.006,bevelThickness:.005,bevelSegments:1,curveSegments:8});geo.rotateX(-Math.PI/2);geometries.add(geo);mesh(g,geo,'wood');for(let i=0;i<9;i++)box(g,[(i/8-.5)*l*.83,.03,0],[.004,.002,w*.75],'darkWood');curve(g,[[-l*.53,.028,0],[-l*.35,.028,-w*.43],[l*.37,.028,-w*.39],[l*.54,.028,0],[l*.37,.028,w*.39],[-l*.35,.028,w*.43],[-l*.53,.028,0]],.007,'brass');if(rails)rail(g,l*.82,w*.91,.029);return g;}
 function hull(p,at,l,w,d){const g=group(p,'Honeywood auxiliary hull',at);orb(g,[0,-d*.4,0],[l*.52,d*.65,w*.48],'wood');deck(g,[0,0,0],l,w);for(const side of[-1,1])curve(g,[[-l*.46,-d*.15,side*w*.11],[-l*.28,-d*.63,side*w*.38],[l*.25,-d*.6,side*w*.38],[l*.46,-d*.18,side*w*.18]],.009,'darkTeal');for(let i=0;i<5;i++){const x=(i/4-.5)*l*.72;for(const side of[-1,1])rod(g,[x,0,side*w*.42],[x,-d*.75,side*w*.26],.006,'brass');}return g;}
 function balloon(p,at,l,r){const g=group(p,'Stitched cream lift envelope',at);orb(g,[0,0,0],[l*.52,r,r*.9]);for(const x of[-.28,0,.28]){const ringRadius=r*Math.sqrt(1-(x/.52)**2);const o=ring(g,[x*l,0,0],ringRadius,'darkWood');o.scale.z*=.9;}for(const side of[-1,1])curve(g,Array.from({length:13},(_,i)=>{const a=(i/12)*Math.PI;return[(i/12-.5)*l,Math.sin(a)*r*.52,side*Math.sin(a)*r*.8];}),.0023,'rope');const patch=orb(g,[-l*.22,r*.45,-r*.77],[l*.065,r*.25,.006],'coral');patch.rotation.z=.3;for(const x of[-.28,.28])rod(g,[x*l,-r*.75,0],[x*l,-r-.14,0],.008,'brass');return g;}
 function rotor(p,at,r=.09){const g=group(p,'Turning propeller',at);g.userData.spin=true;ring(g,[0,0,0],r,'brass');for(let i=0;i<5;i++){const a=i*TAU/5;const blade=orb(g,[0,Math.sin(a)*r*.57,Math.cos(a)*r*.57],[r*.09,r*.2,r*.49],'teal');blade.rotation.x=-a;rod(g,[0,0,0],[0,Math.sin(a)*r*.8,Math.cos(a)*r*.8],r*.035,'brass');}orb(g,[.01,0,0],[r*.18,r*.18,r*.18],'brass');return g;}
 function engine(p,at,s=1){const g=group(p,'Outboard painted engine',at);orb(g,[0,0,0],[.09*s,.053*s,.053*s],'teal');for(const x of[-.055,.04])ring(g,[x*s,0,0],.054*s);for(const t of[-.022,0,.022])ring(g,[t*s,0,0],.052*s,'darkTeal');rod(g,[-.04*s,.03*s,0],[-.04*s,.1*s,0],.012*s,'darkWood');ring(g,[-.04*s,.103*s,0],.016*s,'brass','y');rotor(g,[.12*s,0,0],.105*s);return g;}
 function cabin(p,at,l=.3,w=.23,h=.22){const g=group(p,'Handmade sky cottage',at);box(g,[0,h*.42,0],[l,h*.84,w],'lightWood');for(const s of[-1,1]){box(g,[0,h*.82,s*w*.25],[l*1.16,.025,w*.63],'teal',[s*.46,0,0]);for(const x of[-.33,.33])rod(g,[x*l,.01,s*w*.51],[x*l,h*.84,s*w*.51],.009,'darkWood');const o=ring(g,[-l*.13,h*.45,s*w*.51],h*.16,'brass','z');orb(g,[-l*.13,h*.45,s*w*.515],[h*.12,h*.12,.005],'glass');}box(g,[-l*.26,h*.31,-w*.517],[l*.15,h*.55,.007],'darkTeal');rod(g,[l*.22,h*.8,w*.12],[l*.22,h*1.42,w*.12],.018,'darkWood');ring(g,[l*.22,h*1.44,w*.12],.023,'brass','y');const d=deck(g,[0,-.015,0],l*1.4,w*1.6);lamp(g,[-l*.38,.04,-w*.67],.85);return g;}
 function cloth(p,at,l,w,height=.1,m='coral'){const g=group(p,'Billowing sewn canopy',at);const vertices=[],uv=[],indices=[],nx=16,nz=8;for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const u=x/nx,v=z/nz;vertices.push((u-.5)*l,Math.sin(u*Math.PI)*height+Math.sin(v*Math.PI)*height*.5,(v-.5)*w);uv.push(u,v);}for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,b=a+nx+1;indices.push(a,b,a+1,b,b+1,a+1);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();geometries.add(geo);materials[m].side=THREE.DoubleSide;mesh(g,geo,m);for(const side of[-1,1])curve(g,Array.from({length:13},(_,i)=>{const u=i/12;return[(u-.5)*l,Math.sin(u*Math.PI)*height,side*w*.5];}),.006,'brass');for(const u of[.15,.5,.85])curve(g,Array.from({length:9},(_,i)=>{const v=i/8;return[(u-.5)*l,Math.sin(u*Math.PI)*height+Math.sin(v*Math.PI)*height*.5,(v-.5)*w];}),.003,'cream');return g;}
 function brace(p,at){for(const x of[-.2,.2])rod(p,[x,-.15,0],[at[0]+x*.6,at[1],at[2]],.01,'darkWood');}
 function add(level,fn){const g=new THREE.Group();g.name=`Lv${String(level).padStart(2,'0')}_${LEVELS[level-1].name}`;g.userData.unlockLevel=level;fn(g);g.updateMatrixWorld(true);modules.push(g);}
 add(2,p=>{curve(p,[[-.46,-.15,-.07],[-.5,-.16,0],[-.46,-.15,.07]],.014);for(const s of[-1,1]){box(p,[.28,-.04,s*.08],[.14,.012,.09],'coral',[0,0,-.2]);lamp(p,[-.34,-.08,s*.09],.7);}});
 add(3,p=>{deck(p,[-.05,-.13,-.22],.58,.23);brace(p,[-.05,-.13,-.22]);flag(p,[.12,-.08,-.29],.1);});
 add(4,p=>{deck(p,[-.05,-.13,.22],.58,.23);brace(p,[-.05,-.13,.22]);for(let i=0;i<3;i++)box(p,[i*.055-.04,-.075,.23],[.043,.045,.05],i%2?'coral':'lightWood');});
 add(5,p=>{for(const s of[-1,1]){engine(p,[.3,-.15,s*.29],.8);rod(p,[.17,-.13,s*.09],[.3,-.15,s*.29],.013,'darkWood');}});
 add(6,p=>{balloon(p,[0,.16,-.37],.76,.135);brace(p,[0,-.03,-.37]);});
 add(7,p=>{balloon(p,[0,.19,.37],.79,.14);brace(p,[0,0,.37]);});
 add(8,p=>{hull(p,[0,-.32,0],.73,.3,.12);for(const x of[-.25,.25])for(const s of[-1,1])rod(p,[x,-.15,s*.08],[x,-.31,s*.12],.008,'brass');});
 add(9,p=>{deck(p,[-.49,-.12,0],.36,.43);for(const s of[-1,1]){rod(p,[-.6,-.12,s*.16],[-.28,-.26,s*.06],.013,'darkWood');lamp(p,[-.58,-.065,s*.15]);}});
 add(10,p=>{cabin(p,[.46,-.06,.015],.28,.23,.23);rod(p,[.34,-.1,-.1],[.5,-.2,-.1],.018,'darkWood');flag(p,[.54,.23,0],.12);});
 add(11,p=>{deck(p,[.03,-.18,0],1.0,1.13);for(const s of[-1,1])curve(p,[[-.38,-.2,s*.46],[0,-.33,s*.39],[.39,-.21,s*.46]],.018,'darkWood');});
 add(12,p=>{for(const s of[-1,1]){engine(p,[.31,-.18,s*.57],1.15);rod(p,[.1,-.17,s*.26],[.31,-.18,s*.57],.018,'brass');}});
 add(13,p=>{cabin(p,[.15,.12,-.43],.31,.24,.24);brace(p,[.15,.12,-.43]);});
 add(14,p=>{cabin(p,[-.12,.03,.44],.34,.25,.22);cloth(p,[-.15,.16,.6],.38,.18,.065,'cream');brace(p,[-.12,.03,.44]);});
 add(15,p=>{cloth(p,[-.12,.43,0],.62,1.17,.17);for(const s of[-1,1])for(const x of[-.38,.15])rod(p,[x,-.13,s*.42],[x,.43,s*.55],.009,'brass');});
 add(16,p=>{for(const s of[-1,1]){hull(p,[0,-.35,s*.62],1.08,.29,.16);rod(p,[-.28,-.19,s*.35],[-.28,-.35,s*.62],.014,'darkWood');rod(p,[.3,-.19,s*.35],[.3,-.35,s*.62],.014,'darkWood');}});
 add(17,p=>{balloon(p,[.08,.53,-.65],1.17,.205);brace(p,[.08,.16,-.65]);});
 add(18,p=>{balloon(p,[.08,.59,.65],1.2,.215);brace(p,[.08,.2,.65]);});
 add(19,p=>{rotor(p,[.79,-.015,0],.24);ring(p,[.76,-.015,0],.266);for(const s of[-1,1])rod(p,[.45,-.12,s*.12],[.75,-.015,s*.12],.018,'brass');});
 add(20,p=>{cabin(p,[.46,.29,.01],.4,.31,.27);deck(p,[.46,.28,0],.45,1.38);for(const s of[-1,1])rod(p,[.3,-.09,s*.3],[.46,.27,s*.6],.015,'darkWood');});
 add(21,p=>{deck(p,[-.86,-.1,0],.5,.54);curve(p,[[-.48,-.2,-.1],[-.8,-.28,-.14],[-1.1,-.08,0],[-.8,-.28,.14],[-.48,-.2,.1]],.02,'brass');flag(p,[-1.05,-.02,0],.22);});
 add(22,p=>{const g=cloth(p,[-.15,.2,-.96],.92,.48,.18,'cream');g.rotation.x=-.28;brace(p,[-.15,.17,-.96]);flag(p,[.13,.28,-1.03],.16);});
 add(23,p=>{const g=cloth(p,[-.15,.25,.97],1.05,.51,.2,'coral');g.rotation.x=.24;brace(p,[-.15,.2,.97]);flag(p,[.15,.32,1.06],.14);});
 add(24,p=>{const g=group(p,'Sky route lighthouse',[.77,.25,.16]);mesh(g,primitives.cylinder,'lightWood',[0,.26,0],[.085,.52,.085]);for(const h of[.02,.2,.4])ring(g,[0,h,0],.094,'brass','y');orb(g,[0,.55,0],[.105,.12,.105],'glass');mesh(g,primitives.cone,'teal',[0,.72,0],[.15,.2,.15]);for(const s of[-1,1])rod(p,[.43,.15,s*.1],[.77,.26,.16+s*.06],.016,'darkWood');});
 add(25,p=>{hull(p,[.14,-.56,0],1.47,.69,.21);for(const s of[-1,1])for(const x of[-.4,.4])rod(p,[x,-.27,s*.14],[x,-.55,s*.26],.018,'brass');lamp(p,[-.43,-.48,-.21],1.4);});
 add(26,p=>{balloon(p,[.02,1.02,0],1.57,.285);for(const s of[-1,1])for(const x of[-.37,.37])rod(p,[x,.3,s*.4],[x,.87,s*.09],.012,'brass');});
 add(27,p=>{const g=deck(p,[.0,.61,-.36],.91,.31);g.rotation.y=-.16;for(const x of[-.3,.3])rod(p,[x,.27,-.35],[x,.59,-.36],.014,'darkWood');for(let i=0;i<6;i++)box(p,[-.3+i*.033,.21+i*.065,-.53],[.075,.018,.16],'wood');flag(p,[-.32,.65,-.46],.2);});
 add(28,p=>{deck(p,[-.1,.49,.43],.82,.43);cloth(p,[-.1,.72,.49],.66,.36,.14,'teal');for(const x of[-.36,.17])rod(p,[x,.5,.39],[x,.72,.39],.008,'brass');for(let i=0;i<4;i++){mesh(p,primitives.cone,'coral',[-.32+i*.15,.55,.55],[.035,.07,.035],[0,0,Math.PI]);orb(p,[-.32+i*.15,.62,.55],[.045,.065,.04],'leaf');}lamp(p,[-.4,.55,.32],1.1);});
 add(29,p=>{rotor(p,[.79,.67,-.46],.27);ring(p,[.77,.67,-.46],.3);rod(p,[.45,.26,-.38],[.78,.65,-.46],.024,'darkWood');for(const s of[-1,1])flag(p,[.56,.39,s*.64],.24);});
 add(30,p=>{for(const s of[-1,1]){const g=cloth(p,[-.57,.56,s*.31],.6,.25,.18,'cream');g.rotation.z=.16;curve(p,[[-.9,-.08,s*.18],[-.78,.2,s*.28],[-.48,.57,s*.33],[-.24,.62,s*.31]],.015,'brass');flag(p,[-.66,.58,s*.35],.26);for(let i=0;i<4;i++)box(p,[-.4+i*.19,-.47,s*.3],[.15,.07,.018],i%2?'brass':'teal');}ring(p,[-.92,-.01,0],.1,'brass','z');lamp(p,[-.93,.05,0],1.5);});

 function bakeGroups(groups){const buckets=new Map(),spinners=[];
  for(const module of groups){
   module.updateMatrixWorld(true);module.traverse(n=>{if(n.userData.spin){const c=n.clone(true);n.matrixWorld.decompose(c.position,c.quaternion,c.scale);spinners.push(c);}
    if(!n.isMesh)return;for(let p=n.parent;p;p=p.parent)if(p.userData.spin)return;
    const geo=n.geometry.clone().applyMatrix4(n.matrixWorld);geo.deleteAttribute('tangent');if(!geo.index){const ind=Array.from({length:geo.attributes.position.count},(_,i)=>i);geo.setIndex(ind);}if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));const key=n.material.uuid;if(!buckets.has(key))buckets.set(key,{material:n.material,geometries:[]});buckets.get(key).geometries.push(geo);
   });
  }
  const root=new THREE.Group();root.name='Merged authored evolution modules';for(const b of buckets.values()){const geo=mergeGeometries(b.geometries,false);b.geometries.forEach(g=>g.dispose());if(!geo)throw Error('Evolution merge failed');geo.computeBoundingBox();geometries.add(geo);const o=new THREE.Mesh(geo,b.material);o.name='Evolution surface '+b.material.name;root.add(o);}for(const s of spinners)root.add(s);
  return root;
 }
 function compile(level){if(compiled.has(level))return compiled.get(level);const root=bakeGroups(modules.filter(g=>g.userData.unlockLevel<=level));compiled.set(level,root);return root;}
 function create(category,stage=0){if(category==='normal')return original.create('normal',0);if(category==='legacy')return original.create('growth',8);
  const level=levelFor(category,stage);if(!Number.isInteger(level)||level<1||level>30)throw Error('Level1..30 required');const base=original.create('normal',0),extra=compile(level).clone(true);base.root.add(extra);base.root.name='Cloudstitch_Evolution_Lv'+String(level).padStart(2,'0');base.root.userData={...base.root.userData,category,stage,level,modules:LEVELS.filter(v=>v.level>1&&v.level<=level).map(v=>v.id),sourceGeometryPreserved:true};
  const spins=[];extra.traverse(n=>{if(n.userData.spin)spins.push({node:n,quaternion:n.quaternion.clone()});});let triangles=0,meshCount=0;base.root.traverse(n=>{if(n.isMesh){meshCount++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
  return{root:base.root,parts:base.parts,level,counts:{sourceTriangles:11026,triangles,meshes:meshCount,unlockedModules:level-1},update(t=0){base.update(t);const phase=TAU*((t%6+6)%6)/6;for(const s of spins){s.node.quaternion.copy(s.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-phase*12));}},dispose(){extra.removeFromParent();base.dispose();}};
 }
 return{create,sourceTriangles:11026,author:{group,mesh,box,orb,rod,ring,curve,deck,hull,balloon,rotor,engine,cabin,cloth,brace,flag,lamp,materials,bake:bakeGroups},dispose(){original.dispose();geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());Object.values(materials).forEach(m=>m.dispose());}};
}
