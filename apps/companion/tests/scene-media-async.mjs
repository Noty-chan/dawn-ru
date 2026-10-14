import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {runtime,fixture,clone} from './helpers/scene-contract-harness.mjs';

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8').replaceAll('\r\n','\n');
const events=(process.env.DAWN_MEDIA_BASELINE_REF?execFileSync('git',['show',`${process.env.DAWN_MEDIA_BASELINE_REF}:apps/companion/app-scene-events.js`],{encoding:'utf8'}):read('app-scene-events.js')).replaceAll('\r\n','\n');
const app=read('app-core.js'),ui=read('scene-ui.js'),{context,engine,core}=runtime();
let serial=0,sync,view,images,storage,queued,notices,refuse=false;
const handlers={},nodes=new Map();
function node(id){if(!nodes.has(id))nodes.set(id,{value:'',files:[],dataset:{},addEventListener(type,handler){(handlers[`${id}:${type}`]??=[]).push(handler);}});return nodes.get(id);}
Object.assign(context,{$:node,structuredClone,SceneEngine:engine,APP_SCHEMA:14,contentPreferences:{edition:'lionwing'},uid:()=>`media-${++serial}`,
 cleanArray:value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[],clamp:(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0)),
 Sync:{state:()=>sync},activeSceneView:()=>view,store:{mode:'play'},toast:message=>{notices.push(message);return null;},
 queueNetworkV2Snapshot:(scene,label)=>{if(refuse)throw new Error('Queue unavailable');queued.push({room:sync.sceneId,label,scene});return true;},
 assertNetworkSceneFits(){},syncHeroFromScene(){},persist(){},renderPlay(){},renderScene(){},sceneArtworkKey:id=>`scene:art:${id}`,
 writeHeroMedia:entries=>new Promise((resolve,reject)=>storage.push({entries,resolve,reject})),heroMediaStorageReady:false,manualTableDraftGeneration:0,
});
vm.runInContext(app.slice(app.indexOf('function blankScene()'),app.indexOf('function addEnemyDeploymentPassives')),context);
vm.runInContext(app.slice(app.indexOf('function validateTableEdit('),app.indexOf('const TABLE_BACKUP_FORMAT')),context);
vm.runInContext(ui.split('\n').filter(line=>/^function (sceneSnapshot|sceneEvent|sceneMediaSize)\(/.test(line)).join('\n'),context);
vm.runInContext(ui.slice(ui.indexOf('function commitScene('),ui.indexOf('function lionwingDestroyDescription')),context);
// Decode and persistence timing are controlled; callbacks, snapshot validation,
// normalization, history and the final canonical writer run unchanged.
context.imageFromFile=file=>new Promise((resolve,reject)=>images.push({file,resolve,reject}));context.tokenImageFromFile=context.imageFromFile;
const helperStart=events.indexOf('const sceneMediaEdits=');if(helperStart>=0)vm.runInContext(events.slice(helperStart,events.indexOf('function refreshSceneShortcutQuote(')),context);
vm.runInContext(ui.split('\n').find(line=>line.startsWith('function activeSceneView(')),context);
const callbacks={},syncSource=read('app-sync-events.js');context.Sync.on=(name,callback)=>callbacks[name]=callback;
Object.assign(context,{resetNetworkV2Runtime(){},renderSync(){},renderToolsWorkspace(){},renderChallengeRequestDock(){},resetToolsRollResult(){},reconcileSceneResultsDialog(){},
 currentChallengeRequest:()=>null,currentOpposedParticipant:()=>null,queueAutomaticCommands(){},clearSceneMeasurement(){},setScenePanel(){},
 NetworkV2:{resetLocalUiForSceneSwitch:scene=>scene},mergeNetworkV2Scene:remote=>remote,hydratePlayerScene:scene=>context.normalizeScene(scene),
});
vm.runInContext('let pendingSceneCommands=[],pendingCommandSceneId="room-a",lastInviteToken="";const automaticCommandAttempts=new Map(),automaticCommandRetries=new Map(),delayedAutomaticCommands=new Set();',context);
vm.runInContext(syncSource.slice(syncSource.indexOf('function resetClientTableRuntime('),syncSource.indexOf('function renderCloudLibrary(')),context);
for(const name of ['status','scene'])vm.runInContext(syncSource.split('\n').find(line=>line.startsWith(`Sync?.on("${name}",`)&&(name!=='scene'||line.includes('const previousRequestId='))),context);
vm.runInContext(ui.slice(ui.indexOf('function restoreSceneHistory('),ui.indexOf('function undoScene(')),context);
vm.runInContext(events.slice(events.indexOf('function applyTableBackup('),events.indexOf('$("scene-export-table")')),context);
vm.runInContext(events.split('\n').find(line=>line.startsWith('$("scene-view").addEventListener')),context);
const tokenStart=events.indexOf('$("scene-inspector").addEventListener("change",async event=>{');
vm.runInContext(events.slice(tokenStart,events.indexOf('$("scene-inspector").addEventListener("click",event=>{const button=',tokenStart)),context);
const portraitBody=events.indexOf('const actorId=event.target.dataset.scenePortraitUpload'),portraitStart=events.lastIndexOf('$("scene-inspector").addEventListener("change",async event=>{',portraitBody);
vm.runInContext(events.slice(portraitStart,events.indexOf('$("scene-inspector").addEventListener("click",event=>{const button=',portraitBody)),context);
const artStart=events.indexOf('$("scene-art-upload").addEventListener');vm.runInContext(events.slice(artStart,events.indexOf('\n$("scene-board").addEventListener',artStart)),context);
for(const line of events.split('\n').filter(line=>line.startsWith('$("scene-inspector").addEventListener("click"')&&(line.includes('sceneClearTokenImage')||line.includes('sceneClearPortraitImage'))))vm.runInContext(line,context);
const image=text=>`data:image/png;base64,${text}`,tick=()=>new Promise(resolve=>setImmediate(resolve));
function fresh(){
 sync={sceneId:'room-a',campaignId:'campaign-a',userId:'gm',role:'owner',canNarrate:true};view='gm';context.Scene=context.normalizeScene(fixture());context.Scene.view='gm';vm.runInContext('pendingCommandSceneId="room-a";',context);
 images=[];storage=[];queued=[];notices=[];refuse=false;context.heroMediaStorageReady=false;context.manualTableDraftGeneration++;context.store.mode='play';
 node('scene-art-name').value='Original art';node('scene-art-kind').value='art';node('scene-art-upload').files=[{name:'first.png'}];node('scene-art-upload').value='first.png';
}
const art=()=>handlers['scene-art-upload:change'][0]({target:node('scene-art-upload')});
const actorInput=(kind,id='hero')=>({dataset:{[kind==='token'?'sceneTokenUpload':'scenePortraitUpload']:id},files:[{name:`${kind}.png`}],value:`${kind}.png`});
const upload=(kind,input)=>handlers['scene-inspector:change'][kind==='token'?0:1]({target:input});
function clear(kind,id='hero'){
 const attribute=kind==='token'?'data-scene-clear-token-image':'data-scene-clear-portrait-image',dataset={[kind==='token'?'sceneClearTokenImage':'sceneClearPortraitImage']:id},button={dataset};
 const target={closest:selector=>selector===`[${attribute}]`?button:null};let stopped=false;
 for(const handler of handlers['scene-inspector:click']){handler({target,stopImmediatePropagation(){stopped=true;}});if(stopped)break;}
}
function resolve(index,text='AAAA'){images[index].resolve(image(text));}
function unchanged(before,label){assert.deepEqual(clone(context.Scene),before,label);assert.equal(queued.length,0,label);}

fresh();const normal=art();resolve(0);await normal;assert.equal(context.Scene.artworks[0].name,'Original art');assert.equal(context.Scene.undo.length,1);assert.equal(queued[0].room,'room-a');assert.equal(node('scene-art-name').value,'');assert.equal(node('scene-art-upload').value,'');
fresh();const form=art();node('scene-art-name').value='New draft';node('scene-art-kind').value='background';node('scene-art-upload').value='new.png';node('scene-art-upload').files=[{name:'new.png'}];resolve(0);await form;
assert.equal(context.Scene.artworks[0].name,'Original art');assert.equal(context.Scene.artworks[0].kind,'art');assert.equal(node('scene-art-name').value,'New draft');assert.equal(node('scene-art-upload').value,'new.png');
fresh();const changedText=art();node('scene-art-name').value='New draft with same file';node('scene-art-kind').value='background';resolve(0);await changedText;assert.equal(node('scene-art-name').value,'New draft with same file');assert.equal(node('scene-art-upload').value,'first.png','Any changed field preserves the complete newer form, including its selected file');

for(const change of [
 ()=>{sync={...sync,sceneId:'room-b',campaignId:'campaign-b'};},
 ()=>{context.Scene=context.normalizeScene({...fixture(),name:'Replacement scene'});},
 ()=>{context.Scene.tablePolicy={mode:'manual',epoch:2};},
 ()=>{sync={...sync,role:'player',canNarrate:false};view='player';},
 ()=>{context.Scene.lionwing.sceneSerial=2;},
 ()=>{context.manualTableDraftGeneration++;},
 ()=>{context.store.mode='build';},
])for(const stage of ['decode','storage']){
 fresh();context.heroMediaStorageReady=stage==='storage';const job=art();if(stage==='storage'){resolve(0);await tick();assert.equal(storage.length,1);}
 change();const before=clone(context.Scene);node('scene-art-name').value='New draft';node('scene-art-upload').value='new.png';
 if(stage==='decode')resolve(0);else storage[0].resolve();await job;unchanged(before,`Art must stop after ${stage} when scope changed`);assert.equal(node('scene-art-name').value,'New draft');assert.equal(node('scene-art-upload').value,'new.png');
}

for(const kind of ['token','portrait']){
 fresh();const input=actorInput(kind),old=upload(kind,input);input.files=[{name:'new.png'}];input.value='new.png';const latest=upload(kind,input);resolve(1,'BBBB');await latest;const committed=clone(context.Scene);resolve(0,'AAAA');await old;
 assert.deepEqual(clone(context.Scene),committed,`${kind}: late old file must not overwrite latest`);assert.equal(context.Scene.actors[0][`${kind}Image`],image('BBBB'));assert.equal(context.Scene.undo.length,1);
 fresh();const clearInput=actorInput(kind),cleared=upload(kind,clearInput);clear(kind);const clearBefore=clone(context.Scene);resolve(0);await cleared;assert.deepEqual(clone(context.Scene),clearBefore,`${kind}: explicit clear wins even when the previous image was empty`);
 for(const change of [()=>context.Scene.actors.splice(0,1),()=>context.Scene.actors[0].heroId='replacement-owner',()=>context.Scene.actors[0].name='Replacement actor',()=>{sync.sceneId='other-room';},()=>{view='player';sync.canNarrate=false;}]){
  fresh();const pending=upload(kind,actorInput(kind));change();const before=clone(context.Scene);resolve(0);await pending;unchanged(before,`${kind} actor/scope replacement must cancel late completion`);
 }
 // A fresh canonical snapshot produced by an unrelated HP correction is the
 // same Scene context; identity must not depend on object reference/version.
 fresh();const valid=upload(kind,actorInput(kind)),prepared=core.prepare(context.Scene,{actorId:'enemy',kind:'correct',resource:'hp',amount:25});assert.equal(prepared.ok,true,prepared.errors?.join(' '));context.Scene=context.normalizeScene(engine.dispatchMany(context.Scene,prepared.events).scene);resolve(0);await valid;
 assert.equal(context.Scene.actors[1].hp,25);assert.equal(context.Scene.actors[0][`${kind}Image`],image('AAAA'));assert.equal(queued.length,1);
}

fresh();const newestFile=art();node('scene-art-name').value='Second art';node('scene-art-upload').files=[{name:'second.png'}];const newest=art();resolve(1,'BBBB');await newest;const newestScene=clone(context.Scene);resolve(0);await newestFile;assert.deepEqual(clone(context.Scene),newestScene);assert.equal(context.Scene.artworks.length,1);assert.equal(context.Scene.artworks[0].name,'Second art');
fresh();context.Scene.actors.forEach(actor=>{actor.kind='crowd';actor.heroId=null;actor.crowdGroupId='same-group';});context.Scene=context.normalizeScene(context.Scene);const groupOld=upload('token',actorInput('token','hero')),groupLatest=upload('token',actorInput('token','enemy'));const groupBefore=clone(context.Scene);resolve(0);await groupOld;unchanged(groupBefore,'Another group member supersedes the shared token edit before the old file resolves');resolve(1,'BBBB');await groupLatest;assert.ok(context.Scene.actors.every(actor=>actor.tokenImage===image('BBBB')));
fresh();context.heroMediaStorageReady=true;const staleStored=art();resolve(0);await tick();const secondStored=art();resolve(1,'BBBB');await tick();storage[1].resolve();await secondStored;const latestStored=clone(context.Scene);storage[0].resolve();await staleStored;assert.deepEqual(clone(context.Scene),latestStored,'A superseded upload also stops after IndexedDB completion');

for(const stage of ['decode','storage'])for(const limit of ['count','bytes']){
 fresh();context.heroMediaStorageReady=stage==='storage';const limited=art();if(stage==='storage'){resolve(0,'A'.repeat(400000));await tick();}
 context.Scene.artworks=Array.from({length:limit==='count'?12:4},(_,i)=>({id:`existing-${i}`,name:'Existing',kind:'art',image:image('A'.repeat(limit==='bytes'?400000:4)),hidden:false}));const before=clone(context.Scene);
 if(stage==='decode')resolve(0,'A'.repeat(400000));else storage[0].resolve();await limited;unchanged(before,`${limit} capacity must be checked immediately before commit after ${stage}`);assert.equal(notices.length,1);assert.equal(node('scene-art-name').value,'Original art');assert.equal(node('scene-art-upload').value,'first.png');
}

fresh();refuse=true;const refusal=art();resolve(0);await refusal;assert.equal(context.Scene.artworks.length,0);assert.equal(node('scene-art-name').value,'Original art');assert.equal(node('scene-art-upload').value,'first.png');assert.equal(notices[0],'Queue unavailable');
fresh();const failure=art();images[0].reject(new Error('Decode failed'));await failure;assert.equal(node('scene-art-name').value,'Original art');assert.equal(node('scene-art-upload').value,'first.png');assert.deepEqual(notices,['Decode failed']);
fresh();view='player';sync.canNarrate=false;await art();await upload('token',actorInput('token'));assert.equal(images.length,0,'An unauthorized initial upload never starts decoding');
for(const lifecycle of ['client-room','remote-room','status-role','view','history','backup']){
 fresh();if(lifecycle==='view')sync.sceneId=null;const work=upload('portrait',actorInput('portrait'));
 if(lifecycle==='client-room'){context.resetClientTableRuntime();sync.sceneId='room-b';context.resetClientTableRuntime();sync.sceneId='room-a';}
 if(lifecycle==='remote-room'){sync.sceneId='room-b';callbacks.scene({state:clone(context.Scene)});sync.sceneId='room-a';callbacks.scene({state:clone(context.Scene)});}
 if(lifecycle==='status-role'){sync.canNarrate=false;sync.role='player';callbacks.status();sync.canNarrate=true;sync.role='owner';callbacks.status();}
 if(lifecycle==='view'){sync.sceneId=null;handlers['scene-view:change'][0]({target:{value:'player'}});handlers['scene-view:change'][0]({target:{value:'gm'}});}
 if(lifecycle==='history'){const step={id:'same-id-history',label:'Same identities',state:context.sceneSnapshot()};context.Scene.undo=[step];assert.ok(context.restoreSceneHistory(step,context.Scene.undo,context.Scene.redo,'Undo'));}
 if(lifecycle==='backup')assert.ok(context.applyTableBackup({scene:context.sceneSnapshot()},'Same identities backup'));
 queued=[];const before=clone(context.Scene);resolve(0);await work;unchanged(before,`Production ${lifecycle} lifecycle must cancel even after identities/authority return to the original values`);
}
fresh();const refresh=upload('portrait',actorInput('portrait'));callbacks.status();const latest=clone(context.Scene);latest.actors[1].hp=25;latest.version++;callbacks.scene({state:latest});callbacks.status();resolve(0);await refresh;
assert.equal(context.Scene.actors[1].hp,25);assert.equal(context.Scene.actors[0].portraitImage,image('AAAA'));assert.equal(queued.length,1,'Ordinary same-room HP refresh and status notifications keep a valid media edit');
console.log('Scene media async: production callbacks/lifecycle hooks + writer/normalize/snapshot validation cover valid upload, captured/newer forms, concurrent decode/storage, clear, actor/room/policy/role/reset/Undo/backup, capacity/refusal and unrelated canonical HP. DOM/codec/storage/queue mocked.');
