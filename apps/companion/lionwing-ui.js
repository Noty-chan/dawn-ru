"use strict";

// Thin presentation adapter. All mechanical changes go through the same command
// boundary as a future Technique; the UI never edits the result of an operation.
const LionwingEngine = window.DAWN_LIONWING_ENGINE;
const lwActive = () => LionwingEngine.isScene(Scene);
let lwDestination = null;
const lwRules = () => localizedLionwingCoreRules();
const lwActor = () => Scene.actors.find(a => a.id === Scene.selectedActor) || Scene.actors.find(a => a.id === Scene.activeActorId) || currentHeroActor();
const lwCanNarrate = () => !Sync?.state?.().sceneId || Sync.state().canNarrate;
const lwOwns = actorId => lwCanNarrate() || currentHeroActor()?.id === actorId;
const lwFormDraft = new Map();
const lwDraftKey=input=>{const attr=[...input.attributes].find(attr=>attr.name.startsWith("data-lw-"));return attr?attr.name+(attr.value?":"+attr.value:""):null;};
let lwDraftEnabled=false,lwDraftBatch=null;

function lwOperationSummary(p){
  const names={attack:"Атака",damage:"Урон",heal:"Лечение",effect:p.remove?"Снять Эффект":"Наложить Эффект",resource:p.operation==="spend"?"Расход":"Получение",move:"Движение",wound:"Рана",stress:"Стресс",modifier:"Модификатор",usage:"Учесть применение","record-action":"Базовое действие","recover-track":"Восстановление Ран/Стресса",prompt:"Решение",note:"Запись", "grant-turn":"Дополнительный Ход","allow-action":"Допуск действия"};
  const ids=p.targetIds||[p.targetId||lwDraftBatch?.actorId],targets=ids.map(id=>Scene.actors.find(a=>a.id===id)?.name||id).join(", ");
  const detail=[p.amount!=null?String(p.amount):"",p.resource||"",p.effect?([...lwRules().effects.positive,...lwRules().effects.negative].find(e=>e.id===p.effect)?.name||p.effect):"",p.duration||"",p.destination?`${p.destination.x+1}, ${p.destination.y+1}`:"",p.note||p.title||""].filter(Boolean).join(" · ");
  return `${names[p.kind]||p.kind} → ${targets}${detail?": "+detail:""}`;
}

function lwBatchHtml(){
  const draft=lwDraftBatch,actor=Scene.actors.find(a=>a.id===draft?.actorId);
  return `<details class="lw-batch" ${draft?"open":""}><summary>Составной ручной пакет${draft?` · ${draft.operations.length} операций`:""}</summary>
    <label><input type="checkbox" data-lw-stage ${lwDraftEnabled?"checked":""}>Собирать операции перед применением</label>
    <p>Добавляйте урон, Эффекты, ресурсы и общие операции кнопками ниже. До применения состояние не меняется.</p>
    ${draft?`<p>Источник: ${esc(actor?.name||draft.actorId)}</p><ol>${draft.operations.map(operation=>`<li>${esc(lwOperationSummary(operation))}</li>`).join("")}</ol><div class="button-row"><button data-lw-batch-apply>Применить пакет</button><button data-lw-batch-clear>Отменить пакет</button></div>`:""}</details>`;
}

function lwChainHtml(a){return lwCanNarrate()?`<div class="button-row">${Scene.pendingAction||Scene.lionwing?.choices?.length?`<button data-lw-chain="pause-chain" data-lw-actor="${esc(a.id)}">Приостановить цепочку для ручного правила</button>`:""}${Scene.lionwing?.pausedChains?.length?`<button data-lw-chain="resume-chain" data-lw-actor="${esc(a.id)}">Возобновить цепочку (${Scene.lionwing.pausedChains.length})</button>`:""}</div>`:"";}

function lwGeneralHtml(){
  return `<details class="lw-general"><summary>Общие операции правила</summary><div class="lw-fields">
    <label>Операция<select data-lw-general-kind><option value="resource">Ресурс</option><option value="roll">Ручной бросок XD6</option><option value="record-action">Учесть ручное базовое действие и стоимость</option><option value="wound">Получить Рану</option><option value="stress">Получить Стресс</option><option value="recover-track">Вылечить Раны / снять Стресс</option><option value="move">Движение</option><option value="search">Найти Исчезнувшего противника — 2 ОД</option><option value="grant-turn">Дополнительный Ход</option><option value="allow-action">Допуск действия</option><option value="usage">Учесть применение правила</option><option value="prompt">Запросить решение</option><option value="note">Запись в журнал</option></select></label>
    <label>Количество / дальность / лимит<input data-lw-general-amount type="number" min="0" max="9999" value="1"></label>
    <label>Критический успех<select data-lw-general-crit><option value="6">6</option><option value="5">5 или 6</option></select></label><label><input type="checkbox" data-lw-general-explode checked>Дополнительная кость за Крит</label><label>Результаты костей вручную (необязательно)<input data-lw-general-dice placeholder="Например: 4 2 6 3"></label>
    <label>Что восстановить<select data-lw-general-track><option value="wounds">Раны</option><option value="stress">Стресс</option></select></label>
    <label>Ресурс<select data-lw-general-resource><option value="ap">ОД</option><option value="focus">Фокус (с заменой)</option><option value="influence">Влияние</option></select></label>
    <label>Изменение<select data-lw-general-direction><option value="spend">Потратить</option><option value="gain">Получить</option></select></label>
    <label>Способ движения<select data-lw-general-movement><option value="normal">Добровольное</option><option value="forced">Принудительное</option><option value="teleport">Телепортация</option></select></label>
    <label><input type="checkbox" data-lw-general-ignore-opponents>Проходить сквозь противников</label><label><input type="checkbox" data-lw-general-ignore-terrain>Игнорировать местность</label><label><input type="checkbox" data-lw-general-line>Движение по Линии</label>
    <label>Действие<select data-lw-general-action>${lwRules().actions.list.filter(a=>a.type==="action").map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</select></label>
    <label>Стоимость допущенного действия<input data-lw-general-cost type="number" min="0" value="0"></label>
    <label><input data-lw-general-swift type="checkbox" checked>Быстрое действие</label>
    <label><input data-lw-general-reaction type="checkbox">Разрешить действие как Реакцию вне своего Хода</label><label>Область лимита<select data-lw-general-scope><option value="turn">Ход</option><option value="round">Раунд</option><option value="scene">Сцена</option></select></label>
    <label>ID правила<input data-lw-general-id value="manual.rule"></label>
    <label>Решение / пояснение<textarea data-lw-general-note rows="2"></textarea></label>
    <button data-lw-general-submit>Применить к целям (или источнику)</button>
  </div></details>`;
}

