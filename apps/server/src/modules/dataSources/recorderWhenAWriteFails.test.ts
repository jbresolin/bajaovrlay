/**
 * The recorder when the disk fails it, and when the server stops it (apps/server)
 *
 * What this module is for:
 *   A recording must never cost the live show anything. When a line cannot be written
 *   (disk full, no permission), the recording stops with a reason the operator reads and
 *   the source keeps polling (decision D9). When the server closes, the recorder stops
 *   watching the store and calls off anything it still meant to send.
 *
 * What these tests prove (real store on a temporary SQLite file, a file writer that
 * fails as a full disk does, timers run by hand):
 *   - A write that fails logs an error, stops the recording with a pt-BR reason signed
 *     by the recorder, from a timer, and the source keeps polling, with nothing more
 *     written.
 *   - However many polls fail to be written before that stop runs, one stop is sent.
 *   - stop() ends the watching, and calls off a stop still waiting to be sent.
 *
 * What these tests deliberately do not cover:
 *   - What is written while all goes well; recorder.test.ts covers it.
 *   - The stopRecording reducer's own rules; reducers/stopRecording.test.ts covers them.
 */
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import {
  enduroSimulatorId,
  readTheSimulator,
  startOfTheEnduroMs,
  turnTheSimulatorOn,
} from './enduroSimulatorCommands.testSupport.js';
import {
  fileNameOfTheRecordingStartedAt1400,
  pressRecordOnTheSimulator,
  readRecordedMomentsMs,
  readTheOnlyRecording,
  sendAGoodSimulatorPollAt,
  startRecorderWatchingAStore,
} from './recorder.testSupport.js';

const twoSecondsIn = startOfTheEnduroMs + 2_000;
const fourSecondsIn = startOfTheEnduroMs + 4_000;
const eightSecondsIn = startOfTheEnduroMs + 8_000;

