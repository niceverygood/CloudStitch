import {stageMaps} from '../stage-maps/maps.mjs';

/** Sequential progress is read from the controller; cards never change a map. */
export function mountMapNavigation(qa){
  const list=document.getElementById('map-list'),hint=document.getElementById('map-hint');
  const objectives=document.getElementById('map-objectives'),next=document.getElementById('next-stage-button');
  const legacySelect=document.getElementById('legacy-map-select'),legacyButton=document.getElementById('import-legacy-button');
  let mapId=null;
  const cards=stageMaps.map(map=>{
    const card=document.createElement('article');card.className='map-card';card.dataset.map=map.id;card.setAttribute('role','listitem');
    const image=document.createElement('img');image.src=`../world-assets/scene-previews/${map.sceneId}.png`;image.alt='';image.loading='lazy';
    const title=document.createElement('strong');title.textContent=map.name;
    const small=document.createElement('small');small.textContent=map.region;
    const badge=document.createElement('span');badge.className='map-state';badge.textContent='이전 항로를 마치면 열려요';
    card.append(image,title,small,badge);list.append(card);
    const option=document.createElement('option');option.value=map.id;option.textContent=map.name;legacySelect.append(option);
    return {card,badge};
  });
  legacyButton.addEventListener('click',()=>qa.command('import-legacy',{mapId:legacySelect.value}));
  function update(snapshot,busy=false){
    const campaign=snapshot.campaign||{},route=snapshot.routeMap;
    const current=campaign.currentStageIndex??0,count=campaign.completed??0,finished=campaign.campaignComplete===true;
    const harbor=snapshot.phase==='harbor',active=!!qa.controller?.state.activeVoyage,dirty=!!snapshot.harbor?.dirty;
    if(route&&route.id!==mapId){
      mapId=route.id;document.getElementById('map-description').textContent=route.description;
      objectives.replaceChildren();
      for(const item of route.objectives){const li=document.createElement('li');li.textContent=item.label;objectives.append(li);}
    }
    for(const [index,{card,badge}] of cards.entries()){
      const done=index<count,isCurrent=index===current;
      card.dataset.state=done?'completed':isCurrent?'current':'locked';
      card.classList.toggle('is-current',isCurrent);card.setAttribute('aria-current',isCurrent?'step':'false');
      card.setAttribute('aria-label',`${stageMaps[index].name} · ${done?'항해 완료':isCurrent?'현재 항로':'잠김'}`);
      badge.textContent=done?'✓ 항해 완료':isCurrent?'현재 항로':'잠김 · 앞 항로 완료 후';
    }
    document.getElementById('route-progress').textContent=finished?(dirty?'6 / 6 · 완료 기록 미저장':'6 / 6 · 모든 항해 완료'):`${current+1} / ${campaign.totalStages||6} · ${count}개 항로 완료`;
    next.hidden=finished;
    next.disabled=busy||!harbor||dirty||active||campaign.canAdvance!==true;
    next.textContent=finished?'모든 항해 완료':current<5?`다음 항로 · ${stageMaps[current+1].region} →`:'마지막 항로 진행 중';
    if(finished&&dirty)hint.textContent='여섯 항로를 마쳤지만 현재 변경이 미저장 상태예요. 저장하기를 눌러 완료 기록과 정비 내용을 보존하세요.';
    else if(finished)hint.textContent='여섯 항로를 모두 마쳤습니다. 같은 함선과 창고, 자원으로 정비와 저장을 계속할 수 있어요.';
    else if(!harbor||active)hint.textContent='현재 항로를 항해 중입니다. 교전 전체에서 승리한 뒤 남쪽 원 안으로 귀환하세요.';
    else if(count>current&&dirty)hint.textContent='이 항로를 마쳤어요. 화물과 장착품을 정리하고 저장하면 다음 항로로 나아갈 수 있어요.';
    else if(count>current)hint.textContent='귀환 정산을 저장했어요. 다음 항로에도 함선·장착품·창고·자원이 이어집니다.';
    else hint.textContent='전투 전체 승리 → 남쪽 원 안 귀환 → 정산 저장 → 다음 항로. 조기 철수는 현재 단계를 유지합니다.';
    const state=qa.controller?.state;
    const canImport=harbor&&!active&&state?.voyageSequence===0&&state?.settlements?.length===0&&!state?.campaignImport;
    document.getElementById('legacy-import').hidden=!canImport;
    legacyButton.disabled=busy||!canImport;legacySelect.disabled=busy||!canImport;
  }
  return {update};
}

export function drawRouteGuide(ctx,level,map,route){
  ctx.save();ctx.lineWidth=1.3;ctx.strokeStyle='#609b8c';ctx.setLineDash([4,3]);
  for(const corridor of level.corridors){ctx.beginPath();corridor.points.forEach((point,index)=>{const p=map(point[0],point[2]);if(index)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.stroke();}
  ctx.setLineDash([]);ctx.font='9px sans-serif';
  for(const [index,item] of (route?.objectives||[]).entries()){
    const p=map(item.position[0],item.position[2]);ctx.fillStyle='#fff9e8';ctx.strokeStyle='#9a7e49';ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#705a31';ctx.fillText(String(index+1),p.x,p.y+3);
  }
  const trigger=level.triggers.find(item=>item.type==='return-request'),dock=map(trigger?.center[0]||0,trigger?.center[2]||67);
  ctx.strokeStyle='#397565';ctx.beginPath();ctx.arc(dock.x,dock.y,12/180*204,0,Math.PI*2);ctx.stroke();ctx.restore();
}
