import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const nodes = new Map();
class Element {
  constructor(tag) { this.tag = tag; this.innerHTML = ''; this.hidden = false; this.children = []; this.events = {}; }
  append(node) { this.children.push(node); nodes.set(node.id, node); }
  setAttribute() {}
  addEventListener(type, handler) { this.events[type] = handler; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  contains() { return true; }
}
const host = new Element('section');
nodes.set('scene-workbench', host);
const calls = [];
const context = vm.createContext({window:{},document:{getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag)}});
vm.runInContext(fs.readFileSync(new URL('../scene-manual-workspace.js',import.meta.url),'utf8'), context);
const ui = context.window.DAWN_MANUAL_WORKSPACE;
const scene = {tablePolicy:{mode:'manual',processStatuses:false},manualTable:{actorId:'npc',round:3},activeSpace:'main',selectedActor:'hero',actors:[
  {id:'hero',name:'Игрок <img>',space:'main',hp:7,maxHp:10,ap:99,effects:[{id:'snare',name:'Пойман'}]},
  {id:'npc',name:'NPC',kind:'enemy',profileId:'npc-test',space:'main',hp:15,maxHp:20},
  {id:'secret',name:'Hidden NPC',space:'main'},
  {id:'other',name:'Other space',space:'other'},
]};
let narrator = true, control = true;
const options = {scene,canNarrate:()=>narrator,canControl:actor=>control&&actor.id==='hero',canRead:actor=>actor.id!=='secret',
  scopeId:'room-one',
  commit:(label,events)=>calls.push({label,events}),
  readAbilities:()=>[{id:'stance',name:'Стойка',text:'Первый абзац.\nВторой абзац. <script>',toggle:true,area:true,hint:'Только подсказка'}],
  statuses:actor=>actor.effects||[],
  selectActor:actor=>{scene.selectedActor=actor.id; calls.push({selected:actor.id});},
  openSheet:actor=>calls.push({sheet:actor.id}),roll:args=>calls.push({roll:args}),openClocks:actor=>calls.push({clock:actor?.id}),
  showArea:(actor,ability)=>calls.push({area:ability.id,actor:actor.id}),toggleTechnique:(actor,ability,on)=>calls.push({toggle:ability.id,on}),
};
const snapshot = JSON.stringify(scene);
let state = ui.render(options);
assert.equal(state.manual,true);
assert.equal(state.current.id,'npc');
assert.equal(state.selected.id,'hero');
assert.equal(state.round,3);
assert.deepEqual(Array.from(state.actors,actor=>actor.id),['hero','npc'],'hidden and other-space actors stay out of the manual roster');
assert.equal(JSON.stringify(scene),snapshot,'render/read model never change the Scene');
assert.equal(host.children.length,3,'adapter mounts exactly one footer, initiative and reader');
ui.render(options);
assert.equal(host.children.length,3,'ordinary render never duplicates controls or the board');
assert.ok(!nodes.get('scene-manual-footer').innerHTML.includes('99'),'no AP counter is rendered');
assert.ok(nodes.get('scene-manual-footer').innerHTML.includes('Игрок &lt;img&gt;'),'actor labels are escaped');
assert.equal(ui.act('read'),true);
const reader = nodes.get('scene-manual-reader');
assert.equal(reader.hidden,false);
assert.ok(reader.innerHTML.includes('Первый абзац.\nВторой абзац. &lt;script&gt;'),'complete multiline ability text is escaped and available for reading');
assert.ok(reader.innerHTML.includes('Пойман'),'statuses have visible labels while processing is off');
assert.ok(!reader.innerHTML.includes('Только подсказка'),'optional calculations/hints are off by default');
assert.equal(calls.length,0,'reading produces no host command');
assert.equal(ui.act('show-area',0),true);
assert.equal(ui.act('technique-toggle',0),true);
assert.equal(ui.act('dice'),true);
assert.equal(ui.act('clocks'),true);
assert.equal(ui.act('sheet'),true);
assert.equal(calls.filter(call=>call.events).length,0,'area preview, personal technique marks, rolls, clocks and sheet do not submit table mutations');
assert.equal(JSON.stringify(scene),snapshot,'local tools never pay resources or change the manual pointer');
assert.ok(reader.innerHTML.includes('aria-pressed="false"'),'shared mark waits for canonical confirmation');
const abilityKey=options.readAbilities(scene.actors[0])[0].id;
scene.actors[0].manualTechniqueState={[abilityKey]:true};
ui.render(options);
assert.ok(reader.innerHTML.includes('aria-pressed="true"'),'confirmed shared mark survives scene repaint');
delete scene.actors[0].manualTechniqueState;
options.statusHints=true; ui.render(options);
assert.ok(reader.innerHTML.includes('Только подсказка'),'explicit hints option reveals read-only helper text');
assert.equal(calls.filter(call=>call.events).length,0);

