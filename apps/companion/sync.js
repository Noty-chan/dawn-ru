"use strict";

(function exposeDawnSync(global){
  const STORAGE_KEY="dawn-ru-sync-v1";
  const PROJECT=global.DAWN_CONFIG||{};
  const listeners=new Map();
  let client=null,channel=null,channelGeneration=0,authSubscription=null,saveTimer=null,saveInFlight=false,pendingSave=null,reconnectTimer=null,reconnectAttempt=0,sceneRefreshTimer=null,sceneRefreshInFlight=false,mutationChain=Promise.resolve();
  let state={status:"offline",authenticated:false,userId:null,email:"",isAnonymous:true,accountPending:false,userIdChanged:false,url:String(PROJECT.supabaseUrl||""),publishableKey:String(PROJECT.publishableKey||""),displayName:"",campaignId:null,campaignName:"",sceneId:null,role:null,version:0,characterIds:{},presence:[],lastSyncedAt:"",error:""};

  function stored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{}}catch{return{}}}
  function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify({url:state.url,publishableKey:state.publishableKey,displayName:state.displayName,campaignId:state.campaignId,campaignName:state.campaignName,sceneId:state.sceneId,role:state.role,characterIds:state.characterIds||{}}))}
  function snapshot(){return {...state,canNarrate:["owner","narrator"].includes(state.role),hasAccount:Boolean(state.email&&!state.isAnonymous)}}
  function emit(type,payload=snapshot()){for(const listener of listeners.get(type)||[])try{listener(payload)}catch(error){console.error(error)}}
  function patch(next){if(!Object.keys(next).some(key=>state[key]!==next[key]))return snapshot();state={...state,...next};persist();emit("status");return snapshot()}
  function fail(error){const message=error?.message||String(error||"Ошибка синхронизации");patch({status:"error",error:message});throw error instanceof Error?error:new Error(message)}
  function on(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);return()=>listeners.get(type)?.delete(listener)}
  function hasConfig(){return Boolean(state.url&&state.publishableKey)}
  function configure({url,publishableKey,displayName}={}){const rawUrl=String(url||state.url||PROJECT.supabaseUrl||"").trim(),key=String(publishableKey||state.publishableKey||PROJECT.publishableKey||"").trim(),parsed=new URL(rawUrl);if(!["https:","http:"].includes(parsed.protocol))throw new Error("Некорректный Project URL");state.url=parsed.origin;state.publishableKey=key;state.displayName=String(displayName||state.displayName||"").trim().slice(0,80)||"Игрок";if(!state.publishableKey)throw new Error("Нужен publishable/anon key");persist();return snapshot()}
  function authRedirectUrl(){return global.location&&["http:","https:"].includes(global.location.protocol)?`${global.location.origin}${global.location.pathname}${global.location.search||""}`:undefined}
  function authState(session){
    const user=session?.user||null,previous=state.userId;
    return{authenticated:Boolean(user),userId:user?.id||null,email:String(user?.email||""),isAnonymous:Boolean(user?.is_anonymous??!user?.email),accountPending:false,userIdChanged:Boolean(previous&&user?.id&&previous!==user.id)};
  }
  function setupAuthListener(){
    authSubscription?.unsubscribe?.();
    const result=client?.auth?.onAuthStateChange?.((_event,session)=>{
      const next=authState(session),resetIdentity=!session||next.userIdChanged,sceneId=resetIdentity?null:state.sceneId;
      const keepSceneSession=Boolean(session&&sceneId&&!resetIdentity);
      patch({...next,...(resetIdentity?{campaignId:null,campaignName:"",sceneId:null,role:null,version:0,characterIds:{},presence:[]}:{}),status:keepSceneSession?state.status:session?(sceneId?"connecting":"authenticated"):"offline",error:""});
    });
    authSubscription=result?.data?.subscription||null;
  }

  async function connect(){
    const saved={...stored(),...state};state={...state,...saved,status:"connecting",error:""};emit("status");
    if(!state.url||!state.publishableKey)throw new Error("Сначала укажите Project URL и publishable key");
    if(!global.supabase?.createClient)throw new Error("Библиотека Supabase не загрузилась; локальный режим продолжает работать");
    client=global.supabase.createClient(state.url,state.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    setupAuthListener();
    let {data:{session},error}=await client.auth.getSession();if(error)return fail(error);
    if(!session){const signed=await client.auth.signInAnonymously({options:{data:{display_name:state.displayName||"Игрок"}}});if(signed.error)return fail(signed.error);session=signed.data.session}
    const nextAuth=authState(session);patch({status:"authenticated",...nextAuth,...(nextAuth.userIdChanged?{campaignId:null,campaignName:"",sceneId:null,role:null,version:0,characterIds:{},presence:[]}:{}),error:""});
    if(state.sceneId&&state.campaignId){
      const membership=await client.from("campaign_members").select("role,display_name").eq("campaign_id",state.campaignId).eq("user_id",session.user.id).maybeSingle();
      if(membership.error)return fail(membership.error);
      if(membership.data){patch({role:membership.data.role,displayName:membership.data.display_name});await loadScene(state.sceneId)}
      else patch({campaignId:null,campaignName:"",sceneId:null,role:null,version:0,presence:[],error:"Прежняя кампания недоступна для этого аккаунта"});
    }
    return snapshot();
  }

  async function ensureConnected(){if(!client||!state.authenticated)await connect();return client}
  async function unsubscribe(){clearTimeout(reconnectTimer);global.clearInterval?.(sceneRefreshTimer);reconnectTimer=null;sceneRefreshTimer=null;channelGeneration+=1;const previous=channel;channel=null;if(previous&&client)await client.removeChannel(previous)}
  async function refreshSceneIfNewer(){
    if(sceneRefreshInFlight||!client||!state.sceneId||global.document?.hidden)return;
    sceneRefreshInFlight=true;
    try{
      const canNarrate=["owner","narrator"].includes(state.role),table=canNarrate?"scenes":"scene_public_snapshots",idColumn=canNarrate?"id":"scene_id";
      const versionResult=await client.from(table).select("version").eq(idColumn,state.sceneId).single();
      if(versionResult.error)throw versionResult.error;
      if(Number(versionResult.data?.version)>Number(state.version)){
        const result=await client.from(table).select("state,version").eq(idColumn,state.sceneId).single();
        if(result.error)throw result.error;
        if(Number(result.data?.version)>Number(state.version)){patch({version:Number(result.data.version),status:"online",lastSyncedAt:new Date().toISOString(),error:""});emit("scene",{state:result.data.state,version:Number(result.data.version),polled:true})}
      }
    }catch(error){console.warn("DAWN scene refresh failed",error)}
    finally{sceneRefreshInFlight=false}
  }
  function scheduleReconnect(reason="connection"){
    if(!state.sceneId||reconnectTimer||global.navigator?.onLine===false)return;
    reconnectAttempt=Math.min(reconnectAttempt+1,6);patch({status:"connecting",error:reason==="offline"?"Соединение восстановлено; загружаем Сцену":"Realtime переподключается"});
    reconnectTimer=setTimeout(async()=>{reconnectTimer=null;try{await loadScene(state.sceneId);reconnectAttempt=0}catch(error){console.warn("DAWN reconnect failed",error);scheduleReconnect("retry")}},Math.min(1000*2**(reconnectAttempt-1),15000));
  }
  async function requestEmailLink(email){
    const safeEmail=String(email||"").trim().toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(safeEmail))throw new Error("Укажите корректный email");
    if(!client)await connect();
    const redirectTo=authRedirectUrl();
    patch({accountPending:true,error:""});
    if(state.authenticated&&state.isAnonymous){
      const linked=await client.auth.updateUser({email:safeEmail},{emailRedirectTo:redirectTo});
      if(linked.error){patch({accountPending:false});if(/already|registered|exists/i.test(linked.error.message||""))throw new Error("Этот email уже зарегистрирован. Нажмите «Выйти», затем запросите ссылку снова.");return fail(linked.error)}
      patch({email:safeEmail,accountPending:true});return{mode:"claim"};
    }
    if(state.authenticated&&state.email===safeEmail){patch({accountPending:false});return{mode:"ready"}}
    if(state.authenticated){const signedOut=await client.auth.signOut();if(signedOut.error)return fail(signedOut.error)}
    const result=await client.auth.signInWithOtp({email:safeEmail,options:{emailRedirectTo:redirectTo,shouldCreateUser:true,data:{display_name:state.displayName||"Игрок"}}});
    if(result.error)return fail(result.error);patch({email:safeEmail,accountPending:true,status:"authenticated",error:""});return{mode:"signin"};
  }
  async function signOutAccount(){
    clearTimeout(saveTimer);pendingSave=null;await unsubscribe();if(client){const result=await client.auth.signOut();if(result.error)return fail(result.error)}
    patch({status:"offline",authenticated:false,userId:null,email:"",isAnonymous:true,accountPending:false,campaignId:null,campaignName:"",sceneId:null,role:null,version:0,characterIds:{},presence:[],error:""});return snapshot();
  }
  function presencePayload(extra={}){return{userId:state.userId,displayName:state.displayName||"Игрок",role:state.role||"player",onlineAt:new Date().toISOString(),...extra}}
  function readPresence(){if(!channel?.presenceState)return[];const rows=Object.values(channel.presenceState()||{}).flat().filter(item=>item&&item.userId),unique=new Map();for(const item of rows)unique.set(item.userId,item);return[...unique.values()].sort((a,b)=>String(a.displayName||"").localeCompare(String(b.displayName||""),"ru"))}
  async function updatePresence(extra={}){if(!channel?.track||!state.sceneId)return;await channel.track(presencePayload(extra))}
  async function subscribe(){
    await unsubscribe();if(!client||!state.sceneId)return;
    const generation=++channelGeneration;
    const canNarrate=["owner","narrator"].includes(state.role);
    const sceneTable=canNarrate?"scenes":"scene_public_snapshots";
    const sceneFilter=canNarrate?`id=eq.${state.sceneId}`:`scene_id=eq.${state.sceneId}`;
    channel=client.channel(`dawn-scene-${state.sceneId}`,{config:{presence:{key:state.userId}}})
      .on("presence",{event:"sync"},()=>{state={...state,presence:readPresence()};emit("presence",state.presence)})
      .on("presence",{event:"join"},()=>setTimeout(()=>{state={...state,presence:readPresence()};emit("presence",state.presence)},0))
      .on("presence",{event:"leave"},()=>setTimeout(()=>{state={...state,presence:readPresence()};emit("presence",state.presence)},0))
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:sceneTable,filter:sceneFilter},payload=>{
        const remote=payload.new;if(!remote||remote.version<=state.version)return;patch({version:remote.version,status:"online",lastSyncedAt:new Date().toISOString(),error:""});emit("scene",{state:remote.state,version:remote.version,updatedBy:remote.updated_by});
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"scene_commands",filter:`scene_id=eq.${state.sceneId}`},payload=>{if(["owner","narrator"].includes(state.role))emit("command",payload.new)})
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"scene_commands",filter:`scene_id=eq.${state.sceneId}`},payload=>{if(payload.new)emit("command-update",payload.new)})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"scene_events",filter:`scene_id=eq.${state.sceneId}`},payload=>{if(payload.new)emit("event",payload.new)})
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"characters",filter:`campaign_id=eq.${state.campaignId}`},payload=>{if(payload.new)emit("character",payload.new)})
      .subscribe(status=>{if(generation!==channelGeneration)return;if(status==="SUBSCRIBED"){reconnectAttempt=0;patch({status:"online",lastSyncedAt:new Date().toISOString(),error:""});global.clearInterval?.(sceneRefreshTimer);sceneRefreshTimer=global.setInterval?.(()=>void refreshSceneIfNewer(),2500)||null;void updatePresence().catch(error=>console.warn("Presence update failed",error))}else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))scheduleReconnect(status)});
  }

  async function loadScene(sceneId){
    await ensureConnected();
    const canNarrate=["owner","narrator"].includes(state.role);
    const result=canNarrate
      ?await client.from("scenes").select("id,campaign_id,name,state,version").eq("id",sceneId).single()
      :await client.from("scene_public_snapshots").select("scene_id,campaign_id,state,version").eq("scene_id",sceneId).single();
    if(result.error)return fail(result.error);
    const scene={...result.data,id:result.data.id||result.data.scene_id};
    patch({sceneId:scene.id,campaignId:scene.campaign_id,version:scene.version,status:"connecting",lastSyncedAt:new Date().toISOString(),error:""});await subscribe();emit("scene",{state:scene.state,version:scene.version,initial:true});if(canNarrate){const pending=await client.from("scene_commands").select("id,actor_id,command_type,payload,status,created_at").eq("scene_id",scene.id).eq("status","pending").order("created_at",{ascending:true}).limit(30);if(!pending.error)emit("commands",pending.data||[])}return scene;
  }

  async function createCampaign(name,initialState){
    await ensureConnected();const result=await client.rpc("create_campaign",{p_name:String(name||"").trim(),p_display_name:state.displayName||"Нарратор",p_initial_state:initialState||{}}).single();if(result.error)return fail(result.error);
    patch({campaignId:result.data.campaign_id,sceneId:result.data.scene_id,role:result.data.role,campaignName:String(name||"").trim(),version:1});await loadScene(result.data.scene_id);return snapshot();
  }
  async function listCampaigns(){
    await ensureConnected();const memberships=await client.from("campaign_members").select("campaign_id,role,display_name").eq("user_id",state.userId);if(memberships.error)return fail(memberships.error);
    const rows=memberships.data||[],ids=rows.map(row=>row.campaign_id);if(!ids.length)return[];
    const narratorIds=rows.filter(row=>["owner","narrator"].includes(row.role)).map(row=>row.campaign_id),playerIds=rows.filter(row=>row.role==="player").map(row=>row.campaign_id);
    const campaigns=await client.from("campaigns").select("id,name,updated_at").in("id",ids);if(campaigns.error)return fail(campaigns.error);
    const privateScenes=narratorIds.length?await client.from("scenes").select("id,campaign_id,name,version,updated_at").in("campaign_id",narratorIds):{data:[],error:null};if(privateScenes.error)return fail(privateScenes.error);
    const publicScenes=playerIds.length?await client.from("scene_public_snapshots").select("scene_id,campaign_id,version,updated_at").in("campaign_id",playerIds):{data:[],error:null};if(publicScenes.error)return fail(publicScenes.error);
    const membershipByCampaign=new Map(rows.map(row=>[row.campaign_id,row])),sceneByCampaign=new Map([...(privateScenes.data||[]).map(scene=>[scene.campaign_id,{...scene,sceneId:scene.id}]),...(publicScenes.data||[]).map(scene=>[scene.campaign_id,{...scene,sceneId:scene.scene_id,name:"Структурированный бой"}])]);
    return(campaigns.data||[]).map(campaign=>{const membership=membershipByCampaign.get(campaign.id),scene=sceneByCampaign.get(campaign.id);return{id:campaign.id,name:campaign.name,role:membership?.role||"player",displayName:membership?.display_name||"",sceneId:scene?.sceneId||null,sceneName:scene?.name||"Структурированный бой",version:Number(scene?.version||0),updatedAt:scene?.updated_at||campaign.updated_at||""}}).filter(campaign=>campaign.sceneId).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  async function openCampaign(campaignId,sceneId){
    await ensureConnected();const membership=await client.from("campaign_members").select("role,display_name").eq("campaign_id",campaignId).eq("user_id",state.userId).maybeSingle();if(membership.error)return fail(membership.error);if(!membership.data)throw new Error("Этот стол больше недоступен");
    const campaign=await client.from("campaigns").select("id,name").eq("id",campaignId).single();if(campaign.error)return fail(campaign.error);
    patch({campaignId:campaign.data.id,campaignName:campaign.data.name,sceneId,role:membership.data.role,displayName:membership.data.display_name||state.displayName,version:0,error:""});return loadScene(sceneId);
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
    try{mutationChain=mutationChain.catch(()=>{}).then(async()=>{await ensureConnected();const result=await client.rpc("save_scene_snapshot",{p_scene_id:state.sceneId,p_expected_version:state.version,p_state:current.scene,p_event_type:current.label||"scene.snapshot"});if(result.error){if(result.error.code==="40001"||/version conflict/i.test(result.error.message||"")){patch({error:"Сцена изменилась на другом устройстве; загружена свежая версия"});await loadScene(state.sceneId)}else return fail(result.error)}else patch({version:Number(result.data),status:"online",lastSyncedAt:new Date().toISOString(),error:""})});await mutationChain}finally{saveInFlight=false;if(pendingSave)void flushSave()}
  }
  function queueScene(scene,label="scene.snapshot"){if(!["owner","narrator"].includes(state.role)||!state.sceneId)return;pendingSave={scene,label};clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flushSave(),250)}

  async function sendEventBatch(events,scene,label){
    await ensureConnected();
    const payload=events.map(event=>({id:event.id,type:event.type,actorId:event.actorId,payload:event.payload,at:event.at}));
    const result=await client.rpc("append_scene_events",{p_scene_id:state.sceneId,p_expected_version:state.version,p_events:payload,p_state:scene,p_label:label});
    if(result.error){if(result.error.code==="40001"||/version conflict/i.test(result.error.message||"")){await loadScene(state.sceneId);throw new Error("Сцена изменилась на другом устройстве; события не отправлены повторно автоматически")};return fail(result.error)}
    patch({version:Number(result.data),status:"online",lastSyncedAt:new Date().toISOString(),error:""});return result.data;
  }
  async function publishEvents(events,scene,label="scene.events"){
    if(!state.sceneId||!Array.isArray(events)||!events.length)return null;
    if(!["owner","narrator"].includes(state.role))return submitCommand("dispatch_events",{expectedVersion:state.version,events});
    mutationChain=mutationChain.catch(()=>{}).then(()=>sendEventBatch(events,scene,label));return mutationChain;
  }

  async function submitCommand(commandType,payload={}){await ensureConnected();if(!state.sceneId)throw new Error("Сначала войдите в кампанию");const result=await client.from("scene_commands").insert({campaign_id:state.campaignId,scene_id:state.sceneId,actor_id:state.userId,command_type:commandType,payload}).select().single();if(result.error)return fail(result.error);return result.data}
  async function acceptCommand(commandId,events,scene,label="scene.command.accepted"){
    await ensureConnected();if(!["owner","narrator"].includes(state.role))throw new Error("Решение принимает Нарратор");if(!Array.isArray(events)||!events.length)throw new Error("Команда не содержит событий");
    const rawId=String(commandId??"").trim();if(!/^\d+$/.test(rawId))throw new Error("Некорректный id команды");
    const payload=events.map(event=>({id:event.id,type:event.type,actorId:event.actorId,payload:event.payload,at:event.at}));
    const result=await client.rpc("accept_scene_command",{p_command_id:rawId,p_expected_version:state.version,p_events:payload,p_state:scene,p_label:label});
    if(result.error){if(result.error.code==="40001"||/version conflict/i.test(result.error.message||"")){await loadScene(state.sceneId);throw new Error("Сцена изменилась; проверьте команду игрока ещё раз")};return fail(result.error)}
    const acceptedVersion=Number(result.data);patch({version:acceptedVersion,status:"online",lastSyncedAt:new Date().toISOString(),error:""});if(acceptedVersion!==Number(scene?.version))await loadScene(state.sceneId);return acceptedVersion;
  }
  async function saveLibraryCharacter(hero){
    await ensureConnected();const localId=String(hero?.id||"").slice(0,120);if(!localId)throw new Error("У персонажа нет локального id");
    const record={owner_id:state.userId,local_id:localId,name:String(hero?.name||"Безымянный герой").slice(0,180),state:hero||{},updated_at:new Date().toISOString()};
    const result=await client.from("user_characters").upsert(record,{onConflict:"owner_id,local_id"}).select("id,local_id,name,state,version,updated_at").single();
    if(result.error)throw new Error(result.error.message||"Не удалось сохранить персонажа в облаке");emit("library-character",result.data);return result.data;
  }
  async function listLibraryCharacters(){await ensureConnected();const result=await client.from("user_characters").select("id,local_id,name,state,version,updated_at").order("updated_at",{ascending:false}).limit(60);if(result.error)throw new Error(result.error.message||"Не удалось открыть облачных персонажей");return result.data||[]}
  async function loadLibraryCharacter(characterId){await ensureConnected();const result=await client.from("user_characters").select("id,local_id,name,state,version,updated_at").eq("id",characterId).single();if(result.error)throw new Error(result.error.message||"Не удалось загрузить персонажа");return result.data}
  async function deleteLibraryCharacter(characterId){await ensureConnected();const result=await client.from("user_characters").delete().eq("id",characterId).select("id").single();if(result.error)throw new Error(result.error.message||"Не удалось удалить облачную копию");return result.data}
  async function saveCharacter(hero){
    await ensureConnected();if(!state.campaignId)throw new Error("Сначала войдите в кампанию");
    const localId=String(hero?.id||""),key=`${state.campaignId}:${localId}`,known=state.characterIds?.[key],characterId=known||global.crypto?.randomUUID?.();
    if(!characterId)throw new Error("Браузер не смог создать id персонажа");
    const result=await client.from("characters").upsert({id:characterId,campaign_id:state.campaignId,owner_id:state.userId,name:String(hero?.name||"Безымянный герой").slice(0,180),state:hero||{},updated_by:state.userId,updated_at:new Date().toISOString()},{onConflict:"id"}).select("id,version").single();
    if(result.error)return fail(result.error);state.characterIds={...(state.characterIds||{}),[key]:result.data.id};persist();await updatePresence({heroName:String(hero?.name||"Безымянный герой").slice(0,180)});return result.data;
  }
  async function listCharacters(){await ensureConnected();if(!state.campaignId)return[];const result=await client.from("characters").select("id,owner_id,name,state,version,updated_at").eq("campaign_id",state.campaignId).order("updated_at",{ascending:false});if(result.error)return fail(result.error);return result.data||[]}
  async function loadCharacter(characterId){await ensureConnected();if(!["owner","narrator"].includes(state.role))throw new Error("Лист игрока открывает Нарратор");const result=await client.from("characters").select("id,owner_id,name,state,version").eq("id",characterId).eq("campaign_id",state.campaignId).single();if(result.error)return fail(result.error);return result.data}
  async function decideCommand(commandId,decision){await ensureConnected();if(!["owner","narrator"].includes(state.role))throw new Error("Решение принимает Нарратор");const status=decision==="applied"?"applied":"rejected",result=await client.from("scene_commands").update({status,decided_by:state.userId,decided_at:new Date().toISOString()}).eq("id",commandId).eq("status","pending").select().single();if(result.error)return fail(result.error);return result.data}
  async function leave(){clearTimeout(saveTimer);pendingSave=null;await unsubscribe();patch({status:"authenticated",campaignId:null,campaignName:"",sceneId:null,role:null,version:0,presence:[],error:""});return snapshot()}

  state={...state,...stored()};if(!state.characterIds||typeof state.characterIds!=="object"||Array.isArray(state.characterIds))state.characterIds={};
  global.addEventListener?.("offline",()=>patch({status:"offline",error:"Нет соединения; локальные данные сохранены"}));
  global.addEventListener?.("online",()=>scheduleReconnect("offline"));
  global.DAWN_SYNC={acceptCommand,configure,connect,createCampaign,createInvite,decideCommand,deleteLibraryCharacter,hasConfig,leave,listCampaigns,listCharacters,listLibraryCharacters,loadCharacter,loadLibraryCharacter,loadScene,on,openCampaign,publishEvents,queueScene,redeemInvite,requestEmailLink,saveCharacter,saveLibraryCharacter,signOutAccount,state:snapshot,submitCommand,updatePresence};
})(window);
