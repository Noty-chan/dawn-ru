import { defaultVerificationRepoRoot, DEFAULT_VERIFICATION_MANIFEST, DEFAULT_VERIFICATION_REPORT,
  runAutomationVerification, readVerificationReport, evaluateVerificationReport, loadVerificationManifest } from "./automation-verification.mjs";

const args = process.argv.slice(2);
const options = { repoRoot: defaultVerificationRepoRoot, manifestPath: DEFAULT_VERIFICATION_MANIFEST,
  outputPath: DEFAULT_VERIFICATION_REPORT, allowDirty: false, scenarioIds: [] };
let checkOnly = false;
for (let index = 0; index < args.length; index++) {
  const flag = args[index];
  if (flag === "--allow-dirty") options.allowDirty = true;
  else if (flag === "--check") checkOnly = true;
  else if (["--manifest", "--output", "--scenario"].includes(flag)) {
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--manifest") options.manifestPath = value;
    else if (flag === "--output") options.outputPath = value;
    else options.scenarioIds.push(value);
  } else throw new Error(`Unknown verification option ${flag}`);
}
try {
  let evaluation;
  if (checkOnly) {
    const manifest = loadVerificationManifest(options);
    const report = readVerificationReport({ repoRoot: options.repoRoot, reportPath: options.outputPath });
    evaluation = evaluateVerificationReport({ ...options, manifest, report, requireClean: !options.allowDirty });
  } else {
    const result = await runAutomationVerification({ ...options, onProgress: progress => {
      if (progress.state !== "running") console.log(`${progress.scenarioId}: ${progress.state}`);
    } });
    evaluation = result.evaluation;
    console.log(`Verification artifact: ${result.outputPath}`);
  }
  console.log(JSON.stringify({ run: evaluation.run, summary: evaluation.summary }, null, 2));
  if (!["current", "partial"].includes(evaluation.run.status)) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
