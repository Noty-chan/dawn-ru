"use strict";

function configureSyncFromForm(){if(!Sync)throw new Error("Модуль общего стола не загрузился");return Sync.configure({url:$("sync-url").value,publishableKey:$("sync-key").value,displayName:$("sync-display-name").value||S.player||"Игрок"})}
function inviteToken(value){const raw=String(value||"").trim();if(!raw)return"";try{return new URL(raw).searchParams.get("invite")||raw}catch{return raw}}
function inviteLink(token){const url=new URL(location.href);url.search="";url.hash="";url.searchParams.set("mode","play");url.searchParams.set("invite",token);return url.href}
async function publishCurrentHero(){await Sync.saveLibraryCharacter(S);const character=await Sync.saveCharacter(S);await Sync.submitCommand("join_hero",{characterId:character.id,heroId:S.id});return character}
async function runSyncAction(action,success){try{await action();renderSync();renderScene();if(success)toast(success)}catch(error){renderSync();toast(error?.message||"Не удалось подключить общий стол")}}
let lastInviteToken="",pendingSceneCommands=[],pendingCommandSceneId=null,cloudCharacters=[],cloudLibraryUserId=null,cloudLibraryLoading=false,savedCampaigns=[],savedCampaignUserId=null,savedCampaignsLoading=false,automaticCommandChain=Promise.resolve();
const automaticCommandAttempts=new Map();
function resetClientTableRuntime(){
  resetNetworkV2Runtime();pendingSceneCommands=[];pendingCommandSceneId=null;automaticCommandAttempts.clear();lastInviteToken="";
  $("sync-invite-output").textContent="";$("sync-copy-invite").hidden=true;
}
function renderCloudLibrary(){
  const select=$("sync-library-select"),selected=select.value;select.innerHTML=cloudCharacters.length?`<option value="">Выберите персонажа</option>${cloudCharacters.map(record=>`<option value="${record.id}">${esc(record.name)} · версия ${record.version}</option>`).join("")}`:`<option value="">В облаке пока нет персонажей</option>`;if(cloudCharacters.some(record=>record.id===selected))select.value=selected;const chosen=Boolean(select.value);$("sync-library-load").disabled=!chosen;$("sync-library-delete").disabled=!chosen;
}
async function refreshCloudCharacters(){if(cloudLibraryLoading)return;cloudLibraryLoading=true;try{cloudCharacters=await Sync.listLibraryCharacters();cloudLibraryUserId=Sync.state().userId;renderCloudLibrary()}finally{cloudLibraryLoading=false}}
function renderSavedCampaigns(){
  const select=$("sync-table-select"),selected=select.value,roleNames={owner:"Нарратор",narrator:"Нарратор",player:"Игрок"};select.innerHTML=savedCampaigns.length?`<option value="">Выберите стол</option>${savedCampaigns.map(campaign=>`<option value="${campaign.sceneId}">${esc(campaign.name)} · ${roleNames[campaign.role]||campaign.role} · версия ${campaign.version}</option>`).join("")}`:`<option value="">Сохранённых столов пока нет</option>`;if(savedCampaigns.some(campaign=>campaign.sceneId===selected))select.value=selected;const chosen=savedCampaigns.find(campaign=>campaign.sceneId===select.value),canDelete=chosen?.role==="owner";$("sync-table-open").disabled=!chosen;$("sync-table-delete").hidden=!canDelete;$("sync-table-delete").disabled=!canDelete;
}
async function refreshSavedCampaigns(){if(savedCampaignsLoading)return;savedCampaignsLoading=true;try{savedCampaigns=await Sync.listCampaigns();savedCampaignUserId=Sync.state().userId;renderSavedCampaigns()}finally{savedCampaignsLoading=false}}
function renderSyncAccount(sync=Sync.state()){
  const label=sync.hasAccount?sync.email:sync.authenticated?"Гостевая сессия":"Не подключён",pending=sync.accountPending?" · проверьте почту":"";$("sync-account-state").textContent=`${label}${pending}`;$("sync-account-email").hidden=sync.hasAccount;$("sync-account-link").hidden=sync.hasAccount;$("sync-account-signout").hidden=!sync.authenticated;$("sync-library-save").disabled=!sync.authenticated;$("sync-library-refresh").disabled=!sync.authenticated;$("sync-table-refresh").disabled=!sync.authenticated;if(sync.hasAccount&&sync.userId&&cloudLibraryUserId!==sync.userId&&!cloudLibraryLoading)setTimeout(()=>refreshCloudCharacters().catch(error=>toast(error.message||"Не удалось открыть облачных персонажей")),0);if(sync.authenticated&&sync.userId&&savedCampaignUserId!==sync.userId&&!savedCampaignsLoading)setTimeout(()=>refreshSavedCampaigns().catch(error=>toast(error.message||"Не удалось открыть сохранённые столы")),0);if(!sync.userId&&cloudLibraryUserId){cloudLibraryUserId=null;cloudCharacters=[];renderCloudLibrary()}if(!sync.userId&&savedCampaignUserId){savedCampaignUserId=null;savedCampaigns=[];renderSavedCampaigns()}}
