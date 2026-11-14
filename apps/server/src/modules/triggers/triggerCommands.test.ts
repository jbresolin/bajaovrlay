/**
 * Creating, changing and deleting triggers, and the macros they name (apps/server)
 *
 * What this module is for:
 *   The operator edits triggers on "Gatilhos" with createTrigger, updateTrigger and
 *   deleteTrigger, and pauses them all with setTriggersPaused (BAJAOVRLAY-48). A trigger
 *   names a macro, so that macro cannot be deleted while a trigger names it: the refusal
 *   lists the triggers, as a layer's delete lists what uses the layer.
 *
 * What these tests prove:
 *   - A trigger is created with the defaults and saved, so a restart keeps it; the pause is
 *     saved too (BAJAOVRLAY-73, gate 2), so a restart while paused comes back paused, but a
 *     firing that waited before the restart is not offered after it (BAJAOVRLAY-48).
 *   - A trigger naming a macro that does not exist is refused, created or changed.
 *   - updateTrigger changes only what it names; deleteTrigger removes the trigger.
 *   - Deleting a macro two triggers name is refused, naming both; once they are gone it works.
 *   - An operator may not send fireTrigger: only the trigger service may.
 *
 * What these tests deliberately do not cover:
 *   - Firing; triggerFiring.test.ts. The page that edits; apps/control's tests.
 */
import { describe, expect, it } from 'vitest';

import {
  applyAsTheOperatorOrThrow,
  createTrigger,
  interviewInTheBoxMacroId,
  operatorActor,
  readFirings,
  reportObsShowing,
  startTriggersOnTheStore,
  trackReplayMacroId,
} from './triggersOnTheStore.testSupport.js';

/** "Entrou no box" as the page sends it: only the name, the kind and the macro. */
const boxEnteredTrigger = {
  name: 'Entrou no box',
  when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
  macroId: interviewInTheBoxMacroId,
};

describe('createTrigger', () => {
  it('creates the trigger on, asking, with 10 s between firings', () => {
    // Arrange: a race-day store.
    const { store } = startTriggersOnTheStore();

    // Act: the operator saves a trigger with only a name, a kind and a macro.
    createTrigger(store, boxEnteredTrigger);

    // Assert: the trigger as stored, with the brief's defaults.
    expect(store.readAllSlices().triggers, 'the new trigger must be stored as sent').toEqual([
      {
        id: 'gatilho-1',
        name: 'Entrou no box',
        isEnabled: true,
        when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
        macroId: interviewInTheBoxMacroId,
        mode: 'ask',
        minimumIntervalMs: 10_000,
      },
    ]);
  });

  it('refuses a trigger naming a macro that does not exist', () => {
    // Arrange: a race-day store.
    const { store } = startTriggersOnTheStore();

    // Act: a trigger names a deleted macro.
    const outcome = store.applyCommand(
      { type: 'createTrigger', ...boxEnteredTrigger, macroId: 'macro-apagada' },
      operatorActor,
    );

    // Assert: refused with the macro's id.
    expect(outcome, 'a trigger must name a macro that exists').toEqual({
      ok: false,
      error: { code: 'MACRO_NOT_FOUND', message: 'A macro "macro-apagada" não existe.' },
    });
  });
});

describe('updateTrigger and deleteTrigger', () => {
  it('changes only what the command names', () => {
    // Arrange: the Box trigger.
    const { store } = startTriggersOnTheStore();
    const triggerId = createTrigger(store, boxEnteredTrigger);

    // Act: the operator switches it to auto and gives it 30 s between firings.
    applyAsTheOperatorOrThrow(store, {
      type: 'updateTrigger',
      triggerId,
      mode: 'auto',
      minimumIntervalMs: 30_000,
    });

    // Assert: those two changed, the rest kept.
    const trigger = store.readAllSlices().triggers[0];
    expect(
      { name: trigger?.name, mode: trigger?.mode, minimumIntervalMs: trigger?.minimumIntervalMs },
      'only the mode and the interval may change',
    ).toEqual({ name: 'Entrou no box', mode: 'auto', minimumIntervalMs: 30_000 });
  });

  it('refuses a change to a macro that does not exist, and to a trigger that does not', () => {
    // Arrange: the Box trigger.
    const { store } = startTriggersOnTheStore();
    const triggerId = createTrigger(store, boxEnteredTrigger);

    // Act: one change names a missing macro, another a missing trigger.
    const toAMissingMacro = store.applyCommand(
      { type: 'updateTrigger', triggerId, macroId: 'macro-apagada' },
      operatorActor,
    );
    const ofAMissingTrigger = store.applyCommand(
      { type: 'updateTrigger', triggerId: 'gatilho-apagado', isEnabled: false },
      operatorActor,
    );

    // Assert: both refused, each with its code.
    expect(
      [toAMissingMacro, ofAMissingTrigger].map((outcome) => !outcome.ok && outcome.error.code),
      'each must be refused for what it names',
    ).toEqual(['MACRO_NOT_FOUND', 'TRIGGER_NOT_FOUND']);
  });

  it('deletes a trigger', () => {
    // Arrange: the Box trigger.
    const { store } = startTriggersOnTheStore();
    const triggerId = createTrigger(store, boxEnteredTrigger);

    // Act: the operator deletes it.
    applyAsTheOperatorOrThrow(store, { type: 'deleteTrigger', triggerId });

    // Assert: gone.
    expect(store.readAllSlices().triggers, 'the trigger must be gone').toEqual([]);
  });
});

