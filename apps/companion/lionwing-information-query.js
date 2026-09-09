"use strict";

(function exposeLionWingInformationQuery(global) {
  const SCHEMA = 1;
  const EDITION_ID = "dawn-en-lionwing-cb2f8e67";
  const STUDY_ACTION_ID = global.DAWN_SCENE_ENGINE?.ACTION_IDS?.study || "action.утилитарные-действия.изучение";
  const CONTRACT_DIGEST = "lionwing-information-query:study:v1";
  const MAX_STUDIES = 512;
  const MAX_FACTS = 1024;
  const MAX_RECEIPTS = 512;
  const MAX_WARNINGS = 128;
  const MAX_JOURNAL = 256;

  const CATEGORY_DEFS = Object.freeze({
    health: { id: "health", label: "Здоровье", valueKind: "health" },
    defense: { id: "defense", label: "Защита", valueKind: "number-or-text" },
    speed: { id: "speed", label: "Скорость", valueKind: "number-or-text" },
    passives: { id: "passives", label: "Пассивные правила", valueKind: "text" },
    actions: { id: "actions", label: "Действия", valueKind: "text" },
    trumps: { id: "trumps", label: "Козыри", valueKind: "text" },
    custom: { id: "custom", label: "Другое", valueKind: "manual" },
  });
  const CATEGORY_ALIASES = Object.freeze({
    armor: "defense",
    evasion: "defense",
    abilities: "passives",
    techniques: "passives",
    healthCurrent: "health",
    currentHealth: "health",
  });

  // Every adapter below is backed by a fresh EN LionWing row and its reviewed
  // RU overlay.  Registry notes are intentionally not used as rule input.
  const EN_RU_EVIDENCE = Object.freeze({
    "powerhouse.predator.1": {
      sourceDigest: "a8cae75148d195565fbe193ff9772ee0c4951d7c993b3e45738aea75d4c00e55",
      en: "The first time you Investigate each Turn, it becomes Swift, has its Cost Reduced to 0, and has a range of [Body]. However, it can only be used to ask what your target's current and maximum Health is. When any opponent is Knocked Out while adjacent to you, you heal [Body] Health.",
      ru: "Первое Изучение в каждый Ход становится Быстрым, получает Стоимость 0 и дальность `[Тело]`, но позволяет спросить только текущее и максимальное Здоровье цели. Когда противника выводят из строя в смежности с вами, восстановите `[Тело]` Здоровья.",
      semanticDiff: "Implemented only the verified first Study quote and health category; the adjacent KO heal remains outside this query contract.",
      coverage: "partial",
    },
    "powerhouse.predator.2": {
      sourceDigest: "88f405e82601d2322d20ac82489157225be603a8bbb1a95a62f5498be18bd5b8",
      en: "If you know an opponent has half their maximum Health remaining or less, your Speed is increased by 3, and you ignore Difficult Terrain, but you cannot move unless you're moving closer to at least one of said opponents.",
      ru: "Если вам известно, что у противника осталось не больше половины максимального Здоровья, ваша Скорость увеличивается на 3 и вы игнорируете трудную местность. Однако двигаться вы можете только так, чтобы приближаться хотя бы к одному такому противнику.",
      semanticDiff: "The adapter exposes the authoritative known-health query; movement and derived Speed hooks remain partial.",
      coverage: "partial",
    },
    "vagabond.cunning-fighter.1": {
      sourceDigest: "4373bc4971b0d11b0adce5ad6d070e9012c97e4acb27f45a34b8d28b89b6b421",
      en: "Begin tracking ‘Cunning Plan', a 4 Segment Clock that's emptied after every Scene. If you Investigate a character who you haven't Investigated this Turn, fill one Cunning Plan Segment. Once per Turn, you may empty a Segment to take any non-Attack Action, reducing its Cost by 1 and gaining Swift.",
      ru: "Начните отслеживать **Хитрый план** — часы на 4 сегмента, которые очищаются после каждой Сцены. Если вы Изучаете персонажа, которого ещё не Изучали в этот Ход, заполните один сегмент Хитрого плана. Один раз за Ход можете очистить сегмент, чтобы совершить любое действие не-Атаки, снизив его Стоимость на 1 и сделав Быстрым.",
      semanticDiff: "The query records unique per-turn Study facts; the existing clock consumer remains responsible for filling the segment.",
      coverage: "partial",
    },
    "vagabond.cunning-fighter.3": {
      sourceDigest: "42e5ed604240ee0101c74613994c2e7507fa7312e05cae2cfa01dbc532f04f89",
      en: "The first time you Investigate each Turn, you may spend 1 Focus to Swifty Investigate another enemy within [Mind] spaces of the target at no Cost.",
      ru: "В первый раз за Ход, когда вы используете Изучение, можете потратить 1 Фокус, чтобы бесплатно и Быстро Изучить ещё одного врага в пределах `[Разум]` клеток от цели.",
      semanticDiff: "The API exposes a trusted follow-up availability query; it does not spend Focus or execute the second Study.",
      coverage: "partial",
    },
    "bulwark.absolute-bastard.1": {
      sourceDigest: "91c7070f4960afafc561e002df64ca574cf017f64e12b15f175339623fd1d903",
      en: "Gain 3 Focus at the start of each Scene. After you Investigate an enemy, you may spend 1 Focus to Taunt them.",
      ru: "В начале каждой Сцены получите 3 Фокуса. После Изучения врага можете потратить 1 Фокус, чтобы Спровоцировать его.",
      semanticDiff: "Study provenance and marked-target queries are complete; the optional Focus spend and Taunt operation stay with the rule adapter.",
      coverage: "partial",
    },
    "altruist.battle-instructor.1": {
      sourceDigest: "186549bb352bd001b470542b150f49b4a2af058b72f8ee43c038eb2f3e92d63c",
      en: "After you mark a character, an ally of your choosing may move up to 3 spaces towards the character. Your Investigates are Swift.",
      ru: "После того как вы Помечаете персонажа, выбранный вами союзник может переместиться к нему не более чем на 3 клетки. Ваши Изучения становятся Быстрыми.",
      semanticDiff: "The action quote is wired; the ally movement choice remains an existing movement consumer.",
      coverage: "partial",
    },
    "vagabond.dim-mak.1": {
      sourceDigest: "86bc2801b43ae4f2bd3de697124313b986e9ae1081e0dd8f3f52dfc44b097c59",
      en: "After you Investigate a character, place a ‘Weak Point' in a space adjacent to them that doesn't have one. Your Investigations that target the same character are Swift this Turn. Weak Points move to match their host's movement. After you move into a Weak Point, you may remove it to ‘Jab', dealing [Mind/2] damage to its host. This counts as a Swift Skirmish, but cannot have its damage or targeting altered.",
      ru: "После Изучения персонажа поместите **Слабую точку** в смежную с ним клетку, где ещё нет Слабой точки. В этот Ход ваши Изучения той же цели становятся Быстрыми. Слабые точки двигаются вместе со своим носителем. Войдя в клетку Слабой точки, можете убрать её, чтобы нанести носителю **тычок** с `[Разум / 2]` урона. Он считается Быстрой Стычкой, но его урон и выбор цели нельзя изменить.",
      semanticDiff: "Existing Detective marker placement stays in its adapter; its same-target decision reads the shared Study query.",
      coverage: "partial",
    },
    "vagabond.dim-mak.2": {
      sourceDigest: "d63edd4d649fb29805706009934a7eb38427b2507f32b1d5632e881f7e24a5a2",
      en: "The third Investigate has no Cost, and Slows all Marked Enemies.",
      ru: "Третье Изучение ничего не стоит и Замедляет всех Помеченных врагов.",
      semanticDiff: "The shared count supplies the free third Study and trigger proof; slowing all marked enemies remains the existing event adapter.",
      coverage: "partial",
    },
  });

  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const text = value => typeof value === "string" ? value.trim() : "";
  const id = value => {
    const result = text(value);
    return result && result.length <= 160 ? result : null;
  };
  const fail = (message, code) => {
    const error = new Error(message);
    if (code) error.code = code;
    throw error;
  };
  const resultError = (message, code) => ({ ok: false, errors: [message], code: code || "INFORMATION_QUERY_INVALID" });
  const now = () => new Date().toISOString();
  const actor = (scene, actorId) => (scene?.actors || []).find(item => item?.id === actorId) || null;
  const isPlayer = value => Boolean(value && (value.kind === "hero" || value.kind === "player" || value.heroId));
  const isLive = value => Boolean(value && !value.knockedOut && value.removed !== true && value.despawned !== true);
  const isLionWing = scene => Boolean(scene && (scene.rulesEdition === "lionwing" || !scene.rulesEdition && (scene.lionwing || (scene.actors || []).some(item => item?.rulesEdition === "lionwing"))));
  const normalizeCategory = value => {
    const raw = text(value);
    return CATEGORY_ALIASES[raw] || raw;
  };
  const categoryDef = value => CATEGORY_DEFS[normalizeCategory(value)] || null;
  const normalizeCategories = values => {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map(normalizeCategory).filter(item => categoryDef(item)).map(item => categoryDef(item).id))];
  };
  const categoryList = values => {
    const selected = normalizeCategories(values);
    return (selected.length ? selected : Object.keys(CATEGORY_DEFS)).map(key => copy(CATEGORY_DEFS[key]));
  };
  const visibleTo = (fact, viewer = {}) => {
    if (!fact) return false;
    const role = viewer.role || "narrator";
    if (role === "narrator" || role === "gm" || role === "owner") return true;
    if (fact.visibility === "public") return true;
    if (fact.visibility === "narrator") return false;
    if (fact.visibility === "player" || fact.visibility === "owner") return Boolean(viewer.actorId && viewer.actorId === fact.ownerActorId) || Boolean(viewer.playerId && viewer.playerId === fact.ownerPlayerId);
    return false;
  };
  const entityVisible = (scene, entityId, viewer = {}) => {
    const role = viewer.role || "narrator";
    if (role === "narrator" || role === "gm" || role === "owner") return true;
    if (!entityId) return true;
    const entity = actor(scene, entityId);
    return Boolean(entity && !entity.hidden);
  };
  const studyVisibleTo = (study, viewer = {}, scene = null) => {
    const role = viewer.role || "narrator";
    if (role === "narrator" || role === "gm" || role === "owner") return true;
    if (!entityVisible(scene, study.actorId, viewer) || !entityVisible(scene, study.targetId, viewer)) return false;
    if (viewer.actorId && viewer.actorId === study.actorId) return true;
    return study.visibility === "public";
  };
  const emptyState = () => ({ schema: SCHEMA, studies: [], facts: [], receipts: [], pending: [], warnings: [], handouts: [], journal: [] });
  const ensureState = scene => {
    if (!scene || typeof scene !== "object") fail("Сцена Изучения отсутствует");
    scene.lionwing ||= {};
    if (!scene.lionwing.information) scene.lionwing.information = emptyState();
    const info = scene.lionwing.information;
    if (!info || typeof info !== "object" || Array.isArray(info)) fail("Реестр информации LionWing имеет неподдерживаемый формат");
    info.schema = SCHEMA;
    for (const key of ["studies", "facts", "receipts", "pending", "warnings", "handouts", "journal"]) {
      if (!Array.isArray(info[key])) fail("Реестр информации LionWing имеет неподдерживаемый список: " + key);
    }
    info.studies = info.studies.slice(-MAX_STUDIES);
    info.facts = info.facts.slice(-MAX_FACTS);
    info.receipts = info.receipts.slice(-MAX_RECEIPTS);
    info.warnings = info.warnings.slice(-MAX_WARNINGS);
    info.handouts = info.handouts.slice(-MAX_FACTS);
    info.journal = info.journal.slice(-MAX_JOURNAL);
    info.pending = info.pending.filter(studyId => info.studies.some(item => item.id === studyId && item.status === "pending" || item.id === studyId && item.status === "blocked"));
    return info;
  };
  const infoState = scene => ensureState(scene);
  // Journal rows contain before/after snapshots. Exclude the journal itself
  // from those snapshots so every new operation stays bounded and replay or
  // undo cannot build a recursively expanding history tree.
  const snapshot = scene => {
    const result = copy(ensureState(scene));
    result.journal = [];
    return result;
  };
  const currentContext = scene => {
    const s = scene?.lionwing || {};
    const active = actor(scene, scene.activeActorId);
    return {
      round: Number(scene?.round || 0),
      turnSerial: Number(scene?.turnSerial || 0),
      turnInstanceId: s.activeTurnInstanceId || s.activeTurn?.turnInstanceId || null,
      ownerTurnSerial: active ? Number(active.lionwing?.ownerTurnSerial ?? active.lionwing?.turnSerial ?? active.lionwing?.turns ?? 0) : null,
      sceneSerial: Number(s.sceneSerial || 1),
      chapterSerial: Number(s.chapterSerial || 1),
    };
  };
  const actionTargetIds = event => event?.payload?.targetIds || event?.targetIds || [];
  const actionProof = (scene, input) => {
    const sourceId = id(input.actorId || input.sourceActorId);
    const targetId = id(input.targetId);
    const actionInstanceId = id(input.actionInstanceId);
    if (!sourceId || !targetId || !actionInstanceId) return { ok: false, message: "Изучение требует исполнителя, цель и actionInstanceId", code: "STUDY_PROOF_INCOMPLETE" };
    const source = actor(scene, sourceId), target = actor(scene, targetId);
    if (!source || !target || !isLive(source) || !isLive(target)) return { ok: false, message: "Исполнитель или цель Изучения отсутствует", code: "STUDY_TARGET_UNAVAILABLE" };
    if (!isLionWing(scene) || scene.rulesEdition && scene.rulesEdition !== "lionwing") return { ok: false, message: "Изучение другой редакции не принимается", code: "OLD_EDITION_ISOLATION" };
    if (isPlayer(target) || source.team === target.team) return { ok: false, message: "Изучение требует живую NPC-цель противника", code: "STUDY_TARGET_INVALID" };
    const rows = (scene.log || []).map((event, index) => ({ event, index })).filter(item => item.event?.type === "action.resolve" && item.event.actorId === sourceId);
    const actionRow = rows.find(item => {
      const payload = item.event.payload || {};
      return (payload.actionId === STUDY_ACTION_ID || payload.actionId === "Изучение") &&
        payload.actionInstanceId === actionInstanceId &&
        actionTargetIds(item.event).length === 1 &&
        actionTargetIds(item.event)[0] === targetId &&
        (!input.actionEventId || item.event.id === input.actionEventId);
    });
    if (!actionRow) return { ok: false, message: "Не найден авторитетный action.resolve для Изучения", code: "STUDY_RECEIPT_REQUIRED" };
    const history = Array.isArray(source.lionwing?.history) ? source.lionwing.history : [];
    const historyRow = history.find(item => {
      const targets = item.targetIds || (item.targetId ? [item.targetId] : []);
      return (item.actionId === STUDY_ACTION_ID || item.actionId === "Изучение") &&
        item.actionInstanceId === actionInstanceId && targets.length === 1 && targets[0] === targetId;
    });
    if (!historyRow) return { ok: false, message: "История исполнителя не подтверждает Изучение", code: "STUDY_RECEIPT_REQUIRED" };
    return { ok: true, source, target, actionRow: actionRow.event, historyRow };
  };
  const receiptFingerprint = value => JSON.stringify(value);
  const receipt = (info, receiptId, fingerprint) => {
    const existing = info.receipts.find(item => item.id === receiptId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) fail("Конфликт стабильной квитанции информации", "INFORMATION_RECEIPT_CONFLICT");
      return true;
    }
    info.receipts.push({ schema: 1, id: receiptId, fingerprint, at: now() });
    info.receipts = info.receipts.slice(-MAX_RECEIPTS);
    return false;
  };
  const journalMutation = (scene, operation, rootId, mutator) => {
    const before = snapshot(scene);
    const info = ensureState(scene);
    const output = mutator(info);
    if (output && output.ok === false) return output;
    const after = snapshot(scene);
    const event = {
      schema: 1,
      id: rootId || "information:" + operation + ":" + String(info.journal.length + 1),
      type: "information." + operation,
      operation,
      rootEventId: rootId || null,
      before,
      after,
    };
    if (!same(before, after)) {
      info.journal.push(copy(event));
      info.journal = info.journal.slice(-MAX_JOURNAL);
    }
    return { ...(output || { ok: true }), event };
  };
  const studyRecord = (scene, input = {}) => {
    const proof = actionProof(scene, input);
    if (!proof.ok) return resultError(proof.message, proof.code);
    const info = ensureState(scene);
    const studyId = "information:study:" + input.actionInstanceId;
    const fingerprint = receiptFingerprint([studyId, proof.source.id, proof.target.id, proof.actionRow.id, normalizeCategories(input.categories)]);
    const existing = info.studies.find(item => item.id === studyId);
    if (existing) {
      if (existing.actorId !== proof.source.id || existing.targetId !== proof.target.id || existing.actionEventId !== proof.actionRow.id) return resultError("Конфликт повторного Изучения", "INFORMATION_RECEIPT_CONFLICT");
      return { ok: true, duplicate: true, study: copy(existing), event: info.journal.find(item => item.id === studyId) || null };
    }
    const context = currentContext(scene);
    const study = {
      schema: 1,
      id: studyId,
      actionId: STUDY_ACTION_ID,
      actionInstanceId: input.actionInstanceId,
      actionEventId: proof.actionRow.id,
      rootActionId: proof.actionRow.execution?.rootActionId || input.rootActionId || input.actionInstanceId,
      actorId: proof.source.id,
      targetId: proof.target.id,
      targetKind: proof.target.kind || "npc",
      scope: "turn",
      visibility: "public",
      round: Number(proof.actionRow.payload?.round ?? context.round),
      turnSerial: Number(proof.actionRow.payload?.turnSerial ?? context.turnSerial),
      turnInstanceId: proof.actionRow.payload?.ownerTurnInstanceId || context.turnInstanceId,
      ownerTurnSerial: proof.historyRow.ownerTurnSerial ?? context.ownerTurnSerial,
      ownerTurnInstanceId: proof.historyRow.ownerTurnInstanceId || context.turnInstanceId,
      sceneSerial: context.sceneSerial,
      chapterSerial: context.chapterSerial,
      categories: normalizeCategories(input.categories),
      status: "pending",
      revealedFactIds: [],
      createdAt: proof.actionRow.at || now(),
      sourceDigest: input.sourceDigest || CONTRACT_DIGEST,
    };
    const result = journalMutation(scene, "study", studyId, state => {
      try {
        const duplicate = receipt(state, studyId, fingerprint);
        if (duplicate) return { ok: true, duplicate: true, study: copy(state.studies.find(item => item.id === studyId) || null) };
      } catch (error) {
        return resultError(error.message, error.code);
      }
      state.studies.push(study);
      state.pending.push(study.id);
      return { ok: true, study: copy(study) };
    });
    return result;
  };
  const availableCategories = (scene, query = {}) => {
    const info = ensureState(scene);
    const study = typeof query === "string" ? info.studies.find(item => item.id === query) : query.studyId ? info.studies.find(item => item.id === query.studyId) : query.id ? info.studies.find(item => item.id === query.id) : query;
    return categoryList(study?.categories);
  };
  const warning = (info, study, code, message, category) => {
    const warningId = "information:warning:" + study.id + ":" + (category || code);
    if (!info.warnings.some(item => item.id === warningId)) info.warnings.push({ schema: 1, id: warningId, studyId: study.id, category: category || null, code, message, requiresOverride: true, at: now() });
    study.status = "blocked";
    if (!info.pending.includes(study.id)) info.pending.push(study.id);
  };
  const targetHealth = target => {
    const current = Number(target?.hp);
    const maximum = Number(target?.maxHp);
    if (!Number.isFinite(current) || !Number.isFinite(maximum)) return null;
    return { current, maximum };
  };
  const confirmReveal = (scene, input = {}, options = {}) => {
    const role = options.role;
    if (!["narrator", "gm"].includes(role)) return resultError("Раскрытие информации доступно только Нарратору", "INFORMATION_AUTHORITY_REQUIRED");
    const info = ensureState(scene);
    const studyId = id(input.studyId);
    const study = info.studies.find(item => item.id === studyId);
    if (!study) return resultError("Изучение не найдено", "STUDY_NOT_FOUND");
    if (study.status === "cancelled") return resultError("Изучение отменено", "STUDY_CANCELLED");
    const category = normalizeCategory(input.category);
    const definition = categoryDef(category);
    try {
      return journalMutation(scene, "reveal", "information:reveal:" + study.id + ":" + category, state => {
        const liveTarget = actor(scene, study.targetId);
        if (!liveTarget || !isLive(liveTarget)) {
          warning(state, study, "TARGET_UNAVAILABLE", "Цель Изучения выведена из Сцены до раскрытия.", category);
          return resultError("Цель Изучения недоступна для раскрытия", "STUDY_TARGET_UNAVAILABLE");
        }
        if (!definition && input.override !== true) {
          warning(state, study, "UNKNOWN_CATEGORY", "Правило не определяет категорию раскрытия; требуется ручной override Нарратора.", category || "unknown");
          return resultError("Неоднозначное правило: требуется ручной override Нарратора", "INFORMATION_RULE_BLOCKED");
        }
        if (definition && study.categories.length && !study.categories.includes(definition.id) && input.override !== true) {
          warning(state, study, "CATEGORY_NOT_ALLOWED", "Эта категория не разрешена данным правилом Изучения.", definition.id);
          return resultError("Категория не разрешена правилом Изучения", "INFORMATION_RULE_BLOCKED");
        }
        const actualCategory = definition ? definition.id : "custom";
        let value = input.value;
        if (actualCategory === "health" && value === undefined) value = targetHealth(liveTarget);
        if (value === undefined || value === null || (actualCategory === "health" && !value)) {
          warning(state, study, "VALUE_REQUIRED", "Для этой категории Нарратор должен выбрать или ввести раскрываемое значение.", actualCategory);
          return resultError("Нужно указать раскрываемую информацию", "INFORMATION_RULE_BLOCKED");
        }
        if (JSON.stringify(value).length > 4096) return resultError("Раскрываемая информация слишком велика", "INFORMATION_VALUE_TOO_LARGE");
        const factId = study.id + ":fact:" + actualCategory;
        const visibility = input.visibility || "public";
        if (!["public", "narrator", "player"].includes(visibility)) return resultError("Неизвестная видимость факта", "INFORMATION_VISIBILITY_INVALID");
        const factFingerprint = receiptFingerprint([factId, study.id, actualCategory, visibility, value]);
        const old = state.facts.find(item => item.id === factId);
        if (old) {
          if (old.fingerprint !== factFingerprint) return resultError("Факт уже раскрыт с другим значением", "INFORMATION_RECEIPT_CONFLICT");
          return { ok: true, duplicate: true, fact: copy(old), study: copy(study) };
        }
        const fact = {
          schema: 1,
          id: factId,
          studyId: study.id,
          actorId: study.actorId,
          targetId: study.targetId,
          ownerActorId: visibility === "player" ? (input.ownerActorId || study.actorId) : null,
          ownerPlayerId: visibility === "player" ? (input.ownerPlayerId || null) : null,
          category: actualCategory,
          label: definition?.label || String(input.label || "Другое").slice(0, 120),
          value: copy(value),
          visibility,
          scope: input.scope || "scene",
          sourceDigest: input.sourceDigest || study.sourceDigest || CONTRACT_DIGEST,
          fingerprint: factFingerprint,
          createdAt: now(),
          manualOverride: input.override === true,
        };
        state.facts.push(fact);
        study.revealedFactIds = [...new Set([...(study.revealedFactIds || []), fact.id])];
        study.status = "resolved";
        study.resolvedAt = now();
        state.pending = state.pending.filter(item => item !== study.id);
        state.warnings = state.warnings.filter(item => item.studyId !== study.id || item.code === "TARGET_UNAVAILABLE");
        state.receipts.push({ schema: 1, id: "information:reveal:" + study.id + ":" + actualCategory, fingerprint: factFingerprint, at: now() });
        state.receipts = state.receipts.slice(-MAX_RECEIPTS);
        return { ok: true, fact: copy(fact), study: copy(study) };
      });
    } catch (error) {
      return resultError(error.message, error.code);
    }
  };
  const cancelReveal = (scene, input = {}, options = {}) => {
    const info = ensureState(scene);
    const study = info.studies.find(item => item.id === id(input.studyId));
    if (!study) return resultError("Изучение не найдено", "STUDY_NOT_FOUND");
    const role = options.role;
    if (!["narrator", "gm"].includes(role) && options.actorId !== study.actorId) return resultError("Отмена доступна Нарратору или владельцу Изучения", "INFORMATION_AUTHORITY_REQUIRED");
    if (study.status === "cancelled") return { ok: true, duplicate: true, study: copy(study) };
    try {
      return journalMutation(scene, "cancel", "information:cancel:" + study.id, state => {
        study.status = "cancelled";
        study.cancelledAt = now();
        state.pending = state.pending.filter(item => item !== study.id);
        state.receipts.push({ schema: 1, id: "information:cancel:" + study.id, fingerprint: receiptFingerprint([study.id, "cancel"]), at: now() });
        state.receipts = state.receipts.slice(-MAX_RECEIPTS);
        return { ok: true, study: copy(study) };
      });
    } catch (error) {
      return resultError(error.message, error.code);
    }
  };
  const handout = (scene, input = {}, options = {}) => {
    if (!["narrator", "gm"].includes(options.role)) return resultError("Ручная выдача доступна только Нарратору", "INFORMATION_AUTHORITY_REQUIRED");
    const info = ensureState(scene);
    const target = input.targetId ? actor(scene, input.targetId) : null;
    const category = normalizeCategory(input.category || "custom");
    const definition = categoryDef(category);
    const handoutId = id(input.handoutId || input.id) || "information:handout:" + [input.actorId || "scene", input.targetId || "none", category, JSON.stringify(input.value)].join(":").slice(0, 150);
    const visibility = input.visibility || "public";
    if (!["public", "narrator", "player"].includes(visibility)) return resultError("Неизвестная видимость handout", "INFORMATION_VISIBILITY_INVALID");
    if (input.value === undefined) return resultError("Ручная выдача требует значение", "INFORMATION_VALUE_REQUIRED");
    if (target && !isLive(target)) return resultError("Цель handout недоступна", "STUDY_TARGET_UNAVAILABLE");
    try {
      return journalMutation(scene, "handout", handoutId, state => {
        const fingerprint = receiptFingerprint([handoutId, input.actorId || null, input.targetId || null, category, visibility, input.value]);
        const old = state.handouts.find(item => item.id === handoutId);
        if (old) {
          if (old.fingerprint !== fingerprint) return resultError("Конфликт повторной ручной выдачи", "INFORMATION_RECEIPT_CONFLICT");
          return { ok: true, duplicate: true, fact: copy(old) };
        }
        const fact = {
          schema: 1,
          id: handoutId,
          handout: true,
          studyId: null,
          actorId: input.actorId || null,
          targetId: input.targetId || null,
          ownerActorId: visibility === "player" ? (input.ownerActorId || input.actorId || null) : null,
          ownerPlayerId: visibility === "player" ? (input.ownerPlayerId || null) : null,
          category: definition ? definition.id : "custom",
          label: definition?.label || String(input.label || "Ручная выдача").slice(0, 120),
          value: copy(input.value),
          visibility,
          sourceDigest: input.sourceDigest || "manual:narrator",
          fingerprint,
          createdAt: now(),
        };
        state.handouts.push(fact);
        state.facts.push(fact);
        state.receipts.push({ schema: 1, id: handoutId, fingerprint, at: now() });
        state.receipts = state.receipts.slice(-MAX_RECEIPTS);
        return { ok: true, fact: copy(fact) };
      });
    } catch (error) {
      return resultError(error.message, error.code);
    }
  };
  const filterScope = (study, scene, scope, options = {}) => {
    const current = currentContext(scene);
    if (!scope || scope === "all") return true;
    if (scope === "turn") {
      if (options.turnInstanceId || current.turnInstanceId) return options.turnInstanceId ? study.turnInstanceId === options.turnInstanceId : study.turnSerial === current.turnSerial;
      return study.turnSerial === (options.turnSerial ?? current.turnSerial);
    }
    if (scope === "round") return Number(study.round) === Number(options.round ?? current.round);
    if (scope === "scene") return Number(study.sceneSerial) === Number(options.sceneSerial ?? current.sceneSerial);
    if (scope === "chapter") return Number(study.chapterSerial) === Number(options.chapterSerial ?? current.chapterSerial);
    return true;
  };
  const queryArgs = (actorOrQuery, targetId, scope, options) => {
    if (actorOrQuery && typeof actorOrQuery === "object" && !Array.isArray(actorOrQuery)) return { ...actorOrQuery };
    return { actorId: actorOrQuery, targetId, scope, ...(options || {}) };
  };
  const studies = (scene, query = {}) => {
    const info = ensureState(scene);
    const normalized = typeof query === "string" ? { actorId: query } : query || {};
    return info.studies.filter(study => {
      if (normalized.actorId && study.actorId !== normalized.actorId) return false;
      if (normalized.targetId && study.targetId !== normalized.targetId) return false;
      if (normalized.actionInstanceId && study.actionInstanceId !== normalized.actionInstanceId) return false;
      if (normalized.status && study.status !== normalized.status) return false;
      return filterScope(study, scene, normalized.scope || "all", normalized);
    }).map(copy);
  };
  const studyCount = (scene, actorOrQuery, targetId, scope, options) => {
    const query = queryArgs(actorOrQuery, targetId, scope, options);
    return studies(scene, query).filter(item => item.status !== "cancelled").length;
  };
  const studiedThisTurn = (scene, actorId, targetId) => studyCount(scene, { actorId, targetId, scope: "turn" }) > 0;
  const firstStudy = (scene, actorOrQuery, targetId, scope, options) => studies(scene, queryArgs(actorOrQuery, targetId, scope || "scene", options))[0] || null;
  const studyStatus = (scene, studyId) => {
    const study = ensureState(scene).studies.find(item => item.id === (typeof studyId === "string" ? studyId : studyId?.studyId));
    return study ? copy(study) : null;
  };
  const factForViewer = (scene, factOrQuery, viewer = {}) => {
    const info = ensureState(scene);
    const query = typeof factOrQuery === "string" ? { id: factOrQuery } : factOrQuery || {};
    const found = info.facts.find(item => (query.id && item.id === query.id) || query.studyId && item.studyId === query.studyId && (!query.category || item.category === normalizeCategory(query.category)) || query.actorId && item.actorId === query.actorId && item.targetId === query.targetId && (!query.category || item.category === normalizeCategory(query.category)));
    if (!found || !visibleTo(found, viewer) || !entityVisible(scene, found.actorId, viewer) || !entityVisible(scene, found.targetId, viewer)) return null;
    return copy(found);
  };
  const revealedFact = (scene, queryOrStudyId, categoryOrViewer, maybeViewer) => {
    let query, viewer;
    if (typeof queryOrStudyId === "string") {
      if (typeof categoryOrViewer === "string") {
        query = { studyId: queryOrStudyId, category: categoryOrViewer };
        viewer = maybeViewer || { role: "narrator" };
      } else {
        query = { studyId: queryOrStudyId };
        viewer = categoryOrViewer || { role: "narrator" };
      }
    } else {
      query = queryOrStudyId || {};
      viewer = categoryOrViewer || { role: "narrator" };
    }
    return factForViewer(scene, query, viewer);
  };
  const facts = (scene, query = {}, viewer = { role: "narrator" }) => {
    const info = ensureState(scene);
    const normalized = typeof query === "string" ? { studyId: query } : query || {};
    return info.facts.filter(item => (!normalized.studyId || item.studyId === normalized.studyId) && (!normalized.actorId || item.actorId === normalized.actorId) && (!normalized.targetId || item.targetId === normalized.targetId) && (!normalized.category || item.category === normalizeCategory(normalized.category)) && visibleTo(item, viewer) && entityVisible(scene, item.actorId, viewer) && entityVisible(scene, item.targetId, viewer)).map(copy);
  };
  const markedTargetStatus = (scene, actorId, targetId) => {
    const target = actor(scene, targetId), info = ensureState(scene);
    if (!target) return { marked: false, source: null };
    const effects = Array.isArray(target.effects) ? target.effects : [];
    const states = target.effectStates && typeof target.effectStates === "object" ? target.effectStates : {};
    const effectMarked = effects.includes("negative.помечен") || Object.prototype.hasOwnProperty.call(states, "negative.помечен");
    const study = info.studies.find(item => item.actorId === actorId && item.targetId === targetId && item.status !== "cancelled");
    return { marked: Boolean(effectMarked || study), source: effectMarked ? "effect" : study ? "study" : null, studyId: study?.id || null };
  };
  const markedTarget = (scene, actorId, targetId) => markedTargetStatus(scene, actorId, targetId).marked;
  const knownHealth = (scene, actorId, targetId, viewer = { role: "narrator" }) => {
    const found = facts(scene, { actorId, targetId, category: "health" }, viewer).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).pop();
    return found ? copy(found.value) : null;
  };
  const knownHealthAtMost = (scene, actorId, targetId, viewer = { role: "narrator" }) => {
    const value = knownHealth(scene, actorId, targetId, viewer);
    return Boolean(value && Number.isFinite(Number(value.current)) && Number.isFinite(Number(value.maximum)) && Number(value.current) * 2 <= Number(value.maximum));
  };
  const followupStatus = (scene, actorId, options = {}) => {
    const participant = actor(scene, actorId);
    const level = Number(participant?.techniques?.["vagabond.cunning-fighter"] || participant?.knownTechniques?.["vagabond.cunning-fighter"] || 0);
    const count = studyCount(scene, { actorId, scope: "turn" });
    return {
      available: level >= 3 && count === 0,
      techniqueId: "vagabond.cunning-fighter.3",
      sourceDigest: EN_RU_EVIDENCE["vagabond.cunning-fighter.3"].sourceDigest,
      firstStudyThisTurn: count === 0,
      requiresFocus: 1,
      requiresEnemyTarget: true,
      range: Number(participant?.attrs?.mind || 0),
      targetId: options.targetId || null,
      coverage: "partial",
    };
  };
  const infoAdapters = Object.freeze([
    { id: "powerhouse.predator.1", techniqueId: "powerhouse.predator", level: 1, label: "Хищник I: первое Изучение — Здоровье", sourceDigest: EN_RU_EVIDENCE["powerhouse.predator.1"].sourceDigest, coverage: EN_RU_EVIDENCE["powerhouse.predator.1"].coverage },
    { id: "powerhouse.predator.2", techniqueId: "powerhouse.predator", level: 2, label: "Хищник II: известное низкое Здоровье", sourceDigest: EN_RU_EVIDENCE["powerhouse.predator.2"].sourceDigest, coverage: EN_RU_EVIDENCE["powerhouse.predator.2"].coverage },
    { id: "vagabond.cunning-fighter.1", techniqueId: "vagabond.cunning-fighter", level: 1, label: "Хитроумный боец I: уникальное Изучение в Ход", sourceDigest: EN_RU_EVIDENCE["vagabond.cunning-fighter.1"].sourceDigest, coverage: EN_RU_EVIDENCE["vagabond.cunning-fighter.1"].coverage },
    { id: "vagabond.cunning-fighter.3", techniqueId: "vagabond.cunning-fighter", level: 3, label: "Хитроумный боец III: статус второго Изучения", sourceDigest: EN_RU_EVIDENCE["vagabond.cunning-fighter.3"].sourceDigest, coverage: EN_RU_EVIDENCE["vagabond.cunning-fighter.3"].coverage },
    { id: "bulwark.absolute-bastard.1", techniqueId: "bulwark.absolute-bastard", level: 1, label: "Полный ублюдок I: после Изучения", sourceDigest: EN_RU_EVIDENCE["bulwark.absolute-bastard.1"].sourceDigest, coverage: EN_RU_EVIDENCE["bulwark.absolute-bastard.1"].coverage },
    { id: "altruist.battle-instructor.1", techniqueId: "altruist.battle-instructor", level: 1, label: "Боевой инструктор I: Быстрое Изучение", sourceDigest: EN_RU_EVIDENCE["altruist.battle-instructor.1"].sourceDigest, coverage: EN_RU_EVIDENCE["altruist.battle-instructor.1"].coverage },
  ]);
  const knows = (participant, techniqueId, level) => Number(participant?.techniques?.[techniqueId] || participant?.knownTechniques?.[techniqueId] || 0) >= level;
  const enabled = (participant, ruleId) => {
    const rule = infoAdapters.find(item => item.id === ruleId);
    return Boolean(rule && knows(participant, rule.techniqueId, rule.level) && participant?.lionwing?.automation?.[ruleId] === true);
  };
  const actionQuote = (participant, context = {}) => {
    if (!participant || context.actionId !== STUDY_ACTION_ID) return null;
    const scene = context.scene;
    const patches = [];
    if (scene && enabled(participant, "powerhouse.predator.1") && studyCount(scene, { actorId: participant.id, scope: "turn" }) === 0) {
      patches.push({ id: "powerhouse.predator.1", cost: 0, costMode: "replace", swift: true, range: Number(participant.attrs?.body || 0), informationCategories: ["health"], reason: "Первое Изучение Хищника ограничено вопросом о Здоровье.", sourceDigest: EN_RU_EVIDENCE["powerhouse.predator.1"].sourceDigest, coverage: EN_RU_EVIDENCE["powerhouse.predator.1"].coverage });
    }
    if (enabled(participant, "altruist.battle-instructor.1")) {
      patches.push({ id: "altruist.battle-instructor.1", swift: true, reason: "Изучение Боевого инструктора является Быстрым.", sourceDigest: EN_RU_EVIDENCE["altruist.battle-instructor.1"].sourceDigest, coverage: EN_RU_EVIDENCE["altruist.battle-instructor.1"].coverage });
    }
    if (!patches.length) return null;
    const replacements = [...new Set(patches.filter(item => item.cost != null).map(item => item.cost))];
    if (replacements.length > 1) return { ok: false, reason: "Конфликт канонических изменений Стоимости Изучения." };
    return {
      ok: true,
      cost: replacements.length ? replacements[0] : undefined,
      costMode: replacements.length ? "replace" : undefined,
      swift: patches.some(item => item.swift),
      range: patches.find(item => item.range != null)?.range,
      informationCategories: patches.find(item => item.informationCategories)?.informationCategories || null,
      modifiers: patches.map(item => {
        const rule = infoAdapters.find(entry => entry.id === item.id);
        return { id: item.id, techniqueId: rule?.techniqueId || null, level: rule?.level || null, sourceDigest: item.sourceDigest, coverage: item.coverage, reason: item.reason };
      }),
      modifierIds: patches.map(item => item.id),
      reason: patches.map(item => item.reason).join(" "),
    };
  };
  const project = (scene, viewer = {}) => {
    const info = ensureState(scene);
    const projectedViewer = { ...viewer, scene };
    const studies = info.studies.filter(study => studyVisibleTo(study, projectedViewer, scene)).map(study => ({
      id: study.id,
      actorId: study.actorId,
      targetId: study.targetId,
      status: study.status,
      scope: study.scope,
      round: study.round,
      turnSerial: study.turnSerial,
      categories: availableCategories(scene, study).map(item => ({ id: item.id, label: item.label })),
      revealedFactIds: study.revealedFactIds || [],
    }));
    const visibleFacts = info.facts.filter(fact => visibleTo(fact, viewer) && entityVisible(scene, fact.actorId, viewer) && entityVisible(scene, fact.targetId, viewer)).map(fact => ({
      id: fact.id,
      studyId: fact.studyId,
      actorId: fact.actorId,
      targetId: fact.targetId,
      category: fact.category,
      label: fact.label,
      value: copy(fact.value),
      visibility: fact.visibility,
      manual: Boolean(fact.handout),
    }));
    const output = { schema: SCHEMA, studies, facts: visibleFacts, handouts: visibleFacts.filter(item => item.manual) };
    if (viewer.role === "narrator" || viewer.role === "gm") {
      output.pending = info.pending.map(studyId => {
        const study = info.studies.find(item => item.id === studyId);
        return study ? { studyId: study.id, targetId: study.targetId, actorId: study.actorId, categories: availableCategories(scene, study).map(item => ({ id: item.id, label: item.label })), status: study.status } : null;
      }).filter(Boolean);
      output.warnings = info.warnings.map(copy);
      output.receiptCount = info.receipts.length;
    } else {
      output.pending = [];
    }
    return output;
  };
  const formatFactValue = value => {
    if (value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "current") && Object.prototype.hasOwnProperty.call(value, "maximum")) return String(value.current) + " / " + String(value.maximum);
    if (Array.isArray(value)) return value.join(", ");
    if (value && typeof value === "object") return Object.values(value).join(", ");
    return String(value);
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  const lionwingInformationPanel = (scene, viewer = {}) => {
    const data = project(scene, viewer);
    let html = "<section class=\"scene-information-panel\"><header><h3>Изучение и сведения</h3><p>Результаты Изучения и раскрытые Нарратором факты.</p></header>";
    if (!data.studies.length) html += "<p class=\"muted\">Изученных целей пока нет.</p>";
    else {
      html += "<div class=\"information-study-history\">" + data.studies.map(study => {
        const target = actor(scene, study.targetId), status = study.status === "pending" ? "Ожидает решения Нарратора" : study.status === "cancelled" ? "Отменено" : "Раскрыто";
        return "<article class=\"information-study\"><strong>" + escapeHtml(target?.name || study.targetId) + "</strong><span>" + escapeHtml(status) + "</span><small>" + escapeHtml(study.categories.map(item => item.label).join(", ")) + "</small></article>";
      }).join("") + "</div>";
    }
    if (data.facts.length) html += "<div class=\"information-facts\">" + data.facts.map(fact => "<article class=\"information-fact\"><strong>" + escapeHtml(fact.label) + "</strong><span>" + escapeHtml(formatFactValue(fact.value)) + "</span></article>").join("") + "</div>";
    if (viewer.role === "narrator" || viewer.role === "gm") {
      if (data.pending.length) html += "<div class=\"information-pending\"><h4>Ожидает выбора Нарратора</h4>" + data.pending.map(item => "<article><span>Цель: " + escapeHtml(actor(scene, item.targetId)?.name || item.targetId) + "</span><div>" + item.categories.map(category => "<button type=\"button\" data-information-reveal=\"" + escapeHtml(item.studyId) + "\" data-information-category=\"" + escapeHtml(category.id) + "\">Раскрыть " + escapeHtml(category.label) + "</button>").join("") + "<button type=\"button\" data-information-cancel=\"" + escapeHtml(item.studyId) + "\">Отменить</button></div></article>").join("") + "</div>";
      if (data.warnings.length) html += "<div class=\"information-warnings\">" + data.warnings.map(item => "<p>" + escapeHtml(item.message) + "</p>").join("") + "</div>";
    }
    return html + "</section>";
  };
  const reset = (scene, options = {}) => {
    if (!scene || typeof scene !== "object") return emptyState();
    scene.lionwing ||= {};
    const next = emptyState();
    if (options.keepHandouts) next.handouts = copy(scene.lionwing.information?.handouts || []);
    scene.lionwing.information = next;
    return next;
  };
  const serialize = scene => JSON.stringify(copy(scene));
  const reload = value => {
    const scene = typeof value === "string" ? JSON.parse(value) : copy(value);
    if (!scene || typeof scene !== "object") fail("Сохранение информации не является JSON-объектом");
    if (scene.actors || scene.lionwing || scene.rulesEdition) {
      ensureState(scene);
      return scene;
    }
    const wrapped = { rulesEdition: "lionwing", actors: [], lionwing: { information: scene } };
    ensureState(wrapped);
    return wrapped;
  };
  const replaceSnapshot = (scene, value) => {
    scene.lionwing ||= {};
    scene.lionwing.information = copy(value);
    ensureState(scene);
    return scene;
  };
  const comparableSnapshot = value => {
    const result = copy(value);
    if (result && Array.isArray(result.journal)) result.journal = [];
    return result;
  };
  const replay = (scene, event) => {
    const input = typeof event === "string" ? JSON.parse(event) : copy(event);
    if (!input?.before || !input?.after) fail("Событие информации не содержит снимки для replay");
    const current = snapshot(scene);
    if (same(comparableSnapshot(current), comparableSnapshot(input.after))) return { ok: true, scene: copy(scene), replayed: true, idempotent: true, event: input };
    if (!same(comparableSnapshot(current), comparableSnapshot(input.before))) fail("Повтор информации применён не к тому снимку", "INFORMATION_REPLAY_STALE");
    const next = copy(scene);
    replaceSnapshot(next, input.after);
    return { ok: true, scene: next, replayed: true, idempotent: false, event: input };
  };
  const undo = (scene, event) => {
    const input = typeof event === "string" ? JSON.parse(event) : copy(event);
    if (!input?.before || !input?.after) fail("Событие информации не содержит снимки для отката");
    const current = snapshot(scene);
    if (!same(comparableSnapshot(current), comparableSnapshot(input.after))) fail("Откат информации устарел", "INFORMATION_UNDO_STALE");
    const next = copy(scene);
    replaceSnapshot(next, input.before);
    return { ok: true, scene: next, undone: true, event: { id: "undo:" + (input.id || "information"), operation: "undo", before: input.after, after: input.before } };
  };
  const api = Object.freeze({
    schema: SCHEMA,
    editionId: EDITION_ID,
    contractDigest: CONTRACT_DIGEST,
    studyActionId: STUDY_ACTION_ID,
    categories: copy(CATEGORY_DEFS),
    evidence: copy(EN_RU_EVIDENCE),
    adapters: infoAdapters.map(copy),
    emptyState,
    ensureState,
    state: infoState,
    reset,
    serialize,
    reload,
    replay,
    undo,
    recordStudy: studyRecord,
    study: studyRecord,
    availableCategories,
    confirmReveal,
    reveal: confirmReveal,
    cancelReveal,
    handout,
    studies,
    studyCount,
    studiedThisTurn,
    firstStudy,
    studyStatus,
    revealedFact,
    revealedFacts: facts,
    facts,
    markedTarget,
    markedTargetStatus,
    knownHealth,
    knownHealthAtMost,
    followupStatus,
    actionQuote,
    project,
    render: lionwingInformationPanel,
    panel: lionwingInformationPanel,
  });
  global.DAWN_LIONWING_INFORMATION_QUERY = api;
  global.lionwingInformationPanel = lionwingInformationPanel;
})(typeof window === "object" ? window : globalThis);
