import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=f=>fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const root={window:{}};vm.createContext(root);for(const f of ['scene-presentation-model.js','scene-presentation-transport.js'])vm.runInContext(source(f),root);
let time=10000,serial=0,sends=0;const bus=new Set(),clients=[];
const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
for(let r=1;r<=5;r++)for(let u=1;u<=5;u++){
 const room=uid(100+r),user=uid(u),scene={tablePolicy:{epoch:1},spaces:[{id:'main',width:8,height:8}]},rows=[],statuses=[];
 const roster=Array.from({length:5},(_,i)=>({user_id:uid(i+1),display_name:`User${i+1}`,color_slot:i}));
 const client={rpc:async()=>({data:roster}),removeChannel:async ch=>bus.delete(ch),channel(topic,opts){assert.equal(opts.config.private,true);const ch={topic,user,on(e,filter,fn){this.receive=fn;return this},subscribe(fn){this.status=fn;bus.add(this);fn('SUBSCRIBED');return this},async send(msg){assert.equal(this.topic.split(':')[2],user,'only own author channel publishes');sends++;for(const other of bus)if(other!==this&&other.topic===this.topic)other.receive({payload:msg.payload});return 'ok'}};return ch;}};
 const lane=root.window.DAWN_PRESENTATION_TRANSPORT.create({client,getScene:()=>scene,emit:row=>rows.push(row),status:v=>statuses.push(v),now:()=>time});
 await lane.start(room,user);assert.equal(lane.isReady(),true);clients.push({lane,scene,room,user,rows,client,roster});
}
const request=()=>({clientId:`id-${++serial}`,epoch:1,spaceId:'main',kind:'ping',cells:['2,2']});
const before=JSON.stringify(clients.map(c=>c.scene));
for(let second=0;second<300;second++){time+=1000;for(const c of clients)assert.equal(await c.lane.send(request()),true);}
assert.equal(sends,7500);for(const c of clients){assert.equal(c.rows.length,1500);assert.ok(c.rows.every(row=>row.scene_id===c.room));}
assert.equal(JSON.stringify(clients.map(c=>c.scene)),before,'no Scene or resource mutation across5x5 load');
const a=clients[0],own=[...bus].find(ch=>ch.user===a.user&&ch.topic===`dawn-present:${a.room}:${a.user}`),peer=clients[1];
const last=a.rows.at(-1);let size=peer.rows.length;
own.receive({payload:{id:'forged',epoch:1,spaceId:'main',kind:'ping',cells:['1,1'],createdAt:new Date(time).toISOString(),expiresAt:new Date(time+1200).toISOString(),user_id:uid(9),color_slot:11}});
assert.equal(a.rows.at(-1).user_id,a.user);assert.equal(a.rows.at(-1).color_slot,0,'payload cannot spoof sender/color');
assert.equal(await a.lane.send({...request(),epoch:0}),false);assert.equal(await a.lane.send({...request(),cells:Array(129).fill('1,1')}),false);
time+=1000;const count=sends;for(let i=0;i<100;i++)await a.lane.send(request());assert.ok(sends-count<=4,'outbound flood bounded');
await a.lane.stop();assert.equal(a.lane.isReady(),false);own.receive({payload:{id:'stale'}});assert.equal(a.lane.isReady(),false);
// Delayed teardown from A cannot revive A after B starts.
await a.lane.start(a.room,a.user);let release;const original=a.client.removeChannel;a.client.removeChannel=ch=>release?original(ch):new Promise(resolve=>{release=resolve});
const oldStart=a.lane.start(uid(200),a.user);await a.lane.start(uid(201),a.user);release();await oldStart;
assert.equal([...bus].filter(ch=>ch.user===a.user&&ch.topic.startsWith('dawn-present:'+uid(200))).length,0);
a.client.removeChannel=original;await a.lane.stop();for(const c of clients.slice(1))await c.lane.stop();
console.log('Private presentations production transport:5 rooms x5 clients x300s, trusted author/colors, rate/capacity/epoch, immutable Scene and delayed teardown passed');

// Actual lifecycle: a transient bootstrap failure retains only desired identity,
// never old channels/gestures. Poll retries are bounded and single-flight.
{
 let calls=0,error={code:'DAWN_REQUEST_TIMEOUT'},resolveRpc;
 const active=new Set(),scene={tablePolicy:{epoch:1},spaces:[{id:'main',width:8,height:8}]};
 const client={rpc:async()=>{calls++;if(resolveRpc)return new Promise(resolve=>resolveRpc=resolve);return error?{error}:{data:[{user_id:uid(1),display_name:'One',color_slot:0}]};},removeChannel:async ch=>active.delete(ch),channel(){const ch={on(){return this},subscribe(fn){active.add(this);fn('SUBSCRIBED');return this},send:async()=> 'ok'};return ch;}};
 const lane=root.window.DAWN_PRESENTATION_TRANSPORT.create({client,getScene:()=>scene,emit(){},status(){},now:()=>time});
 assert.equal(await lane.start(uid(101),uid(1)),false);assert.equal(calls,1);
 await lane.refresh();assert.equal(calls,1,'backoff prevents immediate retry');
 time+=30000;error=null;assert.equal(await lane.refresh(),true);assert.equal(lane.isReady(),true);
 error={code:'DAWN_REQUEST_TIMEOUT'};assert.equal(await lane.refresh(),false);assert.equal(active.size,0);
 time+=30000;error=null;await lane.refresh();assert.equal(lane.isReady(),true);
 error={code:'42501'};await lane.refresh();const deniedCalls=calls;time+=30000;await lane.refresh();assert.equal(calls,deniedCalls,'denial is not retried');
 error={code:'DAWN_REQUEST_TIMEOUT'};await lane.start(uid(101),uid(1));
 for(let i=0;i<10;i++){time+=30000;await lane.refresh();}
 assert.equal(calls-deniedCalls,4,'at most four roster attempts per disconnected lifecycle');
 await lane.stop();const stoppedCalls=calls;error=null;time+=30000;await lane.refresh();assert.equal(calls,stoppedCalls,'leave cannot revive desired identity');
}
console.log('Presentation recovery: transient bootstrap/poll retry, bounded backoff, denial and leave guards passed');
{
 let calls=0;const active=new Set(),scene={tablePolicy:{epoch:1},spaces:[{id:'main',width:8,height:8}]};
 const client={rpc:async()=>{calls++;return{data:[{user_id:uid(1),display_name:'One',color_slot:0}]};},removeChannel:async ch=>active.delete(ch),channel(){const ch={on(){return this},subscribe(fn){active.add(this);fn('CHANNEL_ERROR');return this}};return ch;}};
 const lane=root.window.DAWN_PRESENTATION_TRANSPORT.create({client,getScene:()=>scene,emit(){},status(){},now:()=>time});
 await lane.start(uid(101),uid(1));for(let i=0;i<10;i++){time+=30000;await lane.refresh();}
 assert.equal(calls,4,'subscription failures share the bounded retry budget');assert.equal(active.size,0);await lane.stop();
}
