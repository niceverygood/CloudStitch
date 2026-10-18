// Explicit, reviewable roof infill for two generated hero buildings. This does
// not blindly cap mesh boundaries and never rewrites either preserved source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {makeWorldKit,THREE} from './core.mjs';
import checks from '../qa/world-gltf.cjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT=path.join(ROOT,'outputs/world-assets');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();}).catch(error=>this.onerror?.(error));}};
globalThis.ProgressEvent??=class{constructor(type,data={}){this.type=type;Object.assign(this,data);}};

const plans={
  'harbor-inn':{
    roofColor:0x346b7d,wallColor:0xf0dfb5,
    panels:[
      {name:'front_recessed_roof_liner',x:[-.35,.35],z:[-.005,.25],ridge:.218,slope:-.57,edgeDrop:.009},
      {name:'rear_recessed_roof_liner',x:[-.35,.35],z:[-.305,-.005],ridge:.218,slope:.47,edgeDrop:.009}
    ],
    ridge:{x:[-.345,.345],z:[-.018,.008],y:.214},
    dormers:[
      {name:'left_dormer',center:-.232,halfWidth:.054,rearZ:.045,frontZ:.181,rearBase:.17,rearTop:.24,frontBase:.105,frontTop:.165},
      {name:'right_dormer',center:.205,halfWidth:.048,rearZ:.045,frontZ:.208,rearBase:.17,rearTop:.23,frontBase:.097,frontTop:.16}
    ]
  },
  'repair-workshop':{
    roofColor:0x346b7d,wallColor:0xf0dfb5,
    panels:[
      {name:'left_recessed_roof_liner',x:[-.445,-.138],z:[-.30,.29],axis:'x',ridgeCoord:-.138,ridge:.176,slope:.48,edgeDrop:.005,endRise:.01},
      {name:'right_recessed_roof_liner',x:[-.138,.115],z:[-.30,.29],axis:'x',ridgeCoord:-.138,ridge:.176,slope:-.65,edgeDrop:.005,endRise:.01}
    ],
    ridge:{x:[-.183,-.093],z:[-.30,.29],y:.173,axis:'z',endRise:.01},dormers:[]
  }
};

