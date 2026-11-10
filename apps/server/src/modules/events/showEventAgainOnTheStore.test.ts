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
 *
 * What these tests deliberately do not cover:
 *   - Restoring a dismissed event, and EVENT_TOO_OLD on one; restoreEventOnTheStore.test.ts.
 *   - The "Mostrar de novo" button; the control page's EventHistoryShowAgain.test.tsx.
 *   - The event-log row of a restore, and the events that cannot come back;
 *     showEventAgainLogAndRefusalsOnTheStore.test.ts.
 */
import type { InboxEventStatus } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { CommandOutcome } from '../../core/store/createStateStore.js';
import {
  applyOrThrow,
  type EventInboxOnTheStore,
  readEvent,
} from './eventInboxOnTheStore.testSupport.js';
import {
  dataRoleActor,
  eventIdOfKind,
  type KindInTheseTests,
  letExpire,
  openInboxWithAnEventOfEachKind,
  producerActor,
  showAndClear,
} from './showEventAgain.testSupport.js';

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
