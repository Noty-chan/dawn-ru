import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { window: {}, console };
vm.createContext(context);
for (const file of ["edition-lionwing.js", "edition-lionwing-ru.js"]) {
  vm.runInContext(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"), context, { filename: file });
}
context.window.DAWN_LIONWING_ADAPTERS = {
  list: actor => actor?.lionwing?.automation?.["ruiner.cryomancer.1"] ? [{
    id: "ruiner.cryomancer.1",
    techniqueId: "ruiner.cryomancer",
    level: 1,
    label: "Frost Veiler I · reviewed adapter",
    coverage: "partial",
    sourceDigest: "canonical",
    enabled: true,
  }] : [],
};
context.window.DAWN_SCENE_ENGINE = {
  availableActions: () => [{ id: "action.cast", name: "Cast", available: false, reason: "Сейчас Ход другого участника", costModel: { amount: 1, resource: "ap" } }],
};
vm.runInContext(fs.readFileSync(new URL("../lionwing-technique-surface.js", import.meta.url), "utf8"), context, { filename: "lionwing-technique-surface.js" });
const surface = context.window.DAWN_LIONWING_TECHNIQUE_SURFACE;

const actor = {
  id: "hero",
  name: "Герой",
  rulesEdition: "lionwing",
  knownTechniques: { "ruiner.cryomancer": 2 },
  techniques: { "ruiner.cryomancer": 2 },
  lionwing: { automation: { "ruiner.cryomancer.1": true } },
  knockedOut: false,
};
const baseScene = {
  rulesEdition: "lionwing",
  version: 7,
  activeActorId: "other",
  actors: [actor, { id: "other", name: "Другой", rulesEdition: "lionwing", knockedOut: false }],
  targetIds: [],
  log: [],
  lionwing: { choices: [] },
};

const entries = surface.entries(actor);
const frost = entries.find(entry => entry.id === "ruiner.cryomancer.1");
assert.ok(frost, "known LionWing level is visible");
assert.equal(frost.canonicalTechniqueName, "Frost Veiler", "new canonical name is used");
assert.equal(frost.previousName, "Cryomancer", "migration name remains a hint only");
assert.match(frost.canonicalText, /successful Casts Slow/i);
assert.equal(frost.canonicalSource.locale, "en");
assert.equal(frost.canonicalSource.pdfPage, 100);

const model = surface.model(baseScene, actor, { viewer: { role: "player", actorId: "hero" } });
assert.equal(model.statuses[0].status.state, "assisted");
assert.equal(model.statuses[0].status.rows[0].coverage, "partial");
assert.equal(model.actionSummary.total, 1);
assert.equal(model.actionSummary.available, 0);
const html = surface.render(actor, { scene: baseScene, viewer: { role: "player", actorId: "hero" } });
assert.match(html, /Канон: LionWing EN · стр\. 100/);
assert.match(html, /Авто частично/);
assert.match(html, /Your successful Casts Slow/);
assert.doesNotMatch(html, /reviewed adapter/);
assert.match(html, /Сейчас Ход другого участника/);

const offerScene = structuredClone(baseScene);
offerScene.activeActorId = "hero";
offerScene.lionwing.choices = [{
  id: "offer-1",
  actorId: "hero",
  kind: "technique-trigger",
  title: "Frost Veiler: choose",
  options: ["skip", "apply"],
  context: {
    ruleId: "ruiner.cryomancer.1",
    optionLabels: { skip: "Не использовать", apply: "Применить" },
    choices: { apply: [{ kind: "effect", targetId: "other", effect: "negative.замедлен" }] },
  },
}];
const ownerModel = surface.model(offerScene, actor, { viewer: { role: "player", actorId: "hero" } });
assert.equal(ownerModel.offers.length, 1);
assert.equal(surface.model(structuredClone(offerScene), actor, { viewer: { role: "player", actorId: "hero" } }).offers.length, 1, "offer survives JSON reload");
const offerHtml = surface.pendingHtml(offerScene.lionwing.choices[0], { scene: offerScene, viewer: { role: "player", actorId: "hero" } });
assert.match(offerHtml, /data-lw-technique-choice="true"/);
assert.match(offerHtml, /Не использовать/);
assert.match(surface.pendingHtml({ ...offerScene.lionwing.choices[0], options: ["pass", "apply"], context: { ...offerScene.lionwing.choices[0].context, optionLabels: { pass: "Pass", apply: "Apply" } } }, { scene: offerScene, viewer: { role: "player", actorId: "hero" } }), /Pass · отмена/);
assert.match(offerHtml, /Срок: до ответа на это решение/);
assert.match(offerHtml, /Frost Veiler/);
assert.match(offerHtml, /Цели: Другой/);
assert.deepEqual(surface.visibleChoices(offerScene, { role: "player", actorId: "other" }), [], "another player cannot see private technique offer");
assert.equal(surface.visibleChoices(offerScene, { role: "player", actorId: "hero" }).length, 1);
assert.equal(surface.visibleChoices(offerScene, { role: "narrator" }).length, 1);

let dispatches = 0;
assert.equal(surface.dispatchOnce("choice:offer-1:skip", () => { dispatches += 1; return true; }), true);
assert.equal(surface.dispatchOnce("choice:offer-1:skip", () => { dispatches += 1; return true; }), false, "repeated click is ignored until state changes");
assert.equal(dispatches, 1);
assert.equal(surface.dispatchOnce("failed", () => false), false);
assert.equal(surface.dispatchOnce("failed", () => { dispatches += 1; return true; }), true, "failed dispatch can be retried");

console.log("LionWing technique surface passed: canonical source, separate automation status, action availability, offer cancel/reload and visibility");
