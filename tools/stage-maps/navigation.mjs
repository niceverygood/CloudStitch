import {stageMaps} from './maps.mjs';
import {selectedMap} from './selection.mjs';
export function mountMapNavigation(qa){
 const list=document.getElementById('map-list'),hint=document.getElementById('map-hint');
 const objectives=document.getElementById('map-objectives');
 document.getElementById('map-description').textContent=selectedMap.description;
 for(const item of selectedMap.objectives){const li=document.createElement('li');li.textContent=item.label;objectives.append(li);}
 let changing=false;
 for(const map of stageMaps){
  const button=document.createElement('button');button.type='button';button.className='map-card';button.dataset.map=map.id;
  button.setAttribute('aria-pressed',String(map.id===selectedMap.id));
  const image=document.createElement('img');image.src=`../world-assets/scene-previews/${map.sceneId}.png`;image.alt='';image.loading='lazy';
  const title=document.createElement('strong');title.textContent=map.name;
  const small=document.createElement('small');small.textContent=map.region;
  button.append(image,title,small);list.append(button);
  button.addEventListener('click',async()=>{
   if(changing||map.id===selectedMap.id)return;
   const snapshot=qa.snapshot();
   if(snapshot?.phase!=='harbor'||qa.controller.state.activeVoyage){hint.textContent='현재 항해를 마치고 항구에서 항로를 바꿔 주세요.';return;}
   changing=true;update(snapshot,true);
   const saved=await qa.command('save');
   if(!saved?.ok||qa.snapshot().harbor.dirty){changing=false;update(qa.snapshot());hint.textContent='현재 항로 저장에 실패했습니다. 저장을 복구한 뒤 다시 선택해 주세요.';return;}
   const url=new URL(location.href);url.searchParams.set('map',map.id);location.assign(url);
  });
 }
 function update(snapshot,busy=false){
  const available=snapshot?.phase==='harbor'&&!qa.controller?.state.activeVoyage;
  for(const button of list.children)button.disabled=changing||busy||!available;
  hint.textContent=available?'각 항로는 별도 기록을 사용합니다. 선택하면 현재 항구를 저장하고 이동합니다.':'항해 중에는 항로가 고정됩니다. 현재 항해를 마치고 선택하세요.';
  document.getElementById('route-progress').textContent=`${selectedMap.order} / 6 · ${snapshot?.phase==='harbor'?'항구에서 준비':'현재 항로'}`;
 }
 return {update};
}
export function drawRouteGuide(ctx,level,map){
 ctx.save();ctx.lineWidth=1.3;ctx.strokeStyle='#609b8c';ctx.setLineDash([4,3]);
 for(const route of level.corridors){ctx.beginPath();route.points.forEach((point,index)=>{const p=map(point[0],point[2]);if(index)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.stroke();}
 ctx.setLineDash([]);ctx.font='9px sans-serif';
 selectedMap.objectives.forEach((item,index)=>{const p=map(item.position[0],item.position[2]);ctx.fillStyle='#fff9e8';ctx.strokeStyle='#9a7e49';ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#705a31';ctx.fillText(String(index+1),p.x,p.y+3);});
 const dock=map(0,67);ctx.strokeStyle='#397565';ctx.beginPath();ctx.arc(dock.x,dock.y,12/180*204,0,Math.PI*2);ctx.stroke();ctx.restore();
}
