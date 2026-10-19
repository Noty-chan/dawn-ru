import assert from 'node:assert/strict';
import {sceneAdminHarness} from './helpers/scene-admin-harness.mjs';

function importFile(h,name,{defer=false}={}){
 const file={size:100,text:()=>defer?new Promise((resolve,reject)=>{file.resolve=()=>resolve(h.snapshot(name));file.reject=reject;}):Promise.resolve(h.snapshot(name))};
 h.node('scene-import-table').files=[file];h.node('scene-import-table').value=`${name}.json`;
 return{file,job:h.node('scene-import-table').onchange({target:h.node('scene-import-table')})};
}
const savedKey='dawn-ru-companion-table-recovery-v1',metaKey='dawn-ru-companion-table-recovery-meta-v1';
let cases=0;
{
 const h=sceneAdminHarness();h.context.Scene.name='Original scene';const {job}=importFile(h,'Chosen backup');await h.tick();assert.equal(h.state.writes.length,1);h.state.writes[0].resolve();await job;
 assert.equal(h.context.Scene.name,'Chosen backup');assert.equal(h.state.queued[0].room,'room-a');assert.equal(h.context.Scene.undo[0].state.name,'Original scene');assert.equal(JSON.parse(h.state.indexed.get(savedKey)).scene.name,'Original scene');assert.equal(h.node('scene-import-table').value,'');cases++;
}
const changes={
 room:h=>{h.context.resetClientTableRuntime();h.state.sync.sceneId='room-b';h.context.Scene.name='Room B';},
 roomRoundtrip:h=>{h.context.resetClientTableRuntime();h.state.sync.sceneId='room-b';h.context.resetClientTableRuntime();h.state.sync.sceneId='room-a';},
 roleRoundtrip:h=>{h.state.sync.canNarrate=false;h.state.sync.role='player';h.callbacks.status();h.state.sync.canNarrate=true;h.state.sync.role='owner';h.callbacks.status();},
 policy:h=>{h.context.Scene.tablePolicy.epoch++;},
 hp:h=>{const prepared=h.core.prepare(h.context.Scene,{actorId:'enemy',kind:'correct',resource:'hp',amount:25});assert.equal(prepared.ok,true);h.context.Scene=h.context.normalizeScene(h.engine.dispatchMany(h.context.Scene,prepared.events).scene);},
 sameVersionValue:h=>{h.context.Scene.targetIds=['enemy'];},
 identicalHistory:h=>{const step={id:'same-ids',label:'Restored identities',state:h.context.sceneSnapshot()};h.context.Scene.undo=[step];assert.ok(h.context.restoreSceneHistory(step,h.context.Scene.undo,[],'Undo'));h.state.queued=[];},
};
for(const [name,change]of Object.entries(changes))for(const stage of ['file','recovery']){
 const h=sceneAdminHarness(),{file,job}=importFile(h,'Old chosen backup',{defer:stage==='file'});if(stage==='recovery'){await h.tick();assert.equal(h.state.writes.length,1);}
 change(h);const before=h.clone(h.context.Scene);h.node('scene-import-table').value='newer-file.json';
 if(stage==='file'){file.resolve();await h.tick();assert.equal(h.state.writes.length,0,`${name}: an obsolete file read must not start a recovery write`);}else h.state.writes[0].resolve();await job;
 assert.deepEqual(h.clone(h.context.Scene),before,`${name}/${stage}: an obsolete import cannot replace the current Scene`);assert.equal(h.state.queued.length,0);assert.equal(h.node('scene-import-table').value,'newer-file.json');assert.equal(h.state.notices.length,0);if(stage==='file')assert.equal(h.state.confirmations,0);cases++;
}
{
 const h=sceneAdminHarness(),old=importFile(h,'Old import');await h.tick();const latest=importFile(h,'Latest import');await h.tick();
 // Same-store IndexedDB writes complete in transaction order. The stale job
 // cannot apply when its earlier write finishes; the later job wins once.
 h.state.writes[0].resolve();await old.job;assert.notEqual(h.context.Scene.name,'Old import');h.state.writes[1].resolve();await latest.job;assert.equal(h.context.Scene.name,'Latest import');assert.equal(h.state.queued.length,1);cases++;
}
for(const [name,change]of Object.entries(changes)){
 const h=sceneAdminHarness();h.state.indexed.set(savedKey,h.snapshot('Recovery backup'));h.state.readGate={};const job=h.node('scene-restore-recovery').onclick();change(h);const before=h.clone(h.context.Scene);h.state.readGate.resolve();await job;
 assert.deepEqual(h.clone(h.context.Scene),before,`${name}: a late recovery read cannot restore an obsolete context`);assert.equal(h.state.queued.length,0);assert.equal(h.state.confirmations,0);cases++;
}
{
 const h=sceneAdminHarness();h.state.indexed.set(savedKey,h.snapshot('Good recovery'));h.state.failLocal=true;const {job}=importFile(h,'Failed import');await h.tick();h.state.writes[0].reject(new Error('IndexedDB unavailable'));await job;
 assert.notEqual(h.context.Scene.name,'Failed import');assert.equal(h.node('scene-import-table').value,'Failed import.json');assert.equal(h.state.queued.length,0);assert.equal(JSON.parse(await h.context.readTableRecovery()).scene.name,'Good recovery');cases++;
}
async function checkpoint(h,name,label,{fallback=false}={}){
 h.context.Scene.name=name;const before=h.state.writes.length,job=h.context.saveTableRecovery(label);await h.tick();if(fallback)h.state.writes[before].reject(new Error('IndexedDB unavailable'));else h.state.writes[before].resolve();assert.equal(await job,true);
}
for(const tie of [false,true]){
 const h=sceneAdminHarness();await checkpoint(h,'IndexedDB old','Same label');if(!tie)h.state.now++;await checkpoint(h,'Local newer','Same label',{fallback:true});
 assert.equal(JSON.parse(await h.context.readTableRecovery()).scene.name,'Local newer','A successful newer fallback wins over an older valid IndexedDB point, including a same-ms tie');assert.equal(JSON.parse(h.state.local.get(metaKey)).storage,'localStorage');
 if(!tie)h.state.now++;await checkpoint(h,'IndexedDB newest','Same label');assert.equal(JSON.parse(await h.context.readTableRecovery()).scene.name,'IndexedDB newest');assert.equal(JSON.parse(h.state.local.get(metaKey)).storage,'indexedDB');cases+=2;
}
{
 const h=sceneAdminHarness();await checkpoint(h,'Valid checkpoint','Good');h.state.local.set(savedKey,JSON.stringify({format:'dawn-ru-table-backup',schema:999,exportedAt:'2099-01-01T00:00:00.000Z',scene:{actors:[],spaces:[]}}));
 assert.equal(JSON.parse(await h.context.readTableRecovery()).scene.name,'Valid checkpoint','A corrupt newer envelope cannot hide the prior good checkpoint');
 h.state.local.set(savedKey,JSON.stringify({...h.context.sceneSnapshot(),name:'Legacy claimed future',exportedAt:'2099-01-01T00:00:00.000Z'}));assert.equal(JSON.parse(await h.context.readTableRecovery()).scene.name,'Valid checkpoint','An arbitrary legacy accepted shape does not gain priority from an untrusted export timestamp');cases+=2;
}
console.log(`Scene backup async: ${cases} production import/recovery/writer/lifecycle cases preserve room/authority/version/value, latest action, failed recovery and complete inputs; real save/read callbacks choose newest valid point with deterministic backend ties. DOM/storage/transport mocked.`);
