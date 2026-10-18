/**
 * The data-source poller: rhythm, timeout, failures and "Atualizar agora" (apps/server)
 *
 * What this module is for:
 *   The poller reads every source that is on, one loop per source: it asks the source's
 *   adapter for the canonical shapes every pollIntervalMs and hands each result, good or
 *   failed, to the store as recordDataSourcePoll, signed `sistema:fonte:<sourceId>`. It
 *   never writes state itself.
 *
 * What these tests prove (fake clock and timers from 14:00, a real store on SQLite,
 * hand-written fake adapters):
 *   - A source turned on is polled at once, then every pollIntervalMs.
 *   - A slow poll is never overlapped: the next one starts pollIntervalMs after it settles.
 *   - A poll is called off after min(pollIntervalMs, 10 s): its signal fires and the
 *     source records "Tempo esgotado".
 *   - A failed poll is recorded with the adapter's error, a warning is logged per
 *     failure, and an info line when the source goes stale.
 *   - A kind with no adapter fails its polls with a pt-BR error instead of crashing.
 *   - "Atualizar agora" polls at once, and does nothing while a poll is in flight.
 *   - A store that throws on a result is logged, and the loop carries on.
 *
 * What these tests deliberately do not cover:
 *   - Turning off, deleting, the stale watch and stop(); pollerLifecycle.test.ts.
 *   - What the store does with each result; reducers/recordDataSourcePoll.test.ts.
 *   - The real adapters (simulator, replay), which have their own tests.
 */
import { describe, expect, it, vi } from 'vitest';

import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  createSimulatorAdapterAnsweredByHand,
  createSimulatorAdapterAnsweringAfter,
  createSimulatorAdapterAnsweringAtOnce,
  createSimulatorAdapterThatGivesUpWhenSignalled,
  isPollResultCommand,
  pressPollNowOnTheSimulator,
  readTheSimulator,
  setTheSimulatorPollInterval,
  startOfTheEnduroMs,
  startPollerWatchingTheStore,
  turnTheSimulatorOn,
} from './poller.testSupport.js';

/** Turns moments into seconds after 14:00, so expectations read like a stopwatch. */
function toSecondsAfterTwoPm(momentsMs: number[]): number[] {
  return momentsMs.map((momentMs) => (momentMs - startOfTheEnduroMs) / 1_000);
}

describe('the rhythm of the polls', () => {
  it('polls a source as soon as it is turned on, then every pollIntervalMs', async () => {
    // Arrange: a poller with an adapter that answers at once; the simulator polled every 2 s.
    const fakeSimulator = createSimulatorAdapterAnsweringAtOnce();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
    });

    // Act: the operator turns the simulator on at 14:00 and six seconds go by.
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(6_000);

    // Assert: polls at 0, 2, 4 and 6 s; the last one's data is the snapshot.
    expect(
      toSecondsAfterTwoPm(fakeSimulator.readPollMomentsMs()),
      'the first poll comes at once, then one every two seconds',
    ).toEqual([0, 2, 4, 6]);
    expect(
      stateStore.readAllSlices().dataSnapshots[0]?.receivedAtMs,
      'the snapshot must be the one of the poll at 14:00:06',
    ).toBe(startOfTheEnduroMs + 6_000);
    expect(readTheSimulator(stateStore).status.isStale, 'a source polled well is not late').toBe(
      false,
    );
  });

  it('never starts a second poll while a slow one is in flight', async () => {
    // Arrange: an adapter that takes five seconds to answer, polled every two.
    const slowSimulator = createSimulatorAdapterAnsweringAfter(5_000);
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: slowSimulator.adapter },
    });

    // Act: the simulator is turned on and fourteen seconds go by.
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(14_000);

    // Assert: each poll starts two seconds after the one before answered; never two at once.
    expect(
      toSecondsAfterTwoPm(slowSimulator.readPollMomentsMs()),
      'a poll answered at 5 s is followed at 7 s, the one answered at 12 s at 14 s',
    ).toEqual([0, 7, 14]);
    expect(
      slowSimulator.readMostPollsInFlightAtOnce(),
      'one source must never have two polls in flight',
    ).toBe(1);
  });
});

describe('the timeout of a poll', () => {
  const timeoutScenarios = [
    // A short interval: a poll may take at most the interval, or polls would pile up.
    {
      name: 'calls a poll off after the 2 s interval',
      pollIntervalMs: 2_000,
      expectedTimeoutMs: 2_000,
      expectedError: 'Tempo esgotado: a fonte não respondeu em 2 s.',
    },
    // A long interval: the wait is capped at 10 s, so a dead source shows up soon.
    {
      name: 'calls a poll off after 10 s even with a 30 s interval',
      pollIntervalMs: 30_000,
      expectedTimeoutMs: 10_000,
      expectedError: 'Tempo esgotado: a fonte não respondeu em 10 s.',
    },
  ];

  it.each(timeoutScenarios)(
    '$name',
    async ({ pollIntervalMs, expectedTimeoutMs, expectedError }) => {
      // Arrange: an adapter that only gives up when signalled, the simulator on, its
      // first poll started, and time up to one millisecond before the timeout.
      const stuckSimulator = createSimulatorAdapterThatGivesUpWhenSignalled();
      const { stateStore } = startPollerWatchingTheStore({
        adapters: { simulator: stuckSimulator.adapter },
      });
      setTheSimulatorPollInterval(stateStore, pollIntervalMs);
      turnTheSimulatorOn(stateStore);
      await vi.advanceTimersByTimeAsync(expectedTimeoutMs - 1);
      const isSignalledBeforeTheTimeout = stuckSimulator.readSignals()[0]?.aborted;

      // Act: the last millisecond goes by.
      await vi.advanceTimersByTimeAsync(1);

      // Assert: the signal fired at the timeout, and the source records it, stale.
      const simulatorStatus = readTheSimulator(stateStore).status;
      expect(isSignalledBeforeTheTimeout, 'the poll must not be called off early').toBe(false);
      expect(
        toSecondsAfterTwoPm(stuckSimulator.readAbortMomentsMs()),
        'the signal must fire exactly at the timeout',
      ).toEqual([expectedTimeoutMs / 1_000]);
      expect(simulatorStatus.lastError, 'the operator must read why in pt-BR').toBe(expectedError);
      expect(simulatorStatus.lastAttemptAtMs, 'the attempt is dated when it started').toBe(
        startOfTheEnduroMs,
      );
      expect(simulatorStatus.isStale, 'a source that timed out is late').toBe(true);
    },
  );
});

