import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "console.js"), "utf8");
const css = fs.readFileSync(path.join(root, "console.css"), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML ids must be unique");
for (const match of app.matchAll(/\$\("([A-Za-z][\w-]+)"\)/g)) {
  assert.ok(ids.includes(match[1]), `console.js references missing #${match[1]}`);
}
for (const file of ["config.js", "model.js", "network.js", "console.js"]) assert.match(html, new RegExp(`src="${file.replace(".", "\\.")}"`));
assert.ok(fs.existsSync(path.join(root, "simulation-worker.js")), "background simulation worker must exist");
assert.match(html, /supabase-js@2\.110\.3/);
assert.match(css, /@media \(orientation: portrait\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(app, /AudioContext/);
assert.match(app, /security\.fire/);
assert.match(app, /engineer\.overdrive/);
assert.match(app, /driver\.cutoff/);
console.log(`OK: ${ids.length} unique DOM ids and controller bindings validated.`);
