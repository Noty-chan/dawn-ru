import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const edgeCandidates = [
  process.env.EDGE_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const edge = edgeCandidates.find(candidate => fs.existsSync(candidate));
if (!edge) throw new Error("Microsoft Edge not found; set EDGE_PATH to run browser smoke test");

const base = process.env.DM_TEST_URL || "http://127.0.0.1:8899/deus-mortuus/";
const cloud = process.env.DM_CLOUD === "1";
const output = process.env.DM_SCREENSHOT_DIR || path.join(os.tmpdir(), "deus-mortuus-qa");
const windowSize = process.env.DM_WINDOW_SIZE || "1440,900";
const suffix = process.env.DM_SCREENSHOT_SUFFIX ? `-${process.env.DM_SCREENSHOT_SUFFIX}` : "";
fs.mkdirSync(output, { recursive: true });
const port = 9400 + Math.floor(Math.random() * 300);
const profile = path.join(os.tmpdir(), `dm-edge-${Date.now()}`);
const child = spawn(edge, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${windowSize}`, cloud ? `${base}?gm=1` : `${base}?gm=1&local=1`,
], { stdio: "ignore" });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(task, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { const value = await task(); if (value) return value; } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out: ${label}`);
}
async function targets(debugPort = port) { return fetch(`http://127.0.0.1:${debugPort}/json/list`).then(response => response.json()); }

class CDP {
  constructor(url) {
    this.id = 0; this.pending = new Map(); this.errors = [];
    this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
    this.ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id); this.pending.delete(message.id);
        if (message.error) pending?.reject(new Error(message.error.message)); else pending?.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") this.errors.push(message.params.exceptionDetails.text || "Runtime exception");
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error") this.errors.push(message.params.entry.text);
    };
  }
  async send(method, params = {}) {
    await this.ready; const id = ++this.id;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify({ id, method, params }));
    return result;
  }
  async eval(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async screenshot(file) {
    const data = await this.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(data.data, "base64"));
  }
  close() { this.ws.close(); }
}

