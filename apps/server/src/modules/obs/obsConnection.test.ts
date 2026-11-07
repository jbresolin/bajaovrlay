/**
 * The server's one connection to OBS (apps/server, modules/obs)
 *
 * What this module is for:
 *   The server talks to OBS 32 on the stream PC through obs-websocket v5, from the server
 *   only. It fills the `obs` slice (connected or not, OBS's scenes, Program, Preview), so
 *   the control page's tally and the macro editor read OBS without ever talking to it.
 *   When OBS closes, the server tries again every 5 s on its own; nothing else on the
 *   server waits for OBS or is blanked by it (rule 4).
 *
 * What these tests prove, one row of the connection table each:
 *   - no address: nothing connects, and the slice says `desligado` with no address;
 *   - wrong password: `erro` with the pt-BR reason, and the password nowhere in the logs;
 *   - connect: `conectado`, the scenes in the order of OBS's Scenes panel, Program named;
 *   - OBS closes: `erro`, the scenes and Program forgotten, every other slice untouched;
 *   - OBS comes back: after the 5 s wait the server reconnects by itself, and the list
 *     and the scenes are read anew, changes made while it was away included.
 *   And around them: one log line when OBS drops and one when it comes back, never one
 *   per attempt; the connection's reports leave no event-log row; and stop() ends the
 *   connection and every attempt.
 *
 * What these tests deliberately do not cover:
 *   - OBS's events once connected (obsEvents.test.ts) and the scene switch
 *     (switchObsScene.test.ts).
 *   - A real OBS: the fake one (fakeObsWebSocketServer.testSupport.ts) is a real
 *     WebSocket server speaking the protocol, and the client is the server's real one.
 *     João checks against OBS 32 at gate 2.
 *   - Reading the two variables, which readServerEnvironmentObs.test.ts covers.
 */
import { describe, expect, it } from 'vitest';

import { buildBootOptions } from '../../core/boot/bootedServer.testSupport.js';
import { startServer } from '../../core/boot/startServer.js';
import { committedMigrationsFolder } from '../../core/db/openDatabase.js';
import { obsPasswordOfTheStreamPc, outdatedObsPassword } from './fakeObsPasswords.testSupport.js';
import { startFakeObs } from './fakeObsWebSocketServer.testSupport.js';
import {
  operatorActor,
  raceDayObsSetup,
  readLevelAndMessageOfEachLine,
  startStoreConnectedToFakeObs,
  startStoreWithObsConnectionTo,
  waitForTheObsSlice,
} from './obsOnTheStore.testSupport.js';

const fiveSecondsBetweenAttempts = 5_000;

