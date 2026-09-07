import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {StormEngine,STAGES} from '../storm-core.js';
const manifest=JSON.parse(readFileSync(new URL('../samples/manifest.json',import.meta.url)));
const samples=Object.fromEntries(Object.keys(manifest).map(name=>[name,{rate:100,channels:[new Float32Array([.1,.2,-.1,-.2])]}]));
const make=()=>new StormEngine(samples,100,()=>.5);
function advance(e,seconds){const l=new Float32Array(100),r=new Float32Array(100);for(let i=0;i<seconds;i++){l.fill(0);r.fill(0);e.mix(l,r);assert(l.every(Number.isFinite));assert(r.every(Number.isFinite));assert(e.voices.length<=96);}}
test('all original layers have samples; sample playback is unchanged by weather pace',()=>{const a=make(),b=make();b.configure({hours:3,pace:.5});advance(a,10);advance(b,10);assert.equal(a.phase,10);assert.equal(b.phase,10/6);for(let i=0;i<a.layers.length;i++){assert(samples[a.layers[i].name]);assert.equal(a.layers[i].pos,b.layers[i].pos);}});
test('every stage occurs and an eight-hour simulation keeps cycling with bounded voices',()=>{const e=make(),seen=new Set();for(let i=0;i<8*3600;i++){seen.add(e.stage());advance(e,1);}assert.equal(e.cycles,8);assert.equal(e.phase,0);assert.equal(seen.size,7);});
test('cycle lengths and pace produce the specified wall-clock duration',()=>{for(const hours of [1,2,3]){const e=make();e.configure({hours,pace:2});advance(e,1800*hours+1);assert.equal(e.cycles,1);}});
test('wildlife recedes during heavy rain and returns in recovery',()=>{const e=make();e.phase=(e.edges[3]+e.edges[4])/2;assert.equal(e.animalLevel('crickets'),0);assert.equal(e.animalLevel('frogs'),0);e.phase=3500;assert(e.animalLevel('crickets')>0);assert(e.animalLevel('frogs')>0);});
test('all sound controls at zero mute output after the short gain ramp',()=>{const e=make();advance(e,3);e.configure({intensity:0,crickets:0,frogs:0});advance(e,1);const l=new Float32Array(100),r=new Float32Array(100);e.mix(l,r);assert(l.every(v=>v===0));assert(r.every(v=>v===0));});
test('adversarial random stage draws still give a positive recovery interval',()=>{const e=new StormEngine(samples,100,()=>.999999);assert(e.edges.at(-1)===3600);for(let i=1;i<e.edges.length;i++)assert(e.edges[i]>e.edges[i-1]);});
test('seek clears old thunder tails and controls reject non-finite inputs',()=>{const e=make();e.note('environ/thunder-low.aiff',1,1,0);assert.equal(e.voices.length,1);e.seek(.5);assert.equal(e.voices.length,0);assert.equal(e.phase,1799.995);e.configure({pace:Infinity,hours:NaN});assert.equal(e.settings.pace,1);assert.equal(e.settings.hours,1);});
