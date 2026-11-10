/**
 * Undoing "Descartar": restoreEvent, through a real store (apps/server)
 *
 * What this module is for:
 *   Humans err: a penalty dismissed by a slip of the mouse must be able to come back
 *   (asked at the walk of PR #22). restoreEvent ("Desfazer" on the console, "Restaurar" on
 *   the "Eventos" page) takes a dismissed event back to pending, waiting for the operator,
 *   dated at the command's moment and logged. It comes back pending even when its rule is
 *   automatic: a corrected mistake is the operator's to show, never the runner's, so it
 *   cannot go on air by itself seconds after being brought back.
 *
 * What these tests prove:
 *   - A dismissed penalty comes back pending, the change dated and logged, and "No ar"
 *     then shows it.
 *   - A dismissed penalty whose rule is automatic comes back pending, not queued.
 *   - A dismissed penalty whose rule is now "Ignorar" comes back pending all the same: the
 *     operator asked for it by name (gate 2 of the walk changes).
 *   - A dismissed penalty past its rule's maximum wait is refused (EVENT_TOO_OLD), saying
 *     so in pt-BR, and stays dismissed, rather than coming back only to expire at "No ar".
 *     Kinds with no maximum wait (incidents, typed events) can be restored hours later.
 *   - Restoring an event that is waiting is refused with EVENT_NOT_DISMISSED, saying its
 *     status; an unknown one with EVENT_NOT_FOUND.
 *
 * What these tests deliberately do not cover:
 *   - Who may send it (operators only); authorizeEventCommands.test.ts.
 *   - Bringing back a shown or expired event ("Mostrar de novo", BAJAOVRLAY-67);
 *     showEventAgainOnTheStore.test.ts.
 *   - The max age at "No ar" itself; inboxCommandsOnTheStore.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildShapesWithCar31Leading,
  buildStartPenaltyOfCar47,
} from './detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  type EventInboxOnTheStore,
  openEventInboxOnTheStore,
  operatorActor,
  pollTheSimulator,
  readCommandsOfNewestLogRows,
  readEvent,
} from './eventInboxOnTheStore.testSupport.js';

/** The id the inbox gives car 47's start penalty from the simulator. */
const startPenaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';

/**
 * An inbox whose incidents rule (in the mode given) shows events with a race clock item,
 * and car 47's penalty in it, as its rule left it (pending when it asks, queued when auto).
 */
function openInboxWithThePenalty(mode: 'ask' | 'auto'): EventInboxOnTheStore {
  const inbox = openEventInboxOnTheStore();
  const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — aviso');
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId, mode });
  pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
  pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));
  return inbox;
}

describe('restoreEvent, undoing "Descartar"', () => {
  it('brings a dismissed penalty back to pending, and "No ar" then shows it', () => {
    // Arrange: the penalty dismissed by mistake, noticed five seconds later.
    const inbox = openInboxWithThePenalty('ask');
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });
    const dismissedAtMs = readEvent(inbox.stateStore, startPenaltyEventId)?.statusChanges.at(
      -1,
    )?.atMs;
    inbox.clock.letTimePass(5_000);

    // Act: undo the dismissal, then "No ar".
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: startPenaltyEventId });
    const eventRestored = readEvent(inbox.stateStore, startPenaltyEventId);
    const commandsLogged = readCommandsOfNewestLogRows(inbox.stateStore, 1);
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: startPenaltyEventId });

    // Assert: pending again, the change dated five seconds after the dismissal and logged;
    // then on air like any waiting event.
    expect(eventRestored?.status, 'the penalty waits again').toBe('pending');
    expect(eventRestored?.statusChanges.at(-1), 'the restore is dated').toEqual({
      status: 'pending',
      atMs: (dismissedAtMs ?? 0) + 5_000,
    });
    expect(commandsLogged, 'the restore is logged').toEqual(['restoreEvent']);
    expect(
      readEvent(inbox.stateStore, startPenaltyEventId)?.status,
      'a restored event can be shown',
    ).toBe('onAir');
  });

  it('brings it back pending even when its rule is automatic', () => {
    // Arrange: incidents on air by themselves; the penalty queued, then dismissed.
    const inbox = openInboxWithThePenalty('auto');
    const statusOnArrival = readEvent(inbox.stateStore, startPenaltyEventId)?.status;
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });

    // Act: undo the dismissal.
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: startPenaltyEventId });

    // Assert: it had arrived queued, and comes back for the operator, not the runner.
    expect(statusOnArrival, 'the auto rule had queued it').toBe('queued');
    expect(
      readEvent(inbox.stateStore, startPenaltyEventId)?.status,
      'a corrected mistake waits for the operator',
    ).toBe('pending');
  });
});

