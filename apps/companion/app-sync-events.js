"use strict";

function configureSyncFromForm(){if(!Sync)throw new Error(t("sync.error.module"));return Sync.configure({url:$("sync-url").value,publishableKey:$("sync-key").value,displayName:$("sync-display-name").value||S.player||t("sync.role.player")})}
function inviteToken(value){const raw=String(value||"").trim();if(!raw)return"";try{return new URL(raw).searchParams.get("invite")||raw}catch{return raw}}
function inviteLink(token){const url=new URL(location.href);url.search="";url.hash="";url.searchParams.set("mode","play");url.searchParams.set("lang",contentPreferences.locale);url.searchParams.set("edition",contentPreferences.edition);url.searchParams.set("invite",token);return url.href}
async function publishCurrentHero(){await Sync.saveLibraryCharacter(S);const character=await Sync.saveCharacter(S);await Sync.submitCommand("join_hero",{characterId:character.id,heroId:S.id});return character}
async function runSyncAction(action,success){try{await action();renderSync();renderScene();if(success)toast(success)}catch(error){renderSync();toast(error?.message||t("sync.error.connect"))}}
let lastInviteToken="",pendingSceneCommands=[],pendingCommandSceneId=store.sceneSessionId||null,cloudCharacters=[],cloudLibraryUserId=null,cloudLibraryLoading=false,savedCampaigns=[],savedCampaignUserId=null,savedCampaignsLoading=false,automaticCommandChain=Promise.resolve();
const automaticCommandAttempts=new Map();
const automaticCommandRetries=new Map();
const delayedAutomaticCommands=new Set();
function resetClientTableRuntime(){
  resetNetworkV2Runtime();pendingSceneCommands=[];pendingCommandSceneId=null;automaticCommandAttempts.clear();automaticCommandRetries.clear();delayedAutomaticCommands.clear();lastInviteToken="";
  $("sync-invite-output").textContent="";$("sync-copy-invite").hidden=true;
}
function renderCloudLibrary(){
  const select=$("sync-library-select"),selected=select.value;select.innerHTML=cloudCharacters.length?`<option value="">${esc(t("sync.chooseCharacter"))}</option>${cloudCharacters.map(record=>`<option value="${record.id}">${esc(record.name)} · ${esc(t("sync.version",{version:record.version}))}</option>`).join("")}`:`<option value="">${esc(t("sync.emptyCharacters"))}</option>`;if(cloudCharacters.some(record=>record.id===selected))select.value=selected;const chosen=Boolean(select.value);$("sync-library-load").disabled=!chosen;$("sync-library-delete").disabled=!chosen;
}
async function refreshCloudCharacters(){if(cloudLibraryLoading)return;cloudLibraryLoading=true;try{cloudCharacters=await Sync.listLibraryCharacters();cloudLibraryUserId=Sync.state().userId;renderCloudLibrary()}finally{cloudLibraryLoading=false}}
function renderSavedCampaigns(){
  const select=$("sync-table-select"),selected=select.value,roleNames={owner:t("sync.role.narrator"),narrator:t("sync.role.narrator"),player:t("sync.role.player")};select.innerHTML=savedCampaigns.length?`<option value="">${esc(t("sync.chooseTable"))}</option>${savedCampaigns.map(campaign=>`<option value="${campaign.sceneId}">${esc(campaign.name)} · ${roleNames[campaign.role]||campaign.role} · ${esc(t("sync.version",{version:campaign.version}))}</option>`).join("")}`:`<option value="">${esc(t("sync.emptyTables"))}</option>`;if(savedCampaigns.some(campaign=>campaign.sceneId===selected))select.value=selected;const chosen=savedCampaigns.find(campaign=>campaign.sceneId===select.value),canDelete=chosen?.role==="owner";$("sync-table-open").disabled=!chosen;$("sync-table-delete").hidden=!canDelete;$("sync-table-delete").disabled=!canDelete;
}
async function refreshSavedCampaigns(){if(savedCampaignsLoading)return;savedCampaignsLoading=true;try{savedCampaigns=await Sync.listCampaigns();savedCampaignUserId=Sync.state().userId;renderSavedCampaigns()}finally{savedCampaignsLoading=false}}
function renderSyncAccount(sync=Sync.state()){
  const label=sync.hasAccount?sync.email:sync.authenticated?t("sync.account.guest"):t("sync.account.disconnected"),pending=sync.accountPending?t("sync.account.checkMail"):"";$("sync-account-state").textContent=`${label}${pending}`;$("sync-account-email").hidden=sync.hasAccount;$("sync-account-link").hidden=sync.hasAccount;$("sync-account-signout").hidden=!sync.authenticated;$("sync-library-save").disabled=!sync.authenticated;$("sync-library-refresh").disabled=!sync.authenticated;$("sync-table-refresh").disabled=!sync.authenticated;if(sync.hasAccount&&sync.userId&&cloudLibraryUserId!==sync.userId&&!cloudLibraryLoading)setTimeout(()=>refreshCloudCharacters().catch(error=>toast(error.message||t("sync.error.characters"))),0);if(sync.authenticated&&sync.userId&&savedCampaignUserId!==sync.userId&&!savedCampaignsLoading)setTimeout(()=>refreshSavedCampaigns().catch(error=>toast(error.message||t("sync.error.tables"))),0);if(!sync.userId&&cloudLibraryUserId){cloudLibraryUserId=null;cloudCharacters=[];renderCloudLibrary()}if(!sync.userId&&savedCampaignUserId){savedCampaignUserId=null;savedCampaigns=[];renderSavedCampaigns()}}
