import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../lionwing-ui.js",import.meta.url),"utf8");
const helper=source.slice(source.indexOf("function lwEffectSourcesHtml"),source.indexOf("function lwDirectorHtml"));
const statuses={
  "target:negative.помечен":{sources:[{sourceId:'mark<&"',actorId:"caster",duration:"endTurn",removable:false,suppressedBy:[]}]},
  "target:negative.испуган":{sources:[{sourceId:"fear:b",actorId:"caster",duration:"scene",removable:true,suppressedBy:["shield"]}]},
};
const Scene={actors:[{id:"target",name:"Цель <опасная>",effectStates:{"negative.помечен":{},"negative.испуган":{}}},{id:"caster",name:"Колдун & союзник"}]};
const context={Scene,LionwingEngine:{effectInstanceStatus:(_scene,targetId,effect)=>statuses[`${targetId}:${effect}`]},lwRules:()=>({effects:{positive:[],negative:[{id:"negative.помечен",name:"Помечен"},{id:"negative.испуган",name:"Испуган"}]}}),esc:value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;")};
vm.createContext(context);
vm.runInContext(`${helper}\nthis.renderSources=lwEffectSourcesHtml;`,context);
const html=context.renderSources([Scene.actors[0]]);

assert.match(html,/Цель &lt;опасная>/,"target names are escaped and visible");
assert.match(html,/Колдун &amp; союзник/,"source actor is displayed independently");
assert.match(html,/data-lw-target="target" data-lw-effect="negative\.помечен" data-lw-source="mark&lt;&amp;&quot;"/,"actions carry exact escaped identities");
assert.match(html,/до конца следующего Хода владельца срока/,"durations receive readable Russian labels");
assert.match(html,/data-lw-effect-source="remove"[^>]+disabled title="Этот источник нельзя снять вручную"/,"protected sources cannot be removed");
assert.match(html,/data-lw-effect-source="restore"[^>]+data-lw-suppression="shield"/,"restoration carries the exact suppression id");
assert.doesNotMatch(html,/data-lw-source="fear:b"[^>]*data-lw-effect-source="suppress"/,"suppressed sources do not offer another suppression");
assert.match(context.renderSources([]),/нет отдельных источников Эффектов/,"empty target state is explicit");

console.log("LionWing effects UI rendering passed: identity, escaping, durations, protected removal and restoration");
