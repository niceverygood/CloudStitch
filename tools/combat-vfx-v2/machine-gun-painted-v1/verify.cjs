/* Geometry/timing checks only. No browser, GPU, generation or original mutation. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),THREE=require('three'),esbuild=require('esbuild');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.join(ROOT,'outputs/combat-vfx-v2/machine-gun-painted-v1'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(path.join(__dirname,'painted-effects.js'),'utf8'),scope={module:{exports:{}}};scope.exports=scope.module.exports;vm.runInNewContext(esbuild.transformSync(source,{format:'cjs'}).code,scope);
const {createPaintedMG}=scope.module.exports,atlas=new THREE.Texture(),metal=new THREE.Texture(),effect=createPaintedMG(THREE,{atlas,metalTexture:metal});
const failures=[],assert=(ok,why)=>{if(!ok)failures.push(why);},surfaceNames=/^(painted_impact_core|painted_contact_brush|restrained_impact_light|fine_gold_flick_)/;
const point=new THREE.Vector3(.0007595372312182436,.6299396781481901,3.996617496159633),muzzle=point.clone().add(new THREE.Vector3(0,0,-4.005));
const cameras=[[-7,5.5,-7],[7,3,-7],[.5,4,-8]].map(p=>{const c=new THREE.PerspectiveCamera();c.position.set(...p);c.lookAt(point);c.updateMatrixWorld(true);return c;});
let conditions=0,planes=0,maxCoplanarError=0,minNormalAlignment=1,minSurfaceGap=Infinity,maxCameraVertexDifference=0;
const cameraSamples=new Map();
for(const [mode,times] of [['attack',[.91,1.05]],['hit',[.05,.15]]])for(const time of times)for(let cameraIndex=0;cameraIndex<cameras.length;cameraIndex++){
 const normal=new THREE.Vector3(0,mode==='hit'?1:0,mode==='attack'?-1:0),hit=mode==='hit'?new THREE.Vector3():point;
 effect.update({mode,time,camera:cameras[cameraIndex],muzzle:mode==='hit'?new THREE.Vector3():muzzle,hit,impactNormal:normal});effect.root.updateMatrixWorld(true);conditions++;
 effect.root.traverseVisible(n=>{if(!surfaceNames.test(n.name))return;assert(n.isMesh&&!n.isSprite,'Surface remained billboard: '+n.name);const p=n.geometry.attributes.position,world=[];for(let i=0;i<p.count;i++)world.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld));
  const planeNormal=new THREE.Vector3().fromBufferAttribute(n.geometry.attributes.normal,0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(n.matrixWorld)).normalize();const alignment=Math.abs(planeNormal.dot(normal));minNormalAlignment=Math.min(minNormalAlignment,alignment);assert(alignment>1-1e-9,'Surface normal mismatch: '+n.name);
  const origin=world[0].dot(normal);for(const v of world){maxCoplanarError=Math.max(maxCoplanarError,Math.abs(v.dot(normal)-origin));minSurfaceGap=Math.min(minSurfaceGap,v.clone().sub(hit).dot(normal));}
  const key=mode+':'+time+':'+n.parent.name+':'+n.name,values=world.flatMap(v=>v.toArray());if(cameraIndex===0)cameraSamples.set(key,values);else{const prior=cameraSamples.get(key);assert(prior?.length===values.length,'Camera changed plane count');if(prior)for(let i=0;i<values.length;i++)maxCameraVertexDifference=Math.max(maxCameraVertexDifference,Math.abs(values[i]-prior[i]));}planes++;
 });
}
assert(maxCoplanarError<1e-9&&minSurfaceGap>0,'Surface clipping/coplanarity error');assert(maxCameraVertexDifference===0,'Camera changed impact geometry');
const snapshot=()=>{const rows=[];effect.root.traverseVisible(n=>{rows.push(n.name,...n.matrixWorld.elements,n.material?.opacity??1);});return JSON.stringify(rows);};
effect.update({time:.91,camera:cameras[0],muzzle,hit:point,impactNormal:new THREE.Vector3(0,0,-1)});const before=snapshot();effect.update({time:1.95,camera:cameras[0],muzzle,hit:point});effect.update({time:.91,camera:cameras[0],muzzle,hit:point,impactNormal:new THREE.Vector3(0,0,-1)});assert(before===snapshot(),'Reverse scrub changed visual state');
for(const mode of ['attack','muzzle','projectile','hit']){effect.update({mode,time:effect.durations[mode],camera:cameras[0]});assert(!effect.root.visible,'Effect remained at end: '+mode);}
let baseDisposed=0;atlas.addEventListener('dispose',()=>baseDisposed++);metal.addEventListener('dispose',()=>baseDisposed++);effect.dispose();assert(baseDisposed===0,'Caller texture disposed');
const manifest=JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'),'utf8'));for(const a of manifest.original_assets){const b=fs.readFileSync(path.join(ROOT,a.path));assert(b.length===a.bytes&&sha(b)===a.sha256,'Original changed: '+a.id);}
for(const image of Object.values(manifest.textures)){const b=fs.readFileSync(path.join(ROOT,image.path));assert(sha(b)===image.sha256&&b.length===image.bytes,'Texture changed');assert(b.readUInt32BE(16)%2===0&&b.readUInt32BE(20)%2===0,'Atlas grid not even');}
const report={game_title:'Cloudstitch',passed:failures.length===0,scope:'Geometry/timing/source only; visual evidence recorded separately',source_sha256:sha(Buffer.from(source)),output:manifest.output,conditions,planes_checked:planes,min_abs_normal_dot:minNormalAlignment,max_plane_error:maxCoplanarError,min_surface_gap:minSurfaceGap,max_camera_vertex_difference:maxCameraVertexDifference,reverse_scrub_identical:before===snapshot(),base_texture_disposals:baseDisposed,browser_run:false,failures};
// The equality was asserted before end/dispose changed visibility.
report.reverse_scrub_identical=!failures.includes('Reverse scrub changed visual state');
if(process.argv.includes('--write')){fs.mkdirSync(path.join(OUT,'verification'),{recursive:true});fs.writeFileSync(path.join(OUT,'verification/geometry.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
