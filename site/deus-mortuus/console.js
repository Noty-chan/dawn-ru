(function runDeusMortuus() {
  "use strict";

  const M = window.DM_MODEL;
  const Net = window.DM_NETWORK;
  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = M.clamp;
  const percent = value => `${Math.round(clamp(value))}%`;
  const signed = value => `${Number(value) >= 0 ? "+" : ""}${Math.round(Number(value) * 100)}%`;
  const stationNames = { driver: "Машинист", engineer: "Инженер", warden: "Страж состава", roaming: "Вне поста", gm: "Управляющий пункт" };
  const phaseNames = { moving: "ДВИЖЕНИЕ", encounter: "ОКНО ВНИМАНИЯ", station: "СТАНЦИЯ" };
  const pathStations = { driver: "driver", engineer: "engineer", security: "warden", attention: "any", alarm: "any" };
  let state = M.createInitialState();
  let net = Net.state();
  let players = [];
  let attentionRequests = new Set();
  let active = false;
  let lastFrame = performance.now();
  let lastSimulationTick = Date.now();
  let lastRender = 0;
  let lastBroadcast = 0;
  let lastAlertId = "";
  let renderQueued = false;
  let toastTimer = null;
  let pendingControls = new Map();
  let playersRenderKey = "";
  let currentAlert = null;
  let attentionCooldownUntil = 0;
  let targetStructureKey = "";
  let securityStructureReady = false;
  let gmFailureRenderKey = "";
  const feedbackTimers = new WeakMap();

  class CabAudio {
    constructor() { this.enabled = false; this.ctx = null; this.master = null; this.rumble = null; this.rumbleGain = null; this.lastChuff = 0; }
    async toggle(force) {
      this.enabled = force ?? !this.enabled;
      if (this.enabled && !this.ctx) this.start();
      if (this.ctx?.state === "suspended") await this.ctx.resume();
      if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.22 : 0, this.ctx.currentTime, 0.08);
      return this.enabled;
    }
    start() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.rumble = this.ctx.createOscillator();
      this.rumble.type = "sawtooth";
      this.rumbleGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 90;
      this.rumble.frequency.value = 28;
      this.rumbleGain.gain.value = 0.12;
      this.rumble.connect(filter).connect(this.rumbleGain).connect(this.master);
      this.rumble.start();
    }
    update(current) {
      if (!this.enabled || !this.ctx) return;
      const speed = current.driver.speed;
      this.rumble.frequency.setTargetAtTime(25 + speed * 0.18, this.ctx.currentTime, 0.12);
      this.rumbleGain.gain.setTargetAtTime(0.035 + speed / 850, this.ctx.currentTime, 0.12);
      const interval = clamp(1300 - speed * 9, 210, 1500);
      if (performance.now() - this.lastChuff > interval && speed > 2) { this.lastChuff = performance.now(); this.noise(0.045, 0.08 + speed / 1400, 110); }
    }
    tone(frequency, duration = 0.12, gain = 0.14, type = "square") {
      if (!this.enabled || !this.ctx) return;
      const oscillator = this.ctx.createOscillator();
      const volume = this.ctx.createGain();
      oscillator.type = type; oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(gain, this.ctx.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      oscillator.connect(volume).connect(this.master); oscillator.start(); oscillator.stop(this.ctx.currentTime + duration);
    }
    noise(duration = 0.08, gain = 0.12, cutoff = 700) {
      if (!this.enabled || !this.ctx) return;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
      const source = this.ctx.createBufferSource(); source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = cutoff;
      const volume = this.ctx.createGain(); volume.gain.value = gain;
      source.connect(filter).connect(volume).connect(this.master); source.start();
    }
    cue(kind) {
      if (kind === "alert") { this.tone(340, .15, .17); setTimeout(() => this.tone(260, .22, .18), 170); }
      if (kind === "fire") { this.noise(.22, .55, 420); this.tone(58, .28, .35, "sawtooth"); }
      if (kind === "hit") this.tone(560, .08, .12, "triangle");
      if (kind === "miss") this.tone(150, .12, .1, "triangle");
      if (kind === "valve") this.noise(.18, .12, 1300);
      if (kind === "button") this.tone(95, .035, .06, "square");
      if (kind === "god") { this.tone(41, 1.3, .16, "sawtooth"); this.tone(63, 1.1, .08, "sine"); }
    }
  }
  const audio = new CabAudio();

  function toast(text, bad = false) {
    const node = $("toast");
    node.textContent = text;
    node.classList.toggle("bad", bad);
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 2500);
  }

  function setBar(id, value) { const node = $(id); if (node) node.style.width = `${clamp(value)}%`; }
  function setText(id, text) { const node = $(id); if (node) node.textContent = text; }
  function setDial(id, value, max = 100) { const node = $(id); if (node) node.style.setProperty("--needle", `${-112 + clamp(value, 0, max) / max * 224}deg`); }
  function displayed(path) { return M.displayed(state, path); }
  function stationForAction(type) { return pathStations[String(type).split(".")[0]] || "gm"; }

  function confirmAction(title, text) {
    return new Promise(resolve => {
      const dialog = $("confirm-dialog");
      setText("confirm-title", title); setText("confirm-text", text);
      const handler = () => { dialog.removeEventListener("close", handler); resolve(dialog.returnValue === "confirm"); };
      dialog.addEventListener("close", handler); dialog.showModal();
    });
  }

  function apply(action, remote = false) {
    if (!action.actor) action.actor = net.characterName;
    const result = M.applyAction(state, action);
    if (result?.text) toast(result.text, result.ok === false);
    if (action.type === "security.fire") audio.cue(result?.hit ? "hit" : "miss");
    if (action.type.includes("vent") || action.type.includes("overdrive")) audio.cue("valve");
    if (action.type === "gm.targets" || action.type === "gm.failure") audio.cue("alert");
    if (net.role === "gm") void Net.sendState(state, true);
    if (action.type === "attention" || action.type === "alarm" || action.type === "gm.dismissAlert") renderAll();
    else queueRender();
    return result;
  }

  function send(action, immediate = false) {
    if (net.role === "gm") return apply(action);
    if (!net.roomId) return null;
    if (immediate) void Net.sendAction(action).catch(error => toast(error.message, true));
    else {
      const key = `${action.type}:${action.circuit || action.index || ""}`;
      clearTimeout(pendingControls.get(key));
      pendingControls.set(key, setTimeout(() => {
        pendingControls.delete(key);
        void Net.sendAction(action).catch(error => toast(error.message, true));
      }, 90));
    }
    return null;
  }

  function allowedRemote(message) {
    const action = message.action || {};
    const needed = stationForAction(action.type);
    if (needed === "any") return true;
    const member = players.find(item => item.user_id === message.actorId);
    const assigned = member?.station || message.station;
    return needed === assigned;
  }

  Net.on("status", next => { net = next; renderConnection(); renderPanels(); });
  Net.on("state", incoming => { if (net.role !== "gm") { state = M.normalize(incoming); active = true; showGame(); queueRender(); } });
  Net.on("action", message => {
    if (net.role !== "gm" || !message.action) return;
    if (!allowedRemote(message)) { toast(`${message.actor || "Игрок"}: команда отклонена — персонаж не у этого поста`, true); return; }
    if (message.action.type === "attention") attentionRequests.add(message.actorId);
    message.action.actor = message.actor;
    message.action.actorId = message.actorId;
    const result = apply(message.action, true);
    if (result?.text) void Net.sendResult(message.actorId, message.action.type, result);
  });
  Net.on("players", next => {
    players = next;
    const self = players.find(item => item.user_id === net.userId);
    if (self && self.station !== net.station) net = { ...net, station: self.station };
    renderPanels(); renderPlayers(); renderWaiting();
  });
  Net.on("notice", message => toast(message.text));
  Net.on("result", message => {
    const result = message.result || {};
    if (result.text) toast(result.text, result.ok === false);
    if (message.actionType === "security.fire") {
      audio.cue(result.hit ? "hit" : "miss");
      pulseElement($("fire-button"), result.hit ? "feedback-good" : "feedback-bad", 480);
    }
    if (message.actionType === "security.shackleSync") pulseElement($("anchor-dials"), result.score > .3 ? "sync-good" : "sync-bad", 750);
  });

  function lobbyStatus() {
    const cloud = Net.hasCloudConfig();
    const box = $("lobby-status-text");
    const wrap = box.closest(".lobby-status");
    wrap.className = `lobby-status ${cloud ? "online" : ""}`;
    box.textContent = cloud ? "Облачная эфирная линия готова" : "Локальный испытательный контур — между устройствами нужен Supabase";
  }

  async function enter(task) {
    $("lobby-error").textContent = "";
    try {
      const result = await task();
      if (!result) throw new Error("Сохранённый рейс больше не существует");
      if (result?.state) state = M.normalize(result.state);
      if (result?.players) players = result.players;
      net = Net.state(); active = true; showGame(); renderAll();
    } catch (error) {
      $("lobby-error").textContent = error?.message || String(error);
    }
  }

  function showGame() { $("lobby").hidden = true; $("game").hidden = false; renderPanels(); renderConnection(); }
  function showLobby() { $("game").hidden = true; $("lobby").hidden = false; active = false; }

  function renderConnection() {
    const connection = net.connection;
    const node = $("connection-label")?.parentElement;
    if (!node) return;
    node.className = `connection-line ${connection === "online" || connection === "local" ? "online" : connection === "error" ? "error" : ""}`;
    setText("connection-label", net.mode === "cloud" ? (connection === "online" ? "Эфирная линия синхронизирована" : "Эфирная линия: " + connection) : "Локальный испытательный контур");
  }

  function renderPanels() {
    if (!active) return;
    const role = net.role;
    const station = role === "gm" ? "gm" : net.station;
    for (const id of ["waiting", "driver", "engineer", "warden", "gm"]) $(`${id}-panel`).hidden = id !== (station || "waiting") && !(station === "roaming" && id === "waiting");
    setText("operator-name", net.characterName || "—");
    setText("operator-role", role === "gm" ? "ГМ · УПРАВЛЕНИЕ" : station ? stationNames[station] : "ЭКИПАЖ · ОЖИДАНИЕ");
    setText("room-code", net.code || "——"); setText("gm-room-code", net.code || "——");
    $("attention-button").hidden = role === "gm";
    $("alarm-button").hidden = role === "gm";
    $("gm-reference-link").hidden = role !== "gm";
  }

  function renderHeader() {
    setText("phase-label", state.runtime.paused ? "ПАУЗА" : phaseNames[state.runtime.phase]);
    document.body.dataset.instability = state.driver.instability > 76 ? "critical" : state.driver.instability > 48 ? "high" : "normal";
    document.body.dataset.overdrive = String(state.engineer.overdrive.active);
    document.body.dataset.god = state.god.pressure > 58 ? "high" : "normal";
    document.body.dataset.crash = String(Boolean(state.train.crashed));
    for (const subsystem of ["boiler", "traction", "brakes", "defense", "shackles", "sensors", "coupling", "auxiliary"]) {
      document.body.classList.toggle(`failure-${subsystem}`, state.failures.some(item => !item.resolved && item.subsystem === subsystem));
    }
    const relevantAlerts = state.alerts.filter(item => item.station === "all" || item.station === net.station || (net.role === "gm" && item.station === "gm"));
    const relevant = net.role === "gm" ? relevantAlerts.find(item => item.id.startsWith("attention-")) || relevantAlerts[0] : relevantAlerts[0];
    currentAlert = relevant || null;
    const alertBox = $("global-alert");
    alertBox.hidden = !relevant;
    if (relevant) {
      setText("global-alert-level", relevant.severity === "critical" ? "КРИТИЧЕСКИЙ СИГНАЛ" : "ВНИМАНИЕ");
      let alertText = relevant.text;
      if (relevant.id.startsWith("attention-")) {
        const member = players.find(item => relevant.actorId === item.user_id || relevant.text.startsWith(item.character_name));
        alertText += ` · ${member ? stationNames[member.station] || "ожидает назначения" : "ожидает назначения"}`;
      }
      setText("global-alert-text", alertText);
      if (lastAlertId !== relevant.id) { lastAlertId = relevant.id; audio.cue("alert"); }
    }
  }

  function renderModes() {
    for (const station of M.STATIONS) {
      const panel = $(`${station}-panel`);
      panel.classList.toggle("light-mode", state.runtime.light[station]);
      panel.classList.toggle("show-efficiency", state.runtime.showEfficiency);
      setText(`${station}-mode`, state.runtime.light[station] ? "УЧЕБНЫЙ РЕЖИМ" : "ПОЛНЫЙ РЕЖИМ");
    }
    setText("driver-efficiency", `КПД ${Math.round(state.driver.efficiency)}%`);
    setText("engineer-efficiency", `КПД ${Math.round(state.engineer.efficiency)}%`);
    setText("warden-efficiency", `КПД ${Math.round(state.security.efficiency)}%`);
  }

  function renderDriver() {
    const d = state.driver; const track = state.route.track;
    const speed = displayed("driver.speed"); const quality = displayed("route.track.quality");
    setText("distance-reading", `${displayed("route.distance").toFixed(1)} км`);
    setText("route-message", state.route.message || "Помехи в путевом телеграфе.");
    const upcoming = state.route.upcoming.filter(item => item.at < state.route.distance + .01).sort((a,b) => b.at - a.at).slice(0,3);
    $("upcoming-strip").innerHTML = upcoming.map(item => `<div class="route-node"><span>ЧЕРЕЗ ${Math.max(0, state.route.distance - item.at).toFixed(1)} КМ</span><b>${escapeHTML(item.name)}</b><small>путь ${Math.round(item.quality)} · безопасно ${Math.round(42 + item.quality * .5)}</small></div>`).join("");
    const progress = clamp(state.route.travelled / Math.max(1, state.route.travelled + state.route.distance), 0, 1);
    $("map-train").style.transform = `translate(${(progress - .5) * 250}px, ${(progress - .5) * -30}px)`;
    setText("speed-reading", Math.round(speed)); setDial("speed-dial", speed, 180);
    setText("traction-reading", Math.round(d.traction)); setDial("traction-dial", d.traction, 130);
    const qualityName = quality >= 78 ? "ПУТЬ РОВНЫЙ" : quality >= 55 ? "ПУТЬ ИЗНОШЕН" : quality >= 32 ? "ПУТЬ РАЗБИТ" : "ПУТЬ ИСКАЖЁН";
    setText("track-state", qualityName); setText("track-quality", percent(quality)); setBar("track-quality-bar", quality);
    setText("adhesion-reading", percent(track.adhesion * 100)); setBar("adhesion-bar", track.adhesion * 100);
    setText("safe-speed", `${Math.round(track.safeSpeed)} км/ч`); setText("grade-reading", signed(track.grade));
    renderConsist();
    setText("instability-reading", percent(d.instability)); setBar("instability-bar", d.instability);
    setText("brake-pipe-reading", percent(displayed("driver.brakePipe"))); setBar("brake-pipe-bar", displayed("driver.brakePipe"));
    setText("brake-heat-reading", percent(d.brakeHeat)); setBar("brake-heat-bar", d.brakeHeat);
    setText("brake-slide-reading", percent(d.brakeSlide)); setBar("brake-slide-bar", d.brakeSlide);
    setText("derail-risk-reading", percent(d.derailRisk)); setBar("derail-risk-bar", d.derailRisk); setText("derail-risk-cause", d.derailCause);
    const derailedCount = state.train.cars.filter(item => item.connected && item.derailed).length;
    setText("wave-summary", state.train.crashed ? "КРУШЕНИЕ СОСТАВА" : derailedCount ? `СХОД · ${derailedCount} ВАГОН${derailedCount === 1 ? "" : "А"}` : Math.max(...d.wave.map(Math.abs)) > .75 ? "УДАР ПО СОСТАВУ" : Math.max(...d.wave.map(Math.abs)) > .32 ? "ВОЛНА В СЦЕПКАХ" : "СОСТАВ СОБРАН");
    syncControl("throttle-input", d.throttle * 100, "throttle-output", percent(d.throttle * 100));
    syncControl("brake-input", d.brake * 100, "brake-output", percent(d.brake * 100));
    syncControl("cutoff-input", d.cutoff * 100, "cutoff-output", percent(d.cutoff * 100));
    setText("throttle-response", `КАМЕРА ${Math.round(d.steamChest)}% · ${d.acceleration > .08 ? "НАБОР ХОДА" : d.acceleration < -.08 ? "ТЯГА ПАДАЕТ" : "УСИЛИЕ РОВНОЕ"}`);
    setText("brake-response", `МАГИСТРАЛЬ ${Math.round(d.brakePipe)}% · УСИЛИЕ ${Math.round(d.brakeForce)}%`);
    $$("[data-cutoff]").forEach(button => button.classList.toggle("active", button.dataset.cutoff === d.cutoffMode));
    $("engine-toggle").classList.toggle("lit", d.engineOn); $("engine-toggle").innerHTML = `МАШИНА<br><b>${d.engineOn ? "В ХОДУ" : "ОСТАНОВЛЕНА"}</b>`;
    $("sand-button").classList.toggle("active", d.sand); setText("sand-reading", percent(d.sandReserve));
  }

  function renderConsist() {
    const parts = [];
    state.train.cars.forEach((item, index) => {
      const bounce = Math.sin(state.runtime.elapsed * 3 + index) * state.driver.instability / 26;
      const transform = `translateY(${bounce + (item.derailed ? 8 : 0)}px) rotate(${item.derailed ? (index % 2 ? -8 : 8) : 0}deg)`;
      parts.push(`<div class="train-car ${item.type === "reliquary" ? "reliquary" : ""} ${item.connected ? "" : "disconnected"} ${item.derailed ? "derailed" : ""}" style="transform:${transform}" title="${escapeHTML(item.name)} · целостность ${Math.round(item.integrity)}%${item.derailed ? " · СОШЁЛ С РЕЛЬСОВ" : ""}"><span>${item.short}</span><small>${item.derailed ? "СХОД" : Math.round(item.integrity)}</small></div>`);
      if (index < 5) {
        const wave = state.driver.wave[index]; const kind = wave > .18 ? "tension" : wave < -.18 ? "compression" : "";
        parts.push(`<i class="coupler-wave ${kind}" style="transform:scaleX(${1 + Math.abs(wave) * .45})" aria-label="${kind || "равновесие"}"></i>`);
      }
    });
    $("driver-consist").innerHTML = parts.join("");
  }

  function renderEngineer() {
    const e = state.engineer;
    const pressure = displayed("engineer.boilerPressure"); const water = displayed("engineer.water");
    setText("boiler-pressure", percent(pressure)); setBar("boiler-pressure-bar", pressure);
    setText("heat-reading", percent(e.heat)); setBar("heat-bar", e.heat);
    setText("water-reading", percent(water)); setBar("water-bar", water);
    setText("fuel-reading", percent(e.fuel)); setBar("fuel-bar", e.fuel);
    $("boiler-water").style.height = `${clamp(e.water * .68, 4, 68)}%`;
    $("boiler-fire").style.height = `${clamp(18 + e.heat * .24, 18, 44)}%`;
    $("boiler-pressure-ring").style.opacity = clamp((e.boilerPressure - 45) / 55, .1, 1);
    setText("boiler-state", e.boilerPressure > 92 ? "КРАСНАЯ ЧЕРТА" : e.water < 22 ? "МАЛО ВОДЫ" : e.heat < 35 ? "ТОПКА ГАСНЕТ" : "РАБОЧИЙ ЖАР");
    syncControl("feed-input", e.feed * 100, "feed-output", percent(e.feed * 100));
    syncControl("injector-input", e.injector * 100, "injector-output", percent(e.injector * 100));
    setText("feed-response", e.feed > .7 ? "ТОПКА РЕВЁТ" : e.feed > .46 ? "ЖАР НАБИРАЕТСЯ" : e.feed < .2 ? "ТОПКА ОСТЫВАЕТ" : "ТОПКА ДЕРЖИТ ЖАР");
    setText("injector-response", e.injector > .58 ? "ХОЛОДНЫЙ УДАР ПО КОТЛУ" : e.injector > .3 ? "ВОДА ПРИБЫВАЕТ" : "УРОВЕНЬ СТАБИЛИЗИРУЕТСЯ");
    let totalFlow = 0;
    $$(".circuit").forEach(node => {
      const id = node.dataset.circuit; const circuit = e.circuits[id]; totalFlow += circuit.flow;
      node.querySelector("[data-circuit-pressure]").textContent = `${Math.round(displayed(`engineer.circuits.${id}.pressure`))}%`;
      node.querySelector("[data-circuit-buffer]").style.height = `${circuit.buffer}%`;
      node.querySelector("[data-circuit-flow]").style.height = `${clamp(circuit.flow)}%`;
      const input = node.querySelector("input[type=range]"); const output = node.querySelector("output");
      if (document.activeElement !== input) input.value = Math.round(circuit.targetValve * 100);
      output.value = percent(circuit.targetValve * 100);
      const wheel = node.querySelector(".valve-wheel");
      if (wheel) { wheel.style.setProperty("--valve-angle", `${-135 + circuit.targetValve * 270}deg`); wheel.setAttribute("aria-valuenow", String(Math.round(circuit.targetValve * 100))); }
      node.style.setProperty("--circuit-flow", String(clamp(circuit.flow) / 100));
      const button = node.querySelector(".isolate-button");
      if (button) { button.classList.toggle("active", circuit.isolated); button.textContent = circuit.isolated ? "ИЗОЛИРОВАН" : "ИЗОЛИРОВАТЬ"; }
      node.classList.toggle("starved", circuit.buffer < 8);
    });
    setText("collector-total", `ПОТОК ${Math.round(totalFlow / 5)}%`);
    setText("steam-reserve", percent(Object.values(e.circuits).reduce((sum,item) => sum + item.buffer,0) / 5));
    const od = e.overdrive;
    setText("overdrive-state", od.active ? "БАЙПАС ОТКРЫТ" : od.armed ? "ПЛОМБА СНЯТА" : "ЗАПЕРТ");
    setText("overdrive-power", `×${(1 + od.intensity / 25).toFixed(1)}`);
    $("overdrive-coil").classList.toggle("active", od.active);
    $("overdrive-arm").classList.toggle("armed", od.armed); $("overdrive-arm").textContent = od.armed ? "ПЛОМБА СНЯТА" : "СНЯТЬ ПЛОМБУ";
    $("overdrive-toggle").disabled = !od.armed && !od.active; $("overdrive-toggle").textContent = od.active ? "ЗАКРЫТЬ БАЙПАС" : "ОТКРЫТЬ БАЙПАС";
    if (document.activeElement !== $("overdrive-target")) $("overdrive-target").value = od.circuit;
    setText("overdrive-instability", percent(od.instability)); setBar("overdrive-instability-bar", od.instability);
    $("vent-button").classList.toggle("active", e.vent);
  }

  function renderWarden() {
    const s = state.security; const sector = s.sectors[s.sector];
    $$("[data-sector]").forEach(button => button.classList.toggle("active", button.dataset.sector === s.sector));
    const sectorTargets = s.targets.filter(item => item.alive && item.sector === s.sector);
    setText("target-count", `${sectorTargets.length} СИГНАТУР`);
    const dots = $("target-dots");
    const nextTargetKey = `${s.sector}:${sectorTargets.map(item => `${item.id}:${item.kind}`).join("|")}`;
    if (nextTargetKey !== targetStructureKey) {
      targetStructureKey = nextTargetKey;
      dots.innerHTML = sectorTargets.map(target => `<button type="button" class="target-dot" data-target="${target.id}"></button>`).join("");
    }
    for (const targetItem of sectorTargets) {
      const node = [...dots.children].find(item => item.dataset.target === targetItem.id); if (!node) continue;
      const left = clamp(targetItem.bearing * 100, 4, 96); const top = clamp(88 - targetItem.distance / 720 * 76, 8, 90);
      node.style.left = `${left}%`; node.style.top = `${top}%`;
      node.classList.toggle("group", targetItem.kind === "stalker");
      node.classList.toggle("selected", targetItem.id === s.selectedTarget);
      node.setAttribute("aria-label", `${targetItem.name}, ${Math.round(targetItem.distance)} метров`);
    }
    const target = sectorTargets.find(item => item.id === s.selectedTarget);
    setText("selected-target", target?.name || "НЕТ ЦЕЛИ"); setText("target-distance", target ? `${Math.round(target.distance)} м · ${target.health}/${target.maxHealth}` : "—");
    if (target) { $("target-reticle").style.left = `${clamp(target.bearing * 100,4,96)}%`; $("target-reticle").style.top = `${clamp(88 - target.distance / 720 * 76,8,90)}%`; }
    $("target-reticle").style.opacity = target ? "1" : ".25";
    $("rhythm-marker").style.left = `${s.rhythm * 100}%`;
    setText("turret-heat", percent(sector.heat)); setBar("turret-heat-bar", sector.heat);
    setText("turret-reload", percent(sector.reload * 100)); setBar("turret-reload-bar", sector.reload * 100);
    setText("turret-state", sector.heat > 92 ? "ПЕРЕГРЕВ" : !s.turretsEnabled ? "ОБЕСТОЧЕНА" : sector.reload < .98 ? "ПЕРЕЗАРЯДКА" : "ГОТОВА");
    $("fire-button").disabled = !target || !s.turretsEnabled || sector.reload < .98 || sector.heat >= 92;
    $("fire-button").querySelector("small").textContent = !target ? "СНАЧАЛА ВЫБЕРИТЕ ЦЕЛЬ" : sector.reload < .98 ? `ПЕРЕЗАРЯДКА ${Math.round(sector.reload * 100)}%` : sector.heat >= 92 ? "СЕКТОР ПЕРЕГРЕТ" : "НАЖАТЬ В ТАКТ";
    $("turret-toggle").classList.toggle("lit", s.turretsEnabled); $("turret-toggle").innerHTML = `ТУРЕЛИ <b>${s.turretsEnabled ? "В СЕТИ" : "ОТКЛЮЧЕНЫ"}</b>`;
    setText("defense-pressure", `ПИТАНИЕ ${Math.round(state.engineer.circuits.defense.pressure)}%`);
    setText("barrier-charge", percent(s.barrier.charge)); $("barrier-orb").classList.toggle("active", s.barrier.enabled);
    $("barrier-toggle").classList.toggle("active", s.barrier.enabled); $("barrier-toggle").textContent = s.barrier.enabled ? "ВКЛЮЧЁН" : "ВЫКЛЮЧЕН";
    syncControl("barrier-power", s.barrier.power * 100, "barrier-power-output", percent(s.barrier.power * 100));
    setText("shackle-stability", percent(displayed("security.shackles.stability")));
    syncControl("shackle-power", s.shackles.power * 100, "shackle-power-output", percent(s.shackles.power * 100));
    $$("#anchor-dials i").forEach((node,index) => node.style.setProperty("--anchor", `${s.shackles.anchors[index] * 360}deg`));
    $("shackle-phase").style.transform = `rotate(${s.rhythm * 360}deg)`;
    renderSecurityTrain();
  }

  function renderSecurityTrain() {
    const s = state.security;
    if (!securityStructureReady) {
      const parts = [];
      state.train.cars.forEach((item,index) => {
        parts.push(`<div class="security-car" data-security-car="${index}"><span>${item.short}</span><small></small></div>`);
        if (index < 5) parts.push(`<button type="button" data-coupling="${index}" class="security-coupler" aria-label="Подготовить сцепку ${index + 1}"><i></i></button>`);
      });
      $("security-consist").innerHTML = parts.join("");
      $("bulkhead-bank").innerHTML = s.bulkheads.map((_,index) => `<button type="button" data-bulkhead="${index}"></button>`).join("");
      securityStructureReady = true;
    }
    state.train.cars.forEach((item,index) => {
      const node = document.querySelector(`[data-security-car="${index}"]`); if (!node) return;
      node.classList.toggle("reliquary", item.type === "reliquary"); node.classList.toggle("disconnected", !item.connected); node.classList.toggle("derailed", item.derailed);
      node.querySelector("small").textContent = item.derailed ? `СХОД · ${Math.round(item.integrity)}` : `${Math.round(item.integrity)} · КОЛ ${Math.round(item.wheelDamage || 0)}`;
    });
    $$(`[data-coupling]`, $("security-consist")).forEach(button => {
      const index = Number(button.dataset.coupling);
      button.classList.toggle("armed", s.detachArmed === index); button.classList.toggle("open", !s.couplings[index]);
      button.setAttribute("aria-label", s.detachArmed === index ? `Подтвердить отсоединение после вагона ${index + 1}` : `Подготовить сцепку ${index + 1}`);
    });
    $$(`[data-bulkhead]`, $("bulkhead-bank")).forEach(button => {
      const index = Number(button.dataset.bulkhead); const closed = s.bulkheads[index];
      button.classList.toggle("open", !closed); button.textContent = `${index + 1} · ${closed ? "ЗАКРЫТА" : "ОТКРЫТА"}`;
    });
    setText("train-integrity", `СОСТАВ ${Math.round(state.train.integrity)}%`);
  }

  function syncControl(inputId, value, outputId, label) {
    const input = $(inputId); if (document.activeElement !== input) input.value = Math.round(value);
    const output = $(outputId); if (output) output.value = label;
  }

  function renderWaiting() {
    if (!$("waiting-crew")) return;
    $("waiting-crew").innerHTML = players.map(item => `<span>${escapeHTML(item.character_name)} · ${stationNames[item.station] || "ожидает"}</span>`).join("");
  }

  function renderPlayers() {
    const list = $("gm-player-list"); if (!list) return;
    const nextKey = JSON.stringify(players.map(item => [item.user_id, item.character_name, item.station, attentionRequests.has(item.user_id)]));
    if (nextKey === playersRenderKey) return;
    playersRenderKey = nextKey;
    if (!players.length) { list.innerHTML = "<p>Ожидание игроков…</p>"; return; }
    list.innerHTML = players.map(item => `<div class="gm-player ${attentionRequests.has(item.user_id) ? "attention" : ""}" data-player="${item.user_id}"><div><strong>${escapeHTML(item.character_name)}</strong><small>${attentionRequests.has(item.user_id) ? "ПРОСИТ ВНИМАНИЯ" : stationNames[item.station] || "не назначен"}</small></div><select aria-label="Пост ${escapeHTML(item.character_name)}"><option value="">Ожидает</option><option value="driver" ${item.station === "driver" ? "selected" : ""}>Машинист</option><option value="engineer" ${item.station === "engineer" ? "selected" : ""}>Инженер</option><option value="warden" ${item.station === "warden" ? "selected" : ""}>Страж</option><option value="roaming" ${item.station === "roaming" ? "selected" : ""}>Вне поста</option></select></div>`).join("");
  }

  const failureDescriptions = {
    boiler: severity => `Целевое давление котла −${(2.475 * severity).toFixed(1)} пункта; вода дополнительно уходит на ${(0.01125 * severity).toFixed(3)} пункта/с.`,
    traction: severity => `Доступная тяга умножается на ${(1 - .095 * severity).toFixed(3)} (потеря ${Math.round(9.5 * severity)}%).`,
    brakes: severity => `Цель давления тормозной магистрали ниже на ${(3.675 * severity).toFixed(1)} пункта; тормоза медленнее отпускают.`,
    defense: severity => `Подача пара в оборонный контур умножается на ${(1 - .105 * severity).toFixed(3)} (потеря ${Math.round(10.5 * severity)}%).`,
    shackles: severity => `Питание оков умножается на ${(1 - .1125 * severity).toFixed(3)} (потеря ${Math.round(11.25 * severity)}%); рост влияния ускоряется косвенно.`,
    sensors: severity => `Искажение физических показаний возрастает на ${5 * severity} пунктов. Цифры могут быть дополнительно подменены отдельно.`,
    coupling: severity => `Добавляет ${Math.round(3.125 * severity)} пунктов к продольной неустойчивости; толчки быстрее повреждают вагоны.`,
    auxiliary: severity => `Подача в служебный контур умножается на ${(1 - .1 * severity).toFixed(2)} (потеря ${10 * severity}%).`,
  };

  function renderFailurePreview() {
    const subsystem = $("gm-failure-system").value;
    const severity = Number($("gm-failure-severity").value);
    const level = ["", "помеха", "серьёзная", "критическая", "катастрофическая"][severity];
    setText("gm-failure-preview", `Степень ${severity} — ${level}. ${failureDescriptions[subsystem]?.(severity) || "Эффект не описан."} ${$("gm-failure-hidden").checked ? "Игроки не получат прямого сообщения: останутся только физические признаки." : "Сбой будет записан в журнал и проявится на посту."}`);
  }

  function renderGM() {
    if (net.role !== "gm") return;
    setText("gm-save-state", `${net.mode === "cloud" ? "облако" : "локально"} · v${net.version}`);
    $$("[data-phase]").forEach(button => button.classList.toggle("active", button.dataset.phase === state.runtime.phase));
    $$("[data-speed]").forEach(button => button.classList.toggle("active", Number(button.dataset.speed) === state.runtime.timeScale));
    $("gm-pause").textContent = state.runtime.paused ? "Запустить" : "Пауза";
    $("gm-show-efficiency").checked = state.runtime.showEfficiency;
    $("gm-auto-catastrophes").checked = Boolean(state.gm.autoCatastrophes);
    setText("gm-derail-risk", percent(state.driver.derailRisk)); setBar("gm-derail-risk-bar", state.driver.derailRisk);
    setText("gm-derail-cause", state.driver.derailCause);
    const derailedCount = state.train.cars.filter(item => item.connected && item.derailed).length;
    setText("gm-risk-state", state.train.crashed ? "КРУШЕНИЕ" : derailedCount ? `сошло вагонов: ${derailedCount}` : state.driver.derailRisk >= 72 ? "критический порог" : state.driver.derailRisk >= 38 ? "нарастающая угроза" : "режим устойчив");
    $$("[data-light]").forEach(input => input.checked = state.runtime.light[input.dataset.light]);
    $$("[data-gm-path]").forEach(input => {
      if (document.activeElement === input) return;
      const parts = input.dataset.gmPath.split("."); let value = state;
      for (const part of parts) value = value?.[part];
      input.value = Number(value).toFixed(input.step === "0.01" ? 2 : input.step === "0.1" ? 1 : 0);
    });
    const activeFailures = state.failures.filter(item => !item.resolved);
    const failureKey = activeFailures.map(item => `${item.id}:${item.severity}:${item.hidden}`).join("|");
    if (failureKey !== gmFailureRenderKey) {
      gmFailureRenderKey = failureKey;
      $("gm-failure-list").innerHTML = activeFailures.map(item => `<div class="gm-failure ${item.severity >= 3 ? "severe" : ""}"><span>${M.failureLabel(item.subsystem)} · ${item.severity}${item.hidden ? " · скрытая" : ""}</span><button type="button" data-repair="${item.id}">Исправлено</button></div>`).join("") || "<p>Активных поломок нет.</p>";
    }
    $("gm-log").innerHTML = state.log.slice(0, 32).map(item => `<p class="${item.level}"><span>${formatTime(item.at)}</span> ${escapeHTML(item.text)}</p>`).join("");
    if (document.activeElement !== $("gm-message")) $("gm-message").value = state.route.message;
    renderPlayers();
  }

  function renderAll() {
    if (!active) return;
    renderHeader(); renderModes(); renderDriver(); renderEngineer(); renderWarden(); renderWaiting(); renderGM(); renderConnection();
  }
  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderAll(); });
  }

  function frame(now) {
    const dt = Math.min(.5, (now - lastFrame) / 1000); lastFrame = now;
    if (active && !state.runtime.paused && net.role !== "gm") state.security.rhythm = (state.security.rhythm + dt * (0.62 + state.driver.speed / 260)) % 1;
    if (active && now - lastRender > 110) { lastRender = now; renderAll(); audio.update(state); }
    requestAnimationFrame(frame);
  }

  function simulationTick(now = Date.now()) {
    const dt = Math.min(.5, Math.max(0, (now - lastSimulationTick) / 1000)); lastSimulationTick = now;
    if (!active || net.role !== "gm") return;
    M.step(state, dt);
    if (now - lastBroadcast > 280) { lastBroadcast = now; void Net.sendState(state); }
  }

  function startSimulationTicker() {
    try {
      const worker = new Worker("simulation-worker.js");
      worker.onmessage = event => { if (event.data?.type === "tick") simulationTick(Number(event.data.now) || Date.now()); };
      worker.onerror = () => { worker.terminate(); setInterval(() => simulationTick(Date.now()), 100); };
    } catch { setInterval(() => simulationTick(Date.now()), 100); }
  }

  function pulseElement(node, className = "command-pulse", duration = 260) {
    if (!node) return;
    const previous = feedbackTimers.get(node); if (previous) { clearTimeout(previous.timer); node.classList.remove(previous.className); }
    node.classList.remove(className); void node.offsetWidth; node.classList.add(className);
    feedbackTimers.set(node, { className, timer: setTimeout(() => { node.classList.remove(className); feedbackTimers.delete(node); }, duration) });
  }

  function escapeHTML(value) { return String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
  function formatTime(seconds) { const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`; }

  function bindRange(id, type, transform = value => value / 100, extra = {}) {
    $(id).addEventListener("input", event => {
      const raw = Number(event.target.value);
      const output = event.target.closest("label")?.querySelector("output"); if (output) output.value = percent(raw);
      pulseElement(event.target.closest("label") || event.target, "control-live", 260);
      send({ type, value: transform(raw), ...extra });
    });
  }
  function bindHold(id, type) {
    const button = $(id);
    const down = event => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); pulseElement(button, "control-live", 300); send({ type, value: true }, true); audio.cue("button"); };
    const up = event => { event.preventDefault(); send({ type, value: false }, true); };
    button.addEventListener("pointerdown", down); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("lostpointercapture", up);
  }

  function enhanceValveControls() {
    $$(".circuit").forEach(node => {
      const input = node.querySelector("input[type=range]"); if (!input || node.querySelector(".valve-command")) return;
      const circuit = node.dataset.circuit; input.hidden = true; input.tabIndex = -1;
      const control = document.createElement("div"); control.className = "valve-command";
      control.innerHTML = `<button type="button" class="valve-step" data-step="-8" aria-label="Прикрыть клапан">−</button><button type="button" class="valve-wheel" role="slider" aria-label="Клапан ${M.CIRCUIT_LABELS[circuit].toLowerCase()} контура" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${input.value}"><i></i><b></b></button><button type="button" class="valve-step" data-step="8" aria-label="Открыть клапан">+</button>`;
      input.closest("label").after(control);
      const wheel = control.querySelector(".valve-wheel");
      const commit = (raw, immediate = false) => {
        const value = clamp(Math.round(raw), 0, 100); input.value = value;
        node.querySelector("output").value = percent(value);
        wheel.style.setProperty("--valve-angle", `${-135 + value * 2.7}deg`); wheel.setAttribute("aria-valuenow", String(value));
        pulseElement(node, "valve-commanded", 360); send({ type: "engineer.valve", circuit, value: value / 100 }, immediate);
      };
      control.addEventListener("click", event => { const step = event.target.closest("[data-step]"); if (step) commit(Number(input.value) + Number(step.dataset.step), true); });
      wheel.addEventListener("wheel", event => { event.preventDefault(); commit(Number(input.value) + (event.deltaY < 0 ? 5 : -5)); }, { passive: false });
      wheel.addEventListener("keydown", event => {
        if (["ArrowUp", "ArrowRight"].includes(event.key)) { event.preventDefault(); commit(Number(input.value) + 5, true); }
        if (["ArrowDown", "ArrowLeft"].includes(event.key)) { event.preventDefault(); commit(Number(input.value) - 5, true); }
      });
      wheel.addEventListener("pointerdown", event => {
        event.preventDefault(); wheel.setPointerCapture?.(event.pointerId);
        const startX = event.clientX; const startY = event.clientY; const startValue = Number(input.value);
        const move = moveEvent => commit(startValue + (moveEvent.clientX - startX - (moveEvent.clientY - startY)) * .72);
        const up = () => { wheel.removeEventListener("pointermove", move); wheel.removeEventListener("pointerup", up); wheel.removeEventListener("pointercancel", up); commit(Number(input.value), true); };
        wheel.addEventListener("pointermove", move); wheel.addEventListener("pointerup", up); wheel.addEventListener("pointercancel", up);
      });
    });
  }

  function bindPlayerControls() {
    bindRange("throttle-input", "driver.throttle"); bindRange("brake-input", "driver.brake"); bindRange("cutoff-input", "driver.cutoff");
    $$("[data-cutoff]").forEach(button => button.addEventListener("click", () => send({ type: "driver.cutoffMode", value: button.dataset.cutoff }, true)));
    $("engine-toggle").addEventListener("click", () => send({ type: "driver.engine", value: !state.driver.engineOn }, true));
    bindHold("sand-button", "driver.sand");
    bindRange("feed-input", "engineer.feed"); bindRange("injector-input", "engineer.injector"); bindHold("vent-button", "engineer.vent");
    $("manual-coal").addEventListener("click", () => send({ type: "engineer.manualCoal" }, true));
    enhanceValveControls();
    $$(".circuit").forEach(node => {
      const circuit = node.dataset.circuit;
      node.querySelector(".isolate-button").addEventListener("click", () => send({ type: "engineer.isolate", circuit, value: !state.engineer.circuits[circuit].isolated }, true));
    });
    $("overdrive-target").addEventListener("change", event => send({ type: "engineer.overdrive.target", value: event.target.value }, true));
    $("overdrive-arm").addEventListener("click", () => send({ type: "engineer.overdrive.arm", value: !state.engineer.overdrive.armed }, true));
    $("overdrive-toggle").addEventListener("click", async () => {
      if (!state.engineer.overdrive.active && !await confirmAction("Открыть форсажный байпас?", "Выбранная система будет набирать мощность и нестабильность без верхнего предела, пока байпас не закроют вручную.")) return;
      send({ type: "engineer.overdrive.toggle" }, true);
    });
    for (const selectId of ["crossfeed-from", "crossfeed-to"]) $(selectId).innerHTML = M.CIRCUITS.map(id => `<option value="${id}">${M.CIRCUIT_LABELS[id]}</option>`).join("");
    $("crossfeed-to").selectedIndex = 1;
    $("crossfeed-apply").addEventListener("click", () => send({ type: "engineer.crossfeed", from: $("crossfeed-from").value, to: $("crossfeed-to").value }, true));
    $$("[data-sector]").forEach(button => button.addEventListener("click", () => send({ type: "security.sector", value: button.dataset.sector }, true)));
    $("target-dots").addEventListener("click", event => { const target = event.target.closest("[data-target]"); if (target) { pulseElement(target, "control-live", 350); send({ type: "security.target", value: target.dataset.target }, true); } });
    $("fire-button").addEventListener("click", () => { audio.cue("fire"); pulseElement($("fire-button"), "control-live", 250); send({ type: "security.fire", phase: state.security.rhythm }, true); });
    $("turret-toggle").addEventListener("click", () => send({ type: "security.turrets", value: !state.security.turretsEnabled }, true));
    $("barrier-toggle").addEventListener("click", () => send({ type: "security.barrier", value: !state.security.barrier.enabled }, true));
    bindRange("barrier-power", "security.barrierPower"); bindRange("shackle-power", "security.shacklePower");
    $("shackle-sync").addEventListener("click", () => { pulseElement($("anchor-dials"), "control-live", 380); send({ type: "security.shackleSync", phase: state.security.rhythm }, true); });
    $("security-consist").addEventListener("click", event => { const button = event.target.closest("[data-coupling]"); if (button) { pulseElement(button, "control-live", 380); send({ type: "security.detach", index: Number(button.dataset.coupling) }, true); } });
    $("bulkhead-bank").addEventListener("click", event => { const button = event.target.closest("[data-bulkhead]"); if (button) { const index = Number(button.dataset.bulkhead); pulseElement(button, "control-live", 380); send({ type: "security.bulkhead", index, value: !state.security.bulkheads[index] }, true); } });
  }

  function bindGMControls() {
    $$("[data-phase]").forEach(button => button.addEventListener("click", () => apply({ type: "gm.phase", value: button.dataset.phase })));
    $("gm-pause").addEventListener("click", () => apply({ type: "gm.pause", value: !state.runtime.paused }));
    $$("[data-speed]").forEach(button => button.addEventListener("click", () => apply({ type: "gm.timeScale", value: Number(button.dataset.speed) })));
    $$("[data-light]").forEach(input => input.addEventListener("change", () => apply({ type: "gm.light", station: input.dataset.light, value: input.checked })));
    $$("[data-light-all]").forEach(button => button.addEventListener("click", () => apply({ type: "gm.lightAll", value: button.dataset.lightAll === "true" })));
    $("gm-show-efficiency").addEventListener("change", event => apply({ type: "gm.efficiency", value: event.target.checked }));
    $("gm-auto-catastrophes").addEventListener("change", event => apply({ type: "gm.autoCatastrophes", value: event.target.checked }));
    $$("[data-gm-path]").forEach(input => input.addEventListener("change", () => apply({ type: "gm.set", path: input.dataset.gmPath, value: Number(input.value) })));
    $("gm-send-message").addEventListener("click", () => apply({ type: "gm.message", value: $("gm-message").value }));
    $("gm-refresh-players").addEventListener("click", () => void Net.refreshPlayers().catch(error => toast(error.message, true)));
    $("gm-player-list").addEventListener("change", event => {
      const row = event.target.closest("[data-player]"); if (!row || event.target.tagName !== "SELECT") return;
      const id = row.dataset.player; attentionRequests.delete(id);
      const member = players.find(item => item.user_id === id); if (member) member.station = event.target.value || null;
      playersRenderKey = ""; renderPlayers();
      void Net.assignStation(id, event.target.value || null).catch(error => toast(error.message, true));
    });
    for (const id of ["gm-failure-system", "gm-failure-severity", "gm-failure-hidden"]) $(id).addEventListener("change", renderFailurePreview);
    renderFailurePreview();
    $("gm-add-failure").addEventListener("click", () => apply({ type: "gm.failure", subsystem: $("gm-failure-system").value, severity: Number($("gm-failure-severity").value), hidden: $("gm-failure-hidden").checked }));
    $$("[data-damage]").forEach(button => button.addEventListener("click", () => apply({ type: "gm.damage", car: $("gm-damage-car").value, amount: Number(button.dataset.damage), shock: Number(button.dataset.shock) })));
    $("gm-cascade").addEventListener("click", async () => { if (await confirmAction("Запустить каскадный срыв?", "Поезд получит несколько одновременных поломок, удар по сцепкам и всплеск давления бога. Это полноценное окно катастрофы.")) apply({ type: "gm.cascade" }); });
    $("gm-repair-car").addEventListener("click", () => apply({ type: "gm.repairCar", car: $("gm-damage-car").value, amount: 25 }));
    $("gm-rerail-car").addEventListener("click", () => apply({ type: "gm.rerailCar", car: $("gm-damage-car").value }));
    $("gm-restore-coupling").addEventListener("click", () => apply({ type: "gm.restoreCoupling", index: Number($("gm-repair-coupling").value) }));
    $("gm-failure-list").addEventListener("click", event => { const button = event.target.closest("[data-repair]"); if (button) apply({ type: "gm.repair", id: button.dataset.repair }); });
    $("gm-set-false").addEventListener("click", () => apply({ type: "gm.falseReading", gauge: $("gm-false-gauge").value, offset: Number($("gm-false-offset").value) }));
    $("gm-clear-false").addEventListener("click", () => apply({ type: "gm.clearFalse" }));
    $$("[data-event]").forEach(button => button.addEventListener("click", () => triggerEvent(button.dataset.event, button.dataset.sector)));
    $("gm-export").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }); const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = `deus-mortuus-${net.code || "save"}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    });
    $("gm-import").addEventListener("change", async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { state = M.normalize(JSON.parse(await file.text())); apply({ type: "gm.pause", value: true }); toast("Снимок рейса восстановлен"); } catch { toast("Файл не похож на снимок Deus mortuus", true); }
      event.target.value = "";
    });
  }

  function triggerEvent(kind, sector) {
    if (kind === "targets") apply({ type: "gm.targets", sector, count: 3, kind: "stalker" });
    if (kind === "track") { apply({ type: "gm.set", path: "route.track.quality", value: 24 }); apply({ type: "gm.set", path: "route.track.safeSpeed", value: 42 }); apply({ type: "gm.message", value: "Впереди разрыв полотна. Сигнальные цепи подтверждают просадку рельсов." }); }
    if (kind === "god") { apply({ type: "gm.set", path: "god.pressure", value: clamp(state.god.pressure + 12) }); apply({ type: "gm.set", path: "god.resonance", value: clamp(state.god.resonance + 18) }); audio.cue("god"); }
    if (kind === "storm") { apply({ type: "gm.set", path: "route.track.adhesion", value: .38 }); apply({ type: "gm.message", value: "Пепельная буря закрывает путь. Рельсы теряют сцепление." }); }
    if (kind === "jump") { apply({ type: "gm.message", value: "Впереди пропасть. Для перехода нужен предельный разгон и удержание состава." }); apply({ type: "gm.set", path: "route.track.safeSpeed", value: 140 }); }
  }

  function bindShell() {
    const params = new URLSearchParams(location.search);
    const gmRequested = params.get("gm") === "1";
    $("gm-entry").hidden = !gmRequested; $("player-entry").hidden = gmRequested;
    $("open-gm").addEventListener("click", () => { $("gm-entry").hidden = false; $("player-entry").hidden = true; history.replaceState(null,"", "?gm=1"); });
    $("open-player").addEventListener("click", () => { $("gm-entry").hidden = true; $("player-entry").hidden = false; history.replaceState(null,"", location.pathname); });
    $("join-code").addEventListener("input", event => event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,6));
    $("join-form").addEventListener("submit", event => { event.preventDefault(); void enter(() => Net.joinRoom($("join-code").value, $("join-name").value)); });
    $("create-form").addEventListener("submit", event => { event.preventDefault(); state = M.createInitialState(); void enter(() => Net.createRoom($("gm-name").value, state)); });
    $("resume-session").addEventListener("click", () => void enter(() => Net.resume()));
    if (Net.hasSavedSession()) { $("resume-session").hidden = false; setText("resume-label", "Вернуться к сохранённой комнате"); }
    $("room-code").addEventListener("click", () => copyCode()); $("gm-room-code").addEventListener("click", () => copyCode());
    $("leave-button").addEventListener("click", async () => { if (!await confirmAction("Покинуть рейс?", "Сохранённое состояние останется у ГМа, но этот экран вернётся ко входу.")) return; await Net.leave(); showLobby(); });
    $("attention-button").addEventListener("click", () => {
      const button = $("attention-button");
      if (Date.now() < attentionCooldownUntil) { toast("Запрос уже передан ГМу"); return; }
      attentionCooldownUntil = Date.now() + 8000;
      send({ type: "attention" }, true);
      button.disabled = true; button.textContent = "ЗАПРОС ПЕРЕДАН";
      setTimeout(() => { button.disabled = false; button.textContent = "ВНИМАНИЕ ГМ"; }, 8000);
    });
    $("alarm-button").addEventListener("click", () => send({ type: "alarm" }, true));
    $("dismiss-alert").addEventListener("click", () => {
      if (!currentAlert) return;
      if (currentAlert.id.startsWith("attention-")) {
        const member = players.find(item => currentAlert.actorId === item.user_id || currentAlert.text.startsWith(item.character_name));
        if (member) attentionRequests.delete(member.user_id);
        playersRenderKey = "";
      }
      if (net.role === "gm") apply({ type: "gm.dismissAlert", id: currentAlert.id });
      else $("global-alert").hidden = true;
      currentAlert = null;
    });
    $("sound-toggle").addEventListener("click", async event => { const enabled = await audio.toggle(); event.currentTarget.setAttribute("aria-pressed", String(enabled)); toast(enabled ? "Звук поста включён" : "Звук выключен"); });
  }

  async function copyCode() { try { await navigator.clipboard.writeText(net.code); toast(`Код ${net.code} скопирован`); } catch { toast(`Код рейса: ${net.code}`); } }

  function init() {
    if (!M || !Net) { $("lobby-error").textContent = "Модули поезда не загрузились"; return; }
    lobbyStatus(); bindShell(); bindPlayerControls(); bindGMControls(); renderAll(); startSimulationTicker(); requestAnimationFrame(frame);
    if (Net.hasSavedSession()) void enter(() => Net.resume());
  }
  init();
})();
