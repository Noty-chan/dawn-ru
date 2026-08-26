import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { loadSceneEngine } from "./tests/load-scene-engine.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(root, "../..");
const docs = path.join(repository, "docs");
const checkOnly = process.argv.includes("--check");
const sourcePath = path.join(root, "data.js");
const sourceDigest = crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
const translationDirectory = path.join(repository, "source", "translation");
const translationCorpus = fs.readdirSync(translationDirectory)
  .filter(file => /^pages-.*\.md$/.test(file))
  .map(file => fs.readFileSync(path.join(translationDirectory, file), "utf8"))
  .join("\n");
const namedEnemySource = fs.readFileSync(path.join(repository, "source", "companion", "named-enemies.md"), "utf8");

const context = { console, Date };
context.globalThis = context;
context.window = context;
for (const file of ["data.js", "technique-foundation-map.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
loadSceneEngine(context);
vm.runInNewContext(fs.readFileSync(path.join(root, "technique-engine.js"), "utf8"), context, { filename: "technique-engine.js" });

const data = context.DAWN_DATA;
const scene = context.DAWN_SCENE_ENGINE;
const techniques = context.DAWN_TECHNIQUE_ENGINE;
const foundations = context.DAWN_TECHNIQUE_FOUNDATION_MAP;
const coverage = techniques.techniqueCoverage(data);
const capabilityById = foundations.CAPABILITIES;
const sceneActionsSource = fs.readFileSync(path.join(root, "scene-actions.js"), "utf8");
const namesIndex = fs.readFileSync(path.join(repository, "source", "translation", "adapted-names-index.md"), "utf8");

const TRAIT_RULE_ENGLISH = new Map([
  ["enemy.antagonist-trait.all-seeing.defense-reaction.предсказуемо", "Predictable"],
  ["enemy.antagonist-trait.all-seeing.reaction.пронзающий-взгляд", "Piercing Vision"],
  ["enemy.antagonist-trait.all-seeing.phase-change.вы-вынудили-меня", "...You've Forced My Hand"],
  ["enemy.antagonist-trait.cruel-hearted.defense-reaction.тело-шипов", "Body Of Thorns"],
  ["enemy.antagonist-trait.cruel-hearted.turn-start.садист", "Sadist"],
  ["enemy.antagonist-trait.cruel-hearted.phase-change.вдохните-это", "Breath It In!"],
  ["enemy.antagonist-trait.god-like.defense-reaction.сломайся", "BREAK"],
  ["enemy.antagonist-trait.god-like.turn-start.узри", "BEHOLD"],
  ["enemy.antagonist-trait.god-like.phase-change.склонись-передо-мной", "BOW TO ME"],
  ["enemy.antagonist-trait.wild-eyed.defense-reaction.жестокий-перехват", "Vicious Interception"],
  ["enemy.antagonist-trait.wild-eyed.turn-start.звериный-рев", "Beastly Roar"],
  ["enemy.antagonist-trait.wild-eyed.phase-change.сокрушите-их-всех", "Crush Them All!"],
  ["enemy.antagonist-trait.iron-willed.defense-reaction.защитник", "Guardian"],
  ["enemy.antagonist-trait.iron-willed.turn-start.колючие-оскорбления", "Jabbing Insults"],
  ["enemy.antagonist-trait.iron-willed.phase-change.давите-линию", "Push The Line!"],
  ["enemy.antagonist-trait.swift-stepping.defense-reaction.уйти-в-тень", "Enter Shadow"],
  ["enemy.antagonist-trait.swift-stepping.turn-start.подчинить", "Dominate"],
  ["enemy.antagonist-trait.swift-stepping.phase-change.спи", "Go To Sleep..."],
  ["enemy.antagonist-trait.world-renowned.defense-reaction.героический-перехват", "Hero's Interception"],
  ["enemy.antagonist-trait.world-renowned.ally-turn-start.вдохновляющее-присутствие", "Inspiring Presence"],
  ["enemy.antagonist-trait.world-renowned.phase-change.ко-мне-лицом", "Face Me!"],
  ["enemy.antagonist-trait.back-stabbling.defense-reaction.почетная-жертва", "\"Honorable\" Sacrifice"],
  ["enemy.antagonist-trait.back-stabbling.turn-start.переложить-вину", "Shirk The Blame"],
  ["enemy.antagonist-trait.back-stabbling.phase-change.схватить-их", "Seize Them!"],
]);

const AUDIT_FINDINGS = new Map([
  ["powerhouse.gunslinger.1", "До повторного аудита Стычка ошибочно принимала пустые клетки, хотя канон требует персонажей; исправлено отдельной валидацией, статус остаётся partial до полного пользовательского пути."],
  ["powerhouse.braggart.3", "До повторного аудита prompt открывался от любой Раны, включая союзный/собственный источник; исправлена обязательная проверка вражеской команды. Нужны UI/network/save-load и stale/duplicate evidence."],
  ["powerhouse.breacher.1", "До повторного аудита толчок срабатывал при ненулевом уроне от Напряжения даже без Успеха; исправлено отдельным requiresSuccess и negative regression."],
  ["vagabond.assassin.1", "Заявление full понижено до partial: quickActionSources проверяет пустой журнал действий Сцены, а не первое действие после конкретного Развертывания."],
  ["vagabond.assassin.2", "Заявление decision понижено до partial: composite plan покрывает появление и отмену, но ядро принимает готовый roll и не добавляет/не валидирует [Ступень] Преимущества и крит на 5–6."],
  ["vagabond.untouchable.2", "До повторного аудита повторный Dodge предлагался при любом итоговом нуле, даже если Evasion не поглотило урон; исправлено требование `evaded > 0` и добавлен zero-damage regression."],
  ["vagabond.egomaniac.1", "До повторного аудита условие «Танец» принимало любое недавнее перемещение при текущей смежности; теперь требуется переход предыдущим действием из несмежной клетки в смежность. Добавлен отрицательный regression для adjacent→adjacent."],
  ["bulwark.giant-frame.1", "Повторная сверка выявила грамматическое рассогласование «одно из этих клеток»; источник RU исправлен на «одна из этих клеток / смежна». Механическая partial-реализация по-прежнему не связана атомарно с Завершением Телом."],
  ["bulwark.mundane.1", "До повторного аудита `[Тело / 2]` ошибочно округлялось вниз, вопреки общему правилу Always Round Up (PDF-стр. 22); исправлено на `ceil` и закреплено нечётным Body regression."],
  ["altruist.heavenly-saint.2", "До повторного аудита лечение `[Успехи / 2]` ошибочно округлялось вниз; исправлено на Always Round Up и закреплено regression с 3 Успехами → 2 лечения."],
  ["altruist.empath.2", "До повторного аудита самонанесённая Рана открывала Protective Response, хотя канон исключает source=self; добавлена проверка источника и отрицательный regression."],
  ["vagabond.knife-juggler.2", "Маркер ставится только в клетку цели; канонический выбор свободной смежной клетки отсутствует."],
  ["altruist.alchemist.2", "Урон зельем по врагу применяется обязательно, хотя канон требует опциональный выбор."],
  ["disruptor.chemist.2", "Здоровье цели читается и KO применяется автоматически вместо вопроса Нарратору."],
  ["ruiner.ego-arm.2", "Нет модели носителя, конца его Хода и множества атакованных им врагов."],
  ["ruiner.sellsword-s-call.1", "Создаётся marker, а не Призыв-actor с HP, атакой, половиной урона и Ходом."],
  ["enemy.common.cannoneer.trump.fire", "Конфигурация повторяет канонический урон три раза вместо одного броска 6(+1)D6."],
  ["enemy.common.bruiser.attack.skulduggery", "Конфигурация добавляет неканонический Stun при неполном толчке."],
  ["enemy.common.oni.attack.polaris", "В ветке Fortified отсутствует обязательный Accelerated."],
  ["enemy.common.builder.attack.violent-construction", "Прямой урон 3(+1) заменён произвольным числом из UI-запроса."],
  ["enemy.common.bodyguards.attack.behind-me", "Обязательное движение зон массовки объявлено, но не исполняется."],
  ["enemy.common.coordinator.attack.fanaticize", "Обязательная союзная follow-up ветка отсутствует."],
  ["enemy.common.swarm.attack.tear", "Отсутствует движение зон массовки; Stun накладывается автоматически вместо выбора."],
  ["enemy.common.paladin.attack.gift-from-god", "Союзник дополнительно лечится, хотя канон предписывает только Regeneration."],
  ["enemy.common.privateer.action.escort", "Исполнялась только выдача эффекта «Ускорен»; обязательное окно выбора и равное движение вслед за союзником отсутствуют."],
]);

const TRANSLATION_FINDINGS = new Map([
  ["enemy.common.viper.trump.knife-in-the-dark", "Проектный RU-текст меняет механику: вместо атаки всех игроков без смежного союзника описывает телепорт к цели атаки союзного игрока. До исправления авторитетен английский оригинал, PDF стр. 112."],
]);

const statusRu = { full: "полная", decision: "решение", partial: "частичная", manual: "ручная", attack: "атака", effect: "эффект", state: "состояние", assisted: "помощь Нарратора" };
const kindRu = { action: "Действие", attack: "Атака", trump: "Козырь", reaction: "Реакция", "defense-reaction": "Реакция защиты", "turn-start": "Начало Хода", "ally-turn-start": "Начало Хода союзника", "phase-change": "Смена фазы" };
const archetypeEn = { powerhouse: "Powerhouse", vagabond: "Vagabond", bulwark: "Bulwark", altruist: "Altruist", disruptor: "Disruptor", ruiner: "Ruiner" };
const escapeTable = value => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
const code = value => `\`${String(value ?? "").replaceAll("`", "'")}\``;
const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const normalize = value => String(value ?? "").normalize("NFKD").toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const quote = value => String(value ?? "").trim().replace(/\n{3,}/g, "\n\n");
const nameParts = name => {
  const match = String(name ?? "").match(/^(.*?)\s+\(([^()]*)\)(?:\s+(\[[^\]]+\]))?$/);
  return match ? { ru: match[1], en: match[2], suffix: match[3] || "" } : { ru: String(name ?? ""), en: "", suffix: "" };
};
const compactRule = rule => {
  const omit = new Set(["id", "techniqueId", "level", "name", "automation", "note"]);
  const fields = Object.fromEntries(Object.entries(rule).filter(([key, value]) => !omit.has(key) && value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && !value.length)));
  const data = Object.keys(fields).length ? JSON.stringify(fields) : "без дополнительных полей";
  return `${code(rule.id)} · ${code(rule.kind)} · ${data}${rule.note ? `; ${rule.note}` : ""}`;
};
const lineNumbersFor = id => sceneActionsSource.split(/\r?\n/).flatMap((line, index) => line.includes(`\"${id}\"`) ? [index + 1] : []);
const enemyAdapterRefs = id => {
  const lines = lineNumbersFor(id);
  if (!lines.length) return "в реестрах `scene-actions.js` нет записи";
  return lines.map(line => code(`scene-actions.js:${line}`)).join(", ");
};
const profileRules = profile => (profile.rules || []).map(rule => ({ profile, rule, automation: scene.enemyRuleAutomation(rule.id) }));
const enemyProfiles = [...data.enemies.common, ...data.enemies.modifiers, ...data.enemies.named, ...data.enemies.antagonistTraits];

