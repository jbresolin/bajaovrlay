/**
 * The obsScene macro step (apps/server, modules/obs with the core's macro runner)
 *
 * What this module is for:
 *   A macro can switch OBS's scene as one of its steps, so one button changes the scene
 *   and puts the graphics for it on air ("Pista + torre"). The runner sends the step as
 *   switchObsScene and waits for OBS's answer before the next step: a graphic must never
 *   go on air over the wrong scene.
 *
 * What these tests prove:
 *   - "Pista + torre" switches OBS to "Pista", waits for OBS, then takes the tower item,
 *     in that order in the event log.
 *   - With OBS down the macro stops at the obsScene step, nothing after it runs, and the
 *     button's stop says which step and why, in pt-BR.
 *   - When OBS itself refuses the switch the macro stops there too, with OBS's reason.
 *   - "Parar" while the runner waits for OBS's answer ends the run with nothing after it.
 *
 * What these tests deliberately do not cover:
 *   - Every other step and the runner's own rules (core/store/macroRunner*.test.ts), and
 *     previewMacro skipping this step (core/store/reducers/previewMacro.test.ts).
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { startMacroRunner } from '../../core/store/macroRunner.js';
import {
  operatorActor,
  startStoreConnectedToFakeObs,
  waitForTheObsSlice,
} from './obsOnTheStore.testSupport.js';
import type { TimersMovedByHand } from './timersMovedByHand.testSupport.js';

/**
 * Saves the clock item standing in for the tower (the graphics folder of these tests has
 * the race clock only) and the macro "Pista + torre": the "Pista" scene, then that item.
 * Returns the macro's id, as the store made it.
 */
function saveTheTrackAndTowerMacro(store: StateStore): string {
  store.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'quickFire', panelId: 'atalhos' },
      graphicId: 'race-clock',
      layerId: 'clock',
      label: 'Torre',
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'green' },
        clockMode: { kind: 'literal', value: 'elapsed' },
        referenceTimeMs: { kind: 'literal', value: 3_900_000 },
        referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
        running: { kind: 'literal', value: true },
      },
    },
    operatorActor,
  );
  const towerItem = store.readAllSlices().items.find((item) => item.label === 'Torre');
  store.applyCommand(
    {
      type: 'createMacro',
      label: 'Pista + torre',
      color: 'success',
      steps: [
        { kind: 'obsScene', sceneName: 'Pista' },
        { kind: 'takeItem', itemId: towerItem?.id ?? 'item-sem-id' },
      ],
    },
    operatorActor,
  );
  const macro = store.readAllSlices().macros.find((saved) => saved.label === 'Pista + torre');
  return macro?.id ?? 'macro-sem-id';
}

/** Starts the macro runner on the test's hand-moved timers; it stops when the test ends. */
function startMacroRunnerOnTimersMovedByHand(store: StateStore, timers: TimersMovedByHand): void {
  const runner = startMacroRunner({
    stateStore: store,
    logger: createLogger({ level: 'silent' }),
    startTimer: timers.startTimer,
    cancelTimer: timers.cancelTimer,
  });
  onTestFinished(() => runner.stop());
}

/** Reads the event log as `actor command` lines, from the press of the macro on. */
function readEventLogFromTheRunMacro(store: StateStore): string[] {
  const eventLog = store.readAllSlices().eventLog;
  const positionOfTheRun = eventLog.findIndex((entry) => entry.command === 'runMacro');
  return eventLog.slice(positionOfTheRun).map((entry) => `${entry.actor} ${entry.command}`);
}

/** Resolves once no macro is running any more. */
function waitForTheRunToEnd(store: StateStore): Promise<void> {
  if (store.readAllSlices().macroRuns.length === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const stopWatching = store.subscribeToSliceChanges((_changedSliceNames, slices) => {
      if (slices.macroRuns.length === 0) {
        stopWatching();
        resolve();
      }
    });
  });
}

