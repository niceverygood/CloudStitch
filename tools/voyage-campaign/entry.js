// Surface startup failures while preserving the campaign save for inspection.
import('./app.js').catch(error=>{
  document.getElementById('loading-message').textContent=error.message;
  document.querySelector('#loading-screen h2').textContent='항로를 열지 못했어요';
  document.getElementById('app-status').textContent=error.message;
  const button=document.createElement('button');button.className='secondary';button.textContent='다시 불러오기';
  button.addEventListener('click',()=>location.reload());
  document.querySelector('#loading-screen .overlay-paper').append(button);
});
