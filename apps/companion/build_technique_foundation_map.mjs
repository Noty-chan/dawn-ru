import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadSceneEngine } from "./tests/load-scene-engine.mjs";
import { reviewedSourceFilesDigest } from "./reviewed-source-digest.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const context = { console, Date };
context.globalThis = context;
context.window = context;
for (const file of ["data.js", "technique-foundation-map.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(path.join(root, "technique-engine.js"), "utf8"), context);

const map = context.DAWN_TECHNIQUE_FOUNDATION_MAP;
const reviewedSourceFiles = [
  "pages-065-070-powerhouse-techniques.md",
  "pages-071-076-vagabond-techniques.md",
  "pages-077-081-bulwark-techniques.md",
  "pages-082-087-altruist-techniques.md",
  "pages-088-093-disruptor-techniques.md",
  "pages-094-099-ruiner-techniques.md",
];
const actualSourceDigest = reviewedSourceFilesDigest(reviewedSourceFiles.map(file => path.join(root, "..", "..", "source", "translation", file)));
if (actualSourceDigest !== map.REVIEWED.sourceDigest) {
  throw new Error("Текст Техник изменился после ручной сверки. Обновите REVIEWED.profiles и sourceDigest.");
}
const coverage = context.DAWN_TECHNIQUE_ENGINE.techniqueCoverage(context.DAWN_DATA);
const escapeCell = value => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const stateLabel = { ready: "готово", planned: "планируется", fallback: "ручное" };
const automationLabel = { full: "полная", decision: "с выбором", partial: "частичная", manual: "ручная" };
const reviewedCount = coverage.filter(entry => entry.foundationPlan.status === "reviewed").length;
const lines = [
  "# Карта требований автоматизации Техник",
  "",
  "> Генерируется командой `npm run map`. Не редактируйте таблицы вручную:",
  "> классификация, реестр ручной сверки и точные исключения находятся в `technique-foundation-map.js`.",
  "",
  `Покрыто Уровней: **${coverage.length}**. Ручная сверка текста завершена: **${reviewedCount}**. Непроверенные строки остаются кандидатами и не являются утверждением о полной автоматизации.`,
  "",
  `Ревизия источника ручной сверки: \`${map.REVIEWED.sourceRevision}\`.`,
  `SHA-256 проверенных файлов: \`${map.REVIEWED.sourceDigest}\`.`,
  "",
  "## Легенда возможностей",
  "",
  "| id | Назначение | Состояние | Модуль | Проверенных Уровней |",
  "| --- | --- | --- | --- | ---: |",
];

for (const [id, capability] of Object.entries(map.CAPABILITIES)) {
  const count = coverage.filter(entry => entry.foundationPlan.status === "reviewed"
    && entry.foundationPlan.capabilities.some(item => item.id === id)).length;
  lines.push(`| \`${id}\` | ${escapeCell(capability.label)} | ${stateLabel[capability.state] || capability.state} | ${capability.module ? `\`${capability.module}\`` : "—"} | ${count} |`);
}

lines.push(
  "",
  "## Как читать карту",
  "",
  "- `проверено` означает, что полный текст Уровня вручную сверен и перечисленные семейства возможностей подтверждены.",
  "- `кандидат` означает автоматическую первичную классификацию по индексу механик и тексту; её обязан проверить разработчик.",
  "- Колонка `Адаптер` показывает текущую честную степень автоматизации движка.",
  "- Проверенная разметка не повышает степень автоматизации: она описывает требования к будущему адаптеру.",
  "- Несколько возможностей у одного Уровня — нормальный случай: тонкий адаптер должен компоновать общее ядро.",
  "",
  "## Все Техники",
  "",
);

let currentArchetype = "";
let currentTechnique = "";
for (const entry of coverage) {
  if (entry.archetypeName !== currentArchetype) {
    currentArchetype = entry.archetypeName;
    currentTechnique = "";
    lines.push(`## ${escapeCell(currentArchetype)}`, "");
  }
  if (entry.techniqueName !== currentTechnique) {
    currentTechnique = entry.techniqueName;
    lines.push(
      `### ${escapeCell(currentTechnique)} (\`${entry.techniqueId}\`)`,
      "",
      "| Ур. | Название | Разметка | Адаптер | Возможности |",
      "| ---: | --- | --- | --- | --- |",
    );
  }
  const plan = entry.foundationPlan;
  const capabilities = plan.capabilities.map(item => `\`${item.id}\``).join(", ");
  const reviewLabel = plan.status === "reviewed" ? "проверено" : "кандидат";
  lines.push(`| ${entry.level} | ${escapeCell(entry.name)} | ${reviewLabel} | ${automationLabel[entry.automation] || entry.automation} | ${capabilities} |`);
  const next = coverage[coverage.indexOf(entry) + 1];
  if (!next || next.techniqueName !== currentTechnique) lines.push("");
}

lines.push(
  "## Поддержание ручной сверки",
  "",
  "При появлении или изменении Уровня откройте его полный текст в `source/translation/`, проверьте каждый тег и обновите `REVIEWED` вместе с точными дополнениями или исключениями. Не повышайте автоматизацию только на основании этой карты.",
);

const output = `${lines.join("\n")}\n`;
const target = path.join(root, "TECHNIQUE-FOUNDATION-MAP.md");
if (process.argv.includes("--check")) {
  const actual = fs.existsSync(target) ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") : "";
  if (actual !== output) {
    console.error("TECHNIQUE-FOUNDATION-MAP.md устарел. Выполните npm run map.");
    process.exitCode = 1;
  } else {
    console.log(`Technique foundation map is current: ${coverage.length} levels`);
  }
} else {
  fs.writeFileSync(target, output, "utf8");
  console.log(`Technique foundation map written: ${coverage.length} levels`);
}
