"use strict";

// Thin presentation adapter. All mechanical changes go through the same command
// boundary as a future Technique; the UI never edits the result of an operation.
const LionwingEngine = window.DAWN_LIONWING_ENGINE;
const lwActive = () => LionwingEngine.isScene(Scene);
let lwDestination = null;
const lwRules = () => activeCoreRules() || Lionwing.coreRules;
const lwActor = () => Scene.actors.find(a => a.id === Scene.selectedActor) || Scene.actors.find(a => a.id === Scene.activeActorId) || currentHeroActor();
const lwCanNarrate = () => !Sync?.state?.().sceneId || Sync.state().canNarrate;
const lwOwns = actorId => lwCanNarrate() || currentHeroActor()?.id === actorId;

function lwSubmit(actorId, payload, label = "Действие LionWing") {
  const prepared = LionwingEngine.prepare(Scene, { ...payload, actorId });
  if (!prepared.ok) { toast(prepared.errors.join(" ")); return false; }
  if(payload.kind==="attack"||prepared.scene?.pendingAction||prepared.scene?.lionwing?.choices?.length)activeDirectorTab="turn";
  return commitSceneEvents(label, prepared.events);
}

function lwStatusHtml(a) {
  const vulnerability = a.lionwing?.vulnerable ? " · Уязвим" : "";
  return `<p class="lw-status"><b>${a.hp}/${a.maxHp} ЗД</b> · ${a.ap} ОД · ${a.focus || 0} Фокуса${a.kind === "hero" || a.heroId ? ` · ${a.wounds || 0}/3 Ран${vulnerability}` : ""}${a.stepRemaining ? ` · осталось ${a.stepRemaining} кл. Шага` : ""}</p>`;
}

function lwPendingHtml() {
  const choice = Scene.lionwing?.choices?.[0];
  if (choice) {
    const owner = Scene.actors.find(a => a.id === choice.actorId), can = choice.kind==="clash-tie"?lwCanNarrate():lwOwns(choice.actorId);
    const labels = { resist: "Сопротивляться", accept: choice.kind==="clash-loss"?"Принять Атаку":"Принять выведение", reroll:"5 урона → перебросить", win:"Защитник победил",lose:"Атакующий победил",record: "Записать решение", place: "Выбрать клетку" };
    return `<section class="lw-pending"><strong>${esc(owner?.name || "Участник")}: ${esc(choice.title)}</strong>${choice.context?.text ? `<p>${esc(choice.context.text)}</p>` : ""}${can ? `${choice.options.includes("record") ? '<input data-lw-choice-note placeholder="Принятое решение" aria-label="Принятое решение">' : ""}<div class="button-row">${choice.options.map(option => `<button data-lw-choice="${option}" data-lw-choice-id="${esc(choice.id)}" data-lw-actor="${esc(choice.actorId)}">${labels[option] || esc(option)}</button>`).join("")}</div>` : "<p>Ожидается решение владельца героя.</p>"}</section>`;
  }
  const pending = Scene.pendingAction;
  if (!pending?.lionwing) return "";
  const waiting = pending.targetIds.filter(id => !Scene.actors.find(a => a.id === id)?.knockedOut && pending.responses[id]?.choice === "pending");
  return `<section class="lw-pending"><strong>${esc(pending.name)} · ${pending.damage} урона${pending.repeat > 1 ? ` × ${pending.repeat} отдельных нанесений` : ""}</strong>${waiting.map(id => { const a = Scene.actors.find(x => x.id === id); return `<div class="lw-reaction"><b>${esc(a.name)}</b>${lwOwns(id) ? `<div class="button-row">${[["take", "Принять", 0], ["block", "Блок", 2], ["dodge", "Уворот", 2], ["clash", "Столкновение", 2]].map(([key,label,cost]) => `<button data-lw-reaction="${key}" data-lw-actor="${esc(id)}" ${Number(a.focus || 0) < cost ? 'disabled title="Недостаточно Фокуса"' : ""}>${label}${cost ? ` · ${cost} Фокуса` : ""}</button>`).join("")}</div>` : " · ожидается ответ"}</div>`; }).join("")}${!waiting.length && lwCanNarrate() ? `<button class="primary" data-lw-resolve data-lw-actor="${esc(pending.actorId)}">Применить урон</button>` : ""}${lwCanNarrate() ? `<button data-lw-cancel data-lw-actor="${esc(pending.actorId)}">Прервать</button>` : ""}</section>`;
}

