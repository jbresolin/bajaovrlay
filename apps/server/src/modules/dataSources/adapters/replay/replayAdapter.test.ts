/**
 * The replay adapter: a recording played back as a live source (apps/server)
 *
 * What this module is for:
 *   A source of kind `replay` reads a recording file (one JSON line per good poll, as
 *   the recorder writes it) and, at every poll, answers the line of the moment on the
 *   replay's timeline (replayTimeline.ts), with its shapes moved onto today's timeline.
 *   It reads each recording once and keeps the most recently polled ones in memory, up
 *   to a total size: only closed recordings can be replayed, so the file never changes
 *   afterwards, and a long recording parsed is large, so the ones no longer polled are
 *   let go. Loading a recording must never stall the server: it is read as a stream, a
 *   line at a time; the lines were checked when they were written, so loading only
 *   parses them, and only the line a poll answers is checked against the shapes (gate 2
 *   on PR #16).
 *
 * What these tests prove (real files in a temporary folder, a fake clock in the context):
 *   - Polls follow the clock: at 1× and at 10×, each poll answers the line of its moment,
 *     dated now, with the session clock shifted onto today.
 *   - The file is read once: deleting it after the first poll changes nothing.
 *   - Recordings stay in memory up to the size bound; the least recently polled goes
 *     first, and the one just polled always stays, even alone above the bound.
 *   - A missing file, or one with no readable line, fails the poll with a pt-BR reason;
 *     a line that is not a recorded snapshot (cut off, no shapes) is skipped.
 *   - The adapter says it may produce all four shapes, and checks configs with the
 *     shared ReplayConfigSchema.
 *
 * What these tests deliberately do not cover:
 *   - Every case of the timeline (offset, loop, hold); replayTimeline.test.ts covers them.
 *   - A bad line answered, and loading a large recording; replayAdapterLoading.test.ts.
 *   - The poller calling the adapter; recordAndReplay.test.ts runs a recording through
 *     a real store and back.
 */
import { copyFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ReplayConfigSchema } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createTemporaryRecordingsFolder } from '../../recorder.testSupport.js';
import { buildRecordingLineText } from '../../recordingLine.js';
import {
  buildFridayLineAt,
  buildFridayPositionsAt,
  buildFridayRecordingLines,
  enduroDurationMs,
  fridayAt1300Ms,
} from './fridayTraining.testSupport.js';
import { createReplayAdapter } from './replayAdapter.js';
import {
  buildFridayReplayConfig,
  buildPollContextAt,
  fridayRecordingId,
  replayTurnedOnAtMs,
  writeFridayRecordingIntoAFolder,
  writeRecordingLineTextsIntoAFolder,
} from './replayAdapter.testSupport.js';

describe('the replay adapter, polled as the clock moves', () => {
  const speedScenarios = [
    // Real time: two seconds after 15:00 is two seconds into Friday.
    {
      name: 'answers the line of each moment at 1×',
      speed: 1 as const,
      expectedLineMomentsMs: [fridayAt1300Ms, fridayAt1300Ms + 2_000, fridayAt1300Ms + 4_000],
    },
    // Ten times faster: two seconds after 15:00 is twenty seconds into Friday.
    {
      name: 'answers the line of each moment at 10×',
      speed: 10 as const,
      expectedLineMomentsMs: [fridayAt1300Ms, fridayAt1300Ms + 20_000, fridayAt1300Ms + 40_000],
    },
  ];

  it.each(speedScenarios)('$name', async ({ speed, expectedLineMomentsMs }) => {
    // Arrange: Friday's recording on disk and a replay adapter reading that folder.
    const replayAdapter = createReplayAdapter({
      recordingsFolder: writeFridayRecordingIntoAFolder(),
    });
    const config = buildFridayReplayConfig(speed);
    const pollMomentsMs = [
      replayTurnedOnAtMs,
      replayTurnedOnAtMs + 2_000,
      replayTurnedOnAtMs + 4_000,
    ];

    // Act: poll at 15:00:00, 15:00:02 and 15:00:04.
    const answers = [];
    for (const pollMomentMs of pollMomentsMs) {
      answers.push(await replayAdapter.pollOnce(config, buildPollContextAt(pollMomentMs)));
    }

    // Assert: each poll answers the positions of the expected line, dated at the poll.
    expect(
      answers.map((answer) => answer.shapes.positions),
      'each poll must answer the recorded positions of its moment, dated now',
    ).toEqual(
      expectedLineMomentsMs.map((lineMomentMs, index) => ({
        ...buildFridayPositionsAt(lineMomentMs),
        updatedAtMs: pollMomentsMs[index],
      })),
    );
  });

  it('shifts the session clock onto today', async () => {
    // Arrange: Friday's recording and a replay at 1× turned on at 15:00.
    const replayAdapter = createReplayAdapter({
      recordingsFolder: writeFridayRecordingIntoAFolder(),
    });

    // Act: poll at 15:00:07, which replays 13:00:07 (the line of 13:00:06).
    const answer = await replayAdapter.pollOnce(
      buildFridayReplayConfig(1),
      buildPollContextAt(replayTurnedOnAtMs + 7_000),
    );

    // Assert: the session of 13:00:06, dated now. Its clock reads 3:59:54 left at
    // 15:00:06, as it did at 13:00:06, so at 15:00:07 it shows what 13:00:07 showed.
    expect(answer.shapes.session, 'the session must be dated now, its clock shifted').toEqual({
      ...buildFridayLineAt(fridayAt1300Ms + 6_000).shapes.session,
      clock: {
        clockMode: 'remaining',
        referenceTimeMs: enduroDurationMs - 6_000,
        referenceWallClockMs: replayTurnedOnAtMs + 6_000,
        running: true,
      },
      updatedAtMs: replayTurnedOnAtMs + 7_000,
    });
  });
});

