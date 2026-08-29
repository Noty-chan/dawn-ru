"use strict";

const ENEMY_MODIFIER_IDS = Object.freeze({
  artillery: "enemy.modifier.artillery",
  collateral: "enemy.modifier.collateral",
  contagion: "enemy.modifier.contagion",
  earthquake: "enemy.modifier.earthquake",
  gargantuan: "enemy.modifier.gargantuan",
  giant: "enemy.modifier.giant",
  haven: "enemy.modifier.haven",
  isolation: "enemy.modifier.isolation",
  legion: "enemy.modifier.legion",
  vip: "enemy.modifier.vip",
  vortex: "enemy.modifier.vortex",
});
const ATTACHED_MODIFIER_IDS = new Set([
  ENEMY_MODIFIER_IDS.contagion,
  ENEMY_MODIFIER_IDS.earthquake,
  ENEMY_MODIFIER_IDS.gargantuan,
  ENEMY_MODIFIER_IDS.giant,
  ENEMY_MODIFIER_IDS.haven,
  ENEMY_MODIFIER_IDS.isolation,
  ENEMY_MODIFIER_IDS.vortex,
]);
const AREA_MODIFIER_IDS = new Set([
  ENEMY_MODIFIER_IDS.artillery,
  ENEMY_MODIFIER_IDS.haven,
]);
const PLAYER_ANCHOR_MODIFIER_IDS = new Set([
  ENEMY_MODIFIER_IDS.contagion,
  ENEMY_MODIFIER_IDS.isolation,
  ENEMY_MODIFIER_IDS.vortex,
]);
const isEnemyModifier = (actor) =>
  Boolean(actor && Object.values(ENEMY_MODIFIER_IDS).includes(actor.profileId));
const isAttachedModifier = (actor) =>
  Boolean(actor && ATTACHED_MODIFIER_IDS.has(actor.profileId));
const modifierTierValue = (formula, tier = 1) =>
  enemyTierFormula(formula, tier);
const modifierState = (actor) =>
  actor?.modifierState && typeof actor.modifierState === "object"
    ? actor.modifierState
    : {};
const modifierCarrier = (scene, actor) =>
  actorById(scene, modifierState(actor).carrierId);
const livePlayers = (scene) =>
  (scene.actors || []).filter(
    (item) => item.team === "hero" && !item.knockedOut && item.kind !== "crowd",
  );
const liveOpponents = (scene, actor) =>
  (scene.actors || []).filter(
    (item) =>
      item.team !== actor.team && !item.knockedOut && item.kind !== "crowd",
  );
