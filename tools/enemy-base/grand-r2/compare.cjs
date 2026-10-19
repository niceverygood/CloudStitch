/* Compare the two actual GLBs with exactly the same camera and canvas size. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
module.exports=async function compare(page,report){
  const root=path.resolve(__dirname,'../../..'),work=path.join(root,'work/verification/enemy-base-v1/grand-r2');
  const results=[];
  for(const [id,entry] of [['v1','outputs/enemy-base-v1/index.html'],['r2','outputs/enemy-base-v1/grand-r2/index.html']]){
    await page.setViewportSize({width:1440,height:1050});
    await page.goto(pathToFileURL(path.join(root,entry)).href,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__enemyBaseReady===true,null,{timeout:90000});
    await page.evaluate(()=>{
      const stage=document.getElementById('stage');stage.style.height='760px';
      const v=window.__enemyBaseReview;v.setMotion(false);v.setAutoRotate(false);v.controls.enableDamping=false;v.setEnvironment(false);v.setMode('handdrawn');
    });
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const sample=await page.evaluate(()=>{
      const v=window.__enemyBaseReview,w=1094,h=760;
      v.renderer.setPixelRatio(1);v.effect.setSize(w,h);
      v.controls.target.set(0,12,2);v.camera.position.set(58,50,73);v.camera.up.set(0,1,0);
      v.camera.zoom=1;v.camera.top=29;v.camera.bottom=-29;v.camera.left=-29*w/h;v.camera.right=29*w/h;
      v.camera.near=.05;v.camera.far=2000;v.camera.lookAt(v.controls.target);v.controls.update();v.camera.updateProjectionMatrix();v.camera.updateMatrixWorld(true);v.render();
      return{png:v.renderer.domElement.toDataURL('image/png'),matrix:v.camera.matrixWorld.toArray(),projection:v.camera.projectionMatrix.toArray(),canvas:[v.renderer.domElement.width,v.renderer.domElement.height],triangles:v.stats.triangles};
    });
    const filename='comparison-'+id+'-matched.png',bytes=Buffer.from(sample.png.split(',')[1],'base64');delete sample.png;
    const target=path.join(work,filename);fs.writeFileSync(target,bytes);report.screenshots.push(path.relative(root,target).split(path.sep).join('/'));
    results.push({id,entry,...sample,image:filename,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  const same=JSON.stringify(results[0].matrix)===JSON.stringify(results[1].matrix)&&JSON.stringify(results[0].projection)===JSON.stringify(results[1].projection)&&JSON.stringify(results[0].canvas)===JSON.stringify(results[1].canvas);
  report.matchedComparison={sameCameraAndProjection:same,sameCanvas:same,mode:'handdrawn',results,scope:'Actual GLB renders; comparison is not human art approval.'};
  return same&&results[0].sha256!==results[1].sha256;
};
