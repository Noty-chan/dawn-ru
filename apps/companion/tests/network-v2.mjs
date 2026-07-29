import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context={console,Date,setTimeout,clearTimeout,structuredClone,crypto:globalThis.crypto};
context.globalThis=context;
context.window=context;
context.normalizeScene=value=>structuredClone(value);
context.sceneCore=value=>structuredClone(value);
vm.runInNewContext(fs.readFileSync(new URL("../data.js",import.meta.url),"utf8"),context);
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(new URL("../network-v2.js",import.meta.url),"utf8"),context);

const Network=context.DAWN_NETWORK_V2,Engine=context.DAWN_SCENE_ENGINE,data=context.DAWN_DATA;
assert.equal(Network.PROTOCOL,2);
assert.equal(Network.TICK_MS,200,"the authoritative cadence is capped at five ticks per second");
assert.equal(new Network.PlayerOutbox({tickMs:1,send:async()=>{}}).tickMs,200,"callers cannot bypass the five-per-second client cap");
assert.equal(new Network.AuthorityQueue({tickMs:1,flush:async()=>{}}).tickMs,200,"callers cannot bypass the five-per-second authority cap");

const baseScene={
  version:7,round:1,tension:0,activeActorId:"hero",view:"gm",tool:"erase",activeSpace:"side",selectedActor:"hero",targetIds:["enemy"],
  spaces:[{id:"main",width:7,height:7},{id:"side",width:4,height:4}],
  actors:[
    {id:"hero",ownerId:"player-1",heroId:"sheet-1",name:"Герой",team:"hero",space:"side",x:0,y:0,hp:10,maxHp:10,wounds:0,focus:3,influence:1,ap:3,baseAp:3,speed:4,effects:[],usedActions:[],attrs:{body:3,talent:3,spirit:3,mind:3},techniques:{}},
    {id:"enemy",name:"Враг",team:"enemy",space:"side",x:1,y:0,hp:8,maxHp:8,ap:2,baseAp:2,speed:3,effects:[],usedActions:[],attrs:{body:2,talent:2,spirit:2,mind:2}},
  ],
  objects:[],markers:[],sessionClocks:[],rollFeed:[],log:[],undo:[],
};
const wire=Network.networkSceneState(baseScene);
assert.equal(wire.tool,"select");
assert.equal(wire.selectedActor,null);
assert.deepEqual(Array.from(wire.targetIds),[]);
assert.equal(wire.activeSpace,"main","the wire snapshot must not publish the narrator's open space");

const remote=structuredClone(baseScene);
remote.version=8;
remote.actors[0].hp=6;
remote.view="gm";
remote.tool="select";
remote.activeSpace="main";
remote.selectedActor=null;
remote.targetIds=[];
const merged=Network.mergeRemoteScene(remote,baseScene);
assert.equal(merged.actors[0].hp,6,"canonical state comes from the authoritative snapshot");
assert.equal(merged.tool,"erase","the local tool survives a network snapshot");
assert.equal(merged.activeSpace,"side","the open board space is local UI");
assert.equal(merged.selectedActor,"hero","the open actor card is not collapsed by synchronization");
assert.deepEqual(Array.from(merged.targetIds),["enemy"],"local target selection is not overwritten by another client");

const snapshotBase=structuredClone(baseScene);
snapshotBase.objects=[{id:"old-object",label:"Старая область",space:"side"}];
const narratorDesired=structuredClone(snapshotBase);
narratorDesired.actors[0].name="Переименованный герой";
narratorDesired.objects=[];
const newerCanonical=structuredClone(snapshotBase);
newerCanonical.version=8;
newerCanonical.actors[0].hp=7;
newerCanonical.actors[1].hp=5;
newerCanonical.actors.push({id:"remote-enemy",name:"Новый враг",team:"enemy",space:"side",x:2,y:0,hp:4,maxHp:4,effects:[]});
const rebasedSnapshot=Network.rebaseSceneSnapshot(snapshotBase,narratorDesired,newerCanonical);
assert.equal(rebasedSnapshot.actors.find(actor=>actor.id==="hero").name,"Переименованный герой","the narrator's local field change survives a rebase");
assert.equal(rebasedSnapshot.actors.find(actor=>actor.id==="hero").hp,7,"an unrelated newer canonical field is preserved");
assert.equal(rebasedSnapshot.actors.find(actor=>actor.id==="enemy").hp,5);
assert.ok(rebasedSnapshot.actors.some(actor=>actor.id==="remote-enemy"),"entities added by another narrator are not erased by a stale snapshot");
assert.equal(rebasedSnapshot.objects.length,0,"an intentional local entity removal remains intentional");

