import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadSceneEngine } from "./tests/load-scene-engine.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const context = { console, Date };
context.globalThis = context;
context.window = context;
for (const file of ["data.js", "technique-foundation-map.js"]) vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context);
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(path.join(root, "technique-engine.js"), "utf8"), context);

const map = context.DAWN_TECHNIQUE_FOUNDATION_MAP;
const coverage = context.DAWN_TECHNIQUE_ENGINE.techniqueCoverage(context.DAWN_DATA);
const escapeCell = value => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const stateLabel = { ready: "готово", planned: "планируется", fallback: "ручное" };
const automationLabel = { full: "полная", decision: "с выбором", partial: "частичная", manual: "ручная" };
const lines = [
  "# Карта заготовок автоматизации Техник",
  "",
  "> Генерируется командой `npm run map`. Не редактируйте таблицы вручную:",
  "> правила классификации находятся в `technique-foundation-map.js`.",
  "",
  `Покрыто Уровней: **${coverage.length}**. Начата проверенная интеграция: **${coverage.filter(entry => entry.foundationPlan.status === "started").length}**. Остальные строки — кандидаты для ручной сверки, а не утверждение о полной автоматизации.`,
  "",
  "## Легенда возможностей",
  "",
  "| id | Назначение | Состояние | Модуль | Уровней-кандидатов |",
  "| --- | --- | --- | --- | ---: |",
];

for (const [id, capability] of Object.entries(map.CAPABILITIES)) {
  const count = coverage.filter(entry => entry.foundationPlan.capabilities.some(item => item.id === id)).length;
  lines.push(`| \`${id}\` | ${escapeCell(capability.label)} | ${stateLabel[capability.state] || capability.state} | ${capability.module ? `\`${capability.module}\`` : "—"} | ${count} |`);
}

lines.push(
  "",
  "## Как читать карту",
  "",
  "- `проверено` означает, что для Уровня уже существует первый foundation-адаптер.",
  "- `кандидат` означает автоматическую первичную классификацию по индексу механик и тексту; её обязан проверить разработчик.",
  "- Колонка `Адаптер` показывает текущую честную степень автоматизации движка.",
  "- Несколько возможностей у одного Уровня — нормальный случай: тонкий адаптер должен компоновать общее ядро.",
  "",
  "## Все Техники",
  "",
);

let currentArchetype = "", currentTechnique = "";
for (const entry of coverage) {
  if (entry.archetypeName !== currentArchetype) {
    currentArchetype = entry.archetypeName;
    currentTechnique = "";
    lines.push(`## ${escapeCell(currentArchetype)}`, "");
  }
  if (entry.techniqueName !== currentTechnique) {
    currentTechnique = entry.techniqueName;
    lines.push(`### ${escapeCell(currentTechnique)} (\`${entry.techniqueId}\`)`, "", "| Ур. | Название | Разметка | Адаптер | Возможности |", "| ---: | --- | --- | --- | --- |");
  }
  const plan = entry.foundationPlan, capabilities = plan.capabilities.map(item => `\`${item.id}\``).join(", ");
  lines.push(`| ${entry.level} | ${escapeCell(entry.name)} | ${plan.status === "started" ? "проверено" : "кандидат"} | ${automationLabel[entry.automation] || entry.automation} | ${capabilities} |`);
  const next = coverage[coverage.indexOf(entry) + 1];
  if (!next || next.techniqueName !== currentTechnique) lines.push("");
}

lines.push(
  "## Обязательная ручная сверка",
  "",
  "При обработке строки откройте полный текст Уровня в `source/translation/`, проверьте каждый тег и внесите точное исключение в `REVIEWED` либо правила классификации. Не повышайте автоматизацию только на основании этой карты.",
);

const output = `${lines.join("\n")}\n`;
const target = path.join(root, "TECHNIQUE-FOUNDATION-MAP.md");
if (process.argv.includes("--check")) {
  const actual = fs.existsSync(target) ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") : "";
  if (actual !== output) {
    console.error("TECHNIQUE-FOUNDATION-MAP.md устарел. Выполните npm run map.");
    process.exitCode = 1;
  } else console.log(`Technique foundation map is current: ${coverage.length} levels`);
} else {
  fs.writeFileSync(target, output, "utf8");
  console.log(`Technique foundation map written: ${coverage.length} levels`);
}