function installCloudHero(record){const hero=normalizeHero(record.state),index=store.heroes.findIndex(item=>item.id===hero.id);if(index>=0)store.heroes[index]=hero;else store.heroes.push(hero);store.current=index>=0?index:store.heroes.length-1;S=store.heroes[store.current];persist();renderAll();return hero}
function hydratePlayerScene(scene){
  if(Sync.state().role!=="player")return scene;const actor=scene.actors.find(item=>item.heroId===S.id);if(!actor)return scene;
  Object.assign(S.runtime,{hp:actor.hp,maxHp:actor.maxHp,wounds:actor.wounds,stress:actor.stress,focus:actor.focus,influence:actor.influence,ap:actor.ap,effects:[...(actor.effects||[])]});S.runtime.tension=scene.tension;
  Object.assign(actor,heroActorState(S,actor),{ownerId:null,characterId:null,hp:actor.hp,maxHp:actor.maxHp,wounds:actor.wounds,stress:actor.stress,focus:actor.focus,influence:actor.influence,ap:actor.ap,effects:[...(actor.effects||[])]});return scene;
}
$("sync-config-form").addEventListener("submit",event=>{event.preventDefault();runSyncAction(async()=>{configureSyncFromForm();await Sync.connect()},t("sync.notice.authReady"))});
$("sync-account-link").onclick=()=>runSyncAction(async()=>{if(!Sync.hasConfig())configureSyncFromForm();const result=await Sync.requestEmailLink($("sync-account-email").value);if(result.mode==="ready")throw new Error(t("sync.error.alreadyConnected"))},t("sync.notice.emailSent"));
$("sync-account-signout").onclick=()=>runSyncAction(async()=>{resetClientTableRuntime();await Sync.signOutAccount();cloudCharacters=[];cloudLibraryUserId=null;renderCloudLibrary()},t("sync.notice.signedOut"));
$("sync-library-save").onclick=()=>runSyncAction(async()=>{await Sync.saveLibraryCharacter(S);await refreshCloudCharacters()},t("sync.notice.heroSaved"));
$("sync-library-refresh").onclick=()=>runSyncAction(refreshCloudCharacters,t("sync.notice.charactersRefreshed"));
$("sync-library-select").onchange=renderCloudLibrary;
$("sync-library-load").onclick=()=>runSyncAction(async()=>{const record=await Sync.loadLibraryCharacter($("sync-library-select").value),hero=installCloudHero(record);toast(t("sync.notice.heroLoaded",{name:hero.name||t("sync.unnamedHero")}))},"");
$("sync-library-delete").onclick=()=>runSyncAction(async()=>{const record=cloudCharacters.find(item=>item.id===$("sync-library-select").value);if(!record||!window.confirm(t("sync.confirm.deleteCloud",{name:record.name})))return;await Sync.deleteLibraryCharacter(record.id);await refreshCloudCharacters()},t("sync.notice.cloudDeleted"));
$("sync-table-select").onchange=renderSavedCampaigns;
$("sync-table-refresh").onclick=()=>runSyncAction(refreshSavedCampaigns,t("sync.notice.tablesRefreshed"));
$("sync-table-open").onclick=()=>runSyncAction(async()=>{const campaign=savedCampaigns.find(item=>item.sceneId===$("sync-table-select").value);if(!campaign)throw new Error(t("sync.error.chooseTable"));resetClientTableRuntime();await Sync.openCampaign(campaign.id,campaign.sceneId)},t("sync.notice.tableOpened"));
$("sync-table-delete").onclick=()=>{const campaign=savedCampaigns.find(item=>item.sceneId===$("sync-table-select").value);if(!campaign||campaign.role!=="owner"){toast(t("sync.error.ownerOnly"));return}if(!window.confirm(t("sync.confirm.deleteTable",{name:campaign.name})))return;runSyncAction(async()=>{if(Sync.state().campaignId===campaign.id)resetClientTableRuntime();await Sync.deleteCampaign(campaign.id);await refreshSavedCampaigns()},t("sync.notice.tableDeleted"))};
$("sync-create-campaign").onclick=()=>runSyncAction(async()=>{configureSyncFromForm();await Sync.connect();resetClientTableRuntime();await Sync.createCampaign($("sync-campaign-name").value.trim()||t("sync.defaultCampaign"),sceneCore(blankScene()));await refreshSavedCampaigns()},t("sync.notice.created"));
$("sync-join-campaign").onclick=()=>runSyncAction(async()=>{configureSyncFromForm();await Sync.connect();resetClientTableRuntime();await Sync.redeemInvite(inviteToken($("sync-invite-token").value));await refreshSavedCampaigns()},t("sync.notice.joined"));
$("sync-create-invite").onclick=()=>runSyncAction(async()=>{lastInviteToken=await Sync.createInvite("player");$("sync-invite-output").textContent=t("sync.inviteOutput",{link:inviteLink(lastInviteToken)});$("sync-copy-invite").hidden=false},t("sync.notice.inviteCreated"));
$("sync-copy-invite").onclick=()=>runSyncAction(async()=>{if(!lastInviteToken)throw new Error(t("sync.error.inviteFirst"));await navigator.clipboard.writeText(inviteLink(lastInviteToken))},t("sync.notice.copied"));
$("sync-publish-hero").onclick=()=>runSyncAction(publishCurrentHero,t("sync.notice.published"));
$("sync-reconnect").onclick=()=>runSyncAction(async()=>{const state=Sync.state();if(!state.authenticated)await Sync.connect();if(Sync.state().sceneId){await Sync.refreshScene();if(!retryNetworkV2Failed())toast(t("sync.notice.reconnected"))}},"");
const leaveCurrentTable=()=>runSyncAction(async()=>{resetClientTableRuntime();await Sync.leave();await refreshSavedCampaigns()},t("sync.notice.left"));
$("sync-leave").onclick=leaveCurrentTable;
$("sync-leave-table").onclick=leaveCurrentTable;
$("sync-send-targets").onclick=()=>runSyncAction(async()=>{await Sync.submitCommand("set_targets",{targetIds:Scene.targetIds.slice(0,40),heroId:S.id})},t("sync.notice.targetsSent"));
$("sync-request-undo").onclick=()=>runSyncAction(async()=>{await Sync.submitCommand("request_undo",{reason:"player_request"})},t("sync.notice.undoRequested"));
async function prepareSceneCommand(command){if(command.command_type==="set_targets")return prepareTargetsCommand(command);if(command.command_type==="request_undo")return prepareUndoCommand(command);if(command.command_type==="join_hero")return prepareRemoteHeroCommand(command);if(command.command_type==="update_runtime")return prepareRuntimeCommand(command);if(command.command_type==="dispatch_events")return prepareEventCommand(command);return null}
async function decideSceneCommand(command,decision){if(decision==="applied"&&command.command_type==="set_targets"){applyTransientTargetsCommand(command);await Sync.decideCommand(command.id,"applied")}else if(decision==="applied"){const prepared=await prepareSceneCommand(command);if(!prepared)decision="rejected";else await acceptPreparedRemoteCommand(command,prepared)}if(decision==="rejected")await Sync.decideCommand(command.id,"rejected");pendingSceneCommands=pendingSceneCommands.filter(item=>String(item.id)!==String(command.id));automaticCommandAttempts.delete(String(command.id));automaticCommandRetries.delete(String(command.id));delayedAutomaticCommands.delete(String(command.id));renderSync()}
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
    try{const wasDelayed=delayedAutomaticCommands.has(id);await decideSceneCommand(current,"applied");automaticCommandRetries.delete(id);if(wasDelayed)toast(t("sync.notice.delayedProcessed"))}
    catch(error){
      automaticCommandAttempts.delete(id);delayedAutomaticCommands.add(id);
      const retryable=NetworkV2.retryableAuthorityFailure(error),attempt=(automaticCommandRetries.get(id)||0)+1;
      renderSync();toast(t("sync.notice.delayed",{error:friendlySyncError(error)}));
      if(retryable&&attempt<=6){automaticCommandRetries.set(id,attempt);setTimeout(()=>{const retry=pendingSceneCommands.find(item=>String(item.id)===id);if(retry)queueAutomaticCommand(retry)},Math.min(1200*2**(attempt-1),15000))}
      else{automaticCommandRetries.delete(id);if(typeof renderSync==="function")renderSync()}
    }
  });
}
function queueAutomaticCommands(){pendingSceneCommands.forEach(queueAutomaticCommand)}
$("sync-command-queue").addEventListener("click",event=>{const button=event.target.closest("[data-sync-command]");if(!button)return;runSyncAction(async()=>{const command=pendingSceneCommands.find(item=>String(item.id)===button.dataset.syncCommand);if(!command)return;button.disabled=true;await decideSceneCommand(command,button.dataset.syncDecision)},t("sync.notice.commandProcessed"))});