function lwSubmit(actorId, payload, label = "Действие LionWing") {
  if(lwDraftEnabled&&["batch","attack","damage","heal","effect","move","resource","modifier","wound","stress","recover-track","record-action","allow-action","grant-turn","usage","note","prompt"].includes(payload.kind)){
    if(!lwCanNarrate())return false;
    if(lwDraftBatch&&lwDraftBatch.actorId!==actorId){toast("Сначала примените или отмените пакет прежнего источника");return false;}
    const operations=payload.kind==="batch"?payload.operations:[payload];
    if((lwDraftBatch?.operations.length||0)+operations.length>192){toast("Пакет ограничен 192 операциями");return false;}
    lwDraftBatch||={actorId,operations:[],labels:[]};lwDraftBatch.operations.push(...structuredClone(operations));
    lwDraftBatch.labels.push(`${label}: ${operations.length} операций`);renderScene();return true;
  }
  // A player's public snapshot intentionally has no authoritative continuation.
  // Send the selected option; the Narrator validates and resumes its saved frame.
  if (!lwCanNarrate() && payload.kind === "choice" && ["replacement","rule-trigger"].includes(Scene.lionwing?.choices?.[0]?.kind)) {
    const pending = Scene.lionwing.choices[0];
    if (!lwOwns(actorId) || pending.actorId !== actorId || pending.id !== payload.id || !pending.options.includes(payload.choice)) return false;
    return commitSceneEvents(label, [LionwingEngine.command(actorId, { kind: "choice", id: payload.id, choice: payload.choice })]);
  }
  const prepared = LionwingEngine.prepare(Scene, { ...payload, actorId });
  if (!prepared.ok) { toast(prepared.errors.join(" ")); return false; }
  if(payload.kind==="attack"||prepared.scene?.pendingAction||prepared.scene?.lionwing?.choices?.length)activeDirectorTab="turn";
  return commitSceneEvents(label, prepared.events);
}

function lwStatusHtml(a) {
  const vulnerability = a.lionwing?.vulnerable ? " · Уязвим" : "", focusLabel=Object.values(a.ruleResources||{}).find(r=>r.replaces==="focus")?.label||"Фокус";
  return `<p class="lw-status"><b>${a.hp}/${a.maxHp} ЗД</b> · ${a.ap} ОД · ${LionwingEngine.balance(a,"focus")} ${esc(focusLabel)}${a.kind === "hero" || a.heroId ? ` · ${a.wounds || 0}/3 Ран${vulnerability}` : ""}${a.stepRemaining ? ` · осталось ${a.stepRemaining} кл. Шага` : ""}</p>`;
}

function lwPendingHtml() {
  const choice = Scene.lionwing?.choices?.[0];
  if (choice) {
    const owner = Scene.actors.find(a => a.id === choice.actorId), can = ["clash-tie","duel-outcome","duel-wounds"].includes(choice.kind)?lwCanNarrate():lwOwns(choice.actorId);
    const duel=choice.kind==="duel-outcome"?Scene.lionwing.duels.find(item=>item.id===choice.context.duelId):null;
    const duelControls=duel&&can?`<label>Напряжение Дуэли<input type="number" min="0" max="999" data-lw-duel-tension value="${duel.tension}"></label><button data-lw-set-duel-tension="${esc(duel.id)}" data-lw-actor="${esc(choice.actorId)}">Задать Напряжение Дуэли</button><p>Подходы и ресурсы разрешите до определения победителя. Используйте панель бросков и общие операции ресурсов; Напряжение исходного боя сохраняется.</p>`:"";
    const labels = { keep:"Применить Эффект", "bail":"Отступить — без ставки", "take-it":"Принять удар — вернуть Влияние", "double-down":"Удвоить ставку — переброс", "one-wound":"1 Рана (стр. 38)", "two-wounds":"2 Раны (стр. 62)", resist: "Сопротивляться", accept: choice.kind==="clash-loss"?"Принять Атаку":"Принять выведение", reroll:"5 урона → перебросить", win:choice.kind==="duel-outcome"?"Инициатор победил":"Защитник победил",lose:choice.kind==="duel-outcome"?"Инициатор проиграл":"Атакующий победил",record: "Записать решение", place: "Выбрать клетку" };
    return `<section class="lw-pending"><strong>${esc(owner?.name || "Участник")}: ${esc(choice.kind==="duel-wounds"?"Продолжить сохранённую Дуэль: 1 Рана по уточнению автора":choice.title)}</strong>${duelControls}${choice.kind==="replacement"?`<p>${esc([...lwRules().effects.positive,...lwRules().effects.negative].find(e=>e.id===choice.context.effect)?.name||choice.context.effect)}. Исходный Эффект ещё не наложен.</p>`:""}${choice.context?.text ? `<p>${esc(choice.context.text)}</p>` : ""}${can ? `${choice.options.includes("record") ? '<input data-lw-choice-note placeholder="Принятое решение" aria-label="Принятое решение">' : ""}<div class="button-row">${(choice.kind==="duel-wounds"?["one-wound"]:choice.options).map(option => `<button data-lw-choice="${option}" data-lw-choice-id="${esc(choice.id)}" data-lw-actor="${esc(choice.actorId)}">${esc(choice.context?.labels?.[option] || labels[option] || option)}</button>`).join("")}</div>` : "<p>Ожидается решение владельца героя.</p>"}</section>`;
  }
  const pending = Scene.pendingAction;
  if (!pending?.lionwing) return "";
  const waiting = SceneEngine.pendingActionStatus(Scene).waitingIds;
  return `<section class="lw-pending"><strong>${esc(pending.name)} · ${pending.damage} урона${pending.repeat > 1 ? ` × ${pending.repeat} отдельных нанесений` : ""}</strong>${waiting.map(id => { const a = Scene.actors.find(x => x.id === id); return `<div class="lw-reaction"><b>${esc(a.name)}</b>${lwOwns(id) ? `<div class="button-row">${[["take", "Принять", 0], ["block", "Блок", 2], ["dodge", "Уворот", 2], ["clash", "Столкновение", 2]].map(([key,label,cost]) => `<button data-lw-reaction="${key}" data-lw-actor="${esc(id)}" ${!LionwingEngine.canSpend(a,"focus",cost) ? 'disabled title="Недостаточно Фокуса"' : ""}>${label}${cost ? ` · ${cost} Фокуса` : ""}</button>`).join("")}</div>` : " · ожидается ответ"}</div>`; }).join("")}${!waiting.length && lwCanNarrate() ? `<button class="primary" data-lw-resolve data-lw-actor="${esc(pending.actorId)}">Применить урон</button>` : ""}${lwCanNarrate() ? `<button data-lw-cancel data-lw-actor="${esc(pending.actorId)}">Прервать</button>` : ""}</section>`;
}

