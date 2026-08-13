"use strict";

// Runtime localization boundary. Rules and saved scenes keep stable semantic ids;
// only presentation resolves those ids into the active language.
(() => {
  const DEFAULT_LOCALE = "ru";
  const catalogs = new Map();
  let activeLocale = DEFAULT_LOCALE;

  const normalizeLocale = value => String(value || DEFAULT_LOCALE).trim().toLowerCase().split("-")[0] || DEFAULT_LOCALE;
  const interpolate = (template, params = {}) => String(template).replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match);
  const catalogue = locale => catalogs.get(normalizeLocale(locale)) || null;

  function registerLocale(locale, messages = {}) {
    const key = normalizeLocale(locale);
    if (!messages || typeof messages !== "object" || Array.isArray(messages)) throw new Error("Locale messages must be an object.");
    catalogs.set(key, Object.freeze({ ...(catalogs.get(key) || {}), ...messages }));
    return key;
  }

  function translate(key, params = {}, options = {}) {
    const messageKey = String(key || "");
    const requested = normalizeLocale(options.locale || activeLocale);
    const message = catalogue(requested)?.[messageKey] ?? catalogue(DEFAULT_LOCALE)?.[messageKey];
    if (message == null) return options.fallback != null ? interpolate(options.fallback, params) : messageKey;
    return interpolate(message, params);
  }

  function localizedField(entity, field, options = {}) {
    if (!entity || typeof entity !== "object") return options.fallback ?? "";
    const requested = normalizeLocale(options.locale || activeLocale);
    const value = entity.i18n?.[requested]?.[field] ?? entity.i18n?.[DEFAULT_LOCALE]?.[field] ?? entity[field];
    return value ?? options.fallback ?? "";
  }

  function localizeEvent(event, options = {}) {
    const payload = event?.payload || {};
    if (!payload.messageKey) return payload.message || payload.text || payload.name || event?.type || "";
    return translate(payload.messageKey, payload.messageArgs || {}, { ...options, fallback: payload.messageFallback || payload.message || payload.text || payload.name });
  }

  function setLocale(locale) {
    const next = normalizeLocale(locale);
    if (!catalogs.has(next)) return false;
    activeLocale = next;
    if (typeof document === "object") document.documentElement.lang = next;
    if (typeof window === "object" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") window.dispatchEvent(new CustomEvent("dawn:locale-change", { detail: { locale: next } }));
    return true;
  }

  const api = Object.freeze({
    DEFAULT_LOCALE,
    registerLocale,
    t: translate,
    field: localizedField,
    eventText: localizeEvent,
    setLocale,
    getLocale: () => activeLocale,
    availableLocales: () => [...catalogs.keys()],
    hasLocale: locale => catalogs.has(normalizeLocale(locale)),
  });
  (typeof window === "object" ? window : globalThis).DAWN_I18N = api;
})();
