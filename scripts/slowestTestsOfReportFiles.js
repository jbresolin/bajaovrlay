// The slowest-tests report of a CI job, from its JSON report files on disk
// (BAJAOVRLAY-42): reads each file, hands it to slowestTests.js, and puts the tables
// together. Kept apart from slowestTests.js, which never touches the disk, because this is
// the part that must survive whatever a failed or cancelled job left behind.
import { existsSync, readFileSync } from 'node:fs';

import {
  combineTimingsOfSeveralRuns,
  findWhichRunnerWroteTheReport,
  readTimingsFromPlaywrightReport,
  readTimingsFromVitestReport,
  writeSlowestTestsMarkdown,
} from './slowestTests.js';

/**
 * @typedef {import('./slowestTests.js').TimingsOfOneRun} TimingsOfOneRun
 */

/**
 * The whole report of a CI job: the slowest-tests tables of the JSON reports at
 * `reportPaths`, as markdown, Vitest first. It never throws, because it runs after the
 * tests and must never turn a green job red: a report that is missing (its tests did not
 * finish) or cannot be read (not JSON, an unknown shape) gets a line saying so, and the
 * others are still shown.
 * @param {string[]} reportPaths
 * @param {string} repositoryRoot
 * @param {number} rowsInEachTable
 * @returns {string}
 */
export function writeSlowestTestsReportOfFiles(reportPaths, repositoryRoot, rowsInEachTable) {
  /** @type {string[]} */
  const lines = [];
  /** @type {TimingsOfOneRun[]} */
  const vitestRuns = [];
  /** @type {TimingsOfOneRun[]} */
  const playwrightRuns = [];
  for (const reportPath of reportPaths) {
    if (!existsSync(reportPath)) {
      lines.push(`_No report at ${reportPath}: its tests did not finish._\n`);
      continue;
    }
    try {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      const runner = findWhichRunnerWroteTheReport(report);
      if (runner === 'Vitest') {
        vitestRuns.push(readTimingsFromVitestReport(report, repositoryRoot));
      } else if (runner === 'Playwright') {
        playwrightRuns.push(readTimingsFromPlaywrightReport(report, repositoryRoot));
      } else {
        lines.push(`_${reportPath} is neither a Vitest nor a Playwright report._\n`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lines.push(`_não foi possível ler ${reportPath}: ${reason}_\n`);
    }
  }
  if (vitestRuns.length > 0) {
    const vitestTimings = combineTimingsOfSeveralRuns(vitestRuns);
    lines.push(writeSlowestTestsMarkdown('Vitest', vitestTimings, rowsInEachTable));
  }
  if (playwrightRuns.length > 0) {
    const playwrightTimings = combineTimingsOfSeveralRuns(playwrightRuns);
    lines.push(writeSlowestTestsMarkdown('Playwright', playwrightTimings, rowsInEachTable));
  }
  return lines.join('\n');
}