function installCloudHero(record){const hero=normalizeHero(record.state),index=store.heroes.findIndex(item=>item.id===hero.id);if(index>=0)store.heroes[index]=hero;else store.heroes.push(hero);store.current=index>=0?index:store.heroes.length-1;S=store.heroes[store.current];persist();renderAll();return hero}
function hydratePlayerScene(scene){
  if(Sync.state().role!=="player")return scene;const actor=scene.actors.find(item=>item.heroId===S.id);if(!actor)return scene;
  Object.assign(S.runtime,{hp:actor.hp,maxHp:actor.maxHp,wounds:actor.wounds,stress:actor.stress,focus:actor.focus,influence:actor.influence,ap:actor.ap,effects:[...(actor.effects||[])]});S.runtime.tension=scene.tension;
  Object.assign(actor,heroActorState(S,actor),{ownerId:null,characterId:null,hp:actor.hp,maxHp:actor.maxHp,wounds:actor.wounds,stress:actor.stress,focus:actor.focus,influence:actor.influence,ap:actor.ap,effects:[...(actor.effects||[])]});return scene;
}
$("sync-config-form").addEventListener("submit",event=>{event.preventDefault();runSyncAction(async()=>{configureSyncFromForm();await Sync.connect()},"Авторизация общего стола готова")});
$("sync-account-link").onclick=()=>runSyncAction(async()=>{if(!Sync.hasConfig())configureSyncFromForm();const result=await Sync.requestEmailLink($("sync-account-email").value);if(result.mode==="ready")throw new Error("Этот аккаунт уже подключён")},"Ссылка отправлена. Откройте письмо в этом браузере");
$("sync-account-signout").onclick=()=>runSyncAction(async()=>{resetClientTableRuntime();await Sync.signOutAccount();cloudCharacters=[];cloudLibraryUserId=null;renderCloudLibrary()},"Вы вышли из аккаунта");
$("sync-library-save").onclick=()=>runSyncAction(async()=>{await Sync.saveLibraryCharacter(S);await refreshCloudCharacters()},"Персонаж сохранён в облаке");
$("sync-library-refresh").onclick=()=>runSyncAction(refreshCloudCharacters,"Список облачных персонажей обновлён");
$("sync-library-select").onchange=renderCloudLibrary;
$("sync-library-load").onclick=()=>runSyncAction(async()=>{const record=await Sync.loadLibraryCharacter($("sync-library-select").value),hero=installCloudHero(record);toast(`Загружен персонаж «${hero.name||"Безымянный герой"}»`)},"");
$("sync-library-delete").onclick=()=>runSyncAction(async()=>{const record=cloudCharacters.find(item=>item.id===$("sync-library-select").value);if(!record||!window.confirm(`Удалить облачную копию «${record.name}»? Локальный персонаж останется.`))return;await Sync.deleteLibraryCharacter(record.id);await refreshCloudCharacters()},"Облачная копия удалена");
$("sync-table-select").onchange=renderSavedCampaigns;
$("sync-table-refresh").onclick=()=>runSyncAction(refreshSavedCampaigns,"Список столов обновлён");
$("sync-table-open").onclick=()=>runSyncAction(async()=>{const campaign=savedCampaigns.find(item=>item.sceneId===$("sync-table-select").value);if(!campaign)throw new Error("Выберите сохранённый стол");resetClientTableRuntime();await Sync.openCampaign(campaign.id,campaign.sceneId)},"Стол открыт");
$("sync-table-delete").onclick=()=>{const campaign=savedCampaigns.find(item=>item.sceneId===$("sync-table-select").value);if(!campaign||campaign.role!=="owner"){toast("Удалить стол может только его владелец");return}if(!window.confirm(`Удалить стол «${campaign.name}» без возможности восстановления?`))return;runSyncAction(async()=>{if(Sync.state().campaignId===campaign.id)resetClientTableRuntime();await Sync.deleteCampaign(campaign.id);await refreshSavedCampaigns()},"Стол удалён")};
$("sync-create-campaign").onclick=()=>runSyncAction(async()=>{configureSyncFromForm();await Sync.connect();resetClientTableRuntime();await Sync.createCampaign($("sync-campaign-name").value.trim()||"Серия DAWN",sceneCore(blankScene()));await refreshSavedCampaigns()},"Кампания создана; Сцена синхронизируется");
$("sync-join-campaign").onclick=()=>runSyncAction(async()=>{configureSyncFromForm();await Sync.connect();resetClientTableRuntime();await Sync.redeemInvite(inviteToken($("sync-invite-token").value));await refreshSavedCampaigns()},"Вы вошли за общий стол");
$("sync-create-invite").onclick=()=>runSyncAction(async()=>{lastInviteToken=await Sync.createInvite("player");$("sync-invite-output").textContent=`Ссылка для игроков: ${inviteLink(lastInviteToken)}`;$("sync-copy-invite").hidden=false},"Приглашение действует 7 дней или 8 входов");
$("sync-copy-invite").onclick=()=>runSyncAction(async()=>{if(!lastInviteToken)throw new Error("Сначала создайте приглашение");await navigator.clipboard.writeText(inviteLink(lastInviteToken))},"Ссылка скопирована");
$("sync-publish-hero").onclick=()=>runSyncAction(publishCurrentHero,"Лист и токен отправлены за стол");
const leaveCurrentTable=()=>runSyncAction(async()=>{resetClientTableRuntime();await Sync.leave();await refreshSavedCampaigns()},"Компаньон снова работает локально");
$("sync-leave").onclick=leaveCurrentTable;
$("sync-leave-table").onclick=leaveCurrentTable;
$("sync-send-targets").onclick=()=>runSyncAction(async()=>{await Sync.submitCommand("set_targets",{targetIds:Scene.targetIds.slice(0,40),heroId:S.id})},"Цели отправлены за стол");
$("sync-request-undo").onclick=()=>runSyncAction(async()=>{await Sync.submitCommand("request_undo",{reason:"player_request"})},"Запрос отката отправлен Нарратору");
async function prepareSceneCommand(command){if(command.command_type==="set_targets")return prepareTargetsCommand(command);if(command.command_type==="request_undo")return prepareUndoCommand(command);if(command.command_type==="join_hero")return prepareRemoteHeroCommand(command);if(command.command_type==="update_runtime")return prepareRuntimeCommand(command);if(command.command_type==="dispatch_events")return prepareEventCommand(command);return null}
async function decideSceneCommand(command,decision){if(decision==="applied"&&command.command_type==="set_targets"){applyTransientTargetsCommand(command);await Sync.decideCommand(command.id,"applied")}else if(decision==="applied"){const prepared=await prepareSceneCommand(command);if(!prepared)decision="rejected";else await acceptPreparedRemoteCommand(command,prepared)}if(decision==="rejected")await Sync.decideCommand(command.id,"rejected");pendingSceneCommands=pendingSceneCommands.filter(item=>String(item.id)!==String(command.id));automaticCommandAttempts.delete(String(command.id));renderSync()}
function queueAutomaticCommand(command){
  const id=String(command?.id||""),version=Number(Scene.version||0);
  if(!id||!Sync.state().canNarrate||!NetworkV2.AUTOMATIC_COMMANDS.has(command.command_type))return;
  if(command.command_type==="intent_v2"){
    if(automaticCommandAttempts.has(id))return;
    automaticCommandAttempts.set(id,"v2");
    try{if(!enqueueNetworkV2Command(command))automaticCommandAttempts.delete(id)}
    catch(error){automaticCommandAttempts.delete(id);throw error}
    return;
  }
  if(automaticCommandAttempts.get(id)===version)return;
  automaticCommandAttempts.set(id,version);
  automaticCommandChain=automaticCommandChain.catch(()=>{}).then(async()=>{
    const current=pendingSceneCommands.find(item=>String(item.id)===id);
    if(!current)return;
    try{await decideSceneCommand(current,"applied")}
    catch(error){automaticCommandAttempts.delete(id);renderSync();toast(`Действие игрока временно задержано: ${error?.message||"не удалось проверить"}`);setTimeout(()=>{const retry=pendingSceneCommands.find(item=>String(item.id)===id);if(retry)queueAutomaticCommand(retry)},1200)}
  });
}
function queueAutomaticCommands(){pendingSceneCommands.forEach(queueAutomaticCommand)}
$("sync-command-queue").addEventListener("click",event=>{const button=event.target.closest("[data-sync-command]");if(!button)return;runSyncAction(async()=>{const command=pendingSceneCommands.find(item=>String(item.id)===button.dataset.syncCommand);if(!command)return;button.disabled=true;await decideSceneCommand(command,button.dataset.syncDecision)},"Команда игрока обработана")});

