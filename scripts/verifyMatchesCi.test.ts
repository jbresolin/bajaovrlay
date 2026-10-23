/**
 * `pnpm verify` runs what CI runs (scripts)
 *
 * What this module is for:
 *   `pnpm verify` is CI on João's machine: an agent runs it before every push, because a
 *   draft pull request gets no CI run until gate 2 has passed. It is only worth that if it
 *   runs the same checks as CI. The two lists live in two files, .github/workflows/ci.yml
 *   and scripts/verifySteps.js, and nothing else would notice them drifting apart: a check
 *   added to CI alone would pass every local run and fail only after the push, and a step
 *   left in verify after CI dropped it would slow every run for nothing. This test reads
 *   ci.yml as text and fails on either.
 *
 * What these tests prove:
 *   - Every `run:` command in ci.yml is a step of `pnpm verify`, or is on the short list
 *     below of commands that only make sense on CI, each with its reason.
 *   - Every step of `pnpm verify` is a command in ci.yml.
 *   - Both checks catch a drift: a CI step added without verify, and a verify step CI
 *     no longer runs, are each named.
 *   - The reading of ci.yml finds commands in the three shapes the workflow writes them.
 *
 * What these tests deliberately do not cover:
 *   - The order of the steps: CI runs its jobs side by side, so there is no single order
 *     to compare with; verify runs the cheapest checks first.
 *   - Running the commands (scripts/verify.js runs them; its output is the check).
 *   - The `uses:` steps (checkout, pnpm and Node setup, cache, upload): they prepare a CI
 *     runner and run no check.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { readRunCommandsOfWorkflow } from './ciWorkflowCommands.js';
import { verifySteps } from './verifySteps.js';

const ciWorkflowText = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
);

// The commands CI runs that `pnpm verify` leaves out on purpose. A command matches when it
// starts with the text given.
const ciCommandsVerifyLeavesOut = [
  {
    startsWith: 'pnpm exec playwright install --with-deps chromium',
    // It installs the browser's system packages with apt and sudo: a developer installs
    // the browser once, and verify must not ask for a password.
    why: 'installs the browser on a new CI runner',
  },
  {
    startsWith: 'echo "version=$(pnpm exec playwright --version',
    why: "reads the Playwright version for the key of CI's browser cache",
  },
  {
    startsWith: 'node scripts/reportSlowestTests.js',
    why: "writes the slowest-tests table to CI's summary page",
  },
  {
    startsWith: 'echo "Results of the jobs:',
    why: 'is "CI passed", which reads the results of the other CI jobs',
  },
];

// CI splits the control page's browser tests in two shards on two runners; verify runs
// them whole. With the shard taken off, the command is verify's.
const shardArgumentOfCi = ' --shard=${{ matrix.shard }}/2';

/** A CI command as verify would write it: the same, with CI's shard argument taken off. */
function writeCiCommandAsVerifyWould(ciCommand: string): string {
  return ciCommand.replace(shardArgumentOfCi, '');
}

/** Whether a CI command is one verify leaves out on purpose (the list above). */
function isLeftOutOfVerifyOnPurpose(ciCommand: string): boolean {
  return ciCommandsVerifyLeavesOut.some((leftOut) => ciCommand.startsWith(leftOut.startsWith));
}

/** The CI commands of a workflow that are neither a verify step nor left out on purpose. */
function findCiCommandsMissingFromVerify(workflowText: string, verifyCommands: string[]) {
  return readRunCommandsOfWorkflow(workflowText)
    .map(writeCiCommandAsVerifyWould)
    .filter((ciCommand) => !isLeftOutOfVerifyOnPurpose(ciCommand))
    .filter((ciCommand) => !verifyCommands.includes(ciCommand));
}

/** The verify commands that no CI command runs. */
function findVerifyCommandsMissingFromCi(workflowText: string, verifyCommands: string[]) {
  const ciCommands = readRunCommandsOfWorkflow(workflowText).map(writeCiCommandAsVerifyWould);
  return verifyCommands.filter((verifyCommand) => !ciCommands.includes(verifyCommand));
}

const verifyCommands = verifySteps.map((step) => step.command);

describe('pnpm verify and ci.yml', () => {
  it('has every CI command as a verify step, unless it only makes sense on CI', () => {
    // Arrange: the real ci.yml and the real verify steps.

    // Act: find CI commands that verify neither runs nor leaves out on purpose.
    const missingFromVerify = findCiCommandsMissingFromVerify(ciWorkflowText, verifyCommands);

    // Assert: none.
    expect(
      missingFromVerify,
      'a CI command must be added to scripts/verifySteps.js, or to the left-out list here with its reason',
    ).toEqual([]);
  });

  it('has every verify step as a CI command', () => {
    // Arrange: the real ci.yml and the real verify steps.

    // Act: find verify commands that CI does not run.
    const missingFromCi = findVerifyCommandsMissingFromCi(ciWorkflowText, verifyCommands);

    // Assert: none.
    expect(
      missingFromCi,
      'a verify step CI does not run must be added to ci.yml or removed from verify',
    ).toEqual([]);
  });

  it('names a check added to CI without verify', () => {
    // Arrange: ci.yml with one more step after Typecheck, a dependency audit.
    const ciWithAnAudit = ciWorkflowText.replace(
      '        run: pnpm typecheck\n',
      '        run: pnpm typecheck\n\n      - name: Audit the dependencies\n        run: pnpm audit --prod\n',
    );
    expect(ciWithAnAudit, 'the audit step must have gone into the stand-in ci.yml').not.toBe(
      ciWorkflowText,
    );

    // Act: compare it with the real verify steps.
    const missingFromVerify = findCiCommandsMissingFromVerify(ciWithAnAudit, verifyCommands);

    // Assert: the audit is named.
    expect(missingFromVerify, 'the new CI check must be named as missing from verify').toEqual([
      'pnpm audit --prod',
    ]);
  });

  it('names a verify step that CI no longer runs', () => {
    // Arrange: ci.yml without its Typecheck command.
    const ciWithoutTypecheck = ciWorkflowText.replace('run: pnpm typecheck', 'run: echo pulado');

    // Act: compare the real verify steps with it.
    const missingFromCi = findVerifyCommandsMissingFromCi(ciWithoutTypecheck, verifyCommands);

    // Assert: the typecheck is named.
    expect(missingFromCi, 'the dropped CI check must be named as missing from CI').toEqual([
      'pnpm typecheck',
    ]);
  });
});

describe('readRunCommandsOfWorkflow', () => {
  it('reads one-line, folded and literal commands, and nothing else', () => {
    // Arrange: a small workflow with one command of each shape and a `uses:` step.
    const workflowText = [
      'jobs:',
      '  unit-tests:',
      '    steps:',
      '      - uses: actions/checkout@v7',
      '      - name: Vitest',
      '        run: pnpm test',
      '      - name: Report',
      '        run: >-',
      '          node scripts/reportSlowestTests.js',
      '          vitest-report.json',
      '      - name: Check',
      '        run: |',
      '          echo "Results of the jobs: success"',
      '          exit 0',
      '',
    ].join('\n');

    // Act: read its commands.
    const commands = readRunCommandsOfWorkflow(workflowText);

    // Assert: three commands, the folded one on one line, the literal one on two.
    expect(commands, 'each shape must be read whole, and `uses:` left alone').toEqual([
      'pnpm test',
      'node scripts/reportSlowestTests.js vitest-report.json',
      'echo "Results of the jobs: success"\nexit 0',
    ]);
  });
});