const actionIntent=Network.intentFromEvents(baseScene,[
  {type:"action.prepare",actorId:"hero",payload:{actionId:"action.step",targetIds:["enemy"],request:{useGrasp:true}}},
  {type:"actor.move",actorId:"hero",payload:{space:"side",x:0,y:1}},
],"Шаг");
assert.equal(actionIntent.kind,"action");
assert.deepEqual(JSON.parse(JSON.stringify(actionIntent.destination)),{x:0,y:1});
assert.equal(actionIntent.options.useGrasp,true);
assert.equal("events" in actionIntent,false,"v2 sends intent, not a client-computed event batch");

const actionNamed=name=>data.actions.list.find(action=>action.name===name);
const chargeSource=structuredClone(baseScene);
chargeSource.actors[0].focus=0;
const chargePreview=Engine.prepareAction(chargeSource,data,{actorId:"hero",actionId:actionNamed("Зарядка").id,targetIds:[],roll:{formula:"3D6 ≥4",attribute:"spirit",rolls:[6,5,4],successes:3,crits:1}});
assert.equal(chargePreview.ok,true);
const chargeIntent=Network.intentFromEvents(chargeSource,chargePreview.events,"Зарядка");
const canonicalCharge=Network.materializeIntent(chargeSource,data,chargeIntent,"player-1",{sceneEngine:Engine});
const charged=Engine.dispatchMany(chargeSource,canonicalCharge).scene;
assert.equal(charged.actors[0].focus,3,"Charge is recomputed by the narrator and grants all three Focus");

const stepPreview=Engine.prepareAction(baseScene,data,{actorId:"hero",actionId:actionNamed("Шаг").id,targetIds:[],destination:{x:0,y:1}});
assert.equal(stepPreview.ok,true);
const stepIntent=Network.intentFromEvents(baseScene,stepPreview.events,"Шаг");
const canonicalStep=Network.materializeIntent(baseScene,data,stepIntent,"player-1",{sceneEngine:Engine});
const stepped=Engine.dispatchMany(baseScene,canonicalStep).scene;
assert.equal(stepped.actors[0].x,0);
assert.equal(stepped.actors[0].y,1,"movement is authoritative and arrives as one canonical result");

const planPreview=Engine.prepareActionPlan(baseScene,data,{actorId:"hero",actionId:actionNamed("Шаг").id,phase:"destination",context:{destinationKind:"movement",targetIds:[]}});
assert.equal(planPreview.ok,true);
const planIntent=Network.intentFromEvents(baseScene,planPreview.events,"Подготовка Шага");
assert.equal(planIntent.kind,"action-plan-start");
const canonicalPlan=Network.materializeIntent(baseScene,data,planIntent,"player-1",{sceneEngine:Engine});
const planned=Engine.dispatchMany(baseScene,canonicalPlan).scene;
assert.equal(planned.pendingActionPlan?.phase,"destination");
const continuationPreview=Engine.prepareActionPlanContinuation(planned,data,{actorId:"hero",destination:{x:0,y:1},context:planned.pendingActionPlan.context});
assert.equal(continuationPreview.ok,true);
const continuationIntent=Network.intentFromEvents(planned,continuationPreview.events,"Шаг");
assert.equal(continuationIntent.kind,"action-plan-continue");
const canonicalContinuation=Network.materializeIntent(planned,data,continuationIntent,"player-1",{sceneEngine:Engine});
const continued=Engine.dispatchMany(planned,canonicalContinuation).scene;
assert.equal(continued.actors[0].y,1,"multi-step actions are rebuilt from their authoritative plan");

let reactionRequest=null;
const reactionEvents=Network.materializeIntent(baseScene,data,{kind:"reaction",actorId:"hero",choice:"dodge",destination:{x:0,y:1}},"player-1",{sceneEngine:{respondReaction:(_scene,_data,request)=>{reactionRequest=request;return{ok:true,events:[{type:"reaction.respond",actorId:request.actorId,payload:{choice:request.choice}}]}}}});
assert.equal(reactionRequest.choice,"dodge");
assert.equal(reactionEvents[0].type,"reaction.respond","the narrator rebuilds a Reaction from the player's choice");

