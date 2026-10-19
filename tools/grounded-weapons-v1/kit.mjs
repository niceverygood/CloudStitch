import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };

export const PALETTE = Object.freeze({
  honey:0xb9824c,wood:0xb9824c,woodLight:0xd7aa70,woodDark:0x73503a,
  cream:0xe7dbb8,ivory:0xf8edce,teal:0x3b7b7b,lightTeal:0x74a5a0,deepTeal:0x285259,
  brass:0xc58e3e,amber:0xe0b05d,copper:0xb87545,coral:0xc96c54,
  steel:0x68757b,iron:0x3f4c54,navy:0x344952,ink:0x263d42,black:0x293439,
  rope:0xcebd91,leather:0x8d5940,sage:0x9ea883,green:0x718f71,blue:0x719fa8,
  gold:0xc58e3e,silver:0x9aa9a9,white:0xf5ecd2
});

// Original editable meshes. Painted variation is stored in glTF COLOR_0;
// no account assets, generated-image textures or shader tricks are required.
export function makeKit(spec) {
  let serial=0;
  const seed=[...spec.id].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261)>>>0;
  let state=seed;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const root=new THREE.Group();root.name=spec.id;
  root.userData={asset_id:spec.id,title:'Cloudstitch',coordinates:'+Y up, +Z front',
    units:'relative design units, final engine scale not approved',
    status:'static multipart art prototype',source_reference:'fantasy-weapon-moodboard-v2',
    limitations:'No collider, animation, damage, physics, LOD or approved engine sockets.'};
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:0,side:THREE.DoubleSide});
  material.name='Cloudstitch matte vertex paint';
  const place=(m,pos=[0,0,0])=>{m.position.set(...pos);return m;};
  function group(name='part',parent=root){const g=new THREE.Group();g.name=`${spec.id}_${name}_${serial++}`;parent.add(g);return g;}
  function mesh(name,geometry,color=PALETTE.honey,parent=root){
    const g=geometry.index?geometry.toNonIndexed():geometry.clone();
    g.deleteAttribute('uv');g.deleteAttribute('uv1');g.deleteAttribute('uv2');
    if(!g.getAttribute('normal'))g.computeVertexNormals();
    const p=g.getAttribute('position'),n=g.getAttribute('normal'),values=new Float32Array(p.count*3),base=new THREE.Color(color);
    const phase=random()*9;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      // Broad painted light bands and a faint continuous brush wash. Adjacent
      // vertices share the same field, avoiding confetti-like face colors.
      const light=n.getX(i)*-.27+n.getY(i)*.81+n.getZ(i)*.38;
      const band=light>.48?1.03:light>-.17?.92:.77;
      const wash=.98+.018*Math.sin(x*8.4+z*4.1+phase)+.012*Math.sin(y*21+phase);
      const c=base.clone().multiplyScalar(band*wash);
      values[i*3]=THREE.MathUtils.clamp(c.r,0,1);values[i*3+1]=THREE.MathUtils.clamp(c.g,0,1);values[i*3+2]=THREE.MathUtils.clamp(c.b,0,1);
    }
    g.setAttribute('color',new THREE.BufferAttribute(values,3));
    const m=new THREE.Mesh(g,material);m.name=`${spec.id}_${name}_${serial++}`;parent.add(m);return m;
  }
  const box=(name,size,pos,color,parent=root)=>place(mesh(name,new THREE.BoxGeometry(...size),color,parent),pos);
  function bevelBox(name,size,pos,color,parent=root){return place(mesh(name,new RoundedBoxGeometry(...size,1,Math.max(.002,Math.min(...size)*.11)),color,parent),pos);}
  const cylinder=(name,rTop,rBottom,h,pos,color,parent=root,segments=16)=>place(mesh(name,new THREE.CylinderGeometry(rTop,rBottom,h,segments),color,parent),pos);
  const cone=(name,r,h,pos,color,parent=root,segments=16)=>place(mesh(name,new THREE.ConeGeometry(r,h,segments),color,parent),pos);
  function sphere(name,r,pos,color,parent=root,scale=null){const m=place(mesh(name,new THREE.SphereGeometry(r,16,10),color,parent),pos);if(scale)m.scale.set(...scale);return m;}
  function ring(name,r,t,pos,color,parent=root){const geo=new THREE.TorusGeometry(r,t,6,32);geo.rotateX(Math.PI/2);return place(mesh(name,geo,color,parent),pos);}
  function tube(name,points,r,color,parent=root,closed=false){
    if(points.length<2)throw new Error('Tube needs two points: '+name);
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    return mesh(name,new THREE.TubeGeometry(curve,Math.min(128,Math.max(8,points.length*5)),r,6,closed),color,parent);
  }
  function rope(name,points,parent=root){return tube(name,points,.019,PALETTE.rope,parent);}
  function bolt(name,pos,parent=root){const g=place(group(name,parent),pos);cylinder('hex_bolt',.033,.033,.023,[0,.0115,0],PALETTE.brass,g,6);box('cut_slot',[.038,.004,.007],[0,.025,0],PALETTE.woodDark,g);return g;}
  function paintWood(name,size,pos,parent=root){
    const g=place(group(name,parent),pos),[w,h,d]=size;
    bevelBox('rounded_timber',size,[0,0,0],PALETTE.honey,g);
    for(let i=0;i<3;i++){
      const a=w*(.54+random()*.25),z=(i-1)*d*.25;
      tube('top_brushed_grain',[[-a*.5,h*.5+.002,z],[0,h*.5+.003,z+.008],[a*.5,h*.5+.002,z-.004]],.0035,i===1?PALETTE.woodLight:PALETTE.woodDark,g);
    }
    for(let i=0;i<2;i++){
      const y=(i-.5)*h*.4;
      tube('front_grain',[[-w*.36,y,d*.5+.002],[0,y+.008,d*.5+.003],[w*.36,y-.004,d*.5+.002]],.003,PALETTE.woodLight,g);
    }
    return g;
  }
  function beam(name,a,b,w=.14,d=.14,color=PALETTE.honey,parent=root){
    const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),delta=B.clone().sub(A),len=delta.length();
    if(len<1e-6)throw new Error('Zero length beam '+name);
    const midpoint=A.clone().add(B).multiplyScalar(.5);
    const g=color===PALETTE.honey||color===PALETTE.wood?paintWood(name,[w,len,d],midpoint.toArray(),parent):place(group(name,parent),midpoint.toArray());
    if(color!==PALETTE.honey&&color!==PALETTE.wood)bevelBox('solid_brace',[w,len,d],[0,0,0],color,g);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return g;
  }
  function deck(name,w,d,pos,parent=root){
    const g=place(group(name,parent),pos),count=Math.max(3,Math.ceil(w/.26)),step=w/count;
    for(let i=0;i<count;i++){
      const x=-w*.5+(i+.5)*step;
      const plank=paintWood('deck_plank',[d,.1,step*.96],[x,0,0],g);plank.rotation.y=Math.PI/2;
    }
    for(const s of[-1,1]){
      bevelBox('teal_end_cap',[w+.06,.12,.065],[0,0,s*(d*.5+.01)],PALETTE.teal,g);
      bevelBox('cross_bearer',[.10,.18,d+.08],[s*w*.37,-.08,0],PALETTE.woodDark,g);
      for(const z of[-d*.38,d*.38])bolt('mount_bolt',[s*w*.4,.055,z],g);
    }
    return g;
  }
  function cloth(name,w,d,pos,parent=root){
    const g=place(group(name,parent),pos),nx=8,nz=7,vertices=[],indices=[];
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/nz;vertices.push((u-.5)*w,-Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*Math.min(w,d)*.10,(v-.5)*d);}
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);mesh('stitched_canvas',geo,PALETTE.cream,g);
    box('coral_mended_patch',[w*.21,.012,d*.22],[w*.23,-Math.min(w,d)*.045,d*.19],PALETTE.coral,g);
    for(const s of[-1,1])for(let i=0;i<8;i++)box('edge_stitch',[.008,.008,d*.035],[s*w*.47,0,(i/7-.5)*d*.87],PALETTE.woodLight,g);
    return g;
  }
  function gear(name,r,teeth,pos,color=PALETTE.brass,parent=root){
    const g=place(group(name,parent),pos);cylinder('gear_hub',r*.82,r*.82,.07,[0,0,0],color,g,32);
    for(let i=0;i<teeth;i++){const a=i/teeth*Math.PI*2,m=bevelBox('gear_tooth',[r*.22,.075,r*.24],[Math.sin(a)*r,0,Math.cos(a)*r],color,g);m.rotation.y=a;}
    cylinder('axle',r*.16,r*.16,.13,[0,0,0],PALETTE.iron,g,12);return g;
  }
  function strap(name,size,pos,parent=root){const g=place(group(name,parent),pos);bevelBox('teal_iron_band',size,[0,0,0],PALETTE.teal,g);for(const s of[-1,1])bolt('brass_pin',[size[0]*.34*s,size[1]*.5+.002,0],g);return g;}
  return {THREE,root,palette:PALETTE,material,group,mesh,box,bevelBox,cylinder,cone,sphere,ring,tube,rope,bolt,paintWood,beam,deck,cloth,gear,strap,random,place};
}
