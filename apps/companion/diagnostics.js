"use strict";

// Compact, local-first diagnostics for alpha reports. Nothing is sent
// automatically: the tester reviews and explicitly copies/downloads it.
(() => {
  const STORAGE_KEY="dawn-alpha-diagnostics-v1",MAX_ROWS=500,MAX_AGE=6*60*60*1000;
  const now=()=>new Date().toISOString(),copy=value=>{try{return JSON.parse(JSON.stringify(value))}catch{return String(value)}};
  const scrub=value=>{
    if(value==null||typeof value==="boolean"||typeof value==="number")return value;
    if(typeof value==="string")return value.startsWith("data:image/")?`[image ${value.length} chars]`:value.slice(0,800);
    if(Array.isArray(value))return value.slice(0,40).map(scrub);
    if(typeof value!=="object")return String(value);
    const result={};for(const [key,item] of Object.entries(value)){
      if(/key|token|secret|password|authorization|portraitImage|tokenImage/i.test(key)){result[key]="[redacted]";continue}
      result[key]=scrub(item);
    }return result;
  };
  let rows=[];
  try{const saved=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||"[]"),cutoff=Date.now()-MAX_AGE;rows=Array.isArray(saved)?saved.filter(row=>Date.parse(row.at)>=cutoff).slice(-MAX_ROWS):[]}catch{}
  const persistRows=()=>{try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(rows.slice(-MAX_ROWS)))}catch{}};
  function record(kind,summary,details={}){rows.push({at:now(),kind:String(kind).slice(0,60),summary:String(summary||kind).slice(0,300),details:scrub(details)});rows=rows.slice(-MAX_ROWS);persistRows()}
  function targetDescription(target){
    const element=target?.closest?.("button,a,input,select,textarea,summary,[data-mode],[data-enemy-rule],[data-action]");if(!element)return null;
    const dataset=Object.fromEntries(Object.entries(element.dataset||{}).filter(([key])=>/^(mode|action|enemyRule|scenePanel|openScenePanel|heroView|tech|level)/i.test(key)).slice(0,8));
    return{tag:element.tagName?.toLowerCase(),id:element.id||null,type:element.type||null,label:(element.getAttribute?.("aria-label")||element.title||element.textContent||"").replace(/\s+/g," ").trim().slice(0,120),dataset};
  }
  document.addEventListener("click",event=>{const target=targetDescription(event.target);if(target)record("ui.click",target.label||target.id||target.tag,target)},{capture:true});
  document.addEventListener("change",event=>{const target=targetDescription(event.target);if(!target)return;record("ui.change",target.label||target.id||target.tag,{...target,checked:event.target.type==="checkbox"?Boolean(event.target.checked):undefined,selected:event.target.tagName==="SELECT"?String(event.target.value).slice(0,120):undefined})},{capture:true});
  document.addEventListener("submit",event=>record("ui.submit",event.target?.id||event.target?.className||"form"),{capture:true});
  addEventListener("error",event=>record("runtime.error",event.message||"Unhandled error",{file:event.filename?.split("/").pop(),line:event.lineno,column:event.colno,stack:event.error?.stack}));
  addEventListener("unhandledrejection",event=>record("runtime.rejection",event.reason?.message||String(event.reason||"Unhandled rejection"),{stack:event.reason?.stack}));
  const originalWarn=console.warn.bind(console),originalError=console.error.bind(console);
  console.warn=(...args)=>{record("console.warn",args.map(String).join(" "),args);return originalWarn(...args)};
  console.error=(...args)=>{record("console.error",args.map(String).join(" "),args);return originalError(...args)};
  if(typeof commitSceneEvents==="function"){
    const original=commitSceneEvents;commitSceneEvents=function(label,events){record("scene.commit",label,{round:Scene?.round,version:Scene?.version,eventTypes:(events||[]).map(event=>event.type),actorIds:[...new Set((events||[]).map(event=>event.actorId).filter(Boolean))]});try{const result=original(label,events);record(result?"scene.commit.ok":"scene.commit.rejected",label,{version:Scene?.version});return result}catch(error){record("scene.commit.error",label,{message:error.message,stack:error.stack});throw error}};
  }
  if(typeof commitScene==="function"){
    const original=commitScene;commitScene=function(label,mutator){record("scene.manual",label,{round:Scene?.round,version:Scene?.version});try{const result=original(label,mutator);record(result?"scene.manual.ok":"scene.manual.rejected",label,{version:Scene?.version});return result}catch(error){record("scene.manual.error",label,{message:error.message,stack:error.stack});throw error}};
  }
  if(typeof toast==="function"){
    const original=toast;toast=function(message){record("ui.notice",message);return original(message)};
  }
  function recentSceneLog(){
    const log=Array.isArray(Scene?.log)?Scene.log:[],starts=[];log.forEach((event,index)=>{if(event?.type==="round.start")starts.push(index)});
    const end=starts.length>=3?starts[2]+1:Math.min(log.length,220);
    return log.slice(0,end).map(event=>({at:event.at,type:event.type,actorId:event.actorId||null,text:event.text||null,payload:scrub(event.payload||{})}));
  }
  function sceneSummary(){
    if(typeof Scene!=="object"||!Scene)return null;
    return{schema:Scene.schema,rulesEdition:Scene.rulesEdition,version:Scene.version,round:Scene.round,turnSerial:Scene.turnSerial,activeActorId:Scene.activeActorId||null,tension:Scene.tension,controlMode:typeof sceneControlMode==="string"?sceneControlMode:null,pending:{action:Boolean(Scene.pendingAction),plan:Boolean(Scene.pendingActionPlan),prompt:Boolean(Scene.pendingPrompt),triggers:Number(Scene.triggerQueue?.length||0)},actors:(Scene.actors||[]).map(actor=>({id:actor.id,name:actor.name,kind:actor.kind,team:actor.team,profileId:actor.profileId||null,hp:actor.hp,maxHp:actor.maxHp,ap:actor.ap,focus:actor.focus,stress:actor.stress,influence:actor.influence,armor:actor.armor,evasion:actor.evasion,effects:actor.effects,space:actor.space,x:actor.x,y:actor.y,acted:actor.acted,knockedOut:actor.knockedOut})),spaces:(Scene.spaces||[]).map(space=>({id:space.id,name:space.name,width:space.width,height:space.height})),counts:{objects:Scene.objects?.length||0,markers:Scene.markers?.length||0,walls:Scene.walls?.length||0,entities:Object.keys(Scene.entities||{}).length}};
  }
  function heroSummary(){
    if(typeof S!=="object"||!S)return null;
    return{id:S.id,name:S.profile?.name||S.name||"",tier:S.tier,edition:contentPreferences?.edition,build:{attributes:S.attributes,outlooks:S.outlooks,primaryOutlook:S.primaryOutlook,gifts:S.gifts,techniques:S.techniques,skills:(S.skills||[]).map(skill=>({id:skill.id||skill.name,rank:skill.rank}))},runtime:scrub(S.runtime)};
  }
  function reportData(description="",steps="",includeState=true){
    const navigation=performance.getEntriesByType?.("navigation")?.[0];
    return{reportSchema:1,createdAt:now(),description:String(description).trim(),steps:String(steps).trim(),environment:{url:`${location.origin}${location.pathname}${location.search}`,locale:document.documentElement.lang,edition:contentPreferences?.edition,mode:store?.mode,viewport:`${innerWidth}x${innerHeight}`,userAgent:navigator.userAgent,online:navigator.onLine,loadType:navigation?.type||null},diagnostics:copy(rows.slice(-350)),...(includeState?{hero:heroSummary(),scene:sceneSummary(),sceneLog:recentSceneLog()}: {})};
  }
  const text={ru:{button:"Баг-репорт",eyebrow:"АЛЬФА-ТЕСТ",title:"Сообщить о проблеме",help:"Опишите, что пошло не так. Компаньон приложит существенные действия этой вкладки и события последних трёх Раундов. Ничего не отправляется автоматически.",description:"Что произошло?",descriptionPlaceholder:"Ожидаемое и фактическое поведение…",steps:"Как это повторить?",stepsPlaceholder:"1. Открыл… 2. Нажал… 3. Получил…",include:"Приложить состояние героя, стола и журнал последних Раундов. Изображения и ключи доступа исключаются.",preview:"Просмотреть технический отчёт",discord:"Скопируйте или скачайте отчёт и отправьте его в Discord: akasha6664",copy:"Скопировать отчёт",download:"Скачать .txt",copied:"Отчёт скопирован. Отправьте его в Discord: akasha6664",failed:"Не удалось скопировать автоматически — скачайте файл."},en:{button:"Bug report",eyebrow:"ALPHA TEST",title:"Report a problem",help:"Describe what went wrong. The Companion will attach meaningful actions from this tab and events from the last three Rounds. Nothing is sent automatically.",description:"What happened?",descriptionPlaceholder:"Expected and actual behavior…",steps:"How can we reproduce it?",stepsPlaceholder:"1. Opened… 2. Clicked… 3. Saw…",include:"Include the Hero and table state plus the latest Round log. Images and access keys are excluded.",preview:"Preview technical report",discord:"Copy or download the report and send it on Discord to: akasha6664",copy:"Copy report",download:"Download .txt",copied:"Report copied. Send it on Discord to: akasha6664",failed:"Automatic copy failed — please download the file."}};
  const locale=()=>document.documentElement.lang?.startsWith("en")?"en":"ru",el=id=>document.getElementById(id);
  function reportText(){const data=reportData(el("bug-report-description")?.value,el("bug-report-steps")?.value,el("bug-report-include-state")?.checked!==false);return`DAWN Companion alpha bug report\nDiscord: akasha6664\n\n${JSON.stringify(data,null,2)}`}
  function refreshPreview(){const preview=el("bug-report-preview");if(preview)preview.textContent=reportText()}
  function localize(){const l=text[locale()];el("bug-report-open").textContent=l.button;el("bug-report-eyebrow").textContent=l.eyebrow;el("bug-report-title").textContent=l.title;el("bug-report-help").textContent=l.help;el("bug-report-description-label").textContent=l.description;el("bug-report-description").placeholder=l.descriptionPlaceholder;el("bug-report-steps-label").textContent=l.steps;el("bug-report-steps").placeholder=l.stepsPlaceholder;el("bug-report-include-state-label").textContent=l.include;el("bug-report-preview-label").textContent=l.preview;el("bug-report-discord").textContent=l.discord;el("bug-report-copy").textContent=l.copy;el("bug-report-download").textContent=l.download;el("bug-report-close").setAttribute("aria-label",locale()==="en"?"Close":"Закрыть")}
  const dialog=el("bug-report-dialog");
  el("bug-report-open")?.addEventListener("click",()=>{localize();record("report.open","Bug report opened",{rows:rows.length,round:Scene?.round});refreshPreview();if(!dialog.open)dialog.showModal()});
  ["bug-report-description","bug-report-steps","bug-report-include-state"].forEach(id=>el(id)?.addEventListener("input",refreshPreview));
  el("bug-report-copy")?.addEventListener("click",async()=>{const l=text[locale()],value=reportText();try{await navigator.clipboard.writeText(value);record("report.copy","Bug report copied",{length:value.length});toast(l.copied)}catch{record("report.copy.error","Clipboard rejected");toast(l.failed)}});
  el("bug-report-download")?.addEventListener("click",()=>{const value=reportText(),blob=new Blob([value],{type:"text/plain;charset=utf-8"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`dawn-companion-bug-${new Date().toISOString().replace(/[:.]/g,"-")}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);record("report.download","Bug report downloaded",{length:value.length})});
  addEventListener("dawn:locale-change",localize);localize();record("session.start","Companion diagnostics started",{locale:locale(),path:location.pathname,mode:store?.mode,edition:contentPreferences?.edition});
  window.DAWN_DIAGNOSTICS=Object.freeze({record,rows:()=>copy(rows),report:reportData,clear:()=>{rows=[];persistRows()}});
})();
