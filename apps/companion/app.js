"use strict";

const syncPanel=$("scene-sync-panel"),sceneRail=document.querySelector(".scene-rail");if(syncPanel&&sceneRail)sceneRail.prepend(syncPanel);
const launchParams=new URLSearchParams(location.search),invitedToken=launchParams.get("invite"),sharedRuleQuery=launchParams.get("q");if(invitedToken){store.mode="play";Scene.view="player";document.body.classList.add("invited-player");$("sync-invite-token").value=invitedToken;activeScenePanel="network"}if(sharedRuleQuery){store.mode="reference";$("ref-search").value=sharedRuleQuery.slice(0,180)}
document.documentElement.classList.toggle("light",store.theme==="light");initCollapsibleBuildPanels();setMode(store.mode||"build");renderAll();renderSync();if(importedPresetName)toast(`Создан персонаж «${importedPresetName}»`);
initializeHeroMediaStorage().catch(error=>console.warn("DAWN extended media storage unavailable",error));
if(Sync?.hasConfig())window.addEventListener("load",()=>setTimeout(()=>Sync.connect().catch(()=>renderSync()),250),{once:true});
if(location.protocol.startsWith("http")&&"serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
