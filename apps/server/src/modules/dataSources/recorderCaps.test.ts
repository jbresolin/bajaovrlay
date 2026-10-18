/**
 * The recorder's caps: a recording stops itself at 6 h or 300 MB (apps/server)
 *
 * What this module is for:
 *   A recording left running (the operator forgot "Parar gravação" on Saturday night)
 *   must not fill the disk of the machine that runs the show. So a recording stops by
 *   itself after 6 hours or when its file would pass 300 MB, whichever comes first, and
 *   the source shows which cap stopped it (gate 2 on PR #16). The stop is the recorder's
 *   stopRecording, signed `sistema:gravador`, like the stop after a failed write; the
 *   source keeps polling.
 *
 * What these tests prove (real store on a temporary SQLite file, real temporary folder,
 * timers run by hand, the size cap made small so a test can reach it):
 *   - A line that would take the file past the size cap is not written: the recording
 *     stops with the reason naming the cap, the file stays within it, the source stays on.
 *   - When the duration cap's wait ends, the recording stops with the reason naming 6 h.
 *   - A recording closed before its 6 h is up calls its wait off, so it can never stop
 *     the source's next recording.
 *   - A size-cap stop still on its way when the operator stops and starts again is
 *     dropped: it was for the old recording and never closes the new one.
 *
 * What these tests deliberately do not cover:
 *   - The real 300 MB: reaching it would take a test minutes of writing; the cap's
 *     number is a plain constant in recordingCaps.ts.
 *   - The stop after a failed write; recorderWhenAWriteFails.test.ts covers it.
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  enduroSimulatorId,
  readTheSimulator,
  startOfTheEnduroMs,
  turnTheSimulatorOn,
} from './enduroSimulatorCommands.testSupport.js';
import {
  fileNameOfTheRecordingStartedAt1400,
  pressRecordOnTheSimulator,
  pressStopRecordingOnTheSimulator,
  readRecordedLines,
  readTheOnlyRecording,
  sendAGoodSimulatorPollAt,
  startRecorderWatchingAStore,
} from './recorder.testSupport.js';

/** Six hours in milliseconds: the real duration cap, which the timers run by hand reach. */
const sixHoursMs = 6 * 60 * 60 * 1_000;
/**
 * A size cap of 2 000 bytes (0,002 MB): a few lines of the test's session, so the test
 * reaches it in a handful of polls. The real cap is 300 MB.
 */
const smallSizeCapInBytes = 2_000;

