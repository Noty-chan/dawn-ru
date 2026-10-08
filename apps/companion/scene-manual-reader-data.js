"use strict";

// Read-only projection: callers supply edition/localization adapters, never the
// currently edited hero. Reading another participant must not consult global S.
(function exposeManualReaderData(root) {
  function entries(actor, options = {}) {
    if (!actor || typeof actor !== "object") return [];
    const copy = (ru, en) => options.english ? en : ru;
    const rows = [];
    const add = (id, name, text, extra = {}) => {
      if (text != null && String(text).trim()) rows.push({id, name: String(name || id), text: String(text), ...extra});
    };
    const translate = (key, params, fallback) => {
      const translated = options.t?.(key, params);
      return translated && translated !== key ? translated : fallback.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
    };
    const formula = (ability, key) => {
      if (!ability.words) return "";
      const word = id => options.wordById?.(id, ability);
      const placeholders = {verbs: ["verb", "Глагол", "Verb"], nouns: ["noun", "Существительное", "Noun"], conditions: ["condition", "Условие", "Condition"]};
      const x = word(ability.xNoun)?.name || "X";
      const first = group => {
        const [label, ru, en] = placeholders[group];
        const name = word(ability.words[group]?.[0])?.name;
        return name ? String(name).replaceAll("X", x).toLowerCase() : `[${translate(`builder.ability.placeholder.${label}`, {}, copy(ru, en))}]`;
      };
      const params = {verb: first("verbs"), noun: first("nouns"), condition: first("conditions")};
      const uncontrollable = key === "ability" && (actor.gifts || []).includes("cursed.uncontrollable-power");
      const noCondition = !uncontrollable && [...(ability.words.verbs || []), ...(ability.words.nouns || [])].some(id => String(word(id)?.marks || "").includes("✢"));
      if (uncontrollable && !(ability.words.conditions || []).length) {
        // The gift explicitly allows constant use when no condition exists.
        return translate("builder.ability.formulaUncontrollableAlways", params, copy("Вы {verb} {noun} постоянно.", "You {verb} {noun} constantly."));
      }
      return translate(`builder.ability.${noCondition ? "formulaNoCondition" : uncontrollable ? "formulaUncontrollable" : "formula"}`, params,
        noCondition ? copy("Вы можете {verb} {noun}.", "You can {verb} {noun}.") : uncontrollable ? copy("Вы {verb} {noun}, когда {condition}.", "You {verb} {noun} when {condition}.") : copy("Вы можете {verb} {noun}, пока {condition}.", "You can {verb} {noun} while {condition}."));
    };
    for (const key of ["ability", "taintedAbility"]) {
      const ability = actor[key];
      if (!ability?.enabled) continue;
      add(key, ability.name || copy(key === "ability" ? "Способность" : "Способность Порченого тела", key === "ability" ? "Ability" : "Tainted Body Ability"),
        [formula(ability, key), ability.desc].filter(Boolean).join("\n\n"), {area:true,meta: `${copy("Ранг", "Rank")} ${ability.rank || 1}`});
    }
    for (const entry of options.techniqueEntries?.(actor) || []) {
      add(entry.id, `${entry.displayTechniqueName} · ${entry.displayLevelName}`, entry.displayText, {toggle: true,area:true});
    }
    const profile = actor.profileId ? options.enemyProfile?.(actor.profileId) : null;
    if (profile) {
      const prefix = `profile:${profile.id || actor.profileId}`;
      add(`${prefix}:description`, profile.name, profile.description);
      add(`${prefix}:passive`, copy("Пассивная способность", "Passive ability"), profile.passive);
      const defense = options.defense?.(actor) || profile.defense;
      if (defense) add(`${prefix}:defense`, typeof defense === "object" ? defense.name || copy("Защита", "Defense") : copy("Защита", "Defense"), typeof defense === "object" ? defense.text : defense);
      const rules = Array.isArray(profile.rules) ? profile.rules : [...(profile.actions || []), ...(profile.ace ? [profile.ace] : [])];
      rules.forEach((rule, index) => {
        const id = `${prefix}:${rule.id || index}`;
        add(id, rule.name, rule.text,{area:true});
        add(`${id}:reward`, copy("Награда", "Reward"), rule.reward);
      });
      add(`${prefix}:reward`, copy("Награда", "Reward"), profile.reward);
      // Modifier/custom profiles may have only a prose rule, not structured rules.
      if (!profile.passive && !rules.length && !profile.description) add(`${prefix}:text`, profile.name, profile.text);
    }
    add("notes", copy("Заметки", "Notes"), actor.notes);
    return rows;
  }
  root.DAWN_MANUAL_READER_DATA = Object.freeze({entries});
})(window);
