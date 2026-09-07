import {StormEngine} from './storm-core.js';
class StormProcessor extends AudioWorkletProcessor {
  constructor(){
    super();this.engine=null;this.report=0;
    this.port.onmessage=({data})=>{
      if(data.type==='init'){this.engine=new StormEngine(data.samples,sampleRate);this.engine.configure(data.settings);this.port.postMessage({type:'ready'});}
      if(data.type==='settings'&&this.engine)this.engine.configure(data.settings);
      if(data.type==='seek'&&this.engine)this.engine.seek(data.fraction);
    };
  }
  process(inputs,outputs){
    if(this.engine&&outputs[0]?.length===2){
      this.engine.mix(outputs[0][0],outputs[0][1]);
      this.report+=outputs[0][0].length;
      if(this.report>=sampleRate){this.report=0;this.port.postMessage({type:'status',...this.engine.status()});}
    }
    return true;
  }
}
registerProcessor('rainfall-storm',StormProcessor);
