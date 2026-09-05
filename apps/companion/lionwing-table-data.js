"use strict";

(function exposeLionwingTableData(root){
  function formula(value){
    return typeof value==="number"?String(value):String(value||"0");
  }

  function profileText(npc){
    return [
      npc.description,
      npc.passive?`Passive: ${npc.passive}`:"",
      ...(npc.actions||[]).map(action=>`${action.kind==="attack"?"Attack":"Action"} - ${action.name}: ${action.text}`),
      npc.ace?`Ace T${npc.ace.tension} - ${npc.ace.name}: ${npc.ace.text}`:"",
    ].filter(Boolean).join("\n\n");
  }

  function actionCost(action){
    const text=String(action?.text||"");
    const match=text.match(/(?:costs?|сто(?:ит|имость))\s+(\d+)\s*(?:AP|ОД)/iu);
    return match?Number(match[1]):1;
  }

  function normalizeNpc(npc){
    const stats=npc.statistics||{};
    const rules=(npc.actions||[]).map(action=>({
      ...action,
      apCost:actionCost(action),
      automation:"assisted",
      available:false,
      reason:"LionWing: разрешите правило вручную через Пульт Нарратора.",
    }));
    if(npc.ace)rules.push({
      ...npc.ace,
      kind:"trump",
      apCost:2,
      automation:"assisted",
      available:false,
      reason:"LionWing: разрешите Козырь вручную через Пульт Нарратора.",
    });
    return{
      id:npc.id,
      kind:"common",
      editionId:"lionwing",
      manualOnly:true,
      name:npc.name,
      tags:npc.role||"NPC",
      role:npc.role||"NPC",
      stats:{health:formula(stats.health),speed:formula(stats.speed),armor:formula(stats.armor),evasion:formula(stats.evasion)},
      statsRaw:`Health: ${formula(stats.health)}; Speed: ${formula(stats.speed)}; Armor: ${formula(stats.armor)}; Evasion: ${formula(stats.evasion)}`,
      passive:npc.passive||"",
      text:profileText(npc),
      rules,
      source:npc.source||null,
    };
  }

  function profiles(coreRules){
    return (coreRules?.npcs?.list||[]).map(normalizeNpc);
  }

  function effects(coreRules){
    return{
      positive:[...(coreRules?.effects?.positive||[])],
      negative:[...(coreRules?.effects?.negative||[])],
    };
  }

  root.DAWN_LIONWING_TABLE_DATA=Object.freeze({normalizeNpc,profiles,effects});
})(window);
