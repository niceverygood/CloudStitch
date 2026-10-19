import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

const WIDTH = 900, HEIGHT = 700, TIME = 2;
const BACKGROUND = '#f1e6cf';
function vector(v) { return v.toArray(); }
function boxData(b) { return {min:vector(b.min),max:vector(b.max)}; }
function parse(base64) {
  const raw = atob(base64), bytes = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    if (!/^(data:|blob:)/.test(url)) throw new Error('External GLB resources are forbidden');
    return url;
  });
  return new Promise((resolve,reject) => new GLTFLoader(manager).parse(bytes.buffer,'',resolve,reject));
}
function setupAsset(gltf) {
  const object = gltf.scene;
  const clip = gltf.animations.find(a => a.name === 'FloatIdle');
  let mixer;
  if (clip) {
    mixer = new THREE.AnimationMixer(object);
    const action = mixer.clipAction(clip); action.play();
    mixer.setTime(TIME); action.paused = true;
  }
  object.traverse(node => {
    if (!node.isMesh) return;
    const convert = source => {
      const material = new THREE.MeshBasicMaterial({
        color:source.color ? source.color.clone() : 0xffffff,
        map:source.map || null, alphaMap:source.alphaMap || null,
        vertexColors:source.vertexColors, transparent:source.transparent,
        opacity:source.opacity, alphaTest:source.alphaTest,
        side:source.side, depthWrite:source.depthWrite, depthTest:source.depthTest,
      });
      material.name = `${source.name || 'material'}:comparison-handdrawn`;
      material.userData.outlineParameters = {thickness:0.003,color:[0.18,0.13,0.12],alpha:1,visible:true};
      return material;
    };
    node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material);
  });
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object,true);
  if (bounds.isEmpty() || ![...bounds.min,...bounds.max].every(Number.isFinite)) throw new Error('Empty or invalid scene bounds');
  return {object, bounds, mixer, animation:{clip:clip?.name || null,duration:clip?.duration || null,sampleTimeSeconds:TIME,stopped:true,missingFloatIdle:!clip}};
}
function pixels(canvas) {
  const copy=document.createElement('canvas'); copy.width=WIDTH; copy.height=HEIGHT;
  const ctx=copy.getContext('2d',{willReadFrequently:true}); ctx.drawImage(canvas,0,0);
  return ctx.getImageData(0,0,WIDTH,HEIGHT).data;
}
function nonempty(data,background) {
  let count=0;
  for(let i=0;i<data.length;i+=4) if(Math.abs(data[i]-background[0])+Math.abs(data[i+1]-background[1])+Math.abs(data[i+2]-background[2])>18) count++;
  return {nonBackgroundPixels:count,fraction:count/(WIDTH*HEIGHT)};
}
window.captureActualPair = async function(input) {
  const before=setupAsset(await parse(input.before));
  const after=setupAsset(await parse(input.after));
  const union=before.bounds.clone().union(after.bounds);
  const target=union.getCenter(new THREE.Vector3());
  const size=union.getSize(new THREE.Vector3());
  const radius=size.length()/2;
  if (!(radius>0)) throw new Error('Zero scene radius');
  const direction=new THREE.Vector3(-1.25,0.9,-1.6).normalize();
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,radius*0.01,radius*8);
  camera.position.copy(target).addScaledVector(direction,radius*4);
  camera.lookAt(target); camera.updateMatrixWorld(true);
  // Project the union's corners into this one view; native scales and positions stay intact.
  let halfX=0,halfY=0;
  for(const x of [union.min.x,union.max.x]) for(const y of [union.min.y,union.max.y]) for(const z of [union.min.z,union.max.z]) {
    const p=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
    halfX=Math.max(halfX,Math.abs(p.x)); halfY=Math.max(halfY,Math.abs(p.y));
  }
  const halfHeight=Math.max(halfY,halfX/(WIDTH/HEIGHT))*1.12;
  camera.left=-halfHeight*WIDTH/HEIGHT; camera.right=-camera.left;
  camera.top=halfHeight; camera.bottom=-halfHeight; camera.updateProjectionMatrix();
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});
  renderer.setPixelRatio(1); renderer.setSize(WIDTH,HEIGHT);
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.NoToneMapping;
  const effect=new OutlineEffect(renderer); effect.autoClear=true;
  const scene=new THREE.Scene(); scene.background=new THREE.Color(BACKGROUND);
  scene.add(new THREE.AmbientLight(0xffffff,1.5));
  const key=new THREE.DirectionalLight(0xffefd5,2); key.position.set(6,10,8); scene.add(key);
  document.body.replaceChildren(renderer.domElement);
  const canvases=[], images={}, pixelSets=[];
  try {
    for(const [name,asset] of [['before',before],['after',after]]) {
      scene.add(asset.object); effect.render(scene,camera);
      const copy=document.createElement('canvas'); copy.width=WIDTH; copy.height=HEIGHT;
      copy.getContext('2d').drawImage(renderer.domElement,0,0); canvases.push(copy);
      images[name]=copy.toDataURL('image/png'); pixelSets.push(pixels(copy)); scene.remove(asset.object);
    }
    const bgCanvas=document.createElement('canvas'); bgCanvas.width=1; bgCanvas.height=1;
    const bgCtx=bgCanvas.getContext('2d'); bgCtx.fillStyle=BACKGROUND; bgCtx.fillRect(0,0,1,1);
    const bg=bgCtx.getImageData(0,0,1,1).data;
    const content={before:nonempty(pixelSets[0],bg),after:nonempty(pixelSets[1],bg)};
    if(content.before.nonBackgroundPixels<100 || content.after.nonBackgroundPixels<100) throw new Error('Empty or nearly empty model render');
    let changed=0;
    for(let i=0;i<pixelSets[0].length;i+=4) {
      let delta=0; for(let c=0;c<3;c++) delta+=Math.abs(pixelSets[0][i+c]-pixelSets[1][i+c]);
      if(delta>18) changed++;
    }
    const composite=document.createElement('canvas'); composite.width=WIDTH*2; composite.height=HEIGHT;
    const ctx=composite.getContext('2d'); ctx.drawImage(canvases[0],0,0); ctx.drawImage(canvases[1],WIDTH,0);
    images.pair=composite.toDataURL('image/png');
    return {id:input.id, images, bounds:{before:boxData(before.bounds),after:boxData(after.bounds),union:boxData(union)},
      camera:{type:'OrthographicCamera',position:vector(camera.position),target:vector(target),left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,near:camera.near,far:camera.far,matrixWorld:camera.matrixWorld.toArray(),projectionMatrix:camera.projectionMatrix.toArray()},
      animation:{before:before.animation,after:after.animation},render:{width:WIDTH,height:HEIGHT,dpr:1,background:BACKGROUND,material:'MeshBasicMaterial preserving source maps/colors/vertexColors/alpha',outlineAutoClear:effect.autoClear,nativeCoordinates:true,toneMapping:'NoToneMapping',outputColorSpace:'SRGBColorSpace',lights:{ambient:{color:0xffffff,intensity:1.5},directional:{color:0xffefd5,intensity:2,position:[6,10,8]}},content,changedPixels:changed,changedFraction:changed/(WIDTH*HEIGHT)},artApproval:'PENDING_HUMAN_REVIEW'};
  } finally {
    for(const asset of [before,after]) {
      asset.mixer?.stopAllAction(); asset.mixer?.uncacheRoot(asset.object);
      asset.object.traverse(node => {if(node.isMesh){node.geometry.dispose(); for(const m of (Array.isArray(node.material)?node.material:[node.material])) {m.map?.dispose();m.alphaMap?.dispose();m.dispose();}}});
    }
    renderer.dispose(); renderer.forceContextLoss(); document.body.replaceChildren();
  }
};
