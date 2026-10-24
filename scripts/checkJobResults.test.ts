/**
 * "CI passed" reads the other jobs' results (scripts)
 *
 * What this module is for:
 *   João merges only on a green "CI passed", the last job of ci.yml. It runs
 *   checkJobResults.sh with the results of the jobs it needs, one word each, and must be
 *   red unless every one of them is "success". Branch protection is not available on this
 *   repository's plan, so this script is the whole merge gate.
 *
 * What these tests prove:
 *   - Every job a success: it passes and says so.
 *   - One job failed, cancelled (a timeout) or skipped: it fails and names the result.
 *   - No results at all: it fails, since nothing was checked.
 *
 * What these tests deliberately do not cover:
 *   - That GitHub hands it the right results (`join(needs.*.result, ' ')` in ci.yml):
 *     that is GitHub's, and the job's log prints the list it received.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('./checkJobResults.sh', import.meta.url));

/** Runs the script as "CI passed" does, with the results given. */
function runCheckJobResults(resultsOfTheJobs: string) {
  const run = spawnSync('bash', [scriptPath], {
    env: { PATH: process.env.PATH, RESULTS_OF_THE_JOBS: resultsOfTheJobs },
    encoding: 'utf8',
  });
  return { exitCode: run.status, output: run.stdout };
}

describe('checkJobResults.sh', () => {
  const resultScenarios = [
    // The normal green run: Vitest, the checks job and the two control shards (one result
    // for the matrix job) all passed.
    {
      name: 'passes when every job is a success',
      results: 'success success success',
      expectedExitCode: 0,
      expectedLine: 'Every job passed.',
    },
    // A test failed in one control shard.
    {
      name: 'fails when one job failed',
      results: 'success failure success',
      expectedExitCode: 1,
      expectedLine: 'A job ended as "failure", so CI did not pass.',
    },
    // A job past its timeout-minutes ends as cancelled, which is not a pass.
    {
      name: 'fails when one job was cancelled',
      results: 'success success cancelled',
      expectedExitCode: 1,
      expectedLine: 'A job ended as "cancelled", so CI did not pass.',
    },
    // A skipped job proved nothing, so it cannot count as green.
    {
      name: 'fails when one job was skipped',
      results: 'skipped success success',
      expectedExitCode: 1,
      expectedLine: 'A job ended as "skipped", so CI did not pass.',
    },
    // An empty list would loop over nothing and pass if it were not caught.
    {
      name: 'fails when no results are given',
      results: '',
      expectedExitCode: 1,
      expectedLine: 'No job results were given, so CI did not pass.',
    },
  ];

  it.each(resultScenarios)('$name', ({ results, expectedExitCode, expectedLine }) => {
    // Arrange: the results of the row (in the table above).

    // Act: run the script.
    const run = runCheckJobResults(results);

    // Assert: the exit code and the line that explains it.
    expect(run.exitCode, 'the exit code must pass or fail CI as the row says').toBe(
      expectedExitCode,
    );
    expect(run.output, 'the log must say why').toContain(expectedLine);
  });
});
