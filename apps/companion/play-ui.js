"use strict";

function renderSync(){
  if(!Sync)return;const sync=Sync.state(),statusNames={offline:sync.authenticated?"Нет сети":"Локально",connecting:"Переподключение…",authenticated:"Auth готов",online:"Синхронизировано",error:"Ошибка"},roleNames={owner:"Владелец / Нарратор",narrator:"Нарратор",player:"Игрок"},status=$("scene-sync-status");status.textContent=statusNames[sync.status]||sync.status;status.className=`sync-status ${sync.status}`;status.title=sync.error||"";
  if(document.activeElement!==$("sync-url"))$("sync-url").value=sync.url||"";if(document.activeElement!==$("sync-key"))$("sync-key").value=sync.publishableKey||"";if(document.activeElement!==$("sync-display-name"))$("sync-display-name").value=sync.displayName||S.player||"";$("sync-reconnect").disabled=sync.status==="connecting";$("sync-reconnect").textContent=sync.status==="connecting"?"Подключаемся…":"Переподключиться";
  document.body.dataset.networkRole=sync.sceneId?(sync.canNarrate?"narrator":"player"):"";$("scene-sync-title").textContent=sync.sceneId?(sync.canNarrate?"Стол Нарратора":"Стол Игрока"):"Подключение кампании";if(sync.status==="error")$("scene-sync-settings").open=true;$("scene-sync-lobby").hidden=Boolean(sync.sceneId);$("scene-sync-session").hidden=!sync.sceneId;$("sync-leave-table").hidden=!sync.sceneId;$("sync-player-actions").hidden=sync.role!=="player";$("sync-publish-hero").hidden=sync.role!=="player";const people=Array.isArray(sync.presence)?sync.presence:[],presenceMarkup=sync.sceneId?(people.length?`<strong>Сейчас за столом:</strong>${people.map(person=>`<span class="sync-person ${person.userId===sync.userId?"self":""}"><i></i>${esc(person.displayName||"Игрок")}${person.heroName?` · ${esc(person.heroName)}`:""}<small>${esc(roleNames[person.role]||person.role||"")}</small></span>`).join("")}`:`<span class="autosave">Подключаем участников…</span>`):"",presenceNode=$("sync-presence");if(presenceNode.innerHTML!==presenceMarkup)presenceNode.innerHTML=presenceMarkup;const queue=$("sync-command-queue"),manualCommands=pendingSceneCommands.filter(command=>!NetworkV2.AUTOMATIC_COMMANDS.has(command.command_type));queue.hidden=!sync.canNarrate||!manualCommands.length;const queueMarkup=queue.hidden?"":`<strong>Решения Нарратора</strong>${manualCommands.map(command=>`<article class="sync-command"><span>${esc(commandSummary(command))}</span><button type="button" data-sync-command="${command.id}" data-sync-decision="applied">Принять</button><button type="button" data-sync-command="${command.id}" data-sync-decision="rejected">Отклонить</button></article>`).join("")}`;if(queue.innerHTML!==queueMarkup)queue.innerHTML=queueMarkup;if(sync.sceneId){$("sync-campaign-title").textContent=sync.campaignName||"Кампания DAWN";$("sync-role-label").textContent=`${roleNames[sync.role]||sync.role} · версия Сцены ${sync.version}`;$("sync-create-invite").hidden=!sync.canNarrate}if(typeof renderSyncAccount==="function")renderSyncAccount(sync);
}
function renderPlay(){
  ensureRuntime();const d=derived(),rt=S.runtime;
  $("ko-banner").innerHTML=rt.wounds>=d.guts?`<div class="ko"><strong>Раны догнали Стойкость.</strong> Герой выводится из строя: снимите одну Рану и увеличьте Напряжение — либо поставьте Влияние на кон и вернитесь с 2 Стресса и Здоровьем, равным Стойкости.<div class="button-row"><button type="button" id="ko-yield">Выведен из строя</button><button type="button" id="ko-stake">Поставить на кон</button></div></div>`:"";
  $("play-counters").innerHTML=counter("hp","Здоровье",rt.hp,d.hp)+counter("wounds","Раны",rt.wounds,d.guts)+counter("focus","Фокус",rt.focus)+counter("ap","ОД",rt.ap)+counter("influence","Влияние",rt.influence)+counter("stress","Стресс",rt.stress,3)+counter("tension","Напряжение",rt.tension)+(hasGift("Trust Fund")?counter("funding","Финансирование",rt.funding):"");
  const playKit=$("play-kit"),openDetails=new Map([...playKit.querySelectorAll("details")].map((details,index)=>[`${index}:${details.querySelector("summary")?.textContent||""}`,details.open]));playKit.innerHTML=sceneSheetPanel();[...playKit.querySelectorAll("details")].forEach((details,index)=>{const key=`${index}:${details.querySelector("summary")?.textContent||""}`;if(openDetails.has(key))details.open=openDetails.get(key)});
  $("scene-notes").value=rt.notes;
  $("effect-tracker").innerHTML=`<div class="effect-groups">${[["Положительные",D.effects.positive],["Отрицательные",D.effects.negative]].map(([name,list])=>`<div><h4>${name}</h4><div class="chip-row">${list.map(e=>`<button type="button" class="effect-chip ${rt.effects.includes(e.id)?"on":""}" data-effect="${e.id}" title="${esc(e.text)}">${esc(e.name)}</button>`).join("")}</div></div>`).join("")}</div>`;
  $("ko-yield")?.addEventListener("click",()=>{rt.wounds=Math.max(0,rt.wounds-1);rt.tension++;persist();renderPlay();});
  $("ko-stake")?.addEventListener("click",()=>{rt.stress=2;rt.hp=d.guts;rt.wounds=Math.max(0,rt.wounds-1);persist();renderPlay();});
  renderSync();renderScene();reconcileSceneResultsDialog();
}

