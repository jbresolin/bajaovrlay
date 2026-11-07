/**
 * When a trigger fires, and what a firing does (apps/server, modules/triggers)
 *
 * What this module is for:
 *   A trigger runs a macro when something outside the operator's hands happens
 *   (BAJAOVRLAY-48). The trigger service watches the store and sends fireTrigger, signed
 *   `sistema:gatilhos`; its reducer decides whether the trigger may fire now (on, not
 *   paused, its minimum interval passed) and then either starts the macro ("auto") or
 *   puts a firing in the Eventos tab for the operator ("ask"), exactly as the event inbox
 *   does. An auto firing while another macro runs asks instead: never a queue, never a
 *   cancel.
 *
 * What these tests prove, on a real store with the real macro runner, on fake time:
 *   - the brief's examples: "Box" entered runs "Entrevista no box"; leaving "Pista" asks;
 *     a penalty for car 47 asks, and "Rodar" puts it on air with the car filled;
 *   - the minimum interval blocks a second firing, and lets the next one through after it;
 *   - paused fires nothing (and writes no row) until unpaused; an off trigger neither;
 *   - auto while another macro runs becomes ask, with the reason, and "Rodar" runs it later;
 *   - every firing writes one event-log row as `sistema:gatilhos`, naming the trigger and
 *     its data; "Descartar" and "Desfazer" move a firing between waiting and dismissed.
 *
 * What these tests deliberately do not cover:
 *   - The two rules against loops; triggerLoops.test.ts.
 *   - Trigger data in a take's fields; triggerDataInTakes.test.ts.
 *   - Schedule triggers and the HTTP route; scheduleTriggers.test.ts, triggerHttpRoute.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  applyAsTheOperatorOrThrow,
  createTrigger,
  interviewInTheBoxMacroId,
  operatorActor,
  penaltyNoticeMacroId,
  readDataOnAirOnLayer,
  readEventLogFrom,
  readFirings,
  readRunningMacroId,
  reportObsShowing,
  startTriggersOnTheStore,
  trackReplayMacroId,
} from './triggersOnTheStore.testSupport.js';

/** "Entrou no box": the scene Box entered runs "Entrevista no box" by itself. */
const boxEnteredRunsTheInterview = {
  name: 'Entrou no box',
  when: { kind: 'obsScene', change: 'entered', sceneName: 'Box' },
  macroId: interviewInTheBoxMacroId,
  mode: 'auto',
};

/** "Saiu da pista": leaving Pista asks before running "Replay da pista". */
const trackLeftAsksForTheReplay = {
  name: 'Saiu da pista',
  when: { kind: 'obsScene', change: 'left', sceneName: 'Pista' },
  macroId: trackReplayMacroId,
  mode: 'ask',
};

describe('the brief’s examples', () => {
  it('runs "Entrevista no box" when the scene Box is entered', () => {
    // Arrange: the trigger, and OBS showing the track.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, boxEnteredRunsTheInterview);
    reportObsShowing(store, 'Pista');

    // Act: the director cuts to Box in OBS, and the runner gets its turn.
    reportObsShowing(store, 'Box');
    passTime(100);

    // Assert: the lower third is on air, and the firing says it ran with the scene's name.
    expect(
      readDataOnAirOnLayer(store, 'lower-third'),
      'the interview macro must have put the lower third on air',
    ).toEqual({ name: 'Convidado do box', role: 'Entrevista' });
    expect(
      readFirings(store).map((firing) => ({ status: firing.status, data: firing.data })),
      'one firing, already run, carrying the scene entered',
    ).toEqual([{ status: 'ran', data: { cena: 'Box' } }]);
  });

  it('asks before the replay when the scene Pista is left', () => {
    // Arrange: the trigger, and OBS showing the track.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, trackLeftAsksForTheReplay);
    reportObsShowing(store, 'Pista');

    // Act: the director cuts away from the track.
    reportObsShowing(store, 'Pódio');
    passTime(100);

    // Assert: a firing waits for the operator, and no macro runs.
    expect(
      readFirings(store).map((firing) => ({ status: firing.status, data: firing.data })),
      'leaving Pista must wait for the operator, with the scene left',
    ).toEqual([{ status: 'pending', data: { cena: 'Pista' } }]);
    expect(readRunningMacroId(store), 'nothing may run before the operator says yes').toBe(
      undefined,
    );
  });

  it('asks about a penalty for car 47, and "Rodar" puts the notice on air with the car filled', () => {
    // Arrange: a penalty trigger that asks, its macro filling car, team and reason.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, {
      name: 'Penalidade',
      when: { kind: 'dataEvent', eventKind: 'penalty' },
      macroId: penaltyNoticeMacroId,
      mode: 'ask',
    });
    applyAsTheOperatorOrThrow(store, {
      type: 'createManualEvent',
      noticeKind: 'penalty',
      carNumber: 47,
      teamName: 'Baja UFPR',
      reason: 'Queima de largada',
    });
    passTime(100);
    const waitingFiring = readFirings(store)[0];

    // Act: the operator presses "Rodar" on the waiting firing.
    applyAsTheOperatorOrThrow(store, {
      type: 'runTriggerFiring',
      firingId: waitingFiring?.firingId,
    });
    passTime(100);

    // Assert: the firing carried the event, and the notice went on air with it.
    expect(waitingFiring?.data, 'the firing must carry the penalty’s car, team and reason').toEqual(
      {
        tipo: 'Penalidade',
        carro: 47,
        equipe: 'Baja UFPR',
        motivo: 'Queima de largada',
      },
    );
    expect(
      readDataOnAirOnLayer(store, 'notice'),
      'the notice must show car 47 of Baja UFPR, with the reason',
    ).toEqual({
      variant: 'penalty',
      carNumber: 47,
      teamName: 'Baja UFPR',
      reason: 'Queima de largada',
    });
  });
});

