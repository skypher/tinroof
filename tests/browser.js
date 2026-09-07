import {chromium} from 'playwright';
import assert from 'node:assert/strict';
if(process.argv.includes('-h')||process.argv.includes('--help')){console.log('Usage: node tests/browser.js [URL]; set CHROMIUM_PATH to use an existing Chromium binary.');process.exit(0);}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   const Native=window.AudioWorkletNode;
   window.AudioWorkletNode=class extends Native{constructor(context,...args){super(context,...args);window.stormNode=this;window.stormContext=context;window.stormAnalyser=context.createAnalyser();this.connect(window.stormAnalyser);}};
 });
 await page.goto(process.argv[2]||'http://127.0.0.1:8000');
 await page.click('#toggle');await page.waitForFunction(()=>document.querySelector('audio').currentTime>.2);await page.click('#toggle');
 assert(await page.$eval('#audio',a=>a.paused));
 await page.selectOption('#mode','4');assert.equal(await page.$eval('#seek',e=>e.max),'14400');
 await page.$eval('#seek',e=>{e.value=3599;e.dispatchEvent(new Event('change'));});await page.click('#toggle');
 try { await page.waitForFunction(()=>Number(document.querySelector('#seek').value)>=3600,{},{timeout:10000}); } catch(e) { console.log(await page.evaluate(()=>({seek:document.querySelector('#seek').value,state:document.querySelector('#state').textContent,error:document.querySelector('#error').textContent,primary:{time:document.querySelector('audio').currentTime,src:document.querySelector('audio').src,paused:document.querySelector('audio').paused,loop:document.querySelector('audio').loop,ready:document.querySelector('audio').readyState}}))); throw e; }await page.click('#toggle');
 console.log('PASS original playback, pause and first four-hour playlist transition');
 await page.selectOption('#mode','8');assert.equal(await page.$eval('#seek',e=>e.max),'28800');
 await page.$eval('#seek',e=>{e.value=28799;e.dispatchEvent(new Event('change'));});await page.click('#toggle');
 await page.waitForFunction(()=>Number(document.querySelector('#seek').value)<5&&document.querySelector('#toggle').getAttribute('aria-label')==='Pause storm',{},{timeout:30000});await page.click('#toggle');
 console.log('PASS eight-hour seeking and playlist wrap');
 await page.selectOption('#mode','live');await page.click('#toggle');
 await page.waitForFunction(()=>window.stormContext?.state==='running'&&document.querySelector('#state').textContent==='Distant thunder',{},{timeout:60000});
 await page.waitForFunction(()=>{const a=new Float32Array(window.stormAnalyser.fftSize);window.stormAnalyser.getFloatTimeDomainData(a);return a.some(v=>Math.abs(v)>.00001);});
 await page.selectOption('#cycle','3');await page.selectOption('#pace','0.5');assert.equal(await page.$eval('#seek',e=>e.max),'21600');
 for (const fraction of [.4,.45,.5,.55,.6]) {
   await page.$eval('#seek',(e,f)=>{e.value=Number(e.max)*f;e.dispatchEvent(new Event('change'));},fraction);
   try { await page.waitForFunction(()=>document.querySelector('#state').textContent==='Heavy storm',{},{timeout:1400}); break; } catch {}
 }
 assert.equal(await page.textContent('#state'),'Heavy storm');
 for(const id of ['intensity','crickets','frogs'])await page.$eval(`#${id}`,e=>{e.value=0;e.dispatchEvent(new Event('input'));});
 await page.waitForFunction(()=>{const a=new Float32Array(window.stormAnalyser.fftSize);window.stormAnalyser.getFloatTimeDomainData(a);return a.every(v=>Math.abs(v)<.000001);});
 for(const id of ['intensity','crickets','frogs'])await page.$eval(`#${id}`,e=>{e.value=1;e.dispatchEvent(new Event('input'));});
 await page.waitForFunction(()=>{const a=new Float32Array(window.stormAnalyser.fftSize);window.stormAnalyser.getFloatTimeDomainData(a);return a.some(v=>Math.abs(v)>.00001);});
 await page.click('#toggle');await page.waitForFunction(()=>window.stormContext.state==='suspended');
 await page.click('#restart');await page.click('#toggle');await page.waitForFunction(()=>window.stormContext.state==='running');
 console.log('PASS live samples produce audio, stage seeking, stretching, speed, mute controls, pause/resume');
 // Block the page thread while the audio thread continues to schedule the storm.
 const before=await page.evaluate(()=>window.stormContext.currentTime);
 await page.evaluate(()=>{const end=performance.now()+1500;while(performance.now()<end){}});
 assert((await page.evaluate(()=>window.stormContext.currentTime))>before+1);
 await page.selectOption('#mode','1');await page.waitForFunction(()=>window.stormContext.state==='suspended');
 await page.click('#toggle');
 await page.selectOption('#mode','live');await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/rainfall-live-mobile.png',fullPage:true});assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
 assert.deepEqual(errors,[]);console.log('PASS audio-thread continuity, mode switching, mobile layout, no JS errors');
}finally{await browser.close();}
