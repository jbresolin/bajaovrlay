/**
 * The slowest-tests table (scripts)
 *
 * What this module is for:
 *   CI went from 11 to 26 minutes without anyone seeing which tests grew. Every CI run now
 *   writes the 15 slowest test files and tests, of Vitest and of Playwright, on the run's
 *   summary page. slowestTests.js reads the two runners' JSON reports and writes that
 *   markdown; reportSlowestTests.js only reads the files named on its command line.
 *
 * What these tests prove:
 *   - A report is told apart by its content (Vitest, Playwright or neither), so CI can
 *     name every package's report with one shell pattern.
 *   - From Vitest's report: each file's time from its start to its end, each test's own
 *     time and full name, paths relative to the repository, and the passed / failed /
 *     skipped counts.
 *   - From Playwright's report: the tests inside nested describe blocks are all found,
 *     named with their describe blocks, and a file's time is the sum of its tests'.
 *   - Several reports (the Playwright packages, the shards) combine into one table.
 *   - The table lists the slowest first, at most the count asked for, in seconds with
 *     one decimal, and a `|` in a test name does not break the table.
 *
 * What these tests deliberately do not cover:
 *   - The command line itself (reading files, a missing report): it is a short loop
 *     around these functions, run by every CI job, whose output shows on the run's page.
 *   - The exact report formats of every Vitest and Playwright version: the reports here
 *     carry only the fields the module reads, copied from real reports of Vitest 5.0 and
 *     Playwright 1.62.
 */
import { describe, expect, it } from 'vitest';

import {
  combineTimingsOfSeveralRuns,
  findWhichRunnerWroteTheReport,
  formatDurationInSeconds,
  pickTheSlowest,
  readTimingsFromPlaywrightReport,
  readTimingsFromVitestReport,
  writeSlowestTestsMarkdown,
} from './slowestTests.js';

const repositoryRoot = '/home/runner/work/bajaovrlay/bajaovrlay';

/** One test as Vitest's JSON report lists it inside its file. */
function createVitestTestResult(fullName: string, durationMs: number, status = 'passed') {
  return { fullName, duration: durationMs, status };
}

/** A Vitest JSON report of the files given, each with its start, end and tests. */
function createVitestReport(
  files: {
    path: string;
    startTime: number;
    endTime: number;
    tests: ReturnType<typeof createVitestTestResult>[];
  }[],
) {
  return {
    testResults: files.map((file) => ({
      name: `${repositoryRoot}/${file.path}`,
      startTime: file.startTime,
      endTime: file.endTime,
      assertionResults: file.tests,
    })),
  };
}

/** One spec as Playwright's JSON report lists it: its title, file and one run. */
function createPlaywrightSpec(
  file: string,
  title: string,
  durationMs: number,
  status = 'expected',
) {
  return { title, file, tests: [{ status, results: [{ duration: durationMs }] }] };
}

/** A Playwright JSON report of apps/control's e2e folder with the suites given. */
function createControlPlaywrightReport(suites: unknown[]) {
  return { config: { rootDir: `${repositoryRoot}/apps/control/e2e` }, suites };
}

describe('findWhichRunnerWroteTheReport', () => {
  const reportScenarios = [
    // Vitest's JSON report lists its test files under testResults.
    { name: 'knows a Vitest report', report: createVitestReport([]), expected: 'Vitest' },
    // Playwright's lists its files as suites.
    {
      name: 'knows a Playwright report',
      report: createControlPlaywrightReport([]),
      expected: 'Playwright',
    },
    // Some other JSON file matched by the pattern, such as a package's manifest.
    {
      name: 'gives null for a file that is neither',
      report: { name: '@bajaovrlay/control', version: '0.3.1' },
      expected: null,
    },
  ];

  it.each(reportScenarios)('$name', ({ report, expected }) => {
    // Arrange: the report of the row (in the table above).

    // Act: ask which runner wrote it.
    const runner = findWhichRunnerWroteTheReport(report);

    // Assert: the runner, or null.
    expect(runner, 'the report must be recognised by its content').toBe(expected);
  });
});

