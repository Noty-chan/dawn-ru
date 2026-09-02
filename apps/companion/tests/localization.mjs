import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const root = new URL("../", import.meta.url);
const context = { console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of ["localization.js", "locale-ru.js", "locale-en-builder.js", "data.js", "edition-lionwing.js"]) vm.runInContext(fs.readFileSync(new URL(file, root), "utf8"), context, { filename: file });

const i18n = context.DAWN_I18N;
assert.equal(i18n.getLocale(), "ru");
assert.equal(i18n.t("scene.prompt.cancel"), "Отменить");
assert.equal(i18n.t("missing.key", { actor: "Нари" }, { fallback: "Ход: {actor}" }), "Ход: Нари");
assert.equal(i18n.field({ name: "Русское имя", i18n: { en: { name: "English name" } } }, "name"), "Русское имя");
assert.equal(i18n.setLocale("en"), true);
assert.equal(i18n.t("scene.prompt.cancel"), "Cancel");
assert.equal(i18n.t("builder.profile.title"), "Profile");
assert.equal(i18n.t("scene.error.missingActor"), "Участник не найден.", "missing English strings must fall back to Russian");
assert.equal(i18n.field({ name: "Русское имя", i18n: { en: { name: "English name" } } }, "name"), "English name");
assert.equal(i18n.eventText({ type: "rule.prompt", payload: { messageKey: "scene.prompt.cancel", messageFallback: "Отмена" } }), "Cancel");

assert.equal(context.DAWN_DATA.sourceLocale, "ru");
assert.deepEqual(Array.from(context.DAWN_DATA.availableLocales), ["ru"]);
assert.equal(context.DAWN_DATA.contentSources.ru.id, "dawn-ru-v0.9");
assert.equal(context.DAWN_DATA.contentSources.ru.status, "canonical");
assert.equal(context.DAWN_DATA.contentSources.en.id, "dawn-en-lionwing-cb2f8e67");
assert.equal(context.DAWN_DATA.contentSources.en.status, "canonical");
assert.match(context.DAWN_DATA.contentSources.en.sha256, /^[a-f0-9]{64}$/);
assert.equal(context.DAWN_DATA.contentSources["en-legacy"].status, "obsolete-reference");
assert.equal(context.DAWN_DATA.contentSources.en.supersedes, context.DAWN_DATA.contentSources["en-legacy"].id);
assert.equal(context.DAWN_LIONWING_DATA.editionId, context.DAWN_DATA.contentSources.en.id);
assert.equal(context.DAWN_LIONWING_DATA.archetypes.reduce((sum, archetype) => sum + archetype.techniques.length, 0), 111);

const engineContext = { console, structuredClone };
engineContext.window = engineContext;
engineContext.globalThis = engineContext;
vm.createContext(engineContext);
const engine = loadSceneEngine(engineContext);
const step = context.DAWN_DATA.actions.list.find(action => action.id === engine.ACTION_IDS.step);
assert.equal(engine.actionIs(step, "step"), true);
assert.equal(engine.actionByKey(context.DAWN_DATA, "spell").id, engine.ACTION_IDS.spell);

const scene = { actors: [], spaces: [], objects: [], markers: [], walls: [], log: [] };
const validated = engine.validateEvent(scene, { id: "evt-valid", type: "movement-traces.clear", actorId: null, payload: { messageKey: "scene.prompt.cancel", messageArgs: { count: 1 } } });
assert.equal(validated.id, "evt-valid");
assert.throws(() => engine.validateEvent(scene, { id: "evt-invalid", type: "movement-traces.clear", actorId: null, payload: { messageKey: "Русский ключ" } }), /ключ локализуемого сообщения/);

const html = fs.readFileSync(new URL("index.html", root), "utf8");
assert.ok(html.indexOf("localization.js") < html.indexOf("locale-ru.js"));
assert.ok(html.indexOf("locale-ru.js") < html.indexOf("data.js"));
assert.ok(html.indexOf("locale-ru.js") < html.indexOf("locale-en-builder.js"));
assert.ok(html.indexOf("locale-en-builder.js") < html.indexOf("data.js"));
assert.ok(html.indexOf("data.js") < html.indexOf("edition-lionwing.js"));
assert.ok(html.indexOf("edition-lionwing.js") < html.indexOf("app-bootstrap.js"));
assert.match(html, /data-i18n="builder\.profile\.title"/);
const serviceWorker = fs.readFileSync(new URL("sw.js", root), "utf8");
assert.match(serviceWorker, /localization\.js/);
assert.match(serviceWorker, /locale-ru\.js/);
assert.match(serviceWorker, /locale-en-builder\.js/);
assert.match(serviceWorker, /edition-lionwing\.js/);
const referenceSource = fs.readFileSync(new URL("app-reference-data.js", root), "utf8");
assert.match(referenceSource,/rule\.regeneration[\s\S]+Регенерирует \/ Регенерация[\s\S]+заканчивает свой \*\*Ход\*\*[\s\S]+максимального Здоровья[\s\S]+не снимается автоматически/,"the main reference must expose the complete Regenerating rule without relying on hover text");

const productionSources = fs.readdirSync(root)
  .filter(file => file.endsWith(".js") && !["data.js", "technique-foundation-map.js", "vtt-concepts.js"].includes(file))
  .map(file => [file, fs.readFileSync(new URL(file, root), "utf8")]);
const nameBranchPatterns = [
  /\b(?:action|movementAction|pendingAction|rollAction|option)\??\.name\s*(?:===|!==)/,
  /\.find\([^\n]*(?:action)\s*=>\s*action\.name\s*===/,
  /\[(?:"(?:Шаг|Прыжок|Стычка|Заклинание|Завершение|Блок|Уворот|Столкновение)"[,]?\s*)+\]\.includes\([^\n]*\.name\)/,
];
for (const [file, source] of productionSources) for (const pattern of nameBranchPatterns) assert.doesNotMatch(source, pattern, `${file} must branch on stable action ids, not display names`);

console.log("Localization architecture QA passed");
