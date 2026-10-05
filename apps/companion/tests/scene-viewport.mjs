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
  ["scene-zoom-fit",{classList:{toggle(){}},setAttribute:(key,value)=>attributes.set(key,value)}],
]);
const context={Scene:scene,store:{mode:"play"},$ :id=>elements.get(id),
  clamp:(value,min,max)=>Math.max(min,Math.min(max,Number(value))),
  activeSceneSpace:()=>space,usingNextSceneInterface:()=>true,
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
assert.ok(wide*615/100<=wrap.clientHeight-110,"field tools and board shadow retain their own space");

wrap.clientWidth=540;
run("scheduleSceneViewportFit()");flush();
assert.ok(run("sceneZoom")<wide,"opening both panels shrinks a fitted board");
assert.ok(run("sceneZoom")*820/100<=wrap.clientWidth-40);

run("scheduleSceneViewportFit();applySceneZoom(110,{manual:true})");flush();
assert.equal(run("sceneZoom"),110,"a manual zoom wins over an already queued automatic fit");
wrap.clientWidth=900;
run("scheduleSceneViewportFit();applySceneZoom()");flush();
assert.equal(run("sceneZoom"),110,"renders, panel changes and desktop resizes preserve manual zoom");
assert.equal(saved.at(-1).mode,"manual","the local preference survives persistence");
assert.equal(attributes.get("aria-pressed"),"false");

run("fitSceneZoom()");
assert.equal(run("sceneZoomMode"),"fit","the explicit fit control resumes automatic fitting");
assert.equal(attributes.get("aria-pressed"),"true");
const visibleZoom=run("sceneZoom");
wrap.clientWidth=0;wrap.clientHeight=0;
run("scheduleSceneViewportFit()");flush();
assert.equal(run("sceneZoom"),visibleZoom,"hidden workspaces cannot overwrite a useful zoom");

wrap.clientWidth=1260;wrap.clientHeight=650;
run("scheduleSceneViewportFit();store.mode='rules'");flush();
assert.equal(run("sceneZoom"),visibleZoom,"navigation cancels a queued viewport update");
assert.equal(JSON.stringify(scene),before,"camera changes never alter actions, actors or targets");
console.log("Scene viewport preserves manual zoom and coalesces automatic fitting without game mutations");
