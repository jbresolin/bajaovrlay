/**
 * The replay adapter, checking lines and loading large recordings (apps/server)
 *
 * What this module is for:
 *   A recording of a whole enduro is thousands of lines of 60 cars. Loading one must
 *   never stall the server: the file is read as a stream, a line at a time, and each line
 *   is only parsed (its moment and its shapes object), because the lines were checked
 *   when they were written. Only the line a poll answers is checked against the shapes,
 *   so a bad recorded line fails that poll instead of anything worse (gate 2 on PR #16).
 *
 * What these tests prove (real files in a temporary folder, a fake clock in the context):
 *   - A line that is read but fails its shapes fails the poll that answers it, with a
 *     pt-BR reason naming the recording.
 *   - A line recorded before BAJAOVRLAY-24, whose standings carry points per event
 *     (`pointsByEvent`, since replaced by the score parts), still replays: the old field
 *     is dropped, never a failure.
 *   - A recording of 2 000 lines of 60 cars (about 50 MB), prepared as the poller
 *     prepares a replay turned on and then polled, loads in under largestLoadTimeMs, and
 *     the server's event loop is never held meanwhile for more than a third of what the
 *     old way (reading and parsing the whole file in one go) holds it on the same machine.
 *
 * What these tests deliberately do not cover:
 *   - Answering the right line as the clock moves, and the memory bound;
 *     replayAdapter.test.ts covers them. What a poll does while the read is still going
 *     (its signal firing, "Carregando a gravação…"); replayAdapterAbortSignal.test.ts.
 *   - A whole 4-hour enduro (7 200 lines, 180 MB): writing it would cost the test itself
 *     seconds; loading time grows with the file, a line at a time.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fileNameOfTheLargeRecording,
  writeTheLargeRecordingInto,
} from '../../largeRecording.testSupport.js';
import { createTemporaryRecordingsFolder } from '../../recorder.testSupport.js';
import { buildRecordingLineText } from '../../recordingLine.js';
import { buildFridayPositionsAt, buildFridayRecordingLines } from './fridayTraining.testSupport.js';
import { createReplayAdapter } from './replayAdapter.js';
import {
  buildFridayReplayConfig,
  buildPollContextAt,
  replayTurnedOnAtMs,
  writeRecordingLineTextsIntoAFolder,
} from './replayAdapter.testSupport.js';

/**
 * How long loading the large recording may take: about a third of a second here. 3 s is
 * a sanity ceiling for a slow CI machine: it catches a load that hangs, or one that grew
 * a step costing more per line the longer the file is. It does not catch a full check of
 * the 60 cars on every line (that adds only about 200 ms here); the stall check below
 * and the boot listing's bound (recordingsFromFolderLargeRecording.test.ts) are what
 * guard the large recordings (gate 2 on PR #16).
 */
const largestLoadTimeMs = 3_000;

/**
 * How much shorter than the old way the longest stall of the streamed load must be: at
 * most a third of it. The old way (the whole 50 MB read as one text and every line
 * parsed in one go) is measured in the same test, on the same machine, right after the
 * streamed load; here it holds the loop for 260 to 370 ms (alone, or beside the whole
 * suite), and the stream for 12 to 15 ms, so a third leaves the stream about seven
 * times its usual worst. Comparing the two, instead of the stall against a fixed number
 * of ms, keeps the test steady on a slow or busy CI machine (another test file running
 * beside it, a garbage collection), which slows both down alike.
 */
const largestStallAsAShareOfTheOldWay = 1 / 3;

/** The old way of loading a recording: read the whole file as one text, parse every line. */
function parseEveryLineOfAFileInOneGo(filePath: string): unknown[] {
  const lineTexts = readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((lineText) => lineText !== '');
  return lineTexts.map((lineText) => JSON.parse(lineText) as unknown);
}

