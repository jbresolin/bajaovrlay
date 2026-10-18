/**
 * The data-source poller: starting, stopping, late answers and the stale watch (apps/server)
 *
 * What this module is for:
 *   The poller keeps one loop per source that is on. A loop starts when the source is
 *   turned on (or at boot, for a source left on), and stops when it is turned off or
 *   deleted, calling off its poll in flight and dropping that poll's late answer. A
 *   source that gives no good answer for longer than staleAfterMs is marked late
 *   ("atrasada") even while its adapter hangs, because the poller watches the time since
 *   its last good poll on a timer of its own.
 *
 * What these tests prove (fake clock and timers from 14:00, a real store on SQLite,
 * hand-written fake adapters):
 *   - A source on before the poller starts (a restart) is polled at once.
 *   - Turning a source off, or deleting it, signals its poll in flight, drops that
 *     poll's answer and polls no more.
 *   - Off and on again quickly: the old loop's late answer is dropped, the new loop's
 *     is recorded.
 *   - An adapter that never answers and ignores the signal: the source goes stale once
 *     more than staleAfterMs passed with no good poll ("Sem dados novos há 8 s."), and
 *     is marked only once however long it hangs.
 *   - A source back stale from a restart, with no error, gets that reason and a warning.
 *   - Lowering the interval of a healthy source restarts the rhythm at once and never
 *     marks it stale (the old, longer waits are not compared with the new staleAfterMs).
 *   - A good poll after failures logs "recovered".
 *   - stop() (the server closing) calls everything off; an answer after it sends nothing.
 *
 * What these tests deliberately do not cover:
 *   - The rhythm, the timeout and "Atualizar agora"; poller.test.ts.
 *   - Booting the poller with the server; core/boot/startServer.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  countPollResults,
  createSimulatorAdapterAnsweredByHand,
  createSimulatorAdapterAnsweringAtOnce,
  createSimulatorAdapterThatNeverAnswers,
  enduroSimulatorId,
  operatorActor,
  readTheSimulator,
  setTheSimulatorPollInterval,
  startOfTheEnduroMs,
  startPollerWatchingTheStore,
  turnTheSimulatorOff,
  turnTheSimulatorOn,
} from './poller.testSupport.js';

describe('starting a loop', () => {
  it('polls at once a source that was on before the poller started, as after a restart', async () => {
    // Arrange: the simulator on before the poller starts watching the store.
    const fakeSimulator = createSimulatorAdapterAnsweringAtOnce();
    startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
      isSimulatorOnBeforeThePollerStarts: true,
    });

    // Act: the first timer fires.
    await vi.advanceTimersByTimeAsync(0);

    // Assert: one poll, at 14:00.
    expect(
      fakeSimulator.readPollMomentsMs(),
      'a source left on must be polled again at boot, without waiting',
    ).toEqual([startOfTheEnduroMs]);
  });
});

describe('stopping a loop', () => {
  const stopScenarios = [
    // The operator's switch: the source stays listed, off.
    {
      name: 'turning the source off',
      stopTheSource: turnTheSimulatorOff,
    },
    // "Excluir": the source is gone from the list.
    {
      name: 'deleting the source',
      stopTheSource: deleteTheSimulator,
    },
  ];

  it.each(stopScenarios)(
    '$name calls off the poll in flight, drops its answer and polls no more',
    async ({ stopTheSource }) => {
      // Arrange: an adapter the test answers by hand, the simulator on, a poll waiting.
      const handAnsweredSimulator = createSimulatorAdapterAnsweredByHand();
      const { stateStore, readCommandsSentByThePoller } = startPollerWatchingTheStore({
        adapters: { simulator: handAnsweredSimulator.adapter },
      });
      turnTheSimulatorOn(stateStore);
      await vi.advanceTimersByTimeAsync(0);

      // Act: the source is stopped, then the waiting poll answers, then ten seconds pass.
      stopTheSource(stateStore);
      handAnsweredSimulator.answerTheOldestPendingPoll();
      await vi.advanceTimersByTimeAsync(10_000);

      // Assert: the poll was signalled, its answer never sent, and no poll followed.
      expect(
        handAnsweredSimulator.readSignals()[0]?.aborted,
        'the poll in flight must be called off',
      ).toBe(true);
      expect(
        countPollResults(readCommandsSentByThePoller()),
        'the late answer of a stopped source must be dropped',
      ).toBe(0);
      expect(
        handAnsweredSimulator.countPollsStarted(),
        'a stopped source must not be polled again',
      ).toBe(1);
    },
  );

  it("drops the old loop's late answer when a source is turned off and on again", async () => {
    // Arrange: the simulator on with a poll waiting, then off and on again: a second
    // loop starts and its own poll waits too.
    const handAnsweredSimulator = createSimulatorAdapterAnsweredByHand();
    const { stateStore, readCommandsSentByThePoller } = startPollerWatchingTheStore({
      adapters: { simulator: handAnsweredSimulator.adapter },
    });
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);
    turnTheSimulatorOff(stateStore);
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Act: the old poll answers first, then the new one.
    handAnsweredSimulator.answerTheOldestPendingPoll();
    await vi.advanceTimersByTimeAsync(0);
    const pollResultsAfterTheOldAnswer = countPollResults(readCommandsSentByThePoller());
    handAnsweredSimulator.answerTheOldestPendingPoll();
    await vi.advanceTimersByTimeAsync(0);

    // Assert: two polls started; only the new loop's answer reached the store.
    expect(handAnsweredSimulator.countPollsStarted(), 'each loop starts its own poll').toBe(2);
    expect(pollResultsAfterTheOldAnswer, "the old loop's answer must be dropped").toBe(0);
    expect(
      countPollResults(readCommandsSentByThePoller()),
      "the new loop's answer must be recorded",
    ).toBe(1);
    expect(
      stateStore.readAllSlices().dataSnapshots.map((snapshot) => snapshot.sourceId),
      'the simulator must have its snapshot',
    ).toEqual([enduroSimulatorId]);
  });

  it('calls everything off when the poller stops, and sends nothing afterwards', async () => {
    // Arrange: the simulator on, a poll waiting.
    const handAnsweredSimulator = createSimulatorAdapterAnsweredByHand();
    const { stateStore, poller, readCommandsSentByThePoller } = startPollerWatchingTheStore({
      adapters: { simulator: handAnsweredSimulator.adapter },
    });
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Act: the server closes (stop), then the poll answers and ten seconds pass.
    poller.stop();
    handAnsweredSimulator.answerTheOldestPendingPoll();
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: the poll was signalled; nothing was sent to the closing store.
    expect(
      handAnsweredSimulator.readSignals()[0]?.aborted,
      'stop() must call off the poll in flight',
    ).toBe(true);
    expect(
      readCommandsSentByThePoller(),
      'nothing may reach a store whose database is closing',
    ).toEqual([]);
    expect(handAnsweredSimulator.countPollsStarted(), 'no poll may start after stop()').toBe(1);
  });
});

describe('the stale watch', () => {
  it('marks a source stale once staleAfterMs passed with no good poll, while its adapter hangs', async () => {
    // Arrange: an adapter that never answers and ignores the signal; the simulator,
    // polled every 2 s, stale after 6 s, turned on at 14:00; 7.999 s go by.
    const hungSimulator = createSimulatorAdapterThatNeverAnswers();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: hungSimulator.adapter },
    });
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(7_999);
    const isStaleBeforeTheWatchTicks = readTheSimulator(stateStore).status.isStale;

    // Act: the watch ticks at 8 s (6 s was not yet "more than" 6 s).
    await vi.advanceTimersByTimeAsync(1);

    // Assert: stale at 8 s with the pt-BR reason, dated at the tick; the hung poll was
    // signalled at its timeout.
    const simulatorStatus = readTheSimulator(stateStore).status;
    expect(isStaleBeforeTheWatchTicks, 'six seconds without data is not yet late').toBe(false);
    expect(simulatorStatus.isStale, 'eight seconds without data is late').toBe(true);
    expect(simulatorStatus.lastError, 'the operator must read why').toBe('Sem dados novos há 8 s.');
    expect(simulatorStatus.lastAttemptAtMs, 'the stale mark is dated at the tick').toBe(
      startOfTheEnduroMs + 8_000,
    );
    expect(hungSimulator.readSignals()[0]?.aborted, 'the hung poll must be signalled').toBe(true);
  });

  it('marks a stale source only once while its adapter keeps hanging', async () => {
    // Arrange: the same hung adapter; the simulator on at 14:00 and already marked
    // stale by the watch at 8 s.
    const hungSimulator = createSimulatorAdapterThatNeverAnswers();
    const { stateStore, readCommandsSentByThePoller } = startPollerWatchingTheStore({
      adapters: { simulator: hungSimulator.adapter },
    });
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(8_000);

    // Act: ten more seconds go by, five more ticks of the watch.
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: still the one stale mark, and still the one hung poll.
    expect(
      countPollResults(readCommandsSentByThePoller()),
      'a source already stale with a reason is not marked again at every tick',
    ).toBe(1);
    expect(
      hungSimulator.readSignals().length,
      'a poll in flight, even hung, is never overlapped',
    ).toBe(1);
  });

  it('gives a reason to a source that came back stale from a restart, while its adapter hangs', async () => {
    // Arrange: the simulator left on across a restart, so it comes back stale with no
    // error; the hung adapter; a logger that keeps its lines.
    const hungSimulator = createSimulatorAdapterThatNeverAnswers();
    const { logger, readRecordedLines } = createRecordingLogger();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: hungSimulator.adapter },
      logger,
      isSimulatorLeftOnAcrossARestart: true,
    });
    const statusRightAfterTheRestart = readTheSimulator(stateStore).status;

    // Act: eight seconds go by (polled every 2 s, stale after 6 s).
    await vi.advanceTimersByTimeAsync(8_000);

    // Assert: the restart left it stale with no reason; at 8 s it has one, with a warning.
    const warnings = readRecordedLines().filter((line) => line.level === 'warn');
    expect(statusRightAfterTheRestart.isStale, 'a restart brings the source back stale').toBe(true);
    expect(statusRightAfterTheRestart.lastError, 'with no reason yet').toBeNull();
    expect(
      readTheSimulator(stateStore).status.lastError,
      'the operator must read why the source is still late',
    ).toBe('Sem dados novos há 8 s.');
    expect(
      warnings.map((line) => [line.message, line.error]),
      'the failure must leave one warning',
    ).toEqual([['data source poll failed', 'Sem dados novos há 8 s.']]);
  });

  it('does not mark a healthy source stale when its interval is lowered', async () => {
    // Arrange: an adapter that answers at once; the simulator polled every 60 s, on
    // since 14:00 and polled well then; one second goes by.
    const fakeSimulator = createSimulatorAdapterAnsweringAtOnce();
    const { logger, readRecordedLines } = createRecordingLogger();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
      logger,
    });
    setTheSimulatorPollInterval(stateStore, 60_000);
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(1_000);

    // Act: at 14:00:01 the operator sets 500 ms ("Editar"), which makes staleAfterMs
    // 1.5 s, and a minute goes by, past the moment the old 60 s waits were armed for.
    setTheSimulatorPollInterval(stateStore, 500);
    await vi.advanceTimersByTimeAsync(60_000);

    // Assert: the new rhythm started at the edit, and the source never went stale.
    expect(
      toSecondsAfterTwoPm(fakeSimulator.readPollMomentsMs().slice(0, 4)),
      'the edit polls at once, then every half a second',
    ).toEqual([0, 1, 1.5, 2]);
    expect(
      readRecordedLines().filter((line) => line.level === 'warn'),
      'a healthy source must never be marked as failing',
    ).toEqual([]);
    expect(readTheSimulator(stateStore).status.isStale, 'a source polled well is not late').toBe(
      false,
    );
  });

  it('logs "recovered" when a good poll follows failures', async () => {
    // Arrange: an adapter failing with "Falha simulada.", the simulator on and stale.
    const fakeSimulator = createSimulatorAdapterAnsweringAtOnce();
    fakeSimulator.breakIt('Falha simulada.');
    const { logger, readRecordedLines } = createRecordingLogger();
    const { stateStore } = startPollerWatchingTheStore({
      adapters: { simulator: fakeSimulator.adapter },
      logger,
    });
    turnTheSimulatorOn(stateStore);
    await vi.advanceTimersByTimeAsync(0);

    // Act: the fault clears and the next poll (at 2 s) answers well.
    fakeSimulator.repairIt();
    await vi.advanceTimersByTimeAsync(2_000);

    // Assert: stale and recovered, each said once; the source is healthy again.
    const infoLines = readRecordedLines().filter((line) => line.level === 'info');
    expect(
      infoLines.map((line) => [line.message, line.source_id]),
      'going stale and recovering must each leave one info line',
    ).toEqual([
      ['data source went stale', 'simulador-enduro'],
      ['data source recovered', 'simulador-enduro'],
    ]);
    expect(readTheSimulator(stateStore).status.isStale, 'a good poll ends the delay').toBe(false);
  });
});

/** Turns moments into seconds after 14:00, so expectations read like a stopwatch. */
function toSecondsAfterTwoPm(momentsMs: number[]): number[] {
  return momentsMs.map((momentMs) => (momentMs - startOfTheEnduroMs) / 1_000);
}

/** The operator deletes "Simulador — Enduro" ("Excluir"). */
function deleteTheSimulator(stateStore: StateStore): void {
  stateStore.applyCommand({ type: 'deleteDataSource', sourceId: enduroSimulatorId }, operatorActor);
}
