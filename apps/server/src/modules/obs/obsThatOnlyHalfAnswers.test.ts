/**
 * An OBS that only half answers (apps/server, modules/obs)
 *
 * What this module is for:
 *   The server's one connection to OBS (obsConnection.ts) counts as up only once it has
 *   read OBS's scenes. An OBS frozen by a heavy scene, or still starting, may take the
 *   connection and then never greet the server, or let it in and never answer the scene
 *   read. Each such attempt is given up after 3 s and tried again 5 s later, like any
 *   other failed attempt.
 *
 * What these tests prove:
 *   - An OBS that lets the server in but never answers GetSceneList, cycle after cycle,
 *     gives one log line when it drops and one when it really comes back, never a
 *     "back" and a "dropped" per cycle; and the tally says `erro` until a connection
 *     has read the scenes, never flipping to `conectado` and back.
 *   - The same OBS from the very first attempt at boot: one "cannot connect" line, then
 *     "connected to OBS" only once the scenes are read.
 *   - An OBS that takes the connection and never says Hello: the attempt is given up
 *     after 3 s, the server hangs up, says why, and the next attempt goes through.
 *
 * What these tests deliberately do not cover:
 *   - An OBS that refuses at once (wrong password, closed): obsConnection.test.ts.
 *   - A read that fails after the scenes were read once, which counts as a drop: the
 *     tally was right until then (switchObsScene.test.ts covers a request with no answer).
 *
 * Time: the 5 s between attempts and the 3 s OBS has to answer are timers moved by hand
 * (timersMovedByHand.testSupport.ts); no test waits on the clock.
 */
import type { ObsSlice } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { StateStore } from '../../core/store/createStateStore.js';
import { obsPasswordOfTheStreamPc } from './fakeObsPasswords.testSupport.js';
import { type FakeObs, startFakeObs } from './fakeObsWebSocketServer.testSupport.js';
import {
  raceDayObsSetup,
  readLevelAndMessageOfEachLine,
  startStoreConnectedToFakeObs,
  startStoreWithObsConnectionTo,
  waitForTheObsSlice,
} from './obsOnTheStore.testSupport.js';

const fiveSecondsBetweenAttempts = 5_000;
const threeSecondsForObsToAnswer = 3_000;

/** Keeps the connection state and last error of every change of the obs slice, in order. */
function recordEveryChangeOfTheObsSlice(store: StateStore) {
  const changesSeen: Array<Pick<ObsSlice, 'connectionState' | 'lastError'>> = [];
  store.subscribeToSliceChanges((changedSliceNames, slices) => {
    if (changedSliceNames.includes('obs')) {
      const { connectionState, lastError } = slices.obs;
      changesSeen.push({ connectionState, lastError });
    }
  });
  return changesSeen;
}

/** How many GetSceneList requests the fake OBS has received so far. */
function countSceneReadsReceived(fakeObs: FakeObs): number {
  const requests = fakeObs.readRequestsReceived();
  return requests.filter((request) => request.requestType === 'GetSceneList').length;
}

