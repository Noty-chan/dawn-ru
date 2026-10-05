import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const firstSceneId="00000000-0000-4000-8000-000000000111";
const secondSceneId="00000000-0000-4000-8000-000000000112";
const context={structuredClone,normalizeScene:value=>structuredClone(value),sceneCore:value=>structuredClone(value),console};
context.globalThis=context;
context.window=context;
vm.runInNewContext(fs.readFileSync(new URL("../network-v2.js",import.meta.url),"utf8"),context);
context.NetworkV2=context.DAWN_NETWORK_V2;

const oldSnapshot={version:3,name:"Old table before edit",spaces:[{id:"room",width:7,height:7}],activeSpace:"room",actors:[{id:"old-hero",name:"Old hero"}],undo:[],redo:[],turnUndo:[]};
const oldScene={
  version:4,name:"Old table",spaces:[{id:"room",width:7,height:7}],activeSpace:"room",tool:"erase",
  actors:[{id:"old-hero",name:"Old hero"}],selectedActor:"old-hero",targetIds:["old-hero"],targetCells:["1,1"],
  undo:[{id:"old-table-undo",label:"Old table edit",state:oldSnapshot}],
  redo:[{id:"old-table-redo",label:"Old table redo",state:oldSnapshot}],
  turnUndo:[{id:"old-table-turn",label:"Old table turn",state:oldSnapshot,checkpoint:"turn-start"}],
  challengeRequest:null,opposedRoll:null,
};
const secondScene={version:8,name:"Second table",spaces:[{id:"main",width:7,height:7},{id:"room",width:7,height:7}],activeSpace:"main",actors:[{id:"old-hero",name:"New table hero"}],undo:[],redo:[],turnUndo:[]};
const thirdScene={version:2,name:"First table reopened",spaces:[{id:"room",width:7,height:7}],activeSpace:"room",actors:[{id:"old-hero",name:"Old hero"}],undo:[],redo:[],turnUndo:[]};
const syncState={sceneId:secondSceneId,canNarrate:true,role:"owner"};
Object.assign(context,{
  Scene:oldScene,
  Sync:{state:()=>syncState},
  store:{mode:"tools",sceneSessionId:firstSceneId},
  pendingSceneCommands:[{id:"old-command"}],
  pendingCommandSceneId:firstSceneId,
  automaticCommandAttempts:new Map([["old-command","v2"]]),
  automaticCommandRetries:new Map([["old-command",2]]),
  delayedAutomaticCommands:new Set(["old-command"]),
  mergeNetworkV2Scene:(remote,current)=>context.NetworkV2.mergeRemoteScene(remote,current),
  hydratePlayerScene:scene=>scene,
  resetToolsRollResult(){},persist(){},renderPlay(){},renderToolsWorkspace(){},
  reconcileSceneResultsDialog(){},renderChallengeRequestDock(){},
  currentChallengeRequest:()=>null,currentOpposedParticipant:()=>null,
  queueAutomaticCommands(){},toast(){},
});

const appSyncSource=fs.readFileSync(new URL("../app-sync-events.js",import.meta.url),"utf8");
const listenerStart=appSyncSource.indexOf('Sync?.on("scene",payload=>{');
const listenerEnd=appSyncSource.indexOf('\nSync?.on("commands"',listenerStart);
assert.ok(listenerStart>=0&&listenerEnd>listenerStart,"the production scene listener is present");
const registration=appSyncSource.slice(listenerStart,listenerEnd).trim();
const prefix='Sync?.on("scene",payload=>{';
assert.ok(registration.startsWith(prefix)&&registration.endsWith("});"));
const handlerBody=registration.slice(prefix.length,-2);
vm.runInNewContext(`this.handleScene=payload=>{${handlerBody}`,context,{filename:"app-sync-events.js#scene-listener"});

context.handleScene({state:secondScene,version:secondScene.version});
assert.deepEqual(Array.from(context.Scene.actors,actor=>actor.id),["old-hero"]);
assert.equal(context.Scene.actors[0].name,"New table hero","the overlapping id refers to the new table's actor");
assert.deepEqual(Array.from(context.Scene.undo),[],"undo history from another table is discarded before the remote projection merge");
assert.deepEqual(Array.from(context.Scene.redo),[]);
assert.deepEqual(Array.from(context.Scene.turnUndo),[]);
assert.equal(context.Scene.selectedActor,null,"a selected actor from another table is not restored by an ID collision");
assert.deepEqual(Array.from(context.Scene.targetIds),[]);
assert.deepEqual(Array.from(context.Scene.targetCells),[]);
assert.equal(context.Scene.tool,"select");
assert.equal(context.Scene.activeSpace,"main","a previously selected room from the old table is not carried over");
assert.equal(context.pendingSceneCommands.length,0);
assert.equal(context.store.sceneSessionId,secondSceneId,"the local Scene is durably bound to the table whose snapshot was merged");

// Reopening the first table is another scene switch and must not revive its
// previous local undo stack or selections.
syncState.sceneId=firstSceneId;
context.handleScene({state:thirdScene,version:thirdScene.version});
assert.deepEqual(Array.from(context.Scene.actors,actor=>actor.id),["old-hero"]);
assert.deepEqual(Array.from(context.Scene.undo),[]);
assert.equal(context.Scene.selectedActor,null);
assert.deepEqual(Array.from(context.Scene.targetIds),[]);
assert.equal(context.store.sceneSessionId,firstSceneId);

// A disconnect/leave clears the in-memory table marker; joining again starts
// a fresh local UI context even when the user reopens that same table.
const statusStart=appSyncSource.indexOf('Sync?.on("status",()=>{');
const statusEnd=appSyncSource.indexOf('\nSync?.on("presence"',statusStart);
assert.ok(statusStart>=0&&statusEnd>statusStart,"the production status listener is present");
const statusRegistration=appSyncSource.slice(statusStart,statusEnd).trim();
const statusPrefix='Sync?.on("status",()=>{';
assert.ok(statusRegistration.startsWith(statusPrefix)&&statusRegistration.endsWith("});"));
const statusBody=statusRegistration.slice(statusPrefix.length,-2);
Object.assign(context,{renderSync(){},renderChallengeRequestDock(){}});
vm.runInNewContext(`this.handleStatus=()=>{${statusBody}`,context,{filename:"app-sync-events.js#status-listener"});
syncState.sceneId=null;
context.handleStatus();
assert.equal(context.pendingCommandSceneId,null);
syncState.sceneId=firstSceneId;
context.Scene.selectedActor="old-hero";
context.Scene.targetIds=["old-hero"];
context.Scene.undo=[{id:"left-before-rejoin",label:"stale",state:oldSnapshot}];
context.handleScene({state:thirdScene,version:thirdScene.version});
assert.deepEqual(Array.from(context.Scene.undo),[],"rejoining after leave clears stale undo even when it is the same table");
assert.equal(context.Scene.selectedActor,null);
assert.deepEqual(Array.from(context.Scene.targetIds),[]);

// A newer projection for the same table should retain that table's local UI
// history, since it still belongs to the active session.
context.Scene.undo=[{id:"same-table-undo",label:"Same table edit",state:thirdScene}];
context.Scene.selectedActor="old-hero";
context.Scene.targetIds=["old-hero"];
context.handleScene({state:{...thirdScene,version:3},version:3});
assert.equal(context.Scene.undo[0].id,"same-table-undo");
assert.equal(context.Scene.selectedActor,"old-hero");
assert.deepEqual(Array.from(context.Scene.targetIds),["old-hero"]);

console.log("Network table-switch QA passed: scene-local history and selection never cross tables");
