/**
 * Cloudstitch · The Mended Reach
 * Procedural, local-only environment for the first aerial combat prototype.
 * X/Z is the flight plane. Ships fly at Y=0; terrain remains below it.
 * Distances are prototype units, not the design documents' finalized U scale.
 */
export function createWorld(THREE) {
  const group = new THREE.Group();
  group.name = 'Cloudstitch — The Mended Reach';
  const resources = new Set();
  const animated = [];
  const random = seeded(84731);
  const C = {
    rock: '#a99a82', rockDark: '#756d63', rockLight: '#c6b69a',
    chalk: '#ebd8b2', grass: '#a4b279', grassLight: '#c2c58c',
    grassDark: '#738c74', teal: '#397b79', tealLight: '#71a19a',
    tealDark: '#285659', honey: '#c89a5a', wood: '#a87443',
    woodDark: '#71553d', brass: '#d4ad62', cream: '#f7e7bd',
    coral: '#cb795f', coralLight: '#e59b7b', slate: '#46615f',
    window: '#efcf88', flower: '#edd8aa', cloud: '#f7ead2',
  };

  // One vertex-color material and one merged static mesh keep the islands,
  // grass, buildings and fine wooden details inexpensive to draw.
  const ramp = new THREE.DataTexture(new Uint8Array([90, 152, 205, 255]), 4, 1, THREE.RedFormat);
  ramp.needsUpdate = true;
  ramp.magFilter = ramp.minFilter = THREE.NearestFilter;
  resources.add(ramp);
  const paint = keep(new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: ramp, side: THREE.DoubleSide,
  }));
  const batch = new PainterBatch(THREE, random);
  const primitives = {
    box: keep(new THREE.BoxGeometry(1, 1, 1)),
    cylinder: keep(new THREE.CylinderGeometry(1, 1, 1, 10)),
    cone: keep(new THREE.ConeGeometry(1, 1, 9)),
    sphere: keep(new THREE.IcosahedronGeometry(1, 1)),
  };

  function keep(value) { resources.add(value); return value; }
  function item(geometry, color, x, y, z, sx=1, sy=1, sz=1, rx=0, ry=0, rz=0, builder=batch) {
    builder.add(geometry, color, [x,y,z], [sx,sy,sz], [rx,ry,rz]);
  }
  function box(color, x,y,z, sx,sy,sz, ry=0, builder=batch) {
    item(primitives.box,color,x,y,z,sx,sy,sz,0,ry,0,builder);
  }
  function ball(color,x,y,z,sx,sy=sx,sz=sx,builder=batch) {
    item(primitives.sphere,color,x,y,z,sx,sy,sz,0,random()*Math.PI,0,builder);
  }
  function cylinder(color,x,y,z,r,h,rx=0,rz=0,builder=batch) {
    item(primitives.cylinder,color,x,y,z,r,h,r,rx,0,rz,builder);
  }
  function beam(color,a,b,width=.16,builder=batch) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    const center = av.clone().add(bv).multiplyScalar(.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());
    const matrix = new THREE.Matrix4().compose(center,q,new THREE.Vector3(width,new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)),width));
    builder.addMatrix(primitives.cylinder,color,matrix);
  }

  const islands = [
    // The harbor apron is clear at the requested (0,48) return point.
    {x:0,z:58,rx:17,rz:14,top:-5.1,depth:16,seed:1,kind:'harbor'},
    {x:-15,z:-5,rx:10.5,rz:13.5,top:-5.0,depth:23,seed:2,kind:'ruin'},
    {x:40,z:5,rx:13,rz:10,top:-6.0,depth:22,seed:3,kind:'mill'},
    {x:-49,z:26,rx:18,rz:12.5,top:-7.0,depth:25,seed:4,kind:'garden'},
    {x:-51,z:-48,rx:13,rz:11,top:-7.0,depth:24,seed:5,kind:'ruin'},
    {x:44,z:-64,rx:17.5,rz:13,top:-8.0,depth:28,seed:6,kind:'mill'},
    {x:-8,z:-77,rx:10,rz:8,top:-6.5,depth:18,seed:7,kind:'beacon'},
    {x:73,z:43,rx:13,rz:10,top:-9,depth:24,seed:8,kind:'garden'},
    {x:-78,z:-8,rx:10,rz:8.5,top:-9,depth:22,seed:9,kind:'garden'},
  ];

  const obstacles = islands.filter(i=>i.kind!=='harbor').map(i=>({
    x:i.x,z:i.z,radius:Math.min(i.rx,i.rz)*.8,
  }));
  const landmarks = [
    {id:'harbor',label:'수선항',x:0,z:48,radius:10,type:'harbor'},
    {id:'old-arch',label:'부서진 바람문',x:-15,z:-5,radius:12,type:'cover'},
    {id:'windmill',label:'청록 풍차섬',x:40,z:5,radius:11,type:'cover'},
    {id:'garden',label:'떠돌이 정원',x:-49,z:26,radius:15,type:'scenery'},
    {id:'north-beacon',label:'먼바람 등대',x:-8,z:-77,radius:8,type:'beacon'},
  ];

  for (const island of islands) {
    makeIsland(island);
    decorate(island);
  }
  // Low-contrast distant islands complete the horizon while remaining outside
  // the +/-95 flight boundary. They never enter collision or mission lists.
  for (const [x,z,rx,rz] of [[-115,-87,24,14],[110,-119,31,17],[-74,-135,19,11],[129,29,20,13]]) {
    makeIsland({x,z,rx,rz,top:-22,depth:26,seed:Math.abs(x),distant:true});
    for(let j=0;j<5;j++) {
      const px=x+(random()-.5)*rx, pz=z+(random()-.5)*rz;
      cylinder('#a3ae9b',px,-18,pz,.7+random(),8+random()*8);
      item(primitives.cone,'#78978e',px,-12,pz,1.7,4,1.7);
    }
  }

  makeHarbor();
  makeNavigationBuoys();
  const staticGeometry = keep(batch.finish());
  const staticMesh = new THREE.Mesh(staticGeometry,paint);
  staticMesh.name = 'Merged painted islands, harbor, vegetation and ruins';
  staticMesh.receiveShadow = true;
  staticMesh.castShadow = false;
  group.add(staticMesh);

  const clouds = makeCloudSea();
  const wind = makeWindLines();
  const birds = makeBirds();

  function makeIsland(i) {
    const local = seeded(1909+i.seed*319);
    const n=14;
    const offsets=Array.from({length:n},()=>.87+local()*.2);
    const colors=i.distant?['#a9b5aa','#98aaa1','#829e96']: [C.chalk,C.rockLight,C.rock,C.rockDark];
    const rings=[
      {y:i.top-.15,s:1,ox:0,oz:0},
      {y:i.top-2,s:1.035,ox:0,oz:0},
      {y:i.top-i.depth*.44,s:.73,ox:i.rx*.06,oz:-i.rz*.03},
      {y:i.top-i.depth*.82,s:.31,ox:-i.rx*.08,oz:i.rz*.05},
      {y:i.top-i.depth,s:.05,ox:i.rx*.04,oz:0},
    ];
    const points=rings.map((r,ri)=>Array.from({length:n},(_,k)=>{
      const angle=k/n*Math.PI*2;
      return [i.x+Math.cos(angle)*i.rx*r.s*offsets[k]+r.ox,
        r.y+(ri>0? (local()-.5)*1.3 : (local()-.5)*.25),
        i.z+Math.sin(angle)*i.rz*r.s*offsets[k]+r.oz];
    }));
    for(let ri=0;ri<rings.length-1;ri++) {
      for(let k=0;k<n;k++) {
        const a=points[ri][k],b=points[ri][(k+1)%n],c=points[ri+1][k],d=points[ri+1][(k+1)%n];
        const base=colors[Math.min(ri,colors.length-1)];
        batch.triangle(a,b,c,base,.12);
        batch.triangle(b,d,c,base,.12);
      }
    }
    const grass=i.distant?'#b2bca4':C.grass;
    for(let k=0;k<n;k++) {
      const a=points[0][k],b=points[0][(k+1)%n];
      batch.triangle([i.x,i.top+.02,i.z],b,a,grass,.085);
      const inner=a.map((v,c)=>c===1?i.top+.035:(v-(c===0?i.x:i.z))*.78+(c===0?i.x:i.z));
      const innerB=b.map((v,c)=>c===1?i.top+.035:(v-(c===0?i.x:i.z))*.78+(c===0?i.x:i.z));
      batch.triangle(inner,innerB,[i.x,i.top+.06,i.z],i.distant?grass:C.grassLight,.055);
    }
    if(i.distant) return;
    // Exposed strata break up the regular taper, in place of PBR rock textures.
    for(let k=0;k<8;k++) {
      const a=local()*Math.PI*2;
      const r=.6+local()*.25;
      ball(k%3===0?C.rockLight:C.rock,
        i.x+Math.cos(a)*i.rx*r,i.top-4-local()*5,i.z+Math.sin(a)*i.rz*r,
        1+local()*2.6,2+local()*3,1.4+local()*1.3);
    }
    // Small grass tufts and wildflowers use only simple painted triangles.
    for(let j=0;j<42;j++) {
      const a=local()*Math.PI*2,r=Math.sqrt(local())*.82;
      const x=i.x+Math.cos(a)*i.rx*r,z=i.z+Math.sin(a)*i.rz*r;
      if(i.kind==='harbor' && Math.abs(x)<8 && z<57) continue;
      const h=.22+local()*.4,w=.14+local()*.23;
      const color=j%6===0?C.flower:C.grassDark;
      batch.triangle([x-w,i.top+.06,z],[x,i.top+h,z],[x+w,i.top+.06,z],color,.05);
      if(j%4===0) batch.triangle([x,i.top+.06,z-w],[x,i.top+h*.8,z],[x,i.top+.06,z+w],C.grassDark,.05);
    }
  }

  function decorate(i) {
    const local=seeded(i.seed*103+19);
    if(i.kind==='harbor') return;
    for(let j=0;j<(i.kind==='garden'?8:4);j++) {
      const angle=local()*Math.PI*2;
      const r=.4+local()*.35;
      tree(i.x+Math.cos(angle)*i.rx*r,i.top,i.z+Math.sin(angle)*i.rz*r,1.2+local()*.9,local()>.5);
    }
    if(i.kind==='mill') {
      windmill(i.x-2,i.top,i.z-1,1.15);
      house(i.x+4,i.top+.1,i.z+2,2.4,2.5,2.4,-.13,C.cream);
      laundry(i.x+1,i.top+2.2,i.z+5,i.x+7,i.top+2.1,i.z+5.3);
      for(let j=0;j<5;j++) box(C.wood,i.x-5+j*.8,i.top+.28,i.z+4,.6,.4,2.4,.08);
    }
    if(i.kind==='ruin') {
      const xx=i.x,zz=i.z;
      arch(xx,i.top,zz,4.6,7.8,1.25);
      for(let j=0;j<4;j++) {
        const x=xx-5+local()*10,z=zz-4+local()*8;
        box(j%2?C.rockLight:C.chalk,x,i.top+.3,z,.9+local(),.65,.85+local(),local());
      }
      // Ivy climbing the broken masonry has a stitched, graphic silhouette.
      for(let j=0;j<8;j++) ball(C.grassDark,xx-4.5+(local()-.5)*1.1,i.top+1+j*.47,zz+.8,.35,.42,.2);
      if(i.seed===2) {
        box(C.teal,xx+4.6,i.top+5.8,zz,1.8,.4,2.1);
        pennant(xx+4.9,i.top+7.4,zz,.9,C.coral);
      }
    }
    if(i.kind==='garden') {
      house(i.x-2,i.top,i.z+1,3.1,2.5,3.1,.12,C.chalk);
      for(let j=0;j<5;j++) {
        box(C.wood,i.x+2.8+j*.56,i.top+.24,i.z+3.4,.34,.35,3.2);
        for(let k=0;k<3;k++) ball(j%2?C.grass:C.grassDark,i.x+2.8+j*.56,i.top+.55,i.z+2.3+k*.9,.36,.31,.42);
      }
      laundry(i.x-6,i.top+2.6,i.z+4,i.x+1,i.top+2.5,i.z+5);
      fence(i.x-7,i.top,i.z-4,10,0);
    }
    if(i.kind==='beacon') {
      cylinder(C.chalk,i.x,i.top+3.2,i.z,1.55,6.4);
      cylinder(C.coral,i.x,i.top+3.6,i.z,1.57,.65);
      cylinder(C.woodDark,i.x,i.top+6.6,i.z,2,.3);
      cylinder(C.brass,i.x,i.top+7.35,i.z,1.25,1.3);
      cylinder(C.window,i.x,i.top+7.35,i.z,1.16,.9);
      item(primitives.cone,C.teal,i.x,i.top+8.65,i.z,2,1.6,2);
      pennant(i.x,i.top+10.5,i.z,1.2,C.coral);
      const lightMat=keep(new THREE.MeshBasicMaterial({color:'#ffe5a8',transparent:true,opacity:.16,depthWrite:false}));
      lightMat.userData.outlineParameters={visible:false};
      const glow=new THREE.Mesh(keep(new THREE.SphereGeometry(1.7,12,6)),lightMat);
      glow.position.set(i.x,i.top+7.35,i.z);
      group.add(glow);
      animated.push({kind:'glow',mesh:glow,base:.14});
    }
  }

  function tree(x,y,z,s=1,poplar=false) {
    const h=s*(poplar?3.6:2.1);
    cylinder(C.woodDark,x,y+h*.43,z,.13*s,h*.85);
    if(poplar) {
      ball(C.grassDark,x,y+h,z,.75*s,1.65*s,.7*s);
      ball(C.grass,x-.25*s,y+h+.42*s,z-.2*s,.53*s,1.05*s,.56*s);
    } else {
      ball(C.grassDark,x,y+h,z,1.27*s,1.05*s,1.18*s);
      ball(C.grass,x-.36*s,y+h+.38*s,z-.23*s,.94*s,.78*s,.86*s);
      ball(C.grassLight,x+.48*s,y+h+.25*s,z-.3*s,.65*s,.69*s,.7*s);
    }
  }

  function house(x,y,z,w,h,d,rot=0,color=C.cream) {
    const b=new PainterBatch(THREE,random);
    box(color,0,h/2,0,w,h,d,0,b);
    box(C.woodDark,0,.15,0,w+.2,.28,d+.2,0,b);
    // A real pitched roof, with a painted teal ridge and broad cream fascia.
    const roofPoints=[[-w*.62,h,-d*.6],[w*.62,h,-d*.6],[0,h+w*.43,-d*.6],
      [-w*.62,h,d*.6],[w*.62,h,d*.6],[0,h+w*.43,d*.6]];
    b.triangle(roofPoints[0],roofPoints[3],roofPoints[2],C.tealDark,.04);
    b.triangle(roofPoints[3],roofPoints[5],roofPoints[2],C.teal,.03);
    b.triangle(roofPoints[2],roofPoints[5],roofPoints[1],C.teal,.03);
    b.triangle(roofPoints[5],roofPoints[4],roofPoints[1],C.tealLight,.03);
    b.triangle(roofPoints[0],roofPoints[2],roofPoints[1],C.wood,.04);
    b.triangle(roofPoints[3],roofPoints[4],roofPoints[5],C.wood,.04);
    beam(C.chalk,roofPoints[3],roofPoints[5],.12,b);
    beam(C.chalk,roofPoints[4],roofPoints[5],.12,b);
    box(C.tealDark,0,h*.4,d*.505,.5,h*.8,.07,0,b);
    for(const side of [-1,1]) {
      box(C.woodDark,side*w*.29,h*.6,d*.51,.65,.77,.1,0,b);
      box(C.window,side*w*.29,h*.6,d*.57,.43,.54,.04,0,b);
      box(C.chalk,side*w*.29,h*.6,d*.6,.07,.58,.04,0,b);
    }
    box(C.chalk,w*.25,h+w*.12,-d*.2,.38,w*.55,.4,0,b);
    const geo=b.finish();
    batch.add(geo,'#ffffff',[x,y,z],[1,1,1],[0,rot,0],0);
    geo.dispose();
  }

  function arch(x,y,z,r,height,thick) {
    const stoneH=.92,legH=height-r;
    for(const side of [-1,1]) {
      for(let j=0;j<Math.floor(legH/stoneH);j++) box(j%3===0?C.chalk:C.rockLight,x+side*r,y+stoneH*(j+.5),z,1.2,stoneH*.94,thick);
      box(C.rock,x+side*r,y+.25,z,1.7,.5,thick*1.4);
    }
    for(let j=0;j<11;j++) {
      if(j===7||j===8) continue; // an intentionally broken crown
      const a=(j+.5)/11*Math.PI;
      item(primitives.box,j%3===0?C.chalk:C.rockLight,
        x+Math.cos(a)*r,y+legH+Math.sin(a)*r,z,
        1.18,.94,thick,0,0,a-Math.PI/2);
    }
  }

  function windmill(x,y,z,s) {
    const geo=keep(new THREE.CylinderGeometry(1.15,1.65,5,10));
    item(geo,C.chalk,x,y+2.5*s,z,s,s,s);
    cylinder(C.wood,x,y+.3,z,1.85*s,.6*s);
    item(primitives.cone,C.teal,x,y+5.6*s,z,2.05*s,1.9*s,2.05*s);
    box(C.woodDark,x,y+1.2*s,z+1.55*s,.7*s,1.8*s,.12);
    const bladeBatch=new PainterBatch(THREE,random);
    cylinder(C.brass,0,0,0,.4,.28,Math.PI/2,0,bladeBatch);
    for(let j=0;j<4;j++) {
      const a=j*Math.PI/2;
      const ex=Math.sin(a)*3.6*s,ey=Math.cos(a)*3.6*s;
      beam(C.woodDark,[0,0,0],[ex,ey,0],.12*s,bladeBatch);
      const perpendicular=[Math.cos(a),-Math.sin(a)];
      const p1=[ex*.31+perpendicular[0]*.13,ey*.31+perpendicular[1]*.13,.04];
      const p2=[ex+perpendicular[0]*.13,ey+perpendicular[1]*.13,.04];
      const p3=[ex+perpendicular[0]*.83*s,ey+perpendicular[1]*.83*s,.04];
      const p4=[ex*.31+perpendicular[0]*.48*s,ey*.31+perpendicular[1]*.48*s,.04];
      bladeBatch.triangle(p1,p2,p3,C.cream,.03);
      bladeBatch.triangle(p1,p3,p4,C.cream,.03);
      beam(C.honey,p2,p3,.055,bladeBatch);
    }
    const blades=new THREE.Mesh(keep(bladeBatch.finish()),paint);
    blades.position.set(x,y+4.3*s,z+1.58*s);
    blades.rotation.z=random()*Math.PI;
    blades.name='Slow cloth windmill sails';
    group.add(blades);
    animated.push({kind:'mill',mesh:blades,speed:.19+random()*.08});
  }

  function pennant(x,y,z,size,color=C.coral) {
    cylinder(C.woodDark,x,y-.5,z,.055,2.2*size);
    const clothBatch=new PainterBatch(THREE,random);
    clothBatch.triangle([0,0,0],[1.8*size,-.25*size,.1],[0,-.65*size,0],color,.02);
    const flag=new THREE.Mesh(keep(clothBatch.finish()),paint);
    flag.position.set(x,y+.3,z);
    flag.rotation.y=-.3;
    group.add(flag);
    animated.push({kind:'flag',mesh:flag,phase:random()*6.28});
  }

  function fence(x,y,z,length,rot) {
    const a=[x,y+.8,z],b=[x+Math.cos(rot)*length,y+.8,z+Math.sin(rot)*length];
    beam(C.wood,a,b,.095);
    beam(C.wood,[a[0],y+.42,a[2]],[b[0],y+.42,b[2]],.08);
    const n=Math.ceil(length/1.6);
    for(let j=0;j<=n;j++) cylinder(C.honey,x+Math.cos(rot)*length*j/n,y+.6,z+Math.sin(rot)*length*j/n,.11,1.2);
  }

  function laundry(ax,ay,az,bx,by,bz) {
    cylinder(C.wood,ax,ay-1,az,.07,2.5);
    cylinder(C.wood,bx,by-1,bz,.07,2.5);
    let old=[ax,ay,az];
    for(let j=1;j<=12;j++) {
      const t=j/12,now=[ax+(bx-ax)*t,ay+(by-ay)*t-Math.sin(t*Math.PI)*.4,az+(bz-az)*t];
      beam(C.woodDark,old,now,.025);old=now;
    }
    for(let j=1;j<=5;j++) {
      const t=j/6,x=ax+(bx-ax)*t,z=az+(bz-az)*t,y=ay+(by-ay)*t-Math.sin(t*Math.PI)*.4;
      box([C.cream,C.coral,C.tealLight][j%3],x,y-.4,z,.65,.8,.035);
    }
  }

  function makeHarbor() {
    // Entirely below the flight plane at the apron: a visual docking place,
    // not an invisible collision wall across the player's first approach.
    for(let j=0;j<21;j++) box(j%4===0?C.honey:C.wood,-7+j*.7,-3.55,48,.66,.32,13.5);
    for(const x of [-7.5,7.5]) {
      box(C.woodDark,x,-4,48,.35,.75,14.2);
      for(const z of [41.3,45.7,50.1,54.5]) {
        cylinder(C.woodDark,x,-4.7,z,.3,3.8);
        cylinder(C.brass,x,-2.92,z,.4,.23);
      }
    }
    // An inlaid stitch-ring marks the return point without filling it in.
    const r=4.2;
    for(let j=0;j<40;j++) {
      const a=j/40*Math.PI*2;
      box(j%5===0?C.coral:C.cream,Math.cos(a)*r,-3.36,48+Math.sin(a)*r,.38,.035,.105,-a);
    }
    box(C.tealDark,0,-3.32,48,.13,.04,4.5);
    box(C.tealDark,0,-3.31,48,4.5,.04,.13);
    for(const x of [-7.3,7.3]) {
      // Draped dock ropes deliberately stop short of the approach mouth.
      for(let j=0;j<3;j++) {
        const za=45.7+j*2.9,zb=za+2.9;
        let previous=[x,-2.8,za];
        for(let k=1;k<=8;k++) {
          const t=k/8,next=[x,-2.8-Math.sin(t*Math.PI)*.5,za+(zb-za)*t];
          beam(C.cream,previous,next,.045);previous=next;
        }
      }
    }
    house(-6,-5,61,4.7,4.1,4.8,-.16,C.chalk);
    house(4.8,-5,62,5.9,3.1,4.5,.1,C.cream);
    box(C.teal,4.8,-1.1,64.6,6.6,.16,2.3,.1);
    for(const x of [2,7.6]) cylinder(C.wood,x,-2.65,65.7,.1,4.6);
    cylinder(C.chalk,-.7,-.7,68,1.9,8.5);
    cylinder(C.woodDark,-.7,3.7,68,2.35,.3);
    cylinder(C.window,-.7,4.3,68,1.5,.9);
    item(primitives.cone,C.teal,-.7,5.5,68,2.4,1.7,2.4);
    pennant(-.7,8.4,68,1.4,C.coral);
    tree(-11.5,-5,61.5,1.8,true);
    tree(11,-5,62,1.5);
    tree(7,-5,69,1.5,true);
    for(const [x,z] of [[-5,56.2],[-5.2,57.6],[5.3,56.8],[6.7,57.1]]) {
      box(C.honey,x,-4.24,z,1.05,1.45,1.05,.13);
      box(C.woodDark,x,-3.57,z,1.09,.12,1.08,.13);
      box(C.woodDark,x,-4.25,z,1.09,.13,1.08,.13);
    }
    laundry(-11,-1.5,57,-3,-1.7,58);
    // A small brass dock crane, visually readable against the pale clouds.
    cylinder(C.tealDark,10.3,-3.1,54,1.05,1.8);
    beam(C.honey,[10.3,-3,54],[10.3,3.3,54],.24);
    beam(C.honey,[10.3,3.3,54],[6.8,3.6,53],.22);
    beam(C.woodDark,[10.3,-.2,54],[7.4,3.4,53.2],.11);
    beam(C.woodDark,[6.8,3.5,53],[6.8,.4,53],.035);
    cylinder(C.brass,6.8,.25,53,.22,.4);
  }

  function makeNavigationBuoys() {
    // They suggest the navigable reach without a hard graphical arena wall.
    for(const [x,z] of [[-16,36],[16,36],[-66,63],[67,65],[-84,-55],[79,-47],[-27,-91],[27,-91]]) {
      ball(C.cream,x,-2.2,z,.8,.95,.8);
      cylinder(C.teal,x,-3.2,z,.55,.65);
      cylinder(C.woodDark,x,-4.5,z,.05,2.5);
      pennant(x,-.4,z,.53,C.coralLight);
    }
  }

  function makeCloudSea() {
    // A locally generated alpha wash makes the distant sea soft and airy.
    // It has no image dependency, canvas dependency, or network request.
    const width=128,height=64,pixels=new Uint8Array(width*height*4);
    const lobes=[[-.64,.02,.25,.32],[-.3,-.08,.34,.53],[.08,.03,.39,.63],[.45,-.06,.3,.43],[.7,.08,.21,.27]];
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const u=x/(width-1)*2-1,v=y/(height-1)*2-1;
      let inverseDensity=1;
      for(const [cx,cy,rx,ry] of lobes) {
        const distance=(u-cx)**2/(rx*rx)+(v-cy)**2/(ry*ry);
        inverseDensity*=1-Math.exp(-distance*2.15)*.9;
      }
      const grain=1+Math.sin(x*2.13+y*1.77)*.035+Math.sin(x*.29-y*.31)*.04;
      const density=Math.max(0,Math.min(1,(1-inverseDensity-.018)*grain));
      const i=(y*width+x)*4;
      pixels[i]=242+Math.round(density*11);
      pixels[i+1]=244+Math.round(density*7);
      pixels[i+2]=229+Math.round(density*11);
      pixels[i+3]=Math.round(density*230);
    }
    const texture=keep(new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat));
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;
    const geo=keep(new THREE.PlaneGeometry(1,1));geo.rotateX(-Math.PI/2);
    const material=keep(new THREE.MeshBasicMaterial({
      map:texture,transparent:true,opacity:.92,depthWrite:false,alphaTest:.015,side:THREE.DoubleSide,toneMapped:false,
    }));
    material.userData.outlineParameters={visible:false};
    const count=132;
    const mesh=new THREE.InstancedMesh(geo,material,count);
    mesh.name='Soft watercolor cloud washes — instanced';
    const transform=new THREE.Object3D(),color=new THREE.Color();
    const clusterRandom=seeded(9975);
    for(let j=0;j<count;j++) {
      const cx=((j*53.7)%330)-165;
      const cz=((j*79.3)%320)-160;
      transform.position.set(cx,-28-clusterRandom()*13,cz);
      transform.scale.set(13+clusterRandom()*14,1,7+clusterRandom()*8);
      transform.rotation.y=-.14+clusterRandom()*.28;
      transform.updateMatrix();mesh.setMatrixAt(j,transform.matrix);
      color.set(j%5===0?'#d2e5dd':j%3===0?'#e7eee4':'#fff7e5');
      mesh.setColorAt(j,color);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.instanceColor.needsUpdate=true;
    group.add(mesh);
    return mesh;
  }

  function makeWindLines() {
    const lines=[];
    for(let j=0;j<18;j++) {
      const x=-100+random()*200,z=-100+random()*200,y=-8-random()*10;
      const length=4+random()*8;
      for(let k=0;k<10;k++) {
        const t=k/10,t1=(k+1)/10;
        lines.push(x+t*length,y+Math.sin(t*Math.PI)*.2,z+t*.3,
          x+t1*length,y+Math.sin(t1*Math.PI)*.2,z+t1*.3);
      }
    }
    const geo=keep(new THREE.BufferGeometry());
    geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    const mat=keep(new THREE.LineBasicMaterial({color:'#fff5df',transparent:true,opacity:.3,depthWrite:false}));
    const mesh=new THREE.LineSegments(geo,mat);
    mesh.name='Quiet drifting wind stitches';group.add(mesh);
    return mesh;
  }

  function makeBirds() {
    const birdBatch=new PainterBatch(THREE,random);
    for(let j=0;j<11;j++) {
      const x=-27+random()*54,z=-38+random()*76,y=-9-random()*6;
      birdBatch.triangle([x-.65,y+.12,z+.1],[x,y-.15,z],[x-.15,y+.1,z-.2],C.slate,.01);
      birdBatch.triangle([x+.65,y+.12,z+.1],[x+.15,y+.1,z-.2],[x,y-.15,z],C.slate,.01);
    }
    const mesh=new THREE.Mesh(keep(birdBatch.finish()),paint);
    mesh.name='Distant seabird silhouettes';group.add(mesh);return mesh;
  }

  return {
    group,obstacles,landmarks,
    update(dt,time) {
      for(const a of animated) {
        if(a.kind==='mill') a.mesh.rotation.z-=dt*a.speed;
        else if(a.kind==='flag') {
          a.mesh.rotation.y=-.3+Math.sin(time*1.9+a.phase)*.14;
          a.mesh.rotation.x=Math.sin(time*2.4+a.phase)*.055;
        } else if(a.kind==='glow') a.mesh.material.opacity=a.base+Math.sin(time*1.4)*.035;
      }
      clouds.position.x=Math.sin(time*.018)*3.4;
      clouds.position.z=Math.sin(time*.012)*1.3;
      wind.position.x=(time*1.1)%35-17.5;
      birds.position.x=Math.sin(time*.08)*8;
      birds.position.z=Math.cos(time*.07)*5;
      birds.position.y=Math.sin(time*1.5)*.12;
    },
    dispose() {
      group.removeFromParent();
      for(const resource of resources) resource.dispose?.();
      group.clear();
    },
  };
}

