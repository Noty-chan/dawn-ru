import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeReviewedSource, reviewedSourceDigest } from "../reviewed-source-digest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assert.equal(normalizeReviewedSource("a\r\nb\rc\n"), "a\nb\nc\n");
assert.equal(reviewedSourceDigest(["первая\r\nстрока\r\n", "вторая\rстрока"]), reviewedSourceDigest(["первая\nстрока\n", "вторая\nстрока"]), "Reviewed source digest must be independent of checkout line endings");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "logic.js"), "utf8"), context);
vm.runInNewContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), context);
const data = context.window.DAWN_DATA;
const logic = context.window.DAWN_LOGIC;
assert.deepEqual(JSON.parse(JSON.stringify(logic.reconcileHealthRuntime({ current: null, nextMax: 6 }))), { current: 6, maximum: 6 }, "A fresh hero starts at the rules-derived maximum Health");
assert.deepEqual(JSON.parse(JSON.stringify(logic.reconcileHealthRuntime({ current: 10, previousMax: 10, nextMax: 6 }))), { current: 6, maximum: 6 }, "Changing Body cannot leave current Health above the new maximum");
assert.deepEqual(JSON.parse(JSON.stringify(logic.reconcileHealthRuntime({ current: 7, previousMax: 10, nextMax: 12 }))), { current: 9, maximum: 12 }, "Changing maximum Health preserves missing Health instead of granting a free heal");
assert.deepEqual(JSON.parse(JSON.stringify(logic.reconcileHealthRuntime({ current: 6, nextMax: 10 }))), { current: 6, maximum: 10 }, "Legacy saves without a remembered maximum retain valid current Health");
assert.deepEqual(JSON.parse(JSON.stringify(logic.reconcileHealthRuntime({ current: 0, previousMax: 0, nextMax: 10 }))), { current: 10, maximum: 10 }, "A legacy 0/0 Health placeholder initializes the hero at full Health");
assert.deepEqual(JSON.parse(JSON.stringify(logic.reconcileSceneActorHealth({ current: 0, previousMax: 6, nextMax: 6, existing: false }))), { current: 6, maximum: 6 }, "A newly spawned table actor starts at full Health even when the saved character sheet was at zero");
assert.deepEqual(JSON.parse(JSON.stringify(logic.reconcileSceneActorHealth({ current: 2, previousMax: 6, nextMax: 8, existing: true }))), { current: 4, maximum: 8 }, "Refreshing an existing table actor preserves its missing Health");
const appFiles = ["localization.js", "locale-ru.js", "app-bootstrap.js", "app-reference-data.js", "app-core.js", "hero-ui.js", "scene-ui.js", "gm-library.js", "scene-effects.js", "scene-actions-ui.js", "scene-sync-ui.js", "play-ui.js", "app-builder-events.js", "app-sync-events.js", "app-scene-events.js", "app-play-events.js", "app.js"];
const appSource = appFiles.map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const companionMarkup = fs.readFileSync(path.join(root, "index.html"), "utf8");
const companionCss = fs.readFileSync(path.join(root, "app.css"), "utf8");
const publicProjectionMigration = fs.readFileSync(path.resolve(root, "..", "..", "supabase", "migrations", "202608110001_harden_public_scene_projection.sql"), "utf8");
assert.match(companionMarkup, /id="app-update-banner"/, "An open table must expose a visible path to the latest deployed build");
assert.match(appSource, /APP_BUILD_VERSION[\s\S]+update-check=[^)]*Date\.now\(\)[\s\S]+cache:"no-store"/, "The companion must compare its running build with uncached deployed markup");
assert.match(appSource, /visibilitychange[\s\S]+document\.hidden[\s\S]+check\(\)/, "Returning to a stale table tab must trigger an update check");
assert.match(companionMarkup, /data-scene-panel="network"/, "The immersive table must expose network controls in its dock");
assert.match(companionMarkup, /data-scene-panel="network"[^>]*>Сеть<\/button>\s*<button[^>]+data-scene-panel="log"/, "The network button must sit directly above the Scene log");
assert.match(companionMarkup, /id="scene-sync-panel"[^>]+data-scene-panel-content="network"/, "The network controls must open as a table rail panel");
assert.match(companionMarkup, /id="sync-leave-table"[^>]+title="Выйти из общего стола"/, "A connected table must expose a quick leave action in the visible header");
assert.match(appSource, /sceneRail\.prepend\(syncPanel\)/, "The network panel must be mounted into the immersive table rail");
assert.match(appSource, /if\(presenceNode\.innerHTML!==presenceMarkup\)presenceNode\.innerHTML=presenceMarkup/, "Unchanged presence markup must not be recreated on every realtime status event");
assert.doesNotMatch(fs.readFileSync(path.join(root, "sync.js"), "utf8"), /emit\("presence",state\.presence\);emit\("status"\)/, "Presence events must not trigger a duplicate status render");
assert.doesNotMatch(fs.readFileSync(path.join(root, "sync.js"), "utf8"), /if\(session&&state\.sceneId\).*scheduleReconnect/, "Auth refreshes must not rebuild an already subscribed Scene channel");
assert.match(appSource, /acceptPreparedRemoteCommand[\s\S]+setConfirmedScene\?\.\(Scene\)/, "Accepting a joined hero must update the Narrator's confirmed network Scene before the next roll");
assert.match(fs.readFileSync(path.join(root, "sync.js"), "utf8"), /subscriptionIsActive=\(\)=>generation===channelGeneration/, "Callbacks from an intentionally removed realtime channel must be ignored");
assert.doesNotMatch(appSource, /Sync\?\.on\("status",\(\)=>\{[^}]*renderScene\(\)/, "A connection-status repaint must not rebuild the table");
assert.match(appSource, /openDetails=new Map/, "Expanded hero rules must survive a canonical Scene repaint");
assert.match(companionMarkup, /id="stress-trackers"/, "Tools must expose the shared Stress tracker");
assert.match(appSource, /key:"stress",value:next/, "The narrator edits Stress through a canonical Scene event");
assert.match(appSource, /scene\.undo=\[\]/, "Recursive undo snapshots must never fill localStorage");
assert.match(appSource, /indexedDB\.open\(HERO_MEDIA_DB,1\)/, "Large hero images must move out of localStorage");
assert.match(appSource, /HERO_STORAGE_KEY[\s\S]+function loadStoredHeroes\([\s\S]+storedHeroes\.heroes/, "Hero sheets must restore from storage independently of the heavier table Scene");
assert.match(appSource, /function persistHeroStore\([\s\S]+localStorage\.setItem\(HERO_STORAGE_KEY[\s\S]+sync\.role==="player"[\s\S]+localStorage\.removeItem\(STORAGE_KEY\)/, "An online player's hero sheet must survive local Scene quota exhaustion");
assert.match(companionMarkup, /id="scene-clear-movement-traces"/, "The narrator toolbar must expose movement-trace cleanup");
assert.match(appSource, /sceneReferenceMarkup!==markup[\s\S]+openRuleIds[\s\S]+details\.open=openRuleIds\.has/, "Unchanged rule cards must retain their open state across Scene renders");
assert.match(appSource, /health=Logic\.reconcileSceneActorHealth\(\{current:base\.hp,previousMax:base\.maxHp,nextMax:derived\.hp,existing:hasSceneHealth\}\)/, "A newly spawned hero starts at full Health while an existing table actor retains battle damage");
assert.match(appSource, /Number\.isFinite\(Number\(base\.focus\)\)\?Number\(base\.focus\)-Number\(base\.techniqueFocusBonus\|\|0\):derived\.focus/, "A hero entering combat starts with Focus derived from Spirit while an existing table actor keeps current Focus");
assert.match(appSource, /if\(!sceneCombatStarted\(scene\)\)\{delete base\.focus;delete base\.hp;delete base\.maxHp\}/, "Refreshing a remotely submitted hero before combat must repair its starting Focus and Health");
assert.match(appSource, /if\(!sceneCombatStarted\(Scene\)\)\{delete base\.focus;delete base\.hp;delete base\.maxHp\}/, "Refreshing a local hero before combat must repair its starting Focus and Health");
assert.match(appSource, /feed\.innerHTML=\[\.\.\.rolls\]\.reverse\(\)\.map/, "The newest public roll must stay at the bottom edge of the upward-growing feed");
assert.match(appSource, /function sceneTrayHeroActor\(\)[\s\S]+selected\.team==="hero"[\s\S]+active\.team==="hero"/, "The Narrator tray follows selected or active heroes and never exposes hero actions for enemies");
assert.match(companionMarkup, /option value="crowd">Зона массовки/, "The terrain painter exposes canonical Fodder Zones");
assert.match(appSource, /source\.kind==="crowd"[\s\S]+actor\.crowdGroupId/, "Scene normalization preserves Fodder identity and its shared visual type");
assert.match(appSource, /actor\.crowdSubtype=\["seeker","vortex"\][\s\S]+actor\.seekerTargetId[\s\S]+actor\.seekerDamage[\s\S]+actor\.vortexOwnerId/, "Scene import preserves special Fodder provenance for Hound Master Seekers and Vortex flows");
assert.match(appSource, /editTargets=actor\.kind==="crowd"[\s\S]+targets\.forEach\(item=>item\.tokenImage=image\)/, "Renaming or uploading a token updates every zone of that Fodder type");
assert.match(companionCss, /\.scene-token\.crowd\{[^}]*border-radius:7px[^}]*repeating-linear-gradient/, "Fodder Zones are visually distinct from circular character tokens");
assert.match(companionCss, /modifier-carrier-pulse[\s\S]+modifier-artillery-cell[\s\S]+modifier-gargantuan-body-cell[\s\S]+modifier-vortex-edge/, "Rule-critical Enemy Modifiers have distinct carrier, danger-area, body-edge, and spawn-edge visuals");
assert.match(appSource, /compoundId:typeof enemy\?\.compoundId[\s\S]+crowdGroupId:/, "Encounter normalization preserves Compound Enemy and Fodder identities");
assert.match(fs.readFileSync(path.join(root, "index.html"), "utf8"), /id="scene-crowd-style"[\s\S]+id="scene-crowd-team"[\s\S]+id="scene-crowd-symbol"[\s\S]+id="scene-crowd-color"/, "Narrator can create visually distinct allied or hostile Fodder groups");
assert.match(appSource, /data-crowd-add-group[\s\S]+data-crowd-remove-defeated[\s\S]+data-crowd-remove-group/, "Narrator has group-level Fodder add and cleanup controls");
assert.match(fs.readFileSync(path.join(root, "scene-triggers.js"), "utf8"), /fodder-move-select[\s\S]+fodder-round-batch/, "Canonical Fodder movement and Round-end damage are surfaced as typed prompts");
assert.match(appSource, /fodder-batch-editor[\s\S]+data-fodder-batch-zone[\s\S]+data-fodder-batch-submit/, "Narrator resolves all eligible Fodder zones through one editable damage interface");
assert.match(appSource, /compoundIds=new Map\(\)[\s\S]+compoundCells=new Map\(\)/, "Encounter deployment remaps Compound groups and keeps their parts in one cell");
assert.match(appSource, /parts\.length<2[\s\S]+part\.compoundId=null/, "Removing Compound parts cannot leave an unusable one-part Compound identity");
assert.match(appSource, /sceneActorSpace[\s\S]+compound\.active\?compound\.parts:\[actor\][\s\S]+moving\.forEach/, "Moving a Compound part between spaces must move the complete enemy");
assert.match(appSource, /function placeActorsSafely[\s\S]+compound:[\s\S]+Резерв после удаления[\s\S]+Резерв после смены режима/, "Space deletion and mode changes repack whole Compound groups without stacking overflow in one cell");
assert.match(appSource, /function renderSceneManager[\s\S]+ownerActorId[\s\S]+Создал:/, "Additional spaces identify their creating actor in the Scene manager");
assert.match(appSource, /function removeManagedSceneSpace[\s\S]+id==="main"[\s\S]+Основное поле удалить нельзя/, "The canonical main space cannot be removed even when the spaces array is reordered");
assert.match(appSource, /function removeManagedSceneSpace[\s\S]+placeActorsSafely\(scene,moving,fallback[\s\S]+scene\.objects=scene\.objects\.filter[\s\S]+scene\.spaces=scene\.spaces\.filter/, "Space removal evacuates its actors to the main field before deleting field entities and the space itself");
assert.match(appSource, /const canonicalCell=[\s\S]+normalizedCells=[\s\S]+base\.objects=base\.objects\.map[\s\S]+base\.topology\.cuts=/, "Imported actors and field entities are repaired to canonical cells within their actual space bounds");
assert.match(appSource, /mutator\(Scene\);Scene=normalizeScene\(Scene\)/, "Every direct Narrator transaction repairs stale references before persistence or networking");
assert.match(appSource, /restoreSceneHistory[\s\S]+restored\.version=Number\(current\.version[\s\S]+syncHeroFromScene\(\)/, "Undo and redo are monotonic Scene revisions and refresh the linked hero runtime");
assert.match(appSource, /function sceneCore[\s\S]+structuredClone\(base\)[\s\S]+JSON\.parse\(JSON\.stringify\(base\)\)/, "Scene snapshots must not share nested mutable action or resource state with the live table");
assert.match(appSource, /pendingActionPlan=null;scene\.pendingPrompt=null;scene\.triggerQueue=\[\];scene\.challengeRequest=null;scene\.opposedRoll=null/, "Starting a new Scene must close every Action, prompt, trigger, and roll-request lifecycle");
assert.match(appSource, /persistentEffects[\s\S]+effectStates=Object\.fromEntries/, "Starting a new Scene must expire Scene-bound Effects without deleting explicitly persistent Effects");
assert.match(appSource, /Narrator cleanup must remain available[\s\S]+data-scene-remove-actor[\s\S]+scene-remove-npcs/, "Narrator cleanup remains available when a stale rules chain would otherwise block the table");
assert.match(publicProjectionMigration, /'rollFeed'[\s\S]+visibility','public'\)<>'gm'/, "The server projection must keep public rolls shared while hiding Narrator-only rolls");
assert.match(publicProjectionMigration, /'pendingAction'[\s\S]+'pendingPrompt'[\s\S]+'triggerQueue'[\s\S]+'challengeRequest'[\s\S]+'opposedRoll'/, "The server projection must sanitize every live combat lifecycle that can reference a hidden actor");
assert.match(appSource, /deployment=new Set\([\s\S]+type==="deploy-enemy"/, "Encounter deployment uses explicit enemy deployment zones");
assert.match(appSource, /gmDeployTerrainCells[\s\S]+availableEncounterCell/, "Encounter deployment avoids saved blocking Terrain");
assert.match(appSource, /if\(Scene\.selectedActor!==actor\.id\)\{Scene\.targetIds=\[\];Scene\.targetCells=\[\]\}[\s\S]+Scene\.targetIds=\[\];Scene\.targetCells=\[\];Scene\.selectedActor=actor\.id/, "Switching the controlled actor cannot retain stale empty-cell targets from another character");
assert.match(appSource, /const BUILTIN_ENCOUNTERS=Object\.freeze\(\[/, "Narrator tools provide reusable built-in encounter presets");
assert.match(appSource, /id:"builtin\.svetozar-team"[\s\S]+compoundId:"svetozar"[\s\S]+enemy\.common\.coordinator[\s\S]+name:"Мира"[\s\S]+name:"Том"[\s\S]+name:"Нейра"[\s\S]+name:"Бранн"/, "The six-hour battle test has a deployable Svetozar-team preset with a Compound boss and named allies");
assert.match(appSource, /Светозар · Тройной взгляд Сурьи[\s\S]+maxHp:13,hp:13[\s\S]+Светозар · Усилитель Сурьи[\s\S]+maxHp:13,hp:13/, "Svetozar deploys as two 13-Health parts sharing one 26-Health Compound pool");
assert.match(appSource, /data-gm-encounter-copy/, "A built-in encounter can be copied into the user's editable library");
assert.doesNotMatch(appSource, /commitScene\(`Стены расстановки:/, "Encounter deployment must not split Walls into a second undo transaction");
assert.match(appSource, /Резерв героев/, "A full preset has a safe overflow space instead of stacking excess heroes in one cell");
assert.match(appSource, /Зоны Развёртывания задаются сценарием; это не фиксированные квадраты 2×2/, "The preset UI must not present a 2×2 deployment zone as a universal rule");
assert.ok(appSource.includes('canonicalGroup:true')&&appSource.includes('Канонический состав: Т3 Громила + Т3 Бехемот + Т3 Гигант'), "The canonical compound-enemy example is available at its printed Tier");
assert.match(appSource, /defined=\(value,fallback\)[\s\S]+source\.maxHp,stats\.health/, "Sparse built-in blueprints derive Health from enemy rules instead of spawning as 1 HP placeholders");
assert.match(companionMarkup, /id="scene-export-table"[\s\S]+id="scene-import-table"[\s\S]+id="scene-save-recovery"[\s\S]+id="scene-restore-recovery"/, "Narrator tools expose downloadable and local table recovery paths");
assert.match(appSource, /TABLE_BACKUP_FORMAT="dawn-ru-table-backup"[\s\S]+normalizedTableBackup/, "Table backups use a versioned normalized format with legacy migration");
assert.match(appSource, /saveTableRecovery[\s\S]+writeHeroMedia\(\[\{key:TABLE_RECOVERY_KEY/, "Large local recovery points use IndexedDB instead of competing with the Scene for localStorage quota");
assert.match(appSource, /templateScene=sceneCore\(Scene\)[\s\S]+templateScene\.spaces\.length/, "Saved encounter presets preserve the complete multi-space table and its media");
assert.match(appSource, /compound\.defenseType==="armor"[\s\S]+data-scene-compound-defense/, "Compound Enemies expose one explicit shared defense rather than stacking Armor and Evasion");
assert.match(companionMarkup, /<section class="compound-builder"[^>]+aria-labelledby="compound-builder-title"/, "Compound Enemy creation must stay visible in the Narrator add panel instead of hiding inside a collapsed disclosure");
assert.doesNotMatch(companionMarkup, /<details[^>]*>(?:(?!<\/details>)[\s\S])*id="scene-compound-parts"/, "Compound Enemy creation must not regress into a closed details element");
assert.match(appSource, /data-compound-part[\s\S]+updateCompoundBuilderSelection[\s\S]+parts\.length<2/, "Compound Enemy creation must expose touch-friendly parts and require at least two selected profiles");
assert.match(appSource, /data-core-action="\$\{esc\(action\.id\)\}" data-core-actor="\$\{esc\(actor\.id\)\}"/, "Narrator tray actions retain the delegated hero identity");
assert.match(appSource, /activeSceneView\(\)==="gm"&&button\.dataset\.coreActor\)pendingCoreActorId=button\.dataset\.coreActor/, "Clicking a Narrator tray action delegates it before preparation");
assert.match(appSource, /querySelector\("article:last-child"\)/, "Roll animation must target the newest bottom card");
assert.match(appSource, /if\(performance\.now\(\)<sceneSuppressBoardClickUntil\)/, "A synthetic click after dropping a token must not move the previously selected actor");
assert.match(appSource, /actorId=event\.dataTransfer\.getData\("text\/plain"\)\|\|sceneDragActorId/, "A dropped token must be resolved from its drag payload, not Scene selection");
assert.match(appSource, /requestAnimationFrame\(\(\)=>\{const actor=Scene\.actors\.find\(item=>item\.id===actorId\)/, "Token movement must wait until the native drop animation has completed");
assert.doesNotMatch(appSource, /queueScene\?\.\(sceneSnapshot\(\),"tools\.clocks\.migrate"\)/, "Opening shared clocks must not race an event batch with a stale snapshot migration");
assert.match(appSource, /clock-add-progress/);
assert.match(appSource, /clock-add-danger/);
assert.match(appSource, /data-clock-save/);
assert.match(appSource, /session-clock\.kind/);
assert.match(appSource, /session-clock\.size/);
assert.match(appSource, /closest\("\[data-clock-save\]"\)[\s\S]+closest\("\[data-clock-remove\]"\)/, "clock controls must use resilient delegated button lookup");
assert.match(companionCss, /\.clock-head\{[^}]*grid-template-columns:minmax\(0,1fr\)/, "the clock name must receive a full-width row");
assert.match(appSource, /data-clock-name[^>]+maxlength="120"/, "clock names must remain editable up to the Scene limit");
assert.match(appSource, /readOnlyCard[\s\S]+clock-readonly[\s\S]+<span class="segment/, "players must receive non-interactive clock cards");
assert.match(appSource, /addActions\.hidden=locked/, "clock creation controls must be hidden from players");
assert.match(companionCss, /\.segments\{[^}]*flex-wrap:wrap/, "large clocks must wrap instead of overflowing into the neighbouring group");
const cockpitSource = fs.readFileSync(path.join(root, "vtt-concepts.js"), "utf8");
const appCoreFile = fs.readFileSync(path.join(root, "app-core.js"), "utf8");
const sceneCoreSource = appCoreFile.slice(appCoreFile.indexOf("function blankScene"), appCoreFile.indexOf("function normalizeScene"));
const appCoreContext = { console };
vm.createContext(appCoreContext);
vm.runInContext(`const uid=()=>"test-id";const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));function cleanArray(value){return Array.isArray(value)?value.filter(item=>typeof item==="string"):[]}${sceneCoreSource}`, appCoreContext);
const freshCampaignScene = vm.runInContext("sceneCore(blankScene())", appCoreContext);
assert.equal(freshCampaignScene.actors.length, 0, "A newly created campaign must not inherit actors from the current local Scene");
assert.equal(freshCampaignScene.objects.length, 0, "A newly created campaign must not inherit terrain from the current local Scene");
assert.equal(freshCampaignScene.markers.length, 0, "A newly created campaign must not inherit markers from the current local Scene");
assert.equal(freshCampaignScene.log.length, 0, "A newly created campaign must start with an empty event log");
const detachedSnapshot = vm.runInContext(`(()=>{const raw={spaces:[{id:"main",width:7,height:7}],actors:[{id:"hero",team:"hero",space:"main",ruleResources:{test:{value:1}}},{id:"enemy",team:"enemy",space:"main"}],pendingAction:{actorId:"hero",targetIds:["enemy"],responses:{enemy:{choice:"pending"}}}};const snapshot=sceneCore(raw);raw.actors[0].ruleResources.test.value=9;raw.pendingAction.responses.enemy.choice="pass";return{resource:snapshot.actors[0].ruleResources.test.value,response:snapshot.pendingAction.responses.enemy.choice}})()`, appCoreContext);
assert.deepEqual(JSON.parse(JSON.stringify(detachedSnapshot)), { resource: 1, response: "pending" }, "A saved Scene snapshot must remain detached from later resource and Reaction mutations");
const persistedDomain = vm.runInContext(`sceneCore({spaces:[{id:"main",width:7,height:7},{id:"inner-world-hero",name:"Внутренний мир",width:3,height:3,returnSpaceId:"main",ownerActorId:"hero"}],actors:[{id:"hero",team:"hero",space:"inner-world-hero"}]})`, appCoreContext);
assert.deepEqual(JSON.parse(JSON.stringify(((space) => ({ returnSpaceId: space.returnSpaceId, ownerActorId: space.ownerActorId }))(persistedDomain.spaces[1]))), { returnSpaceId: "main", ownerActorId: "hero" }, "Scene persistence retains validated Inner World ownership and return-space metadata");
const repairedScene = vm.runInContext(`sceneCore({spaces:[{id:"main",width:7,height:7}],actors:[{id:"enemy",team:"enemy",space:"main",x:99,y:99,compoundId:"orphan",compoundBaseSpeed:4,speed:9}],objects:[{id:"area",space:"main",type:"danger",cells:["1,1","99,99"]}],markers:[{id:"mark",space:"main",x:99,y:99}],topology:{cuts:[{id:"cut",space:"main",cells:["2,2","99,99"]}]}})`, appCoreContext);
assert.deepEqual(JSON.parse(JSON.stringify({ x: repairedScene.actors[0].x, y: repairedScene.actors[0].y, compoundId: repairedScene.actors[0].compoundId, speed: repairedScene.actors[0].speed, area: repairedScene.objects[0].cells, marker: [repairedScene.markers[0].x, repairedScene.markers[0].y], cut: repairedScene.topology.cuts[0].cells })), { x: 6, y: 6, compoundId: null, speed: 4, area: ["1,1"], marker: [6,6], cut: ["2,2"] }, "Scene normalization repairs off-board entities and dissolves orphaned Compound identities");
const staleLifecycleScene = vm.runInContext(`sceneCore({spaces:[{id:"main",width:7,height:7}],actors:[{id:"hero",team:"hero",space:"main",knockedOut:true},{id:"enemy",team:"enemy",space:"main"}],pendingActionPlan:{id:"plan",actorId:"hero",context:{targetIds:["enemy"]}},pendingPrompt:{id:"prompt",sourceActorId:"hero",targetId:"enemy",options:["pass"]},triggerQueue:[{key:"queued",event:{type:"rule.prompt",actorId:"hero",payload:{sourceActorId:"hero",options:["pass"]}}}],challengeRequest:{id:"request",actorId:"hero",target:3},opposedRoll:{id:"opposed",participants:[{id:"a",actorId:"hero",name:"Hero",controller:"participant",pool:2},{id:"b",actorId:"enemy",name:"Enemy",controller:"participant",pool:2}]}})`, appCoreContext);
assert.deepEqual(JSON.parse(JSON.stringify({ active: staleLifecycleScene.activeActorId, plan: staleLifecycleScene.pendingActionPlan, prompt: staleLifecycleScene.pendingPrompt, queue: staleLifecycleScene.triggerQueue, challenge: staleLifecycleScene.challengeRequest, opposed: staleLifecycleScene.opposedRoll })), { active: null, plan: null, prompt: null, queue: [], challenge: null, opposed: null }, "Scene normalization clears lifecycle state whose participants can no longer act");
const emptyTargetActionScene = vm.runInContext(`sceneCore({activeSpace:"main",spaces:[{id:"main",width:7,height:7}],actors:[{id:"hero",team:"hero",space:"main"}],targetCells:["01,1","2,2","2,2","99,99"],pendingAction:{id:"pending",actorId:"hero",targetIds:[],targetCells:["03,3","3,3","99,99"],allowEmptyTargets:true,responses:{}}})`, appCoreContext);
assert.equal(emptyTargetActionScene.pendingAction?.id, "pending", "Targetless Actions explicitly marked as valid survive persistence and network normalization");
assert.deepEqual(JSON.parse(JSON.stringify(emptyTargetActionScene.targetCells)), ["2,2"], "Scene persistence keeps only unique canonical in-bounds cell targets");
assert.deepEqual(JSON.parse(JSON.stringify(emptyTargetActionScene.pendingAction.targetCells)), ["3,3"], "Pending empty-cell Actions cannot restore malformed or off-board cell keys");
const normalizedEffectScene = vm.runInContext(`sceneCore({turnSerial:7,spaces:[{id:"main",name:"Main",width:7,height:7}],actors:[
  {id:"source",team:"hero",space:"main",name:"Source",effects:[]},
  {id:"target",team:"enemy",space:"main",name:"Target",effects:["negative.испуган"],effectStates:{"negative.испуган":{duration:"default",appliedTurnSerial:null,appliedRound:null,sourceBound:true,sources:[{actorId:"source",actionId:"test",eventId:"event-1"}]}}}
]})`, appCoreContext);
assert.equal(normalizedEffectScene.turnSerial, 7, "Scene persistence must retain the Turn lifecycle serial");
assert.deepEqual(JSON.parse(JSON.stringify(normalizedEffectScene.actors[1].effectStates["negative.испуган"].sources.map(source => source.actorId))), ["source"], "Scene persistence must retain valid Effect sources");
assert.equal(normalizedEffectScene.actors[1].effectStates["negative.испуган"].appliedTurnSerial, null, "Unknown Effect application boundaries must remain unknown");
assert.equal(normalizedEffectScene.actors[1].effectStates["negative.испуган"].appliedRound, null, "Unknown Effect application rounds must remain unknown");
assert.match(appSource, /counter\("focus","Фокус",rt\.focus\)/, "Focus counter must remain unbounded");
assert.doesNotMatch(cockpitSource, /maxFocus|Фокус\s*\$\{[^}]+\}\s*\//, "Cockpit must not display or store a Focus ceiling");
const syncStorage = new Map();
const syncContext = { window: {}, URL, console, setTimeout, clearTimeout, localStorage: { getItem: key => syncStorage.get(key) || null, setItem: (key, value) => syncStorage.set(key, value) } };
vm.runInNewContext(fs.readFileSync(path.join(root, "sync.js"), "utf8"), syncContext);
const syncApi = syncContext.window.DAWN_SYNC;
assert.ok(syncApi);
assert.equal(syncApi.hasConfig(), false);
syncApi.configure({ url: "https://dawn-test.supabase.co/path", publishableKey: "sb_publishable_test", displayName: "Нарратор" });
assert.equal(syncApi.state().url, "https://dawn-test.supabase.co");
assert.equal(syncApi.state().displayName, "Нарратор");
assert.equal(syncApi.hasConfig(), true);
const configuredContext = { window: {}, URL, console, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem: () => {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, "config.js"), "utf8"), configuredContext);
vm.runInNewContext(fs.readFileSync(path.join(root, "sync.js"), "utf8"), configuredContext);
assert.equal(configuredContext.window.DAWN_SYNC.hasConfig(), true, "Published companion must use the DAWN Supabase project by default");
const fakeScene = { id: "00000000-0000-0000-0000-000000000002", campaign_id: "00000000-0000-0000-0000-000000000001", name: "Структурированный бой", state: { round: 1 }, version: 1 };
const fakeQuery = { select(){ return this; }, eq(){ return this; }, order(){ return this; }, limit: async () => ({ data: [], error: null }), single: async () => ({ data: fakeScene, error: null }), maybeSingle: async () => ({ data: null, error: null }) };
const fakeChannel = { on(){ return this; }, subscribe(callback){ callback("SUBSCRIBED"); return this; } };
const fakeClient = {
  auth: { getSession: async () => ({ data: { session: null }, error: null }), signInAnonymously: async () => ({ data: { session: { user: { id: "00000000-0000-0000-0000-000000000003" } } }, error: null }) },
  from: () => fakeQuery,
  rpc: name => ({ single: async () => name === "create_campaign" ? ({ data: { campaign_id: fakeScene.campaign_id, scene_id: fakeScene.id, role: "owner" }, error: null }) : ({ data: null, error: new Error("unexpected rpc") }) }),
  channel: () => fakeChannel,
  removeChannel: async () => {},
};
syncContext.window.supabase = { createClient: () => fakeClient };
await syncApi.connect();
await syncApi.createCampaign("Тестовая Серия", { round: 1 });
assert.equal(syncApi.state().role, "owner");
assert.equal(syncApi.state().sceneId, fakeScene.id);
assert.equal(syncApi.state().status, "online");
assert.equal(data.schemaVersion, 2);
assert.equal(data.archetypes.length, 6);
assert.equal(data.archetypes.flatMap(a => a.techniques).length, 107);
for (const archetype of data.archetypes) {
  for (const technique of archetype.techniques) {
    for (const level of technique.levels) {
      assert.ok(
        !/^#{2,3} /m.test(level.text || ""),
        `${technique.id}.${level.n} must not absorb a following Markdown section`,
      );
    }
  }
}
assert.equal(data.archetypes.flatMap(a => a.techniques.flatMap(technique => technique.levels)).filter(level => level.mechanics).length, 321);
assert.equal(data.outlooks.length, 10);
assert.equal(data.outlooks.flatMap(o => (o.builtin ? [o.builtin] : []).concat(o.gifts)).length, 52);
const loyal = data.outlooks.find(outlook => outlook.name === "Верный");
const wolf = data.outlooks.find(outlook => outlook.name === "Волк");
const loyalGifts = logic.resolveSelectedGifts({ outlooks: data.outlooks, selectedOutlookIds: [loyal.id], primaryOutlookId: loyal.id, selectedGiftIds: [] });
const wolfGifts = logic.resolveSelectedGifts({ outlooks: data.outlooks, selectedOutlookIds: [wolf.id], primaryOutlookId: wolf.id, selectedGiftIds: [] });
assert.deepEqual(JSON.parse(JSON.stringify(loyalGifts.map(gift => gift.en))), ["The Oath"], "The Loyal must automatically receive The Oath");
assert.deepEqual(JSON.parse(JSON.stringify(wolfGifts.map(gift => gift.en))), ["Lone Wolf"], "The Wolf must automatically receive Lone Wolf");
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.resolveSelectedGifts({ outlooks: data.outlooks, selectedOutlookIds: [loyal.id, wolf.id], primaryOutlookId: loyal.id, selectedGiftIds: [] }).map(gift => gift.en))),
  ["The Oath"],
  "An inherent Gift belongs only to the Primary Outlook",
);
const loyalChoice = loyal.gifts[0];
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.resolveSelectedGifts({ outlooks: data.outlooks, selectedOutlookIds: [loyal.id], primaryOutlookId: loyal.id, selectedGiftIds: [loyalChoice.id] }).map(gift => gift.id))),
  [loyal.builtin.id, loyalChoice.id],
  "An inherent Gift must be added on top of selectable Gifts without occupying their slots",
);
assert.equal(data.bonds.actions.length, 12);
assert.equal(data.bonds.actions.filter(action => !action.antagonistic).length, 10);
assert.match(data.bonds.rankUp, /Есть 10/);
assert.equal(data.bonds.actions.find(action => action.name === "Защита")?.tag, "Подопечный");
assert.match(data.bonds.quick, /Ранг\*\* 1|Ранг 1/);
assert.match(data.bonds.favoredActions, /Стресс/);
assert.equal(data.bonds.relatedRules.length, 6);
assert.match(data.bonds.relatedRules.find(rule => rule.id === "bond.context.duel")?.text || "", /встречный бросок/);
assert.equal(data.effects.positive.length, 8);
assert.equal(data.effects.negative.length, 11);
assert.ok(data.effects.positive.find(effect => effect.name === "Исчез")?.aliases.includes("Исчезнуть"));
const regeneration=data.effects.positive.find(effect=>effect.name==="Регенерирует");
assert.ok(regeneration?.aliases.includes("Регенерация"));
assert.match(regeneration?.text||"",/Ступень[\s\S]+Здоровья[\s\S]+не удаляется/i,"the effect catalog must explain Regenerating's amount, timing, and persistence");
assert.equal(data.actions.list.length, 15);
assert.equal(data.enemies.common.length, 41);
assert.equal(data.enemies.modifiers.length, 11);
assert.equal(data.enemies.antagonistTraits.length, 8);
assert.deepEqual(
  JSON.parse(JSON.stringify(data.enemies.antagonistTraits.map(trait => trait.rules.find(rule => rule.kind === "defense-reaction")?.automation?.mode))),
  ["evasion-move", "armor-corrupt", "armor-repel", "clash", "intercept-armor", "evasion-vanish", "intercept-clash", "redirect-ally"],
  "Every canonical Antagonist defensive Reaction must have an explicit automation profile",
);
assert.equal(data.enemies.named.length, 3);
const leon = data.enemies.named.find(enemy => enemy.en === "Leon, Academy Spatial Mage");
assert.equal(leon?.stats.health, "16");
assert.equal(leon?.stats.evasion, "2");
assert.equal(leon?.tokenImage, "../../media/tokens/leon-academy-mage.png");
assert.equal(leon?.rules.find(rule => rule.en === "Elemental Breach")?.tension, 3);
assert.equal(data.enemies.common.find(enemy => enemy.en === "Bruiser")?.stats.armor, "1(+1/2)");
const assassin = data.enemies.common.find(enemy => enemy.en === "Assassin");
assert.match(assassin?.text || "", /Исчезнуть/);
assert.ok(data.enemies.common.reduce((total, enemy) => total + enemy.rules.length, 0) >= 120);
assert.deepEqual(Array.from(assassin.deployEffects), ["Исчез"]);
assert.equal(assassin.rules.find(rule => rule.en === "Slice")?.dice, "5(+1)");
assert.equal(assassin.rules.find(rule => rule.en === "Slice")?.tensionMultiplier, 2);
assert.deepEqual(Array.from(assassin.rules.find(rule => rule.en === "Neutralize Target")?.targetEffects || []), ["Помечен"]);
assert.deepEqual(Array.from(assassin.rules.find(rule => rule.en === "Disappear")?.selfEffects || []), ["Исчез"]);
assert.ok(data.abilityWords.verbs.length > 20);
assert.ok(data.abilityWords.nouns.length > 20);
assert.ok(data.abilityWords.conditions.length > 20);

const ids = [
  ...data.archetypes.flatMap(a => a.techniques.map(t => t.id)),
  ...data.outlooks.map(o => o.id),
  ...data.outlooks.flatMap(o => (o.builtin ? [o.builtin] : []).concat(o.gifts).map(g => g.id)),
  ...data.bonds.actions.map(action => action.id),
  ...data.bonds.relatedRules.map(rule => rule.id),
  ...Object.values(data.effects).flat().map(e => e.id),
  ...data.actions.list.map(a => a.id),
  ...Object.values(data.enemies).flat().map(enemy => enemy.id),
  ...data.enemies.antagonistTraits.flatMap(trait => trait.rules.map(rule => rule.id)),
  ...Object.values(data.abilityWords).flat().map(w => w.id),
];
assert.equal(new Set(ids).size, ids.length, "stable ids must be unique");
for (const archetype of data.archetypes) for (const technique of archetype.techniques) assert.equal(technique.levels.length, 3, technique.name);

assert.deepEqual(
  JSON.parse(JSON.stringify(logic.calculateRankSpend({ skillSpent: 4, abilityCost: 5, abilityExtra: 2, gadgetSpent: 5, gadgetPool: 3 }))),
  { paidAbility: 3, paidGadgets: 2, rankSpent: 14, coreRankSpent: 9 },
  "Gearhead's first three gadget ranks must not spend the main rank budget",
);
const cursedBudget = JSON.parse(JSON.stringify(logic.calculateCreationBudgets({
  tier: 1,
  gifts: ["Uncontrollable Power"],
  skillRanks: [2, 2],
  abilityCost: 6,
})));
assert.equal(cursedBudget.rankPool, 12);
assert.equal(cursedBudget.coreRankPool, 8);
assert.equal(cursedBudget.uncontrollableRanks, 4);
assert.equal(cursedBudget.abilityExtra, 4);
assert.equal(cursedBudget.paidAbility, 2);
assert.equal(cursedBudget.rankSpent, 10, "Selecting an Ability-only gift must not reduce the visible ranks already spent");
assert.equal(cursedBudget.coreRankSpent, 6, "Uncontrollable Power still restricts its four bonus ranks to the Ability");
const darkUrgeRegression = logic.calculateCreationBudgets({ gifts: ["Dark Urge"], skillRanks: [2, 2], abilityCost: 4 });
assert.equal(darkUrgeRegression.rankSpent, 8, "Dark Urge must not change 8 spent ranks into 4");
assert.equal(darkUrgeRegression.rankPool, 12, "Dark Urge adds four restricted ranks to the visible total pool");
assert.equal(darkUrgeRegression.rankOver, 0);
assert.equal(logic.calculateCreationBudgets({ gifts: ["Dark Urge"], skillRanks: [3, 3, 3, 3] }).rankOver, 4, "Dark Urge ranks cannot be diverted into Skills");
const taintedBudget = JSON.parse(JSON.stringify(logic.calculateCreationBudgets({
  tier: 3,
  gifts: ["Dark Urge", "Uncontrollable Power", "Tainted Body"],
  skillRanks: [2, 2],
  abilityCost: 10,
  taintedBodyUsed: true,
  taintedAbilityCost: 5,
})));
assert.equal(taintedBudget.abilityExtra, 8);
assert.equal(taintedBudget.taintedAbilityPool, 6);
assert.equal(taintedBudget.taintedAbilitySpent, 5);
assert.equal(taintedBudget.taintedAbilityRemaining, 1);
assert.equal(taintedBudget.taintedAbilityOver, 0);
assert.equal(taintedBudget.rankPool, 26, "Tainted Body reserve must be present in the visible total pool");
assert.equal(taintedBudget.rankSpent, 19, "Tainted Body Ability cost must be present in visible spent ranks");
assert.equal(taintedBudget.paidAbility, 2, "Tainted Body is reserved for a new Ability, not the existing one");
assert.equal(logic.calculateCreationBudgets({ tier: 1, gifts: ["Tainted Body"], taintedBodyUsed: true, taintedAbilityCost: 6 }).taintedAbilityOver, 2, "Tainted Body cannot silently overpay its new Ability");
const artistBudget = JSON.parse(JSON.stringify(logic.calculateCreationBudgets({
  gifts: ["Performance Artist"],
  skillRanks: [2, 2],
  performanceTargetRank: 2,
})));
assert.equal(artistBudget.skillSpent, 4);
assert.equal(artistBudget.performanceBonus, 1, "Performance Artist grants a free rank to the selected Skill");
assert.equal(logic.calculateCreationBudgets({ gifts: ["Performance Artist"], skillRanks: [3, 1], performanceTargetRank: 3 }).performanceBonus, 0, "Skill rank cannot exceed 3");
const deafnessBudget = logic.calculateCreationBudgets({ gifts: ["Supernatural Deafness"], skillRanks: [2, 2], abilityCost: 4 });
assert.equal(deafnessBudget.rankPool, 11, "Supernatural Deafness adds three unrestricted ranks");
assert.equal(deafnessBudget.rankSpent, 8, "Selecting Supernatural Deafness must not rewrite already spent ranks");
const gearheadBudget = logic.calculateCreationBudgets({ gifts: ["Gearhead"], skillRanks: [2, 2], abilityCost: 4, gadgetSpent: 3 });
assert.equal(gearheadBudget.rankPool, 11, "Gearhead adds its three gadget-only ranks to the visible pool");
assert.equal(gearheadBudget.rankSpent, 11, "Configured gadget ranks must be visible in total spending");
assert.equal(gearheadBudget.coreRankSpent, 8, "Gift-paid gadget ranks must not consume the core pool");
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.calculateCreationBudgets({ tier: 3, gifts: ["Past Your Prime"], skillRanks: [] }))).rankPool,
  14,
);
assert.equal(logic.calculateCreationBudgets({ tier: 3, gifts: ["Past Your Prime"], skillRanks: [] }).skillMin, 8);
assert.equal(logic.calculateCreationBudgets({ tier: 3, gifts: ["Amazing Potential"], skillRanks: [] }).rankPool, 12);
assert.equal(logic.calculateCreationBudgets({ tier: 3, gifts: ["Amazing Potential"], skillRanks: [] }).skillMin, 2);
const conflictingRankGifts = logic.calculateCreationBudgets({ tier: 1, gifts: ["Past Your Prime", "Amazing Potential"], skillRanks: [2, 2] });
assert.equal(conflictingRankGifts.rankBudgetConflict, true);
assert.equal(conflictingRankGifts.rankPool, 8, "An invalid pair must not arbitrarily let one starting budget overwrite the other");
assert.equal(conflictingRankGifts.skillMin, 4);
assert.equal(logic.calculateCreationBudgets({ gifts: [], skillRanks: [], gadgetSpent: 9 }).rankSpent, 0, "Gadget spend is ignored without Gearhead");
const forcedConditionWords = [{ id: "verb", group: "verbs", cost: 1, marks: "✢" }, { id: "noun", group: "nouns", cost: 1, marks: "" }, { id: "condition", group: "conditions", cost: 2, marks: "" }];
assert.equal(logic.calculateAbilityCost({ enabled: true, words: forcedConditionWords }), 2, "A terminating word normally omits the Condition cost");
assert.equal(logic.calculateAbilityCost({ enabled: true, words: forcedConditionWords, forceCondition: true }), 4, "Uncontrollable Power must retain and pay for its required Condition");
assert.equal(logic.scaleTierFormula("15(+5)", 1), 15);
assert.equal(logic.scaleTierFormula("15(+5)", 3), 25);
assert.equal(logic.scaleTierFormula("1(+1/2)", 1), 1);
assert.equal(logic.scaleTierFormula("1(+1/2)", 2), 2);
assert.equal(logic.scaleTierFormula("1(+1/2)", 3), 2);
assert.equal(logic.scaleTierFormula("X", 3), null);
assert.equal(logic.areaCells({ shape: "radius2", x: 3, y: 3, width: 7, height: 7 }).length, 13);
assert.deepEqual(Array.from(logic.areaCells({ shape: "adjacent", x: 3, y: 3, width: 7, height: 7 })).sort(), ["2,3", "3,2", "3,3", "3,4", "4,3"]);
assert.equal(logic.areaCells({ shape: "square5", x: 3, y: 3, width: 7, height: 7 }).length, 25);
assert.equal(logic.areaCells({ shape: "square5", x: 0, y: 0, width: 7, height: 7 }).length, 9);
assert.equal(logic.areaCells({ shape: "lineDiagDown", x: 3, y: 3, width: 7, height: 7 }).length, 7);
assert.deepEqual(Array.from(logic.areaCells({ shape: "square2", x: 6, y: 6, width: 7, height: 7 })), ["6,6"]);
assert.equal(logic.calculateAbilityCost({
  enabled: true,
  words: [
    { id: "verb.create", group: "verbs", cost: 4, marks: "✢" },
    { id: "noun.gravity", group: "nouns", cost: 3, marks: "" },
    { id: "condition.memory", group: "conditions", cost: 3, marks: "" },
  ],
}), 7, "✢ omits the Condition and its cost");
assert.equal(logic.calculateAbilityCost({
  enabled: true,
  words: [{ id: "noun.people", group: "nouns", cost: 2, marks: "✝" }],
  specializations: { "noun.people": "только врачи" },
}), 1, "✝ narrows a category and reduces its cost by one");
assert.equal(logic.calculateAbilityCost({
  enabled: true,
  words: [
    { id: "verb.merge", group: "verbs", cost: null, marks: "☾" },
    { id: "noun.gravity", group: "nouns", cost: 3, marks: "" },
  ],
  xWord: { id: "noun.plants", group: "nouns", cost: 1, marks: "✝" },
  specializations: { "noun.plants": "только розы" },
}), 3, "☾ derives X from the selected Noun cost, including category narrowing");
const sequence = [5 / 6, 0, 2 / 6];
const rolled = logic.rollXd6({ count: 2, threshold: 3, random: () => sequence.shift() });
assert.deepEqual(Array.from(rolled.rolls), [6, 1, 3]);
assert.equal(rolled.successes, 2, "All Out succeeds on 3+");
assert.equal(rolled.crits, 1, "exploding six is still a critical success");
const assassinSequence = [4 / 6, 1 / 6];
const assassinRoll = logic.rollXd6({ count: 1, criticalAt: 5, random: () => assassinSequence.shift() });
assert.deepEqual(Array.from(assassinRoll.rolls), [5, 2], "Assassinate makes a 5 explode into an additional die");
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.swapAttributeBase({ body: 4, talent: 3, spirit: 2, mind: 2 }, "spirit", 4, ["body", "talent", "spirit", "mind"]))),
  { body: 2, talent: 3, spirit: 4, mind: 2 },
  "choosing a base attribute must swap values and preserve the 4/3/2/2 array",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.normalizeAttributeBases({ body: 3, talent: 4, spirit: 4, mind: 2 }, ["body", "talent", "spirit", "mind"]))),
  { body: 3, talent: 4, mind: 2, spirit: 2 },
  "invalid persisted base Attributes must be repaired to the 4/3/2/2 array",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(logic.normalizeAttributeGrowth({ body: 2, talent: 2, spirit: 1, mind: 1 }, 2, ["body", "talent", "spirit", "mind"]))),
  { body: 1, talent: 1, spirit: 0, mind: 0 },
  "each gained tier grants two different ordinary Attribute increases",
);

for (const file of ["index.html", "app.css", "vtt-cockpit.css", ...appFiles, "logic.js", "config.js", "sync.js", "data.js", "manifest.webmanifest", "sw.js", "icon.svg"]) assert.ok(fs.existsSync(path.join(root, file)), file);
const app = appSource;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const cockpitCss = fs.readFileSync(path.join(root, "vtt-cockpit.css"), "utf8");
const sceneResponsesSource = fs.readFileSync(path.join(root, "scene-responses.js"), "utf8");
const sync = fs.readFileSync(path.join(root, "sync.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
assert.match(serviceWorker, /["']\.\/network-v2\.js["']/, "the offline app shell must cache the network v2 runtime");
const sql = fs.readFileSync(path.resolve(root, "../../supabase/migrations/202607130001_dawn_multiplayer.sql"), "utf8");
const eventSql = fs.readFileSync(path.resolve(root, "../../supabase/migrations/202607210001_dawn_event_stream.sql"), "utf8");
const liveCharacterSql = fs.readFileSync(path.resolve(root, "../../supabase/migrations/202607230001_dawn_live_characters.sql"), "utf8");
const eventRepairSql = fs.readFileSync(path.resolve(root, "../../supabase/migrations/202607230002_fix_append_scene_events.sql"), "utf8");
assert.match(html, /data-scene-tool="place"/, "The GM table exposes an explicit manual placement tool");
assert.match(app, /movement:"Ручная перестановка",placement:true/, "Manual GM placement is journaled without invoking a Turn movement action");
assert.match(app, /SCENE_RULE_SECTIONS=\[/, "The table sidebar exposes focused structured-combat rule sections");
assert.match(app, /sceneRuleChapter\(chapterId\)\?\.cards/, "The table sidebar reuses the canonical Rules chapters instead of a separate help catalog");
assert.match(html, /Правила структурированного боя/, "The table labels its sidebar as a structured-combat rules view");
assert.match(html, /Как запустить общий стол/, "The network lobby contains an in-product quick start for narrator and players");
assert.match(html, /id="sync-leave-table"/, "An active table exposes a leave action outside the collapsible connection panel");
assert.match(html, /id="sync-table-select"/, "The connection panel exposes saved table selection");
assert.match(app, /Sync\.listCampaigns\(\)/, "Saved tables are loaded from authenticated campaign memberships");
assert.match(app, /class="core-action-rule"/, "Every table action keeps its full rule text directly reachable");
assert.match(app, /function combatActionReferenceHtml/, "Structured combat embeds the complete base-action reference");
assert.match(html, /id="scene-enemy-trait"/, "Enemy setup exposes Antagonist Traits");
assert.match(sceneResponsesSource, /autoPassedIds/, "Enemy targets without an available Reaction are skipped automatically");
assert.match(app, /function sceneNarratorConsoleHtml/, "The selected actor exposes a dedicated Narrator adjudication console");
assert.match(app, /sourceActionId:"manual\.adjudication"/, "Manual health, resources, and Effects remain explicit journaled events");
assert.match(html, /id="scene-space-manager"/, "The Narrator can inspect and remove created spaces");
assert.match(html, /id="scene-clear-field"/, "The Narrator has an explicit reversible field cleanup command");
assert.match(html, /id="scene-reset-table"/, "The Narrator has an explicit full table reset command");
assert.match(app, /S\.runtime\.hp=d\.maxHp[\s\S]+S\.runtime\.tension=1/, "Ending a Scene restores the sheet Health and applies the canonical Tension reset");
assert.match(app, /scene\.tension=1[\s\S]+actor\.hp=Math\.max\(0,Number\(actor\.maxHp[\s\S]+actor\.knockedOut=false/, "Starting the next Scene restores combatant Health and returns knocked-out participants");
assert.doesNotMatch(app, /rollKeys/, "Post-battle replay preserves separate public rolls even when their dice match");
assert.match(app, /base\.results=scene\.results[\s\S]+openedAt[\s\S]+openedBy/, "The open battle-results state survives normalization, sync, export, and reconnect");
assert.match(app, /Итоги боя открыты для всего стола[\s\S]+scene\.results=\{id:uid\(\)/, "The Narrator publishes one shared battle-results token instead of opening a local-only dialog");
assert.match(app, /Scene\.results\?`<button[^`]+data-scene-session-action="results">К итогам/, "Every participant receives a persistent reopen button while shared results exist");
assert.match(app, /sceneBattleComplete\(\)[\s\S]+Завершить бой/, "The Narrator receives a finish-battle action when either side is knocked out");
assert.match(app, /reconcileSceneResultsDialog\(\)/, "A newly synchronized results token opens the post-battle dialog on every client");
assert.match(app, /Math\.ceil\(attrValueFor\(hero,"talent"\)\/2\)/);
assert.match(app, /takeWound\(external\)/);
assert.match(app, /setToolsResource\("influence"/, "Free-play Influence changes must update the local sheet or canonical shared actor");
assert.match(app, /Logic\.calculateCreationBudgets/);
assert.match(app, /builtinGifts\.hidden=!builtin/);
assert.match(app, /Получен автоматически и не занимает слот/);
assert.match(app, /performanceSkill/);
assert.match(app, /taintedAbilityPool/);
assert.match(app, /taintedAbility/);
assert.match(app, /function commitScene/);
assert.match(app, /function insetSceneTracePoints/);
assert.match(app, /function sceneTracePathData/);
assert.match(app, /points=points\.map[\s\S]+occupied\.some/, "movement traces must bend around actors occupying intermediate path cells");
assert.match(app, /function sceneTracePartGlyph/);
assert.match(app, /const sceneMarkerType=/);
assert.match(app, /class="trace-halo"/);
assert.match(app, /class="trace-destination"/);
assert.match(cockpitCss, /\.scene-move-trace \.trace-halo/);
assert.match(cockpitCss, /\.scene-move-trace\.teleport \.trace-destination/);
assert.match(cockpitCss, /\.scene-mode \.scene-token\{position:relative;z-index:4/);
assert.match(app, /Logic\.areaCells/);
assert.match(app, /scaledEnemyStats/);
assert.match(app, /TECH_SCENE_TEMPLATES/);
assert.match(app, /disruptor\.chemist/);
assert.match(app, /function playInnerWorldFx/, "Inner World transfer has an event-driven visual layer");
assert.match(app, /function captureSceneFxContext/, "Scene FX can retain pre-dispatch token geometry");
assert.match(app, /sourceActionId===?["']disruptor\.inner-world\.2/, "Inner World FX accepts the canonical source action marker");
assert.match(app, /space\.ensure[\s\S]+payload\?\.activate[\s\S]+Внутренний мир/, "Inner World FX only starts for an activated canonical pocket space event");
assert.match(cockpitCss, /\.inner-world-fx[\s\S]+@keyframes inner-world-void/, "Inner World FX is styled in the shared tactical cockpit");
assert.match(cockpitCss, /prefers-reduced-motion:reduce[\s\S]+fx-inner-world-target/, "Inner World FX respects reduced-motion preferences");
assert.match(app, /function playInnerWorldExitFx/, "Inner World evacuation has an event-driven return animation");
assert.match(companionCss, /inner-world-exit-fx[\s\S]+@keyframes inner-world-exit/, "Inner World return animation is styled in the shared application layer");
assert.match(app, /disruptor\.inner-world/);
assert.match(app, /bulwark\.giant-frame/);
assert.match(app, /powerhouse\.warring-ascendant/);
assert.match(app, /ruiner\.bombardier/);
assert.match(app, /shape:"square5"/);
assert.match(app, /ruiner\.rapid-fire-sorcery/);
assert.match(app, /ruiner\.ritualist/);
assert.match(app, /ruiner\.ego-arm/);
assert.match(app, /ruiner\.sellsword-s-call/);
assert.match(app, /disruptor\.wave-rider/);
assert.match(app, /disruptor\.hunter/);
assert.match(app, /disruptor\.gale-strider/);
assert.match(app, /GIFT_SCENE_TEMPLATES/);
assert.match(app, /Trust Fund/);
assert.match(app, /data-sacrifice/);
assert.match(app, /tokenImageFromFile/);
assert.match(app, /scene\.markers/);
assert.match(app, /hero\.media\.token/);
assert.match(app, /hero\.media\.portrait/);
assert.match(app, /function renderSceneMedia/);
assert.match(app, /initCollapsibleBuildPanels/);
assert.match(app, /builder-mode/);
assert.match(app, /scene-mode/);
assert.match(app, /function renderBondTraining/);
assert.match(app, /function renderBondReference/);
assert.match(app, /const RULE_CHAPTERS/);
assert.match(app, /const GLOSSARY/);
assert.match(app, /Рана, которую герой наносит себе сам, Влияния не даёт/);
assert.match(app, /<article id="\$\{id\}" class="rules-card">/);
assert.doesNotMatch(app, /<details id="\$\{id\}" class="rules-card">/);
assert.match(css, /rules-index::\-webkit-scrollbar-thumb/);
assert.match(css, /\.rules-card>header/);
const glossaryIds = [...app.matchAll(/glossaryTerm\("([^"]+)"/g)].map(match => match[1]);
assert.ok(glossaryIds.length >= 80, `expected a broad glossary, got ${glossaryIds.length} terms`);
assert.equal(new Set(glossaryIds).size, glossaryIds.length, "glossary term ids must be unique");
for (const requiredTerm of ["stress","scene","threat","risk","reward","intermission","knocked-out","on-the-line","character-rank","technique-level","motivation","history","impact","access","health","guts","ap","turn","action","basic-action","attack","damage","reaction","defensive-reaction","fast","line","zone","terrain","ally","antagonist","trump"]) assert.ok(glossaryIds.includes(requiredTerm), `missing required glossary term: ${requiredTerm}`);
assert.match(app, /function renderRules/);
assert.match(app, /function actionRulesHtml/);
assert.match(app, /function rulesChapterText/);
assert.match(app, /function fieldRulesVisual/);
assert.match(app, /function ruleKey/);
assert.match(app, /rule-permalink/);
assert.match(app, /target\?\.matches\?\./);
assert.match(app, /Преимущество от Рангов/);
assert.match(app, /Поставить на кон/);
assert.match(app, /Альтернативные Фокусы/);
assert.match(app, /Жизненный цикл Эффектов/);
assert.match(app, /id:"abilities"/);
assert.match(app, /id:"narrator"/);
assert.match(app, /id:"enemies"/);
assert.match(app, /requestedMode/);
assert.match(app, /bondRelatedItems/);
assert.match(html, /id="bond-training"/);
assert.match(html, /data-mode="rules"/);
assert.match(html, /data-page="rules"/);
assert.match(html, /id="rules-index"/);
assert.match(html, /id="rules-chapters"/);
assert.match(html, /id="rules-search"/);
assert.match(html, /id="rules-filters"/);
assert.match(html, /id="rules-expand"/);
assert.match(html, /id="rules-collapse"/);
assert.match(html, /reference-rules-link/);
assert.doesNotMatch(html, /id="bond-reference"/);
assert.match(html, /scene-sync-body/);
assert.match(html, /scene-inspector-panel/);
assert.match(app, /scene\.artworks/);
assert.match(app, /data-scene-portrait-actor/);
assert.match(app, /duration:"nextTurn"/);
assert.match(app, /data-scene-turn/);
assert.match(app, /data-ability-field="xNoun"/);
assert.match(app, /wordSpecialization/);
assert.match(app, /customWordCosts/);
assert.match(app, /data-custom-word-cost/);
assert.match(app, /customWordCostOptions/);
assert.match(app, /value==="X"/);
assert.doesNotMatch(app, /id="ability-variable"/);
assert.match(app, /\(item\.aliases\|\|\[\]\)\.join/);
assert.match(app, /name:"Эффекты"/);
assert.doesNotMatch(app, /Math\.floor\(attrValue/);
assert.match(html, /Метки слов:/);
assert.match(html, /id="builtin-gifts"/);
assert.match(html, /Новая Способность «Порченого тела»/);
assert.match(html, /supabase-js@2\.110\.3/);
assert.match(html, /data-scene-tool="marker"/);
assert.match(html, /scene-add-free-token/);
assert.match(html, /scene-marker-kind/);
assert.match(html, /value="weapon">Оружие/);
assert.match(html, /square5/);
assert.match(html, /hero-portrait-upload/);
assert.match(html, /hero-token-upload/);
assert.match(html, /scene-hero-select/);
assert.match(html, /scene-media-menu/);
assert.match(html, /scene-art-upload/);
assert.match(html, /scene-dock/);
assert.match(html, /id="scene-control-mode"/);
assert.match(html, /data-scene-panel="director"/);
assert.match(html, /id="scene-director"/);
assert.match(html, /scene-enemy-roster/);
assert.match(html, /scene-zoom-fit/);
assert.match(html, /data-scene-tool="measure"/);
assert.match(html, /scene-roll-feed/);
assert.match(html, /scene-action-tray/);
assert.match(html, /scene-turn-strip/);
assert.match(html, /data-scene-panel="utility"/);
assert.match(html, /data-scene-panel="reference"/);
assert.match(html, /scene-ref-search/);
assert.match(html, /dice-attr/);
assert.match(html, /dice-skill/);
assert.match(html, /dice-ability/);
assert.match(sync, /signInAnonymously/);
assert.match(sync, /save_scene_snapshot/);
assert.match(sync, /postgres_changes/);
assert.match(sync, /decideCommand/);
assert.match(sync, /scene_public_snapshots/);
assert.match(sync, /append_scene_events/);
assert.match(sync, /presenceState/);
assert.match(sync, /listCharacters/);
assert.match(html, /config\.js\?v=__BUILD_VERSION__/);
assert.match(html, /sync-publish-hero/);
assert.match(app, /Нарратор принял цели игрока/);
assert.match(app, /canonicalPlayerEvents/);
assert.match(app, /function activeSceneTool\(\)[\s\S]+playerSceneTool/, "a player must never inherit the narrator's destructive board tool");
assert.match(app, /function canControlScenePrompt[\s\S]+heroId===S\.id/, "players may only resolve prompts belonging to their own hero");
assert.match(app, /TechniqueEngine\.toEvents/);
assert.match(app, /data-core-technique/);
assert.match(app, /SceneEngine\.prepareEnemyRule/);
assert.match(app, /data-enemy-rule/);
assert.match(app, /profile\.deployEffects/);
assert.match(html, /gm-library\.js\?v=__BUILD_VERSION__/);
assert.match(app, /function normalizeGmLibrary/);
assert.match(app, /function deployEncounter/);
assert.match(app, /data-gm-variant-add/);
assert.match(app, /data-gm-encounter-deploy/);
assert.match(html, /scene-enemy-team/);
assert.match(app, /data-scene-actor-team/);
assert.match(app, /actorTeam=\(team\|\|blueprint\?\.team\)==="hero"/);
assert.match(app, /profileActors=Scene\.actors\.filter/);
assert.match(app, /activeActorId/);
assert.match(app, /public-actor-card/);
assert.match(app, /data-core-assist-technique/);
assert.match(app, /TechniqueEngine\.assistedPreview/);
assert.match(app, /pendingEnemyRule/);
assert.match(app, /enemyAreaCells/);
assert.match(app, /renderSceneReference/);
assert.match(app, /function renderSceneDirector/);
assert.match(app, /data-director-resource/);
assert.match(app, /data-director-quick-turn/);
assert.match(app, /data-director-set-resource/);
assert.match(app, /data-director-toggle-target/);
assert.match(app, /data-director-resolve-outcome/);
assert.match(app, /function directorEnemyProfileSection[\s\S]+СПОСОБНОСТИ ПРОФИЛЯ[\s\S]+enemyRuleOptionsHtml/, "The Narrator console must show the selected enemy profile's passive, defense, actions, and rule options");
assert.match(app, /scene-director[\s\S]+closest\("\[data-enemy-rule\]"\)[\s\S]+useEnemyRule/, "Enemy actions shown in the Narrator console must execute through the enemy rules engine");
assert.match(app, /applyNarratorOverride/);
assert.match(app, /Решение Нарратора обходит правила/);
assert.match(app, /phase="result"/);
assert.match(app, /data-scene-flow-round/);
assert.match(app, /function sceneSheetPanel/);
assert.match(app, /function rollSceneDice/);
assert.match(app, /function automationBadge/);
assert.match(app, /data-gm-technique-actor/);
assert.match(app, /scene-dice-actor-select/);
assert.match(app, /scene-dice-target/);
assert.match(app, /data-scene-request-roll/);
assert.match(app, /sync\.canNarrate\?"gm":"player"/);
assert.match(app, /scene-turn-strip[\s\S]{0,500}setScenePanel\(activeSceneView\(\)===\"player\"/);
assert.match(app, /sceneActionPanel\(actorOverride=null\)/);
assert.match(app, /data-scene-sheet-actor/);
assert.match(app, /pendingCoreActorId=delegatedSheet\.dataset\.sceneSheetActor/);
assert.match(app, /localActor=Scene\.actors\.find\(item=>item\.heroId===S\.id\)/);
assert.match(app, /openSceneRollPreset\(\{actorId,skillId:/);
assert.match(app, /openSceneRollPreset\(\{actorId,abilityKey:/);
assert.doesNotMatch(app, /ГЕРОЙ · СТУПЕНЬ \$\{S\.tier\}/);
assert.match(cockpitCss, /\.automation-badge/);
assert.match(cockpitCss, /focus-mode\.scene-mode \.scene-board-wrap\{height:100%/);
assert.match(app, /function measurementPath/);
assert.match(app, /taintedAbility:hero\.mods\.taintedBody/);
assert.match(sql, /enable row level security/);
assert.match(sql, /redeem_campaign_invite/);
assert.match(sql, /scene version conflict/);
assert.doesNotMatch(sql, /service_role/i);
assert.match(eventSql, /public_scene_projection/);
assert.match(eventSql, /append_scene_events/);
assert.match(eventSql, /characters_private_select/);
assert.match(eventSql, /commands_private_select/);
assert.match(eventSql, /event_log_narrator_select/);
assert.match(eventSql, /state version does not match event batch/);
assert.match(eventSql, /join_hero/);
assert.doesNotMatch(eventSql, /create policy scenes_member_select/);
assert.match(liveCharacterSql, /bump_character_version/);
assert.match(liveCharacterSql, /supabase_realtime add table public\.characters/);
assert.match(eventRepairSql, /batch\(event_item\)/);
assert.doesNotMatch(eventRepairSql, /batch\(item\)/);
console.log(`OK: ${ids.length} unique rule ids; companion data and invariants validated.`);
