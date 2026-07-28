"use strict";

const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const md = value => esc(value).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`(.+?)`/g,"<code>$1</code>").replace(/\n- /g,"<br>• ").replace(/\n/g,"<br>");
const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clamp = (n,min,max) => Math.max(min,Math.min(max,Number(n)||0));
const download = (name, content, type="application/json") => { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); };
let toastTimer;
function toast(message){ const el=$("toast"); el.textContent=message; el.classList.add("on"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("on"),2600); }

function blankAbility(){return {enabled:false,name:"",desc:"",rank:1,words:{verbs:[],nouns:[],conditions:[]},xNoun:null,specializations:{},customWordCosts:{}}}

function blankHero(){
  return {
    schema:APP_SCHEMA,id:uid(),name:"",player:"",concept:"",tier:1,media:{portrait:"",token:""},
    attrs:{body:4,talent:3,spirit:2,mind:2},attrBonus:{body:0,talent:0,spirit:0,mind:0},
    techConversions:0,conversionAttr:"body",primaryOutlook:null,outlooks:[],gifts:[],
    skills:[{id:uid(),name:"",rank:1}],
    ability:blankAbility(),taintedAbility:blankAbility(),
    techniques:{},mods:{taintedBody:false,gadgetSpent:0,performanceSkill:null},
    runtime:{hp:null,maxHp:null,wounds:0,focus:null,influence:1,stress:0,ap:3,tension:0,funding:null,fundingTier:0,sacrifices:[],notes:"",effects:[],clocks:[],diceHistory:[]}
  };
}

function blankScene(){
  return {schema:10,version:0,name:"Структурированный бой",view:"gm",round:1,turnSerial:0,tension:0,tool:"select",activeSpace:"main",activeActorId:null,spaces:[{id:"main",name:"Основное поле",width:7,height:7}],actors:[],objects:[],markers:[],topology:{cuts:[]},artworks:[],backgroundArt:null,backgroundView:{fit:"cover",position:"center",dim:28,gridOpacity:58},featuredArt:null,selectedActor:null,targetIds:[],pendingActionPlan:null,pendingAction:null,pendingPrompt:null,triggerQueue:[],sessionClocks:[],ruleHandouts:[],tools:{clocksMigrated:false},rollFeed:[],log:[],undo:[]};
}

