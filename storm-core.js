// Browser adaptation of owstorm.py and pwrain.py by Owen Williams,
// Peter Williams and Andrew Plotkin. Sample names, layer levels, event
// pitch ranges and modulation intervals follow the original soundscape.
export const STAGES = ['Distant thunder', 'Light rain', 'Gathering rain', 'Heavy storm', 'Rain easing', 'Light rain', 'After the rain'];
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const env = name => `environ/${name}.aiff`;
const insect = name => `insect/${name}.aiff`;
const frog = name => `animal/${name}.aiff`;
const thunder = ['thunder-low', 'thunder-low-1', 'thunder-low-2'].map(env);
const frogs = ['frog-bullfrog1','frog-bullfrog2','frog-bullfrog3','frog-cheep'].map(frog);
export class StormEngine {
  constructor(samples, rate, random=Math.random) {
    this.samples=samples; this.rate=rate; this.random=random;
    this.settings={hours:1, pace:1, intensity:1, crickets:1, frogs:1};
    this.seconds=0; this.phase=0; this.cycles=0; this.voices=[];
    this.events={thunder:10,intense:120,plink:1,bug1:8,bug2:15,frog1:5,frog2:8};
    this.bugs=Object.keys(samples).filter(n=>n.startsWith('insect/'));
    this.makeCycle();
    const layer=(name, levels, group='weather', modulation=0)=>({name,levels,group,modulation,pos:0,value:1,from:1,target:1,start:0,end:0,next:0,gain:0});
    this.layers=[
      layer(env('wind-far'),[.04,.05,.1,.15,.1,.05,.04]),
      layer(env('water-rushing'),[.075,.1,.3,.5,.3,.1,.075],'weather',1),
      layer(env('rain-thin'),[0,.3,.3,0,.3,.3,0]),
      layer(env('rain-med'),[0,0,.65,.65,.65,0,0]),
      layer(env('rain-splatter'),[0,0,.455,1.085,.455,0,0]),
      layer(env('rain-on-leaves'),[0,0,.39,1.09,.39,0,0]),
      layer(env('rain-heavy'),[0,0,0,.56,0,0,0]),
      layer(insect('melodious_ground_cricket'),[.025],'crickets',1),
      layer(insect('everglades_conehead'),[.025],'crickets',1),
      layer(insect('pine_tree_cricket'),[.01875],'crickets',1),
      layer(insect('vocal_field_cricket'),[.025],'crickets',.5),
      layer(frog('frog-cheep'),[.05],'frogs',.1)
    ];
  }
  rand(a,b){return a+(b-a)*this.random();}
  choose(a){return a[Math.floor(this.random()*a.length)];}
  makeCycle(){
    let durations=[480,570,540,420,540,570].map(n=>n+this.rand(-120,120));
    // Reserve a minute of recovery even for the longest random stage draws.
    const sum=durations.reduce((a,b)=>a+b,0);
    if(sum>3540)durations=durations.map(d=>d*3540/sum);
    durations.push(3600-durations.reduce((a,b)=>a+b,0));
    this.edges=[0]; for(const d of durations)this.edges.push(this.edges.at(-1)+d);
    this.frogReturn=Math.min(3540,this.edges[4]+this.rand(300,420));
    this.bugReturn=Math.min(3540,this.edges[5]+this.rand(15,60));
  }
  configure(values){
    for(const [key,min,max] of [['hours',1,3],['pace',.5,2],['intensity',0,1.5],['crickets',0,2],['frogs',0,2]]){
      if(Number.isFinite(values[key]))this.settings[key]=clamp(values[key],min,max);
    }
  }
  seek(fraction){this.phase=clamp(fraction)*3599.99;this.voices=[];for(const key of Object.keys(this.events))this.events[key]=this.seconds+this.rand(1,5);}
  stage(){let i=0;while(i<6&&this.phase>=this.edges[i+1])i++;return i;}
  level(levels){
    const i=this.stage(), previous=i===0?6:i-1;
    const blend=clamp((this.phase-this.edges[i])/10);
    return levels[previous]*(1-blend)+levels[i]*blend;
  }
  animalLevel(kind){
    const end=kind==='crickets'?this.edges[1]:this.edges[2];
    const back=kind==='crickets'?this.bugReturn:this.frogReturn;
    const fade=kind==='crickets'?120:180;
    const before=clamp(this.phase/3)*clamp((end+fade-this.phase)/fade);
    const after=clamp((this.phase-back)/30)*clamp((3600-this.phase)/45);
    return Math.max(before,after)*this.settings[kind];
  }
  note(name,pitch,gain,pan,group='weather'){
    if(!this.samples[name]||gain<=0||this.voices.length>=96)return;
    this.voices.push({name,pitch,gain,pan,group,pos:0});
  }
  schedule(){
    const s=this.seconds, strength=this.settings.intensity;
    const insectGain=this.animalLevel('crickets'),frogGain=this.animalLevel('frogs');
    if(s>=this.events.thunder){
      const vol=this.level([.4,.5,.8,1,.8,.5,.4]);
      this.note(this.choose(thunder),this.rand(.75,1),this.rand(vol-.2,vol+.2),this.rand(-1,1));
      this.events.thunder=s+this.rand(this.level([20,7,7,2,7,7,20]),this.level([35,15,15,8,15,15,35]))/Math.max(.25,strength);
    }
    if(s>=this.events.intense){
      const vol=this.level([0,0,.7,1,.7,0,0]);
      if(vol>.01)this.note(env('thunder-tense'),this.rand(.75,1),this.rand(Math.max(0,vol-.2),vol+.2),this.rand(-1,1));
      this.events.intense=s+this.rand(this.level([60,60,60,13,60,60,60]),this.level([90,90,90,30,90,90,90]))/Math.max(.25,strength);
    }
    if(s>=this.events.plink){
      const vol=this.level([.1,.15,.2,.4,.2,.15,.1]);
      this.note(env('droplet-plink'),this.rand(.8,1.2),this.rand(vol*.9,vol*1.1),this.rand(-.5,.5));
      const delay=this.level([4,1,.75,.4,.75,1,4]), delta=this.level([2,.5,.4,.3,.4,.5,2]);
      this.events.plink=s+this.rand(delay-delta,delay+delta);
    }
    for(const [key,min,max,gain] of [['bug1',10,20,.1],['bug2',20,40,.2]]){
      if(s>=this.events[key]){if(insectGain>0)this.note(this.choose(this.bugs),this.rand(.8,1.2),this.rand(0,gain),this.rand(-.9,.9),'crickets');this.events[key]=s+this.rand(min,max);}
    }
    for(const [key,min,max,gain] of [['frog1',3,8,.05],['frog2',6,12,.1]]){
      if(s>=this.events[key]){if(frogGain>0)this.note(this.choose(frogs),this.rand(.8,1.2),this.rand(0,gain),this.rand(-.9,.9),'frogs');this.events[key]=s+this.rand(min,max);}
    }
  }
  modulate(layer){
    if(!layer.modulation)return 1;
    const s=this.seconds;
    layer.value=layer.from+(layer.target-layer.from)*clamp((s-layer.start)/Math.max(.001,layer.end-layer.start));
    if(s>=layer.next){layer.from=layer.value;layer.target=1+this.rand(-layer.modulation,layer.modulation);layer.start=s;layer.end=s+this.rand(3,10);layer.next=s+this.rand(20,45);}
    return layer.value;
  }
  mix(left,right){
    this.schedule();
    const animals={crickets:this.animalLevel('crickets'),frogs:this.animalLevel('frogs'),weather:this.settings.intensity};
    const dt=left.length/this.rate;
    for(const layer of this.layers){
      const sample=this.samples[layer.name];if(!sample)continue;
      const target=(layer.group==='weather'?this.level(layer.levels)*animals.weather:layer.levels[0]*animals[layer.group])*this.modulate(layer);
      const endGain=layer.gain+(target-layer.gain)*Math.min(1,dt/.02);
      const gainStep=(endGain-layer.gain)/left.length, channels=sample.channels, len=channels[0].length;
      const step=sample.rate/this.rate;
      for(let i=0;i<left.length;i++){
        const idx=Math.floor(layer.pos), f=layer.pos-idx, next=(idx+1)%len;
        const gain=layer.gain+gainStep*i;
        left[i]+=(channels[0][idx]*(1-f)+channels[0][next]*f)*gain;
        const r=channels[1]||channels[0];right[i]+=(r[idx]*(1-f)+r[next]*f)*gain;
        layer.pos=(layer.pos+step)%len;
      }
      layer.gain=endGain;
    }
    for(let v=this.voices.length-1;v>=0;v--){
      const voice=this.voices[v],sample=this.samples[voice.name], channels=sample.channels,len=channels[0].length;
      const step=sample.rate/this.rate*voice.pitch;
      const gain=voice.gain*animals[voice.group];
      const lg=gain*Math.min(1,1-voice.pan),rg=gain*Math.min(1,1+voice.pan);
      for(let i=0;i<left.length&&voice.pos<len-1;i++){
        const idx=Math.floor(voice.pos),f=voice.pos-idx,r=channels[1]||channels[0];
        left[i]+=(channels[0][idx]*(1-f)+channels[0][idx+1]*f)*lg;
        right[i]+=(r[idx]*(1-f)+r[idx+1]*f)*rg;
        voice.pos+=step;
      }
      if(voice.pos>=len-1)this.voices.splice(v,1);
    }
    // The original Boodler master is 0.5, with signed-PCM saturation.
    for(let i=0;i<left.length;i++){left[i]=clamp(left[i]*.5,-1,1);right[i]=clamp(right[i]*.5,-1,1);}
    this.seconds+=dt;this.phase+=dt*this.settings.pace/this.settings.hours;
    if(this.phase>=3600){this.phase-=3600;this.cycles++;this.makeCycle();}
  }
  status(){return {elapsed:this.seconds,phase:this.phase,cycleSeconds:3600*this.settings.hours/this.settings.pace,stage:STAGES[this.stage()],cycles:this.cycles,voices:this.voices.length};}
}
