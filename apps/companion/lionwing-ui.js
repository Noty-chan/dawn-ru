"use strict";

// Thin presentation adapter. All mechanical changes go through the same command
// boundary as a future Technique; the UI never edits the result of an operation.
const LionwingEngine = window.DAWN_LIONWING_ENGINE;
const lwActive = () => LionwingEngine.isScene(Scene);
let lwDestination = null, lwGeometryPreview = null, lwDetectiveTeleport = null;
const lwRules = () => localizedLionwingCoreRules();
const lwActor = () => Scene.actors.find(a => a.id === Scene.selectedActor) || Scene.actors.find(a => a.id === Scene.activeActorId) || currentHeroActor();
const lwCanNarrate = () => !Sync?.state?.().sceneId || Sync.state().canNarrate;
const lwOwns = actorId => lwCanNarrate() || currentHeroActor()?.id === actorId;
const lwEntities = () => window.DAWN_LIONWING_ENTITIES;
const lwEntityViewer = () => {
  const sync = Sync?.state?.() || {};
  const view = typeof activeSceneView === "function" ? activeSceneView() : (sync.canNarrate ? "gm" : "player");
  const actor = currentHeroActor?.() || Scene.actors.find(item => item.id === sync.actorId);
  return { role: view === "gm" ? "narrator" : "player", actorId: actor?.id || sync.actorId || null, userId: sync.userId || null };
};
const lwEntityName = entity => {
  const owner = Scene.actors.find(actor => actor.id === entity?.ownerActorId);
  return owner?.name || "Участник Сцены";
};
const lwEntityBacking = entity => {
  const backing = entity?.backing;
  if (!backing) return entity?.backingHidden ? "Backing скрыт правами проекции" : "Без backing";
  const type = backing.type || (backing.actorId ? "actor" : backing.markerId ? "marker" : backing.objectId ? "object" : backing.areaId ? "area" : backing.wallId ? "wall" : "");
  const id = backing.id || backing[`${type}Id`];
  const collections = { actor: Scene.actors, marker: Scene.markers, object: Scene.objects, area: [...(Scene.areas || []), ...(Scene.objects || []).filter(item => item.type === "area")], wall: Scene.walls };
  const item = (collections[type] || []).find(candidate => candidate?.id === id);
  const typeNames = { actor: "участник", marker: "маркер", object: "объект", area: "область", wall: "Стена" };
  return `${typeNames[type] || "ссылка"}${item?.name || item?.label ? ` · ${item.name || item.label}` : ""}`;
};
const lwEntityTechnical = entity => {
  const backing = entity?.backing || {};
  const source = entity?.source || {};
  const refs = [entity?.id, entity?.ownerActorId, source.actorId || source.markerId || source.objectId || source.areaId || source.sceneId, backing.id || backing.actorId || backing.markerId || backing.objectId || backing.areaId || backing.wallId].filter(Boolean);
  return refs.length ? `<details class="scene-entity-technical"><summary>Технические данные</summary><code>${refs.map(esc).join(" · ")}</code></details>` : "";
};
const lwEntityTypes = Object.freeze(["actor", "marker", "object", "area", "wall"]);
const lwEntityTypeNames = Object.freeze({ actor: "участник", marker: "маркер", object: "объект", area: "область", wall: "Стена" });
const lwEntityVisibilityNames = Object.freeze({ public: "Публичная", owner: "Только владельцу", narrator: "Только Нарратору", hidden: "Скрытая" });
const lwEntityClone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const lwEntityCanMutate = () => lwEntityViewer().role === "narrator" && (typeof lwCanNarrate !== "function" || lwCanNarrate());
function lwEntityBackingOptions(scene = Scene) {
  const result = [], seen = new Set(), add = (type, items) => {
    for (const item of Array.isArray(items) ? items : []) {
      if (!item?.id || seen.has(`${type}:${item.id}`)) continue;
      seen.add(`${type}:${item.id}`);
      result.push({ type, id: String(item.id), ref: { [`${type}Id`]: String(item.id) }, label: item.name || item.label || item.id });
    }
  };
  add("actor", scene?.actors);
  add("marker", scene?.markers);
  add("object", (scene?.objects || []).filter(item => item?.type !== "area"));
  add("area", [...(scene?.areas || []), ...(scene?.objects || []).filter(item => item?.type === "area")]);
  add("wall", scene?.walls);
  return result;
}
function lwEntityBackingFromValue(value) {
  const match = /^(actor|marker|object|area|wall):(.+)$/u.exec(String(value || ""));
  return match ? { type: match[1], id: match[2], ref: { [`${match[1]}Id`]: match[2] } } : null;
}
function lwEntityControlsHtml() {
  if (!lwEntityCanMutate()) return "";
  const actors = Array.isArray(Scene.actors) ? Scene.actors : [], backings = lwEntityBackingOptions();
  const owner = actors[0]?.id || "", backing = backings[0];
  return `<form class="scene-entity-create" data-lw-entity-form><strong>Создать public сущность</strong><p>Выберите существующий backing и владельца. Состояние backing (координаты, Здоровье и другие поля) сюда не копируется.</p><div class="scene-entity-create-fields"><label>Тип (kind)<input data-lw-entity-kind maxlength="80" value="summon" required spellcheck="false"></label><label>Владелец<select data-lw-entity-owner required>${actors.map(actor => `<option value="${esc(actor.id)}"${actor.id === owner ? " selected" : ""}>${esc(actor.name || actor.id)}</option>`).join("")}</select></label><label>Backing<select data-lw-entity-backing required>${backings.map(item => `<option value="${esc(`${item.type}:${item.id}`)}"${item === backing ? " selected" : ""}>${esc(`${lwEntityTypeNames[item.type]} · ${item.label}`)}</option>`).join("")}</select></label><label>Видимость<select data-lw-entity-visibility>${Object.entries(lwEntityVisibilityNames).map(([value, label]) => `<option value="${value}"${value === "public" ? " selected" : ""}>${label}</option>`).join("")}</select></label></div>${actors.length && backings.length ? `<button type="submit" class="primary" data-lw-entity-create>Создать сущность</button>` : `<p class="autosave">Нужны хотя бы один владелец и существующий backing.</p>`}</form>`;
}
function lwEntityCommit(label, transition) {
  let result = null;
  const committed = commitScene(label, scene => {
    result = transition(scene);
    if (!result?.ok || !result.scene?.lionwing) throw new Error("Операция сущности не вернула совместимый снимок реестра.");
    scene.lionwing ||= {};
    scene.lionwing.entities = lwEntityClone(result.scene.lionwing.entities || {});
    if (Object.prototype.hasOwnProperty.call(result.scene.lionwing, "entityReceipts")) scene.lionwing.entityReceipts = lwEntityClone(result.scene.lionwing.entityReceipts);
  });
  if (!committed) return false;
  renderLionwingEntities();
  return { ...committed, entityResult: result };
}
function lwCreateEntity(form) {
  if (!lwEntityCanMutate()) return toast("Эта операция доступна только Нарратору");
  const api = lwEntities(), kind = form?.querySelector("[data-lw-entity-kind]")?.value?.trim() || "", ownerActorId = form?.querySelector("[data-lw-entity-owner]")?.value || "", backing = lwEntityBackingFromValue(form?.querySelector("[data-lw-entity-backing]")?.value), visibility = form?.querySelector("[data-lw-entity-visibility]")?.value || "public";
  if (!api?.create || !ownerActorId || !backing || !Scene.actors?.some(actor => actor.id === ownerActorId)) return toast("Выберите существующего владельца и backing");
  if (!kind || /\s/u.test(kind) || kind.length > 80) return toast("Тип (kind) обязателен и не должен содержать пробелы");
  if (!Object.prototype.hasOwnProperty.call(lwEntityVisibilityNames, visibility)) return toast("Неизвестная видимость сущности");
  const option = lwEntityBackingOptions().find(item => item.type === backing.type && item.id === backing.id), expectedVersion = Number(Scene.version || 0);
  if (!option) return toast("Backing отсутствует на Сцене");
  const summary = `Создать сущность «${kind}» для «${Scene.actors.find(actor => actor.id === ownerActorId)?.name || ownerActorId}»?\nBacking: ${lwEntityTypeNames[option.type]} · ${option.label}\nВидимость: ${lwEntityVisibilityNames[visibility]}.`;
  if (!window.confirm(summary)) return false;
  const id = uid(), entity = { id, kind, ownerActorId, source: { actorId: ownerActorId }, rule: "manual.entity", backing: option.ref, lifetime: { boundary: "scene" }, visibility };
  return lwEntityCommit(`Создана сущность «${kind}» · ${lwEntityTypeNames[option.type]} · ${option.label}`, scene => api.create(scene, entity, { role: "narrator", actorId: ownerActorId, expectedVersion }));
}
function lwDestroyEntity(id) {
  if (!lwEntityCanMutate()) return toast("Эта операция доступна только Нарратору");
  const api = lwEntities(), entity = api?.resolve?.(Scene, id)?.entity;
  if (!api?.remove || !entity) return toast("Сущность уже отсутствует на Сцене");
  const expectedVersion = Number(Scene.version || 0), owner = Scene.actors.find(actor => actor.id === entity.ownerActorId)?.name || entity.ownerActorId;
  if (!window.confirm(`Удалить сущность «${entity.kind}» владельца «${owner}»?\nBacking: ${lwEntityBacking(entity)}\nСвязи реестра будут очищены по политике источника.`)) return false;
  const label = `Удалена сущность «${entity.kind}» · ${lwEntityBacking(entity)}`;
  // Removal is a Scene event because the registry operation also cleans live
  // auras, continuations and pending decisions. The ordinary registry helper
  // only copied entities and would silently drop those foreign mutations.
  const committed = commitSceneEvents(label, [{ type: "entity.remove", actorId: "narrator", payload: { id, purge: true, expectedVersion } }]);
  if (!committed) return false;
  renderLionwingEntities();
  return committed;
}
function renderLionwingEntities() {
  const root = $("scene-entities");
  if (!root || !lwActive()) return;
  const api = lwEntities();
  if (!api?.project) { root.innerHTML = `<p class="autosave" role="status">Реестр сущностей не загружен.</p>`; return; }
  let projection;
  try { projection = api.project(Scene, lwEntityViewer()); }
  catch (error) { root.innerHTML = `<p class="autosave" role="status">Реестр сущностей пока недоступен: ${esc(error.message || error)}</p>`; return; }
  const records = Array.isArray(projection?.entities) ? projection.entities : [], controls = lwEntityControlsHtml();
  const cards = records.map(entity => `<article class="scene-entity-card"><header><div><strong>${esc(entity.kind || "Сущность")}</strong><small>${esc(entity.lifecycle || "active")} · ${esc(lwEntityBacking(entity))}</small></div>${lwEntityCanMutate() ? `<button type="button" class="danger-quiet" data-lw-entity-destroy="${esc(entity.id)}">Удалить</button>` : ""}</header><dl><div><dt>Владелец</dt><dd>${esc(lwEntityName(entity))}</dd></div><div><dt>Видимость</dt><dd>${esc(entity.visibility || "public")}</dd></div><div><dt>Источник</dt><dd>${entity.sourceHidden ? "скрыт" : "указан"}</dd></div></dl>${lwEntityTechnical(entity)}</article>`).join("");
  root.innerHTML = `<div class="scene-entities" aria-live="polite">${controls}<p class="scene-entities-intro">Показана проекция реестра, доступная текущему участнику Сцены.</p>${records.length ? `<div class="scene-entity-list">${cards}</div>` : `<p class="autosave">Доступных сущностей пока нет.</p>`}</div>`;
}
const lwFormDraft = new Map();
const lwDraftKey=input=>{const attr=[...input.attributes].find(attr=>attr.name.startsWith("data-lw-"));return attr?attr.name+(attr.value?":"+attr.value:""):null;};
let lwDraftEnabled=false,lwDraftBatch=null;

