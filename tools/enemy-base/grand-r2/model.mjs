import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildFortress as buildBaseline } from '../fortress.mjs';

// GRAND r2: original volumetric additions, preserving the frozen r1 source.
// Latest art direction is expressed through load-bearing mass, layered armor,
// asymmetric industry and broad cloth fields; no numeric scale claim is made.
export function buildFortress() {
  const { root, zones } = buildBaseline();
  const palette = { iron:'#25373d', edge:'#41565a', shadow:'#15272d',
    teal:'#285c60', oxblood:'#662e35', brass:'#ac874c', bright:'#d5ae67',
    cloth:'#8e3439', patch:'#b14b43', stitch:'#c9b486', warm:'#efa455' };
  const buckets = new Map(), mats = new Map();
  let additions = 0;
  const v = a => new THREE.Vector3(...a);
  const frac = x => x-Math.floor(x);
  function add(g,key,zone,p=[0,0,0],r=[0,0,0],s=[1,1,1]) {
    if(g.index) { const old=g; g=g.toNonIndexed();old.dispose(); }
    g.applyMatrix4(new THREE.Matrix4().compose(v(p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),v(s)));
    if(!g.attributes.normal)g.computeVertexNormals();
    const ps=g.attributes.position, ns=g.attributes.normal, c=new THREE.Color(palette[key]);
    const colors=new Float32Array(ps.count*3);
    for(let i=0;i<ps.count;i+=3){
      const nx=(ns.getX(i)+ns.getX(i+1)+ns.getX(i+2))/3;
      const ny=(ns.getY(i)+ns.getY(i+1)+ns.getY(i+2))/3;
      const nz=(ns.getZ(i)+ns.getZ(i+1)+ns.getZ(i+2))/3;
      const len=Math.hypot(nx,ny,nz)||1, light=(-nx*.35+ny*.82+nz*.45)/len;
      const band=light>.52?1.12:light>.04?.95:.73;
      const x=ps.getX(i),y=ps.getY(i),z=ps.getZ(i);
      const brush=.95+.055*frac(Math.sin(Math.floor(x*1.8)*17.2+Math.floor(y*3.1)*32.4+Math.floor(z*2.1)*11.7)*43758.5)+.018*Math.sin(x*5.1+y*.23+z*1.4);
      for(let j=0;j<3;j++){colors[(i+j)*3]=Math.min(1,c.r*band*brush);colors[(i+j)*3+1]=Math.min(1,c.g*band*brush);colors[(i+j)*3+2]=Math.min(1,c.b*band*brush);}
    }
    for(const a of Object.keys(g.attributes))if(!['position','normal'].includes(a))g.deleteAttribute(a);
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const id=zone+'/'+key;if(!buckets.has(id))buckets.set(id,[]);buckets.get(id).push(g);additions++;
  }
  const box=(zone,key,x,y,z,w,h,d,rz=0,ry=0)=>add(new THREE.BoxGeometry(w,h,d,2,2,2),key,zone,[x,y,z],[0,ry,rz]);
  const cyl=(zone,key,x,y,z,rt,rb,h,n=16,rot=[0,0,0])=>add(new THREE.CylinderGeometry(rt,rb,h,n,2),key,zone,[x,y,z],rot);
  const torus=(zone,key,x,y,z,r,t,rot=[Math.PI/2,0,0])=>add(new THREE.TorusGeometry(r,t,6,32),key,zone,[x,y,z],rot);
  function beam(zone,key,a,b,w,d=w){const delta=v(b).sub(v(a));const g=new THREE.BoxGeometry(w,delta.length(),d,2,2,2);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...v(a).add(v(b)).multiplyScalar(.5).toArray());add(g,key,zone);}
  function plate(zone,key,points,depth,z){
    let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}
    const ordered=area<0?[...points].reverse():points;
    const shape=new THREE.Shape();shape.moveTo(...ordered[0]);for(const p of ordered.slice(1))shape.lineTo(...p);shape.closePath();
    add(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.09,bevelSize:.09,bevelSegments:1,curveSegments:1}),key,zone,[0,0,z-depth/2]);
  }

  // 1. Two massive stepped shoulder citadels: they connect the tall keep to
  // the hull instead of appearing as free-standing duplicate roofed houses.
  for(const side of [-1,1]){
    const x=side*11.5, z=side<0?-2.7:-3.8, top=side<0?15.4:13.9;
    cyl('keep','shadow',x,7.0,z,4.55,5.35,6.4,8);
    cyl('keep','iron',x,10.4,z,4.25,4.65,6.0,8);
    cyl('keep','teal',x,top-1.8,z,3.8,4.25,3.6,8);
    for(const [yy,rr] of [[4.4,5.15],[7.9,4.9],[10.0,4.55],[top,4.2]]){
      cyl('keep','shadow',x,yy,z,rr,rr,.5,8);
      cyl('keep','brass',x,yy+.30,z,rr+.04,rr+.04,.14,8);
    }
    // Heavy rampart crown, warm vent slits and recessed oxblood armor panels.
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+Math.PI/8, xx=x+Math.cos(a)*4,zz=z+Math.sin(a)*4;
      box('keep','iron',xx,top+.65,zz,1.35,1.65,1.2,0,-a);
      box('keep','brass',xx,top+1.5,zz,1.48,.16,1.3,0,-a);
      const px=x+Math.cos(a)*4.31,pz=z+Math.sin(a)*4.31;
      box('keep','shadow',px,11.0,pz,1.9,2.1,.25,0,Math.PI/2-a);
      box('keep','warm',px+Math.cos(a)*.15,11.0,pz+Math.sin(a)*.15,.26,1.5,.12,0,Math.PI/2-a);
    }
    // Structural flying buttress cheeks are closed extrusions, 3.2 units deep.
    const profile=[[side*6.2,18.2],[side*8.8,17.2],[side*16.6,4.1],[side*14.4,1.9],[side*11.6,7.7],[side*8.0,13.4]];
    for(const zz of [z-2.9,z+2.9]){
      plate('keep','shadow',profile,1.25,zz);
      beam('keep','edge',[side*6.7,17.7,zz+.7],[side*15.8,3.6,zz+.7],.48,.35);
      beam('keep','brass',[side*7,17.6,zz+.91],[side*15.5,4.1,zz+.91],.15,.13);
      for(let k=0;k<5;k++){const t=(k+.5)/5;box('keep','iron',side*(7.2+8*t),17-12.5*t,zz,2.2,.65,1.55,side*.53);}
    }
    // Broad load-bearing armored gallery between shoulder and central keep.
    box('keep','oxblood',side*7.2,12.9,z,3.7,4.0,4.3);
    box('keep','shadow',side*7.2,15.0,z,4.3,.55,4.9);
    box('keep','brass',side*7.2,15.31,z,4.35,.13,4.95);
  }

  // 2. Main keep armor. Preserve the original windows and roof silhouette,
  // using broad painted fields and diagonal girders over the blank plaster.
  for(const z of [1.85,-5.85]){
    for(const x of [-4.9,-1.65,1.6]){
      box('keep',x===-1.65?'teal':'oxblood',x,13.2,z,2.15,3.0,.22);
      beam('keep','shadow',[x-1.2,10.0,z+.18],[x+1.2,15.0,z+.18],.36,.32);
      box('keep','iron',x-1.25,10.3,z,.38,11.3,.46);
    }
    for(const y of [6.0,10.0,15.3]){
      box('keep','shadow',-1.4,y,z,9.7,.48,.7);
      box('keep','brass',-1.4,y+.27,z+.07,9.8,.12,.75);
    }
  }
  for(const side of [-1,1])beam('bell_tower','iron',[1.9+side*2.6,15.2,-1.7],[1.9+side*2.0,21.1,-1.7],.48,.65);

  // 3. Monumental portcullis collar: thick side pylons and stepped shoulders,
  // an open central passage and a heavy armored brow, never a filled doorway.
  for(const side of [-1,1]){
    box('dock','shadow',side*4.45,8.1,9.7,2.6,8.0,3.5);
    box('dock','iron',side*4.45,9.1,11.5,2.4,6.1,.65);
    box('dock','teal',side*4.45,9.6,11.9,1.4,3.2,.24);
    box('dock','brass',side*4.45,6.1,11.92,2.65,.30,.38);
    box('dock','brass',side*4.45,11.9,11.9,2.65,.23,.4);
    for(let k=0;k<3;k++)box('dock','iron',side*(4.1+k*.58),12.8-k*.65,9.7,1.7,1.7,3.9);
    cyl('dock','brass',side*4.45,8.7,12.13,.56,.56,.38,12,[Math.PI/2,0,0]);
    cyl('dock','shadow',side*4.45,8.7,12.4,.27,.27,.19,8,[Math.PI/2,0,0]);
  }
  box('dock','shadow',0,12.6,9.7,9.1,2.1,3.7);
  box('dock','oxblood',0,12.75,11.65,6.0,1.4,.3);
  box('dock','brass',0,13.8,9.7,9.8,.22,4.1);
  for(const x of [-3,-1.5,0,1.5,3]){
    box('dock','iron',x,14.3,9.7,.85,1.0,3.5);
    cyl('dock','brass',x,15.05,11.1,0,.26,.7,5);
  }
  for(let i=0;i<5;i++)box('dock','iron',0,4.50+i*.13,16.8-i*.75,7.25,.12,.7);

  // 4. A deep rear furnace-house: a separate industrial silhouette, with
  // asymmetric exhaust towers, vented armor and real dimensional pipe runs.
  box('machinery','shadow',1.0,8.1,-10.1,11.6,8.2,6.2);
  box('machinery','oxblood',1.0,9.7,-13.28,10.0,4.6,.35);
  box('machinery','iron',1.0,12.5,-10.3,12.7,.8,7.1);
  box('machinery','teal',1.0,13.2,-10.3,10.8,.7,6.3);
  for(const x of [-4,-1.5,1,3.5,6]){
    box('machinery','iron',x,8.6,-13.6,.6,8.1,.8);
    box('machinery','brass',x,12.4,-13.8,.9,.23,1.0);
  }
  for(const x of [-2.8,.9,4.6]){
    box('machinery','shadow',x,8.8,-13.65,2.6,3.25,.4);
    box('machinery','warm',x,8.7,-13.9,1.8,2.35,.13);
    for(let j=0;j<5;j++)box('machinery','iron',x,7.65+j*.47,-14.02,2.4,.23,.23);
  }
  for(const [x,z,h,r] of [[-3,-10.5,23,1.2],[4.7,-10.7,19.5,1.55],[.8,-11.4,17,1.0]]){
    cyl('machinery','shadow',x,(13+h)/2,z,r,r*1.23,h-13,12);
    for(const yy of [13.6,h-1.2,h]){
      cyl('machinery','iron',x,yy,z,r*1.24,r*1.24,.55,12);
      torus('machinery','brass',x,yy+.28,z,r*1.22,.12);
    }
    cyl('machinery','shadow',x,h+.3,z,r*.9,r*.9,.1,12);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;box('machinery','edge',x+Math.cos(a)*r,h+.45,z+Math.sin(a)*r,.25,.8,.3,0,-a);}
  }
  for(const side of [-1,1]){
    beam('machinery','iron',[side*8,4.1,-9.2],[side*6.7,11.9,-9.2],.9,1.1);
    const curve=new THREE.CatmullRomCurve3([[side*11,5,-7],[side*11,10,-8],[side*8,14,-9],[side*6,14,-10]].map(v));
    add(new THREE.TubeGeometry(curve,28,.4,8,false),'brass','machinery');
  }

  // 5. Large sewn standards. Closed thin solids with differently torn tails,
  // wave displacement, raised seams and an original interlocking stitch mark.
  function standard(x,y,z,w,h,angle,variant){
    const nx=24,ny=56,depth=.09,positions=[],indices=[];
    const local=(u,t,offset=0)=>{
      const tail=(.28*Math.pow(Math.sin(u*Math.PI*3+variant*.7),8)+.12*u)*Math.pow(t,12);
      const yy=-h*t+h*tail,xx=(u-.5)*w;
      const zz=Math.sin(u*Math.PI*2+t*3.1+variant)*.36+Math.sin(t*6.0)*.18+offset;
      return [x+xx*Math.cos(angle)+zz*Math.sin(angle),y+yy,z-xx*Math.sin(angle)+zz*Math.cos(angle)];
    };
    for(const side of [-1,1])for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)positions.push(...local(i/nx,j/ny,side*depth/2));
    const row=nx+1,layer=row*(ny+1);
    const quad=(a,b,c,d)=>indices.push(a,b,d,b,c,d);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const a=j*row+i,b=a+1,c=b+row,d=a+row;
      quad(a,d,c,b);quad(a+layer,b+layer,c+layer,d+layer);
    }
    for(let i=0;i<nx;i++){quad(i,i+1,i+1+layer,i+layer);const a=ny*row+i;quad(a,a+layer,a+1+layer,a+1);}
    for(let j=0;j<ny;j++){const a=j*row,b=a+row;quad(a,a+layer,b+layer,b);const c=a+nx,d=c+row;quad(c,d,d+layer,c+layer);}
    // Reverse the shell's initial inward construction: exterior winding must
    // remain correct with single-sided materials in engines and GLB viewers.
    for(let i=0;i<indices.length;i+=3){const t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,'cloth','banners');
    beam('banners','shadow',local(-.08,0),local(1.08,0),.22,.22);
    for(const u of [.055,.945])for(let j=0;j<22;j++)beam('banners','stitch',local(u,j/23,.10),local(u+.025,(j+.56)/23,.10),.065,.065);
    const strokes=[[[.28,.22],[.72,.60]],[[.72,.22],[.28,.60]],[[.50,.17],[.50,.67]],[[.25,.41],[.75,.41]]];
    for(const [a,b] of strokes){for(let j=0;j<12;j++){const t=j/12,q=(j+1)/12;beam('banners','stitch',local(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,.12),local(a[0]+(b[0]-a[0])*q,a[1]+(b[1]-a[1])*q,.12),.13,.09);}}
  }
  standard(-12.1,18.0,2.15,3.9,12.0,-.12,0);
  standard(12.5,16.9,1.1,4.4,10.8,.18,1);
  standard(-6.0,17.4,-9.0,3.1,10.6,Math.PI-.23,2);
  standard(5.6,20.0,-7.8,3.0,10.0,Math.PI+.18,3);

  for(const [id,gs] of buckets){
    const [zone,key]=id.split('/');
    if(!mats.has(key)){const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1,metalness:0});m.name='grand_paint_'+key;m.userData={palette:palette[key],finish:'matte three-band vertex-painted'};mats.set(key,m);}
    const merged=mergeGeometries(gs,false);if(!merged)throw new Error('Grand geometry merge failed: '+id);
    merged.normalizeNormals();merged.computeBoundingBox();merged.computeBoundingSphere();
    const mesh=new THREE.Mesh(merged,mats.get(key));mesh.name=zone+'__grand_'+key;mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={semantic_zone:zone,paint:key,authored_components:gs.length,revision:'grand-r2'};
    const group=root.getObjectByName(zone);group.add(mesh);group.userData.triangles=(group.userData.triangles||0)+merged.attributes.position.count/3;
    gs.forEach(g=>g.dispose());
  }
  root.userData={...root.userData,revision:2,revision_label:'grand-r2',authored_components:(root.userData.authored_components||0)+additions,
    art_changes:'Load-bearing shoulder citadels, layered armor and braces, monumental gate collar, deep rear furnace, closed torn standards; baked three-band matte shading.',
    review_status:'Source geometry validated; visual comparison and human art approval required.'};
  root.updateMatrixWorld(true);return {root,zones};
}