const titleRows = [...namesIndex.matchAll(/^\|\s*(.*?)\s*\|\s*(.*?)\s*\|/gm)].map(match => ({ en: match[1], ru: match[2] }));
const titleIndex = new Map();
for (const row of titleRows) {
  const key = normalize(row.en);
  if (!titleIndex.has(key)) titleIndex.set(key, new Set());
  titleIndex.get(key).add(normalize(row.ru));
}
const titleMatchesIndex = (en, ru) => Boolean(titleIndex.get(normalize(en))?.has(normalize(ru)));
const titleMatchesTranslationSource = (en, ru) => translationCorpus.includes(`${ru} (${en})`);
const titleMatchesCanonicalSource = (en, ru) => titleMatchesIndex(en, ru) || titleMatchesTranslationSource(en, ru);
const titleMatchesProjectNamedSource = (en, ru) => namedEnemySource.includes(`${ru} (${en})`);

const techniqueRows = data.archetypes.flatMap(archetype => archetype.techniques.flatMap(technique => technique.levels.map(level => ({ archetype, technique, level, identity: `${technique.id}.${level.n}` }))));
const techniqueTranslationIssues = techniqueRows.filter(item => {
  const name = nameParts(item.level.name);
  return !name.en || !titleMatchesCanonicalSource(name.en, name.ru);
});
const techniqueIndexOmissions = techniqueRows.filter(item => {
  const name = nameParts(item.level.name);
  return name.en && !titleMatchesIndex(name.en, name.ru) && titleMatchesTranslationSource(name.en, name.ru);
});
const explicitEnemyRows = [...data.enemies.common, ...data.enemies.named].flatMap(profileRules).filter(item => item.rule.en);
const enemyTranslationIssues = explicitEnemyRows.filter(item => !titleMatchesCanonicalSource(item.rule.en, item.rule.name) && !titleMatchesProjectNamedSource(item.rule.en, item.rule.name));
const enemyIndexOmissions = explicitEnemyRows.filter(item => !titleMatchesIndex(item.rule.en, item.rule.name) && titleMatchesTranslationSource(item.rule.en, item.rule.name));
const namedEnemyPairs = explicitEnemyRows.filter(item => titleMatchesProjectNamedSource(item.rule.en, item.rule.name) && !titleMatchesCanonicalSource(item.rule.en, item.rule.name));
const traitRows = data.enemies.antagonistTraits.flatMap(profileRules);
const traitTranslationIssues = traitRows.filter(item => !TRAIT_RULE_ENGLISH.has(item.rule.id));

