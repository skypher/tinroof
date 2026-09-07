'use strict';
const audio=document.querySelector('#audio'), toggle=document.querySelector('#toggle'), seek=document.querySelector('#seek'), volume=document.querySelector('#volume'), state=document.querySelector('#state'), hint=document.querySelector('#hint'), error=document.querySelector('#error');
const clock=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
audio.volume=Number(volume.value);
function update(){const active=!audio.paused;document.body.classList.toggle('playing',active);toggle.setAttribute('aria-label',active?'Pause storm':'Play storm');document.querySelector('#symbol').textContent=active?'Ⅱ':'▶';state.textContent=active?'Let it rain':'Stay a while';hint.textContent=active?'The storm passes. Then begins again.':'One hour · Repeats endlessly';if('mediaSession' in navigator)navigator.mediaSession.playbackState=active?'playing':'paused';}
async function play(){error.textContent='';try{await audio.play();}catch(e){error.textContent='Couldn’t start the audio. Check your connection and tap play to try again.';}update();}
toggle.addEventListener('click',()=>audio.paused?play():audio.pause());
audio.addEventListener('play',update);audio.addEventListener('pause',update);
audio.addEventListener('timeupdate',()=>{seek.value=audio.currentTime;document.querySelector('#elapsed').textContent=clock(audio.currentTime);});
audio.addEventListener('waiting',()=>{if(!audio.paused)state.textContent='Listening for the rain…';});audio.addEventListener('playing',update);
audio.addEventListener('error',()=>{error.textContent='The sound couldn’t load. Please refresh and try again.';update();});
seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(Number(seek.value),audio.duration-.1);});
volume.addEventListener('input',()=>{audio.volume=Number(volume.value);});
document.querySelector('#restart').addEventListener('click',()=>{audio.currentTime=0;});
if('mediaSession' in navigator){navigator.mediaSession.metadata=new MediaMetadata({title:'A passing storm',artist:'Boodler',album:'Rain, crickets & frogs'});navigator.mediaSession.setActionHandler('play',play);navigator.mediaSession.setActionHandler('pause',()=>audio.pause());navigator.mediaSession.setActionHandler('seekto',e=>{audio.currentTime=e.seekTime;});}
