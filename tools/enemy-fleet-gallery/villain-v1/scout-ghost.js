import {THREE,group,box,sphere,beam,tube,ring,cone,cloth,gear,cannon,jaw,lantern} from './core.js';
export function addScoutGhost(ctx){
 const{id,root,m,features}=ctx,n=id+'-villain-';
 if(id==='mission-guard-scout'){
  // A shrike, rather than another pirate skiff: forked black tail and a tall
  // signal array sweep in the opposite direction from the forward needle.
  const prow=group(root,n+'shrike-beak',[-7,2.2,0]);
  for(const s of [-1,1]){
   const shape=new THREE.Shape();shape.moveTo(-6,0);shape.lineTo(.5,1.35);shape.lineTo(2,-.1);shape.lineTo(-1,-.4);shape.closePath();
   const g=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});const mesh=new THREE.Mesh(g,m.ink);mesh.name=n+'split-beak-'+s;mesh.position.z=s*.52;prow.add(mesh);
   tube(root,m.brass,n+'gilded-beak-edge-'+s,[[-12.9,2.2,s*.6],[-6,3.6,s*.6],[-5,2.1,s*.6]],.09,16);
   cone(root,m.iron,n+'rear-feather-'+s,[8.5,5.3,s*2.7],1.05,5.3,[s*.5,0,-.65],4);
   const wing=group(root,n+'stabilizer-'+s,[3.5,3.8,s*2.5],[s*.5,0,-.3]);
   cloth(wing,m.ink,n+'black-pennant-'+s,{at:[0,0,0],width:6.5,height:2.4,ragged:true,billow:.4});
   lantern(root,{...m,dark:m.ink},n+'amber-search-eye-'+s,[-7,3,s*.85],.55);
  }
  beam(root,m.iron,n+'signal-mast',[2,5.8,0],[4,12.2,0],.17);
  ring(root,m.brass,n+'listening-halo',[3.4,10.2,0],1.65,.16,'x');
  for(let i=0;i<5;i++)beam(root,m.brass,n+'antenna-'+i,[2.9,8.8+i*.55,-1.1],[2.9,8.8+i*.55,1.1+i*.15],.065);
  cloth(root,m.red,n+'command-ribbon',{at:[3.7,11.6,0],width:1.1,height:4.4,ragged:true,billow:.45,rotation:[0,0,-.5]});
  features.push('사납고 길게 갈라진 철제 때까치 부리','대칭 두꼬리 검은 안정날개','기낭 위로 치솟는 비대칭 신호 안테나','황동 청음 고리와 주황 탐조 눈','검은 장막과 붉은 지휘 리본의 강한 대비');return true;
 }
 if(id==='mission-ghost-artillery'){
  // A skeletal manta carrying one unmistakable spinal cannon. Swept rib wings
  // leave empty windows between fabric instead of filling the whole outline.
  for(const side of [-1,1]){
   for(let i=0;i<5;i++){
    const x=-4.8+i*2.7,z=side*(4+i*.28);
    tube(root,m.ivory,n+'manta-rib-'+side+'-'+i,[[x-.8,2.4,side*1.7],[x,4.4,side*4.6],[x+2,3,z+1.8*side],[x+4,1.2,z+2.6*side]],.14,20);
    const rag=group(root,n+'manta-fin-'+side+'-'+i,[x+.8,3.1,side*4.4],[side*.7,0,-.3]);
    cloth(rag,i%2?m.ink:m.cloth,n+'ragged-fin-'+side+'-'+i,{at:[0,0,0],width:2.8,height:2.2+i*.13,ragged:true,billow:side*.55});
   }
   tube(root,m.cold,n+'spectral-spine-vein-'+side,[[-7,.8,side*2],[-3,1.5,side*3.1],[2,1.15,side*2.3],[7,1.8,side*1]],.07,20);
   lantern(root,{...m,dark:m.ink,glow:m.cold},n+'cold-cage-'+side,[1,-1.1,side*3.7],.6);
  }
  cannon(root,m,n+'spinal-siege-cannon',[-1.4,5,0],1.5,[0,0,-.06]);
  for(let i=0;i<6;i++)cone(root,m.ivory,n+'spinal-prong-'+i,[i*1.55-1,6.7+i*.1,0],.34,1.35,[0,0,-.4],4);
  tube(root,m.iron,n+'torn-bow-lance',[[-8,2,0],[-11.5,2.2,0],[-14,2.8,0]],.19,12);
  jaw(root,m,n+'skull-bow',[-8.4,2,0],2.8,4.7);
  features.push('쥐가오리처럼 좌우로 크게 펼친 빈 늑골 날개','검은 파손천과 창백한 골조의 교차 면','선체를 관통하는 특대 척추 포신','장막 아래 푸른 혼등과 좁은 잔광 균열','극단적으로 긴 해골 창선수');return true;
 }return false;
}
