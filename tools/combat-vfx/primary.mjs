export function buildPrimary(spec,k) {
 const {root,group,puff,box,cone,cylinder,ring,tube,beam,motion,envelope,rayBurst,smoke,random,P,THREE}=k;
 function flash(size=1,wide=false){const g=group('muzzle_flower');const core=puff(.17,P.ivory,g);core.scale.set(.75,.75,2);core.position.z=.17;for(let i=0;i<7;i++){const a=i/7*Math.PI*2;const m=cone(.09,.55,P.amber,g,5);m.rotation.x=Math.PI/2;m.position.set(Math.cos(a)*.12,Math.sin(a)*.12,.28);m.rotation.y=Math.cos(a)*(wide?.65:.3);m.rotation.z=Math.sin(a)*.3;}const rear=puff(.22,P.coral,g);rear.scale.set(.8,.8,.45);motion(g,{times:[0,.12,.34,.65,1],scales:[.001,size,size*.7,.001,.001]});return g;}
 function pressure(size=1){const r=ring(.28,.018,P.cream,root,'z');motion(r,{times:[0,.12,.65,1],positions:[[0,0,.05],[0,0,.2],[0,0,.7],[0,0,.9]],scales:[.001,size,size*2,.001]});return r;}
 function impact(size=1,color=P.amber){const g=group('impact');const c=puff(.2*size,P.cream,g);c.position.y=.12;envelope(c,{peak:.12,end:.58,size:1.3});rayBurst({count:10,radius:1.15*size,height:.8*size,color,parent:g});const r=ring(.3*size,.025*size,color,g);motion(r,{times:[0,.12,.65,1],scales:[.001,.7,2.4,.001]});return g;}
 function chunks(color,count=8,size=1){rayBurst({count,radius:1.2*size,height:1.2*size,color,chip:true});}
 function flight(type){const g=group('projectile_carrier');
   if(type==='machine'){const bullet=cone(.07,.25,P.brass,g,8);bullet.rotation.x=Math.PI/2;const tracer=cylinder(.026,.85,P.cream,g,6);tracer.rotation.x=Math.PI/2;tracer.position.z=-.5;}
   if(type==='cannon'){puff(.2,P.navy,g);ring(.19,.025,P.brass,g,'z');const c=puff(.08,P.cream,g);c.position.z=-.23;}
   if(type==='mortar'){const bomb=puff(.22,P.navy,g);bomb.scale.set(1,1,1.3);ring(.21,.035,P.teal,g,'z');const fin=group('tail_fins',g);for(let i=0;i<4;i++){const f=box(.055,.22,.23,P.brass,fin);f.position.z=-.26;f.rotation.z=i*Math.PI/2;} }
   if(type==='harpoon'){const shaft=cylinder(.035,.95,P.teal,g,8);shaft.rotation.x=Math.PI/2;const tip=cone(.16,.43,P.navy,g,4);tip.rotation.x=Math.PI/2;tip.position.z=.55;for(const sign of [-1,1]){const barb=cone(.07,.28,P.navy,g,3);barb.rotation.x=-Math.PI/2;barb.rotation.z=sign*.6;barb.position.set(sign*.11,0,.39);}const band=cylinder(.052,.14,P.brass,g,8);band.rotation.x=Math.PI/2;band.position.z=-.25;
     const rope=group('tether_growth');tube([[0,0,0],[.06,-.05,.3],[-.04,-.07,.65],[0,0,1]],.018,P.cream,rope);motion(rope,{times:[0,.12,.75,1],scales:[[1,1,.001],[1,1,.48],[1,1,3],[1,1,4]]});}
   if(type==='chain'){for(const sign of [-1,1]){const b=puff(.18,P.navy,g);b.position.x=sign*.34;ring(.09,.024,P.brass,g,'z').position.x=sign*.25;}for(let i=0;i<5;i++){const r=ring(.065,.018,P.brass,g,i%2?'z':'y');r.position.x=-.2+i*.1;}}
   const times=Array.from({length:9},(_,i)=>i/8);const arc=type==='mortar';motion(g,{times,positions:times.map(t=>[0,arc?Math.sin(t*Math.PI)*2:0,t*4]),scales:times.map(t=>t===1&&type!=='harpoon'?.001:1),rotations:times.map(t=>[arc?Math.cos(t*Math.PI)*-.6:0,0,type==='chain'?t*Math.PI*4:0])});
   if(['cannon','mortar'].includes(type)){for(let i=0;i<7;i++){const s=i*.09,e=Math.min(.99,s+.45),p=puff(.1+i*.012,P.smoke);const z=i*.45,y=arc?Math.sin(z/4*Math.PI)*2:0;motion(p,{times:[0,s||.001,s+.08,e,1],positions:[[0,y,z],[0,y,z],[0,y+.05,z],[.1,y+.4,z],[.1,y+.4,z]],scales:[.001,.001,1,.001,.001]});}}
   return g;
 }
 function flame(parent=root,extent=1.9){for(let i=0;i<9;i++){const g=group('flame_lobe',parent),z=.25+i*.17;const p=puff(.12+i*.027,i%3===0?P.coral:i%3===1?P.amber:P.cream,g);p.scale.set(1,1,1.6);g.position.set(Math.sin(i*2)*.05,Math.cos(i*2)*.07,z);const base=[g.position.x,g.position.y,g.position.z];motion(g,{times:[0,.13,.31,.51,.73,.9,1],positions:[base,base,[base[0]+.04,base[1]+.07,z+.1],base,[base[0]-.05,base[1],z+.13],base,base],scales:[.001,.7+i*.04,1,.75,1,.7,.001]});} }
 switch(spec.id){
 case 'machine-gun-muzzle': {flash(.6);const casing=cylinder(.045,.14,P.brass);motion(casing,{times:[0,.15,.5,1],positions:[[0,0,-.1],[.3,.2,-.1],[.8,-.1,-.25],[1,-.4,-.3]],scales:[.001,1,1,.001],rotations:[[0,0,0],[0,0,.5],[1,1,2],[2,2,4]]});break;}
 case 'machine-gun-projectile':flight('machine');break;
 case 'machine-gun-hit':impact(.45);break;
 case 'cannon-muzzle':flash(1.3);pressure(1.4);{const g=group('bore_smoke');g.rotation.x=Math.PI/2;smoke({count:5,radius:.16,spread:.12,rise:1.2,start:.15,parent:g});}break;
 case 'cannon-projectile':flight('cannon');break;
 case 'cannon-hit':impact(1.1);chunks(P.wood,10,1.1);smoke({count:7,color:P.darkSmoke,start:.17,rise:1.4});break;
 case 'mortar-launch':{const f=flash(.85);f.rotation.x=-Math.PI/2;pressure(.8).rotation.x=-Math.PI/2;smoke({count:5,color:P.cream,radius:.15,spread:.25,rise:1.8,start:.05});break;}
 case 'mortar-projectile':flight('mortar');break;
 case 'mortar-hit':{impact(1.5,P.coral);chunks(P.wood,14,1.3);smoke({count:9,color:P.darkSmoke,radius:.28,rise:2,start:.12});break;}
 case 'harpoon-launch':{const ringlet=ring(.22,.025,P.teal,root,'z');motion(ringlet,{times:[0,.2,.6,1],positions:[[0,0,0],[0,0,.3],[0,0,.7],[0,0,1]],scales:[.001,1,1.5,.001]});const g=group('pressure_puff');g.rotation.x=Math.PI/2;smoke({count:4,color:P.cream,radius:.1,spread:.12,rise:.7,parent:g});break;}
 case 'harpoon-projectile':flight('harpoon');break;
 case 'harpoon-hit':{impact(.55,P.brass);const latch=group('embedded_latch');const shaft=cylinder(.045,.5,P.navy,latch);shaft.position.y=.05;for(const sign of [-1,1]){const c=box(.08,.22,.08,P.brass,latch);c.position.x=sign*.16;c.rotation.z=sign*.4;}motion(latch,{times:[0,.15,.28,1],positions:[[0,.5,0],[0,.08,0],[0,0,0],[0,0,0]],scales:[.001,1,1,1]});const rope=tube([[0,.15,0],[.1,.4,0],[-.05,.7,0],[0,1,0]],.025,P.cream);envelope(rope,{peak:.26,end:1,size:1});break;}
 case 'chain-shot-launch':flash(.95,true);pressure(1.1);break;
 case 'chain-shot-projectile':flight('chain');break;
 case 'chain-shot-hit':{impact(.7,P.brass);for(let i=0;i<9;i++){const a=i/9*Math.PI*2;const r=ring(.11,.027,P.navy,root,i%2?'z':'y');motion(r,{times:[0,.18,.5,1],positions:[[0,0,0],[Math.cos(a)*.4,.1,Math.sin(a)*.4],[Math.cos(a)*.52,.15,Math.sin(a)*.52],[Math.cos(a)*.52,.15,Math.sin(a)*.52]],scales:[.001,1,1,.001]});}break;}
 case 'flamethrower-ignite':flash(.45);{const pilot=cone(.08,.32,P.coral);pilot.rotation.x=Math.PI/2;pilot.position.z=.2;envelope(pilot,{peak:.12,end:.9,size:1});}break;
 case 'flamethrower-stream':flame();break;
 case 'flamethrower-hit':{const g=group('surface_fire');g.rotation.x=-Math.PI/2;flame(g);smoke({count:5,color:P.darkSmoke,radius:.16,spread:.4,rise:1.7,start:.15});break;}
 case 'wood-hit':impact(.65);chunks(P.woodLight,13,.9);{const s=box(.12,.5,.035,P.wood);motion(s,{times:[0,.2,.7,1],positions:[[0,0,0],[.6,.7,.2],[.9,.3,.3],[1,0,.4]],scales:[.001,1,1,.001],rotations:[[0,0,0],[0,1,1],[1,2,3],[2,3,4]]});}break;
 case 'metal-hit':impact(.75,P.brass);chunks(P.teal,7,.8);rayBurst({count:13,color:P.cream,radius:1.4,height:.4});break;
 case 'fabric-hit':{for(let i=0;i<10;i++){const m=cone(.09,.33,i%4?P.cream:P.coral,root,3);motion(m,{times:[0,.22,.65,1],positions:[[0,0,0],[(random()-.5)*1.2,random()*.6,(random()-.5)*1.2],[(random()-.5)*1.7,.2,(random()-.5)*1.7],[(random()-.5)*2,-.1,(random()-.5)*2]],scales:[.001,[1,1,.1],[1,.9,.1],.001],rotations:[[0,0,0],[1,i,.3],[2,i+1,1],[3,i+2,2]]});}for(let i=0;i<4;i++){const t=tube([[0,0,0],[.05,.15,0],[.15,.3,.05]],.008,P.cream);t.rotation.y=i*1.6;envelope(t,{peak:.2,end:.9});}break;}
 case 'armor-hit':{impact(.6,P.amber);const shield=group('dent_ring');ring(.4,.06,P.navy,shield);for(let i=0;i<4;i++){const p=box(.18,.035,.08,P.teal,shield);p.position.set(Math.cos(i*1.57)*.32,.02,Math.sin(i*1.57)*.32);p.rotation.y=-i*1.57;}envelope(shield,{peak:.14,end:.85});rayBurst({count:8,radius:.8,height:.3,color:P.brass});break;}
 case 'ricochet-hit':{const g=group('ricochet_path');beam([0,0,0],[-.6,.15,.5],.018,P.amber,g);beam([-.6,.15,.5],[-1.3,.35,.2],.012,P.cream,g);envelope(g,{peak:.12,end:.7});const c=puff(.08,P.brass);motion(c,{times:[0,.3,.6,1],positions:[[.4,.5,-.6],[0,0,0],[-.6,.15,.5],[-1.3,.35,.2]],scales:[1,1,1,.001]});break;}
 case 'weakpoint-hit':{impact(1.1,P.coral);for(let i=0;i<4;i++){const g=group('critical_diamond');const d=cone(.1,.3,P.coral,g,4);d.rotation.x=Math.PI/2;g.rotation.y=i*Math.PI/2;motion(g,{times:[0,.18,.55,1],positions:[[0,0,0],[Math.cos(i*1.57)*.6,.15,Math.sin(i*1.57)*.6],[Math.cos(i*1.57),.2,Math.sin(i*1.57)],[Math.cos(i*1.57)*1.2,.2,Math.sin(i*1.57)*1.2]],scales:[.001,1,1,.001]});}break;}
 case 'cloud-miss':smoke({count:10,color:P.cream,radius:.28,spread:.7,rise:.4});break;
 case 'penetration-exit':{impact(.7,P.cream);chunks(P.teal,6,.7);const g=group('exit_cone');const c=cone(.25,.9,P.amber,g,6);c.position.y=.5;envelope(g,{peak:.1,end:.6,size:1});break;}
 default:throw new Error('Primary effect not implemented: '+spec.id);
 }
 return root;
}
