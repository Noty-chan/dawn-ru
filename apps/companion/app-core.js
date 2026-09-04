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
function friendlySyncError(error,fallback="временная ошибка соединения"){
  const raw=String(error?.message||error||"").trim();
  if(!raw)return fallback;
  if(/statement timeout|canceling statement|lock timeout|57014/i.test(raw))return "сервер занят; команда будет повторена";
  if(/failed to fetch|network\s*error|networkerror|load failed|fetch failed|connection (?:closed|terminated|timed? ?out)|websocket/i.test(raw))return "сервер временно недоступен; команда будет повторена";
  if(/jwt|token.*expired|not authenticated|invalid.*session/i.test(raw))return "сессия обновляется; команда будет повторена";
  if(/version conflict|serialization|40001/i.test(raw))return "сцена уже обновилась; команда пересчитывается";
  return /[А-Яа-яЁё]/.test(raw)?raw:fallback;
}

function blankAbility(){return {enabled:false,name:"",desc:"",rank:1,words:{verbs:[],nouns:[],conditions:[]},xNoun:null,specializations:{},customWordCosts:{}}}

function blankHero(rulesEdition=contentPreferences?.edition||"ru-v0.9"){
  return {
    schema:APP_SCHEMA,rulesEdition:["ru-v0.9","lionwing"].includes(rulesEdition)?rulesEdition:"ru-v0.9",id:uid(),name:"",player:"",concept:"",tier:1,media:{portrait:"",token:"",portraitStored:false,tokenStored:false},
    attrs:{body:4,talent:3,spirit:2,mind:2},attrBonus:{body:0,talent:0,spirit:0,mind:0},
    techConversions:0,conversionAttr:"body",primaryOutlook:null,outlooks:[],gifts:[],bonds:[],supplementIds:[],
    skills:[{id:uid(),name:"",rank:1}],
    ability:blankAbility(),taintedAbility:blankAbility(),
    techniques:{},mods:{taintedBody:false,gadgetSpent:0,performanceSkill:null,spellcrafterAugments:[],wispSpiritTypes:[]},
    runtime:{hp:null,maxHp:null,wounds:0,focus:null,influence:1,stress:0,ap:3,tension:0,funding:null,fundingTier:0,sacrifices:[],notes:"",effects:[],clocks:[],diceHistory:[],freeplay:{target:null}}
  };
}

function blankScene(){
  return {schema:14,version:0,name:"Структурированный бой",view:"gm",turnApprovalMode:"self",round:1,turnSerial:0,tension:0,tool:"select",activeSpace:"main",activeActorId:null,spaces:[{id:"main",name:"Основное поле",mode:"standard",width:7,height:7}],actors:[],objects:[],walls:[],markers:[],topology:{cuts:[]},artworks:[],backgroundArt:null,backgroundView:{fit:"cover",position:"center",dim:28,gridOpacity:58},featuredArt:null,selectedActor:null,targetIds:[],targetCells:[],pendingActionPlan:null,pendingAction:null,pendingPrompt:null,triggerQueue:[],challengeRequest:null,opposedRoll:null,results:null,sessionClocks:[],reminders:[],ruleHandouts:[],tools:{clocksMigrated:false},rollFeed:[],log:[],undo:[],redo:[],turnUndo:[]};
}