function safeImage(value,maxLength=520000){
  const image=typeof value==="string"?value:"";
  return /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(image)&&image.length<=maxLength?image:"";
}
function safeTokenImage(value){return safeImage(value,220000)}
function safeColor(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||""))?String(value):fallback}
function normalizedSceneObjectType(object,sceneSchema){
  const legacyScorched=Number(sceneSchema||0)<5&&object?.type==="terrain"&&/выжженн(?:ая|ой) земл|scorched earth|rapid-fire-sorcery/i.test(`${object?.label||""} ${object?.source||""}`);
  if(legacyScorched)return "difficult";
  return ["attack","gas","terrain","difficult","danger","portal","custom"].includes(object?.type)?object.type:"custom";
}
function imageFromFile(file,{maxSide=720,maxLength=520000,square=false}={}){
  return new Promise((resolve,reject)=>{if(!file||!/^image\/(?:png|jpeg|webp|gif)$/i.test(file.type))return reject(new Error("Нужен PNG, JPG, WebP или GIF"));if(file.size>12*1024*1024)return reject(new Error("Исходное изображение больше 12 МБ"));const reader=new FileReader();reader.onerror=()=>reject(new Error("Не удалось прочитать изображение"));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error("Файл не распознан как изображение"));image.onload=()=>{const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");if(square){canvas.width=maxSide;canvas.height=maxSide;const scale=Math.max(maxSide/image.naturalWidth,maxSide/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;ctx.drawImage(image,(maxSide-width)/2,(maxSide-height)/2,width,height)}else{const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));ctx.drawImage(image,0,0,canvas.width,canvas.height)}let value=canvas.toDataURL("image/webp",.82);if(value.length>maxLength)value=canvas.toDataURL("image/jpeg",.68);value=safeImage(value,maxLength);value?resolve(value):reject(new Error("Не удалось уместить изображение в безопасный размер"))};image.src=String(reader.result)};reader.readAsDataURL(file)});
}
function tokenImageFromFile(file){return imageFromFile(file,{maxSide:192,maxLength:220000,square:true})}

function sceneCore(raw){
  const base=blankScene(),scene=raw&&typeof raw==="object"?raw:{};
  base.version=clamp(scene.version,0,999999999);base.name=typeof scene.name==="string"?scene.name.slice(0,120):base.name;base.view=scene.view==="player"?"player":"gm";base.round=clamp(scene.round||1,1,999);base.turnSerial=clamp(scene.turnSerial,0,999999999);base.tension=clamp(scene.tension,0,999);base.tool=["select","place","measure","target","area","marker","topology","erase"].includes(scene.tool)?scene.tool:"select";
  base.spaces=Array.isArray(scene.spaces)?scene.spaces.slice(0,12).map((space,index)=>({id:typeof space.id==="string"?space.id:uid(),name:typeof space.name==="string"?space.name.slice(0,60):`Пространство ${index+1}`,width:clamp(space.width||7,1,12),height:clamp(space.height||7,1,12)})):base.spaces;
  if(!base.spaces.length)base.spaces=blankScene().spaces;const spaceIds=new Set(base.spaces.map(space=>space.id));base.activeSpace=spaceIds.has(scene.activeSpace)?scene.activeSpace:base.spaces[0].id;
  base.actors=Array.isArray(scene.actors)?scene.actors.slice(0,120).map(actor=>({id:typeof actor.id==="string"?actor.id:uid(),kind:["hero","enemy","token"].includes(actor.kind)?actor.kind:(actor.team==="enemy"?"enemy":"hero"),team:actor.team==="enemy"?"enemy":"hero",heroId:typeof actor.heroId==="string"?actor.heroId:null,ownerId:typeof actor.ownerId==="string"?actor.ownerId:null,characterId:typeof actor.characterId==="string"?actor.characterId:null,profileId:typeof actor.profileId==="string"?actor.profileId:null,antagonistTraitId:typeof actor.antagonistTraitId==="string"?actor.antagonistTraitId:null,sheetVersion:clamp(actor.sheetVersion,0,99),name:typeof actor.name==="string"?actor.name.slice(0,120):"Участник",tier:clamp(actor.tier||1,1,99),space:spaceIds.has(actor.space)?actor.space:base.activeSpace,x:clamp(actor.x,0,11),y:clamp(actor.y,0,11),hp:clamp(actor.hp,0,9999),maxHp:clamp(actor.maxHp,0,9999),guts:clamp(actor.guts,0,99),wounds:clamp(actor.wounds,0,99),focus:actor.team==="enemy"?0:Math.max(0,Number(actor.focus)||0),influence:clamp(actor.influence,0,999),ap:clamp(actor.ap??3,0,99),baseAp:clamp(actor.baseAp??3,0,99),speed:clamp(actor.speed,0,99),armor:clamp(actor.armor,0,99),evasion:clamp(actor.evasion,0,9999),attrs:{body:clamp(actor.attrs?.body,0,99),talent:clamp(actor.attrs?.talent,0,99),spirit:clamp(actor.attrs?.spirit,0,99),mind:clamp(actor.attrs?.mind,0,99)},skills:Array.isArray(actor.skills)?actor.skills.slice(0,30):[],ability:actor.ability&&typeof actor.ability==="object"?actor.ability:null,taintedAbility:actor.taintedAbility&&typeof actor.taintedAbility==="object"?actor.taintedAbility:null,techniques:actor.techniques&&typeof actor.techniques==="object"?actor.techniques:{},ruleResources:actor.ruleResources&&typeof actor.ruleResources==="object"?actor.ruleResources:{},ruleClocks:actor.ruleClocks&&typeof actor.ruleClocks==="object"?actor.ruleClocks:{},effects:cleanArray(actor.effects).slice(0,30),acted:Boolean(actor.acted),knockedOut:Boolean(actor.knockedOut),hidden:Boolean(actor.hidden),tokenSymbol:typeof actor.tokenSymbol==="string"?actor.tokenSymbol.slice(0,4):"",tokenColor:safeColor(actor.tokenColor,actor.team==="enemy"?"#902a3d":"#256a92"),tokenImage:safeTokenImage(actor.tokenImage),portraitImage:safeImage(actor.portraitImage)})):[];
  const persistedActorIds=new Set(base.actors.map(actor=>actor.id));
  base.actors.forEach((actor,index)=>{
    const source=scene.actors?.[index]||{};
    actor.usedActions=cleanArray(source.usedActions).slice(0,30);
    actor.usedTrump=Boolean(source.usedTrump);
    actor.stepRemaining=clamp(source.stepRemaining,0,99);
    actor.speedZeroUntilTurnEnd=Boolean(source.speedZeroUntilTurnEnd);
    actor.extraTurns=clamp(source.extraTurns,0,4);
    actor.comboCooldowns=source.comboCooldowns&&typeof source.comboCooldowns==="object"?Object.fromEntries(Object.entries(source.comboCooldowns).filter(([id,value])=>typeof id==="string"&&id.length<=180&&Number(value)>0).slice(0,30).map(([id,value])=>[id,clamp(value,1,4)])):{};
    actor.techniqueState=source.techniqueState&&typeof source.techniqueState==="object"?{cunningPlan:clamp(source.techniqueState.cunningPlan,0,4),studiedActorIds:cleanArray(source.techniqueState.studiedActorIds).slice(0,120),spellModifiers:cleanArray(source.techniqueState.spellModifiers).filter(value=>["fierce","focused","wild","outstanding"].includes(value)).slice(0,2)}:{cunningPlan:0,studiedActorIds:[],spellModifiers:[]};
    actor.ruleClocks=source.ruleClocks&&typeof source.ruleClocks==="object"?Object.fromEntries(Object.entries(source.ruleClocks).filter(([id])=>/^[a-z][a-z0-9.-]{0,79}$/.test(id)).slice(0,30).map(([id,clock])=>[id,clock&&typeof clock==="object"?{...clock,clockId:id,size:clamp(clock.size||6,1,24),minimumSize:clamp(clock.minimumSize||clock.size||6,1,24),initial:clamp(clock.initial,0,24),value:clamp(clock.value,0,24),active:clock.active!==false}:clamp(clock,0,24)])):{};
    actor.creationMarks=clamp(source.creationMarks,0,99);
    actor.innovationCharges=clamp(source.innovationCharges,0,99);
    actor.inventory=source.inventory&&typeof source.inventory==="object"?Object.fromEntries(Object.entries(source.inventory).filter(([id,value])=>typeof id==="string"&&id.length<=80&&Number(value)>0).slice(0,60).map(([id,value])=>[id,clamp(value,1,99)])):{};
    actor.ruleState=source.ruleState&&typeof source.ruleState==="object"?{pugilistStance:clamp(source.ruleState.pugilistStance,0,4),martialPerfection:Boolean(source.ruleState.martialPerfection),growth:clamp(source.ruleState.growth,0,99),imposingPresence:Boolean(source.ruleState.imposingPresence),grimTransformed:Boolean(source.ruleState.grimTransformed),grimUsed:Boolean(source.ruleState.grimUsed),warringTransformed:Boolean(source.ruleState.warringTransformed),warringUsed:Boolean(source.ruleState.warringUsed),drainLife:Boolean(source.ruleState.drainLife),lastCreationSpellMarks:clamp(source.ruleState.lastCreationSpellMarks,0,99)}:{};
    actor.ruleState.modifiedOverclockTurns=clamp(source.ruleState?.modifiedOverclockTurns,0,2);
    actor.ruleState.icicleSpellsRemaining=clamp(source.ruleState?.icicleSpellsRemaining,0,4);
    actor.ruleState.styleCarryRemaining=clamp(source.ruleState?.styleCarryRemaining,0,99);
    actor.ruleState.timeStopUsed=Boolean(source.ruleState?.timeStopUsed);
    actor.techniqueArmor=clamp(source.techniqueArmor,0,99);
    actor.techniqueFocusBonus=clamp(source.techniqueFocusBonus,0,99);
    actor.clashAdvantage=clamp(source.clashAdvantage,0,30);
    actor.meals=clamp(source.meals,0,99);
    actor.maxMeals=clamp(source.maxMeals,0,99);
    actor.effectStates=source.effectStates&&typeof source.effectStates==="object"?Object.fromEntries(Object.entries(source.effectStates).filter(([effect,state])=>actor.effects.includes(effect)&&state&&typeof state==="object").slice(0,30).map(([effect,state])=>[effect,{duration:["default","persistent","scene","startTurn","actionOrStartTurn","roundEnd"].includes(state.duration)?state.duration:"default",removable:state.removable!==false,appliedTurnSerial:state.appliedTurnSerial!=null&&Number.isInteger(Number(state.appliedTurnSerial))?clamp(state.appliedTurnSerial,0,999999999):null,appliedRound:state.appliedRound!=null&&Number.isInteger(Number(state.appliedRound))?clamp(state.appliedRound,1,999):null,appliedEventId:typeof state.appliedEventId==="string"?state.appliedEventId.slice(0,120):"",sourceBound:Boolean(state.sourceBound),exclusiveBySource:Boolean(state.exclusiveBySource),sources:Array.isArray(state.sources)?state.sources.filter(item=>item&&persistedActorIds.has(item.actorId)).slice(0,12).map(item=>({actorId:item.actorId,actionId:typeof item.actionId==="string"?item.actionId.slice(0,180):"",eventId:typeof item.eventId==="string"?item.eventId.slice(0,120):""})):[]}])):{};
  });
  const actorIds=new Set(base.actors.map(actor=>actor.id));base.objects=Array.isArray(scene.objects)?scene.objects.slice(0,240).map(object=>({id:typeof object.id==="string"?object.id:uid(),space:spaceIds.has(object.space)?object.space:base.activeSpace,type:normalizedSceneObjectType(object,scene.schema),label:typeof object.label==="string"?object.label.slice(0,80):"Область",source:typeof object.source==="string"?object.source.slice(0,160):"Ручное правило",ruleId:typeof object.ruleId==="string"?object.ruleId.slice(0,180):"",duration:object.duration==="turn"?"endTurn":["instant","endTurn","nextTurn","round","scene","persistent"].includes(object.duration)?object.duration:"scene",ownerActorId:actorIds.has(object.ownerActorId)?object.ownerActorId:null,cells:cleanArray(object.cells).slice(0,144),createdRound:clamp(object.createdRound||1,1,999),hp:object.hp==null?null:clamp(object.hp,0,9999),maxHp:object.maxHp==null?null:clamp(object.maxHp,0,9999),metadata:object.metadata&&typeof object.metadata==="object"?object.metadata:{}})):[];
  base.markers=Array.isArray(scene.markers)?scene.markers.slice(0,240).map(marker=>({id:typeof marker.id==="string"?marker.id:uid(),space:spaceIds.has(marker.space)?marker.space:base.activeSpace,x:clamp(marker.x,0,11),y:clamp(marker.y,0,11),kind:["mark","damocles","bomb","ritual","trap","summon","weapon","objective","countdown","hidden","custom"].includes(marker.kind)?marker.kind:"mark",label:typeof marker.label==="string"?marker.label.slice(0,80):"Метка",color:safeColor(marker.color,"#e2b54a"),source:typeof marker.source==="string"?marker.source.slice(0,160):"Ручное правило",ruleId:typeof marker.ruleId==="string"?marker.ruleId.slice(0,180):"",duration:["endTurn","nextTurn","round","scene","persistent"].includes(marker.duration)?marker.duration:"scene",ownerActorId:actorIds.has(marker.ownerActorId)?marker.ownerActorId:null,createdRound:clamp(marker.createdRound||1,1,999),metadata:marker.metadata&&typeof marker.metadata==="object"?marker.metadata:{}})):[];
  base.topology={cuts:Array.isArray(scene.topology?.cuts)?scene.topology.cuts.slice(0,120).map(cut=>({id:typeof cut.id==="string"?cut.id:uid(),space:spaceIds.has(cut.space)?cut.space:base.activeSpace,label:typeof cut.label==="string"?cut.label.slice(0,80):"Разрыв поля",source:typeof cut.source==="string"?cut.source.slice(0,160):"Ручное правило",ruleId:typeof cut.ruleId==="string"?cut.ruleId.slice(0,180):"",ownerActorId:actorIds.has(cut.ownerActorId)?cut.ownerActorId:null,crossing:cut.crossing==="opposite"?"opposite":"blocked",cells:cleanArray(cut.cells).slice(0,144),createdRound:clamp(cut.createdRound||1,1,999)})):[]};
  base.artworks=Array.isArray(scene.artworks)?scene.artworks.slice(0,12).map(art=>({id:typeof art.id==="string"?art.id:uid(),name:typeof art.name==="string"?art.name.slice(0,120):"Арт Сцены",kind:art.kind==="background"?"background":"art",image:safeImage(art.image),hidden:Boolean(art.hidden)})).filter(art=>art.image):[];const artIds=new Set(base.artworks.map(art=>art.id));base.backgroundArt=artIds.has(scene.backgroundArt)?scene.backgroundArt:null;base.featuredArt=artIds.has(scene.featuredArt)?scene.featuredArt:null;base.backgroundView={fit:scene.backgroundView?.fit==="contain"?"contain":"cover",position:["center","top","bottom","left","right"].includes(scene.backgroundView?.position)?scene.backgroundView.position:"center",dim:clamp(scene.backgroundView?.dim??28,0,85),gridOpacity:clamp(scene.backgroundView?.gridOpacity??58,12,96)};
  const targetableActorIds=new Set(base.actors.filter(actor=>!actor.knockedOut).map(actor=>actor.id));base.selectedActor=actorIds.has(scene.selectedActor)?scene.selectedActor:null;base.activeActorId=actorIds.has(scene.activeActorId)?scene.activeActorId:null;base.targetIds=cleanArray(scene.targetIds).filter(id=>targetableActorIds.has(id)).slice(0,40);base.pendingActionPlan=scene.pendingActionPlan&&typeof scene.pendingActionPlan==="object"?scene.pendingActionPlan:null;base.pendingAction=scene.pendingAction&&typeof scene.pendingAction==="object"?scene.pendingAction:null;base.pendingPrompt=scene.pendingPrompt&&typeof scene.pendingPrompt==="object"?scene.pendingPrompt:null;base.triggerQueue=Array.isArray(scene.triggerQueue)?scene.triggerQueue.filter(item=>item&&typeof item.key==="string"&&item.event?.type==="rule.prompt").slice(0,24):[];base.sessionClocks=Array.isArray(scene.sessionClocks)?scene.sessionClocks.slice(0,30).filter(clock=>clock&&typeof clock.id==="string").map(clock=>({id:clock.id.slice(0,120),name:typeof clock.name==="string"?clock.name.slice(0,120):"Часы Сцены",size:[4,6,8,12].includes(Number(clock.size))?Number(clock.size):6,value:clamp(clock.value,0,[4,6,8,12].includes(Number(clock.size))?Number(clock.size):6)})):[];base.ruleHandouts=Array.isArray(scene.ruleHandouts)?scene.ruleHandouts.slice(0,12).filter(item=>item&&typeof item.id==="string"&&typeof item.ruleId==="string").map(item=>({id:item.id.slice(0,120),ruleId:item.ruleId.slice(0,180),title:typeof item.title==="string"?item.title.slice(0,180):"Правило",kind:typeof item.kind==="string"?item.kind.slice(0,80):"Правило",sharedBy:typeof item.sharedBy==="string"?item.sharedBy.slice(0,120):"Нарратор",at:typeof item.at==="string"?item.at.slice(0,32):""})):[];base.tools={clocksMigrated:Boolean(scene.tools?.clocksMigrated)};base.rollFeed=Array.isArray(scene.rollFeed)?scene.rollFeed.slice(0,20):[];
  base.log=Array.isArray(scene.log)?scene.log.slice(0,200).map(row=>({id:typeof row.id==="string"?row.id:uid(),at:typeof row.at==="string"?row.at.slice(0,32):"",text:typeof row.text==="string"?row.text.slice(0,240):"",type:typeof row.type==="string"?row.type.slice(0,80):"legacy.note",actorId:typeof row.actorId==="string"?row.actorId:null,payload:row.payload&&typeof row.payload==="object"?row.payload:{},visibility:row.visibility==="gm"?"gm":"public"})):[];
  return base;
}

function normalizeScene(raw){
  const base=sceneCore(raw);base.undo=Array.isArray(raw?.undo)?raw.undo.slice(0,20).filter(row=>row&&typeof row==="object"&&row.state).map(row=>({id:typeof row.id==="string"?row.id:uid(),label:typeof row.label==="string"?row.label.slice(0,160):"Изменение",state:sceneCore(row.state)})):[];return base;
}

function cleanArray(value){ return Array.isArray(value) ? value.filter(v=>typeof v==="string") : []; }
function normalizeAbility(raw){
  const ability=raw&&typeof raw==="object"?raw:{},specializations={},customWordCosts={};
  if(ability.specializations&&typeof ability.specializations==="object")for(const [id,value]of Object.entries(ability.specializations))if(typeof value==="string"&&value.trim())specializations[id]=value.slice(0,120);
  if(ability.customWordCosts&&typeof ability.customWordCosts==="object")for(const [id,value]of Object.entries(ability.customWordCosts))if(id.startsWith("custom:"))customWordCosts[id]=value==="X"?"X":clamp(value,-1,4);
  return {enabled:Boolean(ability.enabled),name:typeof ability.name==="string"?ability.name.slice(0,180):"",desc:typeof ability.desc==="string"?ability.desc.slice(0,1500):"",rank:clamp(ability.rank||1,1,3),words:{verbs:cleanArray(ability.words?.verbs),nouns:cleanArray(ability.words?.nouns),conditions:cleanArray(ability.words?.conditions)},xNoun:typeof ability.xNoun==="string"?ability.xNoun:null,specializations,customWordCosts};
}
function normalizeHero(raw){
  const base=blankHero(), h=raw && typeof raw==="object" ? raw : {};
  base.id=typeof h.id==="string"?h.id:base.id;
  for(const key of ["name","player","concept"]) base[key]=typeof h[key]==="string"?h[key].slice(0,500):"";
  base.media={portrait:safeImage(h.media?.portrait),token:safeTokenImage(h.media?.token)};
  base.tier=clamp(h.tier,1,6);
  for(const [key] of ATTRS){ base.attrs[key]=clamp(h.attrs?.[key] ?? base.attrs[key],2,4); base.attrBonus[key]=clamp(h.attrBonus?.[key],0,5); }
  base.attrs=Logic.normalizeAttributeBases(base.attrs,ATTRS.map(([key])=>key));
  base.attrBonus=Logic.normalizeAttributeGrowth(base.attrBonus,base.tier,ATTRS.map(([key])=>key));
  base.techConversions=clamp(h.techConversions,0,5); base.conversionAttr=ATTRS.some(a=>a[0]===h.conversionAttr)?h.conversionAttr:"body";
  base.primaryOutlook=typeof h.primaryOutlook==="string"?h.primaryOutlook:null; base.outlooks=cleanArray(h.outlooks).slice(0,3); base.gifts=cleanArray(h.gifts);
  if(base.primaryOutlook&&!base.outlooks.includes(base.primaryOutlook)) base.outlooks.unshift(base.primaryOutlook);
  base.skills=Array.isArray(h.skills)?h.skills.slice(0,30).map(s=>({id:typeof s.id==="string"?s.id:uid(),name:typeof s.name==="string"?s.name.slice(0,180):"",rank:clamp(s.rank,1,3)})):base.skills;
  base.ability=normalizeAbility(h.ability);base.taintedAbility=normalizeAbility(h.taintedAbility);
  base.techniques={}; if(h.techniques&&typeof h.techniques==="object") for(const [id,level] of Object.entries(h.techniques)) base.techniques[id]=clamp(level,0,3);
  base.mods={taintedBody:Boolean(h.mods?.taintedBody),gadgetSpent:clamp(h.mods?.gadgetSpent,0,99),performanceSkill:typeof h.mods?.performanceSkill==="string"?h.mods.performanceSkill:null};
  const rt=h.runtime||{}; base.runtime={hp:rt.hp!==""&&rt.hp!=null&&Number.isFinite(+rt.hp)?+rt.hp:null,maxHp:rt.maxHp!==""&&rt.maxHp!=null&&Number.isFinite(+rt.maxHp)?Math.max(0,+rt.maxHp):null,wounds:clamp(rt.wounds,0,99),focus:Number.isFinite(+rt.focus)?+rt.focus:null,influence:clamp(rt.influence,0,999),stress:clamp(rt.stress,0,3),ap:clamp(rt.ap??3,0,99),tension:clamp(rt.tension,0,99),funding:Number.isFinite(+rt.funding)?clamp(rt.funding,0,999):null,fundingTier:clamp(rt.fundingTier,0,6),sacrifices:cleanArray(rt.sacrifices).filter(item=>["eye","arm","leg","tongue","life"].includes(item)),notes:typeof rt.notes==="string"?rt.notes.slice(0,10000):"",effects:cleanArray(rt.effects),clocks:Array.isArray(rt.clocks)?rt.clocks.slice(0,30).map(c=>({id:typeof c.id==="string"?c.id:uid(),name:typeof c.name==="string"?c.name.slice(0,120):"Часы",size:[4,6,8].includes(+c.size)?+c.size:6,value:clamp(c.value,0,[4,6,8].includes(+c.size)?+c.size:6)})):[],diceHistory:Array.isArray(rt.diceHistory)?rt.diceHistory.slice(0,20).map(row=>({at:typeof row.at==="string"?row.at.slice(0,20):"",count:clamp(row.count,1,300),successes:clamp(row.successes,0,300),crits:clamp(row.crits,0,300),outcome:typeof row.outcome==="string"?row.outcome.slice(0,80):"",allIn:Boolean(row.allIn),payment:typeof row.payment==="string"?row.payment.slice(0,20):""})):[]};
  return base;
}

function migrateLegacy(raw){
  const techByName=new Map(D.archetypes.flatMap(a=>a.techniques.map(t=>[t.name,t.id])));
  const outlookByName=new Map(D.outlooks.map(o=>[o.name,o.id]));
  const giftByName=new Map(D.outlooks.flatMap(o=>(o.builtin?[o.builtin]:[]).concat(o.gifts).map(g=>[g.name,g.id])));
  const heroes=(raw?.heroes||[]).map(old=>{
    const h=blankHero(); Object.assign(h,{name:old.name||"",player:old.player||"",concept:old.concept||"",tier:old.tier||1});
    h.attrs=old.attrs||h.attrs; h.attrBonus=old.bonus||old.attrBonus||h.attrBonus;
    const ol=outlookByName.get(old.outlook); if(ol){h.primaryOutlook=ol;h.outlooks=[ol];}
    h.gifts=(old.gifts||[]).map(name=>giftByName.get(name)).filter(Boolean);
    h.skills=(old.skills||[]).map(s=>({id:uid(),name:s.name||"",rank:s.rank||1}));
    h.ability={...h.ability,enabled:Boolean(old.ability?.name||old.ability?.rank),name:old.ability?.name||"",desc:old.ability?.desc||"",rank:clamp(old.ability?.rank||1,1,3)};
    for(const [name,level] of Object.entries(old.techniques||old.techs||{})){const id=techByName.get(name)||name;if(id)h.techniques[id]=level;}
    h.runtime={...h.runtime,...(old.rt||{})}; return normalizeHero(h);
  });
  return {schema:APP_SCHEMA,current:clamp(raw?.current,0,Math.max(0,heroes.length-1)),mode:raw?.mode||"build",theme:"dark",heroes:heroes.length?heroes:[blankHero()],scene:blankScene()};
}

function loadStore(){
  try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(parsed?.schema===APP_SCHEMA&&Array.isArray(parsed.heroes))return {...parsed,heroes:parsed.heroes.map(normalizeHero),scene:normalizeScene(parsed.scene)};}catch(e){console.warn(e)}
  try{const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||"null");if(legacy){const migrated=migrateLegacy(legacy);localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;}}catch(e){console.warn(e)}
  return {schema:APP_SCHEMA,current:0,mode:"build",theme:"dark",heroes:[blankHero()],scene:blankScene()};
}
function isPristineHero(hero){
  return hero&&!hero.name&&!hero.player&&!hero.concept&&!hero.primaryOutlook&&!hero.outlooks.length&&!hero.gifts.length&&!Object.keys(hero.techniques).length&&!hero.ability.enabled&&hero.skills.length===1&&!hero.skills[0].name;
}
function consumePresetDraft(targetStore){
  let draft;
  try{const url=new URL(window.location.href),raw=url.searchParams.get("preset");if(!raw)return null;url.searchParams.delete("preset");history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);draft=JSON.parse(raw);}catch{return null}
  const createdAt=Number(draft?.createdAt);
  if(!draft||draft.schema!==1||draft.kind!=="dawn-combat-preset"||!Number.isFinite(createdAt)||Math.abs(Date.now()-createdAt)>15*60*1000)return null;
  const knownTechniques=new Set(D.archetypes.flatMap(archetype=>archetype.techniques.map(technique=>technique.id))),techniques={};
  for(const [id,level] of Object.entries(draft.techniques||{}))if(knownTechniques.has(id)&&[1,2,3].includes(Number(level)))techniques[id]=Number(level);
  if(Object.values(techniques).reduce((total,level)=>total+level,0)!==5)return null;
  const attrs={};for(const [key] of ATTRS)attrs[key]=clamp(draft.attrs?.[key],2,4);
  if(Object.values(attrs).sort().join(",")!=="2,2,3,4")return null;
  const hero=normalizeHero({...blankHero(),name:String(draft.title||"").slice(0,120),concept:String(draft.role||"").slice(0,180),attrs,techniques});
  if(targetStore.heroes.length===1&&isPristineHero(targetStore.heroes[0])){targetStore.heroes[0]=hero;targetStore.current=0;}else{targetStore.heroes.push(hero);targetStore.current=targetStore.heroes.length-1;}
  targetStore.mode="build";
  return hero.name||"Новый персонаж";
}
function sceneViewportProfile(){if(matchMedia("(max-width: 950px) and (max-height: 500px) and (orientation: landscape)").matches)return"phone-landscape";if(matchMedia("(max-width: 720px)").matches)return"phone";return"desktop"}
let store=loadStore(); const importedPresetName=consumePresetDraft(store),requestedMode=new URLSearchParams(location.search).get("mode");if(["build","play","tools","rules","reference"].includes(requestedMode))store.mode=requestedMode;let S=store.heroes[store.current]||store.heroes[0]; let Scene=store.scene||blankScene();let activeArch=D.archetypes[0]?.id; let refKind="all",rulesAudience="all";let activeScenePanel=null,scenePanelTrigger=null,activeSheetTab="combat",activeUtilityPreset={skillId:"",abilityKey:""},activeUtilityActorId=null;let sceneViewportMode=sceneViewportProfile(),sceneZoom=clamp(store.sceneUi?.zoom||60,30,180),sceneNeedsInitialFit=store.sceneUi?.fitVersion!==7||store.sceneUi?.viewport!==sceneViewportMode,sceneResizeTimer=null;let sceneDragActorId=null,sceneMeasureStart=null,sceneMeasureCells=new Set(),sceneMeasureLabel="",scenePanState=null,sceneSpaceHeld=false,sceneTokenTipTimer=null,hoveredSceneActorId=null,sceneContextTarget=null;
function persist(){ store.heroes[store.current]=S;store.scene=Scene;store.sceneUi={zoom:sceneZoom,fitVersion:7,viewport:sceneViewportMode}; try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}catch(e){toast("Не удалось сохранить: хранилище браузера заполнено");} }