describe('restoreEvent and the rule as it is now', () => {
  it('brings a penalty back pending even when its rule is now "Ignorar"', () => {
    // Arrange: the penalty dismissed, then the incidents rule set to "Ignorar".
    const inbox = openInboxWithThePenalty('ask');
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind: 'newIncident',
      mode: 'ignore',
    });

    // Act: undo the dismissal.
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: startPenaltyEventId });

    // Assert: it waits for the operator, who asked for this one by name.
    expect(
      readEvent(inbox.stateStore, startPenaltyEventId)?.status,
      '"Ignorar" stops new events from being listed, not a restore asked for by name',
    ).toBe('pending');
  });

  it("refuses a penalty past its rule's maximum wait, and keeps it dismissed", () => {
    // Arrange: incidents may wait 2 min; the penalty dismissed, and 3 min gone by.
    const inbox = openInboxWithThePenalty('ask');
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind: 'newIncident',
      maxAgeMs: 120_000,
    });
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });
    inbox.clock.letTimePass(180_000);

    // Act: try to undo the dismissal.
    const outcome = inbox.stateStore.applyCommand(
      { type: 'restoreEvent', eventId: startPenaltyEventId },
      operatorActor,
    );

    // Assert: refused, saying why, rather than restored only to expire at "No ar".
    expect(outcome, 'too old to come back').toEqual({
      ok: false,
      error: {
        code: 'EVENT_TOO_OLD',
        message: 'Este evento passou da espera máxima da regra e não pode mais ser restaurado.',
      },
    });
    expect(readEvent(inbox.stateStore, startPenaltyEventId)?.status, 'still dismissed').toBe(
      'dismissed',
    );
  });

  it('restores a penalty hours later when its rule has no maximum wait', () => {
    // Arrange: incidents with no maximum wait (the default); dismissed, then 3 h go by.
    const inbox = openInboxWithThePenalty('ask');
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });
    inbox.clock.letTimePass(3 * 60 * 60 * 1_000);

    // Act: undo the dismissal.
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: startPenaltyEventId });

    // Assert: it waits again; a penalty stays news until the operator decides.
    expect(readEvent(inbox.stateStore, startPenaltyEventId)?.status, 'it waits again').toBe(
      'pending',
    );
  });
});

describe('refused restores', () => {
  const refusalScenarios = [
    // Two operators: the second press of "Desfazer" finds the event already waiting.
    {
      name: 'refuses to restore an event that is waiting',
      eventId: startPenaltyEventId,
      expectedError: {
        code: 'EVENT_NOT_DISMISSED',
        message: 'Este evento não pode ser trazido de volta: está esperando.',
      },
    },
    // An id the inbox no longer holds (it keeps its newest 200).
    {
      name: 'refuses an event the inbox does not hold',
      eventId: 'simulador-enduro:incident:nenhuma',
      expectedError: {
        code: 'EVENT_NOT_FOUND',
        message: 'Este evento não está na caixa de eventos.',
      },
    },
  ];

  it.each(refusalScenarios)('$name', ({ eventId, expectedError }) => {
    // Arrange: the penalty waiting.
    const inbox = openInboxWithThePenalty('ask');

    // Act: restore it.
    const outcome = inbox.stateStore.applyCommand({ type: 'restoreEvent', eventId }, operatorActor);

    // Assert: refused with this row's code and pt-BR reason.
    expect(outcome, 'the restore must be refused, saying why').toEqual({
      ok: false,
      error: expectedError,
    });
  });
});