function lwAutomationHtml(a) {
  const rules = window.DAWN_LIONWING_ADAPTERS.list(a);
  if (!rules.length) return "";
  return `<details><summary>Автоматизация Техник</summary><p>Включайте только те правила, которые хотите разыгрывать автоматически. Остальные Уровни остаются ручными.</p>${rules.map(rule => {
    const enabled = a.lionwing?.automation?.[rule.id] === true;
    return `<p>${esc(rule.label)} · ${enabled ? "включено" : "вручную"}${lwCanNarrate() ? ` <button data-lw-automation="${esc(rule.id)}" data-lw-actor="${esc(a.id)}" data-lw-enabled="${!enabled}">${enabled ? "Выключить" : "Включить"}</button>` : ""}</p>`;
  }).join("")}</details>`;
}

function lwActionsHtml(a) {
  if (!a) return "<p>Выберите участника на поле.</p>";
  const buttons = lwRules().actions.list.filter(d => d.type === "action"&&(a.kind!=="enemy"||d.id===SceneEngine.ACTION_IDS.step)).map(def => {
    const normal = LionwingEngine.actionStatus(Scene, a, def), breakout = !normal.available && Scene.lionwing?.breakout ? LionwingEngine.actionStatus(Scene, a, def, { breakout: true }) : null;
    const status = breakout?.available ? breakout : normal, reason = status.reason || "";
    return `<button data-lw-action="${esc(def.id)}" data-lw-actor="${esc(a.id)}" ${breakout?.available ? 'data-lw-breakout="true"' : ""} ${status.available && lwOwns(a.id) ? "" : "disabled"} title="${esc(reason || def.text)}"><strong>${esc(def.name)}</strong><small>${esc(reason || (breakout?.available ? "Прорыв · 1 Влияние" : status.continuation ? `Продолжить · ${a.stepRemaining} кл.` : `${status.cost} ${status.resource === "ap" ? "ОД" : "Влияния"}`))}</small></button>`;
  }).join("");
  const opportunities=(Scene.lionwing?.opportunities||[]).filter(o=>o.actorId===a.id&&lwOwns(a.id)).map(o=>`<button data-lw-punish="${esc(o.id)}" data-lw-actor="${esc(a.id)}" ${!LionwingEngine.canSpend(a,"focus",2)?"disabled":""}>Наказать · 2 Фокуса: ${esc(Scene.actors.find(x=>x.id===o.targetId)?.name||"цель")}</button>`).join("");
  const effects=[...lwRules().effects.positive,...lwRules().effects.negative].filter(e=>e.id!=="positive.изгнан");
  return `<section class="lw-actions" data-lw-root data-lw-actor="${esc(a.id)}">${lwStatusHtml(a)}${lwAutomationHtml(a)}${lwPendingHtml()}${lwChainHtml(a)}${opportunities}${(a.effects||[]).includes("positive.невидим")?`<button data-lw-invisible data-lw-actor="${esc(a.id)}">Потратить Невидимость → Исчезнуть</button>`:""}${lwDestination ? '<p class="lw-hint">Выберите клетку на поле. <button data-lw-clear-destination>Отменить выбор</button></p>' : ""}<div class="core-action-list">${buttons}</div><details><summary>Параметры действия</summary><div class="lw-fields"><label>Атрибут<select data-lw-attribute><option value="">Подобрать по действию</option><option value="body">Тело</option><option value="talent">Талант</option><option value="spirit">Дух</option><option value="mind">Разум</option></select></label><label>Фокус для Завершения<input data-lw-focus type="number" min="0" max="${Math.min(Object.values(a.ruleResources||{}).some(r=>r.replaces==="focus"&&r.inverted)?Scene.tension||0:LionwingEngine.balance(a,"focus"), Scene.tension || 0)}" value="0"></label><label>Преимущество<input data-lw-advantage type="number" min="0" max="50" value="0"></label><label>Помеха<input data-lw-disadvantage type="number" min="0" max="50" value="0"></label><label>Импровизация<select data-lw-improvise-effect><option value="">Создать препятствие</option>${effects.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label><label>Убрать соседнее препятствие<select data-lw-remove-obstacle><option value="">Не убирать</option>${Scene.objects.filter(o=>o.type==="terrain"&&o.space===a.space).map(o=>`<option value="${esc(o.id)}">${esc(o.label||"Препятствие")}</option>`).join("")}</select></label><label><input type="checkbox" data-lw-spike>Использовать бонус по Подброшенным целям</label></div></details></section>`;
}

