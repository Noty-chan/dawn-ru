import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { window: {}, console }; vm.createContext(context);
for (const file of ["data.js", "edition-lionwing.js", "logic.js"]) vm.runInContext(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), context, { filename: file });
const engine = loadSceneEngine(context), lw = context.window.DAWN_LIONWING_ENGINE;
vm.runInContext(fs.readFileSync(new URL("../scene-table-policy.js", import.meta.url), "utf8"), context, { filename: "scene-table-policy.js" });
const policy = context.window.DAWN_TABLE_POLICY;
const plain = value => JSON.parse(JSON.stringify(value));
const actor = (id, x, extra = {}) => ({ id, name:id, kind:"hero", heroId:id, rulesEdition:"lionwing", team:"hero", space:"main", x,y:1,hp:16,maxHp:16,ap:3,baseAp:3,focus:10,influence:3,wounds:0,stress:0,tier:1,speed:4,armor:0,evasion:0,attrs:{body:4,talent:3,spirit:2,mind:2},effects:[],effectStates:{},usedActions:[],acted:false,knockedOut:false,...extra });
const fixture = () => ({ rulesEdition:"lionwing",version:0,round:4,turnSerial:8,tension:2,activeActorId:"h",spaces:[{id:"main",width:7,height:7}],actors:[actor("h",1),actor("e",4,{kind:"enemy",heroId:null,team:"enemy",profileId:"lionwing.npc.gas"})],objects:[{id:"gas",type:"difficult",space:"main",cells:["2,1","3,1"]}],walls:[{id:"wall",space:"main",x:1,y:1,side:"east"}],markers:[],log:[],targetIds:[],reminders:[],rollFeed:[] });
let serial = 0;
const event = (actorId, payload, id = `manual-${++serial}`) => ({id,type:"table.command",actorId,payload});
const run = (scene, actorId, payload, options) => policy.dispatchMany(scene,[event(actorId,payload)],options).scene;
const reject = (scene, rows, code, options) => { const before=JSON.stringify(scene); assert.throws(()=>policy.dispatchMany(scene,rows,options),error=>error.code===code); assert.equal(JSON.stringify(scene),before,"failed packet leaves input byte-for-byte unchanged"); };
assert.equal(policy.isManual({sceneControlMode:"manual"}),false,"old visual flag never switches policy");
assert.deepEqual(plain(policy.normalizePolicy()),{mode:"rules",processStatuses:false,epoch:0});
let s=fixture();
// Prepare a real aura before switching policies; its storage and transitions
// provide a production-shaped sentinel rather than a mock dispatcher.
s=lw.dispatchMany(s,[{id:"aura-seed",type:"lionwing.command",actorId:"e",payload:{kind:"aura",operation:"create",id:"gas-aura",ownerActorId:"e",sourceEntityId:"e",ruleId:"test.gas",effectId:"negative.обездвижен",shape:{kind:"radius",distance:2},filter:{relation:"enemy"},lifetime:"scene",removable:true}}]).scene;
s=run(s,null,{kind:"policy",mode:"manual"});
const initial=plain(s), mechanical=value=>plain({...value,version:0,log:[],manualTable:undefined,actors:value.actors.map(a=>({...a,x:0,y:0,manualMovementTrace:undefined,manualStatuses:undefined})),lionwing:{...value.lionwing,receipts:[]}});
s=run(s,"h",{kind:"move",space:"main",x:2,y:1});
s=run(s,"h",{kind:"move",space:"main",x:4,y:1});
assert.deepEqual(mechanical(s),mechanical(initial),"moving through Gas, wall, occupied cell and aura changes no mechanical state");
assert.equal(s.actors[0].manualMovementTrace.to.x,4);
assert.deepEqual(plain(s.log.filter(row=>row.type!=="table.command")),plain(initial.log.filter(row=>row.type!=="table.command")));
const roundsBefore=mechanical(s);
s=run(s,null,{kind:"pointer",actorId:"e"}); s=run(s,null,{kind:"round",delta:3});
assert.deepEqual(mechanical(s),roundsBefore,"manual pointer and rounds do not invoke core boundaries");
assert.deepEqual(plain(s.manualTable),{actorId:"e",round:4});
s=run(s,"h",{kind:"resource",values:{hp:0}});
assert.equal(s.actors[0].hp,0); assert.equal(s.actors[0].wounds,0); assert.equal(s.actors[0].knockedOut,false); assert.equal(s.actors[0].stress,0);
reject(s,[event("e",{kind:"resource",values:{maxHp:2}})],"TABLE_COMMAND_INVALID");
reject(s,[event("h",{kind:"resource",values:{focus:NaN}})],"SCENE_EVENT_PACKET_INVALID");
reject(s,[event("h",{kind:"resource",values:{speedZeroUntilTurnEnd:1}})],"TABLE_COMMAND_INVALID");
const statusBefore=plain(s.actors[0]);
s=run(s,"h",{kind:"status",effectId:"negative.обездвижен",enabled:true});
assert.deepEqual(plain(s.actors[0]),{...statusBefore,manualStatuses:["negative.обездвижен"]});
s=run(s,"h",{kind:"move",space:"main",x:6,y:6}); assert.equal(s.actors[0].x,6,"manual Snare label does not block movement");
s=run(s,null,{kind:"marker/create",marker:{id:"manual-mark",space:"main",x:2,y:2,kind:"note",label:"Snare"}});
s=run(s,null,{kind:"marker/move",id:"manual-mark",space:"main",x:3,y:2}); assert.equal(s.markers[0].x,3);
s=run(s,null,{kind:"marker/remove",id:"manual-mark"}); assert.equal(s.markers.length,0);
s.lionwing.entities={terrain:{id:"terrain",backing:{objectId:"gas"},links:[]},retained:{id:"retained",backing:{markerId:"other"},links:[{from:"terrain",to:"retained"}]}};
s.actors[0].ruleState={sourceEntityId:"terrain",score:5}; s.reminders=[{id:"r",sourceEntityId:"gas",due:true}];
const resources=plain(s.actors.map(({hp,ap,focus,wounds,stress})=>({hp,ap,focus,wounds,stress}))), registryBefore=plain(s);
s=run(s,null,{kind:"object/remove",id:"gas"});
assert.equal(s.objects.length,0); assert.equal(s.lionwing.entities.terrain,undefined); assert.equal(s.lionwing.entities.retained.links.length,0);
assert.equal(s.actors[0].ruleState.sourceEntityId,null); assert.equal(s.actors[0].ruleState.score,5); assert.equal(s.reminders[0].sourceEntityId,null); assert.equal(s.reminders[0].due,true);
assert.deepEqual(plain(s.actors.map(({hp,ap,focus,wounds,stress})=>({hp,ap,focus,wounds,stress}))),resources);
assert.equal(registryBefore.objects.length,1,"the caller snapshot still has all undo data");
const repeat=event("h",{kind:"resource",values:{focus:8}},"repeat"); s=policy.dispatchMany(s,[repeat],{expectedVersion:s.version}).scene;
const replay=policy.dispatchMany(plain(s),[repeat],{expectedVersion:0}); assert.equal(replay.events.length,0); assert.deepEqual(plain(replay.scene),plain(s));
reject(s,[{...repeat,payload:{kind:"resource",values:{focus:7}}}],"SCENE_EVENT_ID_CONFLICT");
reject(s,[event("h",{kind:"move",space:"main",x:1,y:1})],"SCENE_VERSION_CONFLICT",{expectedVersion:0});
reject(s,[event("h",{kind:"move",space:"main",x:1,y:1}),event("h",{kind:"resource",values:{hp:500}})],"TABLE_COMMAND_INVALID");
for (const field of ["pendingAction","pendingPrompt","pendingActionPlan"]) { const pending=fixture(); pending[field]={id:"pending"}; reject(pending,[event(null,{kind:"policy",mode:"manual"})],"TABLE_PENDING_WORK"); }
for (const field of ["choices","deferred","pausedChains"]) { const pending=fixture(); pending.lionwing={[field]:[{id:"pending"}]}; reject(pending,[event(null,{kind:"policy",mode:"manual"})],"TABLE_PENDING_WORK"); }
reject(s,[event(null,{kind:"policy",mode:"rules"})],"TABLE_START_RULES_REQUIRED");
policy.install(engine,lw); policy.install(engine,lw);
for (const candidate of [engine,lw]) {
  const before=JSON.stringify(s);
  assert.throws(()=>candidate.dispatchMany(s,[{id:"old-auto",type:"lionwing.command",actorId:"h",payload:{kind:"turn-start"}}]),e=>e.code==="TABLE_AUTOMATION_BLOCKED");
  assert.equal(candidate.previewEvents(s,[{type:"actor.move",actorId:"h",payload:{space:"main",x:2,y:1,placement:true}}]).ok,false);
  assert.equal(JSON.stringify(s),before);
}
assert.equal(lw.prepare(s,{actorId:"h",kind:"action",actionId:engine.ACTION_IDS.charge}).ok,false);
assert.equal(lw.prepareEntityRemoval(s,"retained").ok,false);
assert.equal(lw.replay(s,{operation:"damage"}).ok,false);
assert.equal(lw.consumeEvasion(s,s.actors[0],1).ok,false);
assert.deepEqual(plain(lw.reload(JSON.stringify(s))),plain(s),"manual reload is storage only");
assert.equal(engine.prepareAction(s,context.window.DAWN_DATA,{actorId:"h",actionId:engine.ACTION_IDS.charge}).ok,false);
assert.throws(()=>engine.eventPacketContract.dispatchContinuation(s,[{type:"turn.start",actorId:"h"}]),e=>e.code==="TABLE_AUTOMATION_BLOCKED");
assert.equal(engine.dispatchMany(s,[event("h",{kind:"resource",values:{focus:5}})]).scene.actors[0].focus,5);
const oldScene=fixture(); oldScene.activeActorId=null; assert.equal(lw.dispatchMany(oldScene,[{id:"rules-still-live",type:"lionwing.command",actorId:"h",payload:{kind:"turn-start"}}]).scene.turnSerial,9,"ordinary rules scenes keep the original dispatcher");
console.log("Manual table policy: real engine storage commands, side-effect isolation, atomic validation, references, replay, stale guards and blocked automatic APIs passed");

