import * as T from 'three';
import {createLibrary as previous} from '../artillery-rich-v5/models.js';
import {TYPES} from './catalog.js';
export {TYPES};
const V=a=>new T.Vector3(...a);
export function createLibrary(gltf){const lib=previous(gltf),owned=new Set();
 function create(id){const base=lib.create(id),meta=TYPES.find(t=>t.id===id);if(meta.branch!=='mobility')return base;const root=base.root,r=meta.rank,L=Math.pow(1.6,r-1);
  // Grand-v3 emits its mobility fittings after this named shared mast. Keep the
  // hull, inhabited galleries and envelopes; replace only that final equipment block.
  const start=root.children.findIndex(n=>n.name==='Coral pennant signal mast');if(start<0)throw Error('Missing frozen mobility equipment boundary');for(const n of root.children.slice(start+1))n.visible=false;
  const kit=new T.Group();kit.name='Mobility mechanical refit';root.add(kit);const maps={};root.traverse(n=>{if(n.isMesh&&n.material.map){const s=n.material.name||'';if(s==='Grand hand-painted wood')maps.wood=n.material.map;if(s==='Grand hand-painted cream')maps.cloth=n.material.map;if(s==='Grand hand-painted brass')maps.metal=n.material.map;}});
  const mats={};for(const[k,c]of Object.entries({wood:0xb58246,darkWood:0x76523c,teal:0x397e83,dark:0x2b505b,cream:0xf5e5c4,brass:0xdfb65c,coral:0xd77d61})){const m=new T.MeshBasicMaterial({name:'Windrunner crafted '+k,color:c,map:maps[k.toLowerCase().includes('wood')?'wood':['cream','coral'].includes(k)?'cloth':'metal'],vertexColors:true,side:T.DoubleSide});mats[k]=m;owned.add(m);}
  function group(name,p=[0,0,0],parent=kit){const o=new T.Group();o.name=name;o.position.fromArray(p);parent.add(o);return o;}
  function mesh(geo,k,p=[0,0,0],s=[1,1,1],parent=kit){geo.computeVertexNormals();const n=geo.attributes.normal,a=geo.attributes.position,c=[];for(let i=0;i<a.count;i++){const q=n.getY(i)*.7-n.getX(i)*.2-n.getZ(i)*.3,v=T.MathUtils.clamp((q>.4?.99:q>-.2?.87:.72)+Math.sin(a.getX(i)*93+a.getY(i)*37)*.012,0,1);c.push(v,v*.99,v*.96);}geo.setAttribute('color',new T.Float32BufferAttribute(c,3));owned.add(geo);const o=new T.Mesh(geo,mats[k]);o.position.fromArray(p);o.scale.fromArray(s);parent.add(o);return o;}
  const box=(p,s,k='wood',parent=kit)=>mesh(new T.BoxGeometry(),k,p,s,parent),orb=(p,s,k='brass',parent=kit)=>mesh(new T.SphereGeometry(1,16,10),k,p,s,parent);
  function rod(a,b,rad,k='brass',parent=kit){const d=V(b).sub(V(a)),o=mesh(new T.CylinderGeometry(rad,rad,d.length(),10),k,V(a).add(V(b)).multiplyScalar(.5).toArray(),[1,1,1],parent);o.quaternion.setFromUnitVectors(V([0,1,0]),d.normalize());return o;}
  function line(ps,rad,k='brass',parent=kit){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(ps.map(V)),24,rad,7,false),k,[0,0,0],[1,1,1],parent);}
  function ring(p,rad,k='brass',axis='x',parent=kit,tube=rad*.07){const o=mesh(new T.TorusGeometry(rad,tube,7,32),k,p,[1,1,1],parent);o.rotation.set(axis==='y'?Math.PI/2:0,axis==='x'?Math.PI/2:0,0);return o;}
  function hinge(p,size,parent=kit){const g=group('Exposed wing incidence gearbox',p,parent);orb([0,0,0],[size*.8,size*.75,size*.45],'teal',g);ring([0,0,-size*.48],size,'brass','z',g);for(let i=0;i<10;i++){const a=i*Math.PI/5,o=box([Math.cos(a)*size,Math.sin(a)*size,-size*.48],[size*.20,size*.20,size*.16],'brass',g);o.rotation.z=a;}orb([0,0,-size*.52],[size*.28,size*.28,size*.15],'dark',g);return g;}
  function foil(p,len,span,s,k,bank,parent=kit){const g=group('Individually hinged cambered wing',p,parent);g.rotation.x=bank;g.rotation.y=s*.10;
   const point=(u,v)=>[(u-.5)*len*(1-v*.58)+v*len*.32,Math.sin(Math.PI*u)*span*.10+Math.sin(Math.PI*v)*span*.05,s*v*span],pos=[],uv=[],ix=[];
   for(let j=0;j<=8;j++)for(let i=0;i<=18;i++){pos.push(...point(i/18,j/8));uv.push(i/18,j/8);}for(let j=0;j<8;j++)for(let i=0;i<18;i++){const n=j*19+i;ix.push(n,n+19,n+1,n+1,n+19,n+20);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(ix);mesh(geo,k,[0,0,0],[1,1,1],g);
   for(const u of[0,1])line(Array.from({length:12},(_,i)=>point(u,i/11)),L*.006,'darkWood',g);for(const v of[.18,.43,.70,1])line(Array.from({length:12},(_,i)=>point(i/11,v)),L*.003,v===1?'coral':'brass',g);rod(point(.5,0),point(.5,1),L*.008,'wood',g);hinge([0,0,0],L*.027,g);return g;
  }
  function prop(p,rad,parent=kit){const g=group('Windrunner rotor',p,parent);g.userData.viewerMotion='rotorX';for(let i=0;i<4;i++){const a=i*Math.PI/2,o=orb([0,Math.cos(a)*rad*.53,Math.sin(a)*rad*.53],[rad*.07,rad*.48,rad*.14],'teal',g);o.rotation.x=a;}orb([0,0,0],[rad*.22,rad*.19,rad*.19],'brass',g);return g;}
  function engine(p,rad,tilt,parent=kit){const g=group('Gimballed ducted propulsion nacelle',p,parent);g.rotation.z=tilt;orb([0,0,0],[rad*1.05,rad*.62,rad*.62],'teal',g);for(const x of[-rad*.62,rad*.50])ring([x,0,0],rad*.63,'brass','x',g);const rim=rad*1.13;ring([rad*.95,0,0],rim,'dark','x',g,rad*.12);ring([rad*1.02,0,0],rim,'brass','x',g,rad*.035);for(const s of[-1,1])rod([rad*.05,0,s*rad*.45],[rad*.95,0,s*rim],rad*.07,'wood',g);prop([rad*.98,0,0],rad*.98,g);for(let i=0;i<4;i++)box([-rad*.15+i*rad*.22,rad*.55,-rad*.1],[rad*.08,rad*.18,rad*.24],'brass',g);return g;}
  function fin(p,len,height,s,parent=kit){const g=group('Swept steering rudder',p,parent),shape=new T.Shape();shape.moveTo(-len*.5,0);shape.lineTo(len*.08,height);shape.lineTo(len*.54,height*.68);shape.lineTo(len*.38,0);shape.closePath();mesh(new T.ExtrudeGeometry(shape,{depth:L*.009,bevelEnabled:false}),'teal',[0,0,-L*.0045],[1,1,1],g);line([[-len*.5,0,s*L*.008],[len*.08,height,s*L*.008],[len*.54,height*.68,s*L*.008]],L*.005,'brass',g);rod([len*.20,L*.015,s*L*.014],[len*.20,height*.70,s*L*.014],L*.005,'coral',g);return g;}
  for(const s of[-1,1]){
   const hub=[-L*.04,L*.015,s*L*.125];hinge(hub,L*.045);line([[-L*.25,-L*.045,s*L*.10],hub,[L*.27,-L*.025,s*L*.14]],L*.018,'wood');
   const count=r-1;for(let j=0;j<count;j++){
    const x=L*(-.24+j*.15),y=L*(.01+(r>=4?j*.028:0)),z=s*L*(.14+(r===5&&j>1?.045:0));
    const span=L*(r===2?.27:r===3?.31:r===4?.34:.38)*(1-j*.085),len=L*(r===2?.52:r===5?.37:.41),bank=s*(r===2?.04:r===3?(j===0?-.10:.25):j*.15-.08);
    const wing=foil([x,y,z],len,span,s,j%2?'teal':'cream',bank);rod(hub,[x,y,z],L*.012,'brass');rod([x+L*.08,-L*.045,s*L*.10],[x,y,z],L*.011,'darkWood');
    if(r>=3){const joint=[x+L*.05,y+L*.03,s*L*.23];rod([x-L*.06,L*.005,s*L*.11],joint,L*.011,'teal');rod(joint,[x+L*.10,y+L*.06,s*L*.28],L*.005,'brass');}
   }
  }
  if(r===2){rod([L*.28,-L*.025,0],[L*.48,L*.035,0],L*.035,'wood');engine([L*.43,L*.035,0],L*.095,0);fin([L*.41,L*.08,0],L*.27,L*.16,1);}
  if(r===3){for(const s of[-1,1]){const p=[L*.32,L*.025,s*L*.23];rod([L*.23,-L*.035,s*L*.08],p,L*.027,'wood');hinge(p,L*.035);engine(p,L*.082,s*.12);fin([L*.43,L*.04,s*L*.16],L*.23,L*.14,s);}}
  if(r>=4){for(const s of[-1,1]){const p=[L*.35,L*.03,s*L*.27];rod([L*.22,-L*.045,s*L*.10],p,L*.030,'wood');hinge(p,L*.042);engine(p,L*(r===5?.115:.098),s*.06);fin([L*.43,L*.065,s*L*.24],L*.29,L*.18,s);
    // Visible drive shafts and changing control surfaces replace the old repeated props.
    rod([L*.06,-L*.015,s*L*.14],[L*.35,L*.03,s*L*.27],L*.012,'brass');for(let j=0;j<3;j++)ring([L*(.14+j*.055),L*.018,s*L*(.18+j*.025)],L*.022,'brass','x');
    if(r===5){const q=[L*.12,L*.10,s*L*.36];rod([L*.15,0,s*L*.12],q,L*.021,'wood');engine(q,L*.065,-s*.17);foil([L*.40,L*.035,s*L*.13],L*.24,L*.17,s,'coral',s*.26);}
   }}
  const bow=group('Wind reader and steering station',[-L*.37,L*.025,0]);box([0,0,0],[L*.16,L*.025,L*.19],'wood',bow);ring([L*.015,L*.095,0],L*.048,'brass','z',bow);rod([L*.015,0,0],[L*.015,L*.095,0],L*.006,'darkWood',bow);for(const s of[-1,1]){line([[-L*.07,0,s*L*.08],[-L*.05,L*.06,s*L*.08],[L*.07,L*.06,s*L*.08]],L*.004,'brass',bow);}
  if(r>=4){const mast=group('Wind sensing vane',[L*.46,L*.10,0]);rod([0,-L*.12,0],[0,L*.22,0],L*.004,'brass',mast);for(let j=0;j<r-2;j++){const y=L*(.04+j*.055);ring([0,y,0],L*.03,'brass','x',mast);rod([0,y,0],[L*.10,y+L*.025,0],L*.004,'teal',mast);box([L*.11,y+L*.025,0],[L*.065,L*.025,L*.006],'coral',mast);}}
  root.updateMatrixWorld(true);let triangles=0,meshes=0;root.traverseVisible(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});const rotors=[];kit.traverse(n=>{if(n.userData.viewerMotion==='rotorX')rotors.push({n,q:n.quaternion.clone()});});
  return{...base,counts:{triangles,meshes,sourceTriangles:11026},update(t=0){base.update(t);for(const {n,q}of rotors)n.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(V([1,0,0]),t*Math.PI*6));}};
 }
 return{create,createOriginal:()=>lib.createOriginal(),dispose(){lib.dispose();owned.forEach(x=>x.dispose());}};
}