let pendingAllIn=null;
function resetToolsRollResult(){
  pendingAllIn=null;
  const result=$("dice-result"),risks=$("freeplay-risk-actions");
  if(result){result.className="dice-result";result.innerHTML=""}
  if(risks)risks.innerHTML="";
  if($("all-in-reroll"))updateAllInAvailability();
}
function toolsSyncContext(){const state=Sync?.state?.()||{};return{shared:Boolean(state.sceneId),canEdit:!state.sceneId||Boolean(state.canNarrate),status:state.status||"offline",role:state.role||"",displayName:state.displayName||S.player||"Нарратор"}}
function toolsRole(){const context=toolsSyncContext();return context.shared?(context.canEdit?"network-narrator":"network-player"):"local-table"}
function renderToolsSyncState(){const context=toolsSyncContext(),output=$("tools-sync-state"),role=toolsRole();output.classList.toggle("online",context.shared);output.textContent=role==="network-narrator"?"Общий стол · Нарратор":role==="network-player"?"Общий стол · Игрок":"Один стол · одно устройство"}
function sessionClocks(){Scene.sessionClocks||=[];Scene.tools||={clocksMigrated:false};const context=toolsSyncContext();if(!Scene.tools.clocksMigrated&&!context.shared&&context.canEdit){Scene.sessionClocks=S.runtime.clocks.map(clock=>({...clock,kind:clock.kind==="progress"?"progress":"danger"}));Scene.tools.clocksMigrated=true;persist()}return Scene.sessionClocks}
function freeplayState(){S.runtime.freeplay||={target:null};return S.runtime.freeplay}
function currentChallengeRequest(){const request=Scene.challengeRequest,actor=currentHeroActor();return request&&actor&&request.actorId===actor.id?request:null}
function currentOpposedRoll(){return Scene.opposedRoll||null}
function opposedParticipantForHero(request=Scene.opposedRoll,hero=S){if(!request||!hero)return null;const actor=Scene.actors.find(item=>item.heroId===hero.id);return request.participants.find(item=>item.heroId===hero.id||actor&&item.actorId===actor.id)||null}
function currentOpposedParticipant(){return opposedParticipantForHero()}
function opposedParticipantResult(participant,request=Scene.opposedRoll){return participant&&request?.results?.[participant.id]||null}
function activeToolsRollKind(){return Scene.opposedRoll?"opposed":"challenge"}
function freeplayTarget(){const context=toolsSyncContext(),request=currentChallengeRequest();return context.shared&&!context.canEdit&&request?clamp(request.target,1,99):clamp($("dice-target").value,1,99)}
function freeplayScenario(){return{target:freeplayTarget()}}
function toolsRollContext(){
  const persisted=currentHeroActor();
  if(persisted)return{scene:Scene,actor:persisted,persisted:true};
  const space=Scene.spaces.find(item=>item.id===Scene.activeSpace)||Scene.spaces[0]||{id:"main"},actor=heroActorState(S,{id:`freeplay-${S.id}`,space:space.id,x:0,y:0});
  return{scene:{...Scene,actors:[...(Scene.actors||[]),actor]},actor,persisted:false};
}
function toolsRuntimeActor(){return toolsSyncContext().shared?currentHeroActor():null}
function toolsResourceValue(key){const actor=toolsRuntimeActor();return clamp(actor?.[key]??S.runtime[key],0,key==="stress"?3:999)}
function refreshFreeplayResourceUi(){
  for(const key of ["influence","stress"]){
    const value=toolsResourceValue(key),maximum=key==="stress"?3:null,group=document.querySelector(`[data-freeplay-resource-group="${key}"]`);
    if(!group)continue;
    group.querySelector("strong").textContent=maximum?`${value} / ${maximum}`:String(value);
    const down=group.querySelector(`[data-freeplay-delta="-1"]`),up=group.querySelector(`[data-freeplay-delta="1"]`);
    if(down)down.disabled=value<=0;if(up)up.disabled=maximum!=null&&value>=maximum;
  }
}
function setToolsResource(key,value,label){
  const actor=toolsRuntimeActor(),context=toolsSyncContext(),maximum=key==="stress"?3:999,next=clamp(value,0,maximum);
  if(actor&&context.shared&&!context.canEdit){
    actor[key]=next;S.runtime[key]=next;refreshFreeplayResourceUi();if(key==="stress")renderStressTrackers();updateAllInAvailability();persistAfterPaint();
    Sync.submitCommand("update_runtime",{actorId:actor.id,key,value:next}).catch(error=>{toast(error?.message||"Не удалось синхронизировать ресурс");Promise.resolve(Sync.refreshScene?.()).catch(()=>{})});
    return true;
  }
  if(actor){
    if(!commitSceneEvents(`${actor.name}: ${label} → ${next}`,[{type:"actor.runtime.set",actorId:actor.id,payload:{key,value:next}}]))return false;
    actor[key]=next;if(actor.heroId===S.id)S.runtime[key]=next;
  }else S.runtime[key]=next;
  refreshFreeplayResourceUi();if(key==="stress")renderStressTrackers();updateAllInAvailability();persistAfterPaint();return true;
}
function freeplayBondStatus(bond){
  if(!bond)return{amount:0,parts:[]};
  const standardTags=D.bonds.actions.map(action=>action.tag),base=Logic.freeplayBondAdvantage({rank:bond.rank,tags:bond.tags,standardTags}),parts=[`Ранг ${base.rank}`];
  let amount=base.total;
  if(base.customTagBonus){parts.push("нестандартный тег +1");}
  if(S.gifts.includes("wolf.guard-dog")&&S.bonds.length===1){amount+=2;parts.push("Сторожевой пес +2");}
  if(S.gifts.includes("mentor.perspective-of-a-teacher")&&bond.tags.includes("Ученик")){amount+=2;parts.push("Взгляд учителя +2");}
  if(S.gifts.includes("rebel.supernatural-deafness")){amount*=2;parts.push("Глухота к сверхъестественному ×2");}
  return{amount,parts};
}
function toolsDiceRequest(){
  const abilityKey=$("dice-ability").value,skill=S.skills.find(item=>item.id===$("dice-skill").value),ability=abilityKey==="tainted"?S.taintedAbility:abilityKey==="main"?S.ability:null,bond=S.bonds.find(item=>item.id===$("dice-bond").value),bondStatus=freeplayBondStatus(bond),hooks=[];
  if(skill)hooks.push({type:"advantage",ruleId:`freeplay.skill:${skill.id}`,label:`Навык: ${skillDisplayName(skill)}`,amount:effectiveSkillRank(skill)});
  if(ability?.enabled)hooks.push({type:"advantage",ruleId:`freeplay.ability:${abilityKey}`,label:`Способность: ${ability.name||"без названия"}`,amount:ability.rank});
  if(bond&&bondStatus.amount)hooks.push({type:"advantage",ruleId:`freeplay.bond:${bond.id}`,label:`Связь: ${bond.name} (${bondStatus.parts.join(", ")})`,amount:bondStatus.amount});
  if($("dice-outgunned")?.checked)hooks.push({type:"advantage",ruleId:"freeplay.wolf.outgunned",label:"В меньшинстве · подтверждено по нарративу",amount:2});
  return{scope:"challenge",sceneContext:false,baseCount:clamp($("dice-count").value,1,40),advantage:clamp($("dice-adv").value,0,30),hindrance:clamp($("dice-dis").value,0,30),attribute:$("dice-attr").value==="manual"?null:$("dice-attr").value,usesAbility:Boolean(abilityKey),abilityKey:abilityKey||null,selectedHookIds:$("dice-dark-urge")?.checked?["wolf.dark-urge"]:[],targetIds:[],hooks};
}
function renderOutcomeGuide(){
  if($("freeplay-request-kind")?.value==="opposed"||Scene.opposedRoll){
    $("dice-outcome-guide").innerHTML="<span><b>Встречный бросок</b> · побеждает большее число Успехов</span><span><b>Ничья</b> · переброс, либо обе совместимые Награды по решению Нарратора</span>";
    return;
  }
  const target=clamp($("dice-target").value,1,99),minimumEnd=target*2-1;
  $("dice-outcome-guide").innerHTML=`<span><b>Провал</b> · 0–${target-1}</span><span><b>Минимальный успех</b> · ${target}${minimumEnd>target?`–${minimumEnd}`:""}</span><span><b>Крайний успех</b> · ${target*2}+</span>`;
}
function challengeActors(){
  const heroes=Scene.actors.filter(actor=>actor.team==="hero"&&actor.kind!=="token"&&!actor.knockedOut),players=heroes.filter(actor=>actor.ownerId);
  return players.length?players:heroes;
}
function opposedActorChoices(role=toolsRole()){
  if(role!=="local-table")return Scene.actors.filter(actor=>actor.kind!=="token"&&!actor.knockedOut).map(actor=>({value:`actor:${actor.id}`,name:actor.name,actor,pool:actor.team==="enemy"?actor.tier+5:Math.max(1,actor.tier+3)}));
  const heroIds=new Set(store.heroes.map(hero=>hero.id)),heroes=store.heroes.map(hero=>({value:`hero:${hero.id}`,name:hero.name||"Безымянный герой",hero,pool:Math.max(1,hero.tier+3)})),actors=Scene.actors.filter(actor=>actor.kind!=="token"&&!actor.knockedOut&&(!actor.heroId||!heroIds.has(actor.heroId))).map(actor=>({value:`actor:${actor.id}`,name:actor.name,actor,pool:actor.team==="enemy"?actor.tier+5:Math.max(1,actor.tier+3)}));
  return[...heroes,...actors,{value:"custom",name:"Другой NPC…",pool:6}];
}
function opposedResultSummary(request){
  if(!request)return"";
  const winner=request.participants.find(item=>item.id===request.winnerParticipantId);
  if(request.resolution==="both")return"Ничья: Нарратор разрешил обе совместимые Награды.";
  if(winner)return`Побеждает ${winner.name} и получает свою Награду.`;
  if(request.status==="tied")return"Ничья: стороны должны перебросить. Нарратор может разрешить обе Награды, только если они не исключают друг друга.";
  const ready=request.participants.filter(item=>request.results?.[item.id]).length;
  return ready?`Получен ${ready} из 2 результатов.`:"Обе стороны собирают свои пулы и бросают.";
}
function opposedCountLabel(value,one,few,many){const number=Math.abs(Number(value)||0)%100,last=number%10;return`${value} ${number>10&&number<20?many:last===1?one:last>=2&&last<=4?few:many}`}
function challengeResultSummary(result){return result?`${opposedCountLabel(result.successes,"Успех","Успеха","Успехов")} · ${opposedCountLabel(result.crits,"Крит","Крита","Критов")}${result.outcome?` · ${result.outcome}`:""}${result.payment?` · Ва-банк: ${result.payment}`:""}`:""}
function renderOpposedStatus(){
  const root=$("freeplay-opposed-status"),request=Scene.opposedRoll,context=toolsSyncContext(),role=toolsRole();
  root.hidden=!request;if(!request){root.innerHTML="";return}
  const current=currentOpposedParticipant(),cards=request.participants.map(participant=>{
    const result=opposedParticipantResult(participant,request),isCurrent=current?.id===participant.id,hero=participant.heroId&&store.heroes.find(item=>item.id===participant.heroId),manual=context.canEdit&&!result;
    return`<article class="opposed-side ${isCurrent?"current":""}"><div><span>${isCurrent?"ВАША СТОРОНА":participant.controller==="narrator"?"СТОРОНА НАРРАТОРА":"УЧАСТНИК"}</span><strong>${esc(participant.name)}</strong><small>${result?`${opposedCountLabel(result.successes,"Успех","Успеха","Успехов")} · ${opposedCountLabel(result.crits,"Крит","Крита","Критов")}${result.payment?` · Ва-банк: ${esc(result.payment)}`:""}`:"Результат ещё не получен"}</small></div>${result?`<div class="opposed-dice">${result.rolls.map(value=>`<i class="${value>=6?"crit":value>=4?"success":""}">${value}</i>`).join("")}</div>`:""}<div class="opposed-side-actions">${role==="local-table"&&hero&&!result?`<button type="button" data-opposed-open-hero="${esc(hero.id)}">Открыть лист</button>`:""}${manual?`<label>Ручной пул<input type="number" min="1" max="99" value="${participant.pool}" data-opposed-pool="${esc(participant.id)}"></label><button type="button" data-opposed-roll="${esc(participant.id)}">Бросить за участника</button>`:""}</div></article>`;
  }).join("");
  const actions=context.canEdit?`<div class="opposed-resolution-actions">${request.status==="tied"?`<button type="button" class="primary" data-opposed-reroll>Перебросить ничью</button><button type="button" data-opposed-both>Разрешить обе Награды</button>`:""}<button type="button" data-opposed-close>${request.status==="resolved"?"Завершить":"Отменить"} встречный бросок</button></div>`:"";
  root.innerHTML=`<header><div><span>ВСТРЕЧНЫЙ БРОСОК · ПОПЫТКА ${request.attempt}</span><strong>${esc(opposedResultSummary(request))}</strong></div></header><div class="opposed-sides">${cards}</div>${actions}`;
}
function renderFreeplayDirector(){
  const context=toolsSyncContext(),role=toolsRole(),request=Scene.challengeRequest,opposed=Scene.opposedRoll,kindSelect=$("freeplay-request-kind"),kind=opposed?"opposed":request?"challenge":kindSelect.value,localSelect=$("freeplay-local-hero"),actorSelect=$("freeplay-request-actor"),opponent=$("freeplay-opponent"),target=$("dice-target"),requestActorWrap=$("freeplay-request-actor-wrap"),localHeroWrap=$("freeplay-local-hero-wrap"),kindWrap=$("freeplay-request-kind-wrap"),opponentWrap=$("freeplay-opponent-wrap"),opponentNameWrap=$("freeplay-opponent-name-wrap"),targetWrap=$("freeplay-target-wrap"),actions=$("freeplay-request-actions"),state=$("freeplay-request-state"),requestButton=$("freeplay-request-roll"),clearButton=$("freeplay-request-clear"),defaultButton=$("dice-target-default");
  kindSelect.value=kind;kindSelect.disabled=Boolean(request||opposed);kindWrap.hidden=role==="network-player";targetWrap.hidden=kind==="opposed";opponentWrap.hidden=kind!=="opposed"||role==="network-player";opponentNameWrap.hidden=opponentWrap.hidden||opponent.value!=="custom";
  clearButton.textContent=kind==="opposed"?"Отменить встречный бросок":"Отменить запрос";
  document.body.classList.toggle("tools-narrator-mode",role==="network-narrator"&&store.mode==="tools");
  document.querySelector(".freeplay-grid").dataset.toolsRole=role;
  document.querySelector(".freeplay-hero-tool").hidden=role==="network-narrator";
  document.querySelector(".dice-tool").hidden=false;
  document.querySelector(".freeplay-bonds-tool").hidden=role==="network-narrator";
  localHeroWrap.hidden=role!=="local-table";requestActorWrap.hidden=role!=="network-narrator";actions.hidden=role==="network-player"||role==="local-table"&&kind!=="opposed";defaultButton.hidden=false;target.disabled=false;
  if(role!=="network-player")$("roll-dice").disabled=false;
  if(role==="local-table"){
    $("freeplay-director-kind").textContent="ЛОКАЛЬНЫЙ СТОЛ";$("freeplay-director-title").textContent=kind==="opposed"?"Встречный бросок за одним устройством":"Испытание за одним устройством";$("freeplay-director-help").textContent=kind==="opposed"?"Выберите две стороны. Герои используют свои листы, за NPC Нарратор может бросить вручную.":"Нарратор выбирает героя и сложность, затем игрок собирает пул и бросает.";
    localSelect.innerHTML=store.heroes.map((hero,index)=>`<option value="${index}" ${index===store.current?"selected":""}>${esc(hero.name||"Безымянный герой")} · Ст.${hero.tier}</option>`).join("");
    if(kind==="opposed"){const selected=opponent.value,choices=opposedActorChoices(role).filter(choice=>choice.value!==`hero:${S.id}`);opponent.innerHTML=choices.map(choice=>`<option value="${esc(choice.value)}">${esc(choice.name)}</option>`).join("");if(choices.some(choice=>choice.value===selected))opponent.value=selected;opponentNameWrap.hidden=opponent.value!=="custom";}
    if(document.activeElement!==target)target.value=freeplayState().target||S.tier+1;
    state.innerHTML=kind==="opposed"?opposed?`<strong>${esc(opposed.participants.map(item=>item.name).join(" против "))}</strong><span>Результаты сохраняются по сторонам; при ничьей нужен новый совместный переброс.</span>`:"<strong>Подготовьте две стороны</strong><span>У встречного броска нет Цели Успехов: побеждает сторона с большим числом Успехов.</span>":"<strong>Локальная игра</strong><span>Все герои и броски остаются на этом устройстве; переключение героя использует его настоящий лист.</span>";
  }else if(role==="network-narrator"){
    $("freeplay-director-kind").textContent="СЕТЕВОЙ СТОЛ";$("freeplay-director-title").textContent="Пульт Нарратора";$("freeplay-director-help").textContent=kind==="opposed"?"Выберите две стороны. Владельцы героев получат запросы, за NPC можно бросить с пульта.":"Выберите героя и назначьте Цель Успехов. Игрок получит запрос на своём устройстве.";
    const actors=kind==="opposed"?opposedActorChoices(role).map(choice=>choice.actor):challengeActors(),selected=actorSelect.value||request?.actorId||opposed?.participants?.[0]?.actorId;actorSelect.innerHTML=actors.map(actor=>`<option value="${actor.id}">${esc(actor.name)}</option>`).join("")||`<option value="">Нет доступных участников</option>`;if(actors.some(actor=>actor.id===selected))actorSelect.value=selected;
    if(kind==="opposed"){const opponentSelected=opponent.value||opposed?.participants?.[1]?.actorId,available=actors.filter(actor=>actor.id!==actorSelect.value);opponent.innerHTML=available.map(actor=>`<option value="actor:${actor.id}">${esc(actor.name)}</option>`).join("")||`<option value="">Нужен второй участник</option>`;if(available.some(actor=>`actor:${actor.id}`===opponentSelected||actor.id===opponentSelected))opponent.value=opponentSelected?.startsWith("actor:")?opponentSelected:`actor:${opponentSelected}`;}
    if(document.activeElement!==target)target.value=request?.target||freeplayState().target||S.tier+1;
    requestButton.disabled=kind==="opposed"?actors.length<2:!actors.length;clearButton.hidden=!request&&!opposed;requestButton.textContent=kind==="opposed"?"Создать встречный бросок":request?.result?"Создать новый запрос":"Запросить бросок";clearButton.textContent=kind==="opposed"?"Отменить встречный бросок":request?.result?"Завершить запрос":"Отменить запрос";
    const actor=Scene.actors.find(item=>item.id===request?.actorId),result=request?.result;state.innerHTML=opposed?`<strong>${esc(opposed.participants.map(item=>item.name).join(" против "))}</strong><span>${esc(opposedResultSummary(opposed))}</span>`:result?`<strong>Получен результат: ${esc(challengeResultSummary(result))}</strong><span>${esc(actor?.name||"Герой")} · кости: ${result.rolls.join(" · ")}. Запрос можно завершить или заменить новым.</span>`:request?`<strong>Ожидается бросок: ${esc(actor?.name||"герой")}</strong><span>Назначенная цель — ${request.target}. Новый запрос заменит текущий.</span>`:`<strong>Активного запроса нет</strong><span>${kind==="opposed"?"Создайте состязание двух персонажей без фиксированной сложности.":"Назначьте сложность, когда станет понятно, что действие требует испытания."}</span>`;
  }else{
    const ownRequest=currentChallengeRequest(),ownChallengeResult=ownRequest?.result,ownSide=currentOpposedParticipant(),ownResult=opposedParticipantResult(ownSide,opposed),opponentSide=opposed?.participants.find(item=>item.id!==ownSide?.id);
    $("freeplay-director-kind").textContent=ownSide||request?"ЗАПРОС НАРРАТОРА":"СВОБОДНЫЙ БРОСОК";$("freeplay-director-title").textContent=ownSide?"Встречный бросок":request?"Назначено испытание":"Бросить без запроса";$("freeplay-director-help").textContent=ownSide?`Ваш противник — ${opponentSide?.name||"другой персонаж"}. Соберите пул по листу и бросьте.`:request?"Соберите пул по листу персонажа и совершите публичный бросок.":"Соберите любой пул и бросьте: результат сразу появится в общей истории стола.";
    target.value=ownRequest?.target||S.tier+1;
    state.innerHTML=ownSide?`<strong>${ownResult?`Ваш результат: ${ownResult.successes} Успехов`:"Нужен ваш результат"}</strong><span>${esc(opposedResultSummary(opposed))}</span>`:ownChallengeResult?`<strong>Результат принят: ${esc(challengeResultSummary(ownChallengeResult))}</strong><span>Нарратор получил этот бросок. Для замены результата используйте «Ва-банк».</span>`:ownRequest?`<strong>Цель Успехов: ${ownRequest.target}</strong><span>${esc(ownRequest.requestedBy)} запросил бросок для ${esc(S.name||"вашего героя")}.</span>`:opposed?`<strong>Встречный бросок других персонажей</strong><span>${esc(opposed.participants.map(item=>item.name).join(" против "))}.</span>`:request?`<strong>Нарратор запросил другого героя</strong><span>Сейчас бросает ${esc(Scene.actors.find(actor=>actor.id===request.actorId)?.name||"другой участник")}.</span>`:`<strong>Свободный публичный бросок</strong><span>Запрос Нарратора не требуется. Выберите пул и при необходимости укажите цель результата.</span>`;
    target.disabled=Boolean(ownRequest||ownSide);
    $("roll-dice").disabled=ownSide?Boolean(ownResult):Boolean(ownChallengeResult);
  }
  if(role==="local-table"&&kind==="opposed"){$("roll-dice").disabled=!opposed||!currentOpposedParticipant()||Boolean(opposedParticipantResult(currentOpposedParticipant(),opposed));requestButton.textContent=opposed?"Заменить встречный бросок":"Создать встречный бросок";clearButton.hidden=!opposed}
  const sideResult=opposedParticipantResult(currentOpposedParticipant(),opposed);$("dice-tool-kind").textContent=kind==="opposed"?"ВСТРЕЧНЫЙ БРОСОК":"БРОСОК ИСПЫТАНИЯ";$("dice-tool-title").textContent=kind==="opposed"?"Собрать пул своей стороны":"Разрешить действие";$("roll-dice").textContent=kind==="opposed"?(sideResult?"Результат стороны сохранён":"Бросить за свою сторону"):request?.result?"Результат принят Нарратором":"Бросить испытание";
  renderOutcomeGuide();renderOpposedStatus();renderToolsSyncState();
}
function renderChallengeRequestDock(){
  const dock=$("challenge-request-dock"),context=toolsSyncContext(),request=currentChallengeRequest(),opposed=Scene.opposedRoll,participant=currentOpposedParticipant(),result=opposedParticipantResult(participant,opposed),opponent=opposed?.participants.find(item=>item.id!==participant?.id),visible=context.shared&&!context.canEdit&&Boolean(request||participant)&&store.mode!=="tools";
  const resolved=Boolean(participant?result:request?.result);dock.hidden=!visible;dock.classList.toggle("resolved",resolved);if(visible)$("challenge-request-dock-text").textContent=participant?(result?`Запрос → Ответ · ${result.successes} Успехов · ${opposedResultSummary(opposed)}`:`Запрос · встречный бросок против ${opponent?.name||"соперника"}`):request.result?`Запрос → Ответ · ${challengeResultSummary(request.result)}`:`Запрос · ${request.requestedBy} просит бросок · цель ${request.target}`;
}
function updateDicePoolTotal(){
  const request=toolsDiceRequest(),context=toolsRollContext(),status=SceneEngine.diceHookStatus(context.scene,context.actor.id,request),total=status.available?status.count:Math.max(1,request.baseCount+request.advantage-request.hindrance),dark=$("dice-dark-urge");
  if(dark){dark.disabled=!request.usesAbility;if(!request.usesAbility)dark.checked=false}
  const automatic=status.sources?.filter(source=>["advantage","hindrance"].includes(source.type)).map(source=>`${source.type==="hindrance"?"−":"+"}${source.amount} ${source.label}`)||[];
  $("dice-pool-total").innerHTML=`<span>Итоговый пул</span><strong>${total}D6</strong><small>${esc([`${request.baseCount} от Атрибута`,request.advantage?`+${request.advantage} прочее Преимущество`:"",request.hindrance?`−${request.hindrance} Помеха`:"",...automatic].filter(Boolean).join(" · "))}</small>`;
  $$("[data-dice-count]").forEach(button=>button.classList.toggle("on",+$("dice-count").value===+button.dataset.diceCount));renderOutcomeGuide();
}
function recalculateDicePool(){const attr=$("dice-attr").value,count=$("dice-count");count.readOnly=attr!=="manual";if(attr!=="manual")count.value=Math.max(1,attrValue(attr));updateDicePoolTotal()}
function renderDiceComposer(){
  const skill=$("dice-skill"),ability=$("dice-ability"),bond=$("dice-bond"),skillValue=skill.value,abilityValue=ability.value,bondValue=bond.value,darkChecked=$("dice-dark-urge")?.checked,outgunnedChecked=$("dice-outgunned")?.checked;
  skill.innerHTML=`<option value="">Без Навыка</option>${S.skills.filter(item=>item.name.trim()).map(item=>`<option value="${item.id}">${esc(item.name)} · +${effectiveSkillRank(item)}D6</option>`).join("")}`;if([...skill.options].some(option=>option.value===skillValue))skill.value=skillValue;
  ability.innerHTML=`<option value="">Без Способности</option>${S.ability.enabled?`<option value="main">${esc(S.ability.name||"Способность")} · +${S.ability.rank}D6</option>`:""}${S.mods.taintedBody&&S.taintedAbility.enabled?`<option value="tainted">${esc(S.taintedAbility.name||"Порченое тело")} · +${S.taintedAbility.rank}D6</option>`:""}`;if([...ability.options].some(option=>option.value===abilityValue))ability.value=abilityValue;
  bond.innerHTML=`<option value="">Без Связи</option>${S.bonds.map(item=>{const status=freeplayBondStatus(item);return`<option value="${item.id}">${esc(item.name)} · +${status.amount}D6</option>`}).join("")}`;if([...bond.options].some(option=>option.value===bondValue))bond.value=bondValue;
  const opposed=Scene.opposedRoll,participant=currentOpposedParticipant(),opponent=opposed?.participants.find(item=>item.id!==participant?.id);
  $("dice-hero-context").innerHTML=`<span>Бросает</span><strong>${esc(S.name||"Безымянный герой")}</strong><small>${participant?`Встречный бросок против ${esc(opponent?.name||"соперника")} · попытка ${opposed.attempt}`:`Ступень ${S.tier} · назначенная цель ${freeplayTarget()}`}</small>`;
  $("dice-hook-controls").innerHTML=`${S.gifts.includes("wolf.outgunned")?`<label class="switch"><input id="dice-outgunned" type="checkbox" ${outgunnedChecked?"checked":""}><span><b>В меньшинстве</b> · +2 Преимущества, если это верно в текущем повествовании</span></label>`:""}${S.gifts.includes("wolf.dark-urge")?`<label class="switch"><input id="dice-dark-urge" type="checkbox" ${darkChecked?"checked":""}><span><b>Тёмный порыв</b> · +4 Преимущества со Способностью; нечётные Успехи дают Нарратору право сменить цель</span></label>`:""}`;
  recalculateDicePool();
}
function openToolsDicePreset({attr="",skillId="",abilityKey=""}={}){setMode("tools");renderDiceComposer();if(attr&&[...$("dice-attr").options].some(option=>option.value===attr))$("dice-attr").value=attr;if(skillId&&[...$("dice-skill").options].some(option=>option.value===skillId))$("dice-skill").value=skillId;if(abilityKey&&[...$("dice-ability").options].some(option=>option.value===abilityKey))$("dice-ability").value=abilityKey;recalculateDicePool();requestAnimationFrame(()=>$("roll-dice").focus())}
function renderFreeplayHeroPanel(){
  const actor=toolsRuntimeActor(),stress=clamp(actor?.stress??S.runtime.stress,0,3),influence=Math.max(0,Number(actor?.influence??S.runtime.influence)||0),gifts=selectedGifts(),techniques=Object.entries(S.techniques).filter(([,level])=>level>0).map(([id,level])=>({tech:techById(id),level})).filter(item=>item.tech),locked=toolsSyncContext().shared&&!actor;
  const resource=(key,label,value,maximum="")=>`<div class="freeplay-resource" data-freeplay-resource-group="${key}"><span>${label}</span><button type="button" data-freeplay-resource="${key}" data-freeplay-delta="-1" ${locked||value<=0?"disabled":""}>−</button><strong>${value}${maximum?` / ${maximum}`:""}</strong><button type="button" data-freeplay-resource="${key}" data-freeplay-delta="1" ${locked||maximum&&value>=maximum?"disabled":""}>+</button></div>`;
  $("freeplay-hero-panel").innerHTML=`<header class="freeplay-hero-head">${S.media.portrait?`<img src="${S.media.portrait}" alt="">`:`<i>✦</i>`}<div><span class="kind">ЛИСТ ПЕРСОНАЖА</span><h2>${esc(S.name||"Безымянный герой")}</h2><p>${esc(S.concept||"Концепция не записана")} · Ступень ${S.tier}</p></div><div class="freeplay-resources">${resource("influence","Влияние",influence)}${resource("stress","Стресс",stress,3)}</div></header><div class="freeplay-sheet-picks"><section><h3>Атрибуты</h3><div>${ATTRS.map(([key,label])=>`<button type="button" data-freeplay-attr="${key}"><span>${label}</span><b>${attrValue(key)}D6</b></button>`).join("")}</div></section><section><h3>Навыки</h3><div>${S.skills.filter(skill=>skillDisplayName(skill).trim()).map(skill=>`<button type="button" data-freeplay-skill="${skill.id}"><span>${esc(skillDisplayName(skill))}</span><b>+${effectiveSkillRank(skill)}D6</b></button>`).join("")||`<p class="autosave">Навыки не записаны.</p>`}</div></section>${S.ability.enabled?`<section><h3>Способность</h3><button type="button" class="freeplay-ability-pick" data-freeplay-ability="main"><span><b>${esc(S.ability.name||abilityFormula())}</b><small>${esc(abilityFormula())}</small></span><strong>+${S.ability.rank}D6</strong></button></section>`:""}</div><div class="freeplay-features"><details><summary>Мировоззрения и Дары <small>${gifts.length}</small></summary>${gifts.map(gift=>`<article><strong>${esc(gift.name)}</strong><p>${md(gift.text)}</p></article>`).join("")||`<p class="autosave">Дары не выбраны.</p>`}</details><details><summary>Техники <small>${techniques.reduce((sum,item)=>sum+item.level,0)} ур.</small></summary>${techniques.map(({tech,level})=>`<article><strong>${esc(tech.name)} · Уровень ${level}</strong>${tech.levels.slice(0,level).map(item=>`<p><b>${item.n}: ${esc(item.name)}</b> — ${md(item.text)}</p>`).join("")}</article>`).join("")||`<p class="autosave">Техники не выбраны.</p>`}</details></div>`;
}
function renderFreeplayBonds(){
  const standard=D.bonds.actions.map(action=>action.tag);
  $("freeplay-bonds").innerHTML=S.bonds.map(bond=>{const status=freeplayBondStatus(bond),canRaise=bond.rank<3&&bond.tags.length>=bond.rank;return`<article class="freeplay-bond-card"><header><div><strong>${esc(bond.name)}</strong><small>${bond.quick?"Быстрая Связь · ":""}Преимущество +${status.amount}</small></div><div class="freeplay-bond-rank"><button type="button" data-bond-rank="${bond.id}" data-bond-delta="-1" ${bond.rank<=1?"disabled":""}>−</button><b>Ранг ${bond.rank}</b><button type="button" data-bond-rank="${bond.id}" data-bond-delta="1" title="${canRaise?"Повысить Ранг":"Для повышения нужны все теги текущего Ранга"}" ${canRaise?"":"disabled"}>+</button></div></header><div class="freeplay-bond-tags">${bond.tags.map(tag=>`<span>${esc(tag)}</span>`).join("")||`<small>Тегов пока нет</small>`}</div><div class="freeplay-bond-actions"><select data-bond-tag-select="${bond.id}" ${bond.tags.length>=bond.rank?"disabled":""}><option value="">${bond.tags.length>=bond.rank?"Все места тегов заняты":"Добавить тег…"}</option>${standard.filter(tag=>!bond.tags.includes(tag)).map(tag=>`<option>${esc(tag)}</option>`).join("")}<option value="__custom">Свой тег…</option></select><button type="button" data-bond-use="${bond.id}">В бросок</button><button type="button" class="remove" data-bond-remove="${bond.id}">Удалить</button></div></article>`}).join("")||`<p class="autosave">Связей пока нет. В обычной или быстрой Связи можно хранить Ранг и неизменяемые теги.</p>`;
}
function renderAllInControls(){
  renderFreeplayDirector();
  if(toolsRole()==="network-narrator")return;
  renderDiceComposer();
  renderFreeplayHeroPanel();
  renderFreeplayBonds();
  renderStressTrackers();
  updateAllInAvailability();
}
function updateAllInAvailability(){
  const stressPayment=hasGift("Overexertion")||hasGift("Durandal");
  const flashback=hasGift("Plenty To Learn");
  const influence=toolsResourceValue("influence"),stress=toolsResourceValue("stress");
  $("all-in-reroll").disabled=!pendingAllIn||influence<1;
  $("all-in-stress").hidden=!stressPayment;
  $("all-in-stress").disabled=!pendingAllIn||stress>=3;
  $("all-in-flashback-wrap").hidden=!flashback;
  $("all-in-flashback").disabled=!pendingAllIn;
  if(!pendingAllIn)$("all-in-flashback").checked=false;
  $("all-in-hint").textContent=!pendingAllIn?"Сначала совершите обычный бросок.":influence>0?"Можно перебросить этот результат, потратив 1 Влияние.":stressPayment&&stress<3?"Влияния нет, но Дар позволяет получить Стресс вместо оплаты.":"Для Ва-банк недостаточно Влияния.";
}
function renderToolsWorkspace(){renderFreeplayDirector();renderClocks();renderStressTrackers();renderDiceHistory();if(toolsRole()!=="network-narrator")renderAllInControls();renderChallengeRequestDock()}
function applyOptimisticToolsEvents(events){
  try{Scene=normalizeScene(SceneEngine.dispatchMany(Scene,events,{expectedVersion:Number(Scene.version||0)}).scene);syncHeroFromScene();persistAfterPaint();return true}catch{return false}
}
function resolveDice(count,threshold,payment="",diceRequest=null,scenario=freeplayScenario()){
  const context=toolsRollContext(),opposed=Scene.opposedRoll,participant=currentOpposedParticipant(),isOpposed=Boolean(opposed&&participant),request=diceRequest?{...diceRequest,threshold}:null,status=request?SceneEngine.diceHookStatus(context.scene,context.actor.id,request):null;
  if(request&&!status.available){toast(status.reason);return null}
  const result=Logic.rollXd6({count:status?.count||count,threshold:status?.threshold||threshold,criticalAt:status?.criticalAt||6}),prepared=request?SceneEngine.diceRollPayload(context.scene,context.actor.id,request,result):null,roll=prepared?.available?prepared.payload:{formula:`${result.initialCount}D6 ≥${threshold}`,rolls:result.rolls,successes:result.successes,crits:result.crits},resolution=isOpposed?null:Logic.challengeOutcome({successes:roll.successes,target:scenario.target}),outcome=isOpposed?"Встречный бросок":resolution.label,sources=roll.dice?.sources?.map(source=>source.label).join(" · "),darkUrge=roll.dice?.selectedHookIds?.includes("wolf.dark-urge")&&roll.successes%2===1;
  $("dice-result").className=`dice-result ${isOpposed?"outcome-opposed":`outcome-${resolution.id}`}`;
  $("dice-result").innerHTML=`<div class="dice">${roll.rolls.map(v=>`<span class="die ${v>=(roll.dice?.criticalAt||6)?"crit":v>=(roll.dice?.threshold||threshold)?"success":""}">${v}</span>`).join("")}</div><strong>${roll.successes} Успехов · ${roll.crits} Критов · ${outcome}</strong><div class="dice-resolution">${isOpposed?"Результат стороны сохранён. Победитель определится после броска соперника.":resolution.id==="failure"?"Награда не получена. Нарратор применяет проговорённый Риск.":resolution.id==="minimal"?"Герой получает оговорённую награду; Нарратор добавляет значительную трудность.":"Герой получает оговорённую награду и описывает дополнительный эффект."}</div><div class="autosave">${payment?`Ва-банк (${esc(payment)}). `:""}Исходных костей: ${result.initialCount}; ${isOpposed?`встречный бросок, попытка ${opposed.attempt}.`:`цель: ${scenario.target}, Крайний успех: ${scenario.target*2}.`}${sources?` Правила: ${esc(sources)}.`:""}${result.truncated?" Цепочка взрывов ограничена 300 костями.":""}</div>`;
  $("freeplay-risk-actions").innerHTML=`${darkUrge?`<div class="freeplay-rule-alert"><strong>Тёмный порыв: нечётное число Успехов</strong><span>Нарратор может перенаправить сохранённый результат на другого персонажа; сопротивление стоит 2 Стресса.</span></div>`:""}${!isOpposed&&resolution.id==="failure"?`<div class="freeplay-failure-tools"><button type="button" data-freeplay-risk="stress" ${toolsResourceValue("stress")>=3?"disabled":""}>Применить базовый Риск: +1 Стресс, +1 Влияние</button><details><summary>Другие Риски по правилам</summary><ul><li><b>Обоюдоострый исход:</b> желаемый эффект происходит с героем.</li><li><b>Эскалация:</b> возникает более значимая связанная Угроза.</li><li><b>Компромисс:</b> теряется вещь, безопасность или ценность.</li><li><b>Дрогнуть:</b> принять довод против Мотивации и получить 2 Влияния.</li><li><b>Напоминание, Смена Сцены или Споткнуться.</b></li></ul></details></div>`:""}`;
  S.runtime.diceHistory.unshift({at:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}),count:result.initialCount,successes:roll.successes,crits:roll.crits,outcome,target:isOpposed?null:scenario.target,allIn:Boolean(payment),payment});
  S.runtime.diceHistory=S.runtime.diceHistory.slice(0,20);persistAfterPaint();renderDiceHistory();
  const sync=toolsSyncContext(),challenge=currentChallengeRequest(),payload={...roll,actor:isOpposed?participant.name:S.name||"Система",outcome,payment,...(isOpposed?{opposedRequestId:opposed.id,opposedParticipantId:participant.id,opposedAttempt:opposed.attempt}:{target:scenario.target,...(challenge?{challengeRequestId:challenge.id}:{})})},event={type:"roll.public",actorId:isOpposed?participant.actorId||null:context.persisted?context.actor.id:null,payload};
  if(!event.actorId)delete payload.dice;
  if(context.persisted||sync.shared&&sync.canEdit||isOpposed){const committed=commitSceneEvents(payment?"Публичный бросок Ва-банк":"Публичный бросок",[event]);if(committed?.pending){applyOptimisticToolsEvents([event]);renderToolsWorkspace()}}
  return result;
}
function rollDice(){
  const syncContext=toolsSyncContext(),challenge=currentChallengeRequest(),opposed=Scene.opposedRoll,participant=currentOpposedParticipant(),opposedResult=opposedParticipantResult(participant,opposed);if(opposed&&(!participant||opposedResult))return toast(opposedResult?"Результат этой стороны уже сохранён":"Текущий герой не участвует во встречном броске");
  const scenario=freeplayScenario(),state=freeplayState();Object.assign(state,scenario);persistAfterPaint();
  const request=toolsDiceRequest(),context=toolsRollContext(),status=SceneEngine.diceHookStatus(context.scene,context.actor.id,request),count=status.available?status.count:Math.max(1,request.baseCount+request.advantage-request.hindrance);
  if(!status.available)return toast(status.reason);resolveDice(count,4,"",request,scenario);pendingAllIn={count,diceRequest:request,scenario};renderAllInControls();
}
function allIn(payment){
  if(!pendingAllIn)return;
  if(payment==="Влияние"){const influence=toolsResourceValue("influence");if(influence<1)return toast("Недостаточно Влияния");if(!setToolsResource("influence",influence-1,"Влияние"))return}else{const stress=toolsResourceValue("stress");if(stress>=3)return toast("Стресс уже максимален");if(!setToolsResource("stress",stress+1,"Стресс"))return}
  const flashback=hasGift("Plenty To Learn")&&$("all-in-flashback").checked,{count,diceRequest,scenario}=pendingAllIn,request=diceRequest?{...diceRequest,hooks:[...(diceRequest.hooks||[]),...(flashback?[{type:"advantage",ruleId:"student.plenty-to-learn",label:"Ещё многому учиться",amount:4}]:[])]}:null;pendingAllIn=null;resolveDice(count+(request?0:flashback?4:0),3,flashback?`${payment}, флэшбек +4` : payment,request,scenario);renderAllInControls();if(store.mode==="play")renderPlay();
}
function renderDiceHistory(){const context=toolsSyncContext(),history=context.shared?(Scene.rollFeed||[]).filter(roll=>activeSceneView()==="gm"||roll.visibility!=="gm"):S.runtime.diceHistory;$("dice-history").innerHTML=context.shared?history.map(h=>`<li><strong>${esc(h.actor||"Система")}</strong><br>${esc(h.formula||"Бросок")} → ${esc(h.successes)} успех., ${esc(h.crits)} крит.${h.outcome?` · ${esc(h.outcome)}`:""}${h.target?` · цель ${h.target}`:""}</li>`).join("")||`<li>На общем столе ещё не было публичных бросков.</li>`:history.map(h=>`<li>${esc(h.at)} · ${h.allIn?"Ва-банк · ":""}${esc(h.count)}D6 → ${esc(h.successes)} успех., ${esc(h.crits)} крит. · ${esc(h.outcome)}${h.target?` (цель ${h.target})`:""}</li>`).join("")}
function renderClocks(){
  const context=toolsSyncContext(),clocks=sessionClocks(),locked=context.shared&&!context.canEdit,addActions=$("clock-add-progress").closest(".clock-add-actions");addActions.hidden=locked;const editableCard=c=>`<article class="clock ${c.kind==="progress"?"progress":"danger"}"><div class="clock-head"><label>Название<input data-clock-name="${c.id}" value="${esc(c.name)}" maxlength="120" title="${esc(c.name)}"></label><div class="clock-head-actions"><button type="button" data-clock-save="${c.id}">✓ Сохранить</button><button type="button" class="remove" data-clock-remove="${c.id}">× Удалить</button></div></div><div class="clock-meta"><label>Тип<select data-clock-kind="${c.id}"><option value="progress" ${c.kind==="progress"?"selected":""}>Хорошие</option><option value="danger" ${c.kind==="progress"?"":"selected"}>Плохие</option></select></label><label>Сегменты<select data-clock-size="${c.id}">${[4,6,8,12].map(size=>`<option value="${size}" ${c.size===size?"selected":""}>${size}</option>`).join("")}</select></label></div><div class="segments">${Array.from({length:c.size},(_,i)=>`<button type="button" class="segment ${i<c.value?"on":""}" data-clock="${c.id}" data-value="${i+1}" aria-label="${i+1} из ${c.size}"></button>`).join("")}</div></article>`,readOnlyCard=c=>`<article class="clock clock-readonly ${c.kind==="progress"?"progress":"danger"}"><div class="clock-readonly-head"><strong title="${esc(c.name)}">${esc(c.name)}</strong><small>${c.value} / ${c.size}</small></div><div class="segments" role="img" aria-label="${esc(`${c.name}: заполнено ${c.value} из ${c.size}`)}">${Array.from({length:c.size},(_,i)=>`<span class="segment ${i<c.value?"on":""}"></span>`).join("")}</div></article>`,card=locked?readOnlyCard:editableCard,group=(kind,title,empty)=>{const items=clocks.filter(clock=>(clock.kind==="progress"?"progress":"danger")===kind);return`<section class="clock-group ${kind}"><h3>${title}</h3>${items.map(card).join("")||`<p class="autosave">${empty}</p>`}</section>`};$("clocks").innerHTML=group("progress","Хорошие часы","Пока нет часов прогресса.")+group("danger","Плохие часы",locked?"Нарратор ещё не добавил часы угрозы.":"Пока нет часов угрозы.");renderToolsSyncState();
}
function renderStressTrackers(){
  const root=$("stress-trackers"),context=toolsSyncContext(),heroes=context.shared
    ?Scene.actors.filter(actor=>actor.team==="hero"&&actor.kind!=="token")
    :store.heroes.map(hero=>({id:hero.id,name:hero.name||"Безымянный герой",stress:clamp(hero.runtime?.stress,0,3)}));
  const segment=(hero,index)=>context.canEdit
    ?`<button type="button" class="${index<=hero.stress?"on":""}" data-stress-actor="${esc(hero.id)}" data-stress-value="${index}" aria-label="${esc(`${hero.name}: Стресс ${index}`)}"></button>`
    :`<span class="${index<=hero.stress?"on":""}"></span>`;
  root.innerHTML=heroes.map(hero=>`<article class="stress-card ${Number(hero.stress)>=3?"maximum":""}"><div><strong>${esc(hero.name)}</strong><small>${Number(hero.stress)>=3?"Максимум · герой вне строя":`${clamp(hero.stress,0,3)} / 3`}</small></div><div class="stress-segments" ${context.canEdit?"":`role="img" aria-label="${esc(`${hero.name}: Стресс ${clamp(hero.stress,0,3)} из 3`)}"`}>${[1,2,3].map(index=>segment(hero,index)).join("")}</div></article>`).join("")||`<p class="autosave">${context.shared?"Добавьте героев за общий стол.":"Нет текущего героя."}</p>`;
}

