import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","logic.js"])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
loadSceneEngine(context);const lw=context.window.DAWN_LIONWING_ENGINE;
const actor=(id,x,y,extra={})=>({id,name:id,kind:"hero",heroId:id,rulesEdition:"lionwing",team:"hero",space:"main",x,y,hp:16,maxHp:16,ap:3,baseAp:3,focus:2,influence:2,wounds:0,stress:0,tier:1,speed:5,armor:0,evasion:0,attrs:{body:3,talent:3,spirit:3,mind:3},effects:[],effectStates:{},usedActions:[],acted:false,...extra});
const fixture=()=>({rulesEdition:"lionwing",version:4,round:1,turnSerial:1,activeActorId:"source",spaces:[{id:"main",width:7,height:7}],actors:[actor("source",0,5),actor("mover",1,1,{occupiedWidth:2,occupiedHeight:2}),actor("body",5,5)],objects:[],walls:[{id:"lower",space:"main",a:"1,2",b:"2,2"}],markers:[],log:[]});
const request={kind:"geometry-move",targetId:"mover",destination:{space:"main",x:2,y:1},maximum:3};
let scene=fixture(),before=JSON.stringify(scene),prepared=lw.prepare(scene,{actorId:"source",...request});
assert.equal(prepared.ok,true,prepared.errors?.join(" "));assert.equal(JSON.stringify(scene),before,"preparing a route does not move the actor");
assert.equal(prepared.events[0].payload.geometryPlan.kind,"lionwing.geometry.route");
let moved=lw.dispatchMany(scene,prepared.events).scene;
assert.deepEqual([moved.actors[1].x,moved.actors[1].y],[2,1]);assert.deepEqual(JSON.parse(JSON.stringify(moved.log.find(event=>event.type==="actor.move").payload.path)),[{x:1,y:0},{x:2,y:0},{x:2,y:1}],"commit uses the body-safe planned route");
assert.equal(moved.log.find(event=>event.type==="geometry.route.commit").payload.spent,3);
assert.equal(JSON.stringify(lw.dispatchMany(moved,prepared.events).scene),JSON.stringify(moved),"repeating the prepared command is idempotent");
assert.throws(()=>lw.dispatchMany({...scene,version:5},prepared.events),/устарел/);

scene=fixture();scene.walls=[];scene.objects=[{id:"mud",type:"difficult",space:"main",cells:["2,2"]}];
prepared=lw.prepare(scene,{actorId:"source",...request,maximum:4});assert.equal(prepared.ok,true,prepared.errors?.join(" "));
moved=lw.dispatchMany(scene,prepared.events).scene;
assert.equal(moved.actors[1].lionwing.difficultTerrainStopSerial,scene.turnSerial);assert.equal(moved.log.find(event=>event.type==="geometry.route.commit").payload.remaining,0,"terminal routes consume the movement remainder");

const occupied=structuredClone(scene);occupied.actors.push(actor("blocker",2,1,{team:"enemy",kind:"enemy",heroId:null}));
assert.throws(()=>lw.dispatchMany(occupied,prepared.events),/план|маршрут|занят|устарел/i,"a target occupied after preview invalidates commit");

scene=fixture();scene.walls=[];
const packageRequest={kind:"plan",actionId:"manual.adjudication",costs:[{kind:"resource",resource:"ap",amount:1}],targetIds:["mover","body"],operations:[
  {kind:"geometry-move",targetId:"mover",destination:{space:"main",x:3,y:1},maximum:3},
  {kind:"damage",targetId:"body",amount:2},
]};
before=JSON.stringify(scene);prepared=lw.prepare(scene,{actorId:"source",...packageRequest});
assert.equal(prepared.ok,true,prepared.errors?.join(" "));assert.equal(JSON.stringify(scene),before,"previewing a manual package is side-effect free");
assert.equal(prepared.events[0].payload.operations[0].geometryPlan.kind,"lionwing.geometry.route","nested movement receives a verified plan");
const packaged=lw.dispatchMany(scene,prepared.events).scene;
assert.deepEqual([packaged.actors[1].x,packaged.actors[1].y],[3,1]);assert.equal(packaged.actors[2].hp,14);assert.equal(packaged.actors[0].ap,2,"price and all consequences commit in one transaction");
const stalePackage=structuredClone(scene);stalePackage.actors.push(actor("late-blocker",3,1,{team:"enemy",kind:"enemy",heroId:null}));
assert.throws(()=>lw.dispatchMany(stalePackage,prepared.events),/план|маршрут|занят|устарел/i,"a stale nested route rejects the whole package");
assert.equal(stalePackage.actors.find(item=>item.id==="source").ap,3,"rejection does not charge the package price");assert.equal(stalePackage.actors.find(item=>item.id==="body").hp,16,"rejection does not apply later consequences");
console.log("LionWing geometry commit: preview, body route, terminal terrain, replay and stale target passed");
