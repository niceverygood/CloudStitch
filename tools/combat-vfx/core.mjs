import * as THREE from 'three';
export { THREE };
export const PALETTE = {cream:0xffedbd,ivory:0xfff8df,amber:0xe8ad50,brass:0xc78a38,coral:0xdc7659,hot:0xf2b45d,teal:0x4d8f8d,lightTeal:0x92c5b6,deepTeal:0x285b61,navy:0x324452,smoke:0x889b9b,darkSmoke:0x536a70,wood:0xbd8551,woodLight:0xe0b27a,ink:0x253b41};
export function makeKit(spec) {
  let state = [...spec.id].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261)>>>0, serial=0;
  const random = () => {state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const root = new THREE.Group(); root.name=spec.id; root.userData={asset_id:spec.id,purpose:spec.purpose,axes:'Y up, Z forward; surface impacts Y normal',engine_integration:'Visual mesh/transform animation only. No collisions, damage, audio or engine particle system.'};
  const tracks=[], mats=new Map();
  const material = (opacity=1) => {if(!mats.has(opacity))mats.set(opacity,new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,transparent:opacity<1,opacity,depthWrite:opacity>=1,side:THREE.DoubleSide}));return mats.get(opacity);};
  function group(name='part',parent=root){const g=new THREE.Group();g.name=spec.id+'_'+name+'_'+serial++;parent.add(g);return g;}
  function mesh(geometry,color,parent=root,name='mesh',opacity=1){
    const geo=geometry.index?geometry.toNonIndexed():geometry.clone();geo.deleteAttribute('uv');if(!geo.attributes.normal)geo.computeVertexNormals();
    const pos=geo.attributes.position, norm=geo.attributes.normal, colors=[]; const base=new THREE.Color(color);
    for(let i=0;i<pos.count;i+=3){const light=(norm.getX(i)*-.35+norm.getY(i)*.75+norm.getZ(i)*.4);const band=light>.48?1.08:light>-.16?.9:.69;const variation=.97+random()*.06;const c=base.clone().multiplyScalar(band*variation);c.r=Math.min(1,Math.max(0,c.r));c.g=Math.min(1,Math.max(0,c.g));c.b=Math.min(1,Math.max(0,c.b));for(let j=0;j<3;j++)colors.push(c.r,c.g,c.b);}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const m=new THREE.Mesh(geo,material(opacity));m.name=spec.id+'_'+name+'_'+serial++;parent.add(m);return m;
  }
  const puff=(radius,color,parent=root,detail=1,opacity=1)=>mesh(new THREE.IcosahedronGeometry(radius,detail),color,parent,'painted_puff',opacity);
  const box=(x,y,z,color,parent=root)=>mesh(new THREE.BoxGeometry(x,y,z),color,parent,'chip');
  const cone=(radius,height,color,parent=root,segments=7)=>mesh(new THREE.ConeGeometry(radius,height,segments),color,parent,'taper');
  const cylinder=(radius,height,color,parent=root,segments=12)=>mesh(new THREE.CylinderGeometry(radius,radius,height,segments),color,parent,'cylinder');
  function ring(radius,width,color,parent=root,normal='y',opacity=1){const geo=new THREE.TorusGeometry(radius,width,4,28);if(normal==='y')geo.rotateX(Math.PI/2);return mesh(geo,color,parent,'ripple',opacity);}
  function tube(points,radius,color,parent=root){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length*6),radius,5,false),color,parent,'painted_curve');}
  function beam(a,b,radius,color,parent=root){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b);const m=cylinder(radius,va.distanceTo(vb),color,parent,6);m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.clone().sub(va).normalize());return m;}
  function motion(node,{times=[0,.15,.65,1],positions,scales,rotations}={}){
    const indices=times.map((v,i)=>i).filter(i=>i===0||times[i]>times[i-1]);
    if(times.some(v=>v<0||v>1)||indices.length<2)throw new Error('Invalid normalized keyframe times: '+node.name);
    const t=indices.map(i=>times[i]*spec.duration_seconds);
    if(positions)tracks.push(new THREE.VectorKeyframeTrack(node.name+'.position',t,indices.flatMap(i=>positions[i])));
    if(scales)tracks.push(new THREE.VectorKeyframeTrack(node.name+'.scale',t,indices.flatMap(i=>typeof scales[i]==='number'?[scales[i],scales[i],scales[i]]:scales[i])));
    if(rotations)tracks.push(new THREE.QuaternionKeyframeTrack(node.name+'.quaternion',t,indices.flatMap(i=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotations[i])).toArray())));
  }
  function envelope(node,{start=0,peak=.15,end=1,size=1}={}){const times=[0],scales=[.001];if(start>0){times.push(start);scales.push(.001);}times.push(peak,end);scales.push(size,.001);if(end<1){times.push(1);scales.push(.001);}motion(node,{times,scales});}
  function rayBurst({count=12,radius=1.4,height=.8,color=PALETTE.amber,chip=false,parent=root,start=0,end=1}={}){
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2+random()*.25, r=radius*(.55+random()*.45), h=height*(.35+random()*.65);const g=group('burst',parent);const p=chip?box(.05+random()*.09,.12+random()*.18,.04,color,g):cone(.025+random()*.035,.25+random()*.3,color,g,4);p.rotation.z=a;
      const ts=start>0?[0,start,start+(end-start)*.24,end,1]:[0,.14,end,1];const points=ts.map(t=>{const f=Math.max(0,Math.min(1,(t-start)/(end-start)));return [Math.cos(a)*r*f,h*Math.sin(f*Math.PI*.75),Math.sin(a)*r*f];});const scales=ts.map(t=>t<=start||t>=end?.001:1);motion(g,{times:ts,positions:points,scales,rotations:ts.map(t=>[t*3+a,a,t*5])});}
  }
  function smoke({count=7,color=PALETTE.smoke,radius=.32,spread=.7,rise=1.6,start=0,parent=root}={}){for(let i=0;i<count;i++){const s=start+i/count*.32,e=Math.min(.99,s+.6),g=group('smoke',parent);puff(radius*(.7+random()*.5),color,g,1);const a=random()*6.28,x=Math.cos(a)*spread,z=Math.sin(a)*spread;const ts=[0,...(s>0?[s]:[]),s+.08,(s+e)/2,e,1];const ps=ts.map(t=>{const f=Math.max(0,(t-s)/(e-s));return[x*(.2+f),f*rise,z*(.2+f)];});const ss=ts.map(t=>t<=s||t>=e?.001:.5+(t-s)/(e-s)*1.4);motion(g,{times:ts,positions:ps,scales:ss});}}
  function clip(){if(!tracks.length)motion(root,{times:[0,1],scales:[1,1]});return new THREE.AnimationClip(spec.id,spec.duration_seconds,tracks);}
  return {root,tracks,group,mesh,puff,box,cone,cylinder,ring,tube,beam,motion,envelope,rayBurst,smoke,random,clip,P:PALETTE,THREE};
}
