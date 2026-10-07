import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app-scene-events.js',import.meta.url),'utf8');
const start=source.indexOf('$("scene-board-wrap").addEventListener("wheel"');
const end=source.indexOf('$("scene-board-wrap").addEventListener("mousedown"',start);
let handler,options,tool='wall',now=1000,zoom=100;
const messages=[],zooms=[],rotations=[],previews=[];
const picker=()=>({value:'east',options:['north','east','south','west'].map(value=>({value,textContent:value})),
  get selectedOptions(){return this.options.filter(option=>option.value===this.value)},
  dispatchEvent(){rotations.push(this.value)}});
const direction=picker(),area=picker();
const context=vm.createContext({$:id=>id==='scene-board-wrap'?{addEventListener:(event,fn,opts)=>{assert.equal(event,'wheel');handler=fn;options=opts}}:id==='scene-wall-direction'?direction:area,
  Scene:{activeSpace:"main"},sceneWallPreviewPoint:{x:3,y:2,space:"main"},previewSceneWall:point=>previews.push(point),activeSceneTool:()=>tool,Date:{now:()=>now},Event:class{constructor(type){this.type=type}},
  applySceneZoom:(next,opts)=>{zoom=next;zooms.push({next,opts})},toast:text=>messages.push(text)});
vm.runInContext('let sceneToolWheelAt=0,sceneZoom=100;'+source.slice(start,end),context);
const wheel=(at,extra={})=>{now=at;let prevented=false;handler({deltaY:20,ctrlKey:false,metaKey:false,preventDefault:()=>{prevented=true},...extra});return prevented};
assert.equal(options.passive,false);
assert.deepEqual([1000,1040,1080,1160,1200].map(at=>wheel(at)),[true,true,true,true,true],
  'every event is consumed even when rotation is throttled');
assert.deepEqual(rotations,['south','west'],'throttle limits rotation without leaking scroll events');
assert.equal(wheel(1400,{ctrlKey:true}),true);
assert.equal(zoom,100,'Wall mode prevents pinch/control wheel from zooming the map');
assert.equal(zooms.length,0);assert.equal(previews.length,3,"wheel rotation refreshes the last hovered wall segment without pointer movement");
assert.equal(wheel(1500,{deltaY:0,deltaX:40}),true,'horizontal trackpad wheel cannot pan during wall placement');
assert.equal(rotations.length,3,'horizontal input does not rotate');
tool='area';assert.equal(wheel(1550),true,'area wheel also consumes throttled input');
assert.equal(wheel(1600),true);
tool='measure';assert.equal(wheel(1700),false,'ordinary camera scrolling remains available to neutral tools');
assert.equal(wheel(1800,{ctrlKey:true}),true);
assert.equal(zooms.length,1,'explicit camera zoom works outside Wall mode');
assert.equal(zooms[0].opts.manual,true);
assert.ok(messages.every(text=>typeof text==='string'));
console.log('Real board wheel handler: all Wall events consumed, throttled rotation, modifiers/trackpad and neutral camera behavior passed');
