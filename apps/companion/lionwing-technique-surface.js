"use strict";

// A data driven control surface for LionWing techniques.  The surface owns
// presentation and dispatch deduplication only; the edition data and the
// LionWing engine remain the authorities for text, validation and state.
(function exposeLionwingTechniqueSurface(global) {
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const text = value => String(value == null ? "" : value);
  const escapeHtml = value => text(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const resourceNames = Object.freeze({ ap: "ОД", focus: "Фокус", influence: "Влияние", health: "Здоровье" });
  const dispatchKeys = new Set();

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
  const displayArchetypes = () => {
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
  const displayTechniqueMap = () => new Map(displayArchetypes().flatMap(archetype => (archetype.techniques || []).map(technique => [technique.id, technique])));
  const canonicalTechniqueMap = () => new Map((canonicalData().archetypes || []).flatMap(archetype => (archetype.techniques || []).map(technique => [technique.id, technique])));

  function entriesFor(actor) {
    if (!actor) return [];
    const displays = displayTechniqueMap();
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

  function automationStatus(entry, adapters, scene, actor, viewer) {
    const rows = rowsForEntry(entry, adapters), enabled = rows.filter(row => row.enabled);
    let state = "manual", label = "Ручной режим", detail = "Действие фиксируется через общий ручной конвейер.";
    if (enabled.length) {
      const partial = enabled.some(row => row.coverage === "partial");
      state = partial ? "assisted" : "automatic";
      label = partial ? "Авто частично" : "Автоматически";
      detail = partial ? "Автоматизируемая часть подключена; остальное остаётся решением Нарратора." : "Подключённый адаптер применяет эту часть правила через ядро.";
    } else if (rows.length) {
      state = "off";
      label = "Автоматизация выключена";
      detail = "Адаптер доступен в Пульте, но сейчас правило исполняется вручную.";
    }
    const choices = visibleChoices(scene, viewer).filter(choice => choice.kind === "technique-trigger" && choice.context?.ruleId === entry.id);
    const receipt = [...(scene?.log || [])].reverse().find(event => {
      const payload = event?.payload || {};
      return (payload.ruleId || payload.techniqueRuleId || payload.sourceRuleId) === entry.id && (!event.actorId || event.actorId === actor?.id);
    }) || null;
    return {
      state,
      label,
      detail,
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
    if (scene?.pendingAction || scene?.pendingActionPlan || scene?.lionwing?.choices?.length) return { available: false, reason: "Сначала завершите текущую цепочку." };
    if (viewer.role === "narrator" || viewer.role === "gm" || viewer.role === "owner") return { available: true, reason: "" };
    if (viewer.actorId !== actor.id) return { available: false, reason: "Это Техника другого участника." };
    if (scene?.activeActorId !== actor.id) return { available: false, reason: "Сейчас Ход другого участника." };
    return { available: true, reason: "" };
  }

  function operationCosts(choice) {
    const context = choice?.context || {};
    const raw = Array.isArray(context.costs) ? context.costs : [];
    const costs = raw.map(cost => ({
      amount: Number(cost.amount),
      resource: cost.resource || cost.id,
    })).filter(cost => Number.isFinite(cost.amount) && cost.amount > 0 && cost.resource);
    if (costs.length) return costs;
    const operations = context.choices && typeof context.choices === "object" ? Object.values(context.choices).flatMap(value => Array.isArray(value) ? value : []) : [];
    return operations.filter(operation => operation?.kind === "resource" && operation.operation === "spend").map(operation => ({
      amount: Number(operation.amount),
      resource: operation.resource,
    })).filter(cost => Number.isFinite(cost.amount) && cost.amount > 0 && cost.resource);
  }

  function formatCosts(costs) {
    const rows = (costs || []).map(cost => Number(cost.amount) + " " + (resourceNames[cost.resource] || cost.resource)).filter(Boolean);
    return rows.length ? rows.join(" · ") : "отдельной цены нет";
  }

  function choiceTargetIds(choice) {
    const context = choice?.context || {}, ids = [];
    const add = value => {
      if (typeof value === "string" && value) ids.push(value);
    };
    add(context.targetId);
    if (Array.isArray(context.targetIds)) context.targetIds.forEach(add);
    if (context.choices && typeof context.choices === "object") {
      for (const operations of Object.values(context.choices)) {
        for (const operation of Array.isArray(operations) ? operations : []) add(operation?.targetId);
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
    const entries = entriesFor(actor);
    const adapters = adapterRows(actor);
    const actions = actionStatuses(scene, actor);
    const statuses = entries.map(entry => ({ entry, status: automationStatus(entry, adapters, scene, actor, viewer) }));
    const offers = statuses.filter(item => item.status.offer);
    return {
      scene,
      actor,
      viewer,
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
    const kind = receipt.type === "rule.activated" ? "сработало" : receipt.type === "rule.completed" ? "завершено" : receipt.type === "technique.resolve" ? "применено" : "записано";
    return "Последнее: " + kind + (payload.outcome ? " · " + payload.outcome : "");
  }

  function actionCostLabel(action) {
    if (action.costModel?.amount != null) return Number(action.costModel.amount) + " " + (resourceNames[action.costModel.resource] || action.costModel.resource || "");
    if (typeof action.cost === "string") return action.cost;
    if (action.cost?.amount != null) return Number(action.cost.amount) + " " + (resourceNames[action.cost.resource] || action.cost.resource || "");
    return "";
  }

  function renderActionShelf(actions, summary) {
    if (!actions.length) return "";
    const rows = actions.map(action => {
      const label = action.available ? "доступно" : "недоступно";
      const reason = action.available ? actionCostLabel(action) || (action.quick ? "Быстрое действие" : "готово") : action.reason || "условия не выполнены";
      return "<li class=\"" + (action.available ? "is-available" : "is-unavailable") + "\"><b>" + escapeHtml(action.displayName || action.name) + "</b><span>" + escapeHtml(label + (reason ? " · " + reason : "")) + "</span></li>";
    }).join("");
    return "<details class=\"lw-technique-actions\"><summary>Базовые действия сейчас · " + summary.available + "/" + summary.total + "</summary><ul>" + rows + "</ul></details>";
  }

  function renderManualControls(entry, status, actor, model) {
    const shouldShow = status.state === "manual" || status.state === "off" || model.viewer.role === "narrator" || model.viewer.role === "gm";
    if (!shouldShow) return "";
    const label = status.state === "automatic" || status.state === "assisted" ? "Применить вручную" : "Зафиксировать вручную";
    const disabled = model.manual.available ? "" : " disabled";
    const title = model.manual.reason || "Сохранить источник и решение в журнале";
    const selectedTargets = (model.scene?.targetIds || []).map(id => actorById(model.scene, id)?.name || id).filter(Boolean);
    const targetHint = selectedTargets.length ? "Цели на поле: " + selectedTargets.join(", ") : "Цели выберите на поле; заметка сохранит остальные детали.";
    return "<div class=\"lw-technique-manual\"><label>Заметка Нарратора<input data-lw-technique-note maxlength=\"500\" placeholder=\"Итог или выбранные цели\"></label><button type=\"button\" data-lw-technique-manual data-lw-technique-id=\"" + escapeHtml(entry.id) + "\" data-lw-actor=\"" + escapeHtml(actor.id) + "\"" + disabled + " title=\"" + escapeHtml(title) + "\">" + label + "</button><small>" + escapeHtml(targetHint) + "</small>" + (model.manual.available ? "" : "<small>" + escapeHtml(title) + "</small>") + "</div>";
  }

  function renderLevel(item, actor, model) {
    const entry = item.entry, status = item.status;
    const translated = entry.displayText !== entry.canonicalText || entry.displayLevelName !== entry.canonicalLevelName;
    const offer = status.offer;
    const offerLabels = offer?.context?.optionLabels || {};
    const optionText = offer ? (offer.options || []).map(option => offerLabels[option] || option).join(" · ") : "";
    const offerDetails = offer ? [choiceTargets(offer, model.scene), choiceVariant(offer)].filter(Boolean).join(" · ") : "";
    const offerHtml = offer ? "<p class=\"lw-technique-offer\" role=\"status\"><b>Нужно решение</b> · " + escapeHtml(optionText) + (offerDetails ? " · " + escapeHtml(offerDetails) : "") + " · срок: " + escapeHtml(deadline(offer, model.scene)) + "</p>" : "";
    return "<article class=\"lw-technique-level\" data-lw-technique-level=\"" + escapeHtml(entry.id) + "\">" +
      "<header><strong>" + escapeHtml(entry.level + ". " + (entry.displayLevelName || entry.canonicalLevelName)) + "</strong><span class=\"lw-technique-status " + escapeHtml(status.state) + "\">" + escapeHtml(status.label) + "</span></header>" +
      "<small class=\"lw-technique-source\">Канон: " + escapeHtml(sourceLabel(entry.canonicalSource)) + "</small>" +
      "<p class=\"lw-technique-canonical\"><b>EN:</b> " + escapeHtml(entry.canonicalText) + "</p>" +
      (translated ? "<details class=\"lw-technique-translation\"><summary>Русский перевод</summary><p>" + escapeHtml(entry.displayText) + "</p></details>" : "") +
      "<p class=\"lw-technique-automation\"><b>" + escapeHtml(status.label) + ":</b> " + escapeHtml(status.detail) + (status.receipt ? " · " + escapeHtml(receiptLabel(status.receipt)) : "") + "</p>" +
      offerHtml + renderManualControls(entry, status, actor, model) + "</article>";
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
    const offerCount = model.offers.length;
    const groupHtml = [...groups.values()].map((group, index) => {
      const heading = group.name + (group.canonicalName !== group.name ? " · " + group.canonicalName : "") + (group.previousName ? " · ранее: " + group.previousName : "");
      return "<details class=\"lw-technique-group\" data-lw-technique-group=\"" + escapeHtml(group.techniqueId) + "\"" + (openPreference(group.techniqueId, index === 0 || group.levels.some(item => item.status.offer)) ? " open" : "") + "><summary><strong>" + escapeHtml(heading) + "</strong><small>" + group.levels.length + " Уров." + (group.levels.some(item => item.status.offer) ? " · есть решение" : "") + "</small></summary><div>" + group.levels.map(item => renderLevel(item, model.actor, model)).join("") + "</div></details>";
    }).join("");
    const outerOpen = offerCount > 0 || openPreference("surface:" + model.actor.id, false);
    const intro = "<p class=\"lw-technique-intro\">Текст EN — источник правила. Перевод показан отдельно; статус автоматизации не заменяет правило.</p>";
    return "<details class=\"lw-technique-surface\" data-lw-technique-surface data-lw-technique-actor=\"" + escapeHtml(model.actor.id) + "\"" + (outerOpen ? " open" : "") + "><summary><strong>Техники · " + model.entries.length + "</strong><small>" + activeCount + " подключено" + (offerCount ? " · " + offerCount + " требует решения" : "") + "</small></summary>" + intro + renderActionShelf(model.actions, model.actionSummary) + "<div class=\"lw-technique-groups\">" + groupHtml + "</div></details>";
  }

  function pendingHtml(choice, options = {}) {
    const scene = options.scene || currentScene(), actor = actorById(scene, choice?.actorId), viewer = viewerFor(scene, options.viewer);
    const canRespond = options.canRespond !== undefined ? Boolean(options.canRespond) : ["owner", "narrator", "gm"].includes(viewer.role) || viewer.actorId === choice?.actorId;
    const entry = entryForId(actor, choice?.context?.ruleId);
    const labels = choice?.context?.optionLabels || {};
    const optionsHtml = (choice?.options || []).map(option => {
      const label = labels[option] || option;
      const cancel = cancellationSuffix(option, label);
      return "<button type=\"button\" data-lw-technique-choice=\"true\" data-lw-choice=\"" + escapeHtml(option) + "\" data-lw-choice-id=\"" + escapeHtml(choice.id) + "\" data-lw-actor=\"" + escapeHtml(choice.actorId) + "\"" + (canRespond ? "" : " disabled") + ">" + escapeHtml(label + cancel) + "</button>";
    }).join("");
    const source = entry ? "<small class=\"lw-technique-source\">Канон: " + escapeHtml(sourceLabel(entry.canonicalSource)) + "</small>" : "";
    const canonical = entry ? "<p class=\"lw-technique-canonical\"><b>EN:</b> " + escapeHtml(entry.canonicalText) + "</p>" : "";
    const details = [choiceTargets(choice, scene), choiceVariant(choice)].filter(Boolean).join(" · ");
    const wait = canRespond ? "<div class=\"button-row\">" + optionsHtml + "</div>" : "<p>Ожидается решение владельца героя.</p>";
    return "<section class=\"lw-pending lw-technique-offer\" data-lw-technique-offer=\"" + escapeHtml(choice.id) + "\"><header><strong>" + escapeHtml(actor?.name || "Участник") + ": " + escapeHtml(choice.title || "Сработала Техника") + "</strong><span>Срок: " + escapeHtml(deadline(choice, scene)) + "</span></header>" + source + canonical + (details ? "<p><b>" + escapeHtml(details) + "</b></p>" : "") + "<p><b>Стоимость:</b> " + escapeHtml(formatCosts(operationCosts(choice))) + "</p>" + wait + "</section>";
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
      const details = event.target.closest?.("[data-lw-technique-surface], [data-lw-technique-group]");
      if (!details) return;
      try {
        const key = details.dataset.lwTechniqueSurface ? "surface:" + details.dataset.lwTechniqueActor : details.dataset.lwTechniqueGroup;
        global.localStorage?.setItem("dawn-lionwing-techniques:" + key, details.open ? "1" : "0");
      } catch {}
    }, true);
  }

  global.DAWN_LIONWING_TECHNIQUE_SURFACE = Object.freeze({
    entries: entriesFor,
    model: modelFor,
    render,
    pendingHtml,
    visibleChoices,
    actionStatuses,
    operationCosts,
    dispatchOnce,
    resetDispatchGuards: () => dispatchKeys.clear(),
  });
})(typeof window === "object" ? window : globalThis);
