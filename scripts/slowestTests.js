// The slowest-tests table of every CI run (BAJAOVRLAY-42): reads Vitest's and Playwright's
// JSON reports and writes the slowest files and tests as a small markdown table, which CI
// appends to the run's summary page. A test that turns slow then shows on the run's page,
// without anyone downloading a log. The reading and the writing are here, pure;
// reportSlowestTests.js only reads the files and prints.
import path from 'node:path';

/**
 * @typedef {{ file: string, durationMs: number }} FileTiming
 * @typedef {{ file: string, test: string, durationMs: number }} TestTiming
 * @typedef {{ passed: number, failed: number, skipped: number }} TestCounts
 * @typedef {{ files: FileTiming[], tests: TestTiming[], counts: TestCounts }} TimingsOfOneRun
 */

/**
 * Which runner wrote a JSON report: Vitest's lists `testResults`, Playwright's lists
 * `suites`. Anything else is neither, and gives null.
 * @param {any} report the parsed JSON report
 * @returns {'Vitest' | 'Playwright' | null}
 */
export function findWhichRunnerWroteTheReport(report) {
  if (Array.isArray(report?.testResults)) {
    return 'Vitest';
  }
  if (Array.isArray(report?.suites)) {
    return 'Playwright';
  }
  return null;
}

/**
 * The timings in Vitest's JSON report (`--reporter=json`): one file per entry of
 * `testResults`, from its start to its end, and every test with its own duration.
 * File paths become relative to `repositoryRoot`, so the table reads the same on any machine.
 * @param {any} report the parsed JSON report
 * @param {string} repositoryRoot
 * @returns {TimingsOfOneRun}
 */
export function readTimingsFromVitestReport(report, repositoryRoot) {
  /** @type {FileTiming[]} */
  const files = [];
  /** @type {TestTiming[]} */
  const tests = [];
  /** @type {TestCounts} */
  const counts = { passed: 0, failed: 0, skipped: 0 };
  for (const fileResult of report.testResults) {
    const file = path.relative(repositoryRoot, fileResult.name);
    files.push({ file, durationMs: fileResult.endTime - fileResult.startTime });
    for (const testResult of fileResult.assertionResults) {
      tests.push({ file, test: testResult.fullName, durationMs: testResult.duration ?? 0 });
      countTestByItsStatus(counts, testResult.status);
    }
  }
  return { files, tests, counts };
}

/**
 * The timings in Playwright's JSON report (`--reporter=json`). Its suites nest (a file,
 * then each `test.describe`), so every level is walked. A test's time is the sum of its
 * runs (there is one, since retries stay at 0), and a file's time is the sum of its tests'.
 * @param {any} report the parsed JSON report
 * @param {string} repositoryRoot
 * @returns {TimingsOfOneRun}
 */
export function readTimingsFromPlaywrightReport(report, repositoryRoot) {
  /** @type {TestTiming[]} */
  const tests = [];
  /** @type {TestCounts} */
  const counts = { passed: 0, failed: 0, skipped: 0 };
  const testFolder = report.config.rootDir;
  for (const suite of report.suites) {
    collectTestsOfPlaywrightSuite(suite, [], { testFolder, repositoryRoot, tests, counts });
  }

  /** @type {Map<string, number>} */
  const durationOfEachFile = new Map();
  for (const testTiming of tests) {
    const durationSoFar = durationOfEachFile.get(testTiming.file) ?? 0;
    durationOfEachFile.set(testTiming.file, durationSoFar + testTiming.durationMs);
  }
  /** @type {FileTiming[]} */
  const files = [];
  for (const [file, durationMs] of durationOfEachFile) {
    files.push({ file, durationMs });
  }
  return { files, tests, counts };
}

/**
 * Adds the tests of one Playwright suite, and of the suites inside it, to `found.tests`.
 * `titles` holds the names of the describe blocks above it, for the test's full name.
 * @param {any} suite
 * @param {string[]} titles
 * @param {{ testFolder: string, repositoryRoot: string, tests: TestTiming[], counts: TestCounts }} found
 * @returns {void}
 */
