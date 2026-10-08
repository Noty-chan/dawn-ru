import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context={window:{},console,Date,setTimeout,clearTimeout,crypto:globalThis.crypto}; vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","logic.js"])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const Engine=loadSceneEngine(context);
for(const file of ["scene-table-policy.js","network-v2.js"])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const Policy=context.window.DAWN_TABLE_POLICY,Network=context.window.DAWN_NETWORK_V2;
Policy.install(Engine,context.window.DAWN_LIONWING_ENGINE);
const plain=value=>JSON.parse(JSON.stringify(value));
const hero=(id,ownerId,x)=>({id,ownerId,heroId:id,name:id,kind:"hero",rulesEdition:"lionwing",team:"hero",space:"main",x,y:1,hp:10,maxHp:10,ap:3,focus:5,wounds:0,stress:0,effects:[]});
const fixture=()=>({rulesEdition:"lionwing",version:2,round:3,turnSerial:8,tension:2,activeActorId:"other",tablePolicy:{mode:"manual",processStatuses:false,epoch:2},manualTable:{actorId:"other",round:4},actors:[hero("mine","p1",1),hero("other","p2",3)],spaces:[{id:"main",width:7,height:7}],objects:[],markers:[],walls:[],sessionClocks:[],rollFeed:[],log:[]});
const command=(actorId,payload,id)=>({id,type:"table.command",actorId,payload});
const asIntent=(scene,actorId,payload)=>Network.intentFromEvents(scene,[command(actorId,payload)],"Тест");
const materialize=(scene,intent,owner="p1")=>Network.materializeIntent(scene,context.window.DAWN_DATA,intent,owner);
let s=fixture();
const before=plain(s), moveIntent=asIntent(s,"mine",{kind:"move",space:"main",x:6,y:1});
assert.equal(moveIntent.kind,"table");assert.equal(moveIntent.policyEpoch,2);
const moveEvents=materialize(s,moveIntent);assert.equal(moveEvents.length,1);assert.equal(moveEvents[0].type,"table.command");
assert.deepEqual(plain(s),before,"classification and authority materialization never write Scene");
s=Engine.dispatchMany(s,moveEvents,{expectedVersion:2}).scene;assert.equal(s.actors[0].x,6);assert.equal(s.actors[0].ap,3);assert.equal(s.turnSerial,8);
assert.throws(()=>materialize(s,asIntent(s,"other",{kind:"resource",values:{hp:1}})),/не владеет/);
for(const request of [{kind:"policy",mode:"manual",processStatuses:true},{kind:"pointer",actorId:"mine"},{kind:"round",delta:1},{kind:"marker/create",marker:{id:"hidden",space:"main",x:0,y:0}},{kind:"object/remove",id:"terrain"}])assert.throws(()=>materialize(s,{kind:"table",actorId:"mine",policyEpoch:2,request}),/Нарратору/);
assert.throws(()=>materialize(s,{...moveIntent,policyEpoch:1}),/Политика/);
const withoutPolicy=fixture();delete withoutPolicy.tablePolicy;withoutPolicy.sceneControlMode="manual";
assert.throws(()=>materialize(withoutPolicy,moveIntent),/ручной политики/);
let calls=0;const originalPrepare=context.window.DAWN_LIONWING_ENGINE.prepare;context.window.DAWN_LIONWING_ENGINE.prepare=()=>{calls++;throw Error("must never reach prepare")};
for(const intent of [{kind:"lionwing",actorId:"mine",request:{kind:"action"}},{kind:"deployment",actorId:"mine",destination:{space:"main",x:2,y:1}},{kind:"action",actorId:"mine"},{kind:"turn-start",actorId:"mine"},{kind:"turn-end",actorId:"mine"},{kind:"runtime",actorId:"mine",key:"hp",value:0}])assert.throws(()=>materialize(s,intent),/выключены/);
assert.equal(calls,0,"old browser intents fail before kernel prepare");context.window.DAWN_LIONWING_ENGINE.prepare=originalPrepare;
assert.throws(()=>Network.intentFromEvents(s,[{type:"actor.move",actorId:"mine",payload:{placement:true,space:"main",x:2,y:1}}]),/выключены/);
const hp=materialize(s,asIntent(s,"mine",{kind:"resource",values:{hp:0}}));s=Engine.dispatchMany(s,hp).scene;assert.equal(s.actors[0].hp,0);assert.equal(s.actors[0].wounds,0);
assert.throws(()=>materialize(s,{kind:"table",actorId:"mine",policyEpoch:2,request:{kind:"resource",values:{hp:5},targetId:"other"}}),/Неизвестные поля/);
for(const payload of [{kind:"status",effectId:"negative.обездвижен",enabled:true},{kind:"technique",key:"test.ability",enabled:true},{kind:"clock/create",clock:{id:"myclock",name:"Ритуал",kind:"progress",size:4,value:0}},{kind:"area/create",area:{id:"myarea",space:"main",cells:["1,1","2,1"],label:"Приём"}}])s=Engine.dispatchMany(s,materialize(s,asIntent(s,"mine",payload))).scene;
assert.deepEqual(plain(s.actors[0].manualTechniqueState),{"test.ability":true});assert.equal(s.sessionClocks[0].ownerActorId,"mine");assert.equal(s.objects[0].type,"manual-area");
s=Engine.dispatchMany(s,materialize(s,asIntent(s,"mine",{kind:"clock/set",id:"myclock",value:4}))).scene;assert.equal(s.sessionClocks[0].current,4);assert.equal(s.pendingPrompt,undefined);
assert.throws(()=>materialize(s,{kind:"table",actorId:"other",policyEpoch:2,request:{kind:"clock/set",id:"myclock",value:2}},"p2"),/не владеет/);
assert.throws(()=>materialize(s,{kind:"table",actorId:"other",policyEpoch:2,request:{kind:"area/remove",id:"myarea"}},"p2"),/не владеет/);
const rollIntent=Network.intentFromEvents(s,[{type:"roll.public",actorId:"mine",payload:{formula:"2D6",rolls:[3,6],successes:1,crits:1}}]);
const rollRows=materialize(s,rollIntent),rollBefore=plain(s.actors);s=Engine.dispatchMany(s,rollRows).scene;const version=s.version;
assert.equal(s.rollFeed.length,1);assert.equal(s.rollFeed[0].manual,true);assert.deepEqual(plain(s.actors),rollBefore);
assert.equal(Engine.dispatchMany(plain(s),rollRows).scene.version,version,"repeated committed roll is idempotent");
const oldRoll=materialize(s,{kind:"public-roll",actorId:"mine",payload:{formula:"1D6",rolls:[4],successes:1,crits:0}});assert.equal(oldRoll[0].type,"table.command");
s=Engine.dispatchMany(s,materialize(s,asIntent(s,"mine",{kind:"area/remove",id:"myarea"}))).scene;
s=Engine.dispatchMany(s,materialize(s,asIntent(s,"mine",{kind:"clock/remove",id:"myclock"}))).scene;assert.equal(s.objects.length,0);assert.equal(s.sessionClocks.length,0);
console.log("Manual table network: real intent classification/authority reducer, ownership, epoch, old-client rejection, storage rolls, actor labels, clocks and informational areas passed");

