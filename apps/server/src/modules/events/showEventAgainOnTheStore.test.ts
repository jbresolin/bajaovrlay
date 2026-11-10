/**
 * "Mostrar de novo": an event already shown, or expired, brought back (apps/server)
 *
 * What this module is for:
 *   The commentators may want to come back to a penalty shown ten minutes ago
 *   (BAJAOVRLAY-67). restoreEvent, until then the undo of "Descartar", now also takes a
 *   shown or expired event back to wait for the operator, who puts it on air with "No ar"
 *   or "Prévia". It never goes on air by itself, whatever its rule says. A Super Chat that
 *   a person had approved comes back approved, ready for "No ar"; one that was discarded,
 *   or never approved, comes back waiting for approval again. Each restore is recorded on
 *   the event, and the rule's maximum wait is measured from the latest one, so a fastest
 *   lap brought back ten minutes later does not expire the moment "No ar" is pressed.
 *
 * What these tests prove, through a real store on a temporary database:
 *   - Table-driven by status, kind and role: where each restore lands, and who may send it
 *     (the Produtor any; Dados only a discarded Super Chat, as since BAJAOVRLAY-35).
 *   - The maximum wait is measured from the restore: "No ar" right after shows the event;
 *     after the wait has passed again, "No ar" expires it.
 *   - Every restore's moment is kept on the event, in order.
 *   - A restored event stays waiting under an automatic rule: the runner never shows it.
 *   - The event-log row says the event was brought back after being shown.
 *   - An event waiting or on air cannot be brought back (EVENT_NOT_DISMISSED).
 *
 * What these tests deliberately do not cover:
 *   - Restoring a dismissed event, and EVENT_TOO_OLD on one; restoreEventOnTheStore.test.ts.
 *   - The "Mostrar de novo" button; the control page's EventHistoryShowAgain.test.tsx.
 */
import type { EventPayloadPath, InboxEventKind, InboxEventStatus } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { eventInboxActor } from '../../core/store/commandActors.js';
import type { CommandOutcome } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  type EventInboxOnTheStore,
  openEventInboxOnTheStore,
  readEvent,
  typedEventId,
} from './eventInboxOnTheStore.testSupport.js';

/** The Produtor at the main desk, logged in with a PIN. */
const producerActor = 'produtor:Mesa 1';

/** Dados at the second desk, reading the chat. */
const dataRoleActor = 'dados:Mesa 2';

/** The id of each kind's event in these tests. */
const eventIdOfKind: Record<'newIncident' | 'fastestLap' | 'manual' | 'superChat', string> = {
  newIncident: 'simulador-enduro:incident:ocorrencia-0007',
  fastestLap: 'simulador-enduro:fastestLap:31-29',
  manual: `manual:${typedEventId}`,
  superChat: 'youtube-ao-vivo:superChat:mensagem-pequi-0001',
};

type KindInTheseTests = keyof typeof eventIdOfKind;

/** The payload field each kind's item reads, one the kind's event carries. */
const pathReadByTheItemOfKind: Record<KindInTheseTests, EventPayloadPath> = {
  newIncident: 'teamName',
  fastestLap: 'teamName',
  manual: 'reason',
  superChat: 'authorName',
};

/**
 * An inbox with every rule asking, each with a clock item reading a field its event has,
 * no maximum wait, and one event of each kind waiting: car 47's start penalty, car 31's
 * fastest lap, a general notice typed in "+ Evento" and a fictional viewer's Super Chat.
 */