describe('a failed poll', () => {
  it("records the adapter's error, warns once per failure and says when it went stale", async () => {
    // Arrange: an adapter failing with "Falha simulada.", a logger that keeps its lines.
    const fakeSimulator = createSimulatorAdapterAnsweringAtOnce();
    fakeSimulator.breakIt('Falha simulada.');
    const { logger, readRecordedLines } = createRecordingLogger();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
      logger,
    });

    // Act: the simulator is turned on and polled twice (at 0 and 2 s).
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(2_000);

    // Assert: two failures counted, one warning each, one "went stale" line.
    const simulatorStatus = readTheSimulator(stateStore).status;
    const warnings = readRecordedLines().filter((line) => line.level === 'warn');
    const infoLines = readRecordedLines().filter((line) => line.level === 'info');
    expect(simulatorStatus.lastError, "the adapter's error is what the operator reads").toBe(
      'Falha simulada.',
    );
    expect(simulatorStatus.consecutiveFailures, 'both failures must be counted').toBe(2);
    expect(
      warnings.map((line) => [line.message, line.source_id, line.error]),
      'every failure must leave one warning naming the source and the error',
    ).toEqual([
      ['data source poll failed', 'simulador-enduro', 'Falha simulada.'],
      ['data source poll failed', 'simulador-enduro', 'Falha simulada.'],
    ]);
    expect(
      infoLines.map((line) => [line.message, line.source_id]),
      'going stale is said once, not at every failure',
    ).toEqual([['data source went stale', 'simulador-enduro']]);
  });

  it('records a failure in pt-BR when no adapter reads the kind of the source', async () => {
    // Arrange: a poller that knows no adapter at all.
    const { stateStore } = startPollerWatchingTheStore({ adapters: {} });

    // Act: the simulator is turned on and its first poll comes.
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Assert: the source records the reason, and is late.
    const simulatorStatus = readTheSimulator(stateStore).status;
    expect(simulatorStatus.lastError, 'the operator must read that the kind is unknown').toBe(
      'O servidor ainda não sabe ler fontes do tipo "simulator".',
    );
    expect(simulatorStatus.isStale, 'a source nobody can read is late').toBe(true);
  });

  it('logs a store that throws on a result and carries on polling', async () => {
    // Arrange: a store that throws on the first poll result only (a locked database).
    const fakeSimulator = createSimulatorAdapterAnsweringAtOnce();
    const { logger, readRecordedLines } = createRecordingLogger();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
      logger,
      wrapStore: throwOnTheFirstPollResult,
    });

    // Act: the simulator is turned on and polled at 0 and 2 s.
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(2_000);

    // Assert: one error line, and the second poll's data reached the store.
    const errorLines = readRecordedLines().filter((line) => line.level === 'error');
    expect(
      errorLines.map((line) => [line.message, line.source_id]),
      'the throw must be logged, naming the source',
    ).toEqual([['data source poll result could not be recorded', 'simulador-enduro']]);
    expect(
      stateStore.readAllSlices().dataSnapshots[0]?.receivedAtMs,
      'the poll at 14:00:02 must still be recorded',
    ).toBe(startOfTheEnduroMs + 2_000);
  });
});

describe('"Atualizar agora"', () => {
  it('polls at once and keeps the rhythm from there', async () => {
    // Arrange: the simulator polled every 10 s, on since 14:00, three seconds later.
    const fakeSimulator = createSimulatorAdapterAnsweringAtOnce();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
    });
    setTheSimulatorPollInterval(stateStore, 10_000);
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(3_000);

    // Act: the operator presses "Atualizar agora" at 14:00:03, and ten more seconds pass.
    pressPollNowOnTheSimulator(stateStore);
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: polls at 0, at the press (3 s) and ten seconds after it (13 s).
    expect(
      toSecondsAfterTwoPm(fakeSimulator.readPollMomentsMs()),
      'the press polls at once and the next poll follows one interval later',
    ).toEqual([0, 3, 13]);
  });

  it('does nothing while a poll is in flight', async () => {
    // Arrange: an adapter the test answers by hand, the simulator on, its first poll waiting.
    const handAnsweredSimulator = createSimulatorAdapterAnsweredByHand();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: handAnsweredSimulator.adapter },
    });
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Act: the operator presses "Atualizar agora" while that poll is still waiting.
    pressPollNowOnTheSimulator(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Assert: still one poll started.
    expect(
      handAnsweredSimulator.countPollsStarted(),
      'a press during a poll must not start a second one',
    ).toBe(1);
  });
});

/** Hands the poller a store that throws on the first recordDataSourcePoll it is given. */
function throwOnTheFirstPollResult(store: StateStore): StateStore {
  let hasThrown = false;
  return {
    ...store,
    applyCommand: (command, actor) => {
      if (isPollResultCommand(command) && !hasThrown) {
        hasThrown = true;
        throw new Error('SQLITE_BUSY: database is locked');
      }
      return store.applyCommand(command, actor);
    },
  };
}