let gm; let player; let guide; let playerChild;
try {
  const gmTarget = await until(async () => (await targets()).find(item => item.type === "page" && item.url.includes("deus-mortuus")), "GM target");
  gm = new CDP(gmTarget.webSocketDebuggerUrl);
  await gm.send("Runtime.enable"); await gm.send("Log.enable"); await gm.send("Page.enable");
  await until(() => gm.eval("document.readyState !== 'loading' && Boolean(window.DM_MODEL && window.DM_NETWORK)"), "GM modules");
  if (!cloud) await gm.eval("window.DEUS_MORTUUS_CONFIG={supabaseUrl:'',supabaseKey:''};true");
  await gm.eval(`document.getElementById("gm-name").value="Смотритель теста";document.getElementById("create-form").requestSubmit();true`);
  await until(() => gm.eval("!document.getElementById('game').hidden"), "GM room creation");
  const code = await gm.eval("document.getElementById('gm-room-code').textContent.trim()");
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  await gm.eval("document.getElementById('gm-pause').click();true");
  await until(() => gm.eval("document.getElementById('phase-label').textContent.includes('ДВИЖЕНИЕ')"), "simulation start");
  await sleep(450);
  await gm.screenshot(path.join(output, `gm${suffix}.png`));

  let playerTarget;
  if (cloud) {
    const playerPort = 9800 + Math.floor(Math.random() * 300);
    const playerProfile = path.join(os.tmpdir(), `dm-edge-player-${Date.now()}`);
    playerChild = spawn(edge, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
      `--remote-debugging-port=${playerPort}`, `--user-data-dir=${playerProfile}`, `--window-size=${windowSize}`, base,
    ], { stdio: "ignore" });
    playerTarget = await until(async () => (await targets(playerPort)).find(item => item.type === "page" && item.url.includes("deus-mortuus")), "cloud player target");
  } else {
    const created = await gm.send("Target.createTarget", { url: `${base}?local=1` });
    playerTarget = await until(async () => (await targets()).find(item => item.id === created.targetId), "player target");
  }
  player = new CDP(playerTarget.webSocketDebuggerUrl);
  await player.send("Runtime.enable"); await player.send("Log.enable"); await player.send("Page.enable");
  await until(() => player.eval("document.readyState !== 'loading' && Boolean(window.DM_NETWORK)"), "player modules");
  if (!cloud) await player.eval("window.DEUS_MORTUUS_CONFIG={supabaseUrl:'',supabaseKey:''};true");
  await player.eval(`document.getElementById("join-name").value="Лисса Вейр";document.getElementById("join-code").value="${code}";document.getElementById("join-form").requestSubmit();true`);
  await until(() => player.eval("!document.getElementById('game').hidden"), "player join");
  try {
    await until(() => gm.eval("document.getElementById('gm-player-list').textContent.includes('Лисса Вейр')"), "GM sees player");
  } catch (error) {
    const diagnostic = {
      gmNetwork: await gm.eval("window.DM_NETWORK.state()"),
      gmList: await gm.eval("document.getElementById('gm-player-list').textContent"),
      gmToast: await gm.eval("document.getElementById('toast').textContent"),
      gmErrors: gm.errors,
      playerNetwork: await player.eval("window.DM_NETWORK.state()"),
      playerToast: await player.eval("document.getElementById('toast').textContent"),
      playerErrors: player.errors,
    };
    throw new Error(`${error.message}: ${JSON.stringify(diagnostic)}`);
  }
  await gm.eval(`window.__dmRoleSelect=document.querySelector("#gm-player-list select");window.__dmRoleSelect.focus();true`);
  await sleep(450);
  assert.equal(await gm.eval("window.__dmRoleSelect === document.querySelector('#gm-player-list select') && window.__dmRoleSelect.isConnected"), true, "role selector must not be rebuilt while it is open");
  await gm.eval(`(()=>{const select=document.querySelector("#gm-player-list select");select.value="driver";select.dispatchEvent(new Event("change",{bubbles:true}));return true})()`);
  try {
    await until(() => player.eval("!document.getElementById('driver-panel').hidden"), "driver assignment");
  } catch (error) {
    const diagnostic = {
      gmNetwork: await gm.eval("window.DM_NETWORK.state()"),
      gmList: await gm.eval("document.getElementById('gm-player-list').textContent"),
      gmToast: await gm.eval("document.getElementById('toast').textContent"),
      playerNetwork: await player.eval("window.DM_NETWORK.state()"),
      playerPanel: await player.eval("({waiting:!document.getElementById('waiting-panel').hidden,driver:!document.getElementById('driver-panel').hidden})"),
      playerToast: await player.eval("document.getElementById('toast').textContent"),
      gmErrors: gm.errors,
      playerErrors: player.errors,
    };
    throw new Error(`${error.message}: ${JSON.stringify(diagnostic)}`);
  }
  await player.eval(`(()=>{const input=document.getElementById("throttle-input");input.value="82";input.dispatchEvent(new Event("input",{bubbles:true}));return true})()`);
  try {
    await until(() => player.eval("document.getElementById('throttle-output').value === '82%'"), "shared throttle command");
  } catch (error) {
    const diagnostic = {
      playerOutput: await player.eval("document.getElementById('throttle-output').value"),
      playerNetwork: await player.eval("window.DM_NETWORK.state()"),
      playerToast: await player.eval("document.getElementById('toast').textContent"),
      gmOutput: await gm.eval("document.getElementById('throttle-output').value"),
      gmToast: await gm.eval("document.getElementById('toast').textContent"),
    };
    throw new Error(`${error.message}: ${JSON.stringify(diagnostic)}`);
  }
  const tractionBefore = Number(await player.eval("document.getElementById('traction-reading').textContent"));
  await until(() => player.eval(`Math.abs(Number(document.getElementById('traction-reading').textContent)-${tractionBefore}) >= 2`), "driver responds to throttle", 7000);
  assert.equal(await player.eval("document.documentElement.scrollWidth <= window.innerWidth + 1"), true, "driver must not overflow horizontally");
  await sleep(400); await player.screenshot(path.join(output, `driver${suffix}.png`));

  await gm.eval(`(()=>{const select=document.querySelector("#gm-player-list select");select.value="engineer";select.dispatchEvent(new Event("change",{bubbles:true}));return true})()`);
  await until(() => player.eval("!document.getElementById('engineer-panel').hidden"), "engineer assignment");
  const valveBefore = Number(await player.eval("document.querySelector('.circuit .valve-wheel').getAttribute('aria-valuenow')"));
  await player.eval("document.querySelector('.circuit .valve-step[data-step=\"8\"]').click();true");
  await until(() => player.eval(`Number(document.querySelector('.circuit .valve-wheel').getAttribute('aria-valuenow'))>${valveBefore}`), "rotary valve command");
  assert.equal(await player.eval("document.documentElement.scrollWidth <= window.innerWidth + 1"), true, "engineer must not overflow horizontally");
  await sleep(400); await player.screenshot(path.join(output, `engineer${suffix}.png`));

  await gm.eval(`(()=>{const select=document.querySelector("#gm-player-list select");select.value="warden";select.dispatchEvent(new Event("change",{bubbles:true}));return true})()`);
  await until(() => player.eval("!document.getElementById('warden-panel').hidden"), "warden assignment");
  await sleep(800);
  assert.equal(await player.eval("document.querySelectorAll('#target-dots [data-target]').length"), 0, "targets must not appear before a GM event");
  await player.eval("window.__dmBulkhead=document.querySelector('#bulkhead-bank [data-bulkhead]');true");
  await sleep(450);
  assert.equal(await player.eval("window.__dmBulkhead===document.querySelector('#bulkhead-bank [data-bulkhead]') && window.__dmBulkhead.isConnected"), true, "bulkhead controls must remain stable between renders");
  const bulkheadBefore = await player.eval("document.querySelector('#bulkhead-bank [data-bulkhead]').textContent");
  await player.eval("document.querySelector('#bulkhead-bank [data-bulkhead]').click();true");
  await until(() => player.eval(`document.querySelector('#bulkhead-bank [data-bulkhead]').textContent !== ${JSON.stringify(bulkheadBefore)}`), "bulkhead operation");
  const barrierBefore = await player.eval("document.getElementById('barrier-toggle').textContent");
  await player.eval("document.getElementById('barrier-toggle').click();true");
  await until(() => player.eval(`document.getElementById('barrier-toggle').textContent !== ${JSON.stringify(barrierBefore)}`), "barrier toggle");
  await player.eval("document.getElementById('shackle-sync').click();true");
  await until(() => player.eval("/Оковы|согласование|противофазу/.test(document.getElementById('toast').textContent)"), "shackle action result");
  await player.eval("document.querySelector('#security-consist [data-coupling]').click();true");
  await until(() => player.eval("document.querySelector('#security-consist [data-coupling]').classList.contains('armed')"), "coupling armed");
  await player.eval("document.querySelector('#security-consist [data-coupling]').click();true");
  await until(() => player.eval("document.querySelector('#security-consist [data-coupling]').classList.contains('open')"), "coupling detached");
  const integrityBeforeDamage = await player.eval("document.getElementById('train-integrity').textContent");
  await gm.eval("document.querySelector('[data-damage=\"25\"]').click();true");
  await until(() => player.eval(`document.getElementById('train-integrity').textContent !== ${JSON.stringify(integrityBeforeDamage)}`), "GM applies direct train damage");
  const integrityAfterDamage = await player.eval("document.getElementById('train-integrity').textContent");
  await gm.eval("document.getElementById('gm-repair-car').click();true");
  await until(() => player.eval(`document.getElementById('train-integrity').textContent !== ${JSON.stringify(integrityAfterDamage)}`), "GM confirms roleplayed car repair");
  await gm.eval("document.getElementById('gm-repair-coupling').value='0';document.getElementById('gm-restore-coupling').click();true");
  await until(() => player.eval("!document.querySelector('#security-consist [data-coupling]').classList.contains('open')"), "GM restores detached coupling");
  await gm.eval("document.getElementById('gm-auto-catastrophes').click();true");
  await until(() => gm.eval("document.getElementById('toast').textContent.includes('катастрофы отключены')"), "GM toggles automatic catastrophes");
  assert.equal(await gm.eval("document.getElementById('gm-auto-catastrophes').checked"), false, "automatic catastrophe toggle must reflect shared state");
  await player.eval("document.getElementById('attention-button').click();document.getElementById('attention-button').click();true");
  assert.equal(await player.eval("document.getElementById('attention-button').disabled"), true, "attention request must enter cooldown");
  try {
    await until(() => gm.eval("!document.getElementById('global-alert').hidden && document.getElementById('global-alert-text').textContent.includes('вызывает внимание')"), "attention alert");
  } catch (error) {
    const diagnostic = {
      gmAlert: await gm.eval("({hidden:document.getElementById('global-alert').hidden,text:document.getElementById('global-alert-text').textContent})"),
      gmToast: await gm.eval("document.getElementById('toast').textContent"),
      gmRuntimeErrors: gm.errors,
      gmLog: await gm.eval("document.getElementById('gm-log').textContent.slice(0,400)"),
      playerToast: await player.eval("document.getElementById('toast').textContent"),
      playerNetwork: await player.eval("window.DM_NETWORK.state()"),
      playerButton: await player.eval("({hidden:document.getElementById('attention-button').hidden,disabled:document.getElementById('attention-button').disabled,text:document.getElementById('attention-button').textContent})"),
    };
    throw new Error(`${error.message}: ${JSON.stringify(diagnostic)}`);
  }
  assert.match(await gm.eval("document.getElementById('global-alert-text').textContent"), /Страж состава/, "attention alert must include assigned station");
  await gm.eval("document.getElementById('dismiss-alert').click();true");
  await sleep(450);
  assert.equal(await gm.eval("document.getElementById('global-alert-text').textContent.includes('вызывает внимание')"), false, "dismissed attention must stay closed");
  await gm.eval(`document.getElementById("gm-failure-system").value="brakes";document.getElementById("gm-failure-severity").value="4";document.getElementById("gm-failure-severity").dispatchEvent(new Event("change",{bubbles:true}));true`);
  assert.equal(await gm.eval("document.getElementById('gm-failure-preview').textContent.includes('14.7')"), true, "failure preview must explain selected severity");
  await gm.eval(`document.querySelector('[data-event="targets"][data-sector="front"]').click();true`);
  await until(() => player.eval("document.querySelectorAll('#target-dots [data-target]').length >= 1"), "turret targets");
  await player.eval("window.__dmTarget=document.querySelector('#target-dots [data-target]');true");
  await sleep(450);
  assert.equal(await player.eval("window.__dmTarget===document.querySelector('#target-dots [data-target]') && window.__dmTarget.isConnected"), true, "moving target must remain clickable between renders");
  await player.eval(`document.querySelector('#target-dots [data-target]').click();true`);
  await until(() => player.eval("document.getElementById('selected-target').textContent !== 'НЕТ ЦЕЛИ'"), "target lock");
  await player.eval("document.getElementById('fire-button').click();true");
  await until(() => player.eval("/Попадание|Цель уничтожена|Залп прошёл/.test(document.getElementById('toast').textContent)"), "turret shot result");
  await until(() => player.eval("Number.parseInt(document.getElementById('turret-reload').textContent) >= 90"), "background GM keeps turret reload moving", 8000);
  assert.equal(await player.eval("document.documentElement.scrollWidth <= window.innerWidth + 1"), true, "warden must not overflow horizontally");
  await sleep(400); await player.screenshot(path.join(output, `warden${suffix}.png`));
  assert.equal(await gm.eval("Promise.all(['manual.html','gm-reference.html'].map(url=>fetch(url).then(response=>response.ok))).then(items=>items.every(Boolean))"), true, "guide pages must be reachable");
  const guideCreated = await gm.send("Target.createTarget", { url: `${base}manual.html` });
  const guideTarget = await until(async () => (await targets()).find(item => item.id === guideCreated.targetId), "crew manual target");
  guide = new CDP(guideTarget.webSocketDebuggerUrl);
  await guide.send("Runtime.enable"); await guide.send("Page.enable");
  await until(() => guide.eval("document.readyState === 'complete' && document.getElementById('quickstart')"), "crew manual content");
  assert.equal(await guide.eval("document.body.textContent.includes('Риск схода') && document.body.textContent.includes('3–5 секунд') && document.body.textContent.includes('Котёл 92 / 108')"), true, "crew manual must contain operating numbers and procedures");
  assert.equal(await guide.eval("document.documentElement.scrollWidth <= window.innerWidth + 1"), true, "crew manual must not overflow horizontally");
  await guide.eval("document.getElementById('quickstart').scrollIntoView();true"); await sleep(250);
  await guide.screenshot(path.join(output, `manual${suffix}.png`));
  await player.send("Page.reload", { ignoreCache: true });
  await until(() => player.eval("document.readyState !== 'loading' && Boolean(window.DM_NETWORK)"), "player reload modules");
  await until(() => player.eval("!document.getElementById('game').hidden && !document.getElementById('warden-panel').hidden"), "player session resumes after reload");
  assert.deepEqual(gm.errors, [], `GM console errors: ${gm.errors.join("; ")}`);
  assert.deepEqual(player.errors, [], `player console errors: ${player.errors.join("; ")}`);
  console.log(`OK: ${cloud ? "cloud" : "local"} GM → room ${code} → player → assignment → shared control; screenshots in ${output}`);
} finally {
  gm?.close(); player?.close(); guide?.close(); child.kill(); playerChild?.kill();
}
