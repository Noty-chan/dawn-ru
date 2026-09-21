"use strict";

// LionWing display-only labels. Canonical role ids stay in edition-lionwing.js;
// the RU projection gets a display label and retains the English search alias.
(() => {
  const root = typeof window === "object" ? window : globalThis;
  const ROLE_LABELS = Object.freeze({
    DPS: "Дамагер",
    Tank: "Танк",
    Support: "Поддержка",
    Engine: "Движок",
  });

  function applyRoleLabels() {
    const canonicalNpcs = root.DAWN_LIONWING_DATA?.coreRules?.npcs?.list;
    const russianEntries = root.DAWN_LIONWING_RU?.coreRules?.npcs?.entries;
    if (!Array.isArray(canonicalNpcs) || !russianEntries || typeof russianEntries !== "object") return 0;
    let applied = 0;
    for (const npc of canonicalNpcs) {
      const label = ROLE_LABELS[npc?.role];
      const overlay = russianEntries[npc?.id];
      if (!label || !overlay || typeof overlay !== "object") continue;
      overlay.role = label;
      overlay.en = npc.role;
      applied += 1;
    }
    return applied;
  }

  root.DAWN_LIONWING_DISPLAY_MAPPING = Object.freeze({
    roleLabels: ROLE_LABELS,
    roleLabel: value => ROLE_LABELS[value] || value || "",
    applyRoleLabels,
  });
  applyRoleLabels();
})();
