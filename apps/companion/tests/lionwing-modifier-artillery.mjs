import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {loadSceneEngine} from "./load-scene-engine.mjs";

const context={window:{},console};vm.createContext(context);
for(const file of ["data.js","edition-lionwing.js","lionwing-table-data.js","logic.js"])
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
const engine=loadSceneEngine(context),data=context.window.DAWN_DATA;
const actor=(id,team,x,y,extra={})=>({id,name:id,kind:team==="hero"?"hero":"enemy",team,rulesEdition:"lionwing",space:"main",x,y,hp:20,maxHp:20,ap:0,baseAp:0,tier:2,speed:3,armor:0,evasion:0,effects:[],usedActions:[],acted:true,knockedOut:false,...extra});
const base=()=>({rulesEdition:"lionwing",version:0,round:1,turnSerial:1,activeActorId:null,tension:3,spaces:[{id:"main",width:7,height:7}],actors:[
  actor("foe","enemy",5,5),actor("artillery","enemy",5,5,{profileId:"lionwing.modifier.artillery",hp:0,maxHp:0,hidden:true,modifierState:{}}),
  actor("inside","hero",1,1),actor("outside","hero",6,0),
],objects:[],walls:[],markers:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[],lionwing:{started:true,lastTeam:"enemy",lastActorId:"foe"}});
const cells=(left,top)=>Array.from({length:9},(_,i)=>`${left+i%3},${top+Math.floor(i/3)}`);
const commit=(scene,plan,prefix)=>engine.dispatchMany(scene,plan.events.map((event,index)=>({...event,id:`${prefix}-${index}`})),{expectedVersion:scene.version}).scene;
let scene=base();
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"artillery",mode:"square3",cells:cells(0,0).slice(1)}).ok,false,"Artillery needs an exact 3×3 Zone");
const lineCells=[...Array.from({length:7},(_,x)=>`${x},0`),...Array.from({length:7},(_,x)=>`${x},2`)];
const edgeCells=[];for(let y=0;y<7;y++)for(let x=0;x<7;x++)if(x===0||y===0||x===6||y===6)edgeCells.push(`${x},${y}`);
for(const [mode,shape] of [["lines",lineCells],["rect2x5",Array.from({length:10},(_,i)=>`${i%2},${Math.floor(i/2)}`)],["edges",edgeCells]])
  assert.equal(engine.prepareModifierConfigure(scene,{actorId:"artillery",mode,cells:shape}).ok,true,`${mode} is a canonical Artillery shape`);
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"artillery",mode:"lines",cells:[...lineCells.slice(0,7),...Array.from({length:7},(_,x)=>`${x},1`)]}).ok,false,"the two lines cannot be adjacent");
let plan=engine.prepareModifierConfigure(scene,{actorId:"artillery",mode:"square3",cells:cells(0,0)});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"artillery-configure");
assert.equal(scene.objects.find(item=>item.metadata?.enemyModifier==="artillery")?.cells.length,9);
assert.equal(engine.prepareModifierConfigure(scene,{actorId:"artillery",mode:"rect2x5",cells:cells(0,0)}).ok,false,"the chosen shape stays fixed");
scene=engine.dispatchMany(scene,[{id:"artillery-round-1",type:"round.end",payload:{}}]).scene;
assert.equal(scene.tension,4,"the LionWing round advances Tension after its end");
assert.equal(scene.actors.find(item=>item.id==="inside").hp,17,"Artillery uses the ended Round's Tension of 3");
assert.equal(scene.actors.find(item=>item.id==="outside").hp,20);
assert.equal(scene.pendingPrompt?.kind,"modifier-refresh");
plan=engine.prepareModifierConfigure(scene,{actorId:"artillery",mode:"square3",cells:cells(3,3)});
assert.equal(plan.ok,true,plan.errors?.join(" "));
scene=commit(scene,plan,"artillery-new-area");
const answer=engine.respondRulePrompt(scene,data,{choice:"confirm"});
assert.equal(answer.ok,true,answer.errors?.join(" "));
scene=commit(scene,answer,"artillery-confirm");
assert.equal(scene.pendingPrompt,null);
assert.equal(scene.objects.find(item=>item.metadata?.enemyModifier==="artillery")?.cells.includes("3,3"),true);
const defeated=base();defeated.actors.find(item=>item.id==="foe").knockedOut=true;
const defeatedConfigured=commit(defeated,engine.prepareModifierConfigure(defeated,{actorId:"artillery",mode:"square3",cells:cells(0,0)}),"artillery-defeated");
const defeatedRound=engine.dispatchMany(defeatedConfigured,[{id:"artillery-defeated-round",type:"round.end",payload:{}}]).scene;
assert.equal(defeatedRound.actors.find(item=>item.id==="inside").hp,20,"alongside modifier stops when no enemies remain alive");
assert.equal(defeatedRound.pendingPrompt==null,true);
console.log("LionWing Artillery: exact shape, Round-end Tension, damage and refresh passed");
