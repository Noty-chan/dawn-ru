"use strict";

(() => {
  const packages = new Map();
  const cleanList = value => Array.isArray(value) ? [...new Set(value.filter(item => typeof item === "string" && item.trim()))] : [];
  const cleanContent = content => ({
    archetypes: Array.isArray(content?.archetypes) ? content.archetypes : [],
    outlooks: Array.isArray(content?.outlooks) ? content.outlooks : [],
    reference: Array.isArray(content?.reference) ? content.reference : [],
    abilityWords: Object.fromEntries(["verbs", "nouns", "conditions"].map(group => [group, Array.isArray(content?.abilityWords?.[group]) ? content.abilityWords[group] : []])),
  });
  function register(raw) {
    if (!raw || typeof raw !== "object" || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(raw.id || "")) throw new Error("Supplement id must be a stable dotted id.");
    if (packages.has(raw.id)) throw new Error(`Duplicate supplement id: ${raw.id}`);
    const item = Object.freeze({
      id: raw.id,
      title: String(raw.title || raw.id),
      titleEn: String(raw.titleEn || raw.title || raw.id),
      description: String(raw.description || ""),
      descriptionEn: String(raw.descriptionEn || raw.description || ""),
      status: ["draft", "review", "published"].includes(raw.status) ? raw.status : "draft",
      compatibleEditions: cleanList(raw.compatibleEditions),
      locales: cleanList(raw.locales),
      source: raw.source && typeof raw.source === "object" ? Object.freeze({ ...raw.source }) : Object.freeze({}),
      content: Object.freeze(cleanContent(raw.content)),
    });
    packages.set(item.id, item);
    return item;
  }
  const compatible = (item, { edition, locale }) => item.compatibleEditions.includes(edition) && item.locales.includes(locale);
  window.DAWN_SUPPLEMENTS = Object.freeze({ register, list: () => [...packages.values()], compatible });
})();
