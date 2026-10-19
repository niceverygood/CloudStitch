const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),THREE=require('three');
const root=path.resolve(__dirname,'../..'),checks=[];
const check=(name,pass,detail)=>checks.push({name,passed:!!pass,detail});
async function main(){
  const {cameraProfiles,cameraBasis}=await import('./camera-profiles.mjs');
  const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  for(const view of cameraProfiles){
    const camera=new THREE.OrthographicCamera(-38.4,38.4,24,-24,.1,500),target=new THREE.Vector3(0,0,24);
    camera.position.copy(target).add(new THREE.Vector3(...cameraBasis(view.id).offset));camera.lookAt(target);camera.updateMatrixWorld();
    const points=[[0,0,24],[7,0,29],[-8,0,17]],errors=[];
    for(const point of points){const projected=new THREE.Vector3(...point).project(camera);ray.setFromCamera(new THREE.Vector2(projected.x,projected.y),camera);ray.ray.intersectPlane(plane,hit);errors.push(hit.distanceTo(new THREE.Vector3(...point)));}
    check(`pointer-ray-round-trip-${view.id}`,Math.max(...errors)<1e-8,{maxWorldError:Math.max(...errors)});
  }
  const html=fs.readFileSync(path.join(root,'tools/levels/camera-template.html'),'utf8'),ui=fs.readFileSync(path.join(root,'tools/levels/camera-ui.js'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),required=[...ui.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
  check('all-ui-controls-exist',required.every(id=>ids.includes(id))&&new Set(ids).size===ids.length,{ids:ids.length,references:new Set(required).size});
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'outputs/playable-battlefield-v1/handoff-files.json'),'utf8'));
  const changed=baseline.files.filter(file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file.path))).digest('hex')!==file.sha256).map(file=>file.path);
  check('original-ready3-files-preserved',changed.length===0,{files:baseline.files.length,changed});
  const result={version:1,passed:checks.every(c=>c.passed),checks,scope:'Node camera ray/projection and source/preservation checks. Browser visual comparison is separate.'};
  fs.mkdirSync(path.join(root,'outputs/playable-camera-v1'),{recursive:true});fs.writeFileSync(path.join(root,'outputs/playable-camera-v1/source-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
