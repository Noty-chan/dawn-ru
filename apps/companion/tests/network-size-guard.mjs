import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../scene-ui.js",import.meta.url),"utf8");
const start=source.indexOf("const NETWORK_SCENE_SAFE_BYTES="),end=source.indexOf("function lionwingDestroyDescription",start);
assert.ok(start>=0&&end>start);
let id=0,queued=0,rendered=0;
const messages=[];
const initial={rulesEdition:"lionwing",version:4,actors:[{id:"hero",name:"Герой"},{id:"enemy",name:"Враг"}],artworks:[{id:"art",image:"x".repeat(1900000)}],log:[],undo:[],redo:[],turnUndo:[]};
const context={
  initial,TextEncoder,structuredClone,NetworkV2:{networkSceneState:scene=>scene},
  Sync:{state:()=>({sceneId:"shared-scene",canNarrate:true})},
  sceneSnapshot:()=>structuredClone(context.Scene),normalizeScene:scene=>structuredClone(scene),
  validateTableEdit:()=>{},uid:()=>`test-${++id}`,
  sceneEvent:label=>context.Scene.log.unshift({id:`log-${++id}`,text:label}),
  queueNetworkV2Snapshot:()=>{queued++;return true},
  toast:message=>messages.push(message),syncHeroFromScene:()=>{},persist:()=>{},
  renderPlay:()=>{rendered++},renderScene:()=>{rendered++},store:{mode:"play"},
};
vm.createContext(context);
vm.runInContext(`let Scene=structuredClone(initial);${source.slice(start,end)}this.commitScene=commitScene;Object.defineProperty(this,"Scene",{get:()=>Scene,set:value=>{Scene=value}});`,context);
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
console.log("Network size guard QA passed: oversized actor removal rolls back, safe edit queues normally");