describe('the recorder, at its caps', () => {
  it('stops a recording whose next line would pass the size cap, without writing it', () => {
    // Arrange: a size cap of 2 000 bytes; the simulator on and recording.
    const { stateStore, recordingsFolder, timers } = startRecorderWatchingAStore({
      recordingCaps: { longestDurationMs: sixHoursMs, largestFileSizeInBytes: smallSizeCapInBytes },
    });
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);

    // Act: ten good polls, two seconds apart, far more than 2 000 bytes of lines; then
    // the recorder's reports and stop are sent.
    for (let pollNumber = 1; pollNumber <= 10; pollNumber += 1) {
      sendAGoodSimulatorPollAt(stateStore, startOfTheEnduroMs + pollNumber * 2_000);
    }
    timers.runEveryDeferredTimer();

    // Assert: the file stays within the cap, the recording stopped with the size reason,
    // its count is exactly the number of lines in the file, and the source is still on.
    const filePath = join(recordingsFolder, enduroSimulatorId, fileNameOfTheRecordingStartedAt1400);
    expect(statSync(filePath).size, 'the file must never pass the cap').toBeLessThanOrEqual(
      smallSizeCapInBytes,
    );
    const simulator = readTheSimulator(stateStore);
    expect(simulator.isRecording, 'the recording must have stopped itself').toBe(false);
    expect(simulator.status.recordingError, 'the operator must read which cap stopped it').toBe(
      'A gravação parou sozinha: chegou a 0,002 MB, o limite de tamanho de uma gravação.',
    );
    expect(simulator.isEnabled, 'a full recording never turns the source off').toBe(true);
    expect(
      readTheOnlyRecording(stateStore).snapshotCount,
      'the list must count exactly the lines that fit under the cap',
    ).toBe(readRecordedLines(filePath).length);
    const lastEventLogEntry = stateStore.readAllSlices().eventLog.at(-1);
    expect(
      [lastEventLogEntry?.command, lastEventLogEntry?.actor],
      'the stop must be in the event log, signed by the recorder',
    ).toEqual(['stopRecording', 'sistema:gravador']);
  });

  it('stops a recording when its 6 h are up, saying so', () => {
    // Arrange: the simulator on and recording at 14:00, one good poll written.
    const { stateStore, timers, moveClockTo } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    sendAGoodSimulatorPollAt(stateStore, startOfTheEnduroMs + 2_000);
    timers.runEveryDeferredTimer();

    // Act: six hours later the cap's wait ends, at 20:00; its stop is sent.
    moveClockTo(startOfTheEnduroMs + sixHoursMs);
    timers.runEveryTimerOfDelay(sixHoursMs);
    timers.runEveryDeferredTimer();

    // Assert: stopped at 20:00 with the duration reason; the source still on.
    const simulator = readTheSimulator(stateStore);
    expect(simulator.isRecording, 'the recording must have stopped itself').toBe(false);
    expect(simulator.status.recordingError, 'the operator must read which cap stopped it').toBe(
      'A gravação parou sozinha: chegou a 6 h, o limite de duração de uma gravação.',
    );
    expect(
      readTheOnlyRecording(stateStore).endedAtMs,
      'the recording must be closed when its time was up',
    ).toBe(startOfTheEnduroMs + sixHoursMs);
    expect(simulator.isEnabled, 'a recording at its cap never turns the source off').toBe(true);
  });

  it("calls off the 6 h wait of a recording closed before then, so it can't stop the next one", () => {
    // Arrange: the simulator on and recording at 14:00; its 6 h wait is running.
    const { stateStore, timers } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    const waitsWhileRecording = timers.countPendingTimersOfDelay(sixHoursMs);

    // Act: "Parar gravação" before the 6 h are up.
    pressStopRecordingOnTheSimulator(stateStore);

    // Assert: one wait while recording, none once the recording is closed.
    expect(
      [waitsWhileRecording, timers.countPendingTimersOfDelay(sixHoursMs)],
      'the wait must belong to its recording and end with it',
    ).toEqual([1, 0]);
  });

  it('drops a size-cap stop still on its way when the operator has started a new recording', () => {
    // Arrange: a size cap of 2 000 bytes; the simulator on and recording; ten polls reach
    // the cap, so the recorder's stop of that recording waits for its timer.
    const { stateStore, timers } = startRecorderWatchingAStore({
      recordingCaps: { longestDurationMs: sixHoursMs, largestFileSizeInBytes: smallSizeCapInBytes },
    });
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    for (let pollNumber = 1; pollNumber <= 10; pollNumber += 1) {
      sendAGoodSimulatorPollAt(stateStore, startOfTheEnduroMs + pollNumber * 2_000);
    }
    const firstRecordingId = stateStore.readAllSlices().recordings[0]?.id;

    // Act: before that timer runs, the operator presses "Parar gravação" and "Gravar"
    // again; then the waiting stop runs.
    pressStopRecordingOnTheSimulator(stateStore);
    pressRecordOnTheSimulator(stateStore);
    timers.runEveryDeferredTimer();

    // Assert: the new recording is still open and carries no reason; the old one closed.
    const simulator = readTheSimulator(stateStore);
    const recordings = stateStore.readAllSlices().recordings;
    const newRecording = recordings.find((recording) => recording.id !== firstRecordingId);
    expect(simulator.isRecording, 'the new recording must still be running').toBe(true);
    expect(
      simulator.status.recordingError,
      "the old recording's cap must not be shown on the new one",
    ).toBe(null);
    expect(newRecording?.endedAtMs, 'the new recording must stay open').toBe(null);
    expect(recordings, 'the operator made exactly two recordings').toHaveLength(2);
  });
});
