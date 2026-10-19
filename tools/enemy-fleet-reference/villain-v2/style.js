import { THREE, mesh, group, beam, box, sphere, tube } from '../kit.js';
export { THREE, mesh, group, beam, box, sphere, tube };

// Painterly materials remain diffuse and readable; colour is only one layer.
export function villainPalette(source,id) {
  const m=Object.fromEntries(Object.entries(source).map(([key,value])=>[key,value.clone()]));
  const colors=id.includes('pirate')?{wood:0xb17e66,darkWood:0x6f4c47,canvas:0x9a3541,red:0xc64b3f,coral:0xae4839,metal:0x9aa1a4,dark:0x535a67,brass:0xc7a47c,teal:0x456764,glow:0xff793f}
    :id.includes('cult')?{wood:0x897467,darkWood:0x675754,canvas:0xa9a08d,ivory:0xe1d2b9,metal:0xa1a5a7,dark:0x555c69,brass:0xcbb28c,red:0xa52e40,glow:0xff693e}
    :id.includes('union')?{wood:0xad765c,darkWood:0x71524b,canvas:id.includes('repair')?0x8e3d43:0xc0af95,metal:0xa0a8a4,dark:0x4f5a61,teal:0x4d7877,red:0xa5473d,blue:0x8a3844,brass:0xc7a46e,glow:0xff663d}
    :id.includes('ghost')?{wood:0x927e72,darkWood:0x655e5f,canvas:0x8c969b,gray:0x9caab3,ivory:0xbac8c9,metal:0x93a7ae,dark:0x535c6c,brass:0x819493,teal:0x456b72,glow:0x65e2ed,coldGlow:0x65e2ed}
    :{wood:0x96725c,darkWood:0x66524d,canvas:0x9d8c76,gray:0x8c8c87,metal:0x969e9d,dark:0x515b61,brass:0xbaa074,teal:0x3d6464,red:0x963d35,glow:0xff7c3c};
  for(const [key,color]of Object.entries(colors))if(m[key]?.color)m[key].color.setHex(color);
  m.blood=m.red.clone();m.blood.color.setHex(id.includes('ghost')?0x557f88:0xb74342);m.blood.name='villain painted crimson';
  m.bone=m.ivory.clone();m.bone.color.setHex(0xddd2b6);m.bone.name='villain painted old ivory';
  m.warning=m.canvas.clone();m.warning.color.setHex(0xd8a94f);m.warning.name='villain worn warning ochre';
  m.iron=m.metal.clone();m.iron.color.setHex(id.includes('ghost')?0x8498a2:0x656c77);m.iron.name='villain forged iron';
  m.evilGlow=new THREE.MeshBasicMaterial({color:id.includes('ghost')?0x65e2ed:0xff6849,toneMapped:false});m.evilGlow.name='villain residual warning lantern';
  return m;
}

export function blade(parent,material,name,points,depth=.14,at=[0,0,0],rot=[0,0,0]) {
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,steps:1});
  return mesh(parent,geometry,material,name,at,rot);
}
export function spike(parent,material,name,from,to,radius=.16) {
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),d=b.clone().sub(a),node=mesh(parent,new THREE.ConeGeometry(radius,d.length(),5),material,name,a.add(b).multiplyScalar(.5).toArray());
  node.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return node;
}
export function chain(parent,m,name,points,links=12) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  for(let i=0;i<links;i++){const g=new THREE.TorusGeometry(.115,.032,5,10);g.scale(1,1.35,1);mesh(parent,g,i%4?m.iron:m.brass,name+'-'+i,curve.getPoint(i/(links-1)).toArray(),[0,i%2?Math.PI/2:0,0]);}
}
export function eye(parent,m,name,at,size=[.9,.12,.1],rotation=[0,0,-.17]) {
  box(parent,m.iron,name+'-socket',at,[size[0]*1.25,size[1]*2.8,size[2]*1.15],rotation);
  return box(parent,m.evilGlow,name+'-slit',[at[0],at[1],at[2]+Math.sign(at[2]||1)*size[2]*.58],size,rotation);
}
export function describe(built,theme,features) {
  built.villainTheme=theme;built.features=[...built.features,...features];
  built.referenceNotes+=' 악당 외형v2: '+theme+'. 장식·색·과장된 구조의 아트 제안이며 실제 무장/피해/충돌/AI 수치 변경 없음.';
  return built;
}
