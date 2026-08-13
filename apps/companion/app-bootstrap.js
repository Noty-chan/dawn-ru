"use strict";

const APP_BUILD_VERSION = new URL(document.currentScript?.src || location.href).searchParams.get("v") || "dev";
const I18n = window.DAWN_I18N;
const t = (key, params, fallback) => I18n?.t(key, params, { fallback }) ?? fallback ?? key;
const D = window.DAWN_DATA;
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
const LEGACY_KEY = "dawn-heroes";
const APP_SCHEMA = 2;
const ATTRS = [
  ["body", "Тело", "Здоровье, Стойкость и физическая мощь"],
  ["talent", "Талант", "Скорость, движение и трюки"],
  ["spirit", "Дух", "Фокус, магия и интуиция"],
  ["mind", "Разум", "Знания и утилитарные действия"],
];