function lwActionsHtml(a) {
  if (!a) return "<p>Выберите участника на поле.</p>";
  const buttons = lwRules().actions.list.filter(d => d.type === "action"&&(a.kind!=="enemy"||d.id===SceneEngine.ACTION_IDS.step)).map(def => {
    const normal = LionwingEngine.actionStatus(Scene, a, def), breakout = !normal.available && Scene.lionwing?.breakout ? LionwingEngine.actionStatus(Scene, a, def, { breakout: true }) : null;
    const status = breakout?.available ? breakout : normal, reason = status.reason || "";
    return `<button data-lw-action="${esc(def.id)}" data-lw-actor="${esc(a.id)}" ${breakout?.available ? 'data-lw-breakout="true"' : ""} ${status.available && lwOwns(a.id) ? "" : "disabled"} title="${esc(reason || def.text)}"><strong>${esc(def.name)}</strong><small>${esc(reason || (breakout?.available ? "Прорыв · 1 Влияние" : status.continuation ? `Продолжить · ${a.stepRemaining} кл.` : `${status.cost} ${status.resource === "ap" ? "ОД" : "Влияния"}`))}</small></button>`;
  }).join("");
  const opportunities=(Scene.lionwing?.opportunities||[]).filter(o=>o.actorId===a.id&&lwOwns(a.id)).map(o=>`<button data-lw-punish="${esc(o.id)}" data-lw-actor="${esc(a.id)}">Наказать: ${esc(Scene.actors.find(x=>x.id===o.targetId)?.name||"цель")}</button>`).join("");
  const effects=[...lwRules().effects.positive,...lwRules().effects.negative].filter(e=>e.id!=="positive.изгнан");
  return `<section class="lw-actions" data-lw-root data-lw-actor="${esc(a.id)}">${lwStatusHtml(a)}${lwPendingHtml()}${opportunities}${(a.effects||[]).includes("positive.невидим")?`<button data-lw-invisible data-lw-actor="${esc(a.id)}">Потратить Невидимость → Исчезнуть</button>`:""}${lwDestination ? '<p class="lw-hint">Выберите клетку на поле. <button data-lw-clear-destination>Отменить выбор</button></p>' : ""}<div class="core-action-list">${buttons}</div><details><summary>Параметры действия</summary><div class="lw-fields"><label>Атрибут<select data-lw-attribute><option value="">Подобрать по действию</option><option value="body">Тело</option><option value="talent">Талант</option><option value="spirit">Дух</option><option value="mind">Разум</option></select></label><label>Фокус для Завершения<input data-lw-focus type="number" min="0" max="${Math.min(a.focus || 0, Scene.tension || 0)}" value="0"></label><label>Преимущество<input data-lw-advantage type="number" min="0" max="50" value="0"></label><label>Помеха<input data-lw-disadvantage type="number" min="0" max="50" value="0"></label><label>Импровизация<select data-lw-improvise-effect><option value="">Создать препятствие</option>${effects.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label><label>Убрать соседнее препятствие<select data-lw-remove-obstacle><option value="">Не убирать</option>${Scene.objects.filter(o=>o.type==="terrain"&&o.space===a.space).map(o=>`<option value="${esc(o.id)}">${esc(o.label||"Препятствие")}</option>`).join("")}</select></label><label><input type="checkbox" data-lw-spike>Использовать бонус по Подброшенным целям</label></div></details></section>`;
}