describe('a macro with an obsScene step', () => {
  it('"Pista + torre" switches to Pista, waits for OBS, then takes the tower', async () => {
    // Arrange: connected, the macro saved, the runner started.
    const { store, timers } = await startStoreConnectedToFakeObs();
    const macroId = saveTheTrackAndTowerMacro(store);
    startMacroRunnerOnTimersMovedByHand(store, timers);
    const macroActor = `sistema:macro:${macroId}`;

    // Act: press it; the runner's first step goes from a 0 ms timer, and its next step
    // from another once OBS has answered.
    store.applyCommand({ type: 'runMacro', macroId }, operatorActor);
    timers.letTimePass(0);
    await waitForTheObsSlice(store, (slice) => slice.sceneSwitch?.status === 'feita');
    await timers.waitForAPendingTimerOf(0);
    timers.letTimePass(0);
    await waitForTheRunToEnd(store);

    // Assert: the scene first, the tower only after OBS said done, and no stop to show.
    expect(readEventLogFromTheRunMacro(store), 'the scene must change before the take').toEqual([
      `${operatorActor} runMacro`,
      `${macroActor} switchObsScene`,
      `${macroActor} advanceMacroRun`,
      `${macroActor} takeItem`,
      `${macroActor} endMacroRun`,
    ]);
    expect(
      store.readAllSlices().instances.map((instance) => instance.layerId),
      'the tower must be on air',
    ).toEqual(['clock']);
    expect(store.readAllSlices().macroStops, 'a run that went to its end leaves no stop').toEqual(
      [],
    );
  });

  it('stops at the obsScene step while OBS is down, and nothing after it runs', async () => {
    // Arrange: connected, the macro saved, the runner started; then OBS quits.
    const { store, timers, fakeObs } = await startStoreConnectedToFakeObs();
    const macroId = saveTheTrackAndTowerMacro(store);
    startMacroRunnerOnTimersMovedByHand(store, timers);
    fakeObs.close();
    await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');

    // Act: press it.
    store.applyCommand({ type: 'runMacro', macroId }, operatorActor);
    timers.letTimePass(0);
    await waitForTheRunToEnd(store);

    // Assert: no tower on air, and the button can say where and why it stopped.
    expect(store.readAllSlices().instances, 'nothing may go on air after the refusal').toEqual(
      [],
    );
    const macroStop = store.readAllSlices().macroStops[0];
    expect(
      { macroId: macroStop?.macroId, stepIndex: macroStop?.stepIndex, reason: macroStop?.reason },
      'the stop must name the first step and OBS’s refusal',
    ).toEqual({
      macroId,
      stepIndex: 0,
      reason: 'O OBS não está conectado. Veja o motivo passando o mouse sobre "OBS" no topo.',
    });
  });

  it('stops when OBS itself refuses the switch, with OBS’s reason', async () => {
    // Arrange: connected, the macro saved, the runner started; "Pista" is deleted in OBS
    // just as the macro is pressed, before the server hears of it.
    const { store, timers, fakeObs } = await startStoreConnectedToFakeObs();
    const macroId = saveTheTrackAndTowerMacro(store);
    startMacroRunnerOnTimersMovedByHand(store, timers);
    fakeObs.removeSceneWithoutAnEvent('Pista');

    // Act: press it, and wait for OBS's refusal to end the run.
    store.applyCommand({ type: 'runMacro', macroId }, operatorActor);
    timers.letTimePass(0);
    await waitForTheObsSlice(store, (slice) => slice.sceneSwitch?.status === 'recusada');
    await timers.waitForAPendingTimerOf(0);
    timers.letTimePass(0);
    await waitForTheRunToEnd(store);

    // Assert: no tower over the wrong scene, and OBS's reason on the button.
    expect(store.readAllSlices().instances, 'nothing may go on air after the refusal').toEqual(
      [],
    );
    expect(store.readAllSlices().macroStops[0]?.reason, 'the stop must carry OBS’s reason').toBe(
      'O OBS recusou a troca para a cena "Pista": a cena não existe mais no OBS.',
    );
  });

  it('"Parar" while waiting for OBS’s answer ends the run with nothing after it', async () => {
    // Arrange: connected, OBS slow to answer, the macro pressed and its switch sent.
    const { store, timers, fakeObs } = await startStoreConnectedToFakeObs();
    const macroId = saveTheTrackAndTowerMacro(store);
    startMacroRunnerOnTimersMovedByHand(store, timers);
    fakeObs.stopAnsweringSceneSwitches();
    store.applyCommand({ type: 'runMacro', macroId }, operatorActor);
    timers.letTimePass(0);
    await fakeObs.waitForRequest('SetCurrentProgramScene');

    // Act: the operator presses "Parar".
    store.applyCommand({ type: 'stopMacro', macroId }, operatorActor);
    timers.letTimePass(0);
    await waitForTheRunToEnd(store);

    // Assert: the run is over, the tower never went on air, and no refusal is shown.
    expect(store.readAllSlices().instances, 'nothing may go on air after "Parar"').toEqual([]);
    expect(store.readAllSlices().macroStops, '"Parar" is not a refusal').toEqual([]);
  });
});