{
// The result panel can correlate acceptance without accessing private receipts.
const rollStart=fixture(),rollEvent=command('mine',{kind:'roll',roll:{formula:'2D6',rolls:[4,6],successes:3,count:2}},'manual-roll-correlation');
const rollIntent=Network.intentFromEvents(rollStart,[rollEvent],'Manual roll');assert.equal(rollIntent.eventId,rollEvent.id);
const rollMaterialized=materialize(rollStart,rollIntent);assert.equal(rollMaterialized[0].id,rollEvent.id);
const rollAccepted=Engine.dispatchMany(rollStart,rollMaterialized).scene;
const rollReplay=Engine.dispatchMany(rollAccepted,materialize(rollAccepted,rollIntent)).scene;
assert.equal(rollReplay.version,rollAccepted.version);assert.equal(rollReplay.rollFeed.length,1);
assert.equal(Engine.projectScene(rollAccepted,{role:'player',actorIds:['mine']}).rollFeed[0].id,rollEvent.id);
const changed=plain(rollIntent);changed.request.roll.rolls=[1,1];assert.throws(()=>materialize(rollAccepted,changed),e=>e.code==='SCENE_EVENT_ID_CONFLICT');
assert.throws(()=>materialize(rollAccepted,{...rollIntent,actorId:'other'},'p2'),e=>e.code==='SCENE_EVENT_ID_CONFLICT');
for(const eventId of [null,'',12,{}])assert.throws(()=>materialize(rollStart,{...rollIntent,eventId}));
const legacy=plain(rollIntent);delete legacy.eventId;assert.equal(typeof materialize(rollStart,legacy)[0].id,'string');

}

// Control-owned notebook commands share the normal authority boundary.
let notes=fixture();
const counter=(operation,extra={})=>({kind:"technique-counter",key:"PRIVATE_COUNTER_RULE",operation,...extra});
const submit=payload=>{notes=Engine.dispatchMany(notes,materialize(notes,asIntent(notes,"mine",payload))).scene;};
submit(counter("create"));submit(counter("adjust",{delta:1}));submit(counter("adjust",{delta:1}));
assert.equal(notes.actors[0].manualTechniqueCounters.PRIVATE_COUNTER_RULE,2,'increments use authority state, not stale UI values');
submit(counter("create"));assert.equal(notes.actors[0].manualTechniqueCounters.PRIVATE_COUNTER_RULE,2,'repeated add never resets a counter');
const stable=JSON.stringify(notes);
for(const p of [counter("set",{value:-1}),counter("set",{value:1000}),counter("set",{value:1.5}),counter("adjust",{delta:7}),{...counter("create"),key:"__proto__"}])assert.throws(()=>materialize(notes,asIntent(notes,"mine",p)));
assert.equal(JSON.stringify(notes),stable,'invalid changes are atomic');
assert.throws(()=>materialize(notes,asIntent(notes,"other",counter("create"))),/владеет/);
const ownerView=Engine.projectScene(notes,{role:"player",actorIds:["mine"]}),otherView=Engine.projectScene(notes,{role:"player",actorIds:["other"]});
assert.equal(ownerView.actors[0].manualTechniqueCounters.PRIVATE_COUNTER_RULE,2);
assert.ok(!JSON.stringify(otherView).includes('PRIVATE_COUNTER_RULE'),'foreign actors and event logs never reveal private rule IDs');
assert.equal(Engine.projectScene(notes,{role:"gm"}).actors[0].manualTechniqueCounters.PRIVATE_COUNTER_RULE,2);
submit(counter("remove"));assert.deepEqual(plain(notes.actors[0].manualTechniqueCounters),{});
assert.throws(()=>materialize(notes,asIntent(notes,"mine",counter("adjust",{delta:1}))),/добавьте/);
for(const field of ["hp","ap","focus","wounds","stress"])assert.equal(notes.actors[0][field],fixture().actors[0][field],'notebook never invokes mechanics');
console.log('Manual counters: owned authority commands, concurrent increments, bounds, privacy, removal and frozen resources passed.');
