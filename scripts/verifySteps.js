// The steps of `pnpm verify` (scripts/verify.js), João's local CI: the same commands CI
// runs, in the order a failure is cheapest to find. verifyMatchesCi.test.ts reads
// .github/workflows/ci.yml and fails when the two lists drift apart, so a check added to
// CI and not here (or the reverse) is caught before it is pushed.

/**
 * @typedef {{ name: string, command: string, isBrowserTest: boolean }} VerifyStep
 */

/** @type {VerifyStep[]} */
export const verifySteps = [
  // pnpm refuses when package.json and the lockfile disagree, as CI does.
  {
    name: 'Install check',
    command: 'pnpm install --frozen-lockfile',
    isBrowserTest: false,
  },
  { name: 'Lint', command: 'pnpm lint', isBrowserTest: false },
  { name: 'Typecheck', command: 'pnpm typecheck', isBrowserTest: false },
  { name: 'Vitest', command: 'pnpm test', isBrowserTest: false },
  { name: 'Build', command: 'pnpm build', isBrowserTest: false },
  {
    name: 'Playwright: renderer and graphics',
    command: 'pnpm test:e2e:renderer-and-graphics',
    isBrowserTest: true,
  },
  // CI splits these in two shards on two runners; here they run whole, one after the other.
  {
    name: 'Playwright: control page',
    command: 'pnpm test:e2e:control',
    isBrowserTest: true,
  },
];

/**
 * The environment every step runs in: this machine's, with CI=1 added, so the tools
 * behave as on CI. Vitest and Playwright then refuse a forgotten `.only`, Playwright
 * starts its own servers instead of reusing one left running (it fails if a port is
 * taken), and the CI-only reporters write their JSON. The one test that must still tell
 * this machine from GitHub's runner (dataSourcesPageStaysResponsive) reads
 * GITHUB_ACTIONS, which only the runner sets.
 * @param {NodeJS.ProcessEnv} machineEnvironment
 * @returns {NodeJS.ProcessEnv}
 */
export function buildEnvironmentOfAStep(machineEnvironment) {
  return { ...machineEnvironment, CI: '1' };
}

/**
 * The steps a run takes: all of them, or with `--quick` all but the browser tests, for a
 * fast check before a push.
 * @param {boolean} isQuick
 * @returns {VerifyStep[]}
 */
export function chooseStepsToRun(isQuick) {
  if (isQuick) {
    return verifySteps.filter((step) => !step.isBrowserTest);
  }
  return verifySteps;
}

/**
 * A duration as each step's line shows it: "42.0 s" under a minute, "3 min 05 s" above.
 * @param {number} durationMs
 * @returns {string}
 */
export function formatStepDuration(durationMs) {
  const totalSeconds = durationMs / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)} s`;
  }
  // Rounded to whole seconds first, so 119,6 s reads "2 min 00 s", never "1 min 60 s".
  const wholeSeconds = Math.round(totalSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
}

/**
 * The summary printed at the end: one line per step that ran, then the verdict, naming
 * the step that failed if one did. Steps after a failure never ran and are not listed.
 * @param {{ name: string, durationMs: number, hasPassed: boolean }[]} results
 * @param {number} totalDurationMs
 * @returns {string}
 */
export function writeVerifySummary(results, totalDurationMs) {
  const lines = ['', 'pnpm verify — summary'];
  for (const result of results) {
    const mark = result.hasPassed ? 'ok    ' : 'FAILED';
    lines.push(`  ${mark} ${result.name.padEnd(36)} ${formatStepDuration(result.durationMs)}`);
  }
  const failedStep = results.find((result) => !result.hasPassed);
  const total = formatStepDuration(totalDurationMs);
  if (failedStep === undefined) {
    lines.push(`Every step passed in ${total}.`);
  } else {
    lines.push(`Stopped at "${failedStep.name}", which failed, after ${total}.`);
  }
  return `${lines.join('\n')}\n`;
}
