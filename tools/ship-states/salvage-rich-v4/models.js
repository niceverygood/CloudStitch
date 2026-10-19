import * as T from 'three';
import {createLibrary as grand} from '../ranks-grand-v3/models.js';
import {TYPES} from './catalog.js';
export {TYPES};
const V=a=>new T.Vector3(...a);
export function createLibrary(gltf){
 const source=grand(gltf),owned=new Set(),palette={};
 const cols={wood:0xb77a3e,teal:0x347b80,deep:0x28515a,brass:0xe1b960,coral:0xd67b60,cream:0xf7e5b8,rope:0x987343,light:0xffd280};
 for(const [k,c]of Object.entries(cols)){const m=new T.MeshBasicMaterial({color:c,vertexColors:true,side:T.DoubleSide,name:'Salvage crafted '+k});palette[k]=m;owned.add(m);}
 function create(id){const base=source.create(id),root=base.root,meta=TYPES.find(x=>x.id===id);if(meta.branch!=='salvage')return base;const r=meta.rank,L=Math.pow(1.6,r-1),theme=new T.Group();theme.name='Rich salvage apparatus';root.add(theme);
  function g(name,p=[0,0,0],parent=theme){const x=new T.Group();x.name=name;x.position.fromArray(p);parent.add(x);return x;}
  function mesh(geo,k,p=[0,0,0],s=[1,1,1],parent=theme){geo.computeVertexNormals();const n=geo.attributes.normal,a=geo.attributes.position,c=[];for(let i=0;i<a.count;i++){const d=T.MathUtils.clamp((n.getY(i)*.7-n.getX(i)*.2-n.getZ(i)*.3>.2?.98:.78)+Math.sin(a.getX(i)*73+a.getY(i)*39)*.015,0,1);c.push(d,d*.99,d*.96);}geo.setAttribute('color',new T.Float32BufferAttribute(c,3));owned.add(geo);const x=new T.Mesh(geo,palette[k]);x.position.fromArray(p);x.scale.fromArray(s);parent.add(x);return x;}
  const orb=(p,s,k='brass',parent=theme)=>mesh(new T.SphereGeometry(1,16,10),k,p,s,parent);
  const box=(p,s,k='wood',parent=theme)=>mesh(new T.BoxGeometry(),k,p,s,parent);
  function rod(a,b,rad,k='brass',parent=theme){const v=V(b).sub(V(a)),x=mesh(new T.CylinderGeometry(rad,rad,v.length(),10),k,V(a).add(V(b)).multiplyScalar(.5).toArray(),[1,1,1],parent);x.quaternion.setFromUnitVectors(V([0,1,0]),v.normalize());return x;}
  function curve(ps,rad,k='brass',parent=theme){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(ps.map(V)),28,rad,7,false),k,[0,0,0],[1,1,1],parent);}
  function ring(p,rad,k='brass',parent=theme,tube=rad*.09){return mesh(new T.TorusGeometry(rad,tube,7,28),k,p,[1,1,1],parent);}
  function gear(p,rad,parent=theme){const x=g('Brass exposed cog',p,parent);ring([0,0,0],rad,'brass',x);orb([0,0,0],[rad*.33,rad*.33,rad*.14],'teal',x);for(let i=0;i<10;i++){const a=i*Math.PI/5,o=box([Math.cos(a)*rad,Math.sin(a)*rad,0],[rad*.23,rad*.20,rad*.19],'brass',x);o.rotation.z=a;rod([0,0,0],[Math.cos(a)*rad*.85,Math.sin(a)*rad*.85,0],rad*.055,'deep',x);}return x;}
  function lantern(p,s,parent=theme){const x=g('Hanging workshop lantern',p,parent);orb([0,0,0],[s,s*1.4,s],'light',x);for(const side of[-1,1])rod([side*s*.8,-s,0],[side*s*.8,s,0],s*.10,'brass',x);mesh(new T.ConeGeometry(s*1.4,s*.7,8),'teal',[0,s*1.45,0],[1,1,1],x);ring([0,s*1.95,0],s*.35,'brass',x);}
  function claw(p,size,parent=theme){const x=g('Oversized three finger recovery grab',p,parent);orb([0,0,0],[size*.35,size*.23,size*.35],'teal',x);const collar=ring([0,0,0],size*.33,'brass',x);collar.rotation.x=Math.PI/2;for(let i=0;i<3;i++){const a=i*Math.PI*2/3,dx=Math.cos(a),dz=Math.sin(a);const elbow=[dx*size*.70,-size*.43,dz*size*.70];curve([[dx*size*.20,0,dz*size*.20],elbow,[dx*size*.55,-size*.93,dz*size*.55],[dx*size*.12,-size*1.12,dz*size*.12]],size*.095,'brass',x);orb(elbow,[size*.15,size*.15,size*.15],'deep',x);orb([dx*size*.16,-size*1.05,dz*size*.16],[size*.15,size*.09,size*.15],'teal',x);}return x;}
  // Replace the thin old cranes with large load-bearing, braced articulated arms.
  root.traverse(n=>{if(n.name==='Load bearing articulated recovery crane'||n.name==='Grand auxiliary holding arm'||n.name==='Grand repair tool arm')n.visible=false;});
  for(const s of[-1,1]){
   const primary=s<0,arm=g(primary?'Main ornate recovery crane':'Counterweight crane',[L*.035,L*.02,s*L*.19]);
   const a=[-L*.10,L*(primary?.35:.25),s*L*(primary?.14:.10)],end=[-L*(primary?.58:.43),L*(primary?.24:.16),s*L*(primary?.16:.12)];
   box([0,0,0],[L*.15,L*.055,L*.12],'deep',arm);curve([[0,0,0],[-L*.03,L*.21,s*L*.10],a],L*.035,'wood',arm);rod(a,end,L*.031,'teal',arm);rod([L*.07,0,0],a,L*.012,'brass',arm);rod([-L*.015,L*.08,s*L*.015],[a[0]-L*.06,a[1]-L*.06,a[2]],L*.012,'brass',arm);gear(a,L*.06,arm);gear([0,L*.04,s*L*.065],L*.07,arm);
   curve([a,[-L*.30,L*(primary?.33:.24),s*L*.15],end],L*.006,'rope',arm);
   const drop=L*(.10+(r-2)*.018);rod(end,[end[0],end[1]-drop,end[2]],L*.007,'rope',arm);claw([end[0],end[1]-drop,end[2]],L*(primary?.11+(r-2)*.028:.085+(r-2)*.015),arm);
   // A broad reel with wound cable and an exposed cog reads from the side.
   const reel=g('Heavy wound salvage drum',[L*.12,-L*.025,s*L*.255]);rod([0,0,-L*.045],[0,0,L*.045],L*.065,'rope',reel);for(let j=0;j<9;j++)ring([0,0,(j/8-.5)*L*.09],L*.067,'rope',reel,L*.004);for(const z of[-L*.055,L*.055])gear([0,0,z],L*.080,reel);rod([-L*.05,-L*.04,0],[-L*.05,-L*.09,-s*L*.07],L*.012,'wood',reel);rod([L*.05,-L*.04,0],[L*.05,-L*.09,-s*L*.07],L*.012,'wood',reel);
  }
  if(r>=3){
   // The bridge arch clears the envelope and is visibly anchored at both rails.
   const x=-L*.22,top=L*(.47+(r-3)*.025);curve([[x,0,-L*.20],[x,L*.30,-L*.35],[x,top,-L*.22],[x,top+L*.04,0],[x,top,L*.22],[x,L*.30,L*.35],[x,0,L*.20]],L*.021,'wood');curve([[x,0,-L*.20],[x,L*.30,-L*.35],[x,top,-L*.22],[x,top+L*.04,0],[x,top,L*.22],[x,L*.30,L*.35],[x,0,L*.20]],L*.008,'brass');gear([x,top+L*.04,0],L*.05);
   for(const s of[-1,1]){const start=[x,L*.29,s*L*.35],end=[x,L*.21,s*L*.35];rod(start,end,L*.004,'rope');lantern([end[0],end[1]-L*.02,end[2]],L*.018);}
  }
  // Rolled cloth, copper vessels, tool crates and side pennants give the boat a working life.
  for(let j=0;j<r-1;j++){const x=L*(.02+j*.095),y=L*.018,z=-L*.14;const c=g('Bound recovered cargo',[x,y,z]);box([0,L*.035,0],[L*.075,L*.07,L*.08],'wood',c);for(const dx of[-L*.025,L*.025])box([dx,L*.036,0],[L*.006,L*.073,L*.083],'brass',c);orb([0,L*.087,0],[L*.03,L*.025,L*.03],j%2?'coral':'cream',c);}
  for(const s of[-1,1]){const awn=g('Scalloped coral workshop awning',[L*.32,L*(.17+(r-2)*.04),s*L*.18]);box([0,0,0],[L*.26,L*.018,L*.14],'coral',awn);for(let i=0;i<7;i++)orb([L*(i/6-.5)*.26,-L*.012,s*L*.07],[L*.022,L*.025,L*.009],i%2?'cream':'coral',awn);for(const dx of[-L*.11,L*.11])rod([dx,-L*(.17+(r-2)*.04),0],[dx,0,0],L*.006,'brass',awn);lantern([-L*.11,-L*.04,s*L*.075],L*.014,awn);}
  if(r>=4){const y=-L*.22,frame=g('Decorated suspended cargo cradle',[L*.04,y,0]);box([0,0,0],[L*.46,L*.025,L*.33],'wood',frame);for(const s of[-1,1]){curve([[-L*.23,L*.04,s*L*.165],[0,-L*.02,s*L*.18],[L*.23,L*.04,s*L*.165]],L*.008,'brass',frame);for(let i=0;i<6;i++)rod([L*(i/5-.5)*.42,L*.02,s*L*.165],[L*(i/5-.5)*.42,L*.08,s*L*.165],L*.004,'rope',frame);}for(const dx of[-L*.20,L*.20])for(const s of[-1,1])rod([dx,y,s*L*.15],[dx,0,s*L*.16],L*.005,'rope');}
  if(r===5){const mast=g('Recovery guild fan crest',[L*.36,L*.36,0]);rod([0,-L*.19,0],[0,L*.14,0],L*.008,'brass',mast);gear([0,L*.04,0],L*.07,mast);for(let i=0;i<5;i++){const a=(i-2)*.32;curve([[0,L*.03,0],[Math.sin(a)*L*.13,Math.cos(a)*L*.19,0],[Math.sin(a)*L*.18,Math.cos(a)*L*.24,0]],L*.012,i%2?'coral':'brass',mast);}lantern([0,-L*.06,0],L*.025,mast);}
  root.updateMatrixWorld(true);let triangles=0,meshes=0;root.traverseVisible(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;}});
  return{...base,counts:{triangles,meshes,sourceTriangles:11026}};
 }
 return{create,createOriginal:()=>source.createOriginal(),dispose(){source.dispose();owned.forEach(x=>x.dispose());}};
}