describe('deleting a macro a trigger names', () => {
  it('is refused, naming every trigger that names it, and works once they are gone', () => {
    // Arrange: two triggers run "Entrevista no box".
    const { store } = startTriggersOnTheStore();
    const boxTriggerId = createTrigger(store, boxEnteredTrigger);
    const deskTriggerId = createTrigger(store, {
      name: 'Botão da mesa',
      when: { kind: 'http' },
      macroId: interviewInTheBoxMacroId,
    });

    // Act: the operator tries to delete the macro, then deletes the triggers and tries again.
    const whileNamed = store.applyCommand(
      { type: 'deleteMacro', macroId: interviewInTheBoxMacroId },
      operatorActor,
    );
    applyAsTheOperatorOrThrow(store, { type: 'deleteTrigger', triggerId: boxTriggerId });
    applyAsTheOperatorOrThrow(store, { type: 'deleteTrigger', triggerId: deskTriggerId });
    const onceFree = store.applyCommand(
      { type: 'deleteMacro', macroId: interviewInTheBoxMacroId },
      operatorActor,
    );

    // Assert: refused with both names, then deleted.
    expect(whileNamed, 'a macro a trigger names must not be deleted').toEqual({
      ok: false,
      error: {
        code: 'MACRO_USED_BY_TRIGGER',
        message:
          'A macro "Entrevista no box" não pode ser excluída. Usada por 2 gatilhos: "Entrou no box", "Botão da mesa". Mude ou exclua os gatilhos antes.',
      },
    });
    expect(onceFree, 'with no trigger naming it, the macro may go').toEqual({ ok: true });
  });

  it('leaves a macro no trigger names free to delete', () => {
    // Arrange: a trigger naming the interview, none naming the replay.
    const { store } = startTriggersOnTheStore();
    createTrigger(store, boxEnteredTrigger);

    // Act: the operator deletes the replay macro.
    const outcome = store.applyCommand(
      { type: 'deleteMacro', macroId: trackReplayMacroId },
      operatorActor,
    );

    // Assert: deleted.
    expect(outcome, 'a macro no trigger names is deleted as before').toEqual({ ok: true });
  });
});

describe('who may fire a trigger', () => {
  it('refuses fireTrigger from an operator page', () => {
    // Arrange: an HTTP trigger.
    const { store } = startTriggersOnTheStore();
    const triggerId = createTrigger(store, { ...boxEnteredTrigger, when: { kind: 'http' } });

    // Act: a page sends the firing itself.
    const outcome = store.applyCommand(
      { type: 'fireTrigger', triggerId, triggerName: 'Entrou no box', data: {}, causedBy: 'eu' },
      operatorActor,
    );

    // Assert: not allowed: a firing comes only from what the trigger service saw.
    expect(!outcome.ok && outcome.error.code, 'only sistema:gatilhos may fire').toBe('NOT_ALLOWED');
  });
});

describe('across a restart', () => {
  it('keeps the triggers and the pause, and forgets the firing that waited', () => {
    // Arrange: a trigger that asks, one of its firings waiting for the operator, then the
    // operator presses "Pausar gatilhos" (a podium: nothing may go on air by itself).
    const { store, passTime, restartTheServer } = startTriggersOnTheStore();
    createTrigger(store, boxEnteredTrigger);
    reportObsShowing(store, 'Pista');
    reportObsShowing(store, 'Box');
    passTime(100);
    const firingStatusesBeforeTheRestart = readFirings(store).map((firing) => firing.status);
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: true });

    // Act: the server restarts on the same file.
    const storeAfterTheRestart = restartTheServer();

    // Assert: one firing waited before; after the restart the trigger and the pause are
    // back (BAJAOVRLAY-73, gate 2), and the firing that waited is not offered again.
    const slicesAfter = storeAfterTheRestart.readAllSlices();
    expect(firingStatusesBeforeTheRestart, 'a firing must wait before the restart').toEqual([
      'pending',
    ]);
    expect(
      slicesAfter.triggers.map((trigger) => trigger.name),
      'the triggers are saved, so the restart must bring "Entrou no box" back',
    ).toEqual(['Entrou no box']);
    expect(
      slicesAfter.triggerActivity.isPaused,
      'a server restarted while paused must come back paused',
    ).toBe(true);
    expect(
      readFirings(storeAfterTheRestart),
      'a firing that waited before the restart must not be offered after it',
    ).toEqual([]);
  });

  it('comes back unpaused when the pause was off at the restart', () => {
    // Arrange: a trigger, paused and then resumed by the operator.
    const { store, restartTheServer } = startTriggersOnTheStore();
    createTrigger(store, boxEnteredTrigger);
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: true });
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: false });

    // Act: the server restarts on the same file.
    const storeAfterTheRestart = restartTheServer();

    // Assert: the last word was "Retomar", so the triggers run after the restart.
    expect(
      storeAfterTheRestart.readAllSlices().triggerActivity.isPaused,
      'the restart must keep the pause off, as the operator left it',
    ).toBe(false);
  });
});
