(function (global) {
  "use strict";
  const A = Object.freeze({ spell: "action.атаки.заклинание", skirmish: "action.атаки.стычка", finish: "action.атаки.завершение", study: "action.утилитарные-действия.изучение", breathe: "action.утилитарные-действия.передышка", step: "action.перемещение.шаг", improvise: "action.утилитарные-действия.импровизация", interact: "action.утилитарные-действия.взаимодействие" });
  const defs = [
    ["powerhouse.dragonslayer.1", "Драконоборец I", "5967f1ff724e990c007796133cc60b106a15c4d303d733bda7e73e4b4eb52f7d"],
    ["powerhouse.dragonslayer.3", "Драконоборец III", "2ff4e5d3424564bbc5f46de9fc2a2ca411701d14a1c94fa9c7bb67e13791886b"],
    ["powerhouse.gunslinger.1", "Стрелок I", "cc0633b1a8b266f025540ac30297254052750613f30867617e5b336ac5f58f9b"],
    ["powerhouse.gunslinger.3", "Стрелок III", "fd9e3d44ce0f4c8bcff8c3b316c54ed304a10be26073d9242cbbe17f141f5950"],
    ["vagabond.speed-demon.2", "Демон скорости II", "0365cfb5ae901e4cac9e6571651dc2a256170a13afb47a2077b1c785eb368b62"],
    ["vagabond.cunning-fighter.1", "Хитроумный боец I", "4373bc4971b0d11b0adce5ad6d070e9012c97e4acb27f45a34b8d28b89b6b421"],
    ["vagabond.cunning-fighter.2", "Хитроумный боец II", "cad73b94a9ce468c18309a11ba6a7a84fe70d3ff1ed249e230d1b54b8977fcfd"],
    ["vagabond.enchained.1", "Скованный I", "014b9edb50b008efb13865734553ef7cfc44c532e46c8deaef2be5858d8b654b"],
    ["bulwark.mundane.2", "Обычный II", "9f2acd96734496115e4336cfba21ae1002107d282e903cc9e9a76fa209b81410"],
    ["altruist.gourmand.1", "Гурман I", "d7dabbe3ac7be7d0ded9c75f214be072cd634c54e318455cbd28f6e02d401d73"],
    ["altruist.gourmand.2", "Гурман II", "84ec37d54af70332e7bb2f4ed402265d3514db190bc24b400016b9444b4b8ce7"],
    ["disruptor.chemist.1", "Химик I", "7387a31ab85448d843cc0159532db66530bf54c3b975336e1a13fbefcd624a93"],
    ["disruptor.chemist.3", "Химик III", "4125cbbef359eaa384850fa36e8a442b992640ba73695e720264967d3fc0b300"],
    ["disruptor.hunter.1", "Браконьер I", "4631594ad05e136bae6833e79ee4100f05fbc6102e19050c7ef92f2b8e38f28b"],
    ["disruptor.hunter.2", "Браконьер II", "9cf3c781404a8c16afe29156f0a2ebcf706b9975a00531ab53ced5298a0fea86"],
    ["ruiner.creation-ascetic.1", "Творец I", "6f4e55f851dd43392db08bf1fb2bd639f7921d6767a899dcde23c7492b8f41a3"],
    ["ruiner.creation-ascetic.3", "Творец III", "c7dc7bbd517cd65a2d221ae8066489b4aca652a6a2c2c0a3dadf771ea4962c82"],
  ].map(([id, label, sourceDigest]) => Object.freeze({ id, label, sourceDigest, sourceLevelId: id, techniqueId: id.replace(/\.\d+$/, ""), level: Number(id.match(/\.(\d+)$/)[1]), coverage: "full" }));
  const byId = new Map(defs.map(row => [row.id, row]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const knows = (owner, id) => owner?.rulesEdition === "lionwing" && Number((owner.knownTechniques ?? owner.techniques)?.[byId.get(id)?.techniqueId || id.replace(/\.\d+$/, "")] || 0) >= Number(id.match(/\.(\d+)$/)?.[1]);
  const enabled = (owner, id) => knows(owner, id) && owner.lionwing?.automation?.[id] === true;
  const distance = (a, b) => a?.space === b?.space ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : Infinity;
  const key = point => `${point.x},${point.y}`;
  const history = (scene, owner) => (owner.lionwing?.history || []).filter(row => row.ownerTurnInstanceId ? row.ownerTurnInstanceId === scene.lionwing?.activeTurnInstanceId : row.turnSerial === scene.turnSerial);
  const previous = (scene, owner) => history(scene, owner).filter(row => row.actionId).at(-1);
  const board = (scene, owner) => scene.spaces.find(item => item.id === owner.space);
  const inside = (scene, owner, point) => Number.isInteger(point?.x) && Number.isInteger(point?.y) && (!point.space || point.space === owner.space) && point.x >= 0 && point.y >= 0 && point.x < board(scene, owner)?.width && point.y < board(scene, owner)?.height && !(scene.topology?.cuts || []).some(cut => cut.space === owner.space && (cut.cells || []).includes(key(point)));
  const occupied = (scene, owner, point) => scene.actors.some(target => target.id !== owner.id && !target.knockedOut && !target.effects?.includes("positive.исчез") && target.space === owner.space && target.x === point.x && target.y === point.y);
  const cell = (scene, owner, point, empty = false) => {
    if (!inside(scene, owner, point) || empty && (occupied(scene, owner, point) || scene.objects.some(item => item.type === "terrain" && item.space === owner.space && item.cells?.includes(key(point))))) throw new Error("Выберите свободную клетку поля");
    return { x: point.x, y: point.y, space: owner.space };
  };
  const targetsIn = (scene, owner, cells) => scene.actors.filter(target => target.id !== owner.id && target.team !== owner.team && !target.knockedOut && !target.effects?.includes("positive.исчез") && target.space === owner.space && cells.some(point => point.x === target.x && point.y === target.y)).map(target => target.id);
  const zone = (scene, owner, center, radius = 1) => {
    const cells = [];
    for (let x = center.x - radius; x <= center.x + radius; x++) for (let y = center.y - radius; y <= center.y + radius; y++) if (inside(scene, owner, { x, y })) cells.push({ x, y, space: owner.space });
    return cells;
  };
  const ownResource = (owner, id) => Math.max(0, Number(owner.ruleResources?.[id]?.value || 0));
  const dependencies = id => ({ "vagabond.cunning-fighter.2": ["vagabond.cunning-fighter.1"], "disruptor.hunter.2": ["disruptor.hunter.1"], "altruist.gourmand.2": ["altruist.gourmand.1"], "powerhouse.gunslinger.3": ["powerhouse.gunslinger.1"], "ruiner.creation-ascetic.3": ["ruiner.creation-ascetic.1"], "disruptor.chemist.3": ["disruptor.chemist.1"], "vagabond.speed-demon.2": ["vagabond.speed-demon.1"], "bulwark.mundane.2": ["bulwark.mundane.1"] }[id] || []);
  const finisherDiscount = (scene, owner) => enabled(owner, "bulwark.mundane.2") && !owner.lionwing?.mundaneFinisherRound?.includes(scene.round) ? Math.max(0, Number(owner.lionwing?.mundaneDiscount || 0)) : 0;
  const finisherMaterial = (scene, owner) => enabled(owner, "ruiner.creation-ascetic.3") && previous(scene, owner)?.actionId === A.spell ? Number(previous(scene, owner).materialSpent || 0) : ownResource(owner, "material");
  function quote(scene, owner, actionId, request = {}, base = {}) {
    const result = { ...base };
    if (enabled(owner, "disruptor.chemist.1") && actionId === A.improvise) result.cost = 1;
    if (request.useCunningPlan) {
      if (!enabled(owner, "vagabond.cunning-fighter.1") || [A.spell, A.skirmish, A.finish].includes(actionId) || Number(owner.ruleClocks?.["vagabond.cunning-fighter.plan"]?.current || 0) < 1) throw new Error("Хитрый план требует сегмент и не-Атакующее действие");
      if (!enabled(owner, "vagabond.cunning-fighter.2") && owner.lionwing?.cunningSpentTurn === (scene.lionwing?.activeTurnInstanceId || scene.turnSerial)) throw new Error("Хитрый план уже потрачен в этот Ход");
      result.cost = Math.max(0, Number(result.cost || 0) - 1); result.swift = true;
    }
    if (enabled(owner, "disruptor.hunter.1") && actionId === A.skirmish && request.areaCenter && !request.targetIds?.length) result.swift = true;
    if (actionId === A.finish) {
      const discount = finisherDiscount(scene, owner);
      result.cost = Math.max(0, Number(result.cost || 0) - discount);
      result.focusDiscount = Math.max(0, discount - 2);
      if (enabled(owner, "ruiner.creation-ascetic.1")) result.materialCount = finisherMaterial(scene, owner);
    }
    return result;
  }
  function plan(scene, owner, request) {
    const p = clone(request), actionId = p.actionId;
    // Derived facts are recomputed from the current state at preview and commit.
    delete p.restoredPlan;
    const facts = {};
    if (actionId === A.finish && enabled(owner, "bulwark.mundane.2")) facts.focusCost = Math.max(0, Number(p.focusSpent || 0) - Math.max(0, finisherDiscount(scene, owner) - 2));
    if (enabled(owner, "powerhouse.dragonslayer.3") && actionId === A.finish && p.attribute === "body" && previous(scene, owner)?.actionId === A.breathe) facts.titanic = true;
    if (enabled(owner, "vagabond.enchained.1") && actionId === A.spell && p.areaCenter && !p.targetIds?.length && !p.creatorCells && !p.creatorRadius) {
      facts.emptyCell = cell(scene, owner, p.areaCenter, true);
      if (distance(owner, facts.emptyCell) <= 1 || distance(owner, facts.emptyCell) > 5) throw new Error("Крюк требует пустую несмежную клетку в дальности Заклинания");
      facts.swingDistance = distance(owner, facts.emptyCell); facts.emptyAttack = true;
    }
    if (enabled(owner, "disruptor.hunter.1") && [A.skirmish, A.finish].includes(actionId) && p.areaCenter && !p.targetIds?.length && (actionId !== A.finish || p.attribute === "mind")) {
      facts.emptyCell = cell(scene, owner, p.areaCenter, true);
      const range = actionId === A.skirmish ? 1 + (enabled(owner, "disruptor.hunter.2") ? 3 : 0) : 1;
      if (distance(owner, facts.emptyCell) > range) throw new Error("Клетка ловушки вне дальности");
      facts.trap = true; facts.emptyAttack = true;
    }
    if (p.obstacleId) {
      if (!enabled(owner, "disruptor.chemist.1") && !enabled(owner, "ruiner.creation-ascetic.1")) throw new Error("Участник не использует атаку по препятствию");
      const obstacle = scene.objects.find(item => item.id === p.obstacleId && item.type === "terrain" && item.space === owner.space);
      if (!obstacle) throw new Error("Препятствие отсутствует");
      const cells = (obstacle.cells || []).map(value => { const [x, y] = value.split(",").map(Number); return { x, y, space: owner.space }; });
      if (!cells.length || Math.min(...cells.map(point => distance(owner, point))) > (actionId === A.spell ? 5 : 1)) throw new Error("Препятствие вне дальности");
      if (![A.spell, A.skirmish, A.finish].includes(actionId)) throw new Error("Выберите Атаку по препятствию");
      facts.obstacleId = obstacle.id; facts.obstacleCell = cells[0]; facts.emptyAttack = true; p.targetIds = [];
    }
    if (enabled(owner, "powerhouse.gunslinger.1") && actionId === A.skirmish && Number(p.bulletsSpent || 0) > 0) {
      const count = Number(p.bulletsSpent), selections = p.bulletTargets || [];
      if (!Number.isSafeInteger(count) || count > ownResource(owner, "bullets") || selections.length > count) throw new Error("Недостаточно Пуль или слишком много целей");
      for (const id of selections) { const target = scene.actors.find(item => item.id === id); if (!target || target.team === owner.team || target.knockedOut || distance(owner, target) > 4) throw new Error("Цель Пули должна быть врагом в пределах 4 клеток"); }
      if (!selections.length) throw new Error("Выберите цели Пуль перед Стычкой");
      p.targetIds = [...new Set(selections)]; facts.bullets = count; facts.bulletTargets = selections; facts.ignoreRange = true;
    }
    if (enabled(owner, "ruiner.creation-ascetic.1") && [A.spell, A.finish, A.skirmish].includes(actionId)) {
      const actual = ownResource(owner, "material");
      const amount = actionId === A.finish ? finisherMaterial(scene, owner) : actual;
      facts.materialSpent = actual; facts.materialCount = amount;
      if (actionId === A.finish && Number(p.focusSpent || 0) > amount) throw new Error("Недостаточно Материала для дополнительных костей Завершения");
      if (amount > 0 && [A.spell, A.finish].includes(actionId) && !facts.obstacleId) {
        facts.ignoreRange = true;
        if (actionId === A.spell && amount < 3) {
          const lines = p.creatorLines;
          if (!Array.isArray(lines) || lines.length !== 2 || lines.some(line => !Array.isArray(line) || line.length !== 3)) throw new Error("Перекрёстные гвозди требуют две линии по 3 клетки");
          const parsed = lines.map(line => line.map(point => cell(scene, owner, point)));
          for (const line of parsed) { const dx = line[1].x - line[0].x, dy = line[1].y - line[0].y; if (!dx && !dy || Math.abs(dx) > 1 || Math.abs(dy) > 1 || line[2].x - line[1].x !== dx || line[2].y - line[1].y !== dy || distance(owner, line[0]) > 5 || line.some(point => distance(owner, point) > 5)) throw new Error("Каждая линия должна быть прямой в дальности 5"); }
          if (!parsed[0].some(point => parsed[1].some(other => key(point) === key(other)))) throw new Error("Линии должны пересекаться");
          facts.cells = [...new Map(parsed.flat().map(point => [key(point), point])).values()]; facts.form = "nails";
        } else if (actionId === A.spell) {
          const radius = Number(p.creatorRadius); if (!Number.isInteger(radius) || radius < 1 || radius > 5) throw new Error("Выберите расстояние от 1 до 5 для Невозможного молота");
          facts.cells = []; for (let x = 0; x < board(scene, owner).width; x++) for (let y = 0; y < board(scene, owner).height; y++) if (inside(scene, owner, { x, y }) && distance(owner, { x, y, space: owner.space }) === radius) facts.cells.push({ x, y, space: owner.space });
          facts.form = "mallet"; facts.extraDamage = radius;
        } else if (amount < 3) { facts.form = "pile-arm"; facts.advantage = 2; facts.ignoreRange = false; }
        else {
          const cells = p.creatorCells;
          if (!Array.isArray(cells) || !cells.length || cells.length > 6) throw new Error("Живой идол требует от 1 до 6 связанных клеток");
          facts.cells = cells.map(point => cell(scene, owner, point));
          if (new Set(facts.cells.map(key)).size !== cells.length || !facts.cells.some(point => distance(owner, point) === 1)) throw new Error("Форма должна начинаться рядом с Творцом и не повторять клетки");
          const reached = new Set([key(facts.cells[0])]); let changed = true;
          while (changed) { changed = false; for (const point of facts.cells) if (!reached.has(key(point)) && facts.cells.some(other => reached.has(key(other)) && distance(point, other) === 1)) { reached.add(key(point)); changed = true; } }
          if (reached.size !== cells.length) throw new Error("Клетки Живого идола должны быть связаны");
          facts.form = "idol"; facts.advantage = 4;
        }
        if (facts.cells) { p.targetIds = targetsIn(scene, owner, facts.cells); facts.emptyAttack = !p.targetIds.length; }
      }
    }
    p.restoredPlan = facts;
    return p;
  }
  function install(k) {
    const { scene, state: s, emit, effect, removeEffect, damage, gain, spend, choice, move, fail, actor, alive, clock, inventory } = k;
    const receipt = (owner, id, suffix) => `${s.sceneSerial}:${id}:${owner.id}:${suffix}`;
    const used = token => (s.restoredReceipts || []).includes(token);
    const remember = token => { s.restoredReceipts ||= []; if (used(token)) return false; s.restoredReceipts.push(token); if (s.restoredReceipts.length > 2048) fail("Переполнен журнал применений Техник"); return true; };
    const offer = (owner, ruleId, title, options, context) => choice(owner, "restored-technique", title, ["skip", ...options], { ...context, ruleId, sourceDigest: byId.get(ruleId)?.sourceDigest, optionLabels: { skip: "Не использовать", ...(context.optionLabels || {}) } });
    const mark = (owner, ruleId, detail = {}) => emit("technique.resolve", owner.id, { ruleId, sourceDigest: byId.get(ruleId)?.sourceDigest, ...detail });
    const stateFor = owner => owner.lionwing ||= {};
    function ensure(owner) {
      for (const [id, ruleId, label, initial, replacesAp] of [["bullets", "powerhouse.gunslinger.1", "Пули", () => 6, false], ["material", "ruiner.creation-ascetic.1", "Материал", () => 0, false], ["tenacity", "bulwark.mundane.1", "Упорство", () => 2 + Math.ceil(owner.attrs.body / 2), true]]) {
        if (!enabled(owner, ruleId) || owner.ruleResources?.[id]) continue;
        const value = initial();
        k.configure({ id, label, value, current: value, replaces: "focus", replacesAp, ruleId }, owner.id);
      }
      if (enabled(owner, "vagabond.cunning-fighter.1") && !owner.ruleClocks?.["vagabond.cunning-fighter.plan"]) clock({ id: "vagabond.cunning-fighter.plan", operation: "create", size: 4, current: 0, initial: 0, scope: "scene", lifetime: "scene", label: "Хитрый план" }, owner.id);
      if (enabled(owner, "altruist.gourmand.1") && !owner.lionwing?.inventory?.definitions?.["altruist.gourmand.meals"]) inventory({ operation: "create", id: "altruist.gourmand.meals", kind: "stack", ruleId: "altruist.gourmand.1", sourceDigest: byId.get("altruist.gourmand.1").sourceDigest, label: "Порции", current: Math.ceil(owner.attrs.mind / 2), initial: Math.ceil(owner.attrs.mind / 2), maximum: Math.ceil(owner.attrs.mind / 2), resetAt: "intermission", lifetime: "scene", visibility: "owner" }, owner.id);
    }
    function afterEvent(row) {
      const p = row.payload || {}, owner = actor(row.actorId);
      if (row.type === "action.resolve" && owner && p.actionId === A.study && enabled(owner, "vagabond.cunning-fighter.1")) {
        ensure(owner);
        for (const targetId of p.targetIds || []) if (remember(receipt(owner, "cunning-study", `${s.activeTurnInstanceId || scene.turnSerial}:${targetId}`))) {
          const value = owner.ruleClocks["vagabond.cunning-fighter.plan"].current;
          if (value < 4) clock({ id: "vagabond.cunning-fighter.plan", operation: "add", delta: 1 }, owner.id);
        }
      }
      if (row.type === "attack.pending") for (const id of p.targetIds || []) {
        const target = actor(id); if (target && enabled(target, "bulwark.mundane.2") && remember(receipt(target, "mundane-target", p.actionInstanceId || row.id))) gain(target, "tenacity", 1, { ruleId: "bulwark.mundane.2" });
      }
      if (row.type === "resource.spend" && owner && p.resource === "bullets" && enabled(owner, "powerhouse.gunslinger.1") && !p.bigIronHandled && p.amount > 0) {
        const enemies = scene.actors.filter(target => alive(target) && target.team !== owner.team && distance(owner, target) <= 4);
        if (enemies.length) offer(owner, "powerhouse.gunslinger.1", "Большой ствол: выберите врага для каждой потраченной Пули", enemies.map(target => target.id), { count: p.amount, remaining: p.amount, optionLabels: Object.fromEntries(enemies.map(target => [target.id, target.name])) });
      }
      if (["effect.remove", "effect.source.remove"].includes(row.type)) {
        for (const target of scene.actors) for (const meal of target.lionwing?.meals || []) if (!meal.finished && meal.effect === p.effect && target.id === (p.targetId || row.actorId) && (p.sourceId ? p.sourceId === meal.sourceId : !(target.effectStates?.[meal.effect]?.sources || []).some(source => source.sourceId === meal.sourceId))) {
          meal.finished = true; k.heal(target, 4 + meal.mind, meal.ownerId); mark(actor(meal.ownerId) || target, "altruist.gourmand.1", { targetId: target.id, finished: true });
        }
      }
      if (["turn.start", "scene.reset", "round.end"].includes(row.type)) {
        if (row.type === "turn.start") scene.areas = (scene.areas || []).filter(area => area.ruleId !== "disruptor.chemist.1" || area.ownerActorId !== row.actorId || Number(area.createdOwnerTurn || 0) >= Number(owner?.lionwing?.ownTurnSerial || owner?.lionwing?.turnSerial || 0));
        if (row.type === "round.end") { s.restoredReceipts = (s.restoredReceipts || []).filter(token => !token.includes(":flash-strike:") && !token.includes(":cunning-study:") && !token.includes(":mundane-target:") && !token.includes(":dragonslayer-first:") && !token.includes(":gas-evasion:")); for (const target of scene.actors) { stateFor(target).mundaneDiscount = 0; stateFor(target).mundaneFinisherRound = []; } }
        if (row.type === "scene.reset") { scene.areas = (scene.areas || []).filter(area => area.ruleId !== "disruptor.chemist.1"); s.restoredReceipts = []; s.restoredOperations = {}; for (const target of scene.actors) { delete stateFor(target).cunningSpentTurn; stateFor(target).mundaneDiscount = 0; target.lionwing.mundaneFinisherRound = []; if (target.ruleClocks?.["vagabond.cunning-fighter.plan"]) clock({ id: "vagabond.cunning-fighter.plan", operation: "reset" }, target.id); } }
      }
    }
    function beforeGain(owner, resource, amount) {
      if (resource !== "focus" || !enabled(owner, "bulwark.mundane.2")) return false;
      if (!(owner.lionwing?.mundaneFinisherRound || []).includes(scene.round)) { stateFor(owner).mundaneDiscount = Number(owner.lionwing.mundaneDiscount || 0) + amount; mark(owner, "bulwark.mundane.2", { discount: amount, total: owner.lionwing.mundaneDiscount }); }
      return true;
    }
    function actionCosts(p) {
      const f = p.restoredPlan || {}, costs = [];
      if (p.useCunningPlan) costs.push({ kind: "clock", id: "vagabond.cunning-fighter.plan", amount: 1, ruleId: "vagabond.cunning-fighter.1" });
      if (f.materialSpent) costs.push({ kind: "resource", resource: "material", amount: f.materialSpent, ruleId: "ruiner.creation-ascetic.1" });
      if (f.bullets) costs.push({ kind: "resource", resource: "bullets", amount: f.bullets, ruleId: "powerhouse.gunslinger.1", bigIronHandled: true });
      return costs;
    }
    function beforeAction(owner, p, context = {}) {
      ensure(owner);
      const f = p.restoredPlan || {};
      if (p.useCunningPlan) { if (!context.pricePaid) clock({ id: "vagabond.cunning-fighter.plan", operation: "add", delta: -1 }, owner.id); stateFor(owner).cunningSpentTurn = s.activeTurnInstanceId || scene.turnSerial; mark(owner, "vagabond.cunning-fighter.1", { actionId: p.actionId }); }
      if (enabled(owner, "bulwark.mundane.2") && p.actionId === A.finish) {
        const discount = Number(owner.lionwing?.mundaneDiscount || 0), base = k.actionDef(A.finish).cost.amount;
        stateFor(owner).mundaneFinisherRound ||= []; owner.lionwing.mundaneFinisherRound.push(scene.round); owner.lionwing.mundaneDiscount = 0;
      }
      if (f.materialSpent && !context.pricePaid) spend(owner, "material", f.materialSpent, { ruleId: "ruiner.creation-ascetic.1" });
      if (f.bullets) { if (!context.pricePaid) spend(owner, "bullets", f.bullets, { ruleId: "powerhouse.gunslinger.1", bigIronHandled: true }); for (const id of f.bulletTargets) if (alive(actor(id))) damage({ targetId: id, sourceActorId: owner.id, amount: enabled(owner, "powerhouse.gunslinger.3") && actor(id).effects?.includes("negative.подброшен") ? 2 : 1, attack: false, sourceActionId: "powerhouse.gunslinger.1" }); }
    }
    function terrain(owner, f) {
      const cells = f.cells.map(key), selected = new Set(cells);
      for (const object of scene.objects) if (object.space === owner.space && ["high", "low"].includes(object.type)) object.cells = object.cells.filter(value => !selected.has(value));
      scene.objects = scene.objects.filter(object => !["high", "low"].includes(object.type) || object.cells.length);
      scene.objects.push({ id: `${k.rootId}:creator-terrain`, type: f.form === "idol" ? "high" : "low", space: owner.space, cells, duration: "scene", ownerActorId: owner.id, label: f.form === "idol" ? "Высокая местность Творца" : "Низкая местность Творца" });
      mark(owner, "ruiner.creation-ascetic.1", { form: f.form, cells: f.cells });
    }
    function afterAction(owner, p, result) {
      const f = p.restoredPlan || {};
      const row = (owner.lionwing?.history || []).at(-1); if (row && f.materialCount != null) row.materialSpent = f.materialCount;
      if (f.emptyAttack && ["mallet", "idol"].includes(f.form)) terrain(owner, f);
      if (f.emptyCell && !f.trap) offer(owner, "vagabond.enchained.1", "Раскачаться: выберите свободную клетку на том же расстоянии от якоря", ["swing"], { anchor: f.emptyCell, distance: f.swingDistance, optionLabels: { swing: "Выбрать клетку телепортации" } });
      if (f.trap) offer(owner, "disruptor.hunter.1", "Стальные челюсти: поставить ловушку?", ["trap"], { cell: f.emptyCell, optionLabels: { trap: "Поставить малую ловушку" } });
      if (f.obstacleId) {
        const obstacle = scene.objects.find(item => item.id === f.obstacleId);
        if (obstacle) { obstacle.hp = Math.max(0, Number(obstacle.hp ?? 10) - Number(result?.successes || 0)); if (enabled(owner, "ruiner.creation-ascetic.2") && result?.successes > 0) gain(owner, "material", 1, { ruleId: "ruiner.creation-ascetic.2" }); }
        if (enabled(owner, "disruptor.chemist.1") && obstacle) offer(owner, "disruptor.chemist.1", "Сублимация: уничтожить препятствие и создать Газ?", ["gas"], { obstacleId: f.obstacleId, cell: f.obstacleCell, optionLabels: { gas: "Уничтожить и создать Газ" } });
        else if (obstacle?.hp === 0) { scene.objects = scene.objects.filter(item => item.id !== obstacle.id); emit("object.destroy", owner.id, { objectId: obstacle.id }); }
      }
      if (scene.pendingAction?.actorId === owner.id && scene.pendingAction.actionInstanceId === p.actionInstanceId) {
        scene.pendingAction.restoredPlan = clone(f);
        if (f.titanic) { scene.pendingAction.damage = result.rolls.length + scene.tension; for (const id of scene.pendingAction.targetIds) scene.pendingAction.targetDamage[id] = result.rolls.length + Number(p.targetRolls?.[id]?.rolls?.length || 0) + scene.tension; }
        if (f.extraDamage) { scene.pendingAction.damage += f.extraDamage; for (const id of scene.pendingAction.targetIds) scene.pendingAction.targetDamage[id] += f.extraDamage; }
        scene.pendingAction.restoredAttribute = p.attribute || "spirit";
      }
    }
    function beforeDamage(p) {
      const owner = actor(p.sourceActorId), target = actor(p.targetId);
      // Ordered pre-damage effects are queued by resolve(), through the same
      // replacement/interrupt foundation as every other Effect.
    }
    function resolve(pending, operations) {
      const owner = actor(pending.actorId), f = pending.restoredPlan || {};
      if (!owner) return;
      // The shared ledger also records manual Attacks and bridged Armaments.
      // Actor-local action history alone misses those paths.
      const earlierAttack = (s.history || []).some(row => row.ownerActorId === owner.id && row.sceneSerial === s.sceneSerial && (row.ownerTurnInstanceId ? row.ownerTurnInstanceId === s.activeTurnInstanceId : row.turnSerial === scene.turnSerial) && (row.type === "attack" || row.type === "apply" && [A.spell, A.skirmish, A.finish].includes(row.actionId)) && row.actionInstanceId !== pending.actionInstanceId);
      const enqueue = payload => { const token = `${k.rootId}:restored:${operations.length}`; s.restoredOperations ||= {}; s.restoredOperations[token] = clone(payload); operations.push({ ...payload, authorization: token }); };
      if (enabled(owner, "powerhouse.dragonslayer.1") && scene.activeActorId === owner.id && pending.sourceActionId === A.finish && pending.restoredAttribute === "body" && !earlierAttack && remember(receipt(owner, "dragonslayer-first", pending.actionInstanceId))) {
        operations.unshift({ kind: "resource", resource: "focus", operation: "gain", amount: 2, targetId: owner.id, sourceActorId: owner.id, ruleId: "powerhouse.dragonslayer.1" });
        for (let index = operations.length - 1; index >= 0; index--) if (operations[index].kind === "damage" && operations[index].attack) operations.splice(index, 0, { kind: "effect", targetId: operations[index].targetId, sourceActorId: owner.id, effect: "negative.разорван", ruleId: "powerhouse.dragonslayer.1" });
      }
      if (f.titanic) {
        for (const id of pending.targetIds) if (!pending.responses[id]?.preventForcedMovement) enqueue({ kind: "restored-technique", operation: "titanic-push", targetId: id, sourceActorId: owner.id });
        operations.push({ kind: "effect", targetId: owner.id, sourceActorId: owner.id, effect: "negative.ослаблен", ruleId: "powerhouse.dragonslayer.3" });
      }
      if (f.form === "pile-arm") for (const id of pending.targetIds) if (!pending.responses[id]?.preventForcedMovement) enqueue({ kind: "restored-technique", operation: "pile-arm", targetId: id, sourceActorId: owner.id });
      if (["mallet", "idol"].includes(f.form)) enqueue({ kind: "restored-technique", operation: "creator-terrain", form: f.form, cells: f.cells, sourceActorId: owner.id });
      if (enabled(owner, "powerhouse.gunslinger.3") && pending.criticals >= 2) enqueue({ kind: "restored-technique", operation: "bullet-launch", sourceActorId: owner.id, targetIds: pending.targetIds });
    }
    function gas(owner, center) {
      const cells = zone(scene, owner, center), id = `${k.rootId}:gas:${scene.areas.length}`;
      scene.areas.push({ id, ruleId: "disruptor.chemist.1", ownerActorId: owner.id, space: center.space || owner.space, cells: cells.map(key), label: "Газ", kind: "zone", createdOwnerTurn: Number(owner.lionwing?.ownTurnSerial || owner.lionwing?.turnSerial || 0), sourceDigest: byId.get("disruptor.chemist.1").sourceDigest });
      mark(owner, "disruptor.chemist.1", { areaId: id, cells });
      if (enabled(owner, "disruptor.chemist.3")) for (const targetId of targetsIn(scene, owner, cells)) damage({ targetId, sourceActorId: owner.id, amount: owner.attrs.mind, attack: false, sourceActionId: "disruptor.chemist.3" });
    }
    function beforeAttack(owner, pending) {
      // An adjudicated Attack also pays Creator's mandatory resource. Base
      // Actions already settled this charge through actionCosts(), leaving
      // no Material to charge again; fixed Jabs use that same path.
      if (enabled(owner, "ruiner.creation-ascetic.1") && ownResource(owner, "material") > 0) spend(owner, "material", ownResource(owner, "material"), { ruleId: "ruiner.creation-ascetic.1", actionInstanceId: pending.actionInstanceId });
      for (const targetId of pending.targetIds) { const target = actor(targetId); if (!target) continue;
        if ((scene.areas || []).some(area => area.ruleId === "disruptor.chemist.1" && area.space === target.space && area.cells.includes(key(target)) && actor(area.ownerActorId)?.team === target.team && (owner.space !== area.space || !area.cells.includes(key(owner)))) && remember(receipt(target, "gas-evasion", pending.actionInstanceId || pending.id))) { target.evasion = Number(target.evasion || 0) + 3; emit("stat.gain", target.id, { stat: "evasion", amount: 3, ruleId: "disruptor.chemist.1", attackId: pending.id }); }
      }
    }
    function limitMove(owner, result, p) {
      if (p.placement || p.teleport) return result;
      const index = result.path.findIndex(point => (scene.markers || []).some(marker => marker.ruleId === "disruptor.hunter.1" && marker.space === owner.space && marker.x === point.x && marker.y === point.y && actor(marker.ownerActorId)?.team !== owner.team && alive(actor(marker.ownerActorId))));
      return index < 0 ? result : { ...result, path: result.path.slice(0, index + 1), cost: index + 1, trapStopped: true };
    }
    function afterMove(owner, p, result, from) {
      const points = [from, ...result.path.map(point => ({ ...point, space: owner.space }))];
      if (!p.forced && !p.placement && !p.teleport && enabled(owner, "vagabond.speed-demon.2") && owner.lionwing?.automation?.["vagabond.speed-demon.1"] === true) for (const target of scene.actors.filter(target => target.id !== owner.id && alive(target))) {
        const exited = points.some((point, index) => index < points.length - 1 && point.space === target.space && key(point) === key(target) && key(points[index + 1]) !== key(target));
        const token = receipt(owner, "flash-strike", `${scene.round}:${target.id}`);
        if (exited && !used(token)) offer(owner, "vagabond.speed-demon.2", `Молниеносный удар: ${target.name}`, ["flash"], { targetId: target.id, token, optionLabels: { flash: `Нанести ${Math.ceil(owner.attrs.talent / 2)} урона` } });
      }
      if (!p.placement && enabled(owner, "altruist.gourmand.2")) { ensure(owner); for (const target of scene.actors.filter(target => target.id !== owner.id && alive(target) && target.team === owner.team)) if (points.some((point, index) => index < points.length - 1 && distance(point, target) === 1 && distance(points[index + 1], target) > 1)) mealOffer(owner, target, "altruist.gourmand.2"); }
      for (const area of scene.areas || []) if (area.ruleId === "disruptor.chemist.1" && area.space === owner.space && points.some((point, index) => index > 0 && area.cells.includes(key(point)) && (points[index - 1].space !== area.space || !area.cells.includes(key(points[index - 1]))))) { const source = actor(area.ownerActorId); if (source && source.team !== owner.team) effect(owner, { effect: "negative.ослаблен", ruleId: "disruptor.chemist.1" }, source.id); }
      if (result.trapStopped) { owner.stepRemaining = 0; for (const trap of scene.markers || []) if (trap.ruleId === "disruptor.hunter.1" && trap.space === owner.space && trap.x === owner.x && trap.y === owner.y && actor(trap.ownerActorId)?.team !== owner.team) { const source = actor(trap.ownerActorId); effect(owner, { effect: "negative.замедлен", ruleId: "disruptor.hunter.1" }, source.id); offer(source, "disruptor.hunter.1", `Стальные челюсти: Стычка с ${owner.name}`, ["trap-attack"], { targetId: owner.id, trapId: trap.id, optionLabels: { "trap-attack": "Бесплатная Быстрая Стычка" } }); } }
    }
    function mealOffer(owner, target, ruleId) {
      if (k.stackCount(owner, "altruist.gourmand.meals") > 0) offer(owner, ruleId, `Передать порцию: ${target.name}`, ["reinforce", "hasten"], { targetId: target.id, optionLabels: { reinforce: "Укрепить и передать порцию", hasten: "Ускорить и передать порцию" } });
    }
    function answer(owner, pending, request) {
      const c = pending.context || {}, action = request.choice;
      if (action === "skip") return;
      if (!enabled(owner, c.ruleId) || c.sourceDigest !== byId.get(c.ruleId)?.sourceDigest) fail("Техника выключена или источник решения изменился");
      if (action === "swing") {
        const point = cell(scene, owner, request.destination, true);
        if (distance(c.anchor, point) !== c.distance) fail("Раскачивание сохраняет расстояние до якоря");
        move(owner, { destination: point, teleport: true, maximum: 999, sourceActionId: c.ruleId });
      } else if (action === "trap") { cell(scene, owner, c.cell, true); scene.markers.push({ id: `${k.rootId}:trap`, ruleId: "disruptor.hunter.1", ownerActorId: owner.id, ...c.cell, label: "Малая ловушка", type: "trap" }); mark(owner, c.ruleId, { cell: c.cell }); }
      else if (action === "gas") { const obstacle = scene.objects.find(item => item.id === c.obstacleId); if (!obstacle) fail("Препятствие уже уничтожено"); scene.objects = scene.objects.filter(item => item.id !== c.obstacleId); emit("object.destroy", owner.id, { objectId: c.obstacleId, ruleId: c.ruleId }); gas(owner, c.cell); }
      else if (action === "flash") { const target = actor(c.targetId); if (!alive(target) || !remember(c.token)) fail("Молниеносный удар уже использован по цели или цель недоступна"); damage({ targetId: target.id, sourceActorId: owner.id, amount: Math.ceil(owner.attrs.talent / 2), attack: false, sourceActionId: c.ruleId }); mark(owner, c.ruleId, { targetId: target.id }); }
      else if (["reinforce", "hasten"].includes(action)) {
        const target = actor(c.targetId); if (!alive(target) || target.team !== owner.team || k.stackCount(owner, "altruist.gourmand.meals") < 1) fail("Нет порции или доступного союзника");
        inventory({ id: "altruist.gourmand.meals", operation: "spend", amount: 1 }, owner.id);
        const effectId = action === "reinforce" ? "positive.укреплен" : "positive.ускорен";
        const sourceId = `${k.rootId}:meal:${target.id}`;
        effect(target, { effect: effectId, sourceId, ruleId: "altruist.gourmand.1" }, owner.id);
        stateFor(target).meals = (stateFor(target).meals || []).filter(meal => !meal.finished); target.lionwing.meals.push({ sourceId, ownerId: owner.id, mind: owner.attrs.mind, effect: effectId, finished: false }); mark(owner, c.ruleId, { targetId: target.id, effect: effectId });
      } else if (c.ruleId === "powerhouse.gunslinger.1") {
        const target = actor(action); if (!alive(target) || target.team === owner.team || distance(owner, target) > 4) fail("Цель Пули больше недоступна");
        damage({ targetId: target.id, sourceActorId: owner.id, amount: enabled(owner, "powerhouse.gunslinger.3") && target.effects?.includes("negative.подброшен") ? 2 : 1, attack: false, sourceActionId: c.ruleId });
        if (c.remaining > 1) { const enemies = scene.actors.filter(target => alive(target) && target.team !== owner.team && distance(owner, target) <= 4); if (enemies.length) offer(owner, c.ruleId, "Выберите цель следующей Пули", enemies.map(target => target.id), { ...c, remaining: c.remaining - 1, optionLabels: Object.fromEntries(enemies.map(target => [target.id, target.name])) }); }
      } else if (action === "trap-attack") {
        const trap = scene.markers.find(item => item.id === c.trapId), target = actor(c.targetId);
        if (!trap || trap.ownerActorId !== owner.id || !alive(target) || target.space !== trap.space || key(target) !== key(trap)) fail("Ловушка или её цель больше недоступна");
        scene.markers = scene.markers.filter(item => item.id !== trap.id);
        k.trapAttack(owner, target, request.roll);
      } else if (c.ruleId === "powerhouse.gunslinger.3") { if (!c.targetIds.includes(action) || !alive(actor(action))) fail("Выберите доступную цель этой Атаки"); effect(actor(action), { effect: "negative.подброшен", ruleId: c.ruleId }, owner.id); }
      else fail("Неизвестное решение Техники");
    }
    function operation(owner, p) {
      if (p.operation !== "meal") {
        const saved = s.restoredOperations?.[p.authorization];
        if (!saved || saved.sourceActorId !== owner.id || Object.entries(saved).some(([key, value]) => JSON.stringify(p[key]) !== JSON.stringify(value))) fail("Продолжение Техники не подтверждено разрешённой Атакой");
        delete s.restoredOperations[p.authorization];
      }
      if (p.operation === "bullet-launch") { const targets = p.targetIds.map(actor).filter(alive); if (targets.length) offer(owner, "powerhouse.gunslinger.3", "Жонглирование пулями: Подбросить одну цель", targets.map(target => target.id), { targetIds: targets.map(target => target.id), optionLabels: Object.fromEntries(targets.map(target => [target.id, target.name])) }); }
      else if (p.operation === "titanic-push") { const target = actor(p.targetId); if (alive(target)) k.push(owner, target, 2); }
      else if (p.operation === "pile-arm") { const target = actor(p.targetId); if (!alive(target)) return; const moved = k.push(owner, target, 999); if (moved > 0) damage({ targetId: target.id, sourceActorId: owner.id, amount: moved, attack: false, sourceActionId: "ruiner.creation-ascetic.1" }); }
      else if (p.operation === "creator-terrain") terrain(owner, p);
      else if (p.operation === "meal") { const target = actor(p.targetId); if (!enabled(owner, "altruist.gourmand.1") || scene.activeActorId !== owner.id || !alive(target) || target.team !== owner.team || distance(owner, target) !== 1 || k.stackCount(owner, "altruist.gourmand.meals") < 1) fail("Порция требует соседнего союзника и запас в свой Ход"); k.interact(owner, p); mealOffer(owner, target, "altruist.gourmand.1"); }
      else fail("Неизвестная операция Техники");
    }
    return { ensure, afterEvent, beforeGain, actionCosts, beforeAction, afterAction, beforeDamage, resolve, gas, beforeAttack, limitMove, afterMove, answer, operation };
  }
  global.DAWN_LIONWING_RESTORED_TECHNIQUES = Object.freeze({ defs, enabled, dependencies, quote, plan, install, rows: owner => defs.filter(row => knows(owner, row.id)).map(row => ({ ...row, enabled: enabled(owner, row.id) })) });
})(window);