function lwDirectorHtml(a) {
  if (!a) return "";
  const targets = Scene.targetIds.map(id => Scene.actors.find(x => x.id === id)).filter(Boolean);
  const effects = [...lwRules().effects.positive, ...lwRules().effects.negative];
  return `<section class="director-section lw-console" data-lw-root data-lw-actor="${esc(a.id)}"><header><strong>LionWing · ${esc(a.name)}</strong><small>Источник — выбранный участник</small></header>${lwActionsHtml(a)}<div class="lw-operation"><p><b>Цели:</b> ${targets.length ? targets.map(t => esc(t.name)).join(", ") : "выберите на поле или в составе"}</p><div class="lw-fields"><label>Урон / лечение<input data-lw-amount type="number" min="0" max="9999" value="1"></label><label>Отдельных нанесений<input data-lw-repeat type="number" min="1" max="30" value="1"></label><label>Стоимость ОД<input data-lw-cost type="number" min="0" max="99" value="0"></label><label>Эффект<select data-lw-effect><option value="">Без Эффекта</option>${effects.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label><label>Срок<select data-lw-duration><option value="default">По правилу</option><option value="startTurn">До начала следующего Хода цели</option><option value="endTurn">До конца следующего Хода цели</option><option value="roundEnd">До конца Раунда</option><option value="scene">До конца Сцены</option><option value="manual">Снять вручную</option></select></label></div><div class="button-row"><button class="primary" data-lw-operation="attack">Атака → Реакции</button><button data-lw-operation="damage">Нанести урон</button><button data-lw-operation="heal">Вылечить</button><button data-lw-operation="effect">Наложить Эффект</button><button data-lw-operation="remove-effect">Снять Эффект</button></div><small>«Нанести урон» — отдельный не-Атакующий источник; для Атаки используются Реакции и Броня.</small><p data-lw-preview aria-live="polite"></p></div><details><summary>Исправить состояние</summary><div class="lw-fields"><label>Поле<select data-lw-correct-field>${[["hp","Здоровье"],["maxHp","Максимум ЗД"],["ap","ОД"],["baseAp","ОД в начале Хода"],["focus","Фокус"],["wounds","Раны"],["stress","Стресс"],["influence","Влияние"],["armor","Броня"],["evasion","Уклонение"],["speed","Скорость"],["knockedOut","Вне боя: 0 — нет, 1 — да"]].map(([key,label]) => `<option value="${key}">${label}</option>`).join("")}</select></label><label>Точное значение<input data-lw-correct-value type="number" min="0" max="9999" value="${a.hp}"></label><button data-lw-correct>Задать выбранному участнику</button></div></details><details><summary>Ресурсы, часы и временные изменения</summary><div class="lw-fields"><label>ID<input data-lw-custom-id value="custom.resource" aria-label="ID ресурса или часов"></label><label>Название<input data-lw-custom-label value="Ресурс"></label><label>Значение<input data-lw-custom-value type="number" min="0" max="9999" value="0"></label><label>Максимум / сегменты<input data-lw-custom-size type="number" min="1" max="9999" value="4"></label></div><div class="button-row"><button data-lw-custom="configure-resource">Задать ресурс</button><button data-lw-custom="spend">Потратить ресурс</button><button data-lw-custom="gain">Получить ресурс</button><button data-lw-custom="clock">Задать часы</button></div><div class="lw-fields"><label>Показатель<select data-lw-mod-stat><option value="armor">Броня</option><option value="evasion">Уклонение</option><option value="speed">Скорость</option></select></label><label>Изменение<input data-lw-mod-amount type="number" min="-9999" max="9999" value="1"></label><button data-lw-modifier>До конца следующего Хода цели</button></div></details></section>`;
}