describe('the replay adapter, checking lines and loading large recordings', () => {
  it('fails the poll, with a pt-BR reason, when the line it answers fails its shapes', async () => {
    // Arrange: a recording whose only line holds car 42 with a last lap of 0 ms, which
    // the positions shape no longer accepts (a lap time must be positive).
    const [firstLine] = buildFridayRecordingLines();
    if (firstLine === undefined) {
      throw new Error("Friday's recording must have a line");
    }
    const positionsWithAZeroLap = {
      ...buildFridayPositionsAt(firstLine.atMs),
      entries: buildFridayPositionsAt(firstLine.atMs).entries.map((entry) => ({
        ...entry,
        lastLapMs: 0,
      })),
    };
    const replayAdapter = createReplayAdapter({
      recordingsFolder: writeRecordingLineTextsIntoAFolder([
        buildRecordingLineText({
          atMs: firstLine.atMs,
          snapshotNumber: 1,
          shapes: { ...firstLine.shapes, positions: positionsWithAZeroLap },
        }),
      ]),
    });

    // Act: poll the replay.
    const polling = replayAdapter.pollOnce(
      buildFridayReplayConfig(1),
      buildPollContextAt(replayTurnedOnAtMs),
    );

    // Assert: the poll fails (the source goes stale, nothing crashes), saying which
    // recording holds the bad line.
    await expect(polling, 'a bad recorded line must fail the poll, in pt-BR').rejects.toThrow(
      'Uma linha da gravação "simulador-enduro/2027-08-13T13-00-00.000Z.jsonl" é inválida:',
    );
  });

  it('replays a line recorded before the score parts, dropping its points per event', async () => {
    // Arrange: a recording whose only line holds the overall standings as they were
    // written before BAJAOVRLAY-24: Jandaia Racing first, with points per event.
    const [firstLine] = buildFridayRecordingLines();
    if (firstLine === undefined) {
      throw new Error("Friday's recording must have a line");
    }
    const standingsWithPointsByEvent = {
      scope: 'overall',
      updatedAtMs: firstLine.atMs,
      entries: [
        {
          rank: 1,
          carNumber: 45,
          teamName: 'Jandaia Racing',
          schoolName: 'UFC',
          points: 646.9,
          pointsByEvent: { enduro: 376.5, acceleration: 54.1, speed: 71.2 },
        },
      ],
    };
    // Written by hand, as the recorder wrote it then: today's types no longer allow the
    // old field, which is exactly what this test is about.
    const oldLine = {
      atMs: firstLine.atMs,
      snapshotNumber: 1,
      shapes: { ...firstLine.shapes, standings: standingsWithPointsByEvent },
    };
    const lineText = `${JSON.stringify(oldLine)}\n`;
    const replayAdapter = createReplayAdapter({
      recordingsFolder: writeRecordingLineTextsIntoAFolder([lineText]),
    });

    // Act: poll the replay.
    const answer = await replayAdapter.pollOnce(
      buildFridayReplayConfig(1),
      buildPollContextAt(replayTurnedOnAtMs),
    );

    // Assert: the standings are answered, dated now, with the team and its total but
    // without the old points per event.
    expect(answer.shapes.standings, 'the old standings must replay, the old field dropped').toEqual(
      {
        scope: 'overall',
        updatedAtMs: replayTurnedOnAtMs,
        entries: [
          { rank: 1, carNumber: 45, teamName: 'Jandaia Racing', schoolName: 'UFC', points: 646.9 },
        ],
      },
    );
  });

  it('loads a recording of 2 000 lines of 60 cars quickly, without stalling the server', async () => {
    // Arrange: an hour of the simulator's 60-car enduro on disk (about 50 MB), a replay
    // of it, and a 10 ms ticker that notes the longest wait between two of its ticks.
    const recordingsFolder = createTemporaryRecordingsFolder();
    writeTheLargeRecordingInto(recordingsFolder);
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

    // Act: the replay prepared, as the poller does when it is turned on, which starts
    // reading the file, and the first poll, which waits for that read; timed together.
    const startedAtMs = performance.now();
    replayAdapter.prepareForPolling?.(config);
    const answer = await replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
    const loadTimeMs = performance.now() - startedAtMs;
    clearInterval(ticker);
    // A load that held the loop to its very end leaves no tick after it: count that wait.
    longestWaitBetweenTicksMs = Math.max(
      longestWaitBetweenTicksMs,
      performance.now() - lastTickAtMs,
    );

    // The old way, timed right after: the whole file read as one text and every line
    // parsed in one go, which holds the loop from start to end.
    const oldWayStartedAtMs = performance.now();
    parseEveryLineOfAFileInOneGo(
      join(recordingsFolder, 'simulador-enduro', fileNameOfTheLargeRecording),
    );
    const oldWayStallMs = performance.now() - oldWayStartedAtMs;
    const longestStallAllowedMs = oldWayStallMs * largestStallAsAShareOfTheOldWay;

    // Assert: the 60 cars answered, within both bounds.
    expect(answer.shapes.positions, 'the first line must answer its 60 cars').toHaveProperty(
      'entries.length',
      60,
    );
    expect(
      loadTimeMs,
      `loading a recording this large must stay quick (under ${String(largestLoadTimeMs)} ms)`,
    ).toBeLessThan(largestLoadTimeMs);
    expect(
      longestWaitBetweenTicksMs,
      `loading must let the server run between lines (no stall over ${String(Math.round(longestStallAllowedMs))} ms, a third of the old way's ${String(Math.round(oldWayStallMs))} ms)`,
    ).toBeLessThan(longestStallAllowedMs);
  });
});