if (techniqueRows.length !== 321) throw new Error(`Expected 321 Technique levels, got ${techniqueRows.length}`);
if (data.enemies.common.length !== 41 || data.enemies.common.flatMap(profileRules).length !== 122) throw new Error("Common-enemy catalog is incomplete");
if (data.enemies.named.length !== 3 || data.enemies.named.flatMap(profileRules).length !== 5) throw new Error("Named-enemy catalog is incomplete");
if (data.enemies.antagonistTraits.length !== 8 || traitRows.length !== 24) throw new Error("Antagonist-edge catalog is incomplete");
if (techniqueTranslationIssues.length || enemyTranslationIssues.length || traitTranslationIssues.length) {
  throw new Error(`Unverified translations: techniques=${techniqueTranslationIssues.length}, enemies=${enemyTranslationIssues.length}, traits=${traitTranslationIssues.length}`);
}

const header = title => [
  `# ${title}`,
  "",
  `> Сгенерировано ${code("npm run docs:rules")} из канонического ${code("apps/companion/data.js")} (SHA-256 ${code(sourceDigest)}).`,
  `> Русский текст - канонический перевод из ${code("source/translation/")}; локальные профили Леона взяты из ${code("source/companion/named-enemies.md")}. Английские названия сверяются с ${code("source/translation/adapted-names-index.md")} и, для Черточек Антагониста, с ${code("source/original/Dawn - A Diceless Fantasy TTRPG.pdf")}.`,
  "",
].join("\n");

