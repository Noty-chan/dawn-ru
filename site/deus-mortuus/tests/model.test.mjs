import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { globalThis: {}, Date, Math, console };
context.globalThis = context;
vm.runInNewContext(fs.readFileSync(path.join(root, "model.js"), "utf8"), context);
const M = context.DM_MODEL;
assert.ok(M, "model must load");

const run = (state, seconds, dt = .1) => {
  state.runtime.paused = false;
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) M.step(state, dt);
  return state;
};

{
  const state = M.createInitialState();
  const before = state.driver.steamChest;
  M.applyAction(state, { type: "driver.throttle", value: 1 });
  state.runtime.paused = false;
  M.step(state, .1);
  assert.ok(state.driver.steamChest > before, "steam chest starts responding immediately");
  assert.ok(state.driver.steamChest < state.engineer.circuits.traction.pressure, "physical response remains delayed");
}

{
  const state = M.createInitialState();
  state.driver.speed = 80;
  state.driver.cutoffMode = "start";
  run(state, 1);
  const wasteful = state.driver.efficiency;
  state.driver.cutoffMode = "run";
  run(state, 2);
  assert.ok(state.driver.efficiency > wasteful, "short cutoff is more efficient at cruising speed");
}

{
  const state = M.createInitialState();
  state.driver.throttle = 0;
  run(state, 1);
  state.driver.throttle = 1;
  run(state, 1);
  assert.ok(Math.abs(state.driver.wave[0]) > Math.abs(state.driver.wave[4]), "slack wave travels from locomotive to tail");
}

{
  const state = M.createInitialState();
  for (const id of ["pneumatic", "shackles", "auxiliary"]) {
    M.applyAction(state, { type: "engineer.valve", circuit: id, value: 0 });
    run(state, 2);
    assert.ok(state.engineer.circuits[id].targetValve > 0, `${id} cannot be manually closed to zero`);
  }
}

{
  const state = M.createInitialState();
  M.applyAction(state, { type: "engineer.overdrive.arm", value: true });
  M.applyAction(state, { type: "engineer.overdrive.toggle" });
  run(state, 10);
  assert.ok(state.engineer.overdrive.intensity > 5, "overdrive keeps scaling while open");
  const intensity = state.engineer.overdrive.intensity;
  M.applyAction(state, { type: "engineer.overdrive.toggle" });
  run(state, 2);
  assert.ok(state.engineer.overdrive.intensity < intensity, "closing bypass starts stabilization");
}

{
  const state = M.createInitialState();
  const before = state.god.pressure;
  state.security.shackles.stability = 100;
  state.security.shackles.power = 1;
  run(state, 20);
  assert.ok(state.god.pressure >= before, "excellent containment slows but never reverses divine pressure");
}

{
  const state = M.createInitialState();
  M.spawnTargets(state, "front", 1, "stalker");
  const target = state.security.targets[0];
  M.applyAction(state, { type: "security.target", value: target.id });
  const result = M.applyAction(state, { type: "security.fire", phase: .5 });
  assert.equal(result.ok, true);
  assert.equal(result.hit, true, "center rhythm shot must hit");
  assert.ok(state.security.sectors.front.heat > 9, "shot creates heat");
}

{
  const state = M.createInitialState();
  const armed = M.applyAction(state, { type: "security.detach", index: 3 });
  assert.equal(armed.armed, true);
  const detached = M.applyAction(state, { type: "security.detach", index: 3 });
  assert.equal(detached.detached, true);
  assert.equal(state.train.cars[4].connected, false);
  assert.equal(state.train.cars[5].connected, false);
}

{
  const state = M.createInitialState();
  M.applyAction(state, { type: "gm.damage", car: "2", amount: 25, shock: 20 });
  assert.equal(state.train.cars[2].integrity, 75, "GM damage targets the selected car");
  assert.ok(state.driver.instability >= 20, "GM damage creates an immediate consist shock");
  M.applyAction(state, { type: "gm.cascade" });
  assert.equal(state.failures.filter(item => !item.resolved).length, 4, "cascade creates four simultaneous failures");
  assert.ok(state.god.pressure >= 19, "cascade worsens divine pressure");
}

{
  const state = M.createInitialState();
  state.driver.speed = 120;
  state.driver.brake = 1;
  run(state, 9);
  assert.ok(state.driver.derailRisk > 40, "slamming the brake at speed creates a visible derailment risk");
  assert.ok(state.train.cars.some(item => item.derailed), "uncontrolled emergency braking can derail a local car");
}

{
  const state = M.createInitialState();
  state.driver.speed = 140;
  state.driver.brake = 1;
  state.gm.autoCatastrophes = false;
  run(state, 20);
  assert.equal(state.train.cars.some(item => item.derailed), false, "GM can disable automatic derailments");
  assert.equal(state.driver.derailRisk, 99, "disabled automatic derailment holds at the decision threshold");
  assert.ok(state.alerts.some(item => item.id === "derail-blocked-gm"), "GM receives a signal when the held threshold is reached");
}

{
  const state = M.createInitialState();
  state.train.cars[3].integrity = 34;
  state.train.cars[3].wheelDamage = 70;
  state.train.cars[3].derailed = true;
  M.applyAction(state, { type: "gm.repairCar", car: "3", amount: 25 });
  assert.equal(state.train.cars[3].integrity, 59, "GM confirms the exact amount of roleplayed car repair");
  M.applyAction(state, { type: "gm.rerailCar", car: "3" });
  assert.equal(state.train.cars[3].derailed, false, "GM can manually return a selected car to the rails");
  M.applyAction(state, { type: "security.detach", index: 2 });
  M.applyAction(state, { type: "security.detach", index: 2 });
  M.applyAction(state, { type: "gm.restoreCoupling", index: 2 });
  assert.equal(state.security.couplings[2], true, "GM can restore an individual coupling after roleplay");
  assert.equal(state.train.cars[5].connected, true, "restoring a coupling rebuilds the connected tail chain");
}

{
  const state = M.createInitialState();
  state.runtime.paused = false;
  state.driver.speed = 45;
  for (const index of [1, 3, 5]) state.train.cars[index].derailed = true;
  M.step(state, .1);
  assert.equal(state.train.crashed, true, "dragging several derailed cars becomes a full consist crash");
  assert.ok(state.alerts.some(item => item.id === "train-crash"), "the crash is surfaced to the crew and GM");
}

{
  const restored = M.normalize({ driver: { speed: 99 }, runtime: { paused: false } });
  assert.equal(restored.driver.speed, 99);
  assert.equal(restored.engineer.circuits.shackles.minimum, .18, "normalization restores newly added defaults");
}

{
  const state = M.createInitialState();
  run(state, 180);
  assert.ok(state.driver.speed > 20, "default light-mode setup must cruise without immediate collapse");
  assert.equal(state.alerts.length, 0, "first calm minutes leave room for roleplay before attention is demanded");
}

for (const required of ["index.html", "console.css", "console.js", "network.js", "config.js"]) {
  assert.ok(fs.existsSync(path.join(root, required)), required);
}

console.log("OK: Deus mortuus simulation invariants validated.");
