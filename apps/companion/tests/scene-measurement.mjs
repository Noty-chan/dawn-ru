import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const effects=read('scene-effects.js'),ui=read('scene-ui.js');
let role='gm',english=false,cancels=0,persists=0;
const scene={tool:'target',pendingActionPlan:{id:'prepared'},targetIds:['foe'],targetCells:['2,2'],hp:12,ap:2};
const context=vm.createContext({Scene:scene,activeSceneView:()=>role,isEnglishPreview:()=>english,renderScene:()=>{},persist:()=>persists++,cancelSceneFlow:()=>cancels++,measurementPath:(a,b)=>[`${a.x},${a.y}`,`${b.x},${b.y}`],toast:()=>{}});
vm.runInContext('let playerSceneTool="select",sceneNeutralTool=null,sceneMeasureEnd=null,sceneMeasureStart=null,sceneMeasureCells=new Set(),sceneMeasureLabel="",scenePreviewCells=new Set(["3,3"]),sceneTopologyCells=new Set();let pendingCoreAction="attack",pendingCoreReaction=null,pendingTechniqueRule=null,pendingEnemyRule=null,pendingEnemyStepActorId=null,pendingZealotPlan=null;',context);
vm.runInContext(ui.slice(ui.indexOf('function activeSceneTool('),ui.indexOf(String.fromCharCode(10),ui.indexOf('function activeSceneTool('))),context);
vm.runInContext(effects.slice(effects.indexOf('function clearSceneMeasurement('),effects.indexOf('function cancelCommittedAction(')),context);
const run=code=>vm.runInContext(code,context),before=JSON.stringify(scene);
for(const current of ['gm','player']){
 role=current;run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:3,y:2})');
 assert.equal(run('sceneMeasureLabel'),'5 кл.');assert.equal(run('activeSceneTool()'),'measure');
 run('updateSceneMeasurement({x:1,y:1})');assert.equal(run('sceneMeasureLabel'),'2 кл.');
 run('updateSceneMeasurement({x:0,y:0},{complete:true})');assert.equal(run('sceneMeasureLabel'),'0 кл.');assert.equal(run('sceneMeasureStart'),null);
 run('clearSceneMeasurement()');assert.equal(run('activeSceneTool()'),current==='gm'?'target':'select');
 assert.equal(JSON.stringify(scene),before);assert.equal(run('scenePreviewCells.has("3,3")'),true);
}
english=true;run('changeSceneTool("measure");updateSceneMeasurement({x:0,y:0});updateSceneMeasurement({x:3,y:2},{complete:true})');assert.equal(run('sceneMeasureLabel'),'5 spaces');
assert.equal(cancels,0);assert.equal(persists,0,'neutral input makes no storage/Scene writes');
const events=read('app-scene-events.js');assert.ok(events.indexOf('if(sceneTool==="measure")')<events.indexOf('const actionModifier='),'measurement owns clicks before rule workflows');
assert.ok(events.includes('if(typeof sceneNeutralTool!=="undefined"&&sceneNeutralTool){clearSceneMeasurement();renderScene();event.preventDefault();return;}'),'Escape leaves prepared action alone');
console.log('Local ruler: GM/Player isolation, Manhattan distance, live/final/zero output, prepared action preservation, no writes');
