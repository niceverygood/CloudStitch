import { makeKit } from './kit.mjs';
import { buildA } from './models-a.mjs';
import { buildB } from './models-b.mjs';
import { buildC } from './models-c.mjs';
export function buildWeapon(spec) {
  const k=makeKit(spec);
  const order=Number(spec.id.slice(0,2));
  (order<=4?buildA:order<=8?buildB:buildC)(spec.id,k);
  k.root.userData.name_ko=spec.name_ko;
  k.root.userData.latest_art_direction='Approved grounded v2: modest fantasy, tangible handcrafted machinery';
  k.root.updateMatrixWorld(true);
  // Painted directional values are baked in assembled coordinates, so curved
  // surfaces and the shaded underside remain legible even in unlit art mode.
  // Keep hardware fully volumetric; this is COLOR_0, not a fake image plane.
  const T=k.THREE, light=new T.Vector3(-.6,.85,.65).normalize();
  const worldNormal=new T.Vector3(),position=new T.Vector3(),normalMatrix=new T.Matrix3();
  const box=new T.Box3().setFromObject(k.root),height=Math.max(.1,box.max.y-box.min.y);
  k.root.traverse(node=>{
    if(!node.isMesh)return;
    const geometry=node.geometry,colors=geometry.getAttribute('color'),normals=geometry.getAttribute('normal'),points=geometry.getAttribute('position');
    normalMatrix.getNormalMatrix(node.matrixWorld);
    for(let i=0;i<colors.count;i++){
      worldNormal.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();
      position.fromBufferAttribute(points,i).applyMatrix4(node.matrixWorld);
      const incidence=worldNormal.dot(light);
      const shade=incidence>.55?1.10:incidence>.05?.88:incidence>-.4?.62:.40;
      const grounding=.88+.12*Math.min(1,(position.y-box.min.y)/height*2.5);
      const r=colors.getX(i)*shade*grounding,g=colors.getY(i)*shade*grounding,b=colors.getZ(i)*shade*grounding;
      colors.setXYZ(i,Math.min(1,r*1.035),Math.min(1,g),Math.min(1,b*.975));
    }
    colors.needsUpdate=true;
  });
  k.root.userData.art_revision='r2 assembled painted chiaroscuro, tactile materials and oversized functional silhouettes';
  return k.root;
}