const lwGeometryStopReasons=Object.freeze({
  "difficult-terrain":"вход в Трудную местность завершает движение",
  opponent:"вход в клетку противника завершает движение",
  "opponent-space":"вход в клетку противника завершает движение",
});
function lwGeometryStopReason(reason){
  const key=String(reason||"");
  return lwGeometryStopReasons[key]|| (key ? "достигнуто ограничение маршрута" : "");
}
function lwGeometryRouteKeys(route){return (route?.path||[]).map(point=>`${point.x},${point.y}`)}
function lwGeometrySceneIdentity(scene=Scene){
  const explicit=scene?.sceneId||scene?.sceneIdentity||scene?.id;
  const shared=Sync?.state?.()?.sceneId;
  const spaces=(scene?.spaces||[]).map(space=>`${space.id}:${space.width}x${space.height}:${space.mode||""}`).sort().join("|");
  const actors=(scene?.actors||[]).map(actor=>String(actor.id||"")).sort().join("|");
  const shape=`${scene?.name||""}|${scene?.rulesEdition||""}|${spaces}|${actors}`;
  if(explicit)return `scene:${String(explicit)}|${shape}`;
  if(shared)return `shared:${String(shared)}|${shape}`;
  return `local:${shape}`;
}
function lwApplyGeometryPreviewCells(){
  if(typeof scenePreviewCells==="undefined")return;
  scenePreviewCells.clear();
  const route=lwGeometryPreview?.event?.payload?.geometryPlan?.route;
  for(const key of lwGeometryRouteKeys(route))scenePreviewCells.add(key);
  if(typeof $$!=="function")return;
  const cells=$$('[data-scene-cell]');
  for(const cell of cells)cell.classList.toggle("preview",scenePreviewCells.has(cell.dataset.sceneCell));
}
function lwClearGeometryPreview({render=true}={}){
  lwGeometryPreview=null;lwDestination=null;
  if(typeof scenePreviewCells!=="undefined")scenePreviewCells.clear();
  if(render&&typeof renderScene==="function")renderScene();
}
function lwGeometryPreviewContext(draft,payload){return{
  sceneIdentity:lwGeometrySceneIdentity(),
  sceneVersion:Number(Scene.version||0),
  activeSpace:Scene.activeSpace||"",
  selectedActor:Scene.selectedActor||"",
  targetIds:[...(Scene.targetIds||[])],
  actorId:draft.actorId,
  destination:payload?.destination?{space:payload.destination.space||Scene.activeSpace,x:Number(payload.destination.x),y:Number(payload.destination.y)}:null,
}}
function lwGeometrySelectionChanged(preview){
  const context=preview?.context||{};
  return context.sceneIdentity!==lwGeometrySceneIdentity()||
    context.activeSpace!== (Scene.activeSpace||"")||
    context.selectedActor!== (Scene.selectedActor||"")||
    JSON.stringify(context.targetIds||[])!==JSON.stringify([...(Scene.targetIds||[])]);
}
function lwBuildGeometryPreview(draft,payload){
  const prepared=LionwingEngine.prepare(Scene,{...payload,actorId:draft.actorId});
  if(!prepared.ok)return {ok:false,prepared};
  const event=prepared.events.find(item=>item.type==="lionwing.command"&&item.payload?.kind==="geometry-move"),route=event?.payload?.geometryPlan?.route;
  if(!event||!route)return {ok:false,prepared,errors:["Планировщик не вернул маршрут"]};
  const intent={...payload};delete intent.geometryPlan;
  lwGeometryPreview={actorId:draft.actorId,label:draft.label,intent,event,stage:draft.stage===true,context:lwGeometryPreviewContext(draft,intent),notice:draft.notice||""};
  lwDestination=null;
  if(typeof scenePreviewCells!=="undefined"){
    scenePreviewCells.clear();
    for(const key of lwGeometryRouteKeys(route))scenePreviewCells.add(key);
  }
  return {ok:true,prepared,event,route};
}
function lwSetGeometryPreview(draft,payload,{render=true}={}){
  const result=lwBuildGeometryPreview(draft,payload);
  if(!result.ok){
    const errors=result.prepared?.errors||result.errors||["Не удалось построить маршрут."];
    toast(errors.join(" "));return false;
  }
  if(render)renderScene();
  return true;
}
function lwRefreshGeometryPreview(preview,notice="Сцена изменилась: маршрут пересчитан. Проверьте и подтвердите обновлённый маршрут."){
  const refreshed=lwSetGeometryPreview({...preview,notice},preview.intent,{render:true});
  if(refreshed){toast(notice);return true;}
  lwClearGeometryPreview();toast("Маршрут больше недоступен: выберите клетку заново.");return false;
}
function lwReconcileGeometryPreview(){
  const preview=lwGeometryPreview;
  if(!preview)return;
  if(lwGeometrySelectionChanged(preview)){lwClearGeometryPreview({render:false});return;}
  if(preview.context?.sceneVersion!==Number(Scene.version||0)){
    const refreshed=lwSetGeometryPreview({...preview,notice:"Сцена изменилась: маршрут пересчитан. Проверьте и подтвердите обновлённый маршрут."},preview.intent,{render:false});
    if(!refreshed){lwClearGeometryPreview({render:false});return;}
    toast("Сцена изменилась: маршрут пересчитан. Проверьте и подтвердите обновлённый маршрут.");
  }
  lwApplyGeometryPreviewCells();
}
function lwCheckGeometryPreview(preview){
  const context=preview?.context||{},currentIdentity=lwGeometrySceneIdentity();
  if(lwGeometrySelectionChanged(preview))return{ok:false,clear:true,errors:["Выбор участника или сцена изменилась."]};
  if(context.sceneIdentity&&context.sceneIdentity!==currentIdentity)return{ok:false,stale:true,errors:["Сцена изменилась."]};
  if(Number(context.sceneVersion)!==Number(Scene.version||0))return{ok:false,stale:true,errors:["Геометрический план устарел."]};
  const plan=preview?.event?.payload?.geometryPlan,geometry=window.DAWN_LIONWING_GEOMETRY;
  if(plan&&geometry?.revalidatePlan){
    const checked=geometry.revalidatePlan(Scene,plan);
    if(!checked.available)return{ok:false,stale:Boolean(checked.stale),errors:[checked.reason||"Маршрут изменился."]};
  }
  const checked=LionwingEngine.previewEvents?.(Scene,[preview.event],{expectedVersion:Number(Scene.version||0)});
  return checked||{ok:true};
}
function lwInstallGeometryPreviewGuard(){
  const board=$("scene-board");
  if(!board||board.__lwGeometryPreviewGuard)return;
  board.__lwGeometryPreviewGuard=true;
  board.addEventListener("mouseleave",()=>{
    if(!lwGeometryPreview)return;
    const restore=()=>{if(lwGeometryPreview)lwApplyGeometryPreviewCells()};
    if(typeof queueMicrotask==="function")queueMicrotask(restore);else setTimeout(restore,0);
  },true);
}

function lwOperationSummary(p){
  const names={attack:"Атака",damage:"Урон","spend-health":"Расход Здоровья","lose-health":"Потеря Здоровья",heal:"Лечение",effect:p.remove?"Снять Эффект":"Наложить Эффект",resource:p.operation==="spend"?"Расход":"Получение",move:"Движение","geometry-move":"Движение по плану",wound:"Рана",stress:"Стресс",modifier:"Модификатор",usage:"Учесть применение","record-action":"Базовое действие","recover-track":"Восстановление Ран/Стресса",prompt:"Решение",note:"Запись", "grant-turn":"Дополнительный Ход","allow-action":"Допуск действия"};
  const ids=p.targetIds||[p.targetId||lwDraftBatch?.actorId],targets=ids.map(id=>Scene.actors.find(a=>a.id===id)?.name||id).join(", ");
  const destination=p.geometryPlan?.route?.stoppedAt||p.destination,cell=destination?`${String.fromCharCode(65+Number(destination.x))}${Number(destination.y)+1}`:"";
  const detail=[p.amount!=null?String(p.amount):"",p.resource||"",p.effect?([...lwRules().effects.positive,...lwRules().effects.negative].find(e=>e.id===p.effect)?.name||p.effect):"",p.duration||"",cell,p.geometryPlan?.route?`${p.geometryPlan.route.spent} кл.`:"",p.note||p.title||""].filter(Boolean).join(" · ");
  return `${names[p.kind]||p.kind} → ${targets}${detail?": "+detail:""}`;
}

function lwGeometryPreviewHtml(){
  const route=lwGeometryPreview?.event?.payload?.geometryPlan?.route;
  if(!route)return "";
  const actor=Scene.actors.find(item=>item.id===route.actorId),cell=route.stoppedAt?`${String.fromCharCode(65+route.stoppedAt.x)}${route.stoppedAt.y+1}`:"—";
  const stop=route.terminal?` · движение завершится${route.stopReason?`: ${lwGeometryStopReason(route.stopReason)}`:""}`:route.partial?" · цель недостижима, показана ближайшая клетка":"";
  const notice=lwGeometryPreview.notice?`<p class="lw-preview-update" role="status">${esc(lwGeometryPreview.notice)}</p>`:"";
  const action=lwGeometryPreview.stage?`<button class="primary" data-lw-geometry-add data-lw-actor="${esc(lwGeometryPreview.actorId)}">Добавить движение в пакет</button>`:`<button class="primary" data-lw-geometry-confirm data-lw-actor="${esc(lwGeometryPreview.actorId)}">Подтвердить движение</button>`;
  return `<section class="lw-pending"><strong>Маршрут: ${esc(actor?.name||route.actorId)} → ${esc(cell)}</strong><p>${route.spent} кл. движения · останется ${route.remaining}${esc(stop)}</p>${notice}<div class="button-row">${action}<button data-lw-geometry-cancel data-lw-actor="${esc(lwGeometryPreview.actorId)}">Отменить выбор</button></div></section>`;
}

function lwCostsFrom(root){
  return [["ap","resource"],["focus","resource"],["influence","resource"],["health","health"]].map(([key,kind])=>({kind,...(kind==="resource"?{resource:key}:{}),amount:Number(root?.querySelector(`[data-lw-cost-${key}]`)?.value||0)})).filter(part=>Number.isInteger(part.amount)&&part.amount>0);
}

function lwBatchHtml(){
  const draft=lwDraftBatch,actor=Scene.actors.find(a=>a.id===draft?.actorId);
  return `<details class="lw-batch" ${draft?"open":""}><summary>Составной ручной пакет${draft?` · ${draft.operations.length} операций`:""}</summary>
    <label><input type="checkbox" data-lw-stage ${lwDraftEnabled?"checked":""}>Собирать операции перед применением</label>
    <p>Добавляйте последствия кнопками ниже. Полная цена резервируется после выбора целей и списывается вместе с пакетом.</p>
    ${draft?`<div class="lw-fields"><label>Цена: ОД<input data-lw-cost-ap type="number" min="0" max="9999" value="0"></label><label>Фокус<input data-lw-cost-focus type="number" min="0" max="9999" value="0"></label><label>Влияние<input data-lw-cost-influence type="number" min="0" max="9999" value="0"></label><label>Здоровье<input data-lw-cost-health type="number" min="0" max="9999" value="0"></label></div>`:""}
    ${draft?`<p>Источник: ${esc(actor?.name||draft.actorId)}</p><ol>${draft.operations.map((operation,index)=>`<li>${esc(lwOperationSummary(operation))} <button data-lw-batch-remove="${index}" aria-label="Убрать операцию ${index+1}">Убрать</button></li>`).join("")}</ol><div class="button-row"><button data-lw-batch-apply>Проверить и применить пакет</button><button data-lw-batch-clear>Отменить пакет</button></div>`:""}</details>`;
}