let techniqueRequest=null;
const techniqueEvents=Network.materializeIntent(baseScene,data,{kind:"technique",actorId:"hero",ruleId:"test.rule",request:{targetIds:["enemy"]}},"player-1",{
  sceneEngine:Engine,
  techniqueEngine:{
    RULES:[{id:"test.rule"}],
    preview:(_scene,request)=>{techniqueRequest=request;return{ok:true,rule:{id:"test.rule"},events:[{type:"technique.prepare",actorId:request.actorId,payload:{ruleId:"test.rule"}}]}},
    toEvents:(_scene,prepared)=>prepared.events,
  },
});
assert.equal(techniqueRequest.actorId,"hero");
assert.equal(techniqueEvents[0].type,"technique.prepare","the narrator rebuilds a Technique instead of trusting its computed effects");

const mixedTechniqueIntent=Network.intentFromEvents(baseScene,[
  {type:"technique.prepare",actorId:"hero",payload:{ruleId:"test.rule",request:{targetIds:["enemy"]}}},
  {type:"action.prepare",actorId:"hero",payload:{actionId:"action.finish",targetIds:["enemy"]}},
],"Боевая техника");
assert.equal(mixedTechniqueIntent.kind,"technique","a Technique that internally prepares an Action keeps its Technique semantics");

const potionIntent=Network.intentFromEvents(baseScene,[
  {type:"technique.prepare",actorId:"hero",payload:{ruleId:"altruist.alchemist.1",targetIds:["enemy"]}},
  {type:"action.prepare",actorId:"hero",payload:{name:"Зелье: pure-water",targetIds:["enemy"]}},
],"Зелье применено");
assert.deepEqual(JSON.parse(JSON.stringify(potionIntent)),{kind:"potion",label:"Зелье применено",actorId:"hero",targetId:"enemy",potion:"pure-water"});
let potionRequest=null;
const potionEvents=Network.materializeIntent(baseScene,data,potionIntent,"player-1",{sceneEngine:{preparePotionUse:(_scene,_data,request)=>{potionRequest=request;return{ok:true,events:[{type:"inventory.change",actorId:request.actorId,payload:{item:`potion:${request.potion}`,delta:-1}}]}}}});
assert.equal(potionRequest.targetId,"enemy");
assert.equal(potionEvents[0].payload.item,"potion:pure-water","potion effects are rebuilt from the current authoritative Scene");

const invisibleIntent=Network.intentFromEvents(baseScene,[
  {type:"effect.remove",actorId:"hero",payload:{targetId:"hero",effect:"positive.невидим"}},
  {type:"effect.apply",actorId:"hero",payload:{targetId:"hero",effect:"positive.исчез"}},
],"Невидим · Исчезнуть");
assert.equal(invisibleIntent.kind,"invisible-disappear");
const invisibleEvents=Network.materializeIntent(baseScene,data,invisibleIntent,"player-1",{sceneEngine:{prepareInvisibleDisappear:(_scene,actorId)=>({ok:true,events:[{type:"effect.apply",actorId,payload:{targetId:actorId,effect:"positive.исчез"}}]})}});
assert.equal(invisibleEvents[0].actorId,"hero");

const mealIntent=Network.intentFromEvents(baseScene,[{type:"resource.gain",actorId:"hero",payload:{resource:"meals",amount:1}}],"Трапеза возвращена");
assert.equal(mealIntent.kind,"meal");
assert.equal(Network.materializeIntent(baseScene,data,mealIntent,"player-1",{sceneEngine:Engine})[0].type,"resource.gain");

const spellScene=structuredClone(baseScene);
spellScene.actors[0].techniques["ruiner.spellcrafter"]=3;
const modifierIntent=Network.intentFromEvents(spellScene,[{type:"technique.state",actorId:"hero",payload:{key:"spellModifiers",value:["fierce","outstanding"]}}],"Выбор Модификаций");
const modifierEvents=Network.materializeIntent(spellScene,data,modifierIntent,"player-1",{sceneEngine:Engine});
assert.deepEqual(Array.from(modifierEvents[0].payload.value),["fierce","outstanding"]);
assert.throws(()=>Network.materializeIntent(baseScene,data,modifierIntent,"player-1",{sceneEngine:Engine}),/Модификаций/i,"the narrator rechecks the current Technique level");

const woundIntent=Network.intentFromEvents(baseScene,[{type:"damage.apply",actorId:null,payload:{targetId:"hero",amount:999,ignoreArmor:true}}],"Рана");
const woundEvents=Network.materializeIntent(baseScene,data,woundIntent,"player-1",{sceneEngine:Engine});
assert.equal(woundEvents[0].payload.amount,10,"self-wound damage is recomputed from authoritative HP");
assert.equal(woundEvents[0].actorId,null);

