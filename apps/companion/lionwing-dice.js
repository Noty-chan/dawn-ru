"use strict";

// LionWing dice are kept as a small, pure value model.  The engine may use
// this module to validate an authoritative roll or to apply a persisted
// operation, but no random source, callback, DOM node, or scene reference is
// ever stored in a roll.
(function installLionwingDice(global) {
  const MAX_POOL = 100;
  const MAX_DICE = 300;
  const MAX_OPERATIONS = 128;
  const MAX_TARGETS = 64;
  const MAX_ID = 180;
  const MAX_ROLL_ID = 150;
  const MAX_FORMULA = 180;
  const KINDS = new Set(["check", "opposed", "raw-d6"]);
  const OPERATION_KINDS = new Set([
    "add", "remove", "reroll", "change", "replace-face", "lock", "unlock",
    "set-hits", "add-hits", "change-threshold",
  ]);
  const WINDOWS = new Set(["before-roll", "post-roll", "resolution", "manual"]);
  const ORIGINS = new Set(["source", "critical", "added"]);
  const TIE_RULES = new Set(["narrator", "reroll", "both", "left", "right", "attacker", "defender", "unresolved"]);

  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const plain = value => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const fail = (message, code = "LIONWING_DICE_INVALID") => {
    const error = new Error(message);
    error.code = code;
    throw error;
  };
  const serializable = value => {
    try {
      if (JSON.stringify(value) === undefined) return false;
      const visit = item => {
        if (item === undefined || typeof item === "function" || typeof item === "symbol" || typeof item === "bigint") return false;
        if (typeof item === "number" && !Number.isFinite(item)) return false;
        if (Array.isArray(item)) return item.every(visit);
        if (item && typeof item === "object") return Object.values(item).every(visit);
        return true;
      };
      return visit(value);
    } catch {
      return false;
    }
  };
  const integer = (value, label, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
      fail(`Некорректное значение: ${label}`, "LIONWING_DICE_BOUNDS");
    }
    return value;
  };
  const face = (value, label = "грань") => integer(value, label, 1, 6);
  const id = (value, label, maximum = MAX_ID) => {
    if (typeof value !== "string" || !value || value.length > maximum || /[\u0000-\u001f\u007f\s]/u.test(value)) {
      fail(`Некорректный ID: ${label}`, "LIONWING_DICE_ID");
    }
    return value;
  };
  const optionalId = (value, label, maximum = MAX_ID) => value == null ? null : id(value, label, maximum);
  const unique = (values, label) => {
    if (new Set(values).size !== values.length) fail(`Повтор ${label}`, "LIONWING_DICE_DUPLICATE");
    return values;
  };
  const array = (value, label, maximum = MAX_DICE) => {
    if (!Array.isArray(value) || value.length > maximum) fail(`${label} должен быть массивом ограниченного размера`, "LIONWING_DICE_BOUNDS");
    return value;
  };

  // Stable JSON is used for operation receipts.  It is deliberately local to
  // this module: a receipt is a semantic fingerprint, not a cryptographic
  // authorization token.
  const stable = value => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  };
  const same = (left, right) => stable(left) === stable(right);
  const exactArray = (left, right) => Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);

  function parse(value, label = "снимок броска") {
    let result = value;
    if (typeof value === "string") {
      try { result = JSON.parse(value); } catch { fail(`${label} не является корректным JSON`, "LIONWING_DICE_JSON"); }
    }
    if (!plain(result) || !serializable(result)) fail(`${label} должен быть сохраняемым JSON-объектом`, "LIONWING_DICE_JSON");
    return result;
  }

  function fieldsFrom(raw, names, defaults = {}) {
    const nested = plain(raw.provenance) ? raw.provenance : plain(raw.identity) ? raw.identity : {};
    const result = {};
    for (const name of names) {
      const top = own(raw, name) ? raw[name] : undefined;
      const inner = own(nested, name) ? nested[name] : undefined;
      if (top != null && inner != null && top !== inner) fail(`Происхождение содержит два разных значения ${name}`, "LIONWING_DICE_PROVENANCE");
      result[name] = top ?? inner ?? defaults[name] ?? null;
    }
    return result;
  }

  function rollIdOf(raw) {
    const candidates = [raw.rollId, raw.id, raw.rollEventId].filter(value => value != null);
    if (new Set(candidates).size > 1) fail("Снимок содержит разные ID одного броска", "LIONWING_DICE_ID");
    const candidate = candidates[0] ?? raw.provenance?.rollId ?? raw.rootActionId ?? raw.actionInstanceId ?? "roll:anonymous";
    return id(candidate, "броска", MAX_ROLL_ID);
  }

  function normalizeProvenance(raw, rollId, expected = null) {
    const fields = fieldsFrom(raw, ["rootActionId", "actionId", "actionDefinitionId", "actionInstanceId", "causeEventId", "ownerActorId"], {
      rootActionId: `${rollId}:root`,
      actionInstanceId: rollId,
      causeEventId: `${rollId}:cause`,
    });
    const result = {
      schema: 1,
      rootActionId: id(fields.rootActionId, "rootAction"),
      actionId: optionalId(fields.actionId, "action"),
      actionDefinitionId: optionalId(fields.actionDefinitionId, "определения действия"),
      actionInstanceId: id(fields.actionInstanceId, "экземпляра действия"),
      causeEventId: id(fields.causeEventId, "causeEvent"),
      ownerActorId: optionalId(fields.ownerActorId, "владельца"),
    };
    if (expected) {
      if (result.rootActionId !== expected.rootActionId) fail("Операция относится к другому rootAction", "LIONWING_DICE_PROVENANCE");
      if (result.actionInstanceId !== expected.actionInstanceId) fail("Операция относится к другому экземпляру действия", "LIONWING_DICE_PROVENANCE");
    }
    return result;
  }

  function normalizeRules(raw, kind) {
    const source = plain(raw.rules) ? raw.rules : {};
    const pick = (left, right, fallback, label) => {
      if (left != null && right != null && left !== right) fail(`Правила броска содержат два разных значения: ${label}`, "LIONWING_DICE_RULES");
      return left ?? right ?? fallback;
    };
    const successAt = pick(source.successAt, raw.successAt, 4, "successAt");
    const criticalAt = pick(source.criticalAt, raw.criticalAt ?? raw.critAt, 6, "criticalAt");
    const requestedExplode = pick(source.explode, raw.explode, kind === "raw-d6" ? false : true, "explode");
    if(typeof requestedExplode!=="boolean")fail("Правило explode должно быть логическим значением", "LIONWING_DICE_RULES");
    if (![5, 6].includes(criticalAt)) fail("Критический успех допускается на 5 или 6", "LIONWING_DICE_RULES");
    integer(successAt, "порог Успеха", 2, 6);
    if (kind === "raw-d6" && requestedExplode === true) fail("Сырая D6-таблица не взрывается как обычная Проверка", "LIONWING_DICE_RULES");
    const policy = source.rerollCriticalPolicy ?? source.criticalPolicy ?? raw.rerollCriticalPolicy ?? raw.criticalPolicy ?? "explicit";
    if (!["explicit", "none"].includes(policy)) fail("Неизвестная политика дополнительных костей при изменении", "LIONWING_DICE_RULES");
    return { successAt, criticalAt, explode: kind === "raw-d6" ? false : Boolean(requestedExplode), criticalPolicy: policy };
  }

  function sourceFacesOf(raw) {
    // In a canonical snapshot rolls/faces are projections of the current
    // active dice, while sourceFaces/rawFaces remain the immutable source.
    // On a fresh/legacy request all four names are aliases of the source.
    const persisted = (raw.schema === 2 || raw.schema === 1) && Array.isArray(raw.dice) && Array.isArray(raw.operations ?? raw.modifications);
    const supplied = (persisted
      ? [raw.sourceFaces, raw.rawFaces]
      : [raw.sourceFaces, raw.rawFaces, raw.rolls, raw.faces]
    ).filter(value => value != null);
    if(supplied.length>1&&supplied.some(value=>JSON.stringify(value)!==JSON.stringify(supplied[0])))fail("Алиасы исходных граней расходятся","LIONWING_DICE_SOURCE");
    const source = raw.sourceFaces ?? raw.rawFaces ?? raw.rolls ?? raw.faces;
    if (source == null) fail("Броску нужны исходные грани", "LIONWING_DICE_SOURCE");
    array(source, "Исходные грани");
    return source.map((value, index) => face(value, `исходная грань ${index + 1}`));
  }

  function poolOf(raw, faces, rules) {
    if (raw.pool != null && raw.initialCount != null && raw.pool !== raw.initialCount) fail("pool и initialCount броска расходятся", "LIONWING_DICE_SOURCE");
    const supplied = raw.pool ?? raw.initialCount;
    if (supplied == null) {
      // A flat list without a pool is only unambiguous when no critical chain
      // is present.  For a chain, silently treating every face as a root would
      // make a malformed authoritative roll look valid.
      const inferred = faces.length;
      if (rules.explode && faces.some(value => value >= rules.criticalAt)) fail("Для броска с Критами нужен исходный пул", "LIONWING_DICE_SOURCE");
      return integer(inferred, "исходный пул", 0, MAX_POOL);
    }
    return integer(supplied, "исходный пул", 0, MAX_POOL);
  }

  function sourceRecords(raw, rollId, faces, pool, rules, provenance) {
    const supplied = raw.sourceDice == null ? null : raw.sourceDice;
    if (supplied != null) array(supplied, "исходные кости");
    if (supplied && supplied.length !== faces.length) fail("Число sourceDice не совпадает с исходными гранями", "LIONWING_DICE_SOURCE");
    const records = faces.map((value, index) => {
      const source = supplied?.[index];
      if (source != null && !plain(source)) fail("Описание исходной кости должно быть объектом", "LIONWING_DICE_SOURCE");
      if (source != null && own(source, "value") && source.value !== value) fail("Значение sourceDice не совпадает с sourceFaces", "LIONWING_DICE_SOURCE");
      if (source != null && own(source, "originalValue") && source.originalValue !== value) fail("Исходное значение sourceDice подменено", "LIONWING_DICE_SOURCE");
      const dieId = id(source?.id ?? source?.dieId ?? `${rollId}:die:${index}`, `кости ${index + 1}`);
      return {
        id: dieId,
        value,
        originalValue: value,
        active: true,
        removed: false,
        locked: false,
        origin: source?.origin ?? "source",
        parentId: source?.parentId ?? null,
        rerollCount: 0,
        changeCount: 0,
        createdByOperationId: null,
        lastChangedBy: null,
        provenance: clone(provenance),
      };
    });
    unique(records.map(record => record.id), "ID исходной кости");
    if (records.length > MAX_DICE) fail("Бросок содержит слишком много костей", "LIONWING_DICE_LIMIT");

    const expectedParents = new Map();
    const expectedOrigins = new Map();
    const queue = records.slice(0, pool);
    let next = pool;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const parent = queue[cursor];
      const critical = parent.value >= rules.criticalAt;
      if (!rules.explode || !critical) continue;
      if (next >= records.length) fail("В критической цепочке не хватает дополнительной кости", "LIONWING_DICE_SOURCE");
      const child = records[next];
      expectedParents.set(child.id, parent.id);
      expectedOrigins.set(child.id, "critical");
      queue.push(child);
      next += 1;
    }
    if (next !== records.length) fail("Исходные грани содержат лишние кости вне критической цепочки", "LIONWING_DICE_SOURCE");
    for (const record of records) {
      const expectedParent = expectedParents.get(record.id) ?? null;
      const expectedOrigin = expectedOrigins.get(record.id) ?? "source";
      // A legacy roll only has a flat `rolls`/`sourceFaces` array.  The queue
      // above is the canonical way to recover its parent links.  Explicit
      // sourceDice must agree with those links instead of silently replacing
      // them.
      if (!supplied) {
        record.parentId = expectedParent;
        record.origin = expectedOrigin;
      }
      if (record.parentId !== expectedParent || !ORIGINS.has(record.origin) || record.origin !== expectedOrigin) {
        fail("Потеряна или подменена связь дополнительной кости с Критом", "LIONWING_DICE_SOURCE");
      }
    }
    return records;
  }

  function baseState(raw) {
    const input = parse(raw);
    if (input.schema != null && ![1, 2].includes(input.schema)) fail("Версия снимка броска не поддерживается", "LIONWING_DICE_VERSION");
    const kind = input.kind ?? input.rollKind ?? "check";
    if (!KINDS.has(kind)) fail("Неизвестный вид броска", "LIONWING_DICE_KIND");
    const rollId = rollIdOf(input);
    const provenance = normalizeProvenance(input, rollId);
    // `rules` is the current result policy and can be changed by an explicit
    // post-roll operation.  The source chain must always be checked against
    // the policy that was active when the authority rolled the pool.
    const sourceRuleInput = plain(input.sourceRules) ? { ...input, rules: input.sourceRules } : input;
    if (sourceRuleInput !== input) {
      delete sourceRuleInput.successAt;
      delete sourceRuleInput.criticalAt;
      delete sourceRuleInput.critAt;
      delete sourceRuleInput.explode;
    }
    const sourceRules = normalizeRules(sourceRuleInput, kind);
    const rules = clone(sourceRules);
    const faces = sourceFacesOf(input);
    const pool = poolOf(input, faces, sourceRules);
    const records = sourceRecords(input, rollId, faces, pool, sourceRules, provenance);
    const formula = input.formula == null ? `${pool}D6` : String(input.formula);
    if (formula.length > MAX_FORMULA) fail("Формула броска слишком длинная", "LIONWING_DICE_BOUNDS");
    return {
      schema: 2,
      id: rollId,
      rollId,
      kind,
      pool,
      initialCount: pool,
      sourceRules,
      sourceRulesDigest: stable(sourceRules),
      rules,
      formula,
      provenance,
      sourceDice: clone(records),
      dice: records,
      operations: [],
      receipts: [],
      hitAdjustment: 0,
      hitAdjustments: [],
      nextDieOrdinal: records.length,
    };
  }

  function targetIdsOf(raw) {
    const supplied=[raw.dieIds,raw.targetIds,raw.dieId==null?null:[raw.dieId]].filter(value=>value!=null);
    if(supplied.length>1&&supplied.some(value=>JSON.stringify(value)!==JSON.stringify(supplied[0])))fail("Алиасы ID костей расходятся","LIONWING_DICE_TARGET");
    const value = raw.dieIds ?? raw.targetIds ?? (raw.dieId == null ? null : [raw.dieId]);
    if (value == null) fail("Операции над костями требуют конкретные ID", "LIONWING_DICE_TARGET");
    array(value, "ID костей", MAX_TARGETS);
    if (!value.length) fail("Операция не может быть применена к нулю костей", "LIONWING_DICE_TARGET");
    const result = value.map((item, index) => id(item, `кости ${index + 1}`));
    return unique(result, "ID костей");
  }

  function valuesOf(raw, count, label = "значения") {
    const candidate = raw.values ?? raw.faces ?? raw.rolls ?? raw.newValues ?? (raw.value == null ? null : [raw.value]) ?? (raw.face == null ? null : [raw.face]);
    if (candidate == null) fail(`Операции нужны ${label}`, "LIONWING_DICE_OPERATION");
    const values = Array.isArray(candidate) ? candidate : [candidate];
    if (values.length !== count) fail(`Число ${label} не совпадает с числом костей`, "LIONWING_DICE_OPERATION");
    return values.map((value, index) => face(value, `${label} ${index + 1}`));
  }

  function addedEntriesOf(raw) {
    const candidate = raw.addedDice ?? raw.dice;
    let entries;
    if (candidate != null) {
      array(candidate, "добавляемые кости", MAX_DICE);
      entries = candidate.map((item, index) => {
        if (!plain(item)) fail("Добавляемая кость должна быть объектом", "LIONWING_DICE_OPERATION");
        const value = item.value ?? item.face;
        return {
          id: item.id ?? item.dieId ?? null,
          value: face(value, `добавляемая грань ${index + 1}`),
          parentId: item.parentId ?? null,
          origin: item.origin ?? (item.parentId == null ? "added" : "critical"),
        };
      });
    } else {
      const candidateValues = raw.values ?? raw.faces ?? raw.rolls ?? (raw.value == null ? null : [raw.value]) ?? (raw.face == null ? null : [raw.face]);
      if (candidateValues == null) fail("Операции add нужны добавляемые грани", "LIONWING_DICE_OPERATION");
      array(candidateValues, "добавляемые грани", MAX_DICE);
      entries = candidateValues.map((value, index) => ({
        id: null,
        value: face(value, `добавляемая грань ${index + 1}`),
        parentId: Array.isArray(raw.parentIds) ? raw.parentIds[index] ?? null : raw.parentId ?? null,
        origin: raw.origin ?? (Array.isArray(raw.parentIds) ? raw.parentIds[index] == null ? "added" : "critical" : raw.parentId == null ? "added" : "critical"),
      }));
    }
    if (!entries.length) fail("Нельзя добавить ноль костей", "LIONWING_DICE_OPERATION");
    if (entries.length > MAX_TARGETS) fail("Одна операция добавляет слишком много костей", "LIONWING_DICE_LIMIT");
    for (const [index, entry] of entries.entries()) {
      entry.id = optionalId(entry.id, `добавляемой кости ${index + 1}`);
      entry.parentId = optionalId(entry.parentId, `родителя кости ${index + 1}`);
      if (!ORIGINS.has(entry.origin) || entry.origin === "source") fail("Некорректное происхождение добавляемой кости", "LIONWING_DICE_OPERATION");
      if (entry.origin === "critical" && !entry.parentId) fail("Дополнительной кости Крита нужен parentId", "LIONWING_DICE_OPERATION");
      if (entry.origin === "added" && entry.parentId) entry.origin = "critical";
    }
    const suppliedIds = entries.filter(entry => entry.id).map(entry => entry.id);
    unique(suppliedIds, "явный ID добавляемой кости");
    if (suppliedIds.length && suppliedIds.length !== entries.length) fail("Либо все добавляемые кости получают ID, либо ID генерируются целиком", "LIONWING_DICE_OPERATION");
    return { entries, idMode: suppliedIds.length ? "explicit" : "generated" };
  }

  function operationProvenance(raw, state) {
    const supplied = fieldsFrom(raw, ["rootActionId", "actionId", "actionDefinitionId", "actionInstanceId", "causeEventId", "ownerActorId"], state.provenance);
    return normalizeProvenance(supplied, state.id, state.provenance);
  }

  function normalizeOperation(raw, state) {
    if (!plain(raw) || !serializable(raw)) fail("Операция броска должна быть JSON-объектом", "LIONWING_DICE_OPERATION");
    const originalKind = raw.kind ?? raw.type;
    if(raw.kind!=null&&raw.type!=null&&(raw.kind==="replace-face"?"change":raw.kind)!==(raw.type==="replace-face"?"change":raw.type))fail("Алиасы вида операции расходятся","LIONWING_DICE_OPERATION");
    const kind = originalKind === "replace-face" ? "change" : originalKind;
    if (!OPERATION_KINDS.has(originalKind) && !OPERATION_KINDS.has(kind)) fail("Неизвестная операция над костями", "LIONWING_DICE_OPERATION");
    const operationId = raw.operationId ?? raw.id;
    if(raw.operationId!=null&&raw.id!=null&&raw.operationId!==raw.id)fail("Алиасы ID операции расходятся","LIONWING_DICE_OPERATION");
    const operation = {
      id: id(operationId, "операции"),
      kind,
      provenance: operationProvenance(raw, state),
    };
    if (kind === "add") {
      const added = addedEntriesOf(raw);
      operation.idMode = raw.idMode === "generated" ? "generated" : added.idMode;
      operation.entries = added.entries;
      operation.requestedIds = operation.idMode === "explicit" ? added.entries.map(entry => entry.id) : null;
    } else if (["remove", "reroll", "change", "lock", "unlock"].includes(kind)) {
      operation.dieIds = targetIdsOf(raw);
      if (["reroll", "change"].includes(kind)) operation.values = valuesOf(raw, operation.dieIds.length, kind === "reroll" ? "новые значения" : "новые грани");
      if (kind === "lock" && raw.locked != null && raw.locked !== true) fail("Операция lock не снимает блокировку; используйте unlock", "LIONWING_DICE_OPERATION");
    } else if (["set-hits", "add-hits"].includes(kind)) {
      if (state.kind === "raw-d6") fail("Сырая D6-таблица не имеет Hits", "LIONWING_DICE_OPERATION");
      operation.value = kind === "set-hits"
        ? integer(raw.value ?? raw.amount, "числа Успехов", 0, MAX_DICE)
        : integer(raw.value ?? raw.amount, "добавки Успехов", -MAX_DICE, MAX_DICE);
    } else if (kind === "change-threshold") {
      operation.window = raw.window ?? raw.allowedWindow;
      if (!WINDOWS.has(operation.window)) fail("Изменение порога требует именованного окна", "LIONWING_DICE_OPERATION");
      operation.successAt = raw.successAt == null ? null : integer(raw.successAt, "порога Успеха", 2, 6);
      operation.criticalAt = raw.criticalAt == null ? null : raw.criticalAt;
      if (operation.criticalAt != null && ![5, 6].includes(operation.criticalAt)) fail("Критический порог допускается только 5 или 6", "LIONWING_DICE_RULES");
      if (operation.successAt == null && operation.criticalAt == null) fail("Изменение порога не содержит нового порога", "LIONWING_DICE_OPERATION");
    }
    const semantic = {
      id: operation.id,
      kind: operation.kind,
      dieIds: operation.dieIds ?? null,
      values: operation.values ?? null,
      entries: operation.kind === "add" ? operation.entries.map(entry => ({ id: operation.idMode === "explicit" ? entry.id : null, value: entry.value, parentId: entry.parentId, origin: entry.origin })) : null,
      idMode: operation.idMode ?? null,
      requestedIds: operation.requestedIds ?? null,
      value: operation.value ?? null,
      window: operation.window ?? null,
      successAt: operation.successAt ?? null,
      criticalAt: operation.criticalAt ?? null,
      provenance: operation.provenance,
    };
    operation.digest = stable(semantic);
    return operation;
  }

  function recordById(state, dieId) {
    const record = state.dice.find(item => item.id === dieId);
    if (!record) fail(`Кость не найдена: ${dieId}`, "LIONWING_DICE_TARGET");
    return record;
  }

  function activeRecord(state, dieId) {
    const record = recordById(state, dieId);
    if (!record.active || record.removed) fail(`Кость уже удалена: ${dieId}`, "LIONWING_DICE_TARGET");
    return record;
  }

  function nextDieId(state) {
    const candidate = `${state.id}:die:${state.nextDieOrdinal}`;
    id(candidate, "новой кости");
    state.nextDieOrdinal += 1;
    return candidate;
  }

  function operationStamp(operation) {
    return {
      rootActionId: operation.provenance.rootActionId,
      actionInstanceId: operation.provenance.actionInstanceId,
      causeEventId: operation.provenance.causeEventId,
      operationId: operation.id,
    };
  }

  function applyOne(stateInput, rawOperation) {
    const state = stateInput;
    const operation = normalizeOperation(rawOperation, state);
    const oldReceipt = state.receipts.find(receipt => receipt.operationId === operation.id);
    if (oldReceipt) {
      if (oldReceipt.digest !== operation.digest) fail(`Повтор операции с другими данными: ${operation.id}`, "LIONWING_DICE_CONFLICT");
      return state;
    }
    if (state.operations.length >= MAX_OPERATIONS) fail("Бросок достиг лимита операций", "LIONWING_DICE_LIMIT");
    const stamp = operationStamp(operation);
    if (operation.kind === "add") {
      const entries = operation.entries.map(entry => ({ ...entry }));
      if (state.dice.length + entries.length > MAX_DICE) fail("Бросок достиг лимита костей", "LIONWING_DICE_LIMIT");
      const allocated = new Set();
      entries.forEach((entry, index) => {
        // Generated IDs are part of the replay contract.  A reloaded
        // operation carries the generated ID in `addedDice`; consume the same
        // ordinal and reject a substituted ID instead of accepting a forked
        // history.
        const generatedId = operation.idMode === "generated" ? nextDieId(state) : null;
        const dieId = entry.id || generatedId;
        if (generatedId && entry.id && entry.id !== generatedId) fail(`ID новой кости не совпадает с replay: ${entry.id}`, "LIONWING_DICE_TAMPER");
        id(dieId, `добавляемой кости ${index + 1}`);
        if (allocated.has(dieId) || state.dice.some(die => die.id === dieId)) fail(`Повтор ID кости: ${dieId}`, "LIONWING_DICE_DUPLICATE");
        allocated.add(dieId);
        entry.id = dieId;
        if (entry.parentId) {
          const parent = [...state.dice, ...entries.slice(0, index).map(item => item.__record).filter(Boolean)].find(die => die.id === entry.parentId);
          if (!parent) fail(`Родительская кость не найдена: ${entry.parentId}`, "LIONWING_DICE_TARGET");
          if (entry.origin !== "critical") fail("Связь parentId должна иметь происхождение critical", "LIONWING_DICE_OPERATION");
          if (parent.value < state.rules.criticalAt) fail("Дополнительная кость ссылается на некритичную грань", "LIONWING_DICE_OPERATION");
        }
        entry.__record = {
          id: dieId,
          value: entry.value,
          originalValue: entry.value,
          active: true,
          removed: false,
          locked: false,
          origin: entry.origin,
          parentId: entry.parentId,
          rerollCount: 0,
          changeCount: 0,
          createdByOperationId: operation.id,
          lastChangedBy: null,
          provenance: clone(operation.provenance),
        };
      });
      operation.addedDice = entries.map(entry => ({ id: entry.id, value: entry.value, parentId: entry.parentId, origin: entry.origin }));
      for (const entry of entries) state.dice.push(entry.__record);
      delete operation.entries;
    } else if (["remove", "reroll", "change", "lock", "unlock"].includes(operation.kind)) {
      const records = operation.dieIds.map(dieId => activeRecord(state, dieId));
      if (["remove", "reroll", "change"].includes(operation.kind)) records.forEach(record => {
        if (record.locked) fail(`Кость заблокирована: ${record.id}`, "LIONWING_DICE_LOCKED");
      });
      records.forEach((record, index) => {
        if (operation.kind === "remove") {
          record.active = false;
          record.removed = true;
        } else if (operation.kind === "reroll") {
          record.value = operation.values[index];
          record.rerollCount += 1;
        } else if (operation.kind === "change") {
          record.value = operation.values[index];
          record.changeCount += 1;
        } else if (operation.kind === "lock") {
          record.locked = true;
        } else if (operation.kind === "unlock") {
          record.locked = false;
        }
        record.lastChangedBy = clone(stamp);
      });
    } else if (operation.kind === "set-hits") {
      const activeHits = state.dice.filter(record => record.active && record.value >= state.rules.successAt).length;
      state.hitAdjustment = operation.value - activeHits;
      state.hitAdjustments.push({ mode: "set", value: operation.value, operationId: operation.id, provenance: clone(operation.provenance) });
    } else if (operation.kind === "add-hits") {
      state.hitAdjustment += operation.value;
      state.hitAdjustments.push({ mode: "add", value: operation.value, operationId: operation.id, provenance: clone(operation.provenance) });
    } else if (operation.kind === "change-threshold") {
      if (operation.successAt != null) state.rules.successAt = operation.successAt;
      if (operation.criticalAt != null) state.rules.criticalAt = operation.criticalAt;
    }
    state.operations.push(clone(operation));
    state.receipts.push({ operationId: operation.id, digest: operation.digest });
    return state;
  }

  function stripRecord(record) {
    const recordId = record.id ?? record.dieId;
    return {
      id: recordId,
      dieId: recordId,
      value: record.value,
      originalValue: record.originalValue,
      active: Boolean(record.active),
      removed: Boolean(record.removed),
      locked: Boolean(record.locked),
      origin: record.origin,
      parentId: record.parentId ?? null,
      rerollCount: record.rerollCount,
      changeCount: record.changeCount,
      createdByOperationId: record.createdByOperationId ?? null,
    };
  }

  function resultCounts(state) {
    const active = state.dice.filter(record => record.active && !record.removed);
    if (state.kind === "raw-d6") return { active, baseHits: null, hits: null, baseCrits: null, crits: null };
    const baseHits = active.filter(record => record.value >= state.rules.successAt).length;
    const baseCrits = active.filter(record => record.value >= state.rules.criticalAt).length;
    return { active, baseHits, hits: Math.max(0, Math.min(MAX_DICE, baseHits + state.hitAdjustment)), baseCrits, crits: baseCrits };
  }

  function project(state) {
    const counts = resultCounts(state);
    const sourceFaces = state.sourceDice.map(record => record.value);
    const finalFaces = counts.active.map(record => record.value);
    const links = state.dice.filter(record => record.parentId).map(record => ({
      parentDieId: record.parentId,
      childDieId: record.id,
      operationId: record.createdByOperationId,
    }));
    const dice = state.dice.map(record => stripRecord(record));
    const sourceDice = state.sourceDice.map(record => ({ id: record.id, dieId: record.id, value: record.value, origin: record.origin, parentId: record.parentId }));
    const provenance = clone(state.provenance);
    return {
      schema: 2,
      id: state.id,
      rollId: state.rollId,
      kind: state.kind,
      pool: state.pool,
      initialCount: state.initialCount,
      formula: state.formula,
      rules: clone(state.rules),
      sourceRules: clone(state.sourceRules),
      sourceRulesDigest: state.sourceRulesDigest,
      provenance,
      rootActionId: provenance.rootActionId,
      actionId: provenance.actionId,
      actionDefinitionId: provenance.actionDefinitionId,
      actionInstanceId: provenance.actionInstanceId,
      causeEventId: provenance.causeEventId,
      ownerActorId: provenance.ownerActorId,
      sourceDice,
      sourceFaces,
      dice,
      activeDice: dice.filter(record => record.active && !record.removed),
      finalDice: dice.filter(record => record.active && !record.removed),
      finalFaces,
      rolls: clone(finalFaces),
      activeCount: counts.active.length,
      hits: counts.hits,
      successes: counts.hits,
      baseHits: counts.baseHits,
      hitAdjustment: state.hitAdjustment,
      hitAdjustments: clone(state.hitAdjustments),
      criticals: counts.crits,
      criticalCount: counts.crits,
      crits: counts.crits,
      critAt: state.rules.criticalAt,
      explode: state.rules.explode,
      criticalLinks: links,
      operations: clone(state.operations),
      modifications: clone(state.operations),
      operationReceipts: clone(state.receipts),
      appliedOperationIds: state.receipts.map(receipt => receipt.operationId),
      nextDieOrdinal: state.nextDieOrdinal,
      revision: state.operations.length,
    };
  }

  function comparePersisted(input, state, canonical) {
    const ruleKeys = ["successAt", "criticalAt", "explode", "criticalPolicy"];
    const compareRuleSet = (actual, expected, label) => {
      if (!plain(actual)) return;
      for (const key of ruleKeys) if (own(actual, key) && actual[key] !== expected[key]) fail(`${label} содержит изменённое правило ${key}`, "LIONWING_DICE_TAMPER");
    };
    compareRuleSet(input.rules, canonical.rules, "rules");
    compareRuleSet(input.sourceRules, canonical.sourceRules, "sourceRules");
    if (own(input, "sourceRulesDigest") && input.sourceRulesDigest !== canonical.sourceRulesDigest) fail("Изменён отпечаток исходных правил броска", "LIONWING_DICE_TAMPER");
    if (own(input, "finalFaces") && !exactArray(input.finalFaces, canonical.finalFaces)) fail("Итоговые грани не совпадают с журналом операций", "LIONWING_DICE_TAMPER");
    // When sourceFaces is absent, `rolls` was used as the legacy source and
    // cannot also be treated as a final projection.  New snapshots have both.
    if (own(input, "sourceFaces") && own(input, "rolls") && !exactArray(input.rolls, canonical.rolls)) fail("Итоговые rolls не совпадают с журналом операций", "LIONWING_DICE_TAMPER");
    if (Array.isArray(input.dice)) {
      const expected = state.dice.map(stripRecord);
      const actual = input.dice.map(stripRecord);
      if (!same(actual, expected)) fail("Состояние отдельных костей не совпадает с операциями", "LIONWING_DICE_TAMPER");
    }
    for (const key of ["activeDice", "finalDice"]) if (Array.isArray(input[key])) {
      const expected = canonical.activeDice.map(stripRecord);
      const actual = input[key].map(stripRecord);
      if (!same(actual, expected)) fail(`Изменен проекционный список ${key}`, "LIONWING_DICE_TAMPER");
    }
    if (Array.isArray(input.sourceDice)) {
      const sourceProjection = record => ({ id: record.id ?? record.dieId, value: record.value, origin: record.origin ?? "source", parentId: record.parentId ?? null });
      const expected = canonical.sourceDice.map(sourceProjection);
      const actual = input.sourceDice.map(sourceProjection);
      if (!same(actual, expected)) fail("Исходные кости не совпадают с исходными гранями", "LIONWING_DICE_TAMPER");
    }
    if (Array.isArray(input.criticalLinks) && !same(input.criticalLinks, canonical.criticalLinks)) fail("Изменены связи критической цепочки", "LIONWING_DICE_TAMPER");
    if (own(input, "nextDieOrdinal") && input.nextDieOrdinal !== canonical.nextDieOrdinal) fail("Повреждён счётчик новых костей", "LIONWING_DICE_TAMPER");
    if (own(input, "hitAdjustment") && input.hitAdjustment !== canonical.hitAdjustment) fail("Повреждена явная модификация Успехов", "LIONWING_DICE_TAMPER");
    const inputOperations = input.operations ?? input.modifications;
    if (Array.isArray(inputOperations)) {
      if (inputOperations.length !== canonical.operations.length) fail("Журнал операций неполон", "LIONWING_DICE_TAMPER");
      inputOperations.forEach((operation, index) => {
        if (!plain(operation) || operation.id !== canonical.operations[index].id || (operation.kind === "replace-face" ? "change" : operation.kind) !== canonical.operations[index].kind) fail("Журнал операций повреждён", "LIONWING_DICE_TAMPER");
        if (operation.digest != null && operation.digest !== canonical.operations[index].digest) fail("Изменена квитанция операции", "LIONWING_DICE_TAMPER");
        if (operation.addedDice != null && !same(operation.addedDice, canonical.operations[index].addedDice)) fail("Изменены добавленные кости операции", "LIONWING_DICE_TAMPER");
      });
    }
    if (Array.isArray(input.appliedOperationIds) && !same(input.appliedOperationIds, canonical.appliedOperationIds)) fail("Изменён список применённых операций", "LIONWING_DICE_TAMPER");
    if (Array.isArray(input.operationReceipts) && !same(input.operationReceipts, canonical.operationReceipts)) fail("Изменены квитанции операций", "LIONWING_DICE_TAMPER");
  }

  function stateFromSnapshot(value) {
    const input = parse(value);
    const state = baseState(input);
    const operations = input.operations ?? input.modifications ?? [];
    if (!Array.isArray(operations) || operations.length > MAX_OPERATIONS) fail("Журнал операций имеет неверный размер", "LIONWING_DICE_LIMIT");
    for (const operation of operations) applyOne(state, operation);
    const canonical = project(state);
    comparePersisted(input, state, canonical);
    return state;
  }

  function normalize(value) {
    return project(stateFromSnapshot(value));
  }

  function create(value) {
    return normalize(value);
  }

  function generatedFaces(request, random) {
    const kind = request.kind ?? request.rollKind ?? "check";
    if (!KINDS.has(kind)) fail("Неизвестный вид броска", "LIONWING_DICE_KIND");
    const rules = normalizeRules(request, kind);
    const pool = integer(request.pool ?? request.initialCount, "исходный пул", 0, MAX_POOL);
    if (typeof random !== "function") fail("Авторитетному броску нужен источник случайности", "LIONWING_DICE_RANDOM");
    const faces = [];
    const queue = Array.from({ length: pool }, () => 0);
    while (queue.length) {
      queue.shift();
      const sample = random();
      if (typeof sample !== "number" || !Number.isFinite(sample) || sample < 0 || sample >= 1) fail("Источник случайности должен вернуть число от 0 до 1", "LIONWING_DICE_RANDOM");
      const value = 1 + Math.floor(sample * 6);
      faces.push(value);
      if (rules.explode && value >= rules.criticalAt) queue.push(0);
      if (faces.length > MAX_DICE) fail("Критическая цепочка превысила лимит костей", "LIONWING_DICE_LIMIT");
    }
    return faces;
  }

  function roll(request = {}, options = {}) {
    if (!plain(request)) fail("Запрос броска должен быть объектом", "LIONWING_DICE_SOURCE");
    const source = request.sourceFaces ?? request.rawFaces ?? request.rolls ?? request.faces;
    if (source != null) return normalize({ ...request, sourceFaces: clone(source) });
    const random = options.random ?? request.random ?? Math.random;
    const safe = { ...request };
    delete safe.random;
    safe.sourceFaces = generatedFaces(request, random);
    return normalize(safe);
  }

  function apply(value, operation, context = null) {
    const state = stateFromSnapshot(value);
    let request = operation;
    if (context != null) {
      if (!plain(context)) fail("Контекст операции должен быть JSON-объектом", "LIONWING_DICE_PROVENANCE");
      request = { ...operation, ...context, provenance: { ...(plain(operation?.provenance) ? operation.provenance : {}), ...context.provenance } };
    }
    const working = clone(state);
    applyOne(working, request);
    return project(working);
  }

  function applyOperations(value, operations) {
    if (!Array.isArray(operations) || operations.length > MAX_OPERATIONS) fail("Список операций имеет неверный размер", "LIONWING_DICE_LIMIT");
    const state = clone(stateFromSnapshot(value));
    for (const operation of operations) applyOne(state, operation);
    return project(state);
  }

  function preview(value, operation) {
    try { return { ok: true, roll: apply(value, operation) }; }
    catch (error) { return { ok: false, code: error.code || "LIONWING_DICE_INVALID", errors: [error.message] }; }
  }

  function validate(value) {
    try { return { ok: true, roll: normalize(value) }; }
    catch (error) { return { ok: false, code: error.code || "LIONWING_DICE_INVALID", errors: [error.message] }; }
  }

  function serialize(value) {
    return JSON.stringify(normalize(value));
  }

  function derived(value) {
    const normalized = normalize(value);
    return {
      hits: normalized.hits,
      successes: normalized.successes,
      crits: normalized.crits,
      criticals: normalized.criticals,
      baseHits: normalized.baseHits,
      hitAdjustment: normalized.hitAdjustment,
    };
  }

  function sourceSide(raw, side, opposedId, opposedProvenance, options = {}) {
    if (!plain(raw)) fail("Участник встречной Проверки должен быть объектом", "LIONWING_DICE_OPPOSED");
    const participantId = id(raw.participantId ?? raw.participantIdValue ?? raw.id ?? side, `участника ${side}`);
    const actionInstanceId = `${opposedProvenance.actionInstanceId}:${side}`;
    const sideRaw = {
      ...raw,
      id: `${opposedId}:${side}`,
      rollId: `${opposedId}:${side}`,
      kind: "opposed",
      rootActionId: opposedProvenance.rootActionId,
      actionId: opposedProvenance.actionId,
      actionDefinitionId: opposedProvenance.actionDefinitionId,
      actionInstanceId,
      causeEventId: opposedProvenance.causeEventId,
      ownerActorId: raw.ownerActorId ?? opposedProvenance.ownerActorId,
      participantId,
    };
    if (sideRaw.sourceFaces == null && sideRaw.rolls == null && sideRaw.faces == null && sideRaw.rawFaces == null) {
      sideRaw.sourceFaces = generatedFaces(sideRaw, options.random);
    }
    const result = normalize(sideRaw);
    result.participantId = participantId;
    return result;
  }

  function opposedInputs(raw) {
    if (Array.isArray(raw.participants)) {
      if (raw.participants.length !== 2) fail("Встречная Проверка требует ровно двух участников", "LIONWING_DICE_OPPOSED");
      return raw.participants;
    }
    if (plain(raw.left) && plain(raw.right)) return [raw.left, raw.right];
    if (plain(raw.attacker) && plain(raw.defender)) return [raw.attacker, raw.defender];
    if (plain(raw.sides) && plain(raw.sides.left) && plain(raw.sides.right)) return [raw.sides.left, raw.sides.right];
    fail("Встречной Проверке нужны две сохранённые стороны", "LIONWING_DICE_OPPOSED");
  }

  function tieRuleOf(raw) {
    const tieRule = raw.tieRule ?? raw.tie?.rule;
    if(tieRule==null)fail("Встречной Проверке нужно явное правило ничьей", "LIONWING_DICE_OPPOSED");
    if (!TIE_RULES.has(tieRule)) fail("Встречная Проверка требует явного правила ничьей", "LIONWING_DICE_OPPOSED");
    return tieRule;
  }

  function opposedState(raw, options = {}) {
    const input = parse(raw, "встречная Проверка");
    const opposedId = id(input.id ?? input.opposedRollId ?? input.rollEventId ?? input.rootActionId ?? "opposed:anonymous", "встречной Проверки", MAX_ROLL_ID);
    const provenance = normalizeProvenance(input, opposedId);
    const participants = opposedInputs(input);
    const random = options.random ?? Math.random;
    const left = sourceSide(participants[0], "left", opposedId, provenance, { random });
    const right = sourceSide(participants[1], "right", opposedId, provenance, { random });
    unique([left.participantId, right.participantId], "участника встречной Проверки");
    const tieRule = tieRuleOf(input);
    const resolution=input.resolution??null;
    if(resolution!=null){
      if(left.hits!==right.hits)fail("Решение ничьей задано для проверки без ничьей","LIONWING_DICE_OPPOSED");
      if(!["left","right","attacker","defender","both","reroll"].includes(resolution))fail("Недопустимое решение ничьей","LIONWING_DICE_OPPOSED");
      if(["left","attacker"].includes(tieRule)&&!["left","attacker"].includes(resolution)||["right","defender"].includes(tieRule)&&!["right","defender"].includes(resolution)||tieRule==="both"&&resolution!=="both"||tieRule==="reroll"&&resolution!=="reroll")fail("Решение не разрешено правилом ничьей","LIONWING_DICE_OPPOSED");
    }
    if (input.leftRoll != null || input.rightRoll != null || input.rolls && plain(input.rolls)) {
      const persistedLeft = input.leftRoll ?? input.rolls.left;
      const persistedRight = input.rightRoll ?? input.rolls.right;
      const comparable = value => {
        const result = normalize(value);
        delete result.participantId;
        return result;
      };
      if (persistedLeft != null && !same(comparable(persistedLeft), comparable(left))) fail("Левая проверка встречной Проверки повреждена", "LIONWING_DICE_TAMPER");
      if (persistedRight != null && !same(comparable(persistedRight), comparable(right))) fail("Правая проверка встречной Проверки повреждена", "LIONWING_DICE_TAMPER");
    }
    return { schema: 1, id: opposedId, kind: "opposed", provenance, left, right, tieRule, resolution };
  }

  function projectOpposed(state) {
    const leftHits = state.left.hits;
    const rightHits = state.right.hits;
    if (leftHits == null || rightHits == null) fail("Встречная Проверка не может сравнить сырые D6", "LIONWING_DICE_OPPOSED");
    const tie = leftHits === rightHits;
    let winnerParticipantId = null;
    if (!tie) winnerParticipantId = leftHits > rightHits ? state.left.participantId : state.right.participantId;
    if (tie && state.resolution && ["left", "attacker"].includes(state.resolution)) winnerParticipantId = state.left.participantId;
    if (tie && ["right", "defender"].includes(state.resolution)) winnerParticipantId = state.right.participantId;
    const tieResolved = tie && state.resolution != null && state.resolution !== "reroll";
    return {
      schema: 1,
      id: state.id,
      kind: "opposed",
      provenance: clone(state.provenance),
      rootActionId: state.provenance.rootActionId,
      actionInstanceId: state.provenance.actionInstanceId,
      causeEventId: state.provenance.causeEventId,
      tieRule: state.tieRule,
      participants: [clone(state.left), clone(state.right)],
      leftRoll: clone(state.left),
      rightRoll: clone(state.right),
      rolls: { left: clone(state.left), right: clone(state.right) },
      comparison: { leftHits, rightHits, difference: leftHits - rightHits, tie, winnerParticipantId },
      resolution: state.resolution,
      status: tie && !tieResolved ? "tied" : "resolved",
    };
  }

  function opposed(value, options = {}) {
    return projectOpposed(opposedState(value, options));
  }

  function resolveTie(value, resolution) {
    const input = parse(value, "встречная Проверка");
    const state = opposedState(input);
    const current = projectOpposed(state);
    if (!current.comparison.tie) fail("Решение ничьей требуется только при ничьей", "LIONWING_DICE_OPPOSED");
    const choice = typeof resolution === "string" ? resolution : resolution?.choice;
    if(current.resolution!=null){if(current.resolution===choice)return current;fail("Уже разрешённую ничью нельзя переиграть","LIONWING_DICE_OPPOSED");}
    if (!["left", "right", "attacker", "defender", "both", "reroll"].includes(choice)) fail("Недопустимое решение ничьей", "LIONWING_DICE_OPPOSED");
    if (["left", "attacker"].includes(state.tieRule) && !["left", "attacker"].includes(choice) || ["right", "defender"].includes(state.tieRule) && !["right", "defender"].includes(choice) || state.tieRule === "both" && choice !== "both" || state.tieRule === "reroll" && choice !== "reroll") fail("Решение не разрешено правилом ничьей", "LIONWING_DICE_OPPOSED");
    state.resolution = choice;
    return projectOpposed(state);
  }

  function reload(value) {
    const input = parse(value);
    if (input.kind === "opposed" && (input.leftRoll || input.rightRoll || input.participants?.length === 2)) return opposed(input);
    return normalize(input);
  }

  const api = {
    MAX_POOL,
    MAX_DICE,
    MAX_OPERATIONS,
    MAX_TARGETS,
    kinds: Object.freeze([...KINDS]),
    operationKinds: Object.freeze([...OPERATION_KINDS]),
    create,
    createRoll: create,
    fromSource: create,
    normalize,
    normalizeRoll: normalize,
    validateRoll: normalize,
    fromRoll: normalize,
    verify: validate,
    verifyRoll: validate,
    validate,
    roll,
    derive: derived,
    deriveResult: derived,
    recalculate: value => normalize(value),
    apply,
    applyOperation: apply,
    operate: apply,
    applyOperations,
    preview,
    add: (value, operation) => apply(value, { ...operation, kind: "add" }),
    remove: (value, operation) => apply(value, { ...operation, kind: "remove" }),
    reroll: (value, operation) => apply(value, { ...operation, kind: "reroll" }),
    change: (value, operation) => apply(value, { ...operation, kind: "change" }),
    lock: (value, operation) => apply(value, { ...operation, kind: "lock" }),
    unlock: (value, operation) => apply(value, { ...operation, kind: "unlock" }),
    serialize,
    reload,
    fromJSON: reload,
    replay: reload,
    opposed,
    opposedRoll: opposed,
    resolveTie,
  };
  global.DAWN_LIONWING_DICE = Object.freeze(api);
})(typeof window === "object" ? window : globalThis);