describe('when a trigger may fire', () => {
  it('lets the minimum interval block a second firing, and the next one through after it', () => {
    // Arrange: the Pista trigger that asks, with its default 10 s, and OBS on the track.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, trackLeftAsksForTheReplay);
    reportObsShowing(store, 'Pista');

    // Act: the track is left, comes back and is left again 4 s later, then once more after 10 s.
    reportObsShowing(store, 'Box');
    passTime(2_000);
    reportObsShowing(store, 'Pista');
    passTime(2_000);
    reportObsShowing(store, 'Box');
    passTime(2_000);
    const firingsWithinTheInterval = readFirings(store).length;
    reportObsShowing(store, 'Pista');
    passTime(6_000);
    reportObsShowing(store, 'Box');
    passTime(100);

    // Assert: one firing for the first two, a second once 10 s had passed.
    expect(firingsWithinTheInterval, 'a second leave 4 s later must not fire').toBe(1);
    expect(readFirings(store).length, 'a leave 12 s after the first must fire again').toBe(2);
  });

  it('fires nothing while paused, writes no row for it, and fires again once unpaused', () => {
    // Arrange: the Box trigger, OBS on the track, and "Pausar gatilhos" for the rehearsal.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, boxEnteredRunsTheInterview);
    reportObsShowing(store, 'Pista');
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: true });

    // Act: Box is entered while paused, then again after the pause is lifted.
    reportObsShowing(store, 'Box');
    passTime(100);
    const firingsWhilePaused = readFirings(store).length;
    const logWhilePaused = readEventLogFrom(store, 'fireTrigger');
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: false });
    reportObsShowing(store, 'Pista');
    reportObsShowing(store, 'Box');
    passTime(100);

    // Assert: nothing while paused, not even a row; one firing afterwards.
    expect(firingsWhilePaused, 'a paused trigger must not fire').toBe(0);
    expect(logWhilePaused, 'a firing that did not happen leaves no row').toEqual([]);
    expect(readFirings(store).length, 'unpaused, the next entry must fire').toBe(1);
  });

  it('fires nothing while the trigger is off', () => {
    // Arrange: the Box trigger switched off on "Gatilhos".
    const { store, passTime } = startTriggersOnTheStore();
    const triggerId = createTrigger(store, boxEnteredRunsTheInterview);
    applyAsTheOperatorOrThrow(store, { type: 'updateTrigger', triggerId, isEnabled: false });
    reportObsShowing(store, 'Pista');

    // Act: Box is entered.
    reportObsShowing(store, 'Box');
    passTime(100);

    // Assert: no firing.
    expect(readFirings(store), 'a trigger that is off must not fire').toEqual([]);
  });

  it('does not count OBS connecting as a scene entered', () => {
    // Arrange: the Box trigger, before OBS has said anything.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, boxEnteredRunsTheInterview);

    // Act: OBS connects, already showing Box.
    reportObsShowing(store, 'Box');
    passTime(100);

    // Assert: no firing: nobody entered Box, the server just heard where OBS was.
    expect(readFirings(store), 'connecting to OBS is not a scene change').toEqual([]);
  });
});

