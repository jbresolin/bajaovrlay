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
 *   - Every `run:` command in ci.yml is, exactly, a step of `pnpm verify` or one of the
 *     few commands below that only make sense on CI, each with its reason. Exactly: a
 *     command with anything added to it (`… && pnpm audit`, one more line) is a new one.
 *   - Every step of `pnpm verify` is, exactly, a command in ci.yml.
 *   - ci.yml sets no `working-directory:`, under which a command would run somewhere
 *     other than the root, where verify runs it.
 *   - Each kind of drift is caught and named: a check added to CI, a check added to a
 *     CI-only command, a line added to a block, a check CI dropped, a working directory.
 *   - The reading of ci.yml finds commands in the three shapes the workflow writes them.
 *
 * What these tests deliberately do not cover:
 *   - The order of the steps: CI runs its jobs side by side, so there is no single order
 *     to compare with; verify runs the cheapest checks first.
 *   - Running the commands (scripts/verify.js runs them; its output is the check).
 *   - The `uses:` steps (checkout, pnpm and Node setup, cache, upload) and each step's
 *     `env:`: they prepare a CI runner and run no check.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  findWorkingDirectoriesOfWorkflow,
  readRunCommandsOfWorkflow,
} from './ciWorkflowCommands.js';
import { verifySteps } from './verifySteps.js';

const ciWorkflowText = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
);

// The commands CI runs that `pnpm verify` leaves out on purpose, each written exactly as
// ci.yml runs it (with runs of spaces made one), and why.
const ciCommandsVerifyLeavesOut = [
  {
    command: 'pnpm exec playwright install --with-deps chromium',
    // It installs the browser's system packages with apt and sudo: a developer installs
    // the browser once, and verify must not ask for a password.
    why: 'installs the browser on a new CI runner',
  },
  {
    command:
      'echo "version=$(pnpm exec playwright --version | sed \'s/^Version //\')" >> "$GITHUB_OUTPUT"',
    why: "reads the Playwright version for the key of CI's browser cache",
  },
  {
    command: 'node scripts/reportSlowestTests.js vitest-report.json >> "$GITHUB_STEP_SUMMARY"',
    why: "writes the Vitest job's slowest-tests table to CI's summary page",
  },
  {
    command:
      'node scripts/reportSlowestTests.js apps/renderer/test-results/playwright-results.json packages/graphics/*/test-results/playwright-results.json >> "$GITHUB_STEP_SUMMARY"',
    why: "writes the renderer and graphics job's slowest-tests table to CI's summary page",
  },
  {
    command:
      'node scripts/reportSlowestTests.js apps/control/test-results/playwright-results.json >> "$GITHUB_STEP_SUMMARY"',
    why: "writes a control shard's slowest-tests table to CI's summary page",
  },
  {
    command: 'bash scripts/checkJobResults.sh',
    why: 'is "CI passed", which reads the results of the other CI jobs',
  },
];
const commandsVerifyLeavesOut = ciCommandsVerifyLeavesOut.map((leftOut) => leftOut.command);

// CI splits the control page's browser tests in two shards on two runners; verify runs
// them whole. With the shard taken off, the command is verify's.
const shardArgumentOfCi = ' --shard=${{ matrix.shard }}/2';

const verifyCommands = verifySteps.map((step) => step.command);

/** A CI command as verify would write it: the same, with CI's shard argument taken off. */
function writeCiCommandAsVerifyWould(ciCommand: string): string {
  return ciCommand.replace(shardArgumentOfCi, '');
}

/**
 * Every way a workflow's commands and verify's steps differ, one sentence each: a CI
 * command verify neither runs nor leaves out on purpose, a verify step CI does not run,
 * and a working directory. Every comparison is exact (===).
 */
function findDriftBetweenCiAndVerify(workflowText: string): string[] {
  const ciCommands = readRunCommandsOfWorkflow(workflowText).map(writeCiCommandAsVerifyWould);
  const drift: string[] = [];
  for (const ciCommand of ciCommands) {
    const isAVerifyStep = verifyCommands.includes(ciCommand);
    const isLeftOutOnPurpose = commandsVerifyLeavesOut.includes(ciCommand);
    if (!isAVerifyStep && !isLeftOutOnPurpose) {
      drift.push(`CI runs a command verify does not: ${ciCommand}`);
    }
  }
  for (const verifyCommand of verifyCommands) {
    if (!ciCommands.includes(verifyCommand)) {
      drift.push(`verify runs a command CI does not: ${verifyCommand}`);
    }
  }
  for (const workingDirectory of findWorkingDirectoriesOfWorkflow(workflowText)) {
    drift.push(`CI runs commands in another folder: ${workingDirectory}`);
  }
  return drift;
}

