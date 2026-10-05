"use strict";

// Hero-only storage and budgeting. This module does not mutate the combat Scene.
(function exposeHeroGadgets(global) {
  function normalize(raw, { normalizeAbility, uid }) {
    const ids = new Set();
    return (Array.isArray(raw) ? raw : []).slice(0, 30)
      .filter(item => item && typeof item === "object" && !Array.isArray(item))
      .map(item => {
        let id = typeof item.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(item.id) ? item.id : uid();
        if (ids.has(id)) id = uid();
        ids.add(id);
        return { id, status: item.status === "destroyed" ? "destroyed" : "active", ability: normalizeAbility({ ...item.ability, enabled: true }) };
      });
  }
  function spending(gadgets, legacySpent, costOf) {
    const recorded = (gadgets || []).filter(item => item.status !== "destroyed")
      .reduce((total, item) => total + costOf(item.ability), 0);
    const unrecorded = Math.max(0, Math.min(99, Number(legacySpent) || 0));
    return { recorded, unrecorded, total: recorded + unrecorded };
  }
  global.DAWN_GADGETS = Object.freeze({ normalize, spending });
})(window);

const HERO_GADGET_TEXT = Object.freeze({
  title: ["Гаджеты", "Gadgets"],
  help: ["Каждый гаджет — физический предмет с формулой Способности. Первые 3 Ранга оплачивает Дар «Технарь», остальное — общий бюджет. Другие персонажи получают от гаджета не больше 2 Преимуществ.", "Each gadget is a physical object with an Ability formula. Gearhead pays the first 3 Ranks; the rest use your shared budget. Other characters gain at most 2 Advantage from a gadget."],
  add: ["Добавить гаджет", "Add gadget"],
  unnamed: ["Новый гаджет", "New gadget"],
  destroyed: ["Разобран / уничтожен", "Dismantled / destroyed"],
  dismantle: ["Разобрать и вернуть Ранги", "Dismantle and refund Ranks"],
  rebuild: ["Собрать заново", "Rebuild"],
  remove: ["Удалить запись", "Delete record"],
  unrecorded: ["Ранги гаджетов без отдельных записей", "Gadget Ranks without individual records"],
  legacyHelp: ["Сохранённая сумма из прежнего листа. Когда опишете эти гаджеты отдельно, уменьшите её, чтобы не учитывать стоимость дважды.", "The saved amount from the old sheet. Reduce it as you record those gadgets individually to avoid counting their cost twice."],
  requires: ["Для использования гаджетов нужен Дар «Технарь».", "You need Gearhead to use gadgets."],
  incomplete: ["Заполните название, Глагол, Существительное и необходимое X у каждого активного гаджета.", "Fill in the name, Verb, Noun and required X for each active gadget."],
  cost: ["Стоимость", "Cost"],
  spent: ["Потрачено на гаджеты", "Spent on gadgets"],
  rank: ["Ранг", "Rank"],
});
function gadgetText(key) { return HERO_GADGET_TEXT[key]?.[contentPreferences.locale === "en" ? 1 : 0] || key; }
function gadgetByKey(key) { return typeof key === "string" && key.startsWith("gadget:") ? (S.gadgets || []).find(item => item.id === key.slice(7)) : null; }
function gadgetRankSpendFor(hero = S) { return window.DAWN_GADGETS.spending(hero.gadgets, hero.mods?.gadgetSpent, abilityCost); }
function gadgetLegacySpendMarkup() {
  const spend = gadgetRankSpendFor();
  return `<p>${esc(gadgetText("spent"))}: <strong>${spend.total}</strong></p><label>${esc(gadgetText("unrecorded"))}<input id="gadget-spent" type="number" min="0" max="99" value="${spend.unrecorded}"></label><small>${esc(gadgetText("legacyHelp"))}</small>`;
}
function heroGadgetIssues() {
  // Losing Gearhead hides and suspends the saved records; it must not erase them.
  if (!hasGift("Gearhead")) return [];
  const active = (S.gadgets || []).filter(item => item.status !== "destroyed");
  const problems = [];
  if (active.some(({ ability }) => !ability.name.trim() || !ability.words.verbs.length || !ability.words.nouns.length || Object.values(ability.words).flat().some(id => !wordById(id, ability)) || (abilityNeedsX(ability) && !wordById(ability.xNoun, ability)))) problems.push(["bad", gadgetText("incomplete")]);
  return problems;
}
function renderHeroGadgets() {
  const root = $("hero-gadgets");
  if (!root) return;
  const enabled = hasGift("Gearhead"), gadgets = S.gadgets || [];
  const previous = new Set([...root.querySelectorAll("[data-gadget-card]")].map(card => card.dataset.gadgetCard));
  const opened = new Set([...root.querySelectorAll("[data-gadget-card][open]")].map(card => card.dataset.gadgetCard));
  root.hidden = !enabled;
  root.innerHTML = `<div class="subpanel-head"><div><h3>${esc(gadgetText("title"))}</h3><small>${esc(gadgetText("help"))}</small></div><button type="button" data-gadget-add ${enabled && gadgets.length < 30 ? "" : "disabled"}>${esc(gadgetText("add"))}</button></div>${!enabled ? `<p class="warning bad">${esc(gadgetText("requires"))}</p>` : ""}<div class="hero-gadget-list">${gadgets.map(gadget => {
    const destroyed = gadget.status === "destroyed", key = `gadget:${gadget.id}`;
    return `<details class="hero-gadget-card" data-gadget-card="${gadget.id}" ${opened.has(gadget.id) || !previous.has(gadget.id) || gadgets.length === 1 ? "open" : ""}><summary><strong>${esc(gadget.ability.name || gadgetText("unnamed"))}</strong><span>${destroyed ? esc(gadgetText("destroyed")) : `${esc(gadgetText("rank"))} ${gadget.ability.rank} · ${esc(gadgetText("cost"))} ${abilityCost(gadget.ability)}`}</span></summary>${renderAbilityEditor(gadget.ability, key, abilityPrefix(key))}<div class="button-row"><button type="button" data-gadget-status="${gadget.id}">${esc(gadgetText(destroyed ? "rebuild" : "dismantle"))}</button>${destroyed ? `<button type="button" class="remove" data-gadget-remove="${gadget.id}">${esc(gadgetText("remove"))}</button>` : ""}</div></details>`;
  }).join("")}</div>`;
}
function heroGadgetsSheetMarkup() {
  if (!hasGift("Gearhead") || !(S.gadgets || []).length) return "";
  return `<section class="hero-sheet-card hero-gadgets-sheet"><h3>${esc(gadgetText("title"))}</h3>${S.gadgets.map(gadget => `<article><h4>${esc(gadget.ability.name || gadgetText("unnamed"))} · ${esc(gadgetText("rank"))} ${gadget.ability.rank}</h4>${gadget.status === "destroyed" ? `<p>${esc(gadgetText("destroyed"))}</p>` : `<p>${esc(abilityFormula(gadget.ability))} · ${esc(gadgetText("cost"))} ${abilityCost(gadget.ability)}</p><p>${md(gadget.ability.desc)}</p>`}</article>`).join("")}</section>`;
}
function heroGadgetDiceSources() {
  return hasGift("Gearhead") ? (S.gadgets || []).filter(item => item.status !== "destroyed").map(item => ({ value: `gadget|${item.id}`, type: "gadget", id: item.id, label: `${gadgetText("title")}: ${item.ability.name || abilityFormula(item.ability)}`, count: item.ability.rank })) : [];
}
function wireHeroGadgets() {
  $("hero-gadgets").addEventListener("click", event => {
    const add = event.target.closest("[data-gadget-add]"), status = event.target.closest("[data-gadget-status]"), remove = event.target.closest("[data-gadget-remove]");
    if (add) {
      if (!hasGift("Gearhead") || (S.gadgets || []).length >= 30) return;
      S.gadgets ||= [];
      S.gadgets.push({ id: uid(), status: "active", ability: { ...blankAbility(), enabled: true, name: gadgetText("unnamed") } });
    } else if (status) {
      const gadget = (S.gadgets || []).find(item => item.id === status.dataset.gadgetStatus);
      if (!gadget || (gadget.status === "destroyed" && !hasGift("Gearhead"))) return;
      gadget.status = gadget.status === "destroyed" ? "active" : "destroyed";
    } else if (remove) {
      S.gadgets = (S.gadgets || []).filter(item => item.id !== remove.dataset.gadgetRemove || item.status !== "destroyed");
    } else return;
    renderAll();
  });
}
