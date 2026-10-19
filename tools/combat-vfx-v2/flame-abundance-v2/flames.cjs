const {THREE:T}=require('./glb.cjs');
const EPS=.00001,END=4.2,Q=(axis,a)=>new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis),a).toArray();
// Volumetric painted lobes, broad curved flame tongues and twisting ribbons.
// Each layer has its own birth/crest/collapse rhythm; not scaled old sprites.
function addAbundantFire(g,{mode,start,contact,added}){
 const palette={edge:0xc9572f,coral:0xf17b35,gold:0xffbd52,yellow:0xffdf83,hot:0xfff3be,white:0xfff9df,smoke:0xa29883,shadow:0x696d65};
 const sphere=new T.SphereGeometry(1,20,14),dust=new T.SphereGeometry(1,8,6),flameGeos=[],ribbons=[];
 function tongue(seed){const points=[],normals=[],indices=[],rows=18,cols=8;for(let y=0;y<=rows;y++){const t=y/rows,center=Math.sin(t*4.7+seed)*.14*t+Math.sin(t*9+seed*.7)*.07*t,half=Math.sin(Math.PI*Math.pow(t,.72))*.38*(1-.4*t)+.028*(1-t);for(let x=0;x<=cols;x++){const u=x/cols*2-1;points.push(center+u*half,t,Math.sin(Math.PI*(u+1)*.5)*Math.sin(t*Math.PI)*.20+Math.sin(t*6+seed)*t*.07);}}for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;}
 for(let i=0;i<5;i++)flameGeos.push(tongue(i*1.7));
 function ribbon(seed){const points=[],indices=[],N=54;for(let i=0;i<=N;i++){const t=i/N,a=t*Math.PI*3.7+seed,r=(.72-.45*t)*(1+.12*Math.sin(t*17+seed)),w=.055+.10*Math.sin(Math.PI*t);for(const side of[-1,1])points.push(Math.cos(a)*(r+side*w),t*3,Math.sin(a)*(r+side*w));if(i<N){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;}
 for(let i=0;i<3;i++)ribbons.push(ribbon(i*2.1));
 function blob(seed){const geo=sphere.clone(),p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.07*Math.sin(x*8+seed)*Math.sin(y*7-seed)+.04*Math.cos(z*11+y*5);p.setXYZ(i,x*r,y*r,z*r);}geo.computeVertexNormals();return geo;}
 const lobes=[blob(1),blob(3),blob(7)];let count=0;
 function mesh(name,geo,color,parent,position=[0,0,0],rotation){count++;return g.mesh('Abundant_fire_'+name,geo,color,parent,{translation:position,...(rotation?{rotation}:{})});}
 function grow(n,t,end,scale,seed=0){const vector=v=>Array.isArray(v)?v:[v,v,v],s=vector(scale);g.scale(n,[0,t,t+.09,t+.24,Math.max(t+.30,end-.35),end,END],[EPS,EPS,s.map(x=>x*.48),s,s.map(x=>x*.74),EPS,EPS]);}
 function ember(n,t,end,a,b){g.move(n,[0,t,t+.18,end,END],[a,a,[(a[0]+b[0])*.5,(a[1]+b[1])*.5+.3,(a[2]+b[2])*.5],b,b]);grow(n,t,end,[.034,.10,.034]);}
 function fireBed(at,t,end,radius,parent){const root=g.node('Abundant_fire_scalloped_carpet',parent,{translation:at});const N=88,vertices=[0,0,0],indices=[];for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,r=radius*(1+.09*Math.sin(i*2.6)+.05*Math.cos(i*.73));vertices.push(Math.cos(a)*r,.02,Math.sin(a)*r);}for(let i=1;i<=N;i++)indices.push(0,i,i+1);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const red=mesh('red_ember_lace_bed',geo,palette.edge,root);grow(red,t,end,1);for(let i=0;i<15;i++){const a=i*2.399,r=radius*(.25+.65*((i*7)%13)/13),p=[Math.cos(a)*r,0,Math.sin(a)*r],s=.45+.12*(i%3);const n=mesh('bed_lapping_petals',flameGeos[i%5],i%3?palette.gold:palette.coral,root,p,Q([0,1,0],a));grow(n,t+i*.017,end-.08,[s,s*1.7,s]);g.rotate(n,[0,t,t+.4,t+.8,end,END],[0,.05,-.14,.14,.2,0],'z');}return root;}
 function burst(at,t,{radius=1.25,height=3.6,linger=1.4,ground=false,swirl=true}={}){
 const root=g.node('Abundant_fire_primary_blossom',added,{translation:at}),end=Math.min(4.03,t+linger);
 // Cream hot heart is clustered around one powerful silhouette, with a warm
 // amber/coral shell left visible around its contour.
 for(let i=0;i<9;i++){const a=i*2.399,r=i===0?0:radius*(.25+.09*(i%3)),p=[Math.cos(a)*r,.12+(i%4)*height*.14,Math.sin(a)*r*.7],s=radius*(i===0?.85:.45+.06*(i%2));for(const [layer,color,k]of[['shell',palette.gold,1.12],['core',i%3?palette.hot:palette.white,.88]]){const n=mesh(layer+'_rolling_billow',lobes[i%3],color,root,p);grow(n,t+i*.018,end-(i%3)*.05,[s*k,s*k*(1.10+.12*(i%3)),s*k]);g.move(n,[0,t,t+.32,end,END],[p,p,[p[0]*1.12,p[1]+.25,p[2]*1.12],[p[0]*1.3,p[1]+.7,p[2]*1.3],p]);}}
 for(let i=0;i<13;i++){const a=i*2.399,r=radius*(.55+.1*(i%3)),p=[Math.cos(a)*r,.05,Math.sin(a)*r*.7],h=height*(.55+.12*(i%4)),w=radius*(.8+.08*(i%3)),q=new T.Quaternion().setFromEuler(new T.Euler(.11*Math.sin(a),a,.13*Math.cos(a))).toArray();for(const [color,width,delay]of[[palette.coral,1.05,0],[palette.yellow,.82,.015],[palette.hot,.45,.035]]){const n=mesh('rising_pointed_tongue',flameGeos[i%5],color,root,p,q);grow(n,t+i*.014+delay,end-.10,[w*width,h*(color===palette.hot?.78:1),w*.7]);g.rotate(n,[0,t,t+.2,t+.5,end,END],[0,-.07,.15,-.14,.25,0],'z');}}
 if(swirl)for(let i=0;i<3;i++){const n=mesh('ivory_spiralling_ribbon',ribbons[i],i===1?palette.white:palette.yellow,root,[0,.05,0]);grow(n,t+.06+i*.025,end-.15,[radius*.85,height/3,radius*.85]);g.rotate(n,[0,t,t+.5,end,END],[0,0,.8,1.5,0],'y');}
 for(let i=0;i<23;i++){const a=i*2.399,p=[Math.cos(a)*radius*.3,.15,Math.sin(a)*radius*.3],destination=[Math.cos(a)*radius*(1.4+.3*(i%3)),height*(.6+.08*(i%5)),Math.sin(a)*radius*1.6],n=mesh('rising_hot_ember',dust,i%3?palette.hot:palette.coral,root,p);ember(n,t+i*.009,Math.min(end+.3,4.1),p,destination);}
 // Smoke appears after the hot crest, expands and drifts; it does not replace
 // the bright first impact with a static opaque cloud.
 for(let i=0;i<7;i++){const a=i*2.399,p=[Math.cos(a)*radius*.4,height*.6,Math.sin(a)*radius*.4],n=mesh('late_lifted_painted_smoke',lobes[i%3],i%2?palette.smoke:palette.shadow,root,p);const st=t+.48+i*.05,finish=Math.min(4.15,st+1.45);grow(n,st,finish,[radius*.55,height*.20,radius*.5]);g.move(n,[0,st,finish,END],[p,p,[p[0]*2,p[1]+1.1,p[2]*2],p]);}
 if(ground)fireBed([at[0],Math.max(.03,at[1]-.1),at[2]],t,Math.min(4.1,t+linger+.3),radius*1.6,added);
 return root;}
 if(mode==='flame'){
 // A continuous, widening braided jet with successive rolling fire fronts,
 // followed by three ignited areas rather than one small repeated puff.
 const length=contact[2]-start[2];for(let station=0;station<7;station++){const f=station/6,at=[start[0]+Math.sin(f*5)*.10,start[1]+.12*Math.sin(f*3),start[2]+f*length];for(let layer=0;layer<3;layer++){const root=g.node('Abundant_fire_braided_jet_'+station+'_'+layer,added,{translation:at,rotation:Q([1,0,0],Math.PI/2)});for(let cycle=0;cycle<3;cycle++){const n=mesh('jet_flame_sheet',flameGeos[(station+cycle)%5],[palette.coral,palette.yellow,palette.hot][layer],root,[Math.sin(station*3)*.1,0,0],Q([0,1,0],cycle*Math.PI/3));const r=.4+f*.75;grow(n,.61+station*.065+cycle*.16,2.30+station*.045,[r*(1-layer*.2),1.15+f*.55,r*(1-layer*.2)]);}}}
 burst(contact,1.12,{radius:1.4,height:4.4,linger:2.1,swirl:true});for(const side of[-1,1])burst([contact[0]+side*1.45,.15,contact[2]-.6],1.45+(side+1)*.12,{radius:.85,height:2.3,linger:2.1,ground:true,swirl:false});
 }else if(mode==='rocket'){for(let i=0;i<3;i++)burst([contact[0]+(i-1)*.8,contact[1],contact[2]-.05],1.45+i*.18,{radius:1.12,height:3.8+i*.45,linger:1.6,swirl:true});}
 else if(mode==='cannon'){burst(contact,1.45,{radius:1.75,height:3.5,linger:1.6});for(const side of[-1,1])burst([contact[0]+side*1.1,contact[1]-.35,contact[2]-.12],1.56,{radius:.78,height:2.25,linger:1.5,swirl:false});}
 else if(mode==='lob')burst(contact,1.45,{radius:1.75,height:5,linger:2.1,swirl:true});
 else if(mode==='drop')burst(contact,1.45,{radius:1.75,height:4.8,linger:2.1,ground:true,swirl:true});
 return {newVisualNodes:count,design:'Ivory hot rolling cores, coral/gold pointed tongues, ivory twist ribbons, ember trajectories, scalloped burning beds, late lifted smoke; five distinct rhythms',runtimeBloomRequired:false};
}
module.exports={addAbundantFire};
