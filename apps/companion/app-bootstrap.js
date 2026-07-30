"use strict";

const APP_BUILD_VERSION = new URL(document.currentScript?.src || location.href).searchParams.get("v") || "dev";
const D = window.DAWN_DATA;
if (!D || D.schemaVersion !== 2) document.body.innerHTML = "<p style='padding:2rem'>Не удалось загрузить данные правил. Запустите build_data.py.</p>";
const Logic = window.DAWN_LOGIC;
if (!Logic) throw new Error("Не удалось загрузить модуль механики DAWN.");
const SceneEngine = window.DAWN_SCENE_ENGINE;
const TechniqueEngine = window.DAWN_TECHNIQUE_ENGINE;
const NetworkV2 = window.DAWN_NETWORK_V2;
if (!SceneEngine || !TechniqueEngine) throw new Error("Не удалось загрузить ядро игровой Сцены DAWN.");
const Sync = window.DAWN_SYNC;

const STORAGE_KEY = "dawn-ru-companion-v2";
const LEGACY_KEY = "dawn-heroes";
const APP_SCHEMA = 2;
const ATTRS = [
  ["body", "Тело", "Здоровье, Стойкость и физическая мощь"],
  ["talent", "Талант", "Скорость, движение и трюки"],
  ["spirit", "Дух", "Фокус, магия и интуиция"],
  ["mind", "Разум", "Знания и утилитарные действия"],
];
