/**
 * The store holds Dados to triggers that ask (apps/server)
 *
 * What this module is for:
 *   A trigger in "auto" runs its macro on air by itself, so with the login on
 *   (BAJAOVRLAY-29) only the Produtor may set one to auto or switch an auto one on, and
 *   Dados may not change an auto trigger's macro or what it waits for (gate 2 of PR #51).
 *   The store's authorisation step asks automationAndTheDataRole.ts for every command
 *   Dados sends, against the triggers as the store holds them.
 *
 * What these tests prove, through the whole store on a real SQLite file:
 *   - Dados's auto trigger is refused with the pt-BR sentence, logged as failed under
 *     `dados:Mesa 2`, and no trigger is stored; the Produtor's same trigger is stored.
 *   - Dados's change of the macro of the Produtor's auto trigger is refused, and the
 *     trigger still runs the macro the Produtor chose; Dados's rename of it is stored.
 *
 * What these tests deliberately do not cover:
 *   - Every row of what Dados may change, and the rules and macros;
 *     core/store/authorizeTriggerAutomationByTheDataRole.test.ts, on the pure check.
 */
import { describe, expect, it } from 'vitest';

import {
  interviewInTheBoxMacroId,
  readEventLogFrom,
  startTriggersOnTheStore,
  trackReplayMacroId,
} from './triggersOnTheStore.testSupport.js';

const producerActor = 'produtor:Mesa 1';
const dataRoleActor = 'dados:Mesa 2';

/** "Entrou no box", in auto: runs the interview macro as soon as OBS shows the box. */
const autoBoxEnteredTrigger = {
  name: 'Entrou no box',
  when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
  macroId: interviewInTheBoxMacroId,
  mode: 'auto',
};

/** The createTrigger command of that trigger, as the page sends it. */
const createAutoBoxEnteredTrigger = { type: 'createTrigger', ...autoBoxEnteredTrigger };

describe('an auto trigger sent by each role', () => {
  it('is refused for Dados, logged as failed, and stored for the Produtor', () => {
    // Arrange: a race-day store with no trigger.
    const { store } = startTriggersOnTheStore();

    // Act: Dados sends the auto trigger, then the Produtor sends the same one.
    const dataRoleOutcome = store.applyCommand(createAutoBoxEnteredTrigger, dataRoleActor);
    const triggersAfterDados = store.readAllSlices().triggers;
    const producerOutcome = store.applyCommand(createAutoBoxEnteredTrigger, producerActor);

    // Assert: Dados is told why in pt-BR, nothing was stored for it, and the log names both.
    expect(dataRoleOutcome, 'Dados may not set up a trigger that airs by itself').toEqual({
      ok: false,
      error: {
        code: 'NOT_ALLOWED',
        message: 'O papel Dados não pode pôr um gatilho no automático. Peça ao Produtor.',
      },
    });
    expect(triggersAfterDados, 'a refused trigger is not stored').toEqual([]);
    expect(producerOutcome, 'the Produtor may').toEqual({ ok: true });
    const eventLog = store.readAllSlices().eventLog;
    const resultsOfTheTwoSends = eventLog
      .filter((entry) => entry.command === 'createTrigger')
      .map((entry) => `${entry.actor} ${entry.result.status}`);
    expect(resultsOfTheTwoSends, 'the log shows who tried and how it ended').toEqual([
      'dados:Mesa 2 failed',
      'produtor:Mesa 1 ok',
    ]);
  });
});

describe('Dados editing the Produtor’s auto trigger', () => {
  it('may rename it, and may not change its macro', () => {
    // Arrange: the Produtor's auto "Entrou no box", running the interview macro.
    const { store } = startTriggersOnTheStore();
    store.applyCommand(createAutoBoxEnteredTrigger, producerActor);
    const triggerId = store.readAllSlices().triggers[0]?.id ?? '';

    // Act: Dados points it at the replay macro, then renames it.
    const macroChangeOutcome = store.applyCommand(
      { type: 'updateTrigger', triggerId, macroId: trackReplayMacroId },
      dataRoleActor,
    );
    const renameOutcome = store.applyCommand(
      { type: 'updateTrigger', triggerId, name: 'Box: entrevista' },
      dataRoleActor,
    );

    // Assert: the macro is still the Produtor's; the new name is stored; it is still auto.
    expect(macroChangeOutcome, 'what an auto trigger runs is the Produtor’s').toEqual({
      ok: false,
      error: {
        code: 'NOT_ALLOWED',
        message: 'O papel Dados não pode mexer num gatilho automático. Peça ao Produtor.',
      },
    });
    expect(renameOutcome, 'a rename puts nothing on air').toEqual({ ok: true });
    expect(store.readAllSlices().triggers[0], 'the trigger after both').toMatchObject({
      name: 'Box: entrevista',
      macroId: interviewInTheBoxMacroId,
      mode: 'auto',
    });
    expect(readEventLogFrom(store, 'updateTrigger'), 'both sends are logged as Dados').toEqual([
      'dados:Mesa 2 updateTrigger',
      'dados:Mesa 2 updateTrigger',
    ]);
  });
});