function collectTestsOfPlaywrightSuite(suite, titles, found) {
  // The top suite of each file is titled with the file's name, already in the File column.
  const isFileSuite = titles.length === 0 && suite.title === suite.file;
  const titlesInside = isFileSuite ? titles : [...titles, suite.title];
  for (const spec of suite.specs ?? []) {
    const file = path.relative(found.repositoryRoot, path.join(found.testFolder, spec.file));
    const test = [...titlesInside, spec.title].join(' › ');
    for (const testOfAProject of spec.tests) {
      let durationMs = 0;
      for (const run of testOfAProject.results) {
        durationMs += run.duration;
      }
      found.tests.push({ file, test, durationMs });
      countTestByItsStatus(found.counts, testOfAProject.status);
    }
  }
  for (const innerSuite of suite.suites ?? []) {
    collectTestsOfPlaywrightSuite(innerSuite, titlesInside, found);
  }
}

/**
 * Counts one test as passed, failed or skipped. Vitest says "passed", "failed",
 * "skipped", "pending" or "todo"; Playwright says "expected", "unexpected", "flaky" or
 * "skipped". A flaky test failed at least once, and since retries stay at 0 it cannot
 * happen, but if it did it counts as failed: a flaky test is a bug.
 * @param {TestCounts} counts
 * @param {string} status
 * @returns {void}
 */
function countTestByItsStatus(counts, status) {
  if (status === 'passed' || status === 'expected') {
    counts.passed += 1;
  } else if (status === 'failed' || status === 'unexpected' || status === 'flaky') {
    counts.failed += 1;
  } else {
    counts.skipped += 1;
  }
}

/**
 * Puts several runs' timings together, as one run: the Playwright reports of the
 * packages and of each shard of apps/control make one table.
 * @param {TimingsOfOneRun[]} runs
 * @returns {TimingsOfOneRun}
 */
export function combineTimingsOfSeveralRuns(runs) {
  /** @type {TimingsOfOneRun} */
  const combined = { files: [], tests: [], counts: { passed: 0, failed: 0, skipped: 0 } };
  for (const run of runs) {
    combined.files.push(...run.files);
    combined.tests.push(...run.tests);
    combined.counts.passed += run.counts.passed;
    combined.counts.failed += run.counts.failed;
    combined.counts.skipped += run.counts.skipped;
  }
  return combined;
}

/**
 * The `count` slowest entries, slowest first. The list given is not changed.
 * @template {{ durationMs: number }} Timing
 * @param {Timing[]} timings
 * @param {number} count
 * @returns {Timing[]}
 */
export function pickTheSlowest(timings, count) {
  const slowestFirst = [...timings].sort((first, second) => second.durationMs - first.durationMs);
  return slowestFirst.slice(0, count);
}

/**
 * A duration as the table shows it: seconds with one decimal ("13.4 s"), which is
 * fine enough to see a slowdown and short enough to read down a column.
 * @param {number} durationMs
 * @returns {string}
 */
export function formatDurationInSeconds(durationMs) {
  return `${(durationMs / 1000).toFixed(1)} s`;
}

/**
 * Makes text safe inside a markdown table cell: a `|` would end the cell early, and a
 * line break would end the row.
 * @param {string} text
 * @returns {string}
 */
function escapeForTableCell(text) {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/**
 * The markdown section of one test runner: a heading, the test counts, then the slowest
 * files and the slowest tests, each as a table.
 * @param {string} runnerName "Vitest" or "Playwright"
 * @param {TimingsOfOneRun} timings
 * @param {number} count how many rows each table shows
 * @returns {string}
 */
export function writeSlowestTestsMarkdown(runnerName, timings, count) {
  const { passed, failed, skipped } = timings.counts;
  const lines = [
    `### ${runnerName}: the ${count} slowest`,
    '',
    `Files: ${timings.files.length}. Tests: ${passed + failed + skipped} (${passed} passed, ${failed} failed, ${skipped} skipped).`,
    '',
    '| File | Time |',
    '| --- | ---: |',
  ];
  for (const fileTiming of pickTheSlowest(timings.files, count)) {
    lines.push(
      `| ${escapeForTableCell(fileTiming.file)} | ${formatDurationInSeconds(fileTiming.durationMs)} |`,
    );
  }
  lines.push('', '| Test | File | Time |', '| --- | --- | ---: |');
  for (const testTiming of pickTheSlowest(timings.tests, count)) {
    lines.push(
      `| ${escapeForTableCell(testTiming.test)} | ${escapeForTableCell(testTiming.file)} | ${formatDurationInSeconds(testTiming.durationMs)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}
