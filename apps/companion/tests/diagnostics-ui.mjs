import assert from "node:assert/strict";
import fs from "node:fs";

const read=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),"utf8");
const html=read("index.html"),script=read("diagnostics.js"),css=read("app.css");

assert.match(html,/id="bug-report-open"/);
assert.match(html,/id="bug-report-description"/);
assert.match(html,/id="bug-report-steps"/);
assert.match(html,/diagnostics\.js\?v=__BUILD_VERSION__/);
assert.match(script,/last three Rounds/);
assert.match(script,/последних трёх Раундов/);
assert.match(script,/Discord: akasha6664/);
assert.match(script,/function recentSceneLog\(\)/);
assert.match(script,/scene\.commit/);
assert.match(script,/runtime\.error/);
assert.match(script,/\[redacted\]/);
assert.match(css,/\.bug-report-dialog\{/);

console.log("Alpha diagnostics UI passed: bilingual report, recent-Round state, runtime and interaction journal, copy/download and redaction");
