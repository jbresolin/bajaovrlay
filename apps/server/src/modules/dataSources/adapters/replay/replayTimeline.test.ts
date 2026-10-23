/**
 * The replay's timeline: which recorded line a replay answers now (apps/server)
 *
 * What this module is for:
 *   A replay plays a recording back as if it were live (rehearsal mode, concept §7 rule
 *   8). At every poll it works out the recorded moment that corresponds to now: the
 *   recording's first moment, plus the start offset, plus the wall time since the replay
 *   was turned on times the speed. It answers the latest line recorded at or before that
 *   moment; past the end it starts again (looping) or keeps the last line. The line's
 *   shapes are then moved onto today's timeline: `updatedAtMs` becomes now, and the
 *   session clock is shifted so that, at now, it shows what it showed at the replayed
 *   moment.
 *
 * What these tests prove (a fake "now" passed in; Friday's training, a line every two
 * seconds for one minute):
 *   - The right line at 1× and at 10×, on a line's own moment and between two lines.
 *   - startOffsetMs starts that far into the recording.
 *   - Past the end, a looping replay starts again and a plain one keeps the last line.
 *   - A looping lap includes the last line's share (the gap before it), so the last line is
 *     shown every lap, and a two-line recording shows each line half of the time.
 *   - A recording of one line is always that line.
 *   - The rewrite sets every shape's `updatedAtMs` to now, and the session clock shows at
 *     now exactly what it showed at the replayed moment; the recorded line is untouched.
 *   - Once a plain replay has ended, it says so, and its clock stops at the last recorded
 *     value instead of counting on between polls; a countdown that would have gone below
 *     zero by then stops at 0:00, so the session still passes its shape's check.
 *
 * What these tests deliberately do not cover:
 *   - Reading the file; replayAdapter.test.ts covers it.
 *   - The clock between two polls: it runs at 1× from the moment of each poll (a
 *     ClockReading has no speed), so at 10× it jumps forward at every poll.
 */
import {
  computeClockTimeMsAtWallClock,
  type ReplayConfig,
  validateDataShape,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildFridayLineAt,
  buildFridayRecordingLines,
  buildFridaySessionAt,
  enduroDurationMs,
  fridayAt1300Ms,
  fridayAt1301Ms,
} from './fridayTraining.testSupport.js';
import {
  chooseRecordedLineToReplay,
  rewriteShapesOntoTheCurrentTimeline,
} from './replayTimeline.js';

/** 15:00:00 UTC on 14 August 2027, the enduro day: the moment the replay was turned on. */
const replayTurnedOnAtMs = Date.parse('2027-08-14T15:00:00.000Z');

/** A replay of Friday's training turned on at 15:00, with this row's settings. */
function buildReplayConfig(settings: Partial<ReplayConfig>): ReplayConfig {
  return {
    recordingId: 'simulador-enduro/2027-08-13T13-00-00.000Z.jsonl',
    speed: 1,
    isLooping: false,
    replayStartedAtMs: replayTurnedOnAtMs,
    ...settings,
  };
}

