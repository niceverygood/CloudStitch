import * as THREE from 'three';

// Source hero and weapon both use +Y up, -X forward. This is a review mount,
// not an engine attachment socket or a change to the authored ship factory.
export function createReviewMount(heroRoot, weaponScene) {
  heroRoot.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(heroRoot);
  const inverse = heroRoot.matrixWorld.clone().invert();
  const localBounds = new THREE.Box3();
  for (const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z]) localBounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(inverse));
  const mount = new THREE.Group(); mount.name='review-weapon-mount';
  mount.position.set(localBounds.min.x-.045,-.10,localBounds.max.z+.09);
  heroRoot.add(mount);
  const wood=new THREE.MeshStandardMaterial({color:0xb98b55,roughness:1}),brass=new THREE.MeshStandardMaterial({color:0xd6b166,roughness:1,metalness:0});
  const geometries=[],materials=[wood,brass];
  const platformGeometry=new THREE.BoxGeometry(.37,.026,.27);geometries.push(platformGeometry);
  const platform=new THREE.Mesh(platformGeometry,wood);platform.position.y=-.018;mount.add(platform);
  const rimGeometry=new THREE.CylinderGeometry(.105,.125,.025,24);geometries.push(rimGeometry);
  const rim=new THREE.Mesh(rimGeometry,brass);rim.position.y=.007;mount.add(rim);
  for(const side of[-1,1]){
    const a=new THREE.Vector3(.13,-.024,side*.10),b=new THREE.Vector3(.34,-.20,-mount.position.z+side*.075),d=b.clone().sub(a);
    const geometry=new THREE.CylinderGeometry(.009,.009,d.length(),8);geometries.push(geometry);
    const beam=new THREE.Mesh(geometry,brass);beam.position.copy(a).add(b).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());mount.add(beam);
  }
  const yaw=new THREE.Group(),recoil=new THREE.Group();yaw.name='review-turret-yaw';recoil.name='display-only-gun-recoil';mount.add(yaw);yaw.add(recoil);
  const model=weaponScene.clone(true);model.name='mounted-original-machine-gun';model.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const scale=.31/Math.max(size.x,size.y,size.z),tip=new THREE.Vector3(),v=new THREE.Vector3();let count=0;
  model.traverse(n=>{if(!n.isMesh)return;const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(n.matrixWorld);if(v.x<=box.min.x+size.x*.025){tip.add(v);count++;}}});
  if(!count)throw Error('기관총 포구 정점을 찾지 못했습니다.');tip.multiplyScalar(1/count);
  model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-box.min.y*scale+.026,-center.z*scale);recoil.add(model);
  const muzzle=new THREE.Object3D();muzzle.name='review-machine-gun-muzzle';muzzle.position.copy(tip).multiplyScalar(scale).add(model.position).add(new THREE.Vector3(-.002,0,0));yaw.add(muzzle);
  let disposed=false;
  function frame(){heroRoot.updateWorldMatrix(true,true);return {position:muzzle.getWorldPosition(new THREE.Vector3()),direction:new THREE.Vector3(-1,0,0).applyQuaternion(muzzle.getWorldQuaternion(new THREE.Quaternion())).normalize(),source:'hero-review-mounted-original-MG-geometric-muzzle'};}
  function aimAt(target){const p=mount.getWorldPosition(new THREE.Vector3()),direction=new THREE.Vector3(target.x-p.x,0,target.z-p.z).normalize();const local=direction.transformDirection(heroRoot.matrixWorld.clone().invert());yaw.rotation.y=Math.atan2(local.z,-local.x);return frame();}
  function updateRecoil(age){recoil.position.x=age>=0&&age<.2?Math.sin(Math.PI*Math.min(1,age/.2))*.014:0;}
  function dispose(){if(disposed)return;disposed=true;mount.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  return{root:mount,model,muzzle,yaw,recoil,frame,aimAt,updateRecoil,dispose,assumption:'Review-only external foredeck mount; no production socket exists on this visual variant.'};
}
