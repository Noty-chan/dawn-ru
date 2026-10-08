"use strict";

// Presentation-only category palette. Every operation remains an existing node
// with its original listener, ID/data attributes, role gating and Scene state.
window.DAWN_SCENE_BOARD_TOOLS = (() => {
  const copy = (key, fallback) => {
    const value = typeof t === "function" ? t(key) : key;
    return value && value !== key ? value : fallback;
  };
  const labelFor = group => group.id === "present" ? (typeof isEnglishPreview === "function" && isEnglishPreview() ? "Show" : "Показ") : group.id === "highlights" ? (typeof isEnglishPreview === "function" && isEnglishPreview() ? "Ability highlights" : "Подсветки способностей") : copy(`scene.boardTools.category.${group.id}`, group.label);
  const groups = [
    { id: "tokens", label: "Жетоны", icon: "●", selectors: ['[data-scene-tool="select"]','[data-scene-tool="place"]','[data-scene-tool="target"]','#scene-clear-targets'] },
    { id: "measure", label: "Измерение", icon: "↔", selectors: ['[data-scene-tool="measure"]','#scene-clear-movement-traces'] },
    { id: "present", label: "Показ", icon: "✦", selectors: ["#scene-present-ping","#scene-present-line","#scene-present-rectangle","#scene-present-cells","#scene-present-cancel"], controls: ["scene-presentation-status"] },
    { id: "areas", label: "Окружение", icon: "▧", gm: true, selectors: ['[data-scene-tool="area"][data-scene-area-type="terrain"]','[data-scene-tool="wall"]','[data-scene-tool="erase"]'], controls: ["scene-area-controls","scene-wall-controls"] },
    { id: "markers", label: "Маркеры", icon: "◆", gm: true, selectors: ['[data-scene-tool="marker"]'], controls: ["scene-marker-controls"] },
    { id: "highlights", label: "Подсветки способностей", icon: "✦", selectors: ["#manual-table-area-tool"], controls: ["manual-table-area-tools"] },
    { id: "history", label: "История", icon: "↶", gm: true, selectors: ['#scene-undo','#scene-redo'] }
  ];
  let toolbar = null, strip = null, tools = null, oldPrimary = null, primaryHidden = false, enabled = false, selected = "tokens";
  const homes = new Map();
  const next = () => typeof usingNextSceneInterface === "function" && usingNextSceneInterface();
  const icon = name => window.DAWN_UI_ICONS?.html(name) || "";
  const escape = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  function remember(node, button = false) {
    if (homes.has(node)) return homes.get(node);
    const anchor = document.createComment("board tool home");
    node.before(anchor);
    const record = { anchor, html: button ? node.innerHTML : null, label: button ? node.textContent.trim() : "", aria: button ? node.getAttribute("aria-label") : null, help:node.dataset?.toolHelp };
    homes.set(node, record); return record;
  }
  function decorate(node) {
    const home = remember(node, true);
    if(node.dataset?.sceneTool==="erase"){const label=copy("scene.boardTools.eraseEnvironment","Удалить окружение; участники сохраняются");node.dataset.toolHelp=label;node.setAttribute("aria-label",label);node.title=label;}
    const operation = ({area:"areas",wall:"walls",marker:"markers",topology:"edit",erase:"clear"})[node.dataset?.sceneTool] || node.dataset?.sceneTool || ({"scene-zoom-fit":"view","scene-undo":"undo","scene-redo":"redo","scene-clear-targets":"clear","scene-clear-movement-traces":"traces"})[node.id] || node.dataset?.boardIcon;
    const svg = icon(operation);
    if (svg && !node.querySelector(".scene-board-tool-original-label")) node.innerHTML = svg + `<span class="scene-board-tool-original-label">${escape(home.label)}</span>`;
    if (!node.getAttribute("aria-label")) node.setAttribute("aria-label", home.label);
  }
  const categories = new Map(), panels = new Map(), toolGroups = new Map();
  let lastActiveTool = null;
  const player = () => document.body.classList.contains("scene-player-view");
  function select(id) {
    const group = groups.find(item => item.id === id);
    if (!enabled || !group || !categories.has(id) || group.gm && player()) return false;
    const changed = selected !== id;
    selected = id;
    if(changed)toolbar.dispatchEvent(new CustomEvent("scene-board-category-change",{detail:{id}}));
    for (const [key, button] of categories) button.setAttribute("aria-pressed", String(key === selected));
    for (const [key, panel] of panels) panel.hidden = key !== selected;
    return true;
  }
  function refresh() {
    if (!toolbar || !enabled) return false;
    if (player() && groups.find(item => item.id === selected)?.gm) select("tokens");
    return true;
  }
  function reflectTool() {
    if (!enabled) return;
    const active = [...toolGroups.keys()].find(button => button.getAttribute("aria-pressed") === "true");
    for (const [id, button] of categories) button.setAttribute("data-active-tool", String(Boolean(active && toolGroups.get(active) === id)));
    // A genuine tool change, including a keyboard shortcut, reveals its group.
    // Simply browsing categories or rerendering the same tool does not jump back.
    if (active && active !== lastActiveTool) select(toolGroups.get(active));
    lastActiveTool = active || null;
  }
  function enhance() {
    if (!enabled || !toolbar || !strip || !tools) return;
    for (const group of groups) {
      const nodes = group.selectors.flatMap(selector => [...document.querySelectorAll(selector)]).filter(node => !node.classList.contains("scene-stage-quick-action"));
      if (!nodes.length) continue;
      for (const node of nodes) if (node.dataset?.sceneTool) toolGroups.set(node, group.id);
      let button = categories.get(group.id), panel = panels.get(group.id);
      if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.id = `scene-board-category-${group.id}`;
      button.className = "scene-board-tool-category" + (group.gm ? " gm-only" : "");
      button.innerHTML = icon(group.id) || group.icon;
      button.title = labelFor(group);
      button.setAttribute("aria-label", labelFor(group));
      button.setAttribute("aria-controls", `scene-board-group-${group.id}`);
      button.addEventListener("click", () => select(group.id));
      panel = document.createElement("section");
      panel.id = `scene-board-group-${group.id}`;
      panel.className = "scene-board-tool-panel" + (group.gm ? " gm-only" : "");
      panel.setAttribute("role", "group");
      panel.setAttribute("aria-labelledby", button.id);
      const heading = document.createElement("h3");
      heading.textContent = labelFor(group);
      panel.append(heading);
      categories.set(group.id, button); panels.set(group.id, panel);
      strip.append(button); tools.append(panel);
      }
      const label=labelFor(group);if(button.title!==label){button.title=label;button.setAttribute("aria-label",label);panel.children[0].textContent=label;}
      for (const node of nodes) { decorate(node); if (node.parentNode !== panel) panel.append(node); }
      for (const id of group.controls || []) {
        const controls = document.getElementById(id);
        if (controls) { remember(controls); if (controls.parentNode !== panel) panel.append(controls); }
      }

    }
    const fit=document.getElementById("scene-zoom-fit"),map=document.getElementById("scene-map-tools");
    if(fit&&map){remember(fit,true);if(fit.parentNode!==map)map.append(fit);}
    const orderedCategories = groups.map(group => categories.get(group.id)).filter(Boolean);
    const orderedPanels = groups.map(group => panels.get(group.id)).filter(Boolean);
    if (orderedCategories.some((node, index) => strip.children[index] !== node)) strip.append(...orderedCategories);
    if (orderedPanels.some((node, index) => tools.children[index] !== node)) tools.append(...orderedPanels);
    select(selected);
    refresh();
    reflectTool();
  }
  function init() {
    if (toolbar) return refresh();
    if (!next()) return false;
    const candidate = document.querySelector(".scene-toolbar");
    oldPrimary = candidate?.querySelector(".scene-tool-group");
    const oldActions = candidate?.querySelector(".scene-tool-actions");
    if (!candidate || !oldPrimary || !oldActions) return false;
    toolbar = candidate; enabled = true; primaryHidden = oldPrimary.hidden;
    strip = document.createElement("nav");
    strip.className = "scene-board-tool-categories";
    strip.setAttribute("aria-label", copy("scene.boardTools.categoriesLabel", "Категории инструментов поля"));
    tools = document.createElement("div");
    tools.className = "scene-board-tool-panels";
    enhance();
    oldPrimary.hidden = true;
    toolbar.prepend(strip, tools);
    toolbar.classList.add("scene-board-tools-ready");
    toolbar.closest(".scene-stage")?.classList.add("scene-board-tools-stage");
    select("tokens");
    reflectTool();
    if (typeof MutationObserver === "function") {
      new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
      new MutationObserver(refresh).observe(document.body, { attributes: true, attributeFilter: ["class"] });
      new MutationObserver(reflectTool).observe(toolbar, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    }
    // This permanent palette is not a dialog. It does not consume Escape or
    // invoke tool/controller events when its category changes.
    return true;
  }
  function setEnabled(value) {
    if (value) {
      if (!toolbar) return init();
      enabled = true; oldPrimary.hidden = true;
      toolbar.prepend(strip, tools);
      toolbar.classList.add("scene-board-tools-ready");
      toolbar.closest(".scene-stage")?.classList.add("scene-board-tools-stage");
      enhance(); return true;
    }
    if (!toolbar) return false;
    enabled = false;
    for (const [node, home] of homes) {
      if (home.anchor.parentNode) home.anchor.after(node);
      if (home.html !== null) {
        node.innerHTML = home.html;
        if(home.help!==undefined)node.dataset.toolHelp=home.help;
        if (home.aria === null) node.removeAttribute("aria-label"); else node.setAttribute("aria-label", home.aria);
      }
    }
    strip.remove(); tools.remove(); oldPrimary.hidden = primaryHidden;
    toolbar.classList.remove("scene-board-tools-ready");
    toolbar.closest(".scene-stage")?.classList.remove("scene-board-tools-stage");
    return true;
  }
  return Object.freeze({ init, refresh, select, enhance, setEnabled, isEnabled: () => enabled });
})();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.DAWN_SCENE_BOARD_TOOLS.init(), { once: true });
else window.DAWN_SCENE_BOARD_TOOLS.init();
