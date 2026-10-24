/**
 * An event's Prévia never reaches the air once the event is over (apps/server)
 *
 * What this module is for:
 *   "Prévia" of an event in the inbox fills the rule's item from that event, and "Tomar"
 *   on that preview shows the event (BAJAOVRLAY-44). Gate 2 of PR #22 closed the ways an
 *   event could reach the air after the operator, or the clock, decided against it: a
 *   dismissed event takes its preview away; a preview cannot be made of an event that no
 *   longer waits; and "Tomar" or "Tomar tudo" refuse a preview whose event no longer waits
 *   or is past its rule's maximum wait, as "No ar" would expire it.
 *
 * What these tests prove:
 *   - "Descartar" removes the event's preview.
 *   - "Prévia" of a dismissed event is refused (EVENT_NOT_WAITING).
 *   - "Tomar" on the preview of an event already put on air with "No ar" is refused.
 *   - "Tomar" and "Tomar tudo" on the preview of an event past its maximum wait are refused,
 *     and nothing goes on air.
 *
 * What these tests deliberately do not cover:
 *   - Previews of items filled from a sample; eventFieldsOnTheStore.test.ts.
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
} from './eventInboxOnTheStore.testSupport.js';

/** The id the inbox gives car 47's start penalty from the simulator. */
const startPenaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';

/**
 * An inbox whose incidents are shown with a template race clock for at most 2 minutes of
 * waiting, with car 47's penalty waiting and previewed ("Prévia" in the Eventos tab).
 */
function openInboxWithThePenaltyPreviewed(): EventInboxOnTheStore & { itemId: string } {
  const inbox = openEventInboxOnTheStore();
  const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — aviso');
  applyOrThrow(inbox.stateStore, {
    type: 'updateEventRule',
    kind: 'newIncident',
    itemId,
    maxAgeMs: 120_000,
  });
  pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
  pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));
  applyOrThrow(inbox.stateStore, { type: 'previewItem', itemId, eventId: startPenaltyEventId });
  return { ...inbox, itemId };
}

/** The instances on the clock layer of this output. */
function readClockLayer(inbox: EventInboxOnTheStore, target: 'program' | 'preview') {
  return inbox.stateStore
    .readAllSlices()
    .instances.filter((instance) => instance.layerId === 'clock' && instance.target === target);
}

describe("an event's Prévia", () => {
  it('goes away when the event is dismissed', () => {
    // Arrange: the penalty waiting and previewed.
    const inbox = openInboxWithThePenaltyPreviewed();

    // Act: "Descartar".
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });

    // Assert: no preview left that "Tomar" could put on air.
    expect(readClockLayer(inbox, 'preview'), 'the dismissed event must leave Prévia').toEqual([]);
  });

  it('cannot be made of an event that no longer waits', () => {
    // Arrange: the penalty previewed, then dismissed.
    const inbox = openInboxWithThePenaltyPreviewed();
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });

    // Act: "Prévia" of it again.
    const outcome = inbox.stateStore.applyCommand(
      { type: 'previewItem', itemId: inbox.itemId, eventId: startPenaltyEventId },
      operatorActor,
    );

    // Assert: refused, saying why.
    expect(outcome, 'a dismissed event has nothing to preview').toEqual({
      ok: false,
      error: {
        code: 'EVENT_NOT_WAITING',
        message: 'Este evento não está mais esperando: foi descartado.',
      },
    });
  });

  it('cannot be taken once the event went on air with "No ar"', () => {
    // Arrange: the penalty previewed, then put on air with "No ar".
    const inbox = openInboxWithThePenaltyPreviewed();
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: startPenaltyEventId });

    // Act: "Tomar" on the preview.
    const outcome = inbox.stateStore.applyCommand(
      { type: 'takePreview', layerId: 'clock' },
      operatorActor,
    );

    // Assert: refused: the event is shown once.
    expect(outcome, 'an event already on air is not shown twice').toEqual({
      ok: false,
      error: {
        code: 'EVENT_NOT_WAITING',
        message: 'Este evento não está mais esperando: já está no ar.',
      },
    });
  });

  const tooOldScenarios = [
    // "Tomar" under the Prévia monitor.
    {
      name: '"Tomar" is refused past the maximum wait',
      command: { type: 'takePreview', layerId: 'clock' },
    },
    // "Tomar tudo", the whole set in one cut.
    { name: '"Tomar tudo" is refused past the maximum wait', command: { type: 'takeAllPreviews' } },
  ];

  it.each(tooOldScenarios)('$name', ({ command }) => {
    // Arrange: the penalty previewed, and three minutes gone by (its rule waits two).
    const inbox = openInboxWithThePenaltyPreviewed();
    inbox.clock.letTimePass(180_000);

    // Act: take the preview.
    const outcome = inbox.stateStore.applyCommand(command, operatorActor);

    // Assert: refused as too old ("Tomar tudo" names the layer first), and nothing on
    // air: never shown late.
    const error = outcome.ok ? undefined : outcome.error;
    expect(error?.code, 'an event past its maximum wait must not go on air').toBe(
      'EVENT_NOT_WAITING',
    );
    expect(error?.message, 'the refusal must say it waited too long').toMatch(
      /Este evento não está mais esperando: passou da espera máxima da regra\.$/,
    );
    expect(readClockLayer(inbox, 'program'), 'nothing may go on air late').toEqual([]);
  });
});