function bondRuleItems(){return [
  {id:"bond.rule.overview",kind:"Связь · правило",name:"Что такое Связь",text:D.bonds.overview},
  {id:"bond.rule.tags",kind:"Связь · правило",name:"Теги Связи",text:D.bonds.tags},
  {id:"bond.rule.quick",kind:"Связь · правило",name:"Быстрые Связи",text:D.bonds.quick},
  {id:"bond.rule.rank",kind:"Связь · правило",name:"Повышение Ранга Связи",text:D.bonds.rankUp},
  {id:"bond.rule.actions",kind:"Связь · правило",name:"Как использовать действия Связи",text:D.bonds.actionsIntro},
  {id:"bond.rule.favored",kind:"Связь · правило",name:"Избранные действия Связи",text:D.bonds.favoredActions},
  {id:"bond.rule.narrator",kind:"Связь · Нарратору",name:"Возвращающиеся персонажи",text:D.bonds.returningCharacters},
  ...D.bonds.relatedRules.map(rule=>({...rule,kind:"Связь · смежное правило"})),
]}
function bondRelatedItems(){
  const mentionsBond=text=>/\*\*(?:Связ|Связан|быстр\w+ Связ|Ранг Связ)|действи\w+ Связи/i.test(text||"");
  const gifts=activeOutlooks().flatMap(outlook=>(outlook.builtin?[outlook.builtin]:[]).concat(outlook.gifts).filter(gift=>mentionsBond(gift.text)).map(gift=>({id:gift.id,name:gift.name,source:`Дар · ${outlook.name}`,text:gift.text})));
  const techniques=activeArchetypes().flatMap(archetype=>archetype.techniques.flatMap(technique=>technique.levels.filter(level=>mentionsBond(level.text)).map(level=>({id:`${technique.id}.${level.n}`,name:`${technique.name} · ${level.n}: ${level.name}`,source:`Техника · ${archetype.name}`,text:level.text}))));
  return gifts.concat(techniques);
}
function renderBondReference(){
  const root=$("bond-reference-content");if(!root)return;
  const standard=D.bonds.actions.filter(action=>!action.antagonistic),antagonistic=D.bonds.actions.filter(action=>action.antagonistic),related=bondRelatedItems();
  const cards=actions=>actions.map(action=>`<article class="bond-action-card ${action.antagonistic?"antagonistic":""}"><header><span>${esc(action.tag)}</span><h3>${esc(action.name)}</h3></header><p>${md(action.text)}</p></article>`).join("");
  root.innerHTML=`<div class="bond-reference-intro">${md(D.bonds.overview)}</div><div class="bond-rule-grid"><article><h3>Теги и пределы</h3><div>${md(D.bonds.tags)}</div></article><article><h3>Быстрые Связи</h3><div>${md(D.bonds.quick)}</div></article><article><h3>Повышение Ранга</h3><div>${md(D.bonds.rankUp)}</div></article><article><h3>Цена и первое действие</h3><div>${md(D.bonds.actionsIntro)}<p>${md(D.bonds.favoredActions)}</p></div></article></div><h3 class="bond-group-title">10 стандартных действий и тегов</h3><div class="bond-action-grid">${cards(standard)}</div><section class="bond-antagonistic"><h3>Антагонистические действия</h3><p>${md(D.bonds.antagonisticIntro)}</p><div class="bond-action-grid">${cards(antagonistic)}</div></section><section class="bond-related"><header><h3>Связи в других базовых правилах</h3><span>${D.bonds.relatedRules.length}</span></header><div class="bond-related-grid">${D.bonds.relatedRules.map(item=>`<article><small>Базовое правило</small><h4>${esc(item.name)}</h4><p>${md(item.text)}</p></article>`).join("")}</div></section><section class="bond-related"><header><h3>Особенности, которые меняют правила Связей</h3><span>${related.length}</span></header><p>Здесь собраны Дары и Техники из остальных разделов книги, которые создают, усиливают, ограничивают или позволяют использовать Связи иначе.</p><div class="bond-related-grid">${related.map(item=>`<article><small>${esc(item.source)}</small><h4>${esc(item.name)}</h4><p>${md(item.text)}</p></article>`).join("")}</div></section><section class="bond-narrator"><h3>Нарратору: связанные NPC должны возвращаться</h3><div>${md(D.bonds.returningCharacters)}</div></section>`;
}
function ruleKey(value){let hash=2166136261;for(const char of String(value))hash=Math.imul(hash^char.charCodeAt(0),16777619);return(hash>>>0).toString(36)}
function ruleCardData(card){return Array.isArray(card)?{name:card[0],text:card[1]}:card}
function ruleCardValues(card){const {name="",text="",category="",aliases=[]}=ruleCardData(card);return[name,text,category,...aliases]}
function ruleCardId(card,chapterId){const item=ruleCardData(card),key=item.id||ruleKey(`${item.name}:${item.text}`);return `rule-${chapterId}-${String(key).replace(/[^a-z0-9_-]+/gi,"-")}`}
function ruleCardsHtml(cards,chapterId="rule"){
  const linkLabel=isEnglishPreview()?"Link to rule":"Ссылка на правило";
  return `<div class="rules-card-grid">${cards.map(card=>{const {name,text}=ruleCardData(card),id=ruleCardId(card,chapterId);return `<article id="${id}" class="rules-card"><header><h3>${esc(name)}</h3><a class="rule-permalink" href="#${id}" aria-label="${linkLabel} «${esc(name)}»">#</a></header><div>${md(text)}</div></article>`}).join("")}</div>`;
}
function fieldRulesVisual(){
  const grid=(cells,classes)=>`<div class="rule-mini-grid">${cells.map((label,index)=>`<span class="${classes[index]||""}">${label}</span>`).join("")}</div>`,range=[4,3,2,3,4,3,2,1,2,3,2,1,"●",1,2,3,2,1,2,3,4,3,2,3,4],line=Array.from({length:25},(_,index)=>index===12?"●":""),lineClasses=Array.from({length:25},(_,index)=>[0,2,4,6,7,10,11,12,13,14,17,18,20,22,24].includes(index)?(index===12?"origin":"line"):""),zone=Array.from({length:25},(_,index)=>index===12?"●":""),zoneClasses=Array.from({length:25},(_,index)=>[6,7,8,11,12,13,16,17,18].includes(index)?(index===12?"origin":"zone"):"");
  return `<div class="rules-diagrams"><figure><figcaption>Манхэттенская дальность</figcaption>${grid(range,range.map(value=>value==="●"?"origin":""))}</figure><figure><figcaption>Ортогональные и диагональные Линии</figcaption>${grid(line,lineClasses)}</figure><figure><figcaption>Центрированная Зона 3 × 3</figcaption>${grid(zone,zoneClasses)}</figure><figure class="cinematic"><figcaption>Кинематографичное поле</figcaption><div class="rule-cinematic-line">${["И","И","·","·","·","В","В"].map((label,index)=>`<span class="${index<2?"hero":index>4?"enemy":""}">${label}</span>`).join("")}</div></figure></div>`;
}
function ruleMatches(query,...values){return !query||values.join(" ").toLowerCase().includes(query)}
function activeRulesActionData(){const core=activeCoreRules();return core?{actions:core.actions,effects:core.effects}:{actions:D.actions,effects:D.effects}}
function actionCostLabel(action){
  if(!action.cost)return"";if(typeof action.cost==="string")return action.cost;
  const labels=isEnglishPreview()?{ap:"AP",focus:"Focus",influence:"Influence",antagonism:"Antagonism"}:{ap:"ОД",focus:"Фокус",influence:"Влияние",antagonism:"Антагонизм"};
  return `${action.cost.amount} ${labels[action.cost.resource]||action.cost.resource}`;
}
function actionRulesHtml(query=""){
  const {actions:actionData,effects}=activeRulesActionData(),actions=actionData.list.filter(action=>ruleMatches(query,action.group,action.name,actionCostLabel(action),action.text)),positive=effects.positive.filter(effect=>ruleMatches(query,effect.name,effect.text)),negative=effects.negative.filter(effect=>ruleMatches(query,effect.name,effect.text)),groups=[...new Set(actions.map(action=>action.group))],en=isEnglishPreview(),linkLabel=en?"Link to action":"Ссылка на действие";
  return `<div class="rules-action-intro">${md(actionData.intro||"")}</div>${groups.map(group=>`<section class="rules-subgroup"><h3>${esc(group)}</h3><div class="rules-card-grid">${actions.filter(action=>action.group===group).map(action=>{const id=`rule-action-${String(action.id||ruleKey(`${action.name}:${action.text}`)).replace(/[^a-z0-9_-]+/gi,"-")}`,cost=actionCostLabel(action);return `<article id="${id}" class="rules-card"><header><h3>${esc(action.name)}</h3>${cost?`<span>${esc(cost)}</span>`:""}<a class="rule-permalink" href="#${id}" aria-label="${linkLabel} «${esc(action.name)}»">#</a></header><div>${md(action.text)}</div></article>`}).join("")}</div></section>`).join("")}${positive.length?`<section class="rules-subgroup"><h3>${en?"Positive Effects":"Положительные Эффекты"}</h3>${ruleCardsHtml(positive,"positive-effect")}</section>`:""}${negative.length?`<section class="rules-subgroup"><h3>${en?"Negative Effects":"Отрицательные Эффекты"}</h3>${ruleCardsHtml(negative,"negative-effect")}</section>`:""}`;
}
function combatActionReferenceHtml(query=""){
  const actions=D.actions.list.filter(action=>ruleMatches(query,action.group,action.name,action.cost||"",action.text)),groups=[...new Set(actions.map(action=>action.group))];
  if(!actions.length)return"";
  return `<section class="combat-action-reference"><header><span class="kind">БАЗОВЫЕ ДЕЙСТВИЯ</span><h3>Все варианты прямо в разделе боя</h3><p>Атаки, защитные Реакции, движение и утилитарные действия приведены здесь полностью — переходить в другую главу не требуется.</p></header>${groups.map(group=>`<details open><summary>${esc(group)} <b>${actions.filter(action=>action.group===group).length}</b></summary><div class="rules-card-grid">${actions.filter(action=>action.group===group).map(action=>{const id=`rule-combat-action-${ruleKey(`${action.name}:${action.text}`)}`;return `<article id="${id}" class="rules-card"><header><h3>${esc(action.name)}</h3>${action.cost?`<span>${esc(action.cost)}</span>`:""}<a class="rule-permalink" href="#${id}" aria-label="Ссылка на действие «${esc(action.name)}»">#</a></header><div>${md(action.text)}</div></article>`}).join("")}</div></details>`).join("")}</section>`;
}
function rulesChapterText(chapter){
  const {actions,effects}=activeRulesActionData(),own=(chapter.cards||[]).flatMap(ruleCardValues).join(" "),special=chapter.special==="bonds"?JSON.stringify(D.bonds):chapter.special==="actions"?`${actions.intro} ${JSON.stringify(actions.list)} ${JSON.stringify(effects)}`:chapter.id==="combat"?JSON.stringify(actions.list):"";
  return `${chapter.name} ${chapter.desc} ${chapter.source||""} ${own} ${special}`.toLowerCase();
}
function activeRuleChapters(){
  const core=activeCoreRules();if(!core)return RULE_CHAPTERS;
  const en=isEnglishPreview(),groups=[];
  for(const card of core.rules){let group=groups.find(item=>item.name===card.category);if(!group){group={id:`lionwing-${ruleKey(card.category)}`,mark:String(groups.length+1).padStart(2,"0"),name:card.category,desc:en?"LionWing core rules":"Базовые правила LionWing",audience:"player",source:en?"LionWing Edition · Core Rules":"LionWing Edition · Базовые правила",cards:[]};groups.push(group)}group.cards.push(card)}
  groups.push({id:"lionwing-actions",mark:String(groups.length+1).padStart(2,"0"),name:en?"Actions and Effects":"Действия и Эффекты",desc:en?"Structured combat reference":"Справочник структурированного боя",audience:"player",source:en?"LionWing Edition · pages 61–65":"LionWing Edition · стр. 61–65",special:"actions"});
  return groups;
}
function renderRules(){
  const index=$("rules-index"),root=$("rules-chapters"),query=$("rules-search").value.trim().toLowerCase();if(!index||!root)return;
  const en=isEnglishPreview(),filters=[{id:"all",name:en?"All":"Все"},{id:"player",name:en?"Players":"Игрокам"},{id:"gm",name:en?"Narrator":"Нарратору"}];
  $("rules-filters").innerHTML=filters.map(filter=>`<button type="button" class="${rulesAudience===filter.id?"on":""}" data-rules-audience="${filter.id}">${filter.name}</button>`).join("");
  const {actions,effects}=activeRulesActionData(),chapters=activeRuleChapters().filter(chapter=>(rulesAudience==="all"||chapter.audience===rulesAudience)&&rulesChapterText(chapter).includes(query));
  index.innerHTML=chapters.map(chapter=>`<a href="#rules-${chapter.id}"><span>${esc(chapter.mark)}</span>${esc(chapter.name)}</a>`).join("");
  root.innerHTML=chapters.map((chapter,chapterIndex)=>{const headerMatch=ruleMatches(query,chapter.name,chapter.desc,chapter.source||""),cards=chapter.cards?.filter(card=>headerMatch||ruleMatches(query,...ruleCardValues(card)))||[],specialQuery=headerMatch?"":query,count=chapter.cards?cards.length+(chapter.id==="combat"?actions.list.length:0):(chapter.special==="bonds"?D.bonds.actions.length:actions.list.length+effects.positive.length+effects.negative.length),visual=!isLionwingEdition()&&chapter.id==="field"&&!query?fieldRulesVisual():"",combatActions=!isLionwingEdition()&&chapter.id==="combat"?combatActionReferenceHtml(specialQuery):"",body=chapter.special==="bonds"?`<div id="bond-reference-content"></div>`:chapter.special==="actions"?actionRulesHtml(specialQuery):`${visual}${ruleCardsHtml(cards,chapter.id)}${combatActions}`;return `<details id="rules-${chapter.id}" class="rules-chapter" ${(chapterIndex===0||query)?"open":""}><summary><span>${esc(chapter.mark)}</span><div><h2>${esc(chapter.name)}</h2><p>${esc(chapter.desc)}</p></div><b>${count}</b></summary><div class="rules-chapter-body">${body}<footer class="rules-source">${esc(chapter.source||"")}</footer></div></details>`}).join("")||`<p class="rules-empty">${en?"No rules found for this query.":"По этому запросу правил не найдено."}</p>`;
  if(!isLionwingEdition())renderBondReference();
  const target=location.hash?document.getElementById(location.hash.slice(1)):null;if(target?.matches?.(".rules-chapter"))target.open=true;else if(target?.matches?.(".rules-card"))target.closest(".rules-chapter")?.setAttribute("open","");
}

