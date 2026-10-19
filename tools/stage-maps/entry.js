// Catch invalid map identities before displaying any example voyage or overwriting a slot.
import('./app.js').catch(error=>{
  document.getElementById('loading-message').textContent=error.message;
  document.querySelector('#loading-screen h2').textContent='항로를 열지 못했어요';
  document.getElementById('app-status').textContent=error.message;
  const button=document.createElement('button');button.className='secondary';button.textContent='종항 항로 열기';
  button.addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.set('map','map-01-harbor');location.assign(url);});
  document.querySelector('#loading-screen .overlay-paper').append(button);
});