function openInboxWithAnEventOfEachKind(): EventInboxOnTheStore {
  const inbox = openEventInboxOnTheStore();
  for (const kind of Object.keys(eventIdOfKind) as KindInTheseTests[]) {
    const itemId = createClockItemForEvents(inbox.stateStore, `Relógio — ${kind}`, {
      sessionName: { kind: 'eventField', path: pathReadByTheItemOfKind[kind] },
    });
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind,
      mode: 'ask',
      itemId,
      maxAgeMs: null,
    });
  }
  const detectedAtMs = inbox.clock.readCurrentTime().getTime();
  applyOrThrow(
    inbox.stateStore,
    {
      type: 'recordDetectedEvents',
      events: [
        {
          eventId: eventIdOfKind.newIncident,
          kind: 'newIncident',
          sourceId: 'simulador-enduro',
          detectedAtMs,
          payload: {
            carNumber: 47,
            teamName: 'Carnaúba Baja',
            noticeKind: 'penalty',
            reason: 'Queima de largada',
            penaltyText: '+30 segundos',
          },
        },
        {
          eventId: eventIdOfKind.fastestLap,
          kind: 'fastestLap',
          sourceId: 'simulador-enduro',
          detectedAtMs,
          payload: { carNumber: 31, teamName: 'Acauã Baja', lapNumber: 29, lapTimeText: '4:38,2' },
        },
        {
          eventId: eventIdOfKind.superChat,
          kind: 'superChat',
          sourceId: 'youtube-ao-vivo',
          detectedAtMs,
          payload: {
            authorName: 'Torcida Pequi Off-Road',
            amountText: 'R$ 20,00',
            messageText: 'Vai, Pequi! Abraço de Goiânia',
          },
        },
      ],
    },
    eventInboxActor,
  );
  applyOrThrow(inbox.stateStore, {
    type: 'createManualEvent',
    noticeKind: 'notice',
    reason: 'Largada adiada em 15 minutos',
  });
  return inbox;
}

/** The kind's event shown and off the air again: "No ar" (after "Aprovar"), then cleared. */
function showAndClear(inbox: EventInboxOnTheStore, kind: KindInTheseTests): void {
  if (kind === 'superChat') {
    applyOrThrow(inbox.stateStore, { type: 'approveEvent', eventId: eventIdOfKind.superChat });
  }
  applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: eventIdOfKind[kind] });
  applyOrThrow(inbox.stateStore, { type: 'clearLayer', layerId: 'clock' });
}

/**
 * The kind's event expired: its rule given a one-minute wait, two minutes gone by, and
 * "No ar" pressed too late. A Super Chat is approved first when `isApprovedFirst`.
 */
function letExpire(
  inbox: EventInboxOnTheStore,
  kind: KindInTheseTests,
  isApprovedFirst: boolean,
): void {
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind, maxAgeMs: 60_000 });
  if (isApprovedFirst) {
    applyOrThrow(inbox.stateStore, { type: 'approveEvent', eventId: eventIdOfKind[kind] });
  }
  inbox.clock.letTimePass(120_000);
  applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: eventIdOfKind[kind] });
}

/** 'ok', or the error code of a refused outcome. */
function readOutcomeCode(outcome: CommandOutcome): string {
  return outcome.ok ? 'ok' : outcome.error.code;
}

type ShowAgainScenario = {
  name: string;
  kind: KindInTheseTests;
  /** What happened to the event before the restore. */
  prepare: (inbox: EventInboxOnTheStore) => void;
  actor: string;
  /** The outcome's error code, or 'ok'. */
  expectedOutcome: string;
  expectedStatus: InboxEventStatus;
};