describe('the replay adapter, reading recordings', () => {
  it('reads a recording once and keeps it', async () => {
    // Arrange: Friday's recording, polled once; then its file is deleted.
    const recordingsFolder = writeFridayRecordingIntoAFolder();
    const replayAdapter = createReplayAdapter({ recordingsFolder });
    const config = buildFridayReplayConfig(1);
    await replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
    rmSync(join(recordingsFolder, fridayRecordingId));

    // Act: poll again two seconds later.
    const answer = await replayAdapter.pollOnce(
      config,
      buildPollContextAt(replayTurnedOnAtMs + 2_000),
    );

    // Assert: the answer came from memory.
    expect(answer.shapes.positions, 'a closed recording never changes, so it is read once').toEqual(
      {
        ...buildFridayPositionsAt(fridayAt1300Ms + 2_000),
        updatedAtMs: replayTurnedOnAtMs + 2_000,
      },
    );
  });

  it('keeps recordings in memory up to the size bound, dropping the least recently polled', async () => {
    // Arrange: Friday's 13:00 recording and two more sessions of that afternoon (15:00
    // and 17:00, copies of the same lines), with room in memory for two of them; each is
    // replayed once, oldest first; then all three files are deleted.
    const recordingsFolder = writeFridayRecordingIntoAFolder();
    const fridayAt1500RecordingId = 'simulador-enduro/2027-08-13T15-00-00.000Z.jsonl';
    const fridayAt1700RecordingId = 'simulador-enduro/2027-08-13T17-00-00.000Z.jsonl';
    for (const recordingId of [fridayAt1500RecordingId, fridayAt1700RecordingId]) {
      copyFileSync(join(recordingsFolder, fridayRecordingId), join(recordingsFolder, recordingId));
    }
    const sizeOfOneRecordingInBytes = statSync(join(recordingsFolder, fridayRecordingId)).size;
    const replayAdapter = createReplayAdapter({
      recordingsFolder,
      largestTotalBytesKeptInMemory: 2 * sizeOfOneRecordingInBytes,
    });
    const recordingIdsInPollOrder = [
      fridayRecordingId,
      fridayAt1500RecordingId,
      fridayAt1700RecordingId,
    ];
    for (const recordingId of recordingIdsInPollOrder) {
      const config = { ...buildFridayReplayConfig(1), recordingId };
      await replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
      rmSync(join(recordingsFolder, recordingId));
    }

    // Act: poll the 17:00 and 15:00 replays again, then the 13:00 one.
    const pollAgain = (recordingId: string) =>
      replayAdapter.pollOnce(
        { ...buildFridayReplayConfig(1), recordingId },
        buildPollContextAt(replayTurnedOnAtMs + 2_000),
      );
    const answerOfThe1700Replay = await pollAgain(fridayAt1700RecordingId);
    const answerOfThe1500Replay = await pollAgain(fridayAt1500RecordingId);
    const pollingThe1300Replay = pollAgain(fridayRecordingId);

    // Assert: the two latest answer from memory; the oldest was dropped, so its file is
    // read again, and it is gone.
    expect(
      [answerOfThe1700Replay.shapes.positions, answerOfThe1500Replay.shapes.positions],
      'the two most recently polled recordings fit within the bound and answer from memory',
    ).toEqual([
      {
        ...buildFridayPositionsAt(fridayAt1300Ms + 2_000),
        updatedAtMs: replayTurnedOnAtMs + 2_000,
      },
      {
        ...buildFridayPositionsAt(fridayAt1300Ms + 2_000),
        updatedAtMs: replayTurnedOnAtMs + 2_000,
      },
    ]);
    await expect(
      pollingThe1300Replay,
      'the least recently polled recording must have been dropped from memory',
    ).rejects.toThrow(
      'O arquivo da gravação "simulador-enduro/2027-08-13T13-00-00.000Z.jsonl" não foi encontrado.',
    );
  });

  it('keeps the recording just polled even when it alone is larger than the bound', async () => {
    // Arrange: Friday's recording, a bound of one byte (far smaller than the file), and a
    // first poll; then the file is deleted.
    const recordingsFolder = writeFridayRecordingIntoAFolder();
    const replayAdapter = createReplayAdapter({
      recordingsFolder,
      largestTotalBytesKeptInMemory: 1,
    });
    const config = buildFridayReplayConfig(1);
    await replayAdapter.pollOnce(config, buildPollContextAt(replayTurnedOnAtMs));
    rmSync(join(recordingsFolder, fridayRecordingId));

    // Act: poll again two seconds later.
    const answer = await replayAdapter.pollOnce(
      config,
      buildPollContextAt(replayTurnedOnAtMs + 2_000),
    );

    // Assert: it answered from memory, so a recording above the bound still plays.
    expect(answer.shapes.positions, 'the recording in use must never be let go').toEqual({
      ...buildFridayPositionsAt(fridayAt1300Ms + 2_000),
      updatedAtMs: replayTurnedOnAtMs + 2_000,
    });
  });

  it('fails with a pt-BR reason when the recording file is missing', async () => {
    // Arrange: an empty recordings folder (the file was deleted by hand).
    const replayAdapter = createReplayAdapter({
      recordingsFolder: createTemporaryRecordingsFolder(),
    });

    // Act: poll the replay.
    const polling = replayAdapter.pollOnce(
      buildFridayReplayConfig(1),
      buildPollContextAt(replayTurnedOnAtMs),
    );

    // Assert: the poll fails with a sentence the operator can act on.
    await expect(polling, 'the operator must read which recording is missing').rejects.toThrow(
      'O arquivo da gravação "simulador-enduro/2027-08-13T13-00-00.000Z.jsonl" não foi encontrado.',
    );
  });

  it('fails with a pt-BR reason when the recording has no readable line', async () => {
    // Arrange: a recording whose only line was cut off.
    const replayAdapter = createReplayAdapter({
      recordingsFolder: writeRecordingLineTextsIntoAFolder(['{"atMs":180546']),
    });

    // Act: poll the replay.
    const polling = replayAdapter.pollOnce(
      buildFridayReplayConfig(1),
      buildPollContextAt(replayTurnedOnAtMs),
    );

    // Assert: the poll fails, saying the recording holds nothing to replay.
    await expect(polling, 'the operator must read that the recording is empty').rejects.toThrow(
      'A gravação "simulador-enduro/2027-08-13T13-00-00.000Z.jsonl" não tem nenhum dado para reproduzir.',
    );
  });

  it('skips a line that is not a recorded snapshot', async () => {
    // Arrange: Friday's first two lines with a cut-off line and a line with no shapes
    // between them.
    const [firstLine, secondLine] = buildFridayRecordingLines();
    if (firstLine === undefined || secondLine === undefined) {
      throw new Error("Friday's recording must have two lines");
    }
    const replayAdapter = createReplayAdapter({
      recordingsFolder: writeRecordingLineTextsIntoAFolder([
        buildRecordingLineText({
          atMs: firstLine.atMs,
          snapshotNumber: 1,
          shapes: firstLine.shapes,
        }),
        '{"atMs":1805\n',
        '{"atMs":1786626001000,"snapshotNumber":3}\n',
        buildRecordingLineText({
          atMs: secondLine.atMs,
          snapshotNumber: 4,
          shapes: secondLine.shapes,
        }),
      ]),
    });

    // Act: poll two seconds in.
    const answer = await replayAdapter.pollOnce(
      buildFridayReplayConfig(1),
      buildPollContextAt(replayTurnedOnAtMs + 2_000),
    );

    // Assert: the second good line answers.
    expect(answer.shapes.positions, 'the good lines must still replay').toEqual({
      ...secondLine.shapes.positions,
      updatedAtMs: replayTurnedOnAtMs + 2_000,
    });
  });
});

describe('the replay adapter, described', () => {
  it('may produce all four shapes and checks configs with the shared schema', () => {
    // Arrange: a replay adapter.
    const replayAdapter = createReplayAdapter({
      recordingsFolder: createTemporaryRecordingsFolder(),
    });

    // Act: ask which shapes a replay of Friday produces.
    const producedShapes = replayAdapter.listProducedShapes(buildFridayReplayConfig(1));

    // Assert: all four (which ones the recording holds is only known once it is read),
    // and the shared schema, the same one the page's form uses (D4).
    expect(producedShapes, 'a replay may produce any of the four shapes').toEqual([
      'session',
      'positions',
      'standings',
      'brackets',
    ]);
    expect(replayAdapter.kind, 'the adapter must be the replay kind').toBe('replay');
    expect(replayAdapter.configSchema, 'the config schema must be the shared one').toBe(
      ReplayConfigSchema,
    );
  });
});
