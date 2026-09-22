import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { loadSceneEngine } from "./load-scene-engine.mjs";

const context = { console, Date };
context.globalThis = context;
context.window = context;
vm.runInNewContext(fs.readFileSync(new URL("../data.js", import.meta.url), "utf8"), context);
loadSceneEngine(context);
const Engine = context.DAWN_SCENE_ENGINE;
const data = context.DAWN_DATA;

const baseScene = {
  version: 0,
  round: 1,
  activeActorId: "hero",
  spaces: [{ id: "main", width: 7, height: 7 }],
  actors: [
    { id: "hero", kind: "hero", name: "Эта", team: "hero", space: "main", x: 1, y: 1, ap: 3, baseAp: 3, focus: 50, hp: 12, maxHp: 12, speed: 4, armor: 0, evasion: 0, attrs: { body: 3, talent: 4, spirit: 4, mind: 2 }, effects: [], usedActions: [], acted: false },
    { id: "enemy", kind: "enemy", name: "Ассасин", team: "enemy", space: "main", x: 4, y: 1, ap: 2, baseAp: 2, focus: 0, hp: 10, maxHp: 10, speed: 4, armor: 1, evasion: 0, attrs: { body: 2, talent: 4, spirit: 1, mind: 2 }, effects: [], usedActions: [], acted: false },
  ],
  objects: [],
  markers: [],
  log: [],
  rollFeed: [],
};

function sourceScene() {
  return Engine.dispatch(structuredClone(baseScene), {
    id: "queue-source",
    type: "resource.gain",
    actorId: "hero",
    payload: { resource: "focus", amount: 1 },
  }).scene;
}

function prompt(label, priority, tieBreak) {
  return {
    id: `prompt-event-${label}`,
    type: "rule.prompt",
    actorId: "hero",
    payload: {
      id: `prompt-${label}`,
      kind: `qa-queue-${label}`,
      sourceActorId: "hero",
      ownerActorId: "hero",
      controller: "source",
      participantIds: ["hero", "enemy"],
      sourceEventId: "queue-source",
      sourceEventType: "resource.gain",
      sourceSceneVersion: 1,
      options: ["accept", "pass", "cancel"],
      priority,
      tieBreak,
    },
  };
}

const simultaneous = Engine.dispatchMany(sourceScene(), [
  prompt("low", 10, "030:low"),
  prompt("high", 30, "010:high"),
  prompt("medium", 20, "020:medium"),
]).scene;
assert.equal(simultaneous.pendingPrompt.id, "prompt-high", "The highest priority simultaneous prompt becomes active first");
assert.deepEqual(Array.from(simultaneous.triggerQueue, item => item.event.payload.id), ["prompt-medium", "prompt-low"], "Lower priority prompts persist in descending queue order");
assert.deepEqual(Array.from(simultaneous.triggerQueue, item => [item.priority, item.tieBreak]), [[20, "020:medium"], [10, "030:low"]]);
assert.equal(Engine.triggerQueueStatus(simultaneous).active.id, "prompt-high", "Queue status exposes the one active prompt separately");
assert.equal(Engine.triggerQueueStatus(simultaneous).next.event.payload.id, "prompt-medium");
assert.equal(simultaneous.log.filter(event => event.type === "rule.trigger" && event.payload?.status === "queued").length, 2, "Every deferred prompt has one persisted queue audit");
const manyPrompts=Engine.dispatchMany(sourceScene(),Array.from({length:30},(_,index)=>prompt(`bulk-${index}`,30-index,`bulk:${index}`))).scene;
assert.equal(manyPrompts.triggerQueue.length,29,"the writer accepts a queue larger than the former 24-item save limit");
assert.equal(manyPrompts.log.filter(event=>event.type==="rule.trigger"&&event.payload?.status==="queued").length,29,"each accepted deferred prompt has a matching journal entry");
assert.throws(()=>Engine.dispatchMany(sourceScene(),Array.from({length:130},(_,index)=>prompt(`overflow-${index}`,130-index,`overflow:${index}`))),/очередь решений заполнена/i,"the writer blocks queue overflow before a saved scene could silently lose accepted work");

const wrongParticipant = Engine.respondRulePrompt(simultaneous, data, { actorId: "enemy", choice: "pass" });
assert.equal(wrongParticipant.ok, false);
assert.match(wrongParticipant.errors.join(" "), /Источник решения/);
assert.throws(() => Engine.dispatch(simultaneous, { id: "queue-bypass", type: "resource.spend", actorId: "hero", payload: { resource: "focus", amount: 1 } }), /ответьте на сработавшее правило/, "A new resource mutation cannot bypass the active prompt");