function safeImage(value,maxLength=520000){
  const image=typeof value==="string"?value:"";
  const bundled=/^(?:\.\.\/){1,3}media\/tokens\/[a-z0-9._-]+\.(?:png|jpe?g|webp|gif)$/i.test(image);
  return bundled||(/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(image)&&image.length<=maxLength)?image:"";
}
function safeTokenImage(value){return safeImage(value,220000)}
function safeColor(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||""))?String(value):fallback}
function normalizeGmLibrary(raw){
  const source=raw&&typeof raw==="object"?raw:{},roles=new Set(["named","boss","npc"]),numberOrNull=(value,min=0,max=9999)=>value===""||value==null||!Number.isFinite(Number(value))?null:clamp(value,min,max);
  const enemyVariants=Array.isArray(source.enemyVariants)?source.enemyVariants.slice(0,120).map(item=>({id:typeof item?.id==="string"?item.id:uid(),name:typeof item?.name==="string"?item.name.slice(0,120):"Именной противник",baseProfileId:typeof item?.baseProfileId==="string"?item.baseProfileId:"",tier:clamp(item?.tier||1,1,99),role:roles.has(item?.role)?item.role:"named",tokenSymbol:typeof item?.tokenSymbol==="string"?item.tokenSymbol.slice(0,4):"☠",tokenColor:safeColor(item?.tokenColor,"#902a3d"),tokenImage:safeTokenImage(item?.tokenImage),portraitImage:safeImage(item?.portraitImage),notes:typeof item?.notes==="string"?item.notes.slice(0,1200):"",overrides:{health:numberOrNull(item?.overrides?.health,1),speed:numberOrNull(item?.overrides?.speed),armor:numberOrNull(item?.overrides?.armor),evasion:numberOrNull(item?.overrides?.evasion),ap:numberOrNull(item?.overrides?.ap,1,99)}})).filter(item=>item.baseProfileId):[];
  const encounters=Array.isArray(source.encounters)?source.encounters.slice(0,80).map(item=>({id:typeof item?.id==="string"?item.id:uid(),name:typeof item?.name==="string"?item.name.slice(0,120):"Столкновение",createdAt:typeof item?.createdAt==="string"?item.createdAt.slice(0,32):new Date().toISOString(),width:clamp(item?.width||7,1,12),height:clamp(item?.height||7,1,12),enemies:Array.isArray(item?.enemies)?item.enemies.slice(0,120).map(enemy=>({kind:enemy?.kind==="crowd"?"crowd":"enemy",profileId:typeof enemy?.profileId==="string"?enemy.profileId:"",enemyVariantId:typeof enemy?.enemyVariantId==="string"?enemy.enemyVariantId:null,compoundId:typeof enemy?.compoundId==="string"&&enemy.compoundId.trim()?enemy.compoundId.trim().slice(0,120):null,compoundDefense:["armor","evasion"].includes(enemy?.compoundDefense)?enemy.compoundDefense:null,crowdType:["mob","swarm","guards","undead","hounds","civilians","custom"].includes(enemy?.crowdType)?enemy.crowdType:"mob",crowdGroupId:typeof enemy?.crowdGroupId==="string"?enemy.crowdGroupId.slice(0,120):null,source:typeof enemy?.source==="string"?enemy.source.slice(0,160):"",name:typeof enemy?.name==="string"?enemy.name.slice(0,120):"Противник",tier:enemy?.kind==="crowd"?0:clamp(enemy?.tier||1,1,99),x:clamp(enemy?.x,0,11),y:clamp(enemy?.y,0,11),hp:clamp(enemy?.hp,0,9999),maxHp:clamp(enemy?.maxHp,0,9999),ap:clamp(enemy?.ap??2,0,99),baseAp:clamp(enemy?.baseAp??2,0,99),speed:clamp(enemy?.speed,0,99),armor:clamp(enemy?.armor,0,99),evasion:clamp(enemy?.evasion,0,9999),effects:cleanArray(enemy?.effects).slice(0,30),tokenSymbol:typeof enemy?.tokenSymbol==="string"?enemy.tokenSymbol.slice(0,4):"☠",tokenColor:safeColor(enemy?.tokenColor,"#902a3d"),tokenImage:safeTokenImage(enemy?.tokenImage),portraitImage:safeImage(enemy?.portraitImage),gmRole:roles.has(enemy?.gmRole)?enemy.gmRole:"named",notes:typeof enemy?.notes==="string"?enemy.notes.slice(0,1200):""})).filter(enemy=>enemy.profileId||enemy.kind==="crowd"):[]})).filter(item=>item.enemies.length):[];
  for(const encounter of encounters){const rawEncounter=(source.encounters||[]).find(item=>item?.id===encounter.id)||{};encounter.objects=Array.isArray(rawEncounter.objects)?rawEncounter.objects.slice(0,120).map(object=>({type:["attack","gas","terrain","difficult","danger","portal","custom"].includes(object?.type)?object.type:"custom",label:typeof object?.label==="string"?object.label.slice(0,80):"Область",source:typeof object?.source==="string"?object.source.slice(0,160):"Подготовка столкновения",duration:["instant","endTurn","nextTurn","round","scene","persistent"].includes(object?.duration)?object.duration:"scene",cells:cleanArray(object?.cells).slice(0,144),ownerEnemyIndex:Number.isInteger(Number(object?.ownerEnemyIndex))?clamp(object.ownerEnemyIndex,0,59):null,hp:numberOrNull(object?.hp),maxHp:numberOrNull(object?.maxHp),metadata:object?.metadata&&typeof object.metadata==="object"?object.metadata:{}})):[];encounter.markers=Array.isArray(rawEncounter.markers)?rawEncounter.markers.slice(0,120).map(marker=>({x:clamp(marker?.x,0,11),y:clamp(marker?.y,0,11),kind:["mark","damocles","bomb","ritual","trap","summon","weapon","objective","countdown","hidden","custom"].includes(marker?.kind)?marker.kind:"mark",label:typeof marker?.label==="string"?marker.label.slice(0,80):"Метка",color:safeColor(marker?.color,"#e2b54a"),source:typeof marker?.source==="string"?marker.source.slice(0,160):"Подготовка столкновения",duration:["endTurn","nextTurn","round","scene","persistent"].includes(marker?.duration)?marker.duration:"scene",ownerEnemyIndex:Number.isInteger(Number(marker?.ownerEnemyIndex))?clamp(marker.ownerEnemyIndex,0,59):null,metadata:marker?.metadata&&typeof marker.metadata==="object"?marker.metadata:{}})):[]}
  for(const encounter of encounters){
    const rawEncounter=(source.encounters||[]).find(item=>item?.id===encounter.id)||{};
    encounter.enemies.forEach((enemy,index)=>enemy.team=rawEncounter.enemies?.[index]?.team==="hero"?"hero":"enemy");
    encounter.mode=["standard","cinematic","custom"].includes(rawEncounter.mode)?rawEncounter.mode:(encounter.width===7&&encounter.height===1?"cinematic":encounter.width===7&&encounter.height===7?"standard":"custom");
    for(let index=0;index<encounter.objects.length;index++){const rawType=rawEncounter.objects?.[index]?.type;if(["high","low","deploy-hero","deploy-enemy","objective"].includes(rawType))encounter.objects[index].type=rawType}
    encounter.walls=Array.isArray(rawEncounter.walls)?rawEncounter.walls.slice(0,240).filter(wall=>typeof wall?.a==="string"&&typeof wall?.b==="string").map(wall=>{const maxHp=clamp(wall.maxHp||10,1,9999);return{a:wall.a,b:wall.b,label:typeof wall.label==="string"?wall.label.slice(0,80):"Стена",source:typeof wall.source==="string"?wall.source.slice(0,160):"Подготовка столкновения",hp:clamp(wall.hp??maxHp,0,maxHp),maxHp}}):[];
    encounter.templateScene=rawEncounter.templateScene&&typeof rawEncounter.templateScene==="object"?sceneCore(rawEncounter.templateScene):null;if(encounter.templateScene){encounter.templateScene.undo=[];encounter.templateScene.pendingAction=null;encounter.templateScene.pendingActionPlan=null;encounter.templateScene.pendingPrompt=null;encounter.templateScene.triggerQueue=[]}
  }
  return {enemyVariants,encounters};
}
function normalizedSceneObjectType(object,sceneSchema){
  const legacyScorched=Number(sceneSchema||0)<5&&object?.type==="terrain"&&/выжженн(?:ая|ой) земл|scorched earth|rapid-fire-sorcery/i.test(`${object?.label||""} ${object?.source||""}`);
  if(legacyScorched)return "difficult";
  return ["attack","gas","terrain","difficult","high","low","deploy-hero","deploy-enemy","objective","danger","portal","custom"].includes(object?.type)?object.type:"custom";
}
function imageFromFile(file,{maxSide=720,maxLength=520000,square=false}={}){
  return new Promise((resolve,reject)=>{if(!file||!/^image\/(?:png|jpeg|webp|gif)$/i.test(file.type))return reject(new Error("Нужен PNG, JPG, WebP или GIF"));if(file.size>12*1024*1024)return reject(new Error("Исходное изображение больше 12 МБ"));const reader=new FileReader();reader.onerror=()=>reject(new Error("Не удалось прочитать изображение"));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error("Файл не распознан как изображение"));image.onload=()=>{const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");if(square){canvas.width=maxSide;canvas.height=maxSide;const scale=Math.max(maxSide/image.naturalWidth,maxSide/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;ctx.drawImage(image,(maxSide-width)/2,(maxSide-height)/2,width,height)}else{const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));ctx.drawImage(image,0,0,canvas.width,canvas.height)}let value=canvas.toDataURL("image/webp",.82);if(value.length>maxLength)value=canvas.toDataURL("image/jpeg",.68);value=safeImage(value,maxLength);value?resolve(value):reject(new Error("Не удалось уместить изображение в безопасный размер"))};image.src=String(reader.result)};reader.readAsDataURL(file)});
}
function tokenImageFromFile(file){return imageFromFile(file,{maxSide:192,maxLength:220000,square:true})}

function normalizedOpposedRoll(value,actorIds){
  if(!value||typeof value!=="object"||typeof value.id!=="string")return null;
  const participants=Array.isArray(value.participants)?value.participants.slice(0,2).map(item=>{
    if(!item||typeof item.id!=="string"||!item.id||item.id.length>120)return null;
    const actorId=typeof item.actorId==="string"&&actorIds.has(item.actorId)?item.actorId:null,heroId=typeof item.heroId==="string"?item.heroId.slice(0,120):null,name=typeof item.name==="string"&&item.name.trim()?item.name.trim().slice(0,120):"Участник";
    if(item.actorId&&!actorId||!actorId&&!heroId&&item.controller!=="narrator")return null;
    return{id:item.id,actorId,heroId,name,controller:item.controller==="narrator"?"narrator":"participant",pool:clamp(item.pool||1,1,99)};
  }).filter(Boolean):[];
  if(participants.length!==2||participants[0].id===participants[1].id||(participants[0].actorId&&participants[0].actorId===participants[1].actorId)||(participants[0].heroId&&participants[0].heroId===participants[1].heroId))return null;
  const participantIds=new Set(participants.map(item=>item.id)),results={};
  for(const [participantId,result] of Object.entries(value.results&&typeof value.results==="object"?value.results:{})){
    if(!participantIds.has(participantId)||!result||typeof result!=="object"||!Array.isArray(result.rolls)||result.rolls.length>300||result.rolls.some(roll=>!Number.isInteger(Number(roll))||Number(roll)<1||Number(roll)>6))continue;
    const successes=clamp(result.successes,0,300),crits=clamp(result.crits,0,successes);
    results[participantId]={participantId,rollEventId:typeof result.rollEventId==="string"?result.rollEventId.slice(0,120):"",formula:typeof result.formula==="string"?result.formula.slice(0,120):`${result.rolls.length}D6 ≥4`,rolls:result.rolls.map(Number),successes,crits,payment:typeof result.payment==="string"?result.payment.slice(0,80):"",at:typeof result.at==="string"?result.at.slice(0,32):""};
  }
  const attempt=clamp(value.attempt||1,1,99),complete=participants.every(item=>results[item.id]),tied=complete&&results[participants[0].id].successes===results[participants[1].id].successes,both=tied&&value.resolution==="both",winner=complete&&!tied?(results[participants[0].id].successes>results[participants[1].id].successes?participants[0].id:participants[1].id):null;
  return{id:value.id.slice(0,120),participants,attempt,results,status:both||winner?"resolved":tied?"tied":"rolling",winnerParticipantId:winner,resolution:both?"both":winner?"winner":null,requestedBy:typeof value.requestedBy==="string"?value.requestedBy.slice(0,120):"Нарратор",at:typeof value.at==="string"?value.at.slice(0,32):""};
}
function normalizedChallengeResult(value){
  if(!value||typeof value!=="object"||!Array.isArray(value.rolls)||value.rolls.length>300||value.rolls.some(roll=>!Number.isInteger(Number(roll))||Number(roll)<1||Number(roll)>6))return null;
  const successes=clamp(value.successes,0,300),crits=clamp(value.crits,0,successes);
  return{rollEventId:typeof value.rollEventId==="string"?value.rollEventId.slice(0,120):typeof value.id==="string"?value.id.slice(0,120):"",formula:typeof value.formula==="string"?value.formula.slice(0,120):`${value.rolls.length}D6 ≥4`,rolls:value.rolls.map(Number),successes,crits,outcome:typeof value.outcome==="string"?value.outcome.slice(0,80):"",payment:typeof value.payment==="string"?value.payment.slice(0,80):"",at:typeof value.at==="string"?value.at.slice(0,32):""};
}

function trimSceneHistory(entries,limit=20){return(Array.isArray(entries)?entries:[]).slice(0,limit)}
function sceneCore(raw){
  const base=blankScene(),scene=raw&&typeof raw==="object"?raw:{};
  base.version=clamp(scene.version,0,999999999);base.name=typeof scene.name==="string"?scene.name.slice(0,120):base.name;base.view=scene.view==="player"?"player":"gm";base.turnApprovalMode=scene.turnApprovalMode==="narrator"?"narrator":"self";base.round=clamp(scene.round||1,1,999);base.turnSerial=clamp(scene.turnSerial,0,999999999);base.tension=clamp(scene.tension,0,999);base.tool=["select","place","measure","target","area","wall","marker","topology","erase"].includes(scene.tool)?scene.tool:"select";
  base.results=scene.results&&typeof scene.results==="object"&&typeof scene.results.id==="string"&&scene.results.id?{id:scene.results.id.slice(0,120),openedAt:typeof scene.results.openedAt==="string"?scene.results.openedAt.slice(0,32):"",openedBy:typeof scene.results.openedBy==="string"?scene.results.openedBy.slice(0,120):"Нарратор"}:null;
  base.spaces=Array.isArray(scene.spaces)?scene.spaces.slice(0,12).map((space,index)=>{const rawWidth=clamp(space.width||7,1,12),rawHeight=clamp(space.height||7,1,12),mode=["standard","cinematic","custom"].includes(space.mode)?space.mode:(rawWidth===7&&rawHeight===1?"cinematic":rawWidth===7&&rawHeight===7?"standard":"custom");return{id:typeof space.id==="string"?space.id:uid(),name:typeof space.name==="string"?space.name.slice(0,60):`Пространство ${index+1}`,mode,width:mode==="cinematic"?7:mode==="standard"?7:rawWidth,height:mode==="cinematic"?1:mode==="standard"?7:rawHeight}}):base.spaces;
  if(!base.spaces.length)base.spaces=blankScene().spaces;const spaceIds=new Set(base.spaces.map(space=>space.id));base.activeSpace=spaceIds.has(scene.activeSpace)?scene.activeSpace:base.spaces[0].id;
  base.spaces.forEach((space,index)=>{const source=scene.spaces?.[index]||{};if(typeof source.returnSpaceId==="string"&&spaceIds.has(source.returnSpaceId)&&source.returnSpaceId!==space.id)space.returnSpaceId=source.returnSpaceId;if(typeof source.ownerActorId==="string"&&source.ownerActorId.length<=120)space.ownerActorId=source.ownerActorId});
  base.actors=Array.isArray(scene.actors)?scene.actors.slice(0,120).map(actor=>({id:typeof actor.id==="string"?actor.id:uid(),kind:["hero","enemy","token"].includes(actor.kind)?actor.kind:(actor.team==="enemy"?"enemy":"hero"),team:actor.team==="enemy"?"enemy":"hero",heroId:typeof actor.heroId==="string"?actor.heroId:null,ownerId:typeof actor.ownerId==="string"?actor.ownerId:null,characterId:typeof actor.characterId==="string"?actor.characterId:null,profileId:typeof actor.profileId==="string"?actor.profileId:null,antagonistTraitId:typeof actor.antagonistTraitId==="string"?actor.antagonistTraitId:null,enemyVariantId:typeof actor.enemyVariantId==="string"?actor.enemyVariantId:null,gmRole:["named","boss","npc"].includes(actor.gmRole)?actor.gmRole:null,notes:typeof actor.notes==="string"?actor.notes.slice(0,1200):"",sheetVersion:clamp(actor.sheetVersion,0,99),name:typeof actor.name==="string"?actor.name.slice(0,120):"Участник",tier:clamp(actor.tier||1,1,99),primaryOutlook:typeof actor.primaryOutlook==="string"?actor.primaryOutlook.slice(0,120):null,outlooks:cleanArray(actor.outlooks).slice(0,3),gifts:cleanArray(actor.gifts).slice(0,30),space:spaceIds.has(actor.space)?actor.space:base.activeSpace,x:clamp(actor.x,0,11),y:clamp(actor.y,0,11),hp:clamp(actor.hp,0,9999),maxHp:clamp(actor.maxHp,0,9999),guts:actor.team==="enemy"?clamp(actor.guts,0,99):Math.max(1,clamp(actor.guts,0,99)||1+clamp(actor.attrs?.body,0,99)),wounds:clamp(actor.wounds,0,99),stress:clamp(actor.stress,0,3),focus:actor.team==="enemy"?0:Math.max(0,Number(actor.focus)||0),influence:clamp(actor.influence,0,999),ap:clamp(actor.ap??3,0,9999),baseAp:clamp(actor.baseAp??3,0,99),speed:clamp(actor.speed,0,99),armor:clamp(actor.armor,0,99),evasion:clamp(actor.evasion,0,9999),attrs:{body:clamp(actor.attrs?.body,0,99),talent:clamp(actor.attrs?.talent,0,99),spirit:clamp(actor.attrs?.spirit,0,99),mind:clamp(actor.attrs?.mind,0,99)},skills:Array.isArray(actor.skills)?actor.skills.slice(0,30):[],ability:actor.ability&&typeof actor.ability==="object"?actor.ability:null,taintedAbility:actor.taintedAbility&&typeof actor.taintedAbility==="object"?actor.taintedAbility:null,techniques:actor.techniques&&typeof actor.techniques==="object"?actor.techniques:{},ruleResources:actor.ruleResources&&typeof actor.ruleResources==="object"?actor.ruleResources:{},ruleClocks:actor.ruleClocks&&typeof actor.ruleClocks==="object"?actor.ruleClocks:{},ruleModes:actor.ruleModes&&typeof actor.ruleModes==="object"?actor.ruleModes:{},effects:cleanArray(actor.effects).slice(0,30),acted:Boolean(actor.acted),knockedOut:Boolean(actor.knockedOut),hidden:Boolean(actor.hidden),tokenSymbol:typeof actor.tokenSymbol==="string"?actor.tokenSymbol.slice(0,4):"",tokenColor:safeColor(actor.tokenColor,actor.team==="enemy"?"#902a3d":"#256a92"),tokenImage:safeTokenImage(actor.tokenImage),portraitImage:safeImage(actor.portraitImage)})):[];
  const persistedActorIds=new Set(base.actors.map(actor=>actor.id));base.spaces.forEach(space=>{if(space.ownerActorId&&!persistedActorIds.has(space.ownerActorId))delete space.ownerActorId});
  base.actors.forEach((actor,index)=>{
    const source=scene.actors?.[index]||{};
    actor.rulesEdition=["ru-v0.9","lionwing"].includes(source.rulesEdition)?source.rulesEdition:"ru-v0.9";
    actor.knownTechniques=source.knownTechniques&&typeof source.knownTechniques==="object"?{...source.knownTechniques}:{...actor.techniques};
    actor.bonds=Array.isArray(source.bonds)?source.bonds.slice(0,30).filter(bond=>bond&&typeof bond.name==="string").map(bond=>({id:typeof bond.id==="string"?bond.id.slice(0,120):"",name:bond.name.slice(0,120)})):[];
    actor.sacrifices=cleanArray(source.sacrifices).filter(item=>["eye","arm","leg","tongue","life"].includes(item));
    actor.compoundId=(actor.kind==="enemy"||Boolean(actor.profileId))&&typeof source.compoundId==="string"&&source.compoundId.trim()?source.compoundId.trim().slice(0,120):null;
    actor.compoundBaseSpeed=actor.compoundId?clamp(source.compoundBaseSpeed??actor.speed,0,99):null;
    actor.compoundDefense=actor.compoundId&&["armor","evasion"].includes(source.compoundDefense)?source.compoundDefense:null;
    if(source.kind==="crowd"){actor.kind="crowd";actor.crowdType=["mob","swarm","guards","undead","hounds","civilians","custom"].includes(source.crowdType)?source.crowdType:"mob";actor.crowdSubtype=["seeker","vortex"].includes(source.crowdSubtype)?source.crowdSubtype:null;actor.crowdGroupId=typeof source.crowdGroupId==="string"&&source.crowdGroupId?source.crowdGroupId.slice(0,120):actor.id;actor.seekerTargetId=actor.crowdSubtype==="seeker"&&typeof source.seekerTargetId==="string"?source.seekerTargetId.slice(0,120):null;actor.seekerOwnerId=actor.crowdSubtype==="seeker"&&typeof source.seekerOwnerId==="string"?source.seekerOwnerId.slice(0,120):null;actor.seekerDamage=actor.crowdSubtype==="seeker"?clamp(source.seekerDamage,1,9999):null;actor.vortexOwnerId=actor.crowdSubtype==="vortex"&&typeof source.vortexOwnerId==="string"?source.vortexOwnerId.slice(0,120):null;actor.source=typeof source.source==="string"?source.source.slice(0,160):"Ручное правило";actor.tier=0;actor.ap=0;actor.baseAp=0;actor.speed=0;actor.acted=true}
    if(String(actor.profileId||"").startsWith("enemy.modifier.")){const physicalImmediately=["enemy.modifier.legion","enemy.modifier.vip"].includes(actor.profileId),deployedCollateral=actor.profileId==="enemy.modifier.collateral"&&Boolean(source.modifierState?.deployed);actor.ap=0;actor.baseAp=0;actor.acted=true;actor.hidden=!(physicalImmediately||deployedCollateral)}
    actor.usedActions=cleanArray(source.usedActions).slice(0,30);
    actor.usedTrump=Boolean(source.usedTrump);
    actor.stepRemaining=clamp(source.stepRemaining,0,99);
    actor.speedZeroUntilTurnEnd=Boolean(source.speedZeroUntilTurnEnd);
    actor.difficultTerrainImmunity=cleanArray(source.difficultTerrainImmunity).slice(0,144);
    actor.extraTurns=clamp(source.extraTurns,0,4);
    actor.comboCooldowns=source.comboCooldowns&&typeof source.comboCooldowns==="object"?Object.fromEntries(Object.entries(source.comboCooldowns).filter(([id,value])=>typeof id==="string"&&id.length<=180&&Number(value)>0).slice(0,30).map(([id,value])=>[id,clamp(value,1,4)])):{};
    const spellcrafterLevel=Number(actor.techniques?.["ruiner.spellcrafter"]||0),spellcrafterLearnedLimit=spellcrafterLevel>=3?2:spellcrafterLevel>=1?1:0,spellcrafterIds=new Set(["fierce","focused","wild","outstanding"]),learned=[...new Set(cleanArray(source.techniqueState?.spellcrafterLearnedModifiers).filter(value=>spellcrafterIds.has(value)))].slice(0,spellcrafterLearnedLimit);
    const wispLevel=Number(actor.techniques?.["altruist.will-o-wisp"]||0),wispIds=new Set(["dreamy","angry","insightful","bright","kind","fierce"]),wispLearned=[...new Set(cleanArray(source.techniqueState?.wispLearnedTypes).filter(value=>wispIds.has(value)))].slice(0,wispLevel>=3?2:wispLevel>=1?1:0);
    actor.techniqueState={cunningPlan:clamp(source.techniqueState?.cunningPlan,0,4),studiedActorIds:cleanArray(source.techniqueState?.studiedActorIds).slice(0,120),spellcrafterLearnedModifiers:learned,spellModifiers:[...new Set(cleanArray(source.techniqueState?.spellModifiers).filter(value=>learned.includes(value)))].slice(0,spellcrafterLevel>=3?2:1),wispLearnedTypes:wispLearned};
    actor.ruleClocks=source.ruleClocks&&typeof source.ruleClocks==="object"?Object.fromEntries(Object.entries(source.ruleClocks).filter(([id])=>/^[a-z][a-z0-9.-]{0,79}$/.test(id)).slice(0,30).map(([id,clock])=>[id,clock&&typeof clock==="object"?{...clock,clockId:id,size:clamp(clock.size||6,1,24),minimumSize:clamp(clock.minimumSize||clock.size||6,1,24),initial:clamp(clock.initial,0,24),value:clamp(clock.value,0,24),active:clock.active!==false}:clamp(clock,0,24)])):{};
    actor.creationMarks=clamp(source.creationMarks,0,99);
    actor.innovationCharges=clamp(source.innovationCharges,0,99);
    actor.inventory=source.inventory&&typeof source.inventory==="object"?Object.fromEntries(Object.entries(source.inventory).filter(([id,value])=>typeof id==="string"&&id.length<=80&&Number(value)>0).slice(0,60).map(([id,value])=>[id,clamp(value,1,99)])):{};
    actor.ruleState=source.ruleState&&typeof source.ruleState==="object"?{pugilistStance:clamp(source.ruleState.pugilistStance,0,4),martialPerfection:Boolean(source.ruleState.martialPerfection),growth:clamp(source.ruleState.growth,0,99),gluttonConsumed:clamp(source.ruleState.gluttonConsumed,0,99),imposingPresence:Boolean(source.ruleState.imposingPresence),enemyAim:clamp(source.ruleState.enemyAim,0,1),rangerHeadshotTargetId:source.ruleState.rangerHeadshotTargetId||null,berserkerLastStand:Boolean(source.ruleState.berserkerLastStand),berserkerReactionTurnSerial:clamp(source.ruleState.berserkerReactionTurnSerial,0,999999),healerGuardianId:source.ruleState.healerGuardianId||null,privateerGearChange:Boolean(source.ruleState.privateerGearChange),roninSheathed:Boolean(source.ruleState.roninSheathed),grimTransformed:Boolean(source.ruleState.grimTransformed),grimUsed:Boolean(source.ruleState.grimUsed),warringTransformed:Boolean(source.ruleState.warringTransformed),warringUsed:Boolean(source.ruleState.warringUsed),drainLife:Boolean(source.ruleState.drainLife),lastCreationSpellMarks:clamp(source.ruleState.lastCreationSpellMarks,0,99)}:{};
    actor.ruleState.modifiedOverclockTurns=clamp(source.ruleState?.modifiedOverclockTurns,0,2);
    actor.ruleState.icicleSpellsRemaining=clamp(source.ruleState?.icicleSpellsRemaining,0,4);
    actor.ruleState.styleCarryRemaining=clamp(source.ruleState?.styleCarryRemaining,0,99);
    actor.ruleState.timeStopUsed=Boolean(source.ruleState?.timeStopUsed);
    actor.ruleState.empathSupport=clamp(source.ruleState?.empathSupport,0,99);
    actor.ruleState.masterArmament=source.ruleState?.masterArmament==="pole"?"polearm":["blade","polearm","chain"].includes(source.ruleState?.masterArmament)?source.ruleState.masterArmament:null;
    const modifierProfile=String(actor.profileId||"").startsWith("enemy.modifier."),rawModifier=source.modifierState&&typeof source.modifierState==="object"?source.modifierState:{};
actor.modifierState=modifierProfile?{carrierId:typeof rawModifier.carrierId==="string"?rawModifier.carrierId:null,targetId:typeof rawModifier.targetId==="string"?rawModifier.targetId:null,cells:cleanArray(rawModifier.cells).slice(0,64),mode:["inward","outward","lines","square3","rect2x5","edges","left","right","top","bottom"].includes(rawModifier.mode)?rawModifier.mode:null,configuredRound:clamp(rawModifier.configuredRound,0,999),groupId:typeof rawModifier.groupId==="string"?rawModifier.groupId.slice(0,120):null,clockId:typeof rawModifier.clockId==="string"?rawModifier.clockId.slice(0,120):null,deployed:Boolean(rawModifier.deployed),expanded:Boolean(rawModifier.expanded),legionHp:clamp(rawModifier.legionHp,0,9999),instanceRootId:typeof rawModifier.instanceRootId==="string"?rawModifier.instanceRootId.slice(0,120):null}:{};
    actor.techniqueArmor=clamp(source.techniqueArmor,0,99);
    actor.occupiedWidth=clamp(source.occupiedWidth||1,1,2);actor.occupiedHeight=clamp(source.occupiedHeight||1,1,2);
    actor.techniqueFocusBonus=clamp(source.techniqueFocusBonus,0,99);
    actor.clashAdvantage=clamp(source.clashAdvantage,0,30);
    actor.meals=clamp(source.meals,0,99);
    actor.maxMeals=clamp(source.maxMeals,0,99);
    actor.effectStates=source.effectStates&&typeof source.effectStates==="object"?Object.fromEntries(Object.entries(source.effectStates).filter(([effect,state])=>actor.effects.includes(effect)&&state&&typeof state==="object").slice(0,30).map(([effect,state])=>[effect,{duration:["default","persistent","scene","startTurn","actionOrStartTurn","roundEnd"].includes(state.duration)?state.duration:"default",removable:state.removable!==false,appliedTurnSerial:state.appliedTurnSerial!=null&&Number.isInteger(Number(state.appliedTurnSerial))?clamp(state.appliedTurnSerial,0,999999999):null,appliedRound:state.appliedRound!=null&&Number.isInteger(Number(state.appliedRound))?clamp(state.appliedRound,1,999):null,appliedEventId:typeof state.appliedEventId==="string"?state.appliedEventId.slice(0,120):"",sourceBound:Boolean(state.sourceBound),exclusiveBySource:Boolean(state.exclusiveBySource),sources:Array.isArray(state.sources)?state.sources.filter(item=>item&&persistedActorIds.has(item.actorId)).slice(0,12).map(item=>({actorId:item.actorId,actionId:typeof item.actionId==="string"?item.actionId.slice(0,180):"",eventId:typeof item.eventId==="string"?item.eventId.slice(0,120):""})):[]}])):{};
  });
  for(const actor of base.actors){const field=base.spaces.find(space=>space.id===actor.space)||base.spaces[0];actor.x=clamp(actor.x,0,field.width-1);actor.y=clamp(actor.y,0,field.height-1)}
  const compoundGroups=new Map();for(const actor of base.actors.filter(item=>item.compoundId)){if(!compoundGroups.has(actor.compoundId))compoundGroups.set(actor.compoundId,[]);compoundGroups.get(actor.compoundId).push(actor)}for(const parts of compoundGroups.values()){if(parts.length<2){parts.forEach(part=>{part.compoundId=null;part.compoundDefense=null;part.speed=part.compoundBaseSpeed??part.speed;part.compoundBaseSpeed=null});continue}const anchor=parts[0],effects=[...new Set(parts.flatMap(part=>part.effects||[]))],effectStates=Object.assign({},...parts.map(part=>part.effectStates||{})),alive=parts.some(part=>Number(part.hp||0)>0),compoundDefense=parts.map(part=>part.compoundDefense).find(value=>value==="armor"||value==="evasion")||null;parts.forEach(part=>{part.space=anchor.space;part.x=anchor.x;part.y=anchor.y;part.compoundBaseSpeed=part.compoundBaseSpeed??part.speed;part.compoundDefense=compoundDefense;part.effects=[...effects];part.effectStates=Object.fromEntries(effects.filter(effect=>effectStates[effect]).map(effect=>[effect,effectStates[effect]]));part.knockedOut=!alive})}
  const actorIds=new Set(base.actors.map(actor=>actor.id));base.objects=Array.isArray(scene.objects)?scene.objects.slice(0,240).map(object=>({id:typeof object.id==="string"?object.id:uid(),space:spaceIds.has(object.space)?object.space:base.activeSpace,type:normalizedSceneObjectType(object,scene.schema),label:typeof object.label==="string"?object.label.slice(0,80):"Область",source:typeof object.source==="string"?object.source.slice(0,160):"Ручное правило",ruleId:typeof object.ruleId==="string"?object.ruleId.slice(0,180):"",duration:object.duration==="turn"?"endTurn":["instant","endTurn","nextTurn","round","scene","persistent"].includes(object.duration)?object.duration:"scene",ownerActorId:actorIds.has(object.ownerActorId)?object.ownerActorId:null,cells:cleanArray(object.cells).slice(0,144),createdRound:clamp(object.createdRound||1,1,999),hp:object.hp==null?null:clamp(object.hp,0,9999),maxHp:object.maxHp==null?null:clamp(object.maxHp,0,9999),metadata:object.metadata&&typeof object.metadata==="object"?object.metadata:{}})):[];
  base.walls=Array.isArray(scene.walls)?scene.walls.slice(0,240).map(wall=>{const space=spaceIds.has(wall.space)?wall.space:base.activeSpace,a=String(wall.a||""),b=String(wall.b||""),[ax,ay]=a.split(",").map(Number),[bx,by]=b.split(",").map(Number),field=base.spaces.find(item=>item.id===space),valid=field&&Number.isInteger(ax)&&Number.isInteger(ay)&&Number.isInteger(bx)&&Number.isInteger(by)&&ax>=0&&ay>=0&&bx>=0&&by>=0&&ax<field.width&&bx<field.width&&ay<field.height&&by<field.height&&Math.abs(ax-bx)+Math.abs(ay-by)===1;if(!valid)return null;const maxHp=clamp(wall.maxHp||10,1,9999);return{id:typeof wall.id==="string"?wall.id:uid(),space,a,b,label:typeof wall.label==="string"?wall.label.slice(0,80):"Стена",source:typeof wall.source==="string"?wall.source.slice(0,160):"Ручное правило",hp:clamp(wall.hp??maxHp,0,maxHp),maxHp,createdRound:clamp(wall.createdRound||1,1,999)}}).filter(Boolean):[];
  base.markers=Array.isArray(scene.markers)?scene.markers.slice(0,240).map(marker=>({id:typeof marker.id==="string"?marker.id:uid(),space:spaceIds.has(marker.space)?marker.space:base.activeSpace,x:clamp(marker.x,0,11),y:clamp(marker.y,0,11),kind:["mark","damocles","bomb","ritual","trap","summon","weapon","objective","countdown","hidden","custom"].includes(marker.kind)?marker.kind:"mark",label:typeof marker.label==="string"?marker.label.slice(0,80):"Метка",color:safeColor(marker.color,"#e2b54a"),source:typeof marker.source==="string"?marker.source.slice(0,160):"Ручное правило",ruleId:typeof marker.ruleId==="string"?marker.ruleId.slice(0,180):"",duration:["endTurn","nextTurn","round","scene","persistent"].includes(marker.duration)?marker.duration:"scene",ownerActorId:actorIds.has(marker.ownerActorId)?marker.ownerActorId:null,createdRound:clamp(marker.createdRound||1,1,999),metadata:marker.metadata&&typeof marker.metadata==="object"?marker.metadata:{}})):[];
  base.topology={cuts:Array.isArray(scene.topology?.cuts)?scene.topology.cuts.slice(0,120).map(cut=>({id:typeof cut.id==="string"?cut.id:uid(),space:spaceIds.has(cut.space)?cut.space:base.activeSpace,label:typeof cut.label==="string"?cut.label.slice(0,80):"Разрыв поля",source:typeof cut.source==="string"?cut.source.slice(0,160):"Ручное правило",ruleId:typeof cut.ruleId==="string"?cut.ruleId.slice(0,180):"",ownerActorId:actorIds.has(cut.ownerActorId)?cut.ownerActorId:null,crossing:cut.crossing==="opposite"?"opposite":"blocked",cells:cleanArray(cut.cells).slice(0,144),createdRound:clamp(cut.createdRound||1,1,999)})):[]};
  const canonicalCell=(spaceId,cell)=>{if(typeof cell!=="string"||!/^(?:0|[1-9]\d*),(?:0|[1-9]\d*)$/.test(cell))return null;const field=base.spaces.find(space=>space.id===spaceId),[x,y]=cell.split(",").map(Number);return field&&x>=0&&y>=0&&x<field.width&&y<field.height?`${x},${y}`:null},normalizedCells=(spaceId,cells,limit=144)=>[...new Set(cleanArray(cells).map(cell=>canonicalCell(spaceId,cell)).filter(Boolean))].slice(0,limit);
  base.objects=base.objects.map(object=>({...object,cells:normalizedCells(object.space,object.cells)})).filter(object=>object.cells.length);
  base.markers.forEach(marker=>{const field=base.spaces.find(space=>space.id===marker.space)||base.spaces[0];marker.x=clamp(marker.x,0,field.width-1);marker.y=clamp(marker.y,0,field.height-1)});
  base.topology.cuts=base.topology.cuts.map(cut=>({...cut,cells:normalizedCells(cut.space,cut.cells)})).filter(cut=>cut.cells.length);
  base.artworks=Array.isArray(scene.artworks)?scene.artworks.slice(0,12).map(art=>({id:typeof art.id==="string"?art.id:uid(),name:typeof art.name==="string"?art.name.slice(0,120):"Арт Сцены",kind:art.kind==="background"?"background":"art",image:safeImage(art.image),hidden:Boolean(art.hidden)})).filter(art=>art.image):[];const artIds=new Set(base.artworks.map(art=>art.id));base.backgroundArt=artIds.has(scene.backgroundArt)?scene.backgroundArt:null;base.featuredArt=artIds.has(scene.featuredArt)?scene.featuredArt:null;base.backgroundView={fit:scene.backgroundView?.fit==="contain"?"contain":"cover",position:["center","top","bottom","left","right"].includes(scene.backgroundView?.position)?scene.backgroundView.position:"center",dim:clamp(scene.backgroundView?.dim??28,0,85),gridOpacity:clamp(scene.backgroundView?.gridOpacity??58,12,96)};
  base.selectedActor=actorIds.has(scene.selectedActor)?scene.selectedActor:null;base.activeActorId=actorIds.has(scene.activeActorId)?scene.activeActorId:null;base.targetIds=cleanArray(scene.targetIds).filter(id=>actorIds.has(id)).slice(0,40);base.pendingActionPlan=scene.pendingActionPlan&&typeof scene.pendingActionPlan==="object"&&actorIds.has(scene.pendingActionPlan.actorId)?scene.pendingActionPlan:null;base.pendingAction=scene.pendingAction&&typeof scene.pendingAction==="object"&&actorIds.has(scene.pendingAction.actorId)?scene.pendingAction:null;if(base.pendingAction){base.pendingAction.targetIds=cleanArray(base.pendingAction.targetIds).filter(id=>actorIds.has(id));const pendingActor=base.actors.find(actor=>actor.id===base.pendingAction.actorId);base.pendingAction.targetCells=normalizedCells(pendingActor?.space,base.pendingAction.targetCells,40);if(!base.pendingAction.targetIds.length&&!base.pendingAction.allowEmptyTargets)base.pendingAction=null}base.pendingPrompt=scene.pendingPrompt&&typeof scene.pendingPrompt==="object"&&actorIds.has(scene.pendingPrompt.sourceActorId)&&(!scene.pendingPrompt.targetId||actorIds.has(scene.pendingPrompt.targetId))?scene.pendingPrompt:null;base.triggerQueue=Array.isArray(scene.triggerQueue)?scene.triggerQueue.filter(item=>item&&typeof item.key==="string"&&item.event?.type==="rule.prompt"&&actorIds.has(item.event.actorId||item.event.payload?.sourceActorId)).slice(0,24):[];if(!base.pendingPrompt&&scene.pendingPrompt)base.triggerQueue=[];const challenge=scene.challengeRequest;base.challengeRequest=challenge&&typeof challenge==="object"&&typeof challenge.id==="string"&&actorIds.has(challenge.actorId)&&Number.isInteger(Number(challenge.target))?{id:challenge.id.slice(0,120),actorId:challenge.actorId,target:clamp(challenge.target,1,99),requestedBy:typeof challenge.requestedBy==="string"?challenge.requestedBy.slice(0,120):"Нарратор",at:typeof challenge.at==="string"?challenge.at.slice(0,32):"",result:normalizedChallengeResult(challenge.result)}:null;base.opposedRoll=normalizedOpposedRoll(scene.opposedRoll,actorIds);if(base.opposedRoll)base.challengeRequest=null;base.sessionClocks=Array.isArray(scene.sessionClocks)?scene.sessionClocks.slice(0,30).filter(clock=>clock&&typeof clock.id==="string").map(clock=>({id:clock.id.slice(0,120),name:typeof clock.name==="string"?clock.name.slice(0,120):"Часы Сцены",kind:clock.kind==="progress"?"progress":"danger",size:[4,6,8,12].includes(Number(clock.size))?Number(clock.size):6,value:clamp(clock.value,0,[4,6,8,12].includes(Number(clock.size))?Number(clock.size):6)})):[];base.reminders=Array.isArray(scene.reminders)?scene.reminders.slice(0,80).filter(item=>item&&typeof item.id==="string"&&typeof item.label==="string").map(item=>({id:item.id.slice(0,120),label:item.label.slice(0,120),text:typeof item.text==="string"?item.text.slice(0,800):"",boundary:["turnStart","turnEnd","roundEnd","manual"].includes(item.boundary)?item.boundary:"manual",ownerActorId:actorIds.has(item.ownerActorId)?item.ownerActorId:null,createdTurnSerial:clamp(item.createdTurnSerial,0,999999999),createdRound:clamp(item.createdRound||base.round,1,999),due:Boolean(item.due),dueEventId:typeof item.dueEventId==="string"?item.dueEventId.slice(0,120):"",sourceActionId:typeof item.sourceActionId==="string"?item.sourceActionId.slice(0,180):"manual.reminder"})):[];base.ruleHandouts=Array.isArray(scene.ruleHandouts)?scene.ruleHandouts.slice(0,12).filter(item=>item&&typeof item.id==="string"&&typeof item.ruleId==="string").map(item=>({id:item.id.slice(0,120),ruleId:item.ruleId.slice(0,180),title:typeof item.title==="string"?item.title.slice(0,180):"Правило",kind:typeof item.kind==="string"?item.kind.slice(0,80):"Правило",sharedBy:typeof item.sharedBy==="string"?item.sharedBy.slice(0,120):"Нарратор",at:typeof item.at==="string"?item.at.slice(0,32):""})):[];base.tools={clocksMigrated:Boolean(scene.tools?.clocksMigrated)};base.rollFeed=Array.isArray(scene.rollFeed)?scene.rollFeed.slice(0,20):[];
  base.targetCells=normalizedCells(base.activeSpace,scene.targetCells,40);
  const actorFor=id=>base.actors.find(actor=>actor.id===id),actorAvailable=id=>Boolean(actorFor(id)&&!actorFor(id).knockedOut),markerIds=new Set(base.markers.map(marker=>marker.id));
  if(base.activeActorId&&(!actorAvailable(base.activeActorId)||String(actorFor(base.activeActorId)?.profileId||"").startsWith("enemy.modifier.")))base.activeActorId=null;
  if(base.pendingActionPlan){
    if(!actorAvailable(base.pendingActionPlan.actorId))base.pendingActionPlan=null;
    else if(base.pendingActionPlan.context&&typeof base.pendingActionPlan.context==="object"){
      const requestedTargets=cleanArray(base.pendingActionPlan.context.targetIds),remainingTargets=requestedTargets.filter(id=>actorAvailable(id));
      base.pendingActionPlan.context={...base.pendingActionPlan.context,targetIds:remainingTargets};
      if(requestedTargets.length&&!remainingTargets.length)base.pendingActionPlan=null;
    }
  }
  if(base.pendingAction){
    if(!actorAvailable(base.pendingAction.actorId))base.pendingAction.interruptedReason=base.pendingAction.interruptedReason||"Исполнитель больше не может завершить действие";
    for(const targetId of base.pendingAction.targetIds||[])if(!actorAvailable(targetId)&&base.pendingAction.responses?.[targetId]?.choice==="pending")base.pendingAction.responses[targetId]={choice:"unavailable",reason:"Цель больше недоступна"};
  }
  const rawPrompt=base.pendingPrompt,promptSource=actorFor(rawPrompt?.sourceActorId),promptTarget=rawPrompt?.targetId?actorFor(rawPrompt.targetId):null,promptMarkerId=rawPrompt?.markerId||rawPrompt?.context?.markerId;
  if(rawPrompt&&(!promptSource||promptSource.knockedOut||rawPrompt.targetId&&(!promptTarget||promptTarget.knockedOut)||promptMarkerId&&!markerIds.has(promptMarkerId)||Number(rawPrompt.expiresAt)>0&&Number(rawPrompt.expiresAt)<=Date.now())){base.pendingPrompt=null;base.triggerQueue=[]}
  const queuedPromptValid=item=>{const deferred=item?.event?.payload||{},source=actorFor(item?.event?.actorId||deferred.sourceActorId),target=deferred.targetId?actorFor(deferred.targetId):null,markerId=deferred.markerId||deferred.context?.markerId;return item&&typeof item.key==="string"&&item.event?.type==="rule.prompt"&&source&&!source.knockedOut&&(!deferred.targetId||target&&!target.knockedOut)&&(!markerId||markerIds.has(markerId))};
  base.triggerQueue=(base.triggerQueue||[]).filter(queuedPromptValid);
  if(base.challengeRequest&&!actorAvailable(base.challengeRequest.actorId))base.challengeRequest=null;
  if(base.opposedRoll?.participants.some(participant=>participant.actorId&&!actorAvailable(participant.actorId)))base.opposedRoll=null;
  if(base.challengeRequest&&!base.challengeRequest.result){const legacyResult=base.rollFeed.find(roll=>roll?.challengeRequestId===base.challengeRequest.id);if(legacyResult)base.challengeRequest.result=normalizedChallengeResult(legacyResult)}
  base.log=Array.isArray(scene.log)?scene.log.slice(0,200).map(row=>({id:typeof row.id==="string"?row.id:uid(),at:typeof row.at==="string"?row.at.slice(0,32):"",text:typeof row.text==="string"?row.text.slice(0,240):"",type:typeof row.type==="string"?row.type.slice(0,80):"legacy.note",actorId:typeof row.actorId==="string"?row.actorId:null,payload:row.payload&&typeof row.payload==="object"?row.payload:{},visibility:row.visibility==="gm"?"gm":"public"})):[];
  return typeof structuredClone==="function"?structuredClone(base):JSON.parse(JSON.stringify(base));
}

function normalizeScene(raw){
  const history=(rows,limit=20)=>Array.isArray(rows)?rows.slice(0,limit).filter(row=>row&&typeof row==="object"&&row.state).map(row=>({id:typeof row.id==="string"?row.id:uid(),label:typeof row.label==="string"?row.label.slice(0,160):"Изменение",state:sceneCore(row.state),...(row.checkpoint==="turn-start"?{checkpoint:"turn-start"}:{})})):[];
  const base=sceneCore(raw);base.undo=history(raw?.undo);base.redo=history(raw?.redo);base.turnUndo=history(raw?.turnUndo,120);return base;
}

const TABLE_BACKUP_FORMAT="dawn-ru-table-backup",TABLE_BACKUP_SCHEMA=1,TABLE_RECOVERY_KEY="dawn-ru-companion-table-recovery-v1",TABLE_RECOVERY_META_KEY="dawn-ru-companion-table-recovery-meta-v1";
function tableBackupPayload(scene=Scene){return{format:TABLE_BACKUP_FORMAT,schema:TABLE_BACKUP_SCHEMA,appSchema:APP_SCHEMA,exportedAt:new Date().toISOString(),scene:sceneCore(scene),gmLibrary:normalizeGmLibrary(store?.gmLibrary)}}
function normalizedTableBackup(raw){
  const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:null;if(!source)throw new Error("Файл не содержит данных стола.");
  if(source.format===TABLE_BACKUP_FORMAT&&Number(source.schema)!==TABLE_BACKUP_SCHEMA)throw new Error("Версия резервной копии пока не поддерживается.");
  const legacyStore=source.schema===APP_SCHEMA&&source.scene&&Array.isArray(source.heroes),sceneRaw=source.format===TABLE_BACKUP_FORMAT?source.scene:legacyStore?source.scene:Array.isArray(source.spaces)&&Array.isArray(source.actors)?source:null;
  if(!sceneRaw||!Array.isArray(sceneRaw.spaces)||!Array.isArray(sceneRaw.actors))throw new Error("Это не резервная копия Сцены DAWN.");
  const scene=normalizeScene(sceneRaw);if(!scene.spaces.length)throw new Error("В копии нет игрового пространства.");
  return{scene,gmLibrary:source.format===TABLE_BACKUP_FORMAT||legacyStore?normalizeGmLibrary(source.gmLibrary):null,legacy:source.format!==TABLE_BACKUP_FORMAT};
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
  base.rulesEdition=["ru-v0.9","lionwing"].includes(h.rulesEdition)?h.rulesEdition:"ru-v0.9";
  base.supplementIds=[...new Set(cleanArray(h.supplementIds))].slice(0,30);
  for(const key of ["name","player","concept"]) base[key]=typeof h[key]==="string"?h[key].slice(0,500):"";
  base.media={portrait:safeImage(h.media?.portrait),token:safeTokenImage(h.media?.token),portraitStored:Boolean(h.media?.portraitStored),tokenStored:Boolean(h.media?.tokenStored)};
  base.tier=clamp(h.tier,1,6);
  for(const [key] of ATTRS){ base.attrs[key]=clamp(h.attrs?.[key] ?? base.attrs[key],2,4); base.attrBonus[key]=clamp(h.attrBonus?.[key],0,5); }
  base.attrs=Logic.normalizeAttributeBases(base.attrs,ATTRS.map(([key])=>key));
  base.attrBonus=Logic.normalizeAttributeGrowth(base.attrBonus,base.tier,ATTRS.map(([key])=>key));
  base.techConversions=clamp(h.techConversions,0,5); base.conversionAttr=ATTRS.some(a=>a[0]===h.conversionAttr)?h.conversionAttr:"body";
  base.primaryOutlook=typeof h.primaryOutlook==="string"?h.primaryOutlook:null; base.outlooks=cleanArray(h.outlooks).slice(0,3); base.gifts=cleanArray(h.gifts);
  if(base.primaryOutlook&&!base.outlooks.includes(base.primaryOutlook)) base.outlooks.unshift(base.primaryOutlook);
  base.bonds=Array.isArray(h.bonds)?h.bonds.slice(0,30).filter(bond=>bond&&typeof bond==="object").map(bond=>({id:typeof bond.id==="string"?bond.id:uid(),name:typeof bond.name==="string"?bond.name.trim().slice(0,120):"",rank:clamp(bond.rank||1,1,3),tags:cleanArray(bond.tags).map(tag=>tag.trim().slice(0,40)).filter(Boolean).slice(0,6),quick:Boolean(bond.quick)})).filter(bond=>bond.name):[];
  base.skills=Array.isArray(h.skills)?h.skills.slice(0,30).map(s=>({id:typeof s.id==="string"?s.id:uid(),name:typeof s.name==="string"?s.name.slice(0,180):"",definitionId:typeof s.definitionId==="string"?s.definitionId.slice(0,180):null,rank:clamp(s.rank,1,3)})):base.skills;
  base.ability=normalizeAbility(h.ability);base.taintedAbility=normalizeAbility(h.taintedAbility);
  base.techniques={}; if(h.techniques&&typeof h.techniques==="object") for(const [id,level] of Object.entries(h.techniques)) base.techniques[id]=clamp(level,0,3);
  const spellcrafterLevel=Number(base.techniques["ruiner.spellcrafter"]||0),spellcrafterLearnedLimit=spellcrafterLevel>=3?2:spellcrafterLevel>=1?1:0,spellcrafterIds=new Set(["fierce","focused","wild","outstanding"]);
  const wispLevel=Number(base.techniques["altruist.will-o-wisp"]||0),wispIds=new Set(["dreamy","angry","insightful","bright","kind","fierce"]);
  base.mods={taintedBody:Boolean(h.mods?.taintedBody),gadgetSpent:clamp(h.mods?.gadgetSpent,0,99),performanceSkill:typeof h.mods?.performanceSkill==="string"?h.mods.performanceSkill:null,spellcrafterAugments:[...new Set(cleanArray(h.mods?.spellcrafterAugments).filter(id=>spellcrafterIds.has(id)))].slice(0,spellcrafterLearnedLimit),wispSpiritTypes:[...new Set(cleanArray(h.mods?.wispSpiritTypes).filter(id=>wispIds.has(id)))].slice(0,wispLevel>=3?2:wispLevel>=1?1:0)};
  const rt=h.runtime||{},freeplay=rt.freeplay&&typeof rt.freeplay==="object"?rt.freeplay:{}; base.runtime={hp:rt.hp!==""&&rt.hp!=null&&Number.isFinite(+rt.hp)?+rt.hp:null,maxHp:rt.maxHp!==""&&rt.maxHp!=null&&Number.isFinite(+rt.maxHp)?Math.max(0,+rt.maxHp):null,wounds:clamp(rt.wounds,0,99),focus:Number.isFinite(+rt.focus)?+rt.focus:null,influence:clamp(rt.influence,0,999),stress:clamp(rt.stress,0,3),ap:clamp(rt.ap??3,0,99),tension:clamp(rt.tension,0,99),funding:Number.isFinite(+rt.funding)?clamp(rt.funding,0,999):null,fundingTier:clamp(rt.fundingTier,0,6),sacrifices:cleanArray(rt.sacrifices).filter(item=>["eye","arm","leg","tongue","life"].includes(item)),notes:typeof rt.notes==="string"?rt.notes.slice(0,10000):"",effects:cleanArray(rt.effects),clocks:Array.isArray(rt.clocks)?rt.clocks.slice(0,30).map(c=>({id:typeof c.id==="string"?c.id:uid(),name:typeof c.name==="string"?c.name.slice(0,120):"Часы",size:[4,6,8].includes(+c.size)?+c.size:6,value:clamp(c.value,0,[4,6,8].includes(+c.size)?+c.size:6)})):[],diceHistory:Array.isArray(rt.diceHistory)?rt.diceHistory.slice(0,20).map(row=>({at:typeof row.at==="string"?row.at.slice(0,20):"",count:clamp(row.count,1,300),successes:clamp(row.successes,0,300),crits:clamp(row.crits,0,300),outcome:typeof row.outcome==="string"?row.outcome.slice(0,80):"",target:clamp(row.target||base.tier+1,1,99),allIn:Boolean(row.allIn),payment:typeof row.payment==="string"?row.payment.slice(0,20):""})):[],freeplay:{target:freeplay.target!=null?clamp(freeplay.target,1,99):null}};
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
    h.skills=(old.skills||[]).map(s=>({id:uid(),name:s.name||"",definitionId:null,rank:s.rank||1}));
    h.ability={...h.ability,enabled:Boolean(old.ability?.name||old.ability?.rank),name:old.ability?.name||"",desc:old.ability?.desc||"",rank:clamp(old.ability?.rank||1,1,3)};
    for(const [name,level] of Object.entries(old.techniques||old.techs||{})){const id=techByName.get(name)||name;if(id)h.techniques[id]=level;}
    h.runtime={...h.runtime,...(old.rt||{})}; return normalizeHero(h);
  });
  return {schema:APP_SCHEMA,current:clamp(raw?.current,0,Math.max(0,heroes.length-1)),mode:raw?.mode||"build",theme:"dark",heroes:heroes.length?heroes:[blankHero()],scene:blankScene(),gmLibrary:normalizeGmLibrary(null)};
}

