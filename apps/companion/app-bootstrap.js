"use strict";

const APP_BUILD_VERSION = new URL(document.currentScript?.src || location.href).searchParams.get("v") || "dev";
const I18n = window.DAWN_I18N;
const t = (key, params, fallback) => I18n?.t(key, params, { fallback }) ?? fallback ?? key;
const D = window.DAWN_DATA;
const Lionwing = window.DAWN_LIONWING_DATA;
const LionwingRu = window.DAWN_LIONWING_RU;
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
    return{locale:["ru","en"].includes(raw?.locale)?raw.locale:"ru",edition:["ru-v0.9","lionwing"].includes(raw?.edition)?raw.edition:"ru-v0.9"};
  }catch{return{locale:"ru",edition:"ru-v0.9"}}
}
let contentPreferences=loadContentPreferences();
const isLionwingEdition=()=>contentPreferences.edition==="lionwing"&&Boolean(Lionwing);
const isEnglishPreview=()=>contentPreferences.locale==="en";
const activeSupplementPackages=()=>Supplements?Supplements.list().filter(item=>S?.supplementIds?.includes(item.id)&&Supplements.compatible(item,{edition:contentPreferences.edition,locale:contentPreferences.locale})):[];
const supplementItems=key=>activeSupplementPackages().flatMap(item=>item.content?.[key]||[]);
const activeArchetypes=()=>[...(isLionwingEdition()?Lionwing.archetypes:D.archetypes),...supplementItems("archetypes")];
const allArchetypes=()=>Lionwing?[...D.archetypes,...Lionwing.archetypes]:D.archetypes;
function localizedLionwingOutlooks(){
  if(contentPreferences.locale!=="ru"||!LionwingRu)return Lionwing.outlooks;
  return Lionwing.outlooks.map(outlook=>{const translation=LionwingRu.outlooks?.[outlook.id];if(!translation)return outlook;return{...outlook,name:translation.name||outlook.name,description:translation.description||outlook.description,gifts:outlook.gifts.map(gift=>({...gift,...(translation.gifts?.[gift.id]||{})}))}});
}
const activeOutlooks=()=>[...(isLionwingEdition()?localizedLionwingOutlooks():D.outlooks),...supplementItems("outlooks")];
const activeAbilityWords=()=>{const base=isLionwingEdition()?Lionwing.abilityWords:D.abilityWords;return Object.fromEntries(["verbs","nouns","conditions"].map(group=>[group,[...(base[group]||[]),...activeSupplementPackages().flatMap(item=>item.content?.abilityWords?.[group]||[])]]))};
const activeReferenceSections=()=>[...(isLionwingEdition()?Lionwing.reference:[]),...supplementItems("reference")];
const activeBuilderRules=()=>isLionwingEdition()?Lionwing.builderRules:null;
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
