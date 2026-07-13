"use strict";

(function exposeDawnSync(global){
  const STORAGE_KEY="dawn-ru-sync-v1";
  const listeners=new Map();
  let client=null,channel=null,saveTimer=null,saveInFlight=false,pendingSave=null;
  let state={status:"offline",authenticated:false,userId:null,url:"",publishableKey:"",displayName:"",campaignId:null,campaignName:"",sceneId:null,role:null,version:0,error:""};

  function stored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{}}catch{return{}}}
  function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify({url:state.url,publishableKey:state.publishableKey,displayName:state.displayName,campaignId:state.campaignId,campaignName:state.campaignName,sceneId:state.sceneId,role:state.role}))}
  function snapshot(){return {...state,canNarrate:["owner","narrator"].includes(state.role)}}
  function emit(type,payload=snapshot()){for(const listener of listeners.get(type)||[])try{listener(payload)}catch(error){console.error(error)}}
  function patch(next){state={...state,...next};persist();emit("status")}
  function fail(error){const message=error?.message||String(error||"Ошибка синхронизации");patch({status:"error",error:message});throw error instanceof Error?error:new Error(message)}
  function on(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);return()=>listeners.get(type)?.delete(listener)}
  function hasConfig(){const value=stored();return Boolean(value.url&&value.publishableKey)}
  function configure({url,publishableKey,displayName}){const parsed=new URL(String(url||"").trim());if(!["https:","http:"].includes(parsed.protocol))throw new Error("Некорректный Project URL");state.url=parsed.origin;state.publishableKey=String(publishableKey||"").trim();state.displayName=String(displayName||"").trim().slice(0,80)||"Игрок";if(!state.publishableKey)throw new Error("Нужен publishable/anon key");persist();return snapshot()}

  async function connect(){
    const saved={...stored(),...state};state={...state,...saved,status:"connecting",error:""};emit("status");
    if(!state.url||!state.publishableKey)throw new Error("Сначала укажите Project URL и publishable key");
    if(!global.supabase?.createClient)throw new Error("Библиотека Supabase не загрузилась; локальный режим продолжает работать");
    client=global.supabase.createClient(state.url,state.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    let {data:{session},error}=await client.auth.getSession();if(error)return fail(error);
    if(!session){const signed=await client.auth.signInAnonymously({options:{data:{display_name:state.displayName||"Игрок"}}});if(signed.error)return fail(signed.error);session=signed.data.session}
    patch({status:"authenticated",authenticated:true,userId:session.user.id,error:""});
    if(state.sceneId&&state.campaignId){
      const membership=await client.from("campaign_members").select("role,display_name").eq("campaign_id",state.campaignId).eq("user_id",session.user.id).maybeSingle();
      if(!membership.error&&membership.data){patch({role:membership.data.role,displayName:membership.data.display_name});await loadScene(state.sceneId)}
    }
    return snapshot();
  }

  async function ensureConnected(){if(!client||!state.authenticated)await connect();return client}
  async function unsubscribe(){if(channel&&client)await client.removeChannel(channel);channel=null}
  async function subscribe(){
    await unsubscribe();if(!client||!state.sceneId)return;
    channel=client.channel(`dawn-scene-${state.sceneId}`)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"scenes",filter:`id=eq.${state.sceneId}`},payload=>{
        const remote=payload.new;if(!remote||remote.version<=state.version)return;patch({version:remote.version,status:"online",error:""});emit("scene",{state:remote.state,version:remote.version,updatedBy:remote.updated_by});
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"scene_commands",filter:`scene_id=eq.${state.sceneId}`},payload=>{if(["owner","narrator"].includes(state.role))emit("command",payload.new)})
      .subscribe(status=>patch({status:status==="SUBSCRIBED"?"online":status==="CHANNEL_ERROR"?"error":"connecting",error:status==="CHANNEL_ERROR"?"Realtime channel error":""}));
  }

  async function loadScene(sceneId){
    await ensureConnected();const result=await client.from("scenes").select("id,campaign_id,name,state,version").eq("id",sceneId).single();if(result.error)return fail(result.error);
    const scene=result.data;patch({sceneId:scene.id,campaignId:scene.campaign_id,version:scene.version,status:"connecting",error:""});await subscribe();emit("scene",{state:scene.state,version:scene.version,initial:true});if(["owner","narrator"].includes(state.role)){const pending=await client.from("scene_commands").select("id,actor_id,command_type,payload,status,created_at").eq("scene_id",scene.id).eq("status","pending").order("created_at",{ascending:true}).limit(30);if(!pending.error)emit("commands",pending.data||[])}return scene;
  }

  async function createCampaign(name,initialState){
    await ensureConnected();const result=await client.rpc("create_campaign",{p_name:String(name||"").trim(),p_display_name:state.displayName||"Нарратор",p_initial_state:initialState||{}}).single();if(result.error)return fail(result.error);
    patch({campaignId:result.data.campaign_id,sceneId:result.data.scene_id,role:result.data.role,campaignName:String(name||"").trim(),version:1});await loadScene(result.data.scene_id);return snapshot();
  }

  async function createInvite(role="player"){
    await ensureConnected();if(!["owner","narrator"].includes(state.role))throw new Error("Приглашения создаёт только Нарратор");const result=await client.rpc("create_campaign_invite",{p_campaign_id:state.campaignId,p_role:role,p_max_uses:8,p_expires_hours:168});if(result.error)return fail(result.error);return result.data;
  }

  async function redeemInvite(token){
    await ensureConnected();const result=await client.rpc("redeem_campaign_invite",{p_token:String(token||"").trim(),p_display_name:state.displayName||"Игрок"}).single();if(result.error)return fail(result.error);
    patch({campaignId:result.data.campaign_id,campaignName:result.data.campaign_name,sceneId:result.data.scene_id,role:result.data.role,version:0});await loadScene(result.data.scene_id);return snapshot();
  }

  async function flushSave(){
    if(saveInFlight||!pendingSave||!["owner","narrator"].includes(state.role))return;saveInFlight=true;const current=pendingSave;pendingSave=null;
    try{await ensureConnected();const result=await client.rpc("save_scene_snapshot",{p_scene_id:state.sceneId,p_expected_version:state.version,p_state:current.scene,p_event_type:current.label||"scene.snapshot"});if(result.error){if(result.error.code==="40001"||/version conflict/i.test(result.error.message||"")){patch({error:"Сцена изменилась на другом устройстве; загружена свежая версия"});await loadScene(state.sceneId)}else return fail(result.error)}else patch({version:Number(result.data),status:"online",error:""})}finally{saveInFlight=false;if(pendingSave)void flushSave()}
  }
  function queueScene(scene,label="scene.snapshot"){if(!["owner","narrator"].includes(state.role)||!state.sceneId)return;pendingSave={scene,label};clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flushSave(),250)}

  async function submitCommand(commandType,payload={}){await ensureConnected();if(!state.sceneId)throw new Error("Сначала войдите в кампанию");const result=await client.from("scene_commands").insert({campaign_id:state.campaignId,scene_id:state.sceneId,actor_id:state.userId,command_type:commandType,payload}).select().single();if(result.error)return fail(result.error);return result.data}
  async function decideCommand(commandId,decision){await ensureConnected();if(!["owner","narrator"].includes(state.role))throw new Error("Решение принимает Нарратор");const status=decision==="applied"?"applied":"rejected",result=await client.from("scene_commands").update({status,decided_by:state.userId,decided_at:new Date().toISOString()}).eq("id",commandId).eq("status","pending").select().single();if(result.error)return fail(result.error);return result.data}
  async function leave(){clearTimeout(saveTimer);pendingSave=null;await unsubscribe();patch({status:"authenticated",campaignId:null,campaignName:"",sceneId:null,role:null,version:0,error:""});return snapshot()}

  state={...state,...stored()};
  global.DAWN_SYNC={configure,connect,createCampaign,createInvite,decideCommand,hasConfig,leave,loadScene,on,queueScene,redeemInvite,state:snapshot,submitCommand};
})(window);
