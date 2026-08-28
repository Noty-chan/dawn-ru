import assert from "node:assert/strict";
import { loadSceneEngine } from "./load-scene-engine.mjs";
const c={console,Date};c.globalThis=c;c.window=c;loadSceneEngine(c);const E=c.DAWN_SCENE_ENGINE;
const enemy=(id,profileId,x,y,extra={})=>({id,kind:"enemy",team:"enemy",name:id,profileId,tier:1,space:"main",x,y,hp:13,maxHp:13,ap:2,baseAp:2,speed:2,armor:0,evasion:0,effects:[],usedActions:[],acted:true,modifierState:{},...extra});
const hero=(id,x,y)=>({id,kind:"hero",team:"hero",name:id,space:"main",x,y,hp:30,maxHp:30,ap:3,baseAp:3,speed:4,armor:0,evasion:0,effects:[],usedActions:[],acted:true});
const base=()=>({version:0,round:1,tension:3,turnSerial:0,activeActorId:null,spaces:[{id:"main",width:7,height:7}],actors:[hero("h1",0,0),hero("h2",6,6),enemy("carrier","enemy.common.bruiser",3,3)],objects:[],markers:[],walls:[],topology:{cuts:[]},sessionClocks:[],reminders:[],log:[],rollFeed:[],targetIds:[],targetCells:[],triggerQueue:[]});
{
 const s=base();s.actors.push(enemy("haven","enemy.modifier.haven",5,5,{hp:0,maxHp:0,armor:1}));const cells=[];for(let y=1;y<=3;y++)for(let x=1;x<=3;x++)cells.push(`${x},${y}`);const p=E.prepareModifierConfigure(s,{actorId:"haven",carrierId:"carrier",cells});assert.equal(p.ok,true);const configured=E.dispatchMany(s,p.events).scene;assert.ok(configured.objects.some(o=>o.metadata?.enemyModifier==="haven"&&o.cells.length===9));const result=E.dispatchMany(configured,[{id:"haven-round",type:"round.end",payload:{narratorOverride:true}}],{narratorOverride:true}).scene;assert.equal(result.actors.find(a=>a.id==="h1").hp,27);assert.equal(result.pendingPrompt?.kind,"modifier-refresh");assert.equal(E.prepareModifierConfigure(s,{actorId:"haven",carrierId:"carrier",cells:cells.slice(1)}).ok,false);
}
{
 const s=base();s.actors.push(enemy("vip","enemy.modifier.vip",5,5));const r=E.dispatchMany(s,[{id:"vip-down",type:"actor.knockout",actorId:"carrier",payload:{targetId:"vip"}}]).scene;assert.ok(r.actors.filter(a=>a.team==="hero").every(a=>a.knockedOut));
}
{
 const s=base();s.actors.push(enemy("legion","enemy.modifier.legion",5,5,{hp:20,maxHp:20}));const r=E.dispatchMany(s,[{id:"foe-down",type:"actor.knockout",actorId:"h1",payload:{targetId:"carrier"}}]).scene;assert.equal(r.actors.find(a=>a.id==="legion").hp,10);
}
{
 const s=base();s.actors.push(enemy("vortex","enemy.modifier.vortex",5,5,{hp:0,maxHp:0,armor:2}));const configured=E.dispatchMany(s,E.prepareModifierConfigure(s,{actorId:"vortex",carrierId:"carrier",targetId:"h1"}).events).scene,r=E.dispatchMany(configured,[{id:"vortex-round",type:"round.end",payload:{narratorOverride:true}}],{narratorOverride:true}).scene;assert.equal(r.actors.filter(a=>a.crowdSubtype==="vortex").length,4);
}
{
 const s=base();s.actors.push(enemy("collateral","enemy.modifier.collateral",5,5,{hp:7,maxHp:7}));const p=E.prepareModifierConfigure(s,{actorId:"collateral",cells:["1,0","2,0","3,0"]});assert.equal(p.ok,true);const deployed=E.dispatchMany(s,p.events).scene;assert.equal(deployed.actors.filter(a=>a.profileId==="enemy.modifier.collateral").length,3);assert.equal(deployed.sessionClocks[0].size,2);const down=E.dispatchMany(deployed,[{id:"collateral-down",type:"actor.knockout",actorId:"carrier",payload:{targetId:"collateral"}}]).scene;assert.equal(down.sessionClocks[0].value,1);
 const rescue=E.prepareCollateralRescue(deployed,{collateralId:"collateral",rescuerId:"h1",roll:{formula:"3D6",rolls:[6,5,4],successes:3,crits:1}});assert.equal(rescue.ok,true);const rescued=E.dispatchMany(deployed,rescue.events).scene;assert.equal(rescued.actors.some(a=>a.id==="collateral"),false);assert.equal(rescued.sessionClocks[0].value,0,"A rescued Collateral does not advance the danger clock");
}
{
 const s=base();s.actors.push(enemy("earth","enemy.modifier.earthquake",5,5,{hp:0,maxHp:0,evasion:15}));const e=E.prepareModifierConfigure(s,{actorId:"earth",carrierId:"carrier",mode:"inward"}).events[0],once=E.dispatch(s,{...e,id:"stable-modifier"}).scene;assert.equal(E.dispatch(once,{...e,id:"stable-modifier"}).duplicate,true);assert.throws(()=>E.dispatch(once,{...e,id:"forged",payload:{...e.payload,state:{...e.payload.state,carrierId:"h1"}}}));
}
{
 const s=base();s.actors.push(enemy("giant","enemy.modifier.giant",5,5,{hp:0,maxHp:0,armor:1,speed:1}));const r=E.dispatchMany(s,E.prepareModifierConfigure(s,{actorId:"giant",carrierId:"carrier"}).events).scene,carrier=r.actors.find(a=>a.id==="carrier");assert.equal(carrier.occupiedWidth,2);assert.equal(E.actorIdsInCells(r,"main",["4,4"],{}).includes("carrier"),true,"Any cell of a Giant's 2×2 footprint targets its carrier");assert.equal(E.effectCellOccupancyStatus(r,"h1",{space:"main",x:4,y:4}).available,false);
}
{
 const s=base();s.actors.push(enemy("garg","enemy.modifier.gargantuan",5,5,{hp:0,maxHp:0,armor:1,evasion:15}));const p=E.prepareModifierConfigure(s,{actorId:"garg",carrierId:"carrier",mode:"right"});assert.equal(p.ok,true);const r=E.dispatchMany(s,p.events).scene;assert.equal(r.spaces[0].width,8);assert.equal(r.spaces[0].mode,"custom");assert.equal(r.objects.find(o=>o.metadata?.enemyModifier==="gargantuan-body")?.cells.length,7);
 const roll={formula:"5D6",rolls:[1,2,3,4,5],successes:2,crits:0},cells=["0,0","1,0","0,1","1,1"];
 assert.equal(E.prepareModifierAction(r,{actorId:"garg",action:"gargantuan-strike",cells:["0,0","2,0","0,2","2,2"],roll}).ok,false,"Scattered cells are not a 2×2 cover");
 const struck=E.dispatchMany(r,E.prepareModifierAction(r,{actorId:"garg",action:"gargantuan-strike",cells,roll}).events).scene,terrain=struck.objects.find(o=>o.metadata?.enemyModifier==="gargantuan");assert.ok(terrain);
 const before=E.compoundEnemyStatus(struck,"carrier").hp,redirected=E.dispatchMany(struck,[{id:"redirect-terrain",type:"object.damage",actorId:"h1",payload:{objectId:terrain.id,amount:3}}]).scene;assert.equal(E.compoundEnemyStatus(redirected,"carrier").hp,before-3,"Damage to Gargantuan terrain redirects into the compound and cannot be evaded");assert.equal(redirected.objects.find(o=>o.id===terrain.id).hp,terrain.hp,"Redirected terrain itself is not damaged");
}
{
 const s=base(),carrier=s.actors.find(a=>a.id==="carrier");carrier.compoundId="shared";s.actors.push(enemy("collateral","enemy.modifier.collateral",5,5,{hp:7,maxHp:7,compoundId:"shared"}));assert.equal(E.compoundEnemyStatus(s,"carrier").active,false,"Collateral never adds its HP to a compound");assert.equal(E.compoundEnemyStatus(s,"collateral").active,false,"Collateral remains an individual target");
}
{
 const s=base();s.actors.push(enemy("giant","enemy.modifier.giant",5,5,{hp:0,maxHp:0,armor:1,speed:1}));const configured=E.dispatchMany(s,E.prepareModifierConfigure(s,{actorId:"giant",carrierId:"carrier"}).events).scene;configured.walls.push({id:"wall",space:"main",a:"4,3",b:"5,3",hp:10,maxHp:10});assert.equal(E.prepareModifierAction(configured,{actorId:"giant",action:"giant-charge",destination:{x:5,y:3}}).ok,false,"A wall blocks every edge of the 2×2 charge footprint");
}
console.log("Enemy modifier QA passed");