const known=plain(s);known.actors[1].hidden=true;known.actors[1].manualInitiativeVisible=true;known.manualTable.actorId=known.actors[1].id;
const projected=engine.projectScene(known,{role:'player'});
assert.equal(projected.actors.some(actor=>actor.id===known.actors[1].id),false);
assert.deepEqual(Object.keys(projected.manualInitiative[0]).sort(),['hidden','id','initiativeOnly','name','space']);
assert.equal(projected.manualTable.actorId,known.actors[1].id);
const twice=engine.projectScene(projected,{role:'player'});assert.deepEqual(plain(twice.manualInitiative),plain(projected.manualInitiative));assert.equal(twice.manualTable.actorId,projected.manualTable.actorId);
known.actors[1].manualInitiativeVisible=false;assert.equal(engine.projectScene(known,{role:'player'}).manualInitiative.length,0);

{
const bounded=fixture();bounded.tablePolicy={mode:'manual',epoch:0};
for(const [key,value] of [['stress',4],['influence',1000],['hp',10000],['armor',100],['wounds',4]])reject(bounded,[event('h',{kind:'resource',values:{[key]:value}})],'TABLE_COMMAND_INVALID');
const extended=plain(bounded);extended.actors[0].gifts=['rebel.supernatural-deafness'];assert.equal(run(extended,'h',{kind:'resource',values:{stress:4}}).actors[0].stress,4);
}
