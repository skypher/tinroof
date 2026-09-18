export class LiveStorm {
  constructor(onStatus){this.onStatus=onStatus;this.context=null;this.node=null;this.pending=null;this.settings={};this.volume=.7;}
  async init(){
    if(this.node)return;
    if(this.pending)return this.pending;
    this.pending=this.load().finally(()=>{this.pending=null;});
    return this.pending;
  }
  async load(){
    this.context=new AudioContext();
    try{
      await this.context.audioWorklet.addModule('./storm-worklet.js');
      const response=await fetch('samples/manifest.json');if(!response.ok)throw Error('Sample list unavailable');
      const manifest=await response.json(),samples={};
      const entries=Object.entries(manifest);let done=0;
      // Four decodes at a time keeps the mobile memory and connection load bounded.
      const worker=async()=>{while(entries.length){const [name,url]=entries.shift();const res=await fetch(url);if(!res.ok)throw Error(`Missing sample: ${name}`);const decoded=await this.context.decodeAudioData(await res.arrayBuffer());samples[name]={rate:decoded.sampleRate,channels:Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i).slice())};this.onStatus({type:'loading',done:++done,total:Object.keys(manifest).length});}};
      const results=await Promise.allSettled(Array.from({length:4},worker));
      const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
      this.node=new AudioWorkletNode(this.context,'tinroof-storm',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
      this.gain=this.context.createGain();this.gain.gain.value=this.volume;
      this.node.connect(this.gain).connect(this.context.destination);
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Audio engine did not initialize')),15000);this.node.port.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timeout);resolve();}else this.onStatus(data);};this.node.port.postMessage({type:'init',samples,settings:this.settings},Object.values(samples).flatMap(s=>s.channels.map(c=>c.buffer)));});
      await this.context.suspend();
    }catch(e){await this.context.close();this.context=null;this.node=null;throw e;}
  }
  async play(){await this.init();await this.context.resume();}
  async pause(){if(this.context?.state==='running')await this.context.suspend();}
  configure(settings){this.settings=settings;this.node?.port.postMessage({type:'settings',settings});}
  setVolume(value){this.volume=value;if(this.gain)this.gain.gain.setTargetAtTime(value,this.context.currentTime,.03);}
  seek(fraction){this.node?.port.postMessage({type:'seek',fraction});}
}