const lwOldActionPanel = sceneActionPanel;
sceneActionPanel = function(actorOverride = null) { return lwActive() ? lwActionsHtml(actorOverride || currentHeroActor()) : lwOldActionPanel(actorOverride); };
const lwOldDirector = renderSceneDirector;
renderSceneDirector = function() {
  lwOldDirector();
  if (!lwActive()) return;
  const root = $("scene-director"), a = lwActor();
  if (!root || !a) return;
  const holder=document.createElement("div");holder.innerHTML=lwDirectorHtml(a);
  const consoleNode=holder.firstElementChild,actions=consoleNode.querySelector(".lw-actions"),turnPane=root.querySelector('[data-director-pane="turn"]'),manualPane=root.querySelector('[data-director-pane="manual"]');
  if(turnPane&&manualPane){turnPane.append(actions);manualPane.prepend(consoleNode);}
  else root.prepend(consoleNode);
  // Keep library, clocks, reminders, media and table tools in their established place.
  for (const element of root.querySelectorAll(".director-resource-row.health, .director-outcome, .director-exact-grid")) if (!element.closest(".lw-console")) element.hidden = true;
  for (const element of root.querySelectorAll(".director-outcome-options")) element.textContent = "Точные изменения записываются как исправления. Для игровых действий используйте операции LionWing выше.";
};

const lwOldEventText = eventText;
eventText = function(event) {
  if (!lwActive()) return lwOldEventText(event);
  const p = event.payload || {}, a = Scene.actors.find(x => x.id === (p.targetId || event.actorId));
  if (p.correction) return `${a?.name || "Участник"}: исправлено ${p.resource}, ${p.before} → ${p.value}`;
  if (event.type === "actor.wound") return `${a?.name}: Раны ${p.total}/3, ЗД восстановлено до ${p.hp}`;
  if (event.type === "rule.respond") return `${a?.name || "Нарратор"}: ${p.note || p.title || p.choice || "решение"}`;
  if (event.type === "action.resolve") return `${a?.name || "Участник"}: ${lwRules().actions.list.find(d => d.id === p.actionId)?.name || p.name}`;
  return lwOldEventText(event);
};

const lwOldSetValue = setNarratorActorValue;
setNarratorActorValue = function(a,key,value,label) { return lwActive() ? lwSubmit(a.id, { kind: "correct", resource: key, amount: value }, label || "Исправление Нарратора") : lwOldSetValue(a,key,value,label); };
const lwOldSetEffect = setNarratorEffect;
setNarratorEffect = function(a,effect,remove) { return lwActive() ? lwSubmit(a.id, { kind: "effect", effect, remove }, "Эффект LionWing") : lwOldSetEffect(a,effect,remove); };
const lwOldOverride=applyNarratorOverride;
applyNarratorOverride=function(request){if(!lwActive())return lwOldOverride(request);const a=lwActor(),operations=[];for(const target of request.targets||[]){if(request.damage)operations.push({kind:"damage",targetId:target.id,amount:request.damage});if(request.effectId)operations.push({kind:"effect",targetId:target.id,effect:request.effectId});}if(request.note)operations.push({kind:"note",note:request.note});return a&&operations.length?lwSubmit(a.id,{kind:"batch",operations},"Результат действия"):false;};
const lwOldForceRound = forceNarratorRound;
forceNarratorRound = function() { return lwActive() ? commitSceneEvents("Конец Раунда", [{type:"round.end",actorId:null,payload:{}}]) : lwOldForceRound(); };
const lwOldForceTurn = forceNarratorTurn;
forceNarratorTurn = function(a) { return lwActive() ? setActorTurn(a) : lwOldForceTurn(a); };
const lwOldTakeWound = takeWound;
takeWound = function(external) { const a=currentHeroActor();return lwActive()&&a?lwSubmit(a.id,{kind:"wound",targetId:a.id,sourceActorId:external?null:a.id},"Рана"):lwOldTakeWound(external); };
const lwOldBoardMove = moveSceneActorFromBoard;
moveSceneActorFromBoard = function(a,x,y,options={}) {
  if (!lwActive()) return lwOldBoardMove(a,x,y,options);
  if (!lwOwns(a.id)) return toast("Можно перемещать только своего героя");
  if (a.x === x && a.y === y) return;
  if (!Scene.lionwing?.started) return commitSceneEvents("Развёртывание", [{ type:"actor.move", actorId:a.id, payload:{space:Scene.activeSpace,x,y,placement:true,movement:"Развертывание"} }]);
  if (options.manual || Scene.tool === "place") { if (!lwCanNarrate()) return toast("Ручная перестановка доступна Нарратору"); return lwSubmit(a.id,{kind:"move",destination:{space:Scene.activeSpace,x,y},placement:true},"Ручная перестановка"); }
  return lwSubmit(a.id,{kind:"action",actionId:SceneEngine.ACTION_IDS.step,destination:{x,y}},"Шаг");
};

