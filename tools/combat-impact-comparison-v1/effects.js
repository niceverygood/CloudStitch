// Absolute-time presentation only. Every origin comes from a supplied receipt.
export function createDramaticEffects(T, scene, {weapon='cannon',atlas=null,reducedMotion=false}={}) {
  const mg=weapon==='mg'||weapon==='machinegun'||weapon==='machine-gun'||weapon==='01-machine-gun';
  const MAX_EVENTS=32, MAX_PROJECTILES=32, LIFE=mg?.72:1.65;
  const root=new T.Group(); root.name='dramatic-painted-impact'; scene.add(root);
  const geos=new Set(),materials=new Set(); let disposed=false,lastTime=0,activeEvents=0,activeProjectiles=0,dropped=0;
  const color={dark:0x70634f,cream:0xfff1ba,white:0xfff9dd,apricot:0xf5ad65,coral:0xd47149,gold:0xe6ba67,sage:0x9da995,smoke:0xc4c4aa,brass:0xc29b4e};
  function keep(g){geos.add(g);return g;}
  function painted(g){const p=g.attributes.position,cols=[];for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),v=.81+.14*Math.sin(x*8+y*5+z*11)+.04*Math.sin(x*31-y*24);cols.push(v,v*.985,v*.95);}g.setAttribute('color',new T.Float32BufferAttribute(cols,3));g.computeVertexNormals();return keep(g);}
  function petal(){const p=[],idx=[],N=28,W=12,colors=[];for(let j=0;j<=N;j++){const t=j/N,half=Math.pow(Math.sin(Math.PI*t),.72)*(.29+.055*Math.sin(t*14))+.008;for(let k=0;k<=W;k++){const u=k/W*2-1;p.push(u*half+Math.sin(t*5.2)*.23,t-.16*t**4,Math.sin(t*Math.PI)*(.20+.26*(1-u*u))+.34*t**4);const rim=Math.abs(u)>.72||t>.86,c=new T.Color(rim?0xffedb2:Math.abs(u)>.43?0xffc877:0xe99050),brush=.91+.08*Math.sin(t*48+u*8);colors.push(c.r*brush,c.g*brush,c.b*brush);}}for(let j=0;j<N;j++)for(let k=0;k<W;k++){const a=j*(W+1)+k;idx.push(a,a+1,a+W+1,a+1,a+W+2,a+W+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();return keep(g);}
  const petalGeo=petal(),blobGeo=(()=>{const g=new T.SphereGeometry(1,16,12),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.10*Math.sin(x*7+y*4)*Math.cos(z*6-y*3);p.setXYZ(i,x*r,y*r,z*r);}return painted(g);})(),chipGeo=painted(new T.ConeGeometry(.16,1,5)),bulletGeo=painted(new T.SphereGeometry(1,12,8));
  const curlGeo=painted(new T.TorusGeometry(1,.23,9,36,Math.PI*1.55));
  const Y=new T.Vector3(0,1,0),normal=new T.Vector3(),offset=new T.Vector3(),q=new T.Quaternion();
  function mesh(g,c,parent,solid=false){const mat=new T.MeshBasicMaterial({color:c,vertexColors:true,transparent:!solid,opacity:1,depthWrite:solid,depthTest:true,side:T.DoubleSide,toneMapped:false});mat.userData.outlineParameters={visible:false};materials.add(mat);const n=new T.Mesh(g,mat);n.userData.outlineParameters={visible:false};n.frustumCulled=false;parent.add(n);return n;}
  function pose(n,p,s,alpha,rot=[0,0,0]){n.visible=alpha>.015;n.position.set(...p);const collapse=n.material.depthWrite?Math.sqrt(Math.min(1,alpha*1.3)):1;n.scale.set(s[0]*collapse,s[1]*collapse,s[2]*collapse);n.rotation.set(...rot);n.material.opacity=Math.max(0,Math.min(1,alpha));}
  function slot(){const g=new T.Group();root.add(g);g.visible=false;return {g,shadow:mesh(blobGeo,color.dark,g,true),heart:mesh(blobGeo,color.white,g,true),shell:mesh(blobGeo,color.apricot,g,true),petals:Array.from({length:5},()=>mesh(petalGeo,0xffffff,g,true)),strokes:Array.from({length:3},(_,i)=>mesh(petalGeo,i===1?color.white:color.gold,g,true)),smoke:Array.from({length:3},(_,i)=>mesh(blobGeo,i===1?color.sage:color.smoke,g,true)),curls:Array.from({length:3},(_,i)=>mesh(curlGeo,i%2?0xc3cbb5:0xd7d8bd,g,true)),chips:Array.from({length:5},(_,i)=>mesh(chipGeo,i%2?color.dark:color.brass,g,true))};}
  const slots=Array.from({length:MAX_EVENTS},slot);
  function flightSlot(){const g=new T.Group();root.add(g);g.visible=false;return {g,body:mesh(bulletGeo,color.brass,g),tip:mesh(bulletGeo,color.cream,g),tails:[mesh(petalGeo,color.apricot,g),mesh(petalGeo,color.cream,g),mesh(petalGeo,color.sage,g)]};}
  const flights=Array.from({length:MAX_PROJECTILES},flightSlot);
  const clamp=x=>Math.max(0,Math.min(1,x)),rise=x=>{x=clamp(x);return 1-(1-x)**3;},window=(t,a,b,c)=>t<a||t>=c?0:t<b?rise((t-a)/(b-a)):1-clamp((t-b)/(c-b))**1.4;
  function vec(a,fallback){return Array.isArray(a)&&a.length>=3&&a.slice(0,3).every(Number.isFinite)?a:fallback;}
  function align(g,p,axis){g.position.set(...vec(p,[0,0,0]));normal.set(...vec(axis,[0,1,0]));if(normal.lengthSq()<1e-9)normal.copy(Y);normal.normalize();g.quaternion.setFromUnitVectors(Y,normal);}
  function paintEvent(s,e,t,index){const hit=e.type==='hit',base=mg?(hit?.66:.57):(hit?2.35:1.75),life=hit?LIFE:(mg?.30:.65),u=t/life;
    align(s.g,e.position,hit?e.normal:e.direction);s.g.visible=true;
    const crest=window(t,0,mg?.012:.02,mg?.17:.55),release=rise(t/(mg?.035:.060)),motion=reducedMotion?.3:1;
    pose(s.shadow,[0,.025,0],[base*.25,base*.055,base*.19],window(t,.002,.02,.07)*.85);
    // A contact is a compressed splash; a muzzle is a forward pressure tongue.
    // Keep the hot core on the exposed face rather than buried inside a sphere.
    pose(s.shell,[0,base*(.14+release*.14),0],[base*(.10+release*(hit?.30:.22)),base*(.10+release*(hit?.16:.72)),base*(.09+release*(hit?.29:.19))],crest);
    pose(s.heart,[0,base*(.18+release*(hit?.30:.62)),base*.04],[base*(.08+release*.22),base*(.08+release*(hit?.18:.32)),base*(.08+release*.20)],window(t,0,.015,mg?.12:.31));
    s.petals.forEach((n,i)=>{const a=i*2.399+index*.43,delay=i*(mg?.002:.004),v=rise((t-delay)/(mg?.040:.065)),w=window(t,delay,delay+.025,mg?.23:.65),asym=1+(i%3)*.17;
      // A radial fan occupies empty space around the contact, with a curled
      // cream rim rather than translucent polygons laid across the target.
      const tilt=hit?(mg?1.18:1.38):.38;
      q.setFromAxisAngle(new T.Vector3(Math.sin(a),0,-Math.cos(a)),tilt);
      pose(n,[Math.cos(a)*base*.13,base*.12,Math.sin(a)*base*.13],[base*(mg?.35:.52),base*(.18+v*(hit?(mg?1.1:1.42):1.65))*asym,base*.65],w);
      n.quaternion.copy(q);n.rotateY(a+.25*Math.sin(t*8+i));
    });
    s.strokes.forEach((n,i)=>{const a=i*2.25+.6,v=rise((t-.025)/.14);pose(n,[Math.cos(a)*base*v*.56,base*(.18+v*.32),Math.sin(a)*base*v*.52],[base*.14,base*(.18+v*1.08),base*.20],window(t,.018,.065,mg?.28:.80),[Math.cos(a)*1.20,a,Math.sin(a)*1.18]);});
    s.smoke.forEach((n,i)=>{const a=i*2.4+index*.3,v=rise((u-.16-i*.035)/.75),alpha=window(u,.16+i*.035,.42+i*.035,1)*.74;pose(n,[Math.cos(a)*base*(.30+v*.46),base*(.32+v*.70*motion),Math.sin(a)*base*(.24+v*.48)],[base*(.12+v*.49),base*(.12+v*.58),base*(.10+v*.40)],alpha,[v*.24,a+v*.45,v*.16]);});
    s.curls.forEach((n,i)=>{const a=i*2.1+.3,v=rise((t-.10-i*.045)/(mg?.20:.55)),alpha=window(t,.10+i*.045,.24+i*.065,life)*.85,r=base*(.14+v*(.34+i*.07));pose(n,[Math.cos(a)*base*(.22+v*.72),base*(.28+v*.52*motion),Math.sin(a)*base*(.22+v*.68)],[r,r*(.8+i*.15),r*.68],alpha,[Math.PI/2+i*.38,a+v*.65,i*.9+v*.7]);});
    s.chips.forEach((n,i)=>{const a=i*2.399+index*.17,v=clamp((u-.035)/.7),distance=base*(.15+v*1.35)*motion;pose(n,[Math.cos(a)*distance,base*(.12+v*1.9-v*v*1.8)*motion,Math.sin(a)*distance*.72],[base*.12,base*(i%2?.27:.17),base*.07],window(u,.02,.08,.78),[a+v*6*motion,a*.7,v*8*motion]);});
    // A muzzle has no target splinters; its moving shapes describe gas release.
    if(!hit)s.chips.forEach(n=>n.visible=false);
  }
  function update(time,events=[],projectiles=[],camera=null){if(disposed)return;lastTime=Number.isFinite(time)?Math.max(0,time):0;for(const s of slots)s.g.visible=false;for(const s of flights)s.g.visible=false;activeEvents=activeProjectiles=dropped=0;
    const seen=new Set(),eligible=[];for(const e of events){if(!e||!['fire','hit'].includes(e.type)||!Number.isFinite(e.time))continue;const age=lastTime-e.time,life=e.type==='hit'?LIFE:(mg?.30:.65),key=e.type+':'+e.id+':'+e.time;if(age<0||age>=life||seen.has(key))continue;seen.add(key);eligible.push(e);}eligible.sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));dropped=Math.max(0,eligible.length-MAX_EVENTS);
    for(const e of eligible.slice(-MAX_EVENTS)){paintEvent(slots[activeEvents],e,lastTime-e.time,activeEvents);activeEvents++;}
    for(const p of projectiles.slice(0,MAX_PROJECTILES)){const s=flights[activeProjectiles++];align(s.g,p.position,p.direction);s.g.visible=true;const b=mg?.17:.36;pose(s.body,[0,0,0],[b,b*2.4,b],1);pose(s.tip,[0,b*1.85,0],[b*.73,b*.85,b*.73],1);s.tails.forEach((n,i)=>{const phase=lastTime*17+i*1.7,wiggle=Math.sin(phase)*.10;pose(n,[b*(i-1)*.4,-b*.9,0],[b*(i===0?2.1:1.5),b*(mg?6:8)*(1-i*.18),b*1.4],i===2?.38:.83,[Math.PI, i*1.85,wiggle]);});}
  }
  function reset(){slots.forEach(s=>s.g.visible=false);flights.forEach(s=>s.g.visible=false);activeEvents=activeProjectiles=dropped=0;lastTime=0;}
  function dispose(){if(disposed)return;disposed=true;root.removeFromParent();geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  function debug(){return {weapon,disposed,time:lastTime,activeEvents,activeProjectiles,droppedEvents:dropped,maxEvents:MAX_EVENTS,maxProjectiles:MAX_PROJECTILES,maxEventLifetime:LIFE,geometries:geos.size,materials:materials.size,simulationAuthority:false,projectileIntegration:false,callerAtlasOwned:Boolean(atlas),reducedMotion};}
  return {update,reset,dispose,debug};
}