const HERO_MEDIA_DB="dawn-ru-companion-media",HERO_MEDIA_STORE="hero-media";
let heroMediaDbPromise=null,heroMediaStorageReady=false,heroMediaWriteTimer=null,heroMediaWriteRunning=false,lastStorageWarningAt=0;
const storedHeroMediaSignatures=new Map();
const heroMediaKey=(heroId,kind)=>`hero:${heroId}:${kind}`;
const mediaSignature=value=>`${String(value||"").length}:${String(value||"").slice(0,48)}:${String(value||"").slice(-48)}`;
function heroMediaEntries(heroes){
  const entries=[];
  for(const hero of heroes||[])for(const kind of ["portrait","token"]){const value=hero?.media?.[kind];if(value)entries.push({key:heroMediaKey(hero.id,kind),value})}
  return entries;
}
function openHeroMediaDb(){
  if(heroMediaDbPromise)return heroMediaDbPromise;
  if(!globalThis.indexedDB)return Promise.reject(new Error("IndexedDB недоступен"));
  heroMediaDbPromise=new Promise((resolve,reject)=>{
    const request=globalThis.indexedDB.open(HERO_MEDIA_DB,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(HERO_MEDIA_STORE))request.result.createObjectStore(HERO_MEDIA_STORE,{keyPath:"key"})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Не удалось открыть хранилище изображений"));
  });
  return heroMediaDbPromise;
}
async function writeHeroMedia(entries){
  const pending=(entries||[]).filter(entry=>entry.value&&storedHeroMediaSignatures.get(entry.key)!==mediaSignature(entry.value));
  if(!pending.length)return;
  const db=await openHeroMediaDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(HERO_MEDIA_STORE,"readwrite"),bucket=tx.objectStore(HERO_MEDIA_STORE);
    pending.forEach(entry=>bucket.put({key:entry.key,value:entry.value,updatedAt:Date.now()}));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error("Не удалось сохранить изображения"));tx.onabort=()=>reject(tx.error||new Error("Сохранение изображений отменено"));
  });
  pending.forEach(entry=>storedHeroMediaSignatures.set(entry.key,mediaSignature(entry.value)));
}
async function readHeroMedia(keys){
  const db=await openHeroMediaDb(),values=new Map();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(HERO_MEDIA_STORE,"readonly"),bucket=tx.objectStore(HERO_MEDIA_STORE);
    for(const key of keys){const request=bucket.get(key);request.onsuccess=()=>{if(request.result?.value)values.set(key,request.result.value)}}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error("Не удалось прочитать изображения"));
  });
  return values;
}
function restoreLocalHeroMedia(scene,heroes){
  const byId=new Map((heroes||[]).map(hero=>[hero.id,hero]));
  for(const actor of scene?.actors||[]){const hero=byId.get(actor.heroId);if(!hero)continue;actor.tokenImage||=hero.media?.token||"";actor.portraitImage||=hero.media?.portrait||""}
  return scene;
}
function scheduleHeroMediaPersistence(){
  if(!heroMediaStorageReady||heroMediaWriteTimer)return;
  heroMediaWriteTimer=setTimeout(async()=>{
    heroMediaWriteTimer=null;
    if(heroMediaWriteRunning)return scheduleHeroMediaPersistence();
    const entries=heroMediaEntries(store?.heroes).filter(entry=>storedHeroMediaSignatures.get(entry.key)!==mediaSignature(entry.value));
    if(!entries.length)return;
    heroMediaWriteRunning=true;
    try{await writeHeroMedia(entries);persist()}
    catch(error){console.warn("DAWN hero media persistence failed",error);if(Date.now()-lastStorageWarningAt>5000){lastStorageWarningAt=Date.now();toast("Изображения пока не вынесены в расширенное хранилище")}}
    finally{heroMediaWriteRunning=false}
  },40);
}
async function initializeHeroMediaStorage(){
  await openHeroMediaDb();
  await writeHeroMedia(heroMediaEntries(store.heroes));
  const bindings=[];
  for(const hero of store.heroes)for(const kind of ["portrait","token"])if(!hero.media?.[kind]&&hero.media?.[`${kind}Stored`])bindings.push({hero,kind,key:heroMediaKey(hero.id,kind)});
  const stored=await readHeroMedia(bindings.map(binding=>binding.key));
  let hydrated=false;
  for(const binding of bindings){if(!binding.hero.media?.[`${binding.kind}Stored`]||binding.hero.media[binding.kind])continue;const value=stored.get(binding.key),safe=binding.kind==="token"?safeTokenImage(value):safeImage(value);if(!safe)continue;binding.hero.media[binding.kind]=safe;storedHeroMediaSignatures.set(binding.key,mediaSignature(safe));hydrated=true}
  heroMediaStorageReady=true;
  S=store.heroes[store.current]||store.heroes[0];
  restoreLocalHeroMedia(Scene,store.heroes);
  persist();
  if(hydrated)renderAll();
}
function normalizedStoredState(parsed){
  const heroes=parsed.heroes.map(normalizeHero),scene=restoreLocalHeroMedia(normalizeScene(parsed.scene),heroes);
  return {...parsed,heroes,scene,gmLibrary:normalizeGmLibrary(parsed.gmLibrary)};
}
function loadStoredHeroes(){
  try{const parsed=JSON.parse(localStorage.getItem(HERO_STORAGE_KEY)||"null");if(parsed?.schema===APP_SCHEMA&&Array.isArray(parsed.heroes)&&parsed.heroes.length)return{current:clamp(parsed.current,0,parsed.heroes.length-1),heroes:parsed.heroes.map(normalizeHero)}}catch(e){console.warn(e)}
  return null;
}
function loadStore(){
  const storedHeroes=loadStoredHeroes();
  try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(parsed?.schema===APP_SCHEMA&&Array.isArray(parsed.heroes)){const restored=normalizedStoredState(parsed);if(storedHeroes){restored.heroes=storedHeroes.heroes;restored.current=storedHeroes.current;restoreLocalHeroMedia(restored.scene,restored.heroes)}return restored}}catch(e){console.warn(e)}
  if(storedHeroes)return {schema:APP_SCHEMA,current:storedHeroes.current,mode:"build",theme:"dark",heroes:storedHeroes.heroes,scene:blankScene(),gmLibrary:normalizeGmLibrary(null)};
  try{const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||"null");if(legacy){const migrated=migrateLegacy(legacy);localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;}}catch(e){console.warn(e)}
  return {schema:APP_SCHEMA,current:0,mode:"build",theme:"dark",heroes:[blankHero()],scene:blankScene(),gmLibrary:normalizeGmLibrary(null)};
}
function isPristineHero(hero){
  return hero&&!hero.name&&!hero.player&&!hero.concept&&!hero.primaryOutlook&&!hero.outlooks.length&&!hero.gifts.length&&!hero.bonds?.length&&!Object.keys(hero.techniques).length&&!hero.ability.enabled&&hero.skills.length===1&&!hero.skills[0].name;
}
function consumePresetDraft(targetStore){
  let draft;
  try{const url=new URL(window.location.href),raw=url.searchParams.get("preset");if(!raw)return null;url.searchParams.delete("preset");history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);draft=JSON.parse(raw);}catch{return null}
  const createdAt=Number(draft?.createdAt);
  if(!draft||draft.schema!==1||draft.kind!=="dawn-combat-preset"||!Number.isFinite(createdAt)||Math.abs(Date.now()-createdAt)>15*60*1000)return null;
  const knownTechniques=new Set(allArchetypes().flatMap(archetype=>archetype.techniques.map(technique=>technique.id))),techniques={};
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
let store=loadStore(); const importedPresetName=consumePresetDraft(store),requestedMode=new URLSearchParams(location.search).get("mode");if(["build","play","tools","rules","reference"].includes(requestedMode))store.mode=requestedMode;let S=store.heroes[store.current]||store.heroes[0]; let Scene=store.scene||blankScene();let activeArch=activeArchetypes()[0]?.id; let techTag="all",techSort="source",refKind="all",refTag="all",refSort="source",rulesAudience="all";let activeScenePanel=null,activeScenePanels={left:null,right:null},scenePanelTrigger=null,activeSheetTab="combat",activeUtilityPreset={skillId:"",abilityKey:""},activeUtilityActorId=null;let sceneViewportMode=sceneViewportProfile(),sceneZoom=clamp(store.sceneUi?.zoom||70,30,180),sceneControlMode=["auto","guided","manual"].includes(store.sceneUi?.controlMode)?store.sceneUi.controlMode:"guided",sceneNeedsInitialFit=store.sceneUi?.fitVersion!==9||store.sceneUi?.viewport!==sceneViewportMode,sceneResizeTimer=null;let sceneDragActorId=null,sceneSuppressBoardClickUntil=0,sceneMeasureStart=null,sceneMeasureCells=new Set(),sceneMeasureLabel="",scenePanState=null,sceneSpaceHeld=false,sceneTokenTipTimer=null,hoveredSceneActorId=null,sceneContextTarget=null,lastAutoOpenedSceneResultsId="",activeModifierPickerId=null,activeModifierActionId=null,activeModifierShapePreset=null,showAllModifierOverlays=false,modifierModeDrafts=new Map();
const DEFAULT_SCENE_PANEL_SIDES={director:"left",inspector:"right",sheet:"right",utility:"right",reference:"right",roster:"right",media:"right",map:"right",add:"right",table:"left",network:"right",log:"right"};
const SCENE_PANEL_WIDTHS={compact:300,normal:380,wide:480};
const sceneLayoutV2=store.sceneUi?.layoutVersion===2;
let sceneInterfaceVersion=store.sceneUi?.interfaceVersion==="next"?"next":"classic",activeDirectorTab="turn",scenePanelLayoutMode=["split","right","left","custom"].includes(store.sceneUi?.panelLayout)?store.sceneUi.panelLayout:"split",scenePanelSides={...DEFAULT_SCENE_PANEL_SIDES,...(sceneLayoutV2?store.sceneUi?.panelSides:{})},scenePanelWidths={left:sceneLayoutV2&&SCENE_PANEL_WIDTHS[store.sceneUi?.panelWidths?.left]?store.sceneUi.panelWidths.left:"wide",right:sceneLayoutV2&&SCENE_PANEL_WIDTHS[store.sceneUi?.panelWidths?.right]?store.sceneUi.panelWidths.right:"normal"},sceneTurnStripVisible=store.sceneUi?.turnStripVisible!==false,sceneInterfaceDensity=["compact","comfortable"].includes(store.sceneUi?.density)?store.sceneUi.density:"compact";
document.body.classList.toggle("scene-interface-next",sceneInterfaceVersion==="next");const sceneNextStyles=$("scene-interface-next-styles");if(sceneNextStyles)sceneNextStyles.disabled=sceneInterfaceVersion!=="next";
function activateHeroEdition(edition,{saveCurrent=true}={}){
  const target=["ru-v0.9","lionwing"].includes(edition)?edition:"ru-v0.9";
  if(saveCurrent)store.heroes[store.current]=S;
  let index=store.heroes.findIndex(hero=>(hero.rulesEdition||"ru-v0.9")===target);
  if(index<0){store.heroes.push(blankHero(target));index=store.heroes.length-1}
  store.current=index;S=normalizeHero(store.heroes[index]);store.heroes[index]=S;
}
function persistableStore(){
  const heroes=persistableHeroes(),scene=sceneCore(Scene),sourceById=new Map(store.heroes.map(hero=>[hero.id,hero]));
  scene.undo=[];
  for(const actor of scene.actors){const hero=sourceById.get(actor.heroId);if(!hero)continue;if(actor.tokenImage&&actor.tokenImage===hero.media?.token)actor.tokenImage="";if(actor.portraitImage&&actor.portraitImage===hero.media?.portrait)actor.portraitImage=""}
  return {...store,heroes,scene,gmLibrary:normalizeGmLibrary(store.gmLibrary),sceneUi:{zoom:sceneZoom,controlMode:sceneControlMode,interfaceVersion:sceneInterfaceVersion,panelLayout:scenePanelLayoutMode,panelSides:scenePanelSides,panelWidths:scenePanelWidths,turnStripVisible:sceneTurnStripVisible,density:sceneInterfaceDensity,layoutVersion:2,fitVersion:9,viewport:sceneViewportMode}};
}
function persistableHeroes(){
  const heroes=store.heroes.map(normalizeHero);
  for(let index=0;index<heroes.length;index++)for(const kind of ["portrait","token"]){
    const source=store.heroes[index],copy=heroes[index],value=source.media?.[kind]||"",stored=storedHeroMediaSignatures.get(heroMediaKey(source.id,kind))===mediaSignature(value);
    if(value&&heroMediaStorageReady&&stored){copy.media[kind]="";copy.media[`${kind}Stored`]=true}
  }
  return heroes;
}
function persistHeroStore(){
  const payload=JSON.stringify({schema:APP_SCHEMA,current:store.current,heroes:persistableHeroes()});
  try{localStorage.setItem(HERO_STORAGE_KEY,payload);return true}
  catch(error){
    const sync=Sync?.state?.();
    if(sync?.sceneId&&sync.role==="player")try{localStorage.removeItem(STORAGE_KEY);localStorage.setItem(HERO_STORAGE_KEY,payload);return true}catch(retryError){console.warn("DAWN hero persistence retry failed",retryError)}
    console.warn("DAWN hero persistence failed",error);return false
  }
}
function persist(){
  store.heroes[store.current]=S;store.scene=Scene;store.gmLibrary=normalizeGmLibrary(store.gmLibrary);store.sceneUi={zoom:sceneZoom,controlMode:sceneControlMode,interfaceVersion:sceneInterfaceVersion,panelLayout:scenePanelLayoutMode,panelSides:scenePanelSides,panelWidths:scenePanelWidths,turnStripVisible:sceneTurnStripVisible,density:sceneInterfaceDensity,layoutVersion:2,fitVersion:9,viewport:sceneViewportMode};scheduleHeroMediaPersistence();
  persistHeroStore();
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(persistableStore()))}
  catch(error){console.warn("DAWN local state persistence failed",error);if(Date.now()-lastStorageWarningAt>5000){lastStorageWarningAt=Date.now();toast(heroMediaStorageReady?"Не удалось сохранить локально; удалите лишний арт Сцены":"Переношу изображения из тесного хранилища браузера…")}}
}
let paintPersistPending=false,paintPersistTimer=null;
function persistAfterPaint(){
  if(paintPersistPending)return;
  paintPersistPending=true;
  requestAnimationFrame(()=>{paintPersistTimer=setTimeout(()=>{paintPersistPending=false;paintPersistTimer=null;persist()},0)});
}
addEventListener("pagehide",()=>{if(!paintPersistPending)return;paintPersistPending=false;if(paintPersistTimer!=null)clearTimeout(paintPersistTimer);paintPersistTimer=null;persist()});

