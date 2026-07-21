"use strict";

(function dawnVttConcepts() {
  const ENGINE = window.DAWN_TECHNIQUE_ENGINE;
  const DATA = window.DAWN_DATA;
  const LOGIC = window.DAWN_LOGIC;
  const SCENE = window.DAWN_SCENE_ENGINE;
  const root = document.querySelector("#concept-root");
  const surfaceRoot = document.querySelector("#surface-root");
  const toastNode = document.querySelector("#toast");
  const roleSelect = document.querySelector("#role-select");

  const REFERENCES = [
    { title: "Зона", tags: "поле область техника", text: "Прямоугольная область клеток. Её можно поворачивать; все подходящие участники внутри становятся кандидатами в цели." },
    { title: "Газ", tags: "эффект область сублимация", text: "Типизированная область, которая сохраняет источник и срок. Конкретное правило определяет последствия входа и нахождения внутри." },
    { title: "Исчез", tags: "эффект исчезнуть цель", text: "Участник временно покидает обычное пространство Сцены. Стол хранит источник, окно возвращения и доступность выбора целью." },
    { title: "Внутренний мир", tags: "пространство домен перенос", text: "Отдельное пространство той же Сцены. Перенесённые участники сохраняют состояние и могут вернуться по условию Техники." },
    { title: "Напряжение", tags: "ресурс козырь раунд", text: "Общее значение боя. Растёт по правилам Сцены и открывает зависящие от него Техники и Козыри врагов." },
  ];

  function initialScene() {
    return {
      version: 0,
      round: 2,
      tension: 2,
      activeSpace: "main",
      spaces: [{ id: "main", name: "Крыши Астры", width: 7, height: 7 }],
      actors: [
        {
          id: "hero-eta", name: "Эта", short: "ЭТ", team: "hero", space: "main", x: 2, y: 4,
          ownerId: "viewer-player", hp: 11, maxHp: 12, armor: 1, evasion: 3, speed: 4, ap: 3, focus: 5,
          acted: false, effects: ["Собранность"],
          techniques: { "ruiner.bombardier": 3, "disruptor.chemist": 1, "disruptor.inner-world": 2 },
          attrs: { body: 3, talent: 4, spirit: 4, mind: 2 },
          skills: [{ id: "acrobatics", name: "Акробатика крыш", rank: 2 }, { id: "occult", name: "Оккультная теория", rank: 3 }],
          ability: { name: "Нарушить пространство", rank: 2 },
          bio: "Бывшая исследовательница разломов, которая научилась входить в невозможные углы раньше, чем они успевают исчезнуть.",
          notes: "Долг Багровому рынку. Не доверяет проводникам Астры.",
          note: "Разрушитель · контроль пространства и взрывные Зоны.",
        },
        {
          id: "hero-rin", name: "Рин", short: "РИ", team: "hero", space: "main", x: 1, y: 5,
          ownerId: "another-player", hp: 9, maxHp: 10, armor: 0, evasion: 4, speed: 5, ap: 3, focus: 3,
          acted: true, effects: ["Ускорение"], note: "Союзник · уже действовал в этом Раунде.",
        },
        {
          id: "enemy-assassin", name: "Ассасин", short: "АС", team: "enemy", space: "main", x: 4, y: 3,
          hp: 13, maxHp: 13, armor: 0, evasion: 4, speed: 5, ap: 2, focus: 0,
          acted: false, effects: ["Метка"], passive: "Тень клинка: после промаха может сменить край поля.",
          actions: ["Разделать · смежная цель · 5D6", "Уйти в тень · Реакция защиты"], trump: "Нож во тьме · Н3", note: "Уклонение 4 · Козырь доступен при Напряжении 3.",
        },
        {
          id: "enemy-brute", name: "Громила", short: "ГР", team: "enemy", space: "main", x: 5, y: 3,
          hp: 18, maxHp: 18, armor: 3, evasion: 0, speed: 3, ap: 2, focus: 0,
          acted: false, effects: [], passive: "Неподвижная масса: смежные клетки считаются трудной местностью.",
          actions: ["Молотить · смежная цель · 6D6", "Отбросить · движение цели"], trump: "Буйство · Н2", note: "Броня 3 · удерживает проход между крышами.",
        },
      ],
      objects: [],
      markers: [],
      targetIds: ["enemy-assassin"],
      rollFeed: [],
      log: [],
    };
  }

  const state = {
    role: "player",
    viewerId: "viewer-player",
    scene: initialScene(),
    selectedId: "enemy-assassin",
    pendingRule: null,
    pendingAction: null,
    preview: null,
    surface: null,
    sheetSection: "main",
    diceResult: "—",
    rollConfig: { attribute: "spirit", feature: "occult", advantage: 0, hindrance: 0 },
    clock: 2,
    history: [],
    zoom: 1,
  };

  let toastTimer;
  let drag = null;
  let suppressClick = false;
  let hoveredPreviewCell = null;

  const clone = value => JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const actorById = id => state.scene.actors.find(actor => actor.id === id);
  const activeHero = () => actorById("hero-eta");
  const activeSpace = () => state.scene.spaces.find(space => space.id === state.scene.activeSpace) || state.scene.spaces[0];
  const selectedActor = () => actorById(state.selectedId) || activeHero();
  const ownedHero = () => state.scene.actors.find(actor => actor.team === "hero" && actor.ownerId === state.viewerId) || activeHero();
  const currentRule = () => ENGINE?.RULES?.find(rule => rule.id === state.pendingRule) || null;
  const healthPercent = actor => Math.max(0, Math.min(100, Math.round((actor.hp / actor.maxHp) * 100)));
  const coordName = (x, y) => `${String.fromCharCode(65 + x)}${y + 1}`;

  function toast(message) {
    window.clearTimeout(toastTimer);
    toastNode.textContent = message;
    toastNode.classList.add("show");
    toastTimer = window.setTimeout(() => toastNode.classList.remove("show"), 2300);
  }

  function sceneStrip() {
    const spaces = state.scene.spaces.map(space => `
      <button type="button" class="${space.id === state.scene.activeSpace ? "on" : ""}" data-space="${escapeHtml(space.id)}">${escapeHtml(space.name)}</button>
    `).join("");
    return `
      <header class="scene-strip">
        <div class="scene-title"><small>Структурированный бой</small><strong>Крыши над Багровым рынком</strong></div>
        <div class="space-tabs" aria-label="Пространства Сцены">${spaces}</div>
        <div class="scene-meta">
          <span class="resource-chip">Раунд <b>${state.scene.round}</b></span>
          <span class="resource-chip">Напряжение <b>${state.scene.tension}</b></span>
          <span class="status-chip"><i class="status-dot"></i><b>4</b> в сети</span>
          <button type="button" class="quiet" data-open-surface="sheet" aria-label="Открыть лист и меню">Лист</button>
        </div>
      </header>
    `;
  }

  function renderBoard() {
    const space = activeSpace();
    const actors = state.scene.actors.filter(actor => actor.space === space.id);
    const previewCells = new Set(state.preview?.affectedCells || []);
    const previewTargets = new Set(state.preview?.affectedActorIds || []);
    const permanentTargets = new Set(state.scene.targetIds || []);
    const objects = (state.scene.objects || []).filter(object => object.space === space.id);
    const cells = [];

    for (let y = 0; y < space.height; y += 1) {
      for (let x = 0; x < space.width; x += 1) {
        const key = `${x},${y}`;
        const cellActors = actors.filter(actor => actor.x === x && actor.y === y);
        const area = objects.find(object => object.cells?.includes(key));
        const cellClasses = ["board-cell"];
        if (area) cellClasses.push(area.areaType === "attack" ? "has-attack" : "has-area");
        if (previewCells.has(key)) cellClasses.push("preview-cell");
        if (state.pendingRule || state.pendingAction) cellClasses.push("action-ready");
        cells.push(`
          <div class="${cellClasses.join(" ")}" role="gridcell" tabindex="${state.pendingRule || state.pendingAction ? "0" : "-1"}" data-cell data-x="${x}" data-y="${y}" aria-label="Клетка ${coordName(x, y)}">
            <span class="coord">${coordName(x, y)}</span>
            ${cellActors.map(actor => renderToken(actor, previewTargets.has(actor.id) || permanentTargets.has(actor.id))).join("")}
          </div>
        `);
      }
    }

    const instruction = state.pendingRule || state.pendingAction
      ? `<div class="board-instruction">${state.pendingAction ? `Выберите клетку для «${escapeHtml(state.pendingAction.name)}»` : currentRule()?.kind === "space" ? "Проверьте перенос выбранной цели" : `Выберите клетку для «${escapeHtml(currentRule()?.name || "Техники") }»`}</div>`
      : "";
    const lastRoll = state.scene.rollFeed?.[0];
    const rollBroadcast = lastRoll ? `<div class="public-roll" role="status"><strong>${escapeHtml(lastRoll.actor)}</strong><span>${escapeHtml(lastRoll.formula)}</span><b>${lastRoll.successes} Усп. · ${lastRoll.crits} Крит.</b></div>` : "";
    return `
      <section class="board-stage" aria-label="Поле Сцены">
        ${instruction}
        ${rollBroadcast}
        ${state.role === "gm" ? gmToolDock() : ""}
        <div class="zoom-cluster" aria-label="Масштаб поля">
          <button type="button" data-zoom="out" aria-label="Отдалить">−</button>
          <button type="button" data-zoom="fit" aria-label="Вписать поле">${Math.round(state.zoom * 100)}%</button>
          <button type="button" data-zoom="in" aria-label="Приблизить">+</button>
        </div>
        <div class="board-frame" style="--board-zoom:${state.zoom}">
          <div class="scene-board" role="grid" style="--cols:${space.width};--rows:${space.height}" aria-label="${escapeHtml(space.name)}, ${space.width} на ${space.height}">
            ${cells.join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderToken(actor, targeted) {
    const selected = state.selectedId === actor.id;
    const isActive = actor.id === "hero-eta";
    return `
      <button type="button" class="token ${actor.team} ${selected ? "selected" : ""} ${targeted ? "targeted" : ""} ${isActive ? "active" : ""}"
        data-actor="${escapeHtml(actor.id)}" aria-label="${escapeHtml(actor.name)}: ${actor.hp} из ${actor.maxHp} Здоровья" title="${escapeHtml(actor.name)} · ${actor.hp}/${actor.maxHp}">
        ${escapeHtml(actor.short)}<span class="token-hp">${actor.hp}</span>
      </button>
    `;
  }

  function gmToolDock() {
    return `
      <div class="gm-tool-dock" aria-label="Инструменты Нарратора">
        <button type="button" data-gm-tool="add" title="Добавить противника">＋</button>
        <button type="button" data-open-surface="techniques" title="Области и Техники">▦</button>
        <button type="button" data-gm-tool="ping" title="Пинг">⌖</button>
        <button type="button" data-open-surface="utilities" title="Утилиты Сцены">◷</button>
      </div>
    `;
  }

  function portraitRail() {
    return `
      <aside class="portrait-rail" aria-label="Участники и Ходы">
        ${state.scene.actors.filter(actor => actor.team === "hero").map(portraitButton).join("")}
        <div class="portrait-divider"></div>
        ${state.scene.actors.filter(actor => actor.team === "enemy").map(portraitButton).join("")}
      </aside>
    `;
  }

  function portraitButton(actor) {
    return `<button type="button" class="portrait-button ${actor.team} ${actor.acted ? "done" : ""} ${state.selectedId === actor.id ? "on" : ""}" data-actor="${escapeHtml(actor.id)}" aria-label="${escapeHtml(actor.name)}">${escapeHtml(actor.short)}</button>`;
  }

  function actorCard(actor, compact = false) {
    const enemyMechanic = actor.team === "enemy"
      ? `<p><b>${actor.name === "Ассасин" ? "Тень клинка:" : "Неподвижная масса:"}</b> ${escapeHtml(actor.note)}</p>`
      : `<p>${escapeHtml(actor.note)}</p>`;
    return `
      <article class="actor-card ${compact ? "compact" : ""}">
        <header class="actor-card-head">
          <span class="actor-avatar">${escapeHtml(actor.short)}</span>
          <div><span class="eyebrow">${actor.team === "hero" ? "Герой" : "Противник"}</span><h2>${escapeHtml(actor.name)}</h2></div>
        </header>
        <div><div class="bar"><i style="width:${healthPercent(actor)}%"></i></div><p>Здоровье ${actor.hp} / ${actor.maxHp}</p></div>
        <div class="stat-row">
          <span>Скорость<b>${actor.speed}</b></span><span>${actor.armor ? "Броня" : "Уклонение"}<b>${actor.armor || actor.evasion}</b></span><span>ОД<b>${actor.ap}</b></span>
        </div>
        ${enemyMechanic}
        <div class="chip-row">${(actor.effects || []).map(effect => `<span class="mini-chip">${escapeHtml(effect)}</span>`).join("") || `<span class="mini-chip">Нет Эффектов</span>`}</div>
        <div class="panel-actions">
          <button type="button" data-open-surface="${actor.team === "hero" ? "sheet" : "reference"}">${actor.team === "hero" ? "Лист" : "Механики"}</button>
          <button type="button" data-open-surface="techniques">${actor.team === "hero" ? "Техники" : "Действия"}</button>
        </div>
      </article>
    `;
  }

  function actionDock() {
    if (state.preview) return `<footer class="action-dock">${previewPanel()}</footer>`;
    if (state.pendingRule) {
      return `
        <footer class="action-dock">
          <div class="action-context"><strong>${escapeHtml(currentRule()?.name || "Техника")}</strong><small>выбор пространства действия</small></div>
          <div class="action-scroll"><span class="status-chip">Нажмите подходящую клетку на поле</span></div>
          <button type="button" data-cancel-action>Отмена</button>
        </footer>
      `;
    }
    if (state.pendingAction) {
      return `<footer class="action-dock"><div class="action-context"><strong>${escapeHtml(state.pendingAction.name)}</strong><small>выбор клетки назначения</small></div><div class="action-scroll"><span class="status-chip">Укажите свободную клетку</span></div><button type="button" data-cancel-action>Отмена</button></footer>`;
    }
    return `
      <footer class="action-dock">
        <div class="action-context"><strong>Эта · активный Ход</strong><small>${activeHero().ap} ОД · Фокус ${activeHero().focus}</small></div>
        <div class="action-scroll">
          <button type="button" data-action-name="Шаг">Шаг</button>
          <button type="button" data-action-name="Стычка">Стычка</button>
          <button type="button" class="primary" data-open-surface="techniques">Техники</button>
          <button type="button" data-open-surface="sheet">Лист</button>
          <button type="button" data-open-surface="utilities">Утилиты</button>
          <button type="button" data-open-surface="reference">Справочник</button>
        </div>
        <div class="dock-tail">
          ${state.history.length ? `<button type="button" data-undo>Отменить</button>` : ""}
          <button type="button" class="primary" data-end-turn>Завершить Ход</button>
        </div>
      </footer>
    `;
  }

  function previewPanel() {
    const preview = state.preview;
    const names = (preview.affectedActorIds || []).map(id => actorById(id)?.name).filter(Boolean);
    const errors = preview.errors || [];
    const detailText = errors.length
      ? `<span class="preview-errors">${escapeHtml(errors.join(" "))}</span>`
      : `<span>${preview.affectedCells?.length || 0} клеток</span><span>${names.length ? `Цели: ${escapeHtml(names.join(", "))}` : "Без целей"}</span><span>${preview.commands?.length || 0} команды</span>`;
    return `
      <div class="preview-panel">
        <div class="preview-main">
          <span class="preview-icon">${preview.ok ? "✓" : "!"}</span>
          <div class="preview-copy"><strong>${escapeHtml(preview.rule?.name || "Предпросмотр")}</strong><small>${escapeHtml(preview.summary || "Проверьте действие")}</small></div>
          <div class="preview-actions">
            <button type="button" data-cancel-action>Назад</button>
            <button type="button" class="primary" data-commit-action ${preview.ok ? "" : "disabled"}>Применить</button>
          </div>
        </div>
        <div class="preview-details">${detailText}</div>
      </div>
    `;
  }

  function renderA() {
    return `
      <section class="concept-shell concept-a ${state.role}">
        ${sceneStrip()}
        <div class="a-workspace">
          ${portraitRail()}
          ${renderBoard()}
          <aside class="context-panel">${actorCard(selectedActor())}</aside>
        </div>
        ${actionDock()}
      </section>
    `;
  }

  function render() {
    root.innerHTML = renderA();
    roleSelect.value = state.role;
    renderSurface();
  }

  function renderSurface() {
    if (!state.surface) {
      surfaceRoot.innerHTML = "";
      return;
    }
    const titles = { sheet: state.role === "gm" ? "Листы противников" : "Живой лист", reference: "Справочник и правила" };
    const title = titles[state.surface] || titles.sheet;
    surfaceRoot.innerHTML = `
      <div class="surface-backdrop" data-close-surface>
        <section class="surface-panel" role="dialog" aria-modal="false" aria-label="${title}">
          <header class="surface-head"><div><h2>${title}</h2><p>${state.role === "gm" ? "Все противники текущей Сцены" : `${escapeHtml(ownedHero().name)} · только ваш лист`}</p></div><button type="button" data-close-surface aria-label="Закрыть">×</button></header>
          <nav class="surface-tabs" aria-label="Разделы игрового кокпита">
            ${Object.entries(titles).map(([id, label]) => `<button type="button" data-surface-tab="${id}" class="${state.surface === id ? "on" : ""}">${label}</button>`).join("")}
          </nav>
          <div class="surface-body">${surfaceContent()}</div>
        </section>
      </div>
    `;
  }

  function surfaceContent() {
    if (state.surface === "sheet") return sheetSurface();
    return referenceSurface("");
  }

  function sheetSurface() {
    if (state.role === "gm") return enemySheetsSurface();
    const sections = { main: "Основной", bio: "Био", combat: "Боевой", utility: "Утилитарный" };
    return `
      <section class="surface-section">
        <nav class="sheet-section-tabs" aria-label="Разделы листа">${Object.entries(sections).map(([id, label]) => `<button type="button" data-sheet-section="${id}" class="${state.sheetSection === id ? "on" : ""}">${label}</button>`).join("")}</nav>
        ${playerSheetSection(ownedHero())}
      </section>
    `;
  }

  function playerSheetSection(hero) {
    if (state.sheetSection === "bio") return `
      <div class="sheet-hero"><div class="sheet-portrait">${escapeHtml(hero.short)}</div><div><span class="eyebrow">Биография и заметки</span><h3>${escapeHtml(hero.name)}</h3><p>${escapeHtml(hero.bio)}</p></div></div>
      <label class="notes-field">Личные заметки<textarea rows="8" data-hero-notes>${escapeHtml(hero.notes)}</textarea></label>
      <p class="privacy-note">Этот раздел принадлежит игроку. Другие игроки его не получают; Нарратору открываются только данные кампании.</p>
    `;
    if (state.sheetSection === "combat") return combatSheet(hero);
    if (state.sheetSection === "utility") return utilitiesSurface(hero);
    return `
      <div class="sheet-hero"><div class="sheet-portrait">${escapeHtml(hero.short)}</div><div><span class="eyebrow">Живой лист · Ступень 3</span><h3>${escapeHtml(hero.name)}</h3><p>${escapeHtml(hero.note)}</p><div class="chip-row" style="margin-top:.5rem"><span class="mini-chip">Разрушитель</span><span class="mini-chip">Химик</span><span class="mini-chip">Внутренний мир</span></div></div></div>
      <div class="sheet-resources">
        <span>Здоровье<b>${hero.hp}/${hero.maxHp}</b></span><span>ОД<b>${hero.ap}/3</b></span><span>Фокус<b>${hero.focus}</b><small>без максимума</small></span><span>Влияние<b>2</b></span>
        <span>Раны<b>0/3</b></span><span>Стресс<b>1</b></span><span>Броня<b>${hero.armor}</b></span><span>Скорость<b>${hero.speed}</b></span>
      </div>
      <div class="attribute-summary">${Object.entries(hero.attrs).map(([id, value]) => `<span>${attributeName(id)}<b>${value}</b></span>`).join("")}</div>
      <div class="technique-card"><h3>Эффекты и ограничения</h3><div class="chip-row">${hero.effects.map(effect => `<span class="mini-chip">${escapeHtml(effect)}</span>`).join("")}<span class="mini-chip">Реакция доступна</span></div></div>
    `;
  }

  function combatSheet(hero) {
    const coverage = ENGINE?.techniqueCoverage(DATA, hero.techniques) || [];
    const actions = SCENE?.availableActions(state.scene, DATA, hero.id) || [];
    return `
      <div class="combat-context"><span class="mini-chip">${hero.ap} ОД</span><span class="mini-chip">Фокус ${hero.focus}</span><span class="mini-chip">цель: ${escapeHtml(selectedActor().name)}</span><span class="mini-chip">Напряжение ${state.scene.tension}</span></div>
      <section><span class="eyebrow">Базовые действия и Реакции</span><div class="base-action-grid">${actions.map(action => `<button type="button" data-base-action-id="${escapeHtml(action.id)}" ${action.available ? "" : "disabled"} title="${escapeHtml(action.reason || action.text)}"><strong>${escapeHtml(action.name)}</strong><small>${escapeHtml(action.cost)} · ${escapeHtml(action.reason || action.group)}</small></button>`).join("")}</div></section>
      <section><span class="eyebrow">Все изученные Техники</span><div class="technique-list">${coverage.map(entry => `
        <article class="technique-card">
          <header><span class="preview-icon">${entry.automation === "full" ? "✓" : entry.automation === "assist" ? "◐" : "·"}</span><div><span class="eyebrow">${escapeHtml(entry.techniqueName)} · Уровень ${entry.level}</span><h3>${escapeHtml(entry.name)}</h3></div><span class="tag automation-${entry.automation}">${automationName(entry.automation)}</span></header>
          <p>${escapeHtml(entry.text)}</p>
          <footer><small>${entry.automation === "manual" ? "Источник и ручной итог попадут в журнал" : `${entry.rules.length} машинное правило`}</small>${entry.rules.length ? entry.rules.map(rule => `<button type="button" class="primary" data-prepare-technique="${escapeHtml(rule.id)}">Использовать</button>`).join("") : `<button type="button" data-manual-technique="${escapeHtml(entry.id)}">Разрешить вручную</button>`}</footer>
        </article>`).join("")}</div></section>
    `;
  }

  function enemySheetsSurface() {
    const enemies = state.scene.actors.filter(actor => actor.team === "enemy");
    return `<section class="surface-section"><div class="enemy-sheet-grid">${enemies.map(enemy => `
      <article class="enemy-sheet ${state.selectedId === enemy.id ? "selected" : ""}">
        <header><span class="actor-avatar">${escapeHtml(enemy.short)}</span><div><span class="eyebrow">Противник</span><h3>${escapeHtml(enemy.name)}</h3></div><b>${enemy.hp}/${enemy.maxHp}</b></header>
        <div class="stat-row"><span>Скорость<b>${enemy.speed}</b></span><span>${enemy.armor ? "Броня" : "Уклонение"}<b>${enemy.armor || enemy.evasion}</b></span><span>ОД<b>${enemy.ap}</b></span></div>
        <p><strong>Пассив:</strong> ${escapeHtml(enemy.passive || enemy.note)}</p>
        <div class="enemy-actions">${(enemy.actions || []).map((action, index) => `<button type="button" data-enemy-action="${escapeHtml(enemy.id)}" data-enemy-action-index="${index}">${escapeHtml(action)}</button>`).join("")}</div>
        <footer><span class="mini-chip">Козырь: ${escapeHtml(enemy.trump || "—")}</span><button type="button" data-actor-focus="${escapeHtml(enemy.id)}">На поле</button></footer>
      </article>`).join("")}</div></section>`;
  }

  function attributeName(id) {
    return ({ body: "Тело", talent: "Талант", spirit: "Дух", mind: "Разум" })[id] || id;
  }

  function automationName(status) {
    return ({ full: "авто", assist: "с подсказкой", manual: "вручную" })[status] || status;
  }

  function rollFeatureRank(hero) {
    if (state.rollConfig.feature === "ability") return Number(hero.ability?.rank || 0);
    return Number(hero.skills?.find(skill => skill.id === state.rollConfig.feature)?.rank || 0);
  }

  function rollPool(hero) {
    return Math.max(1, Number(hero.attrs?.[state.rollConfig.attribute] || 0) + rollFeatureRank(hero) + Number(state.rollConfig.advantage || 0) - Number(state.rollConfig.hindrance || 0));
  }

  function utilitiesSurface(hero) {
    const pool = rollPool(hero);
    const features = [
      ...hero.skills.map(skill => `<option value="${escapeHtml(skill.id)}" ${state.rollConfig.feature === skill.id ? "selected" : ""}>${escapeHtml(skill.name)} · ${skill.rank}</option>`),
      `<option value="ability" ${state.rollConfig.feature === "ability" ? "selected" : ""}>${escapeHtml(hero.ability.name)} · ${hero.ability.rank}</option>`,
      `<option value="none" ${state.rollConfig.feature === "none" ? "selected" : ""}>Без навыка / способности</option>`,
    ].join("");
    return `
      <section class="surface-section">
        <div class="utility-grid">
          <article class="utility-card roll-builder"><span class="eyebrow">Публичный бросок</span><h3>${pool}D6</h3><p>Результат появляется поверх поля и в общем журнале Сцены.</p>
            <div class="roll-fields">
              <label>Атрибут<select data-roll-config="attribute">${Object.entries(hero.attrs).map(([id, value]) => `<option value="${id}" ${state.rollConfig.attribute === id ? "selected" : ""}>${attributeName(id)} · ${value}</option>`).join("")}</select></label>
              <label>Навык / способность<select data-roll-config="feature">${features}</select></label>
              <label>Преимущество<input type="number" min="0" value="${state.rollConfig.advantage}" data-roll-config="advantage"></label>
              <label>Помеха<input type="number" min="0" value="${state.rollConfig.hindrance}" data-roll-config="hindrance"></label>
            </div>
            <div id="dice-output" class="utility-result">${escapeHtml(state.diceResult)}</div><button type="button" class="primary" data-roll-dice>Бросить ${pool}D6 всем</button>
          </article>
          <article class="utility-card"><span class="eyebrow">Часы Сцены</span><h3>Обвал крыши</h3><p>Заполняются отдельно от боевого действия.</p><div class="clock-row"><button type="button" data-clock="down">−</button><output>${state.clock} / 6</output><button type="button" data-clock="up">+</button></div></article>
        </div>
        <article class="utility-card"><span class="eyebrow">Связь с полем</span><h3>Линейка, пинг и показ арта</h3><p>В полном столе эти средства работают поверх поля и не превращаются в постоянную колонку. Здесь кнопки демонстрируют точку входа.</p><div class="panel-actions"><button type="button" data-utility="ruler">Линейка</button><button type="button" data-utility="art">Показать арт</button></div></article>
      </section>
    `;
  }

  function referenceSurface(query) {
    const needle = query.trim().toLowerCase();
    const entries = REFERENCES.filter(entry => `${entry.title} ${entry.tags} ${entry.text}`.toLowerCase().includes(needle));
    return `
      <section class="surface-section">
        <input id="reference-query" class="reference-search" type="search" value="${escapeHtml(query)}" placeholder="Термин, Эффект или Техника" aria-label="Поиск по справочнику">
        <div id="reference-results" class="rule-list">${referenceCards(entries)}</div>
      </section>
    `;
  }

  function referenceCards(entries) {
    return entries.length
      ? entries.map(entry => `<article class="reference-card"><span class="eyebrow">Правило DAWN</span><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.text)}</p></article>`).join("")
      : `<article class="reference-card"><h3>Ничего не найдено</h3><p>Попробуйте название Эффекта, области или ресурса.</p></article>`;
  }

  function prepareTechnique(ruleId) {
    state.surface = null;
    state.pendingRule = ruleId;
    state.preview = null;
    hoveredPreviewCell = null;
    const rule = currentRule();
    if (rule?.kind === "space") {
      const target = selectedActor();
      const fallback = state.scene.actors.find(actor => actor.team === "enemy" && actor.space === activeHero().space);
      const targetId = target?.id !== activeHero().id && target?.space === activeHero().space ? target.id : fallback?.id;
      runPreview({ targetIds: targetId ? [targetId] : [] });
    }
    render();
  }

  function runPreview(extra = {}) {
    if (!ENGINE || !state.pendingRule) return;
    state.preview = ENGINE.preview(state.scene, {
      ruleId: state.pendingRule,
      actorId: activeHero().id,
      options: { focusSpent: 4 },
      ...extra,
    });
  }

  function commitPreview() {
    if (!ENGINE || !state.preview?.ok) return;
    const result = ENGINE.commit(state.scene, state.preview);
    state.scene = result.scene;
    state.history.push(result.transaction);
    state.pendingRule = null;
    state.pendingAction = null;
    state.preview = null;
    hoveredPreviewCell = null;
    state.selectedId = state.scene.targetIds?.[0] || "hero-eta";
    render();
    toast("Техника применена одной транзакцией. Доступен общий откат.");
  }

  function cancelAction() {
    state.preview = null;
    state.pendingRule = null;
    state.pendingAction = null;
    hoveredPreviewCell = null;
    render();
  }

  function undoLast() {
    const transaction = state.history.pop();
    if (!transaction || !ENGINE) return;
    state.scene = ENGINE.undo(transaction);
    state.pendingRule = null;
    state.pendingAction = null;
    state.preview = null;
    hoveredPreviewCell = null;
    render();
    toast("Последнее действие отменено целиком.");
  }

  function canMove(actor) {
    return state.role === "gm" || actor.id === "hero-eta";
  }

  function addDemoEnemy() {
    if (actorById("enemy-reinforcement")) {
      toast("Подкрепление уже находится в Сцене.");
      return;
    }
    state.scene.actors.push({
      id: "enemy-reinforcement", name: "Ловчий", short: "ЛО", team: "enemy", space: "main", x: 6, y: 1,
      hp: 10, maxHp: 10, armor: 1, evasion: 2, speed: 4, ap: 2, focus: 0, acted: false,
      effects: [], passive: "Загонщик: отмеченная цель не может скрыться.", actions: ["Аркан · 5D6", "Зажать путь · зона"], trump: "Сомкнуть капкан · Н3", note: "Подкрепление добавлено через быстрый инструмент Нарратора.",
    });
    state.selectedId = "enemy-reinforcement";
    render();
    toast("Ловчий добавлен в свободную клетку.");
  }

  function openSurface(name) {
    if (name === "reference") state.surface = "reference";
    else {
      state.surface = "sheet";
      state.sheetSection = ({ techniques: "combat", utilities: "utility", sheet: "main" })[name] || state.sheetSection;
    }
    renderSurface();
  }

  function resolveBaseAction(actionId, extra = {}) {
    const hero = ownedHero();
    const action = DATA?.actions?.list?.find(item => item.id === actionId);
    if (!action || !SCENE) return;
    let roll = extra.roll;
    if (!roll && ["Стычка", "Заклинание", "Завершение", "Зарядка"].includes(action.name)) {
      const attribute = action.name === "Заклинание" || action.name === "Зарядка" ? "spirit" : "talent";
      const result = LOGIC.rollXd6({ count: Math.max(1, Number(hero.attrs?.[attribute] || 1)) });
      roll = { formula: `${result.initialCount}D6`, rolls: result.rolls, successes: result.successes, crits: result.crits };
    }
    const targetIds = extra.targetIds || (selectedActor().team === "enemy" ? [selectedActor().id] : []);
    const prepared = SCENE.prepareAction(state.scene, DATA, { actorId: hero.id, actionId, targetIds, destination: extra.destination, roll });
    if (!prepared.ok) return toast(prepared.errors.join(" "));
    const before = clone(state.scene);
    const result = SCENE.dispatchMany(state.scene, prepared.events);
    state.scene = result.scene;
    state.history.push({ before, after: clone(state.scene), label: action.name });
    state.pendingAction = null;
    state.surface = null;
    render();
    toast(`${action.name}: применено ${result.events.length} событий Сцены.`);
  }

  function chooseBaseAction(actionId) {
    const action = DATA?.actions?.list?.find(item => item.id === actionId);
    if (!action) return;
    if (["Шаг", "Прыжок"].includes(action.name)) {
      state.pendingAction = action;
      state.surface = null;
      render();
      return;
    }
    resolveBaseAction(actionId);
  }

  function chooseManualTechnique(entryId) {
    const entry = ENGINE?.techniqueCoverage(DATA, ownedHero().techniques).find(item => item.id === entryId);
    if (!entry) return;
    state.preview = ENGINE.manualPreview(state.scene, {
      actorId: ownedHero().id,
      entry,
      note: entry.text,
      targetIds: state.selectedId ? [state.selectedId] : [],
    });
    state.surface = null;
    render();
  }

  roleSelect.addEventListener("change", () => {
    state.role = roleSelect.value;
    render();
    toast(state.role === "gm" ? "Открыты инструменты Нарратора." : "Игрок видит только игровой контекст.");
  });

  document.querySelector("#reset-demo").addEventListener("click", () => {
    state.scene = initialScene();
    state.selectedId = "enemy-assassin";
    state.pendingRule = null;
    state.pendingAction = null;
    state.preview = null;
    state.surface = null;
    state.history = [];
    state.zoom = 1;
    render();
    toast("Демонстрационный бой сброшен.");
  });

  root.addEventListener("click", event => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    const actorButton = event.target.closest("[data-actor]");
    if (actorButton) {
      state.selectedId = actorButton.dataset.actor;
      render();
      return;
    }
    const cell = event.target.closest("[data-cell]");
    if (cell && state.pendingAction) {
      resolveBaseAction(state.pendingAction.id, { destination: { x: Number(cell.dataset.x), y: Number(cell.dataset.y) } });
      return;
    }
    if (cell && state.pendingRule && currentRule()?.kind !== "space") {
      runPreview({ anchor: { x: Number(cell.dataset.x), y: Number(cell.dataset.y) } });
      render();
      return;
    }
    const open = event.target.closest("[data-open-surface]");
    if (open) {
      return openSurface(open.dataset.openSurface);
    }
    const space = event.target.closest("[data-space]");
    if (space) {
      state.scene.activeSpace = space.dataset.space;
      render();
      return;
    }
    const zoom = event.target.closest("[data-zoom]");
    if (zoom) {
      state.zoom = zoom.dataset.zoom === "fit" ? 1 : Math.max(.8, Math.min(1.2, state.zoom + (zoom.dataset.zoom === "in" ? .1 : -.1)));
      render();
      return;
    }
    if (event.target.closest("[data-cancel-action]")) return cancelAction();
    if (event.target.closest("[data-commit-action]")) return commitPreview();
    if (event.target.closest("[data-undo]")) return undoLast();
    const quickAction = event.target.closest("[data-action-name]");
    if (quickAction) {
      const action = DATA?.actions?.list?.find(item => item.name === quickAction.dataset.actionName);
      if (action) return chooseBaseAction(action.id);
    }
    if (event.target.closest("[data-end-turn]")) {
      const before = clone(state.scene);
      const result = SCENE.dispatch(state.scene, { type: "turn.end", actorId: ownedHero().id, payload: {} });
      state.scene = result.scene;
      state.history.push({ before, after: clone(state.scene), label: "Завершить Ход" });
      render();
      toast("Ход завершён публичным событием Сцены.");
      return;
    }
    const gmTool = event.target.closest("[data-gm-tool]");
    if (gmTool) {
      if (gmTool.dataset.gmTool === "add") addDemoEnemy();
      else toast("Пинг появился бы у всех участников как эфемерное событие.");
      return;
    }
  });

  root.addEventListener("keydown", event => {
    const cell = event.target.closest("[data-cell]");
    if (cell && state.pendingAction && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      resolveBaseAction(state.pendingAction.id, { destination: { x: Number(cell.dataset.x), y: Number(cell.dataset.y) } });
    } else if (cell && state.pendingRule && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      runPreview({ anchor: { x: Number(cell.dataset.x), y: Number(cell.dataset.y) } });
      render();
    }
  });

  root.addEventListener("pointerdown", event => {
    const token = event.target.closest("[data-actor]");
    if (!token || state.pendingRule) return;
    const actor = actorById(token.dataset.actor);
    if (!actor || !canMove(actor)) return;
    drag = { actorId: actor.id, startX: event.clientX, startY: event.clientY, hover: null };
    token.setPointerCapture?.(event.pointerId);
  });

  root.addEventListener("pointermove", event => {
    if (!drag && state.pendingRule && currentRule()?.kind === "area" && event.pointerType !== "touch") {
      const cell = event.target.closest("[data-cell]");
      const cellKey = cell ? `${cell.dataset.x}:${cell.dataset.y}` : null;
      if (cell && cellKey !== hoveredPreviewCell) {
        hoveredPreviewCell = cellKey;
        runPreview({ anchor: { x: Number(cell.dataset.x), y: Number(cell.dataset.y) } });
        render();
      }
      return;
    }
    if (!drag) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-cell]");
    if (drag.hover && drag.hover !== hit) drag.hover.classList.remove("drop-ready");
    drag.hover = hit || null;
    drag.hover?.classList.add("drop-ready");
  });

  function finishDrag(event) {
    if (!drag) return;
    drag.hover?.classList.remove("drop-ready");
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 7;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-cell]") || drag.hover;
    const actor = actorById(drag.actorId);
    if (moved && cell && actor) {
      const x = Number(cell.dataset.x);
      const y = Number(cell.dataset.y);
      const occupied = state.scene.actors.some(other => other.id !== actor.id && other.space === state.scene.activeSpace && other.x === x && other.y === y);
      if (occupied) toast("Клетка занята. Полный движок также проверит путь и Скорость.");
      else {
        const before = clone(state.scene);
        state.scene = SCENE.dispatch(state.scene, { type: "actor.move", actorId: actor.id, payload: { space: state.scene.activeSpace, x, y, movement: "drag" } }).scene;
        state.history.push({ before, after: clone(state.scene), label: "Перемещение токена" });
        state.selectedId = actor.id;
        suppressClick = true;
        render();
        window.setTimeout(() => { suppressClick = false; }, 0);
        toast("Перемещение показано напрямую; в рабочем столе перед фиксацией появятся путь и стоимость.");
      }
    }
    drag = null;
  }

  root.addEventListener("pointerup", finishDrag);
  root.addEventListener("pointercancel", () => { drag = null; });

  surfaceRoot.addEventListener("click", event => {
    const close = event.target.closest("[data-close-surface]");
    if (close && (event.target === close || close.tagName === "BUTTON")) {
      state.surface = null;
      renderSurface();
      return;
    }
    const tab = event.target.closest("[data-surface-tab]");
    if (tab) {
      state.surface = tab.dataset.surfaceTab;
      renderSurface();
      return;
    }
    const section = event.target.closest("[data-sheet-section]");
    if (section) {
      state.sheetSection = section.dataset.sheetSection;
      renderSurface();
      return;
    }
    const baseAction = event.target.closest("[data-base-action-id]");
    if (baseAction) return chooseBaseAction(baseAction.dataset.baseActionId);
    const manual = event.target.closest("[data-manual-technique]");
    if (manual) return chooseManualTechnique(manual.dataset.manualTechnique);
    const actorFocus = event.target.closest("[data-actor-focus]");
    if (actorFocus) {
      state.selectedId = actorFocus.dataset.actorFocus;
      state.surface = null;
      render();
      return;
    }
    const enemyAction = event.target.closest("[data-enemy-action]");
    if (enemyAction) {
      const enemy = actorById(enemyAction.dataset.enemyAction);
      const action = enemy?.actions?.[Number(enemyAction.dataset.enemyActionIndex)];
      if (enemy && action) {
        state.selectedId = enemy.id;
        state.scene.log.unshift({ type: "enemy.action.selected", actorId: enemy.id, text: action });
        state.surface = null;
        render();
        toast(`${enemy.name}: ${action}`);
      }
      return;
    }
    const technique = event.target.closest("[data-prepare-technique]");
    if (technique) return prepareTechnique(technique.dataset.prepareTechnique);
    if (event.target.closest("[data-roll-dice]")) {
      const hero = ownedHero();
      const pool = rollPool(hero);
      const result = LOGIC.rollXd6({ count: pool });
      state.diceResult = `${result.rolls.join(" · ")} · успехов ${result.successes}`;
      state.scene = SCENE.dispatch(state.scene, { type: "roll.public", actorId: hero.id, payload: { formula: `${pool}D6`, rolls: result.rolls, successes: result.successes, crits: result.crits } }).scene;
      render();
      return;
    }
    const clock = event.target.closest("[data-clock]");
    if (clock) {
      state.clock = Math.max(0, Math.min(6, state.clock + (clock.dataset.clock === "up" ? 1 : -1)));
      renderSurface();
      return;
    }
    const utility = event.target.closest("[data-utility]");
    if (utility) toast(utility.dataset.utility === "ruler" ? "Линейка включается поверх поля без ухода со Сцены." : "Арт откроется поверх поля у всех участников.");
  });

  surfaceRoot.addEventListener("input", event => {
    if (event.target.id === "reference-query") {
      const results = surfaceRoot.querySelector("#reference-results");
      const needle = event.target.value.trim().toLowerCase();
      const entries = REFERENCES.filter(entry => `${entry.title} ${entry.tags} ${entry.text}`.toLowerCase().includes(needle));
      results.innerHTML = referenceCards(entries);
      return;
    }
    if (event.target.matches("[data-hero-notes]")) {
      ownedHero().notes = event.target.value;
      return;
    }
    if (event.target.matches("[data-roll-config]")) {
      const key = event.target.dataset.rollConfig;
      state.rollConfig[key] = key === "advantage" || key === "hindrance" ? Math.max(0, Number(event.target.value) || 0) : event.target.value;
      renderSurface();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (state.surface) {
        state.surface = null;
        renderSurface();
      } else if (state.pendingRule || state.preview) cancelAction();
    }
  });

  if (!ENGINE) toast("technique-engine.js не загрузился: предпросмотр Техник недоступен.");
  render();
})();