Sync?.on("status",()=>{renderSync();if(store.mode==="tools")renderToolsSyncState()});
Sync?.on("presence",()=>renderSync());
Sync?.on("scene",payload=>{if(!payload?.state||typeof payload.state!=="object")return;const sceneId=Sync.state().sceneId;if(sceneId!==pendingCommandSceneId){pendingSceneCommands=[];automaticCommandAttempts.clear();pendingCommandSceneId=sceneId}const remote=mergeNetworkV2Scene({...payload.state,version:Number(payload.version??payload.state.version??0)},Scene);Scene=hydratePlayerScene(remote);store.scene=Scene;persist();if(store.mode==="play")renderPlay();if(store.mode==="tools"){renderClocks();renderDiceHistory();renderAllInControls()}queueAutomaticCommands()});
Sync?.on("commands",commands=>{pendingSceneCommands=Array.isArray(commands)?commands:[];retainPendingNetworkV2Commands(pendingSceneCommands.map(command=>command.id));renderSync();queueAutomaticCommands()});
Sync?.on("command",command=>{if(command&&!pendingSceneCommands.some(item=>String(item.id)===String(command.id)))pendingSceneCommands.push(command);renderSync();queueAutomaticCommand(command)});
Sync?.on("command-update",command=>{if(!command)return;if(command.status!=="pending"){discardNetworkV2Commands([command.id]);pendingSceneCommands=pendingSceneCommands.filter(item=>String(item.id)!==String(command.id));automaticCommandAttempts.delete(String(command.id))}renderSync()});
globalThis.addEventListener("dawn-network-v2-settled",event=>{const ids=new Set([...(event.detail?.commandIds||[]),...(event.detail?.rejectedCommandIds||[])].map(String));discardNetworkV2Commands([...ids]);pendingSceneCommands=pendingSceneCommands.filter(command=>!ids.has(String(command.id)));ids.forEach(id=>automaticCommandAttempts.delete(id));renderSync()});
