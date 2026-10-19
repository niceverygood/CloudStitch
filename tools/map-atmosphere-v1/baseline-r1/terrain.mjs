// Cloudstitch map atmosphere: original, closed-volume terrain and vegetation.
// Relative visual units, Y up, +Z front. These recipes add no gameplay rules.
export const assets = [
  {id:'root-garden',name_ko:'뿌리 수염 정원섬',category:'islands',role:'넓은 잔디 선반과 큰 나무 뿌리로 생활 항로의 높이와 깊이를 만든다.',motion_ko:'정적 형태 원형 · 바람과 부유 물리는 포함하지 않음'},
  {id:'crescent-pass',name_ko:'초승달 바람 통로섬',category:'islands',role:'한쪽이 크게 열린 초승달 암반과 서로 다른 높이의 초지로 우회 공간을 읽힌다.',motion_ko:'정적 형태 원형 · 통과 판정과 충돌은 별도'},
  {id:'double-arch',name_ko:'두 겹 아치 절벽섬',category:'islands',role:'실제로 빈 두 아치와 겹친 암반 선반으로 협곡의 큰 실루엣을 만든다.',motion_ko:'정적 형태 원형 · 실제 항로 폭과 고도는 미확정'},
  {id:'water-terraces',name_ko:'빗물 계단 정원섬',category:'islands',role:'높이가 다른 물그릇 암반과 가는 낙수로 구름 사이의 풍성한 정원을 제안한다.',motion_ko:'정적 물줄기 형태 · 유체·물 자원·피해 없음'},
  {id:'wreck-garden',name_ko:'난파 목재 정원섬',category:'islands',role:'부서진 선체 리브와 되살아난 식생을 겹쳐 잔해해역의 생활 흔적을 만든다.',motion_ko:'정적 형태 원형 · 회수 가능 부품으로 등록하지 않음'},
  {id:'quiet-terrace',name_ko:'고요한 크림 석재섬',category:'islands',role:'크림 석재와 황동·검은 천 덧댐으로 조용한 외곽 서비스 정박 풍경을 제안한다.',motion_ko:'정적 형태 원형 · 새 도시나 이야기 해금 없음'},
  {id:'wind-tree',name_ko:'바람에 누운 수관나무',category:'nature',role:'휘어진 줄기·비대칭 수관·독립 잎과 작은 리본으로 바람의 인상을 만든다.',motion_ko:'8초 반복 수관 흔들림 · 실제 풍압과 무관'},
  {id:'hanging-garden',name_ko:'매달린 꽃과 덩굴 정원',category:'nature',role:'세 높이의 목재 바구니·꽃·긴 덩굴을 항로의 생활 디테일로 쓴다.',motion_ko:'8초 반복 바구니·덩굴 흔들림 · 물리와 무관'}
];

