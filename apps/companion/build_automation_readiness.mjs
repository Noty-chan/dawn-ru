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

const data = context.DAWN_DATA;
const engine = context.DAWN_SCENE_ENGINE;
const techniqueEngine = context.DAWN_TECHNIQUE_ENGINE;
const foundation = context.DAWN_TECHNIQUE_FOUNDATION_MAP;
const coverage = techniqueEngine.techniqueCoverage(data);
const capabilities = foundation.CAPABILITIES;
const escape = value => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const countBy = (rows, key) => rows.reduce((result, row) => ({ ...result, [row[key]]: Number(result[row[key]] || 0) + 1 }), {});
const percent = (value, total) => `${(value * 100 / total).toFixed(1)}%`;
const automationLabels = { full: "полная", decision: "решение", partial: "частичная", manual: "ручная", attack: "Атака", effect: "Эффект", state: "состояние", assisted: "помощь Нарратора" };

const techniqueCounts = countBy(coverage, "automation");
const executableTechniqueLevels = Number(techniqueCounts.full || 0) + Number(techniqueCounts.decision || 0);
const enemyProfiles = data.enemies.common;
const enemyRules = enemyProfiles.flatMap(profile => (profile.rules || []).map(rule => ({ profile, rule, automation: engine.enemyRuleAutomation(rule.id) })));
const enemyCounts = countBy(enemyRules, "automation");
const executableEnemyRules = enemyRules.length - Number(enemyCounts.assisted || 0);
const plannedCapabilityCounts = new Map();
for (const entry of coverage.filter(item => ["partial", "manual"].includes(item.automation))) {
  for (const capability of entry.foundationPlan.capabilities) {
    if (capabilities[capability.id]?.state !== "ready") plannedCapabilityCounts.set(capability.id, Number(plannedCapabilityCounts.get(capability.id) || 0) + 1);
  }
}

const lines = [
  "# Карта готовности автоматизации",
  "",
  "> Генерируется командой `npm run readiness`. Таблицы не редактируются вручную.",
  "> Источник истины по каждому Уровню Техники — `technique-foundation-map.js`; исполнимость врагов определяется публичным контрактом `enemyRuleAutomation`.",
  "",
  "## Сводка",
  "",
  "| Контур | Всего | Готово без ручного расчёта | Неполный путь | Что означает «готово» |",
  "| --- | ---: | ---: | ---: | --- |",
  `| Уровни Техник | ${coverage.length} | ${executableTechniqueLevels} (${percent(executableTechniqueLevels, coverage.length)}) | ${techniqueCounts.partial || 0} частичных; ${techniqueCounts.manual || 0} ручных | Полный адаптер либо типизированное решение игрока; стандартный выбор цели и бросок не считаются ручным пробелом |`,
  `| Правила обычных врагов | ${enemyRules.length} | ${executableEnemyRules} (${percent(executableEnemyRules, enemyRules.length)}) | ${enemyCounts.assisted || 0} assisted | Правило создаёт проверяемые события ядра; текстовая кнопка без исполнения считается неполной |`,
  `| Атаки врагов | ${enemyRules.filter(item => item.rule.kind === "attack").length} | ${enemyRules.filter(item => item.rule.kind === "attack" && item.automation !== "assisted").length} | 0 | Все объявленные Атаки используют исполнимый общий или специальный pipeline Реакций, урона и разрешения |`,
  "",
  "Статус описывает механическую автоматизацию, а не качество текста правила. `partial` не следует массово повышать до `full`: сначала нужен полный пользовательский путь — выбор, отмена до оплаты, повторная валидация, прерывание, журнал, сохранение и сетевое исполнение.",
  "",
  "## Готовность системных слоёв",
  "",
  "| Слой | Готовность | Уже есть | Следующий обязательный шаг | Где работать |",
  "| --- | --- | --- | --- | --- |",
  "| Событийное ядро | высокая | атомарные пачки, idempotency, preview, участники, версия Сцены | property/fuzz-проверки конфликтующих пачек и миграций старых сохранений | `scene-engine-core.js`, `scene-events.js`, `tests/scene-engine.mjs` |",
  "| Цели и геометрия | высокая | персонажи, пустые клетки, зоны, линии, стены, удалённые клетки | единый typed target для клеток/стен/местности/сущностей вместо отдельных полей | `scene-query.js`, `scene-actions.js`, `technique-engine.js` |",
  "| Реакции и prompt-цепочки | средне-высокая | очередь, контроллер, повторная валидация, отмена, optional participants | очередь нескольких одновременных prompt одного триггера и явная политика приоритета | `scene-triggers.js`, `scene-responses.js`, `scene-events.js` |",
  "| Эффекты и урон | высокая | источники, сроки, Раны, лечение, снятие по источнику | формализовать редкие замены урона и несколько конкурирующих prevent/redirect | `scene-engine-core.js`, `scene-query.js`, `scene-responses.js` |",
  "| Движение и пространства | средне-высокая | пути, displacement, топология, Внутренние миры, массовый сдвиг | общий контракт крупных/многоклеточных персонажей и движения связанных групп | `scene-movement.js`, `scene-triggers.js`, `scene-responses.js` |",
  "| Сущности и призывы | средняя | зоны, маркеры, владелец, сроки, некоторые Призывы | универсальный spawn/deploy, лист призыва, владелец управления и делегированный Ход | `scene-foundations.js`, `scene-events.js`, `scene-actions-ui.js` |",
  "| Сеть | средне-высокая | intent v2, авторитет Нарратора, локальный UI, атомарные ticks | многоклиентные гонки prompt/turn/undo и reconnect во время незавершённой цепочки | `network-v2.js`, `sync.js`, `tests/network-v2.mjs` |",
  "| Сохранения | средне-высокая | нормализация, отсечение stale lifecycle, канонические клетки | versioned migrations и corpus реальных старых экспортов | `app-core.js`, `tests/qa.mjs` |",
  "| Интерфейс и доступность | средняя | поле-first UI, подсветка, панели, мобильная база | browser E2E для выбора клеток, prompt-цепочек, клавиатуры и 320 px | `scene-ui.js`, `app-scene-events.js`, `vtt-cockpit.css` |",
  "| Наблюдаемость | низко-средняя | журнал событий и тестовые сводки | диагностический экспорт цепочки: событие → триггер → prompt → результат | новый read-only debug adapter рядом с `scene-query.js` |",
  "",
  "## Техники по архетипам",
  "",
  "| Архетип | Уровней | Полная | С решением | Частичная | Ручная |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
];

