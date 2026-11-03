// Benchmark: how fast the replay loads a large recording, and how long it holds the
// server's event loop meanwhile. Run it by hand, on a quiet machine:
//
//   pnpm --filter @bajaovrlay/server benchmark:replay-loading
//
// It is not a CI gate. These were once asserted in replayAdapterLoading.test.ts, where
// writing and reading 78 MB took 4 s of the test's 5 s budget on one busy core and the
// stall, measured in wall time, grew whenever another process took the core
// (BAJAOVRLAY-52). CI now checks, with no clock, that the read streams
// (recordedLinesFromChunks.test.ts) and reaches the last line (replayAdapterLoading);
// this measures how fast.
//
// What it prints, for a recording of 2 000 lines of 60 cars (about 78 MB):
//   - the load time: the replay prepared as the poller prepares one turned on, then the
//     first poll, timed together; about a third of a second on João's machine;
//   - the longest stall of the event loop during that load (the longest wait between
//     two ticks of a 10 ms ticker); 12 to 15 ms;
//   - the old way's stall: the whole file read as one text and every line parsed in one
//     go, on the same machine right after; 260 to 370 ms.
// The two bounds the test used to hold are printed beside them: load under 3 s, and the
// stream's stall under a third of the old way's. Either missed sets exit code 1.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  fileNameOfTheLargeRecording,
  writeTheLargeRecordingInto,
} from '../../largeRecording.testSupport.js';
import { createReplayAdapter } from './replayAdapter.js';
import {
  buildFridayReplayConfig,
  buildPollContextAt,
  replayTurnedOnAtMs,
} from './replayAdapter.testSupport.js';

/** The load time the test once held as a sanity ceiling for a slow machine. */
const largestLoadTimeMs = 3_000;

/** How much shorter than the old way's the streamed load's longest stall should be. */
const largestStallAsAShareOfTheOldWay = 1 / 3;

/** The old way of loading a recording: read the whole file as one text, parse every line. */
function parseEveryLineOfAFileInOneGo(filePath: string): unknown[] {
  const lineTexts = readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((lineText) => lineText !== '');
  return lineTexts.map((lineText) => JSON.parse(lineText) as unknown);
}

/** Loads the large recording through the replay, timing the load and its longest stall. */
async function measureTheStreamedLoad(recordingsFolder: string) {
  const replayAdapter = createReplayAdapter({ recordingsFolder });
  const config = {
    ...buildFridayReplayConfig(1),
    recordingId: `simulador-enduro/${fileNameOfTheLargeRecording}`,
  };
  let longestWaitBetweenTicksMs = 0;
  let lastTickAtMs = performance.now();
  const ticker = setInterval(() => {
    const nowMs = performance.now();
    longestWaitBetweenTicksMs = Math.max(longestWaitBetweenTicksMs, nowMs - lastTickAtMs);
    lastTickAtMs = nowMs;
  }, 10);

  const startedAtMs = performance.now();
  replayAdapter.prepareForPolling?.(config);
  await replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
  const loadTimeMs = performance.now() - startedAtMs;
  clearInterval(ticker);
  // A load that held the loop to its very end leaves no tick after it: count that wait.
  longestWaitBetweenTicksMs = Math.max(longestWaitBetweenTicksMs, performance.now() - lastTickAtMs);
  return { loadTimeMs, longestStallMs: longestWaitBetweenTicksMs };
}

/** Times the old way on the same file: it holds the loop from start to end. */
function measureTheOldWaysStall(recordingsFolder: string): number {
  const startedAtMs = performance.now();
  parseEveryLineOfAFileInOneGo(
    join(recordingsFolder, 'simulador-enduro', fileNameOfTheLargeRecording),
  );
  return performance.now() - startedAtMs;
}

/** Writes the recording, measures both ways, prints the numbers and sets the exit code. */
async function runTheBenchmark(): Promise<void> {
  const recordingsFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-benchmark-'));
  try {
    writeTheLargeRecordingInto(recordingsFolder);
    const { loadTimeMs, longestStallMs } = await measureTheStreamedLoad(recordingsFolder);
    const oldWayStallMs = measureTheOldWaysStall(recordingsFolder);
    const longestStallAllowedMs = oldWayStallMs * largestStallAsAShareOfTheOldWay;
    const isLoadQuickEnough = loadTimeMs < largestLoadTimeMs;
    const isStallShortEnough = longestStallMs < longestStallAllowedMs;

    process.stdout.write(
      [
        'Replay loading, 2 000 lines of 60 cars (about 78 MB):',
        `  load time:          ${loadTimeMs.toFixed(0)} ms (bound ${String(largestLoadTimeMs)} ms) ${isLoadQuickEnough ? 'ok' : 'OVER'}`,
        `  longest stall:      ${longestStallMs.toFixed(0)} ms (bound ${longestStallAllowedMs.toFixed(0)} ms, a third of the old way) ${isStallShortEnough ? 'ok' : 'OVER'}`,
        `  old way's stall:    ${oldWayStallMs.toFixed(0)} ms`,
        '',
      ].join('\n'),
    );
    process.exitCode = isLoadQuickEnough && isStallShortEnough ? 0 : 1;
  } finally {
    rmSync(recordingsFolder, { recursive: true, force: true });
  }
}

await runTheBenchmark();