const lwChainChoiceStages=Object.freeze({knockout:"Сопротивление","clash-loss":"Реакция","clash-tie":"Реакция","duel-outcome":"Реакция","duel-failure":"Реакция","duel-wounds":"Рана",wound:"Рана",replacement:"Последствие","rule-trigger":"Последствие",consequence:"Последствие",placement:"Решение"});
const lwChainPathForStage=Object.freeze({Атака:"Атака",Реакция:"Атака → Реакция",Урон:"Атака → Реакция → Урон",Рана:"Атака → Реакция → Урон → Рана",Сопротивление:"Атака → Реакция → Урон → Рана → Сопротивление",Последствие:"Последствие",Решение:"Ручное решение"});
function lwChainOperationKind(value){return value?.kind||value?.p?.kind||"";}
function lwChainFrameInfo(frame){
  const data=frame?.lionwing||frame||{},choices=Array.isArray(data.choices)?data.choices:[],choice=choices[0],pending=frame?.pendingAction||null,cursor=data.executionCursor||null;
  const actorId=choice?.actorId||pending?.actorId||frame?.turnFrame?.actorId||cursor?.responderActorId||cursor?.ownerActorId||null;
  if(choice){
    const stage=lwChainChoiceStages[choice.kind]||(String(choice.title||"").includes("Сопротив")?"Сопротивление":"Решение");
    return {stage,path:stage==="Сопротивление"&&choice.context?.track==="wounds"?lwChainPathForStage.Сопротивление:lwChainPathForStage[stage]||stage,actorId,choiceId:choice.id};
  }
  if(pending){
    const waiting=Object.values(pending.responses||{}).filter(response=>response?.choice==="pending").length;
    return {stage:"Реакция",path:lwChainPathForStage.Реакция,actorId,pendingId:pending.id,waiting};
  }
  const deferred=Array.isArray(data.deferred)?data.deferred:[],afterAttack=Array.isArray(data.afterAttack)?data.afterAttack:[],item=deferred[0]||afterAttack[0],kind=lwChainOperationKind(item);
  if(kind){
    const stage=kind==="damage"?"Урон":kind==="wound"?"Рана":kind==="knockout"?"Сопротивление":"Последствие";
    return {stage,path:lwChainPathForStage[stage]||stage,actorId,cursor:cursor&&Number.isInteger(cursor.cursor)&&Number.isInteger(cursor.total)?{cursor:cursor.cursor,total:cursor.total,status:cursor.status}:null};
  }
  if(cursor?.status==="waiting")return {stage:"Решение",path:lwChainPathForStage.Решение,actorId,choiceId:cursor.waitingChoiceId,cursor:Number.isInteger(cursor.cursor)&&Number.isInteger(cursor.total)?{cursor:cursor.cursor,total:cursor.total,status:cursor.status}:null};
  return {stage:"Ручное решение",path:"Вложенный ручной уровень",actorId};
}
function lwChainOwnerLabel(actorId){
  if(!actorId||typeof Scene==="undefined")return "";
  const actor=Scene.actors?.find(item=>item.id===actorId);
  return actor?.name||actorId;
}
function lwChainFrameHtml(frame,kind,depth,resumable=false){
  const info=lwChainFrameInfo(frame),owner=lwChainOwnerLabel(info.actorId),progress=info.cursor?` · шаг ${info.cursor.cursor}/${info.cursor.total}`:"",waiting=info.waiting?` · ожидается ответов: ${info.waiting}`:"",token=info.choiceId||info.pendingId;
  return `<li class="lw-chain-frame${kind==="current"?" is-current":""}" data-lw-chain-frame="${kind}" data-lw-chain-depth="${depth}" data-lw-chain-stage="${esc(info.stage)}" data-lw-chain-path="${esc(info.path)}"${resumable?' data-lw-chain-resumable="true"':""}${token?` data-lw-chain-id="${esc(token)}"`:""}><b>${kind==="current"?"Сейчас":"Слой "+depth}: ${esc(info.stage)}</b><small>${esc(info.path)}${owner?` · ${esc(owner)}`:""}${progress}${waiting}</small></li>`;
}
function lwChainHtml(a){
  if(!lwCanNarrate())return "";
  const state=Scene.lionwing||{},choices=Array.isArray(state.choices)?state.choices:[],paused=Array.isArray(state.pausedChains)?state.pausedChains:[],hasCurrent=Boolean(Scene.pendingAction||choices.length||state.deferred?.length||state.afterAttack?.length||state.executionCursor),current=hasCurrent?lwChainFrameInfo(Scene):null;
  if(!hasCurrent&&!paused.length)return "";
  const top=paused.length?lwChainFrameInfo(paused[paused.length-1]):null,header=current?.path||top?.path||"Вложенный ручной уровень",canPause=Boolean(Scene.pendingAction||choices.length),canResume=Boolean(paused.length&&!Scene.pendingAction&&!choices.length&&!state.deferred?.length),items=`${hasCurrent?lwChainFrameHtml(Scene,"current",0):""}${paused.map((frame,index)=>lwChainFrameHtml(frame,"paused",index+1,index===paused.length-1)).join("")}`;
  return `<section class="lw-chain-stack" data-lw-chain-stack data-lw-chain-depth="${paused.length}" data-lw-chain-stage="${esc(current?.stage||top?.stage||"Решение")}" data-lw-chain-path="${esc(header)}" aria-live="polite"><header><strong>Контекст цепочки${paused.length?` · вложенность ${paused.length}`:""}</strong><small>${esc(header)}</small></header><ol>${items}</ol><div class="button-row">${canPause?`<button data-lw-chain="pause-chain" data-lw-actor="${esc(a.id)}" title="Сохранить этап «${esc(current?.stage||"Решение") }» для вложенного ручного правила">Приостановить цепочку для ручного правила</button>`:""}${paused.length?`<button data-lw-chain="resume-chain" data-lw-actor="${esc(a.id)}"${canResume?"":' disabled title="Сначала завершите вложенное решение"'}>Возобновить цепочку (${paused.length})</button>`:""}</div></section>`;
}

function lwGeneralHtml(){
  return `<details class="lw-general"><summary>Общие операции правила</summary><div class="lw-fields">
    <label>Операция<select data-lw-general-kind><option value="resource">Ресурс</option><option value="spend-health">Потратить Здоровье</option><option value="lose-health">Потерять Здоровье</option><option value="roll">Ручной бросок XD6</option><option value="record-action">Учесть ручное базовое действие и стоимость</option><option value="wound">Получить Рану</option><option value="stress">Получить Стресс</option><option value="recover-track">Вылечить Раны / снять Стресс</option><option value="move">Движение</option><option value="search">Найти Исчезнувшего противника — 2 ОД</option><option value="grant-turn">Дополнительный Ход</option><option value="allow-action">Допуск действия</option><option value="usage">Учесть применение правила</option><option value="prompt">Запросить решение</option><option value="note">Запись в журнал</option></select></label>
    <label>Количество / дальность / лимит<input data-lw-general-amount type="number" min="0" max="9999" value="1"></label>
    <label>Вид броска<select data-lw-general-roll-kind><option value="check">Проверка</option><option value="opposed">Встречная Проверка</option><option value="raw-d6">Сырая таблица D6</option></select></label><label>Критический успех<select data-lw-general-crit><option value="6">6</option><option value="5">5 или 6</option></select></label><label><input type="checkbox" data-lw-general-explode checked>Дополнительная кость за Крит</label><label>Результаты костей вручную (необязательно)<input data-lw-general-dice placeholder="Например: 4 2 6 3"></label>
    <label>Что восстановить<select data-lw-general-track><option value="wounds">Раны</option><option value="stress">Стресс</option></select></label>
    <label>Ресурс<select data-lw-general-resource><option value="ap">ОД</option><option value="focus">Фокус (с заменой)</option><option value="influence">Влияние</option></select></label>
    <label>Изменение<select data-lw-general-direction><option value="spend">Потратить</option><option value="gain">Получить</option></select></label>
    <label>Способ движения<select data-lw-general-movement><option value="normal">Добровольное</option><option value="forced">Принудительное</option><option value="teleport">Телепортация</option></select></label>
    <label><input type="checkbox" data-lw-general-ignore-opponents>Проходить сквозь противников</label><label><input type="checkbox" data-lw-general-ignore-terrain>Игнорировать местность</label><label><input type="checkbox" data-lw-general-line>Движение по Линии</label>
    <label>Действие<select data-lw-general-action>${lwRules().actions.list.filter(a=>a.type==="action").map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</select></label>
    <label>Стоимость допущенного действия<input data-lw-general-cost type="number" min="0" value="0"></label>
    <label><input data-lw-general-swift type="checkbox" checked>Быстрое действие</label>
    <label><input data-lw-general-reaction type="checkbox">Разрешить действие как Реакцию вне своего Хода</label><label>Область лимита<select data-lw-general-scope><option value="rootAction">Корневое действие</option><option value="action">Действие</option><option value="ownerTurn">Ход владельца</option><option value="anyTurn">Любой текущий Ход</option><option value="round">Раунд</option><option value="scene">Сцена</option><option value="chapter">Глава</option></select></label>
    <label>ID правила<input data-lw-general-id value="manual.rule"></label>
    <label>Решение / пояснение<textarea data-lw-general-note rows="2"></textarea></label>
    <button data-lw-general-submit>Применить к целям (или источнику)</button>
  </div></details>`;
}

function lwSubmit(actorId, payload, label = "Действие LionWing") {
  if(lwDraftEnabled&&["plan","batch","attack","damage","heal","effect","move","geometry-move","resource","modifier","wound","stress","recover-track","record-action","allow-action","grant-turn","usage","note","prompt"].includes(payload.kind)){
    if(!lwCanNarrate())return false;
    if(lwDraftBatch&&lwDraftBatch.actorId!==actorId){toast("Сначала примените или отмените пакет прежнего источника");return false;}
    const operations=["batch","plan"].includes(payload.kind)?payload.operations:[payload];
    if((lwDraftBatch?.operations.length||0)+operations.length>192){toast("Пакет ограничен 192 операциями");return false;}
    lwDraftBatch||={actorId,operations:[],labels:[]};lwDraftBatch.operations.push(...structuredClone(operations));
    lwDraftBatch.labels.push(`${label}: ${operations.length} операций`);renderScene();return true;
  }
  // A player's public snapshot intentionally has no authoritative continuation.
  // Send the selected option; the Narrator validates and resumes its saved frame.
  if (!lwCanNarrate() && payload.kind === "choice" && ["replacement","rule-trigger","technique-trigger"].includes(Scene.lionwing?.choices?.[0]?.kind)) {
    const pending = Scene.lionwing.choices[0];
    if (!lwOwns(actorId) || pending.actorId !== actorId || pending.id !== payload.id || !pending.options.includes(payload.choice)) return false;
    return commitSceneEvents(label, [LionwingEngine.command(actorId, { kind: "choice", id: payload.id, choice: payload.choice })]);
  }
  const prepared = LionwingEngine.prepare(Scene, { ...payload, actorId });
  if (!prepared.ok) { toast(prepared.errors.join(" ")); return false; }
  if(["pause-chain","resume-chain"].includes(payload.kind)||payload.kind==="attack"||prepared.scene?.pendingAction||prepared.scene?.lionwing?.choices?.length)activeDirectorTab="turn";
  return commitSceneEvents(label, prepared.events);
}

function lwDiceHtml(a) {
  const t = key => esc(window.DAWN_I18N.t(`lionwing.dice.${key}`));
  const rolls = Object.values(Scene.lionwing?.diceRolls || {}).filter(roll => roll.ownerActorId === a.id).slice(-8).reverse();
  return `<details ${rolls.length ? "open" : ""} data-lw-dice-panel data-lw-actor="${esc(a.id)}"><summary>${t("title")}</summary><p>${t("hint")}</p><label>${t("pool")}<input data-lw-dice-pool type="number" min="1" max="100" value="3"></label><button data-lw-dice-create>${t("create")}</button>${rolls.map(roll => `<fieldset data-lw-roll="${esc(roll.id)}"><legend>${esc(roll.formula || roll.id)} · ${t("hits")}: ${roll.successes ?? "—"}</legend>${roll.dice.filter(die => !die.removed).map(die => `<div class="button-row" data-lw-die="${esc(die.id)}"><strong>${die.value} ⚄</strong><label>${t("face")}<select data-lw-die-value ${die.locked ? "disabled" : ""}>${[1,2,3,4,5,6].map(value => `<option ${value === die.value ? "selected" : ""}>${value}</option>`).join("")}</select></label>${["change","reroll","remove",die.locked ? "unlock" : "lock"].map(kind => `<button data-lw-dice-op="${kind}" ${die.locked && ["change","reroll","remove"].includes(kind) ? "disabled" : ""}>${t(kind)}</button>`).join("")}</div>`).join("")}</fieldset>`).join("")}</details>`;
}

function lwDiceClick(button) {
  const panel = button.closest("[data-lw-dice-panel]"), actorId = panel?.dataset.lwActor;
  if (!actorId || !lwOwns(actorId)) return false;
  const label = window.DAWN_I18N.t("lionwing.dice.title");
  if (button.hasAttribute("data-lw-dice-create")) return lwSubmit(actorId, { kind: "dice-create", pool: Number(panel.querySelector("[data-lw-dice-pool]").value), rollId: uid() }, label);
  const row = button.closest("[data-lw-die]"), rollId = button.closest("[data-lw-roll]")?.dataset.lwRoll, kind = button.dataset.lwDiceOp;
  if (!row || !rollId || !["change","reroll","remove","lock","unlock"].includes(kind)) return false;
  if (!window.confirm(window.DAWN_I18N.t("lionwing.dice.confirm"))) return false;
  const operation = { id: uid(), kind, dieId: row.dataset.lwDie };
  if (kind === "change") operation.value = Number(row.querySelector("[data-lw-die-value]").value);
  if (kind === "reroll") operation.value = 1 + Math.floor(Math.random() * 6);
  return lwSubmit(actorId, { kind: "dice-apply", rollId, operation }, label);
}

function lwStatusHtml(a) {
  const vulnerability = a.lionwing?.vulnerable ? " · Уязвим" : "", focusLabel=Object.values(a.ruleResources||{}).find(r=>r.replaces==="focus")?.label||"Фокус";
  return `<p class="lw-status"><b>${a.hp}/${LionwingEngine.maxHealth(a)} ЗД</b> · ${a.ap} ОД · ${LionwingEngine.balance(a,"focus")} ${esc(focusLabel)}${a.kind === "hero" || a.heroId ? ` · ${a.wounds || 0}/3 Ран${vulnerability}` : ""}${a.stepRemaining ? ` · осталось ${a.stepRemaining} кл. Шага` : ""}</p>`;
}

