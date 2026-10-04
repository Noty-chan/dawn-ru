import { generate, runTrace, minimize } from "./helpers/lionwing-composition-generator.mjs";

function integerSetting(name, fallback, minimum, maximum) {
  const raw = process.env[name], value = raw === undefined ? fallback : Number(raw);
  if (raw !== undefined && !/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer in ${minimum}..${maximum}`);
  }
  return value;
}
const seed = integerSetting("DAWN_COMPOSITION_SEED", 20261003, 0, 4294967295);
const runs = integerSetting("DAWN_COMPOSITION_RUNS", 12, 1, 4096);
const replay = process.env.DAWN_COMPOSITION_TRACE ? JSON.parse(Buffer.from(process.env.DAWN_COMPOSITION_TRACE, "base64").toString("utf8")) : null;
let accepted = 0, refused = 0;
const combinations = new Set(), routes = new Set(), bases = new Set();
for (let index = 0; index < (replay ? 1 : runs); index++) {
  const testCase = replay || generate((seed + index) >>> 0);
  try { const result = runTrace(testCase); accepted += result.accepted; refused += result.refused; combinations.add(result.combination); bases.add(testCase.profile); for(const route of result.routes) routes.add(route); }
  catch (error) {
    const minimal = minimize(testCase, String(error.message).split("\n")[0]);
    const encoded = Buffer.from(JSON.stringify(minimal)).toString("base64");
    console.error(JSON.stringify({ seed: testCase.seed, profile: testCase.profile, addons: testCase.addons, armament: testCase.armament, failingStep: error.compositionStep, error: error.message, trace: minimal.trace }, null, 2));
    console.error(`Replay (PowerShell): $env:DAWN_COMPOSITION_TRACE='${encoded}'; node apps/companion/tests/lionwing-composition-properties.mjs`);
    throw error;
  }
}
console.log(`LionWing composition properties: seed=${seed}, runs=${replay ? 1 : runs}, bases=${bases.size}, uniqueCombinations=${combinations.size}, routes=${routes.size}, accepted=${accepted}, refused=${refused}; prices/resources/history, preview/refusal, Turns/Rounds, pending reload and exact replay passed`);