describe('an OBS that lets the server in but never answers the scene read', () => {
  it('logs the first drop and the real return only, never a line per cycle', async () => {
    // Arrange: connected; then OBS freezes so it lets the server in but never answers
    // GetSceneList, and the connection drops.
    const { store, fakeObs, timers, readLogLines } = await startStoreConnectedToFakeObs();
    fakeObs.stopAnsweringSceneListReads();
    fakeObs.close();
    await waitForTheObsSlice(store, (obs) => obs.connectionState === 'erro');
    fakeObs.reopen();
    const sceneReadsBeforeTheCycles = countSceneReadsReceived(fakeObs);
    const changesDuringTheCycles = recordEveryChangeOfTheObsSlice(store);

    // Act: three cycles of 5 s wait, the server let in, 3 s with no scene list; then OBS
    // answers again and the fourth attempt goes through.
    for (let cycle = 1; cycle <= 3; cycle += 1) {
      await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
      timers.letTimePass(fiveSecondsBetweenAttempts);
      await fakeObs.waitForRequest('GetSceneList', sceneReadsBeforeTheCycles + cycle);
      timers.letTimePass(threeSecondsForObsToAnswer);
      await fakeObs.waitUntilNoClientIsConnected();
    }
    await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
    fakeObs.answerSceneListReadsAgain();
    timers.letTimePass(fiveSecondsBetweenAttempts);
    await waitForTheObsSlice(store, (obs) => obs.connectionState === 'conectado');

    // Assert: connected, dropped, back; the three half-answered cycles left no line, and
    // the tally changed once (its reason) before OBS really came back.
    expect(
      readLevelAndMessageOfEachLine(readLogLines),
      'one line for the drop and one for the real return',
    ).toEqual([
      'info connected to OBS',
      'warn OBS connection dropped; trying again every 5 s',
      'info OBS connection is back',
    ]);
    expect(
      changesDuringTheCycles,
      'the tally stays on erro through the cycles, then says conectado once',
    ).toEqual([
      {
        connectionState: 'erro',
        lastError:
          `O OBS em ${fakeObs.address} aceitou a conexão, mas não respondeu a tempo. ` +
          'Confira se o OBS não está travado; o servidor tenta de novo a cada 5 s.',
      },
      {
        connectionState: 'conectado',
        lastError:
          `O OBS em ${fakeObs.address} aceitou a conexão, mas não respondeu a tempo. ` +
          'Confira se o OBS não está travado; o servidor tenta de novo a cada 5 s.',
      },
    ]);
  });

  it('from boot, stays on erro and logs "connected" only once the scenes are read', async () => {
    // Arrange: OBS frozen before the server starts: it lets the server in, no scene list.
    const fakeObs = await startFakeObs(raceDayObsSetup);
    fakeObs.stopAnsweringSceneListReads();
    const { store, timers, readLogLines } = startStoreWithObsConnectionTo(
      fakeObs.address,
      obsPasswordOfTheStreamPc,
    );
    const changesSeen = recordEveryChangeOfTheObsSlice(store);

    // Act: the first attempt is given up after 3 s; 5 s later the second is too; then
    // OBS answers again and, 5 s later, the third attempt goes through.
    await fakeObs.waitForRequest('GetSceneList', 1);
    timers.letTimePass(threeSecondsForObsToAnswer);
    await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
    timers.letTimePass(fiveSecondsBetweenAttempts);
    await fakeObs.waitForRequest('GetSceneList', 2);
    timers.letTimePass(threeSecondsForObsToAnswer);
    await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
    fakeObs.answerSceneListReadsAgain();
    timers.letTimePass(fiveSecondsBetweenAttempts);
    await waitForTheObsSlice(store, (obs) => obs.connectionState === 'conectado');

    // Assert: never conectado before the read; one line for the spell, one for the return.
    expect(
      changesSeen.map((change) => change.connectionState),
      'erro from the first failed attempt until a connection reads the scenes',
    ).toEqual(['erro', 'conectado']);
    expect(
      readLevelAndMessageOfEachLine(readLogLines),
      'one line while it fails, and "connected" only once the scenes are read',
    ).toEqual(['warn cannot connect to OBS; trying again every 5 s', 'info connected to OBS']);
  });
});

describe('an OBS that takes the connection and never says Hello', () => {
  it('gives the attempt up after 3 s, hangs up, says why, and tries again', async () => {
    // Arrange: OBS frozen while starting: it takes the connection and stays silent.
    const fakeObs = await startFakeObs(raceDayObsSetup);
    fakeObs.stopGreetingNewConnections();
    const { store, timers } = startStoreWithObsConnectionTo(
      fakeObs.address,
      obsPasswordOfTheStreamPc,
    );
    await fakeObs.waitForConnectionsLeftWithoutHello(1);

    // Act: 3 s pass with no greeting.
    await timers.waitForAPendingTimerOf(threeSecondsForObsToAnswer);
    timers.letTimePass(threeSecondsForObsToAnswer);
    const obsAfterGivingUp = await waitForTheObsSlice(
      store,
      (obs) => obs.connectionState === 'erro',
    );
    await fakeObs.waitUntilNoClientIsConnected();

    // Assert: the slice says why, and the server hung up rather than wait for ever.
    expect(obsAfterGivingUp.lastError, 'the hover must say OBS took the call but froze').toBe(
      `O OBS em ${fakeObs.address} aceitou a conexão, mas não respondeu a tempo. ` +
        'Confira se o OBS não está travado; o servidor tenta de novo a cada 5 s.',
    );

    // Act: OBS comes to, and the 5 s before the next attempt pass.
    fakeObs.greetNewConnectionsAgain();
    await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
    timers.letTimePass(fiveSecondsBetweenAttempts);
    const obsAfterTheNextAttempt = await waitForTheObsSlice(
      store,
      (obs) => obs.connectionState === 'conectado',
    );

    // Assert: the next attempt went through on its own.
    expect(obsAfterTheNextAttempt.programSceneName, 'the scenes must be read').toBe('Intervalo');
  });
});
