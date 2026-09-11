import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../scene-ui.js", import.meta.url), "utf8");
const helperStart = source.indexOf("const SCENE_NUMERIC_LABELS=");
const helperEnd = source.indexOf("function sceneEffectTitle", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "numeric source panel helpers are present");

const quote = (rawBase, value, sources = [], temporarySources = []) => ({ rawBase, base: rawBase, value, sources, temporarySources });
const canonical = { id: "powerhouse.lancer.1", label: "<Копейщик>", amount: 2, operation: "min", sourceDigest: "a".repeat(64), coverage: "partial", sourceType: "canonical" };
const temporary = { id: "vagabond.drunkard.2:h:turn", label: "Пьяница II", amount: 4, operation: "add", sourceDigest: "b".repeat(64), coverage: "partial", sourceType: "temporary" };
const scene = {};
const actor = { id: "h", name: "Герой", rulesEdition: "lionwing" };
const context = {
  console,
  Scene: scene,
  sceneActorEffects: () => ["positive.ускорен"],
  esc: value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])),
  SceneEngine: {
    effectiveActorStats: () => ({
      maxHp: quote(16, 21, [{ ...canonical, label: "Телосложение II" }]),
      speed: quote(4, 8, [{ ...canonical, id: "bulwark.iron-bodied.1", label: "Каменное тело I", amount: 3, operation: "min" }]),
      armor: quote(0, 3, [], [temporary]),
      evasion: quote(0, 4, [], [temporary]),
      ranges: {
        skirmish: quote(1, 2, [canonical]),
        finishBody: quote(1, 2, [canonical]),
        finishTalent: quote(1, 5, [{ ...canonical, label: "Снайпер I", amount: 5 }]),
        spell: quote(5, 5),
      },
    }),
    numericQuote: () => quote(0, 2, [{ ...canonical, id: "powerhouse.braggart.1", label: "Гордыня I", amount: 1, operation: "add" }]),
  },
};
vm.createContext(context);
vm.runInContext(`${source.slice(helperStart, helperEnd)}\nthis.renderNumericSources = sceneNumericSourcesHtml;`, context, { filename: "scene-ui-numeric-helpers.js" });

const html = context.renderNumericSources(actor);
assert.match(html, /Источники числовых характеристик/, "the table panel has a clear source heading");
assert.match(html, /База листа/, "every stat card starts with its sheet base");
assert.match(html, /Каноническая Техника/, "canonical operations have a separate source category");
assert.match(html, /Временный модификатор/, "bounded modifiers have a separate source category");
assert.match(html, /покрытие: partial/, "partial automation is visible beside its source");
assert.match(html, /&lt;Копейщик&gt;/, "source labels are escaped before insertion");
assert.match(html, /Дальность Стычки/, "contextual attack ranges are shown");
assert.match(html, /Пример Преимущества Стычки/, "contextual Advantage is shown separately from static stats");

console.log("LionWing numeric source UI separates sheet, canonical and temporary contributions");
