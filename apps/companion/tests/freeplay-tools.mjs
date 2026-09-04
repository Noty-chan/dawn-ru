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
const source = ["app-bootstrap.js", "app-core.js", "play-ui.js", "app-play-events.js", "hero-ui.js", "scene-actions-ui.js", "scene-events.js", "scene-sync-ui.js", "app-sync-events.js", "scene-ui.js", "app-scene-events.js"]
  .map(file => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

for (const id of ["freeplay-director-title", "freeplay-local-hero", "freeplay-request-kind", "freeplay-request-actor", "freeplay-opponent", "freeplay-request-roll", "freeplay-opposed-status", "challenge-request-dock", "dice-tool-kind", "dice-tool-title", "dice-target", "dice-bond", "freeplay-bonds", "freeplay-risk-actions"]) {
  assert.match(markup, new RegExp(`id="${id}"`), `Free-play tools must expose #${id}`);
}
assert.match(markup, /id="tools-view-switch"/, "Narrators must be able to switch explicitly between Player and Narrator workspaces");
for (const id of ["freeplay-intent", "freeplay-threat", "freeplay-reward"]) {
  assert.doesNotMatch(markup, new RegExp(`id="${id}"`), `Spoken table context must not be duplicated in #${id}`);
}
assert.match(source, /base\.bonds=Array\.isArray\(h\.bonds\)/, "Bonds must survive character import and normalization");
assert.match(source, /ruleId:`freeplay\.skill:\$\{toolSkillId\(skill\)\}`/, "A Skill must enter a challenge roll through the reusable Advantage hook using its stable definition id");
assert.match(source, /ruleId:`freeplay\.ability:/, "An Ability must enter a challenge roll through the reusable Advantage hook");
assert.match(source, /ruleId:`freeplay\.bond:/, "A Bond must enter a challenge roll through the reusable Advantage hook");
assert.match(source, /S\.skills\.filter\(item=>skillDisplayName\(item\)\.trim\(\)\)/, "LionWing canonical Skills must remain available in the Tools dice composer");
assert.match(source, /localHeroWrap\.hidden=role==="network-player"/, "Narrators must be able to choose a local hero independently of the shared table");
assert.match(source, /if\(role!=="network-player"\)localSelect\.innerHTML=store\.heroes\.map/, "Narrator Tools must populate the local hero selector");
assert.match(source, /function renderToolsWorkspace\(\).*renderAllInControls\(\)/, "Every role, including the Narrator, must render the selected local hero's complete dice options");
assert.match(source, /definitionId:skill\.definitionId\|\|null/, "Published scene heroes must retain canonical LionWing Skill ids");
assert.match(source, /skillDisplayName\(skill,actor\)/, "Scene tools must resolve LionWing Skill names from their stable ids");
assert.match(source, /challengeRequestId:challenge\.id/, "A requested network roll must retain the Narrator request id");
assert.match(source, /Получен результат:/, "The Narrator tools must visibly expose an accepted requested roll");
assert.match(source, /Нарратор получил этот бросок/, "The player must receive explicit confirmation that the requested result was accepted");
assert.match(source, /toast\(`Получен бросок:/, "The Narrator must receive an immediate notification when the network roll is accepted");
assert.match(source, /legacyResult=base\.rollFeed\.find/, "An already-recorded roll must be recovered into its still-active legacy request");
assert.match(source, /opposedRequestId:opposed\.id/, "Each side's result must retain the opposed-roll request id");
assert.match(source, /opposed\.tie\.resolve/, "A Narrator must be able to resolve both compatible Rewards after a tie");
assert.match(source, /Перебросить ничью/, "The UI must expose the canonical tie reroll");
assert.match(source, /role==="network-narrator"/, "Network Narrators must receive a separate tools view");
assert.match(source, /function toolsView\(\)/, "Workspace presentation must remain separate from network authority");
assert.match(source, /freeplayState\(\)\.view=button\.dataset\.toolsView/, "The Player/Narrator workspace switch must persist without changing the table role");
assert.match(source, /role==="local-table"/, "One-device offline play must retain a dedicated local-table view");
assert.match(source, /document\.querySelector\("\.dice-tool"\)\.hidden=false/, "The dice composer must remain available in shared-table tools");
assert.doesNotMatch(source, /!challenge&&!participant\)return toast/, "A network player must be able to roll without a Narrator request");
assert.match(source, /function renderToolsWorkspace\(\).*renderDiceHistory\(\).*renderAllInControls\(\)/, "Shared-table tools must render the public roll history and complete controls for every role");
assert.match(markup, /class="history roll-feed"/, "Public rolls must have a dedicated shared visual feed");
assert.match(source, /class="roll-feed-dice"/, "The shared feed must show every die, not only aggregate successes");
assert.match(source, /pendingAllIn=\{count,diceRequest:request,scenario\};if\(!resolveDice/, "All In must become available before synchronous network rerenders can observe the first result");
assert.match(source, /if\(result\?\.pending\)applyOptimisticToolsEvents\(\[sceneEvent\]\)/, "Narrator Stress changes must use the optimistic scene reducer path");
assert.match(source, /data-gm-core-action/, "The Narrator must be able to invoke basic actions for the selected hero or enemy");
assert.match(source, /sceneContext:false/, "Narrative rolls must explicitly opt out of structured-board spatial hooks");
assert.match(source, /freeplay\.wolf\.outgunned/, "Outgunned must be an explicit narrative choice instead of reading the structured board");
assert.match(source, /refreshFreeplayResourceUi\(\).*persistAfterPaint\(\)/s, "Resource buttons must update visibly before deferred persistence");
assert.match(source, /Применить базовый Риск: \+1 Стресс, \+1 Влияние/, "Failure resolution must offer the canonical basic Risk");
assert.match(source, /hasGift\("Lone Wolf"\)&&S\.bonds\.length>=3/, "The Wolf Bond limit must be enforced in the tools");
assert.match(source, /bond\.tags\.length<bond\.rank/, "Bond rank increases must require all current tag slots");

console.log("Free-play tools QA passed: roles, requested difficulty, immediate resources, character features, Bonds, and Risks");