const allGifts=()=>activeOutlooks().flatMap(o=>(o.builtin?[o.builtin]:[]).concat(o.gifts));
const giftById=id=>allGifts().find(g=>g.id===id);
const selectedGifts=()=>Logic.resolveSelectedGifts({outlooks:activeOutlooks(),selectedOutlookIds:S.outlooks,primaryOutlookId:S.primaryOutlook,selectedGiftIds:S.gifts});
const hasGift=(enOrName)=>selectedGifts().some(g=>g.en===enOrName||g.name===enOrName);
const selectedGiftNames=()=>selectedGifts().map(g=>g.en||g.name);
const outlookById=id=>activeOutlooks().find(o=>o.id===id);
const techById=id=>activeArchetypes().flatMap(a=>a.techniques).find(t=>t.id===id)||D.archetypes.flatMap(a=>a.techniques).find(t=>t.id===id);
function automationBadge(status){
  const labels={full:"Автоматизировано",attack:"Автоматизированная Атака",effect:"Автоматизированный Эффект",state:"Автоматизированное состояние",decision:"Автоматизировано с выбором",partial:"Частично автоматизировано"},label=labels[status];
  return label?`<span class="automation-badge automation-${esc(status)}" title="${esc(label)}" aria-label="${esc(label)}">${status==="partial"?"◐":"⚙"}</span>`:"";
}
function techniqueLevelAutomation(techniqueId,level){if(isLionwingEdition())return"manual";return TechniqueEngine?.techniqueCoverage(D,{[techniqueId]:Number(level)}).find(entry=>entry.techniqueId===techniqueId&&Number(entry.level)===Number(level))?.automation||"manual"}
function enemyProfileAutomation(profile){const statuses=(profile?.rules||[]).map(rule=>SceneEngine?.enemyRuleAutomation?.(rule.id)||"assisted"),automated=statuses.filter(status=>status!=="assisted").length;return automated===statuses.length&&automated?"full":automated?"partial":"assisted"}
const wordById=(id,ability=null)=>{const known=Object.values(activeAbilityWords()).flat().find(w=>w.id===id)||Object.values(D.abilityWords).flat().find(w=>w.id===id);if(known)return known;if(typeof id==="string"&&id.startsWith("custom:")){const [,group,...parts]=id.split(":"),stored=ability?.customWordCosts?.[id],variable=stored==="X",cost=variable?null:Number.isFinite(Number(stored))?clamp(stored,-1,4):0;return{id,name:decodeURIComponent(parts.join(":")),cost,costLabel:variable?"X":String(cost),marks:variable?"☾":"",group}}};
function attrValueFor(hero,key,includeConversion=true){return hero.attrs[key]+hero.attrBonus[key]+(includeConversion&&hero.conversionAttr===key?hero.techConversions:0)}
function attrValue(key,includeConversion=true){return attrValueFor(S,key,includeConversion)}
function derivedFor(hero,edition=hero.rulesEdition||"ru-v0.9"){return Logic.calculateDerivedStatistics({edition,tier:hero.tier,body:attrValueFor(hero,"body"),talent:attrValueFor(hero,"talent"),spirit:attrValueFor(hero,"spirit")})}
function derived(){return derivedFor(S)}
function sceneCombatStarted(scene=Scene){return Boolean(scene.activeActorId||Number(scene.round||1)>1||(scene.actors||[]).some(actor=>actor.kind!=="crowd"&&!String(actor.profileId||"").startsWith("enemy.modifier.")&&actor.acted))}
function ensureRuntime(){const d=derived(),health=Logic.reconcileHealthRuntime({current:S.runtime.hp,previousMax:S.runtime.maxHp,nextMax:d.hp});S.runtime.hp=health.current;S.runtime.maxHp=health.maximum;if(S.runtime.focus===null)S.runtime.focus=d.focus;if(hasGift("Trust Fund")){if(S.runtime.funding===null){S.runtime.funding=10+5*(S.tier-1);S.runtime.fundingTier=S.tier}else if(S.runtime.fundingTier<S.tier){S.runtime.funding+=5*(S.tier-S.runtime.fundingTier);S.runtime.fundingTier=S.tier}}}

