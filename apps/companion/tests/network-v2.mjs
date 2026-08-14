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
const historyScene=structuredClone(baseScene);
historyScene.undo=Array.from({length:25},(_,index)=>({id:`undo-${index}`,state:{},...(index===24?{checkpoint:"turn-start"}:{})}));
const historyMerged=Network.mergeRemoteScene(remote,historyScene);
assert.equal(historyMerged.undo.length,20);
assert.ok(historyMerged.undo.some(entry=>entry.checkpoint==="turn-start"),"network merges preserve the latest Turn-start checkpoint beyond the ordinary undo window");

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
const punishmentScene=structuredClone(baseScene);
punishmentScene.activeActorId="enemy";
punishmentScene.pendingPrompt={id:"punishment-player-2",kind:"sentry-punishment",sourceActorId:"hero",targetId:"enemy",title:"Наказание",options:["punish-paid","pass"],context:{basePunishment:true,stop:{space:"side",x:1,y:0}}};
const punishmentPreview=Engine.respondRulePrompt(punishmentScene,data,{choice:"punish-paid",roll:{formula:"3D6",attribute:"talent",rolls:[6,4,2],successes:2,crits:1}});
assert.equal(punishmentPreview.ok,true);
assert.ok(punishmentPreview.events.some(event=>event.type==="action.prepare"),"Punishment is an answer that atomically opens an Attack");
const punishmentIntent=Network.intentFromEvents(punishmentScene,punishmentPreview.events,"Наказание");
assert.equal(punishmentIntent.kind,"rule-response","a rule answer must outrank the derived Attack during network classification");
assert.equal(punishmentIntent.promptId,"punishment-player-2");
const canonicalPunishment=Network.materializeIntent(punishmentScene,data,punishmentIntent,"player-1",{sceneEngine:Engine});
const onlinePunishment=Engine.dispatchMany(punishmentScene,canonicalPunishment).scene;
assert.equal(onlinePunishment.pendingPrompt,null,"the authoritative batch answers the prompt before opening Punishment");
assert.equal(onlinePunishment.pendingAction?.name,"Наказание");
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

const deploymentScene=structuredClone(baseScene);
deploymentScene.activeActorId=null;
deploymentScene.actors.forEach(actor=>{actor.acted=false});
deploymentScene.objects=[{id:"custom-hero-deploy",type:"deploy-hero",space:"side",cells:["1,2","2,2"]}];
const deploymentEvents=[
  {type:"actor.move",actorId:"hero",payload:{space:"side",x:2,y:2,movement:"Развертывание",placement:true}},
  {type:"actor.enter",actorId:"hero",payload:{space:"side",x:2,y:2,movement:"Развертывание",placement:true}},
];
const deploymentIntent=Network.intentFromEvents(deploymentScene,deploymentEvents,"Развертывание: Герой");
assert.equal(deploymentIntent.kind,"deployment","pre-combat placement has a dedicated safe online intent");
const canonicalDeployment=Network.materializeIntent(deploymentScene,data,deploymentIntent,"player-1",{sceneEngine:Engine});
const deployed=Engine.dispatchMany(deploymentScene,canonicalDeployment).scene;
assert.deepEqual([deployed.actors[0].x,deployed.actors[0].y],[2,2],"a player can reposition inside a custom hero deployment zone");
assert.throws(()=>Network.materializeIntent(deploymentScene,data,{...deploymentIntent,destination:{space:"side",x:3,y:3}},"player-1",{sceneEngine:Engine}),/только в зоне/i,"the authority still rejects placement outside the custom zone");

