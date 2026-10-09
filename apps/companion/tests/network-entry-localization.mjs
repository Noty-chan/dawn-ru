import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root=new URL("../",import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),"utf8");
const nodes=new Map();
const $=id=>{if(!nodes.has(id))nodes.set(id,{value:"",textContent:"",innerHTML:"",hidden:false,disabled:false});return nodes.get(id)};
let sync={authenticated:true,status:"online",sceneId:"qa",canNarrate:false,role:"player",version:5,campaignName:"QA <table>",presence:[{userId:"p",role:"player",displayName:"QA <player>"}],userId:"p"};
let queue={pending:0,failed:0};
const context={console,URL,Set,Map,$,document:{activeElement:null,body:{dataset:{}},documentElement:{},querySelectorAll:()=>[]},contentPreferences:{locale:"en",edition:"lionwing"},location:{href:"https://example.test/companion/index.html?lang=ru&mode=build#profile"},Sync:{state:()=>sync},networkV2QueueStatus:()=>queue,pendingSceneCommands:[],delayedAutomaticCommands:new Set(),NetworkV2:{AUTOMATIC_COMMANDS:new Set()},S:{player:"QA"},store:{mode:"build"},Scene:{actors:[]},esc:value=>String(value??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))};
context.window=context;context.globalThis=context;
vm.createContext(context);
for(const file of ["localization.js","locale-ru.js","locale-en-builder.js"])vm.runInContext(read(file),context,{filename:file});
context.t=(key,params)=>context.DAWN_I18N.t(key,params);
const events=read("app-sync-events.js"),play=read("play-ui.js"),commands=read("scene-sync-ui.js");
for(const name of ["sceneDisplayName","sceneSpaceDisplayName"])vm.runInContext(read("scene-ui.js").split(/\r?\n/).find(line=>line.startsWith(`function ${name}(`)),context);
vm.runInContext(events.slice(events.indexOf("function inviteLink("),events.indexOf("async function publishCurrentHero")),context);
vm.runInContext(play.slice(play.indexOf("function renderSync("),play.indexOf("function renderSceneHeroSheet(")),context);
vm.runInContext(commands.slice(commands.indexOf("function commandSummary("),commands.indexOf("function canonicalPlayerEvents(")),context);

// Invitation destination carries the selected language/edition, without stale route/hash parameters.
for(const [locale,edition] of [["en","lionwing"],["ru","ru-v0.9"]]){
  context.contentPreferences={locale,edition};
  const url=new URL(context.inviteLink("qa+token"));
  assert.equal(url.searchParams.get("lang"),locale);assert.equal(url.searchParams.get("edition"),edition);
  assert.equal(url.searchParams.get("invite"),"qa+token");assert.equal(url.searchParams.get("mode"),"play");assert.equal(url.hash,"");
}

context.DAWN_I18N.setLocale("en");context.renderSync();
const defaultScene={name:"Структурированный бой"},defaultBoard={id:"main",name:"Основное поле"};
assert.equal(context.sceneDisplayName(defaultScene),"Structured combat");assert.equal(context.sceneSpaceDisplayName(defaultBoard),"Main board");
assert.equal(context.sceneDisplayName({name:"My custom table"}),"My custom table");
assert.equal(context.sceneSpaceDisplayName({id:"custom",name:"Основное поле"}),"Основное поле","custom board names remain user text");
assert.equal(defaultScene.name,"Структурированный бой");assert.equal(defaultBoard.name,"Основное поле","presentation does not rewrite saved names");
assert.equal($("scene-sync-title").textContent,"Player table");
assert.equal($("scene-sync-status").textContent,"Synchronized");
assert.equal($("sync-role-label").textContent,"Player · Scene version 5");
assert.match($("sync-presence").innerHTML,/QA &lt;player&gt;/);assert.doesNotMatch($("sync-presence").innerHTML,/[А-Яа-яЁё]/);
assert.equal(context.commandSummary({command_type:"join_hero"}),"Hero ready to join the Scene");
queue={pending:1,failed:0};context.renderSync();assert.equal($("scene-sync-status").textContent,"Saving…");
queue={pending:0,failed:1};context.renderSync();assert.equal($("scene-sync-status").textContent,"Changes not saved");assert.equal($("sync-reconnect").textContent,"Retry saving");
const original=JSON.stringify(sync);
context.DAWN_I18N.setLocale("ru");context.renderSync();assert.equal($("sync-role-label").textContent,"Игрок · версия Сцены 5");
context.DAWN_I18N.setLocale("en");context.renderSync();assert.equal(JSON.stringify(sync),original,"language switching preserves session and user data");

// Every scoped static entry/dock message exists in both locales, and EN needs no RU fallback.
const html=read("index.html"),keys=[...html.matchAll(/data-i18n(?:-placeholder|-aria-label|-title)?="((?:sync\.|scene\.panel\.)[^"]+)"/g)].map(match=>match[1]);
for(const locale of ["ru","en"]){context.DAWN_I18N.setLocale(locale);for(const key of keys){const value=context.t(key);assert.notEqual(value,key,key);if(locale==="en")assert.doesNotMatch(value,/[А-Яа-яЁё]/,key)}}
const attributes={};
context.DAWN_I18N.localizeDocument({querySelectorAll:selector=>selector==="[data-i18n-title]"?[{dataset:{i18nTitle:"scene.panel.networkHelp"},setAttribute:(name,value)=>attributes[name]=value}]:[]});
assert.equal(attributes.title,"Create, open, or leave a shared table");
console.log("Shared-table entry localization: EN/RU controls, status, roles, escaped presence, invite destination and title switching passed");
