import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../scene-ui.js',import.meta.url),'utf8');
const start=source.indexOf('function renderSceneTurnStrip(){');
const end=source.indexOf('function appendMarkerClockControls()',start);
const root={innerHTML:'',scrollTop:84};
let role='gm';
const actor=(id,extra={})=>({id,name:id,team:'hero',kind:'hero',ap:3,hp:12,maxHp:17,tokenColor:'#345',...extra});
const scene={activeActorId:'current',selectedActor:'done',targetIds:['waiting'],version:7,actors:[
  actor('current'),actor('done',{acted:true}),actor('waiting'),actor('down',{knockedOut:true}),
  actor('hidden',{hidden:true}),actor('crowd',{kind:'crowd'}),actor('modifier',{modifier:true}),
]};
const context=vm.createContext({Scene:scene,$:()=>root,activeSceneView:()=>role,
  esc:value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),
  SceneEngine:{isEnemyModifier:actor=>actor.modifier,compoundEnemyStatus:()=>({active:false})},
});
vm.runInContext(source.slice(start,end),context);
const before=JSON.stringify(scene);
context.renderSceneTurnStrip();
const button=id=>root.innerHTML.match(new RegExp(`<button[^>]*data-scene-turn-actor="${id}"[\\s\\S]*?<\\/button>`))?.[0];
assert.match(button('current'),/aria-current="step"/,'current turn is distinct from selection');
assert.match(button('current'),/aria-pressed="false"/);
assert.match(button('current'),/scene-turn-state[^>]*>▶/);
assert.match(button('done'),/aria-pressed="true"/,'inspected token stays selected independently');
assert.doesNotMatch(button('done'),/aria-current/);
assert.match(button('done'),/scene-turn-state[^>]*>✓/,'completed turn has a non-color marker');
assert.match(button('done'),/aria-label="done · Ход завершён · 12\/17 ЗД/);
assert.doesNotMatch(button('waiting'),/scene-turn-state/,'unstarted turn has no completed marker');
assert.match(button('down'),/disabled/);
assert.match(button('down'),/scene-turn-state[^>]*>−/);
assert.ok(button('hidden'),'GM can see a hidden participant');
assert.equal(button('crowd'),undefined);
assert.equal(button('modifier'),undefined);
assert.equal(root.scrollTop,84,'resource redraw preserves roster scroll position');
role='player';context.renderSceneTurnStrip();
assert.equal(button('hidden'),undefined,'player roster never exposes hidden actors');
assert.equal(JSON.stringify(scene),before,'presentation does not assign turns, targets or spend resources');
scene.activeActorId='done';context.renderSceneTurnStrip();
assert.match(button('done'),/scene-turn-state[^>]*>▶/,'current repeated turn takes precedence over acted history');
scene.actors=[actor('A" <B>')];context.renderSceneTurnStrip();
assert.match(root.innerHTML,/aria-label="A&quot; &lt;B>/,'collapsed portraits retain safe accessible names');
scene.actors=[];context.renderSceneTurnStrip();
assert.match(root.innerHTML,/class="autosave"/,'empty roster has no inert portrait buttons');
console.log('Portrait turn roster: active/selected/completed distinction, visibility, scroll and read-only rendering passed');