describe('the OBS connection table', () => {
  it('no address: connects to nothing, and the slice says desligado with no address', async () => {
    // Arrange: a server booted as production boots it, with BAJAOVRLAY_OBS_URL not set.
    const runningServer = await startServer(buildBootOptions(committedMigrationsFolder));

    // Act: read the obs slice, as the control page's hello carries it.
    const obs = runningServer.stateStore.readAllSlices().obs;
    await runningServer.close();

    // Assert: the module is off; the page can say "OBS não configurado".
    expect(obs.connectionState, 'with no address the connection is off').toBe('desligado');
    expect(obs.address, 'with no address there is nothing to show on hover').toBeNull();
    expect(obs.sceneNames, 'with no OBS there is no scene to offer').toEqual([]);
  });

  it('wrong password: erro with the reason in pt-BR, and no password in the logs', async () => {
    // Arrange: OBS with its password, and a server given another one.
    const fakeObs = await startFakeObs(raceDayObsSetup);
    const passwordGivenToTheServer = outdatedObsPassword;

    // Act: start the connection and wait for OBS's refusal to reach the slice.
    const { store, readLogLines } = startStoreWithObsConnectionTo(
      fakeObs.address,
      passwordGivenToTheServer,
    );
    const obs = await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');

    // Assert: the page shows why, and no log line carries either password.
    expect(obs.lastError, 'the reason must say the password was refused, in pt-BR').toBe(
      'O OBS recusou a senha. Confira BAJAOVRLAY_OBS_PASSWORD e a senha em Ferramentas → ' +
        'Configurações do servidor WebSocket, no OBS.',
    );
    const everyLogLine = JSON.stringify(readLogLines());
    expect(everyLogLine, 'the password sent must never be logged').not.toContain(
      passwordGivenToTheServer,
    );
    expect(everyLogLine, 'OBS’s own password must never be logged').not.toContain(
      obsPasswordOfTheStreamPc,
    );
    expect(fakeObs.countIdentifiedClients(), 'OBS must not have let the server in').toBe(0);
  });

  it('a password OBS asks for but the server was not given: erro naming the variable', async () => {
    // Arrange: OBS with authentication on, and BAJAOVRLAY_OBS_PASSWORD not set.
    const fakeObs = await startFakeObs(raceDayObsSetup);

    // Act: start the connection and wait for OBS's refusal.
    const { store } = startStoreWithObsConnectionTo(fakeObs.address, undefined);
    const obs = await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');

    // Assert: the reason names the missing variable.
    expect(obs.lastError, 'the reason must name the variable left empty').toBe(
      'O OBS pede senha, e BAJAOVRLAY_OBS_PASSWORD não está definida no servidor.',
    );
  });

  it('connect: conectado, with the scenes in the Scenes panel’s order and Program named', async () => {
    // Arrange: OBS on race day, the break scene on Program, Studio Mode off.
    const fakeObs = await startFakeObs(raceDayObsSetup);

    // Act: start the connection with the right password and wait for it.
    const { store } = startStoreWithObsConnectionTo(fakeObs.address, obsPasswordOfTheStreamPc);
    const obs = await waitForTheObsSlice(store, (slice) => slice.connectionState === 'conectado');

    // Assert: the slice is what OBS shows, top of the Scenes panel first.
    expect(obs, 'the slice must hold OBS as it is now, and no switch yet').toEqual({
      connectionState: 'conectado',
      address: fakeObs.address,
      lastError: null,
      sceneNames: ['Pista', 'Box', 'Pódio', 'Intervalo'],
      programSceneName: 'Intervalo',
      isStudioModeOn: false,
      previewSceneName: null,
      sceneSwitch: null,
    });
  });

  it('OBS closes: erro, scenes forgotten, and every other slice left as it was', async () => {
    // Arrange: connected, with a macro saved, so there is something besides OBS to keep.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    store.applyCommand(
      { type: 'createMacro', label: 'Pista + torre', color: 'success', steps: [] },
      operatorActor,
    );
    const slicesBefore = store.readAllSlices();

    // Act: OBS quits, and the drop reaches the slice.
    fakeObs.close();
    const obs = await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');

    // Assert: the tally can no longer claim a scene, and nothing else moved.
    expect(obs.lastError, 'the reason must say the connection dropped').toBe(
      'A conexão com o OBS caiu. O servidor tenta de novo a cada 5 s.',
    );
    expect(obs.sceneNames, 'scenes OBS may no longer have must not be offered').toEqual([]);
    expect(obs.programSceneName, 'no scene may be shown as live without OBS').toBeNull();
    const slicesAfter = store.readAllSlices();
    for (const sliceName of Object.keys(slicesBefore) as Array<keyof typeof slicesBefore>) {
      if (sliceName === 'obs') {
        continue;
      }
      expect(slicesAfter[sliceName], `the ${sliceName} slice must be untouched`).toBe(
        slicesBefore[sliceName],
      );
    }
  });

  it('OBS comes back: reconnects after 5 s and reads the list and the scenes anew', async () => {
    // Arrange: connected, then OBS quits; while it is closed someone renames "Box" to
    // "Box 2", and the next start leaves "Pódio" on Program.
    const { store, fakeObs, timers } = await startStoreConnectedToFakeObs();
    fakeObs.close();
    await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');
    fakeObs.renameSceneByHand('Box', 'Box 2');
    fakeObs.switchProgramSceneByHand('Pódio');
    fakeObs.reopen();

    // Act: the 5 s between attempts pass, and the next attempt goes through.
    await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
    timers.letTimePass(fiveSecondsBetweenAttempts);
    const obs = await waitForTheObsSlice(store, (slice) => slice.connectionState === 'conectado');

    // Assert: what OBS has now, not what it had before it closed; the last error is kept.
    expect(obs.sceneNames, 'the renamed scene must be read anew').toEqual([
      'Pista',
      'Box 2',
      'Pódio',
      'Intervalo',
    ]);
    expect(obs.programSceneName, 'Program must be read anew').toBe('Pódio');
    expect(obs.lastError, 'the hover keeps the last error after OBS comes back').toBe(
      'A conexão com o OBS caiu. O servidor tenta de novo a cada 5 s.',
    );
  });
});

