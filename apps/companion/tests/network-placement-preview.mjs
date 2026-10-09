import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../scene-sync-ui.js",import.meta.url),"utf8");
const start=source.indexOf("let networkV2Authority=null"),end=source.indexOf("function mergeNetworkV2Scene",start);
assert.ok(start>=0&&end>start);
const token={classList:{classes:new Set(),add(value){this.classes.add(value)}},setAttribute(name,value){this[name]=value}};
const cells=new Map([["0,0",{appendChild(){}}],["0,1",{appendChild(node){this.token=node}}]]);
const actor={id:"hero",name:"Герой",space:"main",x:0,y:0};
const context={
  Scene:{actors:[actor],spaces:[{id:"main",width:7,height:7}],activeSpace:"main"},
  Sync:{state:()=>({sceneId:"scene-1"})},
  CSS:{escape:value=>value},
  document:{querySelector(selector){if(selector.startsWith("[data-scene-actor="))return token;const match=selector.match(/data-scene-cell="([^"]+)/);return cells.get(match?.[1])||null}},
  renderSceneBoard:()=>{context.renders=(context.renders||0)+1},
};
vm.createContext(context);
vm.runInContext(`${source.slice(start,end)}\nthis.previewNetworkPlacement=previewNetworkPlacement;this.clearPendingNetworkPlacement=clearPendingNetworkPlacement;this.pendingNetworkPlacements=pendingNetworkPlacements;`,context);
const row={clientIntentId:"intent-1"};
context.previewNetworkPlacement(row,[{type:"actor.move",actorId:"hero",payload:{placement:true,space:"main",x:0,y:1}}],"hero");
assert.equal(actor.y,0,"visual preview must not mutate canonical rules state");
assert.equal(cells.get("0,1").token,token,"token appears at the chosen cell immediately");
assert.ok(token.classList.classes.has("pending-network"),"preview is visibly marked as provisional");
context.clearPendingNetworkPlacement({client_intent_id:"intent-1"});
assert.equal(context.pendingNetworkPlacements.size,0,"rejection removes the provisional position");
assert.equal(context.renders,1,"rejection redraws the canonical board");
console.log("Network placement preview QA passed: immediate visual position, unchanged rules state, rejection rollback");

// Real reducers: provisional manual commands never advance confirmed state,
// replay does not double-count, and removing a rejected command rolls back.
const {loadSceneEngine}=await import('./load-scene-engine.mjs');
const optimistic={window:{},console,Scene:{tablePolicy:{mode:'manual',epoch:1},version:0,actors:[{id:'hero',name:'Hero',space:'main',x:0,y:0,hp:10,maxHp:10,focus:0}],spaces:[{id:'main',width:7,height:7}],activeSpace:'main',log:[]},renderSceneBoard(){},Sync:{state:()=>({sceneId:'qa'})}};
vm.createContext(optimistic);optimistic.SceneEngine=loadSceneEngine(optimistic);optimistic.window.DAWN_TABLE_POLICY.install();
vm.runInContext(source.slice(start,end)+'\nthis.project=projectPendingManualScene;this.pending=pendingManualUiIntents;this.setAuthority=q=>networkV2Authority=q;',optimistic);
const provisional={id:'manual-ui-1',type:'table.command',actorId:'hero',payload:{kind:'resource',values:{focus:2}}};
optimistic.setAuthority({queue:[{kind:'events',events:[provisional]}]});
const confirmed=structuredClone(optimistic.Scene),view=optimistic.project(confirmed);
assert.equal(view.actors[0].focus,2);assert.equal(confirmed.actors[0].focus,0);assert.equal(view.version,0);
const accepted=optimistic.SceneEngine.dispatchMany(confirmed,[provisional]).scene;
assert.equal(optimistic.project(accepted).log.length,1,'late acknowledgement does not replay a provisional command twice');
optimistic.setAuthority({queue:[],failed:[{kind:'events',events:[provisional]}]});
assert.equal(optimistic.project(confirmed).actors[0].focus,0,'failed command restores confirmed resource');
optimistic.pending.set('player-1',{events:[provisional],commandId:'command-1'});
assert.equal(optimistic.project(confirmed).actors[0].focus,2,'player sees local command before acknowledgement');
optimistic.project(accepted);assert.equal(optimistic.pending.size,0,'accepted receipt retires player preview');
console.log('Manual provisional view: immediate resource, immutable confirmed state, exact replay and rejection rollback passed');