describe('chooseRecordedLineToReplay', () => {
  const timelineScenarios = [
    // The moment the replay is turned on answers the first line.
    {
      name: 'answers the first line at the moment the replay is turned on',
      settings: {},
      wallTimeSinceTurnedOnMs: 0,
      expectedTargetAtMs: fridayAt1300Ms,
      expectedLineAtMs: fridayAt1300Ms,
    },
    // Between two lines, the earlier one: nothing is answered before it was recorded.
    {
      name: 'answers the latest line at or before the moment at 1×',
      settings: {},
      wallTimeSinceTurnedOnMs: 7_000,
      expectedTargetAtMs: fridayAt1300Ms + 7_000,
      expectedLineAtMs: fridayAt1300Ms + 6_000,
    },
    // "At or before" includes a line recorded exactly at the moment.
    {
      name: 'answers a line recorded exactly at the moment',
      settings: {},
      wallTimeSinceTurnedOnMs: 4_000,
      expectedTargetAtMs: fridayAt1300Ms + 4_000,
      expectedLineAtMs: fridayAt1300Ms + 4_000,
    },
    // At 10×, 3.5 s of wall time is 35 s of recording.
    {
      name: 'answers ten times further in at 10×',
      settings: { speed: 10 as const },
      wallTimeSinceTurnedOnMs: 3_500,
      expectedTargetAtMs: fridayAt1300Ms + 35_000,
      expectedLineAtMs: fridayAt1300Ms + 34_000,
    },
    // The operator skips the first 30 s of the recording.
    {
      name: 'starts startOffsetMs into the recording',
      settings: { startOffsetMs: 30_000 },
      wallTimeSinceTurnedOnMs: 5_000,
      expectedTargetAtMs: fridayAt1300Ms + 35_000,
      expectedLineAtMs: fridayAt1300Ms + 34_000,
    },
    // Past the end of a plain replay: the last line stays (the race "ended").
    {
      name: 'keeps the last line past the end when not looping',
      settings: {},
      wallTimeSinceTurnedOnMs: 65_000,
      expectedTargetAtMs: fridayAt1301Ms,
      expectedLineAtMs: fridayAt1301Ms,
    },
    // A looping lap is the recording's 60 s plus the 2 s the last line is shown for, so
    // the last line gets its turn: 61 s in is still on it.
    {
      name: 'shows the last line for its own share of each lap when looping',
      settings: { isLooping: true },
      wallTimeSinceTurnedOnMs: 61_000,
      expectedTargetAtMs: fridayAt1301Ms + 1_000,
      expectedLineAtMs: fridayAt1301Ms,
    },
    // Past the end of a looping replay: 65 s into a 62 s lap is 3 s into it again.
    {
      name: 'starts again from the top past the end when looping',
      settings: { isLooping: true },
      wallTimeSinceTurnedOnMs: 65_000,
      expectedTargetAtMs: fridayAt1300Ms + 3_000,
      expectedLineAtMs: fridayAt1300Ms + 2_000,
    },
    // Looping at 10×: 13 s of wall time is 130 s, two 62 s laps plus 6 s.
    {
      name: 'loops as many times as needed at 10×',
      settings: { isLooping: true, speed: 10 as const },
      wallTimeSinceTurnedOnMs: 13_000,
      expectedTargetAtMs: fridayAt1300Ms + 6_000,
      expectedLineAtMs: fridayAt1300Ms + 6_000,
    },
  ];

  it.each(timelineScenarios)(
    '$name',
    ({ settings, wallTimeSinceTurnedOnMs, expectedTargetAtMs, expectedLineAtMs }) => {
      // Arrange: Friday's recording, and a replay with this row's settings.
      const lines = buildFridayRecordingLines();
      const config = buildReplayConfig(settings);

      // Act: choose the line at this row's wall time after the replay was turned on.
      const chosen = chooseRecordedLineToReplay(
        lines,
        config,
        replayTurnedOnAtMs + wallTimeSinceTurnedOnMs,
      );

      // Assert: the replayed moment and the line answered.
      expect(chosen.targetAtMs, 'the replayed moment must follow the row').toBe(expectedTargetAtMs);
      expect(chosen.line.atMs, 'the latest line at or before that moment must be answered').toBe(
        expectedLineAtMs,
      );
    },
  );

  it('answers the only line of a recording of one line, even when looping', () => {
    // Arrange: a recording stopped right after its first poll; a looping replay of it.
    const lines = [buildFridayLineAt(fridayAt1300Ms)];
    const config = buildReplayConfig({ isLooping: true });

    // Act: choose the line a minute after the replay was turned on.
    const chosen = chooseRecordedLineToReplay(lines, config, replayTurnedOnAtMs + 60_000);

    // Assert: the one line, at its own moment (a recording that lasts no time cannot loop).
    expect(chosen.line.atMs, 'the only line must be answered').toBe(fridayAt1300Ms);
    expect(chosen.targetAtMs, 'the replayed moment stays on that line').toBe(fridayAt1300Ms);
  });

  it('answers both lines of a looping two-line recording, each for half of every lap', () => {
    // Arrange: a recording of two lines two seconds apart (13:00:00 and 13:00:02), looped,
    // so each lap lasts four seconds: two on the first line, two on the second.
    const lines = [buildFridayLineAt(fridayAt1300Ms), buildFridayLineAt(fridayAt1300Ms + 2_000)];
    const config = buildReplayConfig({ isLooping: true });

    // Act: choose the line at each second of the second and third laps.
    const answeredLineMoments = [4_000, 5_000, 6_000, 7_000, 8_000, 9_000, 10_000, 11_000].map(
      (wallTimeSinceTurnedOnMs) =>
        chooseRecordedLineToReplay(lines, config, replayTurnedOnAtMs + wallTimeSinceTurnedOnMs).line
          .atMs,
    );

    // Assert: the first line in the first half of each lap, the second line in the second.
    expect(
      answeredLineMoments,
      'the last line must be shown for its share of every lap, not skipped',
    ).toEqual([
      fridayAt1300Ms,
      fridayAt1300Ms,
      fridayAt1300Ms + 2_000,
      fridayAt1300Ms + 2_000,
      fridayAt1300Ms,
      fridayAt1300Ms,
      fridayAt1300Ms + 2_000,
      fridayAt1300Ms + 2_000,
    ]);
  });
});