function techniqueCatalog() {
  const lines = [header("DAWN: каталог Техник RU/EN"),
    "## Как читать каталог",
    "",
    "Каждая строка уровня содержит официальное русское и английское название. Блок **RU — канон** воспроизводит полный канонический русский текст. Английская механическая проза намеренно не пересказывается генератором: её авторитетный источник — английский PDF; так документ не выдаёт новый перевод за оригинал.",
    "",
    "## Базовые термины и механики", "",
    "| Русский | English | Базовый смысл |",
    "| --- | --- | --- |",
    "| Ступень | Tier | Масштаб героя/врага; формулы вида `[Ступень]` подставляют её значение. |",
    "| Тело / Дух / Талант / Разум | Body / Spirit / Talent / Mind | Четыре Атрибута для бросков, урона и формул Техник. |",
    "| ОД | Action Points (AP) | Ресурс действий структурированного боя. |",
    "| Фокус | Focus | Расходуемый ресурс многих Техник и Завершений. |",
    "| Напряжение | Tension | Общий счётчик боя; участвует в формулах и требованиях. |",
    "| Ход / Раунд / Сцена | Turn / Round / Scene | Временные границы: один персонаж, полный цикл участников, всё столкновение. |",
    "| Быстро / без Стоимости | Swift / at no cost | Быстрое действие не расходует обычный темп; `без Стоимости` обнуляет указанную цену, но не отменяет другие требования. |",
    "| Стычка / Заклинание / Завершение | Skirmish / Cast / Finisher | Основные боевые действия; уточнение Атрибута после Завершения задаёт его вариант. |",
    "| Прыжок / Передышка / Зарядка / Развертывание | Step / Breathe / Charge / Deploy | Базовые действия движения, восстановления, подготовки и начала позиции. |",
    "| Клетка / дальность / смежный / зона / линия | space / range / adjacent / area / line | Геометрия поля; смежность - расстояние 1, а зона и линия задают множество клеток. |",
    "| Цель / пустая клетка | target / empty space | Персонаж и клетка - разные типы цели; правило явно задаёт допустимый тип. |",
    "| Успех / Критический успех | Hit / Critical Hit | Результаты XD6; правила могут использовать их число, крит или бросок целиком. |",
    "| Преимущество / Помеха | Advantage / Disadvantage | Модификаторы броска, обычно добавляющие либо ухудшающие кости/результат по базовым правилам. |",
    "| Эффект / Рана / Здоровье | Effect / Wound / Health | Временные состояния, серьёзные повреждения и текущий ресурс живучести. |",
    "| Реакция / отмена | Reaction / cancellation | Окно ответа на событие и безопасное прекращение незавершённой цепочки до оплаты/применения. |",
    "| Маркер / зона / местность / Призыв | marker / area / terrain / Summon | Сущности поля: долговременная точка, множество клеток, объект поля и отдельный участник боя. |",
    "",
    "## Сверка перевода", "",
    `- Уровни Техник: ${techniqueRows.length - techniqueTranslationIssues.length}/${techniqueRows.length} пар подтверждены либо адаптационным индексом, либо каноническим Markdown-источником.`,
    `- Для Берсерка авторитетен полный блок Техник в английском PDF на стр. 67; пояснительный пример на стр. 65 содержит старую редакцию второго уровня.`,
    `- Индекс не содержит ${techniqueIndexOmissions.length} уже подтверждённых пар: ${techniqueIndexOmissions.length ? techniqueIndexOmissions.map(item => code(item.identity)).join(", ") : "нет"}. Это пробел индекса, а не расхождение перевода.`,
    `- Неподтверждённые пары: ${techniqueTranslationIssues.length ? techniqueTranslationIssues.map(item => code(item.identity)).join(", ") : "нет"}.`,
    "- Числа, формулы, имена эффектов и русский текст берутся из того же `data.js`, который строится из `source/translation/`; это проверка консистентности репозитория, а не независимая лингвистическая экспертиза каждого предложения.",
    "",
  ];
  for (const archetype of data.archetypes) {
    lines.push(`## ${archetype.name} (${archetypeEn[archetype.id] || archetype.id})`, "");
    for (const technique of archetype.techniques) {
      lines.push(`### ${technique.name} (${technique.en}) ${code(technique.id)}`, "", `**Сложность:** ${"★".repeat(Number(technique.stars || 0)) || "—"}. **Теги:** ${technique.tags || "—"}.`, "");
      if (technique.flavor) lines.push(`_${quote(technique.flavor)}_`, "");
      for (const level of technique.levels) {
        const name = nameParts(level.name);
        lines.push(`#### ${level.n}. ${name.ru} (${name.en})${name.suffix ? ` ${name.suffix}` : ""} ${code(`${technique.id}.${level.n}`)}`, "", `**RU — канон.** ${quote(level.text)}`, "");
      }
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

function techniqueSpec() {
  const ready = Object.entries(capabilityById).filter(([, item]) => item.state === "ready");
  const needed = Object.entries(capabilityById).filter(([, item]) => item.state !== "ready");
  const byId = new Map(coverage.map(item => [item.id, item]));
  const lines = [header("DAWN: кодовая спецификация Техник"),
    "## Границы этого документа", "",
    "Это спецификация текущего кода, а не новый канон. `full`, `decision` и `partial` описывают заявленную привязку к движку; только evidence определяет доказанный уровень. Для канонического текста и двуязычных названий используйте `TECHNIQUES-RU-EN-CATALOG.md`.", "",
    "## Общий контракт выполнения", "",
    "`data.js` → `technique-engine.js:RULES` (если правило зарегистрировано) → `scene-engine` (валидация, events, prompt, реакции, урон, эффект, движение) → UI/intent. Отсутствие строки в `RULES` означает, что UI может показать текст и foundation-plan, но механика не вызывается: статус должен быть `manual`.", "",
    "## Уже работающие семейства", "",
    "| Семейство | Модуль(и) | Контракт |",
    "| --- | --- | --- |",
    ...ready.map(([id, item]) => `| ${code(id)} · ${escapeTable(item.label)} | ${code(item.module || "несколько модулей")} | Готовая общая возможность; отдельный уровень всё равно должен явно зарегистрировать адаптер. |`),
    "",
    "## Требуемые / незавершённые семейства", "",
    "| Семейство | Состояние | Что должен дать будущий контракт |",
    "| --- | --- | --- |",
    ...needed.map(([id, item]) => `| ${code(id)} · ${escapeTable(item.label)} | ${item.state} | Общий typed контракт вместо ручного решения; текущая карта перечисляет зависимость, но не реализует уровень сама. |`),
    "",
    "## Формат уровня", "",
    "- **Текущий адаптер** — только реальные записи `RULES`, без вывода из текста или карты.",
    "- **Готовые foundations** — инфраструктура, которую может переиспользовать адаптер.",
    "- **Нужно добавить** — ближайший кодовый контракт; для статуса `manual` это как минимум регистрация собственного trigger/validator/resolver.",
    "",
  ];
  for (const archetype of data.archetypes) {
    lines.push(`## ${archetype.name} (${archetypeEn[archetype.id] || archetype.id})`, "");
    for (const technique of archetype.techniques) {
      lines.push(`### ${technique.name} (${technique.en}) ${code(technique.id)}`, "");
      for (const level of technique.levels) {
        const id = `${technique.id}.${level.n}`;
        const entry = byId.get(id);
        const title = nameParts(level.name);
        const readyCapabilities = entry.foundationPlan.capabilities.filter(item => capabilityById[item.id]?.state === "ready").map(item => code(item.id));
        const blockedCapabilities = entry.foundationPlan.capabilities.filter(item => capabilityById[item.id]?.state !== "ready").map(item => code(item.id));
        const adapter = entry.rules.length ? entry.rules.map(compactRule).join("<br>") : "нет записи в `RULES`";
        const extension = AUDIT_FINDINGS.get(id) || (entry.automation === "manual" ? (blockedCapabilities.length ? `Зарегистрировать отдельный адаптер и закрыть зависимости: ${blockedCapabilities.join(", ")}.` : "Зарегистрировать отдельный adapter (trigger → validation → events/resolver) и прямые тесты; общая инфраструктура сама правило не исполняет.") : blockedCapabilities.length ? `Сохранить существующий adapter и добавить недостающий контракт: ${blockedCapabilities.join(", ")}.` : "Для кода явный следующий шаг не выведен автоматически; нужны direct pos/neg/boundary тесты и evidence до повышения доверия.");
        lines.push(`#### ${level.n}. ${title.ru} (${title.en}) ${code(id)}`, "", `- **Заявленный статус:** ${code(entry.automation)} (${statusRu[entry.automation]}).`, `- **Текущий адаптер:** ${adapter}.`, `- **Готовые foundations:** ${readyCapabilities.length ? readyCapabilities.join(", ") : "нет"}.`, `- **Нужно добавить:** ${extension}`, "");
      }
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

function enemyCatalog() {
  const lines = [header("DAWN: каталог способностей врагов RU/EN"),
    "## Область каталога", "",
    `Включены ${data.enemies.common.length} обычный тип врага, ${data.enemies.modifiers.length} врагов-модификаторов, ${data.enemies.named.length} именованных профиля и ${data.enemies.antagonistTraits.length} Черточек Антагониста. Всего активируемых правил: ${enemyProfiles.flatMap(profileRules).length}; из них 122 принадлежат обычным врагам, 5 — именованным, 24 — Черточкам Антагониста.`, "",
    "## Базовые термины врагов", "",
    "| Русский | English | Базовый смысл |",
    "| --- | --- | --- |",
    "| Обычный враг | common enemy | Профиль противника со статами, пассивом и правилами; формулы масштабируются по Ступени. |",
    "| Враг-модификатор | enemy modifier | Дополнение к профилю/боевой сцене; в текущих данных не содержит отдельных `rules`. |",
    "| Именованный враг | named enemy | Конкретный профиль с собственными правилами и иногда призывами. |",
    "| Черта Антагониста | Antagonist Edge | Набор реакций/триггеров для важного врага; лимитируется Антагонизмом по базовым правилам. |",
    "| Действие / Атака / Козырь | Action / Attack / Trump | Тип активации; Козырь дополнительно требует порог Напряжения и обычно стоит 2 ОД. |",
    "| Награда | Reward | Последствие успешной атаки после броска и реакций. |",
    "| `X(+Y)` | tier formula | Значение X на Ступени 1, плюс Y за каждую следующую Ступень. |",
    "| Развертывание | Deploy | Появление профиля на поле; может включать пассивный стартовый эффект. |",
    "| Массовка | crowd | Группа токенов, не равная отдельному actor; требует особого group-movement контракта. |",
    "",
    "## Сверка перевода", "",
    `- Обычные и именованные активируемые правила с явным EN: ${explicitEnemyRows.length - enemyTranslationIssues.length}/${explicitEnemyRows.length} пар подтверждены индексом, каноническим Markdown или локальным источником именованных врагов.`,
    `- Индекс не содержит ${enemyIndexOmissions.length} уже подтверждённых пар: ${enemyIndexOmissions.length ? enemyIndexOmissions.map(item => code(item.rule.id)).join(", ") : "нет"}.`,
    `- Локальные (не из английского PDF) пары Леона подтверждены ${code("source/companion/named-enemies.md")}: ${namedEnemyPairs.length ? namedEnemyPairs.map(item => code(item.rule.id)).join(", ") : "нет"}.`,
    `- Черты Антагониста: ${traitRows.length - traitTranslationIssues.length}/${traitRows.length} английских названий извлечены из оригинального PDF (стр. 106–107).`,
    `- Непроверенные пары: ${[...enemyTranslationIssues, ...traitTranslationIssues].length ? [...enemyTranslationIssues.map(item => code(item.rule.id)), ...traitTranslationIssues.map(item => code(item.rule.id))].join(", ") : "нет"}.`,
    `- Подтверждённые смысловые расхождения RU/EN: ${TRANSLATION_FINDINGS.size}; ${[...TRANSLATION_FINDINGS.keys()].map(code).join(", ")}. Проверка пар названий сама по себе этого не выявляет.`,
    "",
  ];
  const groups = [["Обычные враги", data.enemies.common], ["Враги-модификаторы", data.enemies.modifiers], ["Именованные враги", data.enemies.named], ["Черты Антагониста", data.enemies.antagonistTraits]];
  for (const [groupName, profiles] of groups) {
    lines.push(`## ${groupName}`, "");
    for (const profile of profiles) {
      lines.push(`### ${profile.name} (${profile.en || "English name not surfaced"}) ${code(profile.id)}`, "", `**Теги:** ${profile.tags || "—"}. **Параметры:** ${profile.statsRaw || "—"}.`, "");
      if (profile.examples) lines.push(`**Примеры:** ${profile.examples}`, "");
      if (profile.passive) lines.push(`**Пассив / Passive:** ${quote(profile.passive)}`, "");
      if (!profile.rules?.length) {
        lines.push(`**Описание / Description:** ${quote(profile.text || "Отдельных активируемых правил нет.")}`, "");
        continue;
      }
      for (const rule of profile.rules) {
        const en = rule.en || TRAIT_RULE_ENGLISH.get(rule.id) || "English label not surfaced";
        const meta = [`${kindRu[rule.kind] || rule.kind}`, `${rule.apCost || 0} ОД`];
        if (rule.tension) meta.push(`Н${rule.tension}`);
        if (rule.dice) meta.push(`${rule.dice}D6`);
        if (rule.directDamage) meta.push(`${rule.directDamage} direct damage`);
        lines.push(`#### ${rule.name} (${en}) ${code(rule.id)}`, "", `**Тип / type:** ${meta.join(" · ")}.`, "", `**RU — канон.** ${quote(rule.text)}`, "");
        if (rule.reward) lines.push(`**Награда / reward.** ${quote(rule.reward)}`, "");
        if (TRANSLATION_FINDINGS.has(rule.id)) lines.push(`**Расхождение с EN-каноном.** ${TRANSLATION_FINDINGS.get(rule.id)}`, "");
      }
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

function targetContract(rule) {
  const target = [];
  if (rule.requiresTarget) target.push(`targetIds: 1..${rule.maxTargets || 1}`);
  else target.push("targetIds: 0");
  if (rule.adjacent) target.push("adjacent");
  if (rule.range) target.push(`range≤${rule.range}`);
  if (rule.area?.length) target.push(`area:${rule.area.join("×")}${rule.areaAnchor ? `@${rule.areaAnchor}` : ""}`);
  if (rule.maxTargets && !rule.requiresTarget) target.push(`maxTargets:${rule.maxTargets}`);
  return target.join(", ");
}

function enemySpec() {
  const lines = [header("DAWN: кодовая спецификация способностей врагов"),
    "## Границы и правило честности", "",
    "Код не интерпретирует прозу врага на лету. Он использует типизированные реестры `scene-actions.js`; всё, что не вошло в них целиком, имеет статус `assisted` и остаётся решением Нарратора. Для канона смотрите `ENEMIES-RU-EN-CATALOG.md`.", "",
    "## Работающие семейства", "",
    "| Семейство | Вход → результат | Реестр / модуль |",
    "| --- | --- | --- |",
    "| Обычная автоматическая атака | `prepareEnemyRule` валидирует actor/AP/цели/roll → `attack.pending` → реакции → damage/effects/reward | `ENEMY_AUTO_ATTACK_RULES`, `scene-actions.js` |",
    "| Семейная атака | Базовая атака дополняется явной конфигурацией range/area/effects/push/teleport/target cap | `ENEMY_ATTACK_FAMILY_RULES` |",
    "| Эффектное правило | Валидирует цель и публикует typed effect/state event без броска атаки | `ENEMY_AUTO_EFFECT_RULES` |",
    "| Специальное полное правило | Диспетчер выбирает named resolver: state, delayed prompt, heal, turn grant, summon | `ENEMY_FULL_RULES`, `prepareEnemyRule`, `respondRulePrompt` |",
    "| Общие гарантии | event versioning, cancellation before payment, target revalidation, реакции, журнал, persistence normalization | `scene-engine-core.js`, `scene-events.js`, `scene-responses.js` |",
    "",
    "## Нужные семейства", "",
    "| Семейство | Почему нужно |",
    "| --- | --- |",
    "| Typed crowd movement | Нужен для всех последствий, которые сдвигают зоны массовки атомарно и без наложений. |",
    "| Полноценные summons | Нужны HP, профиль, controller, половина урона и делегированный Ход, а не marker. |",
    "| Связанные delayed/chained actions | Нужны для follow-up союзника, отложенных path и реакций Черточек Антагониста. |",
    "| Formula-only direct damage | Нужен для правил, где UI не должен передавать произвольное число урона. |",
    "| Нарраторский information query | Нужен, когда канон запрашивает скрытую информацию, а не разрешает прочитать state напрямую. |",
    "",
    "## Формат каждого правила", "",
    "`request = { actorId, ruleId, targetIds, anchor, roll, options }`; затем `prepareEnemyRule` обязан валидировать живого владельца, AP/Напряжение, тип и геометрию цели. Атаки создают pending-цепочку, эффекты — typed events, специальные правила вызывают named resolver. Статус `assisted` запрещает считать частичную конфигурацию заменой канонической ветки.", "",
  ];
  const groups = [["Обычные враги", data.enemies.common], ["Враги-модификаторы", data.enemies.modifiers], ["Именованные враги", data.enemies.named], ["Черты Антагониста", data.enemies.antagonistTraits]];
  for (const [groupName, profiles] of groups) {
    lines.push(`## ${groupName}`, "");
    for (const profile of profiles) {
      lines.push(`### ${profile.name} (${profile.en || "English name not surfaced"}) ${code(profile.id)}`, "");
      if (!profile.rules?.length) {
        lines.push("- **Текущий адаптер:** нет отдельных активируемых правил; modifier применяется Нарратором/профилем вручную.", "- **Нужно добавить:** typed modifier contract только если модификатор должен сам вызывать события на поле.", "");
        continue;
      }
      for (const rule of profile.rules) {
        const automation = scene.enemyRuleAutomation(rule.id);
        const finding = AUDIT_FINDINGS.get(rule.id);
        const current = automation === "assisted" ? (lineNumbersFor(rule.id).length ? `частичная конфигурация есть в ${enemyAdapterRefs(rule.id)}, но исполнимого статуса нет` : "нет зарегистрированного исполняемого адаптера") : `статус ${code(automation)}; реестр: ${enemyAdapterRefs(rule.id)}`;
        const addition = finding || (automation === "assisted" ? `Добавить named resolver/семейную конфигурацию, которая целиком покрывает trigger, выбор, effect/reward и срок. Базовая форма входа: ${code(targetContract(rule))}.` : "Кодовый пробел не выведен из статуса; нужны прямые pos/neg/boundary тесты и evidence для UI/сети/save-load.");
        const config = { kind: rule.kind, apCost: rule.apCost, tension: rule.tension, dice: rule.dice || undefined, directDamage: rule.directDamage || undefined, tensionMultiplier: rule.tensionMultiplier || undefined, target: targetContract(rule), targetEffects: rule.targetEffects?.length ? rule.targetEffects : undefined, selfEffects: rule.selfEffects?.length ? rule.selfEffects : undefined };
        Object.keys(config).forEach(key => config[key] === undefined && delete config[key]);
        lines.push(`#### ${rule.name} ${code(rule.id)}`, "", `- **Заявленный кодовый статус:** ${code(automation)} (${statusRu[automation]}).`, `- **Входная конфигурация:** ${code(JSON.stringify(config))}.`, `- **Текущий адаптер:** ${current}.`, `- **Нужно добавить / проверить:** ${addition}`, "");
      }
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

const artifacts = new Map([
  [path.join(docs, "TECHNIQUES-RU-EN-CATALOG.md"), techniqueCatalog()],
  [path.join(docs, "TECHNIQUES-IMPLEMENTATION-SPEC.md"), techniqueSpec()],
  [path.join(docs, "ENEMIES-RU-EN-CATALOG.md"), enemyCatalog()],
  [path.join(docs, "ENEMIES-IMPLEMENTATION-SPEC.md"), enemySpec()],
]);

let changed = 0;
for (const [file, content] of artifacts) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (current !== content) {
    changed += 1;
    if (!checkOnly) fs.writeFileSync(file, content, "utf8");
  }
}
if (checkOnly && changed) throw new Error(`${changed} reference document(s) are stale; run npm run docs:rules`);
console.log(`Rule reference documents ${checkOnly ? "are current" : "written"}: ${artifacts.size}; technique title issues: ${techniqueTranslationIssues.length}; enemy title issues: ${enemyTranslationIssues.length}; trait title issues: ${traitTranslationIssues.length}`);
