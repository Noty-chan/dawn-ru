"use strict";

// Temporary presentation-only test pane. Embedded demos have an opaque sandbox
// origin: they cannot read the companion's storage or call its UI controllers.
window.DAWN_PROTOTYPE_TEST_UI = (() => {
  const demos = Object.freeze([
    { id: "tools-1", label: "Инструменты 01 · Рабочее место", path: "prototypes/tools-designs-20261006/index.html?variant=1" },
    { id: "tools-2", label: "Инструменты 02 · Строка действия", path: "prototypes/tools-designs-20261006/index.html?variant=2" },
    { id: "tools-3", label: "Инструменты 03 · Пульт группы", path: "prototypes/tools-designs-20261006/index.html?variant=3" },
    { id: "cockpit", label: "Стол · Компактный пульт действия", path: "prototypes/ux-audit-20261006/cockpit/index.html" },
    { id: "tools-flow", label: "Инструменты · Путь броска", path: "prototypes/ux-audit-20261006/tools-flow/index.html" },
    { id: "workspace", label: "Оболочка · Герой, Стол и справка", path: "prototypes/ux-audit-20261006/workspace/index.html" }
  ]);
  let root = null, select = null, frame = null, fullSize = null, status = null;
  let selected = demos[0].id, loadedUrl = null;
  const demo = () => demos.find(item => item.id === selected) || demos[0];
  const url = () => new URL(demo().path, document.baseURI).href;

  function load(reset = false) {
    if (!frame) return;
    const nextUrl = url();
    if (!reset && loadedUrl === nextUrl) return;
    loadedUrl = nextUrl;
    frame.title = `Временный черновик: ${demo().label}`;
    status.textContent = reset ? "Демо перезапускается. Его временные данные будут сброшены." : `Открывается: ${demo().label}`;
    // Reassigning src also restarts the same URL without reaching into the
    // sandbox or touching production localStorage, scene state or the network.
    frame.src = nextUrl;
  }

  function render() {
    if (!root) return false;
    select.value = selected;
    fullSize.href = url();
    fullSize.setAttribute("aria-label", `Открыть отдельно: ${demo().label}`);
    load();
    return true;
  }

  function mount(target) {
    const nextRoot = target || document.getElementById("prototype-test-root");
    if (!nextRoot || typeof nextRoot.append !== "function") return false;
    if (root === nextRoot && frame?.parentNode === root) return render();
    root = nextRoot;
    loadedUrl = null;
    root.replaceChildren();
    root.classList.add("prototype-test-pane");
    const heading = document.createElement("h1");
    heading.textContent = "Тестирование интерфейса";
    const note = document.createElement("p");
    note.className = "prototype-test-note";
    note.textContent = "Временные черновики · демонстрационные данные. Выбор героя, броски и ресурсы внутри демо не меняют ваш рабочий стол. Переключение варианта начинает отдельный пример заново.";
    const toolbar = document.createElement("div");
    toolbar.className = "prototype-test-toolbar";
    const label = document.createElement("label");
    label.className = "prototype-test-select";
    label.textContent = "Черновик ";
    select = document.createElement("select");
    select.setAttribute("aria-label", "Выбрать черновик интерфейса");
    for (const item of demos) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      select.append(option);
    }
    select.addEventListener("change", () => {
      if (!demos.some(item => item.id === select.value)) return;
      selected = select.value;
      render();
      // Keep keyboard focus on the chooser; Tab proceeds to reset/open/frame.
    });
    label.append(select);
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Перезапустить демо";
    reset.addEventListener("click", () => load(true));
    fullSize = document.createElement("a");
    fullSize.className = "prototype-test-open";
    fullSize.textContent = "Открыть отдельно ↗";
    fullSize.target = "_blank";
    fullSize.rel = "noopener noreferrer";
    toolbar.append(label, reset, fullSize);
    status = document.createElement("p");
    status.className = "prototype-test-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    frame = document.createElement("iframe");
    frame.className = "prototype-test-frame";
    frame.setAttribute("sandbox", "allow-scripts allow-forms allow-top-navigation-by-user-activation");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.addEventListener("load", () => {
      status.textContent = `${demo().label} · страница демо загружена. Можно проверять действия внутри неё.`;
    });
    const limit = document.createElement("p");
    limit.className = "prototype-test-note";
    limit.textContent = "Нужна вся ширина окна или печать? Откройте черновик в отдельной вкладке. Это макеты интерфейса; сетевые комнаты, сохранение и полноценная автоматизация правил здесь не проверяются.";
    root.append(heading, note, toolbar, status, frame, limit);
    return render();
  }

  function activate() {
    return root ? render() : mount();
  }
  return Object.freeze({ mount, activate, render });
})();

// The standalone testing page owns the root. Loading this module on any other
// page does nothing and does not register a new production store mode.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.DAWN_PROTOTYPE_TEST_UI.mount(), { once: true });
} else {
  window.DAWN_PROTOTYPE_TEST_UI.mount();
}
