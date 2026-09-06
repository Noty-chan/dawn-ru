"use strict";

const APP_BUILD_VERSION = new URL(document.currentScript?.src || location.href).searchParams.get("v") || "dev";
const I18n = window.DAWN_I18N;
const t = (key, params, fallback) => I18n?.t(key, params, { fallback }) ?? fallback ?? key;
const D = window.DAWN_DATA;
const Lionwing = window.DAWN_LIONWING_DATA;
const LionwingRu = window.DAWN_LIONWING_RU;
const LionwingTable = window.DAWN_LIONWING_TABLE_DATA;
const Supplements = window.DAWN_SUPPLEMENTS;
if (!D || D.schemaVersion !== 2) document.body.innerHTML = `<p style='padding:2rem'>${t("app.error.data")}</p>`;
const Logic = window.DAWN_LOGIC;
if (!Logic) throw new Error(t("app.error.logic"));
const SceneEngine = window.DAWN_SCENE_ENGINE;
const TechniqueEngine = window.DAWN_TECHNIQUE_ENGINE;
const NetworkV2 = window.DAWN_NETWORK_V2;
if (!SceneEngine || !TechniqueEngine) throw new Error(t("app.error.sceneEngine"));
const Sync = window.DAWN_SYNC;

const STORAGE_KEY = "dawn-ru-companion-v2";
const HERO_STORAGE_KEY = "dawn-ru-companion-heroes-v1";
const CONTENT_PREFERENCES_KEY = "dawn-companion-content-preferences-v1";
const LEGACY_KEY = "dawn-heroes";
const APP_SCHEMA = 2;
const ATTRS = [
  ["body", "Тело", "Здоровье, Стойкость и физическая мощь"],
  ["talent", "Талант", "Скорость, движение и трюки"],
  ["spirit", "Дух", "Фокус, магия и интуиция"],
  ["mind", "Разум", "Знания и утилитарные действия"],
];

