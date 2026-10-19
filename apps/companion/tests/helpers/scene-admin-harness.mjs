import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {runtime,fixture,clone} from './scene-contract-harness.mjs';

export function sceneAdminHarness(){
 const read=name=>fs.readFileSync(new URL(`../../${name}`,import.meta.url),'utf8').replaceAll('\r\n','\n');
 const events=(process.env.DAWN_ADMIN_BASELINE_REF?execFileSync('git',['show',`${process.env.DAWN_ADMIN_BASELINE_REF}:apps/companion/app-scene-events.js`],{encoding:'utf8'}):read('app-scene-events.js')).replaceAll('\r\n','\n');
 const app=read('app-core.js'),ui=read('scene-ui.js'),{context,engine,core}=runtime(),nodes=new Map(),handlers={},callbacks={};let serial=0;
 const state={sync:{sceneId:'room-a',campaignId:'campaign-a',userId:'gm',role:'owner',canNarrate:true},now:Date.parse('2026-10-14T10:00:00.000Z'),writes:[],queued:[],notices:[],renders:0,confirmations:0,confirm:true,refuse:false,readGate:null,local:new Map(),indexed:new Map()};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',files:[],dataset:{},textContent:'',hidden:false,classList:{add(){},remove(){}},addEventListener(type,handler,options){(handlers[`${id}:${type}`]??=[]).push({handler,options});}});return nodes.get(id);};
 Object.assign(context,{$:node,structuredClone,SceneEngine:engine,APP_SCHEMA:14,contentPreferences:{edition:'lionwing'},uid:()=>`admin-${++serial}`,store:{mode:'play'},manualTableDraftGeneration:0,
  Date:class extends Date{constructor(...args){super(...(args.length?args:[state.now]));}static now(){return state.now;}},
  cleanArray:value=>Array.isArray(value)?value.filter(item=>typeof item==='string'):[],clamp:(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0)),
  Sync:{state:()=>state.sync,on:(name,callback)=>callbacks[name]=callback},toast:message=>{state.notices.push(message);return null;},
  queueNetworkV2Snapshot:(scene,label)=>{if(state.refuse)throw new Error('Queue unavailable');state.queued.push({room:state.sync.sceneId,label,scene:clone(scene)});return true;},
  assertNetworkSceneFits(){},syncHeroFromScene(){},persist(){},renderScene(){state.renders++;state.onPaint?.();},renderPlay(){state.renders++;state.onPaint?.();},renderToolsWorkspace(){},renderSync(){},
  renderChallengeRequestDock(){},resetToolsRollResult(){},reconcileSceneResultsDialog(){},currentChallengeRequest:()=>null,currentOpposedParticipant:()=>null,queueAutomaticCommands(){},clearSceneMeasurement(){},setScenePanel(){},resetNetworkV2Runtime(){},
  NetworkV2:{resetLocalUiForSceneSwitch:scene=>scene},mergeNetworkV2Scene:remote=>remote,hydratePlayerScene:scene=>context.normalizeScene(scene),
  localStorage:{getItem:key=>state.local.get(key)||null,setItem:(key,value)=>{if(state.failLocal)throw new Error('Local storage unavailable');state.local.set(key,value);}},
  writeHeroMedia:entries=>new Promise((resolve,reject)=>state.writes.push({entries,resolve(){for(const entry of entries)state.indexed.set(entry.key,entry.value);resolve();},reject})),
  readHeroMedia:keys=>state.readGate?new Promise((resolve,reject)=>{state.readGate.resolve=()=>resolve(new Map(keys.filter(key=>state.indexed.has(key)).map(key=>[key,state.indexed.get(key)])));state.readGate.reject=reject;}):Promise.resolve(new Map(keys.filter(key=>state.indexed.has(key)).map(key=>[key,state.indexed.get(key)]))),
 });
 context.window.confirm=()=>{state.confirmations++;return state.confirm;};
 vm.runInContext(app.slice(app.indexOf('function blankScene()'),app.indexOf('function addEnemyDeploymentPassives')),context);
 vm.runInContext(app.slice(app.indexOf('function validateTableEdit('),app.indexOf('function cleanArray(')),context);
 vm.runInContext(ui.split('\n').filter(line=>/^function (sceneSnapshot|sceneEvent|activeSceneView)\(/.test(line)).join('\n'),context);
 vm.runInContext(ui.slice(ui.indexOf('function commitScene('),ui.indexOf('function lionwingDestroyDescription')),context);
 vm.runInContext(events.slice(events.indexOf('const sceneMediaEdits='),events.indexOf('function refreshSceneShortcutQuote(')),context);
 vm.runInContext(events.slice(events.indexOf('function updateTableRecoveryStatus('),events.indexOf('$("scene-export-table")')),context);
 const importStart=events.indexOf('$("scene-import-table").onchange=');vm.runInContext(events.slice(importStart,events.indexOf('$("scene-save-recovery").onclick',importStart)),context);
 const restoreStart=events.indexOf('$("scene-restore-recovery").onclick=');vm.runInContext(events.slice(restoreStart,events.indexOf('$("scene-reset-table").onclick',restoreStart)),context);
 vm.runInContext(ui.slice(ui.indexOf('function restoreSceneHistory('),ui.indexOf('function undoScene(')),context);
 const sync=read('app-sync-events.js');vm.runInContext('let pendingSceneCommands=[],pendingCommandSceneId="room-a",lastInviteToken="";const automaticCommandAttempts=new Map(),automaticCommandRetries=new Map(),delayedAutomaticCommands=new Set();',context);
 vm.runInContext(sync.slice(sync.indexOf('function resetClientTableRuntime('),sync.indexOf('function renderCloudLibrary(')),context);
 for(const name of ['status','scene'])vm.runInContext(sync.split('\n').find(line=>line.startsWith(`Sync?.on("${name}",`)&&(name!=='scene'||line.includes('const previousRequestId='))),context);
 context.Scene=context.normalizeScene(fixture());context.Scene.view='gm';
 const snapshot=name=>JSON.stringify({format:'dawn-ru-table-backup',schema:1,exportedAt:new Date(state.now).toISOString(),scene:{...context.sceneSnapshot(),name}});
 return{context,engine,core,events,ui,read,state,node,handlers,callbacks,snapshot,clone,tick:()=>new Promise(resolve=>setImmediate(resolve)),run:code=>vm.runInContext(code,context)};
}