const onlineBladeScene=structuredClone(baseScene);
onlineBladeScene.actors[0].x=0;onlineBladeScene.actors[0].y=0;onlineBladeScene.actors[0].techniques={"vagabond.master-at-arms":1};
onlineBladeScene.actors[1].x=2;onlineBladeScene.actors[1].y=0;
const onlineBladePreview=Engine.prepareAction(onlineBladeScene,data,{actorId:"hero",actionId:actionNamed("Стычка").id,targetIds:["enemy"],armamentMode:"blade",armamentDestination:{x:1,y:0},roll:{formula:"3D6 ≥4",attribute:"talent",rolls:[5,4,2],successes:2,crits:0}});
assert.equal(onlineBladePreview.ok,true);
const onlineBladeIntent=Network.intentFromEvents(onlineBladeScene,onlineBladePreview.events,"Стычка · Клинок");
assert.equal(onlineBladeIntent.options.armamentMode,"blade","the player's network intent retains the selected Armament");
assert.deepEqual(JSON.parse(JSON.stringify(onlineBladeIntent.options.armamentDestination)),{x:1,y:0},"the player's network intent retains Blade movement");
const canonicalBlade=Network.materializeIntent(onlineBladeScene,data,onlineBladeIntent,"player-1",{sceneEngine:Engine});
assert.ok(canonicalBlade.some(event=>event.type==="actor.move"&&event.payload.movement.startsWith("Клинок")),"the narrator rebuilds Blade movement from the safe intent");
assert.ok(canonicalBlade.some(event=>event.type==="attack.pending"&&event.payload.armamentMode==="blade"),"the narrator rebuilds the complete Blade Skirmish instead of dropping it after submission");

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

const wispTurn=structuredClone(baseScene);
wispTurn.actors[0].techniques={"altruist.will-o-wisp":3};
wispTurn.markers=[{id:"wisp-online",space:"side",x:0,y:0,markerKind:"ritual",label:"Духовное пламя",source:"altruist.will-o-wisp.1",ruleId:"altruist.will-o-wisp.1",duration:"scene",ownerActorId:"hero",metadata:{spiritTypes:["dreamy"]}}];
const turnEndIntent=Network.intentFromEvents(wispTurn,[{type:"turn.end",actorId:"hero",payload:{}}],"Герой: завершён Ход");
assert.equal(turnEndIntent.kind,"turn-end","a player can send the end of their own Turn as a safe intent");
const canonicalTurnEnd=Network.materializeIntent(wispTurn,data,turnEndIntent,"player-1",{sceneEngine:Engine});
const endedWispTurn=Engine.dispatchMany(wispTurn,canonicalTurnEnd).scene;
assert.equal(endedWispTurn.activeActorId,null,"the authoritative table ends the player's Turn");
assert.equal(endedWispTurn.pendingPrompt?.kind,"wisp-move-select","Will-O-Wisp receives its end-of-Turn flame movement choice online");
assert.throws(()=>Network.materializeIntent({...wispTurn,activeActorId:"enemy"},data,turnEndIntent,"player-1",{sceneEngine:Engine}),/текущий Ход/i,"a player cannot end another participant's Turn");