function lwDirectorHtml(a) {
  if (!a) return "";
  const targets = Scene.targetIds.map(id => Scene.actors.find(x => x.id === id)).filter(Boolean);
  const effects = [...lwRules().effects.positive, ...lwRules().effects.negative];
  return `<section class="director-section lw-console" data-lw-root data-lw-actor="${esc(a.id)}"><header><strong>LionWing · ${esc(a.name)}</strong><small>Источник — выбранный участник</small></header>${lwActionsHtml(a)}<div class="lw-operation"><p><b>Цели:</b> ${targets.length ? targets.map(t => esc(t.name)).join(", ") : "выберите на поле или в составе"}</p><div class="lw-fields"><label>Урон / лечение<input data-lw-amount type="number" min="0" max="9999" value="1"></label><label>Отдельных нанесений<input data-lw-repeat type="number" min="1" max="30" value="1"></label><label>Стоимость ОД<input data-lw-cost type="number" min="0" max="99" value="0"></label><label>Эффект<select data-lw-effect><option value="">Без Эффекта</option>${effects.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label><label>Срок<select data-lw-duration><option value="default">По правилу</option><option value="startTurn">До начала следующего Хода цели</option><option value="endTurn">До конца следующего Хода цели</option><option value="roundEnd">До конца Раунда</option><option value="scene">До конца Сцены</option><option value="manual">Снять вручную</option></select></label></div><details><summary>Урон по отдельным целям</summary>${targets.map(target=>`<label>${esc(target.name)}<input type="number" min="0" max="9999" data-lw-target-damage="${esc(target.id)}" placeholder="Общий урон"></label>`).join("")}</details><details><summary>Особые правила урона</summary><label><input type="checkbox" data-lw-ignore-armor>Игнорирует Броню</label><label><input type="checkbox" data-lw-ignore-evasion>Игнорирует Уклонение</label><label><input type="checkbox" data-lw-irreducible>Урон нельзя снизить</label><label><input type="checkbox" data-lw-final-damage>Указано окончательное значение: без Усиления, Ослабления и Помечен</label></details><div class="button-row"><button class="primary" data-lw-operation="attack">Атака → Реакции</button>${Scene.pendingAction?`<button data-lw-operation="amend-attack">Изменить ожидающую Атаку</button>`:""}<button data-lw-operation="damage">Нанести урон</button><button data-lw-operation="heal">Вылечить</button><button data-lw-operation="effect">Наложить Эффект</button><button data-lw-operation="remove-effect">Снять Эффект</button></div><small>«Нанести урон» — отдельный не-Атакующий источник; для Атаки используются Реакции и Броня.</small><p data-lw-preview aria-live="polite"></p></div><details><summary>Исправить состояние</summary><div class="lw-fields"><label>Поле<select data-lw-correct-field>${[["hp","Здоровье"],["maxHp","Максимум ЗД"],["ap","ОД"],["baseAp","ОД в начале Хода"],["focus","Фокус"],["wounds","Раны"],["stress","Стресс"],["influence","Влияние"],["armor","Броня"],["evasion","Уклонение"],["speed","Скорость"],["vulnerable","Уязвимость: 0 — нет, 1 — да"],["body","Тело"],["talent","Талант"],["spirit","Дух"],["mind","Разум"],["knockedOut","Вне боя: 0 — нет, 1 — да"]].map(([key,label]) => `<option value="${key}">${label}</option>`).join("")}</select></label><label>Точное значение<input data-lw-correct-value type="number" min="0" max="9999" value="${a.hp}"></label><button data-lw-correct>Задать выбранному участнику</button></div></details><details><summary>Ресурсы, часы и временные изменения</summary><div class="lw-fields"><label>ID<input data-lw-custom-id value="custom.resource" aria-label="ID ресурса или часов"></label><label>Название<input data-lw-custom-label value="Ресурс"></label><label>Значение<input data-lw-custom-value type="number" min="0" max="9999" value="0"></label><label>Максимум / сегменты<input data-lw-custom-size type="number" min="1" max="9999" value="4"></label><label>При сбросе<input data-lw-custom-initial type="number" min="0" max="9999" value="0"></label><label>Сбрасывать<select data-lw-custom-reset><option value="manual">Только вручную</option><option value="startTurn">В начале своего Хода</option><option value="endTurn">В конце своего Хода</option><option value="roundEnd">В конце Раунда</option><option value="scene">При завершении Сцены</option></select></label><label><input data-lw-custom-unbounded type="checkbox">Ресурс без максимума</label></div><div class="button-row"><label><input data-lw-replaces-focus type="checkbox">Заменяет Фокус</label><label><input data-lw-replaces-ap type="checkbox">Заменяет ОД</label><label><input data-lw-inverted-focus type="checkbox">Обратный расход: стоимость Фокуса увеличивает ресурс, получение уменьшает</label><button data-lw-custom="configure-resource">Задать ресурс</button><button data-lw-custom="spend">Потратить ресурс</button><button data-lw-custom="gain">Получить ресурс</button><button data-lw-custom="clock">Задать часы</button><button data-lw-custom="reset-resource">Сбросить ресурс</button><button data-lw-custom="remove-resource">Удалить ресурс</button><button data-lw-custom="reset-clock">Сбросить часы</button><button data-lw-custom="remove-clock">Удалить часы</button></div><div class="lw-fields"><label>Показатель<select data-lw-mod-stat><option value="armor">Броня</option><option value="evasion">Уклонение</option><option value="speed">Скорость</option></select></label><label>Изменение<input data-lw-mod-amount type="number" min="-9999" max="9999" value="1"></label><label>Срок изменения<select data-lw-mod-duration><option value="endTurn">До конца следующего Хода цели</option><option value="startTurn">До начала следующего Хода цели</option><option value="roundEnd">До конца Раунда</option><option value="scene">До конца Сцены</option><option value="manual">Снять вручную</option></select></label><button data-lw-modifier="add">Добавить временное изменение</button><button data-lw-modifier="remove">Снять временные изменения показателя</button></div></details></section>`;
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
  holder.firstElementChild.insertAdjacentHTML("afterbegin",lwBatchHtml());
  holder.firstElementChild.insertAdjacentHTML("beforeend",lwGeneralHtml());
  const consoleNode=holder.firstElementChild,actions=consoleNode.querySelector(".lw-actions"),turnPane=root.querySelector('[data-director-pane="turn"]'),manualPane=root.querySelector('[data-director-pane="manual"]');
  if(turnPane&&manualPane){turnPane.prepend(actions);manualPane.prepend(consoleNode);}
  else root.prepend(consoleNode);
  for(const input of root.querySelectorAll("[data-lw-root] input,[data-lw-root] select,[data-lw-root] textarea")){const key=lwDraftKey(input);if(key&&lwFormDraft.has(key)){if(input.type==="checkbox")input.checked=lwFormDraft.get(key);else input.value=lwFormDraft.get(key);}}
  // Keep library, clocks, reminders, media and table tools in their established place.
  for (const element of root.querySelectorAll(".director-resource-row.health, .director-outcome, .director-exact-grid")) if (!element.closest(".lw-console")) element.hidden = true;
  if(Scene.pendingAction||Scene.lionwing?.choices?.length)for(const element of root.querySelectorAll(".director-turn-handoff"))element.hidden=true;
  for (const element of root.querySelectorAll(".director-outcome-options")) element.textContent = "Точные изменения записываются как исправления. Для игровых действий используйте операции LionWing выше.";
};

