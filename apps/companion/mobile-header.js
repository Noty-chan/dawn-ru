"use strict";

// Mobile navigation owns only DOM placement and reading chrome, never game state.
window.DAWN_MOBILE_HEADER = (() => {
  let controller = null;
  function init() {
    if (controller) return controller;
    const header = document.querySelector(".topbar");
    const navigation = document.getElementById("workspace-navigation");
    const sections = document.getElementById("mobile-header-sections");
    const panel = document.getElementById("mobile-header-sections-panel");
    const more = document.getElementById("mobile-header-more");
    const actions = document.getElementById("topbar-actions");
    const controls = document.getElementById("mobile-header-controls");
    if (!header || !navigation || !sections || !panel || !more || !actions || !controls || typeof window.matchMedia !== "function") return null;

    const home = document.createComment("Workspace navigation returns here on desktop");
    navigation.before(home);
    const media = window.matchMedia("(max-width: 720px)");
    const style = document.documentElement.style;
    let mobile = false, height = 0, lastY = 0, direction = 0, distance = 0;
    let scrollFrame = null, navigationTimer = null, navigationPending = false, keyboard = false;
    let view = document.body.dataset.workspaceView;
    const scrollY = () => {
      const max = Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight);
      return Math.min(max, Math.max(0, Number(window.scrollY) || 0));
    };
    const resetDirection = () => { lastY = scrollY(); direction = 0; distance = 0; };
    const expanded = button => button.getAttribute("aria-expanded") === "true";
    const visible = show => {
      header.classList.toggle("mobile-header-hidden", mobile && !show);
      if (mobile) style.setProperty("--mobile-header-visible-height", `${show ? height : 0}px`);
    };
    const measure = () => {
      if (!mobile) return;
      height = Math.ceil(header.getBoundingClientRect().height);
      style.setProperty("--mobile-header-height", `${height}px`);
      style.setProperty("--mobile-header-visible-height", `${header.classList.contains("mobile-header-hidden") ? 0 : height}px`);
    };
    function closeMenus(returnFocus = false) {
      const opener = expanded(sections) ? sections : expanded(more) ? more : null;
      sections.setAttribute("aria-expanded", "false");
      more.setAttribute("aria-expanded", "false");
      panel.hidden = true;
      actions.classList.remove("mobile-header-actions-open");
      if (opener && returnFocus) opener.focus({ preventScroll: true });
    }
    function resumeAfterQuiet() {
      if (navigationTimer !== null) clearTimeout(navigationTimer);
      navigationTimer = setTimeout(() => {
        navigationTimer = null; navigationPending = false; resetDirection();
      }, 140);
    }
    function prepareNavigation() {
      if (!mobile) return;
      closeMenus(); visible(true); resetDirection();
      navigationPending = true; resumeAfterQuiet();
    }
    const locked = () => expanded(sections) || expanded(more) || Boolean(document.querySelector("dialog[open]")) || (keyboard && header.contains(document.activeElement));
    function processScroll() {
      scrollFrame = null;
      if (!mobile) return;
      const y = scrollY(), delta = y - lastY;
      lastY = y;
      if (navigationPending) { resumeAfterQuiet(); direction = 0; distance = 0; visible(true); return; }
      if (y <= height || locked()) { direction = 0; distance = 0; visible(true); return; }
      if (!delta) return;
      const nextDirection = Math.sign(delta);
      distance = nextDirection === direction ? distance + Math.abs(delta) : Math.abs(delta);
      direction = nextDirection;
      if (direction > 0 && distance >= 24) { visible(false); distance = 0; }
      if (direction < 0 && distance >= 12) { visible(true); distance = 0; }
    }
    function onScroll(event) {
      // Pan gestures and scrolls inside the table or a dialog never hide the shell.
      if (event.target && event.target !== document && event.target !== window) return;
      if (scrollFrame === null) scrollFrame = requestAnimationFrame(processScroll);
    }
    function refresh() {
      sections.hidden = !mobile || navigation.hidden;
      if (sections.hidden && expanded(sections)) closeMenus();
      if (view !== document.body.dataset.workspaceView) {
        view = document.body.dataset.workspaceView; prepareNavigation();
      }
      measure();
    }
    function breakpoint() {
      const focused = document.activeElement;
      const navigationFocus = navigation.contains(focused), actionsFocus = actions.contains(focused), controlsFocus = controls.contains(focused);
      mobile = media.matches;
      closeMenus();
      if (navigationTimer !== null) clearTimeout(navigationTimer);
      navigationTimer = null; navigationPending = false;
      document.body.classList.toggle("mobile-header-active", mobile);
      controls.hidden = !mobile;
      if (mobile) panel.append(navigation); else home.after(navigation);
      visible(true); resetDirection(); refresh();
      if (!mobile) { style.removeProperty("--mobile-header-height"); style.removeProperty("--mobile-header-visible-height"); }
      // Moving DOM can reset focus to body; capture ownership before closing or moving it.
      if (mobile && navigationFocus) sections.focus({ preventScroll: true });
      else if (mobile && actionsFocus) more.focus({ preventScroll: true });
      else if (!mobile && controlsFocus) header.querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
      else if (!mobile && (navigationFocus || actionsFocus)) focused.focus({ preventScroll: true });
    }
    function toggle(button) {
      const open = !expanded(button);
      closeMenus(); visible(true); resetDirection();
      if (!open) return;
      button.setAttribute("aria-expanded", "true");
      if (button === sections) panel.hidden = false; else actions.classList.add("mobile-header-actions-open");
    }
    sections.addEventListener("click", () => toggle(sections));
    more.addEventListener("click", () => toggle(more));
    document.addEventListener("pointerdown", event => {
      keyboard = false;
      if (mobile && !header.contains(event.target)) closeMenus();
    }, { passive: true });
    document.addEventListener("keydown", event => {
      keyboard = true;
      if (mobile && event.key === "Escape" && (expanded(sections) || expanded(more))) {
        event.preventDefault(); closeMenus(true); visible(true); resetDirection();
      }
    });
    header.addEventListener("focusin", () => { if (mobile) { visible(true); resetDirection(); } });
    document.addEventListener("click", event => {
      if (!mobile || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.("[data-workspace-anchor],#rules-index a");
      if (anchor && panel.contains(anchor)) prepareNavigation();
      const action = event.target.closest?.("button,a");
      if (action && actions.contains(action)) { closeMenus(); visible(true); }
    }, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { measure(); resetDirection(); });
    media.addEventListener("change", breakpoint);
    if (typeof ResizeObserver === "function") new ResizeObserver(measure).observe(header);
    controller = Object.freeze({ refresh, prepareNavigation });
    breakpoint();
    return controller;
  }
  return Object.freeze({ init, refresh: () => controller?.refresh(), prepareNavigation: () => controller?.prepareNavigation() });
})();