describe('readTimingsFromVitestReport', () => {
  it('times each file from its start to its end, and each test by its own duration', () => {
    // Arrange: one component test file of the data sources page, 13.4 s from start to
    // end, with two tests inside it.
    const report = createVitestReport([
      {
        path: 'apps/control/src/features/dataSources/DataSourcesPageFlexTest.test.tsx',
        startTime: 1_000,
        endTime: 14_400,
        tests: [
          createVitestTestResult('"Testar" shows the 20 cars the timing system answered', 2_100),
          createVitestTestResult('"Testar" says why when the address answers 500', 850),
        ],
      },
    ]);

    // Act: read the timings.
    const timings = readTimingsFromVitestReport(report, repositoryRoot);

    // Assert: the file and both tests, with paths from the repository root.
    expect(timings.files, 'the file must take its time from start to end').toEqual([
      {
        file: 'apps/control/src/features/dataSources/DataSourcesPageFlexTest.test.tsx',
        durationMs: 13_400,
      },
    ]);
    expect(timings.tests, 'each test must keep its full name and its own time').toEqual([
      {
        file: 'apps/control/src/features/dataSources/DataSourcesPageFlexTest.test.tsx',
        test: '"Testar" shows the 20 cars the timing system answered',
        durationMs: 2_100,
      },
      {
        file: 'apps/control/src/features/dataSources/DataSourcesPageFlexTest.test.tsx',
        test: '"Testar" says why when the address answers 500',
        durationMs: 850,
      },
    ]);
  });

  it('counts passed, failed and skipped tests, a "todo" counting as skipped', () => {
    // Arrange: a server test file with one test of each status.
    const report = createVitestReport([
      {
        path: 'apps/server/src/modules/dataSources/adapters/simulator/flags.test.ts',
        startTime: 0,
        endTime: 40,
        tests: [
          createVitestTestResult('draws three yellows in a four-hour enduro', 3, 'passed'),
          createVitestTestResult('never starts a yellow at the green flag', 2, 'failed'),
          createVitestTestResult('keeps a red inside the middle half', 0, 'skipped'),
          createVitestTestResult('draws a red in one race in four', 0, 'todo'),
        ],
      },
    ]);

    // Act: read the timings.
    const timings = readTimingsFromVitestReport(report, repositoryRoot);

    // Assert: one passed, one failed, two skipped.
    expect(timings.counts, 'every status must be counted once, todo as skipped').toEqual({
      passed: 1,
      failed: 1,
      skipped: 2,
    });
  });
});

describe('readTimingsFromPlaywrightReport', () => {
  it('finds tests inside nested describe blocks and names them with those blocks', () => {
    // Arrange: the tower's e2e file, whose file suite holds a describe block with two
    // tests, and a third test straight in the file.
    const towerFile = 'towerFollowsTheSimulator.e2e.ts';
    const report = createControlPlaywrightReport([
      {
        title: towerFile,
        file: towerFile,
        specs: [createPlaywrightSpec(towerFile, 'keeps the clock above the tower', 9_000)],
        suites: [
          {
            title: 'the positions tower',
            file: towerFile,
            specs: [
              createPlaywrightSpec(towerFile, 'shows the first 20 of 60 cars', 31_000),
              createPlaywrightSpec(towerFile, 'swaps rows by itself', 64_000),
            ],
          },
        ],
      },
    ]);

    // Act: read the timings.
    const timings = readTimingsFromPlaywrightReport(report, repositoryRoot);

    // Assert: three tests, named with their describe block, and the file is their sum.
    expect(
      timings.tests.map((testTiming) => testTiming.test),
      'every test must be found, named after the describe blocks around it',
    ).toEqual([
      'keeps the clock above the tower',
      'the positions tower › shows the first 20 of 60 cars',
      'the positions tower › swaps rows by itself',
    ]);
    expect(timings.files, "the file's time must be the sum of its tests' times").toEqual([
      { file: 'apps/control/e2e/towerFollowsTheSimulator.e2e.ts', durationMs: 104_000 },
    ]);
  });

  it('counts an expected result as passed, an unexpected one as failed, and skipped as skipped', () => {
    // Arrange: one file with a passing, a failing and a skipped test.
    const takeFile = 'takeAndClear.e2e.ts';
    const report = createControlPlaywrightReport([
      {
        title: takeFile,
        file: takeFile,
        specs: [
          createPlaywrightSpec(takeFile, 'takes the clock on air', 4_000, 'expected'),
          createPlaywrightSpec(takeFile, 'clears the clock', 3_000, 'unexpected'),
          createPlaywrightSpec(takeFile, 'waits for OBS', 0, 'skipped'),
        ],
      },
    ]);

    // Act: read the timings.
    const timings = readTimingsFromPlaywrightReport(report, repositoryRoot);

    // Assert: one of each.
    expect(timings.counts, "Playwright's statuses must map to passed, failed and skipped").toEqual({
      passed: 1,
      failed: 1,
      skipped: 1,
    });
  });
});

