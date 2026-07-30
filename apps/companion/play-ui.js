"use strict";

function renderSync(){
  if(!Sync)return;const sync=Sync.state(),statusNames={offline:sync.authenticated?"Нет сети":"Локально",connecting:"Переподключение…",authenticated:"Auth готов",online:"Синхронизировано",error:"Ошибка"},roleNames={owner:"Владелец / Нарратор",narrator:"Нарратор",player:"Игрок"},status=$("scene-sync-status");status.textContent=statusNames[sync.status]||sync.status;status.className=`sync-status ${sync.status}`;status.title=sync.error||"";
  if(document.activeElement!==$("sync-url"))$("sync-url").value=sync.url||"";if(document.activeElement!==$("sync-key"))$("sync-key").value=sync.publishableKey||"";if(document.activeElement!==$("sync-display-name"))$("sync-display-name").value=sync.displayName||S.player||"";
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
  renderSync();renderScene();
}

let pendingAllIn=null;
function toolsSyncContext(){const state=Sync?.state?.()||{};return{shared:Boolean(state.sceneId),canEdit:!state.sceneId||Boolean(state.canNarrate),status:state.status||"offline",role:state.role||"",displayName:state.displayName||S.player||"Нарратор"}}
function toolsRole(){const context=toolsSyncContext();return context.shared?(context.canEdit?"network-narrator":"network-player"):"local-table"}
function renderToolsSyncState(){const context=toolsSyncContext(),output=$("tools-sync-state"),role=toolsRole();output.classList.toggle("online",context.shared);output.textContent=role==="network-narrator"?"Общий стол · Нарратор":role==="network-player"?"Общий стол · Игрок":"Один стол · одно устройство"}
function sessionClocks(){Scene.sessionClocks||=[];Scene.tools||={clocksMigrated:false};const context=toolsSyncContext();if(!Scene.tools.clocksMigrated&&!context.shared&&context.canEdit){Scene.sessionClocks=S.runtime.clocks.map(clock=>({...clock,kind:clock.kind==="progress"?"progress":"danger"}));Scene.tools.clocksMigrated=true;persist()}return Scene.sessionClocks}
function freeplayState(){S.runtime.freeplay||={target:null};return S.runtime.freeplay}
function currentChallengeRequest(){const request=Scene.challengeRequest,actor=currentHeroActor();return request&&actor&&request.actorId===actor.id?request:null}
function freeplayTarget(){const context=toolsSyncContext(),request=currentChallengeRequest();return context.shared&&!context.canEdit?clamp(request?.target||S.tier+1,1,99):clamp($("dice-target").value,1,99)}
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
  if(skill)hooks.push({type:"advantage",ruleId:`freeplay.skill:${skill.id}`,label:`Навык: ${skill.name}`,amount:effectiveSkillRank(skill)});
  if(ability?.enabled)hooks.push({type:"advantage",ruleId:`freeplay.ability:${abilityKey}`,label:`Способность: ${ability.name||"без названия"}`,amount:ability.rank});
  if(bond&&bondStatus.amount)hooks.push({type:"advantage",ruleId:`freeplay.bond:${bond.id}`,label:`Связь: ${bond.name} (${bondStatus.parts.join(", ")})`,amount:bondStatus.amount});
  return{scope:"challenge",baseCount:clamp($("dice-count").value,1,40),advantage:clamp($("dice-adv").value,0,30),hindrance:clamp($("dice-dis").value,0,30),attribute:$("dice-attr").value==="manual"?null:$("dice-attr").value,usesAbility:Boolean(abilityKey),abilityKey:abilityKey||null,selectedHookIds:$("dice-dark-urge")?.checked?["wolf.dark-urge"]:[],targetIds:[...(Scene.targetIds||[])],hooks};
}
function renderOutcomeGuide(){
  const target=clamp($("dice-target").value,1,99),minimumEnd=target*2-1;
  $("dice-outcome-guide").innerHTML=`<span><b>Провал</b> · 0–${target-1}</span><span><b>Минимальный успех</b> · ${target}${minimumEnd>target?`–${minimumEnd}`:""}</span><span><b>Крайний успех</b> · ${target*2}+</span>`;
}
function challengeActors(){
  const heroes=Scene.actors.filter(actor=>actor.team==="hero"&&actor.kind!=="token"&&!actor.knockedOut),players=heroes.filter(actor=>actor.ownerId);
  return players.length?players:heroes;
}
function renderFreeplayDirector(){
  const context=toolsSyncContext(),role=toolsRole(),request=Scene.challengeRequest,localSelect=$("freeplay-local-hero"),actorSelect=$("freeplay-request-actor"),target=$("dice-target"),requestActorWrap=$("freeplay-request-actor-wrap"),localHeroWrap=$("freeplay-local-hero-wrap"),actions=$("freeplay-request-actions"),state=$("freeplay-request-state"),requestButton=$("freeplay-request-roll"),clearButton=$("freeplay-request-clear"),defaultButton=$("dice-target-default");
  document.body.classList.toggle("tools-narrator-mode",role==="network-narrator"&&store.mode==="tools");
  document.querySelector(".freeplay-grid").dataset.toolsRole=role;
  document.querySelector(".freeplay-hero-tool").hidden=role==="network-narrator";
  document.querySelector(".dice-tool").hidden=role==="network-narrator";
  document.querySelector(".freeplay-bonds-tool").hidden=role==="network-narrator";
  localHeroWrap.hidden=role!=="local-table";requestActorWrap.hidden=role!=="network-narrator";actions.hidden=role!=="network-narrator";defaultButton.hidden=role==="network-player";target.disabled=role==="network-player";
  if(role!=="network-player")$("roll-dice").disabled=false;
  if(role==="local-table"){
    $("freeplay-director-kind").textContent="ЛОКАЛЬНЫЙ СТОЛ";$("freeplay-director-title").textContent="Испытание за одним устройством";$("freeplay-director-help").textContent="Нарратор выбирает героя и сложность, затем игрок собирает пул и бросает.";
    localSelect.innerHTML=store.heroes.map((hero,index)=>`<option value="${index}" ${index===store.current?"selected":""}>${esc(hero.name||"Безымянный герой")} · Ст.${hero.tier}</option>`).join("");
    if(document.activeElement!==target)target.value=freeplayState().target||S.tier+1;
    state.innerHTML="<strong>Локальная игра</strong><span>Все герои и броски остаются на этом устройстве; переключение героя использует его настоящий лист.</span>";
  }else if(role==="network-narrator"){
    $("freeplay-director-kind").textContent="СЕТЕВОЙ СТОЛ";$("freeplay-director-title").textContent="Пульт Нарратора";$("freeplay-director-help").textContent="Выберите героя и назначьте Цель Успехов. Игрок получит запрос на своём устройстве.";
    const actors=challengeActors(),selected=actorSelect.value||request?.actorId;actorSelect.innerHTML=actors.map(actor=>`<option value="${actor.id}">${esc(actor.name)}</option>`).join("")||`<option value="">Нет подключённых героев</option>`;if(actors.some(actor=>actor.id===selected))actorSelect.value=selected;
    if(document.activeElement!==target)target.value=request?.target||freeplayState().target||S.tier+1;
    requestButton.disabled=!actors.length;clearButton.hidden=!request;
    const actor=Scene.actors.find(item=>item.id===request?.actorId);state.innerHTML=request?`<strong>Ожидается бросок: ${esc(actor?.name||"герой")}</strong><span>Назначенная цель — ${request.target}. Новый запрос заменит текущий.</span>`:`<strong>Активного запроса нет</strong><span>Назначьте сложность, когда станет понятно, что действие требует испытания.</span>`;
  }else{
    $("freeplay-director-kind").textContent="ЗАПРОС НАРРАТОРА";$("freeplay-director-title").textContent=request?"Назначено испытание":"Ожидайте решения Нарратора";$("freeplay-director-help").textContent=request?"Соберите пул по листу персонажа и совершите публичный бросок.":"В сетевой игре сложность задаёт Нарратор.";
    const ownRequest=currentChallengeRequest();target.value=ownRequest?.target||S.tier+1;
    state.innerHTML=ownRequest?`<strong>Цель Успехов: ${ownRequest.target}</strong><span>${esc(ownRequest.requestedBy)} запросил бросок для ${esc(S.name||"вашего героя")}.</span>`:request?`<strong>Нарратор запросил другого героя</strong><span>Сейчас бросает ${esc(Scene.actors.find(actor=>actor.id===request.actorId)?.name||"другой участник")}.</span>`:`<strong>Запроса пока нет</strong><span>Обсудите действие вслух; когда нужен бросок, Нарратор назначит сложность.</span>`;
    $("roll-dice").disabled=!ownRequest;
  }
  renderOutcomeGuide();renderToolsSyncState();
}
function renderChallengeRequestDock(){
  const dock=$("challenge-request-dock"),context=toolsSyncContext(),request=currentChallengeRequest(),visible=context.shared&&!context.canEdit&&Boolean(request)&&store.mode!=="tools";
  dock.hidden=!visible;if(visible)$("challenge-request-dock-text").textContent=`${request.requestedBy} просит бросок · цель ${request.target}`;
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
  const skill=$("dice-skill"),ability=$("dice-ability"),bond=$("dice-bond"),skillValue=skill.value,abilityValue=ability.value,bondValue=bond.value,darkChecked=$("dice-dark-urge")?.checked;
  skill.innerHTML=`<option value="">Без Навыка</option>${S.skills.filter(item=>item.name.trim()).map(item=>`<option value="${item.id}">${esc(item.name)} · +${effectiveSkillRank(item)}D6</option>`).join("")}`;if([...skill.options].some(option=>option.value===skillValue))skill.value=skillValue;
  ability.innerHTML=`<option value="">Без Способности</option>${S.ability.enabled?`<option value="main">${esc(S.ability.name||"Способность")} · +${S.ability.rank}D6</option>`:""}${S.mods.taintedBody&&S.taintedAbility.enabled?`<option value="tainted">${esc(S.taintedAbility.name||"Порченое тело")} · +${S.taintedAbility.rank}D6</option>`:""}`;if([...ability.options].some(option=>option.value===abilityValue))ability.value=abilityValue;
  bond.innerHTML=`<option value="">Без Связи</option>${S.bonds.map(item=>{const status=freeplayBondStatus(item);return`<option value="${item.id}">${esc(item.name)} · +${status.amount}D6</option>`}).join("")}`;if([...bond.options].some(option=>option.value===bondValue))bond.value=bondValue;
  $("dice-hero-context").innerHTML=`<span>Бросает</span><strong>${esc(S.name||"Безымянный герой")}</strong><small>Ступень ${S.tier} · назначенная цель ${freeplayTarget()}</small>`;
  $("dice-hook-controls").innerHTML=S.gifts.includes("wolf.dark-urge")?`<label class="switch"><input id="dice-dark-urge" type="checkbox" ${darkChecked?"checked":""}><span><b>Тёмный порыв</b> · +4 Преимущества со Способностью; нечётные Успехи дают Нарратору право сменить цель</span></label>`:"";
  recalculateDicePool();
}
function openToolsDicePreset({attr="",skillId="",abilityKey=""}={}){setMode("tools");renderDiceComposer();if(attr&&[...$("dice-attr").options].some(option=>option.value===attr))$("dice-attr").value=attr;if(skillId&&[...$("dice-skill").options].some(option=>option.value===skillId))$("dice-skill").value=skillId;if(abilityKey&&[...$("dice-ability").options].some(option=>option.value===abilityKey))$("dice-ability").value=abilityKey;recalculateDicePool();requestAnimationFrame(()=>$("roll-dice").focus())}
function renderFreeplayHeroPanel(){
  const actor=toolsRuntimeActor(),stress=clamp(actor?.stress??S.runtime.stress,0,3),influence=Math.max(0,Number(actor?.influence??S.runtime.influence)||0),gifts=selectedGifts(),techniques=Object.entries(S.techniques).filter(([,level])=>level>0).map(([id,level])=>({tech:techById(id),level})).filter(item=>item.tech),locked=toolsSyncContext().shared&&!actor;
  const resource=(key,label,value,maximum="")=>`<div class="freeplay-resource" data-freeplay-resource-group="${key}"><span>${label}</span><button type="button" data-freeplay-resource="${key}" data-freeplay-delta="-1" ${locked||value<=0?"disabled":""}>−</button><strong>${value}${maximum?` / ${maximum}`:""}</strong><button type="button" data-freeplay-resource="${key}" data-freeplay-delta="1" ${locked||maximum&&value>=maximum?"disabled":""}>+</button></div>`;
  $("freeplay-hero-panel").innerHTML=`<header class="freeplay-hero-head">${S.media.portrait?`<img src="${S.media.portrait}" alt="">`:`<i>✦</i>`}<div><span class="kind">ЛИСТ ПЕРСОНАЖА</span><h2>${esc(S.name||"Безымянный герой")}</h2><p>${esc(S.concept||"Концепция не записана")} · Ступень ${S.tier}</p></div><div class="freeplay-resources">${resource("influence","Влияние",influence)}${resource("stress","Стресс",stress,3)}</div></header><div class="freeplay-sheet-picks"><section><h3>Атрибуты</h3><div>${ATTRS.map(([key,label])=>`<button type="button" data-freeplay-attr="${key}"><span>${label}</span><b>${attrValue(key)}D6</b></button>`).join("")}</div></section><section><h3>Навыки</h3><div>${S.skills.filter(skill=>skill.name.trim()).map(skill=>`<button type="button" data-freeplay-skill="${skill.id}"><span>${esc(skill.name)}</span><b>+${effectiveSkillRank(skill)}D6</b></button>`).join("")||`<p class="autosave">Навыки не записаны.</p>`}</div></section>${S.ability.enabled?`<section><h3>Способность</h3><button type="button" class="freeplay-ability-pick" data-freeplay-ability="main"><span><b>${esc(S.ability.name||abilityFormula())}</b><small>${esc(abilityFormula())}</small></span><strong>+${S.ability.rank}D6</strong></button></section>`:""}</div><div class="freeplay-features"><details><summary>Мировоззрения и Дары <small>${gifts.length}</small></summary>${gifts.map(gift=>`<article><strong>${esc(gift.name)}</strong><p>${md(gift.text)}</p></article>`).join("")||`<p class="autosave">Дары не выбраны.</p>`}</details><details><summary>Техники <small>${techniques.reduce((sum,item)=>sum+item.level,0)} ур.</small></summary>${techniques.map(({tech,level})=>`<article><strong>${esc(tech.name)} · Уровень ${level}</strong>${tech.levels.slice(0,level).map(item=>`<p><b>${item.n}: ${esc(item.name)}</b> — ${md(item.text)}</p>`).join("")}</article>`).join("")||`<p class="autosave">Техники не выбраны.</p>`}</details></div>`;
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
function renderToolsWorkspace(){renderFreeplayDirector();renderClocks();renderStressTrackers();if(toolsRole()!=="network-narrator"){renderDiceHistory();renderAllInControls()}renderChallengeRequestDock()}
function resolveDice(count,threshold,payment="",diceRequest=null,scenario=freeplayScenario()){
  const context=toolsRollContext(),request=diceRequest?{...diceRequest,threshold}:null,status=request?SceneEngine.diceHookStatus(context.scene,context.actor.id,request):null;
  if(request&&!status.available){toast(status.reason);return null}
  const result=Logic.rollXd6({count:status?.count||count,threshold:status?.threshold||threshold,criticalAt:status?.criticalAt||6}),prepared=request?SceneEngine.diceRollPayload(context.scene,context.actor.id,request,result):null,roll=prepared?.available?prepared.payload:{formula:`${result.initialCount}D6 ≥${threshold}`,rolls:result.rolls,successes:result.successes,crits:result.crits},resolution=Logic.challengeOutcome({successes:roll.successes,target:scenario.target}),outcome=resolution.label,sources=roll.dice?.sources?.map(source=>source.label).join(" · "),darkUrge=roll.dice?.selectedHookIds?.includes("wolf.dark-urge")&&roll.successes%2===1;
  $("dice-result").className=`dice-result outcome-${resolution.id}`;
  $("dice-result").innerHTML=`<div class="dice">${roll.rolls.map(v=>`<span class="die ${v>=(roll.dice?.criticalAt||6)?"crit":v>=(roll.dice?.threshold||threshold)?"success":""}">${v}</span>`).join("")}</div><strong>${roll.successes} Успехов · ${roll.crits} Критов · ${outcome}</strong><div class="dice-resolution">${resolution.id==="failure"?"Награда не получена. Нарратор применяет проговорённый Риск.":resolution.id==="minimal"?"Герой получает оговорённую награду; Нарратор добавляет значительную трудность.":"Герой получает оговорённую награду и описывает дополнительный эффект."}</div><div class="autosave">${payment?`Ва-банк (${esc(payment)}). `:""}Исходных костей: ${result.initialCount}; цель: ${scenario.target}, Крайний успех: ${scenario.target*2}.${sources?` Правила: ${esc(sources)}.`:""}${result.truncated?" Цепочка взрывов ограничена 300 костями.":""}</div>`;
  $("freeplay-risk-actions").innerHTML=`${darkUrge?`<div class="freeplay-rule-alert"><strong>Тёмный порыв: нечётное число Успехов</strong><span>Нарратор может перенаправить сохранённый результат на другого персонажа; сопротивление стоит 2 Стресса.</span></div>`:""}${resolution.id==="failure"?`<div class="freeplay-failure-tools"><button type="button" data-freeplay-risk="stress" ${toolsResourceValue("stress")>=3?"disabled":""}>Применить базовый Риск: +1 Стресс, +1 Влияние</button><details><summary>Другие Риски по правилам</summary><ul><li><b>Обоюдоострый исход:</b> желаемый эффект происходит с героем.</li><li><b>Эскалация:</b> возникает более значимая связанная Угроза.</li><li><b>Компромисс:</b> теряется вещь, безопасность или ценность.</li><li><b>Дрогнуть:</b> принять довод против Мотивации и получить 2 Влияния.</li><li><b>Напоминание, Смена Сцены или Споткнуться.</b></li></ul></details></div>`:""}`;
  S.runtime.diceHistory.unshift({at:new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}),count:result.initialCount,successes:roll.successes,crits:roll.crits,outcome,target:scenario.target,allIn:Boolean(payment),payment});
  S.runtime.diceHistory=S.runtime.diceHistory.slice(0,20);persistAfterPaint();renderDiceHistory();
  const sync=toolsSyncContext(),challenge=currentChallengeRequest(),payload={...roll,actor:S.name||"Система",outcome,payment,target:scenario.target,...(challenge?{challengeRequestId:challenge.id}:{})};
  if(context.persisted||sync.shared&&sync.canEdit){if(!context.persisted)delete payload.dice;commitSceneEvents(payment?"Публичный бросок Ва-банк":"Публичный бросок",[{type:"roll.public",actorId:context.persisted?context.actor.id:null,payload}])}
  return result;
}
function rollDice(){
  const syncContext=toolsSyncContext(),challenge=currentChallengeRequest();if(syncContext.shared&&!syncContext.canEdit&&!challenge)return toast("Дождитесь запроса Нарратора для этого героя");
  const scenario=freeplayScenario(),state=freeplayState();Object.assign(state,scenario);persistAfterPaint();
  const request=toolsDiceRequest(),context=toolsRollContext(),status=SceneEngine.diceHookStatus(context.scene,context.actor.id,request),count=status.available?status.count:Math.max(1,request.baseCount+request.advantage-request.hindrance);
  if(!status.available)return toast(status.reason);resolveDice(count,4,"",request,scenario);pendingAllIn={count,diceRequest:request,scenario};renderAllInControls();
}
function allIn(payment){
  if(!pendingAllIn)return;
  if(payment==="Влияние"){const influence=toolsResourceValue("influence");if(influence<1)return toast("Недостаточно Влияния");if(!setToolsResource("influence",influence-1,"Влияние"))return}else{const stress=toolsResourceValue("stress");if(stress>=3)return toast("Стресс уже максимален");if(!setToolsResource("stress",stress+1,"Стресс"))return}
  const flashback=hasGift("Plenty To Learn")&&$("all-in-flashback").checked,{count,diceRequest,scenario}=pendingAllIn,request=diceRequest?{...diceRequest,hooks:[...(diceRequest.hooks||[]),...(flashback?[{type:"advantage",ruleId:"student.plenty-to-learn",label:"Ещё многому учиться",amount:4}]:[])]}:null;pendingAllIn=null;resolveDice(count+(request?0:flashback?4:0),3,flashback?`${payment}, флэшбек +4` : payment,request,scenario);renderAllInControls();if(store.mode==="play")renderPlay();
}
function renderDiceHistory(){const context=toolsSyncContext(),history=context.shared?(Scene.rollFeed||[]):S.runtime.diceHistory;$("dice-history").innerHTML=context.shared?history.map(h=>`<li><strong>${esc(h.actor||"Система")}</strong><br>${esc(h.formula||"Бросок")} → ${esc(h.successes)} успех., ${esc(h.crits)} крит.${h.outcome?` · ${esc(h.outcome)}`:""}${h.target?` · цель ${h.target}`:""}</li>`).join("")||`<li>На общем столе ещё не было публичных бросков.</li>`:history.map(h=>`<li>${esc(h.at)} · ${h.allIn?"Ва-банк · ":""}${esc(h.count)}D6 → ${esc(h.successes)} успех., ${esc(h.crits)} крит. · ${esc(h.outcome)}${h.target?` (цель ${h.target})`:""}</li>`).join("")}
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
  const gifts=D.outlooks.flatMap(outlook=>(outlook.builtin?[outlook.builtin]:[]).concat(outlook.gifts).filter(gift=>mentionsBond(gift.text)).map(gift=>({id:gift.id,name:gift.name,source:`Дар · ${outlook.name}`,text:gift.text})));
  const techniques=D.archetypes.flatMap(archetype=>archetype.techniques.flatMap(technique=>technique.levels.filter(level=>mentionsBond(level.text)).map(level=>({id:`${technique.id}.${level.n}`,name:`${technique.name} · ${level.n}: ${level.name}`,source:`Техника · ${archetype.name}`,text:level.text}))));
  return gifts.concat(techniques);
}
function renderBondReference(){
  const root=$("bond-reference-content");if(!root)return;
  const standard=D.bonds.actions.filter(action=>!action.antagonistic),antagonistic=D.bonds.actions.filter(action=>action.antagonistic),related=bondRelatedItems();
  const cards=actions=>actions.map(action=>`<article class="bond-action-card ${action.antagonistic?"antagonistic":""}"><header><span>${esc(action.tag)}</span><h3>${esc(action.name)}</h3></header><p>${md(action.text)}</p></article>`).join("");
  root.innerHTML=`<div class="bond-reference-intro">${md(D.bonds.overview)}</div><div class="bond-rule-grid"><article><h3>Теги и пределы</h3><div>${md(D.bonds.tags)}</div></article><article><h3>Быстрые Связи</h3><div>${md(D.bonds.quick)}</div></article><article><h3>Повышение Ранга</h3><div>${md(D.bonds.rankUp)}</div></article><article><h3>Цена и первое действие</h3><div>${md(D.bonds.actionsIntro)}<p>${md(D.bonds.favoredActions)}</p></div></article></div><h3 class="bond-group-title">10 стандартных действий и тегов</h3><div class="bond-action-grid">${cards(standard)}</div><section class="bond-antagonistic"><h3>Антагонистические действия</h3><p>${md(D.bonds.antagonisticIntro)}</p><div class="bond-action-grid">${cards(antagonistic)}</div></section><section class="bond-related"><header><h3>Связи в других базовых правилах</h3><span>${D.bonds.relatedRules.length}</span></header><div class="bond-related-grid">${D.bonds.relatedRules.map(item=>`<article><small>Базовое правило</small><h4>${esc(item.name)}</h4><p>${md(item.text)}</p></article>`).join("")}</div></section><section class="bond-related"><header><h3>Особенности, которые меняют правила Связей</h3><span>${related.length}</span></header><p>Здесь собраны Дары и Техники из остальных разделов книги, которые создают, усиливают, ограничивают или позволяют использовать Связи иначе.</p><div class="bond-related-grid">${related.map(item=>`<article><small>${esc(item.source)}</small><h4>${esc(item.name)}</h4><p>${md(item.text)}</p></article>`).join("")}</div></section><section class="bond-narrator"><h3>Нарратору: связанные NPC должны возвращаться</h3><div>${md(D.bonds.returningCharacters)}</div></section>`;
}
function ruleKey(value){let hash=2166136261;for(const char of String(value))hash=Math.imul(hash^char.charCodeAt(0),16777619);return(hash>>>0).toString(36)}
function ruleCardsHtml(cards,chapterId="rule"){return `<div class="rules-card-grid">${cards.map(([name,text])=>{const id=`rule-${chapterId}-${ruleKey(`${name}:${text}`)}`;return `<article id="${id}" class="rules-card"><header><h3>${esc(name)}</h3><a class="rule-permalink" href="#${id}" aria-label="Ссылка на правило «${esc(name)}»">#</a></header><div>${md(text)}</div></article>`}).join("")}</div>`}
function fieldRulesVisual(){
  const grid=(cells,classes)=>`<div class="rule-mini-grid">${cells.map((label,index)=>`<span class="${classes[index]||""}">${label}</span>`).join("")}</div>`,range=[4,3,2,3,4,3,2,1,2,3,2,1,"●",1,2,3,2,1,2,3,4,3,2,3,4],line=Array.from({length:25},(_,index)=>index===12?"●":""),lineClasses=Array.from({length:25},(_,index)=>[0,2,4,6,7,10,11,12,13,14,17,18,20,22,24].includes(index)?(index===12?"origin":"line"):""),zone=Array.from({length:25},(_,index)=>index===12?"●":""),zoneClasses=Array.from({length:25},(_,index)=>[6,7,8,11,12,13,16,17,18].includes(index)?(index===12?"origin":"zone"):"");
  return `<div class="rules-diagrams"><figure><figcaption>Манхэттенская дальность</figcaption>${grid(range,range.map(value=>value==="●"?"origin":""))}</figure><figure><figcaption>Ортогональные и диагональные Линии</figcaption>${grid(line,lineClasses)}</figure><figure><figcaption>Центрированная Зона 3 × 3</figcaption>${grid(zone,zoneClasses)}</figure><figure class="cinematic"><figcaption>Кинематографичное поле</figcaption><div class="rule-cinematic-line">${["И","И","·","·","·","В","В"].map((label,index)=>`<span class="${index<2?"hero":index>4?"enemy":""}">${label}</span>`).join("")}</div></figure></div>`;
}
function ruleMatches(query,...values){return !query||values.join(" ").toLowerCase().includes(query)}
function actionRulesHtml(query=""){
  const actions=D.actions.list.filter(action=>ruleMatches(query,action.group,action.name,action.cost||"",action.text)),positive=D.effects.positive.filter(effect=>ruleMatches(query,effect.name,effect.text)),negative=D.effects.negative.filter(effect=>ruleMatches(query,effect.name,effect.text)),groups=[...new Set(actions.map(action=>action.group))];
  return `<div class="rules-action-intro">${md(D.actions.intro||"")}</div>${groups.map(group=>`<section class="rules-subgroup"><h3>${esc(group)}</h3><div class="rules-card-grid">${actions.filter(action=>action.group===group).map(action=>{const id=`rule-action-${ruleKey(`${action.name}:${action.text}`)}`;return `<article id="${id}" class="rules-card"><header><h3>${esc(action.name)}</h3>${action.cost?`<span>${esc(action.cost)}</span>`:""}<a class="rule-permalink" href="#${id}" aria-label="Ссылка на действие «${esc(action.name)}»">#</a></header><div>${md(action.text)}</div></article>`}).join("")}</div></section>`).join("")}${positive.length?`<section class="rules-subgroup"><h3>Положительные Эффекты</h3>${ruleCardsHtml(positive.map(effect=>[effect.name,effect.text]),"positive-effect")}</section>`:""}${negative.length?`<section class="rules-subgroup"><h3>Отрицательные Эффекты</h3>${ruleCardsHtml(negative.map(effect=>[effect.name,effect.text]),"negative-effect")}</section>`:""}`;
}
function combatActionReferenceHtml(query=""){
  const actions=D.actions.list.filter(action=>ruleMatches(query,action.group,action.name,action.cost||"",action.text)),groups=[...new Set(actions.map(action=>action.group))];
  if(!actions.length)return"";
  return `<section class="combat-action-reference"><header><span class="kind">БАЗОВЫЕ ДЕЙСТВИЯ</span><h3>Все варианты прямо в разделе боя</h3><p>Атаки, защитные Реакции, движение и утилитарные действия приведены здесь полностью — переходить в другую главу не требуется.</p></header>${groups.map(group=>`<details open><summary>${esc(group)} <b>${actions.filter(action=>action.group===group).length}</b></summary><div class="rules-card-grid">${actions.filter(action=>action.group===group).map(action=>{const id=`rule-combat-action-${ruleKey(`${action.name}:${action.text}`)}`;return `<article id="${id}" class="rules-card"><header><h3>${esc(action.name)}</h3>${action.cost?`<span>${esc(action.cost)}</span>`:""}<a class="rule-permalink" href="#${id}" aria-label="Ссылка на действие «${esc(action.name)}»">#</a></header><div>${md(action.text)}</div></article>`}).join("")}</div></details>`).join("")}</section>`;
}
function rulesChapterText(chapter){
  const own=(chapter.cards||[]).flat().join(" "),special=chapter.special==="bonds"?JSON.stringify(D.bonds):chapter.special==="actions"?`${D.actions.intro} ${JSON.stringify(D.actions.list)} ${JSON.stringify(D.effects)}`:chapter.id==="combat"?JSON.stringify(D.actions.list):"";
  return `${chapter.name} ${chapter.desc} ${chapter.source||""} ${own} ${special}`.toLowerCase();
}
function renderRules(){
  const index=$("rules-index"),root=$("rules-chapters"),query=$("rules-search").value.trim().toLowerCase();if(!index||!root)return;
  const filters=[{id:"all",name:"Все"},{id:"player",name:"Игрокам"},{id:"gm",name:"Нарратору"}];
  $("rules-filters").innerHTML=filters.map(filter=>`<button type="button" class="${rulesAudience===filter.id?"on":""}" data-rules-audience="${filter.id}">${filter.name}</button>`).join("");
  const chapters=RULE_CHAPTERS.filter(chapter=>(rulesAudience==="all"||chapter.audience===rulesAudience)&&rulesChapterText(chapter).includes(query));
  index.innerHTML=chapters.map(chapter=>`<a href="#rules-${chapter.id}"><span>${esc(chapter.mark)}</span>${esc(chapter.name)}</a>`).join("");
  root.innerHTML=chapters.map((chapter,chapterIndex)=>{const headerMatch=ruleMatches(query,chapter.name,chapter.desc,chapter.source||""),cards=chapter.cards?.filter(card=>headerMatch||ruleMatches(query,...card))||[],specialQuery=headerMatch?"":query,count=chapter.cards?cards.length+(chapter.id==="combat"?D.actions.list.length:0):(chapter.special==="bonds"?D.bonds.actions.length:D.actions.list.length+D.effects.positive.length+D.effects.negative.length),visual=chapter.id==="field"&&!query?fieldRulesVisual():"",combatActions=chapter.id==="combat"?combatActionReferenceHtml(specialQuery):"",body=chapter.special==="bonds"?`<div id="bond-reference-content"></div>`:chapter.special==="actions"?actionRulesHtml(specialQuery):`${visual}${ruleCardsHtml(cards,chapter.id)}${combatActions}`;return `<details id="rules-${chapter.id}" class="rules-chapter" ${(chapterIndex===0||query)?"open":""}><summary><span>${esc(chapter.mark)}</span><div><h2>${esc(chapter.name)}</h2><p>${esc(chapter.desc)}</p></div><b>${count}</b></summary><div class="rules-chapter-body">${body}<footer class="rules-source">${esc(chapter.source||"")}</footer></div></details>`}).join("")||`<p class="rules-empty">По этому запросу правил не найдено.</p>`;
  renderBondReference();
  const target=location.hash?document.getElementById(location.hash.slice(1)):null;if(target?.matches?.(".rules-chapter"))target.open=true;else if(target?.matches?.(".rules-card"))target.closest(".rules-chapter")?.setAttribute("open","");
}

function referenceItems(){
  const items=[...RULES,...GLOSSARY,...bondRuleItems(),...D.bonds.actions.map(x=>({...x,kind:x.antagonistic?"Связь · антагонистическое действие":"Связь · действие",tags:x.tag})),...D.actions.list.map(x=>({...x,kind:"Действие"})),...D.effects.positive.map(x=>({...x,kind:"Положительный эффект"})),...D.effects.negative.map(x=>({...x,kind:"Отрицательный эффект"})),...D.archetypes.flatMap(a=>a.techniques.map(t=>({...t,kind:`Техника · ${a.name}`,text:[t.flavor,...t.levels.map(l=>`${l.n}: ${l.name} — ${l.text}`)].join("\n")}))),...D.outlooks.flatMap(o=>(o.builtin?[o.builtin]:[]).concat(o.gifts).map(g=>({...g,kind:`Дар · ${o.name}`}))),...enemyProfiles().map(enemy=>({...enemy,kind:enemy.kind==="modifier"?"Враг-Модификатор":"Враг",text:`${enemy.statsRaw}\n${enemy.examples}\n${enemy.text}`})),...(D.enemies?.antagonistTraits||[]).map(trait=>({...trait,kind:"Черта Антагониста",text:trait.rules.map(rule=>`${rule.name} (${rule.trigger}): ${rule.text}`).join("\n")}))];
  return items;
}
function renderReference(){
  const q=$("ref-search").value.trim().toLowerCase(),filters=["all","Термин","Памятка","Связь","Действие","Эффект","Техника","Дар","Враг"];
  $("ref-filters").innerHTML=filters.map(f=>`<button type="button" class="${refKind===f?"on":""}" data-ref-kind="${f}">${f==="all"?"Всё":f}</button>`).join("");
  const matchKind=item=>refKind==="all"||item.kind.toLowerCase().includes(refKind.toLowerCase()); const list=referenceItems().filter(item=>matchKind(item)&&(!q||`${item.name} ${item.en||""} ${(item.aliases||[]).join(" ")} ${item.kind} ${item.text||""} ${item.tags||""}`.toLowerCase().includes(q)));
  $("reference-list").innerHTML=list.slice(0,250).map(item=>`<article class="catalog-card"><span class="kind">${esc(item.kind)}</span><h3>${esc(item.name)}${item.cost?` · ${esc(item.cost)}`:""}</h3>${item.aliases?.length?`<div class="meta">Также: ${item.aliases.map(esc).join(" · ")}</div>`:item.tags?`<div class="meta">${esc(item.tags)}</div>`:""}<p>${md(item.text||"")}</p></article>`).join("")||`<p>Ничего не найдено.</p>`;
}

function renderAll(){renderHeroSelect();renderProfile();renderAttrs();renderOutlooks();renderBondTraining();renderSkillsAbility();renderTechniques();renderSheet();renderSidebar();if(store.mode==="play")renderPlay();if(store.mode==="tools")renderToolsWorkspace();if(store.mode==="rules")renderRules();if(store.mode==="reference")renderReference();renderChallengeRequestDock();persist();}
function initCollapsibleBuildPanels(){$$('.mode-page[data-page="build"]>.panel').forEach(panel=>{const title=panel.querySelector(':scope>.section-title');if(!title)return;panel.classList.add("build-collapsible");title.tabIndex=0;title.setAttribute("role","button");title.setAttribute("aria-expanded","true");const toggle=()=>{const collapsed=panel.classList.toggle("collapsed");title.setAttribute("aria-expanded",String(!collapsed))};title.addEventListener("click",toggle);title.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggle()}})})}
function setMode(mode){store.mode=["build","play","tools","rules","reference"].includes(mode)?mode:"build";if(store.mode!=="play")setScenePanel(null);document.body.classList.toggle("builder-mode",store.mode==="build");document.body.classList.toggle("scene-mode",store.mode==="play");document.body.classList.toggle("scene-player-view",store.mode==="play"&&activeSceneView()==="player");if(store.mode!=="tools")document.body.classList.remove("tools-narrator-mode");$$('[data-page]').forEach(p=>p.classList.toggle("active",p.dataset.page===store.mode));$$('[data-mode]').forEach(b=>b.setAttribute("aria-current",b.dataset.mode===store.mode?"page":"false"));if(store.mode==="play")renderPlay();if(store.mode==="tools")renderToolsWorkspace();if(store.mode==="rules")renderRules();if(store.mode==="reference")renderReference();renderChallengeRequestDock();persist();if(["rules","reference"].includes(store.mode)&&location.hash)requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());else window.scrollTo({top:0,behavior:"smooth"});}
