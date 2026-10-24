// Prints the slowest-tests tables for the JSON reports named on the command line, as
// markdown (slowestTestsOfReportFiles.js). CI appends the output to $GITHUB_STEP_SUMMARY:
//
//   node scripts/reportSlowestTests.js vitest-report.json \
//     apps/*/test-results/playwright-results.json
//
// Each report is told apart by its content, so a shell pattern can name every package's
// report at once. A report that is missing or cannot be read is named in the output and
// skipped (writeSlowestTestsReportOfFiles never throws), so this step never turns a green
// job red and never hides the failure that matters.
import { fileURLToPath } from 'node:url';

import { writeSlowestTestsReportOfFiles } from './slowestTestsOfReportFiles.js';

// Fifteen rows: the brief's number, enough to see a whole family of slow files.
const rowsInEachTable = 15;
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const reportPaths = process.argv.slice(2);

process.stdout.write(
  `${writeSlowestTestsReportOfFiles(reportPaths, repositoryRoot, rowsInEachTable)}\n`,
);
