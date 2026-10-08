"use strict";

// A data driven control surface for LionWing techniques.  The surface owns
// presentation and dispatch deduplication only; the edition data and the
// LionWing engine remain the authorities for text, validation and state.
(function exposeLionwingTechniqueSurface(global) {
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const text = value => String(value == null ? "" : value);
  const escapeHtml = value => text(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const resourceNames = Object.freeze({ ap: "ОД", focus: "Фокус", influence: "Влияние", health: "Здоровье" });
  const cockpitText = (key, fallback, params = {}) => {
    const plain = () => fallback.replace(/\{(\w+)\}/g, (_, name) => text(params[name] ?? ""));
    try { return global.DAWN_I18N?.t?.("lionwing.cockpit." + key, params, { fallback }) || plain(); } catch { return plain(); }
  };
  const dispatchKeys = new Set();
  const statusFallbacks = Object.freeze({
    ru: Object.freeze({
      "manual.label": "Ручной режим",
      "manual.detail": "Автоматика для этого уровня ещё не подключена. Результат можно записать вручную.",
      "assisted.label": "Авто частично",
      "assisted.detail": "Автоматизируемая часть подключена; остальное остаётся решением Нарратора.",
      "automatic.label": "Автоматически",
      "automatic.detail": "Правило срабатывает при соответствующих действиях и событиях.",
      "off.label": "Автоматизация выключена",
      "off.detail": "Автоматика доступна, но выключена для этого персонажа. Нарратор может включить её здесь.",
      intro: "Включённые техники срабатывают при соответствующих действиях и событиях. Английский оригинал можно раскрыть под описанием.",
      help: "Как использовать техники",
      source: "Оригинал EN и источник",
      canonical: "Канон",
      adapter: "Адаптер",
      translation: "Русский перевод",
      title: "Пульт техник",
      levels: "изученных уровней",
      enabled: "Работает",
      disabled: "Выключено",
      manualCount: "Вручную",
      enableAll: "Включить доступную автоматику",
      use: "Как использовать",
      useAutomatic: "Выполните указанное в описании действие. Бонусы и эффекты применяются автоматически; если нужен выбор, появится отдельное решение.",
      useOff: "Сначала включите автоматику. Затем выполните действие, указанное в описании техники.",
      useManual: "Для этого уровня пока нет автоматического выполнения в LionWing. Согласуйте результат с Нарратором; запись заметки сама не применяет эффекты и не списывает ресурсы.",
      inspect: "Проверить",
      line: "линия",
      zone: "зона 2×2",
    }),
    en: Object.freeze({
      "manual.label": "Manual mode",
      "manual.detail": "Automation is not connected for this level yet. You can record the result manually.",
      "assisted.label": "Partially automated",
      "assisted.detail": "The automatable part is connected; the Narrator decides the rest.",
      "automatic.label": "Automatic",
      "automatic.detail": "The connected adapter applies this part of the rule through the engine.",
      "off.label": "Automation off",
      "off.detail": "Automation is available but turned off for this character. The Narrator can enable it here.",
      intro: "Enabled techniques trigger through their corresponding actions and events. Expand the source below each description to inspect the original rule.",
      help: "How to use techniques",
      source: "Original EN and source",
      canonical: "Canonical",
      adapter: "Adapter",
      translation: "Russian translation",
      title: "Technique console",
      levels: "learned levels",
      enabled: "Enabled",
      disabled: "Disabled",
      manualCount: "Manual",
      enableAll: "Enable available automation",
      use: "How to use",
      useAutomatic: "Perform the action described by the rule. Bonuses and effects apply automatically; a separate decision appears when a choice is required.",
      useOff: "Enable automation first, then perform the action described by the technique.",
      useManual: "This level has no automatic execution in LionWing yet. Agree the result with the Narrator; recording a note does not apply effects or spend resources.",
      inspect: "Preview",
      line: "line",
      zone: "2×2 area",
    }),
  });
  const localeOf = options => {
    const requested = options?.locale || (() => { try { return global.DAWN_I18N?.getLocale?.(); } catch {} return "ru"; })();
    return ["en", "ru"].includes(String(requested || "").toLowerCase().split("-")[0]) ? String(requested).toLowerCase().split("-")[0] : "ru";
  };
  const copy = (key, options = {}) => {
    const locale = localeOf(options), fallback = statusFallbacks[locale]?.[key] ?? statusFallbacks.ru[key] ?? "";
    try {
      const translated = global.DAWN_I18N?.t?.(`lionwing.technique.automation.${key}`, {}, { locale, fallback });
      if (translated && translated !== `lionwing.technique.automation.${key}`) return text(translated);
    } catch {}
    return fallback;
  };
  const localizedText = (value, options = {}) => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const locale = localeOf(options), alternate = locale === "en" ? "ru" : "en";
    for (const key of [locale, alternate, "default", "text", "value"]) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
    return "";
  };
  const canonicalStatusRow = entry => {
    const sources = [global.DAWN_LIONWING_AUTOMATION_STATUS, global.DAWN_LIONWING_AUTOMATION_REGISTRY, canonicalData()?.automationStatus, canonicalData()?.automationRegistry];
    for (const source of sources) {
      const row = source?.rows?.find?.(item => item?.id === entry?.id);
      if (row) return row;
    }
    return null;
  };
  const canonicalStatusReason = (entry, options = {}) => {
    const row = canonicalStatusRow(entry), implementation = row?.implementation || {};
    const plan = implementation.foundationPlan || row?.foundationPlan || {};
    const candidates = [row?.reason, row?.help, implementation.reason, implementation.help, plan.reason, plan.help];
    for (const value of candidates) {
      const result = localizedText(value, options);
      if (result) return result;
    }
    return "";
  };

  const currentScene = () => {
    try { if (typeof Scene !== "undefined") return Scene; } catch {}
    return global.Scene || null;
  };
  const notify = message => {
    try { if (typeof toast === "function") return toast(message); } catch {}
    if (typeof global.toast === "function") return global.toast(message);
    return undefined;
  };
  const canonicalData = () => global.DAWN_LIONWING_DATA || { archetypes: [], editionId: "unknown", locale: "en" };
  const displayArchetypes = (options = {}) => {
    if (localeOf(options) === "en") return canonicalData().archetypes || [];
    const overlay = global.DAWN_LIONWING_RU;
    if (overlay?.editionId === canonicalData().editionId) return (canonicalData().archetypes || []).map(archetype => {
      const translation = overlay.archetypes?.[archetype.id];
      return { ...archetype, name: translation?.name || archetype.name, techniques: (archetype.techniques || []).map(technique => {
        const translated = translation?.techniques?.[technique.id];
        return { ...technique, name: translated?.name || technique.name, levels: (technique.levels || []).map(level => ({ ...level, ...(translated?.levels?.[level.n] || {}) })) };
      }) };
    });
    try {
      if (typeof activeArchetypes === "function") {
        const result = activeArchetypes();
        if (Array.isArray(result)) return result;
      }
    } catch {}
    return canonicalData().archetypes || [];
  };
  const actorById = (scene, id) => (scene?.actors || []).find(actor => actor?.id === id) || null;
  const knownLevel = (actor, techniqueId) => {
    const known = actor?.knownTechniques;
    const source = known && Object.keys(known).length ? known : actor?.techniques;
    return Number(source?.[techniqueId] || 0);
  };
  const displayTechniqueMap = options => new Map(displayArchetypes(options).flatMap(archetype => (archetype.techniques || []).map(technique => [technique.id, technique])));
  const canonicalTechniqueMap = () => new Map((canonicalData().archetypes || []).flatMap(archetype => (archetype.techniques || []).map(technique => [technique.id, technique])));

  function entriesFor(actor, options = {}) {
    if (!actor) return [];
    const displays = displayTechniqueMap(options);
    return (canonicalData().archetypes || []).flatMap(archetype => (archetype.techniques || []).flatMap(technique => {
      const level = knownLevel(actor, technique.id);
      if (level < 1) return [];
      const display = displays.get(technique.id) || technique;
      return (technique.levels || []).filter(row => Number(row.n) <= level).map(row => {
        const displayLevel = (display.levels || []).find(item => Number(item.n) === Number(row.n)) || row;
        return {
          id: technique.id + "." + row.n,
          techniqueId: technique.id,
          archetypeId: archetype.id,
          archetypeName: archetype.name,
          level: Number(row.n),
          canonicalTechniqueName: technique.name,
          displayTechniqueName: display.name || technique.name,
          previousName: technique.previousName || null,
          canonicalLevelName: row.name,
          displayLevelName: displayLevel.name || row.name,
          canonicalText: row.text || "",
          displayText: displayLevel.text || row.text || "",
          canonicalSource: clone(technique.source || { editionId: canonicalData().editionId, locale: "en" }),
        };
      });
    }));
  }

  function adapterRows(actor) {
    const list = global.DAWN_LIONWING_ADAPTERS?.list;
    if (typeof list !== "function") return [];
    try {
      return (list(actor) || []).map(row => {
        const match = /^(.+)\.(\d+)$/.exec(text(row.id));
        return {
          ...row,
          techniqueId: row.techniqueId || match?.[1] || null,
          level: Number(row.level || match?.[2] || 0),
          enabled: row.enabled === true || actor?.lionwing?.automation?.[row.id] === true,
        };
      });
    } catch {
      return [];
    }
  }

  function actionStatuses(scene, actor) {
    if (!scene || !actor) return [];
    const engine = global.DAWN_SCENE_ENGINE;
    if (typeof engine?.availableActions !== "function") return [];
    try {
      const raw = engine.availableActions(scene, canonicalData(), actor.id) || [];
      const translated = global.DAWN_LIONWING_RU?.coreRules?.actions?.entries || {};
      return raw.map(action => ({
        ...action,
        displayName: translated[action.id]?.name || action.name,
        displayText: translated[action.id]?.text || action.text,
      }));
    } catch {
      return [];
    }
  }

  function viewerFor(scene, explicit = {}) {
    if (explicit && (explicit.role || explicit.actorId)) return {
      role: ["owner", "narrator", "gm"].includes(explicit.role) ? explicit.role : "player",
      actorId: explicit.actorId || null,
    };
    let sync = {};
    try { sync = typeof Sync !== "undefined" && typeof Sync?.state === "function" ? Sync.state() || {} : {}; } catch {}
    const localActor = (() => {
      try { return typeof currentHeroActor === "function" ? currentHeroActor() : null; } catch { return null; }
    })();
    let role = "player";
    try {
      if (typeof activeSceneView === "function" && activeSceneView() === "gm") role = "narrator";
      else if (sync.canNarrate) role = "narrator";
    } catch {}
    return { role, actorId: localActor?.id || sync.actorId || null };
  }

  function visibleChoices(scene, viewer = {}) {
    const view = viewerFor(scene, viewer);
    return (scene?.lionwing?.choices || []).filter(choice => {
      if (["owner", "narrator", "gm"].includes(view.role)) return true;
      return choice?.kind !== "technique-trigger" || Boolean(view.actorId && choice.actorId === view.actorId);
    });
  }

  function entryForId(actor, id) {
    return entriesFor(actor).find(entry => entry.id === id) || null;
  }

  function rowsForEntry(entry, adapters) {
    return adapters.filter(row => row.id === entry.id || row.techniqueId === entry.techniqueId && Number(row.level) === Number(entry.level));
  }

  function automationStatus(entry, adapters, scene, actor, viewer, options = {}) {
    const rows = rowsForEntry(entry, adapters), enabled = rows.filter(row => row.enabled), locale = localeOf(options);
    let state = "manual", label = copy("manual.label", { locale }), detail = copy("manual.detail", { locale });
    if (enabled.length) {
      const partial = enabled.some(row => row.coverage === "partial");
      state = partial ? "assisted" : "automatic";
      label = copy(`${state}.label`, { locale });
      detail = copy(`${state}.detail`, { locale });
    } else if (rows.length) {
      state = "off";
      label = copy("off.label", { locale });
      detail = copy("off.detail", { locale });
    }
    const reason = canonicalStatusReason(entry, { locale });
    const choices = visibleChoices(scene, viewer).filter(choice => choice.kind === "technique-trigger" && choice.context?.ruleId === entry.id);
    const receipt = (scene?.log || []).find(event => {
      if (event?.type === "automation.configure") return false;
      const payload = event?.payload || {};
      return (payload.ruleId || payload.techniqueRuleId || payload.sourceRuleId) === entry.id && (!event.actorId || event.actorId === actor?.id);
    }) || null;
    return {
      state,
      label,
      detail,
      reason,
      help: detail,
      rows,
      enabled,
      offer: choices[0] || null,
      receipt,
      manual: manualStatus(scene, actor, viewer),
    };
  }

  function manualStatus(scene, actor, viewer) {
    if (!actor) return { available: false, reason: "Участник не найден." };
    if (actor.knockedOut) return { available: false, reason: "Участник выведен из боя." };
    if (scene?.pendingPrompt || scene?.pendingAction || scene?.pendingActionPlan || scene?.lionwing?.choices?.length) return { available: false, reason: "Сначала завершите текущую цепочку." };
    if (viewer.role === "narrator" || viewer.role === "gm" || viewer.role === "owner") return { available: true, reason: "" };
    if (viewer.actorId !== actor.id) return { available: false, reason: "Это Техника другого участника." };
    if (scene?.activeActorId !== actor.id) return { available: false, reason: "Сейчас Ход другого участника." };
    return { available: true, reason: "" };
  }

  function operationCosts(choice, option = null) {
    const context = choice?.context || {};
    const raw = Array.isArray(context.costs) ? context.costs : [];
    const costs = raw.map(cost => ({
      amount: Number(cost.amount),
      resource: cost.resource || cost.id,
    })).filter(cost => Number.isFinite(cost.amount) && cost.amount > 0 && cost.resource);
    if (costs.length) return costs;
    // Options are mutually exclusive. Without a selected option there is no
    // single price; do not add all the offers together.
    const options = context.choices && typeof context.choices === "object" ? Object.entries(context.choices).filter(([, value]) => Array.isArray(value)) : [];
    const operations = option != null ? context.choices?.[option] || [] : options.length === 1 ? options[0][1] : [];
    return operations.filter(operation => operation?.kind === "resource" && operation.operation === "spend").map(operation => ({
      amount: Number(operation.amount),
      resource: operation.resource,
    })).filter(cost => Number.isFinite(cost.amount) && cost.amount > 0 && cost.resource);
  }

  function resourceLabel(scene, actorId, id) {
    const owner = actorById(scene, actorId);
    return owner?.ruleResources?.[id]?.label || owner?.ruleResources?.[id]?.name || owner?.ruleClocks?.[id]?.label || owner?.ruleClocks?.[id]?.name || owner?.lionwing?.inventory?.definitions?.[id]?.label || resourceNames[id] || (id === "hp" ? cockpitText("health", "Здоровье") : id);
  }

  function formatCosts(costs, scene = currentScene(), actorId = null, complete = false) {
    const rows = (costs || []).map(cost => {
      const name = resourceLabel(scene, cost.actorId || actorId, cost.resource || cost.id);
      const label = Number(cost.amount) + " " + name;
      return cost.direction === "gain" ? cockpitText("invertedPrice", "{price} (увеличение ресурса)", { price: label }) : label;
    });
    return rows.length ? rows.join(" · ") : complete ? cockpitText("noSpend", "Сейчас без расхода ресурсов") : cockpitText("unknownPrice", "Цена уточнится в предпросмотре");
  }

  function previewCosts(scene, result, actorId = null) {
    const after = result?.preview?.scene || result?.prepared?.scene || result?.scene;
    if (!result?.ok || !after || !Array.isArray(after.log)) return { complete: false, costs: [], label: formatCosts([], scene, actorId) };
    const existing = new Set((scene?.log || []).map(event => event.id)), totals = new Map();
    const invertedCosts = new Map();
    const expectFocus = (ownerId, resource, amount) => {
      if(resource!=="focus"||!Number.isFinite(Number(amount))||Number(amount)<=0)return;
      const owner=actorById(scene,ownerId),resolved=Object.entries(owner?.ruleResources||{}).find(([,definition])=>definition.replaces==="focus"&&definition.inverted)?.[0];
      if(resolved){const key=JSON.stringify([ownerId,resolved]);invertedCosts.set(key,Number(invertedCosts.get(key)||0)+Number(amount));}
    };
    for(const owner of after.actors||[]){
      const previous=new Set((actorById(scene,owner.id)?.lionwing?.history||[]).map(row=>row.actionInstanceId));
      for(const action of owner.lionwing?.history||[])if(!previous.has(action.actionInstanceId))for(const cost of action.execution?.costs||[])expectFocus(owner.id,cost.resource,cost.amount);
    }
    const scanRequest=(request,ownerId)=>{
      if(!request)return;
      if(request.kind==="resource"&&request.operation==="spend")expectFocus(request.targetId||ownerId,request.resource,request.amount);
      if(request.kind==="reaction"){const reaction=global.DAWN_LIONWING_ENGINE?.reactionOptions?.(scene,ownerId)?.find(row=>row.id===request.choice);expectFocus(ownerId,reaction?.costModel?.resource,reaction?.costModel?.amount);}
      for(const cost of request.costs||[])expectFocus(ownerId,cost.resource,cost.amount);
      for(const operation of request.operations||[])scanRequest(operation,operation.sourceActorId||ownerId);
      if(request.kind==="choice"){const choice=(scene?.lionwing?.choices||[]).find(row=>row.id===request.id);for(const operation of choice?.context?.choices?.[request.choice]||[])scanRequest(operation,ownerId);}
    };
    for(const event of result?.prepared?.events||result?.events||[])if(event.type==="lionwing.command")scanRequest(event.payload,event.actorId);
    const add = (ownerId, resource, amount, direction = "spend") => {
      if (!Number.isFinite(amount) || amount <= 0 || !resource) return;
      const key = JSON.stringify([ownerId, resource, direction]), before = totals.get(key);
      totals.set(key, { actorId: ownerId, resource, amount: Number(before?.amount || 0) + amount, direction });
    };
    for (const event of after.log.filter(row => !existing.has(row.id)).reverse()) {
      const p = event.payload || {}, ownerId = p.ownerActorId || event.actorId;
      if (actorId && ownerId !== actorId && p.targetId !== actorId) continue;
      if (event.type === "resource.spend" && !(p.requestedResource==="focus"&&p.inverted)) add(ownerId, p.resource, Number(p.amount));
      else if (event.type === "resource.gain" && actorById(scene, ownerId)?.ruleResources?.[p.resource]?.inverted) {
        const key=JSON.stringify([ownerId,p.resource]),amount=Math.min(Number(p.amount||0),Number(invertedCosts.get(key)||0));
        add(ownerId,p.resource,amount,"gain");invertedCosts.set(key,Math.max(0,Number(invertedCosts.get(key)||0)-amount));
      }
      else if (["rule-clock.add", "rule-clock.set", "rule-clock.reset", "rule-resource.add", "rule-resource.set", "rule-resource.reset"].includes(event.type) && p.before != null) add(ownerId, p.id, Number(p.before) - Number(p.value ?? p.current));
      else if (event.type === "health.spend") add(p.targetId || ownerId, "hp", Number(p.lost));
      else if (event.type === "inventory.spend") add(ownerId, p.itemId, Number(p.before) - Number(p.value ?? p.current));
    }
    const costs = [...totals.values()];
    return { complete: true, costs, label: formatCosts(costs, scene, actorId, true), deferred: Boolean(after.pendingAction || after.pendingPrompt || after.lionwing?.choices?.length) };
  }

  function actionPresentation(scene, actorId, request = {}) {
    const engine = global.DAWN_LIONWING_ENGINE, actor = actorById(scene, actorId);
    const gate = engine?.actionGate?.(scene, actorId, request) || { available: false, reason: cockpitText("engineUnavailable", "Проверка действия недоступна") };
    const needsDestination = [global.DAWN_SCENE_ENGINE?.ACTION_IDS?.jump, global.DAWN_SCENE_ENGINE?.ACTION_IDS?.shove, global.DAWN_SCENE_ENGINE?.ACTION_IDS?.improvise].includes(request.actionId) && !request.destination && !request.effect && !request.removeObstacleId;
    let prepared = null;
    if (gate.available && !needsDestination) prepared = engine?.prepare?.(scene, { ...request, kind: "action", actorId }, { random: () => 0 });
    const confirmed = previewCosts(scene, prepared, actorId);
    const quoted = Number.isFinite(gate.cost) && gate.resource ? engine?.resourceQuote?.(scene, actorId, { resource: gate.resource, amount: gate.cost, operation: "spend" }) : null;
    const baseResource = quoted?.resolvedResource || gate.resource;
    const baseLabel = Number.isFinite(gate.cost) && baseResource ? formatCosts([{ actorId, resource: baseResource, amount: gate.cost, direction: actor?.ruleResources?.[baseResource]?.inverted && gate.resource === "focus" ? "gain" : "spend" }], scene, actorId) : "";
    const costLabel = confirmed.complete ? gate.cost === 0 && baseLabel ? baseLabel + (confirmed.costs.length ? " · " + confirmed.label : "") : confirmed.label : baseLabel ? cockpitText("priceAfterSelection", "{price} · итог после выбора", { price: baseLabel }) : cockpitText("unknownPrice", "Цена уточнится в предпросмотре");
    return { gate, available: gate.available, reason: gate.reason || prepared?.errors?.join(" ") || "", costLabel, costComplete: confirmed.complete, costs: confirmed.costs, selectedTargetIds: [...(request.targetIds || [])], needsDestination };
  }

  function resourceCostLabel(scene, actorId, resource, amount) {
    if(!Number.isFinite(Number(amount))||!resource)return cockpitText("unknownPrice","Цена уточнится в предпросмотре");
    const quote=global.DAWN_LIONWING_ENGINE?.resourceQuote?.(scene,actorId,{resource,amount:Number(amount),operation:"spend"}),resolved=quote?.resolvedResource||resource;
    return formatCosts([{actorId,resource:resolved,amount:Number(amount),direction:resource==="focus"&&actorById(scene,actorId)?.ruleResources?.[resolved]?.inverted?"gain":"spend"}],scene,actorId);
  }

  function actionTargets(scene, actorId, request = {}) {
    const engine = global.DAWN_LIONWING_ENGINE, ids = global.DAWN_SCENE_ENGINE?.ACTION_IDS || {};
    if (![ids.spell, ids.skirmish, ids.finish, ids.study, ids.shove, ...(request.effect ? [ids.improvise] : []), "action.атаки.дуэль"].includes(request.actionId) || request.armamentMode || request.areaCenter || request.obstacleId) return [];
    // Probe the complete action contract rather than duplicate range, team,
    // Technique or effect conditions in the interface. No roll is committed.
    return (scene?.actors || []).filter(actor => actor.id !== actorId || request.actionId === ids.improvise).map(actor => {
      const destinations=request.actionId===ids.shove&&!request.destination?[{space:actor.space,x:actor.x+1,y:actor.y},{space:actor.space,x:actor.x-1,y:actor.y},{space:actor.space,x:actor.x,y:actor.y+1},{space:actor.space,x:actor.x,y:actor.y-1}]:[request.destination];
      let prepared=null;
      for(const destination of destinations){prepared=engine?.prepare?.(scene,{...request,kind:"action",actorId,targetIds:[actor.id],...(destination?{destination}:{})},{random:()=>0});if(prepared?.ok)break;}
      return { id: actor.id, name: actor.name || actor.id, available: prepared?.ok === true, reason: prepared?.errors?.join(" ") || "" };
    });
  }

  function choiceTargetIds(choice, option = null) {
    const context = choice?.context || {}, ids = [];
    const add = value => {
      if (typeof value === "string" && value) ids.push(value);
    };
    add(context.targetId);
    if (Array.isArray(context.targetIds)) context.targetIds.forEach(add);
    if (context.choices && typeof context.choices === "object") {
      for (const operations of option == null ? Object.values(context.choices) : [context.choices[option]]) {
        for (const operation of Array.isArray(operations) ? operations : []) {add(operation?.targetId);if(Array.isArray(operation?.targetIds))operation.targetIds.forEach(add);}
      }
    }
    return [...new Set(ids)];
  }

  function choiceTargets(choice, scene) {
    const names = choiceTargetIds(choice).map(id => actorById(scene, id)?.name || id);
    return names.length ? "Цели: " + names.join(", ") : "";
  }

  function choiceVariant(choice) {
    const context = choice?.context || {};
    const value = context.variant ?? context.mode ?? context.shape ?? context.direction;
    return value == null || value === "" ? "" : "Вариант: " + text(value);
  }

  function cancellationSuffix(option, label) {
    const key = text(option).toLocaleLowerCase();
    if (!["skip", "pass", "cancel", "decline", "none", "no"].includes(key)) return "";
    return /(отмен|не использ|пропуст|не выбирать|не создавать|не использовать)/i.test(text(label)) ? "" : " · отмена";
  }

  function deadline(choice, scene) {
    const context = choice?.context || {};
    if (context.followup && context.deadline === "anyTurnStart") return "до начала следующего Хода любого участника";
    if (context.followup && context.deadline === "anyTurnEnd") return "до конца следующего Хода любого участника";
    if (context.deadline) return text(context.deadline);
    if (context.expiresAt) return "до " + text(context.expiresAt);
    if (scene?.lionwing?.executionCursor?.status === "waiting") return "до продолжения текущей цепочки";
    return "до ответа на это решение";
  }

  function modelFor(scene, actorOrId, options = {}) {
    const actor = typeof actorOrId === "string" ? actorById(scene, actorOrId) : actorOrId;
    const viewer = viewerFor(scene, options.viewer);
    const entries = entriesFor(actor, options);
    const adapters = adapterRows(actor);
    const actions = actionStatuses(scene, actor);
    const locale = localeOf(options);
    const statuses = entries.map(entry => ({ entry, status: automationStatus(entry, adapters, scene, actor, viewer, { locale }) }));
    const offers = statuses.filter(item => item.status.offer);
    return {
      scene,
      actor,
      viewer,
      locale,
      entries,
      adapters,
      statuses,
      offers,
      actions,
      actionSummary: { total: actions.length, available: actions.filter(action => action.available).length },
      manual: manualStatus(scene, actor, viewer),
    };
  }

  function sourceLabel(source) {
    if (!source) return "Источник LionWing не указан";
    const page = source.pdfPage != null ? " · стр. " + source.pdfPage : "";
    return "LionWing EN" + page;
  }

  function receiptLabel(receipt) {
    if (!receipt) return "";
    const payload = receipt.payload || {};
    const kind = receipt.type === "rule.activated" ? "сработало" : receipt.type === "rule.completed" ? "завершено" : ["technique.resolve", "effect.apply"].includes(receipt.type) ? "применено" : "записано";
    return "Последнее: " + kind + (payload.outcome ? " · " + payload.outcome : "");
  }

  function actionCostLabel(action) {
    if (action.costModel?.amount != null) return Number(action.costModel.amount) + " " + (resourceNames[action.costModel.resource] || action.costModel.resource || "");
    if (typeof action.cost === "string") return action.cost;
    if (action.cost?.amount != null) return Number(action.cost.amount) + " " + (resourceNames[action.cost.resource] || action.cost.resource || "");
    return "";
  }

  // An adapter choice is already an authoritative operation offer.  Keep the
  // bridge deliberately small: it turns the offer into a reviewable action,
  // then asks the LionWing engine to prepare and preview the exact event
  // batch before anything is sent to the table.
  const actionPreviews = new Map();
  function operationList(action) {
    if (Array.isArray(action?.operations)) return action.operations;
    const choices = action?.choice?.context?.choices;
    return choices && Array.isArray(choices[action.option]) ? choices[action.option] : [];
  }
  function operationSourceDigests(operations) {
    return [...new Set((operations || []).map(operation => operation?.sourceDigest).filter(Boolean))];
  }
  function actionFromChoice(scene, choice, option, actor) {
    const operations = operationList({ choice, option });
    const context = choice?.context || {};
    const digests = operationSourceDigests(operations);
    const entry = entryForId(actor, context.ruleId);
    return {
      id: "choice:" + choice.id + ":" + option,
      kind: "choice",
      actorId: actor?.id || choice?.actorId || null,
      ruleId: context.ruleId || null,
      techniqueRuleId: context.ruleId || null,
      title: entry ? entry.displayTechniqueName + " · " + entry.displayLevelName : choice.title || "Сработала Техника",
      level: Number(String(context.ruleId || "").match(/\.(\d+)$/)?.[1] || 0),
      option,
      label: context.optionLabels?.[option] || option,
      choice,
      operations,
      targetIds: choiceTargetIds(choice, option),
      destinationRequired: Boolean(context.destinationRequired),
      sourceDigest: context.sourceDigest || (digests.length === 1 ? digests[0] : digests),
      available: true,
      reason: "Выбор доступен текущему владельцу решения.",
    };
  }
  function operationAction(scene, actor, descriptor = {}) {
    const operations = Array.isArray(descriptor.operations) ? descriptor.operations : [];
    const digests = operationSourceDigests(operations);
    return {
      id: descriptor.id || "operation:" + actor?.id + ":" + (descriptor.ruleId || operations[0]?.ruleId || "action"),
      kind: "operations",
      actorId: actor?.id || descriptor.actorId || null,
      ruleId: descriptor.ruleId || operations[0]?.ruleId || null,
      techniqueRuleId: descriptor.techniqueRuleId || descriptor.ruleId || operations[0]?.ruleId || null,
      title: descriptor.title || descriptor.label || "Действие Техники",
      level: Number(descriptor.level || String(descriptor.ruleId || "").match(/\.(\d+)$/)?.[1] || 0),
      label: descriptor.label || descriptor.title || "Выполнить",
      operations,
      targetIds: descriptor.targetIds || [...new Set(operations.map(operation => operation?.targetId).filter(Boolean))],
      destinationRequired: Boolean(descriptor.destinationRequired),
      sourceDigest: descriptor.sourceDigest || (digests.length === 1 ? digests[0] : digests),
      available: descriptor.available !== false,
      reason: descriptor.reason || (descriptor.available === false ? "Условия Техники не выполнены." : "Операция доступна."),
    };
  }
  function adapterActions(scene, actorOrId, options = {}) {
    const actor = typeof actorOrId === "string" ? actorById(scene, actorOrId) : actorOrId;
    if (!scene || !actor) return [];
    const viewer = viewerFor(scene, options.viewer);
    return visibleChoices(scene, viewer).filter(choice => choice?.kind === "technique-trigger" && choice.actorId === actor.id)
      .flatMap(choice => (choice.options || []).map(option => actionFromChoice(scene, choice, option, actor)));
  }
  function actionRequest(action) {
    if (action.kind === "choice") return { kind: "choice", actorId: action.actorId, id: action.choice.id, choice: action.option };
    return { kind: "batch", actorId: action.actorId, operations: operationList(action) };
  }
  function previewAction(scene, action) {
    const engine = global.DAWN_LIONWING_ENGINE;
    if (!engine?.prepare || !engine?.previewEvents) return { ok: false, errors: ["Конвейер предпросмотра Техники недоступен."] };
    if (!action?.actorId || !["choice", "operations"].includes(action.kind)) return { ok: false, errors: ["Действие Техники повреждено."] };
    if (action.kind === "operations" && !operationList(action).length) return { ok: false, errors: ["Пакет операций Техники пуст."] };
    try {
      const prepared = engine.prepare(scene, actionRequest(action));
      if (!prepared?.ok) return prepared || { ok: false, errors: ["Действие Техники недоступно."] };
      const checked = engine.previewEvents(scene, prepared.events, { expectedVersion: Number(scene.version || 0) });
      if (!checked?.ok) return checked || { ok: false, errors: ["Предпросмотр отклонён ядром."] };
      return { ok: true, action, prepared, preview: checked, sceneVersion: Number(scene.version || 0), events: prepared.events };
    } catch (error) {
      return { ok: false, errors: [error?.message || "Предпросмотр отклонён ядром."] };
    }
  }
  function commitAction(scene, preview, options = {}) {
    if (!preview?.ok || !Array.isArray(preview.events)) return { ok: false, errors: ["Нет подтверждённого предпросмотра."] };
    const expectedVersion = Number(scene?.version || 0);
    if (Number(preview.sceneVersion) !== expectedVersion) return { ok: false, stale: true, errors: ["Сцена изменилась: предпросмотр устарел."] };
    const engine = global.DAWN_LIONWING_ENGINE;
    const checked = engine?.previewEvents?.(scene, preview.events, { expectedVersion });
    if (!checked?.ok) return { ok: false, stale: true, errors: checked?.errors || ["Предпросмотр устарел."] };
    const commit = options.commit || global.commitSceneEvents || (() => { try { return typeof commitSceneEvents === "function" ? commitSceneEvents : null; } catch { return null; } })();
    if (typeof commit === "function") {
      const result = commit(options.label || preview.action?.title || "Действие Техники", preview.events);
      return result === undefined ? { ok: true } : result;
    }
    if (!engine?.dispatchMany) return { ok: false, errors: ["Конвейер записи Техники недоступен."] };
    return { ok: true, ...engine.dispatchMany(scene, preview.events, { expectedVersion }) };
  }
  function cancelAction(key) {
    if (key) actionPreviews.delete(key);
    return true;
  }
  function actionSourceLabel(action) {
    const value = action?.sourceDigest;
    if (Array.isArray(value)) return value.length ? value.join(" · ") : "Источник не указан";
    return value || "Источник не указан";
  }
  function previewHtml(action, result = null, key = "") {
    const targets = (action?.targetIds || []).map(id => actorById(currentScene(), id)?.name || id).join(", ");
    const cost = previewCosts(currentScene(), result, action?.actorId).label;
    const status = result?.ok ? "Предпросмотр подтверждён ядром. Проверьте цель и стоимость." : result?.errors?.join(" ") || "";
    return "<div class=\"lw-technique-action-preview\" data-lw-technique-preview-result=\"" + escapeHtml(key) + "\"><p><b>Предпросмотр:</b> " + escapeHtml(status || "нажмите «Проверить»") + "</p><p>Цель: " + escapeHtml(targets || (action?.destinationRequired ? "выберите клетку на поле" : "указана в операции")) + " · Стоимость: " + escapeHtml(cost) + "</p><details><summary>" + escapeHtml(cockpitText("ruleSource","Источник правила")) + "</summary>" + escapeHtml(actionSourceLabel(action)) + "</details>" + (result?.ok ? "<div class=\"button-row\"><button type=\"button\" data-lw-technique-commit=\"" + escapeHtml(key) + "\">Выполнить</button><button type=\"button\" data-lw-technique-cancel=\"" + escapeHtml(key) + "\">Отменить</button></div>" : "") + "</div>";
  }
  function renderActionControl(action, options = {}) {
    if (!action) return "";
    const key = String(options.key || action.id);
    const disabled = action.available === false || options.canRespond === false ? " disabled" : "";
    const targets = (action.targetIds || []).map(id => actorById(currentScene(), id)?.name || id).join(", ");
    actionPreviews.set("action:" + key, { action });
    return "<article class=\"lw-technique-action\" data-lw-technique-action-card=\"" + escapeHtml(key) + "\"><header><strong>" + escapeHtml(action.title || action.label || "Действие Техники") + (action.level ? " · " + escapeHtml(action.level) : "") + "</strong><small>" + escapeHtml(action.available === false || options.canRespond === false ? "недоступно" : "доступно для проверки") + "</small></header><p>Причина: " + escapeHtml(options.canRespond === false ? options.reason || cockpitText("otherOwner", "Решение доступно владельцу участника") : action.reason || "условия выполнены") + "</p><p>Цель: " + escapeHtml(targets || (action.destinationRequired ? "выберите клетку на поле" : "указана в операции")) + " · Стоимость: " + escapeHtml(cockpitText("unknownPrice", "Цена уточнится в предпросмотре")) + "</p><details><summary>" + escapeHtml(cockpitText("ruleSource", "Источник правила")) + "</summary>" + escapeHtml(actionSourceLabel(action)) + "</details><button type=\"button\" data-lw-technique-action=\"true\" data-lw-action-id=\"" + escapeHtml(key) + "\" data-lw-actor=\"" + escapeHtml(action.actorId || "") + "\"" + disabled + ">Проверить</button><div data-lw-technique-preview-host></div></article>";
  }

  function renderManualControls(entry, status, actor, model) {
    const shouldShow = status.state === "manual" || status.state === "off" || ["owner", "narrator", "gm"].includes(model.viewer.role);
    if (!shouldShow) return "";
    const label = cockpitText("recordNote", "Сохранить заметку");
    const disabled = model.manual.available ? "" : " disabled";
    const title = model.manual.reason || "Сохранить источник и решение в журнале";
    const selectedTargets = (model.scene?.targetIds || []).map(id => actorById(model.scene, id)?.name || id).filter(Boolean);
    const targetHint = selectedTargets.length ? "Цели на поле: " + selectedTargets.join(", ") : "Цели выберите на поле; заметка сохранит остальные детали.";
    return "<details class=\"lw-technique-manual-panel\"><summary>Записать результат вручную</summary><div class=\"lw-technique-manual\"><label>Заметка Нарратора<input data-lw-technique-note maxlength=\"500\" placeholder=\"Итог или выбранные цели\"></label><button type=\"button\" data-lw-technique-manual data-lw-technique-id=\"" + escapeHtml(entry.id) + "\" data-lw-actor=\"" + escapeHtml(actor.id) + "\"" + disabled + " title=\"" + escapeHtml(title) + "\">" + label + "</button><small>" + escapeHtml(targetHint) + "</small>" + (model.manual.available ? "" : "<small>" + escapeHtml(title) + "</small>") + "</div></details>";
  }

  function renderRuleSource(entry, adapterSource, locale, reason = "") {
    return "<details class=\"lw-technique-original lw-technique-translation\"><summary>" + escapeHtml(copy("source", { locale })) + "</summary>" +
      "<small class=\"lw-technique-source\">" + escapeHtml(copy("canonical", { locale })) + ": " + escapeHtml(sourceLabel(entry.canonicalSource)) + "</small>" +
      adapterSource + "<p><b>" + escapeHtml(entry.canonicalTechniqueName + " · " + entry.canonicalLevelName) + "</b></p><p class=\"lw-technique-canonical\"><b>EN:</b> " + escapeHtml(entry.canonicalText) + "</p>" + (reason ? "<p>" + escapeHtml(reason) + "</p>" : "") + "</details>";
  }

  // Navigation to existing commands, never a second implementation of a rule.
  const actionGuides = Object.freeze({
    "ruiner.cryomancer": ["action.атаки.заклинание"],
    "ruiner.student-of-stars": ["action.утилитарные-действия.зарядка", "action.атаки.завершение"],
    "powerhouse.breacher": ["action.атаки.завершение"],
    "vagabond.skirmisher": ["action.движение.шаг", "action.атаки.стычка"],
    "powerhouse.dragonslayer": ["action.утилитарные-действия.передышка", "action.атаки.завершение"],
    "vagabond.cunning-fighter": ["action.утилитарные-действия.изучение"],
    "disruptor.chemist": ["action.утилитарные-действия.импровизация"],
  });
  const usageGuides = Object.freeze({
    "vagabond.cunning-fighter": "Изучение пополняет Хитрый план. Для скидки откройте «Параметры действия», отметьте «Хитрый план» и выполните действие, кроме Атаки.",
    "disruptor.chemist": "Для Сублимации откройте «Параметры действия», выберите препятствие и выполните Атаку. Затем появится выбор создания Газа.",
    "ruiner.creation-ascetic": "Передышка и Зарядка пополняют Материал. Используйте выбор формы выше; препятствие для Атаки выбирается в «Параметрах действия».",
    "powerhouse.gunslinger": "Назначьте цели Пуль выше и выполните Стычку. Повторяющаяся цель получает отдельное попадание каждой Пули.",
    "vagabond.enchained": "Выберите якорь кнопкой выше, подтвердите Заклинание, затем выберите и подтвердите клетку раскачивания в появившемся решении.",
    "disruptor.hunter": "Выберите тип ловушки выше, клетку на поле и подтвердите Атаку. В появившемся решении подтвердите установку ловушки.",
    "altruist.gourmand": "Выберите соседнего союзника на поле и передайте порцию кнопкой выше. Решение предложит Укрепление или Ускорение.",
  });
  function renderUsage(entry, status, model) {
    const key = status.state === "manual" ? "useManual" : status.state === "off" ? "useOff" : "useAutomatic";
    const buttons = ["automatic", "assisted"].includes(status.state) ? (actionGuides[entry.techniqueId] || []).map(id => {
      const action = model.actions.find(row => row.id === id);
      if (!action) return "";
      return '<button type="button" data-lw-action-guide="' + escapeHtml(id) + '" data-lw-actor="' + escapeHtml(model.actor.id) + '" title="' + escapeHtml(action.reason || actionCostLabel(action)) + '">' + escapeHtml(cockpitText("openAction", "К действию «{action}»", { action: action.displayName || action.name })) + "</button>";
    }).join("") : "";
    const guide = ["automatic", "assisted"].includes(status.state) && model.locale !== "en" ? usageGuides[entry.techniqueId] : null;
    const help = guide ? global.DAWN_I18N?.t?.(`lionwing.technique.usage.${entry.techniqueId}`, {}, {fallback:guide}) || guide : copy(key, model);
    return '<div class="lw-technique-usage"><b>' + escapeHtml(copy("use", model)) + '</b><p>' + escapeHtml(help) + '</p>' + (buttons ? '<div class="button-row">' + buttons + '</div>' : '') + '</div>';
  }

  function enableOperations(actorOrId, scene = currentScene()) {
    const actor = typeof actorOrId === "string" ? actorById(scene, actorOrId) : actorOrId;
    return adapterRows(actor).filter(row => !row.enabled).map(row => ({ kind: "automation", ruleId: row.id, enabled: true }));
  }

  function renderAutomationControls(status, actor, model) {
    if (!["owner", "narrator", "gm"].includes(model.viewer.role)) return "";
    return status.rows.filter(row => row.configurable !== false).map(row => {
      const variant = row.id === "ruiner.student-of-stars.2-line" ? copy("line", model) : row.id === "ruiner.student-of-stars.2-zone" ? copy("zone", model) : "";
      return "<button type=\"button\" data-lw-automation=\"" + escapeHtml(row.id) + "\" data-lw-actor=\"" + escapeHtml(actor.id) + "\" data-lw-enabled=\"" + (!row.enabled) + "\">" + (row.enabled ? "Выключить автоматику" : "Включить автоматику") + (variant ? " · " + escapeHtml(variant) : "") + "</button>";
    }).join("");
  }

  function descriptionHtml(entry) {
    const content = typeof global.ruleTextMarkup === "function" ? global.ruleTextMarkup(entry.displayText) : null;
    return content == null ? '<p class="lw-technique-description lw-technique-canonical">' + escapeHtml(entry.displayText) + '</p>' : '<div class="lw-technique-description lw-technique-canonical">' + content + '</div>';
  }

  function renderLevel(item, actor, model) {
    const entry = item.entry, status = item.status;
    const offer = status.offer;
    const offerLabels = offer?.context?.optionLabels || {};
    const optionText = offer ? (offer.options || []).map(option => offerLabels[option] || option).join(" · ") : "";
    const offerDetails = offer ? [choiceTargets(offer, model.scene), choiceVariant(offer)].filter(Boolean).join(" · ") : "";
    const offerHtml = offer ? "<p class=\"lw-technique-offer\" role=\"status\"><b>Нужно решение</b> · " + escapeHtml(optionText) + (offerDetails ? " · " + escapeHtml(offerDetails) : "") + " · срок: " + escapeHtml(deadline(offer, model.scene)) + "</p>" : "";
    const adapterDigests = [...new Set(status.rows.map(row => row.sourceDigest).filter(Boolean))];
    const adapterSource = adapterDigests.length ? "<small class=\"lw-technique-source\">" + escapeHtml(copy("adapter", { locale: model.locale })) + ": " + escapeHtml(adapterDigests.join(" · ")) + "</small>" : "";
    return "<article class=\"lw-technique-level\" data-lw-technique-level=\"" + escapeHtml(entry.id) + "\">" +
      "<header><strong>" + escapeHtml(entry.level + ". " + (entry.displayLevelName || entry.canonicalLevelName)) + "</strong><span class=\"lw-technique-status " + escapeHtml(status.state) + "\">" + escapeHtml(status.label) + "</span></header>" +
      descriptionHtml(entry) +
      renderRuleSource(entry, adapterSource, model.locale, status.reason) +
      "<p class=\"lw-technique-automation\"><b>" + escapeHtml(status.label) + ":</b> " + escapeHtml(status.detail) + (status.receipt ? " · " + escapeHtml(receiptLabel(status.receipt)) : "") + "</p>" +
      (typeof techniqueVerificationMarkup === "function" ? techniqueVerificationMarkup(entry.techniqueId, entry.level) : "") +
      renderAutomationControls(status, actor, model) + offerHtml + renderManualControls(entry, status, actor, model) + "</article>";
  }

  function openPreference(key, fallback) {
    try {
      const value = global.localStorage?.getItem("dawn-lionwing-techniques:" + key);
      return value == null ? fallback : value === "1";
    } catch {
      return fallback;
    }
  }

  function render(actorOrId, options = {}) {
    const scene = options.scene || currentScene();
    const model = modelFor(scene, actorOrId, options);
    if (!model.actor || !model.entries.length) return "";
    model.scene = scene;
    const groups = new Map();
    for (const item of model.statuses) {
      const key = item.entry.techniqueId;
      if (!groups.has(key)) groups.set(key, { techniqueId: key, name: item.entry.displayTechniqueName, canonicalName: item.entry.canonicalTechniqueName, previousName: item.entry.previousName, levels: [] });
      groups.get(key).levels.push(item);
    }
    const activeCount = model.statuses.filter(item => ["automatic", "assisted"].includes(item.status.state)).length;
    const offCount = model.statuses.filter(item => item.status.state === "off").length;
    const manualCount = model.statuses.filter(item => item.status.state === "manual").length;
    const offerCount = model.offers.length;
    const directActions = (options.actions || []).map(item => operationAction(scene, model.actor, item));
    const groupHtml = [...groups.values()].map(group => {
      const controls = options.controls?.[group.techniqueId] || "";
      const usage = group.levels.find(item => ["automatic", "assisted"].includes(item.status.state)) || group.levels[0];
      return "<details class=\"lw-technique-group\" data-lw-technique-group=\"" + escapeHtml(group.techniqueId) + "\"" + (group.levels.some(item => item.status.offer) || openPreference(group.techniqueId, false) ? " open" : "") + "><summary><strong>" + escapeHtml(group.name) + "</strong><small>" + group.levels.length + " Уров." + (group.levels.some(item => item.status.offer) ? " · есть решение" : "") + "</small></summary><div>" + controls + renderUsage(usage.entry, usage.status, model) + group.levels.map(item => renderLevel(item, model.actor, model)).join("") + "</div></details>";
    }).join("");
    const outerOpen = offerCount > 0 || openPreference("surface:" + model.actor.id, true);
    const intro = "<details class=\"lw-technique-help\"><summary>" + escapeHtml(copy("help", model)) + "</summary><p class=\"lw-technique-intro\">" + escapeHtml(copy("intro", { locale: model.locale })) + "</p></details>";
    const actionHtml = directActions.length ? "<div class=\"lw-technique-action-list\" aria-label=\"Действия Техник\">" + directActions.map(action => renderActionControl(action, { canRespond: model.manual.available, reason: model.manual.reason })).join("") + "</div>" : "";
    const summary = [["enabled", activeCount], ["disabled", offCount], ["manualCount", manualCount]].filter(([, count]) => count).map(([key, count]) => copy(key, model) + ": " + count).join(" · ");
    const enable = ""; // Mode is selected only in the table menu.
    return "<details class=\"lw-technique-surface\" data-lw-technique-surface data-lw-technique-actor=\"" + escapeHtml(model.actor.id) + "\"" + (outerOpen ? " open" : "") + "><summary><strong>" + escapeHtml(copy("title", model)) + " · " + groups.size + "</strong><small>" + model.entries.length + " " + escapeHtml(copy("levels", model)) + " · " + escapeHtml(summary) + (offerCount ? " · " + offerCount + " требует решения" : "") + "</small></summary>" + intro + enable + actionHtml + "<div class=\"lw-technique-groups\">" + groupHtml + "</div></details>";
  }

  function pendingHtml(choice, options = {}) {
    const scene = options.scene || currentScene(), actor = actorById(scene, choice?.actorId), viewer = viewerFor(scene, options.viewer);
    const canRespond = options.canRespond !== undefined ? Boolean(options.canRespond) : ["owner", "narrator", "gm"].includes(viewer.role) || viewer.actorId === choice?.actorId;
    const locale = localeOf(options), entry = entriesFor(actor, { locale }).find(item => item.id === choice?.context?.ruleId);
    const labels = choice?.context?.optionLabels || {};
    const optionsHtml = (choice?.options || []).map(option => {
      const label = labels[option] || option;
      const cancel = cancellationSuffix(option, label);
      const selectedAction = actionFromChoice(scene, choice, option, actor);
      const checked = selectedAction.destinationRequired && operationList(selectedAction).some(operation => operation.kind === "move" && !operation.destination) ? null : previewAction(scene, selectedAction);
      const price = previewCosts(scene, checked, choice.actorId).label;
      const reason = !canRespond ? cockpitText("otherOwner", "Решение доступно владельцу участника") : checked?.ok === false ? checked.errors?.join(" ") || "" : "";
      return "<div class=\"lw-technique-choice-option\"><button type=\"button\" data-lw-technique-action=\"true\" data-lw-technique-choice=\"true\" data-lw-choice=\"" + escapeHtml(option) + "\" data-lw-choice-id=\"" + escapeHtml(choice.id) + "\" data-lw-actor=\"" + escapeHtml(choice.actorId) + "\"" + (canRespond && checked?.ok !== false ? "" : " disabled") + ">Проверить: " + escapeHtml(label + cancel) + "</button><small>" + escapeHtml(price) + (reason ? " · " + escapeHtml(reason) : "") + "</small></div>";
    }).join("");
    const description = entry ? descriptionHtml(entry) : "";
    const details = [choiceTargets(choice, scene), choiceVariant(choice)].filter(Boolean).join(" · ");
    const wait = canRespond ? "<div class=\"button-row\">" + optionsHtml + "</div>" : "<p>Ожидается решение владельца героя.</p>";
    const digests = [...new Set([choice.context?.sourceDigest, ...(choice.options || []).flatMap(option => operationSourceDigests(operationList({ choice, option })))].filter(Boolean))];
    const digestHtml = digests.length ? "<small class=\"lw-technique-source\">Источник адаптера: " + escapeHtml(digests.join(" · ")) + "</small>" : "";
    const source = entry ? renderRuleSource(entry, digestHtml, locale) : digestHtml ? "<details><summary>" + escapeHtml(cockpitText("ruleSource","Источник правила")) + "</summary>" + digestHtml + "</details>" : "";
    return "<section class=\"lw-pending lw-technique-offer\" data-lw-technique-offer=\"" + escapeHtml(choice.id) + "\"><header><strong>" + escapeHtml(actor?.name || "Участник") + ": " + escapeHtml(entry ? entry.displayTechniqueName + " · " + entry.displayLevelName : choice.title || "Сработала Техника") + "</strong><span>Срок: " + escapeHtml(deadline(choice, scene)) + "</span></header>" + description + source + (details ? "<p><b>" + escapeHtml(details) + "</b></p>" : "") + "<p><b>Причина доступности:</b> " + escapeHtml(canRespond ? "решение принадлежит текущему участнику" : "ожидается решение владельца") + "</p><p>" + escapeHtml(cockpitText("optionPrices", "Стоимость показана для каждого варианта; итог проверяется перед подтверждением.")) + "</p>" + wait + "<div data-lw-technique-preview-host></div></section>";
  }

  function dispatchOnce(key, action) {
    if (dispatchKeys.has(key)) return false;
    dispatchKeys.add(key);
    try {
      const result = action();
      if (result === false) dispatchKeys.delete(key);
      return result === undefined ? true : result;
    } catch (error) {
      dispatchKeys.delete(key);
      throw error;
    }
  }

  function submitChoice(button) {
    const scene = currentScene(), actorId = button.dataset.lwActor, choiceId = button.dataset.lwChoiceId, choice = scene?.lionwing?.choices?.[0];
    if (!scene || !actorId || !choiceId || !choice || choice.id !== choiceId) return false;
    const submit = global.lwSubmit || (() => { try { return typeof lwSubmit === "function" ? lwSubmit : null; } catch { return null; } })();
    if (typeof submit !== "function") return false;
    const key = "choice:" + scene.version + ":" + choiceId + ":" + button.dataset.lwChoice;
    return dispatchOnce(key, () => submit(actorId, { kind: "choice", id: choiceId, choice: button.dataset.lwChoice }, "Решение Техники"));
  }

  function previewButton(button) {
    const scene = currentScene(), actor = actorById(scene, button.dataset.lwActor), choice = scene?.lionwing?.choices?.find(item => item.id === button.dataset.lwChoiceId), option = button.dataset.lwChoice;
    if (button.dataset.lwActionId && !choice) {
      const stored = actionPreviews.get("action:" + button.dataset.lwActionId), action = stored?.action;
      if (!scene || !action) return false;
      const result = previewAction(scene, action), key = scene.version + ":" + action.id;
      const host = button.closest("[data-lw-technique-action-card]")?.querySelector("[data-lw-technique-preview-host]");
      if (result.ok) actionPreviews.set(key, result); else actionPreviews.delete(key);
      if (host) host.innerHTML = previewHtml(action, result, key);
      if (!result.ok) notify(result.errors.join(" "));
      return result.ok;
    }
    if (!scene || !actor || !choice || !option || !choice.options?.includes(option)) return false;
    const action = actionFromChoice(scene, choice, option, actor);
    const pickDestination = global.lwBeginTechniqueChoiceDestination || (() => { try { return typeof lwBeginTechniqueChoiceDestination === "function" ? lwBeginTechniqueChoiceDestination : null; } catch { return null; } })();
    if (action.destinationRequired && typeof pickDestination === "function" && pickDestination(choice, actionRequest(action), action.label)) return true;
    const result = previewAction(scene, action), key = scene.version + ":" + action.id;
    const host = button.closest("[data-lw-technique-offer]")?.querySelector("[data-lw-technique-preview-host]");
    if (result.ok) actionPreviews.set(key, result); else actionPreviews.delete(key);
    if (host) host.innerHTML = previewHtml(action, result, key);
    if (!result.ok) notify(result.errors.join(" "));
    return result.ok;
  }
  function commitButton(button) {
    const key = button.dataset.lwTechniqueCommit, result = actionPreviews.get(key), scene = currentScene();
    if (!result || !scene) return false;
    const committed = commitAction(scene, result);
    if (committed?.ok !== false) { actionPreviews.delete(key); return true; }
    notify((committed.errors || ["Действие Техники отклонено."]).join(" "));
    return false;
  }

  function submitManual(button) {
    const scene = currentScene(), actor = actorById(scene, button.dataset.lwActor), entry = entryForId(actor, button.dataset.lwTechniqueId);
    if (!scene || !actor || !entry) return false;
    const model = modelFor(scene, actor), note = button.closest("[data-lw-technique-level]")?.querySelector("[data-lw-technique-note]")?.value || "";
    if (!model.manual.available) { notify(model.manual.reason); return false; }
    const engine = global.DAWN_TECHNIQUE_ENGINE;
    if (!engine?.manualPreview) { notify("Предпросмотр ручной Техники недоступен."); return false; }
    const prepared = engine.manualPreview(scene, {
      actorId: actor.id,
      entry: { id: entry.id, techniqueId: entry.techniqueId, techniqueName: entry.displayTechniqueName, level: entry.level, name: entry.displayLevelName, canonicalText: entry.canonicalText, canonicalSource: entry.canonicalSource },
      targetIds: [...(scene.targetIds || [])],
      note: text(note).slice(0, 500),
    });
    if (!prepared.ok) { notify(prepared.errors.join(" ")); return false; }
    const key = "manual:" + scene.version + ":" + actor.id + ":" + entry.id;
    return dispatchOnce(key, () => {
      const commit = global.commitTechniquePreview || (() => { try { return typeof commitTechniquePreview === "function" ? commitTechniquePreview : null; } catch { return null; } })();
      if (typeof commit === "function") {
        const result = commit(prepared);
        return result === undefined ? true : result;
      }
      const commitEvents = global.commitSceneEvents;
      if (typeof commitEvents !== "function") { notify("Конвейер записи Техники недоступен."); return false; }
      return Boolean(commitEvents(entry.displayLevelName, engine.toEvents(scene, prepared)));
    });
  }

  if (global.document?.addEventListener) {
    global.document.addEventListener("click", event => {
      const commit = event.target.closest?.("[data-lw-technique-commit]");
      if (commit) {
        event.preventDefault();
        event.stopImmediatePropagation();
        try { commitButton(commit); } catch (error) { notify(error.message || "Предпросмотр устарел."); }
        return;
      }
      const cancel = event.target.closest?.("[data-lw-technique-cancel]");
      if (cancel) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelAction(cancel.dataset.lwTechniqueCancel);
        cancel.closest("[data-lw-technique-preview-result]")?.replaceChildren();
        return;
      }
      const action = event.target.closest?.("[data-lw-technique-action]");
      if (action) {
        event.preventDefault();
        event.stopImmediatePropagation();
        try { previewButton(action); } catch (error) { notify(error.message || "Предпросмотр отклонён."); }
        return;
      }
      const manual = event.target.closest?.("[data-lw-technique-manual]");
      if (manual) {
        event.preventDefault();
        event.stopImmediatePropagation();
        try { submitManual(manual); } catch (error) { notify(error.message || "Не удалось записать ручное правило."); }
        return;
      }
      const choice = event.target.closest?.("[data-lw-technique-choice]");
      if (choice) {
        event.preventDefault();
        event.stopImmediatePropagation();
        try { submitChoice(choice); } catch (error) { notify(error.message || "Решение устарело."); }
      }
    }, true);
    global.document.addEventListener("toggle", event => {
      const details = event.target;
      if (!details.matches?.("[data-lw-technique-surface], [data-lw-technique-group], [data-lw-action-section]")) return;
      try {
        const key = details.hasAttribute("data-lw-action-section") ? "actions:" + details.dataset.lwTechniqueActor : details.hasAttribute("data-lw-technique-surface") ? "surface:" + details.dataset.lwTechniqueActor : details.dataset.lwTechniqueGroup;
        global.localStorage?.setItem("dawn-lionwing-techniques:" + key, details.open ? "1" : "0");
      } catch {}
    }, true);
  }

  global.DAWN_LIONWING_TECHNIQUE_SURFACE = Object.freeze({
    entries: entriesFor,
    actionSectionOpen: actorId => openPreference("actions:" + actorId, false),
    model: modelFor,
    render,
    pendingHtml,
    adapterActions,
    operationAction,
    renderActionControl,
    previewAction,
    commitAction,
    cancelAction,
    visibleChoices,
    actionStatuses,
    enableOperations,
    operationCosts,
    previewCosts,
    actionPresentation,
    actionTargets,
    resourceCostLabel,
    dispatchOnce,
    resetDispatchGuards: () => dispatchKeys.clear(),
  });
})(typeof window === "object" ? window : globalThis);