function solidSurface(kit,name,points,nx,nz,thickness,color){
  const count=points.length,vertices=points.flatMap(p=>p),indices=[];
  vertices.push(...points.flatMap(([x,y,z])=>[x,y-thickness,z]));
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const a=z*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;
    indices.push(a,c,b,b,c,d,count+a,count+b,count+c,count+b,count+d,count+c);
  }
  const border=[];for(let x=0;x<=nx;x++)border.push(x);for(let z=1;z<=nz;z++)border.push(z*(nx+1)+nx);
  for(let x=nx-1;x>=0;x--)border.push(nz*(nx+1)+x);for(let z=nz-1;z>0;z--)border.push(z*(nx+1));
  for(let i=0;i<border.length;i++){const a=border[i],b=border[(i+1)%border.length];indices.push(a,b,count+a,b,count+b,count+a);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  return kit.mesh(name,geometry,color);
}
function thinWall(kit,name,polygon,thickness,color){
  const normal=polygon[1].clone().sub(polygon[0]).cross(polygon[2].clone().sub(polygon[0])).normalize();
  const a=polygon.map(p=>p.clone().addScaledVector(normal,thickness*.5)),b=polygon.map(p=>p.clone().addScaledVector(normal,-thickness*.5)),verts=[...a,...b].flatMap(p=>p.toArray()),n=polygon.length,indices=[];
  for(let i=1;i<n-1;i++)indices.push(0,i,i+1,n,n+i+1,n+i);
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,n+i,j,j,n+i,n+j);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geometry.setIndex(indices);return kit.mesh(name,geometry,color);
}
function appendGeometry(baseBytes,patchBytes){
  const {json:j,bin:base}=checks.parseGLB(baseBytes),{json:p,bin:patch}=checks.parseGLB(patchBytes);
  if(j.buffers.length!==1||p.buffers.length!==1||p.images?.length||p.textures?.length||p.animations?.length)throw new Error('Expected an embedded single-buffer static vertex-painted patch.');
  const o={view:j.bufferViews.length,accessor:j.accessors.length,material:j.materials.length,mesh:j.meshes.length,node:j.nodes.length};
  for(const view of p.bufferViews)j.bufferViews.push({...view,buffer:0,byteOffset:(view.byteOffset||0)+base.length});
  for(const accessor of p.accessors){const a=structuredClone(accessor);if(a.bufferView!==undefined)a.bufferView+=o.view;j.accessors.push(a);}
  j.materials.push(...structuredClone(p.materials));
  for(const original of p.meshes){const m=structuredClone(original);for(const primitive of m.primitives){for(const key of Object.keys(primitive.attributes))primitive.attributes[key]+=o.accessor;if(primitive.indices!==undefined)primitive.indices+=o.accessor;if(primitive.material!==undefined)primitive.material+=o.material;}j.meshes.push(m);}
  for(const original of p.nodes){const n=structuredClone(original);if(n.mesh!==undefined)n.mesh+=o.mesh;if(n.children)n.children=n.children.map(id=>id+o.node);j.nodes.push(n);}
  j.scenes[j.scene??0].nodes.push(...p.scenes[p.scene??0].nodes.map(id=>id+o.node));
  j.extensionsUsed=[...new Set([...(j.extensionsUsed||[]),...(p.extensionsUsed||[])])];
  if(p.extensionsRequired?.length)j.extensionsRequired=[...new Set([...(j.extensionsRequired||[]),...p.extensionsRequired])];
  const bin=Buffer.concat([base,patch]);j.buffers[0].byteLength=bin.length;
  const bytes=checks.makeGLB(j,bin),parsed=checks.parseGLB(bytes);
  if(!parsed.bin.subarray(0,base.length).equals(base))throw new Error('Roof composer changed the preserved source binary prefix.');
  return bytes;
}

