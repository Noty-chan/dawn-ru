"use strict";

(function exposeDawnSync(global){
  const STORAGE_KEY="dawn-ru-sync-v1";
  const PROJECT=global.DAWN_CONFIG||{};
  const listeners=new Map();
  const presenceCache=new Map();
  let client=null,clientConfigKey="",connectInFlight=null,channel=null,channelGeneration=0,authSubscription=null,saveTimer=null,saveInFlight=false,pendingSave=null,reconnectTimer=null,reconnectAttempt=0,sceneRefreshTimer=null,sceneRefreshInFlight=false,pendingCommandsRefreshInFlight=false,lastPendingCommandSignature="",localMutationInFlight=0,mutationChain=Promise.resolve(),sceneLoadGeneration=0,sceneSessionGeneration=0,presenceDetails={},storageWarningShown=false;
  let state={status:"offline",authenticated:false,userId:null,email:"",isAnonymous:true,accountPending:false,userIdChanged:false,url:String(PROJECT.supabaseUrl||""),publishableKey:String(PROJECT.publishableKey||""),displayName:"",campaignId:null,campaignName:"",sceneId:null,role:null,version:0,characterIds:{},presence:[],lastSyncedAt:"",error:""};

  function stored(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")||{}}catch{return{}}}
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({url:state.url,publishableKey:state.publishableKey,displayName:state.displayName,campaignId:state.campaignId,campaignName:state.campaignName,sceneId:state.sceneId,role:state.role,characterIds:state.characterIds||{}}));storageWarningShown=false}catch(error){if(!storageWarningShown){storageWarningShown=true;console.warn("DAWN sync settings could not be persisted",error)}}}
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
      if(resetIdentity){sceneLoadGeneration++;sceneSessionGeneration++;presenceCache.clear();presenceDetails={}}
      patch({...next,...(resetIdentity?{campaignId:null,campaignName:"",sceneId:null,role:null,version:0,characterIds:{},presence:[]}:{}),status:keepSceneSession?state.status:session?(sceneId?"connecting":"authenticated"):"offline",error:""});
    });
    authSubscription=result?.data?.subscription||null;
  }

  async function connectOnce(){
    const saved={...stored(),...state};state={...state,...saved,status:"connecting",error:""};emit("status");
    if(!state.url||!state.publishableKey)throw new Error("Сначала укажите Project URL и publishable key");
    if(!global.supabase?.createClient)throw new Error("Библиотека Supabase не загрузилась; локальный режим продолжает работать");
    const nextConfigKey=`${state.url}\n${state.publishableKey}`;
    if(client&&clientConfigKey!==nextConfigKey){await unsubscribe();authSubscription?.unsubscribe?.();authSubscription=null;client=null}
    if(!client){client=global.supabase.createClient(state.url,state.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});clientConfigKey=nextConfigKey;setupAuthListener()}
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
  async function connect(){if(connectInFlight)return connectInFlight;connectInFlight=connectOnce();try{return await connectInFlight}finally{connectInFlight=null}}

  async function ensureConnected(){if(!client||!state.authenticated)await connect();return client}
  function beginSceneSession(sceneId){
    if(String(sceneId||"")===String(state.sceneId||""))return;
    sceneLoadGeneration++;
    sceneSessionGeneration++;
    presenceCache.clear();
    presenceDetails={};
  }
  async function unsubscribe(){clearTimeout(reconnectTimer);global.clearInterval?.(sceneRefreshTimer);reconnectTimer=null;sceneRefreshTimer=null;channelGeneration+=1;const previous=channel;channel=null;if(previous&&client)await client.removeChannel(previous)}
  async function refreshSceneIfNewer(force=false){
    if(sceneRefreshInFlight||!client||!state.sceneId||!force&&global.document?.hidden)return;
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
  async function refreshPendingCommands(){
    if(pendingCommandsRefreshInFlight||!client||!state.sceneId||!["owner","narrator"].includes(state.role))return;
    pendingCommandsRefreshInFlight=true;
    try{
      const result=await client.from("scene_commands").select("id,actor_id,command_type,payload,status,created_at").eq("scene_id",state.sceneId).eq("status","pending").order("created_at",{ascending:true}).limit(30);
      if(result.error)throw result.error;
      const commands=result.data||[],signature=commands.map(command=>`${command.id}:${command.command_type}`).join("|");
      if(signature!==lastPendingCommandSignature){lastPendingCommandSignature=signature;emit("commands",commands)}
    }catch(error){console.warn("DAWN command refresh failed",error)}
    finally{pendingCommandsRefreshInFlight=false}
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
    clearTimeout(saveTimer);pendingSave=null;sceneLoadGeneration++;sceneSessionGeneration++;presenceCache.clear();presenceDetails={};await unsubscribe();if(client){const result=await client.auth.signOut();if(result.error)return fail(result.error)}
    patch({status:"offline",authenticated:false,userId:null,email:"",isAnonymous:true,accountPending:false,campaignId:null,campaignName:"",sceneId:null,role:null,version:0,characterIds:{},presence:[],error:""});return snapshot();
  }
  function presencePayload(extra={}){return{userId:state.userId,displayName:state.displayName||"Игрок",role:state.role||"player",onlineAt:new Date().toISOString(),...extra}}
  function readPresence(){
    if(!channel?.presenceState)return[];
    const now=Date.now(),rows=Object.values(channel.presenceState()||{}).flat().filter(item=>item&&item.userId);
    for(const item of rows)presenceCache.set(item.userId,{item,seenAt:now});
    for(const [userId,entry] of presenceCache)if(now-entry.seenAt>10000)presenceCache.delete(userId);
    return[...presenceCache.values()].map(entry=>entry.item).sort((a,b)=>String(a.displayName||"").localeCompare(String(b.displayName||""),"ru"));
  }
  async function updatePresence(extra={}){presenceDetails={...presenceDetails,...extra};if(!channel?.track||!state.sceneId)return;await channel.track(presencePayload(presenceDetails))}
  async function subscribe(){
    await unsubscribe();if(!client||!state.sceneId)return;
    const generation=++channelGeneration;
    const canNarrate=["owner","narrator"].includes(state.role);
    const sceneTable=canNarrate?"scenes":"scene_public_snapshots";
    const sceneFilter=canNarrate?`id=eq.${state.sceneId}`:`scene_id=eq.${state.sceneId}`;
    channel=client.channel(`dawn-scene-${state.sceneId}`,{config:{presence:{key:state.userId}}})
      .on("presence",{event:"sync"},()=>{state={...state,presence:readPresence()};emit("presence",state.presence)})
      .on("presence",{event:"join"},()=>setTimeout(()=>{state={...state,presence:readPresence()};emit("presence",state.presence)},0))
      .on("presence",{event:"leave"},()=>{setTimeout(()=>{state={...state,presence:readPresence()};emit("presence",state.presence)},0);setTimeout(()=>{state={...state,presence:readPresence()};emit("presence",state.presence)},10100)})
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:sceneTable,filter:sceneFilter},payload=>{
        const remote=payload.new;if(!remote||remote.version<=state.version||localMutationInFlight&&remote.updated_by===state.userId)return;patch({version:remote.version,status:"online",lastSyncedAt:new Date().toISOString(),error:""});emit("scene",{state:remote.state,version:remote.version,updatedBy:remote.updated_by});
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"scene_commands",filter:`scene_id=eq.${state.sceneId}`},payload=>{if(["owner","narrator"].includes(state.role))emit("command",payload.new)})
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"scene_commands",filter:`scene_id=eq.${state.sceneId}`},payload=>{if(payload.new)emit("command-update",payload.new)})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"scene_events",filter:`scene_id=eq.${state.sceneId}`},payload=>{if(payload.new){emit("event",payload.new);if(Number(payload.new.scene_version)>Number(state.version)&&!(localMutationInFlight&&payload.new.actor_id===state.userId))void refreshSceneIfNewer(true)}})
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"characters",filter:`campaign_id=eq.${state.campaignId}`},payload=>{if(payload.new)emit("character",payload.new)})
      .subscribe(status=>{if(generation!==channelGeneration)return;if(status==="SUBSCRIBED"){reconnectAttempt=0;patch({status:"online",lastSyncedAt:new Date().toISOString(),error:""});global.clearInterval?.(sceneRefreshTimer);sceneRefreshTimer=global.setInterval?.(()=>{void refreshSceneIfNewer();void refreshPendingCommands()},2500)||null;void updatePresence().catch(error=>console.warn("Presence update failed",error));void refreshPendingCommands()}else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))scheduleReconnect(status)});
  }

  async function loadScene(sceneId){
    const requestedSceneId=String(sceneId||""),loadGeneration=++sceneLoadGeneration;
    await ensureConnected();
    if(loadGeneration!==sceneLoadGeneration||!state.authenticated)return null;
    const canNarrate=["owner","narrator"].includes(state.role);
    const result=canNarrate
      ?await client.from("scenes").select("id,campaign_id,name,state,version").eq("id",requestedSceneId).single()
      :await client.from("scene_public_snapshots").select("scene_id,campaign_id,state,version").eq("scene_id",requestedSceneId).single();
    if(result.error)return fail(result.error);
    if(loadGeneration!==sceneLoadGeneration||!state.authenticated)return null;
    const scene={...result.data,id:result.data.id||result.data.scene_id};
    if(state.sceneId&&state.sceneId!==scene.id){sceneSessionGeneration++;presenceCache.clear();presenceDetails={}}
    lastPendingCommandSignature="";patch({sceneId:scene.id,campaignId:scene.campaign_id,version:scene.version,status:"connecting",lastSyncedAt:new Date().toISOString(),error:""});await subscribe();if(loadGeneration!==sceneLoadGeneration||state.sceneId!==scene.id)return null;emit("scene",{state:scene.state,version:scene.version,initial:true});if(canNarrate)await refreshPendingCommands();return scene;
  }

  async function createCampaign(name,initialState){
    await ensureConnected();const result=await client.rpc("create_campaign",{p_name:String(name||"").trim(),p_display_name:state.displayName||"Нарратор",p_initial_state:initialState||{}}).single();if(result.error)return fail(result.error);
    beginSceneSession(result.data.scene_id);patch({campaignId:result.data.campaign_id,sceneId:result.data.scene_id,role:result.data.role,campaignName:String(name||"").trim(),version:1});await loadScene(result.data.scene_id);return snapshot();
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
    beginSceneSession(sceneId);patch({campaignId:campaign.data.id,campaignName:campaign.data.name,sceneId,role:membership.data.role,displayName:membership.data.display_name||state.displayName,version:0,error:""});return loadScene(sceneId);
  }

  async function createInvite(role="player"){
    await ensureConnected();if(!["owner","narrator"].includes(state.role))throw new Error("Приглашения создаёт только Нарратор");const result=await client.rpc("create_campaign_invite",{p_campaign_id:state.campaignId,p_role:role,p_max_uses:8,p_expires_hours:168});if(result.error)return fail(result.error);return result.data;
  }

  async function redeemInvite(token){
    await ensureConnected();const result=await client.rpc("redeem_campaign_invite",{p_token:String(token||"").trim(),p_display_name:state.displayName||"Игрок"}).single();if(result.error)return fail(result.error);
    beginSceneSession(result.data.scene_id);patch({campaignId:result.data.campaign_id,campaignName:result.data.campaign_name,sceneId:result.data.scene_id,role:result.data.role,version:0});await loadScene(result.data.scene_id);return snapshot();
  }

  function serializeSceneMutation(work){const run=mutationChain.catch(()=>{}).then(work);mutationChain=run.catch(()=>{});return run}
  function sceneSessionIsActive(sceneId,generation){return generation===sceneSessionGeneration&&String(sceneId||"")===String(state.sceneId||"")}
  async function flushSave(){
    if(saveInFlight||!pendingSave||!["owner","narrator"].includes(state.role))return;saveInFlight=true;const current=pendingSave;pendingSave=null;
    try{await serializeSceneMutation(async()=>{await ensureConnected();const sceneId=state.sceneId,generation=sceneSessionGeneration,result=await client.rpc("save_scene_snapshot",{p_scene_id:sceneId,p_expected_version:state.version,p_state:current.scene,p_event_type:current.label||"scene.snapshot"});if(!sceneSessionIsActive(sceneId,generation))throw new Error("Стол уже закрыт");if(result.error){if(result.error.code==="40001"||/version conflict/i.test(result.error.message||"")){patch({error:"Сцена изменилась на другом устройстве; загружена свежая версия"});await loadScene(sceneId)}else return fail(result.error)}else patch({version:Number(result.data),status:"online",lastSyncedAt:new Date().toISOString(),error:""})})}finally{saveInFlight=false;if(pendingSave)void flushSave()}
  }
  function queueScene(scene,label="scene.snapshot"){if(!["owner","narrator"].includes(state.role)||!state.sceneId)return;pendingSave={scene:global.DAWN_NETWORK_V2?.networkSceneState?.(scene)||scene,label};clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flushSave(),250)}

  async function sendEventBatch(events,scene,label){
    await ensureConnected();
    const sceneId=state.sceneId,generation=sceneSessionGeneration,payload=events.map(event=>({id:event.id,type:event.type,actorId:event.actorId,payload:event.payload,at:event.at}));
    localMutationInFlight++;let result;try{result=await client.rpc("append_scene_events",{p_scene_id:sceneId,p_expected_version:state.version,p_events:payload,p_state:scene,p_label:label})}finally{localMutationInFlight--}
    if(!sceneSessionIsActive(sceneId,generation))throw new Error("Стол уже закрыт");
    if(result.error){if(result.error.code==="40001"||/version conflict/i.test(result.error.message||"")){await loadScene(sceneId);throw new Error("Сцена изменилась на другом устройстве; события не отправлены повторно автоматически")};return fail(result.error)}
    patch({version:Number(result.data),status:"online",lastSyncedAt:new Date().toISOString(),error:""});return result.data;
  }
  async function publishEvents(events,scene,label="scene.events"){
    if(!state.sceneId||!Array.isArray(events)||!events.length)return null;
    if(!["owner","narrator"].includes(state.role))return submitCommand("dispatch_events",{expectedVersion:state.version,events});
    return serializeSceneMutation(()=>sendEventBatch(events,scene,label));
  }

  async function submitCommand(commandType,payload={}){
    await ensureConnected();if(!state.sceneId)throw new Error("Сначала войдите в кампанию");
    const record={campaign_id:state.campaignId,scene_id:state.sceneId,actor_id:state.userId,command_type:commandType,payload};
    if(commandType==="intent_v2"){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(payload?.clientIntentId||"")))throw new Error("У сетевой команды нет корректного id");record.client_intent_id=payload.clientIntentId}
    const result=await client.from("scene_commands").insert(record).select().single();
    if(result.error?.code==="23505"&&record.client_intent_id){
      const existing=await client.from("scene_commands").select().eq("scene_id",state.sceneId).eq("actor_id",state.userId).eq("client_intent_id",record.client_intent_id).single();
      if(existing.error)return fail(existing.error);
      return existing.data;
    }
    if(result.error)return fail(result.error);return result.data;
  }
  async function acceptCommand(commandId,events,scene,label="scene.command.accepted"){
    return serializeSceneMutation(async()=>{
      await ensureConnected();if(!["owner","narrator"].includes(state.role))throw new Error("Решение принимает Нарратор");if(!Array.isArray(events)||!events.length)throw new Error("Команда не содержит событий");
      const rawId=String(commandId??"").trim();if(!/^\d+$/.test(rawId))throw new Error("Некорректный id команды");
      const sceneId=state.sceneId,generation=sceneSessionGeneration,payload=events.map(event=>({id:event.id,type:event.type,actorId:event.actorId,payload:event.payload,at:event.at}));
      localMutationInFlight++;let result;try{result=await client.rpc("accept_scene_command",{p_command_id:rawId,p_expected_version:state.version,p_events:payload,p_state:scene,p_label:label})}finally{localMutationInFlight--}
      if(!sceneSessionIsActive(sceneId,generation))throw new Error("Стол уже закрыт");
      if(result.error){if(result.error.code==="40001"||/version conflict/i.test(result.error.message||"")){await loadScene(sceneId);throw new Error("Сцена изменилась; проверьте команду игрока ещё раз")};return fail(result.error)}
      const acceptedVersion=Number(result.data);patch({version:acceptedVersion,status:"online",lastSyncedAt:new Date().toISOString(),error:""});if(acceptedVersion!==Number(scene?.version))await loadScene(sceneId);return acceptedVersion;
    });
  }
  async function settleIntentBatch({commandIds=[],rejectedCommandIds=[],events=[],scene,expectedVersion=state.version,label="network.v2.tick"}={}){
    return serializeSceneMutation(async()=>{
      await ensureConnected();if(!["owner","narrator"].includes(state.role))throw new Error("Сетевой такт выполняет Нарратор");
      const ids=commandIds.map(value=>String(value)).filter(value=>/^\d+$/.test(value));
      const rejected=rejectedCommandIds.map(value=>String(value)).filter(value=>/^\d+$/.test(value));
      const sceneId=state.sceneId,generation=sceneSessionGeneration,payload=events.map(event=>({id:event.id,type:event.type,actorId:event.actorId,payload:event.payload,at:event.at}));
      localMutationInFlight++;let result;try{result=await client.rpc("settle_scene_intent_batch",{p_scene_id:sceneId,p_expected_version:Number(expectedVersion),p_command_ids:ids,p_rejected_command_ids:rejected,p_events:payload,p_state:scene,p_label:label})}finally{localMutationInFlight--}
      if(!sceneSessionIsActive(sceneId,generation))throw new Error("Стол уже закрыт");
      if(result.error){
        if(result.error.code==="40001"||/version conflict/i.test(result.error.message||"")){await loadScene(sceneId);throw new Error("Сетевой такт столкнулся с новой версией Сцены и будет пересчитан")}
        return fail(result.error);
      }
      const acceptedVersion=Number(result.data);patch({version:acceptedVersion,status:"online",lastSyncedAt:new Date().toISOString(),error:""});return acceptedVersion;
    });
  }
  async function refreshScene(){await ensureConnected();if(state.sceneId)await loadScene(state.sceneId);return snapshot()}
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
  async function leave(){clearTimeout(saveTimer);pendingSave=null;sceneLoadGeneration++;sceneSessionGeneration++;presenceCache.clear();presenceDetails={};lastPendingCommandSignature="";await unsubscribe();patch({status:"authenticated",campaignId:null,campaignName:"",sceneId:null,role:null,version:0,presence:[],error:""});return snapshot()}

  state={...state,...stored()};if(!state.characterIds||typeof state.characterIds!=="object"||Array.isArray(state.characterIds))state.characterIds={};
  global.addEventListener?.("offline",()=>patch({status:"offline",error:"Нет соединения; локальные данные сохранены"}));
  global.addEventListener?.("online",()=>scheduleReconnect("offline"));
  global.document?.addEventListener?.("visibilitychange",()=>{if(!global.document.hidden)void refreshSceneIfNewer(true)});
  global.DAWN_SYNC={acceptCommand,configure,connect,createCampaign,createInvite,decideCommand,deleteLibraryCharacter,hasConfig,leave,listCampaigns,listCharacters,listLibraryCharacters,loadCharacter,loadLibraryCharacter,loadScene,on,openCampaign,publishEvents,queueScene,redeemInvite,refreshScene,requestEmailLink,saveCharacter,saveLibraryCharacter,settleIntentBatch,signOutAccount,state:snapshot,submitCommand,updatePresence};
})(window);