function lwPendingHtml() {
  const choice = Scene.lionwing?.choices?.[0];
  const techniqueSurface = window.DAWN_LIONWING_TECHNIQUE_SURFACE;
  if (choice?.kind === "technique-trigger" && techniqueSurface?.pendingHtml) {
    if (!lwCanNarrate() && !lwOwns(choice.actorId)) return "<section class=\"lw-pending lw-technique-offer-hidden\"><p>Ожидается решение другого участника.</p></section>";
    return techniqueSurface.pendingHtml(choice, { scene: Scene, viewer: lwEntityViewer(), canRespond: lwCanNarrate() || lwOwns(choice.actorId) });
  }
  if (choice) {
    const owner = Scene.actors.find(a => a.id === choice.actorId), can = ["clash-tie","duel-outcome","duel-wounds"].includes(choice.kind)?lwCanNarrate():lwOwns(choice.actorId);
    const duel=choice.kind==="duel-outcome"?Scene.lionwing.duels.find(item=>item.id===choice.context.duelId):null;
    const duelControls=duel&&can?`<label>Напряжение Дуэли<input type="number" min="0" max="999" data-lw-duel-tension value="${duel.tension}"></label><button data-lw-set-duel-tension="${esc(duel.id)}" data-lw-actor="${esc(choice.actorId)}">Задать Напряжение Дуэли</button><p>Подходы и ресурсы разрешите до определения победителя. Используйте панель бросков и общие операции ресурсов; Напряжение исходного боя сохраняется.</p>`:"";
    const labels = { keep:"Применить Эффект", "bail":"Отступить — без ставки", "take-it":"Принять удар — вернуть Влияние", "double-down":"Удвоить ставку — переброс", "one-wound":"1 Рана (стр. 38)", "two-wounds":"2 Раны (стр. 62)", resist: "Сопротивляться", accept: choice.kind==="clash-loss"?"Принять Атаку":"Принять выведение", reroll:"5 урона → перебросить", win:choice.kind==="duel-outcome"?"Инициатор победил":"Защитник победил",lose:choice.kind==="duel-outcome"?"Инициатор проиграл":"Атакующий победил",record: "Записать решение", place: "Выбрать клетку", "call-help": "Подтянуть Испуганных врагов и нанести урон" };
    return `<section class="lw-pending"><strong>${esc(owner?.name || "Участник")}: ${esc(choice.kind==="duel-wounds"?"Продолжить сохранённую Дуэль: 1 Рана по уточнению автора":choice.title)}</strong>${duelControls}${choice.kind==="replacement"?`<p>${esc([...lwRules().effects.positive,...lwRules().effects.negative].find(e=>e.id===choice.context.effect)?.name||choice.context.effect)}. Исходный Эффект ещё не наложен.</p>`:""}${choice.context?.text ? `<p>${esc(choice.context.text)}</p>` : ""}${can ? `${choice.options.includes("record") ? '<input data-lw-choice-note placeholder="Принятое решение" aria-label="Принятое решение">' : ""}<div class="button-row">${(choice.kind==="duel-wounds"?["one-wound"]:choice.options).map(option => `<button data-lw-choice="${option}" data-lw-choice-id="${esc(choice.id)}"${choice.context?.actionPlanId?` data-lw-plan-id="${esc(choice.context.actionPlanId)}"`:""} data-lw-actor="${esc(choice.actorId)}">${esc(choice.context?.labels?.[option] || labels[option] || option)}</button>`).join("")}</div>` : "<p>Ожидается решение владельца героя.</p>"}</section>`;
  }
  const pending = Scene.pendingAction;
  if (!pending?.lionwing) return "";
  const waiting = SceneEngine.pendingActionStatus(Scene).waitingIds;
  return `<section class="lw-pending"><strong>${esc(pending.name)} · ${pending.damage} урона${pending.repeat > 1 ? ` × ${pending.repeat} отдельных нанесений` : ""}</strong>${waiting.map(id => { const a = Scene.actors.find(x => x.id === id); return `<div class="lw-reaction"><b>${esc(a.name)}</b>${lwOwns(id) ? `<div class="button-row">${[["take", "Принять", 0], ["block", "Блок", 2], ["dodge", "Уворот", 2], ["clash", "Столкновение", 2]].map(([key,label,cost]) => `<button data-lw-reaction="${key}"${pending.actionPlanId?` data-lw-plan-id="${esc(pending.actionPlanId)}"`:""} data-lw-actor="${esc(id)}" ${!LionwingEngine.canSpend(a,"focus",cost) ? 'disabled title="Недостаточно Фокуса"' : ""}>${label}${cost ? ` · ${cost} Фокуса` : ""}</button>`).join("")}</div>` : " · ожидается ответ"}</div>`; }).join("")}${!waiting.length && lwCanNarrate() ? `<button class="primary" data-lw-resolve${pending.actionPlanId?` data-lw-plan-id="${esc(pending.actionPlanId)}"`:""} data-lw-actor="${esc(pending.actorId)}">Применить урон</button>` : ""}${lwCanNarrate() ? `<button data-lw-cancel${pending.actionPlanId?` data-lw-plan-id="${esc(pending.actionPlanId)}"`:""} data-lw-actor="${esc(pending.actorId)}">Прервать</button>` : ""}</section>`;
}

function lwAutomationHtml(a) {
  const rules = window.DAWN_LIONWING_ADAPTERS.list(a);
  if (!rules.length) return "";
  return `<details><summary>Автоматизация Техник</summary><p>Включайте только те правила, которые хотите разыгрывать автоматически. Остальные Уровни остаются ручными.</p>${rules.map(rule => {
    const enabled = a.lionwing?.automation?.[rule.id] === true;
    return `<p>${esc(rule.label)} · ${enabled ? "включено" : "вручную"}${lwCanNarrate() ? ` <button data-lw-automation="${esc(rule.id)}" data-lw-actor="${esc(a.id)}" data-lw-enabled="${!enabled}">${enabled ? "Выключить" : "Включить"}</button>` : ""}</p>`;
  }).join("")}</details>`;
}

function lwInventoryHtml(a) {
  const api = window.DAWN_LIONWING_INVENTORY;
  if (!api?.project || !a?.lionwing?.inventory) return "";
  let projection;
  try { projection = api.project(Scene, { role: lwCanNarrate() ? "narrator" : "owner", actorIds: [a.id] }); }
  catch (error) { return `<details open><summary>Инвентарь</summary><p class="autosave">Инвентарь недоступен: ${esc(error.message || error)}</p></details>`; }
  const state = projection?.[a.id], definitions = state?.definitions || {}, records = Object.values(state?.records || {});
  if (!state || !records.length) return "";
  const rows = records.map(record => {
    const definition = definitions[record.definitionId];
    if (!definition) return "";
    const numeric = ["stack", "count", "charges", "slots"].includes(definition.kind), value = numeric ? api.readNumeric(record) : definition.kind === "recorded-value" ? (record.values || []).map(item => item.value).join(", ") || "—" : (record.selectedItems || (record.selectedItemId ? [record.selectedItemId] : [])).join(", ") || "—";
    if (!numeric) return `<div class="lw-inventory-row" data-lw-inventory-row><span><b>${esc(definition.label)}</b>${record.instanceId ? ` · ${esc(record.instanceId)}` : ""}<small>${esc(definition.kind)} · ${esc(String(value))}</small></span></div>`;
    const spend = api.status(Scene, a.id, { id: definition.id, instanceId: record.instanceId, operation: "spend", amount: 1 }), gain = api.status(Scene, a.id, { id: definition.id, instanceId: record.instanceId, operation: "gain", amount: 1 }), max = definition.maximum == null ? "∞" : definition.maximum;
    return `<div class="lw-inventory-row" data-lw-inventory-row><span><b>${esc(definition.label)}</b>${record.instanceId ? ` · ${esc(record.instanceId)}` : ""}<small>${esc(definition.kind)} · ${value} / ${max}${spend.reserved ? ` · зарезервировано ${spend.reserved}` : ""}</small></span><span class="button-row"><button type="button" data-lw-inventory="spend" data-lw-inventory-id="${esc(definition.id)}"${record.instanceId ? ` data-lw-inventory-instance="${esc(record.instanceId)}"` : ""} data-lw-actor="${esc(a.id)}" ${spend.available && lwOwns(a.id) ? "" : `disabled title="${esc(spend.reason || "Расход недоступен")}"`}>−</button><button type="button" data-lw-inventory="gain" data-lw-inventory-id="${esc(definition.id)}"${record.instanceId ? ` data-lw-inventory-instance="${esc(record.instanceId)}"` : ""} data-lw-actor="${esc(a.id)}" ${gain.available && lwOwns(a.id) ? "" : `disabled title="${esc(gain.reason || "Получение недоступно")}"`}>+</button></span></div>`;
  }).join("");
  return `<details class="lw-inventory" open><summary>Инвентарь и заряды</summary><p>Текущие значения принадлежат ядру Сцены. Кнопки меняют только проверяемую запись; служебные receipt игроку не показываются.</p><div class="lw-inventory-list">${rows}</div></details>`;
}

function lwActionsHtml(a) {
  if (!a) return "<p>Выберите участника на поле.</p>";
  const techniqueSurface=window.DAWN_LIONWING_TECHNIQUE_SURFACE?.render?.(a,{scene:Scene,viewer:lwEntityViewer()})||"";
  const buttons = lwRules().actions.list.filter(d => d.type === "action"&&(a.kind!=="enemy"||d.id===SceneEngine.ACTION_IDS.step)).map(def => {
    const normal = LionwingEngine.actionStatus(Scene, a, def), breakout = !normal.available && Scene.lionwing?.breakout ? LionwingEngine.actionStatus(Scene, a, def, { breakout: true }) : null;
    const status = breakout?.available ? breakout : normal, reason = status.reason || "";
    return `<button data-lw-action="${esc(def.id)}" data-lw-actor="${esc(a.id)}" ${breakout?.available ? 'data-lw-breakout="true"' : ""} ${status.available && lwOwns(a.id) ? "" : "disabled"} title="${esc(reason || def.text)}"><strong>${esc(def.name)}</strong><small>${esc(reason || (breakout?.available ? "Прорыв · 1 Влияние" : status.continuation ? `Продолжить · ${a.stepRemaining} кл.` : `${status.cost} ${status.resource === "ap" ? "ОД" : "Влияния"}`))}</small></button>`;
  }).join("");
  const opportunities=(Scene.lionwing?.opportunities||[]).filter(o=>o.actorId===a.id&&lwOwns(a.id)).map(o=>`<button data-lw-punish="${esc(o.id)}" data-lw-actor="${esc(a.id)}" ${!LionwingEngine.canSpend(a,"focus",2)?"disabled":""}>Наказать · 2 Фокуса: ${esc(Scene.actors.find(x=>x.id===o.targetId)?.name||"цель")}</button>`).join("");
  const detective=LionwingEngine.detectiveMovementStatus?.(Scene,a.id), detectiveState=lwDetectiveTeleport?.actorId===a.id?lwDetectiveTeleport:null;
  const detectiveControls=detective?.available&&lwOwns(a.id)?`<div class="lw-detective-teleport"><button data-lw-detective-teleport data-lw-actor="${esc(a.id)}">Детектив III: заменить Шаг телепортом</button><small>Допустимые Слабые точки: ${detective.markers.map(item=>`(${item.destination.x}, ${item.destination.y})`).join(", ")} · до ${detective.allowance} кл.</small>${detectiveState?.plan?`<p>Предпросмотр: (${detectiveState.plan.preview.stoppedAt.x}, ${detectiveState.plan.preview.stoppedAt.y}) · ${detectiveState.plan.preview.distance ?? ""} кл. <button data-lw-detective-confirm data-lw-actor="${esc(a.id)}">Подтвердить</button> <button data-lw-detective-cancel>Отмена</button></p>`:detectiveState?`<p>Выберите подсвеченную Слабую точку на поле. <button data-lw-detective-cancel>Отмена</button></p>`:""}</div>`:"";
  const effects=[...lwRules().effects.positive,...lwRules().effects.negative].filter(e=>e.id!=="positive.изгнан");
  return `<section class="lw-actions" data-lw-root data-lw-actor="${esc(a.id)}">${lwStatusHtml(a)}${lwDiceHtml(a)}${lwInventoryHtml(a)}${lwAutomationHtml(a)}${techniqueSurface}${lwPendingHtml()}${lwChainHtml(a)}${opportunities}${detectiveControls}${(a.effects||[]).includes("positive.невидим")?`<button data-lw-invisible data-lw-actor="${esc(a.id)}">Потратить Невидимость → Исчезнуть</button>`:""}${lwDestination ? '<p class="lw-hint">Выберите клетку на поле. <button data-lw-clear-destination>Отменить выбор</button></p>' : ""}<div class="core-action-list">${buttons}</div><details><summary>Параметры действия</summary><div class="lw-fields"><label>Атрибут<select data-lw-attribute><option value="">Подобрать по действию</option><option value="body">Тело</option><option value="talent">Талант</option><option value="spirit">Дух</option><option value="mind">Разум</option></select></label><label>Фокус для Завершения<input data-lw-focus type="number" min="0" max="${Math.min(Object.values(a.ruleResources||{}).some(r=>r.replaces==="focus"&&r.inverted)?Scene.tension||0:LionwingEngine.balance(a,"focus"), Scene.tension || 0)}" value="0"></label><label>Преимущество<input data-lw-advantage type="number" min="0" max="50" value="0"></label><label>Помеха<input data-lw-disadvantage type="number" min="0" max="50" value="0"></label><label>Импровизация<select data-lw-improvise-effect><option value="">Создать препятствие</option>${effects.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label><label>Убрать соседнее препятствие<select data-lw-remove-obstacle><option value="">Не убирать</option>${Scene.objects.filter(o=>o.type==="terrain"&&o.space===a.space).map(o=>`<option value="${esc(o.id)}">${esc(o.label||"Препятствие")}</option>`).join("")}</select></label><label><input type="checkbox" data-lw-spike>Использовать бонус по Подброшенным целям</label></div></details></section>`;
}

