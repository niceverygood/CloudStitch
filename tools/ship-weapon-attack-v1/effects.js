import * as T from 'three';
const clamp=T.MathUtils.clamp;
function mesh(g,c,opacity=1){const m=new T.Mesh(g,new T.MeshBasicMaterial({color:c,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,toneMapped:false}));m.material.userData.outlineParameters={visible:false};return m;}
function star(radius,spikes=7){const s=new T.Shape();for(let i=0;i<spikes*2;i++){const a=i*Math.PI/spikes,r=i%2?radius*.30:radius*(.88+.12*Math.sin(i*9));const p=[Math.cos(a)*r,Math.sin(a)*r];i?s.lineTo(...p):s.moveTo(...p)}s.closePath();const g=new T.ShapeGeometry(s);g.rotateY(Math.PI/2);return g;}
function tongue(){const s=new T.Shape();s.moveTo(0,-.035);s.quadraticCurveTo(.15,-.13,.32,.09);s.quadraticCurveTo(.13,.015,.16,.19);s.quadraticCurveTo(.11,.10,0,.035);s.closePath();const g=new T.ShapeGeometry(s);g.rotateY(Math.PI/2);return g;}
export function makeEffect(branch,rich,origin,hit,index){
 const root=new T.Group(),muzzle=new T.Group(),impact=new T.Group();muzzle.position.copy(origin);impact.position.copy(hit);impact.position.x-=.12;root.add(muzzle,impact);
 const warm=branch==='artillery',impactColor=warm?0xf1ad50:branch==='mobility'?0xd8b888:0x8fb8af;
 const flash=mesh(new T.ConeGeometry(.038,.20,7),warm?0xffddb1:0xf6e7bd);flash.rotation.z=Math.PI/2;flash.position.x=-.08;muzzle.add(flash);
 const skirts=[];if(rich)for(let i=0;i<3;i++){const a=i*Math.PI*2/3,n=mesh(new T.TorusGeometry(.032+i*.007,.006,5,20,Math.PI*1.45),warm?0xd99758:0x96bab0);n.rotation.y=Math.PI/2;n.rotation.x=a;n.position.x=.02+i*.027;muzzle.add(n);skirts.push(n);}
 const main=mesh(star(warm?.27:.16,warm?9:6),warm?0xf18a39:impactColor),core=mesh(star(warm?.13:.07,5),0xfff1ca);impact.add(main,core);core.position.x=.005;
 // The comic contact glyph remains readable from the rear side of the test board.
 for(const n of[main,core]){n.material.depthTest=false;n.renderOrder=20;}
 const shock=mesh(new T.TorusGeometry(1,.025,5,40),warm?0xe9c183:0xc8d6bb);shock.rotation.y=Math.PI/2;impact.add(shock);
 const petals=[];if(rich)for(let i=0;i<6;i++){const a=i*Math.PI/3,n=mesh(new T.SphereGeometry(1,12,8),i%2?impactColor:0xf4d69e);n.userData.angle=a;impact.add(n);petals.push(n);}
 const chips=[];for(let i=0;i<(rich?18:5);i++){const n=mesh(new T.BoxGeometry(1,1,1),i%3===0?0x54847d:i%2?0xc28e53:0x845b3c);n.userData.direction=new T.Vector3(.35+.07*(i%5),Math.sin(i*2.399)*.65+.2,Math.cos(i*2.399)*.70);n.userData.phase=i*.73;impact.add(n);chips.push(n);}
 const smoke=[];for(let i=0;i<(rich?8:2);i++){const n=mesh(new T.SphereGeometry(1,12,8),warm?(i%2?0x9c9a8a:0xc2b9a1):0xc4bda7);n.userData.angle=i*2.399;impact.add(n);smoke.push(n);}
 const hero=[];
 if(rich&&warm){
  for(let i=0;i<5;i++){const n=mesh(new T.SphereGeometry(1,14,10),i%2?0xffe6af:0xfff5d5);n.userData.kind='pressure';n.userData.angle=i*2.399;impact.add(n);hero.push(n);}
  for(let i=0;i<5;i++){const n=mesh(tongue(),i%2?0xd86548:0xf0ab44);n.position.x=-.16-i*.003;n.rotation.x=i*Math.PI*2/5;n.material.depthTest=false;n.renderOrder=22;impact.add(n);n.userData.kind='flame';n.userData.angle=n.rotation.x;hero.push(n);}
 }else if(rich){
  const wedge=mesh(new T.ConeGeometry(branch==='mobility'?.055:.09,branch==='mobility'?.5:.35,4),branch==='mobility'?0xfff1cd:0xffe09b);wedge.rotation.z=Math.PI/2;wedge.position.x=-.17;wedge.userData.kind='wedge';impact.add(wedge);hero.push(wedge);
  for(let i=0;i<7;i++){const n=mesh(new T.ConeGeometry(.018,.18+(i%3)*.055,3),branch==='mobility'?(i%2?0xae6c3e:0xe5c690):(i%2?0xf8d479:0x699a93));n.userData.kind='split';n.userData.angle=(i-3)*.34;n.rotation.x=n.userData.angle;impact.add(n);hero.push(n);}
 }
 const exhaust=[];if(warm)for(let i=0;i<(rich?7:2);i++){const n=mesh(new T.SphereGeometry(1,12,8),i<2?0xeeb56a:0xc2bba5);root.add(n);exhaust.push(n);}
 function apply(t,launch,hitTime,flightPosition,on=true){
  const a=t-launch,h=t-hitTime;muzzle.visible=on&&a>=-.10&&a<.25;impact.visible=on&&h>=0&&h<1.65;
  hero.forEach((n,i)=>{const age=Math.max(0,h),burst=Math.min(1,age/.025)*Math.exp(-Math.max(0,age-.08)*4.8);n.visible=h>=0&&h<.65;
   if(n.userData.kind==='pressure'){const angle=n.userData.angle,r=.045+age*.23;n.position.set(-.12,Math.sin(angle)*r,Math.cos(angle)*r);n.scale.set(.07*burst,.14*burst,.115*burst);n.material.opacity=Math.max(0,1-age*2.5);}
   else if(n.userData.kind==='flame'){n.scale.setScalar((.8+age*2)*burst);n.rotation.x=n.userData.angle+age*.7;n.material.opacity=Math.max(0,1-age*2.3);}
   else if(n.userData.kind==='wedge'){n.scale.setScalar(burst);n.material.opacity=Math.max(0,1-age*3);}
   else{const angle=n.userData.angle;n.position.set(-.14-age*.4,Math.sin(angle)*(.09+age*.6),Math.cos(angle)*(.07+age*.45));n.rotation.z=angle+age*2;n.scale.setScalar(Math.max(.1,1-age));n.material.opacity=Math.max(0,1-age/1.05);}
  });
  flash.scale.setScalar(Math.max(.01,Math.sin(clamp((a+.02)/.16,0,1)*Math.PI))*(rich?1.35:.65));flash.material.opacity=a>=0?Math.max(0,1-a/.18):.12;
  skirts.forEach((n,i)=>{n.scale.setScalar(Math.max(.01,.6+a*5+i*.15));n.material.opacity=Math.max(0,1-a/.27)*.7;n.position.x=.02+a*.22+i*.027});
  const primary=h<.035?Math.max(.01,h/.035):Math.max(.01,Math.exp(-(h-.035)*5));main.scale.setScalar(primary*(rich?1:.42));main.rotation.x=h*2;main.material.opacity=Math.max(0,1-h/.30);core.scale.setScalar(primary*(rich?1:.55));core.material.opacity=Math.max(0,1-h/.17);
  shock.visible=rich&&h<.50;shock.scale.setScalar(Math.max(.001,(.03+h*(warm?.82:.48))));shock.material.opacity=Math.max(0,.7-h*1.4);
  petals.forEach((n,i)=>{const a=n.userData.angle,r=.03+Math.max(0,h)*.38;n.position.set(.02+Math.max(0,h)*.08,Math.sin(a)*r,Math.cos(a)*r);n.scale.set(.045*(1+h*2),.08*(1+h),.04*(1+h));n.rotation.x=a;n.material.opacity=Math.max(0,.80-h*2.4);});
  chips.forEach((n,i)=>{const d=n.userData.direction,age=Math.max(0,h),v=rich?.55:.22;n.position.copy(d).multiplyScalar(age*v);n.position.y-=age*age*.34;n.scale.set(.009+(i%3)*.003,.018+(i%4)*.008,.008);n.rotation.set(age*8+i,age*4,age*6);n.material.opacity=Math.max(0,1-age/1.2);});
  smoke.forEach((n,i)=>{const age=Math.max(0,h),a=n.userData.angle,r=(.025+age*(rich?.22:.12))*(rich?1:.65);n.position.set(-.16+Math.cos(a)*age*.08,.03+age*.19+Math.sin(a)*(rich?.095:.045),Math.sin(a)*age*(rich?.22:.12));n.scale.setScalar(Math.max(.001,r*(1+(i%3)*.13)));n.material.opacity=Math.max(0,Math.min(rich?.58:.42,(age-.07)*2))*(1-age/1.65);});
  exhaust.forEach((n,i)=>{n.visible=on&&a>=0&&a<(hitTime-launch+.35);const lag=i*.045,age=Math.max(0,a-lag);n.position.copy(flightPosition);n.position.x+=i*.055;n.position.y+=Math.sin(i+age*3)*.012;n.scale.set(.045+i*.007,.018+i*.006,.018+i*.006);n.material.opacity=Math.max(0,.6-i*.06)*Math.max(0,1-Math.max(0,t-hitTime)*4);});
 }
 return{root,apply};
}