describe('around the connection table', () => {
  it('logs one line when OBS drops and one when it comes back, never one per attempt', async () => {
    // Arrange: connected, then OBS quits.
    const { store, fakeObs, timers, readLogLines } = await startStoreConnectedToFakeObs();
    fakeObs.close();
    await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');

    // Act: three attempts are refused, 5 s apart, then OBS opens and the fourth goes through.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
      timers.letTimePass(fiveSecondsBetweenAttempts);
      await fakeObs.waitForAttemptsRefusedWhileClosed(attempt);
    }
    await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
    fakeObs.reopen();
    timers.letTimePass(fiveSecondsBetweenAttempts);
    await waitForTheObsSlice(store, (slice) => slice.connectionState === 'conectado');

    // Assert: connected, dropped, back; the three refused attempts left no line.
    expect(
      readLevelAndMessageOfEachLine(readLogLines),
      'one line per change of the connection, none per attempt',
    ).toEqual([
      'info connected to OBS',
      'warn OBS connection dropped; trying again every 5 s',
      'info OBS connection is back',
    ]);
  });

  it('says why in the slice while OBS is closed, after the drop', async () => {
    // Arrange: connected, then OBS quits.
    const { store, fakeObs, timers } = await startStoreConnectedToFakeObs();
    fakeObs.close();
    await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');

    // Act: the next attempt finds nothing listening.
    await timers.waitForAPendingTimerOf(fiveSecondsBetweenAttempts);
    timers.letTimePass(fiveSecondsBetweenAttempts);
    const obs = await waitForTheObsSlice(store, (slice) =>
      (slice.lastError ?? '').startsWith('O OBS não respondeu'),
    );

    // Assert: the reason says where the server looked and what to check.
    expect(obs.lastError, 'the reason must name the address and what to check').toBe(
      `O OBS não respondeu em ${fakeObs.address}. Confira se o OBS está aberto e se o ` +
        'servidor WebSocket está ligado (Ferramentas → Configurações do servidor WebSocket).',
    );
  });

  it('leaves no event-log row for its reports', async () => {
    // Arrange: connected, and OBS dropped once.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    fakeObs.close();
    await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');

    // Act: read the event log.
    const eventLogCommands = store.readAllSlices().eventLog.map((entry) => entry.command);

    // Assert: the connection's bookkeeping stays out of the operator's history.
    expect(eventLogCommands, 'recordObsState must never write a row').not.toContain(
      'recordObsState',
    );
  });

  it('stop() closes the connection and leaves no attempt waiting', async () => {
    // Arrange: connected.
    const { fakeObs, obsConnection, timers } = await startStoreConnectedToFakeObs();

    // Act: the server closes, and OBS sees the hang-up.
    await obsConnection.stop();
    await fakeObs.waitUntilNoClientIsConnected();

    // Assert: OBS has no client left and nothing will try again.
    expect(fakeObs.countIdentifiedClients(), 'the server must hang up on OBS').toBe(0);
    expect(timers.countPendingTimers(), 'no attempt may be left waiting').toBe(0);
  });
});
