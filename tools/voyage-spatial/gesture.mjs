/** The READY4 grab policy: thresholded left click, immediate other-button orbit. */
export function beginGesture(event){
 if(![0,1,2].includes(event.button))return null;
 return {id:event.pointerId,kind:event.pointerType,mask:event.button===1?4:event.button===2?2:1,
  startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,
  mode:event.button===0&&event.pointerType!=='touch'?'pending':'orbit'};
}
export function moveGesture(gesture,event){
 if(!gesture||gesture.id!==event.pointerId)return {kind:'ignore'};
 if(gesture.kind==='mouse'&&!(event.buttons&gesture.mask))return {kind:'cancel'};
 if(gesture.mode==='pending'&&Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)<6)return {kind:'pending'};
 gesture.mode='orbit';const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
 gesture.x=event.clientX;gesture.y=event.clientY;return {kind:'orbit',dx,dy};
}
export function finishGesture(gesture,event){
 if(!gesture||gesture.id!==event.pointerId)return 'ignore';
 if(gesture.kind==='mouse'&&(event.buttons&gesture.mask))return 'ignore';
 return gesture.mode==='pending'&&event.button===0&&Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)<6?'click':'orbit';
}
