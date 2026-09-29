import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../scene-ui.js",import.meta.url),"utf8");
const start=source.indexOf("const NETWORK_SCENE_SAFE_BYTES="),end=source.indexOf("function lionwingDestroyDescription",start);
const historyStart=source.indexOf("function restoreSceneHistory("),historyEnd=source.indexOf("function undoScene()",historyStart);
assert.ok(start>=0&&end>start&&historyStart>=0&&historyEnd>historyStart);
let id=0,queued=0,rendered=0,legacyQueued=0;
const messages=[];
const initial={rulesEdition:"lionwing",version:4,actors:[{id:"hero",name:"Герой"},{id:"enemy",name:"Враг"}],artworks:[{id:"art",image:"x".repeat(1900000)}],log:[],undo:[],redo:[],turnUndo:[]};
const context={
  initial,TextEncoder,structuredClone,NetworkV2:{networkSceneState:scene=>scene},
  Sync:{state:()=>({sceneId:"shared-scene",canNarrate:true}),queueScene:()=>{legacyQueued++}},
  sceneSnapshot:()=>structuredClone(context.Scene),sceneCore:scene=>structuredClone(scene),normalizeScene:scene=>structuredClone(scene),
  validateTableEdit:()=>{},uid:()=>`test-${++id}`,
  sceneEvent:label=>context.Scene.log.unshift({id:`log-${++id}`,text:label}),
  queueNetworkV2Snapshot:()=>{queued++;return true},
  toast:message=>messages.push(message),syncHeroFromScene:()=>{},persist:()=>{},
  renderPlay:()=>{rendered++},renderScene:()=>{rendered++},store:{mode:"play"},$:()=>null,
};
vm.createContext(context);
vm.runInContext(`let Scene=structuredClone(initial);${source.slice(start,end)}this.commitScene=commitScene;Object.defineProperty(this,"Scene",{get:()=>Scene,set:value=>{Scene=value}});`,context);
vm.runInContext(`${source.slice(historyStart,historyEnd)}this.restoreSceneHistory=restoreSceneHistory;`,context);
const removeEnemy=scene=>{scene.actors=scene.actors.filter(actor=>actor.id!=="enemy")};
assert.equal(context.commitScene("Убран враг",removeEnemy),null);
assert.ok(context.Scene.actors.some(actor=>actor.id==="enemy"),"oversized edit must roll back before the token disappears");
assert.equal(queued,0,"oversized state must not enter the network queue");
assert.equal(rendered,0,"oversized edit must not render a misleading local scene");
assert.match(messages[0],/лимит 2 МБ/);
context.Scene.artworks[0].image="small";
assert.equal(context.commitScene("Убран враг",removeEnemy)?.queued,true);
assert.ok(!context.Scene.actors.some(actor=>actor.id==="enemy"));
assert.equal(queued,1);

const historyState=structuredClone(context.Scene);
historyState.actors.push({id:"enemy",name:"Враг"});
context.Scene.undo=[{id:"undo-enemy",label:"Убран враг",state:historyState}];
const beforeRejectedUndo=structuredClone(context.Scene),renderedBeforeUndo=rendered;
context.queueNetworkV2Snapshot=()=>false;
assert.equal(context.restoreSceneHistory(context.Scene.undo[0],context.Scene.undo,[],"Отменено"),null);
assert.deepEqual(JSON.parse(JSON.stringify(context.Scene)),beforeRejectedUndo,"a rejected shared undo must keep the visible Scene and history unchanged");
assert.equal(rendered,renderedBeforeUndo,"a rejected shared undo must not render a speculative result");
assert.equal(legacyQueued,0,"shared undo must not fall back to the legacy snapshot writer");
assert.match(messages.at(-1),/Общий стол недоступен/);
context.queueNetworkV2Snapshot=()=>{queued++;return true};
assert.equal(context.restoreSceneHistory(context.Scene.undo[0],context.Scene.undo,[],"Отменено")?.queued,true);
assert.ok(context.Scene.actors.some(actor=>actor.id==="enemy"),"a queued shared undo applies locally");
assert.equal(queued,2);
assert.equal(legacyQueued,0);
console.log("Network size guard QA passed: oversized edit and rejected shared undo roll back; safe edits queue normally");