function lwEffectSourcesHtml(targets) {
  const definitions=[...lwRules().effects.positive,...lwRules().effects.negative], names=new Map(definitions.map(effect=>[effect.id,effect.name]));
  const durationNames={default:"по правилу",startTurn:"до начала следующего Хода владельца срока",endTurn:"до конца следующего Хода владельца срока",nextTurn:"до следующего Хода",roundEnd:"до конца Раунда",scene:"до конца Сцены",persistent:"постоянно",manual:"до ручного снятия"};
  const rows=targets.flatMap(target=>{
    const auraEffects=(Scene.lionwing?.auras||[]).map(aura=>aura.effectId).filter(Boolean), effects=[...new Set([...Object.keys(target.effectStates||{}),...(target.effects||[]),...auraEffects])];
    return effects.flatMap(effect=>{
    const status=LionwingEngine.effectInstanceStatus(Scene,target.id,effect), unsupported=Boolean(target.compoundId||["positive.исчез","positive.изгнан"].includes(effect));
    return status.sources.map(source=>{
      const sourceActor=Scene.actors.find(actor=>actor.id===source.actorId), suppressions=source.suppressedBy||[], duration=source.duration||"default";
      const label=source.aura?`Аура · ${sourceActor?.name||source.ownerActorId||"правило Сцены"}`:sourceActor?.name||"правило Сцены", activity=source.aura?` · ${source.active===false?"неактивна":"активна"}${source.reason?`: ${esc(source.reason)}`:""}`:source.active===false?` · неактивна${source.reason?`: ${esc(source.reason)}`:""}`:"";
      const controls=source.aura?`<small>Активность вычисляется по источнику, геометрии и фильтру; копия на цели не создаётся.</small>`:`<div class="button-row"><button data-lw-effect-source="remove" data-lw-target="${esc(target.id)}" data-lw-effect="${esc(effect)}" data-lw-source="${esc(source.sourceId)}" ${source.removable?"":'disabled title="Этот источник нельзя снять вручную"'}>Снять этот источник</button>${suppressions.map(suppressionId=>`<button data-lw-effect-source="restore" data-lw-target="${esc(target.id)}" data-lw-effect="${esc(effect)}" data-lw-source="${esc(source.sourceId)}" data-lw-suppression="${esc(suppressionId)}">Вернуть источник</button>`).join("")}${suppressions.length?"":`<label>Причина подавления<input data-lw-suppression-reason placeholder="Например: защитное поле"></label><button data-lw-effect-source="suppress" data-lw-target="${esc(target.id)}" data-lw-effect="${esc(effect)}" data-lw-source="${esc(source.sourceId)}" ${unsupported?'disabled title="Подавление составных участников, Исчезновения и Изгнания пока не поддерживается"':""}>Подавить этот источник</button>`}</div>`;
      return `<li data-lw-effect-source-row><b>${esc(target.name)}</b> · ${esc(names.get(effect)||effect)}<br><small>Источник: ${esc(label)} · ${esc(durationNames[duration]||duration)}${suppressions.length?" · подавлен":""}${activity}</small><details><summary>Технические данные</summary><code>${esc(source.sourceId)}</code>${suppressions.length?`<br><code>${suppressions.map(esc).join(", ")}</code>`:""}</details>${controls}</li>`;
    });
    });
  });
  return `<details class="lw-effect-sources" ${rows.length?"open":""}><summary>Источники Эффектов${rows.length?` · ${rows.length}`:""}</summary>${rows.length?`<p>Каждая кнопка меняет только указанный источник у указанной цели.</p><ul>${rows.join("")}</ul>`:"<p>У выбранных целей нет отдельных источников Эффектов.</p>"}</details>`;
}

function lwDirectorHtml(a) {
  if (!a) return "";
  const targets = Scene.targetIds.map(id => Scene.actors.find(x => x.id === id)).filter(Boolean);
  const effects = [...lwRules().effects.positive, ...lwRules().effects.negative];
  return `<section class="director-section lw-console" data-lw-root data-lw-actor="${esc(a.id)}"><header><strong>LionWing · ${esc(a.name)}</strong><small>Источник — выбранный участник</small></header>${lwActionsHtml(a)}${lwGeometryPreviewHtml()}<div class="lw-operation"><p><b>Цели:</b> ${targets.length ? targets.map(t => esc(t.name)).join(", ") : "выберите на поле или в составе"}</p><div class="lw-fields"><label>Урон / лечение<input data-lw-amount type="number" min="0" max="9999" value="1"></label><label>Отдельных нанесений<input data-lw-repeat type="number" min="1" max="30" value="1"></label><label>Цена: ОД<input data-lw-cost-ap type="number" min="0" max="9999" value="0"></label><label>Фокус<input data-lw-cost-focus type="number" min="0" max="9999" value="0"></label><label>Влияние<input data-lw-cost-influence type="number" min="0" max="9999" value="0"></label><label>Здоровье<input data-lw-cost-health type="number" min="0" max="9999" value="0"></label><label>Эффект<select data-lw-effect><option value="">Без Эффекта</option>${effects.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label><label>Срок<select data-lw-duration><option value="default">По правилу</option><option value="startTurn">До начала следующего Хода цели</option><option value="endTurn">До конца следующего Хода цели</option><option value="roundEnd">До конца Раунда</option><option value="scene">До конца Сцены</option><option value="manual">Снять вручную</option></select></label></div><details><summary>Урон по отдельным целям</summary>${targets.map(target=>`<label>${esc(target.name)}<input type="number" min="0" max="9999" data-lw-target-damage="${esc(target.id)}" placeholder="Общий урон"></label>`).join("")}</details><details><summary>Особые правила урона</summary><label><input type="checkbox" data-lw-ignore-armor>Игнорирует Броню</label><label><input type="checkbox" data-lw-ignore-evasion>Игнорирует Уклонение</label><label><input type="checkbox" data-lw-irreducible>Урон нельзя снизить</label><label><input type="checkbox" data-lw-final-damage>Указано окончательное значение: без Усиления, Ослабления и Помечен</label></details><div class="button-row"><button class="primary" data-lw-operation="attack">Атака → Реакции</button>${Scene.pendingAction?`<button data-lw-operation="amend-attack">Изменить ожидающую Атаку</button>`:""}<button data-lw-operation="damage">Нанести урон</button><button data-lw-operation="heal">Вылечить</button><button data-lw-operation="effect">Наложить Эффект</button><button data-lw-operation="remove-effect">Снять Эффект</button></div><small>Цена подтверждается атомарно. Расход Здоровья записывается отдельно от урона.</small><p data-lw-preview aria-live="polite"></p></div><details><summary>Исправить состояние</summary><div class="lw-fields"><label>Поле<select data-lw-correct-field>${[["hp","Здоровье"],["maxHp","Максимум ЗД"],["ap","ОД"],["baseAp","ОД в начале Хода"],["focus","Фокус"],["wounds","Раны"],["stress","Стресс"],["influence","Влияние"],["armor","Броня"],["evasion","Уклонение"],["speed","Скорость"],["vulnerable","Уязвимость: 0 — нет, 1 — да"],["body","Тело"],["talent","Талант"],["spirit","Дух"],["mind","Разум"],["knockedOut","Вне боя: 0 — нет, 1 — да"]].map(([key,label]) => `<option value="${key}">${label}</option>`).join("")}</select></label><label>Точное значение<input data-lw-correct-value type="number" min="0" max="9999" value="${a.hp}"></label><button data-lw-correct>Задать выбранному участнику</button></div></details><details><summary>Ресурсы, часы и временные изменения</summary><div class="lw-fields"><label>ID<input data-lw-custom-id value="custom.resource" aria-label="ID ресурса или часов"></label><label>Название<input data-lw-custom-label value="Ресурс"></label><label>Значение<input data-lw-custom-value type="number" min="0" max="9999" value="0"></label><label>Максимум / сегменты<input data-lw-custom-size type="number" min="1" max="9999" value="4"></label><label>При сбросе<input data-lw-custom-initial type="number" min="0" max="9999" value="0"></label><label>Сбрасывать<select data-lw-custom-reset><option value="manual">Только вручную</option><option value="startTurn">В начале своего Хода</option><option value="endTurn">В конце своего Хода</option><option value="roundEnd">В конце Раунда</option><option value="scene">При завершении Сцены</option></select></label><label><input data-lw-custom-unbounded type="checkbox">Ресурс без максимума</label></div><div class="button-row"><label><input data-lw-replaces-focus type="checkbox">Заменяет Фокус</label><label><input data-lw-replaces-ap type="checkbox">Заменяет ОД</label><label><input data-lw-inverted-focus type="checkbox">Обратный расход: стоимость Фокуса увеличивает ресурс, получение уменьшает</label><button data-lw-custom="configure-resource">Задать ресурс</button><button data-lw-custom="spend">Потратить ресурс</button><button data-lw-custom="gain">Получить ресурс</button><button data-lw-custom="clock">Задать часы</button><button data-lw-custom="reset-resource">Сбросить ресурс</button><button data-lw-custom="remove-resource">Удалить ресурс</button><button data-lw-custom="reset-clock">Сбросить часы</button><button data-lw-custom="remove-clock">Удалить часы</button></div><div class="lw-fields"><label>Показатель<select data-lw-mod-stat><option value="armor">Броня</option><option value="evasion">Уклонение</option><option value="speed">Скорость</option></select></label><label>Изменение<input data-lw-mod-amount type="number" min="-9999" max="9999" value="1"></label><label>Срок изменения<select data-lw-mod-duration><option value="endTurn">До конца следующего Хода цели</option><option value="startTurn">До начала следующего Хода цели</option><option value="roundEnd">До конца Раунда</option><option value="scene">До конца Сцены</option><option value="manual">Снять вручную</option></select></label><button data-lw-modifier="add">Добавить временное изменение</button><button data-lw-modifier="remove">Снять временные изменения показателя</button></div></details></section>`;
}

