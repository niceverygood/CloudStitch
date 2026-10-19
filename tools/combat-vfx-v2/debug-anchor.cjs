const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {launchBrowser}=require('../lib/runtime.cjs');
async function main(){
 const root=path.resolve(__dirname,'../..'),out=path.join(root,'work/combat-vfx-v2/debug-anchor');fs.mkdirSync(out,{recursive:true});
 const browser=await launchBrowser({args:['--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'});await page.goto(pathToFileURL(path.join(root,'outputs/combat-vfx-v2/comparison.html')).href);await page.waitForFunction(()=>window.__vfxV2Ready||window.__vfxV2Stats?.error,null,{timeout:120000});
 const reports=[];
 for(const id of ['repair-stitch']){
  await page.evaluate(async id=>{const a=window.__vfxV2;await a.selectEffect(id);a.setPlaying(false);a.setLoop(false);a.setTime(a.duration*.38);a.setOutline(true);a.setMode('handdrawn');a.focusEffect?.();a.renderClean();},id);
  await page.locator('#stage').screenshot({path:path.join(out,id+'-close-outlined.png')});
  await page.evaluate(()=>{const a=window.__vfxV2;a.setOutline(false);a.setMode('original');a.renderClean();});
  const report=await page.evaluate(()=>{const a=window.__vfxV2,stage=document.getElementById('stage'),V=a.camera.position.constructor;return {id:a.selected.id,time:a.currentTime,anchors:a.stats.anchors,camera:{position:a.camera.position.toArray(),target:a.controls.target.toArray(),left:a.camera.left,right:a.camera.right,top:a.camera.top,bottom:a.camera.bottom,zoom:a.camera.zoom},models:a.models.map((model,index)=>{model.source.updateMatrixWorld(true);const meshes=[];model.source.traverse(n=>{if(!n.isMesh)return;if(!n.geometry.boundingBox)n.geometry.computeBoundingBox();const b=n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld),min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++){const p=new V(x?b.max.x:b.min.x,y?b.max.y:b.min.y,z?b.max.z:b.min.z).project(a.camera);min[0]=Math.min(min[0],(p.x+1)*stage.clientWidth/4+index*stage.clientWidth/2);max[0]=Math.max(max[0],(p.x+1)*stage.clientWidth/4+index*stage.clientWidth/2);min[1]=Math.min(min[1],(1-p.y)*stage.clientHeight/2);max[1]=Math.max(max[1],(1-p.y)*stage.clientHeight/2);}const ancestors=[];let p=n;while(p){ancestors.push({name:p.name,visible:p.visible,scale:p.scale.toArray(),position:p.position.toArray()});p=p.parent;}const c=n.geometry.attributes.color;meshes.push({name:n.name,worldBox:{min:b.min.toArray(),max:b.max.toArray()},projected:{min,max},firstVertexColor:c?[c.getX(0),c.getY(0),c.getZ(0)]:null,ancestors,materials:(Array.isArray(n.material)?n.material:[n.material]).map(m=>({type:m.type,opacity:m.opacity,alphaTest:m.alphaTest,visible:m.visible,transparent:m.transparent,side:m.side,depthTest:m.depthTest,depthWrite:m.depthWrite,color:m.color.toArray(),map:!!m.map,vertexColors:m.vertexColors}))});});return {lane:index?'v2':'v1',meshes};})};});
  reports.push(report);await page.locator('#stage').screenshot({path:path.join(out,id+'-close-original-no-outline.png')});console.log(JSON.stringify({id:report.id,time:report.time,v2:report.models[1].meshes.filter(n=>n.name.includes('patch'))}));
 }
 fs.writeFileSync(path.join(out,'detail-report.json'),JSON.stringify(reports,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