for (const archetype of [...new Set(coverage.map(entry => entry.archetypeName))]) {
  const rows = coverage.filter(entry => entry.archetypeName === archetype), counts = countBy(rows, "automation");
  lines.push(`| ${escape(archetype)} | ${rows.length} | ${counts.full || 0} | ${counts.decision || 0} | ${counts.partial || 0} | ${counts.manual || 0} |`);
}

lines.push(
  "",
  "Полная построчная карта всех 321 Уровней находится в `TECHNIQUE-FOUNDATION-MAP.md`. Ниже перечислены только самые дорогие пробелы и их реальные блокеры.",
  "",
  "### Ручные Уровни",
  "",
  "| Техника | Ур. | Правило | Чего не хватает |",
  "| --- | ---: | --- | --- |",
);

for (const entry of coverage.filter(item => item.automation === "manual")) {
  const blockers = entry.foundationPlan.capabilities.filter(item => capabilities[item.id]?.state !== "ready").map(item => `\`${item.id}\``);
  lines.push(`| ${escape(entry.techniqueName)} (\`${entry.techniqueId}\`) | ${entry.level} | ${escape(entry.name)} | ${blockers.length ? blockers.join(", ") : "тонкий адаптер уникального условия поверх уже готового ядра"} |`);
}

lines.push(
  "",
  "### Общие блокеры частичных и ручных Техник",
  "",
  "| Возможность | Затронуто Уровней | Почему это выгодная следующая инвестиция |",
  "| --- | ---: | --- |",
);
for (const [id, count] of [...plannedCapabilityCounts.entries()].sort((left, right) => right[1] - left[1])) {
  const capability = capabilities[id];
  lines.push(`| \`${id}\` · ${escape(capability?.label || id)} | ${count} | Один общий контракт сможет снять этот блокер сразу у нескольких адаптеров; модуль пока не закреплён |`);
}

