"use strict";

const syncPanel=$("scene-sync-panel"),sceneRail=document.querySelector(".scene-rail");if(syncPanel&&sceneRail)sceneRail.prepend(syncPanel);
const launchParams=new URLSearchParams(location.search),invitedToken=launchParams.get("invite"),sharedRuleQuery=launchParams.get("q");if(invitedToken){store.mode="play";Scene.view="player";document.body.classList.add("invited-player");$("sync-invite-token").value=invitedToken;activeScenePanel="network"}if(sharedRuleQuery){store.mode="reference";$("ref-search").value=sharedRuleQuery.slice(0,180)}
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
