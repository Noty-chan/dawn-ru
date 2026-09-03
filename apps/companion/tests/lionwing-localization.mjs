import assert from "node:assert/strict";

globalThis.window = {};
await import("../edition-lionwing.js");
await import("../edition-lionwing-ru.js");

const english = window.DAWN_LIONWING_DATA;
const russian = window.DAWN_LIONWING_RU;
assert.equal(russian.editionId, english.editionId);
assert.equal(Object.keys(russian.outlooks).length, english.outlooks.length);

let translatedNewBoons = 0;
for (const outlook of english.outlooks) {
  const overlay = russian.outlooks[outlook.id];
  assert.ok(overlay?.name, `missing Russian outlook name: ${outlook.id}`);
  assert.ok(overlay?.description, `missing Russian outlook description: ${outlook.id}`);
  for (const boon of outlook.gifts.filter(item => item.introducedIn)) {
    assert.ok(overlay.gifts?.[boon.id]?.name, `missing new boon name: ${boon.id}`);
    assert.ok(overlay.gifts?.[boon.id]?.text, `missing new boon text: ${boon.id}`);
    translatedNewBoons += 1;
  }
}
assert.equal(translatedNewBoons, 21);

console.log(`LionWing RU overlay QA passed: 10 Outlooks, ${translatedNewBoons} new Boons`);