function helpers(k) {
  const {THREE:T,root,palette:P}=k;
  const tau=Math.PI*2;
  const g=(name,parent=root,pos=[0,0,0])=>{const o=k.group(name,parent);o.position.set(...pos);return o;};
  const box=(name,size,pos,color=P.wood,parent=root)=>k.bevelBox(name,size,pos,color,parent);
  const tube=(name,points,radius,color=P.wood,parent=root,closed=false)=>k.tube(name,points,radius,color,parent,closed);
  const ell=(name,pos,scale,color=P.green,parent=root,detail=1)=>{
    const m=k.mesh(name,new T.IcosahedronGeometry(1,detail),color,parent);
    m.position.set(...pos);m.scale.set(...scale);return m;
  };
  function flatLeaf(name,pos,w,l,color,parent=root,yaw=0,pitch=0) {
    // A closed, eight-faced leaf with a raised midrib; never a camera-facing card.
    const v=[0,0,0,-w*.5,.025,l*.46,0,.11*l,l*.45,w*.5,.025,l*.46,0,0,l,0,-.055*l,l*.42];
    const idx=[0,1,2,1,4,2,4,3,2,3,0,2,1,0,5,4,1,5,3,4,5,0,3,5];
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setIndex(idx);
    const m=k.mesh(name,geo,color,parent);m.position.set(...pos);m.rotation.set(pitch,yaw,0);return m;
  }
  function rock(name,pos,size,{grass=false,color=P.stone,seed=0,skew=.18}={},parent=root) {
    // Closed, offset strata with a broad, irregular foot rather than an inverted cone.
    const [rx,h,rz]=size,n=20;
    const rings=[{y:0,r:1},{y:-h*.12,r:1.04},{y:-h*.37,r:.91},{y:-h*.68,r:.79},{y:-h*.9,r:.61},{y:-h,r:.55}];
    const verts=[],idx=[];
    for(let j=0;j<rings.length;j++)for(let i=0;i<n;i++){
      const a=i/n*tau,r=rings[j],wav=1+.1*Math.sin(a*3+seed)+.05*Math.cos(a*7+seed*.7);
      const drift=(j/(rings.length-1));
      verts.push(Math.cos(a)*rx*r.r*wav+skew*rx*drift,r.y+.035*h*Math.sin(a*3+seed)*(j?1:0),Math.sin(a)*rz*r.r*wav+Math.sin(seed)*.12*rz*drift);
    }
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){
      const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;idx.push(a,b,c,b,d,c);
    }
    const top=verts.length/3;verts.push(0,.015,0);const bottom=verts.length/3;verts.push(skew*rx,-h-.015,Math.sin(seed)*rz*.12);
    for(let i=0;i<n;i++){idx.push(top,(i+1)%n,i);const a=(rings.length-1)*n+i,b=(rings.length-1)*n+(i+1)%n;idx.push(bottom,a,b);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(idx);
    const m=k.mesh(name,geo,color,parent);m.position.set(...pos);
    const a=m.geometry.getAttribute('position'),cols=m.geometry.getAttribute('color');
    for(let i=0;i<a.count;i+=3){
      const y=(a.getY(i)+a.getY(i+1)+a.getY(i+2))/3;
      let base=grass&&y>-.035?P.green:grass&&y>-h*.14?P.earth:color;
      if(y<-h*.35&&y>-h*.46)base=P.stoneDark;
      if(y<-h*.68&&y>-h*.78)base=P.stoneLight;
      const c=new T.Color(base).multiplyScalar(.91+(i%9)*.012);
      for(let j=0;j<3;j++)cols.setXYZ(i+j,c.r,c.g,c.b);
    }
    return m;
  }
  function shelf(name,pos,rx,rz,parent=root,seed=0) {
    return rock(name,pos,[rx,.4,rz],{grass:true,seed,color:P.stoneLight,skew:.04},parent);
  }
  function rootTangle(pos,span=3,count=9,parent=root) {
    for(let i=0;i<count;i++){
      const a=i/count*tau+.27,r=span*(.5+(i%3)*.1),x=Math.cos(a)*r,z=Math.sin(a)*r*.74;
      const endY=pos[1]-1.8-(i%4)*.42;
      tube('great_exposed_tree_root',[[pos[0]+x*.25,pos[1]+.2,pos[2]+z*.25],[pos[0]+x*.85,pos[1]-.55,pos[2]+z*.85],[pos[0]+x*.9,endY+.65,pos[2]+z],[pos[0]+x*.6,endY,pos[2]+z*.85]],.09+(i%3)*.045,i%2?P.wood:P.woodDark,parent);
      if(i%2===0)tube('forking_root_tip',[[pos[0]+x*.9,endY+.65,pos[2]+z],[pos[0]+x*1.02,endY+.3,pos[2]+z*1.09],[pos[0]+x*.98,endY+.15,pos[2]+z*1.2]],.036,P.wood,parent);
    }
  }
  function leafFan(pos,scale=1,parent=root,count=5,angle=0) {
    for(let i=0;i<count;i++)flatLeaf('individual_swept_leaf',pos,.22*scale,.72*scale,i%2?P.leaf:P.sage,parent,angle+(i-(count-1)/2)*.5,-.23-(i%2)*.15);
  }
  function flower(pos,scale=1,parent=root,color=P.flower) {
    const o=g('flower_with_independent_petals',parent,pos),h=.38*scale;
    tube('bent_flower_stem',[[0,0,0],[.025*scale,h*.58,.015*scale],[.07*scale,h,0]],.018*scale,P.pine,o);
    flatLeaf('flower_stem_leaf',[-.01,h*.32,0],.12*scale,.28*scale,P.leaf,o,-1.1,-.5);
    flatLeaf('flower_stem_leaf',[.02,h*.53,.01],.1*scale,.25*scale,P.sage,o,1.2,-.4);
    for(let i=0;i<6;i++){
      const a=i/6*tau,p=ell('separate_rounded_flower_petal',[.07*scale+Math.cos(a)*.11*scale,h+.018*scale,Math.sin(a)*.11*scale],[.1*scale,.04*scale,.18*scale],color,o,0);p.rotation.y=Math.PI/2-a;
    }
    ell('golden_flower_center',[.07*scale,h+.06*scale,0],[.07*scale,.045*scale,.07*scale],P.amber,o,0);return o;
  }
  function flowers(pos,count=7,spread=1,parent=root) {
    for(let i=0;i<count;i++){
      const a=i*2.399,r=spread*Math.sqrt((i+.3)/count);
      flower([pos[0]+Math.cos(a)*r,pos[1],pos[2]+Math.sin(a)*r*.62],.65+(i%3)*.17,parent,i%3?P.flower:P.ivory);
    }
  }
  function grassTufts(pos,count=9,spread=1,parent=root) {
    for(let i=0;i<count;i++){
      const a=i*2.399,r=spread*Math.sqrt((i+.5)/count),x=pos[0]+Math.cos(a)*r,z=pos[2]+Math.sin(a)*r*.7;
      for(let j=0;j<3;j++)flatLeaf('curved_grass_blade',[x,pos[1],z],.045,.3+(i%3)*.09,i%2?P.sage:P.green,parent,a+j*1.9,-1.1+j*.08);
    }
  }
  function tree(pos,size=1,parent=root,{lean=.8,animated=false}={}) {
    const o=g('wind_sculpted_tree',parent,pos),s=size;
    rootTangle([0,-.08,0],.8*s,4,o);
    tube('broad_twisting_trunk',[[0,0,0],[-.16*s,.75*s,0],[lean*.25*s,1.55*s,-.1*s],[lean*.62*s,2.3*s,-.02*s]],.19*s,P.wood,o);
    tube('sunlit_trunk_ridge',[[.13*s,.12*s,.1*s],[.01*s,.8*s,.12*s],[lean*.28*s,1.6*s,.05*s]],.025*s,P.woodLight,o);
    const sway=g('upper_branches_sway',o,[lean*.22*s,1.55*s,-.08*s]);
    for(let j=0;j<6;j++){
      const a=j*2.18,reach=(.65+(j%3)*.23)*s,px=lean*.45*s+Math.cos(a)*reach,pz=Math.sin(a)*reach*.77,py=(.65+(j%2)*.5)*s;
      tube('bent_canopy_branch',[[0,0,0],[lean*.2*s,py*.35,pz*.35],[px,py,pz]],.065*s,P.wood,sway);
      for(let q=0;q<3;q++){
        const a2=a+q*2.3,cx=px+Math.cos(a2)*.35*s,cy=py+q*.11*s,cz=pz+Math.sin(a2)*.32*s;
        ell('painted_foliage_cluster',[cx,cy,cz],[.69*s,.43*s,.57*s],(j+q)%3?P.green:P.sage,sway);
        if(q===1)leafFan([cx+.22*s,cy+.2*s,cz+.23*s],s,sway,4,a);
      }
    }
    for(let i=0;i<4;i++){
      const a=i*1.8;ell('moss_on_trunk',[Math.cos(a)*.16*s,.2*s+i*.22*s,Math.sin(a)*.15*s],[.14*s,.1*s,.08*s],P.moss,o,0);
    }
    if(!animated)return {group:o,tracks:[]};
    const values=[];for(const angle of [0,.035,-.018,.029,0]){const q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),angle);values.push(q.x,q.y,q.z,q.w);}
    return {group:o,tracks:[new T.QuaternionKeyframeTrack(`${sway.name}.quaternion`,[0,2,4,6,8],values)]};
  }
  function lantern(pos,scale=1,parent=root) {
    const o=g('small_warm_route_lantern',parent,pos),s=scale;
    k.cylinder('lantern_teal_foot',.15*s,.18*s,.09*s,[0,0,0],P.teal,o,8);
    k.cylinder('cream_lantern_glass',.11*s,.11*s,.27*s,[0,.18*s,0],P.cream,o,8);
    k.cylinder('brass_lantern_cap',.16*s,.13*s,.08*s,[0,.36*s,0],P.brass,o,8);
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])tube('brass_lantern_bar',[[Math.cos(a)*.13*s,.06*s,Math.sin(a)*.13*s],[Math.cos(a)*.13*s,.32*s,Math.sin(a)*.13*s]],.018*s,P.brass,o);
    tube('lantern_carry_handle',[[-.09*s,.4*s,0],[-.07*s,.53*s,0],[.07*s,.53*s,0],[.09*s,.4*s,0]],.022*s,P.wood,o);return o;
  }
  function rail(a,b,y,parent=root) {
    for(const p of [a,b]){
      k.cylinder('route_post',.075,.1,.7,[p[0],y+.35,p[1]],P.wood,parent,8);
      k.cylinder('route_post_brass_cap',.1,.1,.06,[p[0],y+.72,p[1]],P.brass,parent,8);
    }
    tube('loosely_tied_route_rope',[[a[0],y+.58,a[1]],[(a[0]+b[0])/2,y+.42,(a[1]+b[1])/2],[b[0],y+.58,b[1]]],.035,P.cream,parent);
  }
  function ribbon(pos,parent=root) {
    const o=g('small_stitched_wind_ribbon',parent,pos);
    tube('ribbon_wood_mast',[[0,0,0],[.025,1.2,.015]],.045,P.wood,o);
    const c=k.cloth('coral_patched_route_cloth',.8,.36,[.41,.99,0],o);c.rotation.x=Math.PI/2;c.rotation.z=-.12;
    k.cylinder('ribbon_brass_finial',.07,.055,.12,[.025,1.25,.015],P.brass,o,8);return o;
  }
  function stoneShard(pos,scale=1,parent=root) {
    const m=ell('small_stratified_stone',pos,[.45*scale,.25*scale,.32*scale],P.stoneLight,parent,0);m.rotation.y=pos[0]*.8;return m;
  }
  return {T,P,root,g,box,tube,ell,flatLeaf,rock,shelf,rootTangle,leafFan,flower,flowers,grassTufts,tree,lantern,rail,ribbon,stoneShard,tau};
}

