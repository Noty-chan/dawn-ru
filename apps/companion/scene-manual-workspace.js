"use strict";
window.DAWN_I18N?.registerLocale?.("ru", {
  "scene.manual.healthHelp":"Число — задать ЗД; -5 / +5 — изменить. Enter или выход применяет, Escape отменяет.", "scene.manual.statusHints":"Подсказки статусов", "scene.manual.policyName":"Ведение", "scene.manual.policyAria":"Режим игрового стола", "scene.manual.manual":"Вручную", "scene.manual.rules":"По правилам",
  "scene.manual.select":"Выберите участника", "scene.manual.sheet":"Лист", "scene.manual.close":"Закрыть", "scene.manual.marked":"Личная отметка ✓", "scene.manual.mark":"Личная отметка",
  "scene.manual.counter":"Счётчик", "scene.manual.removeCounter":"Убрать счётчик", "scene.manual.counterValue":"Значение счётчика", "scene.manual.less":"Уменьшить", "scene.manual.more":"Увеличить",
  "scene.manual.area":"Показать область", "scene.manual.noAbilities":"Способности этого участника не добавлены.", "scene.manual.hp":"ЗД", "scene.manual.exactHp":"Записать здоровье",
  "scene.manual.commands":"Команды ручного стола", "scene.manual.read":"Читать", "scene.manual.dice":"Кубы", "scene.manual.clocks":"Часы", "scene.manual.point":"Сейчас играет",
  "scene.manual.round":"Раунд", "scene.manual.nextRound":"+1", "scene.manual.nextRoundHint":"Следующий раунд: +1 Напряжение", "scene.manual.participants":"Участники", "scene.manual.abilities":"Способности участника"
});
window.DAWN_I18N?.registerLocale?.("en", {
  "scene.manual.healthHelp":"A number sets HP; -5 / +5 changes it. Enter or leaving applies, Escape cancels.", "scene.manual.statusHints":"Status hints", "scene.manual.policyName":"Table mode", "scene.manual.policyAria":"Table play mode", "scene.manual.manual":"Manual", "scene.manual.rules":"With rules",
  "scene.manual.select":"Select a participant", "scene.manual.sheet":"Sheet", "scene.manual.close":"Close", "scene.manual.marked":"Personal mark ✓", "scene.manual.mark":"Personal mark",
  "scene.manual.counter":"Counter", "scene.manual.removeCounter":"Remove counter", "scene.manual.counterValue":"Counter value", "scene.manual.less":"Decrease", "scene.manual.more":"Increase",
  "scene.manual.area":"Show area", "scene.manual.noAbilities":"No abilities have been added for this participant.", "scene.manual.hp":"HP", "scene.manual.exactHp":"Set Health",
  "scene.manual.commands":"Manual table commands", "scene.manual.read":"Read", "scene.manual.dice":"Dice", "scene.manual.clocks":"Clocks", "scene.manual.point":"Playing now",
  "scene.manual.round":"Round", "scene.manual.nextRound":"+1", "scene.manual.nextRoundHint":"Next round: +1 Tension", "scene.manual.participants":"Participants", "scene.manual.abilities":"Participant abilities"
});
// Presentation adapter only: the host owns permissions, shared commands and rolls.
window.DAWN_MANUAL_WORKSPACE = (() => {
  let adapter = null, footer = null, initiative = null, reader = null;
  let reading = false, readingActorId = null, readerActorId = null, scope = null, footerScope = null, paintingFooter = false, paintingReader = false;
  const techniqueFlags = new Map();
  let lastWriteResult=null;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const text = (key, fallback) => window.DAWN_I18N?.t?.(`scene.manual.${key}`, {}, {fallback}) || fallback;
  const icon = name => window.DAWN_UI_ICONS?.html?.(name) || "";
  const allowed = (value, actor) => typeof value === "function" ? Boolean(value(actor)) : Boolean(value);
  const isManual = scene => window.DAWN_TABLE_POLICY?.isManual?.(scene) ?? scene?.tablePolicy?.mode === "manual";
  function model(options) {
    const scene = options?.scene;
    const manual = Boolean(scene && isManual(scene));
    const actors = manual ? (scene.actors || []).filter(actor => (!options.canRead || options.canRead(actor)) && (!scene.activeSpace || actor.space === scene.activeSpace)) : [];
    const initiativeActors=manual?[...(scene.actors||[]).filter(actor=>actor.manualInitiativeVisible??!actor.hidden),...(scene.manualInitiative||[]).filter(row=>!(scene.actors||[]).some(actor=>actor.id===row.id))].filter(actor=>!scene.activeSpace||actor.space===scene.activeSpace).map(actor=>options.canRead&&!options.canRead(actor)?{id:actor.id,name:actor.name,space:actor.space,hidden:true,initiativeOnly:true}:actor):[];
    const selected = actors.find(actor => actor.id === scene?.selectedActor) || actors.find(actor => actor.id === readingActorId) || actors.find(actor => allowed(options.canControl, actor)) || null;
    return {manual, actors, initiativeActors, selected, current: initiativeActors.find(actor => actor.id === scene?.manualTable?.actorId) || null,
      round: Math.max(1, Number(scene?.manualTable?.round) || 1), narrator: allowed(options?.canNarrate), control: Boolean(selected && allowed(options?.canControl, selected))};
  }
  function button(action, label, glyph, disabled = false, extra = "") {
    return `<button type="button" data-manual-action="${action}" ${disabled ? "disabled" : ""} ${extra}>${glyph ? icon(glyph) : ""}<span>${escape(label)}</span></button>`;
  }
  function statuses(actor) {
    const entries = adapter.statuses?.(actor) || (actor.effects || []).map(effect => typeof effect === "string" ? {id:effect,name:effect} : effect);
    return entries.map(entry => `<span class="scene-manual-status" title="${escape(adapter.statusHints ? entry.hint || entry.name : entry.name)}">${icon(entry.icon || "effects")}<span>${escape(entry.name || entry.id)}</span>${adapter.statusHints && entry.hint ? `<small>${escape(entry.hint)}</small>` : ""}</span>`).join("");
  }
  function abilities(actor) {
    const result = adapter.readAbilities?.(actor) || [];
    return Array.isArray(result) ? result : [];
  }
  function counterTools(actor, entry, index, control) {
    if (!entry.counter || !adapter.editCounter) return "";
    const value = actor.manualTechniqueCounters?.[entry.id];
    const extra = `data-ability-index="${index}"`;
    if (!Number.isSafeInteger(value)) return button("counter-create", text("counter", "Счётчик"), "add", !control, extra);
    const label = escape(`${text("counterValue", "Значение счётчика")}: ${entry.name}`);
    return `<div class="scene-manual-counter" role="group" aria-label="${label}">${button("counter-down", "−", "", !control || value <= 0, `${extra} aria-label="${escape(text("less", "Уменьшить"))}"`)}<input type="number" min="0" max="999" step="1" inputmode="numeric" data-manual-counter="${index}" aria-label="${label}" value="${value}" ${control ? "" : "disabled"}>${button("counter-up", "+", "", !control || value >= 999, `${extra} aria-label="${escape(text("more", "Увеличить"))}"`)}${button("counter-remove", text("removeCounter", "Убрать счётчик"), "close", !control, `${extra} aria-label="${escape(text("removeCounter", "Убрать счётчик"))}"`)}</div>`;
  }
  function paintReader(state,preserveDraft=true){
    const previous=paintingReader;paintingReader=true;
    try{return drawReader(state,preserveDraft);}finally{paintingReader=previous;}
  }
  function drawReader(state, preserveDraft = true) {
    const actor = state.selected;
    const keepExpansion = actor?.id === readerActorId && !reader.hidden;
    const active = document.activeElement;
    const focused = keepExpansion && active && reader.contains(active) ? {
      action:active.dataset?.manualAction,
      entry:active.closest?.('[data-entry-id]')?.dataset.entryId,
      counter:active.matches?.('[data-manual-counter]'),
      submitted:active.manualSubmitted,
      submission:active.manualSubmission,
      draft:preserveDraft && state.control && active.matches?.('[data-manual-counter]') && active.value !== active.getAttribute('value') ? active.value : null
    } : null;
    const expanded = new Set(keepExpansion ? Array.from(reader.querySelectorAll('details[open]')).map(node => node.dataset.manualAbility) : []);
    const expandProfile = !keepExpansion && Boolean(actor?.profileId || actor?.kind === "enemy" || actor?.kind === "npc");
    readerActorId = actor?.id || null;
    reader.hidden = !reading;
    if (!reading) return;
    reader.innerHTML = `<header><strong>${escape(actor?.name || text("select", "Выберите участника"))}</strong>${adapter.openSheet?button("sheet", text("sheet", "Лист"), "sheet", !actor):""}${button("close-reader", text("close", "Закрыть"), "close")}</header>${actor ? `<div class="scene-manual-statuses">${statuses(actor)}</div><div class="scene-manual-abilities">${abilities(actor).map((entry, index) => {
      const key = `${actor.id}:${entry.id || index}`, on = adapter.toggleTechnique ? Boolean(actor.manualTechniqueState?.[entry.id]) : techniqueFlags.get(key) || false;
      return `<details data-entry-id="${escape(entry.id)}" data-manual-ability="${index}" ${expandProfile || expanded.has(String(index)) ? "open" : ""}><summary>${escape(entry.name)}${entry.meta ? `<small>${escape(entry.meta)}</small>` : ""}</summary><div class="scene-manual-ability-text">${escape(entry.text || entry.description || "")}</div>${adapter.statusHints && entry.hint ? `<p class="scene-manual-hint">${escape(entry.hint)}</p>` : ""}<div class="scene-manual-ability-tools">${entry.toggle ? button("technique-toggle", on ? text("marked", "Личная отметка ✓") : text("mark", "Личная отметка"), "effects", !state.control, `data-ability-index="${index}" aria-pressed="${on}"`) : ""}${counterTools(actor,entry,index,state.control)}${entry.area && adapter.showArea ? button("show-area", text("area", "Показать область"), "areas", !state.control, `data-ability-index="${index}"`) : ""}</div></details>`;
    }).join("") || `<p class="scene-manual-empty">${escape(text("noAbilities", "Способности этого участника не добавлены."))}</p>`}</div>` : ""}`;
    if (focused) {
      const root = focused.entry ? Array.from(reader.querySelectorAll('[data-entry-id]')).find(node=>node.dataset.entryId===focused.entry) : reader;
      const target = focused.counter ? root?.querySelector('[data-manual-counter]') : Array.from(root?.querySelectorAll('[data-manual-action]') || []).find(node=>node.dataset.manualAction===focused.action);
      if (target && !target.disabled) {
        if (focused.draft !== null && focused.counter) target.value=focused.draft;
        if (focused.counter && focused.draft !== null && focused.submitted === focused.draft) {target.manualSubmitted=focused.submitted;target.manualSubmission=focused.submission;}
        target.focus({preventScroll:true});
      }
    }
  }
  function paint() {
    if (!adapter || !footer) return;
    const state = model(adapter), actor = state.selected;
    const oldHp=footer.querySelector('[data-manual-hp]');
    const editingHp=oldHp&&document.activeElement===oldHp&&oldHp.dataset.manualActor===actor?.id&&footerScope===scope&&state.control;
    const hpDraft=editingHp&&oldHp.value!==oldHp.dataset.manualValue?oldHp.value:null;
    const hpSubmitted=editingHp?oldHp.manualSubmitted:undefined;
    const hpSubmission=editingHp?oldHp.manualSubmission:undefined;
    footerScope=scope;
    initiative.setAttribute('aria-label',text('participants','Участники'));
    reader.setAttribute('aria-label',text('abilities','Способности участника'));
    footer.hidden = initiative.hidden = !state.manual;
    if (!state.manual) { reading = false; paintReader(state); return state; }
    const footerMarkup = `<div class="scene-manual-selected"><strong>${escape(actor?.name || text("select", "Выберите участника"))}</strong>${actor ? `<label><span>${escape(text("hp", "ЗД"))}</span><input type="text" inputmode="text" maxlength="6" data-manual-hp data-manual-actor="${escape(actor.id)}" data-manual-value="${escape(actor.hp ?? 0)}" aria-label="${escape(text("exactHp", "Записать здоровье"))}" value="${escape(actor.hp ?? 0)}" title="${escape(text("healthHelp", "Число — задать ЗД; -5 / +5 — изменить. Enter или выход применяет, Escape отменяет."))}" ${!state.control || !(adapter.editResource || adapter.commit) ? "disabled" : ""}><small>/ ${escape(actor.maxHp ?? "—")}</small></label>` : ""}</div><nav aria-label="${escape(text("commands", "Команды ручного стола"))}">${button("read", text("read", "Читать"), "sheet", !actor, `aria-expanded="${reading}"`)}${button("dice", text("dice", "Кубы"), "dice", !adapter.roll)}${button("clocks", text("clocks", "Часы"), "history", !adapter.openClocks)}${state.narrator ? button("point", text("point", "Сейчас играет"), "tokens", !actor || !(adapter.setCurrent || adapter.commit)) : ""}</nav><span class="scene-manual-round">${escape(text("round", "Раунд"))} ${state.round}${state.narrator ? button("round", text("nextRound", "+1"), "add", !(adapter.setRound || adapter.commit), `title="${escape(text("nextRoundHint", "Следующий раунд: +1 Напряжение"))}"`) : ""}</span><output class="scene-manual-message" aria-live="polite"></output>`;
    if(footer.manualRenderedMarkup!==footerMarkup||editingHp){paintingFooter=true;window.DAWN_MANUAL_SURFACE_PAINTING=true;try{footer.innerHTML=footerMarkup;footer.manualRenderedMarkup=footerMarkup;}finally{paintingFooter=false;window.DAWN_MANUAL_SURFACE_PAINTING=false;}}
    adapter.afterFooterRender?.();
    initiative.innerHTML = `<span class="scene-manual-initiative-label">${escape(text("participants", "Участники"))}</span>${state.initiativeActors.map(item => {const image=item.tokenImage || item.portraitImage || item.portraitUrl;return `<button type="button" data-manual-action="select" data-actor-id="${escape(item.id)}" class="${item.id === actor?.id ? "selected" : ""} ${item.id === state.current?.id ? "current" : ""}" title="${escape(item.name)}" aria-label="${escape(item.name)}" ${!state.actors.some(actor=>actor.id===item.id)?"disabled":""} ${item.id === state.current?.id ? 'aria-current="step"' : ""}>${image ? `<img src="${escape(image)}" alt="">` : `<span aria-hidden="true">${escape(item.name?.slice(0,2) || "?")}</span>`}<small>${escape(item.name)}</small></button>`;}).join("")}`;
    paintReader(state);
    if(editingHp&&state.manual){const input=footer.querySelector('[data-manual-hp]');if(input&&!input.disabled){if(hpDraft!==null){input.value=hpDraft;if(hpSubmitted===hpDraft){input.manualSubmitted=hpSubmitted;input.manualSubmission=hpSubmission;}}if(document.activeElement!==input)input.focus?.({preventScroll:true});}}
    return state;
  }
  function act(action, value) {
    if (!adapter) return false;
    const state = model(adapter), actor = state.selected;
    // Recheck the current role/policy, including a stale open reader or footer.
    if (!state.manual) return false;
    if (action === "select") {
      const selected = state.actors.find(item => item.id === value);
      if (!selected || !adapter.selectActor) return false;
      readingActorId = selected.id; adapter.selectActor(selected); paint(); return true;
    }
    if (action === "read" && actor) { reading = !reading; if(reading)adapter.beforeRead?.();readingActorId = actor.id; paint(); return true; }
    if (action === "close-reader") { reading = false; paint(); return true; }
    if (action === "sheet" && actor && adapter.openSheet) { adapter.openSheet(actor); return true; }
    if (action === "dice" && adapter.roll) { adapter.roll({actorId:actor?.id || null}); return true; }
    if (action === "clocks" && adapter.openClocks) { adapter.openClocks(actor); return true; }
    if (action === "point" && state.narrator && actor && (adapter.setCurrent || adapter.commit)) {
      if (adapter.setCurrent) adapter.setCurrent(actor); else adapter.commit(text("point", "Сейчас играет"), [{type:"table.command",actorId:null,payload:{kind:"pointer",actorId:actor.id}}]); return true;
    }
    if (action === "round" && state.narrator && (adapter.setRound || adapter.commit)) {
      if (adapter.setRound) adapter.setRound(state.round + 1); else adapter.commit(text("nextRound", "Ручной раунд +1"), [{type:"table.command",actorId:null,payload:{kind:"round",delta:1}}]); return true;
    }
    if (action === "hp" && state.control && (adapter.editResource || adapter.commit)) {
      const amount = window.DAWN_TABLE_POLICY.healthInput(value,Number(actor.hp||0),actor.maxHp);
      if (amount===null) return false;
      if (amount===Number(actor.hp||0)) return true;
      lastWriteResult=adapter.editResource ? adapter.editResource(actor, {field:"hp",value:amount}) : adapter.commit(text("exactHp", "Записать здоровье"), [{type:"table.command",actorId:actor.id,payload:{kind:"resource",values:{hp:amount}}}]);return Boolean(lastWriteResult);
    }
    if (actor && action.startsWith("counter-") && state.control && adapter.editCounter) {
      const index = typeof value === "object" ? value.index : value;
      const entry = abilities(actor)[Number(index)];
      if (!entry?.counter) return false;
      const operation = ({"counter-create":"create","counter-remove":"remove","counter-up":"adjust","counter-down":"adjust","counter-set":"set"})[action];
      if (!operation) return false;
      const change = {operation};
      if (operation === "adjust") change.delta = action === "counter-up" ? 1 : -1;
      if (operation === "set") {
        change.value = String(value.value).trim() === "" ? NaN : Number(value.value);
        if (!Number.isSafeInteger(change.value) || change.value < 0 || change.value > 999) { paintReader(state, false); return false; }
      }
      if (operation !== "create" && !Number.isSafeInteger(actor.manualTechniqueCounters?.[entry.id])) return false;
      lastWriteResult=adapter.editCounter(actor,entry,change);return Boolean(lastWriteResult);
    }
    if (actor && (action === "technique-toggle" || action === "show-area")) {
      const entry = abilities(actor)[Number(value)];
      if (!entry) return false;
      if (action === "show-area" && state.control && entry.area && adapter.showArea) { adapter.showArea(actor, entry); return true; }
      if (action === "technique-toggle" && entry.toggle && state.control) {
        const key = `${actor.id}:${entry.id || value}`, on = !(adapter.toggleTechnique ? actor.manualTechniqueState?.[entry.id] : techniqueFlags.get(key));
        techniqueFlags.set(key, on); adapter.toggleTechnique?.(actor, entry, on); paintReader(model(adapter)); return true;
      }
    }
    return false;
  }
  function submitNumber(target,isCounter){
    if(target.value===target.manualSubmitted)return;
    const state=model(adapter),actorId=state.selected?.id,writeScope=scope;
    const entry=isCounter?abilities(state.selected)[Number(target.dataset.manualCounter)]?.id:null;
    const value=target.value;target.manualSubmitted=value;lastWriteResult=null;
    const healthValue=isCounter?null:window.DAWN_TABLE_POLICY.healthInput(value,Number(state.selected?.hp||0),state.selected?.maxHp);
    const accepted=act(isCounter?'counter-set':'hp',isCounter?{index:target.dataset.manualCounter,value}:value);
    const receipt=accepted?lastWriteResult:null;
    // A local writer may synchronously render and replace this very input.
    const current=model(adapter);
    const replacement=scope===writeScope&&current.control&&current.selected?.id===actorId
      ?isCounter?Array.from(reader.querySelectorAll('[data-manual-counter]')).find(node=>abilities(current.selected)[Number(node.dataset.manualCounter)]?.id===entry):footer.querySelector('[data-manual-hp]'):null;
    for(const node of new Set([target,replacement].filter(Boolean))){
      if(node.value!==value)continue;
      if(accepted){if(!isCounter)node.value=String(healthValue);node.manualSubmitted=node.value;node.manualSubmission=receipt;}
      else{delete node.manualSubmitted;delete node.manualSubmission;}
    }
  }
  function reconcileNumber(command,events=[]){
    const rejected=command?.status==='rejected',intentId=command?.payload?.clientIntentId||command?.clientIntentId;
    const ids=new Set(events.map(event=>event.id));
    for(const node of [...(footer?.querySelectorAll('[data-manual-hp]')||[]),...(reader?.querySelectorAll('[data-manual-counter]')||[])]){
      const receipt=node.manualSubmission;
      if(receipt&&((rejected&&intentId&&receipt.clientIntentId===intentId)||(receipt.manualEventIds||[]).some(id=>ids.has(id)))){delete node.manualSubmitted;delete node.manualSubmission;}
    }
  }
  function init(mount) {
    if (footer) return true;
    const host = mount || document.getElementById("scene-workbench");
    if (!host) return false;
    footer = document.createElement("section"); footer.id = "scene-manual-footer";
    initiative = document.createElement("nav"); initiative.id = "scene-manual-initiative"; initiative.setAttribute("aria-label", text("participants", "Участники"));
    reader = document.createElement("aside"); reader.id = "scene-manual-reader"; reader.setAttribute("aria-label", text("abilities", "Способности участника"));
    for (const node of [initiative, footer, reader]) {
      node.hidden = true; host.append(node);
      node.addEventListener("click", event => {
        const target = event.target.closest("[data-manual-action]");
        if (target && node.contains(target)) act(target.dataset.manualAction, target.dataset.actorId ?? target.dataset.abilityIndex);
      });
    }
    footer.addEventListener("change", event => { if (paintingFooter) return; if (event.target.matches("[data-manual-hp]")) submitNumber(event.target,false); });
    footer.addEventListener("keydown",event=>{
      if(!event.target.matches("[data-manual-hp]"))return;
      if(event.key==="Enter"){event.preventDefault();submitNumber(event.target,false);}
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();event.target.value=event.target.dataset.manualValue;delete event.target.manualSubmitted;delete event.target.manualSubmission;}
    });
    footer.addEventListener("focusout", event => {
      const target=event.target;
      if(!paintingFooter&&footer.contains(target)&&target.matches("[data-manual-hp]")&&target.value!==target.dataset.manualValue&&target.value!==target.manualSubmitted)submitNumber(target,false);
    });
    reader.addEventListener("change", event => {
      if(paintingReader)return;
      if (event.target.matches("[data-manual-counter]")) submitNumber(event.target,true);
    });
    reader.addEventListener("focusout", event => {
      const target=event.target;
      if(!paintingReader&&reader.contains(target)&&target.matches("[data-manual-counter]")&&target.value!==target.getAttribute("value")&&target.value!==target.manualSubmitted)submitNumber(target,true);
    });
    reader.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if(event.target.matches("[data-manual-counter]"))event.target.value=event.target.getAttribute("value"); act("close-reader"); footer.querySelector('[data-manual-action="read"]')?.focus(); } });
    return true;
  }
  function render(options) {
    const scene = options?.scene;
    // Host may pass a room/scene identity; an unkeyed scene falls back to its reference.
    const nextScope = options?.scopeId != null || scene?.id != null ? `${options?.scopeId ?? scene.id}:${scene?.tablePolicy?.epoch ?? 0}` : scene;
    if (nextScope !== scope) { techniqueFlags.clear(); reading = false; readingActorId = readerActorId = null; scope = nextScope; }
    adapter = options; if (!init(options?.mount)) return model(options); return paint();
  }
  function open(actorId){
    if(!adapter||!isManual(adapter.scene))return false;
    const actor=model(adapter).actors.find(item=>item.id===actorId);if(!actor)return false;
    adapter.beforeRead?.();reading=true;readingActorId=actor.id;paint();return true;
  }
  return Object.freeze({ closeReader:()=>act("close-reader"),render, act, model, open,reconcileNumber});
})();
