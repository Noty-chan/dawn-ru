"use strict";

(function exposeTechniqueFoundationMap(global) {
  const VERSION = 8;
  const CAPABILITIES = {
    "event-participants": { label: "Участники события", state: "ready", module: "scene-engine-core.js" },
    "event-preview": { label: "Предпросмотр цепочки", state: "ready", module: "scene-triggers.js" },
    "spatial-cells": { label: "Персонажи в клетках и областях", state: "ready", module: "scene-query.js" },
    "spatial-range": { label: "Персонажи в дальности", state: "ready", module: "scene-query.js" },
    "spatial-topology": { label: "Удалённые клетки и разрывы поля", state: "ready", module: "scene-engine-core.js / scene-events.js / scene-movement.js" },
    "target-validation": { label: "Проверка целей", state: "ready", module: "scene-query.js" },
    "resource-check": { label: "Проверка ресурсов", state: "ready", module: "scene-query.js" },
    "effect-state": { label: "Чтение состояния Эффекта", state: "ready", module: "scene-query.js" },
    "event-summary": { label: "Сводка цепочки", state: "ready", module: "scene-query.js" },
    "rule-clock": { label: "Часы правила", state: "ready", module: "scene-foundations.js" },
    "alternate-resource": { label: "Альтернативный ресурс", state: "ready", module: "scene-foundations.js" },
    stance: { label: "Стойки", state: "ready", module: "scene-foundations.js" },
    "exclusive-mode": { label: "Взаимоисключающие режимы", state: "ready", module: "scene-foundations.js / scene-events.js" },
    "owned-entities": { label: "Принадлежащие сущности", state: "ready", module: "scene-foundations.js" },
    "action-history": { label: "История действий", state: "ready", module: "scene-foundations.js" },
    terrain: { label: "Местность", state: "ready", module: "scene-foundations.js" },
    "usage-limits": { label: "Лимиты использования", state: "ready", module: "scene-foundations.js" },
    "trigger-router": { label: "Маршрутизация триггеров", state: "ready", module: "scene-triggers.js / scene-events.js" },
    "reaction-window": { label: "Окна Реакций и вмешательств", state: "ready", module: "scene-responses.js / scene-events.js" },
    "turn-lifecycle": { label: "Жизненный цикл Хода и Раунда", state: "planned" },
    "scene-lifecycle": { label: "Начало, конец и сброс Сцены", state: "planned" },
    "movement-lifecycle": { label: "Жизненный цикл движения", state: "planned" },
    "choice-flow": { label: "Типизированное решение", state: "ready", module: "scene-responses.js / scene-events.js / scene-effects.js" },
    "damage-pipeline": { label: "Конвейер урона, Здоровья и Ран", state: "ready", module: "scene-responses.js / scene-events.js" },
    "action-modifier": { label: "Модификатор или новое действие", state: "ready", module: "scene-actions.js / scene-responses.js" },
    "composite-action": { label: "Сохраняемое составное действие", state: "ready", module: "scene-query.js / scene-events.js / scene-responses.js / scene-effects.js" },
    "effect-lifecycle": { label: "Механика, источник и срок Эффекта", state: "ready", module: "scene-engine-core.js / scene-query.js / scene-events.js / scene-triggers.js / scene-responses.js" },
    "entity-lifecycle": { label: "Жизненный цикл зон, маркеров и объектов", state: "ready", module: "scene-events.js / scene-triggers.js / scene-ui.js" },
    inventory: { label: "Инвентарь и заряды", state: "planned" },
    "summon-turns": { label: "Призывы и делегированные Ходы", state: "planned" },
    "dice-hooks": { label: "Модификаторы и повтор броска", state: "ready", module: "scene-foundations.js / scene-events.js / scene-triggers.js" },
    "duration-scheduler": { label: "Сроки действия и отложенные эффекты", state: "ready", module: "scene-events.js / scene-triggers.js / scene-ui.js" },
    "deployment-hooks": { label: "Развертывание", state: "planned" },
    "intermission-reset": { label: "Сброс на Интермиссии", state: "planned" },
    "bond-actions": { label: "Связи и действия Связей", state: "planned" },
    "derived-stats": { label: "Производные характеристики персонажа", state: "planned" },
    "information-query": { label: "Изучение и раскрытие информации", state: "planned" },
    transformation: { label: "Трансформации и заимствованные правила", state: "planned" },
    "duel-flow": { label: "Дуэли и ставки", state: "planned" },
    "combat-meter": { label: "Напряжение и общие счетчики боя", state: "planned" },
    "action-copy": { label: "Заимствование Атак и Техник", state: "planned" },
    "multi-space-actor": { label: "Размер и несколько клеток персонажа", state: "planned" },
    "manual-ruling": { label: "Ручное решение Нарратора", state: "fallback" },
  };

  // Все три Уровня перечисленных Техник последовательно сверены с полным текстом
  // source/translation/pages-065-099-*-techniques.md на ревизии d41acc9.
  // Новая Техника не становится проверенной автоматически: её id требуется явно
  // добавить сюда после чтения всех трёх Уровней.
  const REVIEWED = {
    sourceRevision: "d41acc9",
    sourceDigest: "ff8e0353fb78e8470e8a6ffae40a72b254864f03908c50a98b7d44e876fad0b1",
    // Явные профили добавляются только после отдельной повторной проверки
    // каждого Уровня. Автоматическая классификация не участвует в результате
    // строки со статусом reviewed.
    profiles: {
      "powerhouse.berserker.1": "res limit trigger reaction turn damage action stats meter",
      "powerhouse.berserker.2": "trigger damage stats",
      "powerhouse.berserker.3": "effect trigger choice damage",
      "powerhouse.dragonslayer.1": "tg effect trigger damage action",
      "powerhouse.dragonslayer.2": "tg cells res trigger choice action",
      "powerhouse.dragonslayer.3": "tg move effect action history dice",
      "powerhouse.duelist.1": "tg move effect action history dice",
      "powerhouse.duelist.2": "tg effect trigger reaction action",
      "powerhouse.duelist.3": "tg range res trigger reaction action",
      "powerhouse.flagellant.1": "effect trigger choice",
      "powerhouse.flagellant.2": "tg move effect limit trigger turn action dice",
      "powerhouse.flagellant.3": "effect trigger damage",
      "powerhouse.gunslinger.1": "tg range res alt scene choice action dice",
      "powerhouse.gunslinger.2": "res alt trigger turn action dice",
      "powerhouse.gunslinger.3": "tg res alt effect trigger action",
      "powerhouse.struggler.1": "trigger scene choice damage dice stats",
      "powerhouse.struggler.2": "tg move effect trigger choice damage",
      "powerhouse.struggler.3": "trigger action dice",
      "powerhouse.spellsword.1": "res trigger choice action copy",
      "powerhouse.spellsword.2": "tg move action history",
      "powerhouse.spellsword.3": "tg trigger damage action history",
      "powerhouse.technician.1": "res limit trigger turn duration action history stats",
      "powerhouse.technician.2": "trigger turn duration action history stats",
      "powerhouse.technician.3": "res action history stats",
      "powerhouse.unbroken.1": "res limit scene choice duration duel",
      "powerhouse.unbroken.2": "res trigger action",
      "powerhouse.unbroken.3": "res trigger damage duel",
      "powerhouse.braggart.1": "clock trigger reaction scene duration action history dice",
      "powerhouse.braggart.2": "clock limit trigger choice dice",
      "powerhouse.braggart.3": "clock trigger damage",
      "powerhouse.breacher.1": "tg range move trigger action",
      "powerhouse.breacher.2": "effect trigger choice action dice",
      "powerhouse.breacher.3": "tg cells trigger choice action",
      "powerhouse.dual-wielder.1": "tg limit trigger choice damage action dice",
      "powerhouse.dual-wielder.2": "tg res trigger choice action dice",
      "powerhouse.dual-wielder.3": "tg res move limit trigger turn choice damage action history",
      "powerhouse.martial-artist.1": "tg move effect limit trigger turn choice action",
      "powerhouse.martial-artist.2": "tg trigger damage action history stats",
      "powerhouse.martial-artist.3": "limit trigger action dice",
      "powerhouse.monastic-sage.1": "effect trigger turn stats",
      "powerhouse.monastic-sage.2": "res effect trigger turn action inventory",
      "powerhouse.monastic-sage.3": "res trigger turn choice",
      "powerhouse.lancer.1": "tg range action dice",
      "powerhouse.lancer.2": "tg range damage action",
      "powerhouse.lancer.3": "tg cells range terrain trigger damage action dice",
      "powerhouse.predator.1": "tg res limit trigger turn damage action info",
      "powerhouse.predator.2": "move terrain trigger damage stats info",
      "powerhouse.predator.3": "res effect limit trigger scene damage action",
      "powerhouse.improvisational-fighter.1": "range terrain entity trigger choice damage action dice stats",
      "powerhouse.improvisational-fighter.2": "limit trigger turn action dice",
      "powerhouse.improvisational-fighter.3": "terrain limit trigger scene action dice meter",
      "powerhouse.warring-ascendant.1": "tg range res effect move limit trigger scene choice damage action transform meter copy",
      "powerhouse.warring-ascendant.2": "trigger choice transform copy",
      "powerhouse.warring-ascendant.3": "tg trigger choice damage action transform",
      "vagabond.aerial-master.1": "effect stance terrain move trigger action dice",
      "vagabond.aerial-master.2": "effect move trigger choice action",
      "vagabond.aerial-master.3": "tg effect stance trigger action dice stats",
      "vagabond.assassin.1": "limit trigger action deploy",
      "vagabond.assassin.2": "tg effect move trigger reaction choice action composite dice",
      "vagabond.assassin.3": "effect move action history",
      "vagabond.sniper.1": "tg range action",
      "vagabond.sniper.2": "effect trigger turn action dice range",
      "vagabond.sniper.3": "tg move trigger damage action history dice",
      "vagabond.skirmisher.1": "tg limit trigger turn damage action stats",
      "vagabond.skirmisher.2": "move trigger choice action",
      "vagabond.skirmisher.3": "tg move trigger choice damage action dice",
      "vagabond.speed-demon.1": "tg move",
      "vagabond.speed-demon.2": "move action history",
      "vagabond.speed-demon.3": "tg effect move limit trigger turn damage action",
      "vagabond.untouchable.1": "limit trigger turn stats",
      "vagabond.untouchable.2": "move trigger damage stats",
      "vagabond.untouchable.3": "tg move action history dice",
      "vagabond.acrobat.1": "tg move trigger action history dice",
      "vagabond.acrobat.2": "move terrain limit trigger turn stats",
      "vagabond.acrobat.3": "move terrain limit trigger action",
      "vagabond.blade-master.1": "stance trigger duration action history dice",
      "vagabond.blade-master.2": "tg move stance trigger action history",
      "vagabond.blade-master.3": "move trigger action history dice",
      "vagabond.cunning-fighter.1": "tg clock limit trigger turn scene action info",
      "vagabond.cunning-fighter.2": "limit turn action",
      "vagabond.cunning-fighter.3": "tg cells range res limit trigger turn action info",
      "vagabond.egomaniac.1": "tg res move clock trigger turn scene action history dice",
      "vagabond.egomaniac.2": "tg range res clock trigger choice effect stats",
      "vagabond.egomaniac.3": "clock trigger choice scene action meter",
      "vagabond.enchained.1": "tg range move trigger choice action",
      "vagabond.enchained.2": "tg move trigger choice damage action",
      "vagabond.enchained.3": "tg move trigger action history dice",
      "vagabond.knife-juggler.1": "tg range res alt trigger choice action",
      "vagabond.knife-juggler.2": "tg move res alt entity trigger action dice",
      "vagabond.knife-juggler.3": "tg range res alt entity move trigger reaction action",
      "vagabond.malicious-mimic.1": "tg effect trigger scene action inventory copy",
      "vagabond.malicious-mimic.2": "effect trigger stats inventory",
      "vagabond.malicious-mimic.3": "res trigger choice action inventory copy",
      "vagabond.modified-meister.1": "tg res alt damage trigger scene action",
      "vagabond.modified-meister.2": "tg res alt effect trigger damage action dice",
      "vagabond.modified-meister.3": "res alt move trigger turn duration choice damage action meter",
      "vagabond.opportunist.1": "tg range move limit trigger reaction turn action",
      "vagabond.opportunist.2": "tg range res effect trigger reaction",
      "vagabond.opportunist.3": "tg range effect limit trigger reaction turn action",
      "vagabond.reflector.1": "trigger reaction scene damage choice stats",
      "vagabond.reflector.2": "trigger reaction damage dice",
      "vagabond.reflector.3": "tg move trigger reaction choice damage action stats",
      "vagabond.dim-mak.1": "tg move entity limit trigger turn choice action info",
      "vagabond.dim-mak.2": "tg entity trigger reaction action info stats",
      "vagabond.dim-mak.3": "tg entity move trigger turn action history",
      "vagabond.drunkard.1": "tg effect move limit trigger turn choice damage action deploy dice",
      "vagabond.drunkard.2": "effect trigger turn stats",
      "vagabond.drunkard.3": "effect move limit trigger turn action",
      "vagabond.master-at-arms.1": "tg range effect move limit mode trigger turn choice action",
      "vagabond.master-at-arms.2": "res effect limit mode trigger turn stats",
      "vagabond.master-at-arms.3": "tg cells effect move terrain mode trigger choice damage action dice",
      "bulwark.crusher.1": "tg effect trigger choice damage action",
      "bulwark.crusher.2": "tg cells effect trigger turn damage action history",
      "bulwark.crusher.3": "trigger turn damage action history",
      "bulwark.giant-frame.1": "tg cells res trigger choice action",
      "bulwark.giant-frame.2": "move terrain trigger choice deploy stats multi",
      "bulwark.giant-frame.3": "tg cells res effect trigger choice damage action",
      "bulwark.iron-bodied.1": "move stats",
      "bulwark.iron-bodied.2": "stats",
      "bulwark.iron-bodied.3": "effect trigger turn choice damage stats",
      "bulwark.vanguard-defender.1": "tg range move trigger reaction choice action",
      "bulwark.vanguard-defender.2": "res limit trigger reaction turn duration action stats",
      "bulwark.vanguard-defender.3": "tg move effect trigger reaction choice",
      "bulwark.absolute-bastard.1": "tg effect limit trigger scene action info",
      "bulwark.absolute-bastard.2": "tg move res effect limit trigger turn choice stats",
      "bulwark.absolute-bastard.3": "tg effect trigger action dice",
      "bulwark.battle-jockey.1": "move entity summon trigger deploy",
      "bulwark.battle-jockey.2": "tg effect entity trigger summon",
      "bulwark.battle-jockey.3": "tg range move effect entity summon limit trigger scene choice turn",
      "bulwark.grappler.1": "tg effect trigger action",
      "bulwark.grappler.2": "tg effect move trigger action dice",
      "bulwark.grappler.3": "tg effect move trigger reaction turn duration action composite history",
      "bulwark.juggernaut.1": "tg move terrain trigger choice damage action stats",
      "bulwark.juggernaut.2": "tg move effect limit trigger turn damage",
      "bulwark.juggernaut.3": "move trigger choice action",
      "bulwark.mundane.1": "res alt turn action stats",
      "bulwark.mundane.2": "tg res alt trigger reaction",
      "bulwark.mundane.3": "tg range res alt effect trigger action dice",
      "bulwark.rising-challenger.1": "res move trigger reaction action",
      "bulwark.rising-challenger.2": "tg range move trigger reaction action",
      "bulwark.rising-challenger.3": "dice action",
      "bulwark.runic-retribution.1": "tg trigger reaction action",
      "bulwark.runic-retribution.2": "tg res effect trigger reaction choice action info",
      "bulwark.runic-retribution.3": "tg move effect trigger duration choice action",
      "bulwark.shield-bearer.1": "res trigger reaction turn duration choice stats",
      "bulwark.shield-bearer.2": "tg move entity trigger damage action",
      "bulwark.shield-bearer.3": "tg cells entity trigger reaction stats",
      "bulwark.stalwart-sentry.1": "move trigger turn",
      "bulwark.stalwart-sentry.2": "res clock trigger action",
      "bulwark.stalwart-sentry.3": "tg move terrain entity trigger reaction action info",
      "bulwark.beastial-ascendant.1": "tg range res effect move limit trigger scene choice damage action transform meter copy",
      "bulwark.beastial-ascendant.2": "trigger choice damage transform copy",
      "bulwark.beastial-ascendant.3": "res limit trigger scene choice action transform copy",
      "bulwark.guardian-angel.1": "tg move damage action multi",
      "bulwark.guardian-angel.2": "tg effect trigger action history",
      "bulwark.guardian-angel.3": "tg range res move trigger reaction damage action stats multi",
      "bulwark.servant-s-call.1": "tg cells res entity summon limit trigger choice damage action",
      "bulwark.servant-s-call.2": "tg move entity summon trigger reaction turn duration choice action",
      "bulwark.servant-s-call.3": "tg cells res entity summon limit trigger scene choice damage action bond",
      "bulwark.mecha-pilot.1": "tg cells move terrain entity trigger choice damage action stats multi",
      "bulwark.mecha-pilot.2": "tg cells terrain entity summon trigger choice damage action stats multi",
      "bulwark.mecha-pilot.3": "res effect entity summon trigger choice action stats multi",
      "altruist.battle-instructor.1": "tg move effect trigger choice action info",
      "altruist.battle-instructor.2": "tg res bond trigger reaction choice dice",
      "altruist.battle-instructor.3": "tg res bond limit trigger scene action",
      "altruist.empath.1": "tg effect trigger turn choice",
      "altruist.empath.2": "tg range res move trigger reaction damage action",
      "altruist.empath.3": "tg res bond action",
      "altruist.gourmand.1": "tg damage inventory trigger intermission choice action",
      "altruist.gourmand.2": "inventory intermission",
      "altruist.gourmand.3": "tg res bond inventory trigger",
      "altruist.heavenly-saint.1": "tg res alt limit trigger scene action",
      "altruist.heavenly-saint.2": "tg effect trigger choice damage action dice",
      "altruist.heavenly-saint.3": "tg effect limit trigger scene damage action",
      "altruist.precognizant.1": "tg res limit trigger reaction scene choice dice",
      "altruist.precognizant.2": "tg trigger reaction action stats",
      "altruist.precognizant.3": "tg res effect trigger choice action",
      "altruist.surgeon.1": "tg trigger choice damage action dice",
      "altruist.surgeon.2": "effect inventory trigger intermission choice damage dice",
      "altruist.surgeon.3": "tg entity inventory trigger damage action dice",
      "altruist.talisman-caster.1": "tg entity trigger action",
      "altruist.talisman-caster.2": "range entity trigger choice action",
      "altruist.talisman-caster.3": "tg entity action",
      "altruist.alchemist.1": "tg range effect inventory trigger choice action",
      "altruist.alchemist.2": "tg res inventory trigger choice damage",
      "altruist.alchemist.3": "res inventory trigger choice action dice",
      "altruist.chronomancer.1": "tg move effect trigger choice damage action",
      "altruist.chronomancer.2": "tg res effect trigger reaction action dice",
      "altruist.chronomancer.3": "tg res clock limit trigger turn scene choice damage action duel dice",
      "altruist.dancer.1": "tg move effect limit trigger turn choice action",
      "altruist.dancer.2": "res trigger action history",
      "altruist.dancer.3": "effect trigger choice action history",
      "altruist.fog-walker.1": "tg move res entity trigger turn choice action composite",
      "altruist.fog-walker.2": "move entity trigger stats composite",
      "altruist.fog-walker.3": "tg move res entity trigger choice damage action",
      "altruist.last-hope.1": "tg effect trigger reaction action",
      "altruist.last-hope.2": "move effect trigger reaction turn duration choice meter",
      "altruist.last-hope.3": "trigger reaction turn",
      "altruist.replicator.1": "tg terrain entity limit trigger choice damage action",
      "altruist.replicator.2": "move entity trigger",
      "altruist.replicator.3": "res entity trigger turn action stats",
      "altruist.will-o-wisp.1": "tg move effect entity limit trigger turn scene choice action",
      "altruist.will-o-wisp.2": "tg res move entity trigger reaction choice",
      "altruist.will-o-wisp.3": "entity trigger choice",
      "altruist.artist.1": "tg move res effect entity limit trigger turn choice action",
      "altruist.artist.2": "tg res entity trigger choice action",
      "altruist.artist.3": "tg effect entity trigger turn choice action",
      "altruist.bardic-savant.1": "tg move res effect inventory trigger choice damage action",
      "altruist.bardic-savant.2": "res inventory limit trigger turn choice action",
      "altruist.bardic-savant.3": "res inventory trigger choice action",
      "altruist.deckbuilder.1": "tg move res effect inventory limit trigger scene choice damage action dice",
      "altruist.deckbuilder.2": "tg terrain entity inventory trigger reaction choice action dice",
      "altruist.deckbuilder.3": "inventory limit action",
      "disruptor.bloodletter.1": "tg effect trigger action",
      "disruptor.bloodletter.2": "tg move effect trigger reaction choice damage action",
      "disruptor.bloodletter.3": "tg effect trigger damage action history dice",
      "disruptor.chemist.1": "tg cells effect terrain entity trigger turn duration damage action stats",
      "disruptor.chemist.2": "tg res effect trigger choice damage info",
      "disruptor.chemist.3": "tg cells effect entity trigger damage",
      "disruptor.constrictor.1": "tg move effect trigger turn choice action",
      "disruptor.constrictor.2": "tg effect trigger damage action",
      "disruptor.constrictor.3": "tg move effect trigger damage action dice",
      "disruptor.cutpurse.1": "tg move res effect limit trigger turn choice",
      "disruptor.cutpurse.2": "effect trigger choice",
      "disruptor.cutpurse.3": "move limit trigger turn action history",
      "disruptor.mind-breaker.1": "tg effect limit trigger choice damage action",
      "disruptor.mind-breaker.2": "tg effect trigger",
      "disruptor.mind-breaker.3": "tg move effect limit trigger turn choice action",
      "disruptor.reaper.1": "tg move effect limit trigger turn action",
      "disruptor.reaper.2": "range effect trigger turn duration",
      "disruptor.reaper.3": "tg range res move effect limit trigger turn action",
      "disruptor.tactical-master.1": "res effect stance limit trigger turn damage action",
      "disruptor.tactical-master.2": "res effect trigger choice action",
      "disruptor.tactical-master.3": "res stance trigger turn action stats",
      "disruptor.autophage.1": "res alt effect trigger damage action",
      "disruptor.autophage.2": "tg effect trigger choice damage action dice",
      "disruptor.autophage.3": "tg effect limit trigger scene choice damage action",
      "disruptor.earth-speaker.1": "move terrain entity trigger damage",
      "disruptor.earth-speaker.2": "tg move terrain entity limit trigger turn damage",
      "disruptor.earth-speaker.3": "tg move terrain entity trigger damage action dice",
      "disruptor.inhuman-strength.1": "tg move effect terrain trigger choice action",
      "disruptor.inhuman-strength.2": "tg move trigger action stats",
      "disruptor.inhuman-strength.3": "tg move terrain trigger damage",
      "disruptor.street-fighter.1": "tg effect trigger action",
      "disruptor.street-fighter.2": "tg effect trigger action dice",
      "disruptor.street-fighter.3": "tg effect trigger damage action dice",
      "disruptor.swarm-body.1": "tg move res terrain entity trigger reaction turn damage",
      "disruptor.swarm-body.2": "move entity trigger action",
      "disruptor.swarm-body.3": "tg effect entity trigger choice damage",
      "disruptor.siren.1": "tg effect limit trigger scene action info",
      "disruptor.siren.2": "tg move effect limit trigger turn",
      "disruptor.siren.3": "tg move effect trigger action",
      "disruptor.wave-rider.1": "tg move effect entity limit trigger turn choice action",
      "disruptor.wave-rider.2": "tg move trigger turn damage action",
      "disruptor.wave-rider.3": "tg effect entity limit trigger scene",
      "disruptor.gale-strider.1": "tg move entity trigger turn choice action history",
      "disruptor.gale-strider.2": "tg move effect entity trigger turn",
      "disruptor.gale-strider.3": "tg move terrain entity trigger choice damage",
      "disruptor.hunter.1": "tg move terrain entity trigger reaction choice action",
      "disruptor.hunter.2": "tg range effect trigger action",
      "disruptor.hunter.3": "tg cells terrain entity trigger action",
      "disruptor.inner-world.1": "tg res effect trigger choice action",
      "disruptor.inner-world.2": "tg cells move effect limit trigger scene damage",
      "disruptor.inner-world.3": "limit trigger scene action duel dice",
      "disruptor.mage-s-array.1": "tg cells range entity trigger choice action",
      "disruptor.mage-s-array.2": "move entity trigger choice",
      "disruptor.mage-s-array.3": "terrain entity trigger choice action",
      "ruiner.bombardier.1": "tg cells range action",
      "ruiner.bombardier.2": "tg cells range res trigger choice action",
      "ruiner.bombardier.3": "tg cells range res trigger choice action",
      "ruiner.rapid-fire-sorcery.1": "tg range res trigger choice damage action dice",
      "ruiner.rapid-fire-sorcery.2": "tg terrain entity trigger turn damage",
      "ruiner.rapid-fire-sorcery.3": "tg trigger action history dice meter",
      "ruiner.ritualist.1": "res terrain entity trigger choice action meter",
      "ruiner.ritualist.2": "range terrain entity limit trigger turn action dice meter",
      "ruiner.ritualist.3": "terrain entity trigger scene choice action",
      "ruiner.spellcrafter.1": "cells range inventory limit trigger scene choice damage action stats",
      "ruiner.spellcrafter.2": "res inventory trigger action stats",
      "ruiner.spellcrafter.3": "res inventory trigger action",
      "ruiner.student-of-stars.1": "res limit action history meter",
      "ruiner.student-of-stars.2": "tg cells choice action history",
      "ruiner.student-of-stars.3": "res trigger choice duel dice",
      "ruiner.cryomancer.1": "tg effect trigger action",
      "ruiner.cryomancer.2": "tg res effect clock trigger scene choice damage action dice",
      "ruiner.cryomancer.3": "tg range res effect trigger damage action info",
      "ruiner.dramaturge.1": "res limit trigger choice action dice meter",
      "ruiner.dramaturge.2": "trigger turn meter",
      "ruiner.dramaturge.3": "tg res effect trigger choice damage action meter",
      "ruiner.feral-arcana.1": "tg range effect action dice",
      "ruiner.feral-arcana.2": "tg res effect move clock trigger turn choice action duration meter",
      "ruiner.feral-arcana.3": "tg move clock trigger choice action dice meter",
      "ruiner.flame-heart.1": "res effect trigger choice damage action",
      "ruiner.flame-heart.2": "tg effect trigger damage action dice meter",
      "ruiner.flame-heart.3": "tg effect trigger choice action dice",
      "ruiner.grim-ascendant.1": "tg range res effect move limit trigger scene choice damage action stats transform meter",
      "ruiner.grim-ascendant.2": "effect trigger choice damage action transform",
      "ruiner.grim-ascendant.3": "tg cells trigger choice damage action transform",
      "ruiner.long-draw.1": "res inventory trigger action dice",
      "ruiner.long-draw.2": "move inventory trigger",
      "ruiner.long-draw.3": "tg range res inventory trigger scene damage action history",
      "ruiner.mana-blades.1": "res trigger choice action copy",
      "ruiner.mana-blades.2": "tg move effect entity trigger action dice",
      "ruiner.mana-blades.3": "effect trigger choice action transform copy",
      "ruiner.void-soul.1": "move effect trigger turn duration choice",
      "ruiner.void-soul.2": "res move limit trigger turn",
      "ruiner.void-soul.3": "tg cells effect move clock trigger scene damage action",
      "ruiner.thunder-blood.1": "effect clock trigger scene choice action",
      "ruiner.thunder-blood.2": "tg range effect move clock trigger choice action",
      "ruiner.thunder-blood.3": "tg cells effect clock trigger damage action dice",
      "ruiner.zealot.1": "res clock limit trigger scene choice action dice",
      "ruiner.zealot.2": "tg effect clock trigger turn choice",
      "ruiner.zealot.3": "tg move clock terrain topo trigger choice action",
      "ruiner.creation-ascetic.1": "tg cells range res alt move terrain limit trigger scene choice damage action dice",
      "ruiner.creation-ascetic.2": "res alt terrain limit trigger turn damage action",
      "ruiner.creation-ascetic.3": "res alt action history",
      "ruiner.ego-arm.1": "tg move trigger choice damage action deploy transform",
      "ruiner.ego-arm.2": "tg res entity trigger turn damage action history stats",
      "ruiner.ego-arm.3": "tg res entity trigger choice action dice stats",
      "ruiner.sellsword-s-call.1": "tg cells res entity summon limit trigger choice damage action",
      "ruiner.sellsword-s-call.2": "res move effect entity summon trigger choice action",
      "ruiner.sellsword-s-call.3": "tg cells res entity summon limit trigger scene choice action bond deploy",
    },
  };

  const PROFILE_CODES = {
    tg: ["target-validation", "event-participants"],
    cells: ["spatial-cells"],
    range: ["spatial-range"],
    res: ["resource-check"],
    effect: ["effect-state", "effect-lifecycle"],
    clock: ["rule-clock"],
    alt: ["alternate-resource"],
    stance: ["stance"],
    mode: ["exclusive-mode"],
    entity: ["owned-entities", "entity-lifecycle"],
    history: ["action-history"],
    terrain: ["terrain"],
    topo: ["spatial-topology"],
    limit: ["usage-limits"],
    trigger: ["trigger-router"],
    reaction: ["reaction-window"],
    turn: ["turn-lifecycle"],
    scene: ["scene-lifecycle"],
    move: ["movement-lifecycle"],
    choice: ["choice-flow"],
    damage: ["damage-pipeline"],
    action: ["action-modifier"],
    composite: ["composite-action"],
    summon: ["summon-turns"],
    inventory: ["inventory"],
    dice: ["dice-hooks"],
    duration: ["duration-scheduler"],
    deploy: ["deployment-hooks"],
    intermission: ["intermission-reset"],
    bond: ["bond-actions"],
    stats: ["derived-stats"],
    info: ["information-query"],
    transform: ["transformation"],
    duel: ["duel-flow"],
    meter: ["combat-meter"],
    copy: ["action-copy"],
    multi: ["multi-space-actor"],
    manual: ["manual-ruling"],
  };

  function explicitProfile(id) {
    const codes = String(REVIEWED.profiles[id] || "").trim().split(/\s+/).filter(Boolean);
    if (!codes.length) return null;
    const capabilities = [];
    for (const code of codes) {
      if (!PROFILE_CODES[code]) throw new Error(`Unknown reviewed capability code "${code}" for ${id}`);
      for (const capability of PROFILE_CODES[code]) {
        if (!capabilities.includes(capability)) capabilities.push(capability);
      }
    }
    return capabilities;
  }

  function planForLevel(level = {}) {
    const mechanics = level.mechanics || {};
    const text = String(level.text || "");
    const id = String(level.id || "");
    const evidence = new Map();
    const add = (capability, reason) => {
      if (!CAPABILITIES[capability]) return;
      const reasons = evidence.get(capability) || [];
      if (reason && !reasons.includes(reason)) reasons.push(reason);
      evidence.set(capability, reasons);
    };

    add("event-preview", "любая автоматизация проходит предварительную проверку цепочки");
    add("event-summary", "интерфейс и журнал должны объяснять подготовленные последствия");

    if (mechanics.targets) {
      add("target-validation", "индекс механик: есть цели");
      add("event-participants", "цели должны быть видимы в цепочке");
    }
    if ((mechanics.areas || []).length) add("spatial-cells", "индекс механик: есть область");
    if ((mechanics.ranges || []).length) add("spatial-range", `индекс механик: дальность ${mechanics.ranges.join("/")}`);
    if ((mechanics.resources || []).length) add("resource-check", `индекс механик: ресурсы ${mechanics.resources.join(", ")}`);
    if ((mechanics.effects || []).length || (mechanics.directEffects || []).length) {
      add("effect-state", "индекс механик: есть Эффекты");
      add("effect-lifecycle", "Эффект требуется наложить, снять, сохранить или заменить");
    }

    if (mechanics.movement || /перемест|телепорт|толк|притян|движени|проходи(?:ть|те)|входи(?:ть|те)|выходи(?:ть|те)/i.test(text)) {
      add("movement-lifecycle", "текст изменяет или проверяет движение");
    }
    if ((mechanics.clocks || []).length || /(?:часы|часов|сегмент)/i.test(text)) add("rule-clock", "правило использует часы или сегменты");
    if (/вместо\s+\*\*(?:Фокуса|ОД)\*\*|вместо \*\*(?:Фокуса|ОД)\*\*|ресурс\. Нельзя брать вместе|заменять любую \*\*Стоимость\*\*/i.test(text)) {
      add("alternate-resource", "правило заменяет базовый ресурс");
    }
    if (/\*\*Стойк(?:а|у|е|ой|и)\*\*/i.test(text)) add("stance", "текст использует Стойку");
    if (/местност|элемент \*\*местности\*\*|кра(?:й|я) поля/i.test(text)) add("terrain", "текст взаимодействует с местностью или границей поля");

    const persistentEntity = /(?:созда|помест|размест|убра|удал|двига|перемещ)[^.\n]{0,100}(?:маркер|Печат|Талисман|Рун|Туман|Рой|Ловуш|Тайфун|Эхо|Цвет|Клинок|Прожектор|Оружи)|(?:Призыв|Скакун|Костюм|Заклинательный круг|Слабая точка|Духовное пламя)/i.test(text);
    if (persistentEntity) {
      add("owned-entities", "правило создаёт или использует сохраняемую сущность");
      add("entity-lifecycle", "сущности нужны создание, владелец и удаление");
    }
    if (/(?:\*\*Призыв|\*\*Скакун|\*\*Костюм)[^.\n]{0,180}(?:\*\*Ход|\*\*Атак|\*\*пассив)|(?:\*\*Ход|\*\*Атак|\*\*пассив)[^.\n]{0,180}(?:\*\*Призыв|\*\*Скакун|\*\*Костюм)/i.test(text)) {
      add("summon-turns", "сущность действует как участник");
    }
    if (/перв(?:ый|ая|ое)|второй раз|один раз|раз за \*\*(?:Ход|Раунд|Сцену)|не больше одного раза|одновременно у вас|только \[|можно использовать только/i.test(text)) {
      add("usage-limits", "правило имеет счётчик, максимум или ограничение периода");
    }
    if (mechanics.conditional || /когда |всякий раз|после |в начале|в конце|пока |до начала|до конца|если /i.test(text)) {
      add("trigger-router", mechanics.conditional ? "индекс механик: условное правило" : "текст содержит условие или временной триггер");
    }
    if (/Реакц|Прорыв|вне \*\*Хода\*\*|прерыва(?:ет|я)|сразу после|немедленно совершить/i.test(text)) {
      add("reaction-window", "правило открывает Реакцию или вмешивается в чужую цепочку");
    }
    if (/начина(?:ете|ет|ют) (?:свой )?\*\*Ход|заканчива(?:ете|ет|ют) (?:свой )?\*\*Ход|начале (?:следующего )?\*\*(?:Хода|Раунда)\*\*|конце (?:следующего )?\*\*(?:Хода|Раунда)\*\*|каждый \*\*(?:Ход|Раунд)\*\*|за \*\*(?:Ход|Раунд)\*\*/i.test(text)) {
      add("turn-lifecycle", "правило связано с границей Хода или Раунда");
    }
    if (/начина(?:ете|ет|ют) (?:все |каждую )?\*\*Сцен|конц[ае] \*\*Сцен|после каждой \*\*Сцен|до конца \*\*Сцен|за \*\*Сцен|раз за \*\*Сцен/i.test(text)) {
      add("scene-lifecycle", "правило связано с границей или состоянием Сцены");
    }
    if (/можете выбрать|выберите |по вашему выбору|если вы это делаете|отказаться|согласн|разрешения|случайно|броском d6/i.test(text)) {
      add("choice-flow", "правило требует решения игрока, согласия или случайного выбора");
    }
    if (/урон|Здоров|Ран[ауые]|исцел|восстанавлив|выведен из строя|вывести из строя|нокаут/i.test(text)) {
      add("damage-pipeline", "правило меняет урон, Здоровье, Рану или выведение из строя");
    }
    if ((mechanics.actions || []).length || /Стоимость|Быстр|бесплат|действи|Атак|Стычк|Заклинан|Завершен|Передышк|Зарядк|Изучени|Прыжок|Шаг|Взаимодействи/i.test(text)) {
      add("action-modifier", "правило изменяет, создаёт или вызывает действие");
    }
    if (/\[[^\]]+\s*->\s*[^\]]+\]|предыдущ|прошл(?:ый|ого) \*\*Ход|ранее в этот \*\*Ход|того же персонажа|действие перед|атаковал в (?:свой|этот) \*\*Ход|череду|сбрасываясь в начале/i.test(text)) {
      add("action-history", "правило зависит от последовательности или истории действий");
    }
    if (/брос|кост|Успех|Преимуществ|Помех|Критичес|переброс/i.test(text)) add("dice-hooks", "правило изменяет, повторяет или читает бросок");
    if (/до конца|до начала|следующего \*\*Ход|следующего \*\*Раунд|исчезает|пока не|временно|сохранять .* пока/i.test(text)) {
      add("duration-scheduler", "последствие имеет срок или условие окончания");
    }
    if (/Развертыван/i.test(text)) add("deployment-hooks", "правило срабатывает при Развертывании");
    if (/Интермисси/i.test(text)) add("intermission-reset", "правило связано с Интермиссией");
    if (/Связ[ьи]|действие Связи|Ранг Связи/i.test(text)) add("bond-actions", "правило использует Связи");
    if (/запас|Зель|Бинт|Антисептик|заряд(?:ов|ы|а|\s)|Трапез|Карт[аы]|Строф|Впечатлени/i.test(text)) {
      add("inventory", "правило хранит предметы, заряды или именованный запас");
    }
    if (/Скорост|Стойкост|Брон|Уклонени|максимальн(?:ое|ого) \*\*Здоров|размером? \d|Атрибут|ОД\*\*|дополнительн(?:ое|ый) \*\*ОД/i.test(text)) {
      add("derived-stats", "правило читает или меняет характеристику персонажа");
    }
    if (/\*\*Изучени|спросить \*\*Нарратора|должен сказать вам|известно, что|текущее и максимальное \*\*Здоровье/i.test(text)) {
      add("information-query", "правило раскрывает или проверяет информацию");
    }
    if (/трансформир|Трансформац|считается, что у вас есть .*Уровн|Технику.*как если бы/i.test(text)) {
      add("transformation", "правило временно меняет форму или заимствует набор правил");
    }
    if (/Дуэл|на кон|Ва-банк/i.test(text)) add("duel-flow", "правило связано с Дуэлью, ставкой или Ва-банком");
    if (/Напряжени|Ложное Напряжение/i.test(text)) add("combat-meter", "правило читает или меняет Напряжение");
    if (/использовать (?:указанную )?\*\*Атаку\*\* врага|использовать \*\*Атаки\*\* выбранных врагов|выбранной \*\*Техники\*\*|Технику Оружия/i.test(text)) {
      add("action-copy", "правило заимствует чужую Атаку или Технику");
    }
    if (/размер(?:ом)? 2 x 2|две отдельные \*\*клетки\*\*|занимать область 2 x 2/i.test(text)) {
      add("multi-space-actor", "персонаж занимает несколько клеток или имеет несколько позиций");
    }

    if (!evidence.size) add("manual-ruling", "автоматизируемый паттерн ещё не выделен");

    const explicit = explicitProfile(id);
    const isReviewed = Boolean(explicit);
    const capabilityIds = explicit || [...evidence.keys()];
    const capabilities = capabilityIds.map(capability => ({
      id: capability,
      state: CAPABILITIES[capability].state,
      reasons: explicit ? ["подтверждено отдельной ручной записью Уровня"] : evidence.get(capability),
    }));
    return {
      version: VERSION,
      status: isReviewed ? "reviewed" : "candidate",
      reviewed: isReviewed ? capabilities.map(item => item.id) : [],
      capabilities,
    };
  }

  global.DAWN_TECHNIQUE_FOUNDATION_MAP = { VERSION, CAPABILITIES, REVIEWED, planForLevel };
})(typeof window === "object" ? window : globalThis);