const lwOldActionPanel = sceneActionPanel;
sceneActionPanel = function(actorOverride = null) { return lwActive() ? lwActionsHtml(actorOverride || currentHeroActor()) : lwOldActionPanel(actorOverride); };
const lwOldDirector = renderSceneDirector;
renderSceneDirector = function() {
  if (lwActive()) lwReconcileGeometryPreview();
  lwOldDirector();
  if (!lwActive()) return;
  renderLionwingEntities();
  lwInstallGeometryPreviewGuard();
  const root = $("scene-director"), a = lwActor();
  if (!root || !a) return;
  const holder=document.createElement("div");holder.innerHTML=lwDirectorHtml(a);
  holder.firstElementChild.insertAdjacentHTML("afterbegin",lwBatchHtml());
  holder.firstElementChild.insertAdjacentHTML("beforeend",lwGeneralHtml());
  const consoleNode=holder.firstElementChild,actions=consoleNode.querySelector(".lw-actions"),turnPane=root.querySelector('[data-director-pane="turn"]'),manualPane=root.querySelector('[data-director-pane="manual"]');
  consoleNode.querySelector('[data-lw-operation="remove-effect"]')?.remove();
  consoleNode.querySelector(".lw-operation")?.insertAdjacentHTML("beforeend",lwEffectSourcesHtml((Scene.targetIds.length?Scene.targetIds:[a.id]).map(id=>Scene.actors.find(actor=>actor.id===id)).filter(Boolean)));
  if(turnPane&&manualPane){turnPane.prepend(actions);manualPane.prepend(consoleNode);}
  else root.prepend(consoleNode);
  for(const input of root.querySelectorAll("[data-lw-root] input,[data-lw-root] select,[data-lw-root] textarea")){const key=lwDraftKey(input);if(key&&lwFormDraft.has(key)){if(input.type==="checkbox")input.checked=lwFormDraft.get(key);else input.value=lwFormDraft.get(key);}}
  // Keep library, clocks, reminders, media and table tools in their established place.
  for (const element of root.querySelectorAll(".director-resource-row.health, .director-outcome, .director-exact-grid")) if (!element.closest(".lw-console")) element.hidden = true;
  if(Scene.pendingAction||Scene.lionwing?.choices?.length)for(const element of root.querySelectorAll(".director-turn-handoff"))element.hidden=true;
  for (const element of root.querySelectorAll(".director-outcome-options")) element.textContent = "Точные изменения записываются как исправления. Для игровых действий используйте операции LionWing выше.";
};

const lwOldEventText = eventText;
eventText = function(event) {
  if (!lwActive()) return lwOldEventText(event);
  const p = event.payload || {}, a = Scene.actors.find(x => x.id === (p.targetId || event.actorId));
  const resourceNames={hp:"Здоровье",maxHp:"максимум Здоровья",ap:"ОД",baseAp:"ОД в начале Хода",focus:"Фокус",influence:"Влияние",wounds:"Раны",stress:"Стресс",armor:"Броня",evasion:"Уклонение",speed:"Скорость",body:"Тело",talent:"Талант",spirit:"Дух",mind:"Разум",vulnerable:"Уязвимость",knockedOut:"Выведение"};
  const choiceNames={resist:"Сопротивляться",accept:"Принять последствия",win:"Инициатор победил",lose:"Инициатор проиграл",bail:"Отступить: без ставки", "take-it":"Принять удар и вернуть Влияние","double-down":"Удвоить ставку","one-wound":"1 Рана","two-wounds":"2 Раны",place:"Клетка возвращения выбрана",reroll:"Получить 5 урона и перебросить"};
  const who=a?.name||"Нарратор";
  if (p.correction) return `${who}: исправлено ${resourceNames[p.resource]||p.resource}, ${p.before} → ${p.value}`;
  if(event.type==="attack.amend")return `Нарратор изменил ожидающую Атаку: ${p.amount} урона, целей ${p.targetIds?.length||0}`;
  if(event.type==="actor.track.recover")return `${who}: ${p.track==="wounds"?"вылечены Раны":"снят Стресс"} −${p.amount}, осталось ${p.value}`;
  if(/^rule-(clock|resource)\.(reset|remove)$/.test(event.type))return `${who}: счётчик ${p.id} ${event.type.endsWith("remove")?"удалён":`сброшен до ${p.value}`}`;
  if(event.type==="effect.source.remove")return `${who}: снят один источник Эффекта; остальные источники сохраняются`;
  if(event.type==="chain.pause")return "Цепочка приостановлена для ручного правила";
  if(event.type==="chain.resume")return "Приостановленная цепочка возобновлена";
  if(event.type==="actor.stress")return `${who}: Стресс ${p.total}/3`;
  if(event.type==="health.spend"||event.type==="health.lose")return `${who}: ${event.type==="health.spend"?"потрачено":"потеряно"} ${p.lost} Здоровья (${p.hp} осталось)`;
  if(event.type==="cost.commit")return `${who}: составная цена подтверждена (${p.costs?.length||0} частей)`;
  if(event.type==="duel.start")return `${Scene.actors.find(x=>x.id===event.actorId)?.name||"Инициатор"}: Дуэль с ${who}`;
  if(event.type==="duel.tension")return `Напряжение Дуэли: ${p.amount}`;
  if(event.type==="duel.end")return "Дуэль завершена: оба участника вернулись на край поля";
  if(event.type==="scene.tension")return `Напряжение Сцены: ${p.amount}`;
  if(event.type==="scene.reset")return "Бой завершён: здоровье восстановлено, временное состояние очищено; Раны и Стресс сохранены";
  if(event.type==="rule.used")return `${who}: учтено применение ${p.ruleId} (${({turn:"Ход",round:"Раунд",scene:"Сцена"})[p.scope]||p.scope})`;
  if(event.type==="action.allow")return `${who}: допуск ${lwRules().actions.list.find(d=>d.id===p.actionId)?.name||p.actionId}, применений ${p.uses??1}${p.swift?", Быстрое":""}`;
  if(event.type==="modifier.configure"&&p.stat)return `${who}: временное изменение ${resourceNames[p.stat]||p.stat} ${p.amount>0?"+":""}${p.amount}`;
  if(event.type==="modifier.remove")return `${who}: сняты временные изменения ${resourceNames[p.stat]||p.stat}`;
  if(event.type.startsWith("inventory."))return `${who}: ${p.operation||event.type.replace("inventory.","")} · ${p.itemId||p.id||"запись"}${p.value!=null?` → ${p.value}`:""}${p.boundary?` · ${p.boundary}`:""}`;
  if(event.type==="movement.prevented")return `${who}: принудительное движение предотвращено (${p.reason})`;
  if(event.type==="geometry.route.commit"){
    const stopped=p.stoppedAt?`${String.fromCharCode(65+Number(p.stoppedAt.x))}${Number(p.stoppedAt.y)+1}`:"—",reason=p.terminal?lwGeometryStopReason(p.stopReason):p.partial?"цель недостижима, показана ближайшая клетка":"";
    return `${who}: движение по маршруту до ${stopped}, потрачено ${p.spent??0} кл.${reason?` · ${reason}`:""}`;
  }
  if(event.type==="reaction.respond")return `${who}: ${({take:"Принять Атаку",block:"Блок",dodge:"Уворот",clash:"Столкновение"})[p.choice]||p.choice}`;
  if (event.type === "actor.wound") return `${a?.name}: Раны ${p.total}/3, ЗД восстановлено до ${p.hp}`;
  if (event.type === "automation.configure") return `${a?.name || "Участник"}: ${window.DAWN_LIONWING_ADAPTERS.list(a).find(rule=>rule.id===p.ruleId)?.label||p.ruleId} — ${p.enabled ? "автоматизация включена" : "ручное исполнение"}`;
  if (event.type === "rule.activated") return `${a?.name || "Участник"}: ${window.DAWN_LIONWING_ADAPTERS.list(a).find(rule=>rule.id===p.ruleId)?.label||p.ruleId}`;
  if (event.type === "rule.completed") return p.outcome === "skipped" ? "Необязательное правило пропущено" : "Последствия правила завершены";
  if (event.type === "consequence.replaced") return `${a?.name || "Участник"}: Эффект заменён на 2 урона (Берсерк II)`;
  if (event.type === "consequence.completed") return p.outcome === "replaced" ? "Замена последствия завершена" : "Применение Эффекта завершено";
  if (event.type === "rule.respond") return `${a?.name || "Нарратор"}: ${p.note || p.title || choiceNames[p.choice] || p.choice || "решение"}`;
  if (event.type === "action.resolve") return `${a?.name || "Участник"}: ${lwRules().actions.list.find(d => d.id === p.actionId)?.name || p.name}`;
  return lwOldEventText(event);
};

const lwOldSetValue = setNarratorActorValue;
setNarratorActorValue = function(a,key,value,label) { return lwActive() ? lwSubmit(a.id, { kind: "correct", resource: key, amount: value }, label || "Исправление Нарратора") : lwOldSetValue(a,key,value,label); };
const lwOldSetEffect = setNarratorEffect;
setNarratorEffect = function(a,effect,remove) { return lwActive() ? lwSubmit(a.id, { kind: "effect", effect, remove }, "Эффект LionWing") : lwOldSetEffect(a,effect,remove); };
const lwOldOverride=applyNarratorOverride;
applyNarratorOverride=function(request){if(!lwActive())return lwOldOverride(request);const a=lwActor(),operations=[];for(const target of request.targets||[]){if(request.damage)operations.push({kind:"damage",targetId:target.id,amount:request.damage});if(request.effectId)operations.push({kind:"effect",targetId:target.id,effect:request.effectId});}if(request.note)operations.push({kind:"note",note:request.note});return a&&operations.length?lwSubmit(a.id,{kind:"batch",operations},"Результат действия"):false;};
const lwOldForceRound = forceNarratorRound;
forceNarratorRound = function() { return lwActive() ? commitSceneEvents("Конец Раунда", [{type:"round.end",actorId:null,payload:{}}]) : lwOldForceRound(); };
const lwOldForceTurn = forceNarratorTurn;
forceNarratorTurn = function(a) { return lwActive() ? setActorTurn(a) : lwOldForceTurn(a); };
const lwOldTakeWound = takeWound;
takeWound = function(external) { const a=currentHeroActor();return lwActive()&&a?lwSubmit(a.id,{kind:"wound",targetId:a.id,sourceActorId:external?null:a.id},"Рана"):lwOldTakeWound(external); };
const lwOldBoardMove = moveSceneActorFromBoard;
moveSceneActorFromBoard = function(a,x,y,options={}) {
  if (!lwActive()) return lwOldBoardMove(a,x,y,options);
  if (!lwOwns(a.id)) return toast("Можно перемещать только своего героя");
  if (a.x === x && a.y === y) return;
  if (!Scene.lionwing?.started) return commitSceneEvents("Развёртывание", [{ type:"actor.move", actorId:a.id, payload:{space:Scene.activeSpace,x,y,placement:true,movement:"Развертывание"} }]);
  if (options.manual || Scene.tool === "place") { if (!lwCanNarrate()) return toast("Ручная перестановка доступна Нарратору"); return lwSubmit(a.id,{kind:"move",destination:{space:Scene.activeSpace,x,y},placement:true},"Ручная перестановка"); }
  return lwSubmit(a.id,{kind:"action",actionId:SceneEngine.ACTION_IDS.step,destination:{x,y}},"Шаг");
};

