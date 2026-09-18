import {LiveStorm} from './live.js';
const $=id=>document.getElementById(id);
const primary=$('audio'),spare=new Audio();
let audio=primary, standby=spare, track=0, mode='1', desired=false, loading=false, generation=0;
let liveStatus={phase:0,stage:'Distant thunder',cycles:0};
const clock=s=>{const n=Math.max(0,Math.floor(s));return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;};
const file=n=>n===0?'audio/storm.mp3':`audio/hour-${n+1}.mp3`;
const settings=()=>({hours:Number($('cycle').value),pace:Number($('pace').value),intensity:Number($('intensity').value),crickets:Number($('crickets').value),frogs:Number($('frogs').value)});
const total=()=>mode==='live'?3600*settings().hours/settings().pace:Number(mode)*3600;
const live=new LiveStorm(data=>{
  if(mode!=='live')return;
  if(data.type==='loading'&&loading)$('state').textContent=`Gathering sounds · ${data.done}/${data.total}`;
  if(data.type==='status'){liveStatus=data;timeline();update();}
});
function timeline(){
  const duration=total();$('seek').max=duration;
  const position=mode==='live'?liveStatus.phase/3600*duration:track*3600+audio.currentTime;
  $('seek').value=position;$('elapsed').textContent=clock(position);
  $('duration').textContent=`${clock(duration)} / ${mode==='live'?'NEW EACH CYCLE':'ON REPEAT'}`;
}
function update(){
  document.body.classList.toggle('playing',desired&&!loading);
  $('toggle').setAttribute('aria-label',desired?'Pause storm':'Play storm');
  $('symbol').textContent=desired?'Ⅱ':'▶';
  if(!loading)$('state').textContent=desired?(mode==='live'?liveStatus.stage:'Let it rain'):'Stay a while';
  $('hint').textContent=mode==='live'?`${Math.round(total()/60)}-minute cycles · Always changing`:`${mode==='1'?'One':mode==='4'?'Four':'Eight'} hour${mode==='1'?'':'s'} · Repeats endlessly`;
  if('mediaSession' in navigator)navigator.mediaSession.playbackState=desired&&!loading?'playing':'paused';
}
function prepareNext(){
  if(mode==='live'||mode==='1')return;
  const next=(track+1)%Number(mode),src=new URL(file(next),location.href).href;
  if(standby.src!==src){standby.src=src;standby.preload='auto';standby.load();}
}
function fail(message){desired=false;loading=false;audio.pause();live.pause();$('error').textContent=message;update();}
async function start(){
  const token=++generation;desired=true;loading=true;$('error').textContent='';$('state').textContent='Opening the sky…';update();
  try{
    if(mode==='live'){
      live.configure(settings());await live.init();
      if(token!==generation||!desired)return;
      await live.play();
    }else{
      await audio.play();
      if(token!==generation||!desired){audio.pause();return;}
      prepareNext();
    }
    if(token!==generation||!desired){await live.pause();audio.pause();return;}
    loading=false;update();
  }catch(e){if(token===generation)fail('Couldn’t start the sound. Check your connection and tap play to retry.');}
}
function pause(){++generation;desired=false;loading=false;audio.pause();live.pause();update();}
for(const element of [primary,spare]){
  element.preload='metadata';element.volume=Number($('volume').value);
  element.addEventListener('timeupdate',()=>{if(element===audio&&mode!=='live')timeline();});
  element.addEventListener('ended',async()=>{
    if(element!==audio||mode==='live'||mode==='1'||!desired)return;
    track=(track+1)%Number(mode);[audio,standby]=[standby,audio];audio.currentTime=0;audio.loop=false;
    try{await audio.play();prepareNext();timeline();}catch(e){fail('The next hour couldn’t start. Tap play to continue.');}
  });
  element.addEventListener('error',()=>{if(element===audio&&mode!=='live')fail('The recording couldn’t load. Check your connection and try again.');});
  element.addEventListener('waiting',()=>{if(element===audio&&mode!=='live'&&desired)$('state').textContent='Listening for the rain…';});
  element.addEventListener('playing',()=>{if(element===audio&&mode!=='live')update();});
}
$('toggle').addEventListener('click',()=>desired?pause():start());
$('mode').addEventListener('change',()=>{
  const resume=desired;pause();standby.pause();mode=$('mode').value;track=0;liveStatus={phase:0,stage:'Distant thunder',cycles:0};
  $('weather').hidden=mode!=='live';$('error').textContent='';
  if(mode!=='live'){audio.src=file(0);audio.loop=mode==='1';audio.load();}else live.seek(0);
  timeline();update();if(resume)start();
});
function configure(){live.configure(settings());for(const id of ['intensity','crickets','frogs'])$(`${id}-value`).textContent=`${Math.round(Number($(id).value)*100)}%`;timeline();update();}
for(const id of ['cycle','pace','intensity','crickets','frogs'])$(id).addEventListener('input',configure);
$('volume').addEventListener('input',()=>{const v=Number($('volume').value);primary.volume=v;spare.volume=v;live.setVolume(v);});
async function seekTo(seconds){
  if(mode==='live'){liveStatus.phase=seconds/total()*3600;live.seek(seconds/total());timeline();return;}
  const safe=Math.max(0,Math.min(seconds,total()-.1)),next=Math.floor(safe/3600),offset=safe%3600;
  if(next!==track){track=next;audio.src=file(track);audio.loop=mode==='1';audio.load();}
  audio.currentTime=offset;timeline();
  if(desired)await start();
}
$('seek').addEventListener('change',()=>seekTo(Number($('seek').value)));
$('seek').addEventListener('input',()=>{$('elapsed').textContent=clock(Number($('seek').value));});
$('restart').addEventListener('click',()=>seekTo(0));
if('mediaSession' in navigator){
  navigator.mediaSession.metadata=new MediaMetadata({title:'A passing storm',artist:'Tinroof / Boodler',album:'Rain, crickets & frogs'});
  for(const [action,handler] of Object.entries({play:start,pause,seekto:e=>seekTo(e.seekTime)})){
    try{navigator.mediaSession.setActionHandler(action,handler);}catch(e){/* Optional platform control. */}
  }
}
configure();
