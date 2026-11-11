/**
 * "Mostrar de novo": its event-log row, and what cannot come back (apps/server)
 *
 * What this module is for:
 *   restoreEvent brings back a dismissed, shown or expired event (BAJAOVRLAY-67). The
 *   history must tell "Mostrar de novo" from an undone "Descartar", so the row's details
 *   say which status the event came back from; and an event still waiting, or on air, has
 *   nothing to come back from.
 *
 * What these tests prove:
 *   - The event-log row's details say the event came back from shown, expired or
 *     dismissed.
 *   - An event waiting or on air cannot be brought back (EVENT_NOT_DISMISSED), the reason
 *     saying where it is, in pt-BR.
 *
 * What these tests deliberately do not cover:
 *   - Where a restored event lands, and who may send it; showEventAgainOnTheStore.test.ts.
 *   - How the history reads the row; the shared package's sentencesOfSourcesAndData.test.ts.
 */
import type { InboxEventKind, InboxEventStatus } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { applyOrThrow, type EventInboxOnTheStore } from './eventInboxOnTheStore.testSupport.js';
import {
  eventIdOfKind,
  type KindInTheseTests,
  letExpire,
  openInboxWithAnEventOfEachKind,
  producerActor,
  showAndClear,
} from './showEventAgain.testSupport.js';

describe('the event-log row of "Mostrar de novo"', () => {
  const restoredFromScenarios: Array<{
    name: string;
    kind: InboxEventKind & KindInTheseTests;
    prepare: (inbox: EventInboxOnTheStore) => void;
    expectedRestoredFrom: InboxEventStatus;
  }> = [
    // The row the history reads as "já exibido".
    {
      name: 'says the event was shown before',
      kind: 'newIncident',
      prepare: (inbox) => showAndClear(inbox, 'newIncident'),
      expectedRestoredFrom: 'shown',
    },
    // The row the history reads as "expirado".
    {
      name: 'says the event had expired',
      kind: 'newIncident',
      prepare: (inbox) => letExpire(inbox, 'newIncident', false),
      expectedRestoredFrom: 'expired',
    },
    // An undone "Descartar" says so too, for the history to tell the two apart.
    {
      name: 'says the event had been dismissed',
      kind: 'newIncident',
      prepare: (inbox) =>
        applyOrThrow(inbox.stateStore, {
          type: 'dismissEvent',
          eventId: eventIdOfKind.newIncident,
        }),
      expectedRestoredFrom: 'dismissed',
    },
  ];

  it.each(restoredFromScenarios)('$name', ({ kind, prepare, expectedRestoredFrom }) => {
    // Arrange: the penalty where the row takes it.
    const inbox = openInboxWithAnEventOfEachKind();
    prepare(inbox);

    // Act: bring it back.
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: eventIdOfKind[kind] });

    // Assert: the row's details say where it came back from.
    const newestRow = inbox.stateStore.readAllSlices().eventLog.at(-1);
    expect(newestRow?.command, 'the newest row is the restore').toBe('restoreEvent');
    expect(newestRow?.details, 'the row must say where the event came back from').toEqual({
      restoredFrom: expectedRestoredFrom,
    });
  });
});

describe('events that cannot be brought back', () => {
  const refusalScenarios = [
    // Still waiting: there is nothing to bring back.
    {
      name: 'refuses an event that is waiting',
      prepare: () => undefined,
      expectedMessage: 'Este evento não pode ser trazido de volta: está esperando.',
    },
    // On air right now: "Mostrar de novo" is for after it leaves.
    {
      name: 'refuses an event that is on air',
      prepare: (inbox: EventInboxOnTheStore) =>
        applyOrThrow(inbox.stateStore, {
          type: 'showEvent',
          eventId: eventIdOfKind.newIncident,
        }),
      expectedMessage: 'Este evento não pode ser trazido de volta: está no ar.',
    },
  ];

  it.each(refusalScenarios)('$name', ({ prepare, expectedMessage }) => {
    // Arrange: the penalty waiting, then whatever this row does to it.
    const inbox = openInboxWithAnEventOfEachKind();
    prepare(inbox);

    // Act: try to bring it back.
    const outcome = inbox.stateStore.applyCommand(
      { type: 'restoreEvent', eventId: eventIdOfKind.newIncident },
      producerActor,
    );

    // Assert: refused, saying where the event is.
    expect(outcome, 'the restore must be refused, saying why').toEqual({
      ok: false,
      error: { code: 'EVENT_NOT_DISMISSED', message: expectedMessage },
    });
  });
});