describe('rewriteShapesOntoTheCurrentTimeline', () => {
  it('sets updatedAtMs of every shape to now', () => {
    // Arrange: the line recorded at 13:00:06 with all five shapes, replayed for 13:00:07.
    const recordedLine = buildFridayLineAt(fridayAt1300Ms + 6_000);
    const shapes = {
      ...recordedLine.shapes,
      standings: { scope: 'enduro' as const, updatedAtMs: fridayAt1300Ms, entries: [] },
      brackets: { sessionId: 'treino-2027-sexta', updatedAtMs: fridayAt1300Ms, rounds: [] },
      incidents: { sessionId: 'treino-2027-sexta', updatedAtMs: fridayAt1300Ms, entries: [] },
    };
    const nowMs = replayTurnedOnAtMs + 7_000;

    // Act: rewrite them onto today's timeline.
    const rewritten = rewriteShapesOntoTheCurrentTimeline(shapes, {
      targetAtMs: fridayAt1300Ms + 7_000,
      nowMs,
      isHeldAtTheEnd: false,
    });

    // Assert: each shape is dated now, so no graphic shows Friday's data as old.
    expect(
      [
        rewritten.session?.updatedAtMs,
        rewritten.positions?.updatedAtMs,
        rewritten.standings?.updatedAtMs,
        rewritten.brackets?.updatedAtMs,
        rewritten.incidents?.updatedAtMs,
      ],
      'every shape must be dated at the moment of the poll',
    ).toEqual([nowMs, nowMs, nowMs, nowMs, nowMs]);
    expect(rewritten.positions?.entries, 'the race data itself must be the recorded data').toEqual(
      recordedLine.shapes.positions?.entries,
    );
  });

  it('shifts the session clock so it shows at now what it showed at the replayed moment', () => {
    // Arrange: the line recorded at 13:00:06 (the clock read 3:59:54 left then), replayed
    // for 13:00:07, at 15:00:07 on the enduro day.
    const recordedLine = buildFridayLineAt(fridayAt1300Ms + 6_000);
    const targetAtMs = fridayAt1300Ms + 7_000;
    const nowMs = replayTurnedOnAtMs + 7_000;

    // Act: rewrite the shapes onto today's timeline.
    const rewritten = rewriteShapesOntoTheCurrentTimeline(recordedLine.shapes, {
      targetAtMs,
      nowMs,
      isHeldAtTheEnd: false,
    });

    // Assert: the clock bound to the replay shows 3:59:53 left at 15:00:07, as it did at
    // 13:00:07 on Friday; the recorded line is untouched.
    const recordedClock = recordedLine.shapes.session?.clock;
    const rewrittenClock = rewritten.session?.clock;
    if (recordedClock === undefined || rewrittenClock === undefined) {
      throw new Error('the replayed line must carry a session clock');
    }
    expect(
      computeClockTimeMsAtWallClock(rewrittenClock, nowMs),
      'the clock must show now what it showed at the replayed moment',
    ).toBe(computeClockTimeMsAtWallClock(recordedClock, targetAtMs));
    expect(computeClockTimeMsAtWallClock(rewrittenClock, nowMs), 'that is 3:59:53 left').toBe(
      14_393_000,
    );
    expect(
      rewrittenClock.referenceWallClockMs,
      'the reference moves by now minus the replayed moment',
    ).toBe(fridayAt1300Ms + 6_000 + (nowMs - targetAtMs));
    expect(recordedClock.referenceWallClockMs, 'the recorded line must not be changed').toBe(
      fridayAt1300Ms + 6_000,
    );
  });

  it('stops the session clock at its last recorded value once a plain replay has ended', () => {
    // Arrange: Friday's minute of training, replayed plainly (no loop), polled at 15:01:05,
    // five seconds after the recording ran out. Its last line, 13:01:00, read 3:59:00 left.
    const lines = buildFridayRecordingLines();
    const config = buildReplayConfig({});
    const nowMs = replayTurnedOnAtMs + 65_000;

    // Act: choose the line, then rewrite it onto today's timeline.
    const replayed = chooseRecordedLineToReplay(lines, config, nowMs);
    const rewritten = rewriteShapesOntoTheCurrentTimeline(replayed.line.shapes, {
      targetAtMs: replayed.targetAtMs,
      nowMs,
      isHeldAtTheEnd: replayed.isHeldAtTheEnd,
    });

    // Assert: the replay is held, and its clock is stopped at 3:59:00 left, now and two
    // seconds later (no count on between polls, no jump back at the next one).
    const rewrittenClock = rewritten.session?.clock;
    if (rewrittenClock === undefined) {
      throw new Error('the replayed line must carry a session clock');
    }
    expect(replayed.isHeldAtTheEnd, 'past the end of a plain replay it is held').toBe(true);
    expect(rewrittenClock.running, 'the clock of an ended replay must be stopped').toBe(false);
    expect(
      [
        computeClockTimeMsAtWallClock(rewrittenClock, nowMs),
        computeClockTimeMsAtWallClock(rewrittenClock, nowMs + 2_000),
      ],
      'the clock must stay at 3:59:00 left, the last recorded value',
    ).toEqual([enduroDurationMs - 60_000, enduroDurationMs - 60_000]);
  });

  it('stops a held clock at 0:00, never below, when the recording ends after its countdown would', () => {
    // Arrange: a one-line recording whose only line was written ten minutes after its
    // snapshot was read with five minutes left (a stale source when "Gravar" was pressed),
    // so at the line's moment the running countdown would read five minutes below zero.
    const snapshotReadAtMs = fridayAt1300Ms;
    const lineWrittenAtMs = snapshotReadAtMs + 600_000;
    const staleSession = buildFridaySessionAt(snapshotReadAtMs);
    staleSession.clock = {
      clockMode: 'remaining',
      referenceTimeMs: 300_000,
      referenceWallClockMs: snapshotReadAtMs,
      running: true,
    };
    const lines = [{ atMs: lineWrittenAtMs, shapes: { session: staleSession } }];
    const nowMs = replayTurnedOnAtMs + 5_000;

    // Act: a plain replay of it, polled five seconds after it was turned on (already held).
    const replayed = chooseRecordedLineToReplay(lines, buildReplayConfig({}), nowMs);
    const rewritten = rewriteShapesOntoTheCurrentTimeline(replayed.line.shapes, {
      targetAtMs: replayed.targetAtMs,
      nowMs,
      isHeldAtTheEnd: replayed.isHeldAtTheEnd,
    });

    // Assert: the clock is stopped at 0:00, and the session still passes the shape's
    // check (a negative clock would make every held poll a failed one).
    expect(replayed.isHeldAtTheEnd, 'a one-line plain replay is held at once').toBe(true);
    expect(rewritten.session?.clock.referenceTimeMs, 'the time left must stop at 0:00').toBe(0);
    expect(rewritten.session?.clock.running, 'the held clock must be stopped').toBe(false);
    expect(
      validateDataShape('session', rewritten.session),
      'the held session must still be a valid session shape',
    ).toEqual({ isValid: true, shape: rewritten.session });
  });
});
