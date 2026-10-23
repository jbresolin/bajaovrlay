/**
 * Showing, dismissing, expiring and typing events, through a real store (apps/server)
 *
 * What this module is for:
 *   An event waits in the inbox until someone decides. showEvent ("No ar") takes the
 *   item its rule names onto the program output, leaving after the rule's duration, and
 *   the instance carries the event's id, so the event is on air while that instance is
 *   and is shown once it leaves. dismissEvent ("Descartar") says no. An event older than
 *   its rule's maxAgeMs is expired instead of shown: never shown late. createManualEvent
 *   ("+ Evento") types an event by hand, its team and school read from the sources.
 *
 * What these tests prove:
 *   - "No ar" on a pending penalty puts the rule's item on the program output, with the
 *     event's id and the rule's 10 s as the instance's own auto-out; the event is on air,
 *     its two statuses dated, and the command is logged.
 *   - Clearing the layer makes the event shown.
 *   - "Descartar" dismisses it, logged; a dismissed event can be neither shown nor
 *     dismissed again (EVENT_NOT_WAITING, saying why in pt-BR).
 *   - An unknown event is refused (EVENT_NOT_FOUND); so is one whose rule has no item yet
 *     (EVENT_RULE_WITHOUT_ITEM, naming the kind).
 *   - An event past its rule's max age is expired by "No ar", and nothing goes on air.
 *   - A manual penalty is listed as pending with its own id, no source, and the team and
 *     school of the car as the simulator lists them.
 *
 * What these tests deliberately do not cover:
 *   - How events are detected; eventDetectionOnTheStore.test.ts.
 *   - The runner that shows queued events by itself; eventRunner.test.ts.
 *   - Filling the item's fields from the event (eventField); that arrives with the
 *     template items and has its own tests. Here the item is a plain race clock.
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
  pollTheSimulator,
  readCommandsOfNewestLogRows,
  readEvent,
  startOfTheTests,
} from './eventInboxOnTheStore.testSupport.js';

/** The id the inbox gives car 47's start penalty from the simulator. */
const startPenaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';

/** When the penalty arrives in these tests: one minute after the start of the tests. */
const penaltyArrivedAtMs = Date.parse(startOfTheTests) + 60_000;

/**
 * An inbox whose incidents rule shows events with a race clock item ("Relógio — aviso"),
 * and car 47's penalty waiting in it, arrived at 14:01.
 */
function openInboxWithThePenaltyWaiting(): EventInboxOnTheStore & { itemId: string } {
  const inbox = openEventInboxOnTheStore();
  const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — aviso');
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId });
  pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
  inbox.clock.letTimePass(60_000);
  pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));
  return { ...inbox, itemId };
}

describe('showEvent, "No ar"', () => {
  it("puts the rule's item on air with the event's id and the rule's duration", () => {
    // Arrange: the penalty waiting, and ten seconds for the operator to look at it.
    const inbox = openInboxWithThePenaltyWaiting();
    inbox.clock.letTimePass(10_000);

    // Act: the operator presses "No ar".
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: startPenaltyEventId });

    // Assert: the item is on the program output carrying the event and its duration, the
    // event is on air with that instance, and the command is logged.
    const shownAtMs = penaltyArrivedAtMs + 10_000;
    const instance = inbox.stateStore
      .readAllSlices()
      .instances.find((candidate) => candidate.target === 'program');
    expect(instance?.itemId, "the rule's item must be on air").toBe(inbox.itemId);
    expect(instance?.eventId, "the instance must carry the event's id").toBe(startPenaltyEventId);
    expect(instance?.autoOutAfterMs, "the rule's 10 s must be the instance's auto-out").toBe(
      10_000,
    );
    const event = readEvent(inbox.stateStore, startPenaltyEventId);
    expect(event?.status, 'the event must be on air').toBe('onAir');
    expect(event?.instanceId, 'the event must name the instance showing it').toBe(instance?.id);
    expect(event?.statusChanges, 'both statuses must be dated').toEqual([
      { status: 'pending', atMs: penaltyArrivedAtMs },
      { status: 'onAir', atMs: shownAtMs },
    ]);
    expect(readCommandsOfNewestLogRows(inbox.stateStore, 1), 'the show is logged').toEqual([
      'showEvent',
    ]);
  });

  it('marks the event shown when its graphic leaves the air', () => {
    // Arrange: the penalty on air.
    const inbox = openInboxWithThePenaltyWaiting();
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: startPenaltyEventId });

    // Act: eight seconds later the clock layer is cleared ("Limpar" in Camadas).
    inbox.clock.letTimePass(8_000);
    applyOrThrow(inbox.stateStore, { type: 'clearLayer', layerId: 'clock' });

    // Assert: shown, at the moment it left, with no instance any more.
    const event = readEvent(inbox.stateStore, startPenaltyEventId);
    expect(event?.status, 'an event whose graphic left the air is shown').toBe('shown');
    expect(event?.statusChanges.at(-1), 'shown at the moment of the clear').toEqual({
      status: 'shown',
      atMs: penaltyArrivedAtMs + 8_000,
    });
    expect(event?.instanceId, 'a shown event names no instance').toBe(undefined);
  });

  it('expires an event older than its max age instead of showing it late', () => {
    // Arrange: the incidents rule with a max age of 2 minutes, and 3 minutes gone by.
    const inbox = openInboxWithThePenaltyWaiting();
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind: 'newIncident',
      maxAgeMs: 120_000,
    });
    inbox.clock.letTimePass(180_000);

    // Act: "No ar" at last.
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: startPenaltyEventId });

    // Assert: expired, logged, and nothing went on air.
    expect(readEvent(inbox.stateStore, startPenaltyEventId)?.status, 'too old to show').toBe(
      'expired',
    );
    expect(readCommandsOfNewestLogRows(inbox.stateStore, 1), 'the expiry is logged').toEqual([
      'showEvent',
    ]);
    expect(inbox.stateStore.readAllSlices().instances, 'nothing may go on air late').toEqual([]);
  });
});