// Drive the actual delegated input handler instead of duplicating its validation.
nodes.get('scene-manual-footer').events.change({target:{matches:()=>true,value:'0'}});
assert.equal(calls.at(-1).events[0].payload.kind,'resource');
assert.equal(calls.at(-1).events[0].actorId,'hero');
assert.equal(calls.at(-1).events[0].payload.values.hp,0,'explicit HP zero is sent without inferred KO or damage');
for (const invalid of ['', '11', '-1', '1.5', 'NaN']) assert.equal(ui.act('hp',invalid),false);
assert.equal(calls.filter(call=>call.events).length,1,'invalid exact resources are rejected');
ui.act('point'); ui.act('round');
assert.equal(calls.at(-2).events[0].payload.actorId,'hero');
assert.equal(calls.at(-2).events[0].payload.kind,'pointer');
assert.equal(calls.at(-1).events[0].payload.kind,'round');
assert.equal(calls.at(-1).events[0].payload.delta,1);
assert.equal(JSON.stringify(scene),snapshot,'shared changes are requested through host commit, never applied locally');

const count = calls.length;
narrator=false; control=false;
for (const action of ['point','round','hp','technique-toggle']) assert.equal(ui.act(action,0),false,'permissions are rechecked while the old UI remains open');
assert.equal(calls.length,count);
ui.act('select','npc');
assert.equal(scene.manualTable.actorId,'npc','local selection never changes the shared pointer');
assert.equal(scene.selectedActor,'npc');
assert.ok(reader.innerHTML.includes('data-manual-ability="0" open'),'an individually opened NPC shows all rules immediately');
ui.render(options);
assert.ok(!reader.innerHTML.includes('data-manual-ability="0" open'),'user collapse is respected on repaint (DOM fixture has no open details)');
ui.act('close-reader');ui.open('npc');
assert.ok(reader.innerHTML.includes('data-manual-ability="0" open'),'reopening NPC description expands its rules again');
assert.equal(ui.act('select','secret'),false);
scene.tablePolicy.mode='rules';
for (const action of ['read','dice','clocks','sheet','show-area','point','round','hp','technique-toggle','select']) assert.equal(ui.act(action,'hero'),false,'stale manual controls stop immediately in rules mode');
ui.render(options);
for(const id of ['scene-manual-footer','scene-manual-initiative','scene-manual-reader']) assert.equal(nodes.get(id).hidden,true);
assert.equal(ui.model({scene:{actors:[]}}).manual,false,'old scene without tablePolicy remains a rules scene');
scene.tablePolicy.mode='manual'; scene.selectedActor='hero'; control=true;
options.scopeId='room-two'; ui.render(options); ui.act('read');
assert.ok(!reader.innerHTML.includes('aria-pressed="true"'),'new room clears personal technique marks for reused actor IDs');
console.log('Manual workspace actual adapter: read-only render, complete text, private selection, explicit command payloads, validation and live permission/policy guards passed. Browser geometry is not covered by this harness.');

// Structural integration checks are separate from actual adapter tests above.
const markup=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=Array.from(markup.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g),match=>match[1]);
assert.equal(scripts[scripts.indexOf('lionwing-engine.js')+1],'scene-table-policy.js','policy is available immediately after the LionWing engine');
assert.equal(scripts[scripts.indexOf('scene-token-hud.js')+1],'scene-manual-workspace.js','manual adapter follows the token HUD');
assert.ok(scripts.indexOf('scene-manual-workspace.js')<scripts.indexOf('app.js'),'manual adapter exists before application startup');
assert.ok(markup.includes('href="scene-manual-workspace.css?v=__BUILD_VERSION__"'),'manual stylesheet is loaded by the shell');
const modeSelect=markup.match(/<select id="scene-control-mode"[^>]*>([\s\S]*?)<\/select>/)[1];
assert.deepEqual(Array.from(modeSelect.matchAll(/value="([^"]+)"/g),match=>match[1]),['manual','rules'],'the sole mode selector exposes the shared policies');
const swContext=vm.createContext({self:{addEventListener(){}},URL});
vm.runInContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8')+'\nglobalThis.testAssets=ASSETS;',swContext);
for(const file of ['scene-table-policy.js','scene-manual-workspace.js','scene-manual-workspace.css']) {
  assert.ok(swContext.testAssets.some(value=>value.startsWith(`./${file}?v=`)),`${file} is versioned in the offline cache`);
  assert.ok(fs.existsSync(new URL(`../${file}`,import.meta.url)),`${file} exists on disk`);
}
const localeContext=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(new URL('../localization.js',import.meta.url),'utf8'),localeContext);
vm.runInContext(fs.readFileSync(new URL('../scene-manual-workspace.js',import.meta.url),'utf8'),localeContext);
assert.equal(localeContext.window.DAWN_I18N.t('scene.manual.rules',{}, {locale:'ru'}),'По правилам');
assert.equal(localeContext.window.DAWN_I18N.t('scene.manual.rules',{}, {locale:'en'}),'With rules');
console.log('Manual workspace shell: script order, policy options, RU/EN labels and versioned offline assets passed (structural checks; browser layout remains separate).');

scene.tablePolicy.mode='manual';scene.actors.push({id:'vanished',name:'Known enemy',space:'main',hidden:true,manualInitiativeVisible:true,tokenImage:'private-image',hp:99});
const privacy=ui.render({...options,canNarrate:false,canRead:actor=>!actor.hidden&&actor.id!=='secret'});
const card=privacy.initiativeActors.find(actor=>actor.id==='vanished');assert.equal(card.initiativeOnly,true);assert.equal(card.tokenImage,undefined);assert.equal(card.hp,undefined);
assert.ok(!nodes.get('scene-manual-initiative').innerHTML.includes('private-image'));
scene.actors.at(-1).manualInitiativeVisible=false;assert.ok(!ui.render(options).initiativeActors.some(actor=>actor.id==='vanished'));
