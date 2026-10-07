import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../app-play-events.js',import.meta.url),'utf8');
let role='gm',allowConfirm=true,shown=0,handler,options;
const calls=[],round={disabled:false,click:()=>calls.push('round')},scene={disabled:false,click:()=>calls.push('scene')};
const context=vm.createContext({Scene:{results:null},activeSceneView:()=>role,isEnglishPreview:()=>false,usingNextSceneInterface:()=>true,
 showSceneResults:()=>shown++,window:{confirm:()=>allowConfirm},document:{querySelector:()=>null},
 $:id=>id==='new-round'?round:id==='new-scene'?scene:{addEventListener:(name,fn,opts)=>{assert.equal(name,'wheel');handler=fn;options=opts;}}});
const a=src.indexOf('function handleSceneSessionAction('),b=src.indexOf('$("scene-action-tray").addEventListener("click"',a);
vm.runInContext(src.slice(a,b),context);
const run=code=>vm.runInContext(code,context);
run('handleSceneSessionAction("round")');assert.deepEqual(calls,['round']);
round.disabled=true;run('handleSceneSessionAction("round")');assert.equal(calls.length,1);round.disabled=false;
allowConfirm=false;run('handleSceneSessionAction("scene")');assert.equal(calls.length,1);allowConfirm=true;
role='player';for(const action of ['round','scene','results','unknown']){context.nextAction=action;run('handleSceneSessionAction(nextAction)');}assert.equal(calls.length,1,'stale visible GM commands never elevate Player authority');
context.Scene.results={id:'done'};run('handleSceneSessionAction("results")');assert.equal(shown,1,'Players can view existing results');
role='gm';run('handleSceneSessionAction("scene")');assert.deepEqual(calls,['round','scene']);
assert.equal(options.passive,false);
const area={scrollWidth:600,clientWidth:200,scrollLeft:0};let prevented=0;
handler({target:{closest:()=>area},deltaX:0,deltaY:150,preventDefault:()=>prevented++});assert.equal(area.scrollLeft,150);assert.equal(prevented,1);
handler({target:{closest:()=>area},deltaX:-70,deltaY:4,preventDefault:()=>prevented++});assert.equal(area.scrollLeft,80);
handler({target:{closest:()=>area},deltaY:100,ctrlKey:true,preventDefault:()=>prevented++});assert.equal(area.scrollLeft,80,'camera modifier input is not stolen');
area.scrollWidth=100;handler({target:{closest:()=>area},deltaY:100,preventDefault:()=>prevented++});assert.equal(area.scrollLeft,80,'non-overflowing actions do not trap wheel input');
console.log('Action tray: GM authority/disabled/confirmation guards, results access, vertical/trackpad scroll and camera modifiers');
