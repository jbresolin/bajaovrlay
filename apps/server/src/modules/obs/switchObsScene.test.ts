/**
 * switchObsScene: one of OBS's scenes on Program, or on Preview (apps/server, modules/obs)
 *
 * What this module is for:
 *   switchObsScene is how an operator, a pad or a macro step changes OBS's scene. It goes
 *   through the store's one command path: the reducer checks it against the `obs` slice
 *   and records the switch as `enviada`, which writes the event-log row naming the scene;
 *   the server's OBS connection, watching the slice, asks OBS and records OBS's answer.
 *
 * What these tests prove:
 *   - A switch of Program is done in OBS, answered `feita`, and logged with its scene.
 *   - A switch of Preview in Studio Mode is done on Preview, leaving Program alone.
 *   - Each refusal, in pt-BR, with its code and a failed event-log row, and nothing sent
 *     to OBS: OBS not configured, OBS not connected, a scene OBS does not have, Preview
 *     with Studio Mode off, and a switch while the one before has no answer yet.
 *   - OBS's own answer when it is not ok: OBS refused, OBS did not answer within 3 s,
 *     the connection dropped first. Each is `recusada` with its reason and a failed
 *     event-log row, and a later switch is accepted again.
 *
 * What these tests deliberately do not cover:
 *   - The command API's routes for it (obsSceneThroughTheCommandApi.test.ts) and the
 *     macro step (obsSceneMacroStep.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import {
  operatorActor,
  raceDayObsSetup,
  startStoreConnectedToFakeObs,
  waitForTheObsSlice,
} from './obsOnTheStore.testSupport.js';

const threeSecondsForOBSToAnswer = 3_000;

describe('switchObsScene accepted', () => {
  it('puts the scene on Program, answers feita, and logs a row naming the scene', async () => {
    // Arrange: connected, with "Intervalo" on Program.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();

    // Act: the operator switches to "Pista" and OBS answers.
    const outcome = store.applyCommand(
      { type: 'switchObsScene', sceneName: 'Pista' },
      operatorActor,
    );
    const obs = await waitForTheObsSlice(store, (slice) => slice.sceneSwitch?.status === 'feita');

    // Assert: accepted, done in OBS, on the tally, and logged with its scene.
    expect(outcome, 'a scene OBS has, while connected, must be accepted').toEqual({ ok: true });
    expect(fakeObs.readRequestsReceived().at(-1), 'OBS must be asked for that scene').toEqual({
      requestType: 'SetCurrentProgramScene',
      requestData: { sceneName: 'Pista' },
    });
    expect(obs.sceneSwitch, 'the switch must be answered done').toEqual({
      number: 1,
      sceneName: 'Pista',
      target: 'program',
      status: 'feita',
      refusalReason: null,
    });
    const obsAfterTheEvent = await waitForTheObsSlice(
      store,
      (slice) => slice.programSceneName === 'Pista',
    );
    expect(obsAfterTheEvent.programSceneName, 'the tally must follow OBS’s event').toBe('Pista');
    const logRow = store.readAllSlices().eventLog.at(-1);
    expect(
      { actor: logRow?.actor, command: logRow?.command, payload: logRow?.payload },
      'one row, signed by the operator, naming the scene',
    ).toEqual({
      actor: operatorActor,
      command: 'switchObsScene',
      payload: { type: 'switchObsScene', sceneName: 'Pista', target: 'program' },
    });
    expect(logRow?.result, 'the row must say ok').toEqual({ status: 'ok' });
  });

  it('lines a scene up on Preview in Studio Mode, leaving Program alone', async () => {
    // Arrange: connected, Studio Mode on, "Intervalo" on Program and on Preview.
    const { store } = await startStoreConnectedToFakeObs({
      ...raceDayObsSetup,
      isStudioModeOn: true,
      previewSceneName: 'Intervalo',
    });

    // Act: the operator lines "Pódio" up on Preview.
    store.applyCommand(
      { type: 'switchObsScene', sceneName: 'Pódio', target: 'preview' },
      operatorActor,
    );
    const obs = await waitForTheObsSlice(store, (slice) => slice.previewSceneName === 'Pódio');

    // Assert: Preview moved, Program did not.
    expect(obs.previewSceneName, 'Preview must show the scene lined up').toBe('Pódio');
    expect(obs.programSceneName, 'Program must stay where it was').toBe('Intervalo');
  });
});

describe('switchObsScene refused', () => {
  it('refuses with OBS not configured, naming the variable', () => {
    // Arrange: a store with no OBS connection at all, as with BAJAOVRLAY_OBS_URL unset.
    const { database } = openTemporaryDatabase();
    const store = createStateStore({
      database,
      logger: createRecordingLogger().logger,
      graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    });

    // Act: a pad presses its "Pista" button.
    const outcome = store.applyCommand(
      { type: 'switchObsScene', sceneName: 'Pista' },
      operatorActor,
    );

    // Assert: refused, saying what to set; the row is logged as failed.
    expect(outcome, 'with no OBS configured the switch must be refused').toEqual({
      ok: false,
      error: {
        code: 'OBS_NOT_CONNECTED',
        message: 'O OBS não está configurado: defina BAJAOVRLAY_OBS_URL no servidor.',
      },
    });
    expect(store.readAllSlices().eventLog.at(-1)?.result.status, 'logged as failed').toBe('failed');
  });

  const refusalScenarios = [
    // OBS closed on the stream PC: the button must say so instead of doing nothing.
    {
      name: 'refuses while OBS is not connected',
      setUp: (fakeObs: { close: () => void }) => fakeObs.close(),
      waitsForTheDrop: true,
      command: { type: 'switchObsScene', sceneName: 'Pista' },
      expectedError: {
        code: 'OBS_NOT_CONNECTED',
        message: 'O OBS não está conectado. Veja o motivo passando o mouse sobre "OBS" no topo.',
      },
    },
    // A macro saved before a scene was renamed in OBS names a scene that is gone.
    {
      name: 'refuses a scene OBS does not have',
      setUp: () => undefined,
      waitsForTheDrop: false,
      command: { type: 'switchObsScene', sceneName: 'Pódio 2025' },
      expectedError: {
        code: 'OBS_SCENE_NOT_FOUND',
        message: 'O OBS não tem a cena "Pódio 2025". Confira o nome no OBS.',
      },
    },
    // Without Studio Mode OBS has no Preview; switching Program instead would go on air.
    {
      name: 'refuses Preview while Studio Mode is off',
      setUp: () => undefined,
      waitsForTheDrop: false,
      command: { type: 'switchObsScene', sceneName: 'Pódio', target: 'preview' },
      expectedError: {
        code: 'OBS_STUDIO_MODE_OFF',
        message:
          'A Prévia do OBS só existe com o Modo Estúdio ligado. Ligue o Modo Estúdio no OBS ' +
          'ou troque a cena do Programa.',
      },
    },
  ];

  it.each(refusalScenarios)('$name', async ({ setUp, waitsForTheDrop, command, expectedError }) => {
    // Arrange: connected, then this row's situation (in the table above).
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    setUp(fakeObs);
    if (waitsForTheDrop) {
      await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');
    }
    const requestsBefore = fakeObs.readRequestsReceived().length;

    // Act: send the row's switch.
    const outcome = store.applyCommand(command, operatorActor);

    // Assert: refused with the row's reason, logged as failed, nothing asked of OBS.
    expect(outcome, 'the switch must be refused with its pt-BR reason').toEqual({
      ok: false,
      error: expectedError,
    });
    const logRow = store.readAllSlices().eventLog.at(-1);
    expect(logRow?.command, 'the refusal must be logged under its command').toBe('switchObsScene');
    expect(logRow?.result, 'the row must carry the refusal').toEqual({
      status: 'failed',
      error: expectedError,
    });
    expect(fakeObs.readRequestsReceived().length, 'OBS must not be asked anything').toBe(
      requestsBefore,
    );
  });

  it('refuses a switch while OBS has not answered the one before', async () => {
    // Arrange: connected, OBS slow to answer, and a switch to "Pista" waiting.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    fakeObs.stopAnsweringSceneSwitches();
    store.applyCommand({ type: 'switchObsScene', sceneName: 'Pista' }, operatorActor);

    // Act: a second press, for "Box", before OBS answered.
    const outcome = store.applyCommand({ type: 'switchObsScene', sceneName: 'Box' }, operatorActor);

    // Assert: refused, so a macro waiting for "Pista" never reads the answer to "Box".
    expect(outcome, 'one switch at a time').toEqual({
      ok: false,
      error: {
        code: 'OBS_SCENE_SWITCH_PENDING',
        message:
          'O OBS ainda não respondeu à troca para a cena "Pista". Tente de novo em instantes.',
      },
    });
  });
});

describe('OBS’s answer when it is not ok', () => {
  it('records OBS’s refusal, logs it as failed, and accepts the next switch', async () => {
    // Arrange: connected; "Box" is deleted in OBS just as the switch is sent, so the slice
    // still lists it but OBS no longer has it.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    fakeObs.removeSceneWithoutAnEvent('Box');

    // Act: switch to "Box", wait for OBS's answer, then switch to "Pista".
    store.applyCommand({ type: 'switchObsScene', sceneName: 'Box' }, operatorActor);
    const obs = await waitForTheObsSlice(
      store,
      (slice) => slice.sceneSwitch?.status === 'recusada',
    );
    const failedRow = store.readAllSlices().eventLog.at(-1);
    const nextOutcome = store.applyCommand(
      { type: 'switchObsScene', sceneName: 'Pista' },
      operatorActor,
    );

    // Assert: the reason in pt-BR on the slice and in the log; the next switch goes.
    const expectedReason =
      'O OBS recusou a troca para a cena "Box": a cena não existe mais no OBS.';
    expect(obs.sceneSwitch?.refusalReason, 'the reason must say why, in pt-BR').toBe(
      expectedReason,
    );
    expect(
      { actor: failedRow?.actor, command: failedRow?.command, result: failedRow?.result },
      'OBS’s refusal must be in the operator’s history',
    ).toEqual({
      actor: 'sistema:obs',
      command: 'recordObsSceneSwitchAnswer',
      result: {
        status: 'failed',
        error: { code: 'OBS_REFUSED_SCENE_SWITCH', message: expectedReason },
      },
    });
    expect(nextOutcome, 'an answered switch no longer holds the next one back').toEqual({
      ok: true,
    });
  });

  it('records no answer within 3 s as refused', async () => {
    // Arrange: connected, OBS slow to answer.
    const { store, fakeObs, timers } = await startStoreConnectedToFakeObs();
    fakeObs.stopAnsweringSceneSwitches();

    // Act: switch to "Pista", and let the 3 s OBS has to answer pass.
    store.applyCommand({ type: 'switchObsScene', sceneName: 'Pista' }, operatorActor);
    await timers.waitForAPendingTimerOf(threeSecondsForOBSToAnswer);
    timers.letTimePass(threeSecondsForOBSToAnswer);
    const obs = await waitForTheObsSlice(
      store,
      (slice) => slice.sceneSwitch?.status === 'recusada',
    );

    // Assert: refused, saying OBS did not answer in time.
    expect(obs.sceneSwitch?.refusalReason, 'the reason must say OBS took too long').toBe(
      'O OBS não respondeu a tempo à troca para a cena "Pista".',
    );
  });

  it('records a drop before the answer as refused', async () => {
    // Arrange: connected, OBS slow to answer, and a switch to "Pista" sent.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    fakeObs.stopAnsweringSceneSwitches();
    store.applyCommand({ type: 'switchObsScene', sceneName: 'Pista' }, operatorActor);
    await fakeObs.waitForRequest('SetCurrentProgramScene');

    // Act: OBS quits before answering.
    fakeObs.close();
    const obs = await waitForTheObsSlice(
      store,
      (slice) => slice.sceneSwitch?.status === 'recusada',
    );

    // Assert: refused at once, without waiting the 3 s, saying the connection dropped.
    expect(obs.sceneSwitch?.refusalReason, 'the reason must say the connection dropped').toBe(
      'A conexão com o OBS caiu antes da resposta à troca para a cena "Pista".',
    );
  });
});