lines.push(
  "",
  "## Враги",
  "",
  "`attack`, `full`, `effect` и `state` — исполнимые контракты. `assisted` означает: Нарратор видит правило и фиксирует использование, но уникальные цели, сущности, перемещения или последствия ещё обязан разыграть вручную.",
  "",
  "| Профиль | Правил | Исполнимо | Assisted | Непокрытые правила |",
  "| --- | ---: | ---: | ---: | --- |",
);
for (const profile of enemyProfiles) {
  const rows = enemyRules.filter(item => item.profile.id === profile.id), assisted = rows.filter(item => item.automation === "assisted");
  lines.push(`| ${escape(profile.name)} (\`${profile.id}\`) | ${rows.length} | ${rows.length - assisted.length} | ${assisted.length} | ${assisted.length ? assisted.map(item => escape(item.rule.name)).join("; ") : "—"} |`);
}

lines.push(
  "",
  "### Кластеры следующей автоматизации врагов",
  "",
  "1. **Призыв и подкрепления:** Джавелин, Телохранители, Матка, Обжора, Строитель, Псарь, Некромант и Рой. Сначала нужен общий `summon/deploy` контракт; иначе восемь профилей получат восемь несовместимых реализаций.",
  "2. **Местность и пространственные решения:** Бехемот, Ведьма, Слизь, Строитель, Иллюзионист, Культист и Разломщик. Следующий слой — typed target для клетки/зоны/портала и атомарный preview размещения.",
  "3. **Команды нескольким участникам:** Скакун, Координатор, Барон, Манипулятор и Мученик. Нужны очередь выборов, consent/controller и последовательная симуляция нескольких исполнителей.",
  "4. **Копирование и смена набора правил:** Доппельгангер, Капер, часть Скакуна. Нужен безопасный `action-copy` с замороженным снимком правила и сроком действия.",
  "5. **Уникальные trump-переходы:** Громила, Ловец, Гадюка, Дуэлянт, Они, Паладин, Знаменосец и Сорвиголова. Их следует брать после общих кластеров: они дают меньше повторного использования ядра.",
  "",
  "## Рекомендуемый путь развития",
  "",
  "### Этап 1 — надёжность релиза",
  "",
  "- corpus старых сохранений и миграции по `schema`;",
  "- browser E2E: пустая клетка, Внутренний мир, Тайфун, сетевой prompt и мобильные 320 px;",
  "- property-тесты атомарности: конфликт версий, повтор event id, KO между prompt и ответом, заполненное поле возврата;",
  "- диагностический экспорт одной цепочки для баг-репортов.",
  "",
  "### Этап 2 — мультипликаторы автоматизации",
  "",
  "1. `summon-turns` + `deployment-hooks`;",
  "2. `action-copy` + `transformation` + `derived-stats`;",
  "3. typed spatial targets для местности, порталов и сущностей;",
  "4. очередь нескольких решений одного триггера;",
  "5. `information-query`, Интермиссия и действия Связей.",
  "",
  "### Этап 3 — вертикальные срезы",
  "",
  "После каждого общего контракта выбирать 2–3 максимально разные Техники и 2 профиля врагов. Повышать статус только после UI, отмены, сети, сохранения и регрессионного теста. Так прогресс остаётся измеримым и не создаёт ложных `full`-меток.",
  "",
  "## Definition of Done для одного правила",
  "",
  "- буквальный текст сверен с `source/translation`;",
  "- выборы типизированы и доступны с поля;",
  "- недоступные цели объясняются до оплаты;",
  "- перед ответом выполняется повторная валидация;",
  "- отмена и прерывание не оставляют ресурсы или сущности;",
  "- события атомарны, журналируемы и идемпотентны;",
  "- сохранение/загрузка и сеть сохраняют цепочку;",
  "- есть позитивный, негативный и хотя бы один граничный тест;",
  "- статус в карте повышен только после полного пользовательского пути.",
  "",
  "## Поддержание карты",
  "",
  "После изменения `technique-foundation-map.js`, каталога врагов или адаптеров выполните `npm run readiness`. `npm test` проверяет, что эта карта не устарела.",
);

const output = `${lines.join("\n")}\n`;
const target = path.join(root, "AUTOMATION-READINESS.md");
if (process.argv.includes("--check")) {
  const actual = fs.existsSync(target) ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n") : "";
  if (actual !== output) {
    console.error("AUTOMATION-READINESS.md устарел. Выполните npm run readiness.");
    process.exitCode = 1;
  } else console.log(`Automation readiness map is current: ${coverage.length} technique levels, ${enemyRules.length} enemy rules`);
} else {
  fs.writeFileSync(target, output, "utf8");
  console.log(`Automation readiness map written: ${coverage.length} technique levels, ${enemyRules.length} enemy rules`);
}
