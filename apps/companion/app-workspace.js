// Navigation and result windows are local presentation state.
const workspaceResultStates = new Map();
const workspaceAnchors = new Map();
function workspaceCopy(ru, en) { return typeof isEnglishPreview === "function" && isEnglishPreview() ? en : ru; }
function workspaceResultPage(kind, key, items, pageSize = 40, revealIndex = -1) {
  const size = Math.max(1, Math.floor(Number(pageSize) || 40));
  let state = workspaceResultStates.get(kind);
  if (!state || state.key !== String(key)) {
    state = { key: String(key), limit: size, size };
    workspaceResultStates.set(kind, state);
  }
  if (revealIndex >= 0) state.limit = Math.max(state.limit, Math.ceil((revealIndex + 1) / size) * size);
  const shown = Math.min(items.length, state.limit);
  return { items: items.slice(0, shown), shown, total: items.length, hasMore: shown < items.length };
}
function workspaceMoreResults(kind) {
  const state = workspaceResultStates.get(kind);
  if (!state) return false;
  state.limit += state.size;
  return true;
}
function workspaceReferenceAnchor(item) {
  const key = item.id || ruleKey(`${item.name}:${item.text || ""}`);
  return "reference-" + String(key).replace(/[^a-z0-9_-]+/gi,"-");
}
function workspaceRuleAnchor(item) {
  if (typeof activeRuleChapters !== "function" || typeof ruleCardId !== "function") return "";
  const chapter = activeRuleChapters().find(group => group.cards?.some(card => card.id === item.id));
  if (chapter) return ruleCardId(item,chapter.id);
  const core = typeof activeCoreRules === "function" ? activeCoreRules() : null;
  if (core?.actions?.list?.some(card => card.id === item.id)) return ruleCardId(item,"action");
  if (core?.effects?.positive?.some(card => card.id === item.id)) return ruleCardId(item,"positive-effect");
  if (core?.effects?.negative?.some(card => card.id === item.id)) return ruleCardId(item,"negative-effect");
  return "";
}
function workspaceRulesHref(sectionId, items = []) {
  if (typeof sceneUsesLionwing !== "function" || !sceneUsesLionwing() || typeof activeRuleChapters !== "function") return `?mode=rules#rules-${sectionId === "effects" ? "actions" : sectionId}`;
  const chapters = activeRuleChapters(), ids = new Set(items.map(item => item.id));
  const primary = typeof sceneRuleChapter === "function" ? sceneRuleChapter(sectionId) : null;
  if (primary && chapters.some(chapter => chapter.id === primary.id)) return "?mode=rules#rules-" + primary.id;
  const ranked = chapters.map(chapter => ({ chapter, score: (chapter.cards || []).filter(card => ids.has(card.id)).length })).sort((a,b) => b.score-a.score);
  const chapter = ranked[0]?.score ? ranked[0].chapter : chapters.find(item => item.special === "actions") || chapters[0];
  return chapter ? "?mode=rules#rules-" + chapter.id : "?mode=rules";
}
function renderWorkspaceNavigation() {
  const root = $("workspace-navigation"), links = $("workspace-links"), index = $("rules-index");
  if (!root || !links || !index) return;
  const mode = store.mode, build = document.querySelector('[data-page="build"]');
  const sheet = mode === "build" && build?.dataset.heroView === "sheet";
  document.body.dataset.workspaceView = sheet ? "sheet" : mode === "build" ? "builder" : mode;
  const sidebar = document.querySelector(".sidebar");
  for (const [selector, visible] of [[".hero-switcher",mode === "build"],[".summary",mode === "build" && !sheet],[".hero-files",mode === "build"],[".autosave",mode === "build" && !sheet]]) {
    const element = sidebar?.querySelector(selector); if (element) element.hidden = !visible;
  }
  root.hidden = !["build", "tools", "rules"].includes(mode);
  index.hidden = mode !== "rules";
  links.hidden = mode === "rules";
  if (root.hidden) { window.DAWN_MOBILE_HEADER?.refresh(); return; }
  let entries = [];
  if (mode === "rules") {
    $("workspace-nav-title").textContent = workspaceCopy("Главы правил", "Rule chapters");
  } else if (mode === "tools") {
    $("workspace-nav-title").textContent = workspaceCopy("Инструменты", "Tools");
    entries = [["tools-dice","Бросок и пул","Roll and pool"],["tools-sheet","Источники с листа","Sheet sources"],["tools-context","Настройка броска","Roll setup"],["tools-feed","Лента бросков","Roll history"],["tools-bonds","Связи","Bonds"],["tools-clocks","Часы Сцены","Scene clocks"],["tools-stress","Стресс героев","Hero Stress"]].map(([id,ru,en]) => ({ id, label: workspaceCopy(ru,en) }));
  } else if (sheet) {
    $("workspace-nav-title").textContent = workspaceCopy("Игровой лист", "Play sheet");
    entries = [["identity","Профиль","Profile"],["resources","Ресурсы","Resources"],["attributes","Атрибуты","Attributes"],["skills","Навыки","Skills"],["dice","Бросок","Roll"],["actions","Действия","Actions"],["techniques","Техники","Techniques"]].flatMap(([part,ru,en]) => {
      const section = $("hero-play-sheet")?.querySelector(".hero-sheet-" + part);
      if (!section) return [];
      section.id = "hero-sheet-" + part;
      return [{ id: section.id, label: workspaceCopy(ru,en) }];
    });
  } else {
    $("workspace-nav-title").textContent = workspaceCopy("Сборка героя", "Character build");
    entries = [...(build?.querySelectorAll(".build-collapsible") || [])].flatMap(panel => {
      const heading = panel.querySelector(".section-title h2");
      return heading?.id ? [{ id: heading.id, label: heading.textContent }] : [];
    });
  }
  const key = document.body.dataset.workspaceView, active = workspaceAnchors.get(key);
  links.innerHTML = entries.filter(entry => document.getElementById(entry.id)).map(entry => `<a href="#${esc(entry.id)}" data-workspace-anchor="${esc(entry.id)}"${active === entry.id ? ' aria-current="location"' : ""}>${esc(entry.label)}</a>`).join("");
  window.DAWN_MOBILE_HEADER?.refresh();
}
document.addEventListener("click", event => {
  const internal = event.target.closest?.('.reference-rules-link a,.scene-rule-section-intro a,.scene-reference-card footer a');
  if (internal && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
    const url = new URL(internal.getAttribute("href"),location.href),mode = url.searchParams.get("mode");
    if (url.origin === location.origin && ["build","play","tools","rules","reference"].includes(mode)) {
      event.preventDefault();
      if (mode === "reference") { refKind = "all"; refTag = "all"; $("ref-search").value = url.searchParams.get("q") || ""; }
      setMode(mode,{hash:url.hash}); return;
    }
  }
  const more = event.target.closest?.("[data-workspace-more]");
  if (more) {
    const kind = more.dataset.workspaceMore;
    if (!workspaceMoreResults(kind)) return;
    if (kind === "reference") renderReference();
    if (kind === "scene-reference") renderSceneReference();
    return;
  }
  const anchor = event.target.closest?.("[data-workspace-anchor]");
  if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const target = document.getElementById(anchor.dataset.workspaceAnchor);
  if (!target) return;
  event.preventDefault();
  const panel = target.closest(".build-collapsible");
  if (panel) { panel.classList.remove("collapsed"); panel.querySelector(".section-title")?.setAttribute("aria-expanded","true"); }
  for (let details = target.closest("details"); details; details = details.parentElement?.closest("details")) details.open = true;
  workspaceAnchors.set(document.body.dataset.workspaceView, target.id);
  for (const link of document.querySelectorAll("[data-workspace-anchor]")) {
    if (link === anchor) link.setAttribute("aria-current","location"); else link.removeAttribute("aria-current");
  }
  target.scrollIntoView({ block: "start", behavior: "smooth" });
  target.setAttribute("tabindex","-1"); target.focus({ preventScroll: true });
});