describe('an auto firing while another macro runs', () => {
  it('asks instead, with the reason, and "Rodar" runs it once the other macro ended', () => {
    // Arrange: the replay macro holds the air for 5 s; the Box trigger runs the interview.
    const { store, passTime } = startTriggersOnTheStore({
      macroSteps: { [trackReplayMacroId]: [{ kind: 'wait', ms: 5_000 }] },
    });
    createTrigger(store, boxEnteredRunsTheInterview);
    reportObsShowing(store, 'Pista');
    applyAsTheOperatorOrThrow(store, { type: 'runMacro', macroId: trackReplayMacroId });

    // Act: Box is entered during the replay; later the operator presses "Rodar".
    reportObsShowing(store, 'Box');
    passTime(100);
    const firingDuringTheReplay = readFirings(store)[0];
    const runningDuringTheReplay = readRunningMacroId(store);
    passTime(5_000);
    applyAsTheOperatorOrThrow(store, {
      type: 'runTriggerFiring',
      firingId: firingDuringTheReplay?.firingId,
    });
    passTime(100);

    // Assert: it waited (no queue, no cancel), said why, and ran when asked.
    expect(runningDuringTheReplay, 'the replay must not be cancelled').toBe(trackReplayMacroId);
    expect(
      { status: firingDuringTheReplay?.status, reason: firingDuringTheReplay?.autoRunRefusal },
      'the auto firing must wait, saying which macro was running',
    ).toEqual({
      status: 'pending',
      reason:
        'A macro "Entrevista no box" não pode começar enquanto a macro "Replay da pista" está rodando.',
    });
    expect(
      readDataOnAirOnLayer(store, 'lower-third'),
      '"Rodar" must run the interview afterwards',
    ).toEqual({ name: 'Convidado do box', role: 'Entrevista' });
  });
});

describe('what a firing leaves behind', () => {
  it('writes one event-log row as sistema:gatilhos, naming the trigger and its data', () => {
    // Arrange: the Pista trigger, OBS on the track.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, trackLeftAsksForTheReplay);
    reportObsShowing(store, 'Pista');

    // Act: the track is left.
    reportObsShowing(store, 'Box');
    passTime(100);

    // Assert: exactly one row, signed by the triggers, with the name and the scene.
    const firingRows = store
      .readAllSlices()
      .eventLog.filter((entry) => entry.command === 'fireTrigger');
    expect(
      firingRows.map((entry) => ({ actor: entry.actor, payload: entry.payload })),
      'one row per firing, naming the trigger and its data',
    ).toEqual([
      {
        actor: 'sistema:gatilhos',
        payload: {
          type: 'fireTrigger',
          triggerId: 'gatilho-1',
          triggerName: 'Saiu da pista',
          data: { cena: 'Pista' },
          causedBy: 'obs',
        },
      },
    ]);
  });

  it('dismisses a waiting firing with "Descartar", and "Desfazer" makes it wait again', () => {
    // Arrange: a waiting firing of the Pista trigger.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, trackLeftAsksForTheReplay);
    reportObsShowing(store, 'Pista');
    reportObsShowing(store, 'Box');
    passTime(100);
    const firingId = readFirings(store)[0]?.firingId;

    // Act: the operator dismisses it, then undoes that.
    applyAsTheOperatorOrThrow(store, { type: 'dismissTriggerFiring', firingId });
    const statusAfterDismissing = readFirings(store)[0]?.status;
    applyAsTheOperatorOrThrow(store, { type: 'restoreTriggerFiring', firingId });

    // Assert: dismissed, then waiting again, and nothing ran meanwhile.
    expect(statusAfterDismissing, '"Descartar" must dismiss the firing').toBe('dismissed');
    expect(readFirings(store)[0]?.status, '"Desfazer" must make it wait again').toBe('pending');
    expect(readRunningMacroId(store), 'neither may run the macro').toBe(undefined);
  });

  it('refuses "Rodar" on a firing that already ran', () => {
    // Arrange: a firing that ran by itself.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, boxEnteredRunsTheInterview);
    reportObsShowing(store, 'Pista');
    reportObsShowing(store, 'Box');
    passTime(100);
    const firingId = readFirings(store)[0]?.firingId;

    // Act: a second operator page still showed it and presses "Rodar".
    const outcome = store.applyCommand({ type: 'runTriggerFiring', firingId }, operatorActor);

    // Assert: refused, saying it no longer waits.
    expect(outcome, 'a firing that ran must not run twice').toEqual({
      ok: false,
      error: {
        code: 'TRIGGER_FIRING_NOT_WAITING',
        message:
          'O disparo de "Entrou no box" não está mais esperando: ele já rodou ou foi descartado.',
      },
    });
  });
});