export async function closeHeroRoof(id){
  const plan=plans[id];if(!plan)throw new Error('No reviewed roof infill plan for '+id);
  const dir=path.join(OUT,'hero',id),originalFile=path.join(dir,'model.glb'),baseFile=path.join(dir,'model-repaired.glb'),outputFile=path.join(dir,'model-closed-roof.glb'),logFile=path.join(dir,'roof-repair-log.json');
  const original=fs.readFileSync(originalFile),base=fs.readFileSync(baseFile),originalSHA=hash(original),baseSHA=hash(base);
  const normalLog=JSON.parse(fs.readFileSync(path.join(dir,'repair-log.json'),'utf8'));
  if(normalLog.original_source.sha256!==originalSHA||normalLog.repaired_source.sha256!==baseSHA||normalLog.after.errors)throw new Error('Normal-copy provenance or validation failed.');
  const clean=checks.geometryOnly(base),gltf=await new GLTFLoader().parseAsync(clean.buffer.slice(clean.byteOffset,clean.byteOffset+clean.byteLength),'');
  gltf.scene.traverse(node=>{if(node.isMesh)for(const material of Array.isArray(node.material)?node.material:[node.material])material.side=THREE.DoubleSide;});
  gltf.scene.updateMatrixWorld(true);const beforeBounds=new THREE.Box3().setFromObject(gltf.scene),ray=new THREE.Raycaster();
  const kit=makeWorldKit({id:id+'-roof-infill',category:'reviewed-roof-infill',purpose:'Thin inset backing of generated roof openings; original tiles remain the outer surface.'});
  const parts=[],nx=7,nz=5,thickness=.003,clearance=.008;
  for(const panel of plan.panels){
    const points=[];let fitted=0;
    for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
      const xx=THREE.MathUtils.lerp(...panel.x,x/nx),zz=THREE.MathUtils.lerp(...panel.z,z/nz),edge=Math.abs((x/nx-.5)*2);
      const profileCoordinate=panel.axis==='x'?xx-(panel.ridgeCoord||0):zz;
      const edgeCoordinate=panel.axis==='x'?Math.abs((z/nz-.5)*2):edge;
      const nominal=panel.ridge+panel.slope*profileCoordinate-panel.edgeDrop*edgeCoordinate*edgeCoordinate+(panel.endRise||0)*Math.max(0,zz/.3);
      ray.set(new THREE.Vector3(xx,beforeBounds.max.y+.1,zz),new THREE.Vector3(0,-1,0));
      const hits=ray.intersectObject(gltf.scene,true).filter(hit=>Math.abs(hit.face.normal.y)>.22&&Math.abs(hit.point.y-nominal)<.055);
      let y=nominal;
      if(hits.length){hits.sort((a,b)=>Math.abs(a.point.y-nominal)-Math.abs(b.point.y-nominal));y=Math.min(nominal,hits[0].point.y-clearance);fitted++;}
      points.push([xx,y,zz]);
    }
    const m=solidSurface(kit,panel.name,points,nx,nz,thickness,plan.roofColor);
    parts.push({name:panel.name,kind:'Thin recessed teal roof liner',grid:[nx,nz],thickness,source_surface_sample_clearance:clearance,source_surface_fitted_vertices:fitted,vertices:points.length,
      coordinates:points,triangles:m.geometry.attributes.position.count/3,color_hex:'#'+plan.roofColor.toString(16).padStart(6,'0')});
  }
  const ridgeNx=plan.ridge.axis==='z'?1:7,ridgeNz=plan.ridge.axis==='z'?7:1;
  const ridgePoints=[];for(let z=0;z<=ridgeNz;z++)for(let x=0;x<=ridgeNx;x++){
    const zz=THREE.MathUtils.lerp(...plan.ridge.z,z/ridgeNz),along=plan.ridge.axis==='z'?z/ridgeNz:x/ridgeNx;
    ridgePoints.push([THREE.MathUtils.lerp(...plan.ridge.x,x/ridgeNx),plan.ridge.y-.003*(Math.abs(along-.5)*2)**2+(plan.ridge.endRise||0)*Math.max(0,zz/.3),zz]);
  }
  const ridge=solidSurface(kit,'narrow_recessed_ridge_infill',ridgePoints,ridgeNx,ridgeNz,.003,plan.roofColor);
  parts.push({name:'narrow_recessed_ridge_infill',kind:'Local infill below existing ridge',coordinates:ridgePoints,thickness:.003,triangles:ridge.geometry.attributes.position.count/3,color_hex:'#'+plan.roofColor.toString(16)});
  for(const d of plan.dormers){
    const wall=[new THREE.Vector3(d.center-d.halfWidth,d.rearBase,d.rearZ),new THREE.Vector3(d.center+d.halfWidth,d.rearBase,d.rearZ),new THREE.Vector3(d.center,d.rearTop,d.rearZ)];
    const back=thinWall(kit,d.name+'_inset_backwall',wall,.003,plan.roofColor);
    parts.push({name:d.name+'_inset_backwall',kind:'Inset teal dormer rear backing; front window preserved',coordinates:wall.map(p=>p.toArray()),thickness:.003,triangles:back.geometry.attributes.position.count/3,color_hex:'#'+plan.roofColor.toString(16)});
    for(const sign of [-1,1]){
      const x=d.center+sign*d.halfWidth,poly=[new THREE.Vector3(x,d.frontBase,d.frontZ),new THREE.Vector3(x,d.frontTop,d.frontZ),new THREE.Vector3(x,d.rearTop-.035,d.rearZ),new THREE.Vector3(x,d.rearBase,d.rearZ)];
      const cheek=thinWall(kit,d.name+'_inset_cheek_'+sign,poly,.0025,plan.wallColor);
      parts.push({name:d.name+'_inset_cheek_'+sign,kind:'Local cream dormer side backing',coordinates:poly.map(p=>p.toArray()),thickness:.0025,triangles:cheek.geometry.attributes.position.count/3,color_hex:'#'+plan.wallColor.toString(16)});
    }
  }
  kit.root.updateMatrixWorld(true);const addedBounds=new THREE.Box3().setFromObject(kit.root);
  if(!beforeBounds.clone().expandByScalar(.001).containsBox(addedBounds))throw new Error('Roof infill unexpectedly expands the original building silhouette bounds.');
  const patch=Buffer.from(await new GLTFExporter().parseAsync(kit.root,{binary:true,animations:[],trs:true})),bytes=appendGeometry(base,patch);
  const verified=await checks.verifyGLB(bytes,{requireStatic:true});if(verified.standard_validator.errors||verified.standard_validator.warnings)throw new Error('Roof derived GLB failed official format checks.');
  const addedTriangles=parts.reduce((n,p)=>n+p.triangles,0);
  if(hash(fs.readFileSync(originalFile))!==originalSHA||hash(fs.readFileSync(baseFile))!==baseSHA)throw new Error('A preserved source changed during infill.');
  fs.writeFileSync(outputFile,bytes);
  const log={game_title:'Cloudstitch',id,tool:'tools/world-assets/close-hero-roof.mjs',
    original_source:{model:`hero/${id}/model.glb`,sha256:originalSHA,bytes:original.length},
    base_normal_copy:{model:`hero/${id}/model-repaired.glb`,sha256:baseSHA,bytes:base.length},
    repaired_source:{model:`hero/${id}/model-closed-roof.glb`,sha256:hash(bytes),bytes:bytes.length},
    original_source_preserved:true,base_normal_copy_preserved:true,original_binary_prefix_preserved:true,
    added_geometry:{mesh_count:parts.length,triangles:addedTriangles,material_count:1,materials:[{type:'KHR_materials_unlit',vertex_colors:true,double_sided:true,colors:['#'+plan.roofColor.toString(16),'#'+plan.wallColor.toString(16)]}],parts,
      bounds:{min:addedBounds.min.toArray(),max:addedBounds.max.toArray()},units:'Original mesh-local design coordinates, not approved metres.'},
    changes:['Added only thin recessed teal roof backing and a narrow ridge strip.',...(plan.dormers.length?['Added local teal rear and cream lower-side backing inside the two dormers, leaving original front windows untouched.']:[]),
      'Original textured tile surfaces, positions, UVs, triangles and materials retained. No wholesale cap of boundary loops.'],
    before:{bounds:{min:beforeBounds.min.toArray(),max:beforeBounds.max.toArray()},normal_copy_validator:normalLog.after},
    after:{errors:verified.standard_validator.errors,warnings:verified.standard_validator.warnings,infos:verified.standard_validator.infos,messages:verified.standard_validator.messages,
      triangles:verified.triangles,mesh_count:verified.mesh_count,material_count:verified.material_count,bounds:verified.verification.bounds,geometry_only_GLTFLoader_roundtrip:verified.verification.GLTFLoader_geometry_roundtrip},
    visual_comparison:{status:'pending four-direction actual GLB render comparison',directory:'work/hero-roof-review'},
    limits:['Visual backing, not watertight remeshing; intended door, awning and window openings are not globally filled.',
      'New backing uses a simple hand-painted teal/cream material rather than regenerating or modifying the 2K source texture.',
      'Colliders, interiors, LOD, navigation, engine integration and gameplay remain unimplemented.']};
  fs.writeFileSync(logFile,JSON.stringify(log,null,2)+'\n');
  console.log(JSON.stringify({id,addedMeshes:parts.length,addedTriangles,triangles:verified.triangles,errors:verified.standard_validator.errors,warnings:verified.standard_validator.warnings,boundsUnexpanded:true,originalsPreserved:true}));
  return log;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(plans))await closeHeroRoof(id);
