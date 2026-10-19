import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { THREE };

export const WORLD_PALETTE = {
  cream:0xffedbd, ivory:0xfff8df, honey:0xbd8551, wood:0xbd8551,
  woodLight:0xe0b27a, woodDark:0x825a40, amber:0xe8ad50, brass:0xc78a38,
  coral:0xdc7659, teal:0x4d8f8d, lightTeal:0x92c5b6, deepTeal:0x285b61,
  navy:0x324452, ink:0x253b41, green:0x7c9f64, sage:0xa8bd82,
  pine:0x4b7962, moss:0x6c8760, leaf:0x94b77b, flower:0xe8a38e,
  stone:0xaaa98f, stoneLight:0xd1cbb1, stoneDark:0x797f75,
  cloud:0xe9eddf, earth:0x8d7255, soil:0x66583f, water:0x78aaa5
};
export const PALETTE = WORLD_PALETTE;

export function makeWorldKit(spec) {
  if (!spec?.id) throw new Error('World asset requires an id.');
  let serial=0, state=[...spec.id].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const root=new THREE.Group();root.name=spec.id;
  root.userData={asset_id:spec.id,category:spec.category||null,purpose:spec.purpose||'',
    axes:'Y up, Z front; origin is a visual assembly anchor, not an engine socket.',
    units:'Relative design units; engine scale is not approved.',
    implementation:'Static local vertex-painted geometry; no fake animation, collisions, gameplay, or physics.',
    style:'Cloudstitch warm handmade wood, cream cloth, teal enamel and brass.'};
  const mat=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide});
  function group(name='part',parent=root) {
    const g=new THREE.Group();g.name=`${spec.id}_${name}_${serial++}`;parent.add(g);return g;
  }
  function mesh(name,geometry,color=WORLD_PALETTE.honey,parent=root) {
    const g=geometry.index?geometry.toNonIndexed():geometry.clone();
    g.deleteAttribute('uv');g.deleteAttribute('uv1');g.deleteAttribute('uv2');
    g.computeVertexNormals();
    const p=g.getAttribute('position'),n=g.getAttribute('normal'),colors=[];
    const base=new THREE.Color(color),normal=new THREE.Vector3();
    for(let i=0;i<p.count;i+=3) {
      normal.set(n.getX(i),n.getY(i),n.getZ(i));
      if(!Number.isFinite(normal.lengthSq())||normal.lengthSq()<1e-12)normal.set(0,1,0);
      else normal.normalize();
      const light=normal.x*-.32+normal.y*.8+normal.z*.32;
      const band=light>.46?1.035:light>-.18?.91:.73;
      const c=base.clone().multiplyScalar(band*(.975+random()*.05));
      for(let j=0;j<3 && i+j<p.count;j++) {
        n.setXYZ(i+j,normal.x,normal.y,normal.z);
        colors.push(THREE.MathUtils.clamp(c.r,0,1),THREE.MathUtils.clamp(c.g,0,1),THREE.MathUtils.clamp(c.b,0,1));
      }
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const m=new THREE.Mesh(g,mat);m.name=`${spec.id}_${name}_${serial++}`;parent.add(m);return m;
  }
  function place(m,pos=[0,0,0]){m.position.set(...pos);return m;}
  function box(name,size,pos,color,parent=root){return place(mesh(name,new THREE.BoxGeometry(...size),color,parent),pos);}
  function bevelBox(name,size,pos,color,parent=root){
    const radius=Math.max(.001,Math.min(...size)*.16);
    return place(mesh(name,new RoundedBoxGeometry(...size,1,radius),color,parent),pos);
  }
  function cylinder(name,rTop,rBottom,height,pos,color,parent=root,segments=12){
    return place(mesh(name,new THREE.CylinderGeometry(rTop,rBottom,height,segments),color,parent),pos);
  }
  function cone(name,radius,height,pos,color,parent=root,segments=10){
    return place(mesh(name,new THREE.ConeGeometry(radius,height,segments),color,parent),pos);
  }
  function sphere(name,radius,pos,color,parent=root,scale=null){
    const m=place(mesh(name,new THREE.IcosahedronGeometry(radius,1),color,parent),pos);
    if(scale)m.scale.set(...scale);return m;
  }
  function ring(name,radius,width,pos,color,parent=root){
    const geo=new THREE.TorusGeometry(radius,width,4,24);geo.rotateX(Math.PI/2);
    return place(mesh(name,geo,color,parent),pos);
  }
  function tube(name,points,radius,color,parent=root,closed=false){
    if(points.length<2)throw new Error('Tube needs at least two points: '+name);
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    return mesh(name,new THREE.TubeGeometry(curve,Math.max(8,Math.min(40,points.length*4)),radius,5,closed),color,parent);
  }
  function bolt(name,pos,parent=root){
    const g=place(group(name,parent),pos);
    cylinder('brass_screw',.027,.027,.025,[0,.0125,0],WORLD_PALETTE.brass,g,6);
    box('screw_slot',[.032,.004,.006],[0,.027,0],WORLD_PALETTE.woodDark,g);return g;
  }
  function paintWood(name,size,pos,parent=root){
    const g=place(group(name,parent),pos),[w,h,d]=size;
    bevelBox('warm_rounded_wood',size,[0,0,0],WORLD_PALETTE.honey,g);
    for(let i=0;i<3;i++) {
      const z=(i-1)*d*.23;
      box('painted_wood_grain',[w*(.38+random()*.24),.004,.008],[w*(random()-.5)*.2,h*.5+.002,z],i%2?WORLD_PALETTE.woodDark:WORLD_PALETTE.woodLight,g);
    }
    return g;
  }
  function deck(name,w,d,pos,parent=root){
    const g=place(group(name,parent),pos);
    const count=Math.max(3,Math.min(24,Math.ceil(w/.22))),step=w/count;
    for(let i=0;i<count;i++) {
      const x=-w*.5+(i+.5)*step;
      box('individual_deck_plank',[step*.96,.095,d],[x,0,0],i%3?WORLD_PALETTE.honey:WORLD_PALETTE.woodLight,g);
      box('plank_grain',[.012,.004,d*(.5+random()*.25)],[x+step*.2,.05,0],WORLD_PALETTE.woodDark,g);
    }
    for(const sign of [-1,1]) {
      bevelBox('teal_deck_end',[w+.08,.12,.065],[0,0,sign*(d*.5+.02)],WORLD_PALETTE.teal,g);
      bevelBox('teal_deck_side',[.065,.12,d],[sign*(w*.5+.02),0,0],WORLD_PALETTE.teal,g);
      for(const z of [-d*.4,d*.4])bolt('deck_bolt',[sign*w*.45,.065,z],g);
    }
    return g;
  }
  function window(name,radius,pos,parent=root){
    const g=place(group(name,parent),pos);
    const glass=cylinder('soft_teal_window',radius*.91,radius*.91,.028,[0,0,0],WORLD_PALETTE.lightTeal,g,16);glass.rotation.x=Math.PI/2;
    const frame=ring('brass_porthole',radius,.025,[0,0,.025],WORLD_PALETTE.brass,g);frame.rotation.x=Math.PI/2;
    box('window_cross_vertical',[.025,radius*1.65,.03],[0,0,.035],WORLD_PALETTE.cream,g);
    box('window_cross_horizontal',[radius*1.65,.025,.03],[0,0,.035],WORLD_PALETTE.cream,g);
    const reflection=box('painted_glass_glint',[radius*.18,radius*.45,.006],[-radius*.36,radius*.23,.043],WORLD_PALETTE.ivory,g);reflection.rotation.z=-.22;
    return g;
  }
  function cloth(name,w,d,pos,parent=root){
    const g=place(group(name,parent),pos),nx=6,nz=5,sag=Math.min(w,d)*.14;
    const points=[],indices=[];
    for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
      const u=x/nx,v=z/nz;
      points.push((u-.5)*w,-Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*sag,(v-.5)*d);
    }
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const a=z*(nx+1)+x,b=a+1,c=a+nx+1,e=c+1;indices.push(a,c,b,b,c,e);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.setIndex(indices);
    mesh('sagging_cream_canvas',geo,WORLD_PALETTE.cream,g);
    const patch=box('coral_canvas_repair',[w*.23,.012,d*.27],[w*.21,-sag*.6+.012,-d*.08],WORLD_PALETTE.coral,g);patch.rotation.z=.035;
    for(const sign of [-1,1])for(let i=0;i<7;i++){
      box('cream_canvas_edge_stitch',[.012,.009,d*.045],[sign*w*.48,.008,(i/6-.5)*d*.86],WORLD_PALETTE.woodLight,g);
      box('cream_patch_stitch',[w*.032,.01,.009],[w*.21+(i/6-.5)*w*.21,-sag*.6+.026,-d*.08+sign*d*.14],WORLD_PALETTE.cream,g);
    }
    return g;
  }
  function rope(name,points,parent=root){return tube(name,points,.018,WORLD_PALETTE.cream,parent);}
  return {THREE,root,palette:WORLD_PALETTE,group,mesh,box,bevelBox,cylinder,cone,sphere,ring,tube,deck,window,cloth,rope,bolt,paintWood,random};
}