document.addEventListener("click", event => {
  if (!lwActive()) return;
  const cell = event.target.closest("[data-scene-cell]");
  if (lwDestination && cell) {
    event.preventDefault(); event.stopImmediatePropagation();
    const point = cell.dataset.sceneCell.split(",").map(Number), draft = lwDestination;
    const destination = { x:point[0], y:point[1], space:Scene.activeSpace };
    const payload={...draft.payload,[draft.field||"destination"]:destination};
    if(draft.field==="reappearance"&&[SceneEngine.ACTION_IDS.jump,SceneEngine.ACTION_IDS.shove,SceneEngine.ACTION_IDS.improvise].includes(payload.actionId)&&!payload.effect){lwDestination={actorId:draft.actorId,payload,label:draft.label};toast("Теперь выберите клетку действия");return;}
    if (lwSubmit(draft.actorId,payload,draft.label)) { lwDestination=null; renderScene(); }
    return;
  }
  const legacyAction=event.target.closest("[data-core-action], [data-core-resolve], [data-core-cancel-pending]");
  if(legacyAction){event.preventDefault();event.stopImmediatePropagation();const a=currentHeroActor()||lwActor();if(!a)return;if(legacyAction.hasAttribute("data-core-action"))return lwSubmit(a.id,{kind:"action",actionId:legacyAction.dataset.coreAction,targetIds:[...Scene.targetIds]},"Базовое действие");if(!lwCanNarrate())return;return lwSubmit(Scene.pendingAction?.actorId||a.id,{kind:legacyAction.hasAttribute("data-core-resolve")?"resolve-attack":"cancel-attack"},"Разрешение Атаки");}
  const button = event.target.closest("[data-lw-action], [data-lw-reaction], [data-lw-choice], [data-lw-resolve], [data-lw-cancel], [data-lw-clear-destination], [data-lw-operation], [data-lw-correct], [data-lw-custom], [data-lw-modifier], [data-lw-punish], [data-lw-invisible]");
  if (!button) {
    const oldControl=event.target.closest("[data-director-set-field], [data-director-knockout], [data-director-tension], [data-director-open-reactions], [data-director-set-rule-resource], [data-director-set-rule-clock]");
    if(oldControl){event.preventDefault();event.stopImmediatePropagation();const a=lwActor();if(!a||!lwCanNarrate())return;
      if(oldControl.hasAttribute("data-director-tension"))return lwSubmit(a.id,{kind:"tension",amount:Math.max(0,Scene.tension+Number(oldControl.dataset.directorTension))},"Напряжение");
      if(oldControl.hasAttribute("data-director-knockout"))return lwSubmit(a.id,{kind:"correct",resource:"knockedOut",amount:oldControl.dataset.directorKnockout==="restore"?0:1},"Исправление участия в бою");
      if(oldControl.hasAttribute("data-director-open-reactions"))return lwSubmit(a.id,{kind:"attack",targetIds:[...Scene.targetIds],amount:Number($("scene-director-outcome-damage")?.value||0)},"Ручная Атака");
      if(oldControl.hasAttribute("data-director-set-field")){const key=oldControl.dataset.directorSetField,input=$("scene-director").querySelector(`[data-director-field-input="${CSS.escape(key)}"]`);return lwSubmit(a.id,{kind:"correct",resource:key.replace("attr.",""),amount:Number(input?.value)},"Исправление параметра");}
      if(oldControl.hasAttribute("data-director-set-rule-resource")){const id=oldControl.dataset.directorSetRuleResource,input=$("scene-director").querySelector(`[data-director-rule-resource-input="${CSS.escape(id)}"]`),def=a.ruleResources?.[id];return lwSubmit(a.id,{kind:"configure-resource",id,label:def?.label,value:Number(input?.value),maximum:def?.maximum||9999},"Исправление ресурса");}
      const id=oldControl.dataset.directorSetRuleClock,input=$("scene-director").querySelector(`[data-director-rule-clock-input="${CSS.escape(id)}"]`),def=a.ruleClocks?.[id];return lwSubmit(a.id,{kind:"clock",id,label:def?.label,value:Number(input?.value),size:def?.size||4},"Исправление часов");
    }
    // Legacy shortcuts become the same typed operations, not direct HP mutation.
    const damage = event.target.closest("[data-director-damage], [data-director-heal]");
    if (damage) { event.preventDefault(); event.stopImmediatePropagation(); const a=lwActor(); if(a&&lwCanNarrate())lwSubmit(a.id,{kind:damage.hasAttribute("data-director-damage")?"damage":"heal",targetId:a.id,amount:Number(damage.dataset.directorDamage||damage.dataset.directorHeal),sourceActorId:null},"Здоровье LionWing"); }
    return;
  }
  event.preventDefault(); event.stopImmediatePropagation();
  const root = button.closest("[data-lw-root]") || button.closest(".lw-console"), actorId = button.dataset.lwActor || root?.dataset.lwActor || lwActor()?.id;
  if (!actorId || !lwOwns(actorId)) return toast("Этим участником управляет другой игрок");
  const val = (selector, fallback="") => root?.querySelector(selector)?.value ?? fallback;
  const num = (selector, fallback=0) => Number(val(selector,fallback));
  if(button.hasAttribute("data-lw-punish"))return lwSubmit(actorId,{kind:"punish",id:button.dataset.lwPunish},"Наказание");
  if(button.hasAttribute("data-lw-invisible"))return lwSubmit(actorId,{kind:"invisible"},"Исчезновение");
  if (button.hasAttribute("data-lw-clear-destination")) { lwDestination=null; renderScene(); return; }
  if (button.hasAttribute("data-lw-action")) {
    const actionId=button.dataset.lwAction, payload={kind:"action",actionId,targetIds:[...Scene.targetIds],breakout:button.dataset.lwBreakout==="true",focusSpent:num("[data-lw-focus]"),advantage:num("[data-lw-advantage]"),disadvantage:num("[data-lw-disadvantage]")};
    if(val("[data-lw-attribute]"))payload.attribute=val("[data-lw-attribute]");
    if(root?.querySelector("[data-lw-spike]")?.checked)payload.spikeTargetIds=[...Scene.targetIds];
    if(actionId===SceneEngine.ACTION_IDS.improvise){if(val("[data-lw-improvise-effect]"))payload.effect=val("[data-lw-improvise-effect]");if(val("[data-lw-remove-obstacle]"))payload.removeObstacleId=val("[data-lw-remove-obstacle]");}
    const name=lwRules().actions.list.find(d=>d.id===actionId)?.name||"Действие";
    if((Scene.actors.find(a=>a.id===actorId)?.effects||[]).includes("positive.исчез")){lwDestination={actorId,payload,label:name,field:"reappearance"};toast("Сначала выберите клетку появления");return;}
    if([SceneEngine.ACTION_IDS.jump,SceneEngine.ACTION_IDS.shove,SceneEngine.ACTION_IDS.improvise].includes(actionId)&&!payload.effect){lwDestination={actorId,payload,label:name};toast("Выберите клетку на поле");return;}
    lwSubmit(actorId,payload,name); return;
  }
  if (button.hasAttribute("data-lw-reaction")) { const payload={kind:"reaction",choice:button.dataset.lwReaction};if(payload.choice==="dodge"){lwDestination={actorId,payload,label:"Уворот"};toast("Выберите клетку Уворота");return;} lwSubmit(actorId,payload,"Реакция");return; }
  if (button.hasAttribute("data-lw-choice")) { const payload={kind:"choice",id:button.dataset.lwChoiceId,choice:button.dataset.lwChoice,note:button.closest(".lw-pending")?.querySelector("[data-lw-choice-note]")?.value||""};if(payload.choice==="place"){lwDestination={actorId,payload,label:"Появление"};toast("Выберите клетку на поле");return;}lwSubmit(actorId,payload,"Решение игрока");return; }
  if (button.hasAttribute("data-lw-resolve") || button.hasAttribute("data-lw-cancel")) { if(!lwCanNarrate())return;lwSubmit(actorId,{kind:button.hasAttribute("data-lw-resolve")?"resolve-attack":"cancel-attack"},"Разрешение Атаки");return; }
  if (!lwCanNarrate()) return toast("Эта операция доступна Нарратору");
  if (button.hasAttribute("data-lw-correct")) { lwSubmit(actorId,{kind:"correct",resource:val("[data-lw-correct-field]"),amount:num("[data-lw-correct-value]")},"Исправление состояния");return; }
  if (button.hasAttribute("data-lw-custom")) { const kind=button.dataset.lwCustom,id=val("[data-lw-custom-id]"),value=num("[data-lw-custom-value]");lwSubmit(actorId,["spend","gain"].includes(kind)?{kind:"resource",operation:kind,resource:id,amount:value}:{kind,id,label:val("[data-lw-custom-label]"),value,size:num("[data-lw-custom-size]"),maximum:num("[data-lw-custom-size]")},"Ресурс / часы");return; }
  if (button.hasAttribute("data-lw-modifier")) { const targets=Scene.targetIds.length?Scene.targetIds:[actorId];lwSubmit(actorId,{kind:"batch",operations:targets.map(targetId=>({kind:"modifier",targetId,stat:val("[data-lw-mod-stat]"),amount:num("[data-lw-mod-amount]"),duration:"endTurn"}))},"Временный модификатор");return; }
  if (button.hasAttribute("data-lw-operation")) {
    const kind=button.dataset.lwOperation,targets=[...Scene.targetIds],amount=num("[data-lw-amount]"),repeat=num("[data-lw-repeat]",1),effect=val("[data-lw-effect]"),duration=val("[data-lw-duration]","default"),cost=num("[data-lw-cost]");
    if(!targets.length)return toast("Выберите цели на поле или в составе");
    if(kind==="attack")return lwSubmit(actorId,{kind,amount,repeat,targetIds:targets,effects:effect?[{effect,...(duration!=="default"?{duration}:{})}]:[],cost:{resource:"ap",amount:cost}},"Ручная Атака");
    const operations=cost?[{kind:"resource",resource:"ap",operation:"spend",amount:cost}]:[];
    if(["effect","remove-effect"].includes(kind)&&!effect)return toast("Выберите Эффект");
    if(!Number.isInteger(repeat)||repeat<1||repeat>30)return toast("Повторы: от 1 до 30");
    for(let i=0;i<(kind==="damage"?repeat:1);i++)for(const targetId of targets)operations.push(kind.includes("effect")?{kind:"effect",targetId,effect,remove:kind==="remove-effect",...(duration!=="default"?{duration}:{})}:{kind,targetId,amount,...(effect?{effects:[{effect,...(duration!=="default"?{duration}:{})}]}:{})});
    lwSubmit(actorId,{kind:"batch",operations},"Результат действия");
  }
},true);

document.addEventListener("input",event=>{
  const root=event.target.closest(".lw-console");if(!root||!lwActive())return;
  const output=root.querySelector("[data-lw-preview]");if(!output)return;
  const amount=Number(root.querySelector("[data-lw-amount]")?.value||0),actorId=root.dataset.lwActor;
  const operations=Scene.targetIds.map(targetId=>({kind:"damage",targetId,amount}));if(!operations.length){output.textContent="Выберите цели для предпросмотра.";return;}
  const preview=LionwingEngine.previewEvents(Scene,[LionwingEngine.command(actorId,{kind:"batch",operations})]);
  output.textContent=preview.ok?Scene.targetIds.map(id=>{const before=Scene.actors.find(a=>a.id===id),after=preview.scene.actors.find(a=>a.id===id);return`${before.name}: ${before.hp} → ${after.hp} ЗД${after.wounds!==before.wounds?`, Раны ${after.wounds}/3`:""}`;}).join(" · ")+(preview.scene.lionwing.choices.length?" · потребуется решение игрока":""):preview.errors.join(" ");
});