const showAgainScenarios: ShowAgainScenario[] = [
  // The reason for the feature: the commentators come back to a penalty shown earlier.
  {
    name: 'the Produtor brings back a shown penalty, which waits for "No ar"',
    kind: 'newIncident',
    prepare: (inbox) => showAndClear(inbox, 'newIncident'),
    actor: producerActor,
    expectedOutcome: 'ok',
    expectedStatus: 'pending',
  },
  // A penalty nobody showed in time can still be shown on purpose, later.
  {
    name: 'the Produtor brings back an expired penalty, which waits for "No ar"',
    kind: 'newIncident',
    prepare: (inbox) => letExpire(inbox, 'newIncident', false),
    actor: producerActor,
    expectedOutcome: 'ok',
    expectedStatus: 'pending',
  },
  // Another race kind, the one whose rule is automatic by default.
  {
    name: 'the Produtor brings back a shown fastest lap, which waits for "No ar"',
    kind: 'fastestLap',
    prepare: (inbox) => showAndClear(inbox, 'fastestLap'),
    actor: producerActor,
    expectedOutcome: 'ok',
    expectedStatus: 'pending',
  },
  // A typed general notice, about no car, comes back like any typed event.
  {
    name: 'the Produtor brings back a shown general notice, which waits for "No ar"',
    kind: 'manual',
    prepare: (inbox) => showAndClear(inbox, 'manual'),
    actor: producerActor,
    expectedOutcome: 'ok',
    expectedStatus: 'pending',
  },
  // A person approved it before it was shown: it needs no second approval.
  {
    name: 'the Produtor brings back a shown Super Chat, which comes back approved',
    kind: 'superChat',
    prepare: (inbox) => showAndClear(inbox, 'superChat'),
    actor: producerActor,
    expectedOutcome: 'ok',
    expectedStatus: 'approved',
  },
  // Approved, then left too long: the approval still stands.
  {
    name: 'the Produtor brings back a Super Chat that expired after approval, approved',
    kind: 'superChat',
    prepare: (inbox) => letExpire(inbox, 'superChat', true),
    actor: producerActor,
    expectedOutcome: 'ok',
    expectedStatus: 'approved',
  },
  // Never approved: nothing a viewer wrote may skip a person's approval.
  {
    name: 'the Produtor brings back a Super Chat that expired unapproved, awaiting approval',
    kind: 'superChat',
    prepare: (inbox) => letExpire(inbox, 'superChat', false),
    actor: producerActor,
    expectedOutcome: 'ok',
    expectedStatus: 'pending',
  },
  // As built in BAJAOVRLAY-35: a discarded Super Chat needs approving again.
  {
    name: 'the Produtor brings back a discarded Super Chat, awaiting approval',
    kind: 'superChat',
    prepare: (inbox) =>
      applyOrThrow(inbox.stateStore, { type: 'dismissEvent', eventId: eventIdOfKind.superChat }),
    actor: producerActor,
    expectedOutcome: 'ok',
    expectedStatus: 'pending',
  },
  // Dados keeps undoing the discards of its own moderation.
  {
    name: 'Dados brings back a discarded Super Chat, awaiting approval',
    kind: 'superChat',
    prepare: (inbox) =>
      applyOrThrow(
        inbox.stateStore,
        { type: 'dismissEvent', eventId: eventIdOfKind.superChat },
        dataRoleActor,
      ),
    actor: dataRoleActor,
    expectedOutcome: 'ok',
    expectedStatus: 'pending',
  },
  // Showing something again is a decision about the air: the Produtor's, not Dados's.
  {
    name: 'Dados may not bring back a shown Super Chat',
    kind: 'superChat',
    prepare: (inbox) => showAndClear(inbox, 'superChat'),
    actor: dataRoleActor,
    expectedOutcome: 'NOT_ALLOWED',
    expectedStatus: 'shown',
  },
  // The race's events stay the Produtor's.
  {
    name: 'Dados may not bring back a shown penalty',
    kind: 'newIncident',
    prepare: (inbox) => showAndClear(inbox, 'newIncident'),
    actor: dataRoleActor,
    expectedOutcome: 'NOT_ALLOWED',
    expectedStatus: 'shown',
  },
];

describe('"Mostrar de novo", by status, kind and role', () => {
  it.each(showAgainScenarios)(
    '$name',
    ({ kind, prepare, actor, expectedOutcome, expectedStatus }) => {
      // Arrange: one event of each kind, and this row's event taken where the row says.
      const inbox = openInboxWithAnEventOfEachKind();
      prepare(inbox);

      // Act: the row's actor brings the event back.
      const outcome = inbox.stateStore.applyCommand(
        { type: 'restoreEvent', eventId: eventIdOfKind[kind] },
        actor,
      );

      // Assert: accepted or refused as the row says, and the event left where it says.
      expect(readOutcomeCode(outcome), `restoreEvent by ${actor}`).toBe(expectedOutcome);
      expect(
        readEvent(inbox.stateStore, eventIdOfKind[kind])?.status,
        'the event must be left in this status',
      ).toBe(expectedStatus);
    },
  );
});

