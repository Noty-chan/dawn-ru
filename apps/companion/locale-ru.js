"use strict";

// The complete interface is currently authored in Russian. This catalogue is
// intentionally small: it establishes stable keys for shared bootstrap and
// system messages. New or edited UI text must be added here rather than adding
// a second language directly to feature code.
window.DAWN_I18N?.registerLocale("ru", {
  "app.error.data": "Не удалось загрузить данные правил. Запустите build_data.py.",
  "app.error.logic": "Не удалось загрузить модуль механики DAWN.",
  "app.error.sceneEngine": "Не удалось загрузить ядро игровой Сцены DAWN.",
  "scene.error.missingActor": "Участник не найден.",
  "scene.error.wrongTurn": "Сейчас не Ход этого участника.",
  "scene.prompt.cancel": "Отменить",
  "scene.prompt.pass": "Не использовать",
});