function seeded(seed) {
  return ()=> {
    seed=(seed+0x6D2B79F5)|0;
    let t=Math.imul(seed^seed>>>15,1|seed);
    t=(t+Math.imul(t^t>>>7,61|t))^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

/** Merge colored primitives without depending on BufferGeometryUtils. */
class PainterBatch {
  constructor(THREE,random) {
    this.THREE=THREE;this.random=random;
    this.positions=[];this.normals=[];this.colors=[];
    this.vector=new THREE.Vector3();this.normal=new THREE.Vector3();
    this.color=new THREE.Color();this.normalMatrix=new THREE.Matrix3();
    this.matrix=new THREE.Matrix4();this.euler=new THREE.Euler();this.quaternion=new THREE.Quaternion();
  }
  add(geometry,color,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],variance=.035) {
    this.euler.set(...rotation);this.quaternion.setFromEuler(this.euler);
    this.matrix.compose(new this.THREE.Vector3(...position),this.quaternion,new this.THREE.Vector3(...scale));
    this.addMatrix(geometry,color,this.matrix,variance);
  }
  addMatrix(geometry,color,matrix,variance=.035) {
    const p=geometry.attributes.position,n=geometry.attributes.normal,existingColors=geometry.attributes.color;
    const count=geometry.index?geometry.index.count:p.count;
    this.normalMatrix.getNormalMatrix(matrix);this.color.set(color);
    let shade=1;
    for(let j=0;j<count;j++) {
      if(j%3===0) shade=1+(this.random()-.5)*variance*2;
      const index=geometry.index?geometry.index.getX(j):j;
      this.vector.fromBufferAttribute(p,index).applyMatrix4(matrix);
      this.positions.push(this.vector.x,this.vector.y,this.vector.z);
      if(n) this.normal.fromBufferAttribute(n,index).applyMatrix3(this.normalMatrix).normalize();
      else this.normal.set(0,1,0);
      this.normals.push(this.normal.x,this.normal.y,this.normal.z);
      this.colors.push(
        this.color.r*(existingColors?existingColors.getX(index):1)*shade,
        this.color.g*(existingColors?existingColors.getY(index):1)*shade,
        this.color.b*(existingColors?existingColors.getZ(index):1)*shade);
    }
  }
  triangle(a,b,c,color,variance=.04) {
    const av=new this.THREE.Vector3(...a),bv=new this.THREE.Vector3(...b),cv=new this.THREE.Vector3(...c);
    this.normal.copy(bv).sub(av).cross(cv.sub(av)).normalize();
    this.color.set(color);
    const shade=1+(this.random()-.5)*variance*2;
    for(const p of [a,b,c]) {
      this.positions.push(...p);
      this.normals.push(this.normal.x,this.normal.y,this.normal.z);
      this.colors.push(this.color.r*shade,this.color.g*shade,this.color.b*shade);
    }
  }
  finish() {
    const geometry=new this.THREE.BufferGeometry();
    geometry.setAttribute('position',new this.THREE.Float32BufferAttribute(this.positions,3));
    geometry.setAttribute('normal',new this.THREE.Float32BufferAttribute(this.normals,3));
    geometry.setAttribute('color',new this.THREE.Float32BufferAttribute(this.colors,3));
    geometry.computeBoundingSphere();return geometry;
  }
}