const allGifts=()=>D.outlooks.flatMap(o=>(o.builtin?[o.builtin]:[]).concat(o.gifts));
const giftById=id=>allGifts().find(g=>g.id===id);
const selectedGifts=()=>Logic.resolveSelectedGifts({outlooks:D.outlooks,selectedOutlookIds:S.outlooks,primaryOutlookId:S.primaryOutlook,selectedGiftIds:S.gifts});
const hasGift=(enOrName)=>selectedGifts().some(g=>g.en===enOrName||g.name===enOrName);
const selectedGiftNames=()=>selectedGifts().map(g=>g.en||g.name);
const outlookById=id=>D.outlooks.find(o=>o.id===id);
const techById=id=>D.archetypes.flatMap(a=>a.techniques).find(t=>t.id===id);
const wordById=(id,ability=null)=>{const known=Object.values(D.abilityWords).flat().find(w=>w.id===id);if(known)return known;if(typeof id==="string"&&id.startsWith("custom:")){const [,group,...parts]=id.split(":"),stored=ability?.customWordCosts?.[id],variable=stored==="X",cost=variable?null:Number.isFinite(Number(stored))?clamp(stored,-1,4):0;return{id,name:decodeURIComponent(parts.join(":")),cost,costLabel:variable?"X":String(cost),marks:variable?"☾":"",group}}};
function attrValueFor(hero,key,includeConversion=true){return hero.attrs[key]+hero.attrBonus[key]+(includeConversion&&hero.conversionAttr===key?hero.techConversions:0)}
function attrValue(key,includeConversion=true){return attrValueFor(S,key,includeConversion)}
function derivedFor(hero){return {hp:attrValueFor(hero,"body")*2+hero.tier*2,guts:1+attrValueFor(hero,"body"),speed:2+Math.ceil(attrValueFor(hero,"talent")/2),focus:1+Math.ceil(attrValueFor(hero,"spirit")/2)}}
function derived(){return derivedFor(S)}
function ensureRuntime(){const d=derived(),health=Logic.reconcileHealthRuntime({current:S.runtime.hp,previousMax:S.runtime.maxHp,nextMax:d.hp});S.runtime.hp=health.current;S.runtime.maxHp=health.maximum;if(S.runtime.focus===null)S.runtime.focus=d.focus;if(hasGift("Trust Fund")){if(S.runtime.funding===null){S.runtime.funding=10+5*(S.tier-1);S.runtime.fundingTier=S.tier}else if(S.runtime.fundingTier<S.tier){S.runtime.funding+=5*(S.tier-S.runtime.fundingTier);S.runtime.fundingTier=S.tier}}}

