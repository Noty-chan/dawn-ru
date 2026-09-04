import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const editionRoot = path.join(root, "..", "..", "source", "editions", "dawn-en-lionwing-cb2f8e67");
const canonical = JSON.parse(fs.readFileSync(path.join(editionRoot, "extracted-companion.json"), "utf8"));
const migration = JSON.parse(fs.readFileSync(path.join(editionRoot, "automation-migration-map.json"), "utf8"));
const worklist = JSON.parse(fs.readFileSync(path.join(editionRoot, "translation-worklist.json"), "utf8"));

if (migration.editionId !== canonical.editionId) throw new Error("LionWing automation map targets the wrong edition");
const knownRuleIds = new Set([
  ...(canonical.reference || []).map(item => item.id),
  ...canonical.coreRules.rules.map(item => item.id),
  ...canonical.coreRules.actions.list.map(item => item.id),
  ...canonical.coreRules.effects.positive.map(item => item.id),
  ...canonical.coreRules.effects.negative.map(item => item.id),
  ...(canonical.coreRules.npcs?.list || []).flatMap(item => [item.id, ...item.actions.map(action => action.id), item.ace.id]),
]);
for (const entry of migration.entries) {
  if (!migration.strategies[entry.strategy]) throw new Error(`Unknown LionWing migration strategy: ${entry.strategy}`);
  for (const id of entry.ruleIds || []) if (!knownRuleIds.has(id)) throw new Error(`Unknown LionWing rule id in automation map: ${id}`);
}

const escape = value => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const digest = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const strategyLabels = {
  "parameterize-old-core": "параметризовать общее ядро",
  "extend-shared-core": "расширить общее ядро",
  "new-lionwing-foundation": "новый фундамент LionWing",
  "narrator-ruling": "ручное решение Нарратора",
  "source-review": "сначала сверить канон",
};
const grouped = migration.entries.reduce((result, item) => {
  (result[item.strategy] ||= []).push(item);
  return result;
}, {});
const techniqueActions = new Map(worklist.units.filter(item => item.domain === "technique").map(item => [item.stableId, item.action]));
const techniqueLevels = canonical.archetypes.flatMap(archetype => archetype.techniques.flatMap(technique => technique.levels.map(level => ({ archetype, technique, level }))));

const lines = [
  "# Карта переноса и будущей автоматизации LionWing",
  "",
  "> Генерируется командой `npm run lionwing:map`. Карта 0.9 не является доказательством совместимости.",
  "> Любой Уровень LionWing остается `manual-review-required`, пока для нового текста нет отдельного адаптера и evidence.",
  "",
  "## Сводка стратегий",
  "",
  "| Стратегия | Количество | Назначение |",
  "| --- | ---: | --- |",
  ...Object.entries(migration.strategies).map(([id, description]) => `| \`${id}\` | ${(grouped[id] || []).length} | ${escape(description)} |`),
  "",
  "## Нельзя закрыть простым патчем автоматики 0.9",
  "",
  "| Возможность | Состояние | Что требуется |",
  "| --- | --- | --- |",
  ...(grouped["new-lionwing-foundation"] || []).map(item => `| ${escape(item.name)} (\`${item.id}\`) | \`${item.status}\` | ${item.requires.map(escape).join("; ")} |`),
  "",
  "## Полная карта системных возможностей",
  "",
  "| ID | Возможность | Стратегия | Состояние | Страницы |",
  "| --- | --- | --- | --- | --- |",
  ...migration.entries.map(item => `| \`${item.id}\` | ${escape(item.name)} | ${strategyLabels[item.strategy]} | \`${item.status}\` | ${item.sourcePages.join("–")} |`),
  "",
  `## Карта ${techniqueLevels.length} Уровней Техник LionWing`,
  "",
  "| Архетип | Техника | Ур. | Правило | Изменение | Статус | Digest |",
  "| --- | --- | ---: | --- | --- | --- | --- |",
  ...techniqueLevels.map(({ archetype, technique, level }) => `| ${escape(archetype.name)} | ${escape(technique.name)} (\`${technique.id}\`) | ${level.n} | ${escape(level.name)} | \`${techniqueActions.get(technique.id) || "unknown"}\` | \`manual-review-required\` | \`${digest({ techniqueId: technique.id, ...level })}\` |`),
  "",
  `Всего Уровней: **${techniqueLevels.length}**. Автоматически перенесено из 0.9: **0**.`,
  "",
];

const output = lines.join("\n");
const target = path.join(root, "LIONWING-AUTOMATION-MAP.md");
if (process.argv.includes("--check")) {
  const actual = fs.existsSync(target) ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") : "";
  if (actual !== output) {
    console.error("LIONWING-AUTOMATION-MAP.md устарел. Выполните npm run lionwing:map.");
    process.exitCode = 1;
  } else console.log(`LionWing automation map is current: ${migration.entries.length} capabilities, ${techniqueLevels.length} Technique Levels`);
} else {
  fs.writeFileSync(target, output, "utf8");
  console.log(`LionWing automation map written: ${migration.entries.length} capabilities, ${techniqueLevels.length} Technique Levels`);
}