document.addEventListener("click", event => {
  if (!lwActive()) return;
  const diceButton = event.target.closest("[data-lw-dice-create],[data-lw-dice-op]");
  if (diceButton) { event.preventDefault(); event.stopImmediatePropagation(); return lwDiceClick(diceButton); }
  const entityDestroy = event.target.closest("[data-lw-entity-destroy]");
  if (entityDestroy) { event.preventDefault(); event.stopImmediatePropagation(); return lwDestroyEntity(entityDestroy.dataset.lwEntityDestroy); }
  const effectSource=event.target.closest("[data-lw-effect-source]");
  if(effectSource){event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return toast("Эта операция доступна Нарратору");const operation=effectSource.dataset.lwEffectSource,reason=effectSource.closest("[data-lw-effect-source-row]")?.querySelector("[data-lw-suppression-reason]")?.value?.trim(),suppressionId=effectSource.dataset.lwSuppression||`manual:${effectSource.closest(".lw-console")?.dataset.lwActor||"narrator"}:${Date.now()}`;if(operation==="suppress"&&!reason)return toast("Укажите причину подавления");return lwSubmit(effectSource.closest(".lw-console")?.dataset.lwActor||lwActor()?.id,{kind:"effect-source",operation,targetId:effectSource.dataset.lwTarget,effect:effectSource.dataset.lwEffect,sourceId:effectSource.dataset.lwSource,...(["suppress","restore"].includes(operation)?{suppressionId}:{})},reason||"Источник Эффекта");}
  const chainControl=event.target.closest("[data-lw-chain]");
  if(chainControl){event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;const kind=chainControl.dataset.lwChain;return lwSubmit(chainControl.dataset.lwActor,{kind},kind==="resume-chain"?"Возобновление вложенной цепочки":"Приостановка цепочки для вложенного правила");}
  const batchControl=event.target.closest("[data-lw-batch-apply],[data-lw-batch-clear],[data-lw-batch-remove]");
  if(batchControl){event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;
    if(batchControl.hasAttribute("data-lw-batch-clear")){lwDraftBatch=null;lwDraftEnabled=false;renderScene();return;}
    if(!lwDraftBatch)return;
    if(batchControl.hasAttribute("data-lw-batch-remove")){const index=Number(batchControl.dataset.lwBatchRemove);if(Number.isInteger(index)&&index>=0&&index<lwDraftBatch.operations.length)lwDraftBatch.operations.splice(index,1);if(!lwDraftBatch.operations.length)lwDraftBatch=null;renderScene();return;}
    const costs=lwCostsFrom(batchControl.closest(".lw-batch")),targetIds=LionwingEngine.targetIds(Scene,lwDraftBatch.operations.flatMap(operation=>operation.targetIds||[operation.targetId]).filter(Boolean));
    const payload=costs.length?{kind:"plan",costs,operations:lwDraftBatch.operations,targetIds}:{...lwDraftBatch,kind:"batch"};
    const prepared=LionwingEngine.prepare(Scene,{...payload,actorId:lwDraftBatch.actorId});
    if(!prepared.ok)return toast(prepared.errors.join(" "));
    if(commitSceneEvents("Составной ручной пакет",prepared.events)){lwDraftBatch=null;lwDraftEnabled=false;activeDirectorTab=Scene.pendingAction||Scene.lionwing?.choices?.length?"turn":"manual";renderScene();}return;
  }
  const inspector=event.target.closest("[data-gm-resource],[data-gm-revive],[data-gm-manual-resolve],[data-gm-health]");
  if(inspector){
    event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;
    const actorId=inspector.dataset.gmActor||inspector.dataset.gmRevive||inspector.dataset.gmManualResolve,a=Scene.actors.find(item=>item.id===actorId);if(!a)return;
    if(inspector.hasAttribute("data-gm-health"))return lwSubmit(actorId,{kind:inspector.dataset.gmHealth==="damage"?"damage":"heal",targetId:actorId,amount:Number(inspector.dataset.amount),sourceActorId:null},"Здоровье LionWing");
    if(inspector.hasAttribute("data-gm-resource")){const key=inspector.dataset.gmResource,delta=Number(inspector.dataset.delta);return lwSubmit(actorId,["wounds","stress"].includes(key)?delta>0?{kind:key==="wounds"?"wound":"stress",targetId:actorId,sourceActorId:null}:{kind:"correct",resource:key,amount:Math.max(0,a[key]+delta)}:{kind:"resource",resource:key,operation:delta>0?"gain":"spend",amount:Math.abs(delta)},"Ресурс LionWing");}
    if(inspector.hasAttribute("data-gm-revive"))return lwSubmit(actorId,{kind:"batch",operations:[{kind:"correct",resource:"knockedOut",amount:0},{kind:"correct",resource:"hp",amount:Math.max(1,a.hp)}]},"Исправление участия в бою");
    const note=document.querySelector(`[data-gm-manual-note="${CSS.escape(actorId)}"]`)?.value;
    return lwSubmit(actorId,{kind:"note",note:note||"Ручное решение Нарратора"},"Ручное решение");
  }
  const cell = event.target.closest("[data-scene-cell]");
  if (lwDestination && cell) {
    event.preventDefault(); event.stopImmediatePropagation();
    const point = cell.dataset.sceneCell.split(",").map(Number), draft = lwDestination;
    const destination = { x:point[0], y:point[1], space:Scene.activeSpace };
    const payload={...draft.payload,[draft.field||"destination"]:destination};
    if(payload.kind==="geometry-move"){lwSetGeometryPreview(draft,payload);return;}
    if(draft.field==="reappearance"&&[SceneEngine.ACTION_IDS.jump,SceneEngine.ACTION_IDS.shove,SceneEngine.ACTION_IDS.improvise].includes(payload.actionId)&&!payload.effect&&!payload.removeObstacleId){lwDestination={actorId:draft.actorId,payload,label:draft.label};toast("Теперь выберите клетку действия");return;}
    if (lwSubmit(draft.actorId,payload,draft.label)) { lwDestination=null; renderScene(); }
    return;
  }
  const legacyAction=event.target.closest("[data-core-resolve], [data-core-cancel-pending]");
  if(legacyAction){event.preventDefault();event.stopImmediatePropagation();const a=currentHeroActor()||lwActor();if(!a)return;if(legacyAction.hasAttribute("data-core-action"))return lwSubmit(a.id,{kind:"action",actionId:legacyAction.dataset.coreAction,targetIds:[...Scene.targetIds]},"Базовое действие");if(!lwCanNarrate())return;return lwSubmit(Scene.pendingAction?.actorId||a.id,{kind:legacyAction.hasAttribute("data-core-resolve")?"resolve-attack":"cancel-attack"},"Разрешение Атаки");}
  const duelTension=event.target.closest("[data-lw-set-duel-tension]");
  if(duelTension){event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;return lwSubmit(duelTension.dataset.lwActor,{kind:"tension",duelId:duelTension.dataset.lwSetDuelTension,amount:Number(duelTension.closest(".lw-pending").querySelector("[data-lw-duel-tension]").value)},"Напряжение Дуэли");}
  const general=event.target.closest("[data-lw-general-submit]");
  if(general){
    event.preventDefault();event.stopImmediatePropagation();if(!lwCanNarrate())return;
    const root=general.closest(".lw-console"),sourceId=root.dataset.lwActor,get=key=>root.querySelector(`[data-lw-general-${key}]`)?.value,kind=get("kind"),amount=Number(get("amount")),targets=Scene.targetIds.length?LionwingEngine.targetIds(Scene,Scene.targetIds):[sourceId];
    if(kind==="roll"){
      const payload={kind,count:amount,rollKind:get("roll-kind"),critAt:Number(get("crit")),explode:root.querySelector("[data-lw-general-explode]").checked,label:get("note")||"Ручной бросок"};
      if(get("dice").trim())payload.roll={initialCount:amount,rolls:get("dice").trim().split(/[\s,;]+/).map(Number),critAt:payload.critAt,explode:payload.explode,formula:`${amount}D6`};
      return lwSubmit(sourceId,payload,"Ручной бросок");
    }
    const movementMode=get("movement"),movementKind=movementMode==="teleport"?"move":"geometry-move",geometryMode=movementMode==="normal"?"move":movementMode;
    let operations=targets.map(targetId=>({kind:kind==="move"?movementKind:kind,targetId,...(kind==="record-action"?{actionId:get("action"),resource:get("resource"),amount,swift:root.querySelector("[data-lw-general-swift]").checked,reaction:root.querySelector("[data-lw-general-reaction]").checked}:{}),...(kind==="recover-track"?{track:get("track"),amount}:{}),...(kind==="resource"?{resource:get("resource"),operation:get("direction"),amount}:{}),...(["note","prompt"].includes(kind)?{note:get("note"),title:get("note"),text:get("note")}:{}),...(kind==="allow-action"?{actionId:get("action"),cost:Number(get("cost")),uses:amount,swift:root.querySelector("[data-lw-general-swift]").checked,reaction:root.querySelector("[data-lw-general-reaction]").checked}:{}),...(kind==="usage"?{ruleId:get("id"),scope:get("scope"),limit:amount,targetIds:targets}:{}),...(kind==="move"?(movementMode==="teleport"?{maximum:amount,ignoreOpponents:root.querySelector("[data-lw-general-ignore-opponents]").checked,ignoreTerrain:root.querySelector("[data-lw-general-ignore-terrain]").checked,line:root.querySelector("[data-lw-general-line]").checked,teleport:true}:{maximum:amount,ignoreEnemies:root.querySelector("[data-lw-general-ignore-opponents]").checked,ignoreTerrain:root.querySelector("[data-lw-general-ignore-terrain]").checked,straight:root.querySelector("[data-lw-general-line]").checked,mode:geometryMode}):{})}));
    if(["spend-health","lose-health"].includes(kind))operations=operations.map(operation=>({...operation,amount}));
    if(["wound","stress"].includes(kind)){if(!Number.isInteger(amount)||amount<1||amount*targets.length>192)return toast("Укажите целое количество от 1 до 192 операций");operations=operations.flatMap(operation=>Array.from({length:amount},()=>({...operation})));}
    if(kind==="move"){if(targets.length!==1)return toast("Для движения выберите одну цель");lwDestination={actorId:sourceId,payload:operations[0],label:"Движение правила",stage:lwDraftEnabled&&movementKind==="geometry-move"};renderScene();toast(lwDestination.stage?"Выберите клетку: маршрут будет добавлен в пакет":"Выберите клетку назначения");return;}
    return lwSubmit(sourceId,operations.length===1?operations[0]:{kind:"batch",operations:["note","prompt","usage"].includes(kind)?[operations[0]]:operations},"Общая операция правила");
  }
  const button = event.target.closest("[data-core-action], [data-lw-automation], [data-lw-action], [data-lw-reaction], [data-lw-choice], [data-lw-resolve], [data-lw-cancel], [data-lw-clear-destination], [data-lw-geometry-confirm], [data-lw-geometry-add], [data-lw-geometry-cancel], [data-lw-operation], [data-lw-correct], [data-lw-custom], [data-lw-modifier], [data-lw-punish], [data-lw-invisible], [data-lw-inventory], [data-lw-detective-teleport], [data-lw-detective-confirm], [data-lw-detective-cancel]");
  if (!button) {
    const oldControl=event.target.closest("[data-director-set-field], [data-director-knockout], [data-director-tension], [data-director-open-reactions], [data-director-set-rule-resource], [data-director-set-rule-clock]");
    if(oldControl){event.preventDefault();event.stopImmediatePropagation();const a=lwActor();if(!a||!lwCanNarrate())return;
      if(oldControl.hasAttribute("data-director-tension"))return lwSubmit(a.id,{kind:"tension",amount:Math.max(0,Scene.tension+Number(oldControl.dataset.directorTension))},"Напряжение");
      if(oldControl.hasAttribute("data-director-knockout"))return lwSubmit(a.id,{kind:"correct",resource:"knockedOut",amount:oldControl.dataset.directorKnockout==="restore"?0:1},"Исправление участия в бою");
      if(oldControl.hasAttribute("data-director-open-reactions"))return lwSubmit(a.id,{kind:"attack",targetIds:[...Scene.targetIds],amount:Number($("scene-director-outcome-damage")?.value||0)},"Ручная Атака");
      if(oldControl.hasAttribute("data-director-set-field")){const key=oldControl.dataset.directorSetField,input=$("scene-director").querySelector(`[data-director-field-input="${CSS.escape(key)}"]`);return lwSubmit(a.id,{kind:"correct",resource:key.replace("attr.",""),amount:Number(input?.value)},"Исправление параметра");}
      if(oldControl.hasAttribute("data-director-set-rule-resource")){const id=oldControl.dataset.directorSetRuleResource,input=$("scene-director").querySelector(`[data-director-rule-resource-input="${CSS.escape(id)}"]`),def=a.ruleResources?.[id];return lwSubmit(a.id,{kind:"configure-resource",id,label:def?.label,value:Number(input?.value),maximum:def?.maximum??null},"Исправление ресурса");}
      const id=oldControl.dataset.directorSetRuleClock,input=$("scene-director").querySelector(`[data-director-rule-clock-input="${CSS.escape(id)}"]`),def=a.ruleClocks?.[id];return lwSubmit(a.id,{kind:"clock",id,label:def?.label,value:Number(input?.value),size:def?.size||4},"Исправление часов");
    }
    // Legacy shortcuts become the same typed operations, not direct HP mutation.
    const damage = event.target.closest("[data-director-damage], [data-director-heal]");
    if (damage) { event.preventDefault(); event.stopImmediatePropagation(); const a=lwActor(); if(a&&lwCanNarrate())lwSubmit(a.id,{kind:damage.hasAttribute("data-director-damage")?"damage":"heal",targetId:a.id,amount:Number(damage.dataset.directorDamage||damage.dataset.directorHeal),sourceActorId:null},"Здоровье LionWing"); }
    return;
  }
  event.preventDefault(); event.stopImmediatePropagation();
  const root = button.closest("[data-lw-root]") || button.closest(".lw-console"), actorId = button.dataset.lwActor || button.dataset.coreActor || root?.dataset.lwActor || lwActor()?.id;
  if(button.hasAttribute("data-lw-geometry-cancel")){lwClearGeometryPreview();return;}
  if((button.hasAttribute("data-lw-geometry-confirm")||button.hasAttribute("data-lw-geometry-add"))&&!lwCanNarrate())return toast("Подтвердить движение или добавить его в пакет может только Нарратор");
  if (!actorId || !lwOwns(actorId)) return toast("Этим участником управляет другой игрок");
  const val = (selector, fallback="") => root?.querySelector(selector)?.value ?? fallback;
  const num = (selector, fallback=0) => Number(val(selector,fallback));
  if(button.hasAttribute("data-lw-inventory")){
    const operation=button.dataset.lwInventory, id=button.dataset.lwInventoryId, instanceId=button.dataset.lwInventoryInstance, amount=Number(button.dataset.lwInventoryAmount||1);
    if(!["gain","spend","add","remove"].includes(operation)||!id||!Number.isSafeInteger(amount)||amount<1)return toast("Некорректная операция инвентаря");
    return lwSubmit(actorId,{kind:"inventory",operation,id,amount,...(instanceId?{instanceId}:{} )},operation==="spend"?"Расход записи инвентаря":"Изменение записи инвентаря");
  }
  if(button.hasAttribute("data-lw-geometry-confirm")||button.hasAttribute("data-lw-geometry-add")){
    const preview=lwGeometryPreview;
    if(!preview||preview.actorId!==actorId)return toast("Маршрут больше не доступен: выберите клетку заново.");
    const check=lwCheckGeometryPreview(preview);
    if(check&&!check.ok){
      if(check.clear){lwClearGeometryPreview();return toast("Выбор участника или сцена изменилась: выберите клетку заново.");}
      if(check.stale)return lwRefreshGeometryPreview(preview);
      return toast((check.errors||[]).join(" ")||"Маршрут нельзя подтвердить в текущем состоянии.");
    }
    if(preview.stage||button.hasAttribute("data-lw-geometry-add")){
      lwDraftEnabled=true;
      const staged=lwSubmit(preview.actorId,preview.event.payload,preview.label);
      if(staged)lwClearGeometryPreview();
      return;
    }
    const committed=commitSceneEvents(preview.label,[preview.event]);
    if(committed){lwClearGeometryPreview();return;}
    const after=lwCheckGeometryPreview(preview);
    if(after&&!after.ok&&after.stale)return lwRefreshGeometryPreview(preview);
    return;
  }
  if(button.hasAttribute("data-lw-automation")){if(!lwCanNarrate())return;return lwSubmit(actorId,{kind:"automation",ruleId:button.dataset.lwAutomation,enabled:button.dataset.lwEnabled==="true"},"Настройка автоматизации");}
  if(button.hasAttribute("data-lw-punish"))return lwSubmit(actorId,{kind:"punish",id:button.dataset.lwPunish},"Наказание");
  if(button.hasAttribute("data-lw-invisible"))return lwSubmit(actorId,{kind:"invisible"},"Исчезновение");
  if(button.hasAttribute("data-lw-detective-cancel")){lwDetectiveTeleport=null;renderScene();return;}
  if(button.hasAttribute("data-lw-detective-teleport")){const status=LionwingEngine.detectiveMovementStatus?.(Scene,actorId);if(!status?.available)return toast(status?.reason||"Телепортация Детектива недоступна");lwDetectiveTeleport={actorId,sceneVersion:Number(Scene.version||0),markers:status.markers};renderScene();toast("Выберите подсвеченную Слабую точку для предпросмотра");return;}
  if(button.hasAttribute("data-lw-detective-confirm")){const draft=lwDetectiveTeleport;if(!draft?.plan||draft.actorId!==actorId)return toast("Предпросмотр телепортации устарел");const status=LionwingEngine.detectiveMovementStatus?.(Scene,actorId);if(Number(Scene.version||0)!==Number(draft.sceneVersion)||!status?.markers.some(item=>item.markerId===draft.markerId))return toast("Слабая точка или Движение изменились — выберите заново");if(commitSceneEvents("Детектив III: телепортация к Слабой точке",draft.plan.events)){lwDetectiveTeleport=null;renderScene()}return;}
  if (button.hasAttribute("data-lw-clear-destination")) { lwDestination=null; renderScene(); return; }
  if (button.hasAttribute("data-lw-action") || button.hasAttribute("data-core-action")) {
    const actionId=button.dataset.lwAction||button.dataset.coreAction, payload={kind:"action",actionId,targetIds:[...Scene.targetIds],breakout:button.dataset.lwBreakout==="true",focusSpent:num("[data-lw-focus]"),advantage:num("[data-lw-advantage]"),disadvantage:num("[data-lw-disadvantage]")};
    if(val("[data-lw-attribute]"))payload.attribute=val("[data-lw-attribute]");
    if(root?.querySelector("[data-lw-spike]")?.checked)payload.spikeTargetIds=[...Scene.targetIds];
    if(actionId===SceneEngine.ACTION_IDS.improvise){if(val("[data-lw-improvise-effect]"))payload.effect=val("[data-lw-improvise-effect]");if(val("[data-lw-remove-obstacle]"))payload.removeObstacleId=val("[data-lw-remove-obstacle]");}
    const name=lwRules().actions.list.find(d=>d.id===actionId)?.name||"Действие";
    if((Scene.actors.find(a=>a.id===actorId)?.effects||[]).includes("positive.исчез")){lwDestination={actorId,payload,label:name,field:"reappearance"};toast("Сначала выберите клетку появления");return;}
    if([SceneEngine.ACTION_IDS.jump,SceneEngine.ACTION_IDS.shove,SceneEngine.ACTION_IDS.improvise].includes(actionId)&&!payload.effect&&!payload.removeObstacleId){lwDestination={actorId,payload,label:name};toast("Выберите клетку на поле");return;}
    lwSubmit(actorId,payload,name); return;
  }
  if (button.hasAttribute("data-lw-reaction")) { const payload={kind:"reaction",choice:button.dataset.lwReaction,...(button.dataset.lwPlanId?{planId:button.dataset.lwPlanId}:{})};if(payload.choice==="dodge"){lwDestination={actorId,payload,label:"Уворот"};toast("Выберите клетку Уворота");return;} lwSubmit(actorId,payload,"Реакция");return; }
  if (button.hasAttribute("data-lw-choice")) { const payload={kind:"choice",id:button.dataset.lwChoiceId,choice:button.dataset.lwChoice,note:button.closest(".lw-pending")?.querySelector("[data-lw-choice-note]")?.value||"",...(button.dataset.lwPlanId?{planId:button.dataset.lwPlanId}:{})};if(payload.choice==="place"){lwDestination={actorId,payload,label:"Появление"};toast("Выберите клетку на поле");return;}lwSubmit(actorId,payload,"Решение игрока");return; }
  if (button.hasAttribute("data-lw-resolve") || button.hasAttribute("data-lw-cancel")) { if(!lwCanNarrate())return;lwSubmit(actorId,{kind:button.hasAttribute("data-lw-resolve")?"resolve-attack":"cancel-attack",...(button.dataset.lwPlanId?{planId:button.dataset.lwPlanId}:{})},"Разрешение Атаки");return; }
  if (!lwCanNarrate()) return toast("Эта операция доступна Нарратору");
  if (button.hasAttribute("data-lw-correct")) { lwSubmit(actorId,{kind:"correct",resource:val("[data-lw-correct-field]"),amount:num("[data-lw-correct-value]")},"Исправление состояния");return; }
  if (button.hasAttribute("data-lw-custom")) { const kind=button.dataset.lwCustom,id=val("[data-lw-custom-id]"),value=num("[data-lw-custom-value]");if(/^(reset|remove)-(resource|clock)$/.test(kind)){const [operation,type]=kind.split("-");lwSubmit(actorId,{kind:"counter",id,operation,type},"Счётчик");return;}lwSubmit(actorId,["spend","gain"].includes(kind)?{kind:"resource",operation:kind,resource:id,amount:value}:{kind,id,label:val("[data-lw-custom-label]"),value,initial:num("[data-lw-custom-initial]"),resetAt:val("[data-lw-custom-reset]"),size:num("[data-lw-custom-size]"),maximum:root.querySelector("[data-lw-custom-unbounded]")?.checked||root.querySelector("[data-lw-replaces-focus]")?.checked?null:num("[data-lw-custom-size]"),replaces:root.querySelector("[data-lw-replaces-focus]")?.checked?"focus":null,inverted:root.querySelector("[data-lw-inverted-focus]")?.checked===true,replacesAp:root.querySelector("[data-lw-replaces-ap]")?.checked===true},"Ресурс / часы");return; }
  if (button.hasAttribute("data-lw-modifier")) { const targets=Scene.targetIds.length?LionwingEngine.targetIds(Scene,Scene.targetIds):[actorId];lwSubmit(actorId,{kind:"batch",operations:targets.map(targetId=>({kind:"modifier",remove:button.dataset.lwModifier==="remove",targetId,stat:val("[data-lw-mod-stat]"),amount:num("[data-lw-mod-amount]"),duration:val("[data-lw-mod-duration]","endTurn")}))},"Временный модификатор");return; }
  if (button.hasAttribute("data-lw-operation")) {
    const kind=button.dataset.lwOperation,targets=LionwingEngine.targetIds(Scene,Scene.targetIds),amount=num("[data-lw-amount]"),repeat=num("[data-lw-repeat]",1),effect=val("[data-lw-effect]"),duration=val("[data-lw-duration]","default"),costs=lwCostsFrom(root);
    if(!targets.length)return toast("Выберите цели на поле или в составе");
    const targetDamage=Object.fromEntries([...root.querySelectorAll("[data-lw-target-damage]")].filter(input=>input.value!=="").map(input=>[input.dataset.lwTargetDamage,Number(input.value)]));
    const damageOptions={targetDamage,ignoreArmor:root.querySelector("[data-lw-ignore-armor]").checked,ignoreEvasion:root.querySelector("[data-lw-ignore-evasion]").checked,irreducible:root.querySelector("[data-lw-irreducible]").checked,finalDamage:root.querySelector("[data-lw-final-damage]").checked};
    if(kind==="amend-attack")return lwSubmit(actorId,{kind,amount,targetIds:targets,...damageOptions},"Изменение ожидающей Атаки");
    if(kind==="attack"){
      const attack={kind,...damageOptions,amount,repeat,targetIds:targets,effects:effect?[{effect,...(duration!=="default"?{duration}:{})}]:[]};
      return lwSubmit(actorId,{kind:"plan",...(costs.length?{costs}:{}),operations:[attack],targetIds:targets,actionId:"manual.attack"},"Ручная Атака");
    }
    const operations=[];
    if(["effect","remove-effect"].includes(kind)&&!effect)return toast("Выберите Эффект");
    if(!Number.isInteger(repeat)||repeat<1||repeat>30)return toast("Повторы: от 1 до 30");
    for(let i=0;i<(kind==="damage"?repeat:1);i++)for(const targetId of targets){const ownedSource=LionwingEngine.effectInstanceStatus(Scene,targetId,effect).sources.find(source=>source.actorId===actorId)?.sourceId;operations.push(kind.includes("effect")?{kind:"effect",targetId,effect,remove:kind==="remove-effect",sourceId:kind==="effect"?actorId:ownedSource,...(duration!=="default"?{duration}:{})}:{kind,targetId,amount,...damageOptions,...(effect?{effects:[{effect,...(duration!=="default"?{duration}:{})}]}:{})});}
    lwSubmit(actorId,costs.length?{kind:"plan",costs,operations,targetIds:targets,actionId:"manual.adjudication"}:{kind:"batch",operations},"Результат действия");
  }
},true);