const canonicalCells = (scene, spaceId, cells) => {
  const space = (scene.spaces || []).find((item) => item.id === spaceId),
    removed = removedCellKeys(scene, spaceId);
  if (!space) return [];
  return [
    ...new Set(
      (cells || []).map(String).filter((cell) => {
        const match = cell.match(/^(\d+),(\d+)$/);
        return (
          match &&
          Number(match[1]) < space.width &&
          Number(match[2]) < space.height &&
          !removed.has(cell)
        );
      }),
    ),
  ].slice(0, 64);
};
const rectangularCells = (cells, width, height) => {
  if (cells.length !== width * height) return false;
  const points = cells.map((cell) => cell.split(",").map(Number)),
    xs = [...new Set(points.map((p) => p[0]))].sort((a, b) => a - b),
    ys = [...new Set(points.map((p) => p[1]))].sort((a, b) => a - b);
  return (
    xs.length === width &&
    ys.length === height &&
    xs.at(-1) - xs[0] === width - 1 &&
    ys.at(-1) - ys[0] === height - 1
  );
};
const artilleryCellsValid = (scene, actor, cells, mode) => {
  const space = (scene.spaces || []).find((item) => item.id === actor.space);
  if (!space) return false;
  if (mode === "square3") return rectangularCells(cells, 3, 3);
  if (mode === "rect2x5")
    return rectangularCells(cells, 2, 5) || rectangularCells(cells, 5, 2);
  if (mode === "edges") {
    const expected = [];
    for (let y = 0; y < space.height; y++)
      for (let x = 0; x < space.width; x++)
        if (
          x === 0 ||
          y === 0 ||
          x === space.width - 1 ||
          y === space.height - 1
        )
          expected.push(`${x},${y}`);
    return (
      expected.length === cells.length &&
      expected.every((cell) => cells.includes(cell))
    );
  }
  if (mode === "lines") {
    const points = cells.map((cell) => cell.split(",").map(Number)),
      rows = new Set(points.map((p) => p[1])),
      cols = new Set(points.map((p) => p[0]));
    if (rows.size === 2 && cells.length === space.width * 2) {
      const [a, b] = [...rows];
      return (
        Math.abs(a - b) > 1 && points.every(([x]) => x >= 0 && x < space.width)
      );
    }
    if (cols.size === 2 && cells.length === space.height * 2) {
      const [a, b] = [...cols];
      return (
        Math.abs(a - b) > 1 &&
        points.every(([, y]) => y >= 0 && y < space.height)
      );
    }
    return false;
  }
  return false;
};
function modifierTwoSquareCover(cells = []) {
  const set = new Set(cells),
    squares = [];
  for (const cell of set) {
    const [x, y] = cell.split(",").map(Number),
      square = [
        `${x},${y}`,
        `${x + 1},${y}`,
        `${x},${y + 1}`,
        `${x + 1},${y + 1}`,
      ];
    if (square.every((key) => set.has(key))) squares.push(new Set(square));
  }
  return (
    squares.some((left) => [...set].every((cell) => left.has(cell))) ||
    squares.some((left, index) =>
      squares
        .slice(index + 1)
        .some(
          (right) =>
            [...set].every((cell) => left.has(cell) || right.has(cell)) &&
            [...left, ...right].every((cell) => set.has(cell)),
        ),
    )
  );
}
function modifierConfigurationStatus(scene, actorId, request = {}) {
  const actor = actorById(scene, actorId),
    errors = [];
  if (!isEnemyModifier(actor) || actor.knockedOut)
    errors.push("Модификатор недоступен.");
  const carrier = request.carrierId
    ? actorById(scene, request.carrierId)
    : modifierCarrier(scene, actor);
  if (
    isAttachedModifier(actor) &&
    (!carrier ||
      carrier.id === actor.id ||
      carrier.team !== actor.team ||
      carrier.knockedOut ||
      carrier.kind === "crowd" ||
      carrier.profileId?.startsWith("enemy.modifier."))
  )
    errors.push("Выберите живого обычного врага-носителя на той же стороне.");
  const targetId = request.targetId ?? modifierState(actor).targetId,
    target = actorById(scene, targetId);
  if (
    PLAYER_ANCHOR_MODIFIER_IDS.has(actor?.profileId) &&
    (!target ||
      target.team === actor.team ||
      target.knockedOut ||
      target.kind === "crowd")
  )
    errors.push("Выберите живого персонажа игрока.");
  const cells = canonicalCells(
    scene,
    carrier?.space || actor?.space,
    request.cells ?? modifierState(actor).cells,
  );
  if (AREA_MODIFIER_IDS.has(actor?.profileId) && !cells.length)
    errors.push("Выберите клетки области на поле.");
  const allowedModes =
    actor?.profileId === ENEMY_MODIFIER_IDS.earthquake
      ? ["inward", "outward"]
      : actor?.profileId === ENEMY_MODIFIER_IDS.artillery
        ? ["lines", "square3", "rect2x5", "edges"]
        : actor?.profileId === ENEMY_MODIFIER_IDS.gargantuan
          ? ["left", "right", "top", "bottom"]
          : [];
  const mode = request.mode ?? modifierState(actor).mode;
  if (allowedModes.length && !allowedModes.includes(mode))
    errors.push("Выберите канонический режим модификатора.");
  if (
    actor?.profileId === ENEMY_MODIFIER_IDS.haven &&
    cells.length &&
    !rectangularCells(cells, 3, 3)
  )
    errors.push("Область Убежища должна быть ровно 3×3.");
  if (
    actor?.profileId === ENEMY_MODIFIER_IDS.artillery &&
    cells.length &&
    mode &&
    !artilleryCellsValid(scene, actor, cells, mode)
  )
    errors.push(
      "Клетки не соответствуют выбранной канонической форме Артиллерии.",
    );
  if (actor?.profileId === ENEMY_MODIFIER_IDS.collateral) {
    const required = Math.ceil(livePlayers(scene).length * 1.5),
      occupied = new Set(
        (scene.actors || [])
          .filter(
            (item) =>
              item.id !== actor.id &&
              !item.knockedOut &&
              item.space === actor.space,
          )
          .map(cellKey),
      );
    if (required < 1) errors.push("Сначала добавьте на поле хотя бы одного персонажа игрока.");
    if (cells.length !== required)
      errors.push(
        `Для Случайных жертв выберите ровно ${required} пустых клеток.`,
      );
    if (cells.some((cell) => occupied.has(cell)))
      errors.push("Одна из клеток Случайных жертв занята.");
  }
  return {
    available: !errors.length,
    reason: errors.join(" "),
    actor,
    carrier,
    target,
    cells,
    mode,
  };
}
function prepareModifierConfigure(scene, request = {}) {
  const status = modifierConfigurationStatus(scene, request.actorId, request);
  if (!status.available)
    return { ok: false, errors: [status.reason], events: [] };
  const collateral = status.actor.profileId === ENEMY_MODIFIER_IDS.collateral,
    legion = status.actor.profileId === ENEMY_MODIFIER_IDS.legion,
    gargantuan = status.actor.profileId === ENEMY_MODIFIER_IDS.gargantuan,
    state = {
      carrierId: isAttachedModifier(status.actor) ? status.carrier.id : null,
      targetId: PLAYER_ANCHOR_MODIFIER_IDS.has(status.actor.profileId)
        ? status.target.id
        : null,
      cells:
        AREA_MODIFIER_IDS.has(status.actor.profileId) || collateral
          ? status.cells
          : [],
      mode: status.mode || null,
      configuredRound: Number(scene.round || 1),
      ...(collateral
        ? {
            groupId: `collateral-${status.actor.id}`,
            clockId: `collateral-clock-${status.actor.id}`,
            deployed: true,
          }
        : legion
          ? { deployed: true, legionHp: livePlayers(scene).length * 10 }
          : gargantuan
            ? { expanded: true }
            : {}),
    };
  return {
    ok: true,
    errors: [],
    events: [
      {
        type: "modifier.configure",
        actorId: status.actor.id,
        payload: {
          profileId: status.actor.profileId,
          state,
          participantIds: [
            status.actor.id,
            state.carrierId,
            state.targetId,
          ].filter(Boolean),
        },
      },
    ],
  };
}
function modifierDamageEvents(scene, actor, boundaryEvent) {
  const state = modifierState(actor),
    carrier = modifierCarrier(scene, actor),
    tension = Number(
      boundaryEvent?.payload?.endedTension ?? scene.tension ?? 0,
    ),
    boundaryEventId = boundaryEvent?.id,
    opponents = liveOpponents(scene, actor),
    events = [],
    sourceActionId = `${actor.profileId}.round-end`;
  let targets = [];
  if (actor.profileId === ENEMY_MODIFIER_IDS.artillery)
    targets = opponents.filter(
      (target) =>
        target.space === actor.space && state.cells?.includes(cellKey(target)),
    );
  if (actor.profileId === ENEMY_MODIFIER_IDS.contagion) {
    const anchor = actorById(scene, state.targetId);
    if (anchor && !anchor.knockedOut)
      targets = opponents.filter(
        (target) => target.id !== anchor.id && distance(anchor, target) <= 3,
      );
  }
  if (actor.profileId === ENEMY_MODIFIER_IDS.earthquake && carrier)
    targets = opponents.filter(
      (target) =>
        target.space === carrier.space &&
        (state.mode === "inward"
          ? distance(carrier, target) > 2
          : distance(carrier, target) <= 2),
    );
  if (actor.profileId === ENEMY_MODIFIER_IDS.haven)
    targets = opponents.filter(
      (target) =>
        target.space === carrier?.space &&
        !state.cells?.includes(cellKey(target)),
    );
  if (actor.profileId === ENEMY_MODIFIER_IDS.isolation) {
    const anchor = actorById(scene, state.targetId);
    if (anchor && !anchor.knockedOut) {
      targets = opponents.filter(
        (target) => target.id !== anchor.id && distance(anchor, target) <= 3,
      );
      const total =
          modifierTierValue("6(+1)", actor.tier) * livePlayers(scene).length,
        each = targets.length ? Math.ceil(total / targets.length) : 0;
      for (const target of targets)
        events.push({
          type: "damage.apply",
          actorId: actor.id,
          payload: {
            targetId: target.id,
            amount: each,
            sourceActionId,
            boundaryEventId,
            participantIds: [actor.id, anchor.id, target.id],
          },
        });
      return events;
    }
  }
  for (const target of targets)
    events.push({
      type: "damage.apply",
      actorId: actor.id,
      payload: {
        targetId: target.id,
        amount: tension,
        sourceActionId,
        boundaryEventId,
        participantIds: [actor.id, target.id],
      },
    });
  return events;
}
function modifierRoundEndEvents(scene, boundaryEvent) {
  const events = [];
  for (const actor of (scene.actors || []).filter(
    (item) => isEnemyModifier(item) && !item.knockedOut,
  )) {
    events.push(...modifierDamageEvents(scene, actor, boundaryEvent));
    if (actor.profileId === ENEMY_MODIFIER_IDS.vortex) {
      const carrier = modifierCarrier(scene, actor),
        anchor = actorById(scene, modifierState(actor).targetId),
        space = (scene.spaces || []).find((item) => item.id === carrier?.space);
      if (
        carrier &&
        anchor &&
        !anchor.knockedOut &&
        anchor.space === carrier.space &&
        space
      ) {
        const edgeDistances = [
            { edge: "left", value: anchor.x },
            { edge: "right", value: space.width - 1 - anchor.x },
            { edge: "top", value: anchor.y },
            { edge: "bottom", value: space.height - 1 - anchor.y },
          ],
          maximum = Math.max(...edgeDistances.map((item) => item.value)),
          edges = new Set(
            edgeDistances
              .filter((item) => item.value === maximum)
              .map((item) => item.edge),
          ),
          candidates = [];
        for (let y = 0; y < space.height; y++)
          for (let x = 0; x < space.width; x++)
            if (
              (edges.has("left") && x === 0) ||
              (edges.has("right") && x === space.width - 1) ||
              (edges.has("top") && y === 0) ||
              (edges.has("bottom") && y === space.height - 1)
            )
              candidates.push({ x, y });
        const occupied = new Set(
            (scene.actors || [])
              .filter(
                (item) =>
                  item.kind === "crowd" &&
                  !item.knockedOut &&
                  item.space === space.id,
              )
              .map(cellKey),
          ),
          cells = candidates
            .filter((point) => !occupied.has(cellKey(point)))
            .slice(0, 4),
          groupId = `vortex-${boundaryEvent.id}-${actor.id}`;
        for (const [index, point] of cells.entries())
          events.push({
            type: "actor.spawn",
            actorId: actor.id,
            payload: {
              actor: {
                id: `${groupId}-${index}`,
                kind: "crowd",
                crowdSubtype: "vortex",
                crowdType: "swarm",
                crowdGroupId: groupId,
                vortexOwnerId: actor.id,
                source: "enemy.modifier.vortex.round-end",
                team: actor.team,
                name: "Поток Вихря",
                tier: 0,
                space: space.id,
                ...point,
                hp: 1,
                maxHp: 1,
                focus: 0,
                ap: 0,
                baseAp: 0,
                speed: 0,
                armor: 0,
                evasion: 0,
                effects: [],
                usedActions: [],
                acted: true,
                hidden: false,
                tokenSymbol: "◈",
                tokenColor: "#5aa7c7",
                tokenImage: "",
                portraitImage: "",
              },
              boundaryEventId: boundaryEvent.id,
              participantIds: [actor.id, carrier.id, anchor.id],
            },
          });
      }
    }
    if (
      [
        ENEMY_MODIFIER_IDS.artillery,
        ENEMY_MODIFIER_IDS.contagion,
        ENEMY_MODIFIER_IDS.earthquake,
        ENEMY_MODIFIER_IDS.haven,
        ENEMY_MODIFIER_IDS.isolation,
      ].includes(actor.profileId)
    )
      events.push({
        type: "rule.prompt",
        actorId: actor.id,
        payload: {
          id: `prompt-${boundaryEvent.id}-${actor.id}`,
          kind: "modifier-refresh",
          sourceActorId: actor.id,
          controller: "narrator",
          title: `${actor.name}: новая настройка`,
          text: "Канон требует выбрать новую область, цель или режим после эффекта конца Раунда. Обновите выбор в панели модификатора и подтвердите.",
          options: ["confirm"],
          context: {
            boundaryEventId: boundaryEvent.id,
            profileId: actor.profileId,
            optionLabels: { confirm: "Подтвердить новую настройку" },
          },
          participantIds: [actor.id],
        },
      });
  }
  return events;
}
function modifierMovementEvents(scene, event) {
  const crowd = actorById(scene, event.actorId);
  if (
    event.type !== "actor.move" ||
    crowd?.crowdSubtype !== "vortex" ||
    !event.payload?.fodderMove
  )
    return [];
  const owner = actorById(scene, crowd.vortexOwnerId),
    carrier = modifierCarrier(scene, owner);
  if (
    !owner ||
    owner.knockedOut ||
    !carrier ||
    carrier.knockedOut ||
    distance(crowd, carrier) > 0
  )
    return [];
  const nextArmor = Number(carrier.armor || 0) + 1,
    events = [
      {
        type: "actor.state",
        actorId: carrier.id,
        payload: {
          key: "armor",
          delta: 1,
          sourceActionId: "enemy.modifier.vortex.absorb",
          participantIds: [owner.id, carrier.id, crowd.id],
        },
      },
      {
        type: "actor.despawn",
        actorId: crowd.id,
        payload: {
          reason: `Поглощён носителем ${carrier.name}`,
          sourceActionId: "enemy.modifier.vortex.absorb",
          participantIds: [owner.id, carrier.id],
        },
      },
    ];
  if (nextArmor >= 5)
    for (const target of livePlayers(scene))
      events.push({
        type: "damage.apply",
        actorId: owner.id,
        payload: {
          targetId: target.id,
          amount: modifierTierValue("20(+4)", owner.tier),
          sourceActionId: "enemy.modifier.vortex.burst",
          participantIds: [owner.id, carrier.id, target.id],
        },
      });
  return events;
}
function modifierKnockoutEvents(scene, event) {
  if (event.type !== "actor.knockout") return [];
  const defeated = actorById(scene, event.payload?.targetId || event.actorId);
  if (!defeated) return [];
  const events = [];
  for (const mod of (scene.actors || []).filter(
    (item) =>
      isAttachedModifier(item) &&
      !item.knockedOut &&
      modifierState(item).carrierId === defeated.id,
  ))
    events.push({
      type: "actor.knockout",
      actorId: mod.id,
      payload: {
        targetId: mod.id,
        sourceActionId: "enemy.modifier.carrier-knockout",
        participantIds: [defeated.id, mod.id],
      },
    });
  for (const legion of (scene.actors || []).filter(
    (item) =>
      item.profileId === ENEMY_MODIFIER_IDS.legion &&
      !item.knockedOut &&
      item.id !== defeated.id &&
      defeated.team === item.team &&
      defeated.kind !== "crowd",
  ))
    events.push({
      type: "damage.apply",
      actorId: legion.id,
      payload: {
        targetId: legion.id,
        amount: 10,
        ignoreArmor: true,
        sourceActionId: "enemy.modifier.legion.passive",
        defeatedActorId: defeated.id,
        participantIds: [legion.id, defeated.id],
      },
    });
  if (defeated.profileId === ENEMY_MODIFIER_IDS.legion)
    for (const target of (scene.actors || []).filter(
      (item) =>
        item.team === defeated.team &&
        !item.knockedOut &&
        item.id !== defeated.id,
    ))
      events.push({
        type: "actor.knockout",
        actorId: defeated.id,
        payload: {
          targetId: target.id,
          sourceActionId: "enemy.modifier.legion.collapse",
          participantIds: [defeated.id, target.id],
        },
      });
  if (defeated.profileId === ENEMY_MODIFIER_IDS.vip)
    for (const target of livePlayers(scene))
      events.push({
        type: "actor.knockout",
        actorId: defeated.id,
        payload: {
          targetId: target.id,
          sourceActionId: "enemy.modifier.vip.failure",
          participantIds: [defeated.id, target.id],
        },
      });
  if (
    defeated.profileId === ENEMY_MODIFIER_IDS.collateral &&
    defeated.modifierState?.deployed
  ) {
    const clock = (scene.sessionClocks || []).find(
        (item) => item.id === defeated.modifierState.clockId,
      ),
      value = Math.min(Number(clock?.size || 0), Number(clock?.value || 0) + 1);
    if (clock)
      events.push({
        type: "session-clock.set",
        actorId: defeated.id,
        payload: {
          id: clock.id,
          value,
          sourceActionId: "enemy.modifier.collateral.failure",
          participantIds: [defeated.id],
        },
      });
    if (clock && value >= Number(clock.size || 0))
      for (const target of livePlayers(scene))
        events.push({
          type: "actor.knockout",
          actorId: defeated.id,
          payload: {
            targetId: target.id,
            sourceActionId: "enemy.modifier.collateral.clock-full",
            participantIds: [defeated.id, target.id],
          },
        });
  }
  return events;
}
function modifierConfigureEvents(scene, event) {
  if (event.type !== "modifier.configure") return [];
  const actor = actorById(scene, event.actorId);
  if (!actor || !AREA_MODIFIER_IDS.has(actor.profileId)) return [];
  const id = `modifier-area-${actor.id}`,
    existing = (scene.objects || []).find((item) => item.id === id),
    haven = actor.profileId === ENEMY_MODIFIER_IDS.haven,
    events = [];
  if (existing)
    events.push({
      type: "area.remove",
      actorId: actor.id,
      payload: { id, sourceActionId: actor.profileId },
    });
  events.push({
    type: "area.create",
    actorId: actor.id,
    payload: {
      id,
      space: modifierCarrier(scene, actor)?.space || actor.space,
      areaType: "custom",
      label: haven ? "Убежище · безопасная зона" : "Артиллерия · зона обстрела",
      source: actor.profileId,
      ruleId: actor.profileId,
      duration: "scene",
      ownerActorId: actor.id,
      cells: [...modifierState(actor).cells],
      metadata: {
        enemyModifier: haven ? "haven" : "artillery",
        mode: modifierState(actor).mode,
        configuredRound: Number(scene.round || 1),
      },
      participantIds: [actor.id],
    },
  });
  return events;
}
function modifierActionStatus(scene, request = {}) {
  const actor = actorById(scene, request.actorId),
    action = String(request.action || ""),
    carrier = modifierCarrier(scene, actor),
    cells = canonicalCells(
      scene,
      carrier?.space || actor?.space,
      request.cells,
    ),
    targetIds = [...new Set(request.targetIds || [])],
    targets = targetIds.map((id) => actorById(scene, id)),
    errors = [];
  if (!isEnemyModifier(actor) || actor.knockedOut)
    errors.push("Модификатор недоступен.");
  if (action === "gargantuan-strike") {
    const count = modifierTierValue("5(+1)", actor?.tier),
      roll = request.roll;
    if (actor?.profileId !== ENEMY_MODIFIER_IDS.gargantuan || !carrier)
      errors.push("Удар Громадины требует носителя.");
    if (!modifierTwoSquareCover(cells))
      errors.push("Выберите одну или две точные области 2×2.");
    if (
      !roll ||
      !Array.isArray(roll.rolls) ||
      roll.rolls.length !== count ||
      roll.rolls.some(
        (value) => !Number.isInteger(value) || value < 1 || value > 6,
      ) ||
      Number(roll.successes) !== roll.rolls.filter((value) => value >= 4).length
    )
      errors.push(`Нужен бросок ${count}D6.`);
  } else if (action === "giant-charge") {
    const d = request.destination || {},
      dx = Number(d.x) - Number(carrier?.x),
      dy = Number(d.y) - Number(carrier?.y),
      space = (scene.spaces || []).find((item) => item.id === carrier?.space);
    const invalidGeometry =
      actor?.profileId !== ENEMY_MODIFIER_IDS.giant ||
      !carrier ||
      !Number.isInteger(Number(d.x)) ||
      !Number.isInteger(Number(d.y)) ||
      (dx && dy) ||
      Math.abs(dx + dy) > 4 ||
      (!dx && !dy) ||
      Number(d.x) < 0 ||
      Number(d.y) < 0 ||
      Number(d.x) + 1 >= Number(space?.width) ||
      Number(d.y) + 1 >= Number(space?.height);
    if (invalidGeometry)
      errors.push(
        "Гигант перемещается на 1–4 клетки прямо и должен помещаться областью 2×2.",
      );
    else {
      const stepX = Math.sign(dx), stepY = Math.sign(dy), steps = Math.abs(dx + dy), removed = removedCellKeys(scene, carrier.space);
      for (let step = 1; step <= steps; step++) {
        const x = Number(carrier.x) + stepX * step, y = Number(carrier.y) + stepY * step;
        for (let ox = 0; ox < 2; ox++) for (let oy = 0; oy < 2; oy++) {
          const from = { x: x - stepX + ox, y: y - stepY + oy }, to = { x: x + ox, y: y + oy };
          if (removed.has(cellKey(to))) errors.push("Путь Гиганта проходит через удалённую клетку.");
          if (wallBlocksStep(scene, carrier.space, from, to)) errors.push("Путь Гиганта перекрыт стеной.");
        }
      }
      const destinationStatus = effectCellOccupancyStatus(scene, carrier.id, { space: carrier.space, x: Number(d.x), y: Number(d.y) });
      if (!destinationStatus.available && destinationStatus.blockers.some((blocker) => blocker.type === "terrain" || blocker.team === carrier.team)) errors.push(destinationStatus.reason);
    }
  } else if (action === "legion-return") {
    const space = (scene.spaces || []).find((item) => item.id === actor?.space),
      tension = Number(scene.tension || 0);
    if (
      actor?.profileId !== ENEMY_MODIFIER_IDS.legion ||
      targets.some(
        (target) =>
          !target?.knockedOut ||
          target.team !== actor.team ||
          target.kind === "crowd" ||
          target.id === actor.id,
      ) ||
      targets.length > tension
    )
      errors.push("Выберите до Напряжения павших обычных врагов.");
    if (
      cells.length !== tension ||
      cells.some((cell) => {
        const [x, y] = cell.split(",").map(Number);
        return (
          x !== 0 &&
          y !== 0 &&
          x !== space?.width - 1 &&
          y !== space?.height - 1
        );
      })
    )
      errors.push(`Выберите ${tension} клеток на краю.`);
  } else errors.push("Неизвестное действие модификатора.");
  return {
    available: !errors.length,
    reason: errors.join(" "),
    actor,
    carrier,
    cells,
    targetIds,
    targets,
    action,
    destination: request.destination || null,
    roll: request.roll || null,
  };
}
function prepareModifierAction(scene, request = {}) {
  const status = modifierActionStatus(scene, request);
  if (!status.available)
    return { ok: false, errors: [status.reason], events: [] };
  return {
    ok: true,
    errors: [],
    events: [
      {
        type: "modifier.action",
        actorId: status.actor.id,
        payload: {
          action: status.action,
          cells: status.cells,
          targetIds: status.targetIds,
          destination: status.destination,
          roll: status.roll,
          profileId: status.actor.profileId,
          participantIds: [
            status.actor.id,
            status.carrier?.id,
            ...status.targetIds,
          ].filter(Boolean),
        },
      },
    ],
  };
}
function modifierActionEvents(scene, event) {
  if (event.type !== "modifier.action") return [];
  const status = modifierActionStatus(scene, {
      actorId: event.actorId,
      ...event.payload,
    }),
    actor = status.actor,
    events = [];
  if (!status.available) return events;
  if (status.action === "gargantuan-strike") {
    for (const object of (scene.objects || []).filter(
      (item) =>
        item.ownerActorId === actor.id &&
        item.metadata?.enemyModifier === "gargantuan",
    ))
      events.push({
        type: "area.remove",
        actorId: actor.id,
        payload: { id: object.id },
      });
    const occupants = (scene.actors || []).filter(
      (item) =>
        !item.knockedOut &&
        item.space === status.carrier.space &&
        status.cells.includes(cellKey(item)),
    );
    for (const target of occupants)
      events.push({
        type: "damage.apply",
        actorId: actor.id,
        payload: {
          targetId: target.id,
          amount:
            Number(status.roll.successes || 0) + Number(scene.tension || 0),
          sourceActionId: "enemy.modifier.gargantuan.attack",
          participantIds: [actor.id, target.id],
        },
      });
    events.push({
      type: "area.create",
      actorId: actor.id,
      payload: {
        id: `gargantuan-${event.id}`,
        space: status.carrier.space,
        areaType: "terrain",
        label: "Громадина · местность",
        source: "enemy.modifier.gargantuan.attack",
        duration: "scene",
        ownerActorId: actor.id,
        cells: status.cells,
        hp: status.cells.length * 10,
        maxHp: status.cells.length * 10,
        metadata: { enemyModifier: "gargantuan" },
      },
    });
  }
  if (status.action === "giant-charge")
    events.push({
      type: "actor.move",
      actorId: status.carrier.id,
      payload: {
        space: status.carrier.space,
        x: Number(status.destination.x),
        y: Number(status.destination.y),
        placement: true,
        movement: "Гигант · рывок 2×2",
        sourceActionId: "enemy.modifier.giant.attack",
        participantIds: [actor.id, status.carrier.id],
      },
    });
  if (status.action === "legion-return") {
    for (const [index, target] of status.targets.entries()) {
      const [x, y] = status.cells[index].split(",").map(Number);
      events.push(
        {
          type: "actor.move",
          actorId: target.id,
          payload: {
            space: actor.space,
            x,
            y,
            placement: true,
            allowKnockedOut: true,
            movement: "Легион · возвращение",
            participantIds: [actor.id, target.id],
          },
        },
        {
          type: "actor.knockout",
          actorId: actor.id,
          payload: {
            targetId: target.id,
            restore: true,
            amount: Math.ceil(Number(target.maxHp || 1) / 2),
            sourceActionId: "enemy.modifier.legion.attack",
            participantIds: [actor.id, target.id],
          },
        },
      );
    }
    for (
      let index = status.targets.length;
      index < Number(scene.tension || 0);
      index++
    ) {
      const [x, y] = status.cells[index].split(",").map(Number);
      events.push({
        type: "actor.spawn",
        actorId: actor.id,
        payload: {
          actor: {
            id: `legion-fodder-${event.id}-${index}`,
            kind: "crowd",
            crowdType: "mob",
            crowdGroupId: `legion-${event.id}`,
            team: actor.team,
            name: "Подкрепление Легиона",
            tier: 0,
            space: actor.space,
            x,
            y,
            hp: 1,
            maxHp: 1,
            focus: 0,
            ap: 0,
            baseAp: 0,
            speed: 0,
            armor: 0,
            evasion: 0,
            effects: [],
            usedActions: [],
            acted: true,
            hidden: false,
            tokenSymbol: "●",
            tokenColor: "#7b2638",
            tokenImage: "",
            portraitImage: "",
            source: "enemy.modifier.legion.attack",
          },
        },
      });
    }
  }
  return events;
}
