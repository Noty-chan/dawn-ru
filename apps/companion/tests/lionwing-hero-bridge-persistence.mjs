import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=fs.readFileSync(path.join(root,"app-core.js"),"utf8");
const start=source.indexOf("function normalizeHeroLionwingBridge");
const end=source.indexOf("function normalizeHero(raw)",start);
assert.ok(start>=0&&end>start,"production hero bridge normalizer must be extractable");
const context={clamp:(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0))};
vm.createContext(context);
vm.runInContext(`${source.slice(start,end)}\nthis.normalize=normalizeHeroLionwingBridge;`,context);

const saved=context.normalize({choices:[{id:"drop"}],pausedChains:[{id:"drop"}],consequences:[{id:"c1",category:"boon",lossTarget:{kind:"boon",id:"gift.one",secret:"drop"},status:"applied",applied:true,manualNote:"ok",unknown:"drop"}],legacyNotes:[{id:"l1",type:"legacy-note",note:"remember",unknown:"drop"}]});
const plain=JSON.parse(JSON.stringify(saved));
assert.deepEqual(plain,{schema:1,consequences:[{schema:1,id:"c1",category:"boon",lossTarget:{kind:"boon",id:"gift.one"},status:"applied",applied:true,manualNote:"ok"}],legacyNotes:[{schema:1,id:"l1",type:"legacy-note",note:"remember"}]});
assert.equal("choices" in plain,false);
assert.equal("pausedChains" in plain,false);
assert.deepEqual(JSON.parse(JSON.stringify(context.normalize(plain))),plain,"persist/reload normalization must be stable");
console.log("LionWing hero consequence bridge persistence passed");