let reactionRequest=null;
const reactionEvents=Network.materializeIntent(baseScene,data,{kind:"reaction",actorId:"hero",choice:"dodge",destination:{x:0,y:1}},"player-1",{sceneEngine:{respondReaction:(_scene,_data,request)=>{reactionRequest=request;return{ok:true,events:[{type:"reaction.respond",actorId:request.actorId,payload:{choice:request.choice}}]}}}});
assert.equal(reactionRequest.choice,"dodge");
assert.equal(reactionEvents[0].type,"reaction.respond","the narrator rebuilds a Reaction from the player's choice");
const clashPayload={defenderRoll:{formula:"4D6 · Столкновение",rolls:[6,5,4,1],successes:3,crits:1},attackerRoll:{formula:"4D6 · Столкновение",rolls:[4,2,2,1],successes:1,crits:0},defenderWins:true};
const clashIntent=Network.intentFromEvents(baseScene,[{type:"roll.public",actorId:"hero",payload:clashPayload.defenderRoll},{type:"roll.public",actorId:"enemy",payload:clashPayload.attackerRoll},{type:"reaction.respond",actorId:"hero",payload:{choice:"action.clash",clash:clashPayload}}],"Столкновение");
assert.deepEqual(JSON.parse(JSON.stringify(clashIntent.clash)),clashPayload,"an online Clash must retain both opposed rolls");
Network.materializeIntent(baseScene,data,clashIntent,"player-1",{sceneEngine:{respondReaction:(_scene,_data,request)=>{reactionRequest=request;return{ok:true,events:[{type:"reaction.respond",actorId:request.actorId,payload:{choice:request.choice,clash:request.clash}}]}}}});
assert.deepEqual(JSON.parse(JSON.stringify(reactionRequest.clash)),clashPayload,"the narrator must receive the player's complete defensive Clash");

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
const networkChallenge=Engine.dispatch(baseScene,{type:"challenge.request",payload:{id:"network-challenge",actorId:"hero",target:3,requestedBy:"Нарратор"}}).scene;
const networkDiceRequest={scope:"challenge",baseCount:4,advantage:0,hindrance:0,attribute:null,usesAbility:false,abilityKey:null,selectedHookIds:[],targetIds:[],hooks:[]};
const networkDice=Engine.diceRollPayload(networkChallenge,"hero",networkDiceRequest,{rolls:[5,4,2,1]});
assert.equal(networkDice.available,true);
const networkRollEvent={type:"roll.public",actorId:"hero",payload:{...networkDice.payload,actor:"Герой",outcome:"Провал",target:3,challengeRequestId:"network-challenge"}};
const networkRollIntent=Network.intentFromEvents(networkChallenge,[networkRollEvent],"Публичный бросок");
assert.equal(networkRollIntent.kind,"public-roll");
const canonicalNetworkRoll=Network.materializeIntent(networkChallenge,data,networkRollIntent,"player-1",{sceneEngine:Engine});
const networkRolled=Engine.dispatchMany(networkChallenge,canonicalNetworkRoll).scene;
assert.equal(networkRolled.rollFeed[0].challengeRequestId,"network-challenge","A requested online roll survives the complete player-intent and Narrator-authority path");
assert.equal(networkRolled.rollFeed[0].successes,2);
assert.equal(networkRolled.challengeRequest.result.successes,2,"The authoritative network request exposes the player's result to the Narrator");
assert.equal(networkRolled.challengeRequest.result.rolls.join(","),"5,4,2,1");
const networkOpposed=Engine.dispatch(baseScene,{type:"opposed.request",payload:{id:"network-opposed",requestedBy:"Нарратор",participants:[
  {id:"network-player-side",actorId:"hero",heroId:"sheet-1",name:"Герой",controller:"participant",pool:4},
  {id:"network-enemy-side",actorId:"enemy",name:"Противник",controller:"narrator",pool:6},
]}}).scene;
const opposedDice=Engine.diceRollPayload(networkOpposed,"hero",networkDiceRequest,{rolls:[6,4,2,1]});
const opposedRollEvent={type:"roll.public",actorId:"hero",payload:{...opposedDice.payload,actor:"Герой",outcome:"Встречный бросок",opposedRequestId:"network-opposed",opposedParticipantId:"network-player-side",opposedAttempt:1}};
const opposedRollIntent=Network.intentFromEvents(networkOpposed,[opposedRollEvent],"Публичный встречный бросок");
const canonicalOpposedRoll=Network.materializeIntent(networkOpposed,data,opposedRollIntent,"player-1",{sceneEngine:Engine});
const networkOpposedRolled=Engine.dispatchMany(networkOpposed,canonicalOpposedRoll).scene;
assert.equal(networkOpposedRolled.opposedRoll.results["network-player-side"].successes,2,"An online opposed result is stored for the owned participant");
assert.throws(()=>Network.materializeIntent(networkOpposed,data,opposedRollIntent,"other-player",{sceneEngine:Engine}),/не владеет/i,"Another player cannot submit this side's opposed result");

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