describe('dismissEvent, "Descartar"', () => {
  it('dismisses a pending penalty and logs it', () => {
    // Arrange: the penalty waiting.
    const inbox = openInboxWithThePenaltyWaiting();

    // Act: the operator presses "Descartar".
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });

    // Assert: dismissed at that moment, and logged.
    const event = readEvent(inbox.stateStore, startPenaltyEventId);
    expect(event?.status, 'the event must be dismissed').toBe('dismissed');
    expect(event?.statusChanges.at(-1)?.atMs, 'dismissed now').toBe(penaltyArrivedAtMs);
    expect(readCommandsOfNewestLogRows(inbox.stateStore, 1), 'the dismissal is logged').toEqual([
      'dismissEvent',
    ]);
  });
});

describe('refused inbox commands', () => {
  const refusalScenarios = [
    // A dismissed penalty must not reach the air by a late press of "No ar".
    {
      name: 'refuses to show a dismissed event',
      commandAfterDismissal: { type: 'showEvent', eventId: startPenaltyEventId },
      expectedError: {
        code: 'EVENT_NOT_WAITING',
        message: 'Este evento não está mais esperando: foi descartado.',
      },
    },
    // Two operators pressing "Descartar" at once: the second press is told why.
    {
      name: 'refuses to dismiss it again',
      commandAfterDismissal: { type: 'dismissEvent', eventId: startPenaltyEventId },
      expectedError: {
        code: 'EVENT_NOT_WAITING',
        message: 'Este evento não está mais esperando: foi descartado.',
      },
    },
    // An id the inbox never had (a page showing an event the server dropped).
    {
      name: 'refuses an event the inbox does not hold',
      commandAfterDismissal: { type: 'showEvent', eventId: 'simulador-enduro:incident:nenhuma' },
      expectedError: {
        code: 'EVENT_NOT_FOUND',
        message: 'Este evento não está na caixa de eventos.',
      },
    },
  ];

  it.each(refusalScenarios)('$name', ({ commandAfterDismissal, expectedError }) => {
    // Arrange: the penalty waiting, then dismissed.
    const inbox = openInboxWithThePenaltyWaiting();
    applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: startPenaltyEventId });

    // Act: send this row's command.
    const outcome = inbox.stateStore.applyCommand(
      commandAfterDismissal,
      'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81',
    );

    // Assert: refused with this row's code and pt-BR reason.
    expect(outcome, 'the command must be refused, saying why').toEqual({
      ok: false,
      error: expectedError,
    });
  });

  it('refuses to show an event whose rule has no item yet', () => {
    // Arrange: the incidents rule left with no item ("Regras" set it to none), and the
    // penalty waiting.
    const inbox = openEventInboxOnTheStore();
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId: null });
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));

    // Act: "No ar".
    const outcome = inbox.stateStore.applyCommand(
      { type: 'showEvent', eventId: startPenaltyEventId },
      'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81',
    );

    // Assert: refused, saying which rule needs an item and where to choose one.
    expect(outcome, 'nothing can go on air without an item').toEqual({
      ok: false,
      error: {
        code: 'EVENT_RULE_WITHOUT_ITEM',
        message:
          'A regra "Ocorrência" não tem item para exibir o evento. Escolha um item em Regras.',
      },
    });
  });
});

describe('createManualEvent, "+ Evento"', () => {
  it('lists a typed penalty as pending, with the team and school the simulator lists', () => {
    // Arrange: the simulator's positions known, car 47 among them.
    const inbox = openEventInboxOnTheStore();
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));

    // Act: the operator types a penalty for car 47, without its team or school.
    applyOrThrow(inbox.stateStore, {
      type: 'createManualEvent',
      noticeKind: 'penalty',
      carNumber: 47,
      reason: 'Reabastecimento com o motor ligado',
      penaltyText: '+120 segundos',
    });

    // Assert: one manual event, no source, the car's team and school filled in, waiting.
    expect(inbox.stateStore.readAllSlices().events, 'the typed penalty must wait').toEqual([
      {
        eventId: 'manual:7d0e4a52-9c1b-4f36-8e2a-5b3c1d9f0a68',
        kind: 'manual',
        sourceId: null,
        detectedAtMs: Date.parse(startOfTheTests),
        payload: {
          carNumber: 47,
          teamName: 'Carnaúba Baja',
          schoolName: 'UFERSA',
          noticeKind: 'penalty',
          reason: 'Reabastecimento com o motor ligado',
          penaltyText: '+120 segundos',
        },
        status: 'pending',
        statusChanges: [{ status: 'pending', atMs: Date.parse(startOfTheTests) }],
      },
    ]);
  });

  it('keeps what the operator typed, and leaves out a team nobody lists', () => {
    // Arrange: no poll yet, so no source lists any car.
    const inbox = openEventInboxOnTheStore();

    // Act: a notice for car 12, its school typed, its team not.
    applyOrThrow(inbox.stateStore, {
      type: 'createManualEvent',
      noticeKind: 'notice',
      carNumber: 12,
      schoolName: 'UTFPR',
      reason: 'Carro parado na reta dos boxes',
    });

    // Assert: the school as typed, no team, no penalty.
    expect(inbox.stateStore.readAllSlices().events[0]?.payload, 'only what is known').toEqual({
      carNumber: 12,
      schoolName: 'UTFPR',
      noticeKind: 'notice',
      reason: 'Carro parado na reta dos boxes',
    });
  });
});
