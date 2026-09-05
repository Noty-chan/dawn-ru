"use strict";

const syncPanel=$("scene-sync-panel"),sceneRail=document.querySelector(".scene-rail");if(syncPanel&&sceneRail)sceneRail.prepend(syncPanel);
const launchParams=new URLSearchParams(location.search),invitedToken=launchParams.get("invite"),sharedRuleQuery=launchParams.get("q"),requestedLocale=launchParams.get("lang"),requestedEdition=launchParams.get("edition");
if(["ru","en"].includes(requestedLocale))contentPreferences.locale=requestedLocale;
if(["ru-v0.9","lionwing"].includes(requestedEdition))contentPreferences.edition=requestedEdition;
if(invitedToken){store.mode="play";Scene.view="player";document.body.classList.add("invited-player");$("sync-invite-token").value=invitedToken;activeScenePanel="network"}if(sharedRuleQuery){store.mode="reference";$("ref-search").value=sharedRuleQuery.slice(0,180)}
function syncContentUrl(){
  if(!history?.replaceState)return;
  const url=new URL(location.href);url.searchParams.set("lang",contentPreferences.locale);url.searchParams.set("edition",contentPreferences.edition);url.searchParams.set("mode",store.mode||"build");history.replaceState(null,"",`${url.pathname}?${url.searchParams}${url.hash}`);
}
function renderSupplementPicker(){
  const root=$("supplement-picker"),options=$("supplement-options"),items=Supplements?.list?.()||[],en=isEnglishPreview();
  if(!root||!options)return;
  root.hidden=!items.length;
  const compatible=items.filter(item=>Supplements.compatible(item,{edition:contentPreferences.edition,locale:contentPreferences.locale}));
  const active=new Set(S.supplementIds||[]);$("supplement-count").textContent=en?`${compatible.filter(item=>active.has(item.id)).length} enabled`:`Включено: ${compatible.filter(item=>active.has(item.id)).length}`;
  options.innerHTML=compatible.map(item=>`<label class="supplement-option"><input type="checkbox" data-supplement-id="${esc(item.id)}" ${active.has(item.id)?"checked":""}><span><strong>${esc(en?item.titleEn:item.title)}</strong><small>${esc(en?item.descriptionEn:item.description)}</small><em>${item.status==="draft"?(en?"Draft translation":"Черновой перевод"):item.status}</em></span></label>`).join("")||`<p>${en?"No localized supplements are available for this edition yet.":"Для этой редакции и языка пока нет доступных дополнений."}</p>`;
}
$("supplement-options").addEventListener("change",event=>{const id=event.target.dataset.supplementId;if(!id)return;S.supplementIds=event.target.checked?[...new Set([...(S.supplementIds||[]),id])]:(S.supplementIds||[]).filter(value=>value!==id);renderAll()});
const appSettingsDialog=$("app-settings-dialog");
function openAppSettings(){renderSupplementPicker();renderSceneLayoutSettings();if(appSettingsDialog&&!appSettingsDialog.open)appSettingsDialog.showModal()}
function closeAppSettings(){if(appSettingsDialog?.open)appSettingsDialog.close()}
document.addEventListener("click",event=>{if(event.target.closest("[data-open-app-settings]")){openAppSettings();return}if(event.target.closest("[data-close-app-settings]"))closeAppSettings()});
appSettingsDialog?.addEventListener("click",event=>{if(event.target===appSettingsDialog)closeAppSettings()});
function applyContentPreferences({render=false}={}){
  saveContentPreferences();
  if(S.rulesEdition!==contentPreferences.edition)activateHeroEdition(contentPreferences.edition);
  I18n?.setLocale(contentPreferences.locale);
  $("locale-select").value=contentPreferences.locale;
  $("edition-select").value=contentPreferences.edition;
  document.body.dataset.contentEdition=contentPreferences.edition;
  const banner=$("content-preview-banner");banner.hidden=!isLionwingEdition();if(!banner.hidden)banner.textContent=t(`preview.lionwing.${contentPreferences.locale}`);
  if(isLionwingEdition()&&sceneControlMode!=="manual")sceneControlMode="manual";
  if(typeof relocalizeSceneContent==="function")relocalizeSceneContent();
  if(!activeArchetypes().some(archetype=>archetype.id===activeArch))activeArch=activeArchetypes()[0]?.id;
  syncContentUrl();
  if(render){setMode(store.mode||"build");renderAll();persistHeroStore()}
}
$("locale-select").addEventListener("change",event=>{contentPreferences.locale=event.target.value;if(event.target.value==="en")contentPreferences.edition="lionwing";applyContentPreferences({render:true})});
$("edition-select").addEventListener("change",event=>{contentPreferences.edition=event.target.value;applyContentPreferences({render:true})});
applyContentPreferences();
document.documentElement.classList.toggle("light",store.theme==="light");initCollapsibleBuildPanels();setMode(store.mode||"build");renderAll();renderSync();if(importedPresetName)toast(`Создан персонаж «${importedPresetName}»`);
initializeHeroMediaStorage().catch(error=>console.warn("DAWN extended media storage unavailable",error));
if(Sync?.hasConfig())window.addEventListener("load",()=>setTimeout(()=>Sync.connect().catch(()=>renderSync()),250),{once:true});
if(location.protocol.startsWith("http")&&"serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});

function installBuildUpdateWatcher(){
  const banner=$("app-update-banner"),current=APP_BUILD_VERSION;if(!banner||!current||current==="dev"||current.includes("__BUILD_VERSION__"))return;
  let checking=false;
  const check=async()=>{
    if(checking||document.hidden)return;checking=true;
    try{
      const response=await fetch(`./index.html?update-check=${Date.now()}`,{cache:"no-store"});if(!response.ok)return;
      const html=await response.text(),match=html.match(/app\.js\?v=([^"'&]+)/),latest=match?.[1]||"";
      if(latest&&latest!==current)banner.hidden=false;
    }catch{}finally{checking=false}
  };
  banner.onclick=()=>location.reload();
  window.addEventListener("focus",check);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)check()});
  setTimeout(check,5000);
  setInterval(check,60000);
}
installBuildUpdateWatcher();
