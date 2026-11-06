/**
 * The steps and the summary of `pnpm verify` (scripts)
 *
 * What this module is for:
 *   `pnpm verify` runs CI's commands on João's machine and prints one line per step with
 *   its duration, then a summary that names the step that failed. `pnpm verify --quick`
 *   leaves out the browser tests for a fast check before a push.
 *
 * What these tests prove:
 *   - Every step runs with CI=1 added to this machine's environment, as on CI: a
 *     forgotten `.only` is refused and Playwright never reuses a server left running.
 *     It is the one check a draft gets before gate 2, so it must be as strict as CI.
 *   - A full run takes every step, in order; a quick run takes every step but the three
 *     browser-test steps (the renderer and graphics in CI's two shards, the control page).
 *   - Durations read as seconds under a minute and as minutes and seconds above.
 *   - The summary lists each step that ran with its time, and says either that every
 *     step passed or which one failed.
 *
 * What these tests deliberately do not cover:
 *   - That the steps are CI's: verifyMatchesCi.test.ts.
 *   - Running the commands and stopping at a failure: scripts/verify.js, whose loop
 *     breaks at the first failure; run `pnpm verify` to see it.
 */
import { describe, expect, it } from 'vitest';

import {
  buildEnvironmentOfAStep,
  chooseStepsToRun,
  formatStepDuration,
  verifySteps,
  writeVerifySummary,
} from './verifySteps.js';

describe('buildEnvironmentOfAStep', () => {
  it('adds CI=1 and keeps everything else of the machine’s environment', () => {
    // Arrange: a developer machine's environment, with no CI and a port offset set.
    const machineEnvironment = {
      HOME: '/home/joao',
      PATH: '/usr/local/bin:/usr/bin',
      BAJAOVRLAY_E2E_PORT_OFFSET: '100',
    };

    // Act: build the environment a step runs in.
    const stepEnvironment = buildEnvironmentOfAStep(machineEnvironment);

    // Assert: CI is set, and the rest (the port offset included) is passed on.
    expect(
      stepEnvironment,
      'every step must run with CI=1 and the machine’s own variables',
    ).toEqual({
      HOME: '/home/joao',
      PATH: '/usr/local/bin:/usr/bin',
      BAJAOVRLAY_E2E_PORT_OFFSET: '100',
      CI: '1',
    });
  });

  it('sets CI to 1 even where the machine had CI set to something else', () => {
    // Arrange: a shell where CI was exported empty, which Playwright reads as not CI.
    const machineEnvironment = { CI: '' };

    // Act: build the environment a step runs in.
    const stepEnvironment = buildEnvironmentOfAStep(machineEnvironment);

    // Assert: CI is 1.
    expect(stepEnvironment.CI, 'an empty CI must not switch the CI settings off').toBe('1');
  });
});

describe('chooseStepsToRun', () => {
  it('takes every step, in order, on a full run', () => {
    // Arrange: nothing; the steps are fixed.

    // Act: choose the steps of a full run.
    const steps = chooseStepsToRun(false);

    // Assert: the eight steps, the cheapest first and the browser tests last.
    expect(
      steps.map((step) => step.name),
      'a full run must take every step in order',
    ).toEqual([
      'Install check',
      'Lint',
      'Typecheck',
      'Vitest',
      'Build',
      'Playwright: renderer, bracket, tower',
      'Playwright: other graphics, server',
      'Playwright: control page',
    ]);
  });

  it('leaves out only the browser tests on a quick run', () => {
    // Arrange: nothing; the steps are fixed.

    // Act: choose the steps of a quick run.
    const steps = chooseStepsToRun(true);

    // Assert: every step but the three Playwright ones.
    expect(
      steps.map((step) => step.name),
      '--quick must leave out the browser tests and nothing else',
    ).toEqual(['Install check', 'Lint', 'Typecheck', 'Vitest', 'Build']);
    expect(
      verifySteps.filter((step) => step.isBrowserTest),
      'exactly three steps must be browser tests',
    ).toHaveLength(3);
  });
});

describe('formatStepDuration', () => {
  const durationScenarios = [
    // A lint run: under a minute reads as seconds with one decimal.
    { name: 'shows 51 300 ms as 51.3 s', durationMs: 51_300, expected: '51.3 s' },
    // Vitest on a slow machine: minutes and seconds, the seconds on two digits.
    { name: 'shows 185 000 ms as 3 min 05 s', durationMs: 185_000, expected: '3 min 05 s' },
    // Exactly a minute is already "1 min", not "60.0 s".
    { name: 'shows 60 000 ms as 1 min 00 s', durationMs: 60_000, expected: '1 min 00 s' },
    // Just under two minutes rounds up to the next minute, never to "1 min 60 s".
    { name: 'shows 119 600 ms as 2 min 00 s', durationMs: 119_600, expected: '2 min 00 s' },
  ];

  it.each(durationScenarios)('$name', ({ durationMs, expected }) => {
    // Arrange: the duration of the row (in the table above).

    // Act: format it.
    const formatted = formatStepDuration(durationMs);

    // Assert: the expected text.
    expect(formatted, 'the duration must read as the row says').toBe(expected);
  });
});

describe('writeVerifySummary', () => {
  it('lists every step with its time and says every step passed', () => {
    // Arrange: a quick run where all five steps passed.
    const results = [
      { name: 'Install check', durationMs: 4_100, hasPassed: true },
      { name: 'Lint', durationMs: 21_500, hasPassed: true },
      { name: 'Typecheck', durationMs: 18_200, hasPassed: true },
      { name: 'Vitest', durationMs: 27_300, hasPassed: true },
      { name: 'Build', durationMs: 9_800, hasPassed: true },
    ];

    // Act: write the summary.
    const summary = writeVerifySummary(results, 80_900);

    // Assert: a line per step and the verdict.
    expect(summary, 'each step must be listed with its time').toContain('Vitest');
    expect(summary, 'each step must be listed with its time').toContain('27.3 s');
    expect(summary, 'the verdict must say every step passed').toContain(
      'Every step passed in 1 min 21 s.',
    );
  });

  it('names the step that failed and lists no step after it', () => {
    // Arrange: a run stopped by a typecheck failure, so Vitest never ran.
    const results = [
      { name: 'Install check', durationMs: 4_100, hasPassed: true },
      { name: 'Lint', durationMs: 21_500, hasPassed: true },
      { name: 'Typecheck', durationMs: 18_200, hasPassed: false },
    ];

    // Act: write the summary.
    const summary = writeVerifySummary(results, 43_800);

    // Assert: the failed step is marked and named, and Vitest is not listed.
    expect(summary, 'the failed step must be marked').toMatch(/FAILED Typecheck/);
    expect(summary, 'the verdict must name the failed step').toContain(
      'Stopped at "Typecheck", which failed, after 43.8 s.',
    );
    expect(summary, 'a step that never ran must not be listed').not.toContain('Vitest');
  });
});
