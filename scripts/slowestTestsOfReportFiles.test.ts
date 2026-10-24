/**
 * The slowest-tests report of a CI job, from its report files (scripts)
 *
 * What this module is for:
 *   Every CI job ends by printing the slowest-tests tables of the JSON reports its tests
 *   wrote (reportSlowestTests.js). The step runs after the tests, a failed or cancelled
 *   job's included, so it must never throw: a red line from the report would turn a green
 *   job red, or hide the failure that matters behind its own.
 *
 * What these tests prove:
 *   - A missing report is named, and the other reports are still shown.
 *   - A report that cannot be read (cut short, not JSON; JSON of an unknown shape) is
 *     named in pt-BR ("não foi possível ler …"), nothing throws, and the other reports are
 *     still shown.
 *
 * What these tests deliberately do not cover:
 *   - How a report is read and the tables written: slowestTests.test.ts.
 *   - The command line: reportSlowestTests.js prints what this returns, and every CI job
 *     runs it.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeSlowestTestsReportOfFiles } from './slowestTestsOfReportFiles.js';

const repositoryRoot = '/home/runner/work/bajaovrlay/bajaovrlay';

/** One test as Vitest's JSON report lists it inside its file. */
function createVitestTestResult(fullName: string, durationMs: number) {
  return { fullName, duration: durationMs, status: 'passed' };
}

/** A Vitest JSON report of one file, with its start, end and tests. */
function createVitestReport(file: {
  path: string;
  startTime: number;
  endTime: number;
  tests: ReturnType<typeof createVitestTestResult>[];
}) {
  return {
    testResults: [
      {
        name: `${repositoryRoot}/${file.path}`,
        startTime: file.startTime,
        endTime: file.endTime,
        assertionResults: file.tests,
      },
    ],
  };
}

/** A folder of its own for the report files of one test. */
function createReportFolder(): string {
  return mkdtempSync(join(tmpdir(), 'relatorios-de-teste-'));
}

/** Writes a Vitest report with one 2.5 s file of the rundown into `folder`. */
function writeRundownVitestReport(folder: string): string {
  const reportPath = join(folder, 'vitest-report.json');
  const report = createVitestReport({
    path: 'apps/control/src/features/rundown/RundownKeys.test.tsx',
    startTime: 0,
    endTime: 2_500,
    tests: [createVitestTestResult('Space takes the next item', 1_200)],
  });
  writeFileSync(reportPath, JSON.stringify(report));
  return reportPath;
}

describe('writeSlowestTestsReportOfFiles', () => {
  it('names a missing report and still shows the others', () => {
    // Arrange: a Vitest report, and the path of a control shard's report its tests never
    // wrote.
    const folder = createReportFolder();
    const vitestReportPath = writeRundownVitestReport(folder);
    const missingReportPath = join(folder, 'playwright-results.json');

    // Act: write the job's report.
    const markdown = writeSlowestTestsReportOfFiles(
      [vitestReportPath, missingReportPath],
      repositoryRoot,
      15,
    );

    // Assert: a line for the missing one, and the Vitest table all the same.
    expect(markdown, 'the missing report must be named').toContain(
      `_No report at ${missingReportPath}: its tests did not finish._`,
    );
    expect(markdown, 'the readable report must still be shown').toContain(
      '### Vitest: the 15 slowest',
    );
  });

  const unreadableScenarios = [
    // Cut short: a job cancelled while the reporter was writing.
    { name: 'a report that is not JSON', text: '{"testResults": [{"name": ' },
    // JSON of a shape the reader does not know: a file without its tests.
    {
      name: 'a report of an unknown shape',
      text: JSON.stringify({ testResults: [{ name: `${repositoryRoot}/a.test.ts` }] }),
    },
  ];

  it.each(unreadableScenarios)('names $name in pt-BR and still shows the others', ({ text }) => {
    // Arrange: a readable Vitest report, and the unreadable one of the row (in the table
    // above).
    const folder = createReportFolder();
    const vitestReportPath = writeRundownVitestReport(folder);
    const unreadableReportPath = join(folder, 'playwright-results.json');
    writeFileSync(unreadableReportPath, text);

    // Act: write the job's report.
    const write = () =>
      writeSlowestTestsReportOfFiles([unreadableReportPath, vitestReportPath], repositoryRoot, 15);

    // Assert: it does not throw, names the unreadable report, and shows the other.
    expect(write, 'the report of a job must never throw').not.toThrow();
    const markdown = write();
    expect(markdown, 'the unreadable report must be named').toContain(
      `_não foi possível ler ${unreadableReportPath}: `,
    );
    expect(markdown, 'the readable report must still be shown').toContain(
      '| apps/control/src/features/rundown/RundownKeys.test.tsx | 2.5 s |',
    );
  });
});
