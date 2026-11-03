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
 * What these tests prove (real files in a temporary folder, a clock stopped at a moment in
 * each poll's context):
 *   - A line that is read but fails its shapes fails the poll that answers it, with a
 *     pt-BR reason naming the recording.
 *   - A line recorded before BAJAOVRLAY-24, whose standings carry points per event
 *     (`pointsByEvent`, since replaced by the score parts), still replays: the old field
 *     is dropped, never a failure.
 *   - A recording the stream hands over in many chunks, prepared as the poller prepares
 *     a replay turned on and then polled, is read to its last line: lines cut between
 *     two chunks are put back together, and a poll past the end answers the last one.
 *
 * What these tests deliberately do not cover:
 *   - Answering the right line as the clock moves, and the memory bound;
 *     replayAdapter.test.ts covers them. What a poll does while the read is still going
 *     (its signal firing, "Carregando a gravação…"); replayAdapterAbortSignal.test.ts.
 *   - That lines are parsed as the chunks arrive, not after the whole file is read;
 *     recordedLinesFromChunks.test.ts checks it, with a stream it hands out by hand.
 *   - How fast a large recording loads and how long it holds the event loop: both are
 *     timings of the machine, which a busy CI core stretches, so they are measured by
 *     replayLoading.benchmark.ts (`pnpm --filter @bajaovrlay/server benchmark:replay-loading`),
 *     which prints them and is not a CI gate (BAJAOVRLAY-52).
 */
import { type ClockReading, computeClockTimeMsAtWallClock } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  fileNameOfTheLargeRecording,
  startOfTheLargeRecordingMs,
  writeTheLargeRecordingInto,
} from '../../largeRecording.testSupport.js';
import { createTemporaryRecordingsFolder, readRecordedLines } from '../../recorder.testSupport.js';
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
 * How many lines the recording of the streamed-load test holds: 40 lines of 60 cars,
 * about 1.5 MB, which the stream hands over in about 24 chunks of 64 KB, so most lines
 * are cut between two chunks. Large enough for that; small enough that writing and
 * reading it costs the test a few tens of ms on any machine (the 78 MB file it once used
 * cost 4 s of a 5 s budget on one busy core, BAJAOVRLAY-52).
 */
const lineCountOfTheStreamedRecording = 40;

/**
 * The session clock written on the first line of a recording file. Every line of the
 * large recording holds the same moment of the race (largeRecording.testSupport.ts), so
 * this is the clock of every line; only the line's own moment tells them apart.
 */
function readTheRecordedSessionClockOfTheFirstLine(filePath: string): ClockReading {
  const [firstLine] = readRecordedLines(filePath) as Array<{
    shapes: { session: { clock: ClockReading } };
  }>;
  if (firstLine === undefined) {
    throw new Error('the recording must have a first line');
  }
  return firstLine.shapes.session.clock;
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

  it('reads every line of a recording the stream hands over in many chunks, and answers its last one', async () => {
    // Arrange: 80 s of the simulator's 60-car enduro on disk (40 lines, about 1.5 MB), and a
    // replay of it turned on at 15:00.
    const recordingsFolder = createTemporaryRecordingsFolder();
    const filePath = writeTheLargeRecordingInto(recordingsFolder, lineCountOfTheStreamedRecording);
    const replayAdapter = createReplayAdapter({ recordingsFolder });
    const config = {
      ...buildFridayReplayConfig(1),
      recordingId: `simulador-enduro/${fileNameOfTheLargeRecording}`,
    };
    const lastLineAtMs = startOfTheLargeRecordingMs + (lineCountOfTheStreamedRecording - 1) * 2_000;
    const recordedClock = readTheRecordedSessionClockOfTheFirstLine(filePath);

    // Act: the replay prepared, as the poller does when it is turned on, which starts
    // reading the file, and a poll an hour later, past the recording's end, which waits
    // for that read.
    replayAdapter.prepareForPolling?.(config);
    const answer = await replayAdapter.pollOnce(
      config,
      buildPollContextAt(replayTurnedOnAtMs + 60 * 60 * 1_000),
    );

    // Assert: the 60 cars answered, and the clock stopped where it stood at the last
    // line's moment, which only a read that reached the end of the file can know.
    expect(answer.shapes.positions, 'the poll must answer its 60 cars').toHaveProperty(
      'entries.length',
      60,
    );
    expect(
      answer.shapes,
      "a replay past its end must hold the clock of the recording's last line",
    ).toHaveProperty(
      'session.clock.referenceTimeMs',
      computeClockTimeMsAtWallClock(recordedClock, lastLineAtMs),
    );
  });
});
