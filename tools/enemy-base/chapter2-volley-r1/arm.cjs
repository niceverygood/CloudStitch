// Additive GLB construction: original chapter-two binary/accessors/images stay exact.
const fs=require('fs'),crypto=require('crypto'),T=require('three'),assert=require('assert/strict');
const {mergeGeometries}=require('three/addons/utils/BufferGeometryUtils.js');
const {parseGLB,makeGLB}=require('../../qa/world-gltf.cjs');
const out='outputs/enemy-base-v1/chapter2-volley-r1',source='outputs/enemy-base-v1/chapter2-r2/enemy-base.glb';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),bytes=fs.readFileSync(source);assert.equal(sha(bytes),'d478dfa063f9f475f962da048493fb4de898da1dcc38d73c2e40de4df65143de');
const {json:j,bin}=parseGLB(bytes),original=JSON.parse(JSON.stringify(j)),chunks=[bin];let offset=bin.length;
const V=p=>new T.Vector3(...p),palette={bone:'#c6b398',dark:'#3c3445',coral:'#a83f43',gold:'#b99c67',wood:'#805b40',cyan:'#61c8bb',arrow:'#edcea0',feather:'#9d3747'};
function view(b,target){const id=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:b.length,...(target?{target}:{})});chunks.push(b);offset+=b.length;assert.equal(offset%4,0);return id;}
function acc(array,type,target){const count=array.length/({VEC3:3,VEC4:4,SCALAR:1}[type]),id=j.accessors.length,b=Buffer.from(array.buffer,array.byteOffset,array.byteLength);const a={bufferView:view(b,target),componentType:array instanceof Uint32Array?5125:5126,count,type};if(type==='SCALAR')a.min=[Math.min(...array)],a.max=[Math.max(...array)];j.accessors.push(a);return id;}
const material=j.materials.length;j.materials.push({name:'redtide_arrow_bone_coral_paint',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1},doubleSided:true});
function painted(g,key,p=[0,0,0],rot=[0,0,0]){if(g.index){const a=g;g=g.toNonIndexed();a.dispose();}g.applyMatrix4(new T.Matrix4().compose(V(p),new T.Quaternion().setFromEuler(new T.Euler(...rot)),new T.Vector3(1,1,1)));const ns=g.attributes.normal,ps=g.attributes.position,c=new T.Color(palette[key]),colors=new Float32Array(ps.count*3);for(let i=0;i<ps.count;i++){const l=.5+.5*Math.max(0,ns.getX(i)*-.4+ns.getY(i)*.8+ns.getZ(i)*.4),grain=.96+.04*Math.sin(ps.getX(i)*11+ps.getY(i)*6);colors[i*3]=Math.min(1,c.r*l*grain);colors[i*3+1]=Math.min(1,c.g*l*grain);colors[i*3+2]=Math.min(1,c.b*l*grain);}for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);g.setAttribute('color',new T.BufferAttribute(colors,3));return g;}
function box(parts,key,x,y,z,w,h,d){parts.push(painted(new T.BoxGeometry(w,h,d),key,[x,y,z]));}
function rod(parts,key,a,b,r=.07){const d=V(b).sub(V(a)),g=new T.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...V(a).add(V(b)).multiplyScalar(.5).toArray());parts.push(painted(g,key));}
function mesh(parts,name){const g=mergeGeometries(parts,false),attributes={POSITION:acc(g.attributes.position.array,'VEC3',34962),NORMAL:acc(g.attributes.normal.array,'VEC3',34962),COLOR_0:acc(g.attributes.color.array,'VEC3',34962)};const a=j.accessors[attributes.POSITION],p=g.attributes.position;g.computeBoundingBox();a.min=g.boundingBox.min.toArray();a.max=g.boundingBox.max.toArray();const id=j.meshes.length;j.meshes.push({name,primitives:[{attributes,material,mode:4}]});parts.forEach(g=>g.dispose());g.dispose();return id;}
function node(n){const i=j.nodes.length;j.nodes.push(n);return i;}
const root=j.scenes[j.scene||0].nodes[0],batteries=node({name:'arrow_batteries',children:[],extras:{semantic_zone:'arrow_batteries',scope:'Art-only module count'}}),rain=node({name:'arrow_rain',children:[],extras:{semantic_zone:'arrow_rain'}});j.nodes[root].children??=[];j.nodes[root].children.push(batteries,rain);
// Reusable 24-tube rack: 6x4 hollow bone launch sleeves, dark bores, loaded arrows.
const rack=[];box(rack,'coral',0,.7,-.55,3.35,2.4,1.8);box(rack,'wood',0,-.7,-.8,3.8,.3,2.5);
for(const xx of [-1.8,1.8]){box(rack,'gold',xx,.65,-.65,.12,2.6,2);rod(rack,'bone',[xx,-.8,-1.7],[xx,.8,.7],.14);}
for(let row=0;row<4;row++)for(let col=0;col<6;col++){
 const x=(col-2.5)*.49,y=row*.51-.1;
 rack.push(painted(new T.CylinderGeometry(.225,.25,1.65,8,1,true),'bone',[x,y,.35],[Math.PI/2,0,0]));
 rack.push(painted(new T.CircleGeometry(.184,8),'dark',[x,y,1.19]));
 rack.push(painted(new T.TorusGeometry(.23,.045,4,8),'gold',[x,y,1.21]));
 rack.push(painted(new T.ConeGeometry(.105,.3,5),'arrow',[x,y,1.37],[Math.PI/2,0,0]));
}
const rackMesh=mesh(rack,'twenty_four_bone_arrow_tubes');
// One shared projectile batch mesh; each animated node is exactly 24 real arrows.
const arrows=[];
for(let row=0;row<4;row++)for(let col=0;col<6;col++){
 const x=(col-2.5)*.49,y=row*.51-.1;
 arrows.push(painted(new T.CylinderGeometry(.028,.028,1.65,5),'wood',[x,y,1.1],[Math.PI/2,0,0]));
 arrows.push(painted(new T.ConeGeometry(.12,.39,5),'arrow',[x,y,2.12],[Math.PI/2,0,0]));
 for(const a of [0,Math.PI/2]){const f=new T.BufferGeometry();f.setAttribute('position',new T.Float32BufferAttribute([0,0,0, .18,0,-.35,0,0,-.55,0,0,0,-.18,0,-.35,0,0,-.55],3));f.computeVertexNormals();arrows.push(painted(f,'feather',[x,y,.36],[0,0,a]));}
 const tail=new T.BufferGeometry();tail.setAttribute('position',new T.Float32BufferAttribute([-.025,0,0,.025,0,0,0,0,-2.3],3));tail.computeVertexNormals();arrows.push(painted(tail,'arrow',[x,y,.15]));
}
// Shared morph target scatters each arrow independently after it leaves a port.
// Counts stay exact, but the flight becomes a storm rather than square formations.
const arrowGeometry=mergeGeometries(arrows,false),ap=arrowGeometry.attributes.position,an=arrowGeometry.attributes.normal,dp=new Float32Array(ap.count*3),dn=new Float32Array(an.count*3),perArrow=ap.count/24;
const random=n=>{const q=Math.sin(n*31.79+12.43)*43758.5453;return q-Math.floor(q);};
for(let k=0;k<24;k++){
 const cx=(k%6-2.5)*.49,cy=(Math.floor(k/6))*.51-.1,delta=new T.Vector3((random(k)-.5)*8,(random(k+71)-.5)*5,(random(k+137)-.5)*15),quat=new T.Quaternion().setFromEuler(new T.Euler((random(k+210)-.5)*.25,(random(k+328)-.5)*.32,0));
 for(let n=0;n<perArrow;n++){const i=k*perArrow+n,p=new T.Vector3(ap.getX(i)-cx,ap.getY(i)-cy,ap.getZ(i)-1).applyQuaternion(quat).add(new T.Vector3(cx,cy,1)).add(delta),normal=new T.Vector3(an.getX(i),an.getY(i),an.getZ(i)).applyQuaternion(quat);dp[i*3]=p.x-ap.getX(i);dp[i*3+1]=p.y-ap.getY(i);dp[i*3+2]=p.z-ap.getZ(i);dn[i*3]=normal.x-an.getX(i);dn[i*3+1]=normal.y-an.getY(i);dn[i*3+2]=normal.z-an.getZ(i);}
}
const arrowMesh=mesh(arrows,'twenty_four_arrows_and_painted_speed_strokes'),deltaPosition=acc(dp,'VEC3',34962),deltaNormal=acc(dn,'VEC3',34962);j.accessors[deltaPosition].min=[-12,-12,-12];j.accessors[deltaPosition].max=[12,12,12];
// Exact morph extrema are required by the glTF validator.
for(const [axis,n] of ['X','Y','Z'].entries()){const values=[];for(let i=axis;i<dp.length;i+=3)values.push(dp[i]);j.accessors[deltaPosition].min[axis]=Math.min(...values);j.accessors[deltaPosition].max[axis]=Math.max(...values);}
j.meshes[arrowMesh].primitives[0].targets=[{POSITION:deltaPosition,NORMAL:deltaNormal}];j.meshes[arrowMesh].weights=[0];j.meshes[arrowMesh].extras={targetNames:['independent_arrow_scatter']};arrowGeometry.dispose();
const anim={name:'RedTide_Arrow_Deluge_4608',samplers:[],channels:[],extras:{duration:8,arrowsPerRack:24,batteries:48,burstsPerCycle:4,arrowsPerCycle:4608,damage:false}},placements=[],platforms=[];
function track(n,path,times,values,type,interpolation='LINEAR'){assert(times.every((t,i)=>i===0||t>times[i-1]));const id=anim.samplers.length;anim.samplers.push({input:acc(new Float32Array(times),'SCALAR'),output:acc(new Float32Array(values),path==='weights'?'SCALAR':'VEC'+({translation:3,scale:3,rotation:4}[path])),interpolation});anim.channels.push({sampler:id,target:{node:n,path}});}
const duration=8,epsilon=.00001;
for(let tier=0;tier<3;tier++)for(let i=0;i<16;i++){
 const a=i/16*Math.PI*2+.14*(tier%2),rx=[29.5,24.5,18.8][tier],rz=[23.2,18.8,14.2][tier],y=[8.5,17.2,25.5][tier],x=Math.sin(a)*rx,z=Math.cos(a)*rz,pitch=[-.23,-.34,-.43][tier];
 const q=new T.Quaternion().setFromEuler(new T.Euler(pitch,a,0,'YXZ'));
 const mount=node({name:`arrow_mount_${tier}_${i}`,translation:[x,y,z],rotation:q.toArray(),children:[]});j.nodes[batteries].children.push(mount);
 const rackNode=node({name:`arrow_rack_${tier}_${i}`,mesh:rackMesh,translation:[0,0,0]});j.nodes[mount].children.push(rackNode);
 const flightMount=node({name:`arrow_flight_mount_${tier}_${i}`,translation:[x,y,z],rotation:q.toArray(),children:[]});j.nodes[rain].children.push(flightMount);
 const start=.82+(i%8)*.055+tier*.035,times=[0,start-.25,start-.08],values=[0,0,0,0,0,-.13,0,0,.08];
 for(let b=0;b<4;b++){const t=start+b*.57;times.push(t,t+.055,t+.19,t+.45);values.push(0,0,0,0,0,-.55,0,0,-.22,0,0,0);}
 times.push(5.8,6.6,7.4,8);values.push(0,-.15,-.3,0,-.15,-.3,0,0,0,0,0,0);track(rackNode,'translation',times,values,'VEC3');
 // Four staggered sector waves; shared batches stay bounded and reset at time8.
 for(let b=0;b<4;b++){
  const launch=start+b*.57,flight=2.05,cloud=node({name:`arrow_cloud_${tier}_${i}_${b}`,mesh:arrowMesh,scale:[epsilon,epsilon,epsilon],translation:[0,0,0],extras:{arrows:24,launch,flight}});j.nodes[flightMount].children.push(cloud);
  const ts=[0,launch-.001,launch,launch+.05,launch+.5,launch+1.05,launch+1.6,launch+flight,launch+flight+.005,8];
  const positions=[0,0,0, 0,0,0, 0,0,0, 0,.3,1.8, 0,3.8,12, 0,5.6,24, 0,2.0,37, 0,-8,48, 0,-8,48, 0,0,0];
  const scales=[epsilon,epsilon,epsilon,epsilon,epsilon,epsilon, 1,1,1, 1,1,1, 1.4,1.2,1, 1.8,1.5,1, 2.2,1.8,1, 2.5,2,1, epsilon,epsilon,epsilon,epsilon,epsilon,epsilon];
  track(cloud,'translation',ts,positions);track(cloud,'scale',ts,scales);
  track(cloud,'weights',ts,[0,0,0,.08,.75,1,1,1,0,0]);
  const quatTimes=[0,launch,launch+.6,launch+1.2,launch+flight,8],angles=[0,0,-.08,.1,.42,0],rot=[];for(const angle of angles)rot.push(...new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle).toArray());track(cloud,'rotation',quatTimes,rot);
 }
 // Fixed bone saddle and radial bracket visibly connect the rack to the reef.
 box(platforms,'wood',x,y-1.25,z,4.1,.25,3.9);
 const inside=[x*.81,y-4,z*.81];rod(platforms,'bone',inside,[x,y-1,z],.24);rod(platforms,'gold',[inside[0]+.3,inside[1],inside[2]],[x+.3,y-1,z],.06);
 placements.push({tier,sector:i,position:[x,y,z],quaternion:q.toArray(),ports:24,bursts:4,launch:start});
}
j.nodes[batteries].children.push(node({name:'bone_launcher_saddles',mesh:mesh(platforms,'fixed_bone_saddles')}));j.animations=[anim];j.buffers[0].byteLength=offset;
const result=makeGLB(j,Buffer.concat(chunks));const {json:check,bin:finalBin}=parseGLB(result);assert(finalBin.subarray(0,bin.length).equals(bin),'Original base binary must remain exact');
assert.deepEqual(check.accessors.slice(0,original.accessors.length),original.accessors);assert.deepEqual(check.meshes.slice(0,original.meshes.length),original.meshes);assert.deepEqual(check.materials.slice(0,original.materials.length),original.materials);assert.deepEqual(check.images,original.images);
fs.writeFileSync(out+'/enemy-base.glb',result);
const manifest={revision:'chapter2-volley-r1',source:{path:source,sha256:sha(bytes),binaryAndOriginalMeshesMaterialsImagesPreserved:true},model:{path:'enemy-base.glb',bytes:result.length,sha256:sha(result),animations:1},presentation:{duration,actualBatteries:48,portsPerBattery:24,bursts:4,arrowsPerCycle:4608,cloudNodes:192,arrowsPerCloud:24,cycle:'wind-up → four travelling sector volleys → drifting tails → reload → reset',noDamage:true,noEquipmentRuleChange:true},placements,limits:['Art-only authored projectile flight; not physics or collision','Batched 24 arrows share a flight transform; slight batch fan expansion is a visual effect','Painted speed streaks are opaque mesh geometry, not engine particles','No sound generated; no combat/sim integration']};fs.writeFileSync(out+'/model-manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({bytes:result.length,sha256:sha(result),batteries:48,arrowsPerCycle:4608,channels:anim.channels.length,sourcePreserved:true}));
