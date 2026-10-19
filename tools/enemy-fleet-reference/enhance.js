import * as THREE from 'three';
async function enhance(){
  for(let i=0;i<1200&&!window.__rigReady;i++)await new Promise(resolve=>setTimeout(resolve,50));
  if(!window.__rigReady)return;
  const v=window.__rigViewer,data=v.rig.userData,stage=document.getElementById('stage'),bar=document.getElementById('reference-actions');
  const label=document.createElement('label');label.className='toggle';const input=document.createElement('input');input.type='checkbox';input.id='weakpoints';label.append(input,document.createTextNode('약점 위치 보기'));bar.append(label);
  const markers=[];
  for(const point of data.weakpoints||[]){
    const target=v.rig.getObjectByName(point.nodeName);if(!target)continue;
    const marker=new THREE.Mesh(new THREE.SphereGeometry(.09,14,8),new THREE.MeshBasicMaterial({color:0xc35138,transparent:true,opacity:.8,depthTest:false,toneMapped:false}));marker.visible=false;marker.renderOrder=200;v.scene.add(marker);
    const text=document.createElement('span');text.className='weakpoint-label';text.textContent=point.label;text.hidden=true;stage.append(text);markers.push({point,target,marker,text});
  }
  function setWeakpoints(value){input.checked=Boolean(value);for(const row of markers){row.marker.visible=Boolean(value);row.text.hidden=!value;row.text.style.display=value?'block':'none';}return input.checked;}
  input.addEventListener('change',()=>setWeakpoints(input.checked));
  const tip=document.createElement('span');tip.className='identity-note';tip.textContent='표시는 첨부 컨셉의 약점 위치입니다. 실제 피해·절단·AI 규칙과의 연결은 후속 작업입니다.';bar.append(tip);
  function setDeployment(open){if(!v.clips.some(clip=>clip.name==='AmbushReveal'))return false;v.setProfile('AmbushReveal');v.setTime(open?3.39:0);v.fit();document.getElementById('profile-title').textContent=open?'기동 전개 · 외형 시범':'위장 상태 · 외형 시범';document.getElementById('profile-description').textContent='외피 리그만 펼칩니다. 실제 잠복·기습·피해 상태는 변경하지 않습니다.';window.__enemyReference.deployed=Boolean(open);return true;}
  if(data.deployRig){for(const [text,open]of[['위장 상태',false],['기동 전개',true]]){const button=document.createElement('button');button.className='tool';button.textContent=text;button.dataset.deploy=String(open);button.addEventListener('click',()=>setDeployment(open));bar.append(button);}}
  const world=new THREE.Vector3(),projected=new THREE.Vector3();
  const update=()=>{requestAnimationFrame(update);if(!input.checked)return;for(const row of markers){row.target.getWorldPosition(world);row.marker.position.copy(world);projected.copy(world).project(v.camera);const x=(projected.x*.5+.5)*stage.clientWidth,y=(-projected.y*.5+.5)*stage.clientHeight;row.text.style.left=x+'px';row.text.style.top=y+'px';row.text.style.display=projected.z>=-1&&projected.z<=1?'block':'none';}};
  requestAnimationFrame(update);
  window.__enemyReference={ready:true,points:markers.map(row=>row.point),setWeakpoints,setDeployment,deployed:false,get weakpointsVisible(){return input.checked;}};
}
enhance();