describe('combineTimingsOfSeveralRuns', () => {
  it('puts the files, tests and counts of two shards together', () => {
    // Arrange: two shards of apps/control, one test file each.
    const firstShard = readTimingsFromPlaywrightReport(
      createControlPlaywrightReport([
        {
          title: 'takeAndClear.e2e.ts',
          file: 'takeAndClear.e2e.ts',
          specs: [createPlaywrightSpec('takeAndClear.e2e.ts', 'takes the clock on air', 4_000)],
        },
      ]),
      repositoryRoot,
    );
    const secondShard = readTimingsFromPlaywrightReport(
      createControlPlaywrightReport([
        {
          title: 'recordAndReplay.e2e.ts',
          file: 'recordAndReplay.e2e.ts',
          specs: [createPlaywrightSpec('recordAndReplay.e2e.ts', 'records 40 lines', 22_000)],
        },
      ]),
      repositoryRoot,
    );

    // Act: combine them.
    const combined = combineTimingsOfSeveralRuns([firstShard, secondShard]);

    // Assert: both files, both tests, two passed.
    expect(combined.files, 'both shards’ files must be listed').toHaveLength(2);
    expect(combined.tests, 'both shards’ tests must be listed').toHaveLength(2);
    expect(combined.counts, 'the counts must add up').toEqual({ passed: 2, failed: 0, skipped: 0 });
  });
});

describe('pickTheSlowest', () => {
  it('gives the slowest first, at most the count asked for, and leaves the list alone', () => {
    // Arrange: three files of the item editor in the order the report had them.
    const timings = [
      { file: 'ItemEditorPanelBindings.test.tsx', durationMs: 3_200 },
      { file: 'ItemEditorPanelEventField.test.tsx', durationMs: 8_900 },
      { file: 'ItemEditorPanelEntityField.test.tsx', durationMs: 5_100 },
    ];
    const orderAsRead = timings.map((timing) => timing.file);

    // Act: ask for the two slowest.
    const slowest = pickTheSlowest(timings, 2);

    // Assert: 8.9 s then 5.1 s, and the list given is in its first order still.
    expect(
      slowest.map((timing) => timing.durationMs),
      'the two slowest must come first, slowest at the top',
    ).toEqual([8_900, 5_100]);
    expect(
      timings.map((timing) => timing.file),
      'the list given must not be reordered',
    ).toEqual(orderAsRead);
  });
});

describe('formatDurationInSeconds', () => {
  const durationScenarios = [
    // A typical slow component test file.
    { name: 'shows 13 400 ms as 13.4 s', durationMs: 13_400, expected: '13.4 s' },
    // A fast unit test must still read as a time, not as an empty cell.
    { name: 'shows 17 ms as 0.0 s', durationMs: 17, expected: '0.0 s' },
    // The tower's long e2e test: minutes stay in seconds so the column compares at a glance.
    { name: 'shows 104 000 ms as 104.0 s', durationMs: 104_000, expected: '104.0 s' },
  ];

  it.each(durationScenarios)('$name', ({ durationMs, expected }) => {
    // Arrange: the duration of the row (in the table above).

    // Act: format it.
    const formatted = formatDurationInSeconds(durationMs);

    // Assert: seconds with one decimal.
    expect(formatted, 'the time must read in seconds with one decimal').toBe(expected);
  });
});

describe('writeSlowestTestsMarkdown', () => {
  it('writes the counts, then the slowest files and tests as tables, a "|" kept inside its cell', () => {
    // Arrange: one Vitest file with a test whose name holds a "|", as a keyboard
    // shortcut's name might.
    const timings = readTimingsFromVitestReport(
      createVitestReport([
        {
          path: 'apps/control/src/features/rundown/RundownKeys.test.tsx',
          startTime: 0,
          endTime: 2_500,
          tests: [createVitestTestResult('Space | Enter takes the next item', 1_200)],
        },
      ]),
      repositoryRoot,
    );

    // Act: write the markdown with up to 15 rows.
    const markdown = writeSlowestTestsMarkdown('Vitest', timings, 15);

    // Assert: the heading, the counts, a file row and a test row with the "|" escaped.
    expect(markdown, 'the heading must name the runner and the count').toContain(
      '### Vitest: the 15 slowest',
    );
    expect(markdown, 'the counts must be stated under the heading').toContain(
      'Files: 1. Tests: 1 (1 passed, 0 failed, 0 skipped).',
    );
    expect(markdown, 'the file must be a row with its time').toContain(
      '| apps/control/src/features/rundown/RundownKeys.test.tsx | 2.5 s |',
    );
    expect(markdown, 'a "|" in a test name must be escaped so the row keeps its columns').toContain(
      '| Space \\| Enter takes the next item | apps/control/src/features/rundown/RundownKeys.test.tsx | 1.2 s |',
    );
  });
});
