"use strict";

(function exposeDawnLogic(global) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function calculateRankSpend({ skillSpent, abilityCost, abilityExtra, gadgetSpent, gadgetPool }) {
    const paidAbility = Math.max(0, clamp(abilityCost, 0, 999) - clamp(abilityExtra, 0, 999));
    const paidGadgets = Math.max(0, clamp(gadgetSpent, 0, 999) - clamp(gadgetPool, 0, 999));
    return {
      paidAbility,
      paidGadgets,
      rankSpent: clamp(skillSpent, 0, 999) + paidAbility + paidGadgets,
    };
  }

  function calculateCreationBudgets({
    tier = 1,
    gifts = [],
    skillRanks = [],
    performanceTargetRank = 0,
    abilityCost = 0,
    taintedBodyUsed = false,
    taintedAbilityCost = 0,
    gadgetSpent = 0,
  }) {
    const currentTier = clamp(tier, 1, 6);
    const selected = new Set(Array.isArray(gifts) ? gifts : []);
    let rankBase = 8 + 2 * (currentTier - 1);
    let skillMin = 4;
    if (selected.has("Past Your Prime")) {
      rankBase = 12 + (currentTier - 1);
      skillMin = 8;
    }
    if (selected.has("Amazing Potential")) {
      rankBase = 6 + 3 * (currentTier - 1);
      skillMin = 2;
    }

    const unrestrictedExtra = selected.has("Supernatural Deafness") ? 3 : 0;
    const darkUrgeRanks = selected.has("Dark Urge") ? 4 : 0;
    const uncontrollableRanks = selected.has("Uncontrollable Power") ? 4 : 0;
    const abilityExtra = darkUrgeRanks + uncontrollableRanks;
    const abilityExtraUsed = Math.min(clamp(abilityCost, 0, 999), abilityExtra);
    const taintedAbilityPool = selected.has("Tainted Body") && taintedBodyUsed ? 3 + currentTier : 0;
    const taintedAbilitySpent = taintedAbilityPool ? clamp(taintedAbilityCost, 0, 999) : 0;
    const gadgetPool = selected.has("Gearhead") ? 3 : 0;
    const effectiveGadgetSpent = selected.has("Gearhead") ? clamp(gadgetSpent, 0, 999) : 0;
    const skillSpent = (Array.isArray(skillRanks) ? skillRanks : []).reduce((sum, rank) => sum + clamp(rank, 1, 3), 0);
    const performanceBonus = selected.has("Performance Artist") && clamp(performanceTargetRank, 0, 3) < 3 && clamp(performanceTargetRank, 0, 3) > 0 ? 1 : 0;
    const rankPool = rankBase + unrestrictedExtra;
    const rankAccounting = calculateRankSpend({ skillSpent, abilityCost, abilityExtra, gadgetSpent: effectiveGadgetSpent, gadgetPool });

    return {
      tier: currentTier,
      rankBase,
      unrestrictedExtra,
      rankPool,
      skillMin,
      skillSpent,
      performanceBonus,
      darkUrgeRanks,
      uncontrollableRanks,
      abilityExtra,
      abilityExtraUsed,
      abilityExtraRemaining: abilityExtra - abilityExtraUsed,
      taintedAbilityPool,
      taintedAbilitySpent,
      taintedAbilityRemaining: Math.max(0, taintedAbilityPool - taintedAbilitySpent),
      taintedAbilityOver: Math.max(0, taintedAbilitySpent - taintedAbilityPool),
      gadgetPool,
      gadgetSpent: effectiveGadgetSpent,
      ...rankAccounting,
    };
  }

  function calculateAbilityCost({ enabled = false, rank = 1, words = [], xWord = null, specializations = {} }) {
    if (!enabled) return 0;
    const selectedWords = Array.isArray(words) ? words.filter(Boolean) : [];
    const omitCondition = selectedWords.some(word => word.group !== "conditions" && String(word.marks || "").includes("✢"));
    const activeWords = selectedWords.filter(word => !(omitCondition && word.group === "conditions"));
    const specializationFor = word => String(specializations?.[word?.id] || "").trim();
    const fixedCost = word => {
      const base = Number(word?.cost);
      if (!Number.isFinite(base)) return 0;
      return base - (String(word?.marks || "").includes("✝") && specializationFor(word) ? 1 : 0);
    };
    const variableWords = activeWords.filter(word => word.cost === null);
    let total = activeWords.reduce((sum, word) => sum + (word.cost === null ? 0 : fixedCost(word)), 0);
    if (variableWords.length && xWord) total += variableWords.length * fixedCost(xWord);
    return Math.max(1, total) + (clamp(rank, 1, 3) - 1);
  }

  function scaleTierFormula(formula, tier = 1) {
    const value = String(formula ?? "").trim().replace(/^\*/, "");
    const currentTier = clamp(tier, 1, 99);
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
    let match = value.match(/^(-?\d+(?:\.\d+)?)\(\+(\d+(?:\.\d+)?)\)$/);
    if (match) return Number(match[1]) + (currentTier - 1) * Number(match[2]);
    match = value.match(/^(-?\d+(?:\.\d+)?)\(\+(\d+(?:\.\d+)?)\/2\)$/);
    if (match) return Number(match[1]) + Math.floor(currentTier / 2) * Number(match[2]);
    return null;
  }

  function areaCells({ shape = "cell", x = 0, y = 0, width = 7, height = 7 }) {
    const cells = [];
    const add = (cellX, cellY) => {
      if (cellX >= 0 && cellX < width && cellY >= 0 && cellY < height) cells.push(`${cellX},${cellY}`);
    };
    if (shape === "square2") {
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) add(x + dx, y + dy);
    } else if (shape === "square3") {
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) add(x + dx, y + dy);
    } else if (shape === "square5") {
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) add(x + dx, y + dy);
    } else if (shape === "radius2") {
      for (let cellY = 0; cellY < height; cellY += 1) for (let cellX = 0; cellX < width; cellX += 1) if (Math.abs(cellX - x) + Math.abs(cellY - y) <= 2) add(cellX, cellY);
    } else if (shape === "lineH") {
      for (let cellX = 0; cellX < width; cellX += 1) add(cellX, y);
    } else if (shape === "lineV") {
      for (let cellY = 0; cellY < height; cellY += 1) add(x, cellY);
    } else if (shape === "lineDiagDown") {
      for (let offset = -Math.max(width, height); offset <= Math.max(width, height); offset += 1) add(x + offset, y + offset);
    } else if (shape === "lineDiagUp") {
      for (let offset = -Math.max(width, height); offset <= Math.max(width, height); offset += 1) add(x + offset, y - offset);
    } else add(x, y);
    return [...new Set(cells)];
  }

  function swapAttributeBase(attributes, key, nextValue, order = Object.keys(attributes || {})) {
    const current = { ...(attributes || {}) };
    const value = clamp(nextValue, 2, 4);
    if (!order.includes(key) || current[key] === value) return current;
    const donor = order.find(candidate => candidate !== key && current[candidate] === value);
    if (!donor) return current;
    const previous = current[key];
    current[key] = value;
    current[donor] = previous;
    return current;
  }

  function rollXd6({ count, threshold = 4, random = Math.random, maxRolls = 300 }) {
    const initialCount = clamp(count, 1, 300);
    const successAt = clamp(threshold, 2, 6);
    const rolls = [];
    let pending = initialCount;
    while (pending > 0 && rolls.length < maxRolls) {
      pending -= 1;
      const value = 1 + Math.floor(clamp(random(), 0, 0.999999999) * 6);
      rolls.push(value);
      if (value === 6) pending += 1;
    }
    return {
      initialCount,
      rolls,
      successes: rolls.filter(value => value >= successAt).length,
      crits: rolls.filter(value => value === 6).length,
      truncated: pending > 0,
    };
  }

  global.DAWN_LOGIC = { areaCells, calculateAbilityCost, calculateCreationBudgets, calculateRankSpend, clamp, rollXd6, scaleTierFormula, swapAttributeBase };
})(typeof window === "object" ? window : globalThis);
