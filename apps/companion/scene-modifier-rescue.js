"use strict";
function prepareCollateralRescue(scene, request = {}) {
  const collateral = actorById(scene, request.collateralId);
  const rescuer = actorById(scene, request.rescuerId);
  const canonical = collateral?.profileId === LIONWING_COLLATERAL_ID;
  const roll = request.roll;
  const threshold = collateral ? modifierTierValue("2(+1)", collateral.tier) : 0;
  const errors = [];
  if (![ENEMY_MODIFIER_IDS.collateral, LIONWING_COLLATERAL_ID].includes(collateral?.profileId) || collateral.knockedOut)
    errors.push("Случайная жертва недоступна.");
  if (!rescuer || rescuer.team === collateral?.team || rescuer.knockedOut || rescuer.kind === "crowd" || rescuer.space !== collateral?.space || distance(rescuer, collateral) > 1)
    errors.push("Спасатель должен быть живым смежным персонажем игрока.");
  if (canonical && (rescuer?.kind !== "hero" || rescuer?.profileId))
    errors.push("В LionWing спасение выполняет персонаж игрока.");
  if (Number(rescuer?.ap || 0) < 1)
    errors.push("Для Взаимодействия нужен 1 ОД.");
  if (!roll || !Array.isArray(roll.rolls) || !roll.rolls.length || roll.rolls.some(value => !Number.isInteger(value) || value < 1 || value > 6) || Number(roll.successes) !== roll.rolls.filter(value => value >= 4).length)
    errors.push("Нужен проверяемый бросок испытания.");
  if (canonical && roll?.rolls?.length !== Number(rescuer?.attrs?.spirit || 0))
    errors.push("Испытание спасения бросает число костей, равное Духу персонажа.");
  if (errors.length) return { ok: false, errors, events: [] };
  const sourceActionId = canonical ? "lionwing.modifier.collateral.rescue" : "enemy.modifier.collateral.rescue";
  const rollId = `collateral-rescue-roll-${eventId()}`;
  const spendId = `collateral-rescue-spend-${eventId()}`;
  return {
    ok: true,
    errors: [],
    success: Number(roll.successes) >= threshold,
    events: [
      { id: spendId, type: "resource.spend", actorId: rescuer.id, payload: { resource: "ap", amount: 1, sourceActionId, participantIds: [rescuer.id, collateral.id] } },
      { id: rollId, type: "roll.public", actorId: rescuer.id, payload: { ...clone(roll), target: threshold, intent: `Спасти ${collateral.name}`, targetIds: [collateral.id], spendEventId: spendId } },
      ...(Number(roll.successes) >= threshold ? [{ type: "actor.despawn", actorId: collateral.id, payload: { reason: `Спасён Взаимодействием ${rescuer.name}`, sourceActionId, rescuerId: rescuer.id, rollEventId: rollId, threshold, participantIds: [rescuer.id] } }] : []),
    ],
  };
}
