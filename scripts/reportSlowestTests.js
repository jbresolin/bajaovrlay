// Prints the slowest-tests tables (slowestTests.js) for the JSON reports named on the
// command line, as markdown. CI appends the output to $GITHUB_STEP_SUMMARY:
//
//   node scripts/reportSlowestTests.js vitest-report.json \
//     apps/*/test-results/playwright-results.json
//
// Each report is told apart by its content, so a shell pattern can name every package's
// report at once. A report that is missing (its tests failed before writing it, or the
// pattern matched nothing) is named in the output and skipped, so this step never hides
// the failure that matters.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  combineTimingsOfSeveralRuns,
  findWhichRunnerWroteTheReport,
  readTimingsFromPlaywrightReport,
  readTimingsFromVitestReport,
  writeSlowestTestsMarkdown,
} from './slowestTests.js';

// Fifteen rows: the brief's number, enough to see a whole family of slow files.
const rowsInEachTable = 15;
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const reportPaths = process.argv.slice(2);

const vitestRuns = [];
const playwrightRuns = [];
for (const reportPath of reportPaths) {
  if (!existsSync(reportPath)) {
    process.stdout.write(`_No report at ${reportPath}: its tests did not finish._\n\n`);
    continue;
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const runner = findWhichRunnerWroteTheReport(report);
  if (runner === 'Vitest') {
    vitestRuns.push(readTimingsFromVitestReport(report, repositoryRoot));
  } else if (runner === 'Playwright') {
    playwrightRuns.push(readTimingsFromPlaywrightReport(report, repositoryRoot));
  } else {
    process.stdout.write(`_${reportPath} is neither a Vitest nor a Playwright report._\n\n`);
  }
}

if (vitestRuns.length > 0) {
  const vitestTimings = combineTimingsOfSeveralRuns(vitestRuns);
  process.stdout.write(`${writeSlowestTestsMarkdown('Vitest', vitestTimings, rowsInEachTable)}\n`);
}
if (playwrightRuns.length > 0) {
  const playwrightTimings = combineTimingsOfSeveralRuns(playwrightRuns);
  process.stdout.write(
    `${writeSlowestTestsMarkdown('Playwright', playwrightTimings, rowsInEachTable)}\n`,
  );
}