describe('pnpm verify and ci.yml', () => {
  it('match exactly: every CI command is a verify step or CI-only, and the reverse', () => {
    // Arrange: the real ci.yml and the real verify steps.

    // Act: find every difference.
    const drift = findDriftBetweenCiAndVerify(ciWorkflowText);

    // Assert: none.
    expect(
      drift,
      'add the command to scripts/verifySteps.js, or to the CI-only list here with its reason',
    ).toEqual([]);
  });

  it('leaves out on purpose only commands that ci.yml really runs', () => {
    // Arrange: the commands ci.yml runs.
    const ciCommands = readRunCommandsOfWorkflow(ciWorkflowText);

    // Act: find CI-only entries no CI command matches any more.
    const staleEntries = commandsVerifyLeavesOut.filter((command) => !ciCommands.includes(command));

    // Assert: none, so the list cannot quietly excuse a command CI changed.
    expect(staleEntries, 'a CI-only entry must match a ci.yml command exactly').toEqual([]);
  });

  const driftScenarios = [
    // The plain case: a new check in CI, as its own step.
    {
      name: 'names a check added to CI as a step of its own',
      changeCi: (text: string) =>
        text.replace(
          '        run: pnpm typecheck\n',
          '        run: pnpm typecheck\n\n      - name: Audit the dependencies\n        run: pnpm audit --prod\n',
        ),
      expectedDrift: ['CI runs a command verify does not: pnpm audit --prod'],
    },
    // A check tacked onto a CI-only command (the first of its two jobs): a prefix match
    // would have let it through.
    {
      name: 'names a check added after the browser install with &&',
      changeCi: (text: string) =>
        text.replace(
          'run: pnpm exec playwright install --with-deps chromium',
          'run: pnpm exec playwright install --with-deps chromium && pnpm audit --prod',
        ),
      expectedDrift: [
        'CI runs a command verify does not: pnpm exec playwright install --with-deps chromium && pnpm audit --prod',
      ],
    },
    // One more line in a block: "CI passed" turned into a literal block with a second line.
    {
      name: 'names a line added to a block',
      changeCi: (text: string) =>
        text.replace(
          'run: bash scripts/checkJobResults.sh',
          'run: |\n          bash scripts/checkJobResults.sh\n          pnpm audit --prod',
        ),
      expectedDrift: [
        'CI runs a command verify does not: bash scripts/checkJobResults.sh\npnpm audit --prod',
      ],
    },
    // A check CI dropped, which verify would go on running for nothing.
    {
      name: 'names a verify step that CI no longer runs',
      changeCi: (text: string) => text.replace('run: pnpm typecheck', 'run: echo pulado'),
      expectedDrift: [
        'CI runs a command verify does not: echo pulado',
        'verify runs a command CI does not: pnpm typecheck',
      ],
    },
    // The same words run in another folder are another command.
    {
      name: 'names a working directory set on a step',
      changeCi: (text: string) =>
        text.replace(
          '        run: pnpm test\n',
          '        run: pnpm test\n        working-directory: apps/control\n',
        ),
      expectedDrift: ['CI runs commands in another folder: apps/control'],
    },
  ];

  it.each(driftScenarios)('$name', ({ changeCi, expectedDrift }) => {
    // Arrange: ci.yml changed as the row says (in the table above).
    const changedCiWorkflowText = changeCi(ciWorkflowText);

    // Act: compare it with the real verify steps.
    const drift = findDriftBetweenCiAndVerify(changedCiWorkflowText);

    // Assert: the change really went in, and exactly the expected drift is named.
    expect(changedCiWorkflowText, 'the row must change the stand-in ci.yml').not.toBe(
      ciWorkflowText,
    );
    expect(drift, 'the drift must be caught and named').toEqual(expectedDrift);
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
      '          bash scripts/checkJobResults.sh',
      '          exit 0',
      '',
    ].join('\n');

    // Act: read its commands.
    const commands = readRunCommandsOfWorkflow(workflowText);

    // Assert: three commands, the folded one on one line, the literal one on two.
    expect(commands, 'each shape must be read whole, and `uses:` left alone').toEqual([
      'pnpm test',
      'node scripts/reportSlowestTests.js vitest-report.json',
      'bash scripts/checkJobResults.sh\nexit 0',
    ]);
  });
});
