import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sceneId="00000000-0000-4000-8000-000000000111";
const campaignId="00000000-0000-4000-8000-000000000222";
const user={id:"00000000-0000-4000-8000-000000000333",is_anonymous:true};
const storage=new Map([["dawn-ru-sync-v1",JSON.stringify({
  url:"https://dawn-test.supabase.co",publishableKey:"sb_test",sceneId,campaignId,role:"owner",version:1,
})]]);
const requests=[];
const timeoutLabels=[];
let insertMode="hang",duplicateReadHangs=false,sceneReadHangs=false,pendingReadHangs=false,poll;
let sceneVersion=1,pendingRows=[],pendingReads=0;
let lateSceneRead=null;
const durableCommands=new Map(),insertIds=[],scenePayloads=[];

class PendingRequest {
  constructor(name){this.name=name;this.signal=null;this.abortedBySignal=false;requests.push(this)}
  abortSignal(signal){this.signal=signal;return this}
  select(){return this}
  single(){return this}
  then(resolve,reject){
    const pending=new Promise((_,rejectRequest)=>{
      const abort=()=>{this.abortedBySignal=true;rejectRequest(Object.assign(new Error("request aborted"),{name:"AbortError"}))};
      if(this.signal?.aborted)abort();
      else this.signal?.addEventListener("abort",abort,{once:true});
    });
    return pending.then(resolve,reject);
  }
}

function query(table){
  let inserted=null,columns="";
  const filters=new Map();
  const chain={
    select(value){columns=value||"";return chain},
    eq(key,value){filters.set(key,value);return chain},
    order(){return chain},
    insert(record){
      inserted=record;
      if(insertMode==="hang")return new PendingRequest(`insert:${table}:${inserted.command_type}`);
      insertIds.push(record.client_intent_id);
      if(durableCommands.has(record.client_intent_id))return chain;
      durableCommands.set(record.client_intent_id,{...record,id:"101",status:"pending"});
      return new PendingRequest("insert:committed-reply-lost");
    },
    async maybeSingle(){assert.equal(table,"campaign_members");return{data:{role:"owner",display_name:"Narrator"},error:null}},
    single(){
      if(table==="scene_commands"){
        if(inserted)return{data:null,error:{code:"23505",message:"duplicate intent"}};
        if(duplicateReadHangs)return new PendingRequest("duplicate:readback");
        return{data:durableCommands.get(filters.get("client_intent_id")),error:null};
      }
      assert.equal(table,"scenes");
      if(lateSceneRead){const response=lateSceneRead;lateSceneRead=null;return response}
      if(sceneReadHangs)return new PendingRequest(`scene:${columns}`);
      return{data:{id:filters.get("id")||sceneId,campaign_id:campaignId,state:{version:sceneVersion,actors:[]},version:sceneVersion},error:null};
    },
    limit(){assert.equal(table,"scene_commands");pendingReads++;if(pendingReadHangs)return new PendingRequest("commands:poll");return{data:pendingRows,error:null}},
  };
  return chain;
}