function abilityCost(ability=S.ability){
  const words=Object.entries(ability.words).flatMap(([group,ids])=>ids.map(id=>{const word=wordById(id,ability);return word?{...word,group}:null})).filter(Boolean);
  return Logic.calculateAbilityCost({enabled:ability.enabled,rank:ability.rank,words,xWord:wordById(ability.xNoun,ability),specializations:ability.specializations,forceCondition:ability===S.ability&&hasGift("Uncontrollable Power")});
}
function budgets(){
  const t=S.tier,rules=activeBuilderRules(),aCost=abilityCost(),taintedCost=abilityCost(S.taintedAbility),performanceSkill=S.skills.find(s=>s.id===S.mods.performanceSkill);
  const rankAccounting=Logic.calculateCreationBudgets({tier:t,builderRules:rules,gifts:selectedGiftNames(),skillRanks:S.skills.map(s=>s.rank),performanceTargetRank:performanceSkill?.rank||0,abilityCost:aCost,taintedBodyUsed:S.mods.taintedBody,taintedAbilityCost:taintedCost,gadgetSpent:S.mods.gadgetSpent});
  const giftPool=rules?rules.boons.startingChoices+rules.boons.perTier*(t-1):t+1,activeGiftIds=new Set(allGifts().map(gift=>gift.id)),giftSpent=S.gifts.filter(id=>activeGiftIds.has(id)).length;
  const activeTechniqueIds=new Set(activeArchetypes().flatMap(archetype=>archetype.techniques.map(technique=>technique.id)));
  const techPool=(rules?rules.techniques.startingLevels+rules.techniques.levelsPerTier*(t-1):5+2*(t-1))-(rules?.techniques.levelsPerAttributeConversion||2)*S.techConversions,techSpent=Object.entries(S.techniques).filter(([id])=>activeTechniqueIds.has(id)).reduce((n,[,v])=>n+v,0);
  const archUsed=activeArchetypes().filter(a=>a.techniques.some(tech=>(S.techniques[tech.id]||0)>0)).length;
  const attrPool=(rules?.attributes.growthPerTier||2)*(t-1),attrSpent=Object.values(S.attrBonus).reduce((n,v)=>n+v,0);
  return {aCost,taintedCost,giftPool,giftSpent,techPool,techSpent,archUsed,attrPool,attrSpent,...rankAccounting};
}
function effectiveSkillRank(skill){return Math.min(3,skill.rank+(hasGift("Performance Artist")&&S.mods.performanceSkill===skill.id?1:0))}
function abilityNeedsX(ability=S.ability){return Object.values(ability.words).flat().some(id=>wordById(id,ability)?.marks.includes("☾"))}
function issues(){
  const b=budgets(),tier=S.tier,rules=activeBuilderRules(),problems=[],problem=(kind,key,params={})=>problems.push([kind,t(key,params)]); const bases=Object.values(S.attrs).sort((a,b)=>a-b).join(","),requiredBases=[...(rules?.attributes.startingValues||[4,3,2,2])].sort((a,b)=>a-b).join(",");
  if(bases!==requiredBases)problem("bad","builder.issue.attributeBases");
  if(b.attrSpent!==b.attrPool)problem("","builder.issue.attributePool",{pool:b.attrPool,spent:b.attrSpent});
  if(Object.values(S.attrBonus).some(v=>v>(rules?.attributes.sameAttributeGrowthPerTier||1)*(tier-1)))problem("bad","builder.issue.attributeGrowth");
  const highest=Math.max(...ATTRS.map(([k])=>attrValue(k,false)));if(S.techConversions&&attrValue(S.conversionAttr,false)<highest)problem("bad","builder.issue.attributeConversion");
  if(!S.primaryOutlook)problem("","builder.issue.primaryOutlook");
  const outlookLimit=Math.min(rules?.outlooks.maximum||3,(rules?.outlooks.starting||1)+tier-1);
  if(S.outlooks.length>outlookLimit)problem("bad","builder.issue.outlookLimit",{tier,limit:outlookLimit});
  if(b.giftSpent>b.giftPool)problem("bad","builder.issue.boonsOver");
  if(b.giftSpent<b.giftPool)problem("","builder.issue.boonsRemaining",{count:b.giftPool-b.giftSpent});
  if(b.skillSpent<b.skillMin)problem("bad","builder.issue.skillsMinimum",{count:b.skillMin});
  if(b.rankOver)problem("bad","builder.issue.ranksOver",{count:b.rankOver});
  if(!b.rankOver&&b.coreRankSpent<b.coreRankPool)problem("","builder.issue.ranksRemaining",{count:b.coreRankPool-b.coreRankSpent});
  if(S.skills.some(s=>!skillDisplayName(s).trim()))problem("","builder.issue.skillUnnamed");
  if(S.ability.enabled&&(!S.ability.words.verbs.length||!S.ability.words.nouns.length))problem("","builder.issue.abilityWords");
  if(hasGift("Uncontrollable Power")&&S.ability.enabled&&!S.ability.words.conditions.length)problem("bad","builder.issue.uncontrollableCondition");
  if(S.ability.enabled&&abilityNeedsX(S.ability)&&!wordById(S.ability.xNoun))problem("bad","builder.issue.abilityX");
  if(hasGift("Tainted Body")&&S.mods.taintedBody&&(!S.taintedAbility.words.verbs.length||!S.taintedAbility.words.nouns.length))problem("","builder.issue.taintedWords");
  if(hasGift("Tainted Body")&&S.mods.taintedBody&&abilityNeedsX(S.taintedAbility)&&!wordById(S.taintedAbility.xNoun))problem("bad","builder.issue.taintedX");
  if(b.taintedAbilityOver)problem("bad","builder.issue.taintedOver",{count:b.taintedAbilityOver});
  if(hasGift("Supernatural Deafness")&&S.ability.enabled)problem("bad","builder.issue.supernaturalDeafness");
  if(b.rankBudgetConflict)problem("bad","builder.issue.rankConflict");
  const performanceSkill=S.skills.find(s=>s.id===S.mods.performanceSkill);
  if(hasGift("Performance Artist")&&!performanceSkill)problem("","builder.issue.performanceTarget");
  if(hasGift("Performance Artist")&&performanceSkill?.rank>=3)problem("bad","builder.issue.performanceMaximum");
  if(b.techSpent>b.techPool)problem("bad","builder.issue.techniquesOver");
  if(b.techSpent<b.techPool)problem("","builder.issue.techniquesRemaining",{count:b.techPool-b.techSpent});
  if(b.archUsed>(activeBuilderRules()?.techniques.maximumArchetypes||3))problem("bad","builder.issue.archetypeLimit");
  return problems;
}

function budgetRow(label,spent,total,forcedOver=false){const pct=total?Math.min(100,spent/total*100):0;return `<div class="budget-row ${forcedOver||spent>total?"over":""}"><span>${esc(label)}</span><strong>${spent}/${total}</strong><span class="bar"><i style="--pct:${pct}%"></i></span></div>`}
