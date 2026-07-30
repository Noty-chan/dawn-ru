import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "logic.js"), "utf8"), context);
const logic = context.window.DAWN_LOGIC;

assert.deepEqual(
  JSON.parse(JSON.stringify(logic.challengeOutcome({ successes: 1, target: 2 }))),
  { id: "failure", label: "Провал", target: 2, extremeTarget: 4 },
);
assert.equal(logic.challengeOutcome({ successes: 2, target: 2 }).id, "minimal");
assert.equal(logic.challengeOutcome({ successes: 4, target: 2 }).id, "extreme");
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.freeplayBondAdvantage({ rank: 2, tags: ["Соперник"], standardTags: ["Соперник", "Партнер"] }))),
  { rank: 2, customTagBonus: 0, total: 2 },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.freeplayBondAdvantage({ rank: 2, tags: ["Клятва"], standardTags: ["Соперник", "Партнер"] }))),
  { rank: 2, customTagBonus: 1, total: 3 },
  "A non-standard Bond tag grants exactly one extra Advantage when the Bond is used",
);

const markup = fs.readFileSync(path.join(root, "index.html"), "utf8");
const source = ["app-core.js", "play-ui.js", "app-play-events.js", "hero-ui.js", "scene-events.js"]
  .map(file => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

for (const id of ["freeplay-intent", "freeplay-threat", "freeplay-reward", "dice-target", "dice-bond", "freeplay-bonds", "freeplay-risk-actions"]) {
  assert.match(markup, new RegExp(`id="${id}"`), `Free-play tools must expose #${id}`);
}
assert.match(source, /base\.bonds=Array\.isArray\(h\.bonds\)/, "Bonds must survive character import and normalization");
assert.match(source, /ruleId:`freeplay\.skill:/, "A Skill must enter a challenge roll through the reusable Advantage hook");
assert.match(source, /ruleId:`freeplay\.ability:/, "An Ability must enter a challenge roll through the reusable Advantage hook");
assert.match(source, /ruleId:`freeplay\.bond:/, "A Bond must enter a challenge roll through the reusable Advantage hook");
assert.match(source, /target:scenario\.target,intent:scenario\.intent,threat:scenario\.threat,reward:scenario\.reward/, "Public rolls must retain their declared narrative context");
assert.match(source, /Применить базовый Риск: \+1 Стресс, \+1 Влияние/, "Failure resolution must offer the canonical basic Risk");
assert.match(source, /hasGift\("Lone Wolf"\)&&S\.bonds\.length>=3/, "The Wolf Bond limit must be enforced in the tools");
assert.match(source, /bond\.tags\.length<bond\.rank/, "Bond rank increases must require all current tag slots");

console.log("Free-play tools QA passed: outcomes, character features, Bonds, narrative context, and Risks");
