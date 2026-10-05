import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sceneId="00000000-0000-4000-8000-000000000111";
const campaignId="00000000-0000-4000-8000-000000000222";
const user={id:"00000000-0000-4000-8000-000000000333",email:"narrator@example.com",is_anonymous:false};
const storage=new Map([["dawn-ru-sync-v1",JSON.stringify({url:"https://dawn-test.supabase.co",publishableKey:"sb_test",sceneId,campaignId,role:"owner"})]]);
const emitted=[];
let sceneReads=0;
const sceneAt=version=>({id:sceneId,campaign_id:campaignId,state:{version,name:`Scene ${version}`,actors:[]},version});
const handlers=[];
function query(table){
  return{
    select(){return this},eq(){return this},order(){return this},
    async maybeSingle(){assert.equal(table,"campaign_members");return{data:{role:"owner",display_name:"Narrator"},error:null}},
    async single(){
      if(table==="scenes")return{data:sceneAt(++sceneReads===1?1:2),error:null};
      if(table==="scene_commands")return{data:[],error:null};
      throw new Error(`Unexpected table ${table}`);
    },
    async limit(){return{data:[],error:null}},
  };
}
const channel={
  on(type,filter,callback){handlers.push({type,filter,callback});return this},
  subscribe(callback){
    callback("SUBSCRIBED");
    // A newer scene arrives while loadScene is still awaiting subscribe().
    handlers.find(item=>item.type==="postgres_changes"&&item.filter.table==="scenes")?.callback({new:{...sceneAt(2),updated_by:"other-narrator"}});
    return this;
  },
  track:async()=>{},presenceState:()=>({}),send:async()=>{},
};
const client={
  auth:{getSession:async()=>({data:{session:{user}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  from:query,channel:()=>channel,removeChannel:async()=>{},
};
const browser={supabase:{createClient:()=>client},navigator:{onLine:true},setInterval:()=>1,clearInterval(){},addEventListener(){}};
const context={window:browser,URL,console,setTimeout,clearTimeout,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
vm.runInNewContext(fs.readFileSync(new URL("../sync.js",import.meta.url),"utf8"),context);
const Sync=browser.DAWN_SYNC;
Sync.on("scene",payload=>emitted.push({version:payload.version,name:payload.state.name}));
await Sync.connect();
assert.deepEqual(emitted,[{version:2,name:"Scene 2"}],"a stale initial read must not overwrite a Realtime update received during subscription");
assert.equal(Sync.state().version,2);
console.log("Network load race QA passed: subscription update wins over stale initial snapshot");
