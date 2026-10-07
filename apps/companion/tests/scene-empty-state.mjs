import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../scene-ui.js',import.meta.url),'utf8');
const fragment=source.slice(source.indexOf('  const presentParticipants='),source.indexOf('\n  board.innerHTML=',source.indexOf('  const presentParticipants=')));
const participant={id:'npc',space:'field',effects:['positive.исчез']};
function note(overrides={}){
  const context={isEnglishPreview:()=>false,Scene:{actors:[participant],tool:'select'},space:{id:'field'},actors:[],placementPrompt:false,planAppearance:false,pendingZealotPlan:false,sceneActorEffects:actor=>actor.effects||[],activeSceneView:()=> 'gm',...overrides};
  return vm.runInNewContext(fragment+'\nempty',context);
}
assert.match(note(),/Участники вне поля/);
assert.match(note(),/начните Ход и выберите клетку появления/);
assert.match(note(),/data-open-scene-panel="director"/);
assert.doesNotMatch(note({Scene:{actors:[{...participant,effects:[]}],tool:'select'}}),/начните Ход/,'other off-field participants do not receive reappearance instructions');
assert.match(note({Scene:{actors:[],tool:'select'}}),/data-open-scene-panel="add"/);
assert.equal(note({placementPrompt:true}),'','cell selection must remain unobstructed');
assert.equal(note({planAppearance:true}),'','action-plan reappearance must remain unobstructed');
assert.equal(note({actors:[participant]}),'','visible participants suppress the note');
assert.match(note({Scene:{actors:[{...participant,space:'other'}],tool:'select'}}),/Сцена ждёт героев/,'another space does not suppress the actual empty scene');
assert.doesNotMatch(note({activeSceneView:()=> 'player'}),/data-open-scene-panel/,'read-only players do not receive narrator actions');
console.log('Off-field participant explanation and placement suppression passed');

assert.match(note({isEnglishPreview:()=>true}),/Participants off the field/);
assert.match(note({isEnglishPreview:()=>true}),/start the Turn and choose an arrival space/);
assert.match(note({isEnglishPreview:()=>true,Scene:{actors:[],tool:'select'}}),/Add participant/);
assert.doesNotMatch(note({isEnglishPreview:()=>true,activeSceneView:()=> 'player'}),/data-open-scene-panel/);
