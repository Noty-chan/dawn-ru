import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {loadSceneEngine} from './load-scene-engine.mjs';

const source=fs.readFileSync(new URL('../scene-sync-ui.js',import.meta.url),'utf8');
const begin=source.indexOf('let networkV2Authority=null');
const end=source.indexOf('function renderNetworkScene(',begin);
assert.ok(begin>=0&&end>begin);
const context={window:{},console,structuredClone,renderSceneBoard(){},renderScene(){},syncHeroFromScene(){},
  Sync:{state:()=>({sceneId:'qa',canNarrate:true})},
  Scene:{name:'Before',tablePolicy:{mode:'manual',epoch:1},version:0,actors:[{id:'hero',name:'Hero',space:'main',x:0,y:0,hp:10,maxHp:10,focus:0}],spaces:[{id:'main',width:7,height:7}],activeSpace:'main',selectedActor:'hero',log:[]},
};
vm.createContext(context);
context.SceneEngine=loadSceneEngine(context);context.window.DAWN_TABLE_POLICY.install();
vm.runInContext(fs.readFileSync(new URL('../network-v2.js',import.meta.url),'utf8'),context);
context.NetworkV2=context.window.DAWN_NETWORK_V2;
vm.runInContext(source.slice(begin,end)+'\nthis.setAuthority=q=>networkV2Authority=q;',context);
const confirmed=structuredClone(context.Scene);
const overlay=structuredClone(confirmed);overlay.name='Pending rename';
const first={id:'snapshot-ui-1',type:'table.command',actorId:'hero',payload:{kind:'resource',values:{focus:1}}};
const authority={queue:[{kind:'events',events:[first]}],latestSnapshot:()=>({baseScene:confirmed,scene:overlay})};
context.setAuthority(authority);context.NetworkV2.setConfirmedScene(confirmed);
context.refreshPendingManualUi();
assert.equal(context.Scene.name,'Pending rename','first resource preview must retain metadata overlay');
assert.equal(context.Scene.actors[0].focus,1);
assert.equal(context.NetworkV2.getConfirmedScene().actors[0].focus,0,'preview cannot change canonical state');
context.Scene=context.mergeNetworkV2Scene(confirmed,context.Scene);
assert.equal(context.Scene.name,'Pending rename');
assert.equal(context.Scene.actors[0].focus,1,'remote repaint must preserve resource preview over snapshot');
const second={id:'snapshot-ui-2',type:'table.command',actorId:'hero',payload:{kind:'resource',values:{focus:context.Scene.actors[0].focus+1}}};
authority.queue.push({kind:'events',events:[second]});
context.refreshPendingManualUi();
assert.equal(context.Scene.actors[0].focus,2,'rapid second step must use the provisional value');
const accepted=context.SceneEngine.dispatchMany(confirmed,[first,second]).scene;
context.Scene=context.mergeNetworkV2Scene(accepted,context.Scene);
assert.equal(context.Scene.actors[0].focus,2,'accepted receipts must not replay the two commands');
assert.equal(context.Scene.log.length,2);
assert.equal(context.Scene.name,'Pending rename');
authority.queue=[];
context.NetworkV2.setConfirmedScene(confirmed);context.refreshPendingManualUi();
assert.equal(context.Scene.actors[0].focus,0,'rejected events must roll back while retaining metadata');
assert.equal(context.Scene.name,'Pending rename');
console.log('Manual optimistic snapshot QA passed: refresh/remote overlay, rapid steps, canonical isolation, receipts and rollback');
