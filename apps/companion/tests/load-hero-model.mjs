import fs from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";

// Load production normalizers and budgets without starting a Table or a browser.
export function loadHeroModel() {
  const context = { console, URL, URLSearchParams, crypto: { randomUUID }, location: { href: "http://localhost/", search: "" }, document: { body: {} }, localStorage: { getItem: () => null } };
  context.window = context;
  context.DAWN_SCENE_ENGINE = {};
  context.DAWN_TECHNIQUE_ENGINE = {};
  vm.createContext(context);
  const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  for (const file of ["data.js", "edition-lionwing.js", "edition-lionwing-ru.js", "logic.js", "hero-gadgets.js", "app-bootstrap.js"]) vm.runInContext(read(file), context);
  const core = read("app-core.js");
  vm.runInContext(core.slice(0, core.indexOf("let store=loadStore()")), context);
  vm.runInContext('let S=blankHero("lionwing");let Scene=blankScene("lionwing");', context);
  vm.runInContext(core.slice(core.indexOf("const allGifts="), core.indexOf("function budgetRow")), context);
  const events = read("app-builder-events.js");
  for (const name of ["abilityByKey", "abilityPrefix"]) vm.runInContext(events.split("\n").find(line => line.startsWith(`function ${name}(`)), context);
  const heroUi = read("hero-ui.js");
  vm.runInContext(heroUi.slice(0, heroUi.indexOf("const HERO_VIEW_STORAGE_KEY")), context);
  return {
    context,
    run: code => vm.runInContext(code, context),
    select(hero) { context.importedHero = hero; vm.runInContext('S=normalizeHero(importedHero);contentPreferences.edition=S.rulesEdition;', context); },
    snapshot() { return JSON.parse(vm.runInContext("JSON.stringify({hero:S,budgets:budgets(),issues:issues(),derived:derived()})", context)); },
  };
}