const lwOldEventText = eventText;
eventText = function(event) {
  if (!lwActive()) return lwOldEventText(event);
  const p = event.payload || {}, a = Scene.actors.find(x => x.id === (p.targetId || event.actorId));
  const resourceNames={hp:"Здоровье",maxHp:"максимум Здоровья",ap:"ОД",baseAp:"ОД в начале Хода",focus:"Фокус",influence:"Влияние",wounds:"Раны",stress:"Стресс",armor:"Броня",evasion:"Уклонение",speed:"Скорость",body:"Тело",talent:"Талант",spirit:"Дух",mind:"Разум",vulnerable:"Уязвимость",knockedOut:"Выведение"};
  const choiceNames={resist:"Сопротивляться",accept:"Принять последствия",win:"Инициатор победил",lose:"Инициатор проиграл",bail:"Отступить: без ставки", "take-it":"Принять удар и вернуть Влияние","double-down":"Удвоить ставку","one-wound":"1 Рана","two-wounds":"2 Раны",place:"Клетка возвращения выбрана",reroll:"Получить 5 урона и перебросить"};
  const who=a?.name||"Нарратор";
  if (p.correction) return `${who}: исправлено ${resourceNames[p.resource]||p.resource}, ${p.before} → ${p.value}`;
  if(event.type==="attack.amend")return `Нарратор изменил ожидающую Атаку: ${p.amount} урона, целей ${p.targetIds?.length||0}`;
  if(event.type==="actor.track.recover")return `${who}: ${p.track==="wounds"?"вылечены Раны":"снят Стресс"} −${p.amount}, осталось ${p.value}`;
  if(/^rule-(clock|resource)\.(reset|remove)$/.test(event.type))return `${who}: счётчик ${p.id} ${event.type.endsWith("remove")?"удалён":`сброшен до ${p.value}`}`;
  if(event.type==="effect.source.remove")return `${who}: снят один источник Эффекта; остальные источники сохраняются`;
  if(event.type==="chain.pause")return "Цепочка приостановлена для ручного правила";
  if(event.type==="chain.resume")return "Приостановленная цепочка возобновлена";
  if(event.type==="actor.stress")return `${who}: Стресс ${p.total}/3`;
  if(event.type==="duel.start")return `${Scene.actors.find(x=>x.id===event.actorId)?.name||"Инициатор"}: Дуэль с ${who}`;
  if(event.type==="duel.tension")return `Напряжение Дуэли: ${p.amount}`;
  if(event.type==="duel.end")return "Дуэль завершена: оба участника вернулись на край поля";
  if(event.type==="scene.tension")return `Напряжение Сцены: ${p.amount}`;
  if(event.type==="scene.reset")return "Бой завершён: здоровье восстановлено, временное состояние очищено; Раны и Стресс сохранены";
  if(event.type==="rule.used")return `${who}: учтено применение ${p.ruleId} (${({turn:"Ход",round:"Раунд",scene:"Сцена"})[p.scope]||p.scope})`;
  if(event.type==="action.allow")return `${who}: допуск ${lwRules().actions.list.find(d=>d.id===p.actionId)?.name||p.actionId}, применений ${p.uses??1}${p.swift?", Быстрое":""}`;
  if(event.type==="modifier.configure"&&p.stat)return `${who}: временное изменение ${resourceNames[p.stat]||p.stat} ${p.amount>0?"+":""}${p.amount}`;
  if(event.type==="modifier.remove")return `${who}: сняты временные изменения ${resourceNames[p.stat]||p.stat}`;
  if(event.type==="movement.prevented")return `${who}: принудительное движение предотвращено (${p.reason})`;
  if(event.type==="reaction.respond")return `${who}: ${({take:"Принять Атаку",block:"Блок",dodge:"Уворот",clash:"Столкновение"})[p.choice]||p.choice}`;
  if (event.type === "actor.wound") return `${a?.name}: Раны ${p.total}/3, ЗД восстановлено до ${p.hp}`;
  if (event.type === "automation.configure") return `${a?.name || "Участник"}: ${window.DAWN_LIONWING_ADAPTERS.list(a).find(rule=>rule.id===p.ruleId)?.label||p.ruleId} — ${p.enabled ? "автоматизация включена" : "ручное исполнение"}`;
  if (event.type === "rule.activated") return `${a?.name || "Участник"}: ${window.DAWN_LIONWING_ADAPTERS.list(a).find(rule=>rule.id===p.ruleId)?.label||p.ruleId}`;
  if (event.type === "rule.completed") return p.outcome === "skipped" ? "Необязательное правило пропущено" : "Последствия правила завершены";
  if (event.type === "consequence.replaced") return `${a?.name || "Участник"}: Эффект заменён на 2 урона (Берсерк II)`;
  if (event.type === "consequence.completed") return p.outcome === "replaced" ? "Замена последствия завершена" : "Применение Эффекта завершено";
  if (event.type === "rule.respond") return `${a?.name || "Нарратор"}: ${p.note || p.title || choiceNames[p.choice] || p.choice || "решение"}`;
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
  const chainControl=event.target.closest("[data-lw-chain]");
  if(chainControl){event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;return lwSubmit(chainControl.dataset.lwActor,{kind:chainControl.dataset.lwChain},"Ручное прерывание цепочки");}
  const batchControl=event.target.closest("[data-lw-batch-apply],[data-lw-batch-clear]");
  if(batchControl){event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;
    if(batchControl.hasAttribute("data-lw-batch-clear")){lwDraftBatch=null;lwDraftEnabled=false;renderScene();return;}
    if(!lwDraftBatch)return;
    const prepared=LionwingEngine.prepare(Scene,{...lwDraftBatch,kind:"batch"});
    if(!prepared.ok)return toast(prepared.errors.join(" "));
    if(commitSceneEvents("Составной ручной пакет",prepared.events)){lwDraftBatch=null;lwDraftEnabled=false;activeDirectorTab=Scene.pendingAction||Scene.lionwing?.choices?.length?"turn":"manual";renderScene();}return;
  }
  const inspector=event.target.closest("[data-gm-resource],[data-gm-revive],[data-gm-manual-resolve],[data-gm-health]");
  if(inspector){
    event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;
    const actorId=inspector.dataset.gmActor||inspector.dataset.gmRevive||inspector.dataset.gmManualResolve,a=Scene.actors.find(item=>item.id===actorId);if(!a)return;
    if(inspector.hasAttribute("data-gm-health"))return lwSubmit(actorId,{kind:inspector.dataset.gmHealth==="damage"?"damage":"heal",targetId:actorId,amount:Number(inspector.dataset.amount),sourceActorId:null},"Здоровье LionWing");
    if(inspector.hasAttribute("data-gm-resource")){const key=inspector.dataset.gmResource,delta=Number(inspector.dataset.delta);return lwSubmit(actorId,["wounds","stress"].includes(key)?delta>0?{kind:key==="wounds"?"wound":"stress",targetId:actorId,sourceActorId:null}:{kind:"correct",resource:key,amount:Math.max(0,a[key]+delta)}:{kind:"resource",resource:key,operation:delta>0?"gain":"spend",amount:Math.abs(delta)},"Ресурс LionWing");}
    if(inspector.hasAttribute("data-gm-revive"))return lwSubmit(actorId,{kind:"batch",operations:[{kind:"correct",resource:"knockedOut",amount:0},{kind:"correct",resource:"hp",amount:Math.max(1,a.hp)}]},"Исправление участия в бою");
    const note=document.querySelector(`[data-gm-manual-note="${CSS.escape(actorId)}"]`)?.value;
    return lwSubmit(actorId,{kind:"note",note:note||"Ручное решение Нарратора"},"Ручное решение");
  }
  const cell = event.target.closest("[data-scene-cell]");
  if (lwDestination && cell) {
    event.preventDefault(); event.stopImmediatePropagation();
    const point = cell.dataset.sceneCell.split(",").map(Number), draft = lwDestination;
    const destination = { x:point[0], y:point[1], space:Scene.activeSpace };
    const payload={...draft.payload,[draft.field||"destination"]:destination};
    if(draft.field==="reappearance"&&[SceneEngine.ACTION_IDS.jump,SceneEngine.ACTION_IDS.shove,SceneEngine.ACTION_IDS.improvise].includes(payload.actionId)&&!payload.effect&&!payload.removeObstacleId){lwDestination={actorId:draft.actorId,payload,label:draft.label};toast("Теперь выберите клетку действия");return;}
    if (lwSubmit(draft.actorId,payload,draft.label)) { lwDestination=null; renderScene(); }
    return;
  }
  const legacyAction=event.target.closest("[data-core-resolve], [data-core-cancel-pending]");
  if(legacyAction){event.preventDefault();event.stopImmediatePropagation();const a=currentHeroActor()||lwActor();if(!a)return;if(legacyAction.hasAttribute("data-core-action"))return lwSubmit(a.id,{kind:"action",actionId:legacyAction.dataset.coreAction,targetIds:[...Scene.targetIds]},"Базовое действие");if(!lwCanNarrate())return;return lwSubmit(Scene.pendingAction?.actorId||a.id,{kind:legacyAction.hasAttribute("data-core-resolve")?"resolve-attack":"cancel-attack"},"Разрешение Атаки");}
  const duelTension=event.target.closest("[data-lw-set-duel-tension]");
  if(duelTension){event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;return lwSubmit(duelTension.dataset.lwActor,{kind:"tension",duelId:duelTension.dataset.lwSetDuelTension,amount:Number(duelTension.closest(".lw-pending").querySelector("[data-lw-duel-tension]").value)},"Напряжение Дуэли");}
  const general=event.target.closest("[data-lw-general-submit]");
  if(general){
    event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;
    const root=general.closest(".lw-console"),sourceId=root.dataset.lwActor,get=key=>root.querySelector(`[data-lw-general-${key}]`)?.value,kind=get("kind"),amount=Number(get("amount")),targets=Scene.targetIds.length?LionwingEngine.targetIds(Scene,Scene.targetIds):[sourceId];
    if(kind==="roll"){
      const payload={kind,count:amount,critAt:Number(get("crit")),explode:root.querySelector("[data-lw-general-explode]").checked,label:get("note")||"Ручной бросок"};
      if(get("dice").trim())payload.roll={initialCount:amount,rolls:get("dice").trim().split(/[\s,;]+/).map(Number),critAt:payload.critAt,explode:payload.explode,formula:`${amount}D6`};
      return lwSubmit(sourceId,payload,"Ручной бросок");
    }
    let operations=targets.map(targetId=>({kind,targetId,...(kind==="record-action"?{actionId:get("action"),resource:get("resource"),amount,swift:root.querySelector("[data-lw-general-swift]").checked,reaction:root.querySelector("[data-lw-general-reaction]").checked}:{}),...(kind==="recover-track"?{track:get("track"),amount}:{}),...(kind==="resource"?{resource:get("resource"),operation:get("direction"),amount}:{}),...(["note","prompt"].includes(kind)?{note:get("note"),title:get("note"),text:get("note")}:{}),...(kind==="allow-action"?{actionId:get("action"),cost:Number(get("cost")),uses:amount,swift:root.querySelector("[data-lw-general-swift]").checked,reaction:root.querySelector("[data-lw-general-reaction]").checked}:{}),...(kind==="usage"?{ruleId:get("id"),scope:get("scope"),limit:amount,targetIds:targets}:{}),...(kind==="move"?{maximum:amount,ignoreOpponents:root.querySelector("[data-lw-general-ignore-opponents]").checked,ignoreTerrain:root.querySelector("[data-lw-general-ignore-terrain]").checked,line:root.querySelector("[data-lw-general-line]").checked,forced:get("movement")==="forced",teleport:get("movement")==="teleport"}:{})}));
    if(["wound","stress"].includes(kind)){if(!Number.isInteger(amount)||amount<1||amount*targets.length>192)return toast("Укажите целое количество от 1 до 192 операций");operations=operations.flatMap(operation=>Array.from({length:amount},()=>({...operation})));}
    if(kind==="move"){if(targets.length!==1)return toast("Для движения выберите одну цель");lwDestination={actorId:sourceId,payload:operations[0],label:"Движение правила"};renderScene();toast("Выберите клетку назначения");return;}
    return lwSubmit(sourceId,operations.length===1?operations[0]:{kind:"batch",operations:["note","prompt","usage"].includes(kind)?[operations[0]]:operations},"Общая операция правила");
  }
  const button = event.target.closest("[data-core-action], [data-lw-automation], [data-lw-action], [data-lw-reaction], [data-lw-choice], [data-lw-resolve], [data-lw-cancel], [data-lw-clear-destination], [data-lw-operation], [data-lw-correct], [data-lw-custom], [data-lw-modifier], [data-lw-punish], [data-lw-invisible]");
  if (!button) {
    const oldControl=event.target.closest("[data-director-set-field], [data-director-knockout], [data-director-tension], [data-director-open-reactions], [data-director-set-rule-resource], [data-director-set-rule-clock]");
    if(oldControl){event.preventDefault();event.stopImmediatePropagation();const a=lwActor();if(!a||!lwCanNarrate())return;
      if(oldControl.hasAttribute("data-director-tension"))return lwSubmit(a.id,{kind:"tension",amount:Math.max(0,Scene.tension+Number(oldControl.dataset.directorTension))},"Напряжение");
      if(oldControl.hasAttribute("data-director-knockout"))return lwSubmit(a.id,{kind:"correct",resource:"knockedOut",amount:oldControl.dataset.directorKnockout==="restore"?0:1},"Исправление участия в бою");
      if(oldControl.hasAttribute("data-director-open-reactions"))return lwSubmit(a.id,{kind:"attack",targetIds:[...Scene.targetIds],amount:Number($("scene-director-outcome-damage")?.value||0)},"Ручная Атака");
      if(oldControl.hasAttribute("data-director-set-field")){const key=oldControl.dataset.directorSetField,input=$("scene-director").querySelector(`[data-director-field-input="${CSS.escape(key)}"]`);return lwSubmit(a.id,{kind:"correct",resource:key.replace("attr.",""),amount:Number(input?.value)},"Исправление параметра");}
      if(oldControl.hasAttribute("data-director-set-rule-resource")){const id=oldControl.dataset.directorSetRuleResource,input=$("scene-director").querySelector(`[data-director-rule-resource-input="${CSS.escape(id)}"]`),def=a.ruleResources?.[id];return lwSubmit(a.id,{kind:"configure-resource",id,label:def?.label,value:Number(input?.value),maximum:def?.maximum??null},"Исправление ресурса");}
      const id=oldControl.dataset.directorSetRuleClock,input=$("scene-director").querySelector(`[data-director-rule-clock-input="${CSS.escape(id)}"]`),def=a.ruleClocks?.[id];return lwSubmit(a.id,{kind:"clock",id,label:def?.label,value:Number(input?.value),size:def?.size||4},"Исправление часов");
    }
    // Legacy shortcuts become the same typed operations, not direct HP mutation.
    const damage = event.target.closest("[data-director-damage], [data-director-heal]");
    if (damage) { event.preventDefault(); event.stopImmediatePropagation(); const a=lwActor(); if(a&&lwCanNarrate())lwSubmit(a.id,{kind:damage.hasAttribute("data-director-damage")?"damage":"heal",targetId:a.id,amount:Number(damage.dataset.directorDamage||damage.dataset.directorHeal),sourceActorId:null},"Здоровье LionWing"); }
    return;
  }
  event.preventDefault(); event.stopImmediatePropagation();
  const root = button.closest("[data-lw-root]") || button.closest(".lw-console"), actorId = button.dataset.lwActor || button.dataset.coreActor || root?.dataset.lwActor || lwActor()?.id;
  if (!actorId || !lwOwns(actorId)) return toast("Этим участником управляет другой игрок");
  const val = (selector, fallback="") => root?.querySelector(selector)?.value ?? fallback;
  const num = (selector, fallback=0) => Number(val(selector,fallback));
  if(button.hasAttribute("data-lw-automation")){if(!lwCanNarrate())return;return lwSubmit(actorId,{kind:"automation",ruleId:button.dataset.lwAutomation,enabled:button.dataset.lwEnabled==="true"},"Настройка автоматизации");}
  if(button.hasAttribute("data-lw-punish"))return lwSubmit(actorId,{kind:"punish",id:button.dataset.lwPunish},"Наказание");
  if(button.hasAttribute("data-lw-invisible"))return lwSubmit(actorId,{kind:"invisible"},"Исчезновение");
  if (button.hasAttribute("data-lw-clear-destination")) { lwDestination=null; renderScene(); return; }
  if (button.hasAttribute("data-lw-action") || button.hasAttribute("data-core-action")) {
    const actionId=button.dataset.lwAction||button.dataset.coreAction, payload={kind:"action",actionId,targetIds:[...Scene.targetIds],breakout:button.dataset.lwBreakout==="true",focusSpent:num("[data-lw-focus]"),advantage:num("[data-lw-advantage]"),disadvantage:num("[data-lw-disadvantage]")};
    if(val("[data-lw-attribute]"))payload.attribute=val("[data-lw-attribute]");
    if(root?.querySelector("[data-lw-spike]")?.checked)payload.spikeTargetIds=[...Scene.targetIds];
    if(actionId===SceneEngine.ACTION_IDS.improvise){if(val("[data-lw-improvise-effect]"))payload.effect=val("[data-lw-improvise-effect]");if(val("[data-lw-remove-obstacle]"))payload.removeObstacleId=val("[data-lw-remove-obstacle]");}
    const name=lwRules().actions.list.find(d=>d.id===actionId)?.name||"Действие";
    if((Scene.actors.find(a=>a.id===actorId)?.effects||[]).includes("positive.исчез")){lwDestination={actorId,payload,label:name,field:"reappearance"};toast("Сначала выберите клетку появления");return;}
    if([SceneEngine.ACTION_IDS.jump,SceneEngine.ACTION_IDS.shove,SceneEngine.ACTION_IDS.improvise].includes(actionId)&&!payload.effect&&!payload.removeObstacleId){lwDestination={actorId,payload,label:name};toast("Выберите клетку на поле");return;}
    lwSubmit(actorId,payload,name); return;
  }
  if (button.hasAttribute("data-lw-reaction")) { const payload={kind:"reaction",choice:button.dataset.lwReaction};if(payload.choice==="dodge"){lwDestination={actorId,payload,label:"Уворот"};toast("Выберите клетку Уворота");return;} lwSubmit(actorId,payload,"Реакция");return; }
  if (button.hasAttribute("data-lw-choice")) { const payload={kind:"choice",id:button.dataset.lwChoiceId,choice:button.dataset.lwChoice,note:button.closest(".lw-pending")?.querySelector("[data-lw-choice-note]")?.value||""};if(payload.choice==="place"){lwDestination={actorId,payload,label:"Появление"};toast("Выберите клетку на поле");return;}lwSubmit(actorId,payload,"Решение игрока");return; }
  if (button.hasAttribute("data-lw-resolve") || button.hasAttribute("data-lw-cancel")) { if(!lwCanNarrate())return;lwSubmit(actorId,{kind:button.hasAttribute("data-lw-resolve")?"resolve-attack":"cancel-attack"},"Разрешение Атаки");return; }
  if (!lwCanNarrate()) return toast("Эта операция доступна Нарратору");
  if (button.hasAttribute("data-lw-correct")) { lwSubmit(actorId,{kind:"correct",resource:val("[data-lw-correct-field]"),amount:num("[data-lw-correct-value]")},"Исправление состояния");return; }
  if (button.hasAttribute("data-lw-custom")) { const kind=button.dataset.lwCustom,id=val("[data-lw-custom-id]"),value=num("[data-lw-custom-value]");if(/^(reset|remove)-(resource|clock)$/.test(kind)){const [operation,type]=kind.split("-");lwSubmit(actorId,{kind:"counter",id,operation,type},"Счётчик");return;}lwSubmit(actorId,["spend","gain"].includes(kind)?{kind:"resource",operation:kind,resource:id,amount:value}:{kind,id,label:val("[data-lw-custom-label]"),value,initial:num("[data-lw-custom-initial]"),resetAt:val("[data-lw-custom-reset]"),size:num("[data-lw-custom-size]"),maximum:root.querySelector("[data-lw-custom-unbounded]")?.checked||root.querySelector("[data-lw-replaces-focus]")?.checked?null:num("[data-lw-custom-size]"),replaces:root.querySelector("[data-lw-replaces-focus]")?.checked?"focus":null,inverted:root.querySelector("[data-lw-inverted-focus]")?.checked===true,replacesAp:root.querySelector("[data-lw-replaces-ap]")?.checked===true},"Ресурс / часы");return; }
  if (button.hasAttribute("data-lw-modifier")) { const targets=Scene.targetIds.length?LionwingEngine.targetIds(Scene,Scene.targetIds):[actorId];lwSubmit(actorId,{kind:"batch",operations:targets.map(targetId=>({kind:"modifier",remove:button.dataset.lwModifier==="remove",targetId,stat:val("[data-lw-mod-stat]"),amount:num("[data-lw-mod-amount]"),duration:val("[data-lw-mod-duration]","endTurn")}))},"Временный модификатор");return; }
  if (button.hasAttribute("data-lw-operation")) {
    const kind=button.dataset.lwOperation,targets=LionwingEngine.targetIds(Scene,Scene.targetIds),amount=num("[data-lw-amount]"),repeat=num("[data-lw-repeat]",1),effect=val("[data-lw-effect]"),duration=val("[data-lw-duration]","default"),cost=num("[data-lw-cost]");
    if(!targets.length)return toast("Выберите цели на поле или в составе");
    const targetDamage=Object.fromEntries([...root.querySelectorAll("[data-lw-target-damage]")].filter(input=>input.value!=="").map(input=>[input.dataset.lwTargetDamage,Number(input.value)]));
    const damageOptions={targetDamage,ignoreArmor:root.querySelector("[data-lw-ignore-armor]").checked,ignoreEvasion:root.querySelector("[data-lw-ignore-evasion]").checked,irreducible:root.querySelector("[data-lw-irreducible]").checked,finalDamage:root.querySelector("[data-lw-final-damage]").checked};
    if(kind==="amend-attack")return lwSubmit(actorId,{kind,amount,targetIds:targets,...damageOptions},"Изменение ожидающей Атаки");
    if(kind==="attack")return lwSubmit(actorId,{kind,...damageOptions,amount,repeat,targetIds:targets,effects:effect?[{effect,...(duration!=="default"?{duration}:{})}]:[],cost:{resource:"ap",amount:cost}},"Ручная Атака");
    const operations=cost?[{kind:"resource",resource:"ap",operation:"spend",amount:cost}]:[];
    if(["effect","remove-effect"].includes(kind)&&!effect)return toast("Выберите Эффект");
    if(!Number.isInteger(repeat)||repeat<1||repeat>30)return toast("Повторы: от 1 до 30");
    for(let i=0;i<(kind==="damage"?repeat:1);i++)for(const targetId of targets)operations.push(kind.includes("effect")?{kind:"effect",targetId,effect,remove:kind==="remove-effect",...(duration!=="default"?{duration}:{})}:{kind,targetId,amount,...damageOptions,...(effect?{effects:[{effect,...(duration!=="default"?{duration}:{})}]}:{})});
    lwSubmit(actorId,{kind:"batch",operations},"Результат действия");
  }
},true);