const channel={
  on(){return this},
  subscribe(callback){callback("SUBSCRIBED");return this},
  track:async()=>{},
  presenceState:()=>({}),
  send:async()=>{},
};
const client={
  auth:{
    getSession:async()=>({data:{session:{user}},error:null}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  },
  from:query,
  channel:()=>channel,
  removeChannel:async()=>{},
  rpc(name){return new PendingRequest(`rpc:${name}`)},
};
const browser={
  supabase:{createClient:()=>client},
  AbortController,
  DAWN_NETWORK_V2:{
    withTimeout(request,label){
      timeoutLabels.push(label);
      return new Promise((resolve,reject)=>{
        Promise.resolve(request).then(resolve,reject);
        setTimeout(()=>reject(Object.assign(new Error("network request timed out"),{code:"DAWN_REQUEST_TIMEOUT",retryable:true})),5);
      });
    },
  },
  navigator:{onLine:true},
  setInterval:callback=>{poll=callback;return 1},
  clearInterval(){},
  addEventListener(){},
};
const context={
  window:browser,URL,console,setTimeout,clearTimeout,
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
};
vm.runInNewContext(fs.readFileSync(new URL("../sync.js",import.meta.url),"utf8"),context);
const Sync=browser.DAWN_SYNC;
await Sync.connect();
timeoutLabels.length=0;

await assert.rejects(
  Sync.settleIntentBatch({events:[{id:"timeout-event",type:"scene.test",payload:{}}],scene:{version:2},expectedVersion:1}),
  error=>error?.code==="DAWN_REQUEST_TIMEOUT",
);
assert.equal(requests[0].name,"rpc:settle_scene_intent_batch");
assert.equal(requests[0].signal?.aborted,true,"a timed-out settle RPC must abort its PostgREST request signal");
assert.equal(requests[0].abortedBySignal,true,"the pending transport must observe the abort signal");

await assert.rejects(
  Sync.submitCommand("intent_v2",{clientIntentId:"00000000-0000-4000-8000-000000000444",protocol:2,intent:{kind:"move"}}),
  error=>error?.code==="DAWN_REQUEST_TIMEOUT",
);
assert.equal(requests[1].name,"insert:scene_commands:intent_v2");
assert.equal(requests[1].signal?.aborted,true,"a timed-out intent insert must abort its PostgREST request signal");
assert.equal(requests[1].abortedBySignal,true,"the pending insert transport must observe the abort signal");
assert.deepEqual(timeoutLabels,["сохранения сетевого такта","отправки намерения игрока"]);

// A committed insert can lose its reply. Both the retry insert and the
// duplicate lookup must be bounded, preserving one durable command identity.
vm.runInNewContext(fs.readFileSync(new URL("../network-v2.js",import.meta.url),"utf8"),{window:browser,setTimeout,clearTimeout,console,crypto:globalThis.crypto,structuredClone});
const Network=browser.DAWN_NETWORK_V2,normalTimeout=Network.withTimeout;
Network.withTimeout=(request,label)=>normalTimeout(request,label,5);
insertMode="commit";
duplicateReadHangs=true;
const outbox=new Network.PlayerOutbox({tickMs:10000,send:row=>Sync.submitCommand("intent_v2",row)});
const row=outbox.enqueue({kind:"runtime",actorId:"hero",key:"focus",value:2},1);
await outbox.flush();
assert.equal(outbox.pending(),1,"a committed insert with a lost response retains the same intent");
await outbox.flush();
assert.equal(outbox.pending(),1,"a timed-out duplicate readback releases sending and retains the intent");
assert.ok(requests.find(request=>request.name==="duplicate:readback")?.abortedBySignal);
duplicateReadHangs=false;
await outbox.flush();
assert.equal(outbox.pending(),0,"the same intent completes after readback recovers");
assert.equal(durableCommands.size,1,"retrying a committed insert never creates another command");
assert.deepEqual(insertIds,[row.clientIntentId,row.clientIntentId,row.clientIntentId]);
outbox.clear();

// Both periodic guards must be released after a bounded hanging read; the
// next poll can deliver new Scene and command data instead of remaining stuck.
Sync.on("scene",payload=>scenePayloads.push(payload));
const commandPayloads=[];
Sync.on("commands",rows=>commandPayloads.push(rows));
sceneReadHangs=pendingReadHangs=true;
const beforePoll=pendingReads;
poll();
await new Promise(resolve=>setTimeout(resolve,15));
assert.ok(requests.find(request=>request.name==="scene:version")?.abortedBySignal);
assert.ok(requests.find(request=>request.name==="commands:poll")?.abortedBySignal);
sceneReadHangs=pendingReadHangs=false;
sceneVersion=2;
pendingRows=[{id:"102",command_type:"intent_v2",status:"pending"}];
poll();
await new Promise(resolve=>setTimeout(resolve,10));
assert.equal(pendingReads,beforePoll+2,"the pending-command guard permits polling after timeout");
assert.equal(Sync.state().version,2,"the Scene guard permits polling after timeout");
assert.equal(commandPayloads.at(-1)[0].id,"102");
assert.equal(scenePayloads.at(-1).version,2);

sceneReadHangs=true;
await assert.rejects(Sync.refreshScene(),error=>error?.code==="DAWN_REQUEST_TIMEOUT","reconnect/explicit reload is also bounded");
sceneReadHangs=false;
await Sync.refreshScene();
assert.equal(Sync.state().version,2,"explicit Scene reload recovers after timeout");
let releaseLateRead;
lateSceneRead=new Promise(resolve=>{releaseLateRead=resolve});
const oldLoad=Sync.loadScene(sceneId);
await new Promise(resolve=>setTimeout(resolve,1));
const nextSceneId="00000000-0000-4000-8000-000000000112";
await Sync.loadScene(nextSceneId);
releaseLateRead({data:{id:sceneId,campaign_id:campaignId,state:{version:99,actors:[]},version:99},error:null});
await oldLoad;
assert.equal(Sync.state().sceneId,nextSceneId,"a bounded old-table load cannot overwrite the new session");
assert.equal(Sync.state().version,2,"a late old-table version is ignored");
await Sync.leave();
console.log("Network timeout abort QA passed: bounded RPC/insert/readback, one committed duplicate, polling and reload recovery");
