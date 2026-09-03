"use strict";

const registerDawnSupplement = ({ id, title, titleEn, description, descriptionEn, translationPath, kind }) => window.DAWN_SUPPLEMENTS.register({
  id, title, titleEn, description, descriptionEn, status: "draft", compatibleEditions: ["lionwing"], locales: ["ru"],
  source: { collection: "patreon", translationPath, distribution: "metadata-and-reviewed-translation-only" },
  content: { reference: [{ id: `supplement.${id}.overview`, kind: `Дополнение · ${kind}`, name: title, tags: `Дополнение, ${kind}`, text: description, supplementId: id }] },
});

registerDawnSupplement({ id: "patreon.january-2026", title: "Январь 2026: сверхъестественные боевые искусства", titleEn: "January 2026: Supernatural Martial Arts", kind: "Правила и NPC", translationPath: "source/supplements/patreon/translation-ru/january-2026.ru.md", description: "Опциональное Жульничество и четыре типа NPC для историй о сверхъестественных боевых искусствах.", descriptionEn: "Optional Cheating rules and four NPC types for supernatural martial-arts stories." });
registerDawnSupplement({ id: "patreon.april-2026", title: "Апрель 2026: Боги и Галактики", titleEn: "April 2026: Gods and Galaxies", kind: "Сеттинг", translationPath: "source/supplements/patreon/translation-ru/april-2026.ru.md", description: "Космический сеттинг, Божественные, Элементы, Предзнаменования и особый способ создания персонажей.", descriptionEn: "A cosmic setting with Divines, Elements, Omens, and an alternate character-creation method." });
registerDawnSupplement({ id: "patreon.deployment-recipes", title: "Рецепты Развёртываний", titleEn: "Deployment Recipes", kind: "Дизайн", translationPath: "source/supplements/patreon/translation-ru/deployment-recipes.ru.md", description: "Авторская заметка о переработке готовых Развёртываний для Нарраторов.", descriptionEn: "Design notes about revising preset Deployments for Narrators." });
registerDawnSupplement({ id: "patreon.weapon-techniques", title: "Техники Оружия", titleEn: "Weapon Techniques", kind: "Дизайн Техник", translationPath: "source/supplements/patreon/translation-ru/weapon-techniques.ru.md", description: "Принципы новой конструкции Техник Оружия и их взаимодействия с Оружейником.", descriptionEn: "Design principles for revised Weapon Techniques and their interaction with Weaponsmith." });
