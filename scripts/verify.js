// `pnpm verify`: runs, in order, the commands CI runs (scripts/verifySteps.js), each with
// its own output as it goes, then one line per step with its duration. It stops at the
// first step that fails and names it. `pnpm verify --quick` leaves out the browser tests.
// Every step runs with CI=1, as on CI (buildEnvironmentOfAStep in verifySteps.js).
//
// Run it from the repository root before every push (CLAUDE.md, "Git and process"). The
// browser tests need the e2e ports free (5176-5189); a second checkout running them at the
// same time sets BAJAOVRLAY_E2E_PORT_OFFSET (apps/control/e2e/README.md).
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import {
  buildEnvironmentOfAStep,
  chooseStepsToRun,
  formatStepDuration,
  writeVerifySummary,
} from './verifySteps.js';

const isQuick = process.argv.includes('--quick');
const stepsToRun = chooseStepsToRun(isQuick);
const runStartMs = performance.now();
/** @type {{ name: string, durationMs: number, hasPassed: boolean }[]} */
const results = [];

for (const step of stepsToRun) {
  process.stdout.write(`\n▶ ${step.name}: ${step.command}\n`);
  const stepStartMs = performance.now();
  // The command is one of the fixed strings in verifySteps.js, never user input, so a
  // shell may read it (the root scripts chain commands with &&).
  const run = spawnSync(step.command, {
    shell: true,
    stdio: 'inherit',
    env: buildEnvironmentOfAStep(process.env),
  });
  const durationMs = performance.now() - stepStartMs;
  const hasPassed = run.status === 0;
  results.push({ name: step.name, durationMs, hasPassed });
  const verdict = hasPassed ? 'passed' : 'FAILED';
  process.stdout.write(`■ ${step.name} ${verdict} in ${formatStepDuration(durationMs)}\n`);
  if (!hasPassed) {
    break;
  }
}

const totalDurationMs = performance.now() - runStartMs;
process.stdout.write(writeVerifySummary(results, totalDurationMs));
if (isQuick) {
  process.stdout.write('Quick run: the browser tests were left out.\n');
}
const hasEveryStepPassed = results.every((result) => result.hasPassed);
process.exitCode = hasEveryStepPassed ? 0 : 1;