document.addEventListener("change",event=>{
  if(!lwActive())return;
  if(event.target.matches("[data-lw-stage]")){lwDraftEnabled=event.target.checked;return;}
  const input=event.target.closest("[data-scene-actor-hp]");
  if(input){event.preventDefault();event.stopImmediatePropagation();if(lwCanNarrate())lwSubmit(input.dataset.sceneActorHp,{kind:"correct",resource:"hp",amount:Number(input.value)},"Исправление Здоровья");}
},true);

document.addEventListener("input",event=>{
  if(lwActive()&&event.target.closest("[data-lw-root]")){const key=lwDraftKey(event.target);if(key)lwFormDraft.set(key,event.target.type==="checkbox"?event.target.checked:event.target.value);}
  const root=event.target.closest(".lw-console");if(!root||!lwActive())return;
  const output=root.querySelector("[data-lw-preview]");if(!output)return;
  const amount=Number(root.querySelector("[data-lw-amount]")?.value||0),actorId=root.dataset.lwActor;
  const operations=Scene.targetIds.map(targetId=>({kind:"damage",targetId,amount}));if(!operations.length){output.textContent="Выберите цели для предпросмотра.";return;}
  const preview=LionwingEngine.previewEvents(Scene,[LionwingEngine.command(actorId,{kind:"batch",operations})]);
  output.textContent=preview.ok?Scene.targetIds.map(id=>{const before=Scene.actors.find(a=>a.id===id),after=preview.scene.actors.find(a=>a.id===id);return`${before.name}: ${before.hp} → ${after.hp} ЗД${after.wounds!==before.wounds?`, Раны ${after.wounds}/3`:""}`;}).join(" · ")+(preview.scene.lionwing.choices.length?" · потребуется решение игрока":""):preview.errors.join(" ");
});