describe('the recorder, when a line cannot be written', () => {
  /** A file writer that fails as a full disk does. Counts how often it was called. */
  function createAFullDisk() {
    let numberOfWriteAttempts = 0;
    return {
      appendLine: () => {
        numberOfWriteAttempts += 1;
        throw new Error('ENOSPC: no space left on device, write');
      },
      countWriteAttempts: () => numberOfWriteAttempts,
    };
  }

  it('logs an error and stops the recording with a pt-BR reason, signed by the recorder', () => {
    // Arrange: a full disk, a logger that keeps its lines, the simulator on and recording.
    const fullDisk = createAFullDisk();
    const { logger, readRecordedLines: readLogLines } = createRecordingLogger();
    const { stateStore, timers, moveClockTo } = startRecorderWatchingAStore({
      appendLine: fullDisk.appendLine,
      logger,
    });
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);

    // Act: a good poll arrives, and the recorder's deferred stop runs at 14:00:03.
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);
    const isRecordingBeforeTheTimerRuns = readTheSimulator(stateStore).isRecording;
    moveClockTo(startOfTheEnduroMs + 3_000);
    timers.runEveryPendingTimer();

    // Assert: an error was logged; the stop waited for its timer, then closed the
    // recording with the reason the operator reads; the event log names the recorder.
    const errorLines = readLogLines().filter((line) => line.level === 'error');
    expect(
      errorLines.map((line) => [line.message, line.source_id, line.error]),
      'the failed write must be logged once as an error, naming the source and the cause',
    ).toEqual([
      ['recording write failed', enduroSimulatorId, 'ENOSPC: no space left on device, write'],
    ]);
    expect(
      isRecordingBeforeTheTimerRuns,
      'the stop must be sent from a timer, never from inside the store listener',
    ).toBe(true);
    expect(readTheSimulator(stateStore).isRecording, 'the recording must have stopped').toBe(false);
    expect(
      readTheSimulator(stateStore).status.recordingError,
      'the operator must read, in pt-BR, why the recording stopped',
    ).toBe(
      'A gravação parou: o servidor não conseguiu escrever o arquivo (disco cheio ou sem permissão).',
    );
    expect(
      readTheOnlyRecording(stateStore).endedAtMs,
      'the recording must be listed as closed when the stop arrived',
    ).toBe(startOfTheEnduroMs + 3_000);
    const lastEventLogEntry = stateStore.readAllSlices().eventLog.at(-1);
    expect(
      [lastEventLogEntry?.command, lastEventLogEntry?.actor],
      'the stop must be in the event log, signed by the recorder',
    ).toEqual(['stopRecording', 'sistema:gravador']);
  });

  it('lets the source keep polling, and tries no further write', () => {
    // Arrange: a full disk, the simulator on and recording; a poll failed to be written
    // and the recorder's stop has run.
    const fullDisk = createAFullDisk();
    const { stateStore, timers } = startRecorderWatchingAStore({ appendLine: fullDisk.appendLine });
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);
    timers.runEveryPendingTimer();

    // Act: the next good poll arrives.
    sendAGoodSimulatorPollAt(stateStore, fourSecondsIn);

    // Assert: the poll was taken (the source is on, healthy, with the new data), and the
    // recorder did not try the disk again.
    const simulator = readTheSimulator(stateStore);
    expect(simulator.isEnabled, 'the source must still be on').toBe(true);
    expect(simulator.status.lastOkAtMs, 'the new poll must have been taken').toBe(fourSecondsIn);
    expect(simulator.status.isStale, 'a failed recording does not make the data late').toBe(false);
    expect(fullDisk.countWriteAttempts(), 'only the one failed write may have been tried').toBe(1);
  });

  it('sends one stop only, however many polls fail to be written before it runs', () => {
    // Arrange: a full disk, the simulator on and recording.
    const fullDisk = createAFullDisk();
    const { stateStore, timers } = startRecorderWatchingAStore({ appendLine: fullDisk.appendLine });
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);

    // Act: two good polls arrive before the deferred stop has run.
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);
    sendAGoodSimulatorPollAt(stateStore, fourSecondsIn);

    // Assert: one write tried, and one stop waiting.
    expect(fullDisk.countWriteAttempts(), 'a recording that failed is not written again').toBe(1);
    expect(timers.countPendingTimers(), 'one stop must be on its way, not two').toBe(1);
  });
});

describe('stopping the recorder', () => {
  it('writes nothing more once it is stopped', () => {
    // Arrange: the simulator on and recording, one good poll written.
    const { stateStore, recorder, recordingsFolder } = startRecorderWatchingAStore();
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);

    // Act: the server closes, stopping the recorder; then a poll still lands.
    recorder.stop();
    sendAGoodSimulatorPollAt(stateStore, eightSecondsIn);

    // Assert: the file still holds only the line written before the stop.
    expect(
      readRecordedMomentsMs(
        join(recordingsFolder, enduroSimulatorId, fileNameOfTheRecordingStartedAt1400),
      ),
      'a stopped recorder must not write',
    ).toEqual([twoSecondsIn]);
  });

  it('calls off a stop still waiting to be sent', () => {
    // Arrange: a disk that refuses the write, the simulator on and recording, and a good
    // poll whose write failed, so the recorder's stop is waiting for its timer.
    const { stateStore, recorder, timers } = startRecorderWatchingAStore({
      appendLine: () => {
        throw new Error('EACCES: permission denied, open');
      },
    });
    turnTheSimulatorOn(stateStore);
    pressRecordOnTheSimulator(stateStore);
    sendAGoodSimulatorPollAt(stateStore, twoSecondsIn);
    const pendingTimersBeforeTheStop = timers.countPendingTimers();

    // Act: the server closes, stopping the recorder.
    recorder.stop();

    // Assert: the stop was waiting, and is no longer.
    expect(pendingTimersBeforeTheStop, 'the failed write must have armed a stop').toBe(1);
    expect(
      timers.countPendingTimers(),
      'no command may reach a store whose database is closing',
    ).toBe(0);
  });
});