function referenceItems(){
  if(isLionwingEdition()){
    const core=activeCoreRules(),en=isEnglishPreview(),costText=action=>actionCostLabel(action);return[
    ...activeReferenceSections(),
    ...activeCanonicalSkills().map(skill=>({...skill,kind:en?`Skill · ${skill.attribute}`:`Навык · ${activeAttrs().find(([id])=>id===skill.attribute)?.[1]||skill.attribute}`,text:en?"Canonical Skill; custom Skills are also allowed under the Character Ranks rules.":"Канонический Навык; собственные Навыки также разрешены по правилам Рангов персонажа."})),
    ...core.rules.map(rule=>({...rule,kind:en?`Rule · ${rule.category}`:`Правило · ${rule.category}`})),
    ...core.actions.list.map(action=>({...action,cost:costText(action),kind:en?`Action · ${action.group}`:`Действие · ${action.group}`})),
    ...core.effects.positive.map(effect=>({...effect,kind:en?"Effect · Positive":"Эффект · Положительный"})),
    ...core.effects.negative.map(effect=>({...effect,kind:en?"Effect · Negative":"Эффект · Отрицательный"})),
    ...(core.npcs?.list||[]).map(npc=>({...npc,kind:`NPC · ${npc.role}`,text:[npc.description,`${en?"Health":"Здоровье"}: ${npc.statistics.health}; ${en?"Speed":"Скорость"}: ${npc.statistics.speed}; ${en?"Armor":"Броня"}: ${npc.statistics.armor}`,npc.passive?`${en?"Passive":"Пассив"}: ${npc.passive}`:"",...npc.actions.map(action=>`${action.kind==="attack"?(en?"Attack":"Атака"):(en?"Action":"Действие")} — ${action.name}: ${action.text}`),`${en?"Ace":"Козырь"} T${npc.ace.tension} — ${npc.ace.name}: ${npc.ace.text}`].filter(Boolean).join("\n\n")})),
    ...activeArchetypes().flatMap(archetype=>archetype.techniques.map(technique=>({...technique,kind:`${en?"Technique":"Техника"} · ${archetype.name}`,text:[technique.flavor,...technique.levels.map(level=>`${level.n}: ${level.name} — ${level.text}`)].join("\n")}))),
    ...activeOutlooks().flatMap(outlook=>(outlook.builtin?[outlook.builtin]:[]).concat(outlook.gifts).map(gift=>({...gift,kind:`${en?"Boon":"Дар"} · ${outlook.name}`}))),
  ]}
  const items=[...RULES,...GLOSSARY,...bondRuleItems(),...D.bonds.actions.map(x=>({...x,kind:x.antagonistic?"Связь · антагонистическое действие":"Связь · действие",tags:x.tag})),...D.actions.list.map(x=>({...x,kind:"Действие"})),...D.effects.positive.map(x=>({...x,kind:"Положительный эффект"})),...D.effects.negative.map(x=>({...x,kind:"Отрицательный эффект"})),...activeArchetypes().flatMap(a=>a.techniques.map(t=>{const statuses=t.levels.map(level=>techniqueLevelAutomation(t.id,level.n)),automated=statuses.filter(status=>status!=="manual").length;return{...t,automationStatus:automated===statuses.length&&statuses.every(status=>status==="full")?"full":automated?"partial":"manual",kind:`Техника · ${a.name}`,text:[t.flavor,...t.levels.map(l=>`${l.n}: ${l.name} — ${l.text}`)].join("\n")}})),...activeOutlooks().flatMap(o=>(o.builtin?[o.builtin]:[]).concat(o.gifts).map(g=>({...g,kind:`Дар · ${o.name}`}))),...enemyProfiles().map(enemy=>({...enemy,automationStatus:enemyProfileAutomation(enemy),kind:enemy.kind==="modifier"?"Враг-Модификатор":"Враг",text:`${enemy.statsRaw}\n${enemy.examples}\n${enemy.text}`})),...(D.enemies?.antagonistTraits||[]).map(trait=>({...trait,kind:"Черта Антагониста",text:trait.rules.map(rule=>`${rule.name} (${rule.trigger}): ${rule.text}`).join("\n")}))];
  return items;
}
function renderReference(){
  const lionwing=isLionwingEdition(),en=isEnglishPreview()&&lionwing,q=$("ref-search").value.trim().toLowerCase(),filters=lionwing?(en?["all","Builder Reference","Skill","Rule","Action","Effect","NPC","Technique","Boon"]:["all","Справка","Навык","Правило","Действие","Эффект","NPC","Техника","Дар"]):["all","Термин","Памятка","Связь","Действие","Эффект","Техника","Дар","Враг"],tagList=item=>String(item.tags||"").split(",").map(tag=>tag.trim()).filter(Boolean);
  if(!filters.includes(refKind))refKind="all";
  $("ref-filters").innerHTML=filters.map(f=>`<button type="button" class="${refKind===f?"on":""}" data-ref-kind="${f}">${f==="all"?(en?"All":"Всё"):f}</button>`).join("");
  const matchKind=item=>refKind==="all"||item.kind.toLowerCase().includes(refKind.toLowerCase()),kindItems=referenceItems().filter(matchKind),tags=[...new Set(kindItems.flatMap(tagList))].sort((a,b)=>a.localeCompare(b,en?"en":"ru"));
  if(refTag!=="all"&&!tags.includes(refTag))refTag="all";
  $("ref-tag-filters").innerHTML=`<label class="tag-picker"><span>${en?"Tag":"Тег"}</span><select data-ref-tag-select>${["all",...tags].map(tag=>`<option value="${esc(tag)}" ${refTag===tag?"selected":""}>${tag==="all"?(en?"All tags":"Все теги"):esc(tag)}</option>`).join("")}</select></label>`;
  $("ref-sort").value=refSort;
  const list=kindItems.filter(item=>(refTag==="all"||tagList(item).includes(refTag))&&(!q||`${item.name} ${item.en||""} ${(item.aliases||[]).join(" ")} ${item.kind} ${item.text||""} ${item.tags||""}`.toLowerCase().includes(q)));
  if(refSort==="name")list.sort((a,b)=>a.name.localeCompare(b.name,en?"en":"ru"));
  $("reference-list").innerHTML=list.slice(0,250).map(item=>`<article class="catalog-card"><span class="kind">${esc(item.kind)}</span><h3>${en?"":automationBadge(item.automationStatus)}${esc(item.name)}${item.cost?` · ${esc(item.cost)}`:""}</h3>${item.aliases?.length?`<div class="meta">${en?"Also":"Также"}: ${item.aliases.map(esc).join(" · ")}</div>`:item.tags?`<div class="meta">${esc(item.tags)}</div>`:""}<p>${md(item.text||"")}</p></article>`).join("")||`<p>${en?"Nothing found.":"Ничего не найдено."}</p>`;
}