export function build(spec,k) {
  const h=helpers(k),{T,P,root,g,box,tube,ell,flatLeaf,rock,shelf,rootTangle,leafFan,flowers,grassTufts,tree,lantern,rail,ribbon,stoneShard,tau}=h;
  const clips=[];
  root.userData={...root.userData,implementation:'Locally authored, closed-volume layered visual prototype; optional glTF transform animation only. No collider, weather force, route unlock, water resource or gameplay.',art_direction:'Warm handmade fantasy; voluminous layered forms, selective small life details, painterly vertex colors.',source_scope:'tools/map-atmosphere-v1/terrain.mjs; all previous art and GLB assets preserved.'};
  switch(spec.id) {
    case 'root-garden': {
      rock('asymmetric_garden_foundation',[-.35,-.18,-.08],[3.35,3.1,2.55],{grass:true,seed:.4,skew:.32});
      shelf('broad_front_grass_shelf',[.75,.08,1.1],2.6,1.45,root,2.2);
      shelf('higher_root_garden',[-1.4,.45,-.72],1.65,1.4,root,1.6);
      for(let i=0;i<6;i++)stoneShard([-2.2+i*.85,-2-(i%2)*.42,-.45+Math.sin(i)*.75],.9+(i%3)*.2);
      rootTangle([-.95,-.2,-.45],3.35,11);
      tree([-1.35,.5,-.72],.9,root,{lean:.9});
      flowers([1.65,.12,1.1],9,.85);grassTufts([.3,.08,.3],9,1.8);
      k.deck('little_cantilever_footboard',1.3,1.8,[2.45,.22,.1]);
      tube('wood_board_brace',[[2,.05,-.5],[2.7,-.85,.1],[2.9,.04,.7]],.1,P.wood);
      rail([2.95,-.65],[2.95,.85],.27);lantern([2.85,.3,.65],.85);ribbon([1.1,.1,-1.7]);
      for(let i=0;i<5;i++)leafFan([-2.3+i*.65,.1,1.5],.55,root,3,i*.7);
      break;
    }
    case 'crescent-pass': {
      // A C-shaped solid extruded footprint: the large passage stays empty.
      const points=[],steps=28,start=.48,end=tau-.48;
      for(let i=0;i<=steps;i++){
        const a=start+(end-start)*i/steps,r=1+.035*Math.sin(a*5);points.push([Math.cos(a)*3.8*r,Math.sin(a)*3.1*r]);
      }
      for(let i=steps;i>=0;i--){const a=start+(end-start)*i/steps;points.push([Math.cos(a)*2.05+.25,Math.sin(a)*1.65]);}
      function crescentLayer(name,y,depth,scale,color) {
        const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x*scale,-z*scale):shape.moveTo(x*scale,-z*scale));shape.closePath();
        const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.1,bevelSize:.11,bevelSegments:1,steps:1,curveSegments:1});geo.rotateX(-Math.PI/2);
        const m=k.mesh(name,geo,color);m.position.y=y;return m;
      }
      crescentLayer('closed_crescent_rock_body',-1.65,1.4,1,P.stone);
      crescentLayer('broad_stratified_crescent_lip',-.48,.38,1.035,P.stoneLight);
      crescentLayer('crescent_soil_edge',-.08,.13,1,P.earth);
      crescentLayer('crescent_grassy_top',.05,.12,.98,P.green);
      for(let i=0;i<11;i++){
        const a=.8+i/10*(tau-1.6),r=3.35;stoneShard([Math.cos(a)*r,-1.4-(i%3)*.2,Math.sin(a)*2.6],.8);
      }
      shelf('upper_asymmetric_crescent_tip',[2.55,.6,-1.6],.92,.72,root,2.9);
      tree([-2.55,.19,-.7],.73,root,{lean:1.1});flowers([.25,.19,2.45],7,.65);grassTufts([-.5,.19,-2.5],6,1.2);
      for(const sign of [-1,1]){
        const o=g('tip_root_and_grass',root,[2.7,.05,sign*1.8]);
        tube('curled_tip_root',[[0,0,0],[.25,-.6,.1],[.1,-1.5,.15],[-.35,-1.8,.05]],.11,P.wood,o);
        leafFan([0,.17,0],.6,o,5,sign*.9);
      }
      rail([1.1,2.48],[2.45,1.92],.2);lantern([2.45,.22,1.92],.9);ribbon([2.5,.76,-1.55]);
      break;
    }
    case 'double-arch': {
      // Separate solid arch ribs create two genuine see-through openings.
      for(const [i,x] of [[0,-2.05],[1,2.05]]){
        const geo=new T.TorusGeometry(1.94,.62,7,24,Math.PI);
        const m=k.mesh('deep_natural_stone_arch',geo,i?P.stoneLight:P.stone);m.position.set(x,-2.2,0);m.scale.z=2.45;
        const rear=k.mesh('back_arch_stratum',new T.TorusGeometry(1.94,.38,6,22,Math.PI),P.stoneDark);rear.position.set(x,-2.26,-1.24);
        for(const side of [-1,1])rock('arch_foot_crag',[x+side*1.9,-2.12,0],[.8,1.5,1.5],{seed:x+side,skew:side*.12});
        for(let q=0;q<6;q++){
          const a=.22+q/5*(Math.PI-.44);ell('arch_surface_separate_stone',[x+Math.cos(a)*1.98,-2.2+Math.sin(a)*1.98,1.35],[.41,.22,.15],q%2?P.stoneLight:P.moss,root,0);
        }
      }
      rock('connecting_arch_crown',[0,-.18,-.08],[4.55,.65,1.57],{grass:true,seed:1.5,skew:.03});
      shelf('left_high_crown',[-2.8,.33,-.2],1.3,1.35,root,3.6);
      shelf('right_hanging_ledge',[3.4,-.55,.65],1.4,1.25,root,.4);
      tree([-2.8,.4,-.3],.69,root,{lean:-.85});flowers([.7,-.12,.95],8,.7);grassTufts([1.7,-.1,-.7],6,1.05);
      tube('front_vine_garland',[[-3.7,-.05,1.4],[-2.7,-.55,1.65],[-1.4,-.2,1.5],[0,-.5,1.7],[1.7,-.4,1.52],[3.8,-.65,1.42]],.055,P.pine);
      for(let i=0;i<10;i++)flatLeaf('arch_garland_leaf',[-3.3+i*.68,-.42-(i%3)*.08,1.56],.21,.48,i%2?P.sage:P.leaf,root,i*.7,-.5);
      k.deck('small_crown_boardwalk',2.2,.75,[.1,.01,-.4]);rail([-.8,-.79],[.9,-.79],.09);lantern([.98,.1,-.4],.75);
      break;
    }
    case 'water-terraces': {
      rock('deep_offset_water_island',[.2,-.45,0],[3.3,3.05,2.5],{grass:true,seed:2.1,skew:-.18});
      const tiers=[{p:[-1.45,1.15,-.85],r:[1.7,1.22]},{p:[.8,.42,.1],r:[1.55,1.14]},{p:[1.7,-.25,1.45],r:[1.52,1.02]}];
      for(let i=0;i<tiers.length;i++){
        const {p,r}=tiers[i];rock('closed_rain_catch_bowl',p,[r[0],.72,r[1]],{grass:true,seed:i+2.9});
        const water=k.cylinder('flat_painted_pool',r[0]*.72,r[0]*.72,.045,[p[0],p[1]+.04,p[2]],P.water,root,24);water.scale.z=r[1]/r[0];
        for(let q=0;q<8;q++){
          const a=q/8*tau+.18;ell('round_pool_bank_stone',[p[0]+Math.cos(a)*r[0]*.79,p[1]+.09,p[2]+Math.sin(a)*r[1]*.79],[.25,.13,.21],q%3?P.stoneLight:P.moss,root,0);
        }
        const ripple=k.ring('quiet_pool_ripple',.28+i*.07,.012,[p[0]-.2,p[1]+.069,p[2]+.05],P.lightTeal);ripple.scale.z=.65;
      }
      const streams=[
        [[-.22,1.2,-.48],[.15,.87,-.38],[.23,.51,-.35],[.36,.47,-.25]],
        [[1.48,.48,.63],[1.65,.22,.82],[1.63,-.13,.97],[1.66,-.2,1.08]],
        [[2.6,-.2,1.55],[2.72,-.8,1.62],[2.69,-1.95,1.69],[2.83,-3.36,1.7]]
      ];
      for(let i=0;i<streams.length;i++){
        tube('solid_painterly_water_ribbon',streams[i],i===2?.09:.115,P.water);
        tube('water_edge_brush_highlight',streams[i].map(p=>[p[0]+.045,p[1]+.008,p[2]+.045]),.018,P.ivory);
        const last=streams[i].at(-1);if(i<2)ell('pool_splash_mound',[last[0],last[1]+.03,last[2]],[.25,.06,.22],P.lightTeal,root,0);
      }
      tree([-2.2,.08,.8],.7,root,{lean:-.65});flowers([.15,-.36,1.75],8,.75);grassTufts([-1.15,1.24,-1.7],6,.7);
      for(let i=0;i<5;i++)leafFan([.1+i*.4,-.35,-1.65],.65,root,4,i*.5);
      rootTangle([-.8,-1.25,.25],1.55,5);lantern([-.7,-.25,2.1],.8);
      break;
    }
    case 'wreck-garden': {
      rock('irregular_wreck_garden_base',[-.25,-.24,0],[3.5,2.1,2.35],{grass:true,seed:4,skew:.27});
      shelf('front_reclaimed_grass_shelf',[.25,.02,1.48],2.1,1.05,root,1.3);
      const hull=g('leaning_broken_wood_hull',root,[-.15,.05,-.35]);hull.rotation.z=-.08;
      for(let i=0;i<7;i++){
        const z=-1.65+i*.52,span=1.45+.28*Math.sin(i*.7);
        tube('separate_curved_hull_rib',[[-span,1.05,z],[-span*.84,.17,z],[0,-.2,z],[span*.86,.2,z],[span,1.15+(i%2)*.24,z]],.095,P.woodDark,hull);
        for(const side of [-1,1])box('brass_rib_clamp',[.23,.12,.2],[side*span*.9,.29,z],P.brass,hull);
      }
      for(const side of [-1,1])for(let row=0;row<3;row++){
        const len=3.2-row*.34;
        const b=box('broken_warm_hull_planking',[.15,.24,len],[side*(1.36-row*.13),.42+row*.27,-.12+row*.13],row===1?P.teal:P.woodLight,hull);b.rotation.z=-side*.16;
      }
      tube('broken_bow_rail',[[-1.45,1.22,1.48],[-1.3,1.66,1.86],[0,1.83,2.12],[1.31,1.65,1.84]],.09,P.teal,hull);
      box('diagonal_repair_brace',[.14,1.65,.13],[1.5,.77,.9],P.wood,hull).rotation.z=-.26;
      k.cloth('little_patch_canvas',1.05,.84,[-.55,1.21,-.4],hull).rotation.z=.15;
      tube('short_broken_mast',[[.42,.02,-1.1],[.37,1.45,-1.03],[.51,2.17,-1.05]],.09,P.wood,hull);
      tube('old_loose_mast_rope',[[.49,1.9,-1.05],[1.12,.85,-.55],[.85,.16,.38]],.028,P.cream,hull);
      tree([-2.45,-.13,-.7],.72,root,{lean:-.8});flowers([1.9,.07,1.45],10,.9);
      grassTufts([.1,.07,1.7],7,1.25);rootTangle([-.8,-.7,.3],2.55,7);
      for(let i=0;i<8;i++)leafFan([-1.28+(i%2)*2.7,.55+(i%3)*.24,-1.4+Math.floor(i/2)*.74],.55,hull,3,i);
      lantern([1.04,.45,.85],.9,hull);k.deck('short_salvager_footboard',1.45,.8,[2.45,.12,.08]);
      break;
    }
    case 'quiet-terrace': {
      rock('offset_cream_stone_mass',[-.25,-.2,-.15],[3.6,2.65,2.65],{color:P.stoneLight,seed:3.8,skew:-.3});
      const terrace=g('quiet_service_terrace');
      const slabs=[[-2.05,.12,-.9,2.35,1.75],[-.02,.18,-.85,2.1,1.9],[1.9,.1,-.55,1.8,1.9],[-1.8,.07,.95,2.3,1.8],[.48,.12,1.2,2.2,1.7],[2.3,-.34,1.15,1.4,1.35]];
      for(let i=0;i<slabs.length;i++){
        const [x,y,z,w,d]=slabs[i];box('thick_cream_paving_slab',[w,.3,d],[x,y,z],i%2?P.ivory:P.cream,terrace);
        box('slab_edge_moulding',[w-.08,.065,.075],[x,y+.18,z+d*.44],P.stoneLight,terrace);
        if(i<4)tube('plain_brass_slab_inlay',[[x-w*.35,y+.163,z+.28],[x,y+.163,z+.35],[x+w*.35,y+.163,z+.28]],.018,P.brass,terrace);
      }
      for(const [x,z,angle] of [[-2.75,-1.65,-.08],[2.65,-1.45,.09]]){
        const o=g('broken_cream_parapet',terrace,[x,.28,z]);o.rotation.z=angle;
        box('parapet_wide_foot',[.7,.18,.7],[0,.02,0],P.stoneLight,o);
        box('cream_parapet_column',[.42,1.15,.45],[0,.64,0],P.cream,o);
        box('parapet_brass_head',[.6,.12,.62],[0,1.23,0],P.brass,o);
        box('old_black_canvas_wrap',[.49,.35,.49],[0,.83,.02],P.ink,o);
        tube('canvas_cord_binding',[[-.27,.9,.28],[0,.92,.3],[.27,.88,.26]],.025,P.cream,o);
      }
      // No inscription, royal crest, memorial portrait, or story evidence is added.
      const patch=k.cloth('quiet_folded_seal_canvas',1.2,.85,[.8,.34,-.72],terrace);patch.rotation.y=.3;
      box('dark_seal_canvas_fold',[.72,.055,.25],[.94,.35,-.78],P.ink,terrace).rotation.y=.3;
      k.deck('small_service_edge_wood',1.65,1.15,[-2.45,.32,1.85]);rail([-3.2,1.32],[-3.2,2.28],.37);
      lantern([-2.96,.38,2.18],.9);lantern([1.55,.36,1.78],.75);
      ell('moss_encroaching_cream_stone',[-2.4,.28,-.3],[.64,.075,.34],P.moss);
      flowers([-1.65,.28,1.05],6,.58);grassTufts([-2.4,.29,-.32],5,.64);
      for(let i=0;i<6;i++)stoneShard([-2.9+i*1.06,-1.6-(i%2)*.5,1.58+(i%2)*.18],.75);
      tube('single_old_hanging_root',[[-2.72,.15,.1],[-3,-.7,.3],[-2.82,-1.55,.4],[-3,-2.35,.2]],.08,P.woodDark);
      break;
    }
    case 'wind-tree': {
      rock('closed_root_soil_mound',[0,-.05,0],[1.52,.55,1.18],{grass:true,seed:1.8});
      const result=tree([-.28,0,-.05],1.35,root,{lean:1.18,animated:true});
      rootTangle([-.25,-.12,0],1.8,6);
      flowers([.65,0,.42],8,.65);grassTufts([-.4,0,-.7],6,.75);
      const memorialRibbon=g('plain_personal_tree_ribbon',result.group,[.22,.98,.12]);
      const cloth=k.cloth('little_coral_repair_ribbon',.65,.3,[.3,0,0],memorialRibbon);cloth.rotation.x=Math.PI/2;cloth.rotation.z=-.1;
      tube('loose_ribbon_tail',[[.54,-.06,.02],[.75,-.22,.04],[.7,-.43,.06]],.03,P.coral,memorialRibbon);
      clips.push(new T.AnimationClip('soft_canopy_sway_visual_only',8,result.tracks));
      break;
    }
    case 'hanging-garden': {
      const frame=g('handmade_hanging_garden_frame');
      for(const x of [-1.7,1.7]){
        box('wood_garden_upright',[.18,3.45,.2],[x,1.72,0],P.wood,frame).rotation.z=x<0?.035:-.035;
        box('teal_garden_foot',[.42,.18,.55],[x,.05,0],P.teal,frame);
        k.cylinder('garden_frame_brass_cap',.14,.12,.14,[x,3.47,0],P.brass,frame,8);
      }
      tube('arched_timber_crossbar',[[-1.7,3.4,0],[-.9,3.68,0],[.65,3.63,0],[1.7,3.4,0]],.1,P.woodLight,frame);
      tube('frame_diagonal_brace',[[-1.7,1.8,0],[-.7,3.54,0]],.055,P.woodDark,frame);
      const tracks=[];
      for(let j=0;j<3;j++){
        const x=(j-1)*1.12,y=j===1?1.3:1.93-(j%2)*.2,z=j===1?.25:-.02;
        const pendulum=g('flower_basket_pendulum',frame,[x,3.55,z]);
        const ropeLength=3.55-y;
        for(const side of [-1,1])tube('separate_basket_hanging_rope',[[0,0,0],[side*.23,-ropeLength+.17,0],[side*.38,-ropeLength,0]],.026,P.cream,pendulum);
        const basket=g('closed_wood_stave_flower_basket',pendulum,[0,-ropeLength,0]);
        k.cylinder('basket_closed_soil',.45,.35,.32,[0,-.12,0],P.soil,basket,12);
        for(let i=0;i<12;i++){
          const a=i/12*tau,m=box('individual_warm_basket_stave',[.2,.45,.075],[Math.cos(a)*.43,-.13,Math.sin(a)*.43],i%3?P.woodLight:P.wood,basket);m.rotation.y=Math.PI/2-a;m.rotation.z=.02*Math.sin(a);
        }
        k.ring('basket_lower_brass_band',.38,.026,[0,-.3,0],P.brass,basket);
        k.ring('basket_upper_teal_band',.45,.035,[0,.02,0],P.teal,basket);
        flowers([0,.03,0],5,.34,basket);
        for(let vine=0;vine<4;vine++){
          const a=vine/4*tau+.35,xx=Math.cos(a)*.37,zz=Math.sin(a)*.37,len=.9+(j+vine)%3*.33;
          tube('long_draped_living_vine',[[xx,.05,zz],[xx*1.32,-.45,zz*1.2],[xx*.9,-len,zz*1.18],[xx*1.35,-len-.3,zz*.95]],.027,P.pine,basket);
          for(let leaf=0;leaf<5;leaf++)flatLeaf('separate_trailing_vine_leaf',[xx*(1.2+Math.sin(leaf)*.2),-.14-leaf*(len+.1)/5,zz*1.15],.16,.28+(leaf%2)*.08,leaf%2?P.leaf:P.sage,basket,a+leaf*.8,-.32);
        }
        const values=[],axis=new T.Vector3(0,0,1),amount=.025+j*.006;
        for(const v of [0,amount,-amount*.7,amount*.55,0]){const q=new T.Quaternion().setFromAxisAngle(axis,v*(j===1?-1:1));values.push(q.x,q.y,q.z,q.w);}
        tracks.push(new T.QuaternionKeyframeTrack(`${pendulum.name}.quaternion`,[0,2,4,6,8],values));
      }
      const c=k.cloth('patched_garden_header_canvas',1.15,.4,[.18,3.65,.05],frame);c.rotation.x=.35;
      lantern([1.68,2.62,.05],.72,frame);
      clips.push(new T.AnimationClip('hanging_baskets_gentle_sway_visual_only',8,tracks));
      break;
    }
    default:throw new Error(`No map terrain recipe for ${spec.id}`);
  }
  root.updateMatrixWorld(true);
  return {clips};
}