document.addEventListener("submit", event => {
  if (!lwActive()) return;
  const entityForm = event.target.closest("[data-lw-entity-form]");
  if (!entityForm) return;
  event.preventDefault(); event.stopImmediatePropagation(); lwCreateEntity(entityForm);
}, true);

document.addEventListener("change",event=>{
  if(!lwActive())return;
  if(event.target.matches("[data-lw-stage]")){lwDraftEnabled=event.target.checked;return;}
  const input=event.target.closest("[data-scene-actor-hp]");
  if(input){event.preventDefault();event.stopImmediatePropagation();if(lwCanNarrate())lwSubmit(input.dataset.sceneActorHp,{kind:"correct",resource:"hp",amount:Number(input.value)},"Исправление Здоровья");}
},true);

document.addEventListener("input",event=>{
  if(lwActive()&&event.target.closest("[data-lw-root]")){const key=lwDraftKey(event.target);if(key)lwFormDraft.set(key,event.target.type==="checkbox"?event.target.checked:event.target.value);}
  const root=event.target.closest(".lw-console");if(!root||!lwActive())return;
  const output=root.querySelector("[data-lw-preview]");if(!output)return;
  const amount=Number(root.querySelector("[data-lw-amount]")?.value||0),actorId=root.dataset.lwActor;
  const operations=Scene.targetIds.map(targetId=>({kind:"damage",targetId,amount}));if(!operations.length){output.textContent="Выберите цели для предпросмотра.";return;}
  const preview=LionwingEngine.previewEvents(Scene,[LionwingEngine.command(actorId,{kind:"batch",operations})]);
  output.textContent=preview.ok?Scene.targetIds.map(id=>{const before=Scene.actors.find(a=>a.id===id),after=preview.scene.actors.find(a=>a.id===id);return`${before.name}: ${before.hp} → ${after.hp} ЗД${after.wounds!==before.wounds?`, Раны ${after.wounds}/3`:""}`;}).join(" · ")+(preview.scene.lionwing.choices.length?" · потребуется решение игрока":""):preview.errors.join(" ");
});
