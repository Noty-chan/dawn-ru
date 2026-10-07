import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../scene-ui.js",import.meta.url),"utf8");
const start=source.indexOf("function applySceneZoom("),end=source.indexOf("function reconcileLocalSceneFlow(",start);
assert.ok(start>=0&&end>start);
const frames=[],saved=[],properties=new Map(),attributes=new Map();
const scene=Object.freeze({pendingAction:Object.freeze({id:"attack",actorId:"enemy"}),targetIds:Object.freeze(["enemy"]),actors:Object.freeze([])});
const wrap={clientWidth:1260,clientHeight:650},space={width:8,height:6};
const elements=new Map([
  ["scene-board-wrap",wrap],
  ["scene-board",{style:{setProperty:(key,value)=>properties.set(key,value)}}],
  ["scene-zoom",{}],["scene-zoom-value",{}],
  ["scene-zoom-fit",{classList:{remove(){}},removeAttribute:key=>attributes.delete(key),setAttribute:(key,value)=>attributes.set(key,value)}],
]);
const context={Scene:scene,store:{mode:"play"},$ :id=>elements.get(id),
  clamp:(value,min,max)=>Math.max(min,Math.min(max,Number(value))),
  isEnglishPreview:()=>false,activeSceneSpace:()=>space,usingNextSceneInterface:()=>true,
  requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},
  persist:()=>saved.push(vm.runInContext("({zoom:sceneZoom,mode:sceneZoomMode})",context)),
};
vm.createContext(context);
vm.runInContext("let sceneZoom=80,sceneZoomMode='fit',sceneViewportFitFrame=null,sceneViewportMode='desktop',sceneNeedsInitialFit=true;",context);
vm.runInContext(source.slice(start,end),context);
const run=script=>vm.runInContext(script,context),flush=()=>{while(frames.length)frames.shift()();};
const before=JSON.stringify(scene);

run("scheduleSceneViewportFit();scheduleSceneViewportFit()");
assert.equal(frames.length,1,"panel changes and ResizeObserver share one pending frame");
flush();
const wide=run("sceneZoom");
assert.ok(wide*820/100<=wrap.clientWidth-40);
assert.ok(wide*615/100<=wrap.clientHeight-40,"the new toolbar has its own column, so only board padding is reserved");

wrap.clientWidth=540;
run("scheduleSceneViewportFit()");flush();
assert.equal(run("sceneZoom"),wide,"opening panels preserves the initial fit instead of changing the camera");

run("scheduleSceneViewportFit();applySceneZoom(110,{manual:true})");flush();
assert.equal(run("sceneZoom"),110,"a manual zoom wins over an already queued automatic fit");
wrap.clientWidth=900;
run("scheduleSceneViewportFit();applySceneZoom()");flush();
assert.equal(run("sceneZoom"),110,"renders, panel changes and desktop resizes preserve manual zoom");
assert.equal(saved.at(-1).mode,"manual","the local preference survives persistence");
assert.equal(attributes.has("aria-pressed"),false,"Fit is a one-shot command, not a toggle");

run("fitSceneZoom()");
assert.equal(run("sceneZoomMode"),"manual","the explicit fit control fixes the resulting zoom");
assert.equal(attributes.has("aria-pressed"),false);
const visibleZoom=run("sceneZoom");
wrap.clientWidth=0;wrap.clientHeight=0;
run("scheduleSceneViewportFit()");flush();
assert.equal(run("sceneZoom"),visibleZoom,"hidden workspaces cannot overwrite a useful zoom");

wrap.clientWidth=1260;wrap.clientHeight=650;
run("scheduleSceneViewportFit();store.mode='rules'");flush();
assert.equal(run("sceneZoom"),visibleZoom,"navigation cancels a queued viewport update");
assert.equal(JSON.stringify(scene),before,"camera changes never alter actions, actors or targets");
console.log("Scene viewport preserves manual zoom and coalesces automatic fitting without game mutations");
