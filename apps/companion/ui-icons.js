"use strict";
// Small, local line-icon vocabulary shared by experimental controls.
window.DAWN_UI_ICONS=Object.freeze({html(name){
  const shapes={
    tokens:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    select:'<path d="m5 3 14 8-7 2-3 7z"/>',
    place:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-9 3-3 3 3 3m12-6 3 3-3 3m-9 3 3 3 3-3"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
    measure:'<path d="m3 16 13-13 5 5L8 21zM12 7l3 3m-6 0 3 3m-6 0 3 3"/>',
    areas:'<path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5m-20 5 10 5 10-5"/>',
    walls:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v6m6 0v6m-6 0v6"/>',
    markers:'<path d="M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
    edit:'<path d="m15 3 6 6-12 12H3v-6zm-3 3 6 6M3 15l6 6"/>',
    view:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
    art:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="9" r="3"/><path d="M6 19v-1a6 6 0 0 1 12 0v1"/>',
    map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16"/>',
    history:'<path d="M3 10a9 9 0 1 1 1 7M3 3v7h7m2-5v7l4 3"/>',
    undo:'<path d="m7 3-5 5 5 5M2 8h12a7 7 0 0 1 0 14"/>',
    redo:'<path d="m17 3 5 5-5 5m5-5H10a7 7 0 0 0 0 14"/>',
    sheet:'<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1zm0 0v15"/>',
    actions:'<path d="m3 3 12 12m6-12L9 15M3 21l6-6m6 0 6 6M5 13l6 6m2-14 6 6"/>',
    effects:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close:'<path d="m5 5 14 14M5 19 19 5"/>',
    dice:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01"/>',
    add:'<path d="M12 3v18M3 12h18"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="m10 2 4 0 1 4 4 1 3 3v4l-4 1-1 4-3 3h-4l-1-4-4-1-3-3v-4l4-1 1-4z"/>',
    network:'<path d="M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4"/>',
    log:'<path d="M4 5h16M4 12h16M4 19h16"/>',
    clear:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6m-6 0 6-6"/>',
    traces:'<path d="M2 9c3-10 5 10 8 0s5 10 8 0m0 7 4 4m-4 0 4-4"/>'
  };
  return `<svg class="dawn-control-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]||shapes.effects}</svg>`;
}});