describe('the maximum wait after "Mostrar de novo"', () => {
  it('shows a fastest lap brought back ten minutes after it was shown', () => {
    // Arrange: fastest laps wait two minutes at most; car 31's shown, then 10 min go by.
    const inbox = openInboxWithAnEventOfEachKind();
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind: 'fastestLap',
      maxAgeMs: 120_000,
    });
    showAndClear(inbox, 'fastestLap');
    inbox.clock.letTimePass(10 * 60_000);

    // Act: bring it back, then "No ar" at once.
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: eventIdOfKind.fastestLap });
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: eventIdOfKind.fastestLap });

    // Assert: on air, since its wait counts from the restore, not from its detection.
    expect(
      readEvent(inbox.stateStore, eventIdOfKind.fastestLap)?.status,
      'a fastest lap brought back must not expire the moment "No ar" is pressed',
    ).toBe('onAir');
  });

  it('expires a fastest lap brought back and then left past its wait again', () => {
    // Arrange: the same fastest lap, shown, 10 min later brought back, then 3 min go by.
    const inbox = openInboxWithAnEventOfEachKind();
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind: 'fastestLap',
      maxAgeMs: 120_000,
    });
    showAndClear(inbox, 'fastestLap');
    inbox.clock.letTimePass(10 * 60_000);
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: eventIdOfKind.fastestLap });
    inbox.clock.letTimePass(3 * 60_000);

    // Act: "No ar", three minutes after bringing it back.
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: eventIdOfKind.fastestLap });

    // Assert: expired, never shown late: two minutes from the restore have passed.
    expect(
      readEvent(inbox.stateStore, eventIdOfKind.fastestLap)?.status,
      'the wait from the restore has passed, so it expires',
    ).toBe('expired');
  });

  it('keeps the moment of each restore on the event, in order', () => {
    // Arrange: the penalty shown, brought back 5 min later, shown again.
    const inbox = openInboxWithAnEventOfEachKind();
    const startMs = inbox.clock.readCurrentTime().getTime();
    showAndClear(inbox, 'newIncident');
    inbox.clock.letTimePass(5 * 60_000);
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: eventIdOfKind.newIncident });
    showAndClear(inbox, 'newIncident');
    inbox.clock.letTimePass(5 * 60_000);

    // Act: bring it back a second time, 10 min after the start.
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: eventIdOfKind.newIncident });

    // Assert: both restores recorded, oldest first.
    expect(
      readEvent(inbox.stateStore, eventIdOfKind.newIncident)?.restoresAtMs,
      'each restore must be kept with its moment',
    ).toEqual([startMs + 5 * 60_000, startMs + 10 * 60_000]);
  });
});

describe('a restored event and an automatic rule', () => {
  it('never goes on air by itself after "Mostrar de novo"', () => {
    // Arrange: the fastest lap shown, then its rule set to automatic.
    const inbox = openInboxWithAnEventOfEachKind();
    showAndClear(inbox, 'fastestLap');
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'fastestLap', mode: 'auto' });

    // Act: bring it back, and let the runner's timers run for a minute.
    applyOrThrow(inbox.stateStore, { type: 'restoreEvent', eventId: eventIdOfKind.fastestLap });
    inbox.clock.letTimePass(60_000);
    inbox.clock.runTheTimersDueNow();

    // Assert: still waiting for the operator, the clock layer empty.
    expect(
      readEvent(inbox.stateStore, eventIdOfKind.fastestLap)?.status,
      'only the operator puts a restored event on air',
    ).toBe('pending');
    expect(
      inbox.stateStore.readAllSlices().instances.filter((instance) => instance.layerId === 'clock'),
      'nothing went on air by itself',
    ).toEqual([]);
  });
});

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