function loadContentPreferences(){
  try{
    const raw=JSON.parse(localStorage.getItem(CONTENT_PREFERENCES_KEY)||"null");
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null"),fallback=saved?.scene?.actors?.length?(saved.scene.rulesEdition||"ru-v0.9"):"lionwing";
    return{locale:["ru","en"].includes(raw?.locale)?raw.locale:"ru",edition:["ru-v0.9","lionwing"].includes(raw?.edition)?raw.edition:fallback};
  }catch{return{locale:"ru",edition:"lionwing"}}
}
let contentPreferences=loadContentPreferences();
const isLionwingEdition=()=>contentPreferences.edition==="lionwing"&&Boolean(Lionwing);
const isEnglishPreview=()=>contentPreferences.locale==="en";
const activeSupplementPackages=()=>Supplements?Supplements.list().filter(item=>S?.supplementIds?.includes(item.id)&&Supplements.compatible(item,{edition:contentPreferences.edition,locale:contentPreferences.locale})):[];
const supplementItems=key=>activeSupplementPackages().flatMap(item=>item.content?.[key]||[]);
function localizedLionwingArchetypes(){
  if(contentPreferences.locale!=="ru"||!LionwingRu)return Lionwing.archetypes;
  return Lionwing.archetypes.map(archetype=>{
    const translation=LionwingRu.archetypes?.[archetype.id];
    if(!translation)return archetype;
    return{...archetype,name:translation.name||archetype.name,techniques:archetype.techniques.map(technique=>{
      const translated=translation.techniques?.[technique.id];
      if(!translated)return technique;
      return{...technique,...translated,levels:technique.levels.map(level=>({...level,...(translated.levels?.[level.n]||{})}))};
    })};
  });
}
const activeArchetypes=()=>[...(isLionwingEdition()?localizedLionwingArchetypes():D.archetypes),...supplementItems("archetypes")];
const allArchetypes=()=>Lionwing?[...D.archetypes,...Lionwing.archetypes]:D.archetypes;
function localizedLionwingOutlooks(){
  if(contentPreferences.locale!=="ru"||!LionwingRu)return Lionwing.outlooks;
  return Lionwing.outlooks.map(outlook=>{const translation=LionwingRu.outlooks?.[outlook.id];if(!translation)return outlook;return{...outlook,name:translation.name||outlook.name,description:translation.description||outlook.description,gifts:outlook.gifts.map(gift=>({...gift,...(translation.gifts?.[gift.id]||{})}))}});
}
const activeOutlooks=()=>[...(isLionwingEdition()?localizedLionwingOutlooks():D.outlooks),...supplementItems("outlooks")];
function localizedLionwingAbilityWords(){
  if(contentPreferences.locale!=="ru"||!LionwingRu?.abilityWords)return Lionwing.abilityWords;
  return Object.fromEntries(["verbs","nouns","conditions"].map(group=>[group,(Lionwing.abilityWords[group]||[]).map(word=>({...word,name:LionwingRu.abilityWords[word.id]||word.name}))]));
}
const activeAbilityWords=()=>{const base=isLionwingEdition()?localizedLionwingAbilityWords():D.abilityWords;return Object.fromEntries(["verbs","nouns","conditions"].map(group=>[group,[...(base[group]||[]),...activeSupplementPackages().flatMap(item=>item.content?.abilityWords?.[group]||[])]]))};
function localizedLionwingReference(){
  if(contentPreferences.locale!=="ru"||!LionwingRu?.reference)return Lionwing.reference;
  return Lionwing.reference.map(item=>({...item,...(LionwingRu.reference[item.id]||{})}));
}
const activeReferenceSections=()=>[...(isLionwingEdition()?localizedLionwingReference():[]),...supplementItems("reference")];
function localizedLionwingCoreRules(){
  if(contentPreferences.locale!=="ru"||!LionwingRu?.coreRules)return Lionwing.coreRules;
  const translation=LionwingRu.coreRules,effectEntries=translation.effects?.entries||{},actionEntries=translation.actions?.entries||{},ruleEntries=translation.rules?.entries||{},npcEntries=translation.npcs?.entries||{};
  return{
    ...Lionwing.coreRules,
    effects:{
      ...Lionwing.coreRules.effects,
      intro:translation.effects?.intro||Lionwing.coreRules.effects.intro,
      positive:Lionwing.coreRules.effects.positive.map(item=>({...item,...(effectEntries[item.id]||{})})),
      negative:Lionwing.coreRules.effects.negative.map(item=>({...item,...(effectEntries[item.id]||{})})),
    },
    actions:{
      ...Lionwing.coreRules.actions,
      intro:translation.actions?.intro||Lionwing.coreRules.actions.intro,
      combos:translation.actions?.combos||Lionwing.coreRules.actions.combos,
      list:Lionwing.coreRules.actions.list.map(item=>({...item,...(actionEntries[item.id]||{})})),
    },
    npcs:{list:(Lionwing.coreRules.npcs?.list||[]).map(item=>{const localized=npcEntries[item.id]||{},actions=localized.actions||{};return{...item,...localized,actions:item.actions.map(action=>({...action,...(actions[action.id]||{})})),ace:{...item.ace,...(localized.ace||{})}}})},
    rules:Lionwing.coreRules.rules.map(item=>({...item,...(ruleEntries[item.id]||{})})),
  };
}
const activeCoreRules=()=>isLionwingEdition()?localizedLionwingCoreRules():null;
function localizedLionwingBuilderRules(){
  if(contentPreferences.locale!=="ru"||!LionwingRu?.builderRules)return Lionwing.builderRules;
  const names=LionwingRu.builderRules.skills?.entries||{};
  return{...Lionwing.builderRules,skills:{...Lionwing.builderRules.skills,canonical:Lionwing.builderRules.skills.canonical.map(item=>({...item,name:names[item.id]||item.name}))}};
}
const activeBuilderRules=()=>isLionwingEdition()?localizedLionwingBuilderRules():null;
const activeCanonicalSkills=()=>activeBuilderRules()?.skills?.canonical||[];
function skillDisplayName(skill,owner=S){const canonical=owner?.rulesEdition==="lionwing"?(localizedLionwingBuilderRules()?.skills?.canonical||[]):[];return canonical.find(item=>item.id===skill.definitionId)?.name||skill.name||""}
function canonicalSkillByName(name){
  if(!isLionwingEdition())return null;
  const key=String(name||"").trim().toLocaleLowerCase(),localized=activeCanonicalSkills(),english=Lionwing.builderRules.skills?.canonical||[];
  return localized.find(item=>item.name.toLocaleLowerCase()===key)||english.find(item=>item.name.toLocaleLowerCase()===key)||null;
}
const activeAttrs=()=>isEnglishPreview()?[
  ["body","Body","Health, resilience, and physical power"],
  ["talent","Talent","Speed, movement, and stunts"],
  ["spirit","Spirit","Focus, magic, and intuition"],
  ["mind","Mind","Knowledge and utility actions"],
]:isLionwingEdition()?[
  ["body","Тело","Здоровье и физическая мощь"],
  ["talent","Талант","Скорость, движение и трюки"],
  ["spirit","Дух","Фокус, магия и интуиция"],
  ["mind","Разум","Знания и вспомогательные действия"],
]:ATTRS;
function saveContentPreferences(){localStorage.setItem(CONTENT_PREFERENCES_KEY,JSON.stringify(contentPreferences))}
