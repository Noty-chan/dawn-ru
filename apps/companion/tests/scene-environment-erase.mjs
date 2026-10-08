import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../scene-effects.js',import.meta.url),'utf8');
let role='gm',submitted=[],local=[];
const scene={rulesEdition:'lionwing',activeSpace:'main',actors:[{id:'hero',x:2,y:2,hp:14,ap:3}],objects:[{id:'old',space:'main',cells:['2,2'],label:'Old'},{id:'new',space:'main',cells:['2,2'],label:'New'}],markers:[{id:'mark',space:'main',x:2,y:2,label:'Mark'}],walls:[{id:'wall',space:'main',a:'2,2',b:'3,2',label:'Wall'}]};
const context=vm.createContext({Scene:scene,activeSceneView:()=>role,sceneHasLocalPendingSelection:()=>false,isEnglishPreview:()=>false,toast:()=>{},commitLionwingDestroy:(target)=>{submitted.push(target);return true;},commitScene:(label,fn)=>{local.push(label);fn(scene);return true;}});
vm.runInContext(src.slice(src.indexOf('function sceneEnvironmentTarget('),src.indexOf('function previewSceneEnvironmentErase(')),context);
const run=code=>vm.runInContext(code,context),actors=JSON.stringify(scene.actors);
run('eraseSceneEnvironment({x:2,y:2})');assert.equal(submitted[0].backing.id,'new','overlap chooses the topmost area, never the token');
run('eraseSceneEnvironment({x:2,y:2,markerId:"mark"})');assert.equal(submitted[1].backing.type,'marker');
run('eraseSceneEnvironment({x:2,y:2,wallId:"wall"})');assert.equal(submitted[2].backing.type,'wall');
assert.ok(submitted.every(item=>item.kind==='backing'),'no actor deletion reaches writer');
role='player';assert.equal(run('eraseSceneEnvironment({x:2,y:2})'),false);assert.equal(submitted.length,3);role='gm';
for(const key of ['pendingAction','pendingPrompt','pendingActionPlan']){scene[key]={id:'active'};assert.equal(run('eraseSceneEnvironment({x:2,y:2})'),false);delete scene[key];}
assert.equal(submitted.length,3);assert.equal(run('eraseSceneEnvironment({x:6,y:6})'),false);
scene.rulesEdition='ru-v0.9';run('eraseSceneEnvironment({x:2,y:2})');assert.equal(scene.objects.length,1);assert.equal(scene.objects[0].id,'old');assert.equal(JSON.stringify(scene.actors),actors);
console.log('Environment eraser: objects only, explicit wall/marker, deterministic overlap, permissions and pending workflow protection');