globalThis.addEventListener("dawn:locale-change",()=>{
  renderCloudLibrary();renderSavedCampaigns();
  if(lastInviteToken)$("sync-invite-output").textContent=t("sync.inviteOutput",{link:inviteLink(lastInviteToken)});
  renderSync();
});

Sync?.on("status",()=>{if(!Sync.state().sceneId)pendingCommandSceneId=null;renderSync();if(store.mode==="tools")renderToolsWorkspace();renderChallengeRequestDock()});
Sync?.on("presence",()=>renderSync());
Sync?.on("scene",payload=>{if(!payload?.state||typeof payload.state!=="object")return;const previousRequestId=Scene.challengeRequest?.id||"",previousRequestResultId=Scene.challengeRequest?.result?.rollEventId||"",previousOpposedId=Scene.opposedRoll?.id||"",previousOpposedAttempt=Scene.opposedRoll?.attempt||0,sceneId=Sync.state().sceneId;if(sceneId!==pendingCommandSceneId){pendingSceneCommands=[];automaticCommandAttempts.clear();automaticCommandRetries.clear();delayedAutomaticCommands.clear();Scene=NetworkV2.resetLocalUiForSceneSwitch(Scene);pendingCommandSceneId=sceneId}const remote=mergeNetworkV2Scene({...payload.state,version:Number(payload.version??payload.state.version??0)},Scene);Scene=hydratePlayerScene(remote);store.scene=Scene;store.sceneSessionId=sceneId;if((Scene.challengeRequest?.id||"")!==previousRequestId||(Scene.opposedRoll?.id||"")!==previousOpposedId||(Scene.opposedRoll?.attempt||0)!==previousOpposedAttempt)resetToolsRollResult();persist();if(typeof refreshHeroSheetResourceControls==="function")refreshHeroSheetResourceControls();if(store.mode==="play")renderPlay();if(store.mode==="tools")renderToolsWorkspace();reconcileSceneResultsDialog();renderChallengeRequestDock();const ownRequest=currentChallengeRequest(),requestResult=Scene.challengeRequest?.result,ownSide=currentOpposedParticipant();if(ownRequest&&ownRequest.id!==previousRequestId)toast(`Нарратор запросил бросок · цель ${ownRequest.target}`);if(requestResult?.rollEventId&&requestResult.rollEventId!==previousRequestResultId&&Sync.state().canNarrate){const actor=Scene.actors.find(item=>item.id===Scene.challengeRequest.actorId);toast(`Получен бросок: ${actor?.name||"герой"} · ${requestResult.successes} Успехов`)}if(ownSide&&Scene.opposedRoll?.id!==previousOpposedId){const opponent=Scene.opposedRoll.participants.find(item=>item.id!==ownSide.id);toast(`Встречный бросок против ${opponent?.name||"соперника"}`)}queueAutomaticCommands()});
Sync?.on("commands",commands=>{pendingSceneCommands=Array.isArray(commands)?commands:[];const pendingIds=new Set(pendingSceneCommands.map(command=>String(command.id)));for(const id of automaticCommandAttempts.keys())if(!pendingIds.has(id))automaticCommandAttempts.delete(id);for(const id of automaticCommandRetries.keys())if(!pendingIds.has(id))automaticCommandRetries.delete(id);for(const id of delayedAutomaticCommands)if(!pendingIds.has(id))delayedAutomaticCommands.delete(id);retainPendingNetworkV2Commands([...pendingIds]);renderSync();queueAutomaticCommands()});
Sync?.on("command",command=>{if(command&&!pendingSceneCommands.some(item=>String(item.id)===String(command.id)))pendingSceneCommands.push(command);renderSync();queueAutomaticCommand(command)});
Sync?.on("command-update",command=>{if(!command)return;if(typeof reconcileManualToolsRoll==="function")reconcileManualToolsRoll(command);if(typeof reconcileManualAreaDraft==="function")reconcileManualAreaDraft(command);window.DAWN_MANUAL_WORKSPACE?.reconcileNumber(command);if(typeof reconcileManualClockNumbers==="function")reconcileManualClockNumbers(command);if(command.status!=="pending"){if(command.status==="rejected")clearPendingNetworkPlacement(command);discardNetworkV2Commands([command.id]);pendingSceneCommands=pendingSceneCommands.filter(item=>String(item.id)!==String(command.id));automaticCommandAttempts.delete(String(command.id));automaticCommandRetries.delete(String(command.id));delayedAutomaticCommands.delete(String(command.id))}renderSync()});
globalThis.addEventListener("dawn-network-v2-settled",event=>{const ids=new Set([...(event.detail?.commandIds||[]),...(event.detail?.rejectedCommandIds||[])].map(String));discardNetworkV2Commands([...ids]);pendingSceneCommands=pendingSceneCommands.filter(command=>!ids.has(String(command.id)));ids.forEach(id=>{automaticCommandAttempts.delete(id);automaticCommandRetries.delete(id);delayedAutomaticCommands.delete(id)});renderSync()});