const malformedOwner = prompt("malformed-owner", 1, "040:malformed-owner");
malformedOwner.payload.ownerActorId = "enemy";
assert.throws(() => Engine.dispatch(sourceScene(), malformedOwner), /запрос правила или его источник/, "Prompt owner must match its source actor");
const malformedSource = prompt("malformed-source", 1, "040:malformed-source");
malformedSource.payload.sourceEventType = "turn.end";
assert.throws(() => Engine.dispatch(sourceScene(), malformedSource), /запрос правила или его источник/, "Prompt source type must match the persisted source event");
const malformedController = prompt("malformed-controller", 1, "040:malformed-controller");
malformedController.payload.controller = "forged";
assert.throws(() => Engine.dispatch(sourceScene(), malformedController), /запрос правила или его источник/, "Prompt controller must use the declared authority modes");
const malformedParticipants = prompt("malformed-participants", 1, "040:malformed-participants");
malformedParticipants.payload.participantIds.push("ghost");
assert.throws(() => Engine.dispatch(sourceScene(), malformedParticipants), /запрос правила или его источник/, "Prompt participants must exist on the authoritative Scene");

const cancelled = Engine.respondRulePrompt(simultaneous, data, { choice: "cancel" });
assert.equal(cancelled.ok, true);
const afterCancel = Engine.dispatchMany(simultaneous, cancelled.events).scene;
assert.equal(afterCancel.pendingPrompt.id, "prompt-medium", "Cancelling the active prompt immediately opens the next queued prompt");
assert.deepEqual(Array.from(afterCancel.triggerQueue, item => item.event.payload.id), ["prompt-low"]);

const tieOrdered = Engine.dispatchMany(sourceScene(), [
  prompt("tie-z", 7, "020:z"),
  prompt("tie-b", 7, "010:b"),
  prompt("tie-a", 7, "010:a"),
]).scene;
assert.equal(tieOrdered.pendingPrompt.id, "prompt-tie-a", "Equal priority uses the explicit tie-break before insertion order");
assert.deepEqual(Array.from(tieOrdered.triggerQueue, item => item.event.payload.id), ["prompt-tie-b", "prompt-tie-z"]);

const reloaded = structuredClone(simultaneous);
assert.deepEqual(
  Array.from(Engine.triggerQueueStatus(reloaded).queued, item => [item.triggerId, item.priority, item.tieBreak]),
  Array.from(Engine.triggerQueueStatus(simultaneous).queued, item => [item.triggerId, item.priority, item.tieBreak]),
  "Queue order and provenance survive a scene reload",
);
const queuedAudit = simultaneous.log.find(event => event.type === "rule.trigger" && event.payload?.status === "queued" && event.payload?.queueKey === simultaneous.triggerQueue.find(item => item.event.payload.id === "prompt-medium")?.key);
const replayedAudit = Engine.dispatchMany(reloaded, [queuedAudit]).scene;
assert.equal(replayedAudit.log.length, reloaded.log.length, "Replaying a persisted queue audit is idempotent");
assert.equal(JSON.stringify(replayedAudit.triggerQueue), JSON.stringify(reloaded.triggerQueue));
const activePromptEvent = simultaneous.log.find(event => event.type === "rule.prompt" && event.payload?.id === "prompt-high");
const replayedPrompt = Engine.dispatchMany(reloaded, [activePromptEvent]);
assert.equal(replayedPrompt.events.length, 0, "Replaying the persisted active prompt does not enqueue a duplicate");
assert.equal(replayedPrompt.scene.triggerQueue.length, reloaded.triggerQueue.length);
const noIdPrompt = prompt("no-id", 4, "040:no-id");
delete noIdPrompt.id;
const noIdScene = Engine.dispatchMany(sourceScene(), [noIdPrompt]).scene;
const replayedNoIdPrompt = Engine.dispatchMany(noIdScene, [noIdPrompt]);
assert.equal(replayedNoIdPrompt.events.length, 0, "Replaying a prompt originally submitted without an id remains idempotent after normalization");

const versionMismatch = Engine.respondRulePrompt(simultaneous, data, { choice: "pass" });
versionMismatch.events[0].payload.sceneVersion += 1;
assert.throws(
  () => Engine.dispatch(simultaneous, versionMismatch.events[0]),
  error => error.code === "SCENE_PROMPT_VERSION_CONFLICT",
  "A response from an obsolete scene version is rejected",
);

const staleQueued = structuredClone(simultaneous);
staleQueued.pendingPrompt.expiresAt = Date.now() - 1;
staleQueued.triggerQueue.find(item => item.event.payload.id === "prompt-medium").event.payload.expiresAt = Date.now() - 1;
const staleResponse = Engine.respondRulePrompt(staleQueued, data, { stale: true });
assert.equal(staleResponse.ok, true);
const afterStale = Engine.dispatchMany(staleQueued, staleResponse.events).scene;
assert.equal(afterStale.pendingPrompt.id, "prompt-low", "An expired queued prompt is cancelled through manual fallback before the next valid prompt opens");
assert.ok(afterStale.log.some(event => event.type === "rule.trigger" && event.payload?.status === "cancelled" && event.payload?.queueKey === staleQueued.triggerQueue.find(item => item.event.payload.id === "prompt-medium")?.key));
assert.equal(Engine.respondRulePrompt(afterCancel, data, { choice: "invented" }).ok, false, "A response outside the declared options is rejected");

console.log("LionWing prompt queue QA passed: priority and tie-break ordering, authority boundaries, cancel/stale fallback, reload/replay idempotency, and version conflicts");
