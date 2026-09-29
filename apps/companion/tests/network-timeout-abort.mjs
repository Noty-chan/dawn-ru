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
  let inserted=null;
  const chain={
    select(){return chain},
    eq(){return chain},
    order(){return chain},
    insert(record){inserted=record;return new PendingRequest(`insert:${table}:${inserted.command_type}`)},
    async maybeSingle(){assert.equal(table,"campaign_members");return{data:{role:"owner",display_name:"Narrator"},error:null}},
    async single(){
      assert.equal(table,"scenes");
      return{data:{id:sceneId,campaign_id:campaignId,state:{version:1,actors:[]},version:1},error:null};
    },
    async limit(){assert.equal(table,"scene_commands");return{data:[],error:null}},
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
  setInterval:()=>1,
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

console.log("Network timeout abort QA passed: settle RPC and intent insert abort their PostgREST request signals on client timeout");
