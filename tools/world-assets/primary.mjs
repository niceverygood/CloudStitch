// Original modular architecture and floating terrain for Cloudstitch.
export function buildPrimary(spec,k){
 const {THREE:T,root,palette:P}=k,id=spec.id;
 const g=(n,p=root)=>k.group(n,p),b=(n,s,p,c=P.woodLight,o=root)=>k.bevelBox(n,s,p,c,o);
 const cyl=(n,rt,rb,h,p,c=P.wood,o=root,seg=12)=>k.cylinder(n,rt,rb,h,p,c,o,seg);
 const tube=(n,pts,r,c=P.cream,o=root)=>k.tube(n,pts,r,c,o);
 const plank=(n,w,d,p,o=root)=>k.deck(n,w,d,p,o);
 function post(x,z,y=0,h=1.15,o=root){cyl('wood_post',.085,.1,h,[x,y+h/2,z],P.wood,o);cyl('brass_cap',.108,.108,.07,[x,y+h,z],P.brass,o);b('teal_shoe',[.22,.18,.22],[x,y+.1,z],P.teal,o);}
 function rail(x1,z1,x2,z2,y=0,o=root){post(x1,z1,y,1,o);post(x2,z2,y,1,o);tube('sagged_rope',[[x1,y+.82,z1],[(x1+x2)/2,y+.62,(z1+z2)/2],[x2,y+.82,z2]],.036,P.cream,o);}
 function floor(w=2.4,d=3){plank('timber_platform',w,d,[0,.18,0]);b('support_beam',[w+.08,.18,.2],[0,-.02,-d*.36],P.deepTeal);b('support_beam',[w+.08,.18,.2],[0,-.02,d*.36],P.deepTeal);}
 function roof(name,w,d,pos,curved=false){const roofG=g(name);roofG.position.set(...pos);for(let side of [-1,1])for(let row=0;row<5;row++)for(let col=0;col<6;col++){const t=(row+.5)/5,x=side*t*w/2,y=curved?.65*(1-t*t):.65*(1-t);const tile=b('painted_shingle',[w/10+.035,.075,d/6+.035],[x,y,(col-2.5)*d/6],row%2?P.teal:P.lightTeal,roofG);tile.rotation.z=side*(curved?-Math.atan(1.3*t/w):-.42);}for(let side of [-1,1])tube('brass_eave',[[-w/2,0,side*d/2],[0,.65,side*d/2],[w/2,0,side*d/2]],.06,P.brass,roofG);tube('ridge',[[0,.7,-d/2],[0,.7,d/2]],.07,P.woodLight,roofG);return roofG;}
 function stitches(o,x,y,z,w=1){for(let i=0;i<8;i++){const line=b('repair_stitch',[.04,.013,.12],[x-w*.4+i*w*.1,y,z],P.brass,o);line.rotation.y=.3;}}
 function terrain(size=[3,1.5,2.5],rock=P.stone,top=P.green,variant=0){const o=g('floating_terrain');const geo=new T.IcosahedronGeometry(1,2),a=geo.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),f=1+.12*Math.sin(x*11+z*7+variant);a.setXYZ(i,x*size[0]/2*f,Math.min(-.1,y*size[1]/2-size[1]/2),z*size[2]/2*f);}geo.computeVertexNormals();k.mesh('hand_painted_rock',geo,rock,o);const cap=cyl('irregular_soil_cap',size[0]/2,size[0]*.44,.16,[0,-.08,0],top,o,11);cap.scale.z=size[2]/size[0];for(let i=0;i<8;i++){const angle=i/8*6.28+.15;const crag=k.mesh('rock_lip',new T.IcosahedronGeometry(.24,0),i%2?rock:P.moss,o);crag.position.set(Math.cos(angle)*size[0]*.42,-.28,Math.sin(angle)*size[2]*.42);crag.scale.set(1,.6,1.1);}return o;}
 function cloud(w,h,d,c=P.cream){const o=g('cloud_volume');for(let i=0;i<9;i++){const m=k.mesh('painted_cloud_lobe',new T.IcosahedronGeometry(.5,2),i%3?c:P.ivory,o);m.position.set((i%3-1)*w*.28,Math.floor(i/3)*h*.18,Math.sin(i*1.9)*d*.3);m.scale.set(w*.52,h*(.6+i%2*.15),d*.65);}return o;}
 switch(id){
 case 'dock-straight':floor();rail(-1.12,-1.32,-1.12,1.32,.3);rail(1.12,-1.32,1.12,1.32,.3);break;
 case 'dock-corner':{const a=g('corner_a');plank('corner_floor',2.4,2.4,[0,.18,0],a);plank('east_arm',2.4,1.8,[1.5,.18,0]);rail(-1.1,-1.1,-1.1,1.1,.3);rail(-1.1,1.1,2.5,1.1,.3);break;}
 case 'dock-tee':floor(2.6,3.8);plank('cross_branch',5,1.35,[0,.2,-1.25]);rail(-1.2,1.75,1.2,1.75,.33);rail(-2.35,-1.8,2.35,-1.8,.33);break;
 case 'dock-endcap':floor(2.4,2.2);rail(-1.1,-1,-1.1,1,.3);rail(1.1,-1,1.1,1,.3);rail(-1.1,1,1.1,1,.3);cyl('mooring_plate',.3,.3,.07,[0,.4,.58],P.brass);break;
 case 'dock-ramp':{const r=g('sloped_deck');plank('ramp_boards',2.1,3.2,[0,.15,0],r);rail(-1,-1.4,-1,1.4,.28,r);rail(1,-1.4,1,1.4,.28,r);r.rotation.x=-.24;r.position.y=.42;for(const x of [-.85,.85])b('ramp_support',[.2,.85,.2],[x,.35,1.35],P.deepTeal);break;}
 case 'dock-stairs':for(let i=0;i<6;i++){b('riser',[2.2,.15+i*.13,.44],[0,(.15+i*.13)/2,(i-2.5)*.4],P.woodLight);b('stair_nose',[2.3,.055,.09],[0,.15+i*.13,(i-2.5)*.4+.19],P.teal);}tube('stair_handrail',[[-1.15,.8,-1.2],[-1.15,1.5,1.2]],.05,P.brass);for(let z of [-1.2,1.2])post(-1.15,z,z<0?0:.7,.8);break;
 case 'bridge-short':floor(1.7,4.8);rail(-.78,-2.3,-.78,0,.3);rail(-.78,0,-.78,2.3,.3);rail(.78,-2.3,.78,0,.3);rail(.78,0,.78,2.3,.3);break;
 case 'bridge-arched':for(let i=0;i<15;i++){const z=(i-7)*.31,y=.2+.48*(1-(z/2.3)**2);b('arch_plank',[1.8,.1,.3],[0,y,z],i%2?P.woodLight:P.wood);}for(const x of [-.88,.88]){tube('arched_support',[[x,.03,-2.4],[x,.42,0],[x,.03,2.4]],.12,P.teal);tube('bridge_rope',[[x,1.1,-2.4],[x,1.45,0],[x,1.1,2.4]],.05,P.cream);for(let z of [-2.3,0,2.3])post(x,z,.2+.45*(1-(z/2.3)**2),.85);}break;
 case 'platform-round':{cyl('teal_rim',1.65,1.65,.18,[0,.1,0],P.teal,root,24);for(let i=0;i<11;i++){let x=(i-5)*.28,d=2*Math.sqrt(Math.max(.05,1.5**2-x*x));b('round_cut_plank',[.27,.12,d],[x,.24,0],i%2?P.woodLight:P.wood);}for(let i=0;i<8;i++){let a=i/8*6.28;k.bolt('rim_bolt',[Math.cos(a)*1.55,.22,Math.sin(a)*1.55]);}break;}
 case 'platform-square':floor(3.8,3.8);for(let x of [-1.75,1.75])for(let z of [-1.75,1.75])post(x,z,.3,.5);break;
 case 'canopy-canvas':{floor(3,2.8);for(let x of [-1.35,1.35])for(let z of [-1.2,1.2])post(x,z,.3,2.35);k.cloth('cream_canopy',3.1,2.9,[0,2.85,0]);b('coral_patch',[.5,.025,.4],[.8,2.83,.5],P.coral);stitches(root,.8,2.86,.5,.5);break;}
 case 'awning-repair':{for(let x of [-1.1,1.1])post(x,.65,0,2);const c=k.cloth('repair_awning',2.5,1.9,[0,2.1,0]);c.rotation.x=.1;b('repair_patch',[.5,.03,.5],[.65,2.07,.3],P.coral);stitches(root,.65,2.11,.3,.5);tube('brass_rail',[[-1.2,2.1,-.9],[1.2,2.1,-.9]],.07,P.brass);break;}
 case 'roof-teal-gable':roof('gable_roof',3.4,3.1,[0,.05,0]);break;
 case 'roof-teal-curve':roof('curved_roof',3.5,2.8,[0,.05,0],true);break;
 case 'wall-timber':{b('cream_wall',[2.6,2.3,.19],[0,1.15,0],P.cream);for(const x of [-1.22,0,1.22])b('timber_stile',[.16,2.45,.25],[x,1.2,0],P.wood);for(let y of [.12,2.3])b('timber_rail',[2.7,.16,.26],[0,y,0],P.woodLight);b('teal_foot',[2.75,.22,.28],[0,.1,0],P.teal);break;}
 case 'wall-window-round':{b('plaster_wall',[2.5,2.5,.22],[0,1.25,0],P.cream);for(let x of [-1.15,1.15])b('wood_stile',[.18,2.5,.3],[x,1.25,0],P.wood);k.window('round_window',.65,[0,1.35,.18]);b('teal_sill',[1.5,.13,.44],[0,.58,.22],P.teal);break;}
 case 'door-round':{const shape=new T.Shape();shape.moveTo(-.65,0);shape.lineTo(-.65,1.45);shape.absarc(0,1.45,.65,Math.PI,0,true);shape.lineTo(.65,0);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:true,bevelSize:.04,bevelThickness:.025,bevelSegments:1,steps:1,curveSegments:12});k.mesh('arched_door',geo,P.woodLight);tube('door_frame',[[-.72,0,.1],[-.72,1.45,.1],[-.5,1.95,.1],[0,2.2,.1],[.5,1.95,.1],[.72,1.45,.1],[.72,0,.1]],.09,P.teal);for(let x of [-.35,0,.35])tube('door_plank_seam',[[x,.15,.2],[x,1.65,.2]],.012,P.wood);k.ring('brass_door_pull',.11,.025,[.4,1,.25],P.brass);k.window('door_port',.25,[0,1.5,.23]);break;}
 case 'rail-rope':rail(-1.4,0,1.4,0,0);tube('lower_rope',[[-1.4,.48,0],[0,.3,0],[1.4,.48,0]],.028,P.cream);break;
 case 'island-grass-small':terrain([3,1.8,2.6]);break;
 case 'island-grass-medium':terrain([5.4,2.4,4.4],P.stone,P.green,1);for(let i=0;i<3;i++){const m=k.mesh('moss_mound',new T.IcosahedronGeometry(.4,1),P.moss);m.position.set((i-1)*1.1,.08,-.5);m.scale.y=.25;}break;
 case 'island-rock-small':terrain([2.7,2.2,2.3],P.stone,P.stoneLight,2);break;
 case 'island-rock-tall':terrain([2.8,5.8,2.5],P.stone,P.moss,3);for(let i=0;i<3;i++)tube('mineral_vein',[[-.7,-1-i,.8],[.1,-1.3-i,1.1],[.6,-1.2-i,.7]],.035,P.lightTeal);break;
 case 'cliff-arch':{for(let side of [-1,1]){const r=terrain([1.5,3.4,2],P.stone,P.moss);r.position.set(side*1.6,0,0);}const arch=k.mesh('stone_arch',new T.TorusGeometry(1.65,.58,8,16,Math.PI),P.stone);arch.position.set(0,-.6,0);for(let x of [-1.6,1.6])b('arch_grass',[1.3,.16,1.6],[x,.05,0],P.moss);break;}
 case 'cliff-ledge':{terrain([4.3,3.4,2],P.stone,P.moss,4);const ledge=terrain([3.2,.6,1.8],P.stone,P.green,5);ledge.position.set(.2,-1.3,1.15);break;}
 case 'island-soil-flat':terrain([4.6,.85,3.8],P.wood,P.soil??P.wood,6);break;
 case 'garden-plot':{b('soil_bed',[2.4,.2,1.8],[0,.16,0],P.soil??P.wood);for(let x of [-1.2,1.2])b('bed_side',[.13,.34,2],[x,.24,0]);for(let z of [-.95,.95])b('bed_end',[2.5,.34,.13],[0,.24,z]);for(let i=0;i<4;i++)tube('soil_furrow',[[-.95,.28,(i-1.5)*.4],[.95,.28,(i-1.5)*.4]],.06,P.stone);break;}
 case 'mineral-outcrop-teal':{terrain([2,.8,1.6],P.stone,P.stoneLight);for(let i=0;i<7;i++){const crystal=k.cone('teal_crystal',.2+(i%2)*.1,.7+(i%3)*.32,[Math.sin(i*2.4)*.6,.5,Math.cos(i*2.4)*.45],i%2?P.teal:P.lightTeal,root,5);crystal.rotation.z=Math.sin(i)*.25;}break;}
 case 'rubble-mound':for(let i=0;i<15;i++){const r=k.mesh('weathered_rubble',new T.IcosahedronGeometry(.25+i%3*.08,0),i%2?P.stone:P.stoneLight);const a=i*2.4,rad=Math.sqrt(i/15);r.position.set(Math.cos(a)*rad,.2+(1-rad)*.4,Math.sin(a)*rad*.8);r.rotation.set(i,.3*i,.2*i);}break;
 case 'cloud-bank':cloud(3.4,.6,2.3);break;
 case 'cloud-column':{const c=cloud(1.5,3.6,1.6,P.ivory);c.position.y=1;break;}
 case 'fog-layer':{const c=cloud(4,.18,2.7,P.lightTeal);c.scale.y=.35;break;}
 case 'storm-cloud-mass':{const c=cloud(3.4,1.4,2.6,P.deepTeal);for(let i=0;i<3;i++){const v=k.mesh('dark_cloud_lobe',new T.IcosahedronGeometry(.6,2),P.navy,c);v.position.set(i-1,.6,-.3);}break;}
 case 'wreckage-shoal':{terrain([3.6,.7,2.7],P.stone,P.stoneLight);for(let i=0;i<6;i++){const p=b('wrecked_plank',[.19,.12,1.7],[Math.sin(i)*.9,.18+(i%3)*.13,Math.cos(i)*.65],i%2?P.wood:P.woodLight);p.rotation.set(.1*i,.7*i,.1*i);}tube('bent_hull_rib',[[-1,.2,-.6],[0,.6,-.9],[1,.25,-.6]],.1,P.teal);k.ring('broken_brass_ring',.35,.06,[.8,.35,.7],P.brass);break;}
 case 'industrial-rib':{for(let x of [-1.2,1.2])b('rib_base',[.65,.2,.8],[x,.1,0],P.stone);tube('arched_iron_rib',[[-1.2,.2,0],[-1.15,1.8,0],[-.7,2.65,0],[.7,2.65,0],[1.15,1.8,0],[1.2,.2,0]],.15,P.deepTeal);for(let x of [-1.2,1.2])for(let y of [.55,1.35,2])b('rib_bracket',[.43,.13,.35],[x,y,0],P.coral);for(let x of [-1,1])k.bolt('rib_fastener',[x,.25,.15]);break;}
 case 'royal-stone-platform':{b('stone_plinth',[3.8,.42,3.2],[0,.21,0],P.cream);for(let i=0;i<5;i++)b('stone_tile',[.7,.08,3],[i*.73-1.46,.46,0],i%2?P.ivory:P.cream);for(let x of [-1.85,1.85])b('brass_edge',[.07,.12,3.3],[x,.47,0],P.brass);for(let z of [-1.55,1.55])b('brass_edge',[3.8,.12,.07],[0,.47,z],P.brass);break;}
 case 'sealed-stone-fragment':{const rock=k.mesh('seal_stone',new T.IcosahedronGeometry(1,1),P.cream);rock.position.y=.65;rock.scale.set(1.35,.65,.8);const seal=b('old_black_seal',[.52,.04,.7],[.1,1.22,.1],P.ink);seal.rotation.y=.5;tube('brass_inlay',[[-.7,1.1,-.1],[-.1,1.27,.1],[.6,1.05,.3]],.035,P.brass);break;}
 default:throw new Error('No primary world geometry recipe for '+id);
 }
 root.userData.build_method='Original locally authored modular mesh; static visual prototype';
}
