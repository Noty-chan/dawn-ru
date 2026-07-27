import fs from "node:fs";
import vm from "node:vm";

export const sceneEngineFiles = [
  "scene-engine-core.js",
  "scene-query.js",
  "scene-movement.js",
  "scene-foundations.js",
  "scene-events.js",
  "scene-triggers.js",
  "scene-actions.js",
  "scene-responses.js",
  "scene-engine.js",
];

export function loadSceneEngine(context) {
  for (const file of sceneEngineFiles) {
    const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    vm.runInNewContext(source, context, { filename: file });
  }
  return context.DAWN_SCENE_ENGINE || context.window?.DAWN_SCENE_ENGINE;
}