const runtimeEvents=Network.materializeIntent(baseScene,data,{kind:"runtime",actorId:"hero",key:"focus",value:1},"player-1",{sceneEngine:Engine});
const runtimeResult=Engine.dispatchMany(baseScene,runtimeEvents).scene;
assert.equal(runtimeResult.actors[0].focus,1,"an owned runtime intent becomes a validated canonical event");
const stressEvents=Network.materializeIntent(baseScene,data,{kind:"runtime",actorId:"hero",key:"stress",value:3},"player-1",{sceneEngine:Engine});
assert.equal(Engine.dispatchMany(baseScene,stressEvents).scene.actors[0].stress,3,"Stress uses the same owned canonical runtime path");
assert.throws(()=>Network.materializeIntent(baseScene,data,{kind:"runtime",actorId:"hero",key:"focus",value:9},"other-player",{sceneEngine:Engine}),/не владеет/i);
assert.throws(()=>Network.materializeIntent(baseScene,data,{kind:"runtime",actorId:"hero",key:"admin",value:9},"player-1",{sceneEngine:Engine}),/ресурса/i);

const sent=[];
const outbox=new Network.PlayerOutbox({tickMs:10000,send:async payload=>sent.push(payload)});
const firstEnvelope=outbox.enqueue({kind:"runtime",actorId:"hero",key:"focus",value:2},7);
assert.deepEqual(
  JSON.parse(JSON.stringify(Network.validateIntentEnvelope(firstEnvelope))),
  JSON.parse(JSON.stringify(firstEnvelope)),
  "the authority accepts a complete v2 envelope",
);
assert.match(firstEnvelope.clientIntentId,/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
assert.throws(()=>Network.validateIntentEnvelope({...firstEnvelope,protocol:1}),/протокола/i);
assert.throws(()=>Network.validateIntentEnvelope({...firstEnvelope,clientIntentId:"not-a-uuid"}),/корректного id/i);
outbox.enqueue({kind:"runtime",actorId:"hero",key:"focus",value:3},7);
outbox.enqueue({kind:"public-roll",actorId:"hero",payload:{}},7);
assert.equal(outbox.pending(),2,"continuous updates coalesce while ordered actions remain queued");
await outbox.flush();
assert.equal(sent.length,1,"one client command leaves the outbox per cadence");
assert.equal(sent[0].intent.value,3);
await outbox.flush();
assert.equal(sent.length,2);
outbox.clear();

let releaseInFlight;
let markInFlight;
const inFlightStarted=new Promise(resolve=>{markInFlight=resolve});
const inFlightGate=new Promise(resolve=>{releaseInFlight=resolve});
const inFlightValues=[];
const racingOutbox=new Network.PlayerOutbox({tickMs:10000,send:async payload=>{inFlightValues.push(payload.intent.value);markInFlight();await inFlightGate}});
racingOutbox.enqueue({kind:"runtime",actorId:"hero",key:"focus",value:2},7);
const racingFlush=racingOutbox.flush();
await inFlightStarted;
racingOutbox.enqueue({kind:"runtime",actorId:"hero",key:"focus",value:3},7);
assert.equal(racingOutbox.pending(),2,"an in-flight value and its newer replacement are both accounted for");
releaseInFlight();
await racingFlush;
assert.equal(racingOutbox.pending(),1,"a successful older request must not discard the value queued while it was in flight");
await racingOutbox.flush();
assert.deepEqual(inFlightValues,[2,3],"the latest resource value is delivered after the in-flight request");
racingOutbox.clear();

let retryAttempts=0;
const retryIds=[];
const retryOutbox=new Network.PlayerOutbox({tickMs:10000,send:async payload=>{retryIds.push(payload.clientIntentId);retryAttempts++;if(retryAttempts===1)throw new Error("temporary")}});
const retryEnvelope=retryOutbox.enqueue({kind:"public-roll",actorId:"hero",payload:{}},7);
await retryOutbox.flush();
assert.equal(retryOutbox.pending(),1,"a failed request remains queued");
await retryOutbox.flush();
assert.deepEqual(retryIds,[retryEnvelope.clientIntentId,retryEnvelope.clientIntentId],"a retry preserves the idempotency key");
retryOutbox.clear();

const boundedOutbox=new Network.PlayerOutbox({tickMs:10000,maxItems:2,send:async()=>{}});
boundedOutbox.enqueue({kind:"public-roll",actorId:"hero",payload:{roll:1}},7);
boundedOutbox.enqueue({kind:"public-roll",actorId:"hero",payload:{roll:2}},7);
assert.throws(()=>boundedOutbox.enqueue({kind:"public-roll",actorId:"hero",payload:{roll:3}},7),/очередь действий заполнена/i);
boundedOutbox.clear();

let authorityBatch=[];
const authority=new Network.AuthorityQueue({tickMs:10000,flush:async items=>{authorityBatch=items}});
authority.enqueue({kind:"snapshot",scene:{version:7},label:"first"});
authority.enqueue({kind:"snapshot",scene:{version:7},label:"latest"});
authority.enqueue({kind:"events",events:[{type:"session-clock.set",payload:{id:"clock",value:1}}]});
authority.enqueue({kind:"events",events:[{type:"session-clock.set",payload:{id:"clock",value:4}}]});
assert.equal(authority.queue.length,2,"a tick keeps only the latest snapshot and latest continuous clock value");
await authority.flush();
assert.equal(authorityBatch.length,2);
assert.equal(authorityBatch.find(item=>item.kind==="snapshot").label,"latest");
assert.equal(authorityBatch.find(item=>item.kind==="events").events[0].payload.value,4);
authority.clear();

const prunedAuthority=new Network.AuthorityQueue({tickMs:10000,flush:async()=>{}});
prunedAuthority.enqueue({kind:"command",command:{id:"11"}});
prunedAuthority.enqueue({kind:"command",command:{id:"12"}});
assert.equal(prunedAuthority.discard(item=>item.command?.id==="11"),1);
assert.deepEqual(Array.from(prunedAuthority.queue,item=>item.command.id),["12"],"commands settled by another narrator are removed before the next tick");
prunedAuthority.clear();

let rejectDiscardedFlush;
let startDiscardedFlush;
const discardedStarted=new Promise(resolve=>{startDiscardedFlush=resolve});
const discardedGate=new Promise((_,reject)=>{rejectDiscardedFlush=reject});
const discardedAuthority=new Network.AuthorityQueue({tickMs:10000,flush:async()=>{startDiscardedFlush();await discardedGate}});
discardedAuthority.enqueue({kind:"command",command:{id:"13"}});
const discardedFlush=discardedAuthority.flush();
await discardedStarted;
assert.equal(discardedAuthority.discard(item=>item.command?.id==="13"),1);
rejectDiscardedFlush(new Error("already settled elsewhere"));
await discardedFlush;
assert.equal(discardedAuthority.pending(),0,"a command settled by another narrator must not return after an in-flight failure");

let rejectAuthorityFlush;
let startAuthorityFlush;
const authorityStarted=new Promise(resolve=>{startAuthorityFlush=resolve});
const authorityGate=new Promise((_,reject)=>{rejectAuthorityFlush=reject});
const clearedAuthority=new Network.AuthorityQueue({tickMs:10000,flush:async()=>{startAuthorityFlush();await authorityGate}});
clearedAuthority.enqueue({kind:"events",events:[{type:"round.end",payload:{}}]});
const clearedFlush=clearedAuthority.flush();
await authorityStarted;
clearedAuthority.clear();
rejectAuthorityFlush(new Error("late failure"));
await clearedFlush;
assert.equal(clearedAuthority.pending(),0,"leaving a table must not resurrect a failed in-flight narrator batch");

const migration=fs.readFileSync(new URL("../../../supabase/migrations/202607290004_network_v2_intent_batches.sql",import.meta.url),"utf8");
assert.match(migration,/create or replace function public\.settle_scene_intent_batch/i);
assert.match(migration,/scene_commands_command_type_check[\s\S]+intent_v2/i,"the deployed command constraint must admit v2 intents");
assert.match(migration,/scene_commands_v2_intent_id_required[\s\S]+client_intent_id is not null/i,"every v2 command needs a durable retry key");
assert.match(migration,/for update/i,"the authoritative tick locks the Scene");
assert.match(migration,/current_scene\.version <> p_expected_version/i);
assert.match(migration,/command_type = 'intent_v2'/i);
assert.match(migration,/client_intent_id/i,"client retries have a stable deduplication key");
assert.match(migration,/event batch size must be 0\.\.192/i);
assert.match(migration,/dropped HTTP response/i,"an acknowledged-but-lost tick has an idempotent retry receipt");
assert.match(migration,/client_event_id in/i);
assert.match(migration,/campaign_id = current_scene\.campaign_id[\s\S]+command_type = 'intent_v2'/i,"a retry receipt must verify the matching commands as well as event ids");

console.log("Network v2 QA passed: local UI isolation, structured intents, ownership, coalescing, and atomic ticks");