function abilityCost(ability=S.ability){
  const words=Object.entries(ability.words).flatMap(([group,ids])=>ids.map(id=>{const word=wordById(id,ability);return word?{...word,group}:null})).filter(Boolean);
  return Logic.calculateAbilityCost({enabled:ability.enabled,rank:ability.rank,words,xWord:wordById(ability.xNoun,ability),specializations:ability.specializations,forceCondition:ability===S.ability&&hasGift("Uncontrollable Power")});
}
function budgets(){
  const t=S.tier,aCost=abilityCost(),taintedCost=abilityCost(S.taintedAbility),performanceSkill=S.skills.find(s=>s.id===S.mods.performanceSkill);
  const rankAccounting=Logic.calculateCreationBudgets({tier:t,gifts:selectedGiftNames(),skillRanks:S.skills.map(s=>s.rank),performanceTargetRank:performanceSkill?.rank||0,abilityCost:aCost,taintedBodyUsed:S.mods.taintedBody,taintedAbilityCost:taintedCost,gadgetSpent:S.mods.gadgetSpent});
  const giftPool=t+1,giftSpent=S.gifts.length;
  const techPool=5+2*(t-1)-2*S.techConversions,techSpent=Object.values(S.techniques).reduce((n,v)=>n+v,0);
  const archUsed=D.archetypes.filter(a=>a.techniques.some(tech=>(S.techniques[tech.id]||0)>0)).length;
  const attrPool=2*(t-1),attrSpent=Object.values(S.attrBonus).reduce((n,v)=>n+v,0);
  return {aCost,taintedCost,giftPool,giftSpent,techPool,techSpent,archUsed,attrPool,attrSpent,...rankAccounting};
}
function effectiveSkillRank(skill){return Math.min(3,skill.rank+(hasGift("Performance Artist")&&S.mods.performanceSkill===skill.id?1:0))}
function abilityNeedsX(ability=S.ability){return Object.values(ability.words).flat().some(id=>wordById(id,ability)?.marks.includes("☾"))}
function issues(){
  const b=budgets(),t=S.tier,problems=[]; const bases=Object.values(S.attrs).sort().join(",");
  if(bases!=="2,2,3,4")problems.push(["bad","Стартовые Атрибуты должны образовывать набор 4 / 3 / 2 / 2."]);
  if(b.attrSpent!==b.attrPool)problems.push(["",`Распределите ровно ${b.attrPool} бонусов Атрибутов за Ступени (сейчас ${b.attrSpent}).`]);
  if(Object.values(S.attrBonus).some(v=>v>t-1))problems.push(["bad","Один Атрибут не может получать оба обычных бонуса одной Ступени."]);
  const highest=Math.max(...ATTRS.map(([k])=>attrValue(k,false)));if(S.techConversions&&attrValue(S.conversionAttr,false)<highest)problems.push(["bad","Обмен Уровней должен повышать один из текущих высших Атрибутов."]);
  if(!S.primaryOutlook)problems.push(["","Выберите Основное Мировоззрение."]);
  if(S.outlooks.length>Math.min(3,t))problems.push(["bad",`На ${t}-й Ступени доступно не более ${Math.min(3,t)} Мировоззрений.`]);
  if(b.giftSpent>b.giftPool)problems.push(["bad","Перерасход Даров."]);
  if(b.skillSpent<b.skillMin)problems.push(["bad",`В Навыки нужно вложить минимум ${b.skillMin} Рангов.`]);
  if(b.rankOver)problems.push(["bad",`Перерасход основного бюджета Рангов персонажа на ${b.rankOver}. Целевые Ранги Даров можно тратить только на указанные ими Способности или гаджеты.`]);
  if(S.skills.some(s=>!s.name.trim()))problems.push(["","У одного из Навыков нет названия."]);
  if(S.ability.enabled&&(!S.ability.words.verbs.length||!S.ability.words.nouns.length))problems.push(["","Для формулы Способности выберите хотя бы Глагол и Существительное."]);
  if(hasGift("Uncontrollable Power")&&S.ability.enabled&&!S.ability.words.conditions.length)problems.push(["bad","«Неконтролируемая сила» требует Условие в формуле Способности."]);
  if(S.ability.enabled&&abilityNeedsX(S.ability)&&!wordById(S.ability.xNoun))problems.push(["bad","Для слова с меткой ☾ выберите отдельное Существительное X; если цена слова равна X, она подставится автоматически."]);
  if(hasGift("Tainted Body")&&S.mods.taintedBody&&(!S.taintedAbility.words.verbs.length||!S.taintedAbility.words.nouns.length))problems.push(["","«Порченое тело» раскрыто: соберите новую отдельную Способность из Глагола и Существительного."]);
  if(hasGift("Tainted Body")&&S.mods.taintedBody&&abilityNeedsX(S.taintedAbility)&&!wordById(S.taintedAbility.xNoun))problems.push(["bad","В новой Способности «Порченого тела» слово с ☾ требует отдельное Существительное X."]);
  if(b.taintedAbilityOver)problems.push(["bad",`Новая Способность «Порченого тела» превышает особый резерв на ${b.taintedAbilityOver} Ранг.`]);
  if(hasGift("Supernatural Deafness")&&S.ability.enabled)problems.push(["bad","«Глухота к сверхъестественному» запрещает Способность."]);
  if(b.rankBudgetConflict)problems.push(["bad","«Лучшие годы позади» и «Невероятный потенциал» задают несовместимые стартовые бюджеты."]);
  const performanceSkill=S.skills.find(s=>s.id===S.mods.performanceSkill);
  if(hasGift("Performance Artist")&&!performanceSkill)problems.push(["","Выберите Навык, который получает дополнительный Ранг от Дара «Артист»."]);
  if(hasGift("Performance Artist")&&performanceSkill?.rank>=3)problems.push(["bad","«Артист» не может повысить выбранный Навык выше максимального Ранга 3. Выберите Навык с купленным Рангом 1 или 2."]);
  if(b.techSpent>b.techPool)problems.push(["bad","Перерасход Уровней Техник."]);
  if(b.archUsed>3)problems.push(["bad","Техники взяты более чем из трёх Архетипов."]);
  return problems;
}

function budgetRow(label,spent,total,forcedOver=false){const pct=total?Math.min(100,spent/total*100):0;return `<div class="budget-row ${forcedOver||spent>total?"over":""}"><span>${esc(label)}</span><strong>${spent}/${total}</strong><span class="bar"><i style="--pct:${pct}%"></i></span></div>`}