function renderAll(){renderHeroSelect();renderSupplementPicker();renderProfile();renderAttrs();renderOutlooks();renderBondTraining();renderSkillsAbility();renderTechniques();renderSheet();renderSidebar();if(store.mode==="play")renderPlay();if(store.mode==="tools")renderToolsWorkspace();if(store.mode==="rules")renderRules();if(store.mode==="reference")renderReference();renderChallengeRequestDock();persist();}
function initCollapsibleBuildPanels(){$$('.mode-page[data-page="build"]>.panel').forEach(panel=>{const title=panel.querySelector(':scope>.section-title');if(!title)return;panel.classList.add("build-collapsible");title.tabIndex=0;title.setAttribute("role","button");title.setAttribute("aria-expanded","true");const toggle=()=>{const collapsed=panel.classList.toggle("collapsed");title.setAttribute("aria-expanded",String(!collapsed))};title.addEventListener("click",toggle);title.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggle()}})})}
function setMode(mode){store.mode=["build","play","tools","rules","reference"].includes(mode)?mode:"build";if(store.mode!=="play")setScenePanel(null);document.body.classList.toggle("builder-mode",store.mode==="build");document.body.classList.toggle("reference-mode",store.mode==="reference");document.body.classList.toggle("scene-mode",store.mode==="play");document.body.classList.toggle("scene-player-view",store.mode==="play"&&activeSceneView()==="player");if(store.mode!=="tools")document.body.classList.remove("tools-narrator-mode");$$('[data-page]').forEach(p=>p.classList.toggle("active",p.dataset.page===store.mode));$$('[data-mode]').forEach(b=>b.setAttribute("aria-current",b.dataset.mode===store.mode?"page":"false"));if(store.mode==="play")renderPlay();if(store.mode==="tools")renderToolsWorkspace();if(store.mode==="rules")renderRules();if(store.mode==="reference")renderReference();renderChallengeRequestDock();persist();if(typeof syncContentUrl==="function")syncContentUrl();if(["rules","reference"].includes(store.mode)&&location.hash)requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());else window.scrollTo({top:0,behavior:store.mode==="play"?"auto":"smooth"});}
