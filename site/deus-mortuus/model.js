(function exposeDeusMortuusModel(global) {
  "use strict";

  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
  const approach = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
  const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
  const copy = value => JSON.parse(JSON.stringify(value));
  const CIRCUITS = ["traction", "pneumatic", "defense", "shackles", "auxiliary"];
  const STATIONS = ["driver", "engineer", "warden"];
  const CIRCUIT_LABELS = {
    traction: "Тяговый",
    pneumatic: "Пневматика",
    defense: "Оборонный",
    shackles: "Оковы",
    auxiliary: "Служебный",
  };

  function car(id, type, name, short) {
    return { id, type, name, short, integrity: 100, connected: true, derailed: false, wheelDamage: 0, barrier: 100, temperature: 24 };
  }

  function circuit(valve, buffer, minimum) {
    return { valve, targetValve: valve, flow: valve * 65, pressure: 65, buffer, integrity: 100, minimum, isolated: false };
  }

  function createInitialState() {
    return {
      schema: 3,
      revision: 1,
      updatedAt: Date.now(),
      runtime: {
        phase: "moving",
        paused: true,
        timeScale: 1,
        elapsed: 0,
        attention: false,
        light: { driver: true, engineer: true, warden: true },
        showEfficiency: true,
        travelScale: 1,
      },
      route: {
        distance: 128.7,
        travelled: 0,
        message: "Путь подтверждён до Чёрной Межи. Следить за западным полотном.",
        track: { quality: 72, grade: 0.02, curve: 0.12, adhesion: 0.82, safeSpeed: 78 },
        upcoming: [
          { id: "ash-fields", name: "Пепельные поля", at: 111.2, quality: 74, grade: 0.01, curve: 0.08, adhesion: 0.86 },
          { id: "black-border", name: "Чёрная Межа", at: 76.4, quality: 51, grade: -0.06, curve: 0.38, adhesion: 0.62 },
          { id: "broken-span", name: "Разорванный мост", at: 38.0, quality: 34, grade: 0.09, curve: 0.12, adhesion: 0.72 },
          { id: "sanctum", name: "Освящённая черта", at: 0, quality: 88, grade: 0, curve: 0.04, adhesion: 0.9 },
        ],
      },
      driver: {
        engineOn: true,
        throttle: 0.36,
        brake: 0,
        cutoff: 0.58,
        cutoffMode: "run",
        sand: false,
        sandReserve: 100,
        speed: 31,
        acceleration: 0,
        steamChest: 48,
        traction: 28,
        brakePipe: 92,
        brakeForce: 0,
        brakeHeat: 8,
        wheelSlip: 0,
        brakeSlide: 0,
        brakeShock: 0,
        instability: 0.08,
        derailRisk: 0,
        derailCause: "Режим устойчив",
        incidentStage: 0,
        derailCooldown: 0,
        efficiency: 71,
        wave: [0.05, 0.03, 0.01, 0, 0],
        previousForce: 0,
        previousBrakeForce: 0,
        previousThrottle: 0.36,
        previousBrake: 0,
      },
      engineer: {
        fuel: 86,
        feed: 0.42,
        water: 72,
        injector: 0.23,
        heat: 61,
        boilerPressure: 68,
        steamReserve: 66,
        vent: false,
        efficiency: 74,
        circuits: {
          traction: circuit(0.58, 62, 0),
          pneumatic: circuit(0.30, 78, 0.12),
          defense: circuit(0.50, 64, 0),
          shackles: circuit(0.50, 72, 0.18),
          auxiliary: circuit(0.30, 76, 0.12),
        },
        crossfeed: null,
        overdrive: { armed: false, active: false, circuit: "traction", intensity: 0, instability: 0 },
      },
      security: {
        sector: "front",
        selectedTarget: null,
        rhythm: 0,
        turretsEnabled: true,
        sectors: {
          front: { heat: 9, reload: 1, integrity: 100, shots: 0 },
          right: { heat: 4, reload: 1, integrity: 100, shots: 0 },
          rear: { heat: 6, reload: 1, integrity: 100, shots: 0 },
          left: { heat: 4, reload: 1, integrity: 100, shots: 0 },
        },
        targets: [],
        barrier: { enabled: true, power: 0.44, charge: 78, integrity: 100 },
        bulkheads: [true, true, true, true, true],
        couplings: [true, true, true, true, true],
        detachArmed: null,
        shackles: { power: 0.52, stability: 82, anchors: [0.12, 0.43, 0.68, 0.9], lastSync: 0 },
        efficiency: 73,
      },
      god: { pressure: 9, growth: 0.0024, demand: 0.22, resonance: 11, distortion: 0 },
      train: {
        integrity: 94,
        crashed: false,
        cars: [
          car(1, "command", "Головной и командный", "КОМ"),
          car(2, "boiler", "Котельный", "КОТ"),
          car(3, "reliquary", "Саркофаг божества", "БОГ"),
          car(4, "battle", "Боевой", "БОЙ"),
          car(5, "living", "Жилой", "ЖИЛ"),
          car(6, "cargo", "Грузовой", "ГРУЗ"),
        ],
      },
      gm: {
        falseReadings: {},
        warningStyle: "late",
        godGrowth: 1,
        stationRecovery: true,
        catastrophicLock: true,
        autoCatastrophes: true,
      },
      failures: [],
      alerts: [],
      log: [{ at: 0, level: "info", text: "Состав принят под управление. Ожидается команда отправления." }],
    };
  }

  function log(state, text, level = "info") {
    state.log.unshift({ at: round(state.runtime.elapsed, 1), level, text });
    state.log = state.log.slice(0, 80);
  }

  function alert(state, id, text, severity = "warning", station = "all", ttl = 18) {
    const existing = state.alerts.find(item => item.id === id);
    if (existing) {
      existing.text = text;
      existing.severity = severity;
      existing.station = station;
      existing.ttl = ttl;
      return;
    }
    state.alerts.unshift({ id, text, severity, station, ttl });
    state.alerts = state.alerts.slice(0, 12);
    log(state, text, severity === "critical" ? "critical" : "warning");
  }

  function clearAlert(state, id) {
    state.alerts = state.alerts.filter(item => item.id !== id);
  }

  function addFailure(state, subsystem, severity = 1, hidden = false) {
    const existing = state.failures.find(item => item.subsystem === subsystem && !item.resolved);
    if (existing) {
      existing.severity = clamp(Math.max(existing.severity, severity), 1, 4);
      existing.hidden = existing.hidden && hidden;
      if (!existing.hidden) alert(state, `failure-${subsystem}`, `Зафиксирован сбой: ${failureLabel(subsystem)} · степень ${existing.severity}`, existing.severity >= 3 ? "critical" : "warning", failureStation(subsystem), 18);
      return existing;
    }
    const failure = { id: `${subsystem}-${Date.now()}-${Math.floor(Math.random() * 999)}`, subsystem, severity: clamp(severity, 1, 4), hidden, progress: 0, resolved: false };
    state.failures.push(failure);
    if (hidden) log(state, `Скрытый сбой: ${failureLabel(subsystem)} · степень ${failure.severity}`, severity >= 3 ? "critical" : "warning");
    else alert(state, `failure-${subsystem}`, `Зафиксирован сбой: ${failureLabel(subsystem)} · степень ${failure.severity}`, failure.severity >= 3 ? "critical" : "warning", failureStation(subsystem), 18);
    return failure;
  }

  function failureStation(id) {
    if (["boiler", "auxiliary"].includes(id)) return "engineer";
    if (["traction", "brakes", "coupling", "track"].includes(id)) return "driver";
    if (["defense", "shackles"].includes(id)) return "warden";
    return "all";
  }

  function failureLabel(id) {
    return ({ boiler: "котёл", traction: "тяговая машина", brakes: "тормозная магистраль", defense: "оборонный контур", shackles: "оковы", sensors: "приборы", coupling: "сцепки", track: "путь", auxiliary: "служебный контур" })[id] || id;
  }

  function demands(state) {
    const d = state.driver;
    const s = state.security;
    const god = state.god;
    const targetActivity = s.targets.filter(target => target.alive).length;
    return {
      traction: d.engineOn ? 0.08 + d.throttle * (0.35 + d.cutoff * 0.55) : 0,
      pneumatic: 0.11 + d.brake * 0.58 + Math.max(0, 70 - d.brakePipe) / 220,
      defense: (s.barrier.enabled ? 0.12 + s.barrier.power * 0.42 : 0.03) + (s.turretsEnabled ? targetActivity * 0.025 : 0),
      shackles: 0.12 + god.demand * (0.6 + s.shackles.power * 0.55),
      auxiliary: 0.13 + (100 - state.engineer.water) / 500 + state.engineer.injector * 0.25,
    };
  }

  function failureEffects(state) {
    const effect = { boilerLeak: 0, waterLeak: 0, tractionLoss: 0, brakeLeak: 0, defenseLoss: 0, shackleLoss: 0, sensorDrift: 0, couplingStress: 0, trackLoss: 0, auxLoss: 0 };
    for (const failure of state.failures) {
      if (failure.resolved) continue;
      const power = failure.severity / 4;
      if (failure.subsystem === "boiler") { effect.boilerLeak += 0.18 * power; effect.waterLeak += 0.045 * power; }
      if (failure.subsystem === "traction") effect.tractionLoss += 0.38 * power;
      if (failure.subsystem === "brakes") effect.brakeLeak += 0.42 * power;
      if (failure.subsystem === "defense") effect.defenseLoss += 0.42 * power;
      if (failure.subsystem === "shackles") effect.shackleLoss += 0.45 * power;
      if (failure.subsystem === "sensors") effect.sensorDrift += 20 * power;
      if (failure.subsystem === "coupling") effect.couplingStress += 0.5 * power;
      if (failure.subsystem === "track") effect.trackLoss += 35 * power;
      if (failure.subsystem === "auxiliary") effect.auxLoss += 0.4 * power;
      failure.progress = clamp(failure.progress + power * 0.006, 0, 100);
    }
    return effect;
  }

  function updateEngineer(state, dt, effects) {
    const e = state.engineer;
    const light = state.runtime.light.engineer;
    const demand = demands(state);

    if (light) {
      e.circuits.pneumatic.targetValve = Math.max(e.circuits.pneumatic.targetValve, 0.18 + state.driver.brake * 0.25);
      e.circuits.auxiliary.targetValve = Math.max(e.circuits.auxiliary.targetValve, 0.20);
      e.circuits.shackles.targetValve = Math.max(e.circuits.shackles.targetValve, 0.22 + state.god.pressure / 300);
    }

    e.feed = clamp(e.feed, 0, 1);
    e.injector = clamp(e.injector, 0, 1);
    if (e.fuel <= 0) e.feed = 0;
    const draft = 0.34 + state.driver.throttle * 0.46;
    const targetHeat = 18 + e.feed * 120 * (0.75 + draft * 0.5);
    e.heat = approach(e.heat, targetHeat, 0.055, dt);
    e.fuel = clamp(e.fuel - e.feed * (0.0045 + e.feed * 0.005) * dt, 0, 100);
    e.water = clamp(e.water + e.injector * 0.20 * dt - (0.018 + e.heat / 5200 + effects.waterLeak) * dt, 0, 100);

    const totalDemand = Object.values(demand).reduce((sum, item) => sum + item, 0);
    const waterFactor = clamp(e.water / 35, 0.15, 1);
    const pressureTarget = clamp(e.heat * 1.18 * waterFactor - totalDemand * 19 - effects.boilerLeak * 55, 0, 115);
    e.boilerPressure = approach(e.boilerPressure, pressureTarget, 0.045, dt);
    if (e.injector > 0.05) e.boilerPressure -= e.injector * 0.035 * dt;
    if (e.vent) e.boilerPressure -= 2.5 * dt;

    const overdrive = e.overdrive;
    if (overdrive.active) {
      overdrive.intensity = clamp(overdrive.intensity + 0.85 * dt, 0, 1000);
      overdrive.instability = clamp(overdrive.instability + (0.28 + overdrive.intensity / 180) * dt, 0, 100);
      if (overdrive.instability > 75) alert(state, "overdrive", "Форсажный байпас выходит из-под контроля", "critical", "engineer", 8);
      if (overdrive.instability >= 100 && !state.gm.catastrophicLock) addFailure(state, overdrive.circuit === "traction" ? "traction" : "boiler", 4);
    } else {
      overdrive.intensity = approach(overdrive.intensity, 0, 0.12, dt);
      overdrive.instability = approach(overdrive.instability, 0, 0.035, dt);
      clearAlert(state, "overdrive");
    }

    for (const id of CIRCUITS) {
      const c = e.circuits[id];
      const loss = id === "defense" ? effects.defenseLoss : id === "shackles" ? effects.shackleLoss : id === "auxiliary" ? effects.auxLoss : 0;
      const minimum = c.minimum;
      c.targetValve = c.isolated ? minimum * 0.25 : clamp(Math.max(c.targetValve, minimum), 0, 1);
      c.valve = approach(c.valve, c.targetValve, 0.34, dt);
      let supply = (e.boilerPressure / 100) * c.valve * (1 - loss) * 1.18;
      if (overdrive.active && overdrive.circuit === id) supply += 0.45 + overdrive.intensity / 85;
      if (e.crossfeed && e.crossfeed.to === id) supply += e.circuits[e.crossfeed.from].buffer / 700;
      const delta = supply - demand[id];
      c.buffer = clamp(c.buffer + delta * 5.8 * dt, 0, 100);
      c.flow = approach(c.flow, supply * 100, 0.44, dt);
      c.pressure = approach(c.pressure, clamp(supply * 72 + c.buffer * 0.34, 0, 130), 0.27, dt);
      if (c.buffer <= 2 && demand[id] > supply + 0.08) alert(state, `starve-${id}`, `${CIRCUIT_LABELS[id]} контур истощён`, "critical", id === "traction" || id === "pneumatic" ? "driver" : id === "defense" || id === "shackles" ? "warden" : "engineer", 7);
      else clearAlert(state, `starve-${id}`);
    }

    const pressureScore = 100 - Math.abs(68 - e.boilerPressure) * 2.1;
    const waterScore = 100 - Math.abs(65 - e.water) * 1.4;
    const waste = e.vent ? 18 : 0;
    e.efficiency = clamp(pressureScore * 0.45 + waterScore * 0.3 + (100 - e.feed * e.feed * 32) * 0.25 - waste, 0, 100);

    if (e.water < 18 && e.heat > 65) alert(state, "dry-boiler", "Вода ушла ниже короны топки", "critical", "engineer", 7);
    else clearAlert(state, "dry-boiler");
    if (e.boilerPressure > 92) alert(state, "boiler-high", "Котёл перешёл красную черту", "critical", "engineer", 7);
    else clearAlert(state, "boiler-high");
    if ((e.water < 8 && e.heat > 78) || e.boilerPressure > 108) addFailure(state, "boiler", state.gm.catastrophicLock ? 3 : 4);
  }

  function derailCar(state, cause = "потеря устойчивости") {
    const candidates = state.train.cars.map((item, index) => ({ item, index })).filter(entry => entry.item.connected && !entry.item.derailed);
    if (!candidates.length) return null;
    const waveIndex = state.driver.wave.reduce((best, value, index, list) => Math.abs(value) > Math.abs(list[best]) ? index : best, 0);
    const preferred = candidates.find(entry => entry.index === Math.min(state.train.cars.length - 1, waveIndex + 1));
    const chosen = preferred || candidates[Math.floor(Math.random() * candidates.length)];
    chosen.item.derailed = true;
    chosen.item.integrity = clamp(chosen.item.integrity - 18, 0, 100);
    chosen.item.wheelDamage = clamp(chosen.item.wheelDamage + 32, 0, 100);
    state.driver.speed *= .76;
    state.driver.instability = Math.max(state.driver.instability, 88);
    state.driver.derailRisk = 48;
    state.driver.incidentStage += 1;
    state.driver.derailCooldown = 7.5;
    alert(state, `derail-${chosen.item.id}-${Date.now()}`, `Вагон «${chosen.item.name}» сошёл с рельсов: ${cause}`, "critical", "all", 24);
    return chosen.item;
  }

  function updateDriver(state, dt, effects) {
    const d = state.driver;
    const e = state.engineer;
    const track = state.route.track;
    const throttleDelta = Math.abs(d.throttle - d.previousThrottle);
    const brakeDelta = Math.max(0, d.brake - d.previousBrake);
    d.derailCooldown = Math.max(0, d.derailCooldown - dt);
    if (state.runtime.light.driver) {
      d.cutoff = d.cutoffMode === "start" ? 0.76 : d.cutoffMode === "power" ? 0.66 : clamp(0.67 - d.speed / 220, 0.28, 0.58);
    }
    const tractionCircuit = e.circuits.traction;
    const pneumatic = e.circuits.pneumatic;
    const chestTarget = d.engineOn ? d.throttle * tractionCircuit.pressure * (0.78 + d.cutoff * 0.35) : 0;
    d.steamChest = approach(d.steamChest, chestTarget, 0.31, dt);
    const idealCutoff = clamp(0.76 - d.speed / 190, 0.23, 0.76);
    const cutoffFit = clamp(1 - Math.abs(d.cutoff - idealCutoff) * 1.45, 0.25, 1);
    const availableTraction = d.steamChest * (0.28 + d.cutoff * 0.9) * cutoffFit * (1 - effects.tractionLoss);
    const sandBonus = d.sand && d.sandReserve > 0 ? 0.18 : 0;
    const adhesion = clamp(track.adhesion + sandBonus - Math.abs(track.grade) * 0.35, 0.2, 1);
    const adhesionLimit = 44 + adhesion * 47;
    d.wheelSlip = approach(d.wheelSlip, clamp((availableTraction - adhesionLimit) * 2.2, 0, 100), 0.5, dt);
    if (d.sand && d.sandReserve > 0) d.sandReserve = clamp(d.sandReserve - 0.11 * dt, 0, 100);
    const slipLoss = 1 - d.wheelSlip / 130;
    d.traction = clamp(availableTraction * slipLoss, 0, 130);

    const pipeTarget = clamp(100 - d.brake * 86 - effects.brakeLeak * 35, 0, 100);
    d.brakePipe = approach(d.brakePipe, pipeTarget, 0.18 + pneumatic.pressure / 900, dt);
    d.brakeForce = approach(d.brakeForce, clamp((100 - d.brakePipe) * 1.05, 0, 100), 0.22, dt);
    const brakeAdhesionLimit = 35 + adhesion * 55;
    const slideTarget = clamp((d.brakeForce - brakeAdhesionLimit) * 2.4 * clamp(d.speed / 38, .25, 1.6), 0, 100);
    d.brakeSlide = approach(d.brakeSlide, slideTarget, .72, dt);
    d.brakeShock = clamp(d.brakeShock + brakeDelta * (70 + d.speed * .45), 0, 100);
    const shockTarget = clamp(d.brake * d.speed * .35 + brakeDelta * 95 + d.brakeSlide * .62, 0, 100);
    d.brakeShock = approach(d.brakeShock, shockTarget, shockTarget > d.brakeShock ? 1.18 : .34, dt);
    d.brakeHeat = clamp(d.brakeHeat + (d.brakeForce + d.brakeSlide * .65) * Math.max(0.1, d.speed / 80) * 0.009 * dt - 0.07 * dt, 0, 100);

    const mass = state.train.cars.filter(item => item.connected).length / 6;
    const derailedCars = state.train.cars.filter(item => item.connected && item.derailed);
    const drive = d.traction * 0.026 / Math.max(0.35, mass);
    const braking = d.brakeForce * 0.043 * (1 - d.brakeHeat / 150) * (1 - d.brakeSlide / 190);
    const gradeForce = track.grade * 7.5;
    const drag = 0.08 + d.speed * d.speed * 0.00016 + derailedCars.length * (0.42 + d.speed * .0045);
    const acceleration = drive - braking - gradeForce - drag;
    const previousAcceleration = d.acceleration;
    d.acceleration = approach(d.acceleration, acceleration, 0.34, dt);
    d.speed = clamp(d.speed + d.acceleration * dt, 0, 180);
    if (!d.engineOn && d.speed < 0.15) d.speed = 0;

    const brakeJerk = (d.brakeForce - d.previousBrakeForce) * -.032 - brakeDelta * clamp(d.speed / 60, .2, 2) * 1.1;
    const jerk = clamp((d.acceleration - previousAcceleration) * 1.8 + (d.traction - d.previousForce) * 0.025 + brakeJerk, -1.8, 1.8);
    d.previousForce = d.traction;
    d.previousBrakeForce = d.brakeForce;
    d.wave[0] = clamp(d.wave[0] + jerk * 0.55, -1.5, 1.5);
    for (let index = 0; index < d.wave.length; index += 1) {
      const previous = index === 0 ? jerk * 0.4 : d.wave[index - 1];
      d.wave[index] += (previous - d.wave[index]) * Math.min(1, dt * (1.05 - index * 0.07));
      d.wave[index] *= Math.pow(0.83, dt);
      if (!state.security.couplings[index]) d.wave[index] = 0;
      d.wave[index] = clamp(d.wave[index], -1.4, 1.4);
    }

    const maxWave = Math.max(...d.wave.map(Math.abs));
    const overspeed = Math.max(0, d.speed - track.safeSpeed);
    const curveStress = track.curve * d.speed * 0.34;
    const couplingStress = effects.couplingStress * 25;
    d.instability = clamp(approach(d.instability, maxWave * 52 + overspeed * 2.1 + (100 - track.quality - effects.trackLoss) * 0.22 + curveStress + couplingStress, 0.22, dt), 0, 100);
    if (maxWave > 0.82) {
      const stressed = d.wave.findIndex(value => Math.abs(value) === maxWave);
      const carItem = state.train.cars[Math.min(5, stressed + 1)];
      carItem.integrity = clamp(carItem.integrity - (maxWave - 0.8) * 0.028 * dt, 0, 100);
    }
    if (d.instability > 72) alert(state, "motion-loss", "Состав входит в срыв движения", "critical", "driver", 6);
    else clearAlert(state, "motion-loss");
    if (d.wheelSlip > 52) alert(state, "wheel-slip", "Ведущие колёса сорвали сцепление", "warning", "driver", 6);
    else clearAlert(state, "wheel-slip");

    const brakingHazard = clamp(d.brakeShock + d.brakeSlide * .42 + d.brakeHeat * .16, 0, 100);
    const tractionHazard = clamp(d.wheelSlip * .85 + throttleDelta * 95 + Math.max(0, d.traction - adhesionLimit), 0, 100);
    const motionHazard = clamp(d.instability + curveStress * .35, 0, 100);
    const derailedHazard = derailedCars.length ? clamp(58 + d.speed * .55 + derailedCars.length * 9, 0, 100) : 0;
    const hazard = Math.max(brakingHazard, tractionHazard, motionHazard, derailedHazard);
    d.derailCause = hazard === derailedHazard && derailedHazard > 0 ? "Движение с вагоном вне рельс" : hazard === brakingHazard ? "Юз и ударное торможение" : hazard === tractionHazard ? "Срыв тяги и пробуксовка" : hazard > 30 ? "Продольная волна и путь" : "Режим устойчив";
    const riskRate = hazard > 28 ? (hazard - 28) * .25 : -3.6;
    d.derailRisk = clamp(d.derailRisk + riskRate * dt, 0, 100);
    if (state.runtime.phase === "station" || d.speed < 4) d.derailRisk = clamp(d.derailRisk - 8 * dt, 0, 100);

    if (d.derailRisk > 38) {
      alert(state, "derail-risk-driver", `Риск схода ${Math.round(d.derailRisk)}%: ${d.derailCause}`, d.derailRisk > 72 ? "critical" : "warning", "driver", 5);
      alert(state, "derail-risk-gm", `Состав близок к сходу — ${Math.round(d.derailRisk)}%: ${d.derailCause}`, d.derailRisk > 72 ? "critical" : "warning", "gm", 5);
    } else { clearAlert(state, "derail-risk-driver"); clearAlert(state, "derail-risk-gm"); }

    if (d.derailRisk > 62 && d.speed > 18) {
      const stressedIndex = Math.min(state.train.cars.length - 1, Math.max(0, d.wave.findIndex(value => Math.abs(value) === maxWave) + 1));
      const stressedCar = state.train.cars[stressedIndex];
      stressedCar.wheelDamage = clamp(stressedCar.wheelDamage + (d.derailRisk - 60) * .012 * dt, 0, 100);
      stressedCar.integrity = clamp(stressedCar.integrity - (d.derailRisk - 60) * .0025 * dt, 0, 100);
    }

    if (d.derailRisk >= 99.5) {
      if (state.gm.autoCatastrophes && d.derailCooldown <= 0 && !state.train.crashed) derailCar(state, d.derailCause.toLowerCase());
      else if (state.gm.autoCatastrophes) d.derailRisk = 99;
      else { d.derailRisk = 99; alert(state, "derail-blocked-gm", "Автокатастрофы отключены: состав достиг порога схода", "critical", "gm", 8); }
    } else if (d.derailRisk < 80) clearAlert(state, "derail-blocked-gm");

    for (const carItem of derailedCars) {
      if (d.speed > 12) {
        carItem.integrity = clamp(carItem.integrity - d.speed * .0016 * dt, 0, 100);
        carItem.wheelDamage = clamp(carItem.wheelDamage + d.speed * .002 * dt, 0, 100);
      }
    }

    const currentDerailed = state.train.cars.filter(item => item.connected && item.derailed);
    if (currentDerailed.length && d.speed > 18) {
      const spill = currentDerailed.length * d.speed * .0007 * dt;
      for (const carItem of state.train.cars.filter(item => item.connected && !item.derailed)) {
        carItem.integrity = clamp(carItem.integrity - spill, 0, 100);
        carItem.wheelDamage = clamp(carItem.wheelDamage + spill * .65, 0, 100);
      }
      alert(state, "dragging-derailed-car", `Состав тащит ${currentDerailed.length === 1 ? "сошедший вагон" : `${currentDerailed.length} сошедших вагона`}: повреждение распространяется`, "critical", "all", 6);
    } else clearAlert(state, "dragging-derailed-car");

    const destroyedOnMove = state.train.cars.some(item => item.connected && item.integrity <= 2 && d.speed > 12);
    if (!state.train.crashed && (currentDerailed.length >= 3 || destroyedOnMove)) {
      state.train.crashed = true;
      d.throttle = 0;
      d.instability = 100;
      alert(state, "train-crash", "КРУШЕНИЕ СОСТАВА: дальнейшее движение решается в ролевой сцене", "critical", "all", 60);
    }

    const smooth = 100 - maxWave * 52;
    const speedFactor = d.speed > 5 ? clamp(55 + d.speed * 0.45, 0, 100) : 55;
    d.efficiency = clamp(cutoffFit * 52 + smooth * 0.3 + speedFactor * 0.18 - d.wheelSlip * 0.3 - d.brake * d.throttle * 45, 0, 100);

    if (state.runtime.phase === "moving" || state.runtime.phase === "encounter") {
      const travelled = d.speed * dt / 3600 * state.runtime.travelScale;
      state.route.distance = clamp(state.route.distance - travelled, 0, 999);
      state.route.travelled += travelled;
    }
    state.train.integrity = clamp(state.train.cars.reduce((sum, item) => sum + item.integrity, 0) / state.train.cars.length - d.instability * 0.04, 0, 100);
    d.previousThrottle = d.throttle;
    d.previousBrake = d.brake;
  }

  function updateSecurity(state, dt, effects) {
    const s = state.security;
    const defense = state.engineer.circuits.defense;
    const shacklesCircuit = state.engineer.circuits.shackles;
    const defenseFactor = clamp(defense.pressure / 70, 0, 1.45);
    const activeTargets = s.targets.filter(target => target.alive);

    for (const sector of Object.values(s.sectors)) {
      sector.reload = clamp(sector.reload + (0.16 + defenseFactor * 0.22) * dt, 0, 1);
      sector.heat = clamp(sector.heat - (0.12 + defenseFactor * 0.22) * dt, 0, 100);
    }
    s.rhythm = (s.rhythm + dt * (0.62 + state.driver.speed / 260)) % 1;
    for (const target of activeTargets) {
      target.distance = Math.max(0, target.distance - (target.speed + state.driver.speed * 0.18) * dt / 3.6);
      target.bearing = (target.bearing + target.drift * dt + 1) % 1;
      if (target.distance <= 0) {
        if (s.barrier.enabled && s.barrier.charge > 8) {
          s.barrier.charge = clamp(s.barrier.charge - target.damage * 0.8, 0, 100);
          target.alive = false;
          log(state, `Барьер поглотил контакт: ${target.name}`, "warning");
        } else {
          const victim = state.train.cars[Math.floor(Math.random() * state.train.cars.length)];
          victim.integrity = clamp(victim.integrity - target.damage, 0, 100);
          target.alive = false;
          alert(state, `boarding-${target.id}`, `${target.name}: контакт с вагоном ${victim.id}`, "critical", "warden", 12);
        }
      }
    }
    s.targets = s.targets.filter(target => target.alive || target.distance > -50).slice(-24);

    const barrierDemand = s.barrier.enabled ? 0.16 + s.barrier.power * 0.52 : 0;
    s.barrier.charge = clamp(s.barrier.charge + (defenseFactor * 0.42 - barrierDemand - effects.defenseLoss * 0.2) * dt, 0, 100);
    const shackleSupply = clamp(shacklesCircuit.pressure / 72, 0, 1.4) * s.shackles.power * (1 - effects.shackleLoss);
    const shackleDemand = state.god.demand;
    s.shackles.stability = clamp(s.shackles.stability + (shackleSupply - shackleDemand) * 1.2 * dt - state.god.resonance * 0.0015 * dt, 0, 100);
    s.shackles.anchors = s.shackles.anchors.map((value, index) => (value + dt * (0.08 + state.god.pressure / 520 + index * 0.013)) % 1);

    const restraint = clamp((s.shackles.stability / 100) * (0.48 + shackleSupply * 0.62), 0.05, 1.2);
    state.god.demand = clamp(0.18 + state.god.pressure / 115 + state.god.resonance / 220, 0.18, 1.15);
    const growthMultiplier = clamp(1.8 - restraint, 0.28, 2.2);
    state.god.pressure = clamp(state.god.pressure + state.god.growth * state.gm.godGrowth * growthMultiplier * dt, 0, 100);
    state.god.resonance = clamp(state.god.resonance + (state.god.pressure / 250 - restraint * 0.22) * dt, 0, 100);
    state.god.distortion = clamp((state.god.pressure - 20) * 0.55 + effects.sensorDrift, 0, 100);

    const turretScore = 100 - Math.max(...Object.values(s.sectors).map(item => item.heat)) * 0.45;
    s.efficiency = clamp(turretScore * 0.3 + s.barrier.charge * 0.25 + s.shackles.stability * 0.45, 0, 100);
    if (s.shackles.stability < 28) alert(state, "shackle-low", "Оковы теряют согласование", "critical", "warden", 7);
    else clearAlert(state, "shackle-low");
    if (s.barrier.enabled && s.barrier.charge < 12) alert(state, "barrier-low", "Барьер почти разряжен", "warning", "warden", 7);
    else clearAlert(state, "barrier-low");
  }

  function updateStations(state, dt) {
    if (state.runtime.phase !== "station") return;
    state.driver.throttle = 0;
    state.driver.brake = Math.max(state.driver.brake, 0.45);
    if (state.gm.stationRecovery) {
      state.driver.brakeHeat = approach(state.driver.brakeHeat, 0, 0.055, dt);
      state.driver.brakeSlide = approach(state.driver.brakeSlide, 0, 0.18, dt);
      state.driver.brakeShock = approach(state.driver.brakeShock, 0, 0.14, dt);
      state.driver.derailRisk = approach(state.driver.derailRisk, 0, 0.08, dt);
      state.driver.instability = approach(state.driver.instability, 0, 0.09, dt);
      state.engineer.overdrive.instability = approach(state.engineer.overdrive.instability, 0, 0.04, dt);
      for (const circuitItem of Object.values(state.engineer.circuits)) circuitItem.buffer = clamp(circuitItem.buffer + 0.06 * dt, 0, 100);
      state.security.barrier.charge = clamp(state.security.barrier.charge + 0.035 * dt, 0, 100);
    }
  }

  function updateAlerts(state, dt) {
    for (const item of state.alerts) item.ttl -= dt;
    state.alerts = state.alerts.filter(item => item.ttl > 0);
    if (state.god.pressure > 72) alert(state, "god-pressure", "Саркофаг давит на оковы изнутри", "critical", "warden", 7);
    if (state.train.integrity < 35) alert(state, "train-integrity", "Целостность состава критическая", "critical", "all", 7);
  }

  function step(state, rawDt = 0.1) {
    if (!state || state.runtime.paused) return state;
    const dt = clamp(rawDt * state.runtime.timeScale, 0, 1.5);
    state.runtime.elapsed += dt;
    const effects = failureEffects(state);
    updateEngineer(state, dt, effects);
    updateDriver(state, dt, effects);
    updateSecurity(state, dt, effects);
    updateStations(state, dt);
    updateAlerts(state, dt);
    state.updatedAt = Date.now();
    state.revision += 1;
    return state;
  }

  function setValue(state, path, value) {
    const parts = String(path).split(".");
    let cursor = state;
    for (let index = 0; index < parts.length - 1; index += 1) {
      if (!cursor[parts[index]]) return false;
      cursor = cursor[parts[index]];
    }
    cursor[parts.at(-1)] = value;
    return true;
  }

  function spawnTargets(state, sector = "front", count = 3, kind = "stalker") {
    const names = {
      stalker: ["Костяная стая", "Пепельные гончие", "Мёртвые разведчики"],
      boarder: ["Абордажники", "Войско без знамён", "Прыгуны Межи"],
      heavy: ["Осадная тварь", "Железный паломник", "Пустой колосс"],
    };
    for (let index = 0; index < count; index += 1) {
      const heavy = kind === "heavy";
      state.security.targets.push({
        id: `target-${Date.now()}-${index}-${Math.floor(Math.random() * 999)}`,
        name: names[kind]?.[index % names[kind].length] || names.stalker[index % 3],
        sector,
        kind,
        health: heavy ? 4 : kind === "boarder" ? 2 : 1,
        maxHealth: heavy ? 4 : kind === "boarder" ? 2 : 1,
        distance: 430 + index * 85 + Math.random() * 90,
        speed: heavy ? 18 : kind === "boarder" ? 42 : 33,
        bearing: 0.15 + Math.random() * 0.7,
        drift: (Math.random() - 0.5) * 0.08,
        damage: heavy ? 24 : kind === "boarder" ? 14 : 8,
        alive: true,
      });
    }
    alert(state, `targets-${sector}`, `Новые сигнатуры: сектор «${sectorLabel(sector)}»`, "warning", "warden", 10);
  }

  function sectorLabel(id) {
    return ({ front: "нос", right: "правый борт", rear: "хвост", left: "левый борт" })[id] || id;
  }

  function fireTurrets(state, phase = state.security.rhythm) {
    const s = state.security;
    const sector = s.sectors[s.sector];
    const target = s.targets.find(item => item.id === s.selectedTarget && item.alive && item.sector === s.sector);
    if (!s.turretsEnabled) return { ok: false, text: "Турели обесточены" };
    if (!target) return { ok: false, text: "Цель не захвачена" };
    if (sector.reload < 0.98) return { ok: false, text: "Цикл перезарядки не завершён" };
    if (sector.heat >= 92) return { ok: false, text: "Сектор заблокирован перегревом" };
    const rhythmError = Math.min(Math.abs(phase - 0.5), 1 - Math.abs(phase - 0.5));
    const rhythmScore = clamp(1 - rhythmError / 0.24, 0, 1);
    const distanceScore = clamp(1 - target.distance / 1100, 0.35, 1);
    const hit = rhythmScore * 0.72 + distanceScore * 0.28 >= 0.52;
    sector.reload = 0;
    sector.heat = clamp(sector.heat + 19 + (1 - rhythmScore) * 8, 0, 100);
    sector.shots += 1;
    if (hit) {
      target.health -= rhythmScore > 0.82 ? 2 : 1;
      if (target.health <= 0) {
        target.alive = false;
        log(state, `Сигнатура уничтожена: ${target.name}`);
      }
      return { ok: true, hit: true, text: target.alive ? "Попадание. Цель повреждена" : "Цель уничтожена", score: rhythmScore };
    }
    return { ok: true, hit: false, text: "Залп прошёл мимо", score: rhythmScore };
  }

  function syncShackles(state, phase) {
    const anchors = state.security.shackles.anchors;
    const nearest = Math.min(...anchors.map(value => Math.min(Math.abs(value - phase), 1 - Math.abs(value - phase))));
    const score = clamp(1 - nearest / 0.17, 0, 1);
    state.security.shackles.stability = clamp(state.security.shackles.stability + 4 + score * 9, 0, 100);
    state.god.resonance = clamp(state.god.resonance - 1.2 - score * 2.4, 0, 100);
    state.security.shackles.lastSync = score;
    return { ok: score > 0.3, score, text: score > 0.75 ? "Оковы сведены в единый такт" : score > 0.3 ? "Частичное согласование" : "Импульс ушёл в противофазу" };
  }

  function detach(state, couplingIndex) {
    const index = Number(couplingIndex);
    if (!Number.isInteger(index) || index < 0 || index >= state.security.couplings.length) return { ok: false, text: "Неизвестная сцепка" };
    if (state.security.detachArmed !== index) {
      state.security.detachArmed = index;
      return { ok: true, armed: true, text: `Сцепка ${index + 1} подготовлена. Нажмите ещё раз для отсечения` };
    }
    state.security.couplings[index] = false;
    for (let carIndex = index + 1; carIndex < state.train.cars.length; carIndex += 1) state.train.cars[carIndex].connected = false;
    state.security.detachArmed = null;
    log(state, `Состав отсечён после вагона ${index + 1}`, "critical");
    return { ok: true, detached: true, text: `Вагоны после сцепки ${index + 1} отсоединены` };
  }

  function applyAction(state, action = {}) {
    const type = String(action.type || "");
    const value = action.value;
    let feedback = null;
    if (type === "driver.throttle") state.driver.throttle = clamp(value, 0, 1);
    else if (type === "driver.brake") state.driver.brake = clamp(value, 0, 1);
    else if (type === "driver.cutoff") state.driver.cutoff = clamp(value, 0.12, 0.82);
    else if (type === "driver.cutoffMode") state.driver.cutoffMode = ["start", "run", "power"].includes(value) ? value : "run";
    else if (type === "driver.sand") state.driver.sand = Boolean(value);
    else if (type === "driver.engine") { state.driver.engineOn = Boolean(value); feedback = { ok: true, text: state.driver.engineOn ? "Тяговая машина приняла ход" : "Тяговая машина отсечена" }; }
    else if (type === "engineer.feed") state.engineer.feed = clamp(value, 0, 1);
    else if (type === "engineer.injector") state.engineer.injector = clamp(value, 0, 1);
    else if (type === "engineer.manualCoal") {
      if (state.engineer.fuel <= 0.4) return { ok: false, text: "В тендере не осталось топлива" };
      state.engineer.fuel = clamp(state.engineer.fuel - 0.4, 0, 100);
      state.engineer.heat = clamp(state.engineer.heat + 5.5, 0, 115);
      log(state, `${action.actor || "Кочегар"} вручную усиливает топку`);
    }
    else if (type === "engineer.valve" && CIRCUITS.includes(action.circuit)) state.engineer.circuits[action.circuit].targetValve = clamp(value, 0, 1);
    else if (type === "engineer.isolate" && CIRCUITS.includes(action.circuit)) { state.engineer.circuits[action.circuit].isolated = Boolean(value); feedback = { ok: true, text: `${CIRCUIT_LABELS[action.circuit]} контур ${value ? "изолирован" : "возвращён в коллектор"}` }; }
    else if (type === "engineer.vent") state.engineer.vent = Boolean(value);
    else if (type === "engineer.overdrive.arm") state.engineer.overdrive.armed = Boolean(value);
    else if (type === "engineer.overdrive.target" && CIRCUITS.includes(value)) state.engineer.overdrive.circuit = value;
    else if (type === "engineer.overdrive.toggle") {
      if (state.engineer.overdrive.armed || state.engineer.overdrive.active) {
        state.engineer.overdrive.active = !state.engineer.overdrive.active;
        if (!state.engineer.overdrive.active) state.engineer.overdrive.armed = false;
        log(state, state.engineer.overdrive.active ? `Форсаж направлен в ${CIRCUIT_LABELS[state.engineer.overdrive.circuit].toLowerCase()} контур` : "Форсажный байпас закрыт", state.engineer.overdrive.active ? "critical" : "info");
      }
    }
    else if (type === "engineer.crossfeed") state.engineer.crossfeed = action.from && action.to && action.from !== action.to ? { from: action.from, to: action.to } : null;
    else if (type === "security.sector" && state.security.sectors[value]) { state.security.sector = value; state.security.selectedTarget = null; }
    else if (type === "security.target") {
      state.security.selectedTarget = value;
      const target = state.security.targets.find(item => item.id === value && item.alive);
      feedback = target ? { ok: true, text: `Захват подтверждён: ${target.name}` } : { ok: false, text: "Сигнатура уже потеряна" };
    }
    else if (type === "security.fire") return fireTurrets(state, Number(action.phase));
    else if (type === "security.turrets") { state.security.turretsEnabled = Boolean(value); feedback = { ok: true, text: value ? "Турельная сеть запитана" : "Турельная сеть отключена" }; }
    else if (type === "security.barrier") { state.security.barrier.enabled = Boolean(value); feedback = { ok: true, text: value ? "Барьер развёрнут" : "Барьер свёрнут" }; }
    else if (type === "security.barrierPower") state.security.barrier.power = clamp(value, 0, 1);
    else if (type === "security.bulkhead") { const index = Number(action.index); state.security.bulkheads[index] = Boolean(value); feedback = { ok: true, text: `Перегородка ${index + 1}: ${value ? "закрыта" : "открыта"}` }; }
    else if (type === "security.detach") return detach(state, action.index);
    else if (type === "security.shacklePower") state.security.shackles.power = clamp(value, 0, 1);
    else if (type === "security.shackleSync") return syncShackles(state, Number(action.phase));
    else if (type === "attention") {
      state.runtime.attention = true;
      alert(state, `attention-${action.actorId || action.actor || "crew"}`, `${action.actor || "Экипаж"} вызывает внимание ГМа`, "warning", "gm", 30);
      const request = state.alerts.find(item => item.id === `attention-${action.actorId || action.actor || "crew"}`);
      if (request) request.actorId = action.actorId || null;
    }
    else if (type === "alarm") alert(state, `crew-alarm-${Date.now()}`, `${action.actor || "Экипаж"}: общая тревога`, "critical", "all", 18);
    else if (type === "gm.damage") {
      const amount = clamp(Number(action.amount) || 10, 1, 100);
      const shock = clamp(Number(action.shock) || amount * .7, 0, 100);
      let targets = [];
      if (action.car === "all") targets = state.train.cars;
      else if (action.car === "random") {
        const connected = state.train.cars.filter(item => item.connected);
        if (connected.length) targets = [connected[Math.floor(Math.random() * connected.length)]];
      } else {
        const target = state.train.cars[Number(action.car)]; if (target) targets = [target];
      }
      for (const carItem of targets) carItem.integrity = clamp(carItem.integrity - amount, 0, 100);
      state.driver.instability = clamp(state.driver.instability + shock, 0, 100);
      state.driver.wave = state.driver.wave.map((wave, index) => clamp(wave + (index % 2 ? -1 : 1) * shock / 55, -1.5, 1.5));
      state.train.integrity = clamp(state.train.cars.reduce((sum, item) => sum + item.integrity, 0) / state.train.cars.length, 0, 100);
      const names = targets.length === state.train.cars.length ? "всему составу" : targets.map(item => `вагону «${item.name}»`).join(", ");
      alert(state, `damage-${Date.now()}`, `Удар нанесён ${names}: −${Math.round(amount)}`, amount >= 25 ? "critical" : "warning", "all", 14);
      feedback = { ok: true, text: `Повреждение применено: ${names}` };
    }
    else if (type === "gm.cascade") {
      for (const subsystem of ["boiler", "brakes", "defense", "coupling"]) addFailure(state, subsystem, 2, false);
      state.driver.instability = clamp(state.driver.instability + 28, 0, 100);
      state.driver.wave = state.driver.wave.map((wave, index) => clamp(wave + (index % 2 ? -.75 : .75), -1.5, 1.5));
      state.god.pressure = clamp(state.god.pressure + 10, 0, 100);
      state.god.resonance = clamp(state.god.resonance + 18, 0, 100);
      for (const carItem of state.train.cars) carItem.integrity = clamp(carItem.integrity - 6, 0, 100);
      state.train.integrity = clamp(state.train.cars.reduce((sum, item) => sum + item.integrity, 0) / state.train.cars.length, 0, 100);
      alert(state, `cascade-${Date.now()}`, "Каскадный срыв: несколько систем потеряли устойчивость", "critical", "all", 20);
      feedback = { ok: true, text: "Каскадный срыв запущен" };
    }
    else if (type === "gm.autoCatastrophes") { state.gm.autoCatastrophes = Boolean(value); feedback = { ok: true, text: value ? "Автоматические катастрофы включены" : "Автоматические катастрофы отключены" }; }
    else if (type === "gm.repairCar" || type === "gm.rerailCar") {
      let targets = [];
      if (action.car === "all") targets = state.train.cars;
      else if (action.car === "random") {
        const sorted = [...state.train.cars].sort((a, b) => (Number(b.derailed) * 100 + (100 - b.integrity)) - (Number(a.derailed) * 100 + (100 - a.integrity)));
        if (sorted[0]) targets = [sorted[0]];
      } else { const target = state.train.cars[Number(action.car)]; if (target) targets = [target]; }
      if (type === "gm.repairCar") for (const carItem of targets) { carItem.integrity = clamp(carItem.integrity + (Number(action.amount) || 25), 0, 100); carItem.wheelDamage = clamp(carItem.wheelDamage - 30, 0, 100); }
      else for (const carItem of targets) { carItem.derailed = false; carItem.wheelDamage = clamp(carItem.wheelDamage - 20, 0, 100); }
      state.train.integrity = clamp(state.train.cars.reduce((sum, item) => sum + item.integrity, 0) / state.train.cars.length, 0, 100);
      if (!state.train.cars.some(item => item.derailed)) { state.train.crashed = false; clearAlert(state, "train-crash"); clearAlert(state, "dragging-derailed-car"); }
      feedback = { ok: true, text: type === "gm.repairCar" ? "Ремонт вагона подтверждён" : "Вагон возвращён на рельсы" };
    }
    else if (type === "gm.restoreCoupling") {
      const index = clamp(Math.floor(Number(action.index)), 0, state.security.couplings.length - 1);
      state.security.couplings[index] = true;
      state.train.cars[0].connected = true;
      for (let carIndex = 0; carIndex < state.security.couplings.length; carIndex += 1) state.train.cars[carIndex + 1].connected = state.train.cars[carIndex].connected && state.security.couplings[carIndex];
      feedback = { ok: true, text: `Сцепка ${index + 1} восстановлена` };
    }
    else if (type === "gm.set") {
      setValue(state, action.path, value);
      if (action.path === "train.integrity") for (const item of state.train.cars) item.integrity = clamp(value);
    }
    else if (type === "gm.phase") state.runtime.phase = ["moving", "station", "encounter"].includes(value) ? value : state.runtime.phase;
    else if (type === "gm.pause") state.runtime.paused = Boolean(value);
    else if (type === "gm.timeScale") state.runtime.timeScale = clamp(value, 0.25, 4);
    else if (type === "gm.light" && STATIONS.includes(action.station)) state.runtime.light[action.station] = Boolean(value);
    else if (type === "gm.lightAll") for (const station of STATIONS) state.runtime.light[station] = Boolean(value);
    else if (type === "gm.efficiency") state.runtime.showEfficiency = Boolean(value);
    else if (type === "gm.failure") addFailure(state, action.subsystem, Number(action.severity) || 1, Boolean(action.hidden));
    else if (type === "gm.repair") {
      const failure = state.failures.find(item => item.id === action.id);
      if (failure) { failure.resolved = true; clearAlert(state, `failure-${failure.subsystem}`); log(state, `Поломка отмечена исправленной: ${failureLabel(failure.subsystem)}`); }
    }
    else if (type === "gm.targets") spawnTargets(state, action.sector, Number(action.count) || 3, action.kind || "stalker");
    else if (type === "gm.falseReading") state.gm.falseReadings[action.gauge] = Number(action.offset) || 0;
    else if (type === "gm.clearFalse") state.gm.falseReadings = {};
    else if (type === "gm.message") state.route.message = String(value || "").slice(0, 240);
    else if (type === "gm.clearAttention") state.runtime.attention = false;
    else if (type === "gm.dismissAlert") {
      clearAlert(state, action.id);
      state.runtime.attention = state.alerts.some(item => item.id.startsWith("attention-"));
    }
    else return { ok: false, text: "Команда не распознана" };
    state.updatedAt = Date.now();
    state.revision += 1;
    return feedback || { ok: true };
  }

  function displayed(state, path, fallback = 0) {
    const parts = String(path).split(".");
    let value = state;
    for (const part of parts) value = value?.[part];
    const offset = Number(state.gm.falseReadings[path] || 0);
    return typeof value === "number" ? value + offset : value ?? fallback;
  }

  function normalize(raw) {
    const base = createInitialState();
    if (!raw || typeof raw !== "object") return base;
    const merge = (target, source) => {
      for (const [key, value] of Object.entries(source || {})) {
        if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) merge(target[key], value);
        else target[key] = copy(value);
      }
      return target;
    };
    return merge(base, raw);
  }

  global.DM_MODEL = { CIRCUITS, CIRCUIT_LABELS, STATIONS, addFailure, applyAction, clamp, copy, createInitialState, displayed, failureLabel, normalize, round, sectorLabel, spawnTargets, step };
})(typeof window !== "undefined" ? window : globalThis);
